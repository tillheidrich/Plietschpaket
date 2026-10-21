// Block Studio (canvas, custom blocks) and Language Lab blocks through the API.
//   BASE=http://localhost:8099 node test/studio.mjs
import AdmZip from 'adm-zip';
const BASE = process.env.BASE || 'http://localhost:8099';
let failures = 0;
const ok = (c, m) => {
  console.log(`${c ? '✓' : '✗'} ${m}`);
  if (!c) failures++;
};
let r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', password: 'adminpass1234' }) });
const login = await r.json();
const H = { cookie: r.headers.get('set-cookie').split(';')[0], 'x-csrf-token': login.csrf };
const api = async (method, p, body) => {
  const res = await fetch(BASE + p, { method, headers: { ...H, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await res.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    j = t;
  }
  return { status: res.status, body: j };
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const proj = (await api('POST', '/api/projects', { name: 'Studio' })).body;
const a = (await api('POST', `/api/projects/${proj.id}/courses`, { title: 'A', language: 'de', settings: { mode: 'blocks' } })).body;
const b = (await api('POST', `/api/projects/${proj.id}/courses`, { title: 'B', language: 'de', settings: { mode: 'blocks' } })).body;
const media = await (await fetch(`${BASE}/api/courses/${a.id}/media`, { method: 'POST', headers: { ...H, 'x-filename': 'logo.png', 'content-type': 'image/png' }, body: png })).json();

const types = (await api('GET', '/api/block-types')).body;
ok(types.categories.includes('language') && ['wordBank', 'termGuess', 'oralReading', 'voiceInsert', 'conversation', 'canvas'].every((t) => types.types.some((x) => x.type === t)), 'catalogue has language lab and canvas');

const canvas = { type: 'canvas', data: { aspect: '4:3', background: '#112233', layers: [{ kind: 'text', x: 5, y: 5, w: 50, h: 10, text: 'Hallo', size: 40, color: '#ffffff' }, { kind: 'image', x: 60, y: 10, w: 30, h: 30, image: media.ref, alt: 'Logo' }, { kind: 'button', x: 5, y: 70, w: 20, h: 10, text: 'Info', reveal: 'Mehr' }] } };
const lab = [
  { type: 'wordBank', data: { text: 'Ich [habe] Hunger.', distractors: ['bin'] } },
  { type: 'termGuess', data: { items: [{ clue: 'Gelbe Frucht', term: 'Banane' }] } },
  { type: 'oralReading', data: { text: 'Guten Tag.' } },
  { type: 'voiceInsert', data: { prompt: 'Stell dich vor.' } },
  { type: 'conversation', data: { turns: [{ speaker: 'partner', text: 'Hallo!' }, { speaker: 'learner', text: 'Hallo, wie geht es?' }] } }
];
let s = await api('PUT', `/api/courses/${a.id}/blocks`, { blocks: [{ type: 'title', data: { content: 'Studio' } }, canvas, ...lab] });
ok(s.status === 200 && s.body.blocks.length === 7, `canvas and language lab blocks saved (${s.status} ${JSON.stringify(s.body.error || '')})`);
ok((await api('PUT', `/api/courses/${a.id}/blocks`, { blocks: [{ type: 'canvas', data: { background: 'red' } }] })).status === 400, 'canvas colour must be #hex');
ok((await api('PUT', `/api/courses/${a.id}/blocks`, { blocks: [{ type: 'conversation', data: { turns: [{ speaker: 'partner', text: 'a' }, { speaker: 'partner', text: 'b' }] } }] })).status === 400, 'conversation needs a learner line');
const ex = await api('POST', `/api/courses/${a.id}/export`, { format: 'scorm2004' });
ok(ex.status === 201 && ex.body.report.gradedBlocks === 2, `export counts word bank and term guess as graded (${ex.body.report?.gradedBlocks})`);

const canvasId = s.body.blocks[1].id;
const saved = await api('POST', `/api/courses/${a.id}/blocks/${canvasId}/save-custom`, { name: 'Logo-Kachel' });
ok(saved.status === 201 && saved.body.type === 'canvas', 'canvas saved as custom block');
ok((await api('POST', `/api/courses/${a.id}/blocks/${s.body.blocks[0].id}/save-custom`, { name: '' })).status === 400, 'custom block needs a name');
const use = await api('POST', `/api/courses/${b.id}/custom-blocks/${saved.body.id}/use`);
ok(use.status === 200 && use.body.data.layers.length === 3, 'custom block returned for course B');
const mb = (await api('GET', `/api/courses/${b.id}/media`)).body;
ok(mb.some((m) => m.ref === media.ref), 'media copied into course B');
const ins = await api('POST', `/api/courses/${b.id}/blocks`, { blocks: [use.body] });
ok(ins.status === 201, 'custom block inserted into course B');
ok((await api('DELETE', `/api/custom-blocks/${saved.body.id}`)).status === 200, 'custom block deleted');
await api('DELETE', `/api/projects/${proj.id}`);
console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ Studio-Test bestanden');
process.exit(failures ? 1 : 0);
