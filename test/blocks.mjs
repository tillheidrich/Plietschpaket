// Block course end-to-end: media upload, validation, blocks with all types, H5P unit as block, design,
// SCORM export of the player. Images come from IMAGES (a folder with office.jpg, meeting.jpg, avatar-lea.jpg …)
// or are generated as plain PNGs.
//   BASE=http://localhost:8099 IMAGES=/path node test/blocks.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import AdmZip from 'adm-zip';

const BASE = process.env.BASE || 'http://localhost:8099';
const EMAIL = process.env.EMAIL || 'admin@example.com';
const PASSWORD = process.env.PASSWORD || 'adminpass1234';
const IMAGES = process.env.IMAGES || '';
let failures = 0;
const ok = (c, m) => {
  console.log(`${c ? '✓' : '✗'} ${m}`);
  if (!c) failures++;
};

function png(w, h, rgb) {
  const t = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b) => {
    let c = 0xffffffff;
    for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8);
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
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
}
const image = (name, rgb) => (IMAGES && fs.existsSync(path.join(IMAGES, name)) ? { name, buf: fs.readFileSync(path.join(IMAGES, name)) } : { name: name.replace(/\.\w+$/, '.png'), buf: png(160, 90, rgb) });

let r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
const login = await r.json();
const cookie = r.headers.get('set-cookie').split(';')[0];
const H = { cookie, 'x-csrf-token': login.csrf };
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

const types = await api('GET', '/api/block-types');
ok(types.status === 200 && types.body.types.length >= 38, `block catalogue (${types.body.types?.length} types)`);

const project = (await api('POST', '/api/projects', { name: 'Kontor · Kundenservice' })).body;
const course = (await api('POST', `/api/projects/${project.id}/courses`, { title: 'Souverän im Kundengespräch', description: 'Wie du schwierige Gespräche am Schalter ruhig und lösungsorientiert führst.', language: 'de', settings: { mode: 'blocks', masteryScore: 70 } })).body;
ok(course.settings.mode === 'blocks', 'course created in block mode');

async function upload(file) {
  const res = await fetch(`${BASE}/api/courses/${course.id}/media`, { method: 'POST', headers: { ...H, 'x-filename': encodeURIComponent(file.name), 'content-type': 'application/octet-stream' }, body: file.buf });
  return { status: res.status, body: await res.json() };
}
const media = {};
for (const [key, file] of Object.entries({
  office: image('office.jpg', [70, 90, 120]), meeting: image('meeting.jpg', [120, 90, 70]), service: image('service.jpg', [90, 120, 70]),
  shop: image('shop.jpg', [140, 120, 90]), clinic: image('clinic.jpg', [90, 140, 120]), lea: image('avatar-lea.jpg', [200, 160, 140])
})) {
  const up = await upload(file);
  ok(up.status === 201 && /^media:/.test(up.body.ref), `upload ${file.name}`);
  media[key] = up.body.ref;
}
const fake = await upload({ name: 'evil.png', buf: Buffer.from('<script>alert(1)</script>') });
ok(fake.status === 400, 'upload with wrong content is rejected');
const evilExt = await upload({ name: 'evil.html', buf: Buffer.from('<h1>x</h1>') });
ok(evilExt.status === 400, 'html upload is rejected');

const bad = await api('PUT', `/api/courses/${course.id}/blocks`, { blocks: [{ type: 'quiz', data: { question: 'x', options: ['a'] } }, { type: 'nope' }, { type: 'image', data: { image: 'media:missing.png' } }] });
ok(bad.status === 400 && /Fehler/.test(bad.body.error), 'invalid blocks are rejected with reasons');

// H5P scenario as a block
const MCP = await api('POST', '/api/me/api-tokens', { name: 'blocks-test', days: 30, password: PASSWORD });
const bearer = MCP.body.created.token;
let rid = 0;
async function tool(name, args) {
  const res = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${bearer}`, 'mcp-protocol-version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++rid, method: 'tools/call', params: { name, arguments: args } }) });
  const j = JSON.parse(await res.text());
  if (j.result?.isError) throw new Error(j.result.content.map((c) => c.text).join(' '));
  return j.result.structuredContent ?? j.result.content.map((c) => c.text).join('');
}
const { DEMO_SCENARIO } = await import('./scenario-data.mjs');
const unit = await tool('create_unit', { course_id: course.id, content_type: 'H5P.Scenario', title: 'Rollenspiel: Herr Chen am Schalter', params: DEMO_SCENARIO });

const html = (t) => `<p>${t}</p>`;
const blocks = [
  { type: 'title', data: { content: 'Warum Gespräche kippen', kicker: 'Lektion 1', image: media.service } },
  { type: 'text', data: { content: '<p>Die meisten Beschwerden eskalieren nicht wegen des Problems, sondern wegen der <b>ersten 30 Sekunden</b>. Wer sich gehört fühlt, wird ruhiger. Wer sich abgewimmelt fühlt, wird lauter.</p><p>In diesem Kurs übst du, wie du in diesen Sekunden die Richtung bestimmst.</p>' } },
  { type: 'callout', data: { variant: 'key', title: 'Merke', content: html('Erst zuhören, dann lösen. In genau dieser Reihenfolge.') } },
  { type: 'list', data: { items: ['Blickkontakt halten und ausreden lassen', 'Den Ärger in eigenen Worten spiegeln', 'Konkret sagen, was du jetzt tust'] } },
  { type: 'quote', data: { content: 'Die Leute vergessen, was du gesagt hast. Aber nie, wie sie sich dabei gefühlt haben.', author: 'Lea Brandt, Teamleitung Service', image: media.lea } },
  { type: 'flipcard', data: { cards: [{ front: 'Spiegeln', back: 'Das Gefühl der Person in eigenen Worten wiedergeben: „Das ist ärgerlich, zwei Wochen ohne Lösung.“' }, { front: 'Deeskalieren', back: 'Tempo und Lautstärke bewusst senken, statt dagegenzuhalten.' }, { front: 'Lösung anbieten', back: 'Einen konkreten nächsten Schritt nennen, den du selbst gehst.' }] } },
  { type: 'quiz', data: { question: 'Ein Kunde schimpft lautstark. Was tust du zuerst?', options: ['Ihn bitten, leiser zu sein', 'Zuhören und den Ärger anerkennen', 'Die Richtlinie erklären'], correct: [1], explanation: 'Wer sich gehört fühlt, beruhigt sich. Erklärungen wirken in dieser Phase wie Rechtfertigungen.' } },
  { type: 'title', data: { content: 'Der Ablauf in vier Schritten', kicker: 'Lektion 2', image: media.meeting } },
  { type: 'process', data: { steps: [{ title: 'Zuhören', content: html('Ausreden lassen, nicken, nicht unterbrechen.') }, { title: 'Spiegeln', content: html('Gefühl benennen: „Das ist wirklich ärgerlich.“') }, { title: 'Klären', content: html('Eine konkrete Frage stellen: Was genau ist passiert?') }, { title: 'Lösen', content: html('Selbst handeln und den nächsten Schritt zusagen.') }] } },
  { type: 'tabs', data: { tabs: [{ title: 'Am Schalter', content: html('Körpersprache zählt doppelt: offen stehen, Hände sichtbar.') }, { title: 'Am Telefon', content: html('Die Stimme trägt alles: langsamer sprechen als dein Gegenüber.') }, { title: 'Per E-Mail', content: html('Erst den Ärger anerkennen, dann die Lösung, zuletzt die Erklärung.') }] } },
  { type: 'imageText', data: { image: media.office, alt: 'Großraumbüro', title: 'Hinter den Kulissen', content: html('Viele Lösungen brauchen eine Kollegin im Backoffice. Sag dem Kunden, wen du einbindest und bis wann er Rückmeldung bekommt.'), side: 'right' } },
  { type: 'timeline', data: { items: [{ date: 'Tag 1', title: 'Reklamation geht ein' }, { date: 'Tag 2', title: 'Rückruf mit Lösungsvorschlag' }, { date: 'Tag 5', title: 'Ersatz ist beim Kunden', content: html('Kurz nachfassen, ob alles passt.') }] } },
  { type: 'matching', data: { prompt: 'Ordne jedem Satz die Technik zu.', pairs: [{ left: '„Das verstehe ich, zwei Wochen sind lang.“', right: 'Spiegeln' }, { left: '„Seit wann funktioniert das Gerät nicht?“', right: 'Klären' }, { left: '„Ich starte die Rücksendung jetzt.“', right: 'Lösen' }] } },
  { type: 'sorting', data: { prompt: 'Bring die Schritte in die richtige Reihenfolge.', items: ['Zuhören', 'Spiegeln', 'Klären', 'Lösen'] } },
  { type: 'title', data: { content: 'Üben im Rollenspiel', kicker: 'Lektion 3', image: media.shop } },
  { type: 'statement', data: { content: 'Jetzt bist du dran. Herr Chen steht am Schalter.', style: 'dark' } },
  { type: 'h5p', data: { unitId: unit.id } },
  { type: 'fillBlanks', data: { prompt: 'Ergänze die Lücken.', text: 'Wer sich [gehört|verstanden] fühlt, wird ruhiger. Erklärungen wirken früh wie [Rechtfertigungen|Ausreden].' } },
  { type: 'bucketSort', data: { prompt: 'Was hilft, was schadet?', buckets: [{ name: 'Hilft', items: ['Ausreden lassen', 'Konkreten Schritt nennen'] }, { name: 'Schadet', items: ['Auf Richtlinien verweisen', 'Unterbrechen'] }] } },
  { type: 'graph', data: { chartType: 'bar', title: 'Zufriedenheit nach dem Gespräch', labels: ['Ohne Training', 'Nach Training'], series: [{ name: 'Zufrieden in %', values: [54, 81] }] } },
  { type: 'comparison', data: { left: { title: 'Rechtfertigen', items: ['Erklärt die Regeln', 'Verteidigt das Unternehmen'] }, right: { title: 'Lösen', items: ['Nimmt den Ärger ernst', 'Handelt sofort'] } } },
  { type: 'accordion', data: { items: [{ heading: 'Was, wenn der Kunde beleidigend wird?', content: html('Ruhig eine Grenze setzen und die Teamleitung dazuholen.') }, { heading: 'Darf ich Kulanz anbieten?', content: html('Bis 50 € entscheidest du selbst.') }] } },
  { type: 'title', data: { content: 'Abschluss', kicker: 'Lektion 4' } },
  { type: 'checklist', data: { title: 'Bevor du loslegst', items: ['Ich lasse ausreden', 'Ich spiegle das Gefühl', 'Ich nenne einen konkreten Schritt'] } },
  { type: 'assessment', data: { title: 'Abschlusstest', intro: 'Fünf Fragen, ab 70 % bestanden.', passPercent: 70, questions: [
    { question: 'Was ist der erste Schritt?', options: ['Lösen', 'Zuhören', 'Klären'], correct: [1] },
    { question: 'Was bedeutet Spiegeln?', options: ['Gefühl in eigenen Worten wiedergeben', 'Den Satz wörtlich wiederholen'], correct: [0] },
    { question: 'Welche Sätze deeskalieren?', options: ['„Das ist ärgerlich.“', '„Das ist unsere Richtlinie.“', '„Ich kümmere mich jetzt darum.“'], correct: [0, 2] },
    { question: 'Wie sprichst du am Telefon?', options: ['Schneller als das Gegenüber', 'Langsamer als das Gegenüber'], correct: [1] },
    { question: 'Bis zu welchem Betrag entscheidest du über Kulanz?', options: ['20 €', '50 €', '100 €'], correct: [1] }
  ] } },
  { type: 'furtherReading', data: { links: [{ title: 'Leitfaden Beschwerdemanagement', url: 'https://example.com/leitfaden', description: 'Intern, 12 Seiten' }] } }
];
const saved = await api('PUT', `/api/courses/${course.id}/blocks`, { blocks });
ok(saved.status === 200 && saved.body.blocks.length === blocks.length, `blocks saved (${saved.body.blocks?.length})`);
ok(saved.body.outline?.length === 4, `outline: ${saved.body.outline?.length} lessons`);

const ins = await api('POST', `/api/courses/${course.id}/blocks`, { afterId: saved.body.blocks[1].id, blocks: [{ type: 'divider', data: {} }] });
ok(ins.status === 201 && ins.body.course.blocks[2].type === 'divider', 'insert after block');
const del = await api('DELETE', `/api/courses/${course.id}/blocks/${ins.body.inserted[0]}`);
ok(del.status === 200 && del.body.blocks.length === blocks.length, 'delete block');

const design = await api('PUT', `/api/courses/${course.id}/design`, { player: process.env.DESIGN || 'studio', theme: { preset: 'ocean', font: 'Geist', radius: 'rounded' }, cover: { image: media.service, kicker: 'Kontor · Service-Akademie', duration: '25 Minuten' }, completion: { message: 'Stark! Du bist bereit für den Schalter.' } });
ok(design.status === 200 && design.body.design.theme.primary === '#1f4e79', 'design saved with preset colours');

// MCP block tools
const mTypes = await tool('list_block_types', {});
ok(mTypes.types.length >= 38 && mTypes.designs.includes('hub'), 'mcp list_block_types');
const mIns = await tool('insert_blocks', { course_id: course.id, after_id: saved.body.blocks[0].id, blocks: [{ type: 'subtitle', data: { content: 'Per MCP eingefügt' } }] });
ok(mIns.inserted.length === 1, 'mcp insert_blocks');
const mUpd = await tool('update_block', { course_id: course.id, block_id: mIns.inserted[0], data: { content: 'Per MCP geändert' } });
ok(mUpd.data.content === 'Per MCP geändert', 'mcp update_block');
await tool('move_block', { course_id: course.id, block_id: mIns.inserted[0], after_id: '' });
let mGet = await tool('get_blocks', { course_id: course.id });
ok(mGet.blocks[0].id === mIns.inserted[0], 'mcp move_block to start');
await tool('delete_blocks', { course_id: course.id, block_ids: [mIns.inserted[0]] });
mGet = await tool('get_blocks', { course_id: course.id });
ok(mGet.blocks.length === blocks.length && /\/live\//.test(mGet.liveUrl), 'mcp delete_blocks + get_blocks');
let mErr = '';
try { await tool('insert_blocks', { course_id: course.id, blocks: [{ type: 'quiz', data: { question: 'x' } }] }); } catch (e) { mErr = e.message; }
ok(/options|Optionen|Pflicht/i.test(mErr), `mcp validation error is readable (${mErr.slice(0, 80)})`);
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const mMedia = await tool('upload_course_media', { course_id: course.id, filename: 'pixel.png', base64: tinyPng.toString('base64') });
ok(mMedia.ref === 'media:pixel.png' || /^media:pixel/.test(mMedia.ref), `mcp upload_course_media (${mMedia.ref})`);
const mDesign = await tool('set_course_design', { course_id: course.id, design: { player: 'studio' } });
ok(mDesign.design?.player === 'studio' || mDesign.player === 'studio', 'mcp set_course_design');

// drafts: the web editor saves incomplete blocks, the export refuses them
const cur = (await api('GET', `/api/courses/${course.id}`)).body;
const draft = await api('PUT', `/api/courses/${course.id}/blocks`, { blocks: [...cur.blocks, { id: 'b_draft01', type: 'image', data: {} }], draft: true, expectedUpdatedAt: cur.updatedAt });
ok(draft.status === 200 && draft.body.blocks.at(-1).issues?.length === 1, `draft block kept with issues (${draft.status})`);
const stale = await api('PUT', `/api/courses/${course.id}/blocks`, { blocks: cur.blocks, draft: true, expectedUpdatedAt: '2000-01-01 00:00:00' });
ok(stale.status === 409, 'stale save is rejected with 409');
const exDraft = await api('POST', `/api/courses/${course.id}/export`, { format: 'scorm12' });
ok(exDraft.status === 400 && /unvollständig/.test(exDraft.body.error), `export refuses drafts (${exDraft.status})`);
const strict = await api('PUT', `/api/courses/${course.id}/blocks`, { blocks: [...cur.blocks, { type: 'image', data: {} }] });
ok(strict.status === 400, 'save without draft flag stays strict');
await api('PUT', `/api/courses/${course.id}/blocks`, { blocks: cur.blocks, draft: true });

const ex = await api('POST', `/api/courses/${course.id}/export`, { format: 'scorm12' });
ok(ex.status === 201 && ex.body.report.mode === 'blocks', `export (${ex.status}) ${JSON.stringify(ex.body.report?.warnings || ex.body.error)}`);
const zip = new AdmZip(Buffer.from(await (await fetch(`${BASE}/api/exports/${ex.body.id}/download`, { headers: H })).arrayBuffer()));
const names = zip.getEntries().map((e) => e.entryName);
ok(names.includes('runtime/player.js') && names.includes('runtime/blocks.js') && names.includes('runtime/fonts/Geist-Variable.woff2'), 'player runtime in package');
ok(names.filter((n) => n.startsWith('media/')).length === 6, `media in package (${names.filter((n) => n.startsWith('media/')).length})`);
ok(names.some((n) => /^units\/u01\/index\.html$/.test(n)), 'scenario unit packaged');
const manifest = zip.readAsText('imsmanifest.xml');
ok(/<adlcp:masteryscore>70<\/adlcp:masteryscore>/.test(manifest), 'mastery score in manifest');
console.log(`courseId=${course.id} exportId=${ex.body.id}`);
fs.writeFileSync('/tmp/blocks-last.json', JSON.stringify({ course: course.id, exp: ex.body.id }));
console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ Block-Kurs-Test bestanden');
process.exit(failures ? 1 : 0);
