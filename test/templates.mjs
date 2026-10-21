// Course templates: built-in templates, course from template, save as own template with media, MCP.
//   BASE=http://localhost:8099 node test/templates.mjs
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

const list = (await api('GET', '/api/templates?lang=en')).body;
ok(list.filter((t) => t.builtin).length === 6 && list.find((t) => t.id === 'builtin:software').name === 'Software training', 'six built-in templates, English texts');
const proj = (await api('POST', '/api/projects', { name: 'Vorlagentest' })).body;
const c = await api('POST', `/api/projects/${proj.id}/courses`, { title: 'Compliance 2026', language: 'de', template: 'builtin:compliance' });
ok(c.status === 201 && c.body.settings.mode === 'blocks' && c.body.settings.navigation === 'linear' && c.body.settings.masteryScore === 80, 'course from template gets mode, navigation and mastery');
ok(c.body.blocks.length > 8 && c.body.blocks[0].data.content === 'Warum das wichtig ist' && !c.body.blocks.some((b) => b.issues), 'template blocks are complete and German');
ok(c.body.design.player === 'lesson' && c.body.design.theme.preset === 'ink', 'template design applied');
const ex = await api('POST', `/api/courses/${c.body.id}/export`, { format: 'scorm12' });
ok(ex.status === 201, `course from template exports right away (${ex.status})`);
for (const t of list.filter((x) => x.builtin)) {
  const x = await api('POST', `/api/projects/${proj.id}/courses`, { title: t.name, language: 'en', template: t.id });
  const e = await api('POST', `/api/courses/${x.body.id}/export`, { format: 'cmi5' });
  ok(x.status === 201 && e.status === 201, `${t.id} → course → cmi5 export`);
}
ok((await api('POST', `/api/projects/${proj.id}/courses`, { title: 'X', template: 'builtin:nope' })).status === 404, 'unknown template → 404');

// own template with media
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const up = await fetch(`${BASE}/api/courses/${c.body.id}/media`, { method: 'POST', headers: { ...H, 'x-filename': 'cover.png', 'content-type': 'image/png' }, body: png });
const media = await up.json();
await api('PUT', `/api/courses/${c.body.id}/design`, { cover: { image: media.ref } });
const saved = await api('POST', `/api/courses/${c.body.id}/template`, { name: 'Unsere Unterweisung', description: 'Mit Logo', shared: true });
ok(saved.status === 201 && saved.body.shared && saved.body.lessons.length >= 4, 'course saved as shared template');
const fromOwn = await api('POST', `/api/projects/${proj.id}/courses`, { title: 'Unterweisung 2027', language: 'de', template: saved.body.id });
ok(fromOwn.status === 201 && fromOwn.body.design.cover.image === media.ref, 'own template keeps the cover image');
const m = (await api('GET', `/api/courses/${fromOwn.body.id}/media`)).body;
ok(m.some((x) => x.ref === media.ref), 'media copied into the new course');
const proj2 = (await api('GET', `/api/projects/${proj.id}`)).body;
ok(proj2.courses.find((x) => x.id === fromOwn.body.id)?.thumb?.image === media.ref, 'project list carries a thumbnail');

// MCP
const tok = (await api('POST', '/api/me/api-tokens', { name: 'tpl-test', days: 1, password: 'adminpass1234' })).body.created.token;
const mcp = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${tok}`, 'mcp-protocol-version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_templates', arguments: { language: 'de' } } }) });
const mj = JSON.parse(await mcp.text());
ok(mj.result.structuredContent.items.some((t) => t.id === saved.body.id), 'mcp list_templates includes own template');

ok((await api('DELETE', `/api/templates/${saved.body.id}`)).status === 200, 'template deleted');
await api('DELETE', `/api/projects/${proj.id}`);
console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ Vorlagentest bestanden');
process.exit(failures ? 1 : 0);
