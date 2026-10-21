// Review links: public access with a token, comments on blocks, team replies, resolve, revoke, MCP.
//   BASE=http://localhost:8099 node test/review.mjs
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
const H = { cookie: r.headers.get('set-cookie').split(';')[0], 'x-csrf-token': login.csrf, 'content-type': 'application/json' };
const api = async (method, p, body, headers = H) => {
  const res = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await res.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    j = t;
  }
  return { status: res.status, body: j, headers: res.headers };
};
const anon = { 'content-type': 'application/json' };

const proj = (await api('POST', '/api/projects', { name: 'Reviewtest' })).body;
const units = (await api('POST', `/api/projects/${proj.id}/courses`, { title: 'Einheiten', language: 'de' })).body;
ok((await api('POST', `/api/courses/${units.id}/review-links`, {})).status === 400, 'no review links for unit courses');
const c = (await api('POST', `/api/projects/${proj.id}/courses`, { title: 'Reviewkurs', language: 'de', settings: { mode: 'blocks' } })).body;
const saved = (await api('PUT', `/api/courses/${c.id}/blocks`, { blocks: [{ type: 'title', data: { content: 'Start' } }, { type: 'text', data: { content: 'Hallo Welt' } }] })).body;
const blockId = saved.blocks[1].id;

const link = await api('POST', `/api/courses/${c.id}/review-links`, { label: 'Fachabteilung', days: 7 });
ok(link.status === 201 && /\/review\/[A-Za-z0-9_-]{40,}$/.test(link.body.url), 'review link created');
const token = link.body.url.split('/review/')[1];
const page = await fetch(`${BASE}/review/${token}`);
ok(page.status === 200 && /review\.js/.test(await page.text()), 'review page is public');
const player = await fetch(`${BASE}/review/${token}/player`);
ok(player.status === 200 && /PP_COURSE/.test(await player.text()), 'review player is public');
ok((await fetch(`${BASE}/review/${token.slice(0, -2)}xx`)).status === 404, 'wrong token → 404');
const info = await api('GET', `/review-api/${token}`, undefined, anon);
ok(info.status === 200 && info.body.blocks.length === 2 && info.body.blocks[1].summary === 'Hallo Welt' && !JSON.stringify(info.body).includes(c.id), 'review api gives block summaries without internal ids');

let cm = await api('POST', `/review-api/${token}/comments`, { name: 'Maren Ohlsen', body: 'Der Text ist zu kurz.', blockId }, anon);
ok(cm.status === 201 && cm.body.blockId === blockId && !cm.body.team, 'reviewer comments on a block');
ok((await api('POST', `/review-api/${token}/comments`, { name: 'X', body: '   ' }, anon)).status === 400, 'empty comment rejected');
ok((await api('POST', `/review-api/${token}/comments`, { name: '', body: 'a' }, anon)).status === 400, 'comment without name rejected');
ok((await api('POST', `/review-api/${token}/comments`, { name: 'X', body: 'a', blockId: 'b_nope1234' }, anon)).status === 400, 'comment on unknown block rejected');
const big = await fetch(`${BASE}/review-api/${token}/comments`, { method: 'POST', headers: anon, body: JSON.stringify({ name: 'X', body: 'a'.repeat(40000) }) });
ok(big.status === 413, `oversized body rejected (${big.status})`);
const xss = await api('POST', `/review-api/${token}/comments`, { name: '<img src=x onerror=alert(1)>', body: '<script>alert(1)</script>' }, anon);
ok(xss.status === 201 && xss.body.body === '<script>alert(1)</script>', 'comment text is stored as plain text (escaped on output)');

const list = await api('GET', `/api/courses/${c.id}/comments`);
ok(list.status === 200 && list.body.length === 2, 'editor sees comments');
const reply = await api('POST', `/api/courses/${c.id}/comments`, { body: 'Ist ergänzt.', parentId: cm.body.id });
ok(reply.status === 201 && reply.body.team, 'team reply');
const res1 = await api('PATCH', `/api/courses/${c.id}/comments/${cm.body.id}`, { status: 'resolved' });
ok(res1.status === 200 && res1.body.status === 'resolved' && res1.body.replies.length === 1, 'comment resolved');
const again = await api('POST', `/review-api/${token}/comments`, { name: 'Maren Ohlsen', body: 'Noch nicht ganz.', parentId: cm.body.id }, anon);
const reopened = (await api('GET', `/api/courses/${c.id}/comments?status=open`)).body.find((x) => x.id === cm.body.id);
ok(again.status === 201 && reopened, 'reviewer reply reopens a resolved comment');

const links = (await api('GET', `/api/courses/${c.id}/review-links`)).body;
ok(links[0].comments >= 3 && links[0].active, 'link list with counts');
ok((await api('DELETE', `/api/courses/${c.id}/review-links/${links[0].id}`)).status === 200, 'link revoked');
ok((await api('GET', `/review-api/${token}`, undefined, anon)).status === 404, 'revoked link no longer works');

// MCP
const tok = (await api('POST', '/api/me/api-tokens', { name: 'review-test', days: 1, password: PASSWORD })).body.created.token;
let rid = 0;
async function tool(name, args) {
  const res = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${tok}`, 'mcp-protocol-version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++rid, method: 'tools/call', params: { name, arguments: args } }) });
  const j = JSON.parse(await res.text());
  if (j.result?.isError) throw new Error(j.result.content.map((x) => x.text).join(' '));
  return j.result.structuredContent;
}
const mlink = await tool('create_review_link', { course_id: c.id, label: 'MCP' });
ok(/\/review\//.test(mlink.url), 'mcp create_review_link');
const mlist = await tool('list_review_comments', { course_id: c.id, status: 'open' });
ok(mlist.items.some((x) => x.block?.summary === 'Hallo Welt'), 'mcp list_review_comments with block context');
const mres = await tool('resolve_review_comment', { course_id: c.id, comment_id: cm.body.id });
ok(mres.status === 'resolved', 'mcp resolve_review_comment');

await api('DELETE', `/api/projects/${proj.id}`);
console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ Reviewtest bestanden');
process.exit(failures ? 1 : 0);
