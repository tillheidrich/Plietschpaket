// Security acceptance tests (SECURITY.md, tests 1–7 plus review findings).
// Runs against a local instance with access to its data directory:
//   BASE=http://localhost:8099 DATA_DIR=/tmp/ssdata EMAIL=admin@example.com PASSWORD=adminpass1234 node test/security.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

const BASE = process.env.BASE || 'http://localhost:8099';
const DATA_DIR = process.env.DATA_DIR || '/tmp/ssdata';
const ADMIN = { email: process.env.EMAIL || 'admin@example.com', password: process.env.PASSWORD || 'adminpass1234' };

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

class Client {
  constructor(name) {
    this.name = name;
    this.cookie = '';
    this.csrf = '';
  }
  async req(p, { method = 'GET', body, headers = {}, raw = false, form } = {}) {
    const h = { ...headers, cookie: this.cookie };
    if (this.csrf && method !== 'GET') h['x-csrf-token'] = this.csrf;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) {
      h['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(BASE + p, { method, headers: h, body: payload, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    if (raw) return res;
    const text = await res.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* not json */
    }
    return { status: res.status, data, headers: res.headers };
  }
  async login(email, password) {
    const r = await this.req('/api/auth/login', { method: 'POST', body: { email, password } });
    this.csrf = r.data.csrf;
    return r;
  }
}

async function mcp(token, method, params, id = 1) {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}`, 'mcp-protocol-version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  });
  return { status: res.status, data: res.status === 200 ? await res.json() : null };
}
const tool = async (token, name, args) => {
  const r = await mcp(token, 'tools/call', { name, arguments: args });
  return r.data ? r.data.result || r.data : r;
};

// ------------------------------------------------------------------ setup: admin creates two normal users
const admin = new Client('admin');
await admin.login(ADMIN.email, ADMIN.password);
const suffix = crypto.randomBytes(3).toString('hex');
async function newUser(label) {
  const email = `${label}-${suffix}@example.com`;
  const r = await admin.req('/api/admin/users', { method: 'POST', body: { email, name: label, role: 'user' } });
  const c = new Client(label);
  await c.login(email, r.data.initialPassword);
  return { c, email, password: r.data.initialPassword, id: r.data.user.id };
}
const A = await newUser('alice');
const B = await newUser('bob');
const V = await newUser('vera');

// Alice builds a project with a scored unit and an export
const project = (await A.c.req('/api/projects', { method: 'POST', body: { name: 'Geheim' } })).data;
const course = (await A.c.req(`/api/projects/${project.id}/courses`, { method: 'POST', body: { title: 'Q3' } })).data;
const editorPayload = {
  library: 'H5P.Column 1.18',
  params: {
    metadata: { title: 'Seite', license: 'U' },
    params: { content: [{ content: { library: 'H5P.AdvancedText 1.1', params: { text: '<p>Geheim: Q3-Zahlen</p>' }, subContentId: crypto.randomUUID(), metadata: { contentType: 'Text', license: 'U', title: 'T' } } }] }
  }
};
const created = (await A.c.req(`/api/courses/${course.id}/units/editor`, { method: 'POST', body: editorPayload })).data;
const unit = { ...created.unit, contentId: created.contentId };
ok(unit.id && unit.contentId, 'Alice legt Einheit an (Nicht-Admin)');
const exp = (await A.c.req(`/api/courses/${course.id}/export`, { method: 'POST', body: { format: 'scorm12' } })).data;
ok(exp && exp.id, 'Alice exportiert');
await A.c.req(`/api/projects/${project.id}/members`, { method: 'POST', body: { email: V.email, role: 'viewer' } });

// ------------------------------------------------------------------ 1. IDOR matrix (Bob is no member)
const cid = unit.contentId;
const matrix = [
  `/api/projects/${project.id}`,
  `/api/courses/${course.id}`,
  `/api/units/${unit.id}`,
  `/api/exports/${exp.id}`,
  `/api/exports/${exp.id}/download`,
  `/api/projects/${project.id}/export`,
  `/api/h5p/editor-model/${cid}`,
  `/api/h5p/player-model/${cid}`,
  `/exports/${exp.id}/pkg/index.html`,
  `/h5p/download/${cid}`,
  `/h5p/params/${cid}`,
  `/h5p/content/${cid}/content.json`
];
for (const p of matrix) {
  const r = await B.c.req(p);
  ok(r.status === 404, `IDOR ${p} → ${r.status} (erwartet 404)`);
}
const prev = await B.c.req(`/exports/${exp.id}/preview`);
ok(prev.status === 404, `IDOR /exports/:id/preview → ${prev.status}`);
const missing = await B.c.req('/h5p/download/999999');
ok(missing.status === 404, 'nicht vorhandener Inhalt → 404 (gleich wie fremder)');

// ------------------------------------------------------------------ viewer may not export
const vexp = await V.c.req(`/api/courses/${course.id}/export`, { method: 'POST', body: { format: 'scorm12' } });
ok(vexp.status === 403, `Viewer-Export → ${vexp.status} (erwartet 403)`);

// ------------------------------------------------------------------ 2. MCP with foreign IDs (Bob via access key)
const bobKey = (await B.c.req('/api/me/api-tokens', { method: 'POST', body: { name: 'Test', days: 30, password: B.password } })).data.created.token;
const noPw = await B.c.req('/api/me/api-tokens', { method: 'POST', body: { name: 'x', days: 30 } });
ok(noPw.status === 400, 'Schlüssel anlegen ohne Passwort → 400');
await mcp(bobKey, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
for (const [name, args] of [
  ['get_course', { course_id: course.id }],
  ['get_unit', { unit_id: unit.id }],
  ['export_course', { course_id: course.id }],
  ['delete_unit', { unit_id: unit.id }]
]) {
  const r = await tool(bobKey, name, args);
  ok(r.isError === true, `MCP ${name} mit fremder ID → Fehler`);
}
const ssrf = await tool(bobKey, 'upload_asset', { kind: 'image', url: 'https://127.0.0.1/x', filename: 'x.png', base64: '' });
ok(ssrf.isError === true || ssrf.error, 'upload_asset ohne Base64 / mit URL abgelehnt');
const fakePng = await tool(bobKey, 'upload_asset', { kind: 'image', filename: 'x.png', base64: Buffer.from('<svg onload=alert(1)>').toString('base64') });
ok(fakePng.isError === true, 'upload_asset: Inhalt passt nicht zu kind → abgelehnt');

// ------------------------------------------------------------------ 3. H5P library swap by non-admin (review #1)
const libFile = path.join(DATA_DIR, 'h5p/libraries/H5P.AdvancedText-1.1/library.json');
const before = fs.readFileSync(libFile, 'utf8');
const projZip = new AdmZip(Buffer.from(await (await A.c.req(`/api/projects/${project.id}/export`, { raw: true })).arrayBuffer()));
const h5pEntry = projZip.getEntries().find((e) => e.entryName.endsWith('.h5p'));
ok(!!h5pEntry, 'Projekt-Export enthält .h5p');
const h5p = new AdmZip(h5pEntry.getData());
const libEntry = h5p.getEntries().find((e) => e.entryName === 'H5P.AdvancedText-1.1/library.json');
const lib = JSON.parse(libEntry.getData().toString('utf8'));
lib.patchVersion = 99;
h5p.updateFile(libEntry.entryName, Buffer.from(JSON.stringify(lib)));
const fd = new FormData();
fd.append('file', new Blob([h5p.toBuffer()]), 'evil.h5p');
await B.c.req('/api/import', { method: 'POST', form: fd });
ok(fs.readFileSync(libFile, 'utf8') === before, 'Nicht-Admin kann installierte Bibliothek nicht ersetzen');

// regular .h5p import by a non-admin works (review #14)
const fd2 = new FormData();
fd2.append('file', new Blob([h5pEntry.getData()]), 'seite.h5p');
const imp = await B.c.req('/api/import', { method: 'POST', form: fd2 });
ok(imp.status === 201 && imp.data.units === 1, `Nicht-Admin importiert .h5p → ${imp.status}`);

// ------------------------------------------------------------------ 4. password change revokes everything
const r1 = await mcp(bobKey, 'tools/list', {});
ok(r1.status === 200, 'Bobs Schlüssel funktioniert vor dem Passwortwechsel');
const other = new Client('bob2');
await other.login(B.email, B.password);
const newPw = `neu-${suffix}-passwort`;
await B.c.req('/api/me/password', { method: 'POST', body: { current: B.password, next: newPw } });
ok((await mcp(bobKey, 'tools/list', {})).status === 401, 'Passwortwechsel entwertet Zugangsschlüssel');
ok((await other.req('/api/me')).status === 401, 'Passwortwechsel beendet andere Sitzungen');
ok((await B.c.req('/api/me')).status === 200, 'eigene Sitzung bleibt');

// ------------------------------------------------------------------ 5. deactivation revokes keys
const veraKey = (await V.c.req('/api/me/api-tokens', { method: 'POST', body: { name: 'T', days: 30, password: V.password } })).data.created.token;
await admin.req(`/api/admin/users/${V.id}`, { method: 'PATCH', body: { active: false } });
ok((await mcp(veraKey, 'tools/list', {})).status === 401, 'Deaktivierung entwertet Zugangsschlüssel');
ok((await V.c.req('/api/me')).status === 401, 'Deaktivierung beendet Sitzung');

// ------------------------------------------------------------------ 6. login gives no account oracle
const anon = new Client('anon');
const known = await anon.req('/api/auth/login', { method: 'POST', body: { email: A.email, password: 'falsch-falsch' } });
const unknown = await anon.req('/api/auth/login', { method: 'POST', body: { email: `nobody-${suffix}@example.com`, password: 'falsch-falsch' } });
ok(known.status === unknown.status && known.data.error === unknown.data.error, 'Login: gleiche Antwort für bekannte/unbekannte Adresse');
const out = await new Client('x').req('/api/auth/logout', { method: 'POST' });
ok(out.status === 403 || out.status === 401, 'Logout ohne CSRF-Token abgelehnt');

// ------------------------------------------------------------------ 7. OAuth
const evil = await fetch(`${BASE}/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Claude', redirect_uris: ['https://evil.example/cb'] }) });
ok(evil.status === 400, 'OAuth-Registrierung mit fremder Rückleitung → 400');
const good = await (await fetch(`${BASE}/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'T', redirect_uris: ['http://127.0.0.1:33418/cb'] }) })).json();
ok(!!good.client_id, 'OAuth-Registrierung mit Loopback erlaubt');
const noPkce = await A.c.req(`/oauth/authorize?response_type=code&client_id=${good.client_id}&redirect_uri=${encodeURIComponent('http://127.0.0.1:33418/cb')}&state=s`);
ok(noPkce.status === 302 && /error=invalid_request/.test(noPkce.headers.get('location') || ''), 'Authorize ohne PKCE → invalid_request');

// ------------------------------------------------------------------ 8. signed download links
const forged = await anon.req(`/api/exports/${exp.id}/download?sig=1.AAAA`);
ok(forged.status !== 200 && !(forged.headers.get('content-type') || '').includes('zip'), `gefälschte Signatur liefert kein Paket (${forged.status})`);
const expired = await anon.req(`/api/exports/${exp.id}/download?sig=${Math.floor(Date.now() / 1000) - 10}.AAAA`);
ok(expired.status !== 200, `abgelaufene Signatur liefert kein Paket (${expired.status})`);

// ------------------------------------------------------------------ 9. headers on all route classes
for (const p of ['/login', '/api/me', '/oauth/authorize', '/.well-known/oauth-authorization-server', `/h5p/content/${cid}/content.json`, '/robots.txt']) {
  const r = await A.c.req(p, { raw: true });
  const csp = r.headers.get('content-security-policy') || '';
  ok(!!csp && r.headers.get('x-content-type-options') === 'nosniff' && r.headers.get('x-robots-tag'), `Header auf ${p} (${r.status})`);
}
const consent = await A.c.req(`/oauth/authorize?response_type=code&client_id=${good.client_id}&redirect_uri=${encodeURIComponent('http://127.0.0.1:33418/cb')}&code_challenge=abc&code_challenge_method=S256`, { raw: true });
ok((consent.headers.get('x-frame-options') || '') === 'DENY', 'Consent-Seite nicht rahmbar');
ok(/127\.0\.0\.1:33418/.test(await consent.text()), 'Consent-Seite zeigt Ziel der Rückleitung');

console.log(failures ? `\n✗ ${failures} Prüfung(en) fehlgeschlagen` : '\n✓ alle Sicherheitsprüfungen bestanden');
process.exit(failures ? 1 : 0);
