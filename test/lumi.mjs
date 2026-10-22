// .h5p export for Lumi: single unit and whole course as ZIP, re-import through the H5P validator.
//   BASE=http://localhost:8099 node test/lumi.mjs
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
  return { status: res.status, body: await res.json().catch(() => null) };
};
const ALLOWED = /\.(json|png|jpe?g|gif|bmp|tiff?|svg|eot|ttf|woff2?|otf|webm|mp4|ogg|mp3|m4a|wav|txt|pdf|rtf|docx?|xlsx?|pptx?|odt|ods|odp|xml|csv|diff|patch|swf|md|textile|vtt|webvtt|gltf|glb)$/i;

const proj = (await api('POST', '/api/projects', { name: 'Lumi' })).body;
const c = (await api('POST', `/api/projects/${proj.id}/courses`, { title: 'Kontor Schulung', language: 'de' })).body;
const units = [];
for (const [lib, title] of [['H5P.AppSimulation', 'Beleg erfassen'], ['H5P.Scenario', 'Rollenspiel'], ['H5P.MultiChoice', 'Wissensfrage']]) {
  const u = await api('POST', `/api/courses/${c.id}/units/draft`, { library: lib, title });
  units.push(u.body);
}
const one = await fetch(`${BASE}/api/units/${units[0].id}/h5p`, { headers: H });
const oneBuf = Buffer.from(await one.arrayBuffer());
ok(one.status === 200 && /\.h5p"/.test(one.headers.get('content-disposition')), `single unit as .h5p (${one.status})`);
const z = new AdmZip(oneBuf);
const names = z.getEntries().map((e) => e.entryName);
ok(names.includes('h5p.json') && names.includes('content/content.json'), 'h5p.json and content/content.json at the root');
ok(names.some((n) => n.startsWith('H5P.AppSimulation-1.0/')), 'library bundled, so Lumi can open the app simulation');
const contentFiles = names.filter((n) => n.startsWith('content/') && !n.endsWith('/'));
ok(contentFiles.every((n) => ALLOWED.test(n)), `content files pass the H5P whitelist (${contentFiles.length})`);
ok(!names.some((n) => /index\.html$/.test(n)), 'no SCORM shell files inside');

const zipRes = await fetch(`${BASE}/api/courses/${c.id}/h5p`, { headers: H });
const zz = new AdmZip(Buffer.from(await zipRes.arrayBuffer()));
const zn = zz.getEntries().map((e) => e.entryName);
ok(zipRes.status === 200 && zn.filter((n) => n.endsWith('.h5p')).length === 3 && zn.includes('LIESMICH.txt') && zn[0].startsWith('01-'), `course ZIP with numbered .h5p files (${zn.join(', ')})`);

// round trip through the H5P validator
const form = new FormData();
form.append('file', new Blob([oneBuf]), 'beleg-erfassen.h5p');
form.append('projectId', proj.id);
const imp = await fetch(`${BASE}/api/import`, { method: 'POST', headers: H, body: form });
const impj = await imp.json();
ok(imp.status === 201 && impj.units === 1, `exported .h5p re-imports cleanly (${imp.status} ${impj.error || ''})`);

const blocks = (await api('POST', `/api/projects/${proj.id}/courses`, { title: 'Nur Blöcke', language: 'de', settings: { mode: 'blocks' } })).body;
ok((await fetch(`${BASE}/api/courses/${blocks.id}/h5p`, { headers: H })).status === 400, 'block course without H5P units → clear error');
await api('DELETE', `/api/projects/${proj.id}`);
console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ Lumi-Export-Test bestanden');
process.exit(failures ? 1 : 0);
