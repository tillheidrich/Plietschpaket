/**
 * Import of "click-practice" SCORM packages (course.json + screenshots, a format Claude generates when asked
 * for a software simulation without an authoring tool) into an editable H5P.AppSimulation unit.
 *
 * Source format (course.json, or course.js with `window.COURSE = {...}`):
 *   { id, lang, mode: "practice"|"video"|"both", kicker, title, meta, intro,
 *     chapters: [{id, title}], steps: [{id, chapter, shot, label, detail, target, tone}],
 *     ui: {watch, practice, resume, next, finish, toPractice, doIt, miss, hint, good, doneTitle, doneText, again},
 *     video, videoComplete }
 *   target: {type:"tap", x, y, r}  (centre, radius relative to the screenshot width)
 *         | {type:"rect", x, y, w, h, tap?: [x, y]}  (rect with tap point = task, without = highlight)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { toH5pUser } from '../h5p.js';
import { kindMatches } from '../sniff.js';

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', vtt: 'text/vtt' };
const COURSE_LANGS = ['de', 'en', 'fr', 'it', 'es', 'pt', 'nl', 'pl', 'cs', 'sv', 'tr', 'ar'];

/** Returns the parsed course definition if the archive is a click-practice package, else null. */
export function detectAppSimPackage(entries) {
  const byName = new Map(entries.map((e) => [e.entryName.replace(/^\.\//, ''), e]));
  // packages may sit in a sub folder
  const jsonEntry = entries.find((e) => /(^|\/)course\.json$/.test(e.entryName));
  const jsEntry = entries.find((e) => /(^|\/)course\.js$/.test(e.entryName));
  let data = null;
  let base = '';
  if (jsonEntry) {
    try {
      data = JSON.parse(jsonEntry.getData().toString('utf8'));
      base = jsonEntry.entryName.replace(/course\.json$/, '');
    } catch {
      data = null;
    }
  }
  if (!data && jsEntry) {
    const m = jsEntry.getData().toString('utf8').match(/window\.COURSE\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (m) {
      try {
        data = JSON.parse(m[1]);
        base = jsEntry.entryName.replace(/course\.js$/, '');
      } catch {
        data = null;
      }
    }
  }
  if (!data || !Array.isArray(data.steps) || !Array.isArray(data.chapters) || !data.steps.length) return null;
  return { data, base, byName };
}

function pngSize(buf) {
  if (buf.length > 24 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o < buf.length) {
      if (buf[o] !== 0xff) break;
      const marker = buf[o + 1];
      const len = buf.readUInt16BE(o + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(o + 5), width: buf.readUInt16BE(o + 7) };
      o += 2 + len;
    }
  }
  return null;
}

function cssVar(html, name) {
  const m = html.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1] : undefined;
}

const r4 = (n) => Math.round(Math.max(0, Math.min(1, Number(n) || 0)) * 10000) / 10000;

/** Converts a source target into { kind, area } of the AppSimulation model. */
export function convertTarget(target, tone, size) {
  const ratio = size && size.width && size.height ? size.width / size.height : 9 / 19.5;
  if (!target) return { kind: tone === 'note' ? 'note' : 'info', area: undefined };
  if (target.type === 'tap') {
    const r = (Number(target.r) || 0.06) * 1.25; // the source draws the ring at 1.25 × r
    const rh = r * ratio;
    return {
      kind: 'click',
      area: { shape: 'ellipse', x: r4(target.x - r), y: r4(target.y - rh), w: r4(2 * r), h: r4(2 * rh) }
    };
  }
  const area = { shape: 'rect', x: r4(target.x), y: r4(target.y), w: r4(target.w), h: r4(target.h) };
  if (Array.isArray(target.tap)) return { kind: 'click', area };
  return { kind: tone === 'note' ? 'note' : 'info', area };
}

/**
 * Builds H5P.AppSimulation params from the package and stores all media as temporary H5P files
 * (moved into the content on save).
 */
export async function buildAppSimParams(pkg, { editor, user }) {
  const { data, base, byName } = pkg;
  const h5pUser = toH5pUser(user);
  const uploaded = new Map();
  fs.mkdirSync(config.tmpDir, { recursive: true });

  async function upload(rel, kind) {
    if (!rel) return null;
    const key = path.posix.normalize(base + String(rel).replace(/^\.\//, ''));
    if (key.startsWith('..')) return null;
    if (uploaded.has(key)) return uploaded.get(key);
    const entry = byName.get(key);
    if (!entry) return null;
    const buf = entry.getData();
    if (!kindMatches(kind, buf)) return null;
    const ext = key.split('.').pop().toLowerCase();
    const tmp = path.join(config.tmpDir, `appsim-${crypto.randomUUID()}.${ext}`);
    fs.writeFileSync(tmp, buf);
    try {
      const saved = await editor.saveContentFile(
        undefined,
        { name: 'file', type: kind === 'video' ? 'video' : 'image' },
        { tempFilePath: tmp, mimetype: MIME[ext] || 'application/octet-stream', name: path.posix.basename(key), size: buf.length },
        h5pUser
      );
      const size = kind === 'image' ? pngSize(buf) : null;
      const result = { path: saved.path, mime: saved.mime || MIME[ext], ...(size || {}) };
      uploaded.set(key, result);
      return result;
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }

  const indexEntry = byName.get(`${base}index.html`);
  const html = indexEntry ? indexEntry.getData().toString('utf8') : '';
  const logoRel = (html.match(/<img[^>]+class="logo"[^>]+src="([^"]+)"/) || html.match(/<img[^>]+src="([^"]+)"[^>]+class="logo"/) || [])[1];
  const footer = ((html.match(/id="copy"[^>]*>([^<]{1,80})</) || [])[1] || '').trim();

  const chapters = [];
  const byChapter = new Map();
  for (const ch of data.chapters) {
    const c = { title: String(ch.title || '').slice(0, 80), steps: [] };
    chapters.push(c);
    byChapter.set(ch.id, c);
  }
  let lastShotKey = null;
  for (const st of data.steps) {
    const chapter = byChapter.get(st.chapter) || chapters[chapters.length - 1];
    if (!chapter) continue;
    let screenshot;
    if (st.shot && st.shot !== lastShotKey) {
      screenshot = await upload(st.shot, 'image');
      lastShotKey = st.shot;
    }
    const size = (uploaded.get(path.posix.normalize(base + String(st.shot || ''))) || {});
    const { kind, area } = convertTarget(st.target, st.tone, size);
    const step = { label: String(st.label || '').slice(0, 120), kind };
    if (st.detail) step.detail = String(st.detail).slice(0, 300);
    if (screenshot) step.screenshot = screenshot;
    if (area) step.area = area;
    chapter.steps.push(step);
  }
  const usable = chapters.filter((c) => c.steps.length);

  const ui = data.ui || {};
  const l10n = {};
  const map = { start: ui.practice, resume: ui.resume, watch: ui.watch, toPractice: ui.toPractice, next: ui.next, doIt: ui.doIt, miss: ui.miss, hint: ui.hint, good: ui.good, doneTitle: ui.doneTitle, doneText: ui.doneText, again: ui.again };
  for (const [k, v] of Object.entries(map)) if (typeof v === 'string' && v.trim()) l10n[k] = v.trim();

  const params = {
    intro: {
      kicker: data.kicker ? String(data.kicker).slice(0, 60) : undefined,
      subtitle: data.meta ? String(data.meta).slice(0, 80) : undefined,
      text: data.intro ? String(data.intro).slice(0, 400) : undefined
    },
    chapters: usable,
    theme: {
      frame: 'phone',
      sidebarColor: cssVar(html, 'deep') || '#1d2230',
      accentColor: cssVar(html, 'cyan') || '#e3a33b',
      buttonColor: cssVar(html, 'red') || '#b3312c',
      footer: footer || undefined
    },
    behaviour: { scoring: 'firstTry', hintAfter: 2, tolerance: 25, allowBack: true, showVideoFirst: false },
    l10n
  };
  const logo = logoRel ? await upload(logoRel, 'image') : null;
  if (logo) params.intro.logo = logo;
  if (data.video && data.mode !== 'practice') {
    const video = await upload(data.video, 'video');
    if (video) {
      params.video = { files: [{ path: video.path, mime: video.mime }] };
      params.behaviour.showVideoFirst = true;
    }
  }
  const language = COURSE_LANGS.includes(String(data.lang || '').slice(0, 2)) ? String(data.lang).slice(0, 2) : undefined;
  return { params, title: String(data.title || 'App-Simulation').slice(0, 200), language, stats: { steps: usable.reduce((n, c) => n + c.steps.length, 0), media: uploaded.size } };
}
