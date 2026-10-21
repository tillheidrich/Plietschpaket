// End-to-end smoke test against a running instance.
// Usage: BASE=http://localhost:8099 EMAIL=... PASSWORD=... node test/smoke.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099';
const EMAIL = process.env.EMAIL || 'admin@example.com';
const PASSWORD = process.env.PASSWORD || 'adminpass1234';

let cookie = '';
let csrf = '';
const log = (...a) => console.log('•', ...a);
function assert(cond, msg) {
  if (!cond) {
    console.error('✗', msg);
    process.exit(1);
  }
}

async function web(path, opts = {}) {
  const res = await fetch(BASE + path, {
    redirect: 'manual',
    ...opts,
    headers: { ...(opts.headers || {}), cookie, ...(csrf ? { 'x-csrf-token': csrf } : {}) }
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return res;
}
const json = async (res) => {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
};

// 1. login
let r = await web('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
let body = await json(r);
assert(r.status === 200, `login ${r.status} ${JSON.stringify(body)}`);
csrf = body.csrf;
log('login ok as', body.user.email);

// 2. OAuth discovery + DCR
r = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
assert(r.status === 401 && /resource_metadata/.test(r.headers.get('www-authenticate') || ''), 'mcp 401 challenge');
const prm = await (await fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`)).json();
const asm = await (await fetch(`${prm.authorization_servers[0]}/.well-known/oauth-authorization-server`)).json();
log('discovery ok', asm.token_endpoint);
const redirect = 'https://claude.ai/api/mcp/auth_callback';
const reg = await (await fetch(asm.registration_endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Smoke', redirect_uris: [redirect], token_endpoint_auth_method: 'client_secret_post' }) })).json();
assert(reg.client_id && reg.client_secret, 'dcr');
log('client registered', reg.client_id);

// 3. authorize (consent)
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const params = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz', scope: 'mcp', resource: `${BASE}/mcp` });
r = await web(`/oauth/authorize?${params}`);
assert(r.status === 200, `authorize page ${r.status}`);
const html = await r.text();
const formCsrf = html.match(/name="_csrf" value="([^"]+)"/)[1];
const form = new URLSearchParams({ ...Object.fromEntries(params), _csrf: formCsrf, decision: 'allow' });
r = await web('/oauth/authorize', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() });
assert(r.status === 302, `consent ${r.status}`);
const loc = new URL(r.headers.get('location'));
assert(loc.searchParams.get('state') === 'xyz', 'state echoed');
const code = loc.searchParams.get('code');
let tok = await (await fetch(asm.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirect, client_id: reg.client_id, client_secret: reg.client_secret }) })).json();
assert(tok.access_token, `token ${JSON.stringify(tok)}`);
const refreshed = await (await fetch(asm.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tok.refresh_token, client_id: reg.client_id, client_secret: reg.client_secret }) })).json();
assert(refreshed.access_token, 'refresh');
tok = refreshed;
log('oauth ok');

// 4. MCP
let rpcId = 0;
async function mcp(method, params) {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${tok.access_token}`, 'mcp-protocol-version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params })
  });
  const t = await res.text();
  assert(res.ok, `mcp ${method} ${res.status} ${t.slice(0, 300)}`);
  return JSON.parse(t);
}
async function tool(name, args = {}) {
  const res = await mcp('tools/call', { name, arguments: args });
  const text = res.result.content.map((c) => c.text).join('\n');
  if (res.result.isError) {
    console.error(`✗ tool ${name}:`, text);
    process.exit(1);
  }
  return res.result.structuredContent ?? text;
}
const init = await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } });
log('mcp server', init.result.serverInfo.name, init.result.serverInfo.version);
const tools = await mcp('tools/list', {});
log('tools:', tools.result.tools.map((t) => t.name).join(', '));

const types = await tool('list_content_types');
log('content types:', types.items.length);
const schema = await tool('get_content_schema', { content_type: 'H5P.MultiChoice' });
assert(schema.schema.properties.question, 'schema has question');

const project = await tool('create_project', { name: 'Smoke-Projekt', description: 'Automatischer Test' });
const course = await tool('create_course', { project_id: project.id, title: 'Kontor – Erste Schritte', language: 'de', settings: { scormVersion: '1.2', masteryScore: 70 } });

const lesson = await tool('create_unit', {
  course_id: course.id,
  content_type: 'H5P.Column',
  title: 'Einstieg',
  params: {
    content: [
      { content: { library: 'H5P.AdvancedText 1.1', params: { text: '<h2>Willkommen</h2><p>In diesem Kurs lernst du die Grundlagen.</p>' } } },
      { content: { library: 'H5P.Accordion', params: { panels: [{ title: 'Was ist neu?', content: { library: 'H5P.AdvancedText', params: { text: '<p>Vieles.</p>' } } }] } } }
    ]
  }
});
log('unit', lesson.title, lesson.library);

const quiz = await tool('create_unit', {
  course_id: course.id,
  content_type: 'H5P.QuestionSet',
  title: 'Wissenscheck',
  params: {
    passPercentage: 50,
    questions: [
      { library: 'H5P.MultiChoice 1.16', params: { question: '<p>Was erfasst Kontor?</p>', answers: [{ text: '<div>Belege</div>', correct: true }, { text: '<div>Kaffee</div>', correct: false }] } },
      { library: 'H5P.TrueFalse', params: { question: '<p>SCORM ist ein Standard.</p>', correct: 'true' } }
    ]
  }
});
log('unit', quiz.title, quiz.library);

// invalid params must be rejected with a helpful message
const bad = await mcp('tools/call', { name: 'create_unit', arguments: { course_id: course.id, content_type: 'H5P.MultiChoice', title: 'Kaputt', params: { answers: 'nope' } } });
assert(bad.result.isError && /question|answers/.test(bad.result.content[0].text), 'validation error expected');
log('validation ok:', bad.result.content[0].text.split('\n').slice(0, 3).join(' | '));

const exp = await tool('export_course', { course_id: course.id, format: 'scorm12' });
log('export', exp.filename, exp.size, 'bytes', JSON.stringify(exp.report.warnings));
const dl = await fetch(exp.downloadUrl);
assert(dl.ok, `signed download ${dl.status}`);
const buf = Buffer.from(await dl.arrayBuffer());
fs.writeFileSync('/tmp/smoke-export.zip', buf);
log('download ok', buf.length);

const exp2004 = await tool('export_course', { course_id: course.id, format: 'scorm2004' });
log('export 2004', exp2004.filename);

// 5. project export/import round trip via web API
r = await web(`/api/projects/${project.id}/export`);
assert(r.ok, `project export ${r.status}`);
const projZip = Buffer.from(await r.arrayBuffer());
fs.writeFileSync('/tmp/smoke-project.zip', projZip);
const fd = new FormData();
fd.append('file', new Blob([projZip]), 'smoke-project.zip');
r = await web('/api/import', { method: 'POST', body: fd });
body = await json(r);
assert(r.status === 201 && body.units === 2, `import ${r.status} ${JSON.stringify(body)}`);
log('project import ok', JSON.stringify(body));

console.log(`\n✓ smoke test passed · course ${BASE}/courses/${course.id} · preview ${exp.previewUrl}`);
