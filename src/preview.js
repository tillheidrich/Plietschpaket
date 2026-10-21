import { parseJson } from './db.js';
import { tr } from './i18n.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * In-app "LMS simulator": loads the exported package in an iframe and provides the
 * SCORM API via scorm-again, showing every value the package sends to the LMS.
 */
const TEXT = {
  de: { title: 'LMS-Vorschau', back: '← Zurück zum Kurs', html: 'HTML-Export ohne LMS', version: 'Version', resume: 'Abbrechen &amp; fortsetzen', restart: 'Neu starten', download: 'Paket herunterladen', frame: 'Kursvorschau', lms: 'Das bekäme das LMS', of: 'von', chars: 'Zeichen', xapi: 'Werte, aus denen die Statements entstehen', log: 'Aufrufprotokoll', notes: 'Hinweise zum Paket', locale: 'de-DE' },
  en: { title: 'LMS preview', back: '← Back to course', html: 'HTML export without LMS', version: 'Version', resume: 'Abort &amp; resume', restart: 'Restart', download: 'Download package', frame: 'Course preview', lms: 'What the LMS receives', of: 'of', chars: 'characters', xapi: 'values the statements are built from', log: 'Call log', notes: 'Package notes', locale: 'en-GB' }
};

export function previewPage(row, lang = 'de') {
  const T = TEXT[lang] || TEXT.de;
  const report = parseJson(row.report, {});
  const isX = row.format === 'xapi' || row.format === 'cmi5';
  const is2004 = row.format === 'scorm2004' || isX;
  const isHtml = row.format === 'html';
  const lib = is2004 ? 'scorm2004.min.js' : 'scorm12.min.js';
  const keys = is2004
    ? ['cmi.completion_status', 'cmi.success_status', 'cmi.score.scaled', 'cmi.score.raw', 'cmi.progress_measure', 'cmi.location', 'cmi.exit', 'cmi.session_time']
    : ['cmi.core.lesson_status', 'cmi.core.score.raw', 'cmi.core.lesson_location', 'cmi.core.exit', 'cmi.core.session_time'];
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${T.title} · Plietschpaket</title>
<link rel="stylesheet" href="/assets/app.css">
</head>
<body class="preview-page">
<header class="preview-bar">
  <a class="btn ghost" href="/courses/${esc(row.course_id)}">${T.back}</a>
  <div class="preview-title">
    <strong>${T.title}</strong>
    <span class="muted">${esc(isHtml ? T.html : isX ? `${row.format === 'cmi5' ? 'cmi5' : 'xAPI'} · ${T.xapi}` : is2004 ? 'SCORM 2004 (4th Ed.)' : 'SCORM 1.2')} · ${T.version} ${esc(row.version)}</span>
  </div>
  ${isHtml ? '' : `<button class="btn" id="pv-resume" type="button">${T.resume}</button><button class="btn ghost" id="pv-reset" type="button">${T.restart}</button>`}
  <a class="btn primary" href="/api/exports/${esc(row.id)}/download">${T.download}</a>
</header>
<div class="preview-layout ${isHtml ? 'no-panel' : ''}">
  <iframe id="pv-frame" title="${T.frame}" allow="fullscreen; autoplay; microphone" allowfullscreen></iframe>
  ${
    isHtml
      ? ''
      : `<aside class="preview-panel" aria-live="polite">
    <h2>${T.lms}</h2>
    <dl id="pv-values">${keys.map((k) => `<div><dt>${esc(k)}</dt><dd data-key="${esc(k)}">–</dd></div>`).join('')}</dl>
    <h3>suspend_data <span class="muted" id="pv-suspend-size"></span></h3>
    <pre id="pv-suspend" class="mono small">–</pre>
    <h3>${T.log}</h3>
    <ol id="pv-log" class="mono small log"></ol>
    ${
      report.warnings && report.warnings.length
        ? `<h3>${T.notes}</h3><ul class="small">${report.warnings.map((w) => `<li>${esc(tr(w, lang))}</li>`).join('')}</ul>`
        : ''
    }
  </aside>`
  }
</div>
${
  isHtml
    ? `<script>document.getElementById('pv-frame').src = '/exports/${esc(row.id)}/pkg/index.html';</script>`
    : `<script src="/vendor/${lib}"></script>
<script>
(function () {
  var is2004 = ${is2004 ? 'true' : 'false'};
  var storeKey = 'ss-preview-${esc(row.id)}';
  var Ctor = is2004 ? (window.Scorm2004API.default || window.Scorm2004API) : (window.Scorm12API.default || window.Scorm12API);
  var api = new Ctor({ autocommit: false, logLevel: 5 });
  var saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null'); } catch (e) {}
  var values = {};
  if (saved && saved.resume) {
    values = saved.values || {};
    var flat = {};
    Object.keys(values).forEach(function (k) {
      if (/session_time|exit/.test(k)) return;
      flat[k] = values[k];
    });
    if (is2004) flat['cmi.entry'] = 'resume'; else flat['cmi.core.entry'] = 'resume';
    try { api.loadFromFlattenedJSON(flat, ''); } catch (e) { console.warn('resume failed', e); }
    sessionStorage.setItem(storeKey, JSON.stringify({ resume: false, values: values }));
  }
  if (is2004) window.API_1484_11 = api; else window.API = api;
  var log = document.getElementById('pv-log');
  function addLog(text) {
    var li = document.createElement('li');
    li.textContent = new Date().toLocaleTimeString('${T.locale}') + '  ' + text;
    log.insertBefore(li, log.firstChild);
    while (log.children.length > 80) log.removeChild(log.lastChild);
  }
  function show() {
    document.querySelectorAll('[data-key]').forEach(function (dd) {
      var v = values[dd.getAttribute('data-key')];
      dd.textContent = v === undefined || v === '' ? '–' : v;
    });
    var s = values['cmi.suspend_data'] || '';
    document.getElementById('pv-suspend-size').textContent = s ? '(' + s.length + ' ${T.chars} ${T.of} ' + (is2004 ? '64000' : '4096') + ')' : '';
    var pretty = s;
    try { pretty = JSON.stringify(JSON.parse(s), function (k, v) { return k === 'st' && typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '…' : v; }, 2); } catch (e) {}
    document.getElementById('pv-suspend').textContent = pretty || '–';
    sessionStorage.setItem(storeKey, JSON.stringify({ resume: false, values: values }));
  }
  var setEvent = is2004 ? 'SetValue.cmi.*' : 'LMSSetValue.cmi.*';
  api.on(setEvent, function (el, value) {
    values[el] = String(value);
    if (el !== 'cmi.suspend_data') addLog('Set ' + el + ' = ' + String(value).slice(0, 60));
    show();
  });
  ['Initialize', 'LMSInitialize', 'Commit', 'LMSCommit', 'Terminate', 'LMSFinish'].forEach(function (ev) {
    try { api.on(ev, function () { addLog(ev + '()'); }); } catch (e) {}
  });
  document.getElementById('pv-resume').addEventListener('click', function () {
    var f = document.getElementById('pv-frame');
    f.src = 'about:blank';
    setTimeout(function () {
      sessionStorage.setItem(storeKey, JSON.stringify({ resume: true, values: values }));
      location.reload();
    }, 300);
  });
  document.getElementById('pv-reset').addEventListener('click', function () {
    sessionStorage.removeItem(storeKey);
    location.reload();
  });
  show();
  document.getElementById('pv-frame').src = '/exports/${esc(row.id)}/pkg/index.html';
})();
</script>`
}
</body>
</html>`;
}
