/**
 * Personal access keys ("ssp_…") for local MCP clients such as the Claude Desktop extension.
 * Stored only as SHA-256 hash, shown once, bound to one user, expiring, revocable, and
 * revoked together with sessions and OAuth tokens on password change / reset / deactivation.
 */
import { db, newId, audit } from './db.js';
import { sha256, randomToken } from './auth.js';

export const TOKEN_PREFIX = 'ssp_';
export const MAX_TOKENS_PER_USER = 10;
export const ALLOWED_DAYS = [30, 90];

export function listApiTokens(userId) {
  return db
    .prepare('SELECT id, name, hint, created_at, last_used_at, expires_at FROM api_tokens WHERE user_id = ? AND revoked = 0 AND expires_at > ? ORDER BY created_at DESC')
    .all(userId, Date.now())
    .map((r) => ({ id: r.id, name: r.name, hint: r.hint, createdAt: r.created_at, lastUsed: r.last_used_at, expiresAt: new Date(r.expires_at).toISOString() }));
}

export function createApiToken(userId, { name, days }) {
  const label = String(name || '').trim().slice(0, 80) || 'Claude Desktop';
  const d = ALLOWED_DAYS.includes(Number(days)) ? Number(days) : 90;
  const active = db.prepare('SELECT COUNT(*) AS n FROM api_tokens WHERE user_id = ? AND revoked = 0 AND expires_at > ?').get(userId, Date.now()).n;
  if (active >= MAX_TOKENS_PER_USER) {
    throw Object.assign(new Error(`Höchstens ${MAX_TOKENS_PER_USER} aktive Zugangsschlüssel. Bitte zuerst einen alten widerrufen.`), { status: 400 });
  }
  const token = TOKEN_PREFIX + randomToken(32);
  const id = newId('k_');
  db.prepare('INSERT INTO api_tokens (id, user_id, name, token_hash, hint, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    userId,
    label,
    sha256(token),
    token.slice(-4),
    Date.now() + d * 86400000
  );
  audit(userId, 'apitoken.create', id, { name: label, days: d });
  return { id, token, name: label, expiresAt: new Date(Date.now() + d * 86400000).toISOString() };
}

export function revokeApiToken(userId, id) {
  const r = db.prepare('UPDATE api_tokens SET revoked = 1 WHERE id = ? AND user_id = ? AND revoked = 0').run(id, userId);
  if (r.changes) audit(userId, 'apitoken.revoke', id);
  return r.changes > 0;
}

/** Returns the user row for a valid key, otherwise null. */
export function verifyApiToken(token) {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
  const row = db
    .prepare('SELECT t.id, t.user_id, t.expires_at, t.revoked, u.active FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?')
    .get(sha256(token));
  if (!row || row.revoked || row.expires_at < Date.now() || !row.active) return null;
  db.prepare("UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?").run(row.id);
  return { user: db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id), tokenId: row.id };
}
