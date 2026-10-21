// Interactive-video end-to-end test via MCP. VIDEO=path/to/clip.webm node test/interactive-video.mjs
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
const b64 = fs.readFileSync(process.env.VIDEO || '/tmp/ivtest.webm').toString('base64');
const project = await tool('create_project', { name: 'IV-Test' });
const course = await tool('create_course', { project_id: project.id, title: 'Interaktives Video – Test', language: 'de', settings: { scormVersion: '1.2', masteryScore: 50 } });
// draft unit so content id exists for asset upload
const unitDraft = await tool('create_unit', { course_id: course.id, content_type: 'H5P.Text', title: 'tmp', params: { text: '<p>x</p>' } }).catch(e=>null);
const asset = await tool('upload_asset', { kind: 'video', filename: 'demo.webm', mime: 'video/webm', base64: b64 });
console.log('asset', JSON.stringify(asset));
const vidObj = asset.path ? asset : (asset.file || asset);
const iv = {
  interactiveVideo: {
    video: { files: [vidObj], startScreenOptions: { title: 'Demo', hideStartTitle: false } },
    assets: {
      interactions: [
        { x: 5, y: 5, width: 10, height: 10, duration: { from: 1, to: 9 }, pause: false, displayType: 'button', label: '<p>Info</p>',
          action: { library: 'H5P.Text 1.1', params: { text: '<p>Hintergrundwissen zum Thema.</p>' } } },
        { x: 60, y: 60, width: 20, height: 15, duration: { from: 2, to: 12 }, pause: false, displayType: 'poster',
          action: { library: 'H5P.IVHotspot 1.2', params: { destination: { type: 'timecode', time: '0:20' }, visuals: { shape: 'rectangular', backgroundColor: 'rgba(255,0,0,.3)' }, texts: { label: 'Zu Kapitel 2 springen', alternativeText: 'Sprung zu Kapitel 2' } } } },
        { x: 25, y: 15, width: 50, height: 60, duration: { from: 5, to: 5 }, pause: true, displayType: 'poster', label: '',
          action: { library: 'H5P.MultiChoice 1.16', params: { question: '<p>Welche Farbe hat der Ton?</p>', answers: [{ text: '<div>440 Hz</div>', correct: true }, { text: '<div>Blau</div>', correct: false }] } },
          adaptivity: { wrong: { seekTo: 0, allowOptOut: false, message: 'Schau dir den Anfang nochmal an.', seekLabel: 'Zurück' }, requireCompletion: true } },
        { x: 25, y: 15, width: 50, height: 60, duration: { from: 15, to: 15 }, pause: true, displayType: 'poster',
          action: { library: 'H5P.TrueFalse 1.8', params: { question: '<p>Das Video ist 30 Sekunden lang.</p>', correct: 'true' } } }
      ],
      bookmarks: [{ time: 0, label: 'Intro' }, { time: 20, label: 'Kapitel 2' }],
      endscreens: [{ time: 29, label: 'Ende' }]
    }
  },
  override: { autoplay: false }
};
const v = await tool('validate_params', { content_type: 'H5P.InteractiveVideo', params: iv });
console.log('validate', JSON.stringify(v).slice(0, 600));
const unit = await tool('create_unit', { course_id: course.id, content_type: 'H5P.InteractiveVideo', title: 'Interaktives Video', params: iv });
const got = await tool('get_unit', { unit_id: unit.id });
const ia = got.params.interactiveVideo.assets.interactions;
console.log('interactions kept:', ia.length, JSON.stringify(ia.map(i => ({ x: i.x, y: i.y, w: i.width, dt: i.displayType, pause: i.pause, lib: i.action.library, dur: i.duration }))));
console.log('video files', JSON.stringify(got.params.interactiveVideo.video.files));
if (unitDraft) await tool('delete_unit', { unit_id: unitDraft.id });
const exp = await tool('export_course', { course_id: course.id, format: 'scorm12' });
console.log('export', JSON.stringify(exp).slice(0, 700));
fs.writeFileSync('/tmp/iv-export.json', JSON.stringify(exp));
