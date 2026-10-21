/**
 * Course languages: 12 built-in languages plus languages an admin defines.
 * A custom language has a code (BCP 47, e.g. "de-ch", "ja"), a display name, a writing direction, a base language
 * (built-in; used for H5P interface texts and as fallback for player texts) and optional own player/shell texts.
 */
import { db, audit, parseJson } from './db.js';
import { PLAYER, SHELL } from './export/labels.js';

export const BUILTIN_LANGUAGES = [
  { code: 'de', name: 'Deutsch', de: 'Deutsch', en: 'German', dir: 'ltr' },
  { code: 'en', name: 'English', de: 'Englisch', en: 'English', dir: 'ltr' },
  { code: 'fr', name: 'Français', de: 'Französisch', en: 'French', dir: 'ltr' },
  { code: 'it', name: 'Italiano', de: 'Italienisch', en: 'Italian', dir: 'ltr' },
  { code: 'es', name: 'Español', de: 'Spanisch', en: 'Spanish', dir: 'ltr' },
  { code: 'pt', name: 'Português', de: 'Portugiesisch', en: 'Portuguese', dir: 'ltr' },
  { code: 'nl', name: 'Nederlands', de: 'Niederländisch', en: 'Dutch', dir: 'ltr' },
  { code: 'pl', name: 'Polski', de: 'Polnisch', en: 'Polish', dir: 'ltr' },
  { code: 'cs', name: 'Čeština', de: 'Tschechisch', en: 'Czech', dir: 'ltr' },
  { code: 'sv', name: 'Svenska', de: 'Schwedisch', en: 'Swedish', dir: 'ltr' },
  { code: 'tr', name: 'Türkçe', de: 'Türkisch', en: 'Turkish', dir: 'ltr' },
  { code: 'ar', name: 'العربية', de: 'Arabisch', en: 'Arabic', dir: 'rtl' }
];
const BUILTIN = new Map(BUILTIN_LANGUAGES.map((l) => [l.code, l]));
export const PLAYER_LABEL_KEYS = Object.keys(PLAYER.en);
export const SHELL_LABEL_KEYS = Object.keys(SHELL.en);

const CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8}){0,2}$/;

class LanguageError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function customRow(code) {
  return db.prepare('SELECT * FROM languages WHERE code = ?').get(code);
}
function fromRow(r) {
  return { code: r.code, name: r.name, dir: r.dir, base: r.base, labels: parseJson(r.labels, {}), builtin: false, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function listLanguages() {
  const custom = db.prepare('SELECT * FROM languages ORDER BY name').all().map(fromRow);
  return [...BUILTIN_LANGUAGES.map((l) => ({ ...l, builtin: true })), ...custom];
}

/** Language record or null. */
export function getLanguage(code) {
  const c = String(code || '').toLowerCase();
  if (BUILTIN.has(c)) return { ...BUILTIN.get(c), builtin: true };
  const row = customRow(c);
  return row ? fromRow(row) : null;
}

export const isCourseLanguage = (code) => !!getLanguage(code);

/** Built-in language whose H5P interface texts a course in `code` uses. */
export function h5pLanguage(code) {
  const lang = getLanguage(code);
  if (!lang) return 'en';
  return lang.builtin ? lang.code : lang.base;
}

export const languageDirection = (code) => getLanguage(code)?.dir || 'ltr';

function merged(table, code, scope) {
  const lang = getLanguage(code);
  const base = lang && !lang.builtin ? lang.base : null;
  return { ...table.en, ...(base ? table[base] : {}), ...(lang?.builtin ? table[lang.code] : {}), ...((lang && !lang.builtin && lang.labels[scope]) || {}) };
}
export const playerLabels = (code) => merged(PLAYER, code, 'player');
export const shellLabels = (code) => merged(SHELL, code, 'shell');

function cleanLabels(input, keys) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const k of keys) {
    const v = input[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.replace(/<[^>]*>/g, '').trim().slice(0, 300);
  }
  return out;
}

export function saveLanguage(user, { code, name, dir = 'ltr', base = 'en', labels = {} }, { create = false } = {}) {
  const c = String(code || '').trim().toLowerCase();
  if (!CODE.test(c)) throw new LanguageError('Sprachcode ungültig. Beispiele: ja, de-ch, pt-br.');
  if (BUILTIN.has(c)) throw new LanguageError('Diese Sprache ist bereits eingebaut.');
  const n = String(name || '').trim().slice(0, 80);
  if (!n) throw new LanguageError('Name der Sprache fehlt.');
  if (!['ltr', 'rtl'].includes(dir)) throw new LanguageError('Leserichtung muss ltr oder rtl sein.');
  if (!BUILTIN.has(base)) throw new LanguageError('Basissprache muss eine eingebaute Sprache sein.');
  const clean = { player: cleanLabels(labels.player, PLAYER_LABEL_KEYS), shell: cleanLabels(labels.shell, SHELL_LABEL_KEYS) };
  const exists = !!customRow(c);
  if (create && exists) throw new LanguageError('Diese Sprache gibt es schon.', 409);
  if (!create && !exists) throw new LanguageError('Sprache nicht gefunden.', 404);
  if (exists) {
    db.prepare("UPDATE languages SET name = ?, dir = ?, base = ?, labels = ?, updated_at = datetime('now') WHERE code = ?").run(n, dir, base, JSON.stringify(clean), c);
  } else {
    db.prepare('INSERT INTO languages (code, name, dir, base, labels) VALUES (?, ?, ?, ?, ?)').run(c, n, dir, base, JSON.stringify(clean));
  }
  audit(user.id, exists ? 'language.update' : 'language.create', c, null);
  return getLanguage(c);
}

export function deleteLanguage(user, code) {
  const c = String(code || '').toLowerCase();
  if (!customRow(c)) throw new LanguageError('Sprache nicht gefunden.', 404);
  const used = db.prepare('SELECT COUNT(*) AS n FROM courses WHERE language = ?').get(c).n;
  if (used) throw new LanguageError(`Die Sprache wird noch von ${used} Kurs(en) verwendet.`, 409);
  db.prepare('DELETE FROM languages WHERE code = ?').run(c);
  audit(user.id, 'language.delete', c, null);
}
