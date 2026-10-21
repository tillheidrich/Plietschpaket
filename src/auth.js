import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db, newId, audit } from './db.js';
import { config } from './config.js';

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = 'ss_session';

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, saltB64, keyB64] = stored.split('$');
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 10) {
    return 'Das Passwort muss mindestens 10 Zeichen lang sein.';
  }
  return null;
}

export const publicUser = (u) =>
  u ? { id: u.id, email: u.email, name: u.name, role: u.role, language: u.language || 'de', active: !!u.active, createdAt: u.created_at, lastLoginAt: u.last_login_at } : null;

export async function seedAdmin() {
  const { email, password, name } = config.seedAdmin;
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0 || !email || !password) {
    if (count === 0) {
      console.warn('[auth] Keine Nutzer vorhanden. ADMIN_EMAIL und ADMIN_PASSWORD setzen, um den ersten Admin anzulegen.');
    }
    return;
  }
  const id = newId('u_');
  db.prepare("INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, 'admin')").run(
    id,
    email,
    name,
    await hashPassword(password)
  );
  audit(id, 'user.seed_admin', id);
  console.log(`[auth] Erster Admin angelegt: ${email}`);
}

export function createSession(res, userId) {
  const token = randomToken();
  const csrf = randomToken(18);
  const expires = Date.now() + config.sessionDays * 86400_000;
  db.prepare('INSERT INTO sessions (id, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)').run(sha256(token), userId, csrf, expires);
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(userId);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    maxAge: config.sessionDays * 86400_000,
    path: '/'
  });
  return csrf;
}

export function destroySession(req, res) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(sha256(token));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

/** Attaches req.user (DB row) and req.session if a valid session cookie is present. */
export function sessionMiddleware(req, _res, next) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) {
    const row = db
      .prepare(
        `SELECT s.id AS sid, s.csrf, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = ?`
      )
      .get(sha256(token));
    if (row && row.expires_at > Date.now() && row.active) {
      req.session = { id: row.sid, csrf: row.csrf };
      req.user = row;
      req.authVia = 'web';
    }
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Nicht angemeldet.' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Nicht angemeldet.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur für Admins.' });
  next();
}

/** CSRF check for state-changing JSON requests made by the web app. */
export function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = req.get('x-csrf-token') || req.query._csrf || (req.body && req.body._csrf);
  if (!req.session || !sent || sent !== req.session.csrf) {
    return res.status(403).json({ error: 'Sicherheitstoken fehlt oder ist abgelaufen. Bitte Seite neu laden.' });
  }
  next();
}

/**
 * Invalidates every credential of a user in one transaction: browser sessions (optionally except the
 * current one), OAuth access/refresh tokens and personal access keys. Used on password change,
 * admin password reset and deactivation.
 */
export function revokeAllCredentials(userId, keepSessionId = null) {
  db.transaction(() => {
    if (keepSessionId) db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(userId, keepSessionId);
    else db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    db.prepare('UPDATE oauth_tokens SET revoked = 1 WHERE user_id = ?').run(userId);
    db.prepare('UPDATE api_tokens SET revoked = 1 WHERE user_id = ?').run(userId);
  })();
}

export function purgeExpired() {
  const now = Date.now();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM oauth_codes WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM oauth_tokens WHERE expires_at < ?').run(now);
}

// ---------------------------------------------------------------------------
// Signed links (e.g. export downloads handed to MCP clients)
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

let appSecret = process.env.APP_SECRET || null;
function secret() {
  if (appSecret) return appSecret;
  const file = path.join(config.dataDir, 'app-secret.key');
  try {
    appSecret = fs.readFileSync(file, 'utf8').trim();
  } catch {
    fs.mkdirSync(config.dataDir, { recursive: true });
    appSecret = randomToken(48);
    fs.writeFileSync(file, appSecret, { mode: 0o600 });
  }
  return appSecret;
}

export function signValue(value, ttlSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const mac = crypto.createHmac('sha256', secret()).update(`${value}.${exp}`).digest('base64url');
  return `${exp}.${mac}`;
}

export function verifySigned(value, signature) {
  if (typeof signature !== 'string') return false;
  const [expStr, mac] = signature.split('.');
  const exp = Number(expStr);
  if (!exp || exp < Date.now() / 1000 || !mac) return false;
  const expected = crypto.createHmac('sha256', secret()).update(`${value}.${exp}`).digest('base64url');
  return expected.length === mac.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac));
}
