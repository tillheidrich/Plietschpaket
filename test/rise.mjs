// Rise 360 import with a synthetic export that follows the structure of Rise SCORM exports.
//   BASE=http://localhost:8099 node test/rise.mjs
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
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const course = {
  course: {
    title: 'Datenschutz <b>kompakt</b>',
    description: '<p>Was im Alltag zählt.</p>',
    lessons: [
      { type: 'section', title: 'Grundlagen' },
      {
        type: 'blocks',
        title: 'Warum Datenschutz?',
        items: [
          { type: 'text', variant: 'heading paragraph', items: [{ heading: 'Worum es geht', paragraph: '<p>Personenbezogene Daten sind <strong>alles</strong>, was auf eine Person verweist.</p>' }] },
          { type: 'statement', variant: 'a', items: [{ paragraph: '<p>Daten gehören den Menschen, nicht den Systemen.</p>' }] },
          { type: 'list', variant: 'numbered', items: [{ paragraph: 'Zweck klären' }, { paragraph: 'Nur Nötiges erheben' }, { paragraph: 'Rechtzeitig löschen' }] },
          { type: 'image', variant: 'centered', items: [{ media: { image: { key: 'assets/hero.png', altText: 'Ordner' } }, caption: 'Akten im Archiv' }] },
          { type: 'interactive', variant: 'accordion', items: [{ title: 'Was ist ein Datenleck?', description: '<p>Unbefugter Zugriff.</p>' }, { title: 'Wen informiere ich?', description: '<p>Die Datenschutzbeauftragte.</p>' }] },
          { type: 'divider', variant: 'continue' },
          { type: 'knowledgeCheck', variant: 'multiple choice', items: [{ title: 'Was ist personenbezogen?', answers: [{ title: 'Die E-Mail-Adresse', correct: true }, { title: 'Das Wetter', correct: false }], feedback: 'Die Adresse verweist auf eine Person.' }] },
          { type: 'mystery', variant: 'x', items: [{ title: 'Unbekannter Block', description: 'Dieser Text darf nicht verloren gehen.' }] }
        ]
      },
      {
        type: 'blocks',
        title: 'Im Alltag',
        items: [
          { type: 'interactive', variant: 'process', items: [{ title: 'Erkennen' }, { title: 'Melden', description: '<p>Sofort.</p>' }] },
          { type: 'interactive', variant: 'flashcard', items: [{ front: { description: 'DSGVO' }, back: { description: 'Datenschutz-Grundverordnung' } }] },
          { type: 'quote', variant: 'a', items: [{ paragraph: 'Vertrauen ist schnell verspielt.', name: 'Lea Brandt' }] },
          { type: 'image', variant: 'centered', items: [{ media: { image: { key: 'assets/missing.png' } } }] }
        ]
      }
    ]
  }
};
const b64 = Buffer.from(JSON.stringify(course)).toString('base64');
const zip = new AdmZip();
zip.addFile('imsmanifest.xml', Buffer.from('<manifest/>'));
zip.addFile('scormcontent/index.html', Buffer.from(`<!doctype html><html><head><title>Articulate Rise</title></head><body><script>window.courseData = deserialize("${b64}");</script></body></html>`));
zip.addFile('scormcontent/assets/hero.png', png);
const form = new FormData();
form.append('file', new Blob([zip.toBuffer()]), 'datenschutz-rise-scorm.zip');
const res = await fetch(`${BASE}/api/import`, { method: 'POST', headers: H, body: form });
const sum = await res.json();
ok(res.status === 201 && sum.converted?.from === 'Rise 360', `Rise export detected (${res.status} ${JSON.stringify(sum.converted || sum)})`);
const c = await (await fetch(`${BASE}/api/courses/${sum.courses[0]}`, { headers: H })).json();
const types = c.blocks.map((b) => b.type);
ok(c.title === 'Datenschutz kompakt' && c.description === 'Was im Alltag zählt.' && c.settings.mode === 'blocks', 'title, description and block mode');
ok(c.outline.length === 2 && c.blocks[0].data.kicker === 'Grundlagen', 'lessons with section as kicker');
for (const t of ['subtitle', 'text', 'statement', 'numberedList', 'image', 'accordion', 'divider', 'quiz', 'process', 'flipcard', 'quote']) ok(types.includes(t), `mapped ${t}`);
ok(c.blocks.some((b) => b.type === 'text' && /nicht verloren/.test(b.data.content)), 'unknown block kept as text');
const quiz = c.blocks.find((b) => b.type === 'quiz');
ok(quiz.data.correct[0] === 0 && quiz.data.explanation, 'quiz answers and feedback');
const image = c.blocks.find((b) => b.type === 'image' && !b.issues);
ok(image && /^media:hero/.test(image.data.image) && image.data.alt === 'Ordner', 'image copied with alt text');
ok(sum.converted.missingMedia === 1 && sum.converted.incomplete === 0, 'missing image reported, no broken block created');
await fetch(`${BASE}/api/projects/${sum.projectId}`, { method: 'DELETE', headers: H });
console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ Rise-Import-Test bestanden');
process.exit(failures ? 1 : 0);
