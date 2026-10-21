// App-Simulation end-to-end: import of a click-practice package (course.json format), language version with
// media, SCORM export. Uses a synthetic package (no customer content in the repo).
//   BASE=http://localhost:8099 EMAIL=... PASSWORD=... node test/appsim.mjs
import zlib from 'node:zlib';
import AdmZip from 'adm-zip';

const BASE = process.env.BASE || 'http://localhost:8099';
const EMAIL = process.env.EMAIL || 'admin@example.com';
const PASSWORD = process.env.PASSWORD || 'adminpass1234';
let failures = 0;
const ok = (c, m) => {
  console.log(`${c ? '✓' : '✗'} ${m}`);
  if (!c) failures++;
};

// minimal valid PNG (solid colour)
function png(w, h, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3).map((_, i) => rgb[i % 3])]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const course = {
  id: 'TEST_01', lang: 'en', mode: 'practice', kicker: 'Test · Training', title: 'Synthetic practice', meta: 'iOS · English', intro: 'Test intro.',
  chapters: [{ id: 'c1', title: 'First' }, { id: 'c2', title: 'Second' }],
  steps: [
    { id: 's1', chapter: 'c1', shot: 'media/01.png', label: 'Tap the avatar', detail: 'Top left.', target: { type: 'tap', x: 0.1, y: 0.08, r: 0.06 }, tone: null },
    { id: 's2', chapter: 'c1', shot: 'media/01.png', label: 'This is the list', target: { type: 'rect', x: 0.02, y: 0.2, w: 0.96, h: 0.3 }, tone: null },
    { id: 's3', chapter: 'c2', shot: 'media/02.png', label: 'Tap Save', target: { type: 'rect', x: 0.3, y: 0.56, w: 0.4, h: 0.04, tap: [0.5, 0.58] }, tone: null },
    { id: 's4', chapter: 'c2', shot: 'media/02.png', label: 'Careful', target: { type: 'rect', x: 0.02, y: 0.6, w: 0.96, h: 0.2 }, tone: 'note' }
  ],
  ui: { practice: 'Practise step by step', doneTitle: 'Done!' }
};
const zip = new AdmZip();
zip.addFile('imsmanifest.xml', Buffer.from('<manifest/>'));
zip.addFile('index.html', Buffer.from('<style>:root{--deep:#101820;--cyan:#22aacc;--red:#aa2222}</style><img class="logo" src="assets/logo.png" alt=""><div id="copy">© Test Org</div>'));
zip.addFile('course.json', Buffer.from(JSON.stringify(course)));
zip.addFile('media/01.png', png(90, 195, [200, 220, 240]));
zip.addFile('media/02.png', png(90, 195, [240, 220, 200]));
zip.addFile('assets/logo.png', png(40, 20, [255, 255, 255]));

let r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
const cookie = r.headers.get('set-cookie').split(';')[0];
const { csrf } = await r.json();
const h = { cookie, 'x-csrf-token': csrf };
const fd = new FormData();
fd.append('file', new Blob([zip.toBuffer()]), 'synthetic.zip');
r = await fetch(`${BASE}/api/import`, { method: 'POST', headers: h, body: fd });
const sum = await r.json();
ok(r.status === 201 && sum.converted && sum.converted.steps === 4, `Import Klick-Übungs-Paket → ${r.status} ${JSON.stringify(sum.converted)}`);

const c = await (await fetch(`${BASE}/api/courses/${sum.courses[0]}`, { headers: h })).json();
ok(c.settings.masteryScore === 0, 'importierter Übungskurs: Bestehensgrenze 0');
const unit = await (await fetch(`${BASE}/api/units/${c.units[0].id}`, { headers: h })).json();
const p = unit.params;
const kinds = p.chapters.flatMap((ch) => ch.steps.map((s) => s.kind)).join(',');
ok(kinds === 'click,info,click,note', `Schrittarten ${kinds}`);
const tap = p.chapters[0].steps[0].area;
ok(tap.shape === 'ellipse' && Math.abs(tap.x + tap.w / 2 - 0.1) < 0.001, 'Tipp-Ziel wird zu Ellipse um denselben Mittelpunkt');
ok(p.chapters[0].steps[0].screenshot && !p.chapters[0].steps[1].screenshot, 'gleicher Screenshot wird nicht doppelt gespeichert');
ok(p.theme.sidebarColor === '#101820' && p.theme.footer === '© Test Org' && !!p.intro.logo, 'Farben, Fußzeile und Logo übernommen');
ok(p.l10n.start === 'Practise step by step' && p.l10n.doneTitle === 'Done!', 'Oberflächentexte übernommen');

// language version must carry the media files
r = await fetch(`${BASE}/api/courses/${c.id}/duplicate`, { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify({ language: 'de', title: 'Synthetic (DE)' }) });
const de = await r.json();
ok(r.status === 201, 'Sprachfassung DE angelegt');
const deUnit = await (await fetch(`${BASE}/api/units/${de.units[0].id}`, { headers: h })).json();
ok(deUnit.params.l10n.next === 'Weiter', `DE-Oberfläche: next = ${deUnit.params.l10n.next}`);
r = await fetch(`${BASE}/api/courses/${de.id}/export`, { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify({ format: 'scorm2004' }) });
const ex = await r.json();
ok(r.status === 201, `Export der Sprachfassung (mit Medien) → ${r.status} ${ex.error || ''}`);
if (r.status === 201) {
  const pkg = new AdmZip(Buffer.from(await (await fetch(`${BASE}/api/exports/${ex.id}/download`, { headers: h })).arrayBuffer()));
  const names = pkg.getEntries().map((e) => e.entryName);
  ok(names.filter((n) => /content\/images\/.*\.png$/.test(n)).length >= 3, 'Paket enthält Screenshots und Logo');
  ok(names.some((n) => /H5P\.AppSimulation|appsim/i.test(n)) || pkg.getEntries().some((e) => e.entryName.endsWith('index.html') && e.getData().toString().includes('AppSimulation')), 'Paket enthält den App-Simulation-Player');
  ok(ex.report.scoredUnits === 1, 'Einheit gilt als bewertet');
}
console.log(failures ? `\n✗ ${failures} Prüfung(en) fehlgeschlagen` : '\n✓ App-Simulation-Test bestanden');
process.exit(failures ? 1 : 0);
