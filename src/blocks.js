/**
 * Block courses: a course is a flat list of blocks rendered by our own player (src/export/runtime/blocks.js).
 * Lessons start at every "title" block. H5P units of the same course appear through the "h5p" block.
 *
 * This module owns the block catalogue (shared with the editor and MCP), validation/normalisation, the inline
 * HTML sanitiser, course design (player layout, theme, cover, labels) and course media files.
 * Media references inside blocks are tokens "media:<file>" – resolved to URLs by the player.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { kindMatches } from './sniff.js';

export class BlockError extends Error {
  constructor(message, details) {
    super(message);
    this.status = 400;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------------------------- field specs
const T = (max = 400, req = false) => ({ t: 'text', max, req });
const H = (max = 8000, req = false) => ({ t: 'html', max, req });
const M = (kind = 'image', req = false) => ({ t: 'media', kind, req });
const U = (req = false) => ({ t: 'url', req });
const E = (opts, def) => ({ t: 'enum', opts, def });
const N = (min, max, def, int = true) => ({ t: 'num', min, max, def, int });
const B = (def = false) => ({ t: 'bool', def });
const L = (of, min = 0, max = 50) => ({ t: 'list', of, min, max });
const O = (fields, req = false) => ({ t: 'obj', fields, req });

const QUESTION = {
  question: T(600, true),
  options: L(T(300, true), 2, 8),
  correct: L(N(0, 7, 0), 1, 8),
  multiple: B(false),
  explanation: T(1200)
};

/**
 * Block catalogue. label/desc in German and English; `graded` blocks report a score; `example` is valid data
 * (used by the editor's "insert" and by the MCP guide).
 */
export const BLOCK_TYPES = {
  // ------------------------------------------------------------------ content
  title: { cat: 'content', de: ['Titel', 'Lektionsüberschrift, beginnt eine neue Lektion'], en: ['Title', 'Lesson heading, starts a new lesson'],
    fields: { content: T(200, true), kicker: T(60), image: M('image') }, example: { content: 'Neue Lektion' } },
  subtitle: { cat: 'content', de: ['Zwischentitel', 'Abschnitt innerhalb einer Lektion'], en: ['Subtitle', 'Section heading inside a lesson'],
    fields: { content: T(200, true) }, example: { content: 'Abschnitt' } },
  text: { cat: 'content', de: ['Text', 'Absätze mit Fett, Kursiv und Links'], en: ['Text', 'Paragraphs with bold, italic and links'],
    fields: { content: H(20000, true) }, example: { content: '<p>Text</p>' } },
  list: { cat: 'content', de: ['Aufzählung', 'Punkte ohne Reihenfolge'], en: ['Bullet list', 'Unordered points'],
    fields: { items: L(T(500, true), 1, 40) }, example: { items: ['Erster Punkt', 'Zweiter Punkt'] } },
  numberedList: { cat: 'content', de: ['Nummerierte Liste', 'Schritte in Reihenfolge'], en: ['Numbered list', 'Ordered steps'],
    fields: { items: L(T(500, true), 1, 40) }, example: { items: ['Schritt eins', 'Schritt zwei'] } },
  callout: { cat: 'content', de: ['Hinweisbox', 'Wichtiges hervorheben'], en: ['Callout', 'A note that needs to stand out'],
    fields: { variant: E(['info', 'tip', 'warning', 'success', 'key'], 'info'), title: T(120), content: H(4000, true) }, example: { variant: 'key', title: 'Merke', content: '<p>Das Wichtigste in einem Satz.</p>' } },
  quote: { cat: 'content', de: ['Zitat', 'Zitat mit Quelle'], en: ['Quote', 'Pull quote with attribution'],
    fields: { content: T(1000, true), author: T(160), image: M('image') }, example: { content: 'Ein gutes Zitat.', author: 'Name, Rolle' } },
  statement: { cat: 'content', de: ['Statement', 'Eine Aussage, volle Breite'], en: ['Statement', 'One line, full width'],
    fields: { content: T(400, true), style: E(['accent', 'plain', 'dark'], 'accent') }, example: { content: 'Eine starke Aussage.' } },
  accordion: { cat: 'content', de: ['Akkordeon', 'Aufklappbare Abschnitte'], en: ['Accordion', 'Collapsible panels'],
    fields: { items: L(O({ heading: T(200, true), content: H(8000, true) }), 1, 20) }, example: { items: [{ heading: 'Frage', content: '<p>Antwort</p>' }] } },
  tabs: { cat: 'content', de: ['Tabs', 'Umschaltbare Bereiche'], en: ['Tabs', 'Switchable panes'],
    fields: { tabs: L(O({ title: T(80, true), content: H(8000, true), image: M('image') }), 2, 8) }, example: { tabs: [{ title: 'A', content: '<p>…</p>' }, { title: 'B', content: '<p>…</p>' }] } },
  timeline: { cat: 'content', de: ['Zeitstrahl', 'Datierte oder aufeinanderfolgende Ereignisse'], en: ['Timeline', 'Dated or sequenced events'],
    fields: { items: L(O({ date: T(60), title: T(160, true), content: H(2000) }), 2, 20) }, example: { items: [{ date: '2024', title: 'Start' }, { date: '2026', title: 'Heute' }] } },
  divider: { cat: 'content', de: ['Trenner', 'Optische Pause'], en: ['Divider', 'Visual break'],
    fields: { label: T(120) }, example: {} },
  process: { cat: 'content', de: ['Prozess', 'Nummerierte Stufen zum Durchklicken'], en: ['Process', 'Numbered stages'],
    fields: { steps: L(O({ title: T(120, true), content: H(2000) }), 2, 12) }, example: { steps: [{ title: 'Planen' }, { title: 'Umsetzen' }] } },
  columns: { cat: 'content', de: ['Zwei Spalten', 'Text nebeneinander'], en: ['Two columns', 'Side-by-side text'],
    fields: { leftTitle: T(120), left: H(6000, true), rightTitle: T(120), right: H(6000, true) }, example: { left: '<p>Links</p>', right: '<p>Rechts</p>' } },
  furtherReading: { cat: 'content', de: ['Weiterlesen', 'Links, öffnen in neuem Tab'], en: ['Further reading', 'Linked resources, opened in a new tab'],
    fields: { title: T(120), links: L(O({ title: T(160, true), url: U(true), description: T(300) }), 1, 20) }, example: { links: [{ title: 'Quelle', url: 'https://example.com' }] } },

  // ------------------------------------------------------------------ media
  imageText: { cat: 'media', de: ['Bild + Text', 'Bild neben Text, links oder rechts'], en: ['Image + text', 'Picture beside copy, either side'],
    fields: { image: M('image', true), alt: T(300), title: T(160), content: H(6000, true), side: E(['left', 'right'], 'left') }, example: null },
  image: { cat: 'media', de: ['Bild', 'Bild mit Bildunterschrift'], en: ['Image', 'Picture with caption'],
    fields: { image: M('image', true), alt: T(300), caption: T(300), size: E(['wide', 'full', 'medium'], 'wide') }, example: null },
  gallery: { cat: 'media', de: ['Galerie', 'Raster oder Karussell'], en: ['Gallery', 'Grid or carousel'],
    fields: { layout: E(['grid', 'carousel'], 'grid'), images: L(O({ image: M('image', true), alt: T(300), caption: T(300) }), 2, 24) }, example: null },
  video: { cat: 'media', de: ['Video', 'Datei, YouTube oder Vimeo'], en: ['Video', 'Uploaded file, YouTube or Vimeo'],
    fields: { file: M('video'), url: U(), poster: M('image'), captions: M('captions'), title: T(160) }, example: null },
  audio: { cat: 'media', de: ['Audio', 'Erzählung oder Aufnahme mit Transkript'], en: ['Audio', 'Narration or a recording with transcript'],
    fields: { file: M('audio', true), title: T(160), transcript: H(10000) }, example: null },
  file: { cat: 'media', de: ['Datei', 'Download für Lernende'], en: ['File attach', 'A download the learner keeps'],
    fields: { file: M('file', true), name: T(160, true), description: T(300) }, example: null },
  banner: { cat: 'media', de: ['Banner', 'Randloses Bild mit Überschrift'], en: ['Banner', 'Full-bleed image band'],
    fields: { image: M('image', true), heading: T(160, true), text: T(400) }, example: null },

  // ------------------------------------------------------------------ interactive
  quiz: { cat: 'interactive', graded: true, de: ['Wissensfrage', 'Eine oder mehrere richtige Antworten'], en: ['Quiz', 'Single or multiple answer'],
    fields: QUESTION, example: { question: 'Frage?', options: ['Richtig', 'Falsch'], correct: [0], explanation: 'Darum.' } },
  flipcard: { cat: 'interactive', de: ['Flipcards', 'Vorderseite Frage, Rückseite Antwort'], en: ['Flip cards', 'Question front, answer back'],
    fields: { cards: L(O({ front: T(400, true), back: T(800, true), image: M('image') }), 1, 20) }, example: { cards: [{ front: 'Begriff', back: 'Erklärung' }] } },
  matching: { cat: 'interactive', graded: true, de: ['Zuordnen', 'Begriffe und Bedeutungen verbinden'], en: ['Matching', 'Pair terms to meanings'],
    fields: { prompt: T(400), pairs: L(O({ left: T(200, true), right: T(300, true) }), 2, 12) }, example: { pairs: [{ left: 'A', right: 'Alpha' }, { left: 'B', right: 'Beta' }] } },
  sorting: { cat: 'interactive', graded: true, de: ['Reihenfolge', 'In die richtige Reihenfolge bringen'], en: ['Sorting', 'Put items in the right order'],
    fields: { prompt: T(400), items: L(T(200, true), 2, 12) }, example: { prompt: 'Bring in die richtige Reihenfolge.', items: ['Erstens', 'Zweitens', 'Drittens'] } },
  fillBlanks: { cat: 'interactive', graded: true, de: ['Lückentext', 'Fehlende Wörter eintippen'], en: ['Fill in the blanks', 'Type the missing word'],
    fields: { prompt: T(400), text: T(3000, true), caseSensitive: B(false) }, example: { text: 'Die Hauptstadt von Frankreich ist [Paris].' } },
  hotspot: { cat: 'interactive', de: ['Hotspots', 'Klickbare Punkte auf einem Bild'], en: ['Hotspot', 'Clickable points on an image'],
    fields: { image: M('image', true), alt: T(300), spots: L(O({ x: N(0, 1, 0.5, false), y: N(0, 1, 0.5, false), title: T(120, true), content: H(2000) }), 1, 20) }, example: null },
  bucketSort: { cat: 'interactive', graded: true, de: ['Kategorien sortieren', 'Begriffe in Gruppen ziehen'], en: ['Bucket sort', 'Drag items into categories'],
    fields: { prompt: T(400), buckets: L(O({ name: T(80, true), items: L(T(120, true), 1, 12) }), 2, 5) }, example: { buckets: [{ name: 'Obst', items: ['Apfel'] }, { name: 'Gemüse', items: ['Möhre'] }] } },
  essay: { cat: 'interactive', de: ['Freitext', 'Längere eigene Antwort mit Musterlösung'], en: ['Essay', 'Long-form written answer'],
    fields: { prompt: T(1000, true), minWords: N(0, 2000, 0), sample: H(6000) }, example: { prompt: 'Beschreibe in eigenen Worten …' } },
  checklist: { cat: 'interactive', de: ['Checkliste', 'Zum Abhaken'], en: ['Checklist', 'Tick off as you go'],
    fields: { title: T(160), items: L(T(300, true), 1, 30) }, example: { items: ['Erledigt'] } },
  assessment: { cat: 'interactive', graded: true, de: ['Abschlusstest', 'Mehrere Fragen, Bestehensgrenze, optional Zeitlimit'], en: ['Assessment', 'Scored, timed, pass mark'],
    fields: { title: T(160), intro: T(1000), questions: L(O(QUESTION), 1, 60), passPercent: N(0, 100, 70), timeLimit: N(0, 240, 0), shuffle: B(false), showReview: B(true) },
    example: { title: 'Abschlusstest', questions: [{ question: 'Frage?', options: ['Richtig', 'Falsch'], correct: [0] }], passPercent: 70 } },

  // ------------------------------------------------------------------ advanced
  table: { cat: 'advanced', de: ['Tabelle', 'Zeilen und Spalten'], en: ['Table', 'Rows and columns'],
    fields: { caption: T(200), header: B(true), rows: L(L(T(400), 1, 10), 1, 60) }, example: { rows: [['Spalte A', 'Spalte B'], ['1', '2']] } },
  embed: { cat: 'advanced', de: ['Einbetten', 'Externe Seite (nur https)'], en: ['Embed', 'External page (https only)'],
    fields: { url: U(true), title: T(160), height: N(200, 1600, 480) }, example: null },
  pdf: { cat: 'advanced', de: ['PDF-Anzeige', 'Lesen ohne Download'], en: ['PDF viewer', 'Read inline, no download'],
    fields: { file: M('pdf', true), title: T(160), height: N(300, 1600, 720) }, example: null },
  graph: { cat: 'advanced', de: ['Diagramm', 'Balken, Linie oder Torte'], en: ['Graph', 'Bar, line or pie'],
    fields: { chartType: E(['bar', 'line', 'pie'], 'bar'), title: T(160), labels: L(T(40, true), 1, 24), series: L(O({ name: T(60), values: L(N(-1e9, 1e9, 0, false), 1, 24) }), 1, 6), unit: T(20) },
    example: { chartType: 'bar', labels: ['Q1', 'Q2', 'Q3'], series: [{ name: 'Umsatz', values: [12, 18, 24] }] } },
  comparison: { cat: 'advanced', de: ['Vergleich', 'Das eine gegen das andere'], en: ['Comparison', 'This versus that'],
    fields: { left: O({ title: T(120, true), items: L(T(300, true), 1, 12) }, true), right: O({ title: T(120, true), items: L(T(300, true), 1, 12) }, true) },
    example: { left: { title: 'Vorher', items: ['Langsam'] }, right: { title: 'Nachher', items: ['Schnell'] } } },
  h5p: { cat: 'advanced', de: ['H5P-Einheit', 'App-Simulation, Szenario, interaktives Video, Sprachlabor …'], en: ['H5P unit', 'App simulation, scenario, interactive video, language lab …'],
    fields: { unitId: T(40, true), height: N(0, 2000, 0) }, example: null }
};

export const BLOCK_CATEGORIES = ['content', 'media', 'interactive', 'advanced'];

// ---------------------------------------------------------------------------------------------- sanitiser
const ALLOWED_TAGS = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'a', 'ul', 'ol', 'li', 'h3', 'h4', 'blockquote', 'code', 'mark', 'sub', 'sup', 'span']);
const VOID = new Set(['br']);

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Minimal allowlist sanitiser for inline rich text. Unknown tags are dropped (their text is kept). */
export function sanitizeHtml(input) {
  const src = String(input ?? '');
  if (!/</.test(src)) return src.split(/\n{2,}/).map((p) => (p.trim() ? `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>` : '')).join('');
  let out = '';
  const stack = [];
  const re = /<\s*(\/?)\s*([a-zA-Z0-9]+)([^>]*)>|<!--[\s\S]*?-->|([^<]+)|(<)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[4] !== undefined) {
      out += m[4].replace(/&(?!(?:[a-zA-Z]{2,8}|#\d{1,6}|#x[0-9a-fA-F]{1,6});)/g, '&amp;').replace(/>/g, '&gt;');
      continue;
    }
    if (m[5] !== undefined) {
      out += '&lt;';
      continue;
    }
    if (!m[2]) continue; // comment
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'template') {
      if (!closing) {
        const end = src.toLowerCase().indexOf(`</${tag}`, re.lastIndex);
        re.lastIndex = end === -1 ? src.length : src.indexOf('>', end) + 1 || src.length;
      }
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) continue;
    if (closing) {
      const idx = stack.lastIndexOf(tag);
      if (idx === -1) continue;
      while (stack.length > idx) out += `</${stack.pop()}>`;
      continue;
    }
    let attrs = '';
    if (tag === 'a') {
      const hm = m[3].match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const h = hm ? (hm[1] ?? hm[2] ?? hm[3] ?? '').trim() : '';
      if (/^(https?:|mailto:)/i.test(h)) attrs = ` href="${escapeHtml(h)}" target="_blank" rel="noopener noreferrer"`;
    }
    if (tag === 'span' || tag === 'mark') {
      const cls = (m[3].match(/class\s*=\s*"([a-z0-9 -]{1,60})"/i) || [])[1];
      if (cls && /^(hl|accent|muted)( |$)/.test(cls)) attrs = ` class="${cls}"`;
    }
    out += `<${tag}${attrs}>`;
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) stack.push(tag);
  }
  while (stack.length) out += `</${stack.pop()}>`;
  return out;
}

const stripTags = (s) => String(s ?? '').replace(/<[^>]*>/g, '');

// ---------------------------------------------------------------------------------------------- normaliser
function normField(spec, value, at, errors, ctx) {
  const missing = value === undefined || value === null || value === '';
  switch (spec.t) {
    case 'text': {
      if (missing) {
        if (spec.req) errors.push(`${at}: Pflichtfeld fehlt.`);
        return undefined;
      }
      const v = stripTags(typeof value === 'string' ? value : String(value)).trim();
      if (spec.req && !v) errors.push(`${at}: Pflichtfeld fehlt.`);
      if (v.length > spec.max) errors.push(`${at}: höchstens ${spec.max} Zeichen.`);
      return v || undefined;
    }
    case 'html': {
      if (missing) {
        if (spec.req) errors.push(`${at}: Pflichtfeld fehlt.`);
        return undefined;
      }
      const v = sanitizeHtml(value);
      if (spec.req && !stripTags(v).trim()) errors.push(`${at}: Pflichtfeld fehlt.`);
      if (v.length > spec.max * 1.5) errors.push(`${at}: Text ist zu lang.`);
      return v || undefined;
    }
    case 'url': {
      if (missing) {
        if (spec.req) errors.push(`${at}: Adresse fehlt.`);
        return undefined;
      }
      const v = String(value).trim();
      if (!/^https:\/\/[^\s<>"']{3,1900}$/i.test(v) && !/^mailto:[^\s<>"']{3,200}$/i.test(v)) {
        errors.push(`${at}: nur https-Adressen sind erlaubt.`);
        return undefined;
      }
      return v;
    }
    case 'media': {
      if (missing) {
        if (spec.req) errors.push(`${at}: Datei fehlt (erst hochladen, dann als "media:<name>" eintragen).`);
        return undefined;
      }
      const v = String(value).trim();
      const m = v.match(/^media:([A-Za-z0-9_.-]{3,120})$/);
      if (!m) {
        errors.push(`${at}: Dateiverweis muss "media:<name>" sein.`);
        return undefined;
      }
      if (ctx.mediaExists && !ctx.mediaExists(m[1])) errors.push(`${at}: Datei "${m[1]}" gibt es in diesem Kurs nicht.`);
      return v;
    }
    case 'enum':
      return spec.opts.includes(value) ? value : spec.def;
    case 'num': {
      if (missing) return spec.def;
      let n = Number(value);
      if (Number.isNaN(n)) {
        errors.push(`${at}: Zahl erwartet.`);
        return spec.def;
      }
      if (spec.int) n = Math.round(n);
      return Math.max(spec.min, Math.min(spec.max, n));
    }
    case 'bool':
      return missing ? spec.def : value === true || value === 'true' || value === 1;
    case 'list': {
      const arr = Array.isArray(value) ? value : missing ? [] : null;
      if (!arr) {
        errors.push(`${at}: Liste erwartet.`);
        return [];
      }
      if (arr.length < spec.min) errors.push(`${at}: mindestens ${spec.min} Einträge.`);
      if (arr.length > spec.max) errors.push(`${at}: höchstens ${spec.max} Einträge.`);
      return arr.slice(0, spec.max).map((v, i) => normField(spec.of, v, `${at}[${i}]`, errors, ctx)).filter((v) => v !== undefined);
    }
    case 'obj': {
      if (missing || typeof value !== 'object' || Array.isArray(value)) {
        if (spec.req) errors.push(`${at}: Angaben fehlen.`);
        if (missing) return undefined;
        return undefined;
      }
      const out = {};
      for (const [k, sub] of Object.entries(spec.fields)) {
        const v = normField(sub, value[k], `${at}.${k}`, errors, ctx);
        if (v !== undefined) out[k] = v;
      }
      return out;
    }
    default:
      return undefined;
  }
}

/** Extra rules that cannot be expressed in the field specs. */
function checkBlock(type, data, at, errors, ctx) {
  const checkQuestion = (q, qat) => {
    if (!q || !Array.isArray(q.options)) return;
    q.correct = [...new Set((q.correct || []).filter((i) => i >= 0 && i < q.options.length))];
    if (!q.correct.length) errors.push(`${qat}.correct: mindestens eine richtige Antwort (Index ab 0).`);
    if (q.correct.length > 1) q.multiple = true;
  };
  if (type === 'quiz') checkQuestion(data, at);
  if (type === 'assessment') (data.questions || []).forEach((q, i) => checkQuestion(q, `${at}.questions[${i}]`));
  if (type === 'fillBlanks' && !/\[[^\]]+\]/.test(data.text || '')) errors.push(`${at}.text: Lücken in eckigen Klammern markieren, z. B. [Antwort|Alternative].`);
  if (type === 'video' && !data.file && !data.url) errors.push(`${at}: Video-Datei oder YouTube-/Vimeo-Adresse angeben.`);
  if (type === 'video' && data.url && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|player\.vimeo\.com)\//i.test(data.url)) {
    errors.push(`${at}.url: nur YouTube oder Vimeo.`);
  }
  if (type === 'graph') {
    (data.series || []).forEach((s) => {
      s.values = (s.values || []).slice(0, (data.labels || []).length);
    });
  }
  if (type === 'h5p' && ctx.unitExists && !ctx.unitExists(data.unitId)) errors.push(`${at}.unitId: Einheit gibt es in diesem Kurs nicht.`);
}

const BLOCK_ID = /^[A-Za-z0-9_-]{4,40}$/;
export const newBlockId = () => 'b_' + crypto.randomBytes(6).toString('base64url');

/**
 * Validates and normalises a block list. ctx: { mediaExists(name), unitExists(id) }.
 * Throws BlockError with all problems, or returns the clean list.
 */
export function normalizeBlocks(input, ctx = {}, { draft = false, strictIds = null } = {}) {
  if (!Array.isArray(input)) throw new BlockError('blocks muss eine Liste sein.');
  if (input.length > 600) throw new BlockError('Höchstens 600 Blöcke je Kurs.');
  const errors = [];
  const seen = new Set();
  const out = input.map((raw, i) => {
    const at = `blocks[${i}]`;
    const type = raw && raw.type;
    const def = BLOCK_TYPES[type];
    if (!def) {
      errors.push(`${at}.type: unbekannter Blocktyp "${type}". Erlaubt: ${Object.keys(BLOCK_TYPES).join(', ')}.`);
      return null;
    }
    let id = raw.id && BLOCK_ID.test(String(raw.id)) ? String(raw.id) : newBlockId();
    if (seen.has(id)) id = newBlockId();
    seen.add(id);
    const own = [];
    const data = normField(O(def.fields), raw.data || {}, `${at}.data`, own, ctx) || {};
    checkBlock(type, data, `${at}.data`, own, ctx);
    const block = { id, type, data };
    if (raw.narration !== undefined && raw.narration !== null && raw.narration !== '') {
      const n = normField(M('audio'), raw.narration, `${at}.narration`, own, ctx);
      if (n) block.narration = n;
    }
    // Drafts keep incomplete blocks (the web editor saves while typing); export refuses them.
    if (own.length && draft && !(strictIds === 'all' || (strictIds && strictIds.has(id)))) block.issues = own.map((e) => e.slice(at.length + 1));
    else errors.push(...own);
    return block;
  });
  if (errors.length) throw new BlockError(`Blöcke ungültig (${errors.length} Fehler): ${errors.slice(0, 12).join(' · ')}`, errors);
  return out.filter(Boolean);
}

/** Lessons = segments starting at "title" blocks (blocks before the first title form an intro lesson). */
export function outline(blocks) {
  const lessons = [];
  for (const b of blocks) {
    if (b.type === 'title' || !lessons.length) lessons.push({ title: b.type === 'title' ? b.data.content : '', blockIds: [] });
    lessons[lessons.length - 1].blockIds.push(b.id);
  }
  return lessons;
}

// ---------------------------------------------------------------------------------------------- design
export const PLAYER_DESIGNS = ['studio', 'classic', 'focus', 'stage', 'lesson', 'magazine', 'journey', 'hub'];
export const THEME_PRESETS = {
  ink: { primary: '#1d2230', accent: '#b3312c' },
  ocean: { primary: '#1f4e79', accent: '#2a9d8f' },
  violet: { primary: '#4c3fbf', accent: '#7c6cf0' },
  forest: { primary: '#24513d', accent: '#4caf7d' },
  sunset: { primary: '#8a3b12', accent: '#e07a2e' },
  slate: { primary: '#334155', accent: '#0ea5e9' },
  gold: { primary: '#6b5310', accent: '#d4a72c' },
  rose: { primary: '#7a1f3d', accent: '#e05780' }
};
export const FONTS = ['Geist', 'Inter', 'Poppins', 'Source Sans 3', 'Lato', 'Montserrat', 'Merriweather', 'Georgia', 'System'];

const hex = (v, def) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v).toLowerCase() : def);

export const DEFAULT_DESIGN = {
  player: 'studio',
  theme: { preset: 'ink', mode: 'light', primary: '#1d2230', accent: '#b3312c', background: '#f7f5f0', font: 'Geist', fontSize: 'medium', radius: 'rounded' },
  cover: { show: true, image: null, kicker: '', duration: '' },
  logo: null,
  direction: 'ltr',
  completion: { message: '', nextUrl: '', nextLabel: '', restart: true },
  labels: {}
};

export function normalizeDesign(input = {}, ctx = {}) {
  const d = JSON.parse(JSON.stringify(DEFAULT_DESIGN));
  const errors = [];
  if (PLAYER_DESIGNS.includes(input.player)) d.player = input.player;
  const t = input.theme || {};
  if (THEME_PRESETS[t.preset]) {
    d.theme.preset = t.preset;
    Object.assign(d.theme, THEME_PRESETS[t.preset]);
  }
  if (t.preset === 'custom' || !THEME_PRESETS[t.preset]) {
    // explicit colours only without a named preset (choosing a colour by hand switches to "custom")
    d.theme.preset = 'custom';
    d.theme.primary = hex(t.primary, d.theme.primary);
    d.theme.accent = hex(t.accent, d.theme.accent);
  }
  d.theme.background = hex(t.background, d.theme.background);
  if (['light', 'dark'].includes(t.mode)) d.theme.mode = t.mode;
  if (FONTS.includes(t.font)) d.theme.font = t.font;
  if (['small', 'medium', 'large'].includes(t.fontSize)) d.theme.fontSize = t.fontSize;
  if (['sharp', 'rounded', 'pill'].includes(t.radius)) d.theme.radius = t.radius;
  const c = input.cover || {};
  d.cover.show = c.show !== false;
  d.cover.image = c.image ? normField(M('image'), c.image, 'cover.image', errors, ctx) || null : null;
  d.cover.kicker = normField(T(60), c.kicker, 'cover.kicker', errors, ctx) || '';
  d.cover.duration = normField(T(40), c.duration, 'cover.duration', errors, ctx) || '';
  d.logo = input.logo ? normField(M('image'), input.logo, 'logo', errors, ctx) || null : null;
  if (['ltr', 'rtl'].includes(input.direction)) d.direction = input.direction;
  const comp = input.completion || {};
  d.completion.message = normField(T(600), comp.message, 'completion.message', errors, ctx) || '';
  d.completion.nextUrl = comp.nextUrl ? normField(U(), comp.nextUrl, 'completion.nextUrl', errors, ctx) || '' : '';
  d.completion.nextLabel = normField(T(60), comp.nextLabel, 'completion.nextLabel', errors, ctx) || '';
  d.completion.restart = comp.restart !== false;
  if (input.labels && typeof input.labels === 'object') {
    for (const [k, v] of Object.entries(input.labels)) {
      if (/^[a-zA-Z]{2,30}$/.test(k) && typeof v === 'string' && v.trim()) d.labels[k] = stripTags(v).slice(0, 200);
    }
  }
  if (errors.length) throw new BlockError(`Gestaltung ungültig: ${errors.join(' · ')}`, errors);
  return d;
}

// ---------------------------------------------------------------------------------------------- media
const MEDIA_EXT = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
  video: ['mp4', 'webm', 'm4v'],
  audio: ['mp3', 'm4a', 'ogg', 'oga', 'wav'],
  captions: ['vtt'],
  pdf: ['pdf'],
  file: ['pdf', 'docx', 'xlsx', 'pptx', 'zip', 'txt', 'csv', 'png', 'jpg', 'jpeg']
};
const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', m4v: 'video/mp4',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', vtt: 'text/vtt', pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', zip: 'application/zip', txt: 'text/plain', csv: 'text/csv'
};
export const mediaMime = (name) => MIME[String(name).split('.').pop().toLowerCase()] || 'application/octet-stream';

export const courseMediaDir = (courseId) => path.join(config.dataDir, 'media', courseId.replace(/[^A-Za-z0-9_-]/g, ''));

export function mediaPath(courseId, name) {
  if (!/^[A-Za-z0-9_.-]{3,120}$/.test(name) || name.startsWith('.')) return null;
  const p = path.join(courseMediaDir(courseId), name);
  return fs.existsSync(p) ? p : null;
}

function sniffOk(ext, buf) {
  if (ext === 'vtt') return buf.subarray(0, 6).toString('utf8').replace(/^﻿/, '').startsWith('WEBVTT');
  if (['txt', 'csv'].includes(ext)) return !buf.subarray(0, 512).includes(0);
  if (ext === 'pdf') return buf.subarray(0, 4).toString('latin1') === '%PDF';
  if (['docx', 'xlsx', 'pptx', 'zip'].includes(ext)) return buf.subarray(0, 4).toString('hex') === '504b0304';
  const kind = MEDIA_EXT.image.includes(ext) ? 'image' : MEDIA_EXT.video.includes(ext) ? 'video' : MEDIA_EXT.audio.includes(ext) ? 'audio' : null;
  return kind ? kindMatches(kind, buf) : false;
}

/** Stores an uploaded file for a course. Returns { ref: "media:<name>", name, mime, size, kind }. */
export function saveMedia(courseId, originalName, buf, maxBytes) {
  const ext = String(originalName || '').split('.').pop().toLowerCase();
  const kind = Object.keys(MEDIA_EXT).find((k) => k !== 'file' && MEDIA_EXT[k].includes(ext)) || (MEDIA_EXT.file.includes(ext) ? 'file' : null);
  if (!kind) throw new BlockError(`Dateityp .${ext} wird nicht unterstützt.`);
  if (buf.length > maxBytes) throw new BlockError(`Datei ist zu groß (max. ${Math.round(maxBytes / 1048576)} MB).`);
  if (!sniffOk(ext, buf)) throw new BlockError('Der Dateiinhalt passt nicht zur Dateiendung.');
  const base = String(originalName).replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'datei';
  const name = `${base}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const dir = courseMediaDir(courseId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buf);
  return { ref: `media:${name}`, name, mime: MIME[ext], size: buf.length, kind };
}

export function listMedia(courseId) {
  const dir = courseMediaDir(courseId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => !n.startsWith('.'))
    .map((n) => {
      const st = fs.statSync(path.join(dir, n));
      return { ref: `media:${n}`, name: n, mime: mediaMime(n), size: st.size, updatedAt: st.mtime.toISOString() };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** All media names referenced by blocks and design (for packaging and cleanup). */
export function referencedMedia(blocks, design) {
  const out = new Set();
  const walk = (v) => {
    if (typeof v === 'string') {
      const m = v.match(/^media:([A-Za-z0-9_.-]+)$/);
      if (m) out.add(m[1]);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(blocks);
  walk(design);
  return [...out];
}

/** Compact catalogue for the editor and the MCP guide. */
export function blockCatalog(lang = 'de', { withSpec = false } = {}) {
  return Object.entries(BLOCK_TYPES).map(([type, def]) => {
    const [label, description] = def[lang === 'en' ? 'en' : 'de'];
    const describe = (spec) => {
      switch (spec.t) {
        case 'list': return [describe(spec.of)];
        case 'obj': return Object.fromEntries(Object.entries(spec.fields).map(([k, s]) => [k + (s.req ? '' : '?'), describe(s)]));
        case 'enum': return spec.opts.join('|');
        case 'media': return `media:<${spec.kind}>`;
        case 'num': return `number ${spec.min}..${spec.max}`;
        default: return spec.t;
      }
    };
    return {
      type,
      category: def.cat,
      label,
      description,
      graded: !!def.graded,
      fields: Object.fromEntries(Object.entries(def.fields).map(([k, s]) => [k + (s.req ? '' : '?'), describe(s)])),
      example: def.example,
      ...(withSpec ? { spec: def.fields } : {})
    };
  });
}

/** Short plain-text summary of a block (review sidebar, MCP comment lists). */
export function blockSummary(b) {
  const d = (b && b.data) || {};
  const first = (arr, key) => (Array.isArray(arr) && arr.length ? (typeof arr[0] === 'string' ? arr[0] : arr[0] && arr[0][key]) : '');
  const v =
    d.content || d.question || d.heading || d.title || d.prompt || d.caption || d.name || d.label || d.text ||
    first(d.items, 'heading') || first(d.items, 'title') || first(d.cards, 'front') || first(d.steps, 'title') || first(d.tabs, 'title') ||
    first(d.pairs, 'left') || (Array.isArray(d.questions) ? `${d.questions.length} ?` : '') || (Array.isArray(d.rows) && Array.isArray(d.rows[0]) ? d.rows[0].join(' · ') : '') || '';
  const s = String(v).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > 90 ? `${s.slice(0, 88)}…` : s;
}
