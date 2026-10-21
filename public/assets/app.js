// Plietschpaket web app (vanilla, no build step). UI languages: German (source) and English.
import { EN } from './i18n.js';

const root = document.getElementById('root');
const state = { me: null, csrf: null, app: null, types: null, lang: initialLang() };

function initialLang() {
  try {
    const stored = localStorage.getItem('ss-lang');
    if (stored === 'de' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  return (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
}

/** Translate: German text is the key. */
function t(key, vars) {
  let s = state.lang === 'en' && EN[key] !== undefined ? EN[key] : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}
/** Count + noun: plural(3, 'Kurs', 'Kurse') */
function plural(n, one, many) {
  if (state.lang === 'en') {
    const word = t(n === 1 ? one : many).toLowerCase();
    return `${n} ${n === 1 ? word : word.endsWith('s') ? word : `${word}s`}`;
  }
  return `${n} ${n === 1 ? one : many}`;
}
function setLang(lang) {
  state.lang = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem('ss-lang', lang);
  } catch {
    /* ignore */
  }
}
document.documentElement.lang = state.lang;

// ------------------------------------------------------------------ helpers
const ICONS = {
  projects: '<path d="M3 7h7l2 2h9v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  import: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  admin: '<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  plug: '<path d="M9 7V3m6 4V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  trash: '<path d="M4 7h16M10 7V4h4v3m-7 0 1 13h8l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  download: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  grip: '<circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>'
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

// Monogram tile with a quiet, stable hue derived from the id.
const hueOf = (id) => {
  let h = 0;
  for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return [22, 45, 85, 150, 190, 215, 260, 320][h % 8];
};
const initials = (name) =>
  String(name || '?')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';
const tile = (name, id) => `<span class="tile" style="--h:${hueOf(id)}" aria-hidden="true">${esc(initials(name))}</span>`;
const glyph = (iconUrl, cls = '') =>
  iconUrl
    ? `<span class="glyph ${cls}" aria-hidden="true"><img src="${esc(iconUrl)}" alt="" loading="lazy"></span>`
    : `<span class="glyph ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8M12 8v8"/></svg></span>`;
const chev = () => `<span class="row-chev" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS.chev}</svg></span>`;

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const te = (key, vars) => esc(t(key, vars));

const locale = () => (state.lang === 'en' ? 'en-GB' : 'de-DE');
const fmtDate = (s) => {
  if (!s) return '–';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return d.toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtSize = (n) => {
  const mb = n / 1024 / 1024;
  if (mb >= 1) return `${mb.toLocaleString(locale(), { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
};
const ROLE = () => ({ owner: t('Owner'), editor: t('Bearbeiten'), viewer: t('Lesen') });
const COURSE_LANGS = () => [
  ['de', t('Deutsch')],
  ['en', t('Englisch')],
  ['fr', t('Französisch')],
  ['it', t('Italienisch')]
];
const langOptions = (selected) => COURSE_LANGS().map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${esc(l)}</option>`).join('');
const coursesWord = () => (state.lang === 'en' ? 'Courses' : 'Kurse');

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { 'x-ui-lang': state.lang };
  if (state.csrf && method !== 'GET') headers['x-csrf-token'] = state.csrf;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (res.status === 401 && path !== '/me' && path !== '/auth/login') {
    navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    throw new ApiError(t('Bitte neu anmelden.'), 401);
  }
  if (!res.ok) throw new ApiError((data && data.error) || t('Fehler {status}', { status: res.status }), res.status, data && data.details);
  return data;
}

function toast(message, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 7000 : 3500);
}
const fail = (err) => {
  console.error(err);
  if (err.status !== 401) toast(err.details ? `${err.message} ${err.details.slice(0, 3).join(' · ')}` : err.message, 'error');
};

function dialog({ title, body, actions = [], wide = false, onOpen }) {
  const d = document.createElement('dialog');
  if (wide) d.className = 'wide';
  d.innerHTML = `<div class="dialog-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="${te('Schließen')}">${icon('close')}</button></div>
    <div class="dialog-body">${body}</div>
    ${actions.length ? `<div class="dialog-foot">${actions.map((a, i) => `<button class="btn ${a.kind || ''}" data-action="${i}" type="button">${esc(a.label)}</button>`).join('')}</div>` : ''}`;
  document.body.appendChild(d);
  const close = () => {
    d.close();
    d.remove();
  };
  d.querySelector('[data-close]').onclick = close;
  d.addEventListener('cancel', () => setTimeout(() => d.remove(), 0));
  actions.forEach((a, i) => {
    d.querySelector(`[data-action="${i}"]`).onclick = async (e) => {
      const btn = e.currentTarget;
      if (!a.handler) return close();
      btn.disabled = true;
      try {
        const keep = await a.handler(d);
        if (keep !== true) close();
      } catch (err) {
        fail(err);
      } finally {
        btn.disabled = false;
      }
    };
  });
  d.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'color' && actions.length) {
      e.preventDefault();
      d.querySelector(`[data-action="${actions.length - 1}"]`).click();
    }
  });
  d.showModal();
  if (onOpen) onOpen(d, close);
  const first = d.querySelector('input, select, textarea');
  if (first) first.focus();
  return { el: d, close };
}

function confirmDialog(title, text, label = t('Löschen')) {
  return new Promise((resolve) => {
    dialog({
      title,
      body: `<p>${esc(text)}</p>`,
      actions: [
        { label: t('Abbrechen'), kind: 'ghost', handler: () => resolve(false) },
        { label, kind: 'accent', handler: () => resolve(true) }
      ]
    });
  });
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('Kopiert.'));
  } catch {
    toast(t('Kopieren nicht möglich – bitte manuell markieren.'), 'error');
  }
}

// ------------------------------------------------------------------ router
const routes = [];
const route = (pattern, view, opts = {}) => routes.push({ re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), view, ...opts });

function navigate(to, replace = false) {
  if (replace) history.replaceState({}, '', to);
  else history.pushState({}, '', to);
  render();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/exports') || url.pathname.startsWith('/oauth')) return;
  if (a.dataset.handled) return;
  e.preventDefault();
  navigate(url.pathname + url.search);
});
window.addEventListener('popstate', () => render());

let renderToken = 0;
async function render() {
  const token = ++renderToken;
  const path = location.pathname;
  const match = routes.map((r) => ({ r, m: path.match(r.re) })).find((x) => x.m) || { r: routes.find((x) => x.re.test('/')), m: { groups: {} } };
  if (!match.r.public && !state.me) {
    try {
      const me = await api('/me');
      state.me = me.user;
      state.csrf = me.csrf;
      state.app = me.app;
      if (me.user.language) setLang(me.user.language);
    } catch {
      if (path !== '/login') return navigate(`/login?next=${encodeURIComponent(path + location.search)}`, true);
    }
  }
  if (match.r.admin && state.me?.role !== 'admin') return navigate('/', true);
  if (match.r.public) {
    root.innerHTML = '';
  } else {
    document.body.className = '';
    root.innerHTML = shell(match.r.nav);
    bindShell();
  }
  const target = match.r.public ? root : root.querySelector('#view');
  try {
    await match.r.view(target, match.m.groups || {}, () => token === renderToken);
  } catch (err) {
    if (token !== renderToken) return;
    if (err.status === 404 || err.status === 403) {
      target.innerHTML = `<div class="page"><div class="empty"><h3>${te('Nicht gefunden')}</h3><p class="muted">${esc(err.message)}</p><a class="btn" href="/">${te('Zur Übersicht')}</a></div></div>`;
    } else fail(err);
  }
  window.scrollTo(0, 0);
}

function langSwitch(id) {
  return `<div class="segmented lang-switch" role="group" aria-label="${te('Sprache')}" id="${id}">
    <button type="button" data-lang="de" class="${state.lang === 'de' ? 'is-on' : ''}" lang="de">DE</button>
    <button type="button" data-lang="en" class="${state.lang === 'en' ? 'is-on' : ''}" lang="en">EN</button>
  </div>`;
}

function bindLangSwitch(container, persist) {
  container.querySelectorAll('[data-lang]').forEach((b) => {
    b.onclick = async () => {
      if (b.dataset.lang === state.lang) return;
      setLang(b.dataset.lang);
      if (persist && state.me) {
        try {
          const res = await api('/me', { method: 'PATCH', body: { language: state.lang } });
          state.me = res.user;
        } catch (err) {
          fail(err);
        }
      }
      render();
    };
  });
}

function shell(active) {
  const link = (href, key, label) => `<a class="nav-link ${active === key ? 'is-active' : ''}" href="${href}">${icon(key)}<span>${esc(label)}</span></a>`;
  return `<div class="app">
    <nav class="rail" aria-label="${te('Hauptnavigation')}">
      <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span class="brand-name">Plietschpaket<span class="brand-sub">${te('Interaktive Kurse')}</span></span></a>
      ${link('/', 'projects', t('Projekte'))}
      ${link('/import', 'import', t('Import'))}
      ${link('/connect', 'plug', t('Claude verbinden'))}
      ${link('/account', 'account', t('Konto'))}
      ${state.me?.role === 'admin' ? link('/admin', 'admin', t('Verwaltung')) : ''}
      <div class="rail-foot">
        ${langSwitch('rail-lang')}
        <span class="rail-user">${esc(state.me?.name)}</span>
        <button type="button" id="logout">${te('Abmelden')}</button>
      </div>
    </nav>
    <main class="main" id="view"><div class="page"><div class="skeleton" style="width:240px;height:28px"></div></div></main>
  </div>`;
}

function bindShell() {
  root.querySelector('#logout').onclick = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    state.me = null;
    state.csrf = null;
    navigate('/login');
  };
  bindLangSwitch(root.querySelector('#rail-lang'), true);
}

const skeletonRows = (n = 3) =>
  `<div class="panel">${Array.from({ length: n }, () => '<div class="row"><div><div class="skeleton" style="width:40%"></div><div class="skeleton" style="width:22%;margin-top:8px;height:10px"></div></div></div>').join('')}</div>`;

// ------------------------------------------------------------------ login
route(
  '/login',
  async (el) => {
    const next = new URLSearchParams(location.search).get('next') || '/';
    document.body.className = 'auth-page';
    el.innerHTML = `
      <section class="auth-side" aria-hidden="true">
        <div class="brand"><span class="brand-mark"></span><span class="brand-name">Plietschpaket</span></div>
        <div style="display:grid;gap:40px">
          <div>
            <h2>${te('Lernkurse bauen, die im LMS sauber melden.')}</h2>
            <p style="margin-top:14px">${te('Interaktive H5P-Inhalte im Browser oder direkt aus Claude anlegen und als SCORM 1.2 oder 2004 exportieren.')}</p>
          </div>
          <div class="label-card">
            <div class="lc-top"><span>Plietschpaket</span><span>PP-4F2A91C0</span></div>
            <div class="lc-title">${te('Stellvertretung einrichten')}</div>
            <div class="lc-grid"><span>${te('Version')}<b>v7</b></span><span>${te('Format')}<b>SCORM 1.2</b></span><span>${te('Sprache')}<b>DE · iOS</b></span>
              <span>${te('Status')}<b>passed</b></span><span>${te('Punkte')}<b>87</b></span><span>${te('Lernzeit')}<b>00:04:12</b></span></div>
            <span class="lc-seal">LMS</span>
          </div>
        </div>
        <div class="auth-points">
          <div><span>01</span>${te('Projekte gemeinsam im Team bearbeiten')}</div>
          <div><span>02</span>${te('Lumi-Dateien (.h5p) übernehmen')}</div>
          <div><span>03</span>${te('Claude per MCP mit eigenem Login anbinden')}</div>
          <div><span>04</span>${te('App-Simulationen in 4 Sprachen ausliefern')}</div>
        </div>
      </section>
      <section class="auth-form">
        ${langSwitch('login-lang')}
        <h1>${te('Anmelden')}</h1>
        <form id="login-form" novalidate>
          <div class="field"><label for="email">${te('E-Mail')}</label><input class="input" id="email" type="email" autocomplete="username" required></div>
          <div class="field"><label for="password">${te('Passwort')}</label><input class="input" id="password" type="password" autocomplete="current-password" required></div>
          <p class="field error" id="login-error" hidden></p>
          <button class="btn primary" type="submit">${te('Anmelden')}</button>
        </form>
        <p class="muted small">${te('Kein Konto? Admins legen Zugänge unter „Verwaltung“ an.')}</p>
      </section>`;
    bindLangSwitch(el.querySelector('#login-lang'), false);
    el.querySelector('#login-form').onsubmit = async (e) => {
      e.preventDefault();
      const err = el.querySelector('#login-error');
      err.hidden = true;
      const btn = e.submitter;
      btn.disabled = true;
      try {
        const res = await api('/auth/login', { method: 'POST', body: { email: el.querySelector('#email').value, password: el.querySelector('#password').value } });
        state.me = res.user;
        state.csrf = res.csrf;
        if (res.user.language) setLang(res.user.language);
        document.body.className = '';
        if (next.startsWith('/oauth/') || next.startsWith('/exports/') || next.startsWith('/api/')) location.href = next;
        else navigate(next.startsWith('/') ? next : '/');
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      } finally {
        btn.disabled = false;
      }
    };
  },
  { public: true }
);

// ------------------------------------------------------------------ projects
async function projectsView(el, _p, alive) {
  el.innerHTML = `<div class="page"><div class="page-head"><div><h1>${te('Projekte')}</h1></div></div>${skeletonRows()}</div>`;
  const projects = await api('/projects');
  if (!alive()) return;
  const courseTotal = projects.reduce((a, p) => a + p.courseCount, 0);
  el.innerHTML = `<div class="page">
    <div class="page-head">
      <div><h1>${te('Projekte')}</h1><p class="lead">${te('Ein Projekt bündelt Kurse für ein Produkt oder einen Kunden. Mitglieder sehen und bearbeiten alles darin.')}</p></div>
      <div class="actions"><a class="btn" href="/import">${icon('import')}${te('Importieren')}</a><button class="btn primary" id="new-project">${icon('plus')}${te('Neues Projekt')}</button></div>
    </div>
    <div class="overview">
      <div class="panel">
        ${
          projects.length
            ? `<ul class="rows fade-in">${projects
                .map(
                  (p, i) => `<li style="--i:${i}"><a class="row with-tile" href="/projects/${esc(p.id)}">
                    ${tile(p.name, p.id)}
                    <div><span class="row-title">${esc(p.name)}</span>
                      <span class="row-meta"><span>${esc(plural(p.courseCount, 'Kurs', 'Kurse'))}</span><span>${esc(plural(p.memberCount, 'Mitglied', 'Mitglieder'))}</span><span>${te('geändert')} ${fmtDate(p.updatedAt)}</span></span>
                    </div>
                    <span style="display:flex;gap:10px;align-items:center"><span class="badge ${p.myRole === 'owner' ? 'accent' : ''}">${esc(ROLE()[p.myRole])}</span>${chev()}</span>
                  </a></li>`
                )
                .join('')}</ul>`
            : `<div class="empty"><h3>${te('Noch kein Projekt')}</h3><p class="muted">${te('Lege ein Projekt an oder importiere vorhandene Lumi-Dateien (.h5p) – daraus entsteht automatisch ein Projekt mit Kurs.')}</p><div class="actions"><button class="btn primary" data-new>${icon('plus')}${te('Projekt anlegen')}</button><a class="btn" href="/import">${te('Lumi-Dateien importieren')}</a></div></div>`
        }
      </div>
      <aside class="panel facts">
        <div class="fact"><span class="muted">${te('Projekte')}</span><strong>${projects.length}</strong></div>
        <div class="fact"><span class="muted">${coursesWord()}</span><strong>${courseTotal}</strong></div>
        <div class="fact" style="display:grid;gap:8px"><span class="muted small">${te('Claude kann Kurse direkt hier anlegen. Verbindung einrichten unter „Claude verbinden“.')}</span><a class="btn small" href="/connect">${icon('plug')}${te('MCP-Zugang')}</a></div>
      </aside>
    </div>
  </div>`;
  const open = () =>
    dialog({
      title: t('Neues Projekt'),
      body: `<div class="field"><label for="pn">${te('Name')}</label><input class="input" id="pn" placeholder="${te('z. B. Kontor Schulungen')}" maxlength="200"></div>
             <div class="field"><label for="pd">${te('Beschreibung')}</label><textarea class="input" id="pd" placeholder="${te('Wofür ist das Projekt? (optional)')}"></textarea></div>`,
      actions: [
        { label: t('Abbrechen'), kind: 'ghost' },
        {
          label: t('Anlegen'),
          kind: 'primary',
          handler: async (d) => {
            const p = await api('/projects', { method: 'POST', body: { name: d.querySelector('#pn').value, description: d.querySelector('#pd').value } });
            navigate(`/projects/${p.id}`);
          }
        }
      ]
    });
  el.querySelector('#new-project').onclick = open;
  el.querySelector('[data-new]')?.addEventListener('click', open);
}
route('/', projectsView, { nav: 'projects' });
route('/projects', projectsView, { nav: 'projects' });

route(
  '/projects/:id',
  async (el, { id }, alive) => {
    el.innerHTML = `<div class="page"><div class="page-head"><div><div class="skeleton" style="width:280px;height:28px"></div></div></div>${skeletonRows()}</div>`;
    const p = await api(`/projects/${id}`);
    if (!alive()) return;
    const canEdit = p.myRole !== 'viewer';
    const isOwner = p.myRole === 'owner';
    const roles = ROLE();
    el.innerHTML = `<div class="page">
      <div class="page-head">
        <nav class="crumbs"><a href="/">${te('Projekte')}</a><span>/</span></nav>
        <div><h1>${esc(p.name)}</h1>${p.description ? `<p class="lead">${esc(p.description)}</p>` : ''}</div>
        <div class="actions">
          <a class="btn ghost" href="/api/projects/${esc(p.id)}/export" download>${icon('download')}${te('Projekt exportieren')}</a>
          ${canEdit ? `<button class="btn" id="edit-project">${icon('edit')}${te('Bearbeiten')}</button><button class="btn primary" id="new-course">${icon('plus')}${te('Neuer Kurs')}</button>` : ''}
        </div>
      </div>
      <div class="split">
        <section class="panel">
          <div class="panel-head"><h2>${coursesWord()}</h2><span class="muted small">${esc(plural(p.courses.length, 'Kurs', 'Kurse'))}</span></div>
          ${
            p.courses.length
              ? `<ul class="rows fade-in">${p.courses
                  .map(
                    (c, i) => `<li style="--i:${i}"><a class="row with-tile" href="/courses/${esc(c.id)}">${tile(c.title, c.id)}<div><span class="row-title">${esc(c.title)}</span>
                    <span class="row-meta"><span>${c.settings.mode === 'blocks' ? te('Block-Kurs') : esc(plural(c.unitCount, 'Einheit', 'Einheiten'))}</span><span>${fmtDate(c.updatedAt)}</span></span>
                    <span class="stamps"><span class="stamp"><b>v${c.version}</b>SCORM ${esc(c.settings.scormVersion)}</span><span class="stamp">${esc(c.language.toUpperCase())}</span></span></div>
                    ${chev()}</a></li>`
                  )
                  .join('')}</ul>`
              : `<div class="empty"><h3>${te('Noch keine Kurse')}</h3><p class="muted">${te('Ein Kurs wird später ein SCORM-Paket. Lege ihn an und füge Einheiten hinzu – im Browser oder über Claude.')}</p>${canEdit ? `<button class="btn primary" data-new-course>${icon('plus')}${te('Kurs anlegen')}</button>` : ''}</div>`
          }
        </section>
        <aside class="stack">
          <section class="panel">
            <div class="panel-head"><h2>${te('Mitglieder')}</h2>${isOwner ? `<button class="btn small" id="add-member">${icon('plus')}${te('Hinzufügen')}</button>` : ''}</div>
            <ul class="rows">${p.members
              .map(
                (m) => `<li class="row"><div><span class="row-title">${esc(m.name)}</span><span class="row-meta">${esc(m.email)}</span></div>
                <div class="actions">${
                  isOwner
                    ? `<select class="input" style="min-height:32px;width:auto" data-member="${esc(m.id)}" aria-label="${te('Rolle von {name}', { name: m.name })}">${Object.entries(roles)
                        .map(([k, v]) => `<option value="${k}" ${k === m.role ? 'selected' : ''}>${esc(v)}</option>`)
                        .join('')}</select><button class="icon-btn" data-remove="${esc(m.id)}" aria-label="${te('{name} entfernen', { name: m.name })}">${icon('trash')}</button>`
                    : `<span class="badge">${esc(roles[m.role])}</span>`
                }</div></li>`
              )
              .join('')}</ul>
          </section>
          ${
            canEdit
              ? `<section class="panel"><div class="panel-head"><h2>${te('Lumi-Dateien')}</h2></div><div class="panel-body" style="display:grid;gap:10px">
                <p class="muted small">${te('.h5p-Dateien oder ein ZIP mit mehreren Dateien als neuen Kurs in dieses Projekt übernehmen.')}</p>
                <a class="btn" href="/import?project=${esc(p.id)}">${icon('import')}${te('Importieren')}</a></div></section>`
              : ''
          }
          ${isOwner ? `<button class="btn danger" id="delete-project">${icon('trash')}${te('Projekt löschen')}</button>` : ''}
        </aside>
      </div>
    </div>`;

    const newCourse = () =>
      dialog({
        title: t('Neuer Kurs'),
        body: `<div class="field"><label for="ct">${te('Titel')}</label><input class="input" id="ct" maxlength="200" placeholder="${te('z. B. Kontor – Erste Schritte')}"></div>
          <fieldset class="kind-pick"><legend>${te('Kursart')}</legend>
            <label class="kind-card"><input type="radio" name="ck" value="blocks" checked><span><b>${te('Block-Kurs')}</b><small>${te('Lektionen aus Text, Bildern, Wissensfragen, Rollenspielen und H5P – mit eigenem Player-Design. Empfohlen.')}</small></span></label>
            <label class="kind-card"><input type="radio" name="ck" value="units"><span><b>${te('H5P-Einheiten')}</b><small>${te('Eine Folge von H5P-Inhalten in einer schlichten Kurshülle.')}</small></span></label>
          </fieldset>
          <div class="form-grid two">
            <div class="field"><label for="cl">${te('Kurssprache')}</label><select class="input" id="cl">${langOptions(state.lang)}</select></div>
            <div class="field"><label for="cv">${te('SCORM-Version')}</label><select class="input" id="cv"><option value="1.2">${te('SCORM 1.2 (am verbreitetsten)')}</option><option value="2004">SCORM 2004 (4th Ed.)</option></select></div>
          </div>`,
        actions: [
          { label: t('Abbrechen'), kind: 'ghost' },
          {
            label: t('Anlegen'),
            kind: 'primary',
            handler: async (d) => {
              const c = await api(`/projects/${p.id}/courses`, {
                method: 'POST',
                body: { title: d.querySelector('#ct').value, language: d.querySelector('#cl').value, settings: { scormVersion: d.querySelector('#cv').value, mode: d.querySelector('[name="ck"]:checked').value } }
              });
              navigate(`/courses/${c.id}`);
            }
          }
        ]
      });
    el.querySelector('#new-course')?.addEventListener('click', newCourse);
    el.querySelector('[data-new-course]')?.addEventListener('click', newCourse);
    el.querySelector('#edit-project')?.addEventListener('click', () =>
      dialog({
        title: t('Projekt bearbeiten'),
        body: `<div class="field"><label for="pn">${te('Name')}</label><input class="input" id="pn" value="${esc(p.name)}"></div>
          <div class="field"><label for="pd">${te('Beschreibung')}</label><textarea class="input" id="pd">${esc(p.description)}</textarea></div>
          <div class="form-grid two">
            <div class="field"><label for="bp">${te('Hauptfarbe im Kurs')}</label><input class="input" type="color" id="bp" value="${esc(p.branding.primaryColor || '#1f3a5f')}"></div>
            <div class="field"><label for="ba">${te('Akzentfarbe')}</label><input class="input" type="color" id="ba" value="${esc(p.branding.accentColor || '#c8102e')}"></div>
          </div>
          <div class="field"><label for="bo">${te('Organisation (im Kurskopf)')}</label><input class="input" id="bo" value="${esc(p.branding.organization || '')}" placeholder="${te('z. B. Beispiel GmbH')}"></div>`,
        actions: [
          { label: t('Abbrechen'), kind: 'ghost' },
          {
            label: t('Speichern'),
            kind: 'primary',
            handler: async (d) => {
              await api(`/projects/${p.id}`, {
                method: 'PATCH',
                body: {
                  name: d.querySelector('#pn').value,
                  description: d.querySelector('#pd').value,
                  branding: { primaryColor: d.querySelector('#bp').value, accentColor: d.querySelector('#ba').value, organization: d.querySelector('#bo').value }
                }
              });
              toast(t('Gespeichert.'));
              render();
            }
          }
        ]
      })
    );
    el.querySelector('#add-member')?.addEventListener('click', () =>
      dialog({
        title: t('Mitglied hinzufügen'),
        body: `<div class="field"><label for="me">${te('E-Mail')}</label><input class="input" id="me" type="email" placeholder="name@firma.de"><span class="hint">${te('Das Konto muss bereits existieren (Admins legen Konten unter „Verwaltung“ an).')}</span></div>
          <div class="field"><label for="mr">${te('Rolle')}</label><select class="input" id="mr"><option value="editor">${te('Bearbeiten')}</option><option value="viewer">${te('Lesen')}</option><option value="owner">${te('Owner (darf Mitglieder verwalten)')}</option></select></div>`,
        actions: [
          { label: t('Abbrechen'), kind: 'ghost' },
          {
            label: t('Hinzufügen'),
            kind: 'primary',
            handler: async (d) => {
              await api(`/projects/${p.id}/members`, { method: 'POST', body: { email: d.querySelector('#me').value, role: d.querySelector('#mr').value } });
              render();
            }
          }
        ]
      })
    );
    el.querySelectorAll('[data-member]').forEach((s) => {
      s.onchange = () =>
        api(`/projects/${p.id}/members`, { method: 'POST', body: { userId: s.dataset.member, role: s.value } })
          .then(() => toast(t('Rolle geändert.')))
          .catch((e) => {
            fail(e);
            render();
          });
    });
    el.querySelectorAll('[data-remove]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmDialog(t('Mitglied entfernen?'), t('Die Person verliert den Zugriff auf alle Kurse dieses Projekts.'), t('Entfernen')))) return;
        await api(`/projects/${p.id}/members/${b.dataset.remove}`, { method: 'DELETE' }).catch(fail);
        render();
      };
    });
    el.querySelector('#delete-project')?.addEventListener('click', async () => {
      if (!(await confirmDialog(t('Projekt löschen?'), t('„{name}“ mit allen Kursen, Einheiten und Exporten wird endgültig gelöscht.', { name: p.name })))) return;
      await api(`/projects/${p.id}`, { method: 'DELETE' });
      toast(t('Projekt gelöscht.'));
      navigate('/');
    });
  },
  { nav: 'projects' }
);

// ------------------------------------------------------------------ course
const formatLabel = (f) => (f === 'html' ? 'HTML' : f === 'scorm2004' ? 'SCORM 2004' : 'SCORM 1.2');

route(
  '/courses/:id',
  async (el, { id }, alive) => {
    el.innerHTML = `<div class="page"><div class="page-head"><div><div class="skeleton" style="width:320px;height:28px"></div></div></div>${skeletonRows(4)}</div>`;
    const [c, types] = await Promise.all([api(`/courses/${id}`), state.types || api('/content-types').catch(() => [])]);
    if (!alive()) return;
    if (c.settings.mode === 'blocks') {
      const { blockEditor } = await import('./blockeditor.js');
      if (!alive()) return;
      return blockEditor(el, id, { api, t, te, esc, toast, fail, dialog, confirmDialog, navigate, state, fmtSize, fmtDate, langOptions, alive, render });
    }
    state.types = types.length ? types : state.types;
    const iconOf = (lib) => (types.find((ty) => ty.machineName === String(lib).split(' ')[0]) || {}).icon;
    const titleOf = (lib) => (types.find((ty) => ty.machineName === String(lib).split(' ')[0]) || {}).title || String(lib).replace('H5P.', '').split(' ')[0];
    const canEdit = c.myRole !== 'viewer';
    const s = c.settings;
    const dis = canEdit ? '' : 'disabled';
    el.innerHTML = `<div class="page">
      <div class="page-head">
        <nav class="crumbs"><a href="/">${te('Projekte')}</a><span>/</span><a href="/projects/${esc(c.projectId)}">${esc(c.projectName)}</a><span>/</span></nav>
        <div><h1>${esc(c.title)}</h1>
          <div class="stamps"><span class="stamp solid"><b>v${c.version}</b>SCORM ${esc(s.scormVersion)}</span><span class="stamp">${esc(c.language.toUpperCase())}</span><span class="stamp">${esc(plural(c.units.length, 'Einheit', 'Einheiten'))}</span><span class="stamp" title="${te('Paket-ID')}">PP-${esc(c.packageUuid.slice(0, 8))}</span></div></div>
        <div class="actions">
          ${canEdit ? `<button class="btn ghost" id="to-blocks" title="${te('Lektionen mit Text, Bildern und Übungen um die H5P-Einheiten herum bauen')}">${te('Als Block-Kurs bearbeiten')}</button><button class="btn ghost" id="course-more">${icon('copy')}${te('Duplizieren')}</button><a class="btn" href="/import?course=${esc(c.id)}">${icon('import')}${te('.h5p hinzufügen')}</a><a class="btn primary" href="/courses/${esc(c.id)}/new">${icon('plus')}${te('Einheit hinzufügen')}</a>` : ''}
        </div>
      </div>
      <div class="split">
        <section class="panel">
          <div class="panel-head"><h2>${te('Einheiten')}</h2><span class="muted small">${canEdit ? te('Ziehen oder Pfeile zum Sortieren') : ''}</span></div>
          <div id="units">${
            c.units.length
              ? c.units
                  .map(
                    (u, i) => `<div class="unit" draggable="${canEdit}" data-id="${esc(u.id)}">
                <span class="grip" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS.grip}</svg></span>
                <span class="idx">${String(i + 1).padStart(2, '0')}</span>
                ${glyph(iconOf(u.contentType))}
                <div><div class="unit-title">${esc(u.title)}</div><div class="unit-meta"><span>${esc(titleOf(u.contentType))}</span>${u.weight !== 1 ? `<span>${te('Gewicht')} ${u.weight}</span>` : ''}<span>${fmtDate(u.updatedAt)}</span></div></div>
                <div class="unit-actions">
                  ${canEdit ? `<button class="icon-btn" data-up="${i}" aria-label="${te('Nach oben')}" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button><button class="icon-btn" data-down="${i}" aria-label="${te('Nach unten')}" ${i === c.units.length - 1 ? 'disabled' : ''}>${icon('down')}</button>` : ''}
                  <a class="icon-btn" href="/units/${esc(u.id)}/view" aria-label="${te('Ansehen')}" title="${te('Ansehen')}">${icon('eye')}</a>
                  ${canEdit ? `<a class="icon-btn" href="/units/${esc(u.id)}/edit" aria-label="${te('Bearbeiten')}" title="${te('Bearbeiten')}">${icon('edit')}</a><button class="icon-btn" data-settings="${esc(u.id)}" aria-label="${te('Titel und Gewichtung')}" title="${te('Titel und Gewichtung')}">${icon('sliders')}</button><button class="icon-btn" data-del="${esc(u.id)}" aria-label="${te('Löschen')}" title="${te('Löschen')}">${icon('trash')}</button>` : ''}
                </div>
              </div>`
                  )
                  .join('')
              : `<div class="empty"><h3>${te('Noch leer')}</h3><p class="muted">${te('Füge die erste Einheit hinzu: eine Lektionsseite (Spalte), ein Quiz oder ein interaktives Video. Oder lass Claude den Kurs aus einem Skript bauen.')}</p>${canEdit ? `<a class="btn primary" href="/courses/${esc(c.id)}/new">${icon('plus')}${te('Einheit hinzufügen')}</a>` : ''}</div>`
          }</div>
        </section>
        <aside class="stack">
          <section class="panel">
            <div class="panel-head"><h2>${te('Export')}</h2></div>
            <div class="panel-body" style="display:grid;gap:12px">
              <div class="segmented" role="group" aria-label="${te('Format')}">
                <button type="button" data-fmt="scorm12" class="${s.scormVersion === '1.2' ? 'is-on' : ''}">SCORM 1.2</button>
                <button type="button" data-fmt="scorm2004" class="${s.scormVersion === '2004' ? 'is-on' : ''}">SCORM 2004</button>
                <button type="button" data-fmt="html">HTML</button>
              </div>
              <button class="btn accent" id="export" ${c.units.length ? '' : 'disabled'}>${icon('download')}${te('Paket erstellen')}</button>
              <p class="muted small">${te('Danach öffnet sich die LMS-Vorschau: Sie zeigt genau, welche Werte das Paket an das LMS sendet.')}</p>
            </div>
            ${
              c.exports.length
                ? `<ul class="rows">${c.exports
                    .map(
                      (x) => `<li class="row"><div><span class="stamp"><b>v${x.version}</b>${formatLabel(x.format)} · ${esc(String(x.report.language || c.language).toUpperCase())}</span><span class="row-meta" style="margin-top:6px"><span>${fmtDate(x.createdAt)}</span><span>${fmtSize(x.size)}</span>${x.report.warnings?.length ? `<span class="badge warn">${te('Hinweis')}</span>` : ''}</span></div>
                  <div class="actions"><a class="icon-btn" href="/exports/${esc(x.id)}/preview" aria-label="${te('Vorschau')}" title="${te('Vorschau')}">${icon('eye')}</a><a class="icon-btn" href="/api/exports/${esc(x.id)}/download" download aria-label="${te('Herunterladen')}" title="${te('Herunterladen')}">${icon('download')}</a></div></li>`
                    )
                    .join('')}</ul>`
                : ''
            }
          </section>
          <section class="panel">
            <div class="panel-head"><h2>${te('Abschluss & Bewertung')}</h2></div>
            <form class="panel-body form-grid" id="settings">
              <div class="field"><label for="st-title">${te('Titel')}</label><input class="input" id="st-title" value="${esc(c.title)}" ${dis}></div>
              <div class="field"><label for="st-lang">${te('Kurssprache')}</label><select class="input" id="st-lang" ${dis}>${langOptions(c.language)}</select><span class="hint">${te('Sprache der Kursoberfläche im Paket (Navigation, H5P-Buttons).')}</span></div>
              <div class="field"><label for="st-completion">${te('Kurs gilt als abgeschlossen, wenn …')}</label>
                <select class="input" id="st-completion" ${dis}>
                  <option value="all" ${s.completion === 'all' ? 'selected' : ''}>${te('alle Einheiten erledigt und Fragen beantwortet sind')}</option>
                  <option value="viewed" ${s.completion === 'viewed' ? 'selected' : ''}>${te('alle Einheiten geöffnet wurden')}</option>
                </select></div>
              <div class="form-grid two">
                <div class="field"><label for="st-mastery">${te('Bestehensgrenze')}</label><input class="input num" id="st-mastery" type="number" min="0" max="100" value="${s.masteryScore}" ${dis}><span class="hint">${te('Prozent der Gesamtpunkte')}</span></div>
                <div class="field"><label for="st-nav">${te('Navigation')}</label><select class="input" id="st-nav" ${dis}>
                  <option value="free" ${s.navigation === 'free' ? 'selected' : ''}>${te('frei – jede Einheit jederzeit')}</option>
                  <option value="linear" ${s.navigation === 'linear' ? 'selected' : ''}>${te('linear – erst nach Abschluss der vorherigen')}</option></select></div>
              </div>
              <label class="check"><input type="checkbox" id="st-list" ${s.showUnitList ? 'checked' : ''} ${dis}>${te('Einheitenliste im Kurs anzeigen')}</label>
              ${canEdit ? `<button class="btn" type="submit">${te('Einstellungen speichern')}</button>` : ''}
            </form>
          </section>
          ${canEdit ? `<button class="btn danger" id="delete-course">${icon('trash')}${te('Kurs löschen')}</button>` : ''}
        </aside>
      </div>
    </div>`;

    let format = s.scormVersion === '2004' ? 'scorm2004' : 'scorm12';
    el.querySelectorAll('[data-fmt]').forEach((b) => {
      b.onclick = () => {
        format = b.dataset.fmt;
        el.querySelectorAll('[data-fmt]').forEach((x) => x.classList.toggle('is-on', x === b));
      };
    });
    el.querySelector('#export').onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = t('Paket wird gebaut …');
      try {
        const x = await api(`/courses/${c.id}/export`, { method: 'POST', body: { format } });
        location.href = `/exports/${x.id}/preview`;
      } catch (err) {
        fail(err);
        btn.disabled = false;
        btn.innerHTML = `${icon('download')}${te('Paket erstellen')}`;
      }
    };
    el.querySelector('#settings').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/courses/${c.id}`, {
          method: 'PATCH',
          body: {
            title: el.querySelector('#st-title').value,
            language: el.querySelector('#st-lang').value,
            settings: {
              completion: el.querySelector('#st-completion').value,
              masteryScore: Number(el.querySelector('#st-mastery').value),
              navigation: el.querySelector('#st-nav').value,
              showUnitList: el.querySelector('#st-list').checked,
              scormVersion: format === 'scorm2004' ? '2004' : format === 'scorm12' ? '1.2' : s.scormVersion
            }
          }
        });
        toast(t('Einstellungen gespeichert.'));
        render();
      } catch (err) {
        fail(err);
      }
    };
    const ids = c.units.map((u) => u.id);
    const reorder = async (newIds) => {
      try {
        await api(`/courses/${c.id}/reorder`, { method: 'POST', body: { unitIds: newIds } });
        render();
      } catch (err) {
        fail(err);
      }
    };
    el.querySelectorAll('[data-up]').forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.up);
        const n = [...ids];
        [n[i - 1], n[i]] = [n[i], n[i - 1]];
        reorder(n);
      };
    });
    el.querySelectorAll('[data-down]').forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.down);
        const n = [...ids];
        [n[i + 1], n[i]] = [n[i], n[i + 1]];
        reorder(n);
      };
    });
    let dragId = null;
    el.querySelectorAll('.unit[draggable="true"]').forEach((row) => {
      row.addEventListener('dragstart', (e) => {
        dragId = row.dataset.id;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        row.classList.add('drop-before');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drop-before'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drop-before');
        if (!dragId || dragId === row.dataset.id) return;
        const n = ids.filter((x) => x !== dragId);
        n.splice(n.indexOf(row.dataset.id), 0, dragId);
        reorder(n);
      });
    });
    el.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        const u = c.units.find((x) => x.id === b.dataset.del);
        if (!(await confirmDialog(t('Einheit löschen?'), t('„{name}“ wird endgültig gelöscht.', { name: u.title })))) return;
        await api(`/units/${u.id}`, { method: 'DELETE' }).catch(fail);
        render();
      };
    });
    el.querySelectorAll('[data-settings]').forEach((b) => {
      b.onclick = () => {
        const u = c.units.find((x) => x.id === b.dataset.settings);
        dialog({
          title: u.title,
          body: `<div class="field"><label for="ut">${te('Titel in der Kursnavigation')}</label><input class="input" id="ut" value="${esc(u.title)}"></div>
            <div class="field"><label for="uw">${te('Gewichtung für die Gesamtnote')}</label><input class="input num" id="uw" type="number" min="0" max="100" step="0.5" value="${u.weight}"><span class="hint">${te('1 = normal, 2 = zählt doppelt, 0 = zählt nicht. Nur für Einheiten mit Fragen relevant.')}</span></div>`,
          actions: [
            { label: t('Abbrechen'), kind: 'ghost' },
            {
              label: t('Speichern'),
              kind: 'primary',
              handler: async (d) => {
                await api(`/units/${u.id}`, { method: 'PATCH', body: { title: d.querySelector('#ut').value, weight: Number(d.querySelector('#uw').value) } });
                render();
              }
            }
          ]
        });
      };
    });
    el.querySelector('#delete-course')?.addEventListener('click', async () => {
      if (!(await confirmDialog(t('Kurs löschen?'), t('„{name}“ mit allen Einheiten und Exporten wird endgültig gelöscht.', { name: c.title })))) return;
      await api(`/courses/${c.id}`, { method: 'DELETE' });
      navigate(`/projects/${c.projectId}`);
    });
    el.querySelector('#to-blocks')?.addEventListener('click', () =>
      dialog({
        title: t('Als Block-Kurs bearbeiten?'),
        body: `<p>${te('Der Kurs bekommt den Block-Editor: Lektionen aus Text, Bildern, Wissensfragen und mehr, mit eigenem Player-Design. Jede vorhandene Einheit wird zu einer Lektion mit einem H5P-Block – nichts geht verloren.')}</p>`,
        actions: [
          { label: t('Abbrechen'), kind: 'ghost' },
          {
            label: t('Umstellen'),
            kind: 'primary',
            handler: async () => {
              const blocks = c.units.flatMap((u) => [
                { type: 'title', data: { content: u.title } },
                { type: 'h5p', data: { unitId: u.id } }
              ]);
              await api(`/courses/${c.id}/blocks`, { method: 'PUT', body: { blocks, draft: true } });
              render();
            }
          }
        ]
      })
    );
    el.querySelector('#course-more')?.addEventListener('click', () => {
      const nextLang = c.language === 'de' ? 'en' : 'de';
      dialog({
        title: t('Kurs duplizieren'),
        body: `<p class="muted">${te('Erzeugt eine unabhängige Kopie mit allen Einheiten – zum Beispiel als Grundlage für eine Sprachfassung.')}</p>
          <div class="field"><label for="dt">${te('Titel der Kopie')}</label><input class="input" id="dt" value="${esc(c.title)} (${nextLang.toUpperCase()})"></div>
          <div class="field"><label for="dl">${te('Sprache der Kopie')}</label><select class="input" id="dl">${langOptions(nextLang)}</select></div>`,
        onOpen: (d) => {
          const sel = d.querySelector('#dl');
          const input = d.querySelector('#dt');
          sel.onchange = () => {
            input.value = input.value.replace(/\((DE|EN|FR|IT)\)$/, `(${sel.value.toUpperCase()})`);
          };
        },
        actions: [
          { label: t('Abbrechen'), kind: 'ghost' },
          {
            label: t('Duplizieren'),
            kind: 'primary',
            handler: async (d) => {
              const copyCourse = await api(`/courses/${c.id}/duplicate`, { method: 'POST', body: { title: d.querySelector('#dt').value, language: d.querySelector('#dl').value } });
              navigate(`/courses/${copyCourse.id}`);
            }
          }
        ]
      });
    });
  },
  { nav: 'projects' }
);

// ------------------------------------------------------------------ new unit: type picker
route(
  '/courses/:id/new',
  async (el, { id }, alive) => {
    const [c, types] = await Promise.all([api(`/courses/${id}`), state.types || api('/content-types')]);
    state.types = types;
    if (!alive()) return;
    const desc = (ty) => (state.lang === 'en' ? ty.descriptionEn : ty.description);
    const recommended = types.filter((ty) => ty.description);
    const others = types.filter((ty) => !ty.description);
    const [hero, ...rest] = recommended;
    const heroCard = hero
      ? `<button class="type-card hero" data-type="${esc(hero.ubername)}">
          ${glyph(hero.icon, 'lg')}
          <span class="stamp"><b>${te('Neu')}</b>${te('Software-Training')}</span>
          <strong>${esc(hero.title)}</strong>
          <span class="desc">${esc(String(desc(hero)).replace(/^[^:]{3,30}:\s*/, '').replace(/^./, (c) => c.toUpperCase()))}</span>
          <span class="go">${te('Mit dieser Übung starten')}<svg viewBox="0 0 24 24">${ICONS.arrow}</svg></span>
        </button>`
      : '';
    const card = (ty, i) =>
      `<button class="type-card ${i === 0 ? 'second' : ''}" style="--i:${i + 1}" data-type="${esc(ty.ubername)}">${glyph(ty.icon)}<strong>${esc(ty.title)}</strong><span class="desc">${esc(desc(ty))}</span></button>`;
    const item = (ty) =>
      `<button class="type-item" data-type="${esc(ty.ubername)}" data-search="${esc((ty.title + ' ' + ty.machineName).toLowerCase())}">${glyph(ty.icon)}<span>${esc(ty.title)}<small>${esc(ty.machineName.replace('H5P.', ''))}</small></span></button>`;
    el.innerHTML = `<div class="page">
      <div class="page-head">
        <nav class="crumbs"><a href="/">${te('Projekte')}</a><span>/</span><a href="/projects/${esc(c.projectId)}">${esc(c.projectName)}</a><span>/</span><a href="/courses/${esc(c.id)}">${esc(c.title)}</a><span>/</span></nav>
        <div><h1>${te('Neue Einheit')}</h1><p class="lead">${te('Wähle, was die Einheit leisten soll. Für App-Trainings ist die App-Simulation die erste Wahl, für Lerninhalte im Stil von Rise die Spalte.')}</p></div>
      </div>
      <div class="stack" style="gap:36px">
        <section>
          <div class="section-head"><div><span class="kicker">${te('Empfohlen')}</span><h2>${te('Für die meisten Kurse')}</h2></div></div>
          <div class="picker fade-in">${heroCard}${rest.map(card).join('')}</div>
        </section>
        <section>
          <div class="section-head">
            <div><span class="kicker">${esc(String(others.length))} ${te('Inhaltstypen')}</span><h2>${te('Weitere Inhaltstypen')}</h2></div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <label class="search"><span class="sr-only">${te('Suchen')}</span><svg viewBox="0 0 24 24">${ICONS.search}</svg><input class="input" id="type-filter" type="search" placeholder="${te('Inhaltstyp suchen …')}"></label>
              <button class="btn small ghost" id="hub-editor">${te('Mit H5P-Auswahl öffnen')}</button>
            </div>
          </div>
          <div class="type-list" id="type-list">${others.map(item).join('')}</div>
          <div class="empty" id="type-none" hidden><h3>${te('Kein Treffer')}</h3><p class="muted">${te('Anderer Suchbegriff? Oder die H5P-Auswahl öffnen.')}</p></div>
        </section>
      </div>
    </div>`;
    const filter = el.querySelector('#type-filter');
    filter.oninput = () => {
      const q = filter.value.trim().toLowerCase();
      let shown = 0;
      el.querySelectorAll('#type-list [data-search]').forEach((b) => {
        const hit = !q || b.dataset.search.includes(q);
        b.hidden = !hit;
        if (hit) shown += 1;
      });
      el.querySelector('#type-none').hidden = shown > 0;
    };
    el.querySelectorAll('[data-type]').forEach((b) => {
      b.onclick = async () => {
        el.querySelectorAll('[data-type]').forEach((x) => (x.disabled = true));
        try {
          const unit = await api(`/courses/${c.id}/units/draft`, { method: 'POST', body: { library: b.dataset.type, title: t('Neue Einheit') } });
          navigate(`/units/${unit.id}/edit?draft=1`);
        } catch (err) {
          fail(err);
          el.querySelectorAll('[data-type]').forEach((x) => (x.disabled = false));
        }
      };
    });
    el.querySelector('#hub-editor').onclick = () => navigate(`/courses/${c.id}/new/hub`);
  },
  { nav: 'projects' }
);

// ------------------------------------------------------------------ editor
async function waitForComponents() {
  for (let i = 0; i < 100 && !customElements.get('h5p-editor'); i += 1) await new Promise((r) => setTimeout(r, 50));
}

async function editorView(el, { courseId, unitId }, alive) {
  const unit = unitId ? await api(`/units/${unitId}`) : null;
  const course = await api(`/courses/${courseId || unit.courseId}`);
  if (!alive()) return;
  const isDraft = new URLSearchParams(location.search).get('draft') === '1';
  const title = unit && !isDraft ? unit.title : t('Neue Einheit');
  el.innerHTML = `<div class="page">
    <div class="page-head" style="margin-bottom:16px">
      <nav class="crumbs"><a href="/projects/${esc(course.projectId)}">${esc(course.projectName)}</a><span>/</span><a href="/courses/${esc(course.id)}">${esc(course.title)}</a><span>/</span></nav>
      <div><h1>${esc(title)}</h1></div>
    </div>
    <div class="editor-bar">
      <span class="muted small" id="editor-status">${te('Editor wird geladen …')}</span>
      <div class="actions"><a class="btn ghost" id="cancel" href="/courses/${esc(course.id)}">${te('Abbrechen')}</a><button class="btn primary" id="save" disabled>${te('Speichern')}</button></div>
    </div>
    <div class="editor-frame"><h5p-editor id="h5p-editor"></h5p-editor></div>
  </div>`;
  await waitForComponents();
  const editor = el.querySelector('#h5p-editor');
  const status = el.querySelector('#editor-status');
  const save = el.querySelector('#save');
  editor.loadContentCallback = (contentId) => api(`/h5p/editor-model/${contentId || 'new'}`);
  editor.saveContentCallback = async (_contentId, requestBody) => {
    if (unit) return api(`/units/${unit.id}/editor`, { method: 'POST', body: requestBody });
    const res = await api(`/courses/${course.id}/units/editor`, { method: 'POST', body: requestBody });
    return { contentId: res.contentId, metadata: res.metadata };
  };
  if (isDraft && unit) {
    const cancel = el.querySelector('#cancel');
    cancel.dataset.handled = '1';
    cancel.onclick = async (e) => {
      e.preventDefault();
      await api(`/units/${unit.id}`, { method: 'DELETE' }).catch(() => {});
      navigate(`/courses/${course.id}`);
    };
  }
  const ready = () => {
    status.textContent = t('Titel oben im Editor gilt auch als Titel der Einheit.');
    save.disabled = false;
  };
  editor.addEventListener('editorloaded', ready);
  editor.setAttribute('content-id', unit ? unit.contentId : 'new');
  setTimeout(() => save.disabled && ready(), 6000);
  save.onclick = async () => {
    save.disabled = true;
    status.textContent = t('Speichert …');
    try {
      await editor.save();
      toast(t('Gespeichert.'));
      navigate(`/courses/${course.id}`);
    } catch (err) {
      status.textContent = '';
      fail(err && err.message ? err : new Error(t('Bitte die markierten Felder im Editor prüfen.')));
    } finally {
      save.disabled = false;
    }
  };
}
route('/courses/:courseId/new/hub', (el, p, alive) => editorView(el, { courseId: p.courseId }, alive), { nav: 'projects' });
route('/units/:unitId/edit', (el, p, alive) => editorView(el, { unitId: p.unitId }, alive), { nav: 'projects' });

route(
  '/units/:id/view',
  async (el, { id }, alive) => {
    const unit = await api(`/units/${id}`);
    const course = await api(`/courses/${unit.courseId}`);
    if (!alive()) return;
    el.innerHTML = `<div class="page">
      <div class="page-head">
        <nav class="crumbs"><a href="/projects/${esc(course.projectId)}">${esc(course.projectName)}</a><span>/</span><a href="/courses/${esc(course.id)}">${esc(course.title)}</a><span>/</span></nav>
        <div><h1>${esc(unit.title)}</h1><p class="lead">${esc(unit.contentType)} · ${te('So sieht die Einheit für Lernende aus (ohne Speicherung).')}</p></div>
        <div class="actions">${unit.myRole !== 'viewer' ? `<a class="btn primary" href="/units/${esc(unit.id)}/edit">${icon('edit')}${te('Bearbeiten')}</a>` : ''}</div>
      </div>
      <div class="player-frame"><h5p-player id="player"></h5p-player></div>
    </div>`;
    await waitForComponents();
    const player = el.querySelector('#player');
    player.loadContentCallback = (contentId) => api(`/h5p/player-model/${contentId}`);
    player.setAttribute('content-id', unit.contentId);
  },
  { nav: 'projects' }
);

// ------------------------------------------------------------------ import
route(
  '/import',
  async (el, _p, alive) => {
    const params = new URLSearchParams(location.search);
    const projects = await api('/projects');
    if (!alive()) return;
    const courseId = params.get('course');
    const course = courseId ? await api(`/courses/${courseId}`).catch(() => null) : null;
    const editable = projects.filter((p) => p.myRole !== 'viewer');
    const lead =
      state.lang === 'en'
        ? EN.Importieren_lead
        : 'Übernimmt Lumi-Dateien (.h5p), ZIP-Archive mit mehreren .h5p-Dateien, einen Plietschpaket-Projektexport oder ein Klick-Übungs-Paket (ZIP mit course.json und Screenshots, wird zur bearbeitbaren App-Simulation). Jede .h5p-Datei wird zu einer Einheit.';
    el.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${te('Importieren')}</h1><p class="lead">${esc(lead)}</p></div></div>
      <div class="split">
        <form class="panel panel-body form-grid" id="import-form">
          <div class="field"><label for="file">${te('Datei')}</label><input class="input" type="file" id="file" accept=".h5p,.zip" required><span class="hint">${te('In Lumi: Datei → Speichern unter erzeugt eine .h5p-Datei. Mehrere Dateien vorher zu einem ZIP packen.')}</span></div>
          ${
            course
              ? `<div class="notice ok">${te('Ziel: Kurs „{name}“ – neue Einheiten werden hinten angehängt.', { name: course.title })}</div><input type="hidden" id="course" value="${esc(course.id)}">`
              : `<div class="field"><label for="project">${te('Ziel')}</label><select class="input" id="project"><option value="">${te('Neues Projekt anlegen')}</option>${editable
                  .map((p) => `<option value="${esc(p.id)}" ${params.get('project') === p.id ? 'selected' : ''}>${te('In Projekt: {name}', { name: p.name })}</option>`)
                  .join('')}</select><span class="hint">${te('Bei .h5p-Dateien entsteht im Ziel ein neuer Kurs.')}</span></div>`
          }
          <button class="btn primary" type="submit">${icon('import')}${te('Importieren')}</button>
          <div id="import-result"></div>
        </form>
        <aside class="panel panel-body" style="display:grid;gap:10px">
          <h2>${te('Was übernommen wird')}</h2>
          <p class="muted small">${te('Inhalt, Medien und Einstellungen jeder .h5p-Datei. Fehlende Inhaltstypen werden aus der Datei nachinstalliert.')}</p>
          <p class="muted small">${te('SCORM-Pakete lassen sich nicht zurückverwandeln – dafür die ursprüngliche .h5p-Datei verwenden.')}</p>
        </aside>
      </div>
    </div>`;
    el.querySelector('#import-form').onsubmit = async (e) => {
      e.preventDefault();
      const file = el.querySelector('#file').files[0];
      if (!file) return;
      const btn = e.submitter;
      btn.disabled = true;
      btn.textContent = t('Wird importiert …');
      const form = new FormData();
      form.append('file', file);
      if (el.querySelector('#course')) form.append('courseId', el.querySelector('#course').value);
      else if (el.querySelector('#project').value) form.append('projectId', el.querySelector('#project').value);
      try {
        const res = await api('/import', { method: 'POST', form });
        const out = el.querySelector('#import-result');
        out.innerHTML = `<div class="notice ${res.skipped.length ? '' : 'ok'}">${te('{n} importiert.', { n: plural(res.units, 'Einheit', 'Einheiten') })}${
          res.skipped.length ? `<br>${te('Übersprungen:')} ${res.skipped.map(esc).join('<br>')}` : ''
        }</div>`;
        toast(t('Import abgeschlossen.'));
        if (res.courses.length === 1) setTimeout(() => navigate(`/courses/${res.courses[0]}`), 900);
        else setTimeout(() => navigate(`/projects/${res.projectId}`), 900);
      } catch (err) {
        fail(err);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `${icon('import')}${te('Importieren')}`;
      }
    };
  },
  { nav: 'import' }
);

// ------------------------------------------------------------------ connect (MCP)
route(
  '/connect',
  async (el) => {
    const mcpUrl = state.app?.mcpUrl || `${location.origin}/mcp`;
    const baseUrl = mcpUrl.replace(/\/mcp$/, '');
    const [connections, keys] = await Promise.all([api('/me/connections'), api('/me/api-tokens')]);
    const cmd = `<span class="mono">claude mcp add --transport http plietschpaket ${esc(mcpUrl)}</span>`;
    const steps =
      state.lang === 'en'
        ? [EN.connect_step1, EN.connect_step2.replace('{cmd}', cmd).replace('{mcp}', '<span class="mono">/mcp</span>'), EN.connect_step3]
        : [
            '<strong>Claude (Web, Desktop, App):</strong> Einstellungen → Konnektoren → Benutzerdefinierten Konnektor hinzufügen → diese Adresse eintragen. Beim ersten Aufruf öffnet sich die Anmeldung hier, danach „Zugriff erlauben“.',
            `<strong>Claude Code:</strong> ${cmd}, dann in Claude Code <span class="mono">/mcp</span> aufrufen und anmelden.`,
            'In Team- und Enterprise-Organisationen müssen ggf. Owner den Konnektor freigeben.'
          ];
    const example =
      state.lang === 'en'
        ? EN.connect_example
        : 'Lege im Projekt „Kontor Schulungen“ einen Kurs „Erste Schritte“ an (Deutsch, SCORM 1.2, Bestehensgrenze 80 %). Baue aus dem angehängten Skript vier Lektionsseiten mit je einer Kontrollfrage und am Ende einen Abschlusstest mit acht Fragen. Exportiere den Kurs und gib mir den Vorschau-Link.';
    const manualConfig = JSON.stringify(
      {
        mcpServers: {
          plietschpaket: {
            command: 'node',
            args: ['/PFAD/ZU/plietschpaket/server/index.js'],
            env: { PLIETSCHPAKET_URL: baseUrl, PLIETSCHPAKET_TOKEN: 'ssp_…' }
          }
        }
      },
      null,
      2
    );
    const keyRows = keys.length
      ? `<ul class="rows">${keys
          .map(
            (k) => `<li class="row"><div><span class="row-title">${esc(k.name)} <span class="mono muted small">…${esc(k.hint)}</span></span><span class="row-meta"><span>${te('erstellt')} ${fmtDate(k.createdAt)}</span><span>${te('zuletzt')} ${fmtDate(k.lastUsed)}</span><span>${te('gültig bis')} ${fmtDate(k.expiresAt)}</span></span></div><button class="btn small danger" data-revoke-key="${esc(k.id)}">${te('Widerrufen')}</button></li>`
          )
          .join('')}</ul>`
      : `<div class="empty"><h3>${te('Noch kein Zugangsschlüssel')}</h3><p class="muted small">${te('Erzeuge einen Schlüssel pro Rechner. Er wird nur einmal angezeigt.')}</p></div>`;

    el.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${te('Claude verbinden')}</h1><p class="lead">${te('Über MCP legt Claude Projekte, Kurse und Einheiten direkt hier an – mit deinem Konto und deinen Rechten. Es gibt zwei Wege: als Konnektor über das Internet oder lokal über Claude Desktop, auch wenn Plietschpaket nur im Firmennetz oder per VPN erreichbar ist.')}</p></div></div>
      <div class="split">
        <div class="stack">
          <section class="panel"><div class="panel-head"><h2>${te('Weg A · Konnektor (Internet)')}</h2></div><div class="panel-body" style="display:grid;gap:14px">
            <p class="small muted" style="margin:0">${te('Claude verbindet sich aus der Cloud. Dafür muss diese Adresse öffentlich erreichbar sein. Anmeldung per OAuth, kein Schlüssel nötig.')}</p>
            <div class="copy-row"><code id="mcp-url">${esc(mcpUrl)}</code><button class="btn" id="copy-url">${icon('copy')}${te('Kopieren')}</button></div>
            <ol class="small" style="margin:0;padding-left:18px;display:grid;gap:8px">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>
          </div></section>
          <section class="panel"><div class="panel-head"><h2>${te('Weg B · Claude Desktop lokal (auch nur per VPN)')}</h2></div><div class="panel-body" style="display:grid;gap:14px">
            <p class="small muted" style="margin:0">${te('Die Verbindung läuft von deinem Rechner aus. Was dein Rechner erreicht – etwa per VPN –, erreicht auch Claude. Anmeldung mit einem persönlichen Zugangsschlüssel.')}</p>
            <ol class="small" style="margin:0;padding-left:18px;display:grid;gap:8px">
              <li>${te('Erweiterung herunterladen und doppelklicken (oder in Claude Desktop: Einstellungen → Erweiterungen → Erweiterung installieren).')}</li>
              <li>${te('Rechts einen Zugangsschlüssel erzeugen und in der Erweiterung bei „Zugangsschlüssel“ einfügen. Die Adresse ist schon eingetragen.')}</li>
              <li>${te('Erweiterung aktivieren, Claude Desktop neu starten. Test: „Wer bin ich in Plietschpaket?“')}</li>
            </ol>
            <div><a class="btn primary" href="/downloads/plietschpaket.mcpb" download>${icon('download')}${te('Erweiterung für Claude Desktop')}</a></div>
            <details class="small"><summary>${te('Ohne Erweiterung: manuell in claude_desktop_config.json')}</summary>
              <p class="muted">${te('Benötigt Node.js 18 oder neuer. Die Datei server/index.js aus der Erweiterung (ZIP) an einen festen Ort entpacken und den Pfad eintragen. Bei firmeneigenem Zertifikat zusätzlich PLIETSCHPAKET_CA mit dem Pfad zur PEM-Datei setzen.')}</p>
              <pre class="mono" style="white-space:pre-wrap;background:var(--bg);padding:12px;border-radius:8px;margin:0">${esc(manualConfig)}</pre>
            </details>
          </div></section>
          <section class="panel"><div class="panel-head"><h2>${te('Beispiel-Auftrag an Claude')}</h2></div><div class="panel-body">
            <p class="small mono" style="white-space:pre-wrap;background:var(--bg);padding:12px;border-radius:8px">${esc(example)}</p>
          </div></section>
        </div>
        <div class="stack">
          <section class="panel">
            <div class="panel-head"><h2>${te('Zugangsschlüssel (Claude Desktop)')}</h2><button class="btn small" id="new-key">${icon('plus')}${te('Neuer Schlüssel')}</button></div>
            ${keyRows}
          </section>
          <section class="panel">
            <div class="panel-head"><h2>${te('Verbundene Anwendungen (Konnektor)')}</h2></div>
            ${
              connections.length
                ? `<ul class="rows">${connections
                    .map(
                      (c) => `<li class="row"><div><span class="row-title">${esc(c.name)}</span><span class="row-meta"><span>${te('seit')} ${fmtDate(c.since)}</span><span>${te('zuletzt')} ${fmtDate(c.lastUsed)}</span></span></div><button class="btn small danger" data-revoke="${esc(c.clientId)}">${te('Trennen')}</button></li>`
                    )
                    .join('')}</ul>`
                : `<div class="empty"><h3>${te('Noch keine Verbindung')}</h3><p class="muted small">${te('Sobald du Claude verbunden hast, erscheint die Anwendung hier und lässt sich jederzeit trennen.')}</p></div>`
            }
          </section>
        </div>
      </div>
    </div>`;
    el.querySelector('#copy-url').onclick = () => copy(mcpUrl);
    el.querySelectorAll('[data-revoke]').forEach((b) => {
      b.onclick = async () => {
        await api(`/me/connections/${b.dataset.revoke}`, { method: 'DELETE' }).catch(fail);
        toast(t('Verbindung getrennt.'));
        render();
      };
    });
    el.querySelectorAll('[data-revoke-key]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmDialog(t('Schlüssel widerrufen?'), t('Claude Desktop auf diesem Rechner verliert sofort den Zugriff.'), t('Widerrufen')))) return;
        await api(`/me/api-tokens/${b.dataset.revokeKey}`, { method: 'DELETE' }).catch(fail);
        toast(t('Schlüssel widerrufen.'));
        render();
      };
    });
    el.querySelector('#new-key').onclick = () =>
      dialog({
        title: t('Neuer Zugangsschlüssel'),
        body: `<div class="form-grid">
          <div class="field"><label for="key-name">${te('Bezeichnung')}</label><input class="input" id="key-name" maxlength="80" placeholder="${te('z. B. Dienst-Laptop')}"></div>
          <div class="field"><label for="key-days">${te('Gültigkeit')}</label><select class="input" id="key-days">
            <option value="30">${te('30 Tage')}</option><option value="90" selected>${te('90 Tage')}</option></select>
            <span class="hint">${te('Beim Ändern deines Passworts werden alle Schlüssel ungültig.')}</span></div>
          <div class="field"><label for="key-pw">${te('Dein Passwort zur Bestätigung')}</label><input class="input" type="password" id="key-pw" autocomplete="current-password"></div></div>`,
        actions: [
          { label: t('Abbrechen'), kind: 'ghost' },
          {
            label: t('Erzeugen'),
            kind: 'primary',
            handler: async (d) => {
              const { created } = await api('/me/api-tokens', {
                method: 'POST',
                body: { name: d.querySelector('#key-name').value, days: Number(d.querySelector('#key-days').value), password: d.querySelector('#key-pw').value }
              });
              showKey(created);
            }
          }
        ]
      });
    function showKey(created) {
      dialog({
        title: t('Schlüssel erzeugt'),
        wide: true,
        body: `<p>${te('Jetzt kopieren und in der Claude-Desktop-Erweiterung einfügen. Er wird nur dieses eine Mal angezeigt.')}</p>
          <div class="copy-row"><code id="new-key-value" style="word-break:break-all">${esc(created.token)}</code><button class="btn" id="copy-key">${icon('copy')}${te('Kopieren')}</button></div>`,
        actions: [{ label: t('Fertig'), kind: 'primary', handler: () => render() }],
        onOpen: (d) => {
          d.querySelector('#copy-key').onclick = () => copy(created.token);
          d.addEventListener('close', () => render());
        }
      });
    }
  },
  { nav: 'plug' }
);

// ------------------------------------------------------------------ account
route(
  '/account',
  async (el) => {
    el.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${te('Konto')}</h1><p class="lead">${esc(state.me.email)} · ${state.me.role === 'admin' ? te('Admin') : te('Nutzer')}</p></div></div>
      <div class="split">
        <form class="panel panel-body form-grid" id="pw-form">
          <h2>${te('Passwort ändern')}</h2>
          <div class="field"><label for="pw-cur">${te('Aktuelles Passwort')}</label><input class="input" type="password" id="pw-cur" autocomplete="current-password"></div>
          <div class="field"><label for="pw-new">${te('Neues Passwort')}</label><input class="input" type="password" id="pw-new" autocomplete="new-password" minlength="10"><span class="hint">${te('Mindestens 10 Zeichen. Andere angemeldete Geräte werden abgemeldet.')}</span></div>
          <button class="btn primary" type="submit">${te('Passwort ändern')}</button>
        </form>
        <div class="stack">
          <form class="panel panel-body form-grid" id="name-form">
            <h2>${te('Anzeigename')}</h2>
            <div class="field"><label for="nm">${te('Name')}</label><input class="input" id="nm" value="${esc(state.me.name)}"></div>
            <button class="btn" type="submit">${te('Speichern')}</button>
          </form>
          <section class="panel panel-body form-grid">
            <h2>${te('Oberflächensprache')}</h2>
            ${langSwitch('account-lang')}
            <p class="muted small">${te('Gilt für diese Oberfläche, den H5P-Editor und Fehlermeldungen. Die Sprache eines Kurses stellst du am Kurs ein.')}</p>
          </section>
        </div>
      </div>
    </div>`;
    bindLangSwitch(el.querySelector('#account-lang'), true);
    el.querySelector('#pw-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/me/password', { method: 'POST', body: { current: el.querySelector('#pw-cur').value, next: el.querySelector('#pw-new').value } });
        toast(t('Passwort geändert.'));
        e.target.reset();
      } catch (err) {
        fail(err);
      }
    };
    el.querySelector('#name-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const res = await api('/me', { method: 'PATCH', body: { name: el.querySelector('#nm').value } });
        state.me = res.user;
        toast(t('Gespeichert.'));
        render();
      } catch (err) {
        fail(err);
      }
    };
  },
  { nav: 'account' }
);

// ------------------------------------------------------------------ admin
route(
  '/admin',
  async (el, _p, alive) => {
    const [users, stats, auditLog] = await Promise.all([api('/admin/users'), api('/admin/stats'), api('/admin/audit?limit=40')]);
    if (!alive()) return;
    el.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${te('Verwaltung')}</h1><p class="lead">${te('Konten, Rollen und Aktivität. Admins sehen und bearbeiten alle Projekte.')}</p></div>
        <div class="actions"><button class="btn primary" id="new-user">${icon('plus')}${te('Konto anlegen')}</button></div></div>
      <div class="overview" style="margin-bottom:20px">
        <section class="panel">
          <div class="panel-head"><h2>${te('Konten')}</h2><span class="muted small">${users.length}</span></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>${te('Name')}</th><th>${te('Rolle')}</th><th>${te('Status')}</th><th>${te('Letzte Anmeldung')}</th><th></th></tr></thead><tbody>
          ${users
            .map(
              (u) => `<tr><td><strong>${esc(u.name)}</strong><br><span class="muted small">${esc(u.email)} · ${esc((u.language || 'de').toUpperCase())}</span></td>
              <td><select class="input" style="min-height:32px;width:auto" data-role="${esc(u.id)}" ${u.id === state.me.id ? 'disabled' : ''}><option value="user" ${u.role === 'user' ? 'selected' : ''}>${te('Nutzer')}</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>${te('Admin')}</option></select></td>
              <td>${u.active ? `<span class="badge ok">${te('aktiv')}</span>` : `<span class="badge">${te('deaktiviert')}</span>`}</td>
              <td class="small">${fmtDate(u.lastLoginAt)}</td>
              <td><div class="actions"><button class="btn small" data-reset="${esc(u.id)}">${te('Passwort zurücksetzen')}</button>${u.id === state.me.id ? '' : `<button class="btn small ${u.active ? 'danger' : ''}" data-toggle="${esc(u.id)}" data-active="${u.active ? 1 : 0}">${u.active ? te('Deaktivieren') : te('Aktivieren')}</button>`}</div></td></tr>`
            )
            .join('')}
          </tbody></table></div>
        </section>
        <aside class="panel facts">
          ${[
            [t('Aktive Konten'), stats.users],
            [t('Projekte'), stats.projects],
            [coursesWord(), stats.courses],
            [t('Einheiten'), stats.units],
            [t('Exporte'), stats.exports],
            [t('Claude-Verbindungen'), stats.connections],
            [t('Inhaltstypen'), stats.contentTypes]
          ]
            .map(([k, v]) => `<div class="fact"><span class="muted">${esc(k)}</span><strong>${v}</strong></div>`)
            .join('')}
        </aside>
      </div>
      <section class="panel">
        <div class="panel-head"><h2>${te('Letzte Aktivität')}</h2></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>${te('Zeit')}</th><th>${te('Wer')}</th><th>${te('Aktion')}</th><th>${te('Über')}</th></tr></thead><tbody>
          ${auditLog.map((a) => `<tr><td class="small num">${fmtDate(a.created_at)}</td><td>${esc(a.user_name || '–')}</td><td class="mono">${esc(a.action)}</td><td><span class="badge ${a.via === 'mcp' ? 'accent' : ''}">${esc(a.via)}</span></td></tr>`).join('')}
        </tbody></table></div>
      </section>
    </div>`;
    el.querySelector('#new-user').onclick = () =>
      dialog({
        title: t('Konto anlegen'),
        body: `<div class="field"><label for="un">${te('Name')}</label><input class="input" id="un"></div>
          <div class="field"><label for="ue">${te('E-Mail')}</label><input class="input" id="ue" type="email"></div>
          <div class="field"><label for="ur">${te('Rolle')}</label><select class="input" id="ur"><option value="user">${te('Nutzer')}</option><option value="admin">${te('Admin')}</option></select></div>
          <div class="field"><label for="up">${te('Startpasswort')}</label><input class="input" id="up" type="text" placeholder="${te('leer lassen = wird erzeugt')}"><span class="hint">${te('Mindestens 10 Zeichen. Die Person kann es unter „Konto“ ändern.')}</span></div>`,
        actions: [
          { label: t('Abbrechen'), kind: 'ghost' },
          {
            label: t('Anlegen'),
            kind: 'primary',
            handler: async (d) => {
              const res = await api('/admin/users', {
                method: 'POST',
                body: { name: d.querySelector('#un').value, email: d.querySelector('#ue').value, role: d.querySelector('#ur').value, password: d.querySelector('#up').value || undefined }
              });
              if (res.initialPassword) showSecret(t('Startpasswort'), res.user.email, res.initialPassword);
              render();
            }
          }
        ]
      });
    el.querySelectorAll('[data-role]').forEach((s) => {
      s.onchange = () =>
        api(`/admin/users/${s.dataset.role}`, { method: 'PATCH', body: { role: s.value } })
          .then(() => toast(t('Rolle geändert.')))
          .catch((e) => {
            fail(e);
            render();
          });
    });
    el.querySelectorAll('[data-toggle]').forEach((b) => {
      b.onclick = async () => {
        const active = b.dataset.active === '1';
        if (active && !(await confirmDialog(t('Konto deaktivieren?'), t('Die Person wird abgemeldet und alle Claude-Verbindungen werden getrennt.'), t('Deaktivieren')))) return;
        await api(`/admin/users/${b.dataset.toggle}`, { method: 'PATCH', body: { active: !active } }).catch(fail);
        render();
      };
    });
    el.querySelectorAll('[data-reset]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmDialog(t('Passwort zurücksetzen?'), t('Es wird ein neues Passwort erzeugt; das alte gilt sofort nicht mehr.'), t('Zurücksetzen')))) return;
        try {
          const res = await api(`/admin/users/${b.dataset.reset}/reset-password`, { method: 'POST' });
          const u = users.find((x) => x.id === b.dataset.reset);
          showSecret(t('Neues Passwort'), u.email, res.temporaryPassword);
        } catch (err) {
          fail(err);
        }
      };
    });
  },
  { nav: 'admin', admin: true }
);

function showSecret(title, email, secret) {
  dialog({
    title,
    body: `<p>${te('Für {email}. Wird nur jetzt angezeigt – bitte sicher weitergeben (nicht per E-Mail im Klartext).', { email })}</p><div class="secret">${esc(secret)}</div>`,
    actions: [
      { label: t('Kopieren'), handler: async () => (await copy(secret), true) },
      { label: t('Fertig'), kind: 'primary' }
    ]
  });
}

render();
