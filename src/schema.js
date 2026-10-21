/**
 * Turns H5P semantics.json into something an AI can work with:
 *  - describeSchema(): a compact JSON-Schema-like description per content type
 *  - normalizeParams(): fills defaults, validates and adds subContentIds
 *
 * h5p-server's own SemanticsEnforcer is "mostly only a stub" (see its source), so
 * this module is the real guard for content created through MCP.
 */
import crypto from 'node:crypto';
import { resolveUbername } from './h5p.js';

const MAX_DEPTH = 12;

const localizedCache = new Map();

/** Semantics of a library; with lang the labels and defaults come from the library's language file. */
export async function getSemantics(editor, ubername, lang) {
  const lib = await resolveUbername(editor, ubername);
  if (!lib) return null;
  const name = { machineName: lib.machineName, majorVersion: lib.majorVersion, minorVersion: lib.minorVersion };
  const semantics = await editor.libraryManager.getSemantics(name);
  if (!lang || lang === 'en') return { lib, semantics };
  const key = `${lib.ubername}|${lang}`;
  if (!localizedCache.has(key)) {
    let localized = semantics;
    try {
      const raw = await editor.libraryManager.getLanguage(name, lang);
      const tr = raw ? JSON.parse(raw).semantics : null;
      if (Array.isArray(tr)) localized = mergeTranslation(JSON.parse(JSON.stringify(semantics)), tr);
    } catch {
      /* no translation for this library – keep English defaults */
    }
    localizedCache.set(key, localized);
  }
  return { lib, semantics: localizedCache.get(key) };
}

function mergeTranslation(fields, translations) {
  fields.forEach((field, i) => {
    const tr = translations[i];
    if (!field || !tr) return;
    if (tr.label) field.label = tr.label;
    if (tr.description) field.description = tr.description;
    if (tr.default !== undefined) field.default = tr.default;
    if (Array.isArray(field.fields) && Array.isArray(tr.fields)) mergeTranslation(field.fields, tr.fields);
    if (field.field && tr.field) mergeTranslation([field.field], [tr.field]);
    if (Array.isArray(field.options) && Array.isArray(tr.options)) {
      field.options.forEach((o, j) => {
        if (o && typeof o === 'object' && tr.options[j] && tr.options[j].label) o.label = tr.options[j].label;
      });
    }
  });
  return fields;
}

/**
 * Swaps interface texts (button labels, feedback templates …) that still carry the default
 * of one language for the default of another. Used for language versions of a course.
 */
export async function relocalizeParams(editor, ubername, params, fromLang, toLang) {
  if (!fromLang || !toLang || fromLang === toLang) return params;
  const from = await getSemantics(editor, ubername, fromLang);
  const to = await getSemantics(editor, ubername, toLang);
  if (!from || !to) return params;
  const copy = JSON.parse(JSON.stringify(params ?? {}));
  await walkPair(editor, from.semantics, to.semantics, copy, fromLang, toLang, 0);
  return copy;
}

async function walkPair(editor, fromFields, toFields, obj, fromLang, toLang, depth) {
  if (!obj || typeof obj !== 'object' || depth > 40) return;
  for (let i = 0; i < fromFields.length; i += 1) {
    const f = fromFields[i];
    const g = toFields[i];
    if (!f || !g || !f.name) continue;
    if (isSingleChildGroup(f)) {
      obj[f.name] = await relocalizeValue(editor, f.fields[0], g.fields[0], obj[f.name], fromLang, toLang, depth + 1);
    } else {
      obj[f.name] = await relocalizeValue(editor, f, g, obj[f.name], fromLang, toLang, depth + 1);
    }
  }
}

async function relocalizeValue(editor, f, g, value, fromLang, toLang, depth) {
  if (value === undefined || value === null) return value;
  switch (f.type) {
    case 'text':
      return f.default !== undefined && g.default !== undefined && value === f.default ? g.default : value;
    case 'group':
      if (typeof value === 'object') await walkPair(editor, f.fields || [], g.fields || [], value, fromLang, toLang, depth);
      return value;
    case 'list':
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) value[i] = await relocalizeValue(editor, f.field, g.field, value[i], fromLang, toLang, depth + 1);
      }
      return value;
    case 'library':
      if (value && typeof value === 'object' && value.library && value.params) {
        value.params = await relocalizeParams(editor, value.library, value.params, fromLang, toLang);
      }
      return value;
    default:
      return value;
  }
}

const isSingleChildGroup = (field) => field.type === 'group' && Array.isArray(field.fields) && field.fields.length === 1;

function stripHtml(value) {
  return typeof value === 'string' ? value.replace(/<[^>]+>/g, '').trim() : value;
}

/** Fields that are almost always fine with their defaults (UI texts, behaviour toggles). */
function isNoise(field) {
  if (field.common === true) return true;
  if (field.widget === 'none') return true;
  if (field.importance === 'low' && field.default !== undefined) return true;
  return false;
}

function fieldToSchema(field, opts, depth) {
  const out = {};
  const label = stripHtml(field.label);
  const desc = [label, stripHtml(field.description)].filter(Boolean).join(' – ');
  if (desc) out.description = desc;
  if (field.default !== undefined) out.default = field.default;
  if (depth > MAX_DEPTH) return { ...out, type: 'object' };

  switch (field.type) {
    case 'text': {
      out.type = 'string';
      if (field.widget === 'html' || field.tags) out.format = 'html';
      if (field.maxLength) out.maxLength = field.maxLength;
      if (field.regexp && field.regexp.pattern) out.pattern = field.regexp.pattern;
      if (field.widget === 'colorSelector') out.format = 'color';
      break;
    }
    case 'number':
      out.type = 'number';
      if (field.min !== undefined) out.minimum = Number(field.min);
      if (field.max !== undefined) out.maximum = Number(field.max);
      break;
    case 'boolean':
      out.type = 'boolean';
      break;
    case 'select':
      out.enum = (field.options || []).map((o) => o.value);
      break;
    case 'list': {
      out.type = 'array';
      out.items = fieldToSchema(field.field, opts, depth + 1);
      if (field.min !== undefined) out.minItems = Number(field.min);
      if (field.max !== undefined) out.maxItems = Number(field.max);
      break;
    }
    case 'group': {
      if (isSingleChildGroup(field)) {
        const inner = fieldToSchema(field.fields[0], opts, depth + 1);
        return { ...inner, description: [desc, inner.description].filter(Boolean).join(' / ') };
      }
      Object.assign(out, groupToSchema(field.fields || [], opts, depth + 1));
      break;
    }
    case 'library': {
      out.type = 'object';
      out.description = `${desc ? desc + '. ' : ''}Eingebetteter Inhalt: {"library": "<Name Version>", "params": {...}}. Erlaubt: ${(field.options || []).join(', ')}. Für die params eines Typs get_content_schema mit diesem Namen aufrufen.`;
      out.properties = {
        library: { enum: field.options || [] },
        params: { type: 'object' },
        metadata: { type: 'object', description: 'optional, z. B. {"title": "..."}' }
      };
      out.required = ['library', 'params'];
      break;
    }
    case 'image':
    case 'video':
    case 'audio':
    case 'file': {
      const media = field.type === 'image' || field.type === 'file'
        ? { type: 'object', properties: { path: { type: 'string' }, mime: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' } }, required: ['path'] }
        : { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, mime: { type: 'string' } }, required: ['path'] } };
      Object.assign(out, media);
      out.description = `${desc ? desc + '. ' : ''}Mediendatei: zuerst upload_asset aufrufen und das zurückgegebene Objekt hier einsetzen.`;
      break;
    }
    default:
      out.type = 'object';
  }
  return out;
}

function groupToSchema(fields, opts, depth) {
  const properties = {};
  const required = [];
  for (const f of fields) {
    if (!f || !f.name) continue;
    if (opts.compact && isNoise(f) && f.optional !== false) continue;
    properties[f.name] = fieldToSchema(f, opts, depth);
    if (!f.optional && f.default === undefined && f.type !== 'boolean') required.push(f.name);
  }
  const schema = { type: 'object', properties };
  if (required.length) schema.required = required;
  return schema;
}

export function describeSchema(semantics, { compact = true } = {}) {
  const schema = groupToSchema(semantics, { compact }, 0);
  schema.$schema = 'https://json-schema.org/draft/2020-12/schema';
  if (compact) {
    schema.$comment =
      'Kompakte Ansicht: Oberflächentexte und Verhaltensoptionen mit Standardwert sind ausgeblendet und werden automatisch befüllt. Mit compact=false alle Felder anzeigen.';
  }
  return schema;
}

// ---------------------------------------------------------------------------
// Normalisation + validation
// ---------------------------------------------------------------------------

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * Fills defaults, checks types/required fields and recurses into embedded libraries.
 * Returns { params, errors } – errors is a list of human readable messages with JSON paths.
 */
export async function normalizeParams(editor, ubername, params, lang) {
  const errors = [];
  const resolved = await getSemantics(editor, ubername, lang);
  if (!resolved) return { params, errors: [`Inhaltstyp ${ubername} ist nicht installiert.`] };
  const ctx = { lang };
  const result = await normalizeGroup(editor, resolved.semantics, params ?? {}, '$', errors, 0, ctx);
  return { params: result, errors, library: resolved.lib };
}

async function normalizeGroup(editor, fields, value, path, errors, depth, ctx = {}) {
  const obj = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
  if (value !== undefined && (typeof value !== 'object' || Array.isArray(value))) {
    errors.push(`${path}: Objekt erwartet.`);
  }
  for (const field of fields) {
    if (!field || !field.name) continue;
    const childPath = `${path}.${field.name}`;
    const normalized = await normalizeField(editor, field, obj[field.name], childPath, errors, depth + 1, ctx);
    if (normalized === undefined) delete obj[field.name];
    else obj[field.name] = normalized;
  }
  return obj;
}

async function normalizeField(editor, field, value, path, errors, depth, ctx = {}) {
  if (depth > 40) return value;
  const missing = value === undefined || value === null || value === '';

  if (missing) {
    if (field.default !== undefined) return clone(field.default);
    // An absent optional area (App-Simulation info step without a target) must stay absent,
    // otherwise the learner sees a highlight frame at the default position.
    if (field.type === 'group' && field.optional && field.widget === 'appSimArea') return undefined;
    if (field.type === 'group') {
      // groups without values still get their children's defaults
      if (isSingleChildGroup(field)) {
        return normalizeField(editor, field.fields[0], undefined, path, field.optional ? [] : errors, depth + 1, { ...ctx, absentGroup: ctx.absentGroup || depth >= 3 });
      }
      const filled = await normalizeGroup(editor, field.fields || [], {}, path, field.optional ? [] : errors, depth, { ...ctx, absentGroup: ctx.absentGroup || depth >= 3 });
      return Object.keys(filled).length ? filled : undefined;
    }
    if (field.type === 'list') {
      const min = Number(field.min || 0);
      if (min > 0 && !field.optional) errors.push(`${path}: mindestens ${min} Einträge erforderlich.`);
      return field.optional ? undefined : [];
    }
    if (field.type === 'boolean') return false;
    // Like the H5P editor: an empty select is valid, and numbers/selects inside a group the
    // author did not supply at all fall back to the runtime defaults.
    if (field.type === 'select') return undefined;
    // Nested sub-groups the author left out entirely (e.g. adaptivity.correct) are optional in practice.
    if (ctx.absentGroup) return undefined;
    if (!field.optional && field.widget !== 'none') errors.push(`${path}: Pflichtfeld fehlt (${stripHtml(field.label) || field.name}).`);
    return undefined;
  }

  switch (field.type) {
    case 'text':
      if (typeof value !== 'string') {
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        errors.push(`${path}: Text erwartet.`);
        return undefined;
      }
      if (field.maxLength && stripHtml(value).length > field.maxLength) {
        errors.push(`${path}: höchstens ${field.maxLength} Zeichen.`);
      }
      if (field.regexp && field.regexp.pattern) {
        try {
          if (!new RegExp(field.regexp.pattern, field.regexp.modifiers || '').test(value)) {
            errors.push(`${path}: Format passt nicht (${field.regexp.pattern}).`);
          }
        } catch {
          /* ignore invalid patterns from libraries */
        }
      }
      return value;
    case 'number': {
      let n = value;
      if (typeof value === 'string') {
        const tc = value.trim().match(/^(?:(\d+):)?(\d+):(\d{1,2}(?:\.\d+)?)$/);
        n = tc ? Number(tc[1] || 0) * 3600 + Number(tc[2]) * 60 + Number(tc[3]) : Number(value);
      }
      if (typeof n !== 'number' || Number.isNaN(n)) {
        errors.push(`${path}: Zahl erwartet.`);
        return undefined;
      }
      if (field.min !== undefined && n < Number(field.min)) errors.push(`${path}: mindestens ${field.min}.`);
      if (field.max !== undefined && n > Number(field.max)) errors.push(`${path}: höchstens ${field.max}.`);
      return n;
    }
    case 'boolean':
      if (typeof value !== 'boolean') {
        if (value === 'true' || value === 'false') return value === 'true';
        errors.push(`${path}: true/false erwartet.`);
        return undefined;
      }
      return value;
    case 'select': {
      const allowed = (field.options || []).map((o) => o.value);
      if (field.multiple) {
        const arr = Array.isArray(value) ? value : [value];
        arr.forEach((v) => !allowed.includes(v) && errors.push(`${path}: "${v}" nicht erlaubt (${allowed.join(', ')}).`));
        return arr;
      }
      if (!allowed.includes(value)) errors.push(`${path}: "${value}" nicht erlaubt (${allowed.join(', ')}).`);
      return value;
    }
    case 'list': {
      if (!Array.isArray(value)) {
        errors.push(`${path}: Liste erwartet.`);
        return undefined;
      }
      if (field.min !== undefined && value.length < Number(field.min)) errors.push(`${path}: mindestens ${field.min} Einträge.`);
      if (field.max !== undefined && value.length > Number(field.max)) errors.push(`${path}: höchstens ${field.max} Einträge.`);
      const out = [];
      for (let i = 0; i < value.length; i += 1) {
        const item = await normalizeField(editor, field.field, value[i], `${path}[${i}]`, errors, depth + 1, ctx);
        if (item !== undefined) out.push(item);
      }
      return out;
    }
    case 'group':
      if (isSingleChildGroup(field)) {
        return normalizeField(editor, field.fields[0], value, path, errors, depth + 1, ctx);
      }
      return normalizeGroup(editor, field.fields || [], value, path, errors, depth, ctx);
    case 'library': {
      if (typeof value !== 'object' || !value.library) {
        errors.push(`${path}: {"library": "...", "params": {...}} erwartet.`);
        return undefined;
      }
      const options = field.options || [];
      const wantedName = String(value.library).split(/[ -]/)[0];
      const match = options.find((o) => o === value.library) || options.find((o) => o.split(' ')[0] === wantedName);
      if (!match) {
        errors.push(`${path}: ${value.library} ist hier nicht erlaubt. Erlaubt: ${options.join(', ')}`);
        return undefined;
      }
      const sub = await getSemantics(editor, match, ctx.lang);
      if (!sub) {
        errors.push(`${path}: ${match} ist nicht installiert.`);
        return undefined;
      }
      const params = await normalizeGroup(editor, sub.semantics, value.params ?? {}, `${path}.params`, errors, depth + 1, ctx);
      return {
        library: sub.lib.ubername,
        params,
        subContentId: value.subContentId || crypto.randomUUID(),
        metadata: { contentType: wantedName, license: 'U', title: 'Untitled', ...(value.metadata || {}) }
      };
    }
    case 'image':
    case 'file':
      if (typeof value !== 'object' || !value.path) {
        errors.push(`${path}: Mediendatei erwartet ({"path": ...} aus upload_asset).`);
        return undefined;
      }
      return value;
    case 'video':
    case 'audio': {
      const arr = Array.isArray(value) ? value : [value];
      if (!arr.every((v) => v && typeof v === 'object' && v.path)) {
        errors.push(`${path}: Liste von Mediendateien erwartet ([{"path": ...}]).`);
        return undefined;
      }
      return arr;
    }
    default:
      return value;
  }
}
