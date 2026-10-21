// Course languages: 12 built-in languages, admin-defined languages, RTL, translated player/shell/H5P texts.
//   BASE=http://localhost:8099 node test/languages.mjs
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
const H = { cookie: r.headers.get('set-cookie').split(';')[0], 'x-csrf-token': login.csrf };
const J = { ...H, 'content-type': 'application/json' };
const api = async (method, p, body) => {
  const res = await fetch(BASE + p, { method, headers: J, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await res.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    j = t;
  }
  return { status: res.status, body: j };
};
const pkg = async (courseId) => {
  const ex = await api('POST', `/api/courses/${courseId}/export`, { format: 'scorm12' });
  if (ex.status !== 201) throw new Error(`export ${ex.status} ${JSON.stringify(ex.body)}`);
  return new AdmZip(Buffer.from(await (await fetch(`${BASE}/api/exports/${ex.body.id}/download`, { headers: H })).arrayBuffer()));
};

const langs = (await api('GET', '/api/languages')).body;
ok(langs.languages.filter((l) => l.builtin).length === 12, `12 built-in languages (${langs.languages.length})`);
ok(langs.languages.find((l) => l.code === 'ar')?.dir === 'rtl', 'Arabic is right-to-left');

// clean up custom language from earlier runs
await api('DELETE', '/api/admin/languages/de-ch');

const proj = (await api('POST', '/api/projects', { name: 'Sprachtest' })).body;
const bad = await api('POST', `/api/projects/${proj.id}/courses`, { title: 'X', language: 'xx' });
ok(bad.status === 400 && /Kurssprache/.test(bad.body.error), 'unknown course language is rejected');

const blocks = [
  { type: 'title', data: { content: 'Bienvenida' } },
  { type: 'quiz', data: { question: '¿Sí?', options: ['Sí', 'No'], correct: [0] } }
];
// Spanish block course
const es = (await api('POST', `/api/projects/${proj.id}/courses`, { title: 'Curso', language: 'es', settings: { mode: 'blocks' } })).body;
await api('PUT', `/api/courses/${es.id}/blocks`, { blocks });
let zip = await pkg(es.id);
let index = zip.readAsText('index.html');
ok(/Empezar el curso/.test(index) && /lang="es"/.test(index) && /dir="ltr"/.test(index), 'Spanish player texts in block package');

// Arabic block course → RTL
const ar = (await api('POST', `/api/projects/${proj.id}/courses`, { title: 'دورة', language: 'ar', settings: { mode: 'blocks' } })).body;
await api('PUT', `/api/courses/${ar.id}/blocks`, { blocks });
index = (await pkg(ar.id)).readAsText('index.html');
ok(/dir="rtl"/.test(index) && /ابدأ الدورة/.test(index), 'Arabic package is right-to-left with Arabic texts');

// Scenario in a Spanish course gets Spanish interface defaults
const unit = await api('POST', `/api/courses/${es.id}/units/draft`, { library: 'H5P.Scenario', title: 'Rol' });
ok(unit.status === 201, `scenario draft in Spanish course (${unit.status})`);
const full = (await api('GET', `/api/units/${unit.body.id}`)).body;
ok(full.params?.l10n?.choose === '¿Qué haces?', `scenario l10n Spanish (${full.params?.l10n?.choose})`);
// Units course in Polish: shell labels
const pl = (await api('POST', `/api/projects/${proj.id}/courses`, { title: 'Kurs', language: 'pl' })).body;
await api('POST', `/api/courses/${pl.id}/units/draft`, { library: 'H5P.AppSimulation', title: 'Symulacja' });
zip = await pkg(pl.id);
ok(/Spis treści/.test(zip.readAsText('index.html')), 'Polish course shell');

// custom language
const created = await api('POST', '/api/admin/languages', { code: 'de-CH', name: 'Schweizerdeutsch', base: 'de', dir: 'ltr', labels: { player: { start: 'Kurs starte', bogus: 'x' }, shell: {} } });
ok(created.status === 201 && created.body.code === 'de-ch' && !created.body.labels.player.bogus, 'custom language created (code normalised, unknown keys dropped)');
ok((await api('POST', '/api/admin/languages', { code: 'fr', name: 'X' })).status === 400, 'built-in code cannot be redefined');
const ch = (await api('POST', `/api/projects/${proj.id}/courses`, { title: 'Chuchichäschtli', language: 'de-ch', settings: { mode: 'blocks' } })).body;
await api('PUT', `/api/courses/${ch.id}/blocks`, { blocks: [{ type: 'title', data: { content: 'Grüezi' } }, { type: 'text', data: { content: 'Hoi' } }] });
index = (await pkg(ch.id)).readAsText('index.html');
ok(/Kurs starte/.test(index) && /Weitermachen/.test(index) && /lang="de-ch"/.test(index), 'custom language: own label + German fallback');
const draft = await api('POST', `/api/courses/${ch.id}/units/draft`, { library: 'H5P.Scenario', title: 'Rolle' });
ok((await api('GET', `/api/units/${draft.body.id}`)).body.params?.l10n?.choose === 'Was tust du?', 'custom language uses base language for H5P texts');
const inUse = await api('DELETE', '/api/admin/languages/de-ch');
ok(inUse.status === 409, 'language in use cannot be deleted');

// language version via duplicate
const dup = await api('POST', `/api/courses/${es.id}/duplicate`, { title: 'Course', language: 'en' });
ok(dup.status === 201 && dup.body.language === 'en', `duplicate into English (${dup.status})`);

await api('DELETE', `/api/projects/${proj.id}`);
const gone = await api('DELETE', '/api/admin/languages/de-ch');
ok(gone.status === 200, 'custom language deleted after its courses');
console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ Sprachtest bestanden');
process.exit(failures ? 1 : 0);
