/**
 * Import of Articulate Rise 360 exports (SCORM, xAPI or web export ZIP) into a block course.
 * Rise embeds the whole course as base64 JSON in scormcontent/index.html (deserialize("…") or courseData = "…").
 * Lessons become lessons (title block), Rise blocks are mapped to our block types; images and files from
 * scormcontent/assets are copied into the course media. Anything we cannot map exactly becomes a text block,
 * so no content is lost; the import saves as draft so the editor shows what still needs attention.
 */
import path from 'node:path';
import { sanitizeHtml } from '../blocks.js';

const strip = (s) =>
  String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h\d)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
const html = (s) => sanitizeHtml(String(s ?? ''));
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Returns { data, entries } when the archive is a Rise export, else null. */
export function detectRisePackage(entries) {
  const candidates = entries.filter((e) => /(^|\/)scormcontent\/index\.html$|(^|\/)index\.html$/i.test(e.entryName) && e.header.size < 60 * 1024 * 1024);
  for (const e of candidates) {
    const text = e.getData().toString('utf8');
    if (!/articulate|rise/i.test(text) && !/deserialize\(|courseData/.test(text)) continue;
    const m = text.match(/deserialize\(\s*["']([A-Za-z0-9+/=_-]{40,})["']\s*\)/) || text.match(/courseData\s*=\s*["']([A-Za-z0-9+/=_-]{40,})["']/);
    if (!m) continue;
    const data = decode(m[1]);
    if (data && (data.course || data.lessons)) return { data: data.course ? data : { course: data }, base: path.posix.dirname(e.entryName) };
  }
  return null;
}

function decode(b64) {
  try {
    const raw = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    try {
      return JSON.parse(raw);
    } catch {
      return JSON.parse(decodeURIComponent(raw));
    }
  } catch {
    return null;
  }
}

function mediaKey(m) {
  if (!m || typeof m !== 'object') return null;
  const img = m.image || m.video || m.audio || m.attachment || m;
  return img.key || img.src || img.url || img.originalUrl || null;
}

/**
 * Maps the Rise course to { title, description, blocks, media: [{ key, target }] }.
 * `addMedia(key, kind)` registers a file and returns its future "media:<name>" ref (or null when not found).
 */
export function riseToBlocks(data, addMedia) {
  const course = data.course || data;
  const blocks = [];
  const stats = { lessons: 0, items: 0, mapped: 0, fallback: 0 };
  let section = '';
  const push = (type, d) => blocks.push({ type, data: d });
  const fallback = (item) => {
    const texts = [];
    const walk = (v) => {
      if (typeof v === 'string' && /[a-zA-ZÀ-ɏ]/.test(v) && v.length > 1 && !/^(https?:|[a-f0-9-]{20,}|\w+\.(png|jpe?g|gif|mp4|svg))/i.test(v)) texts.push(strip(v));
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!['id', 'key', 'type', 'variant', 'family', 'settings'].includes(k)) walk(x);
    };
    walk(item.items || item);
    const t = [...new Set(texts.filter(Boolean))].join('\n\n');
    if (t) {
      push('text', { content: html(cut(t, 18000)) });
      stats.fallback++;
    }
  };

  for (const lesson of course.lessons || []) {
    if (lesson.type === 'section') {
      section = strip(lesson.title);
      continue;
    }
    stats.lessons++;
    push('title', { content: cut(strip(lesson.title) || 'Lektion', 200), ...(section ? { kicker: cut(section, 60) } : {}) });
    for (const item of lesson.items || []) {
      stats.items++;
      const before = blocks.length;
      try {
        mapItem(item, push, addMedia);
      } catch {
        /* fall through to text */
      }
      if (blocks.length === before) fallback(item);
      else stats.mapped++;
    }
  }
  return { title: cut(strip(course.title) || 'Rise-Kurs', 200), description: cut(strip(course.description), 4000), blocks, stats };
}

function mapItem(item, push, addMedia) {
  const type = String(item.type || '').toLowerCase();
  const variant = String(item.variant || item.family || '').toLowerCase();
  const its = Array.isArray(item.items) ? item.items : [];
  const first = its[0] || {};
  const img = (m, kind = 'image') => {
    const key = mediaKey(m);
    return key ? addMedia(key, kind) : null;
  };
  switch (type) {
    case 'text': {
      if (variant.includes('two column') || variant.includes('column')) {
        if (its.length >= 2) push('columns', { leftTitle: cut(strip(its[0].heading), 120) || undefined, left: html(its[0].paragraph || its[0].heading), rightTitle: cut(strip(its[1].heading), 120) || undefined, right: html(its[1].paragraph || its[1].heading) });
        return;
      }
      if (variant.includes('table')) return; // tables fall back to text
      if (first.heading) push('subtitle', { content: cut(strip(first.heading), 200) });
      if (first.paragraph) push('text', { content: html(first.paragraph) });
      return;
    }
    case 'statement':
      if (variant.includes('note')) push('callout', { variant: 'info', content: html(first.paragraph) });
      else push('statement', { content: cut(strip(first.paragraph || first.heading), 400), style: variant.includes('d') ? 'dark' : 'accent' });
      return;
    case 'quote': {
      const avatar = first.media ? img(first.media) : null;
      push('quote', { content: cut(strip(first.paragraph), 1000), author: cut(strip(first.name || first.title), 160) || undefined, ...(avatar ? { image: avatar } : {}) });
      return;
    }
    case 'list': {
      const items = its.map((x) => cut(strip(x.paragraph || x.title), 500)).filter(Boolean);
      if (!items.length) return;
      if (variant.includes('check')) push('checklist', { items });
      else if (variant.includes('number')) push('numberedList', { items });
      else push('list', { items });
      return;
    }
    case 'image': {
      const ref = img(first.media);
      if (!ref) return;
      const alt = cut(strip(first.media?.image?.altText || first.altText || ''), 300) || undefined;
      if (variant.includes('aside') || (first.paragraph && strip(first.paragraph).length > 40)) push('imageText', { image: ref, alt, content: html(first.paragraph || first.caption || ' ') || '<p> </p>', side: variant.includes('right') ? 'right' : 'left' });
      else if (variant.includes('hero') || variant.includes('full')) push('banner', { image: ref, heading: cut(strip(first.caption || first.paragraph || ''), 160) || ' ' });
      else push('image', { image: ref, alt, caption: cut(strip(first.caption), 300) || undefined, size: variant.includes('center') ? 'medium' : 'wide' });
      return;
    }
    case 'gallery': {
      const images = its.map((x) => ({ image: img(x.media), caption: cut(strip(x.caption), 300) || undefined })).filter((x) => x.image);
      if (images.length >= 2) push('gallery', { layout: variant.includes('carousel') ? 'carousel' : 'grid', images });
      else if (images.length === 1) push('image', { image: images[0].image, caption: images[0].caption });
      return;
    }
    case 'multimedia': {
      const m = first.media || {};
      if (m.video || variant.includes('video')) {
        const url = m.video?.url || m.video?.originalUrl;
        if (url && /youtu|vimeo/i.test(url)) push('video', { url: url.replace(/^http:/, 'https:'), title: cut(strip(first.title), 160) || undefined });
        else {
          const ref = img(m, 'video');
          if (ref) push('video', { file: ref, title: cut(strip(first.title || first.caption), 160) || undefined });
        }
      } else if (m.audio || variant.includes('audio')) {
        const ref = img(m, 'audio');
        if (ref) push('audio', { file: ref, title: cut(strip(first.title || first.caption), 160) || undefined });
      } else if (m.attachment || variant.includes('attachment')) {
        const ref = img(m, 'file');
        if (ref) push('file', { file: ref, name: cut(strip(first.title || m.attachment?.originalName || 'Datei'), 160) });
      } else if (m.embed || variant.includes('embed')) {
        const url = m.embed?.url || first.src;
        if (url && /^https:/.test(url)) push('embed', { url, title: cut(strip(first.title), 160) || undefined });
      }
      return;
    }
    case 'interactive': {
      if (variant.includes('accordion')) push('accordion', { items: its.map((x) => ({ heading: cut(strip(x.title), 200) || '…', content: html(x.description || x.paragraph || ' ') || '<p>…</p>' })) });
      else if (variant.includes('tab')) push('tabs', { tabs: its.map((x) => ({ title: cut(strip(x.title), 80) || '…', content: html(x.description || x.paragraph || ' ') || '<p>…</p>' })) });
      else if (variant.includes('process')) push('process', { steps: its.filter((x) => x.type !== 'intro' && x.type !== 'summary').map((x) => ({ title: cut(strip(x.title), 120) || '…', content: html(x.description) || undefined })) });
      else if (variant.includes('timeline')) push('timeline', { items: its.map((x) => ({ date: cut(strip(x.date), 60) || undefined, title: cut(strip(x.title), 160) || '…', content: html(x.description) || undefined })) });
      else if (variant.includes('flashcard')) push('flipcard', { cards: its.map((x) => ({ front: cut(strip(x.front?.description || x.front?.title || x.front), 400) || '…', back: cut(strip(x.back?.description || x.back?.title || x.back), 800) || '…' })) });
      else if (variant.includes('labeled') || variant.includes('hotspot')) {
        const ref = img(item.media || first.media);
        const spots = (item.markers || its).map((x) => ({ x: Math.max(0, Math.min(1, Number(x.x ?? x.left ?? 50) / 100)), y: Math.max(0, Math.min(1, Number(x.y ?? x.top ?? 50) / 100)), title: cut(strip(x.title), 120) || '…', content: html(x.description) || undefined }));
        if (ref && spots.length) push('hotspot', { image: ref, spots });
      } else if (variant.includes('sort')) {
        const piles = item.piles || its.filter((x) => Array.isArray(x.items));
        if (piles.length >= 2) push('bucketSort', { buckets: piles.slice(0, 5).map((p) => ({ name: cut(strip(p.title), 80) || '…', items: (p.items || p.cards || []).map((c) => cut(strip(c.title || c), 120)).filter(Boolean).slice(0, 12) })) });
      }
      return;
    }
    case 'knowledgecheck':
    case 'knowledge check':
    case 'quiz': {
      const q = first;
      const question = cut(strip(q.title || q.question), 600);
      const answers = q.answers || [];
      if (variant.includes('blank')) {
        const alts = answers.map((a) => strip(a.title)).filter(Boolean);
        if (question && alts.length) push('fillBlanks', { prompt: question, text: `${question.includes('___') ? question.replace(/_{3,}/, `[${alts.join('|')}]`) : `${question} [${alts.join('|')}]`}` });
        return;
      }
      if (variant.includes('match')) {
        const pairs = answers.map((a) => ({ left: cut(strip(a.title), 200), right: cut(strip(a.matchTitle || a.match || a.pair), 300) })).filter((p) => p.left && p.right);
        if (pairs.length >= 2) push('matching', { prompt: question || undefined, pairs: pairs.slice(0, 12) });
        return;
      }
      if (question && answers.length >= 2) {
        const correct = answers.map((a, i) => (a.correct ? i : -1)).filter((i) => i >= 0);
        push('quiz', { question, options: answers.slice(0, 8).map((a) => cut(strip(a.title), 300) || '…'), correct: correct.length ? correct : [0], explanation: cut(strip(q.feedback || q.feedbackCorrect || ''), 1200) || undefined });
      }
      return;
    }
    case 'divider':
      push('divider', variant.includes('number') ? {} : {});
      return;
    default:
  }
}
