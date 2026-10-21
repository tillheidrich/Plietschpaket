// Scenario (branching role-play) end-to-end via MCP: create, validate, score detection, SCORM export.
//   BASE=http://localhost:8099 EMAIL=... PASSWORD=... node test/scenario.mjs
import AdmZip from 'adm-zip';

const BASE = process.env.BASE || 'http://localhost:8099';
const EMAIL = process.env.EMAIL || 'admin@example.com';
const PASSWORD = process.env.PASSWORD || 'adminpass1234';
let failures = 0;
const ok = (c, m) => {
  console.log(`${c ? '✓' : '✗'} ${m}`);
  if (!c) failures++;
};

let r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
const login = await r.json();
const cookie = r.headers.get('set-cookie').split(';')[0];
const h = { cookie, 'x-csrf-token': login.csrf, 'content-type': 'application/json' };
r = await fetch(`${BASE}/api/me/api-tokens`, { method: 'POST', headers: h, body: JSON.stringify({ name: 'scenario-test', days: 30, password: PASSWORD }) });
const tokenBody = await r.json();
ok(r.status === 201 || r.status === 200, `access key created (${r.status})`);
const bearer = tokenBody.created.token;

let id = 0;
async function tool(name, args = {}) {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${bearer}`, 'mcp-protocol-version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } })
  });
  const raw = await res.text();
  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    throw new Error(`${name}: HTTP ${res.status} ${raw.slice(0, 300)}`);
  }
  if (!j.result) throw new Error(`${name}: ${raw.slice(0, 300)}`);
  const text = (j.result?.content || []).map((c) => c.text).join('\n');
  if (j.result?.isError) throw new Error(`${name}: ${text}`);
  return j.result.structuredContent ?? text;
}

const { DEMO_SCENARIO } = await import('./scenario-data.mjs');

const types = await tool('list_content_types');
ok(types.items.some((t) => t.machineName === 'H5P.Scenario'), 'H5P.Scenario is offered as content type');
const project = await tool('create_project', { name: 'Scenario test' });
const course = await tool('create_course', { project_id: project.id, title: 'Handling an upset customer', language: 'en', settings: { scormVersion: '1.2', masteryScore: 0 } });
const unit = await tool('create_unit', { course_id: course.id, content_type: 'H5P.Scenario', title: 'Handling an upset customer', params: DEMO_SCENARIO });
ok(!!unit.id, 'scenario unit created');
const back = await tool('get_unit', { unit_id: unit.id });
const p = back.params || back.unit?.params;
ok(p && p.scenes.length === 2 && p.scenes[0].choices.length === 3, 'params round-trip');
ok(p && !p.scenes[1].backgroundImage, 'no phantom fields on scenes');

const bad = await tool('create_unit', { course_id: course.id, content_type: 'H5P.Scenario', title: 'broken', params: { characters: [{ key: 'Bad Key', name: 'x', look: 'chen' }], scenes: [], endings: [] } }).then(() => null).catch((e) => e.message);
ok(!!bad, 'invalid params are rejected');

const ex = await tool('export_course', { course_id: course.id, format: 'scorm12' });
ok(ex.report?.scoredUnits === 1, `scenario counts as scored unit (${ex.report?.scoredUnits})`);
const dl = await fetch(ex.downloadUrl);
const zip = new AdmZip(Buffer.from(await dl.arrayBuffer()));
const names = zip.getEntries().map((e) => e.entryName);
const unitHtml = zip.readAsText('units/u01/index.html');
ok(unitHtml.includes('H5P.ScenarioArt') && /H5P\.Scenario\s*=/.test(unitHtml), 'package contains the scenario player and artwork');
console.log(`exportId=${ex.id} courseId=${course.id}`);
console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ Szenario-Test bestanden');
process.exit(failures ? 1 : 0);
