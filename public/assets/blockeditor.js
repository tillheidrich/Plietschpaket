// Plietschpaket block editor (block courses). Loaded on demand by app.js.
// Layout: top bar with tabs · left: outline / block library · centre: block cards with forms · right: live preview.
// Saves drafts automatically; incomplete blocks are kept and marked, the export refuses them.

const MEDIA_EXT = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
  video: ['mp4', 'webm', 'm4v'],
  audio: ['mp3', 'm4a', 'ogg', 'oga', 'wav'],
  captions: ['vtt'],
  pdf: ['pdf'],
  file: ['pdf', 'docx', 'xlsx', 'pptx', 'zip', 'txt', 'csv', 'png', 'jpg', 'jpeg']
};
const DEVICES = { desktop: 1280, tablet: 820, mobile: 390 };

// line icons, 24×24, stroke only
const BI = {
  title: '<path d="M5 5h14M12 5v14"/>',
  subtitle: '<path d="M5 8h14M5 13h9M5 18h6"/>',
  text: '<path d="M4 6h16M4 10h16M4 14h16M4 18h10"/>',
  list: '<circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/><path d="M9 7h11M9 12h11M9 17h11"/>',
  numberedList: '<path d="M4 5h1v4M4 9h2M4 14h2l-2 3h2M9 7h11M9 12h11M9 17h11"/>',
  callout: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14"/>',
  quote: '<path d="M6 17c-1.5-1-2-2.5-2-4.5C4 9 6 7 9 6M15 17c-1.5-1-2-2.5-2-4.5 0-3.5 2-5.5 5-6.5"/>',
  statement: '<path d="M3 12h18M3 7h18M3 17h18" opacity=".35"/><path d="M6 12h12"/>',
  accordion: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><rect x="3" y="11" width="18" height="9" rx="1.5"/><path d="m15 6 1.5 1.5L18 6"/>',
  tabs: '<path d="M3 20V8h6V5h6v3h6v12z"/><path d="M9 8h6"/>',
  timeline: '<path d="M4 12h16"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="12" r="2"/><path d="M7 6v4M17 14v4"/>',
  divider: '<path d="M3 12h7M14 12h7"/><circle cx="12" cy="12" r="1"/>',
  process: '<circle cx="5" cy="12" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/><path d="M7.5 12h2M14.5 12h2"/>',
  columns: '<rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="16" rx="1.5"/>',
  furtherReading: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L12 6.3"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  imageText: '<rect x="3" y="5" width="9" height="14" rx="1.5"/><path d="M15 7h6M15 11h6M15 15h4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-6-6-9 9"/>',
  gallery: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  audio: '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M12 11v6m-3-3 3 3 3-3"/>',
  banner: '<rect x="2" y="6" width="20" height="12" rx="1"/><path d="M6 13h8"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17v.5"/>',
  flipcard: '<rect x="3" y="6" width="12" height="14" rx="2"/><path d="M9 3h10a2 2 0 0 1 2 2v12"/>',
  matching: '<circle cx="5" cy="7" r="2"/><circle cx="5" cy="17" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="19" cy="17" r="2"/><path d="M7 7l10 10M7 17 17 7"/>',
  sorting: '<path d="M7 4v16m0 0-3-3m3 3 3-3M13 6h8M13 12h6M13 18h4"/>',
  fillBlanks: '<path d="M3 15h4M10 15h5M18 15h3"/><path d="M10 17h5" stroke-dasharray="1.5 1.5"/>',
  hotspot: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><circle cx="16" cy="15" r="2"/>',
  bucketSort: '<path d="M4 10h7l-1 10H5zM13 10h7l-1 10h-5z"/><path d="M7.5 3v4M16.5 4v3"/>',
  essay: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 20h7"/>',
  checklist: '<path d="m4 7 2 2 3-3M4 15l2 2 3-3M12 8h8M12 16h8"/>',
  assessment: '<path d="M8 4h8v3H8z"/><path d="M6 6H5v15h14V6h-1"/><path d="m9 14 2 2 4-4"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M3 15h18M10 4v16"/>',
  embed: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>',
  pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>',
  graph: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  comparison: '<path d="M12 3v18"/><path d="M4 8h5M4 12h5M15 8h5M15 12h5"/>',
  h5p: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8v8M8 12h4M12 8v8M16 8v8"/>',
  wordBank: '<rect x="3" y="14" width="7" height="5" rx="2"/><rect x="12" y="14" width="9" height="5" rx="2"/><path d="M3 9h5M11 9h10" stroke-dasharray="2 2"/>',
  termGuess: '<path d="M4 6h16M4 11h10"/><rect x="4" y="15" width="16" height="5" rx="1.5"/><path d="M7 17.5h.01M10 17.5h.01"/>',
  oralReading: '<path d="M4 6h10M4 10h10M4 14h6"/><path d="M17 9a3 3 0 0 1 0 6M19.5 6.5a7 7 0 0 1 0 11"/>',
  voiceInsert: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  conversation: '<path d="M3 5h12v8H8l-4 3z"/><path d="M15 9h6v8l-3-2h-6v-2"/>',
  canvas: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h6M7 13h4"/><circle cx="16" cy="14" r="2.5"/>'
};
const UI = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h4"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  trash: '<path d="M4 7h16M10 7V4h4v3m-7 0 1 13h8l1-13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  grip: '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
  desktop: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
  tablet: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>',
  mobile: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  upload: '<path d="M12 16V4m0 0-4 4m4-4 4 4M5 20h14"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M14 5h-4M14 19h-4M14 5l-4 14"/>',
  underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L12 6.3"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  ul: BI.list,
  ol: BI.numberedList,
  h: '<path d="M6 5v14M18 5v14M6 12h12"/>',
  clear: '<path d="M6 6l12 12M9 4h9l-4 9M5 20h8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  play: '<path d="M8 5v14l11-7z"/>'
};
const svg = (paths, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

// field labels (German keys, translated with t())
const FIELD = {
  content: 'Text', kicker: 'Dachzeile', image: 'Bild', items: 'Einträge', variant: 'Art', title: 'Titel', author: 'Quelle', style: 'Stil',
  heading: 'Überschrift', tabs: 'Tabs', date: 'Datum', label: 'Beschriftung', steps: 'Schritte', leftTitle: 'Titel links', left: 'Links',
  rightTitle: 'Titel rechts', right: 'Rechts', links: 'Links', url: 'Adresse', description: 'Beschreibung', alt: 'Alternativtext',
  caption: 'Bildunterschrift', size: 'Größe', layout: 'Anordnung', images: 'Bilder', file: 'Datei', poster: 'Vorschaubild',
  captions: 'Untertitel (VTT)', transcript: 'Transkript', name: 'Name', text: 'Text', question: 'Frage', options: 'Antworten',
  explanation: 'Erklärung nach dem Antworten', cards: 'Karten', front: 'Vorderseite', back: 'Rückseite', prompt: 'Aufgabe', pairs: 'Paare',
  caseSensitive: 'Groß- und Kleinschreibung beachten', spots: 'Punkte', x: 'Position X', y: 'Position Y', buckets: 'Kategorien',
  minWords: 'Mindestanzahl Wörter', sample: 'Musterlösung', intro: 'Einleitung', questions: 'Fragen', passPercent: 'Bestanden ab (%)',
  timeLimit: 'Zeitlimit in Minuten (0 = ohne)', shuffle: 'Fragen mischen', showReview: 'Antworten nach dem Test zeigen',
  header: 'Erste Zeile ist Kopfzeile', rows: 'Zeilen', height: 'Höhe in Pixeln (0 = automatisch)', chartType: 'Diagrammart',
  labels: 'Beschriftungen', series: 'Datenreihen', values: 'Werte', unit: 'Einheit', unitId: 'H5P-Einheit', multiple: 'Mehrere Antworten',
  distractors: 'Zusätzliche falsche Wörter', clue: 'Beschreibung', term: 'Begriff (Alternativen mit |)', hint: 'Tipp', model: 'Vorlage (Audio)', modelText: 'Vorlage als Text',
  reveal: 'Text beim Klick', link: 'Link (optional)',
  turns: 'Gesprächszüge', speaker: 'Wer spricht', partner: 'Name des Gegenübers', audio: 'Audio (optional)'
};
const OPT = {
  info: 'Hinweis', tip: 'Tipp', warning: 'Achtung', success: 'Gut zu wissen', key: 'Merke', accent: 'Akzent', plain: 'Schlicht', dark: 'Dunkel',
  left: 'Links', right: 'Rechts', wide: 'Breit', full: 'Randlos', medium: 'Mittel', grid: 'Raster', carousel: 'Karussell', bar: 'Balken',
  line: 'Linie', pie: 'Torte', learner: 'Lernende', partner: 'Gegenüber'
};
const HINT = {
  'wordBank.text': 'Wörter für die Wortbank in eckige Klammern setzen, z. B. „Ich [habe] Hunger.“ Alternativen mit |.',
  'conversation.turns': 'Gegenüber-Sätze werden vorgelesen (eigene Audiodatei oder Sprachausgabe des Browsers). Lernende sprechen oder tippen ihre Sätze und sehen danach die Vorlage.',
  'oralReading.passPercent': 'Anteil der Wörter, die die Spracherkennung finden muss, damit die Rückmeldung grün ist.',
  'fillBlanks.text': 'Lücken in eckige Klammern setzen, Alternativen mit |, z. B. „Die Hauptstadt ist [Paris|paris].“',
  'image.alt': 'Beschreibt das Bild für Screenreader. Leer lassen, wenn es nur Dekoration ist.',
  'video.url': 'YouTube- oder Vimeo-Adresse – oder oben eine Videodatei wählen.',
  'embed.url': 'Nur https. Die Seite muss das Einbetten erlauben.'
};
const CATS = { content: 'Text & Struktur', media: 'Medien', interactive: 'Interaktion', language: 'Sprachlabor', advanced: 'Weitere' };
const DESIGN_INFO = {
  studio: ['Studio', 'Seitenleiste mit Lektionen, eine Lektion je Seite'],
  classic: ['Klassisch', 'Helle Seitenleiste, ruhiges Layout'],
  focus: ['Fokus', 'Der ganze Kurs als eine lange Seite'],
  stage: ['Bühne', 'Bildschirm für Bildschirm, wie eine Präsentation'],
  lesson: ['Lektion', 'Abschnitt für Abschnitt mit „Weiter“'],
  magazine: ['Magazin', 'Große Titelbilder, redaktioneller Look'],
  journey: ['Reise', 'Lernpfad als Karte auf der Startseite'],
  hub: ['Hub', 'Kacheln mit Lektionen auf der Startseite']
};
// mini schematics of the player layouts
const DESIGN_ART = {
  studio: '<rect x="1" y="1" width="18" height="38" rx="2" class="a"/><rect x="23" y="6" width="54" height="5" rx="1"/><rect x="23" y="15" width="40" height="3" rx="1" class="m"/><rect x="23" y="21" width="48" height="3" rx="1" class="m"/><rect x="23" y="27" width="30" height="3" rx="1" class="m"/>',
  classic: '<rect x="1" y="1" width="18" height="38" rx="2" class="m"/><rect x="4" y="6" width="12" height="2" rx="1" class="a"/><rect x="23" y="6" width="54" height="5" rx="1"/><rect x="23" y="15" width="44" height="3" rx="1" class="m"/><rect x="23" y="21" width="36" height="3" rx="1" class="m"/>',
  focus: '<rect x="20" y="3" width="40" height="5" rx="1"/><rect x="20" y="11" width="40" height="3" rx="1" class="m"/><rect x="20" y="17" width="34" height="3" rx="1" class="m"/><rect x="20" y="23" width="40" height="10" rx="1.5" class="a"/><rect x="20" y="36" width="30" height="3" rx="1" class="m"/>',
  stage: '<rect x="10" y="5" width="60" height="28" rx="3" class="m"/><rect x="18" y="12" width="34" height="5" rx="1"/><rect x="18" y="20" width="44" height="3" rx="1" class="a"/><circle cx="36" cy="37" r="1.2" class="a"/><circle cx="40" cy="37" r="1.2"/><circle cx="44" cy="37" r="1.2"/>',
  lesson: '<rect x="20" y="3" width="40" height="5" rx="1"/><rect x="20" y="11" width="40" height="3" rx="1" class="m"/><rect x="20" y="17" width="34" height="3" rx="1" class="m"/><rect x="31" y="26" width="18" height="6" rx="3" class="a"/>',
  magazine: '<rect x="1" y="1" width="78" height="17" rx="2" class="m"/><rect x="8" y="9" width="36" height="5" rx="1"/><rect x="22" y="23" width="36" height="3" rx="1" class="m"/><rect x="22" y="29" width="30" height="3" rx="1" class="m"/><rect x="18" y="23" width="2.5" height="9" rx="1" class="a"/>',
  journey: '<circle cx="14" cy="10" r="4" class="a"/><circle cx="40" cy="22" r="4"/><circle cx="66" cy="32" r="4"/><path d="M17 12 37 20M43 24l20 7" class="l"/>',
  hub: '<rect x="4" y="5" width="22" height="16" rx="2" class="a"/><rect x="29" y="5" width="22" height="16" rx="2" class="m"/><rect x="54" y="5" width="22" height="16" rx="2" class="m"/><rect x="4" y="24" width="22" height="12" rx="2" class="m"/><rect x="29" y="24" width="22" height="12" rx="2" class="m"/>'
};
const LABEL_KEYS = ['start', 'resume', 'next', 'prev', 'finish', 'complete', 'completeText', 'check', 'overview'];

export async function blockEditor(el, courseId, ctx) {
  const { api, t, te, esc, toast, fail, dialog, confirmDialog, navigate, state, fmtSize, fmtDate, langOptions } = ctx;
  el.innerHTML = `<div class="be-loading"><div class="skeleton" style="width:260px;height:26px"></div></div>`;
  const [course, catalog, mediaList, commentList] = await Promise.all([
    api(`/courses/${courseId}`),
    api('/block-types'),
    api(`/courses/${courseId}/media`),
    api(`/courses/${courseId}/comments`).catch(() => [])
  ]);
  if (!ctx.alive()) return;

  const TYPES = Object.fromEntries(catalog.types.map((x) => [x.type, x]));
  const canEdit = course.myRole !== 'viewer';
  let blocks = clone(course.blocks);
  let design = clone(course.design);
  let units = course.units;
  let media = mediaList;
  let comments = commentList;
  let customBlocks = await api('/custom-blocks').catch(() => []);
  let commentFilter = 'open';
  let updatedAt = course.updatedAt;
  let sel = blocks[0]?.id || null;
  let tab = 'content';
  let side = blocks.length ? 'outline' : 'library';
  let device = load('pp-be-device', 'desktop');
  let previewOpen = load('pp-be-preview', '1') === '1';
  let filter = '';
  const undo = [];
  const redo = [];
  let baseline = JSON.stringify(blocks);
  let lastChange = 0;
  let saveTimer = null;
  let saving = false;
  let again = false;
  let dirty = false;
  const ac = new AbortController();
  const gone = () => {
    if (!el.isConnected) {
      ac.abort();
      return true;
    }
    return false;
  };

  // ---------------------------------------------------------------- layout
  el.classList.add('be-host');
  el.closest('.main')?.classList.add('is-flush');
  el.innerHTML = `<div class="be">
    <header class="be-bar">
      <div class="be-bar-left">
        <nav class="crumbs"><a href="/">${te('Projekte')}</a><span>/</span><a href="/projects/${esc(course.projectId)}">${esc(course.projectName)}</a><span>/</span></nav>
        <h1 class="be-title">${esc(course.title)}</h1>
      </div>
      <div class="be-tabs" role="tablist">
        ${[['content', 'Inhalt'], ['design', 'Design'], ['review', 'Review'], ['settings', 'Einstellungen'], ['media', 'Medien']].map(([k, l]) => `<button role="tab" data-tab="${k}">${te(l)}${k === 'review' ? `<span class="be-tab-count" id="be-review-count"></span>` : ''}</button>`).join('')}
      </div>
      <div class="be-bar-right">
        <span class="be-status" id="be-status" aria-live="polite"></span>
        ${canEdit ? `<button class="icon-btn" id="be-undo" title="${te('Rückgängig')} (Ctrl+Z)" aria-label="${te('Rückgängig')}">${svg(UI.undo)}</button><button class="icon-btn" id="be-redo" title="${te('Wiederholen')}" aria-label="${te('Wiederholen')}">${svg(UI.redo)}</button>` : ''}
        <button class="icon-btn" id="be-toggle-preview" title="${te('Vorschau ein/aus')}" aria-label="${te('Vorschau ein/aus')}">${svg(UI.panel)}</button>
        <button class="btn accent" id="be-export">${te('Exportieren')}</button>
      </div>
    </header>
    <div class="be-body" id="be-body"></div>
  </div>`;
  const body = el.querySelector('#be-body');
  const statusEl = el.querySelector('#be-status');

  el.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => {
      tab = b.dataset.tab;
      paint();
    };
  });
  el.querySelector('#be-undo')?.addEventListener('click', doUndo);
  el.querySelector('#be-redo')?.addEventListener('click', doRedo);
  el.querySelector('#be-toggle-preview').onclick = () => {
    previewOpen = !previewOpen;
    save_('pp-be-preview', previewOpen ? '1' : '0');
    paint();
  };
  el.querySelector('#be-export').onclick = exportDialog;

  document.addEventListener(
    'keydown',
    (e) => {
      if (gone() || !canEdit) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== 'z') return;
      const t2 = e.target;
      if (t2.closest && t2.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      if (e.shiftKey) doRedo();
      else doUndo();
    },
    { signal: ac.signal }
  );
  window.addEventListener(
    'message',
    (e) => {
      if (gone() || e.origin !== location.origin) return;
      const frame = el.querySelector('#be-frame');
      if (!frame || e.source !== frame.contentWindow || !e.data) return;
      if (e.data.type === 'pp-ready' && sel && tab === 'content') frame.contentWindow.postMessage({ type: 'pp-goto', blockId: sel }, location.origin);
      if (e.data.type === 'pp-select' && tab === 'content' && blocks.some((b) => b.id === e.data.blockId)) select(e.data.blockId, { scroll: true, goto: false });
    },
    { signal: ac.signal }
  );
  window.addEventListener('pagehide', () => dirty && flushKeepalive(), { signal: ac.signal });

  // ---------------------------------------------------------------- painting
  function paint() {
    el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    el.querySelector('#be-toggle-preview').classList.toggle('is-on', previewOpen);
    el.querySelector('#be-toggle-preview').hidden = !['content', 'design'].includes(tab);
    reviewCount();
    body.className = `be-body is-${tab}${previewOpen && (tab === 'content' || tab === 'design') ? ' has-preview' : ''}`;
    if (tab === 'content') {
      body.innerHTML = `<aside class="be-side" id="be-side"></aside><section class="be-canvas" id="be-canvas" aria-label="${te('Blöcke')}"></section>${previewOpen ? previewHtml() : ''}`;
      paintSide();
      paintCanvas();
    } else if (tab === 'design') {
      body.innerHTML = `<section class="be-form-col" id="be-design"></section>${previewOpen ? previewHtml() : ''}`;
      paintDesign();
    } else if (tab === 'review') {
      body.innerHTML = `<section class="be-page" id="be-review"></section>`;
      paintReview();
    } else if (tab === 'settings') {
      body.innerHTML = `<section class="be-page" id="be-settings"></section>`;
      paintSettings();
    } else {
      body.innerHTML = `<section class="be-page" id="be-media"></section>`;
      paintMedia();
    }
    if (previewOpen && (tab === 'content' || tab === 'design')) bindPreview();
  }

  // ---------------------------------------------------------------- side: outline + library
  function paintSide() {
    const s = body.querySelector('#be-side');
    if (!s) return;
    s.innerHTML = `<div class="segmented be-side-switch" role="group">
        <button type="button" data-side="outline" class="${side === 'outline' ? 'is-on' : ''}">${te('Gliederung')}</button>
        ${canEdit ? `<button type="button" data-side="library" class="${side === 'library' ? 'is-on' : ''}">${te('Bausteine')}</button>` : ''}
      </div>
      <div class="be-side-body">${side === 'outline' ? outlineHtml() : libraryHtml()}</div>`;
    s.querySelectorAll('[data-side]').forEach((b) => {
      b.onclick = () => {
        side = b.dataset.side;
        paintSide();
        if (side === 'library') s.querySelector('#be-search')?.focus();
      };
    });
    if (side === 'outline') bindOutline(s);
    else bindLibrary(s);
  }

  function lessonsOf() {
    const out = [];
    blocks.forEach((b, i) => {
      if (b.type === 'title' || !out.length) out.push({ title: b.type === 'title' ? plain(b.data.content) : t('Einstieg'), start: i, blocks: [] });
      out[out.length - 1].blocks.push(b);
    });
    return out;
  }

  function outlineHtml() {
    if (!blocks.length) return `<p class="muted small be-pad">${te('Noch keine Blöcke. Wähle links unter „Bausteine“ den ersten aus.')}</p>`;
    return `<ol class="be-outline">${lessonsOf()
      .map(
        (l, li) => `<li class="be-ol-lesson"><div class="be-ol-head"><span class="be-ol-num">${String(li + 1).padStart(2, '0')}</span><span class="be-ol-title">${esc(l.title || t('Ohne Titel'))}</span></div>
        <ol>${l.blocks
          .map(
            (b) => `<li><button type="button" class="be-ol-item ${b.id === sel ? 'is-sel' : ''} ${b.issues ? 'has-issue' : ''}" data-ol="${esc(b.id)}" draggable="${canEdit}">
            ${svg(BI[b.type] || BI.text, 'be-ic')}<span class="be-ol-label">${esc(summary(b) || typeLabel(b.type))}</span>${b.issues ? `<span class="be-dot" title="${te('Unvollständig')}"></span>` : ''}</button></li>`
          )
          .join('')}</ol></li>`
      )
      .join('')}</ol>`;
  }

  function bindOutline(s) {
    let drag = null;
    s.querySelectorAll('[data-ol]').forEach((b) => {
      b.onclick = () => select(b.dataset.ol, { scroll: true });
      if (!canEdit) return;
      b.addEventListener('dragstart', (e) => {
        drag = b.dataset.ol;
        e.dataTransfer.effectAllowed = 'move';
        b.classList.add('is-drag');
      });
      b.addEventListener('dragend', () => b.classList.remove('is-drag'));
      b.addEventListener('dragover', (e) => {
        e.preventDefault();
        const r = b.getBoundingClientRect();
        b.classList.toggle('drop-after', e.clientY > r.top + r.height / 2);
        b.classList.toggle('drop-before', e.clientY <= r.top + r.height / 2);
      });
      b.addEventListener('dragleave', () => b.classList.remove('drop-before', 'drop-after'));
      b.addEventListener('drop', (e) => {
        e.preventDefault();
        const after = b.classList.contains('drop-after');
        b.classList.remove('drop-before', 'drop-after');
        if (!drag || drag === b.dataset.ol) return;
        const from = idx(drag);
        const [moved] = blocks.splice(from, 1);
        let to = idx(b.dataset.ol) + (after ? 1 : 0);
        blocks.splice(to, 0, moved);
        changed({ structure: true });
        paintCanvas();
      });
    });
  }

  function libraryHtml() {
    const q = filter.trim().toLowerCase();
    const match = (x) => !q || `${x.label} ${x.description} ${x.type}`.toLowerCase().includes(q);
    const groups = catalog.categories
      .map((cat) => {
        const items = catalog.types.filter((x) => x.category === cat && x.type !== 'h5p' && match(x));
        if (!items.length) return '';
        return `<div class="be-lib-group"><h3>${te(CATS[cat] || cat)}</h3><div class="be-lib-grid">${items
          .map((x) => `<button type="button" class="be-lib-tile" data-add="${x.type}" title="${esc(x.description)}">${svg(BI[x.type] || BI.text, 'be-ic')}<span>${esc(x.label)}</span>${x.graded ? `<em class="be-graded" title="${te('bewertet')}"></em>` : ''}</button>`)
          .join('')}</div></div>`;
      })
      .join('');
    const own = customBlocks.filter((x) => !q || `${x.name} ${x.summary}`.toLowerCase().includes(q));
    const ownGroup = canEdit
      ? `<div class="be-lib-group"><h3>${te('Eigene Bausteine')}</h3>${
          own.length
            ? `<div class="be-lib-units">${own
                .map((x) => `<div class="be-lib-own"><button type="button" class="be-lib-unit" data-add-custom="${esc(x.id)}">${svg(BI[x.type] || BI.text, 'be-ic')}<span><b>${esc(x.name)}</b><small>${esc(typeLabel(x.type))}${x.shared ? ` · ${te('für alle')}` : ''}</small></span></button>${x.mine || state.me?.role === 'admin' ? `<button type="button" class="icon-btn small" data-del-custom="${esc(x.id)}" aria-label="${te('Löschen')}" title="${te('Löschen')}">${svg(UI.trash)}</button>` : ''}</div>`)
                .join('')}</div>`
            : `<p class="muted small">${te('Speichere einen Block mit dem Stern-Symbol, um ihn hier wiederzuverwenden. Für frei gestaltete Bausteine: „Freie Fläche“ unter Weitere.')}</p>`
        }</div>`
      : '';
    const used = new Set(blocks.filter((b) => b.type === 'h5p').map((b) => b.data.unitId));
    const h5pItems = units.filter((u) => !q || u.title.toLowerCase().includes(q));
    const h5p = `<div class="be-lib-group"><h3>${te('H5P-Einheiten')}</h3>
      <p class="muted small">${te('App-Simulation, Rollenspiel, interaktives Video und alle anderen H5P-Inhalte.')}</p>
      <div class="be-lib-units">${h5pItems
        .map((u) => `<button type="button" class="be-lib-unit" data-add-unit="${esc(u.id)}">${svg(BI.h5p, 'be-ic')}<span><b>${esc(u.title)}</b><small>${esc(String(u.contentType || '').replace('H5P.', '').split(' ')[0])}${used.has(u.id) ? ` · ${te('bereits eingebunden')}` : ''}</small></span></button>`)
        .join('')}</div>
      <a class="btn small" href="/courses/${esc(courseId)}/new">${svg(UI.plus)}${te('Neue H5P-Einheit')}</a></div>`;
    return `<label class="be-search">${svg(UI.search)}<input class="input" id="be-search" type="search" placeholder="${te('Baustein suchen …')}" value="${esc(filter)}"></label>
      <p class="be-lib-hint muted small">${sel ? te('Wird nach dem ausgewählten Block eingefügt.') : te('Wird am Ende eingefügt.')}</p>
      ${groups}${ownGroup}${h5p}`;
  }

  function bindLibrary(s) {
    const input = s.querySelector('#be-search');
    if (input) {
      input.oninput = () => {
        filter = input.value;
        const pos = input.selectionStart;
        s.querySelector('.be-side-body').innerHTML = libraryHtml();
        bindLibrary(s);
        const n = s.querySelector('#be-search');
        n.focus();
        n.setSelectionRange(pos, pos);
      };
    }
    s.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => addBlock(b.dataset.add)));
    s.querySelectorAll('[data-add-unit]').forEach((b) => (b.onclick = () => addBlock('h5p', { unitId: b.dataset.addUnit })));
    s.querySelectorAll('[data-add-custom]').forEach((b) => {
      b.onclick = async () => {
        try {
          const blk = await api(`/courses/${courseId}/custom-blocks/${b.dataset.addCustom}/use`, { method: 'POST' });
          media = await api(`/courses/${courseId}/media`).catch(() => media);
          addBlock(blk.type, blk.data);
        } catch (err) {
          fail(err);
        }
      };
    });
    s.querySelectorAll('[data-del-custom]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmDialog(t('Baustein löschen?'), t('Der gespeicherte Baustein wird entfernt. Kurse, in denen er schon steckt, bleiben unverändert.')))) return;
        await api(`/custom-blocks/${b.dataset.delCustom}`, { method: 'DELETE' }).catch(fail);
        customBlocks = await api('/custom-blocks').catch(() => customBlocks);
        paintSide();
      };
    });
  }

  // ---------------------------------------------------------------- canvas
  function paintCanvas() {
    const c = body.querySelector('#be-canvas');
    if (!c) return;
    if (!blocks.length) {
      c.innerHTML = `<div class="be-empty">
        <div class="be-empty-art" aria-hidden="true">${svg(BI.title)}${svg(BI.text)}${svg(BI.quiz)}</div>
        <h2>${te('Leerer Kurs')}</h2>
        <p class="muted">${te('Ein Block-Kurs besteht aus Lektionen. Jede Lektion beginnt mit einem Titel. Danach folgen Text, Bilder und Übungen.')}</p>
        ${canEdit ? `<div class="be-empty-actions"><button class="btn primary" data-start="title">${svg(UI.plus)}${te('Erste Lektion anlegen')}</button><button class="btn" data-start="skeleton">${te('Mit Vorlage starten')}</button></div>` : ''}
        <p class="muted small">${te('Oder lass Claude den Kurs über MCP bauen: „Baue aus diesem Skript einen Block-Kurs …“')}</p>
      </div>`;
      c.querySelector('[data-start="title"]')?.addEventListener('click', () => addBlock('title'));
      c.querySelector('[data-start="skeleton"]')?.addEventListener('click', () => {
        blocks = skeleton();
        sel = blocks[0].id;
        changed({ structure: true });
        paintCanvas();
      });
      return;
    }
    let lesson = 0;
    c.innerHTML = `<div class="be-cards">${blocks
      .map((b, i) => {
        let sep = '';
        if (b.type === 'title' || i === 0) {
          lesson++;
          sep = `<div class="be-lesson-sep"><span>${b.type === 'title' ? te('Lektion {n}', { n: lesson }) : te('Einstieg')}</span></div>`;
        }
        return `${sep}${cardHtml(b, i)}${canEdit ? `<div class="be-insert"><button type="button" data-insert="${i + 1}" aria-label="${te('Block einfügen')}">${svg(UI.plus)}</button></div>` : ''}`;
      })
      .join('')}</div>`;
    blocks.forEach((b) => bindCard(b));
    c.querySelectorAll('[data-insert]').forEach((btn) => (btn.onclick = () => pickBlock(Number(btn.dataset.insert))));
  }

  function cardHtml(b, i) {
    const open = b.id === sel;
    const ty = TYPES[b.type] || { label: b.type };
    return `<article class="be-card ${open ? 'is-open' : ''} ${b.issues ? 'has-issue' : ''} be-c-${b.type}" data-card="${esc(b.id)}" id="card-${esc(b.id)}">
      <header class="be-card-head" data-head>
        ${svg(BI[b.type] || BI.text, 'be-ic')}
        <div class="be-card-name"><span class="be-card-type">${esc(ty.label)}${ty.graded ? `<em class="be-graded-tag">${te('bewertet')}</em>` : ''}</span>${open ? '' : `<span class="be-card-sum">${esc(summary(b))}</span>`}</div>
        ${b.issues ? `<span class="be-issue-pill" title="${esc(b.issues.join('\n'))}">${svg(UI.warn)}${te('unvollständig')}</span>` : ''}
        ${openComments(b.id) ? `<button type="button" class="be-comment-pill" data-comments-of="${esc(b.id)}" title="${te('Offene Review-Kommentare')}">${svg(UI.chat)}${openComments(b.id)}</button>` : ''}
        ${
          canEdit
            ? `<div class="be-card-actions">
          <button type="button" class="icon-btn" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="${te('Nach oben')}" title="${te('Nach oben')}">${svg(UI.up)}</button>
          <button type="button" class="icon-btn" data-act="down" ${i === blocks.length - 1 ? 'disabled' : ''} aria-label="${te('Nach unten')}" title="${te('Nach unten')}">${svg(UI.down)}</button>
          <button type="button" class="icon-btn" data-act="dup" aria-label="${te('Duplizieren')}" title="${te('Duplizieren')}">${svg(UI.copy)}</button>
          ${b.type !== 'h5p' ? `<button type="button" class="icon-btn" data-act="keep" aria-label="${te('Als eigenen Baustein speichern')}" title="${te('Als eigenen Baustein speichern')}">${svg(UI.star)}</button>` : ''}
          <button type="button" class="icon-btn" data-act="del" aria-label="${te('Löschen')}" title="${te('Löschen')}">${svg(UI.trash)}</button></div>`
            : ''
        }
      </header>
      ${open ? `<div class="be-card-body" data-body></div>` : ''}
    </article>`;
  }

  function bindCard(b) {
    const card = body.querySelector(`[data-card="${cssId(b.id)}"]`);
    if (!card) return;
    card.querySelector('[data-comments-of]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      tab = 'review';
      commentFilter = 'open';
      paint();
      body.querySelector(`[data-thread-block="${cssId(b.id)}"]`)?.scrollIntoView({ block: 'center' });
    });
    card.querySelector('[data-head]').addEventListener('click', (e) => {
      if (e.target.closest('[data-act], [data-comments-of]')) return;
      select(b.id === sel ? null : b.id, { goto: true });
    });
    card.querySelectorAll('[data-act]').forEach((btn) => {
      btn.onclick = async () => {
        const i = idx(b.id);
        if (btn.dataset.act === 'up' && i > 0) [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]];
        else if (btn.dataset.act === 'down' && i < blocks.length - 1) [blocks[i + 1], blocks[i]] = [blocks[i], blocks[i + 1]];
        else if (btn.dataset.act === 'dup') {
          const copy = { ...clone(b), id: newId() };
          delete copy.issues;
          blocks.splice(i + 1, 0, copy);
          sel = copy.id;
        } else if (btn.dataset.act === 'keep') {
          if (b.issues) return toast(t('Der Block ist noch unvollständig.'), 'error');
          dialog({
            title: t('Als eigenen Baustein speichern'),
            body: `<p class="muted">${te('Der Block landet unter „Bausteine → Eigene Bausteine“ und lässt sich in jeden Kurs einfügen. Bilder und Dateien werden mitkopiert.')}</p>
              <div class="field"><label for="cbn">${te('Name')}</label><input class="input" id="cbn" maxlength="80" value="${esc(cut(summary(b) || typeLabel(b.type), 60))}"></div>
              ${state.me?.role === 'admin' ? `<label class="check"><input type="checkbox" id="cbs">${te('Für alle Konten freigeben')}</label>` : ''}`,
            actions: [
              { label: t('Abbrechen'), kind: 'ghost' },
              {
                label: t('Speichern'),
                kind: 'primary',
                handler: async (dd) => {
                  if (dirty || saving) {
                    clearTimeout(saveTimer);
                    await saveNow();
                  }
                  await api(`/courses/${courseId}/blocks/${b.id}/save-custom`, { method: 'POST', body: { name: dd.querySelector('#cbn').value, shared: !!dd.querySelector('#cbs')?.checked } });
                  customBlocks = await api('/custom-blocks').catch(() => customBlocks);
                  toast(t('Gespeichert. Du findest ihn unter Bausteine.'));
                  if (side === 'library') paintSide();
                }
              }
            ]
          });
          return;
        } else if (btn.dataset.act === 'del') {
          if (!isEmpty(b) && !(await confirmDialog(t('Block löschen?'), t('„{name}“ wird entfernt. Mit „Rückgängig“ holst du ihn zurück.', { name: summary(b) || typeLabel(b.type) }), t('Löschen')))) return;
          blocks.splice(i, 1);
          if (sel === b.id) sel = blocks[Math.min(i, blocks.length - 1)]?.id || null;
        } else return;
        changed({ structure: true });
        paintCanvas();
        if (sel) scrollToCard(sel);
      };
    });
    const bodyEl = card.querySelector('[data-body]');
    if (bodyEl) {
      bodyEl.appendChild(blockForm(b));
      markIssues(b, card);
    }
  }

  function rerenderCard(id) {
    const b = blocks.find((x) => x.id === id);
    const old = body.querySelector(`[data-card="${cssId(id)}"]`);
    if (!b || !old) return;
    const holder = document.createElement('div');
    holder.innerHTML = cardHtml(b, idx(id));
    old.replaceWith(holder.firstElementChild);
    bindCard(b);
  }

  function select(id, { scroll = false, goto = true } = {}) {
    const prev = sel;
    sel = id;
    if (prev && prev !== id) rerenderCard(prev);
    if (id) rerenderCard(id);
    body.querySelectorAll('[data-ol]').forEach((x) => x.classList.toggle('is-sel', x.dataset.ol === id));
    const hint = body.querySelector('.be-lib-hint');
    if (hint) hint.textContent = id ? t('Wird nach dem ausgewählten Block eingefügt.') : t('Wird am Ende eingefügt.');
    if (id && scroll) scrollToCard(id);
    if (id && goto) gotoPreview(id);
  }

  function scrollToCard(id) {
    const c = body.querySelector(`[data-card="${cssId(id)}"]`);
    if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function addBlock(type, data, at) {
    const ty = TYPES[type];
    const b = { id: newId(), type, data: data || clone(ty?.example || {}) };
    if (type === 'title' && !data) b.data = { content: '' };
    const pos = at !== undefined ? at : sel ? idx(sel) + 1 : blocks.length;
    blocks.splice(pos, 0, b);
    sel = b.id;
    side = side === 'library' ? 'library' : 'outline';
    changed({ structure: true });
    paintCanvas();
    paintSide();
    scrollToCard(b.id);
    setTimeout(() => body.querySelector(`[data-card="${cssId(b.id)}"] [data-body] input, [data-card="${cssId(b.id)}"] [data-body] textarea, [data-card="${cssId(b.id)}"] [data-body] [contenteditable]`)?.focus(), 60);
  }

  function pickBlock(at) {
    let q = '';
    const grid = () =>
      catalog.categories
        .map((cat) => {
          const items = catalog.types.filter((x) => x.category === cat && x.type !== 'h5p' && (!q || `${x.label} ${x.description}`.toLowerCase().includes(q)));
          return items.length
            ? `<h3 class="be-pick-cat">${te(CATS[cat])}</h3><div class="be-pick-grid">${items.map((x) => `<button type="button" class="be-pick" data-pick="${x.type}">${svg(BI[x.type] || BI.text, 'be-ic')}<span><b>${esc(x.label)}</b><small>${esc(x.description)}</small></span></button>`).join('')}</div>`
            : '';
        })
        .join('') +
      (units.length && (!q || 'h5p'.includes(q))
        ? `<h3 class="be-pick-cat">${te('H5P-Einheiten')}</h3><div class="be-pick-grid">${units.map((u) => `<button type="button" class="be-pick" data-pick-unit="${esc(u.id)}">${svg(BI.h5p, 'be-ic')}<span><b>${esc(u.title)}</b><small>${esc(String(u.contentType || '').replace('H5P.', '').split(' ')[0])}</small></span></button>`).join('')}</div>`
        : '');
    dialog({
      title: t('Block einfügen'),
      wide: true,
      body: `<label class="be-search">${svg(UI.search)}<input class="input" id="pk" type="search" placeholder="${te('Baustein suchen …')}"></label><div id="pk-grid" class="be-pick-wrap">${grid()}</div>`,
      onOpen: (d, close) => {
        const bind = () => {
          d.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => (close(), addBlock(b.dataset.pick, undefined, at))));
          d.querySelectorAll('[data-pick-unit]').forEach((b) => (b.onclick = () => (close(), addBlock('h5p', { unitId: b.dataset.pickUnit }, at))));
        };
        d.querySelector('#pk').oninput = (e) => {
          q = e.target.value.trim().toLowerCase();
          d.querySelector('#pk-grid').innerHTML = grid();
          bind();
        };
        bind();
      }
    });
  }

  // ---------------------------------------------------------------- forms
  function blockForm(b) {
    const ty = TYPES[b.type];
    const wrap = h('div', 'be-form');
    if (!ty) {
      wrap.textContent = b.type;
      return wrap;
    }
    const ctxF = { block: b, root: b.data, path: 'data' };
    if (b.type === 'quiz') wrap.appendChild(questionEditor(b.data, ctxF, 'data'));
    else if (b.type === 'graph') wrap.appendChild(graphEditor(b));
    else if (b.type === 'h5p') wrap.appendChild(h5pEditor(b));
    else if (b.type === 'canvas') wrap.appendChild(canvasEditor(b));
    else {
      for (const [name, spec] of Object.entries(ty.spec || {})) {
        if (b.type === 'hotspot' && name === 'spots') {
          wrap.appendChild(hotspotEditor(b));
          continue;
        }
        wrap.appendChild(field(name, spec, b.data, `data.${name}`, b));
      }
    }
    if (canEdit) wrap.appendChild(narrationRow(b));
    if (!canEdit) wrap.querySelectorAll('input, textarea, select, button').forEach((x) => (x.disabled = true));
    if (!canEdit) wrap.querySelectorAll('[contenteditable]').forEach((x) => x.setAttribute('contenteditable', 'false'));
    return wrap;
  }

  function fieldLabel(name, spec, typeKey) {
    const req = spec.req || (spec.t === 'list' && spec.min > 0);
    return `${te(FIELD[name] || name)}${req ? '<span class="be-req" aria-hidden="true">*</span>' : ''}`;
  }

  /** Generic field for spec on parent object `obj` at key `name`. */
  function field(name, spec, obj, path, b) {
    const f = h('div', `be-field be-f-${spec.t}`);
    f.dataset.path = path;
    const hint = HINT[`${b.type}.${name}`];
    const lab = () => {
      const l = h('label', 'be-label');
      l.innerHTML = fieldLabel(name, spec);
      return l;
    };
    const commit = (v) => {
      if (v === undefined || v === '' || (Array.isArray(v) && !v.length && !spec.min)) delete obj[name];
      else obj[name] = v;
      changed();
    };
    switch (spec.t) {
      case 'text': {
        f.appendChild(lab());
        const long = spec.max > 220 || name === 'text';
        const inp = long ? h('textarea', 'input') : h('input', 'input');
        if (long) inp.rows = name === 'text' && b.type === 'fillBlanks' ? 4 : 2;
        inp.maxLength = spec.max;
        inp.value = obj[name] ?? '';
        if (b.type === 'title' && name === 'content') inp.classList.add('be-input-title');
        inp.placeholder = placeholderFor(b.type, name);
        inp.oninput = () => {
          commit(inp.value);
          counter();
          if ((b.type === 'title' && name === 'content') || name === 'question' || name === 'heading') refreshOutlineSoon();
        };
        f.appendChild(inp);
        const cnt = h('span', 'be-count');
        const counter = () => {
          const n = inp.value.length;
          cnt.textContent = n > spec.max * 0.8 ? `${n}/${spec.max}` : '';
        };
        counter();
        f.appendChild(cnt);
        if (inp.tagName === 'TEXTAREA') autosize(inp);
        break;
      }
      case 'html': {
        f.appendChild(lab());
        f.appendChild(richText(obj[name] || '', (v) => commit(v), { min: name === 'content' && ['text', 'columns'].includes(b.type) ? 120 : 64 }));
        break;
      }
      case 'url': {
        f.appendChild(lab());
        const inp = h('input', 'input');
        inp.type = 'url';
        inp.placeholder = 'https://';
        inp.value = obj[name] ?? '';
        inp.oninput = () => commit(inp.value.trim());
        f.appendChild(inp);
        break;
      }
      case 'media': {
        f.appendChild(lab());
        f.appendChild(mediaField(spec.kind, obj[name], (v) => (commit(v), rerenderCard(b.id))));
        break;
      }
      case 'enum': {
        f.appendChild(lab());
        const seg = h('div', 'segmented be-seg');
        const cur = obj[name] ?? spec.def;
        for (const o of spec.opts) {
          const btn = h('button', cur === o ? 'is-on' : '');
          btn.type = 'button';
          btn.textContent = t(OPT[o] || o);
          btn.onclick = () => {
            commit(o);
            seg.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === btn));
          };
          seg.appendChild(btn);
        }
        f.appendChild(seg);
        break;
      }
      case 'num': {
        f.appendChild(lab());
        const inp = h('input', 'input num be-num');
        inp.type = 'number';
        inp.min = spec.min;
        inp.max = spec.max;
        inp.step = spec.int ? '1' : 'any';
        inp.value = obj[name] ?? spec.def;
        inp.oninput = () => commit(inp.value === '' ? undefined : Number(inp.value));
        f.appendChild(inp);
        break;
      }
      case 'bool': {
        const l = h('label', 'be-switch');
        const inp = h('input');
        inp.type = 'checkbox';
        inp.checked = obj[name] ?? spec.def;
        inp.onchange = () => commit(inp.checked);
        l.appendChild(inp);
        l.appendChild(h('span', 'be-switch-ui'));
        l.appendChild(document.createTextNode(t(FIELD[name] || name)));
        f.appendChild(l);
        break;
      }
      case 'list': {
        f.appendChild(lab());
        if (name === 'rows' && spec.of.t === 'list') f.appendChild(tableEditor(obj, b));
        else if (spec.of.t === 'obj') f.appendChild(objList(name, spec, obj, path, b));
        else f.appendChild(simpleList(name, spec, obj, path, b));
        break;
      }
      case 'obj': {
        const box = h('fieldset', 'be-group');
        const lg = h('legend');
        lg.innerHTML = fieldLabel(name, spec);
        box.appendChild(lg);
        if (!obj[name] || typeof obj[name] !== 'object') obj[name] = {};
        for (const [k, sub] of Object.entries(spec.fields)) box.appendChild(field(k, sub, obj[name], `${path}.${k}`, b));
        f.appendChild(box);
        break;
      }
      default:
        break;
    }
    if (hint) f.appendChild(Object.assign(h('span', 'hint'), { textContent: t(hint) }));
    return f;
  }

  function simpleList(name, spec, obj, path, b) {
    if (!Array.isArray(obj[name])) obj[name] = [];
    const arr = obj[name];
    const box = h('div', 'be-list');
    const paintL = (focus) => {
      box.innerHTML = '';
      arr.forEach((v, i) => {
        const row = h('div', 'be-list-row');
        row.dataset.path = `${path}[${i}]`;
        const num = h('span', 'be-list-num');
        num.textContent = b.type === 'numberedList' || b.type === 'sorting' ? String(i + 1) : '•';
        row.appendChild(num);
        let inp;
        if (spec.of.t === 'num') {
          inp = h('input', 'input num');
          inp.type = 'number';
          inp.value = v;
          inp.oninput = () => {
            arr[i] = inp.value === '' ? 0 : Number(inp.value);
            changed();
          };
        } else {
          inp = h('input', 'input');
          inp.value = v ?? '';
          inp.maxLength = spec.of.max || 400;
          inp.placeholder = t('Eintrag {n}', { n: i + 1 });
          inp.oninput = () => {
            arr[i] = inp.value;
            changed();
          };
          inp.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.isComposing && arr.length < spec.max) {
              e.preventDefault();
              arr.splice(i + 1, 0, '');
              changed();
              paintL(i + 1);
            } else if (e.key === 'Backspace' && inp.value === '' && arr.length > 1) {
              e.preventDefault();
              arr.splice(i, 1);
              changed();
              paintL(Math.max(0, i - 1));
            }
          };
        }
        row.appendChild(inp);
        row.appendChild(rowTools(arr, i, () => paintL()));
        box.appendChild(row);
        if (focus === i) setTimeout(() => inp.focus(), 0);
      });
      if (arr.length < spec.max) {
        const add = h('button', 'be-add');
        add.type = 'button';
        add.innerHTML = `${svg(UI.plus)}${te('Eintrag hinzufügen')}`;
        add.onclick = () => {
          arr.push(spec.of.t === 'num' ? 0 : '');
          changed();
          paintL(arr.length - 1);
        };
        box.appendChild(add);
      }
    };
    paintL();
    return box;
  }

  function rowTools(arr, i, repaint, { onChange } = {}) {
    const tools = h('div', 'be-row-tools');
    const mk = (ic, label, fn, dis) => {
      const btn = h('button', 'icon-btn small');
      btn.type = 'button';
      btn.innerHTML = svg(ic);
      btn.setAttribute('aria-label', label);
      btn.title = label;
      btn.disabled = !!dis;
      btn.onclick = fn;
      tools.appendChild(btn);
    };
    mk(UI.up, t('Nach oben'), () => ([arr[i - 1], arr[i]] = [arr[i], arr[i - 1]], onChange && onChange('swap', i - 1, i), changed(), repaint()), i === 0);
    mk(UI.down, t('Nach unten'), () => ([arr[i + 1], arr[i]] = [arr[i], arr[i + 1]], onChange && onChange('swap', i, i + 1), changed(), repaint()), i === arr.length - 1);
    mk(UI.trash, t('Entfernen'), () => (arr.splice(i, 1), onChange && onChange('del', i), changed(), repaint()));
    return tools;
  }

  function objList(name, spec, obj, path, b) {
    if (!Array.isArray(obj[name])) obj[name] = [];
    const arr = obj[name];
    const box = h('div', 'be-objlist');
    const itemTitle = { questions: 'Frage', cards: 'Karte', items: 'Eintrag', tabs: 'Tab', steps: 'Schritt', links: 'Link', images: 'Bild', pairs: 'Paar', buckets: 'Kategorie', spots: 'Punkt', series: 'Reihe' }[name] || 'Eintrag';
    const paintO = () => {
      box.innerHTML = '';
      arr.forEach((item, i) => {
        if (!item || typeof item !== 'object') arr[i] = {};
        const card = h('div', 'be-sub');
        card.dataset.path = `${path}[${i}]`;
        const head = h('div', 'be-sub-head');
        head.innerHTML = `<span class="be-sub-num">${String(i + 1).padStart(2, '0')}</span><span class="be-sub-title">${te(itemTitle)}</span>`;
        head.appendChild(rowTools(arr, i, paintO));
        card.appendChild(head);
        if (name === 'pairs') card.classList.add('be-sub-pair');
        if (name === 'questions') card.appendChild(questionEditor(arr[i], { block: b }, `${path}[${i}]`));
        else for (const [k, sub] of Object.entries(spec.of.fields)) card.appendChild(field(k, sub, arr[i], `${path}[${i}].${k}`, b));
        box.appendChild(card);
      });
      if (arr.length < spec.max) {
        const add = h('button', 'be-add');
        add.type = 'button';
        add.innerHTML = `${svg(UI.plus)}${te('{x} hinzufügen', { x: t(itemTitle) })}`;
        add.onclick = () => {
          arr.push(name === 'questions' ? { question: '', options: ['', ''], correct: [0] } : {});
          changed();
          paintO();
          const last = box.querySelectorAll('.be-sub');
          last[last.length - 1]?.querySelector('input, textarea, [contenteditable]')?.focus();
        };
        box.appendChild(add);
      }
      markIssues(b);
    };
    paintO();
    return box;
  }

  function questionEditor(q, _c, path) {
    if (!Array.isArray(q.options)) q.options = ['', ''];
    if (!Array.isArray(q.correct)) q.correct = [];
    const wrap = h('div', 'be-question');
    const b = _c.block;
    const qf = field('question', { t: 'text', max: 600, req: true }, q, `${path}.question`, b);
    wrap.appendChild(qf);
    const opts = h('div', 'be-field');
    opts.dataset.path = `${path}.options`;
    const lab = h('label', 'be-label');
    lab.innerHTML = `${te('Antworten')}<span class="be-req">*</span> <span class="muted small">${te('Richtige ankreuzen')}</span>`;
    opts.appendChild(lab);
    const list = h('div', 'be-options');
    opts.appendChild(list);
    const paintQ = () => {
      list.innerHTML = '';
      q.options.forEach((o, i) => {
        const row = h('div', `be-option ${q.correct.includes(i) ? 'is-correct' : ''}`);
        const ck = h('label', 'be-correct');
        const cb = h('input');
        cb.type = 'checkbox';
        cb.checked = q.correct.includes(i);
        cb.setAttribute('aria-label', t('Richtige Antwort'));
        cb.onchange = () => {
          q.correct = cb.checked ? [...new Set([...q.correct, i])].sort((a, z) => a - z) : q.correct.filter((x) => x !== i);
          q.multiple = q.correct.length > 1;
          row.classList.toggle('is-correct', cb.checked);
          changed();
        };
        ck.appendChild(cb);
        ck.appendChild(h('span', 'be-correct-ui'));
        row.appendChild(ck);
        const inp = h('input', 'input');
        inp.value = o ?? '';
        inp.maxLength = 300;
        inp.placeholder = t('Antwort {n}', { n: i + 1 });
        inp.oninput = () => {
          q.options[i] = inp.value;
          changed();
        };
        inp.onkeydown = (e) => {
          if (e.key === 'Enter' && !e.isComposing && q.options.length < 8) {
            e.preventDefault();
            q.options.splice(i + 1, 0, '');
            q.correct = q.correct.map((x) => (x > i ? x + 1 : x));
            changed();
            paintQ();
            list.querySelectorAll('.be-option input.input')[i + 1]?.focus();
          }
        };
        row.appendChild(inp);
        row.appendChild(
          rowTools(q.options, i, paintQ, {
            onChange: (op, a, z) => {
              if (op === 'del') q.correct = q.correct.filter((x) => x !== a).map((x) => (x > a ? x - 1 : x));
              if (op === 'swap') q.correct = q.correct.map((x) => (x === a ? z : x === z ? a : x));
            }
          })
        );
        list.appendChild(row);
      });
      if (q.options.length < 8) {
        const add = h('button', 'be-add');
        add.type = 'button';
        add.innerHTML = `${svg(UI.plus)}${te('Antwort hinzufügen')}`;
        add.onclick = () => {
          q.options.push('');
          changed();
          paintQ();
          list.querySelectorAll('.be-option input.input')[q.options.length - 1]?.focus();
        };
        list.appendChild(add);
      }
    };
    paintQ();
    wrap.appendChild(opts);
    wrap.appendChild(field('explanation', { t: 'text', max: 1200 }, q, `${path}.explanation`, b));
    return wrap;
  }

  function tableEditor(obj, b) {
    if (!Array.isArray(obj.rows) || !obj.rows.length) obj.rows = [['', ''], ['', '']];
    const rows = obj.rows;
    const box = h('div', 'be-table-ed');
    const paintT = () => {
      const cols = Math.max(...rows.map((r) => r.length));
      rows.forEach((r) => {
        while (r.length < cols) r.push('');
      });
      box.innerHTML = '';
      const grid = h('div', 'be-tgrid');
      grid.style.gridTemplateColumns = `repeat(${cols}, minmax(110px, 1fr)) 32px`;
      rows.forEach((r, ri) => {
        r.forEach((cell, ci) => {
          const inp = h('input', `input ${ri === 0 && obj.header !== false ? 'is-head' : ''}`);
          inp.value = cell ?? '';
          inp.maxLength = 400;
          inp.oninput = () => {
            rows[ri][ci] = inp.value;
            changed();
          };
          grid.appendChild(inp);
        });
        const del = h('button', 'icon-btn small');
        del.type = 'button';
        del.innerHTML = svg(UI.trash);
        del.setAttribute('aria-label', t('Zeile entfernen'));
        del.disabled = rows.length < 2;
        del.onclick = () => (rows.splice(ri, 1), changed(), paintT());
        grid.appendChild(del);
      });
      box.appendChild(grid);
      const bar = h('div', 'be-inline-actions');
      const addR = h('button', 'be-add');
      addR.type = 'button';
      addR.innerHTML = `${svg(UI.plus)}${te('Zeile')}`;
      addR.onclick = () => (rows.push(Array(cols).fill('')), changed(), paintT());
      const addC = h('button', 'be-add');
      addC.type = 'button';
      addC.innerHTML = `${svg(UI.plus)}${te('Spalte')}`;
      addC.disabled = cols >= 10;
      addC.onclick = () => (rows.forEach((r) => r.push('')), changed(), paintT());
      const delC = h('button', 'be-add');
      delC.type = 'button';
      delC.textContent = t('Letzte Spalte entfernen');
      delC.disabled = cols < 2;
      delC.onclick = () => (rows.forEach((r) => r.pop()), changed(), paintT());
      bar.append(addR, addC, delC);
      box.appendChild(bar);
    };
    paintT();
    return box;
  }

  function graphEditor(b) {
    const d = b.data;
    if (!Array.isArray(d.labels) || !d.labels.length) d.labels = ['A', 'B'];
    if (!Array.isArray(d.series) || !d.series.length) d.series = [{ name: '', values: [0, 0] }];
    const wrap = h('div', 'be-form');
    const spec = TYPES.graph.spec;
    wrap.appendChild(field('chartType', spec.chartType, d, 'data.chartType', b));
    wrap.appendChild(field('title', spec.title, d, 'data.title', b));
    const box = h('div', 'be-field');
    box.dataset.path = 'data.series';
    const lab = h('label', 'be-label');
    lab.textContent = t('Daten');
    box.appendChild(lab);
    const tbl = h('div', 'be-table-ed');
    const paintG = () => {
      d.series.forEach((s) => {
        if (!Array.isArray(s.values)) s.values = [];
        while (s.values.length < d.labels.length) s.values.push(0);
        s.values.length = d.labels.length;
      });
      tbl.innerHTML = '';
      const grid = h('div', 'be-tgrid');
      grid.style.gridTemplateColumns = `150px repeat(${d.labels.length}, minmax(80px, 1fr)) 32px`;
      grid.appendChild(Object.assign(h('span', 'be-tg-corner'), { textContent: t('Reihe / Beschriftung') }));
      d.labels.forEach((l, li) => {
        const inp = h('input', 'input is-head');
        inp.value = l;
        inp.maxLength = 40;
        inp.oninput = () => ((d.labels[li] = inp.value), changed());
        grid.appendChild(inp);
      });
      grid.appendChild(h('span'));
      d.series.forEach((s, si) => {
        const nm = h('input', 'input');
        nm.value = s.name || '';
        nm.placeholder = t('Reihe {n}', { n: si + 1 });
        nm.oninput = () => ((s.name = nm.value), changed());
        grid.appendChild(nm);
        s.values.forEach((v, vi) => {
          const inp = h('input', 'input num');
          inp.type = 'number';
          inp.step = 'any';
          inp.value = v;
          inp.oninput = () => ((s.values[vi] = Number(inp.value) || 0), changed());
          grid.appendChild(inp);
        });
        const del = h('button', 'icon-btn small');
        del.type = 'button';
        del.innerHTML = svg(UI.trash);
        del.disabled = d.series.length < 2;
        del.setAttribute('aria-label', t('Reihe entfernen'));
        del.onclick = () => (d.series.splice(si, 1), changed(), paintG());
        grid.appendChild(del);
      });
      tbl.appendChild(grid);
      const bar = h('div', 'be-inline-actions');
      const mk = (txt, fn, dis) => {
        const x = h('button', 'be-add');
        x.type = 'button';
        x.innerHTML = txt;
        x.disabled = !!dis;
        x.onclick = () => (fn(), changed(), paintG());
        bar.appendChild(x);
      };
      mk(`${svg(UI.plus)}${te('Beschriftung')}`, () => d.labels.push(''), d.labels.length >= 24);
      mk(`${svg(UI.plus)}${te('Reihe')}`, () => d.series.push({ name: '', values: [] }), d.series.length >= 6 || d.chartType === 'pie');
      mk(te('Letzte Beschriftung entfernen'), () => d.labels.pop(), d.labels.length < 2);
      tbl.appendChild(bar);
    };
    paintG();
    box.appendChild(tbl);
    wrap.appendChild(box);
    wrap.appendChild(field('unit', spec.unit, d, 'data.unit', b));
    return wrap;
  }

  function hotspotEditor(b) {
    const d = b.data;
    if (!Array.isArray(d.spots)) d.spots = [];
    const box = h('div', 'be-field');
    box.dataset.path = 'data.spots';
    const lab = h('label', 'be-label');
    lab.innerHTML = `${te('Punkte')}<span class="be-req">*</span> <span class="muted small">${te('Ins Bild klicken, um einen Punkt zu setzen')}</span>`;
    box.appendChild(lab);
    const stageEl = h('div', 'be-hs-stage');
    const list = h('div');
    const paintH = () => {
      stageEl.innerHTML = '';
      if (d.image) {
        const img = h('img');
        img.src = mediaUrl(d.image);
        img.alt = '';
        stageEl.appendChild(img);
        d.spots.forEach((s, i) => {
          const m = h('span', 'be-hs-pin');
          m.style.left = `${(s.x ?? 0.5) * 100}%`;
          m.style.top = `${(s.y ?? 0.5) * 100}%`;
          m.textContent = String(i + 1);
          stageEl.appendChild(m);
        });
        stageEl.onclick = (e) => {
          if (!canEdit || d.spots.length >= 20) return;
          const r = img.getBoundingClientRect();
          const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 1000;
          const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 1000;
          d.spots.push({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), title: '' });
          changed();
          paintH();
          list.querySelectorAll('.be-sub')[d.spots.length - 1]?.querySelector('input')?.focus();
        };
      } else stageEl.innerHTML = `<p class="muted small">${te('Erst ein Bild wählen.')}</p>`;
      list.innerHTML = '';
      list.appendChild(objList('spots', TYPES.hotspot.spec.spots, d, 'data.spots', b));
      list.querySelectorAll('.be-add').forEach((x) => x.remove());
    };
    paintH();
    box.append(stageEl, list);
    return box;
  }

  function h5pEditor(b) {
    const d = b.data;
    const wrap = h('div', 'be-form');
    const f = h('div', 'be-field');
    f.dataset.path = 'data.unitId';
    const lab = h('label', 'be-label');
    lab.innerHTML = `${te('H5P-Einheit')}<span class="be-req">*</span>`;
    const s = h('select', 'input');
    s.innerHTML = `<option value="">${te('Einheit wählen …')}</option>${units.map((u) => `<option value="${esc(u.id)}" ${u.id === d.unitId ? 'selected' : ''}>${esc(u.title)} · ${esc(String(u.contentType || '').replace('H5P.', '').split(' ')[0])}</option>`).join('')}`;
    s.onchange = () => {
      d.unitId = s.value;
      changed();
      rerenderCard(b.id);
    };
    f.append(lab, s);
    wrap.appendChild(f);
    const u = units.find((x) => x.id === d.unitId);
    const links = h('div', 'be-inline-actions');
    if (u) links.innerHTML = `<a class="btn small" href="/units/${esc(u.id)}/edit">${svg(UI.edit)}${te('Einheit bearbeiten')}</a><a class="btn small ghost" href="/units/${esc(u.id)}/view">${te('Ansehen')}</a>`;
    links.innerHTML += `<a class="btn small ghost" href="/courses/${esc(courseId)}/new">${svg(UI.plus)}${te('Neue H5P-Einheit')}</a>`;
    wrap.appendChild(links);
    wrap.appendChild(field('height', TYPES.h5p.spec.height, d, 'data.height', b));
    return wrap;
  }

  // ---------------------------------------------------------------- Block Studio: canvas editor
  function canvasEditor(b) {
    const d = b.data;
    if (!Array.isArray(d.layers)) d.layers = [];
    if (!d.aspect) d.aspect = '16:9';
    const RATIO = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '3:4': 3 / 4, '21:9': 21 / 9 };
    let current = d.layers.length ? 0 : -1;
    const wrap = h('div', 'be-cv');
    const bar = h('div', 'be-cv-bar');
    const stageWrap = h('div', 'be-cv-stagewrap');
    const stage = h('div', 'be-cv-stage');
    stageWrap.appendChild(stage);
    const props = h('div', 'be-cv-props');
    wrap.append(bar, stageWrap, props);
    const r1 = (v) => Math.round(v * 10) / 10;

    const addLayer = (kind) => {
      const base = { kind, x: 10 + (d.layers.length % 5) * 4, y: 10 + (d.layers.length % 5) * 4 };
      const l = kind === 'text' ? { ...base, w: 50, h: 14, text: t('Neuer Text'), size: 32, color: '#ffffff' }
        : kind === 'button' ? { ...base, w: 22, h: 11, text: t('Mehr erfahren'), size: 22, fill: '#ffffff', color: '#1d2230', shape: 'round', reveal: t('Text, der beim Klick erscheint.') }
        : kind === 'shape' ? { ...base, w: 20, h: 20 * RATIO[d.aspect], fill: '#b3312c', shape: 'rect' }
        : { ...base, w: 30, h: 30 };
      if (kind === 'image') {
        library('image', (ref) => {
          if (!ref) return;
          d.layers.push({ ...l, image: ref, alt: '' });
          current = d.layers.length - 1;
          changed({ structure: true });
          paintAll();
        });
        return;
      }
      d.layers.push(l);
      current = d.layers.length - 1;
      changed({ structure: true });
      paintAll();
    };

    function paintBar() {
      bar.innerHTML = '';
      const seg = h('div', 'segmented be-seg');
      Object.keys(RATIO).forEach((k) => {
        const x = h('button', d.aspect === k ? 'is-on' : '');
        x.type = 'button';
        x.textContent = k;
        x.onclick = () => ((d.aspect = k), changed(), paintAll());
        seg.appendChild(x);
      });
      const bg = h('label', 'be-color be-cv-bg');
      bg.innerHTML = `<input type="color" value="${esc(d.background || '#1d2230')}"><span>${te('Hintergrund')}</span>`;
      bg.querySelector('input').oninput = (e) => ((d.background = e.target.value), changed(), paintStage());
      const add = h('div', 'be-cv-add');
      [['text', 'Text', UI.h], ['image', 'Bild', BI.image], ['shape', 'Form', '<rect x="4" y="4" width="16" height="16" rx="3"/>'], ['button', 'Knopf', '<rect x="3" y="8" width="18" height="8" rx="4"/>']].forEach(([k, l, ic]) => {
        const x = h('button', 'btn small');
        x.type = 'button';
        x.innerHTML = `${svg(ic)}${te(l)}`;
        x.onclick = () => addLayer(k);
        add.appendChild(x);
      });
      bar.append(seg, bg, add);
    }

    function layerNode(l, i) {
      const n = h('div', `be-cv-layer k-${l.kind} ${i === current ? 'is-sel' : ''}`);
      n.dataset.i = String(i);
      Object.assign(n.style, { left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%`, transform: l.rotate ? `rotate(${l.rotate}deg)` : '', opacity: l.opacity !== undefined ? String(l.opacity / 100) : '' });
      if (l.kind === 'image') n.innerHTML = l.image ? `<img src="${esc(mediaUrl(l.image))}" alt="" draggable="false">` : '';
      else if (l.kind === 'shape') {
        n.style.background = l.fill || '#b3312c';
        n.style.borderRadius = l.shape === 'circle' ? '50%' : l.shape === 'round' ? '999px' : '0';
      } else {
        n.textContent = l.text || '';
        n.style.fontSize = `${(l.size || 28) * 0.1}cqw`;
        n.style.fontWeight = l.weight === 'bold' ? '700' : '400';
        n.style.textAlign = l.align || (l.kind === 'button' ? 'center' : 'left');
        n.style.color = l.color || (l.kind === 'button' ? '#fff' : '#111');
        if (l.kind === 'button') {
          n.style.background = l.fill || '#1d2230';
          n.style.borderRadius = l.shape === 'round' ? '999px' : '0.8cqw';
        } else if (l.fill) n.style.background = l.fill;
      }
      if (i === current && canEdit) {
        const hd = h('span', 'be-cv-handle');
        hd.dataset.resize = '1';
        n.appendChild(hd);
      }
      return n;
    }

    function paintStage() {
      stage.innerHTML = '';
      stage.style.aspectRatio = String(RATIO[d.aspect] || 16 / 9);
      stage.style.background = d.background || '#1d2230';
      if (d.backgroundImage) {
        const im = h('img', 'be-cv-bgimg');
        im.src = mediaUrl(d.backgroundImage);
        im.alt = '';
        im.draggable = false;
        stage.appendChild(im);
      }
      d.layers.forEach((l, i) => stage.appendChild(layerNode(l, i)));
      if (!d.layers.length) stage.insertAdjacentHTML('beforeend', `<p class="be-cv-empty">${te('Füge oben Text, Bilder, Formen oder Knöpfe hinzu und ziehe sie an ihren Platz.')}</p>`);
    }

    // drag & resize with pointer events; values in % of the stage, 0.5 % grid
    stage.addEventListener('pointerdown', (e) => {
      if (!canEdit) return;
      const node = e.target.closest('.be-cv-layer');
      if (!node) {
        current = -1;
        paintStage();
        paintProps();
        return;
      }
      const i = Number(node.dataset.i);
      const l = d.layers[i];
      const resize = !!e.target.dataset.resize;
      if (current !== i) {
        current = i;
        paintStage();
        paintProps();
      }
      const target = stage.querySelector(`[data-i="${i}"]`);
      const rect = stage.getBoundingClientRect();
      const sx = e.clientX;
      const sy = e.clientY;
      const start = { x: l.x, y: l.y, w: l.w, h: l.h };
      stage.setPointerCapture(e.pointerId);
      e.preventDefault();
      const snap = (v) => Math.round(v * 2) / 2;
      const move = (ev) => {
        const dx = ((ev.clientX - sx) / rect.width) * 100;
        const dy = ((ev.clientY - sy) / rect.height) * 100;
        if (resize) {
          l.w = Math.max(2, snap(start.w + dx));
          l.h = Math.max(2, snap(start.h + dy));
          if (ev.shiftKey && l.kind !== 'text') l.h = r1((l.w * rect.width) / rect.height * (start.h / start.w) * (rect.height / rect.width));
        } else {
          l.x = Math.max(-40, Math.min(140, snap(start.x + dx)));
          l.y = Math.max(-40, Math.min(140, snap(start.y + dy)));
        }
        Object.assign(target.style, { left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%` });
      };
      const up = () => {
        stage.removeEventListener('pointermove', move);
        stage.removeEventListener('pointerup', up);
        if (start.x !== l.x || start.y !== l.y || start.w !== l.w || start.h !== l.h) {
          changed();
          paintProps();
        }
      };
      stage.addEventListener('pointermove', move);
      stage.addEventListener('pointerup', up);
    });
    stage.tabIndex = 0;
    stage.addEventListener('keydown', (e) => {
      const l = d.layers[current];
      if (!l || !canEdit || e.target !== stage) return;
      const step = e.shiftKey ? 5 : 0.5;
      const keys = { ArrowLeft: ['x', -step], ArrowRight: ['x', step], ArrowUp: ['y', -step], ArrowDown: ['y', step] };
      if (keys[e.key]) {
        e.preventDefault();
        l[keys[e.key][0]] = r1(l[keys[e.key][0]] + keys[e.key][1]);
        changed();
        paintStage();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        d.layers.splice(current, 1);
        current = Math.min(current, d.layers.length - 1);
        changed({ structure: true });
        paintAll();
      }
    });

    function paintProps() {
      props.innerHTML = '';
      const l = d.layers[current];
      if (!l) {
        const bgf = h('div', 'be-field');
        bgf.innerHTML = `<span class="be-label">${te('Hintergrundbild')}</span>`;
        bgf.appendChild(mediaField('image', d.backgroundImage, (v) => {
          if (v) d.backgroundImage = v;
          else delete d.backgroundImage;
          changed();
          paintAll();
        }));
        props.appendChild(bgf);
        props.appendChild(field('alt', TYPES.canvas.spec.alt, d, 'data.alt', b));
        props.insertAdjacentHTML('beforeend', `<p class="muted small">${te('Element anklicken, um es zu bearbeiten. Pfeiltasten verschieben, Umschalt + Pfeil in großen Schritten, Entf löscht.')}</p>`);
        return;
      }
      const head = h('div', 'be-cv-head');
      head.innerHTML = `<b>${te({ text: 'Text', image: 'Bild', shape: 'Form', button: 'Knopf' }[l.kind])} ${current + 1}</b>`;
      const tools = h('div', 'be-cv-tools');
      const tool = (label, ic, fn, dis) => {
        const x = h('button', 'icon-btn small');
        x.type = 'button';
        x.title = label;
        x.setAttribute('aria-label', label);
        x.innerHTML = svg(ic);
        x.disabled = !!dis;
        x.onclick = fn;
        tools.appendChild(x);
      };
      tool(t('Nach hinten'), UI.down, () => {
        [d.layers[current - 1], d.layers[current]] = [d.layers[current], d.layers[current - 1]];
        current--;
        changed({ structure: true });
        paintAll();
      }, current === 0);
      tool(t('Nach vorn'), UI.up, () => {
        [d.layers[current + 1], d.layers[current]] = [d.layers[current], d.layers[current + 1]];
        current++;
        changed({ structure: true });
        paintAll();
      }, current === d.layers.length - 1);
      tool(t('Duplizieren'), UI.copy, () => {
        d.layers.splice(current + 1, 0, { ...clone(l), x: r1(l.x + 3), y: r1(l.y + 3) });
        current++;
        changed({ structure: true });
        paintAll();
      }, d.layers.length >= 40);
      tool(t('Löschen'), UI.trash, () => {
        d.layers.splice(current, 1);
        current = Math.min(current, d.layers.length - 1);
        changed({ structure: true });
        paintAll();
      });
      head.appendChild(tools);
      props.appendChild(head);
      const grid = h('div', 'be-cv-grid');
      const num = (key, label, min, max, step = 0.5) => {
        const f = h('label', 'be-cv-num');
        f.innerHTML = `<span>${te(label)}</span><input class="input num" type="number" min="${min}" max="${max}" step="${step}" value="${l[key] ?? ''}">`;
        f.querySelector('input').oninput = (e) => {
          if (e.target.value === '') return;
          l[key] = Number(e.target.value);
          changed();
          paintStage();
        };
        grid.appendChild(f);
      };
      num('x', 'X %', -50, 150);
      num('y', 'Y %', -50, 150);
      num('w', 'Breite %', 1, 200);
      num('h', 'Höhe %', 1, 200);
      num('rotate', 'Drehung °', -180, 180, 1);
      props.appendChild(grid);
      const color = (key, label, def) => {
        const c = h('label', 'be-color');
        c.innerHTML = `<input type="color" value="${esc(l[key] || def)}"><span>${te(label)}</span>`;
        c.querySelector('input').oninput = (e) => ((l[key] = e.target.value), changed(), paintStage());
        return c;
      };
      const segOf = (key, opts, def) => {
        const s2 = h('div', 'segmented be-seg');
        opts.forEach(([v, lab]) => {
          const x = h('button', (l[key] || def) === v ? 'is-on' : '');
          x.type = 'button';
          x.textContent = t(lab);
          x.onclick = () => {
            l[key] = v;
            changed();
            paintStage();
            s2.querySelectorAll('button').forEach((y) => y.classList.toggle('is-on', y === x));
          };
          s2.appendChild(x);
        });
        return s2;
      };
      if (l.kind === 'text' || l.kind === 'button') {
        const tf = h('div', 'be-field');
        tf.innerHTML = `<label class="be-label">${te('Text')}<span class="be-req">*</span></label>`;
        const ta = h('textarea', 'input');
        ta.rows = 2;
        ta.maxLength = 600;
        ta.value = l.text || '';
        ta.oninput = () => ((l.text = ta.value), changed(), paintStage());
        tf.appendChild(ta);
        props.appendChild(tf);
        const row = h('div', 'be-cv-row');
        num('size', 'Schriftgröße', 8, 160, 1);
        row.append(segOf('weight', [['regular', 'Normal'], ['bold', 'Fett']], 'regular'), segOf('align', [['left', 'Links'], ['center', 'Mitte'], ['right', 'Rechts']], l.kind === 'button' ? 'center' : 'left'), color('color', 'Schrift', l.kind === 'button' ? '#ffffff' : '#111111'));
        props.appendChild(row);
      }
      if (l.kind !== 'image') {
        const row = h('div', 'be-cv-row');
        row.appendChild(color('fill', l.kind === 'text' ? 'Fläche' : 'Farbe', l.kind === 'button' ? '#1d2230' : '#b3312c'));
        if (l.kind !== 'text') row.appendChild(segOf('shape', l.kind === 'button' ? [['rect', 'Eckig'], ['round', 'Rund']] : [['rect', 'Eckig'], ['round', 'Abgerundet'], ['circle', 'Kreis']], l.kind === 'button' ? 'round' : 'rect'));
        if (l.kind === 'text' && l.fill) {
          const x = h('button', 'btn small ghost');
          x.type = 'button';
          x.textContent = t('Ohne Fläche');
          x.onclick = () => (delete l.fill, changed(), paintAll());
          row.appendChild(x);
        }
        props.appendChild(row);
      }
      if (l.kind === 'image') {
        const f = h('div', 'be-field');
        f.innerHTML = `<span class="be-label">${te('Bild')}</span>`;
        f.appendChild(mediaField('image', l.image, (v) => ((l.image = v), changed(), paintAll())));
        props.appendChild(f);
        props.appendChild(field('alt', { t: 'text', max: 300 }, l, `data.layers[${current}].alt`, b));
      }
      const op = h('label', 'be-cv-range');
      op.innerHTML = `<span>${te('Deckkraft')}</span><input type="range" min="0" max="100" value="${l.opacity ?? 100}">`;
      op.querySelector('input').oninput = (e) => ((l.opacity = Number(e.target.value)), changed(), paintStage());
      props.appendChild(op);
      if (l.kind === 'button') {
        props.appendChild(field('reveal', { t: 'text', max: 600 }, l, `data.layers[${current}].reveal`, b));
        props.appendChild(field('link', { t: 'url' }, l, `data.layers[${current}].link`, b));
        props.insertAdjacentHTML('beforeend', `<p class="muted small">${te('Mit Adresse öffnet der Knopf einen Link, sonst zeigt er den Text an.')}</p>`);
      }
    }

    function paintAll() {
      paintBar();
      paintStage();
      paintProps();
    }
    paintAll();
    return wrap;
  }

  function narrationRow(b) {
    const det = h('details', 'be-narration');
    if (b.narration) det.open = true;
    det.innerHTML = `<summary>${svg(UI.mic)}${te('Vertonung')}${b.narration ? ` <span class="badge">${te('Audio')}</span>` : ''}</summary>`;
    const inner = h('div', 'be-narration-body');
    inner.appendChild(Object.assign(h('p', 'muted small'), { textContent: t('Eine Audiodatei, die Lernende zu diesem Block abspielen können (zum Beispiel ein gesprochener Text).') }));
    inner.appendChild(
      mediaField('audio', b.narration, (v) => {
        if (v) b.narration = v;
        else delete b.narration;
        changed();
        rerenderCard(b.id);
      })
    );
    det.appendChild(inner);
    return det;
  }

  function richText(value, onInput, { min = 64 } = {}) {
    const wrap = h('div', 'be-rte');
    const bar = h('div', 'be-rte-bar');
    const area = h('div', 'be-rte-area');
    area.contentEditable = canEdit ? 'true' : 'false';
    area.innerHTML = value;
    area.style.minHeight = `${min}px`;
    const cmd = (c, arg) => {
      area.focus();
      document.execCommand(c, false, arg);
      onInput(area.innerHTML);
    };
    const tools = [
      ['bold', t('Fett'), () => cmd('bold')],
      ['italic', t('Kursiv'), () => cmd('italic')],
      ['underline', t('Unterstrichen'), () => cmd('underline')],
      ['h', t('Zwischenüberschrift'), () => cmd('formatBlock', document.queryCommandValue('formatBlock') === 'h3' ? 'p' : 'h3')],
      ['ul', t('Aufzählung'), () => cmd('insertUnorderedList')],
      ['ol', t('Nummerierte Liste'), () => cmd('insertOrderedList')],
      [
        'link',
        t('Link'),
        () => {
          const range = window.getSelection().rangeCount ? window.getSelection().getRangeAt(0) : null;
          dialog({
            title: t('Link einfügen'),
            body: `<div class="field"><label for="lk">${te('Adresse')}</label><input class="input" id="lk" type="url" placeholder="https://"></div>`,
            actions: [
              { label: t('Abbrechen'), kind: 'ghost' },
              {
                label: t('Einfügen'),
                kind: 'primary',
                handler: (d) => {
                  const u = d.querySelector('#lk').value.trim();
                  if (!/^(https:\/\/|mailto:)/i.test(u)) {
                    toast(t('Nur https- oder mailto-Adressen.'), 'error');
                    return true;
                  }
                  area.focus();
                  if (range) {
                    const s = window.getSelection();
                    s.removeAllRanges();
                    s.addRange(range);
                  }
                  if (range && !range.collapsed) cmd('createLink', u);
                  else cmd('insertHTML', `<a href="${esc(u)}">${esc(u)}</a>`);
                }
              }
            ]
          });
        }
      ],
      ['clear', t('Formatierung entfernen'), () => cmd('removeFormat')]
    ];
    for (const [ic, label, fn] of tools) {
      const btn = h('button', 'be-rte-btn');
      btn.type = 'button';
      btn.innerHTML = svg(UI[ic]);
      btn.title = label;
      btn.setAttribute('aria-label', label);
      btn.onmousedown = (e) => e.preventDefault();
      btn.onclick = fn;
      bar.appendChild(btn);
    }
    area.addEventListener('input', () => onInput(area.innerHTML));
    area.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });
    area.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        cmd({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]);
      }
    });
    if (canEdit) wrap.appendChild(bar);
    wrap.appendChild(area);
    return wrap;
  }

  // ---------------------------------------------------------------- media
  const mediaUrl = (ref) => `/course-media/${encodeURIComponent(courseId)}/${encodeURIComponent(String(ref || '').replace(/^media:/, ''))}`;
  const extOf = (n) => String(n).split('.').pop().toLowerCase();
  const kindOk = (kind, name) => (MEDIA_EXT[kind] || []).includes(extOf(name));
  const isImg = (name) => MEDIA_EXT.image.includes(extOf(name));

  function mediaField(kind, value, set) {
    const box = h('div', `be-media ${value ? 'has-file' : ''}`);
    if (value) {
      const name = String(value).replace(/^media:/, '');
      box.innerHTML = `${isImg(name) ? `<img src="${esc(mediaUrl(value))}" alt="">` : `<span class="be-media-ic">${svg(kind === 'audio' ? BI.audio : kind === 'video' ? BI.video : BI.file)}</span>`}
        <span class="be-media-name">${esc(name)}</span>`;
      if (kind === 'audio') {
        const a = h('audio');
        a.controls = true;
        a.preload = 'none';
        a.src = mediaUrl(value);
        box.appendChild(a);
      }
      const acts = h('div', 'be-media-acts');
      if (canEdit) {
        const ch = h('button', 'btn small');
        ch.type = 'button';
        ch.textContent = t('Ändern');
        ch.onclick = () => library(kind, set);
        const rm = h('button', 'btn small ghost');
        rm.type = 'button';
        rm.textContent = t('Entfernen');
        rm.onclick = () => set(undefined);
        acts.append(ch, rm);
      }
      box.appendChild(acts);
    } else {
      const drop = h('button', 'be-drop');
      drop.type = 'button';
      drop.innerHTML = `${svg(UI.upload)}<span><b>${te(kind === 'image' ? 'Bild wählen' : kind === 'audio' ? 'Audio wählen' : kind === 'video' ? 'Video wählen' : 'Datei wählen')}</b><small>${te('oder hierher ziehen')} · ${esc(MEDIA_EXT[kind].join(', '))}</small></span>`;
      drop.disabled = !canEdit;
      drop.onclick = () => library(kind, set);
      drop.addEventListener('dragover', (e) => (e.preventDefault(), drop.classList.add('is-over')));
      drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
      drop.addEventListener('drop', async (e) => {
        e.preventDefault();
        drop.classList.remove('is-over');
        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (!kindOk(kind, file.name)) return toast(t('Dieser Dateityp passt hier nicht.'), 'error');
        const saved = await upload(file).catch(fail);
        if (saved) set(saved.ref);
      });
      box.appendChild(drop);
    }
    return box;
  }

  async function upload(file) {
    setStatus('uploading');
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/media`, {
        method: 'POST',
        headers: { 'x-filename': encodeURIComponent(file.name), 'x-csrf-token': state.csrf, 'x-ui-lang': state.lang, 'content-type': file.type || 'application/octet-stream' },
        body: file,
        credentials: 'same-origin'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || t('Hochladen fehlgeschlagen.')), { status: res.status });
      media = [{ ...data, updatedAt: new Date().toISOString() }, ...media.filter((m) => m.name !== data.name)];
      return data;
    } finally {
      setStatus(dirty ? 'pending' : 'saved');
    }
  }

  function library(kind, set) {
    const accept = MEDIA_EXT[kind].map((e) => `.${e}`).join(',');
    const items = () => media.filter((m) => kindOk(kind, m.name));
    const gridHtml = () =>
      items().length
        ? items()
            .map((m) => `<button type="button" class="be-lib-media" data-pick-media="${esc(m.ref)}">${isImg(m.name) ? `<img src="${esc(mediaUrl(m.ref))}" alt="" loading="lazy">` : `<span class="be-media-ic">${svg(kind === 'audio' ? BI.audio : kind === 'video' ? BI.video : BI.file)}</span>`}<span>${esc(m.name)}</span><small>${fmtSize(m.size)}</small></button>`)
            .join('')
        : `<p class="muted">${te('Noch keine passenden Dateien in diesem Kurs.')}</p>`;
    dialog({
      title: t('Mediathek'),
      wide: true,
      body: `<label class="be-upload"><input type="file" id="mf" accept="${esc(accept)}" hidden>${svg(UI.upload)}<span><b>${te('Datei hochladen')}</b><small>${esc(MEDIA_EXT[kind].join(', '))}</small></span></label><div class="be-media-grid" id="mg">${gridHtml()}</div>`,
      onOpen: (d, close) => {
        const bind = () =>
          d.querySelectorAll('[data-pick-media]').forEach((b) => {
            b.onclick = () => {
              set(b.dataset.pickMedia);
              close();
            };
          });
        bind();
        d.querySelector('#mf').onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const saved = await upload(file).catch(fail);
          if (saved) {
            set(saved.ref);
            close();
          }
        };
      }
    });
  }

  // ---------------------------------------------------------------- issues
  function markIssues(b, card) {
    card = card || body.querySelector(`[data-card="${cssId(b.id)}"]`);
    if (!card) return;
    card.querySelectorAll('.be-err').forEach((x) => x.remove());
    card.querySelectorAll('.is-invalid').forEach((x) => x.classList.remove('is-invalid'));
    if (!b.issues) return;
    const left = [];
    for (const msg of b.issues) {
      const m = msg.match(/^([^:]+):\s*(.*)$/);
      const path = m ? m[1].trim() : '';
      const text = m ? m[2] : msg;
      let target = null;
      if (path) {
        let p = path.replace(/\.correct$/, '.options');
        while (p && !(target = card.querySelector(`[data-path="${cssAttr(p)}"]`))) {
          const up = p.replace(/(\.[^.[\]]+|\[\d+\])$/, '');
          if (up === p) break;
          p = up;
        }
      }
      if (target && target !== card) {
        target.classList.add('is-invalid');
        const e = h('span', 'be-err');
        e.textContent = text;
        target.appendChild(e);
      } else left.push(text);
    }
    if (left.length) {
      const e = h('p', 'be-err be-err-block');
      e.textContent = left.join(' ');
      card.querySelector('[data-body]')?.prepend(e);
    }
  }

  // ---------------------------------------------------------------- change tracking, history, saving
  function changed({ structure = false } = {}) {
    if (!canEdit) return;
    const now = Date.now();
    if (structure || now - lastChange > 1200) {
      undo.push(baseline);
      if (undo.length > 80) undo.shift();
      redo.length = 0;
    }
    baseline = JSON.stringify(blocks);
    lastChange = structure ? 0 : now;
    dirty = true;
    setStatus('pending');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, structure ? 250 : 800);
    if (structure) paintSide();
    updateUndoButtons();
  }

  let outlineTimer = null;
  function refreshOutlineSoon() {
    clearTimeout(outlineTimer);
    outlineTimer = setTimeout(() => {
      if (side === 'outline') paintSide();
    }, 500);
  }

  function doUndo() {
    if (!undo.length) return;
    redo.push(JSON.stringify(blocks));
    blocks = JSON.parse(undo.pop());
    afterHistory();
  }
  function doRedo() {
    if (!redo.length) return;
    undo.push(JSON.stringify(blocks));
    blocks = JSON.parse(redo.pop());
    afterHistory();
  }
  function afterHistory() {
    baseline = JSON.stringify(blocks);
    lastChange = 0;
    if (sel && !blocks.some((b) => b.id === sel)) sel = blocks[0]?.id || null;
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 250);
    setStatus('pending');
    if (tab === 'content') {
      paintCanvas();
      paintSide();
    }
    updateUndoButtons();
  }
  function updateUndoButtons() {
    const u = el.querySelector('#be-undo');
    const r = el.querySelector('#be-redo');
    if (u) u.disabled = !undo.length;
    if (r) r.disabled = !redo.length;
  }

  async function saveNow() {
    if (saving) {
      again = true;
      return;
    }
    saving = true;
    dirty = false;
    setStatus('saving');
    try {
      const sent = JSON.stringify(blocks);
      const res = await api(`/courses/${courseId}/blocks`, { method: 'PUT', body: { blocks: JSON.parse(sent), draft: true, expectedUpdatedAt: updatedAt } });
      updatedAt = res.updatedAt;
      const byId = Object.fromEntries(res.blocks.map((b) => [b.id, b]));
      let issueChange = false;
      for (const b of blocks) {
        const srv = byId[b.id];
        const before = JSON.stringify(b.issues || null);
        if (srv && srv.issues) b.issues = srv.issues;
        else delete b.issues;
        if (before !== JSON.stringify(b.issues || null)) {
          issueChange = true;
          const card = body.querySelector(`[data-card="${cssId(b.id)}"]`);
          if (card) {
            card.classList.toggle('has-issue', !!b.issues);
            const pill = card.querySelector('.be-issue-pill');
            if (b.issues && !pill) {
              const html = `<span class="be-issue-pill">${svg(UI.warn)}${te('unvollständig')}</span>`;
              const acts = card.querySelector('.be-card-actions');
              if (acts) acts.insertAdjacentHTML('beforebegin', html);
              else card.querySelector('[data-head]').insertAdjacentHTML('beforeend', html);
            }
            if (!b.issues && pill) pill.remove();
            markIssues(b, card);
          }
        }
      }
      baseline = JSON.stringify(blocks);
      if (issueChange && side === 'outline') paintSide();
      setStatus(dirty ? 'pending' : blocks.some((b) => b.issues) ? 'issues' : 'saved');
      reloadPreview();
    } catch (err) {
      dirty = true;
      if (err.status === 409) {
        setStatus('conflict');
        dialog({
          title: t('Jemand anderes hat gespeichert'),
          body: `<p>${te('Der Kurs wurde inzwischen an anderer Stelle geändert (zum Beispiel über Claude). Neu laden übernimmt den aktuellen Stand; deine letzten Änderungen hier gehen dabei verloren.')}</p>`,
          actions: [
            { label: t('Später'), kind: 'ghost' },
            { label: t('Neu laden'), kind: 'primary', handler: () => ctx.render() }
          ]
        });
      } else {
        setStatus('error');
        fail(err);
      }
    } finally {
      saving = false;
      if (again) {
        again = false;
        saveNow();
      }
    }
  }

  function flushKeepalive() {
    try {
      fetch(`/api/courses/${encodeURIComponent(courseId)}/blocks`, {
        method: 'PUT',
        keepalive: true,
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-csrf-token': state.csrf },
        body: JSON.stringify({ blocks, draft: true, expectedUpdatedAt: updatedAt })
      });
    } catch {
      /* ignore */
    }
  }

  function setStatus(s) {
    const map = {
      saved: ['ok', t('Gespeichert')],
      pending: ['', t('Ungespeichert …')],
      saving: ['', t('Speichert …')],
      uploading: ['', t('Lädt hoch …')],
      issues: ['warn', t('Gespeichert · {n} unvollständig', { n: blocks.filter((b) => b.issues).length })],
      error: ['err', t('Nicht gespeichert')],
      conflict: ['err', t('Konflikt')]
    };
    const [cls, txt] = map[s] || map.saved;
    statusEl.className = `be-status ${cls}`;
    statusEl.textContent = canEdit ? txt : t('Nur lesen');
  }

  // ---------------------------------------------------------------- preview
  function previewHtml() {
    return `<aside class="be-preview" id="be-preview">
      <div class="be-preview-bar">
        <div class="segmented" role="group" aria-label="${te('Gerät')}">
          ${Object.keys(DEVICES).map((k) => `<button type="button" data-device="${k}" class="${device === k ? 'is-on' : ''}" title="${te({ desktop: 'Desktop', tablet: 'Tablet', mobile: 'Smartphone' }[k])}" aria-label="${te({ desktop: 'Desktop', tablet: 'Tablet', mobile: 'Smartphone' }[k])}">${svg(UI[k])}</button>`).join('')}
        </div>
        <span class="be-preview-label">${te('Live-Vorschau')}</span>
        <a class="icon-btn" href="/live/${esc(courseId)}" target="_blank" rel="noopener" title="${te('In neuem Tab öffnen')}" aria-label="${te('In neuem Tab öffnen')}">${svg(UI.ext)}</a>
      </div>
      <div class="be-stage" id="be-stage"><div class="be-device" id="be-device"><iframe id="be-frame" title="${te('Live-Vorschau')}" src="/live/${esc(courseId)}"></iframe></div></div>
    </aside>`;
  }

  function bindPreview() {
    const p = body.querySelector('#be-preview');
    if (!p) return;
    p.querySelectorAll('[data-device]').forEach((b) => {
      b.onclick = () => {
        device = b.dataset.device;
        save_('pp-be-device', device);
        p.querySelectorAll('[data-device]').forEach((x) => x.classList.toggle('is-on', x === b));
        fit();
      };
    });
    const stageEl = p.querySelector('#be-stage');
    const dev = p.querySelector('#be-device');
    const frame = p.querySelector('#be-frame');
    function fit() {
      const w = DEVICES[device];
      const availW = stageEl.clientWidth - 24;
      const availH = stageEl.clientHeight - 24;
      const scale = Math.min(1, availW / w);
      frame.style.width = `${w}px`;
      frame.style.height = `${Math.max(300, availH / scale)}px`;
      frame.style.transform = `scale(${scale})`;
      dev.style.width = `${w * scale}px`;
      dev.style.height = `${Math.max(300, availH)}px`;
      dev.dataset.device = device;
    }
    new ResizeObserver(() => fit()).observe(stageEl);
    fit();
  }

  let reloadTimer = null;
  function reloadPreview() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      const f = el.querySelector('#be-frame');
      if (f) f.contentWindow?.location.reload();
    }, 150);
  }
  function gotoPreview(id) {
    const f = el.querySelector('#be-frame');
    if (f && f.contentWindow) f.contentWindow.postMessage({ type: 'pp-goto', blockId: id }, location.origin);
  }

  // ---------------------------------------------------------------- design tab
  function paintDesign() {
    const c = body.querySelector('#be-design');
    const th = design.theme;
    const presets = catalog.presets;
    c.innerHTML = `<div class="be-design">
      <section class="be-sec"><h2>${te('Player-Design')}</h2><p class="muted small">${te('Wie Lernende sich durch den Kurs bewegen.')}</p>
        <div class="be-designs">${catalog.designs
          .map((k) => `<button type="button" class="be-design-card ${design.player === k ? 'is-on' : ''}" data-player="${k}"><svg viewBox="0 0 80 40" class="be-design-art" aria-hidden="true">${DESIGN_ART[k] || ''}</svg><b>${te(DESIGN_INFO[k]?.[0] || k)}</b><small>${te(DESIGN_INFO[k]?.[1] || '')}</small></button>`)
          .join('')}</div></section>
      <section class="be-sec"><h2>${te('Farben')}</h2>
        <div class="be-swatches">${Object.entries(presets)
          .map(([k, v]) => `<button type="button" class="be-swatch ${th.preset === k ? 'is-on' : ''}" data-preset="${k}" title="${esc(k)}" aria-label="${esc(k)}"><span style="background:${esc(v.primary)}"></span><span style="background:${esc(v.accent)}"></span></button>`)
          .join('')}<button type="button" class="be-swatch is-custom ${th.preset === 'custom' ? 'is-on' : ''}" data-preset="custom">${te('Eigene')}</button></div>
        <div class="be-colors ${th.preset === 'custom' ? '' : 'is-dim'}">
          ${[['primary', 'Hauptfarbe'], ['accent', 'Akzent'], ['background', 'Hintergrund']].map(([k, l]) => `<label class="be-color"><input type="color" data-color="${k}" value="${esc(th[k])}"><span>${te(l)}</span><code>${esc(th[k])}</code></label>`).join('')}
        </div>
        <div class="be-row2"><span class="be-label">${te('Modus')}</span>${seg('mode', th.mode, [['light', 'Hell'], ['dark', 'Dunkel']])}</div>
      </section>
      <section class="be-sec"><h2>${te('Schrift und Form')}</h2>
        <div class="be-row2"><label class="be-label" for="dz-font">${te('Schriftart')}</label><select class="input" id="dz-font">${catalog.fonts.map((f) => `<option ${f === th.font ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></div>
        <div class="be-row2"><span class="be-label">${te('Schriftgröße')}</span>${seg('fontSize', th.fontSize, [['small', 'Klein'], ['medium', 'Mittel'], ['large', 'Groß']])}</div>
        <div class="be-row2"><span class="be-label">${te('Ecken')}</span>${seg('radius', th.radius, [['sharp', 'Eckig'], ['rounded', 'Abgerundet'], ['pill', 'Rund']])}</div>
        <div class="be-row2"><span class="be-label">${te('Leserichtung')}</span>${seg('direction', design.direction, [['ltr', 'Links → rechts'], ['rtl', 'Rechts → links']])}</div>
      </section>
      <section class="be-sec"><h2>${te('Titelseite')}</h2>
        <label class="be-switch"><input type="checkbox" id="dz-cover" ${design.cover.show !== false ? 'checked' : ''}><span class="be-switch-ui"></span>${te('Titelseite vor dem Kurs zeigen')}</label>
        <div class="be-field"><span class="be-label">${te('Titelbild')}</span><div id="dz-cover-img"></div></div>
        <div class="form-grid two"><div class="be-field"><label class="be-label" for="dz-kicker">${te('Dachzeile')}</label><input class="input" id="dz-kicker" maxlength="60" value="${esc(design.cover.kicker || '')}" placeholder="${te('z. B. Service-Akademie')}"></div>
        <div class="be-field"><label class="be-label" for="dz-duration">${te('Dauer')}</label><input class="input" id="dz-duration" maxlength="40" value="${esc(design.cover.duration || '')}" placeholder="${te('z. B. 25 Minuten')}"></div></div>
        <div class="be-field"><span class="be-label">${te('Logo')}</span><div id="dz-logo"></div></div>
      </section>
      <section class="be-sec"><h2>${te('Abschluss')}</h2>
        <div class="be-field"><label class="be-label" for="dz-msg">${te('Abschlussmeldung')}</label><textarea class="input" id="dz-msg" maxlength="600" rows="2" placeholder="${te('z. B. Stark! Du bist bereit für den Schalter.')}">${esc(design.completion.message || '')}</textarea></div>
        <div class="form-grid two"><div class="be-field"><label class="be-label" for="dz-next">${te('Weiter-Link (optional)')}</label><input class="input" id="dz-next" type="url" placeholder="https://" value="${esc(design.completion.nextUrl || '')}"></div>
        <div class="be-field"><label class="be-label" for="dz-nextl">${te('Beschriftung des Links')}</label><input class="input" id="dz-nextl" maxlength="60" value="${esc(design.completion.nextLabel || '')}"></div></div>
        <label class="be-switch"><input type="checkbox" id="dz-restart" ${design.completion.restart !== false ? 'checked' : ''}><span class="be-switch-ui"></span>${te('„Von vorn beginnen“ anbieten')}</label>
      </section>
      <details class="be-sec be-labels"><summary><h2>${te('Beschriftungen im Player')}</h2></summary>
        <p class="muted small">${te('Leer lassen für den Standardtext in der Kurssprache.')}</p>
        <div class="form-grid two">${LABEL_KEYS.map((k) => `<div class="be-field"><label class="be-label" for="dl-${k}">${esc(k)}</label><input class="input" id="dl-${k}" data-label="${k}" maxlength="200" value="${esc(design.labels?.[k] || '')}"></div>`).join('')}</div>
      </details>
    </div>`;
    const put = debounce(async (patch) => {
      setStatus('saving');
      try {
        const res = await api(`/courses/${courseId}/design`, { method: 'PUT', body: patch });
        design = res.design;
        updatedAt = res.updatedAt;
        setStatus(blocks.some((b) => b.issues) ? 'issues' : 'saved');
        reloadPreview();
      } catch (err) {
        setStatus('error');
        fail(err);
      }
    }, 350);
    const send = (patch, repaint) => {
      if (!canEdit) return;
      Object.assign(design, patch, patch.theme ? { theme: { ...design.theme, ...patch.theme } } : {}, patch.cover ? { cover: { ...design.cover, ...patch.cover } } : {}, patch.completion ? { completion: { ...design.completion, ...patch.completion } } : {});
      setStatus('pending');
      put(clone({ ...design }));
      if (repaint) paintDesign();
    };
    c.querySelectorAll('[data-player]').forEach((b) => (b.onclick = () => send({ player: b.dataset.player }, true)));
    c.querySelectorAll('[data-preset]').forEach((b) => {
      b.onclick = () => {
        const p = b.dataset.preset;
        send({ theme: p === 'custom' ? { preset: 'custom' } : { preset: p, ...presets[p] } }, true);
      };
    });
    c.querySelectorAll('[data-color]').forEach((inp) => {
      inp.oninput = () => {
        inp.parentElement.querySelector('code').textContent = inp.value;
        const k = inp.dataset.color;
        const patch = { [k]: inp.value };
        if (k !== 'background') patch.preset = 'custom';
        send({ theme: patch });
        if (k !== 'background') {
          c.querySelectorAll('[data-preset]').forEach((x) => x.classList.toggle('is-on', x.dataset.preset === 'custom'));
          c.querySelector('.be-colors').classList.remove('is-dim');
        }
      };
    });
    c.querySelectorAll('[data-seg]').forEach((g) => {
      g.querySelectorAll('button').forEach((b) => {
        b.onclick = () => {
          g.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
          const k = g.dataset.seg;
          send(k === 'direction' ? { direction: b.dataset.v } : { theme: { [k]: b.dataset.v } });
        };
      });
    });
    c.querySelector('#dz-font').onchange = (e) => send({ theme: { font: e.target.value } });
    c.querySelector('#dz-cover').onchange = (e) => send({ cover: { show: e.target.checked } });
    c.querySelector('#dz-restart').onchange = (e) => send({ completion: { restart: e.target.checked } });
    c.querySelector('#dz-kicker').oninput = (e) => send({ cover: { kicker: e.target.value } });
    c.querySelector('#dz-duration').oninput = (e) => send({ cover: { duration: e.target.value } });
    c.querySelector('#dz-msg').oninput = (e) => send({ completion: { message: e.target.value } });
    c.querySelector('#dz-nextl').oninput = (e) => send({ completion: { nextLabel: e.target.value } });
    c.querySelector('#dz-next').onchange = (e) => {
      const v = e.target.value.trim();
      if (v && !/^https:\/\//i.test(v)) return toast(t('Nur https-Adressen.'), 'error');
      send({ completion: { nextUrl: v } });
    };
    c.querySelectorAll('[data-label]').forEach((inp) => {
      inp.oninput = () => {
        const labels = {};
        c.querySelectorAll('[data-label]').forEach((x) => x.value.trim() && (labels[x.dataset.label] = x.value.trim()));
        send({ labels });
      };
    });
    c.querySelector('#dz-cover-img').appendChild(mediaField('image', design.cover.image, (v) => send({ cover: { image: v || null } }, true)));
    c.querySelector('#dz-logo').appendChild(mediaField('image', design.logo, (v) => send({ logo: v || null }, true)));
    if (!canEdit) c.querySelectorAll('input, select, textarea, button').forEach((x) => (x.disabled = true));
  }

  function seg(key, cur, opts) {
    return `<div class="segmented be-seg" data-seg="${key}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${cur === v ? 'is-on' : ''}">${te(l)}</button>`).join('')}</div>`;
  }

  // ---------------------------------------------------------------- settings tab
  function paintSettings() {
    const c = body.querySelector('#be-settings');
    const s = course.settings;
    const dis = canEdit ? '' : 'disabled';
    const graded = blocks.filter((b) => TYPES[b.type]?.graded).length + blocks.filter((b) => b.type === 'h5p').length;
    c.innerHTML = `<div class="be-settings">
      <section class="panel"><div class="panel-head"><h2>${te('Kurs')}</h2></div>
        <form class="panel-body form-grid" id="st">
          <div class="field"><label for="st-title">${te('Titel')}</label><input class="input" id="st-title" maxlength="200" value="${esc(course.title)}" ${dis}></div>
          <div class="field"><label for="st-desc">${te('Beschreibung')}</label><textarea class="input" id="st-desc" maxlength="4000" ${dis}>${esc(course.description || '')}</textarea><span class="hint">${te('Erscheint auf der Titelseite.')}</span></div>
          <div class="form-grid two">
            <div class="field"><label for="st-lang">${te('Kurssprache')}</label><select class="input" id="st-lang" ${dis}>${langOptions(course.language)}</select></div>
            <div class="field"><label for="st-scorm">${te('SCORM-Version')}</label><select class="input" id="st-scorm" ${dis}><option value="1.2" ${s.scormVersion === '1.2' ? 'selected' : ''}>SCORM 1.2</option><option value="2004" ${s.scormVersion === '2004' ? 'selected' : ''}>SCORM 2004 (4th Ed.)</option></select></div>
          </div>
          <div class="form-grid two">
            <div class="field"><label for="st-nav">${te('Navigation')}</label><select class="input" id="st-nav" ${dis}>
              <option value="free" ${s.navigation === 'free' ? 'selected' : ''}>${te('frei – alles jederzeit')}</option>
              <option value="linear" ${s.navigation === 'linear' ? 'selected' : ''}>${te('geführt – erst nach erledigter Aufgabe weiter')}</option></select></div>
            <div class="field"><label for="st-mastery">${te('Bestehensgrenze')}</label><input class="input num" id="st-mastery" type="number" min="0" max="100" value="${s.masteryScore}" ${dis}><span class="hint">${graded ? te('Prozent der Punkte aus {n} bewerteten Blöcken', { n: graded }) : te('Ohne bewertete Blöcke gilt der Kurs als abgeschlossen, wenn alle Lektionen gesehen sind.')}</span></div>
          </div>
          ${canEdit ? `<button class="btn primary" type="submit">${te('Speichern')}</button>` : ''}
        </form></section>
      <section class="panel"><div class="panel-head"><h2>${te('Exporte')}</h2><button class="btn accent small" id="st-export">${te('Exportieren')}</button></div>
        ${
          course.exports.length
            ? `<ul class="rows">${course.exports
                .map((x) => `<li class="row"><div><span class="stamp"><b>v${x.version}</b>${esc({ html: 'HTML', scorm2004: 'SCORM 2004', xapi: 'xAPI', cmi5: 'cmi5' }[x.format] || 'SCORM 1.2')}</span><span class="row-meta" style="margin-top:6px"><span>${fmtDate(x.createdAt)}</span><span>${fmtSize(x.size)}</span></span></div>
              <div class="actions"><a class="btn small ghost" href="/exports/${esc(x.id)}/preview">${te('LMS-Vorschau')}</a><a class="btn small" href="/api/exports/${esc(x.id)}/download" download>${te('Herunterladen')}</a></div></li>`)
                .join('')}</ul>`
            : `<p class="panel-body muted">${te('Noch kein Export.')}</p>`
        }</section>
      ${canEdit ? `<section class="panel"><div class="panel-head"><h2>${te('Weitere Aktionen')}</h2></div><div class="panel-body be-inline-actions">
        <button class="btn" id="st-dup">${te('Duplizieren / Sprachfassung')}</button>
        <button class="btn" id="st-tpl">${te('Als Vorlage speichern')}</button>
        <button class="btn danger" id="st-del">${te('Kurs löschen')}</button></div></section>` : ''}
    </div>`;
    c.querySelector('#st-export').onclick = exportDialog;
    c.querySelector('#st')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api(`/courses/${courseId}`, {
          method: 'PATCH',
          body: {
            title: c.querySelector('#st-title').value,
            description: c.querySelector('#st-desc').value,
            language: c.querySelector('#st-lang').value,
            settings: { scormVersion: c.querySelector('#st-scorm').value, navigation: c.querySelector('#st-nav').value, masteryScore: Number(c.querySelector('#st-mastery').value) }
          }
        });
        Object.assign(course, { title: res.title, description: res.description, language: res.language, settings: res.settings });
        updatedAt = res.updatedAt;
        el.querySelector('.be-title').textContent = res.title;
        toast(t('Einstellungen gespeichert.'));
        reloadPreview();
      } catch (err) {
        fail(err);
      }
    });
    c.querySelector('#st-del')?.addEventListener('click', async () => {
      if (!(await confirmDialog(t('Kurs löschen?'), t('„{name}“ mit allen Einheiten und Exporten wird endgültig gelöscht.', { name: course.title })))) return;
      await api(`/courses/${courseId}`, { method: 'DELETE' });
      navigate(`/projects/${course.projectId}`);
    });
    c.querySelector('#st-tpl')?.addEventListener('click', () =>
      dialog({
        title: t('Als Vorlage speichern'),
        body: `<p class="muted">${te('Blöcke, Design und Medien werden kopiert. H5P-Einheiten gehören nicht dazu.')}</p>
          <div class="field"><label for="tn">${te('Name der Vorlage')}</label><input class="input" id="tn" maxlength="120" value="${esc(course.title)}"></div>
          <div class="field"><label for="td">${te('Beschreibung')}</label><input class="input" id="td" maxlength="400" placeholder="${te('Wofür eignet sich die Vorlage?')}"></div>
          ${state.me?.role === 'admin' ? `<label class="check"><input type="checkbox" id="ts">${te('Für alle Konten freigeben')}</label>` : ''}`,
        actions: [
          { label: t('Abbrechen'), kind: 'ghost' },
          {
            label: t('Speichern'),
            kind: 'primary',
            handler: async (d) => {
              await api(`/courses/${courseId}/template`, { method: 'POST', body: { name: d.querySelector('#tn').value, description: d.querySelector('#td').value, shared: !!d.querySelector('#ts')?.checked } });
              toast(t('Vorlage gespeichert. Sie steht beim nächsten neuen Kurs zur Auswahl.'));
            }
          }
        ]
      })
    );
    c.querySelector('#st-dup')?.addEventListener('click', () => {
      const nextLang = course.language === 'de' ? 'en' : 'de';
      dialog({
        title: t('Kurs duplizieren'),
        body: `<p class="muted">${te('Erzeugt eine unabhängige Kopie mit allen Blöcken, Medien und Einheiten – zum Beispiel als Grundlage für eine Sprachfassung.')}</p>
          <div class="field"><label for="dt">${te('Titel der Kopie')}</label><input class="input" id="dt" value="${esc(course.title)} (${nextLang.toUpperCase()})"></div>
          <div class="field"><label for="dl">${te('Sprache der Kopie')}</label><select class="input" id="dl">${langOptions(nextLang)}</select></div>`,
        actions: [
          { label: t('Abbrechen'), kind: 'ghost' },
          {
            label: t('Duplizieren'),
            kind: 'primary',
            handler: async (d) => {
              const copy = await api(`/courses/${courseId}/duplicate`, { method: 'POST', body: { title: d.querySelector('#dt').value, language: d.querySelector('#dl').value } });
              navigate(`/courses/${copy.id}`);
            }
          }
        ]
      });
    });
  }

  // ---------------------------------------------------------------- media tab
  function paintMedia() {
    const c = body.querySelector('#be-media');
    const used = new Set();
    JSON.stringify({ blocks, design }).replace(/"media:([A-Za-z0-9_.-]+)"/g, (_, n) => used.add(n));
    c.innerHTML = `<div class="be-settings">
      <section class="panel"><div class="panel-head"><h2>${te('Mediathek')}</h2><span class="muted small">${te('{n} Dateien', { n: media.length })}</span></div>
        <div class="panel-body">
          ${canEdit ? `<label class="be-upload"><input type="file" id="mu" multiple hidden accept="${esc([...new Set(Object.values(MEDIA_EXT).flat())].map((e) => `.${e}`).join(','))}">${svg(UI.upload)}<span><b>${te('Dateien hochladen')}</b><small>${te('Bilder, Audio, Video, PDF, Untertitel (VTT) und Downloads')}</small></span></label>` : ''}
          <div class="be-media-grid">${media
            .map((m) => `<figure class="be-lib-media is-static">${isImg(m.name) ? `<img src="${esc(mediaUrl(m.ref))}" alt="" loading="lazy">` : `<span class="be-media-ic">${svg(BI.file)}</span>`}<span>${esc(m.name)}</span><small>${fmtSize(m.size)}${used.has(m.name) ? ` · ${te('verwendet')}` : ''}</small></figure>`)
            .join('') || `<p class="muted">${te('Noch keine Dateien.')}</p>`}</div>
        </div></section></div>`;
    c.querySelector('#mu')?.addEventListener('change', async (e) => {
      for (const file of e.target.files) await upload(file).catch(fail);
      paintMedia();
    });
  }

  // ---------------------------------------------------------------- review
  function openComments(blockId) {
    return comments.filter((c) => c.blockId === blockId && c.status === 'open').length;
  }
  function reviewCount() {
    const n = comments.filter((c) => c.status === 'open').length;
    const badge = el.querySelector('#be-review-count');
    if (badge) badge.textContent = n ? String(n) : '';
  }
  async function reloadComments() {
    comments = await api(`/courses/${courseId}/comments`).catch(() => comments);
    reviewCount();
  }

  async function paintReview() {
    const c = body.querySelector('#be-review');
    let links = [];
    try {
      links = await api(`/courses/${courseId}/review-links`);
    } catch (err) {
      fail(err);
    }
    if (!c.isConnected) return;
    const blockOf = (id) => blocks.find((b) => b.id === id);
    const list = comments.filter((x) => commentFilter === 'all' || x.status === commentFilter);
    const counts = { open: comments.filter((x) => x.status === 'open').length, resolved: comments.filter((x) => x.status === 'resolved').length, all: comments.length };
    const thread = (x) => {
      const b = x.blockId ? blockOf(x.blockId) : null;
      return `<article class="be-thread ${x.status === 'resolved' ? 'is-done' : ''}" data-thread="${esc(x.id)}" ${x.blockId ? `data-thread-block="${esc(x.blockId)}"` : ''}>
        <header><b>${esc(x.author)}</b>${x.team ? `<span class="badge">${te('Team')}</span>` : ''}<time>${fmtDate(x.createdAt)}</time></header>
        <button type="button" class="be-thread-ref" ${b ? `data-goto-block="${esc(b.id)}"` : 'disabled'}>${b ? `${svg(BI[b.type] || BI.text, 'be-ic')}<span>${esc(summary(b) || typeLabel(b.type))}</span>` : x.blockId ? te('Block wurde gelöscht') : te('Allgemein zum Kurs')}</button>
        <p>${esc(x.body).replace(/\n/g, '<br>')}</p>
        ${x.replies.map((r) => `<div class="be-reply"><header><b>${esc(r.author)}</b>${r.team ? `<span class="badge">${te('Team')}</span>` : ''}<time>${fmtDate(r.createdAt)}</time></header><p>${esc(r.body).replace(/\n/g, '<br>')}</p></div>`).join('')}
        ${
          canEdit
            ? `<div class="be-thread-actions">
          <form class="be-reply-form" data-reply-form="${esc(x.id)}"><input class="input" maxlength="2000" placeholder="${te('Antworten …')}"><button class="btn small" type="submit">${te('Senden')}</button></form>
          <button class="btn small ${x.status === 'open' ? 'primary' : ''}" data-status="${x.status === 'open' ? 'resolved' : 'open'}" data-cid="${esc(x.id)}">${x.status === 'open' ? `${svg(UI.check)}${te('Erledigt')}` : te('Wieder öffnen')}</button>
          <button class="icon-btn small" data-del-comment="${esc(x.id)}" aria-label="${te('Löschen')}" title="${te('Löschen')}">${svg(UI.trash)}</button></div>`
            : ''
        }
      </article>`;
    };
    c.innerHTML = `<div class="be-review">
      <section class="panel">
        <div class="panel-head"><h2>${te('Review-Links')}</h2>${canEdit ? `<button class="btn small primary" id="rl-new">${svg(UI.plus)}${te('Link erzeugen')}</button>` : ''}</div>
        <div class="panel-body"><p class="muted small">${te('Wer den Link hat, sieht den aktuellen Stand des Kurses ohne Konto und kann einzelne Blöcke kommentieren. Links laufen ab und lassen sich jederzeit sperren.')}</p></div>
        ${
          links.length
            ? `<ul class="rows">${links
                .map(
                  (l) => `<li class="row"><div><span class="row-title">${esc(l.label || t('Review-Link'))}</span><span class="row-meta"><span>${l.active ? te('gültig bis {date}', { date: fmtDate(l.expiresAt) }) : `<span class="badge">${l.revoked ? te('gesperrt') : te('abgelaufen')}</span>`}</span><span>${te('{n} Kommentare', { n: l.comments })}</span></span></div>
                  <div class="actions">${l.active && canEdit ? `<button class="btn small ghost" data-revoke="${esc(l.id)}">${te('Sperren')}</button>` : ''}</div></li>`
                )
                .join('')}</ul>`
            : ''
        }
      </section>
      <section class="be-threads">
        <div class="be-threads-head"><h2>${te('Kommentare')}</h2>
          <div class="segmented" role="group">${[['open', 'Offen'], ['resolved', 'Erledigt'], ['all', 'Alle']].map(([k, l]) => `<button type="button" data-filter="${k}" class="${commentFilter === k ? 'is-on' : ''}">${te(l)} <span class="muted">${counts[k]}</span></button>`).join('')}</div>
        </div>
        ${list.length ? list.slice().reverse().map(thread).join('') : `<div class="be-review-empty">${svg(UI.chat)}<p class="muted">${commentFilter === 'open' ? te('Keine offenen Kommentare.') : te('Noch keine Kommentare.')}</p></div>`}
      </section>
    </div>`;
    c.querySelectorAll('[data-filter]').forEach((b) => (b.onclick = () => ((commentFilter = b.dataset.filter), paintReview())));
    c.querySelectorAll('[data-goto-block]').forEach((b) => {
      b.onclick = () => {
        tab = 'content';
        sel = b.dataset.gotoBlock;
        paint();
        scrollToCard(sel);
      };
    });
    c.querySelector('#rl-new')?.addEventListener('click', () =>
      dialog({
        title: t('Review-Link erzeugen'),
        body: `<div class="field"><label for="rlb">${te('Bezeichnung (optional)')}</label><input class="input" id="rlb" maxlength="80" placeholder="${te('z. B. Fachabteilung Service')}"></div>
          <div class="field"><label for="rld">${te('Gültig für')}</label><select class="input" id="rld"><option value="7">${te('7 Tage')}</option><option value="30" selected>${te('30 Tage')}</option><option value="90">${te('90 Tage')}</option></select></div>`,
        actions: [
          { label: t('Abbrechen'), kind: 'ghost' },
          {
            label: t('Erzeugen'),
            kind: 'primary',
            handler: async (d) => {
              const link = await api(`/courses/${courseId}/review-links`, { method: 'POST', body: { label: d.querySelector('#rlb').value, days: Number(d.querySelector('#rld').value) } });
              dialog({
                title: t('Review-Link'),
                body: `<p class="muted">${te('Der Link wird nur jetzt angezeigt. Kopiere ihn und gib ihn an die Prüfer weiter.')}</p><div class="be-linkbox"><input class="input mono" readonly value="${esc(link.url)}" id="rlu"><button class="btn primary" id="rlc">${te('Kopieren')}</button></div>`,
                onOpen: (dd) => {
                  const inp = dd.querySelector('#rlu');
                  inp.select();
                  dd.querySelector('#rlc').onclick = async () => {
                    try {
                      await navigator.clipboard.writeText(link.url);
                      toast(t('Link kopiert.'));
                    } catch {
                      inp.select();
                    }
                  };
                },
                actions: [{ label: t('Fertig'), kind: 'primary' }]
              });
              paintReview();
            }
          }
        ]
      })
    );
    c.querySelectorAll('[data-revoke]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmDialog(t('Link sperren?'), t('Wer den Link hat, kommt danach nicht mehr in den Kurs. Die Kommentare bleiben erhalten.'), t('Sperren')))) return;
        await api(`/courses/${courseId}/review-links/${b.dataset.revoke}`, { method: 'DELETE' }).catch(fail);
        paintReview();
      };
    });
    c.querySelectorAll('[data-status]').forEach((b) => {
      b.onclick = async () => {
        await api(`/courses/${courseId}/comments/${b.dataset.cid}`, { method: 'PATCH', body: { status: b.dataset.status } }).catch(fail);
        await reloadComments();
        paintReview();
      };
    });
    c.querySelectorAll('[data-del-comment]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmDialog(t('Kommentar löschen?'), t('Der Kommentar und alle Antworten werden entfernt.')))) return;
        await api(`/courses/${courseId}/comments/${b.dataset.delComment}`, { method: 'DELETE' }).catch(fail);
        await reloadComments();
        paintReview();
      };
    });
    c.querySelectorAll('[data-reply-form]').forEach((f) => {
      f.onsubmit = async (e) => {
        e.preventDefault();
        const v = f.querySelector('input').value.trim();
        if (!v) return;
        try {
          await api(`/courses/${courseId}/comments`, { method: 'POST', body: { body: v, parentId: f.dataset.replyForm } });
          await reloadComments();
          paintReview();
        } catch (err) {
          fail(err);
        }
      };
    });
  }

  // ---------------------------------------------------------------- export
  function exportDialog() {
    const open = blocks.filter((b) => b.issues);
    if (open.length) {
      dialog({
        title: t('Noch nicht fertig'),
        body: `<p>${te('{n} Blöcke sind unvollständig. Das Paket kann erst erstellt werden, wenn alle Pflichtfelder ausgefüllt sind.', { n: open.length })}</p>`,
        actions: [
          { label: t('Schließen'), kind: 'ghost' },
          {
            label: t('Zum ersten Block'),
            kind: 'primary',
            handler: () => {
              tab = 'content';
              paint();
              select(open[0].id, { scroll: true });
            }
          }
        ]
      });
      return;
    }
    let format = course.settings.scormVersion === '2004' ? 'scorm2004' : 'scorm12';
    dialog({
      title: t('Paket erstellen'),
      body: `<div class="segmented" role="group" id="xf">${[['scorm12', 'SCORM 1.2'], ['scorm2004', 'SCORM 2004'], ['xapi', 'xAPI'], ['cmi5', 'cmi5'], ['html', 'HTML']].map(([k, l]) => `<button type="button" data-f="${k}" class="${format === k ? 'is-on' : ''}">${l}</button>`).join('')}</div>
        <p class="muted small" style="margin-top:12px">${te('Danach öffnet sich die LMS-Vorschau: Sie zeigt genau, welche Werte das Paket an das LMS sendet.')}</p>`,
      onOpen: (d) =>
        d.querySelectorAll('[data-f]').forEach((b) => {
          b.onclick = () => {
            format = b.dataset.f;
            d.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('is-on', x === b));
          };
        }),
      actions: [
        { label: t('Abbrechen'), kind: 'ghost' },
        {
          label: t('Paket erstellen'),
          kind: 'accent',
          handler: async () => {
            if (dirty || saving) {
              clearTimeout(saveTimer);
              await saveNow();
            }
            const x = await api(`/courses/${courseId}/export`, { method: 'POST', body: { format } });
            location.href = `/exports/${x.id}/preview`;
            return true;
          }
        }
      ]
    });
  }

  // ---------------------------------------------------------------- boot (after all bindings above exist)
  paint();
  updateUndoButtons();
  setStatus(blocks.some((b) => b.issues) ? 'issues' : 'saved');

  // ---------------------------------------------------------------- helpers
  function typeLabel(type) {
    return TYPES[type]?.label || type;
  }
  function idx(id) {
    return blocks.findIndex((b) => b.id === id);
  }
  function summary(b) {
    const d = b.data || {};
    const first =
      d.content || d.question || d.heading || d.title || d.prompt || d.caption || d.name || d.label || d.text ||
      (Array.isArray(d.items) && (typeof d.items[0] === 'string' ? d.items[0] : d.items[0]?.heading || d.items[0]?.title)) ||
      (Array.isArray(d.cards) && d.cards[0]?.front) || (Array.isArray(d.steps) && d.steps[0]?.title) || (Array.isArray(d.tabs) && d.tabs[0]?.title) ||
      (Array.isArray(d.pairs) && d.pairs[0]?.left) || (Array.isArray(d.questions) && `${d.questions.length} ${t('Fragen')}`) ||
      (Array.isArray(d.rows) && d.rows[0]?.join(' · ')) || (b.type === 'h5p' && units.find((u) => u.id === d.unitId)?.title) ||
      (d.image && String(d.image).replace(/^media:/, '')) || (d.file && String(d.file).replace(/^media:/, '')) || d.url || '';
    const s = plain(first);
    return s.length > 90 ? `${s.slice(0, 88)}…` : s;
  }
  function isEmpty(b) {
    return !summary(b) && !Object.keys(b.data || {}).length;
  }
  function placeholderFor(type, name) {
    if (type === 'title' && name === 'content') return t('Titel der Lektion');
    if (name === 'question') return t('Was sollen Lernende beantworten?');
    if (name === 'kicker') return t('z. B. Lektion 1');
    return '';
  }
  function skeleton() {
    const nb = (type, data) => ({ id: newId(), type, data });
    return [
      nb('title', { content: t('Worum es geht'), kicker: t('Lektion 1') }),
      nb('text', { content: `<p>${esc(t('Einstieg: Warum ist das Thema wichtig? Zwei, drei Sätze reichen.'))}</p>` }),
      nb('callout', { variant: 'key', title: t('Merke'), content: `<p>${esc(t('Die wichtigste Botschaft dieser Lektion in einem Satz.'))}</p>` }),
      nb('title', { content: t('So geht es'), kicker: t('Lektion 2') }),
      nb('process', { steps: [{ title: t('Schritt 1') }, { title: t('Schritt 2') }, { title: t('Schritt 3') }] }),
      nb('quiz', { question: t('Welcher Schritt kommt zuerst?'), options: [t('Schritt 1'), t('Schritt 3')], correct: [0], explanation: '' }),
      nb('title', { content: t('Abschluss'), kicker: t('Lektion 3') }),
      nb('assessment', { title: t('Abschlusstest'), passPercent: 70, questions: [{ question: t('Frage 1'), options: [t('Richtig'), t('Falsch')], correct: [0] }] })
    ];
  }
}

// ------------------------------------------------------------------ module helpers
function h(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
function clone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}
function plain(s) {
  const d = document.createElement('div');
  d.innerHTML = String(s ?? '');
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}
function newId() {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return 'b_' + btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function cssId(id) {
  return String(id).replace(/["\\]/g, '\\$&');
}
function cssAttr(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}
function cut(s, n) {
  s = String(s || '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
function debounce(fn, ms) {
  let tm = null;
  return (...a) => {
    clearTimeout(tm);
    tm = setTimeout(() => fn(...a), ms);
  };
}
function autosize(ta) {
  const fit = () => {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight + 2}px`;
  };
  ta.addEventListener('input', fit);
  requestAnimationFrame(fit);
}
function load(k, def) {
  try {
    return localStorage.getItem(k) ?? def;
  } catch {
    return def;
  }
}
function save_(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}
