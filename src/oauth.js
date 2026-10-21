/**
 * Minimal OAuth 2.1 authorization server for the MCP endpoint.
 * Implements what Claude (claude.ai connectors, Claude Code, Claude Desktop) needs:
 *  - RFC 9728 protected resource metadata
 *  - RFC 8414 authorization server metadata
 *  - RFC 7591 dynamic client registration
 *  - Authorization code flow with PKCE (S256 only) and refresh token rotation
 *  - RFC 7009 token revocation
 * Users log in with their normal Plietschpaket account; the token acts as that user.
 */
import express from 'express';
import crypto from 'node:crypto';
import { db, audit, parseJson } from './db.js';
import { config } from './config.js';
import { sha256, randomToken } from './auth.js';
import { verifyApiToken, TOKEN_PREFIX } from './apitokens.js';
import { RateLimit, limitByIp } from './limits.js';

const SCOPE = 'mcp';
export const MCP_PATH = '/mcp';

const issuer = () => config.publicUrl;
const resourceUrl = () => `${config.publicUrl}${MCP_PATH}`;

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function isLoopback(u) {
  return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
}

// Only known clients may receive authorization codes: https callbacks on allowlisted hosts
// (OAUTH_REDIRECT_HOSTS, default claude.ai/claude.com incl. subdomains) and loopback for desktop/CLI clients.
function allowedHttpsHost(host) {
  const h = host.toLowerCase();
  return config.oauthRedirectHosts.some((a) => h === a || h.endsWith(`.${a}`));
}
function validRedirectUri(uri) {
  try {
    const u = new URL(uri);
    if (u.hash || u.username || u.password) return false;
    if (u.protocol === 'https:') return allowedHttpsHost(u.hostname);
    return isLoopback(u);
  } catch {
    return false;
  }
}

function safeEqualHex(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const registerLimit = new RateLimit({ windowMs: 60 * 60_000, max: 20 });
const tokenLimit = new RateLimit({ windowMs: 60_000, max: 60 });

function redirectMatches(registered, requested) {
  if (registered.includes(requested)) return true;
  // RFC 8252: for loopback redirects the port may vary.
  try {
    const r = new URL(requested);
    if (!isLoopback(r)) return false;
    return registered.some((reg) => {
      const g = new URL(reg);
      return isLoopback(g) && g.hostname === r.hostname && g.pathname === r.pathname;
    });
  } catch {
    return false;
  }
}

function oauthError(res, status, error, description) {
  res.status(status).json({ error, error_description: description });
}

function issueTokens(clientId, userId, scope, family = crypto.randomUUID()) {
  const access = `ssa_${randomToken(32)}`;
  const refresh = `ssr_${randomToken(32)}`;
  const now = Date.now();
  const ins = db.prepare('INSERT INTO oauth_tokens (token_hash, kind, client_id, user_id, scope, family, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  ins.run(sha256(access), 'access', clientId, userId, scope, family, now + config.oauth.accessTokenTtl * 1000);
  ins.run(sha256(refresh), 'refresh', clientId, userId, scope, family, now + config.oauth.refreshTokenTtl * 1000);
  return { access_token: access, token_type: 'Bearer', expires_in: config.oauth.accessTokenTtl, refresh_token: refresh, scope };
}

function authenticateClient(req) {
  let clientId = req.body.client_id;
  let secret = req.body.client_secret;
  const header = req.get('authorization');
  if (header && header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    clientId = decodeURIComponent(decoded.slice(0, idx));
    secret = decodeURIComponent(decoded.slice(idx + 1));
  }
  if (!clientId) return { error: 'invalid_client', description: 'client_id fehlt.' };
  const client = db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').get(clientId);
  if (!client) return { error: 'invalid_client', description: 'Unbekannter Client.' };
  if (client.client_secret_hash) {
    if (!secret || !safeEqualHex(sha256(secret), client.client_secret_hash)) return { error: 'invalid_client', description: 'Client-Secret falsch.' };
  }
  return { client };
}

/** Express middleware for the MCP route: resolves the bearer token to req.user. */
export function bearerAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const challenge = `Bearer resource_metadata="${issuer()}/.well-known/oauth-protected-resource${MCP_PATH}", scope="${SCOPE}"`;
  if (!token) {
    res.set('WWW-Authenticate', challenge);
    return res.status(401).json({ error: 'invalid_token', error_description: 'Anmeldung erforderlich.' });
  }
  if (token.startsWith(TOKEN_PREFIX)) {
    const hit = verifyApiToken(token);
    if (!hit) {
      res.set('WWW-Authenticate', `${challenge}, error="invalid_token"`);
      return res.status(401).json({ error: 'invalid_token', error_description: 'Zugangsschlüssel ungültig, abgelaufen oder widerrufen.' });
    }
    req.user = hit.user;
    req.authVia = 'desktop';
    req.oauthClientId = null;
    return next();
  }
  const row = db
    .prepare(
      `SELECT t.*, u.id AS uid, u.active FROM oauth_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.kind = 'access'`
    )
    .get(sha256(token));
  if (!row || row.revoked || row.expires_at < Date.now() || !row.active) {
    res.set('WWW-Authenticate', `${challenge}, error="invalid_token"`);
    return res.status(401).json({ error: 'invalid_token', error_description: 'Token ungültig oder abgelaufen.' });
  }
  db.prepare("UPDATE oauth_tokens SET last_used_at = datetime('now') WHERE token_hash = ?").run(row.token_hash);
  req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  req.authVia = 'mcp';
  req.oauthClientId = row.client_id;
  next();
}

export function oauthRouter() {
  const router = express.Router();
  const form = express.urlencoded({ extended: false });
  const json = express.json({ limit: '64kb' });

  const resourceMeta = (_req, res) =>
    res.json({
      resource: resourceUrl(),
      authorization_servers: [issuer()],
      scopes_supported: [SCOPE],
      bearer_methods_supported: ['header'],
      resource_name: 'Plietschpaket'
    });
  router.get('/.well-known/oauth-protected-resource', resourceMeta);
  router.get(`/.well-known/oauth-protected-resource${MCP_PATH}`, resourceMeta);

  const asMeta = (_req, res) =>
    res.json({
      issuer: issuer(),
      authorization_endpoint: `${issuer()}/oauth/authorize`,
      token_endpoint: `${issuer()}/oauth/token`,
      registration_endpoint: `${issuer()}/oauth/register`,
      revocation_endpoint: `${issuer()}/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      scopes_supported: [SCOPE]
    });
  router.get('/.well-known/oauth-authorization-server', asMeta);
  router.get('/.well-known/oauth-authorization-server/mcp', asMeta);
  router.get('/.well-known/openid-configuration', asMeta);

  // --- Dynamic client registration -----------------------------------------
  router.post('/oauth/register', limitByIp(registerLimit), json, (req, res) => {
    const body = req.body || {};
    const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String).slice(0, 10) : [];
    if (!uris.length || !uris.every(validRedirectUri)) {
      return oauthError(res, 400, 'invalid_redirect_uri', `Erlaubt sind nur Rückleitungen zu ${config.oauthRedirectHosts.join(', ')} oder localhost.`);
    }
    const method = ['none', 'client_secret_post', 'client_secret_basic'].includes(body.token_endpoint_auth_method)
      ? body.token_endpoint_auth_method
      : 'none';
    const clientId = `ssc_${randomToken(16)}`;
    const secret = method === 'none' ? null : randomToken(32);
    const name = String(body.client_name || 'MCP-Client').slice(0, 120);
    db.prepare('INSERT INTO oauth_clients (client_id, client_secret_hash, name, redirect_uris, auth_method) VALUES (?, ?, ?, ?, ?)').run(
      clientId,
      secret ? sha256(secret) : null,
      name,
      JSON.stringify(uris),
      method
    );
    audit(null, 'oauth.register', clientId, { name, uris }, 'oauth');
    res.status(201).json({
      client_id: clientId,
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: method,
      scope: SCOPE
    });
  });

  // --- Authorization endpoint ----------------------------------------------
  function checkAuthorizeParams(q) {
    const client = q.client_id ? db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').get(String(q.client_id)) : null;
    if (!client) return { fatal: 'Unbekannte Anwendung (client_id). Bitte die Verbindung in Claude neu einrichten.' };
    const uris = parseJson(client.redirect_uris, []);
    const redirectUri = q.redirect_uri ? String(q.redirect_uri) : uris.length === 1 ? uris[0] : null;
    if (!redirectUri || !redirectMatches(uris, redirectUri) || !validRedirectUri(redirectUri)) return { fatal: 'Die Rücksprungadresse (redirect_uri) passt nicht zur registrierten Anwendung.' };
    if (q.response_type !== 'code') return { client, redirectUri, error: 'unsupported_response_type' };
    if (!q.code_challenge || (q.code_challenge_method && q.code_challenge_method !== 'S256')) {
      return { client, redirectUri, error: 'invalid_request', description: 'PKCE mit S256 ist Pflicht.' };
    }
    return { client, redirectUri };
  }

  function redirectWith(res, redirectUri, params) {
    const u = new URL(redirectUri);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) u.searchParams.set(k, v);
    res.redirect(302, u.toString());
  }

  router.get('/oauth/authorize', (req, res) => {
    const q = req.query;
    const check = checkAuthorizeParams(q);
    if (check.fatal) return res.status(400).send(page('Verbindung nicht möglich', `<p>${esc(check.fatal)}</p>`));
    if (check.error) return redirectWith(res, check.redirectUri, { error: check.error, error_description: check.description, state: q.state });
    if (!req.user) {
      return res.redirect(302, `/login?next=${encodeURIComponent(req.originalUrl)}`);
    }
    const hidden = ['client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'scope', 'resource']
      .filter((k) => q[k] !== undefined)
      .map((k) => `<input type="hidden" name="${k}" value="${esc(q[k])}">`)
      .join('');
    const en = req.user.language === 'en';
    const body = en
      ? `
      <p class="lead"><strong>${esc(check.client.name)}</strong> wants to access Plietschpaket with your account.</p>
      <ul class="perm">
        <li>Read projects, courses and units you have access to</li>
        <li>Create and change content where you have edit rights</li>
        <li>Export SCORM packages</li>
      </ul>
      <p class="muted">After approval you will be sent to <strong>${esc(new URL(check.redirectUri).host)}</strong>. Only continue if you started this connection yourself.</p>
      <p class="muted">Signed in as ${esc(req.user.name)} (${esc(req.user.email)}). You can disconnect at any time under “Connect Claude”.</p>`
      : `
      <p class="lead"><strong>${esc(check.client.name)}</strong> möchte mit deinem Konto auf Plietschpaket zugreifen.</p>
      <ul class="perm">
        <li>Projekte, Kurse und Einheiten lesen, auf die du Zugriff hast</li>
        <li>Inhalte anlegen und ändern, wo du Bearbeitungsrechte hast</li>
        <li>SCORM-Pakete exportieren</li>
      </ul>
      <p class="muted">Nach der Freigabe geht es weiter zu <strong>${esc(new URL(check.redirectUri).host)}</strong>. Nur fortfahren, wenn du die Verbindung gerade selbst gestartet hast.</p>
      <p class="muted">Angemeldet als ${esc(req.user.name)} (${esc(req.user.email)}). Die Verbindung lässt sich jederzeit unter „Claude verbinden“ trennen.</p>`;
    const formHtml = `
      <form method="post" action="/oauth/authorize">
        ${hidden}
        <input type="hidden" name="_csrf" value="${esc(req.session.csrf)}">
        <div class="actions">
          <button type="submit" name="decision" value="deny" class="secondary">${en ? 'Deny' : 'Ablehnen'}</button>
          <button type="submit" name="decision" value="allow" class="primary">${en ? 'Allow access' : 'Zugriff erlauben'}</button>
        </div>
      </form>`;
    res.send(page(en ? 'Allow access?' : 'Zugriff erlauben?', body + formHtml, en ? 'en' : 'de'));
  });

  router.post('/oauth/authorize', form, (req, res) => {
    if (!req.user || !req.session || req.body._csrf !== req.session.csrf) {
      return res.status(403).send(page('Sitzung abgelaufen', '<p>Bitte den Vorgang in Claude neu starten.</p>'));
    }
    const q = req.body;
    const check = checkAuthorizeParams({ ...q, response_type: 'code' });
    if (check.fatal) return res.status(400).send(page('Verbindung nicht möglich', `<p>${esc(check.fatal)}</p>`));
    if (check.error) return redirectWith(res, check.redirectUri, { error: check.error, error_description: check.description, state: q.state });
    if (q.decision !== 'allow') return redirectWith(res, check.redirectUri, { error: 'access_denied', state: q.state });
    const code = randomToken(32);
    db.prepare(
      'INSERT INTO oauth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, scope, resource, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(sha256(code), check.client.client_id, req.user.id, check.redirectUri, String(q.code_challenge), SCOPE, q.resource || null, Date.now() + config.oauth.codeTtl * 1000);
    audit(req.user.id, 'oauth.authorize', check.client.client_id, { name: check.client.name }, 'oauth');
    redirectWith(res, check.redirectUri, { code, state: q.state, iss: issuer() });
  });

  // --- Token endpoint --------------------------------------------------------
  router.post('/oauth/token', limitByIp(tokenLimit), form, json, (req, res) => {
    res.set('Cache-Control', 'no-store');
    const auth = authenticateClient(req);
    if (auth.error) return oauthError(res, 401, auth.error, auth.description);
    const { client } = auth;
    const grant = req.body.grant_type;

    if (grant === 'authorization_code') {
      const row = db.prepare('SELECT * FROM oauth_codes WHERE code_hash = ?').get(sha256(String(req.body.code || '')));
      if (row) db.prepare('DELETE FROM oauth_codes WHERE code_hash = ?').run(row.code_hash); // single use
      if (!row || row.expires_at < Date.now() || row.client_id !== client.client_id) {
        return oauthError(res, 400, 'invalid_grant', 'Code ungültig oder abgelaufen.');
      }
      if (req.body.redirect_uri && req.body.redirect_uri !== row.redirect_uri) {
        return oauthError(res, 400, 'invalid_grant', 'redirect_uri passt nicht.');
      }
      const verifier = String(req.body.code_verifier || '');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      if (!verifier || challenge !== row.code_challenge) return oauthError(res, 400, 'invalid_grant', 'PKCE-Prüfung fehlgeschlagen.');
      const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(row.user_id);
      if (!user) return oauthError(res, 400, 'invalid_grant', 'Konto deaktiviert.');
      return res.json(issueTokens(client.client_id, user.id, row.scope));
    }

    if (grant === 'refresh_token') {
      const row = db
        .prepare("SELECT * FROM oauth_tokens WHERE token_hash = ? AND kind = 'refresh'")
        .get(sha256(String(req.body.refresh_token || '')));
      if (!row || row.client_id !== client.client_id || row.expires_at < Date.now()) {
        return oauthError(res, 400, 'invalid_grant', 'Refresh-Token ungültig.');
      }
      if (row.revoked) {
        // Reuse of a rotated refresh token: revoke the whole family.
        db.prepare('UPDATE oauth_tokens SET revoked = 1 WHERE family = ?').run(row.family);
        return oauthError(res, 400, 'invalid_grant', 'Refresh-Token wurde bereits verwendet.');
      }
      const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(row.user_id);
      if (!user) return oauthError(res, 400, 'invalid_grant', 'Konto deaktiviert.');
      db.prepare('UPDATE oauth_tokens SET revoked = 1 WHERE token_hash = ?').run(row.token_hash);
      return res.json(issueTokens(client.client_id, user.id, row.scope, row.family));
    }

    return oauthError(res, 400, 'unsupported_grant_type', 'Nur authorization_code und refresh_token.');
  });

  router.post('/oauth/revoke', form, json, (req, res) => {
    const token = String(req.body.token || '');
    const row = db.prepare('SELECT family FROM oauth_tokens WHERE token_hash = ?').get(sha256(token));
    if (row) db.prepare('UPDATE oauth_tokens SET revoked = 1 WHERE family = ?').run(row.family);
    res.status(200).end();
  });

  return router;
}

/** Connected apps of a user (for the account page). */
export function listConnections(userId) {
  return db
    .prepare(
      `SELECT c.client_id, c.name, MIN(t.created_at) AS since, MAX(t.last_used_at) AS last_used
       FROM oauth_tokens t JOIN oauth_clients c ON c.client_id = t.client_id
       WHERE t.user_id = ? AND t.revoked = 0 AND t.expires_at > ? AND t.kind = 'refresh'
       GROUP BY c.client_id ORDER BY since DESC`
    )
    .all(userId, Date.now())
    .map((r) => ({ clientId: r.client_id, name: r.name, since: r.since, lastUsed: r.last_used }));
}

export function revokeConnection(userId, clientId) {
  db.prepare('UPDATE oauth_tokens SET revoked = 1 WHERE user_id = ? AND client_id = ?').run(userId, clientId);
}

function page(title, body, lang = 'de') {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Plietschpaket</title><link rel="stylesheet" href="/assets/app.css"></head>
<body class="auth-page"><main class="auth-card"><div class="brand-mark" aria-hidden="true"></div><h1>${esc(title)}</h1>${body}</main></body></html>`;
}
