// Public review page: course player on the left, comments on the right. Talks to /review-api/<token>.
const token = location.pathname.split('/')[2];
const frame = document.getElementById('rv-frame');
const panel = document.getElementById('rv-panel');
const T = {
  de: {
    review: 'Review', general: 'Allgemein zum Kurs', block: 'Ausgewählter Block', pick: 'Klicke im Kurs auf einen Abschnitt, um ihn zu kommentieren.', placeholder: 'Was sollte anders sein?',
    send: 'Kommentar senden', reply: 'Antworten', replyPh: 'Antwort …', sendReply: 'Antwort senden', thisBlock: 'Dieser Block', all: 'Alle', none: 'Noch keine Kommentare.', noneBlock: 'Zu diesem Block gibt es noch keine Kommentare.',
    resolved: 'erledigt', team: 'Team', nameTitle: 'Wie heißt du?', nameHint: 'Dein Name steht bei deinen Kommentaren. Er wird nur in diesem Browser gemerkt.', namePh: 'Vor- und Nachname',
    nameSave: 'Weiter', as: 'Kommentieren als {name}', change: 'ändern', sent: 'Danke! Dein Kommentar ist angekommen.', gone: 'Dieser Review-Link ist ungültig oder abgelaufen.', expires: 'Link gültig bis {date}', show: 'Zeigen', clear: 'Allgemein kommentieren'
  },
  en: {
    review: 'Review', general: 'General comment on the course', block: 'Selected block', pick: 'Click a section of the course to comment on it.', placeholder: 'What should be different?',
    send: 'Send comment', reply: 'Reply', replyPh: 'Reply …', sendReply: 'Send reply', thisBlock: 'This block', all: 'All', none: 'No comments yet.', noneBlock: 'No comments on this block yet.',
    resolved: 'resolved', team: 'Team', nameTitle: 'What is your name?', nameHint: 'Your name is shown with your comments. It is only remembered in this browser.', namePh: 'First and last name',
    nameSave: 'Continue', as: 'Commenting as {name}', change: 'change', sent: 'Thank you! Your comment has arrived.', gone: 'This review link is invalid or has expired.', expires: 'Link valid until {date}', show: 'Show', clear: 'Comment on the course in general'
  }
};
let L = T.de;
const t = (k, v = {}) => Object.entries(v).reduce((s, [a, b]) => s.split(`{${a}}`).join(b), L[k] || k);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k) || '';
    } catch {
      return '';
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  }
};

let data = null;
let sel = null;
let view = 'block';
let name = store.get('pp-review-name');
let replyTo = null;
let draft = '';

async function load() {
  const res = await fetch(`/review-api/${encodeURIComponent(token)}`, { credentials: 'omit' });
  if (!res.ok) {
    document.getElementById('rv').innerHTML = `<div class="rv-gone"><span class="rv-mark"></span><p>${esc(T[navigator.language?.startsWith('de') ? 'de' : 'en'].gone)}</p></div>`;
    return false;
  }
  data = await res.json();
  L = T[data.course.ui] || T.en;
  document.documentElement.lang = data.course.ui;
  document.getElementById('rv-title').textContent = data.course.title;
  document.title = `${data.course.title} · ${t('review')}`;
  document.getElementById('rv-kicker').textContent = data.link.label ? `${t('review')} · ${data.link.label}` : t('review');
  return true;
}

function marks() {
  const counts = {};
  for (const c of data.comments) if (c.blockId && c.status === 'open') counts[c.blockId] = (counts[c.blockId] || 0) + 1;
  frame.contentWindow?.postMessage({ type: 'pp-marks', counts }, location.origin);
}

function nameChip() {
  const b = document.getElementById('rv-name');
  b.innerHTML = name ? `${esc(t('as', { name }))} <u>${esc(t('change'))}</u>` : '';
  b.hidden = !name;
  b.onclick = askName;
}

function askName() {
  panel.innerHTML = `<form class="rv-card rv-namebox" id="nf"><h2>${esc(t('nameTitle'))}</h2><p class="rv-muted">${esc(t('nameHint'))}</p>
    <input class="rv-input" id="nn" maxlength="80" required placeholder="${esc(t('namePh'))}" value="${esc(name)}" autocomplete="name">
    <button class="rv-btn" type="submit">${esc(t('nameSave'))}</button></form>`;
  const f = panel.querySelector('#nf');
  f.querySelector('#nn').focus();
  f.onsubmit = (e) => {
    e.preventDefault();
    name = f.querySelector('#nn').value.trim();
    if (!name) return;
    store.set('pp-review-name', name);
    nameChip();
    paint();
  };
}

function fmt(s) {
  const d = new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  return d.toLocaleString(data.course.ui === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function thread(c) {
  const blk = c.blockId ? data.blocks.find((b) => b.id === c.blockId) : null;
  return `<article class="rv-c ${c.status === 'resolved' ? 'is-done' : ''}">
    <header><b>${esc(c.author)}</b>${c.team ? `<span class="rv-tag">${esc(t('team'))}</span>` : ''}<time>${fmt(c.createdAt)}</time>${c.status === 'resolved' ? `<span class="rv-tag ok">${esc(t('resolved'))}</span>` : ''}</header>
    ${view === 'all' && blk ? `<button type="button" class="rv-ref" data-goto="${esc(blk.id)}">↳ ${esc(blk.summary || blk.type)}</button>` : ''}
    <p>${esc(c.body).replace(/\n/g, '<br>')}</p>
    ${c.replies.map((r) => `<div class="rv-r"><header><b>${esc(r.author)}</b>${r.team ? `<span class="rv-tag">${esc(t('team'))}</span>` : ''}<time>${fmt(r.createdAt)}</time></header><p>${esc(r.body).replace(/\n/g, '<br>')}</p></div>`).join('')}
    ${replyTo === c.id
      ? `<form class="rv-replyf" data-reply-form="${esc(c.id)}"><textarea class="rv-input" maxlength="2000" rows="2" placeholder="${esc(t('replyPh'))}" required></textarea><button class="rv-btn small" type="submit">${esc(t('sendReply'))}</button></form>`
      : `<button type="button" class="rv-link" data-reply="${esc(c.id)}">${esc(t('reply'))}</button>`}
  </article>`;
}

function paint() {
  if (!name) return askName();
  const blk = sel ? data.blocks.find((b) => b.id === sel) : null;
  const list = view === 'block' ? data.comments.filter((c) => (sel ? c.blockId === sel : !c.blockId)) : data.comments;
  const open = data.comments.filter((c) => c.status === 'open').length;
  panel.innerHTML = `
    <div class="rv-seg" role="group"><button type="button" data-view="block" class="${view === 'block' ? 'is-on' : ''}">${esc(sel ? t('thisBlock') : t('general'))}</button><button type="button" data-view="all" class="${view === 'all' ? 'is-on' : ''}">${esc(t('all'))} <span>${data.comments.length}</span>${open ? `<em>${open}</em>` : ''}</button></div>
    <form class="rv-card rv-compose" id="cf">
      <div class="rv-ctx"><span class="rv-kick">${esc(blk ? t('block') : t('general'))}</span><strong>${esc(blk ? blk.summary || blk.type : t('pick'))}</strong>${blk ? `<button type="button" class="rv-link" id="clear">${esc(t('clear'))}</button>` : ''}</div>
      <textarea class="rv-input" id="cb" maxlength="2000" rows="4" required placeholder="${esc(t('placeholder'))}">${esc(draft)}</textarea>
      <button class="rv-btn" type="submit">${esc(t('send'))}</button>
    </form>
    <div class="rv-list">${list.length ? list.slice().reverse().map(thread).join('') : `<p class="rv-muted rv-empty">${esc(sel && view === 'block' ? t('noneBlock') : t('none'))}</p>`}</div>`;
  panel.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => ((view = b.dataset.view), paint())));
  panel.querySelector('#clear')?.addEventListener('click', () => {
    sel = null;
    paint();
  });
  const cb = panel.querySelector('#cb');
  cb.oninput = () => (draft = cb.value);
  panel.querySelector('#cf').onsubmit = async (e) => {
    e.preventDefault();
    const ok = await post({ body: cb.value, blockId: sel || undefined });
    if (ok) draft = '';
    paint();
  };
  panel.querySelectorAll('[data-reply]').forEach((b) => (b.onclick = () => ((replyTo = b.dataset.reply), paint(), panel.querySelector('[data-reply-form] textarea')?.focus())));
  panel.querySelectorAll('[data-reply-form]').forEach((f) => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (await post({ body: f.querySelector('textarea').value, parentId: f.dataset.replyForm })) replyTo = null;
      paint();
    };
  });
  panel.querySelectorAll('[data-goto]').forEach((b) => {
    b.onclick = () => {
      sel = b.dataset.goto;
      view = 'block';
      frame.contentWindow?.postMessage({ type: 'pp-goto', blockId: sel }, location.origin);
      paint();
    };
  });
}

async function post(body) {
  const res = await fetch(`/review-api/${encodeURIComponent(token)}/comments`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'content-type': 'application/json', 'accept-language': data.course.ui },
    body: JSON.stringify({ ...body, name })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(j.error || 'Error', true);
    return false;
  }
  await refresh();
  toast(t('sent'));
  return true;
}

async function refresh() {
  const res = await fetch(`/review-api/${encodeURIComponent(token)}`, { credentials: 'omit' });
  if (res.ok) data = await res.json();
  marks();
}

function toast(msg, err) {
  const d = document.createElement('div');
  d.className = `rv-toast ${err ? 'err' : ''}`;
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3200);
}

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.source !== frame.contentWindow || !e.data) return;
  if (e.data.type === 'pp-ready') marks();
  if (e.data.type === 'pp-select' && data.blocks.some((b) => b.id === e.data.blockId)) {
    if (sel === e.data.blockId) return;
    sel = e.data.blockId;
    view = 'block';
    replyTo = null;
    paint();
  }
});

if (await load()) {
  nameChip();
  frame.src = `/review/${encodeURIComponent(token)}/player`;
  paint();
}
