import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { ZipArchive } from 'archiver';
import HtmlExporterModule from '@lumieducation/h5p-html-exporter';
import { config } from '../config.js';
import { db, newId, audit, parseJson } from '../db.js';
import { assertCourse } from '../access.js';
import { toH5pUser } from '../h5p.js';
import { getCourse, getH5P } from '../services.js';
import { referencedMedia, mediaPath } from '../blocks.js';
import { h5pLanguage, shellLabels, playerLabels, languageDirection } from '../languages.js';

const HtmlExporter = HtmlExporterModule.default || HtmlExporterModule;
const here = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = path.join(here, 'runtime');
const SCHEMA_DIR = path.join(here, 'schemas');
const FONT_FILE = path.join(here, '..', '..', 'public', 'assets', 'fonts', 'Geist-Variable.woff2');

export const FORMATS = {
  scorm12: { label: 'SCORM 1.2', ext: 'zip' },
  scorm2004: { label: 'SCORM 2004 (4th Ed.)', ext: 'zip' },
  html: { label: 'HTML (ohne LMS)', ext: 'zip' },
  xapi: { label: 'xAPI (Tin Can)', ext: 'zip' },
  cmi5: { label: 'cmi5', ext: 'zip' }
};
const XAPI_FORMATS = new Set(['xapi', 'cmi5']);

/** Stable activity IRI of a course (same across versions and languages of one package id). */
export const activityIri = (course) => `${config.publicUrl.replace(/\/$/, '')}/xapi/activities/PP-${course.package_uuid}`;

function xapiScript(payload, base = 'runtime/') {
  return payload.xapi ? `<script>window.PP_XAPI = ${jsonForScript(payload.xapi)};</script>\n<script src="${base}xapi.js"></script>\n` : '';
}

function tincanXml(course) {
  const lang = esc(course.language);
  return `<?xml version="1.0" encoding="UTF-8"?>
<tincan xmlns="http://projecttincan.com/tincan.xsd">
  <activities>
    <activity id="${esc(activityIri(course))}" type="http://adlnet.gov/expapi/activities/course">
      <name lang="${lang}">${esc(course.title)}</name>
      <description lang="${lang}">${esc(course.description || course.title)}</description>
      <launch lang="${lang}">index.html</launch>
    </activity>
  </activities>
</tincan>
`;
}

function cmi5Xml(course, scoredAny, settings) {
  const lang = esc(course.language);
  const iri = activityIri(course);
  const scored = scoredAny && settings.completion === 'all';
  const mastery = scored ? ` masteryScore="${Math.round(settings.masteryScore) / 100}"` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<courseStructure xmlns="https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd">
  <course id="${esc(iri)}/course">
    <title><langstring lang="${lang}">${esc(course.title)}</langstring></title>
    <description><langstring lang="${lang}">${esc(course.description || course.title)}</langstring></description>
  </course>
  <au id="${esc(iri)}" moveOn="${scored ? 'CompletedAndPassed' : 'Completed'}"${mastery} launchMethod="AnyWindow">
    <title><langstring lang="${lang}">${esc(course.title)}</langstring></title>
    <description><langstring lang="${lang}">${esc(course.description || course.title)}</langstring></description>
    <url>index.html</url>
  </au>
</courseStructure>
`;
}

/** Libraries that report a score themselves. */
const SCORED = new Set([
  'H5P.MultiChoice', 'H5P.TrueFalse', 'H5P.Blanks', 'H5P.DragText', 'H5P.DragQuestion', 'H5P.MarkTheWords',
  'H5P.Summary', 'H5P.SingleChoiceSet', 'H5P.QuestionSet', 'H5P.ImageHotspotQuestion',
  'H5P.ImageMultipleHotspotQuestion', 'H5P.ImagePair', 'H5P.ImageSequencing', 'H5P.Essay', 'H5P.ArithmeticQuiz',
  'H5P.Crossword', 'H5P.FindTheWords', 'H5P.SortParagraphs', 'H5P.MultiMediaChoice', 'H5P.Dictation',
  'H5P.SpeakTheWords', 'H5P.SpeakTheWordsSet', 'H5P.MemoryGame'
]);

const NEEDS_COMPLETION = new Set(['H5P.AppSimulation', 'H5P.Scenario']);

/** Containers count as scored if they contain a scored library somewhere inside. */
export function isScored(library, params) {
  const main = String(library).split(' ')[0];
  if (main === 'H5P.AppSimulation') {
    const tasks = (params?.chapters || []).some((c) => (c?.steps || []).some((st) => (st?.kind || 'click') === 'click' && st?.area));
    return (params?.behaviour?.scoring || 'firstTry') !== 'none' && tasks;
  }
  if (main === 'H5P.Scenario') {
    const points = (params?.scenes || []).some((sc) => (sc?.choices || []).some((c) => Number(c?.points) > 0));
    return (params?.behaviour?.scoring || 'points') !== 'none' && points;
  }
  if (SCORED.has(main)) return true;
  let found = false;
  const walk = (node, depth) => {
    if (found || depth > 30 || !node || typeof node !== 'object') return;
    if (typeof node.library === 'string' && SCORED.has(node.library.split(' ')[0])) {
      found = true;
      return;
    }
    for (const v of Array.isArray(node) ? node : Object.values(node)) walk(v, depth + 1);
  };
  walk(params, 0);
  return found;
}


const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const jsonForScript = (v) =>
  JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function unitTemplate(unitMeta, language) {
  return (integration, scriptsBundle, stylesBundle, contentId) => `<!doctype html>
<html lang="${esc(language)}" dir="${languageDirection(language)}" class="h5p-iframe">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(unitMeta.title)}</title>
<script>window.SS_UNIT = ${jsonForScript(unitMeta)};
H5PIntegration = ${jsonForScript(integration)};
${scriptsBundle}</script>
<script src="../../runtime/unit.js"></script>
<style>${stylesBundle}</style>
<style>html,body{margin:0;background:#fff}.ss-unit-wrap{max-width:980px;margin:0 auto;padding:24px 16px 48px}</style>
</head>
<body>
<div class="ss-unit-wrap"><div class="h5p-content lag" data-content-id="${esc(contentId)}"></div></div>
</body>
</html>`;
}

function shellHtml(course, project, payload, labels) {
  const branding = parseJson(project.branding, {});
  const vars = [];
  if (branding.primaryColor) vars.push(`--ss-primary:${branding.primaryColor}`);
  if (branding.accentColor) vars.push(`--ss-accent:${branding.accentColor}`);
  if (branding.fontFamily) vars.push(`--ss-font:${branding.fontFamily}`);
  const list = payload.settings.showUnitList !== false && payload.units.length > 1;
  return `<!doctype html>
<html lang="${esc(course.language)}" dir="${languageDirection(course.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(course.title)}</title>
<link rel="stylesheet" href="runtime/shell.css">
${vars.length ? `<style>:root{${vars.join(';')}}</style>` : ''}
</head>
<body class="${list ? '' : 'ss-no-list'}">
<header class="ss-head">
  <button type="button" class="ss-menu-btn" id="ss-menu" aria-controls="ss-side">${esc(labels.menu)}</button>
  <h1>${esc(course.title)}</h1>
  ${branding.organization ? `<span class="ss-org">${esc(branding.organization)}</span>` : ''}
</header>
<p class="ss-warning" id="ss-lms-warning" hidden>${esc(labels.lmsWarning)}</p>
<nav class="ss-side" id="ss-side" aria-label="${esc(labels.menu)}">
  <div class="ss-progress">
    <div class="ss-progress-track"><div class="ss-progress-bar" id="ss-progress-bar"></div></div>
    <div class="ss-progress-meta"><span id="ss-progress-text"></span><span id="ss-score" hidden></span></div>
  </div>
  <ol class="ss-units" id="ss-units"></ol>
</nav>
<main class="ss-main"><iframe id="ss-frame" title="" allow="fullscreen; autoplay; microphone" allowfullscreen></iframe></main>
<footer class="ss-foot">
  <button type="button" class="ss-nav" id="ss-prev">${esc(labels.prev)}</button>
  <button type="button" class="ss-nav is-primary" id="ss-next">${esc(labels.next)}</button>
</footer>
<script>window.SS_COURSE = ${jsonForScript(payload)};</script>
${xapiScript(payload)}<script src="runtime/shell.js"></script>
</body>
</html>`;
}

/** Entry page of a block course: the block player renders everything from PP_COURSE. */
export function playerHtml(course, payload, { assetBase = 'runtime/' } = {}) {
  const dir = payload.design.direction === 'rtl' || languageDirection(course.language) === 'rtl' ? 'rtl' : 'ltr';
  payload = { ...payload, uiLabels: playerLabels(course.language), dir };
  return `<!doctype html>
<html lang="${esc(course.language)}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(course.title)}</title>
<link rel="stylesheet" href="${assetBase}player.css">
</head>
<body class="pp-body">
<div id="pp-app"></div>
<noscript>JavaScript is required.</noscript>
<script>window.PP_COURSE = ${jsonForScript(payload)};</script>
${xapiScript(payload, assetBase)}<script src="${assetBase}blocks.js"></script>
<script src="${assetBase}player.js"></script>
</body>
</html>`;
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

function manifest12(course, files, scoredAny, settings) {
  const id = `PP-${course.package_uuid}`;
  const mastery = scoredAny && settings.completion === 'all' ? `\n        <adlcp:masteryscore>${settings.masteryScore}</adlcp:masteryscore>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${esc(id)}" version="${course.version}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${esc(course.title)}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">
        <title>${esc(course.title)}</title>${mastery}
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
${files.map((f) => `      <file href="${esc(f)}"/>`).join('\n')}
    </resource>
  </resources>
</manifest>
`;
}

function manifest2004(course, files) {
  const id = `PP-${course.package_uuid}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${esc(id)}" version="${course.version}"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${esc(course.title)}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">
        <title>${esc(course.title)}</title>
      </item>
      <imsss:sequencing>
        <imsss:controlMode choice="true" flow="true"/>
      </imsss:sequencing>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormType="sco" href="index.html">
${files.map((f) => `      <file href="${esc(f)}"/>`).join('\n')}
    </resource>
  </resources>
</manifest>
`;
}

async function zipDir(dir, target) {
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const out = fs.createWriteStream(target);
  archive.directory(dir, false);
  const done = pipeline(archive, out);
  await archive.finalize();
  await done;
}

/**
 * Builds the package directory for a course. Returns { dir, report }.
 * The directory is a temp folder the caller must clean up (or keep for previews).
 */
export async function buildPackage(user, courseId, format) {
  if (!FORMATS[format]) throw Object.assign(new Error('Unbekanntes Exportformat.'), { status: 400 });
  const { course, project } = assertCourse(user, courseId, 'viewer');
  const full = getCourse(user, courseId);
  const blockMode = full.settings.mode === 'blocks';
  if (blockMode && !full.blocks.length) throw Object.assign(new Error('Der Kurs hat noch keine Blöcke.'), { status: 400 });
  if (blockMode) {
    const open = full.blocks.map((b, i) => ({ b, i })).filter((x) => x.b.issues?.length);
    if (open.length) {
      throw Object.assign(new Error(`${open.length} ${open.length === 1 ? 'Block ist' : 'Blöcke sind'} noch unvollständig.`), {
        status: 400,
        details: open.flatMap((x) => x.b.issues.map((m) => `Block ${x.i + 1} (${x.b.type}): ${m}`)).slice(0, 20)
      });
    }
    const unitIds = new Set(full.units.map((u) => u.id));
    const gone = full.blocks.filter((b) => b.type === 'h5p' && !unitIds.has(b.data.unitId));
    if (gone.length) throw Object.assign(new Error('Ein H5P-Block verweist auf eine gelöschte Einheit.'), { status: 400 });
  }
  if (!blockMode && !full.units.length) throw Object.assign(new Error('Der Kurs hat noch keine Einheiten.'), { status: 400 });
  const settings = full.settings;
  const { editor } = getH5P();
  const h5pUser = toH5pUser(user);
  const language = h5pLanguage(course.language);
  const labels = shellLabels(course.language);

  const dir = await fs.promises.mkdtemp(path.join(config.tmpDir, 'pkg-'));
  const warnings = [];
  const unitsPayload = [];

  for (let i = 0; i < full.units.length; i += 1) {
    const unit = full.units[i];
    const folder = `u${String(i + 1).padStart(2, '0')}`;
    const unitDir = path.join(dir, 'units', folder);
    await fs.promises.mkdir(unitDir, { recursive: true });
    const content = await editor.getContent(unit.contentId, h5pUser);
    const scored = isScored(unit.library, content.params.params);
    const exporter = new HtmlExporter(
      editor.libraryStorage,
      editor.contentStorage,
      editor.config,
      config.h5p.bundledCore,
      config.h5p.bundledEditor,
      unitTemplate({ id: unit.id, title: unit.title }, course.language)
    );
    const { html, contentFiles } = await exporter.createBundleWithExternalContentResources(unit.contentId, h5pUser, 'content', {
      language,
      showFrame: false,
      showLicenseButton: false,
      showEmbedButton: false
    });
    await fs.promises.writeFile(path.join(unitDir, 'index.html'), html);
    for (const file of contentFiles) {
      const target = path.join(unitDir, 'content', file);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      const stream = await editor.contentStorage.getFileStream(unit.contentId, file, h5pUser);
      await pipeline(stream, fs.createWriteStream(target));
    }
    // Content types that only count as done once they report "completed" (not merely opened).
    const finish = NEEDS_COMPLETION.has(String(unit.library).split(' ')[0]);
    unitsPayload.push({ id: unit.id, title: unit.title, href: `units/${folder}/index.html`, weight: unit.weight, scored, finish, library: String(unit.library).split(' ')[0] });
  }

  const scormVersion = format === 'scorm2004' || XAPI_FORMATS.has(format) ? '2004' : '1.2';
  if (blockMode) return finishBlockPackage({ dir, course, full, settings, unitsPayload, format, scormVersion, warnings });

  const scoredAny = unitsPayload.some((u) => u.scored);
  if (settings.completion === 'all' && !scoredAny) {
    warnings.push('Kein Inhalt im Kurs vergibt Punkte. Der Kurs gilt als abgeschlossen, sobald alle Einheiten geöffnet wurden.');
  }
  if (scoredAny && unitsPayload.some((u) => u.scored && u.weight === 0)) {
    warnings.push('Mindestens eine bewertete Einheit hat die Gewichtung 0 und zählt nicht zur Note.');
  }

  await fs.promises.mkdir(path.join(dir, 'runtime'), { recursive: true });
  for (const f of ['shell.js', 'shell.css', 'unit.js']) {
    await fs.promises.copyFile(path.join(RUNTIME_DIR, f), path.join(dir, 'runtime', f));
  }

  const payload = {
    title: course.title,
    packageUuid: course.package_uuid,
    scormVersion,
    settings: { completion: settings.completion, masteryScore: settings.masteryScore, navigation: settings.navigation, showUnitList: settings.showUnitList },
    units: unitsPayload,
    labels,
    ...(XAPI_FORMATS.has(format) ? { xapi: xapiConfig(course, format, scoredAny, settings) } : {})
  };
  await fs.promises.writeFile(path.join(dir, 'index.html'), shellHtml(course, project, payload, labels));
  await writeXapiFiles(dir, course, format, scoredAny, settings);

  if (format === 'scorm12' || format === 'scorm2004') {
    const schemaSrc = path.join(SCHEMA_DIR, format === 'scorm2004' ? 'scorm2004' : 'scorm12');
    for (const f of fs.readdirSync(schemaSrc)) await fs.promises.copyFile(path.join(schemaSrc, f), path.join(dir, f));
  }
  const files = listFiles(dir).filter((f) => f !== 'imsmanifest.xml');
  const contentFiles = files.filter((f) => !f.endsWith('.xsd') && !f.endsWith('.dtd'));
  if (format === 'scorm12') await fs.promises.writeFile(path.join(dir, 'imsmanifest.xml'), manifest12(course, contentFiles, scoredAny, settings));
  if (format === 'scorm2004') await fs.promises.writeFile(path.join(dir, 'imsmanifest.xml'), manifest2004(course, contentFiles));

  return {
    dir,
    report: {
      format,
      language: course.language,
      units: unitsPayload.length,
      scoredUnits: unitsPayload.filter((u) => u.scored).length,
      files: files.length + (format === 'scorm12' || format === 'scorm2004' ? 1 : 0),
      completion: settings.completion,
      masteryScore: settings.masteryScore,
      scormVersion: format === 'scorm12' || format === 'scorm2004' ? scormVersion : null,
      ...(XAPI_FORMATS.has(format) ? { activityId: activityIri(course) } : {}),
      packageId: `PP-${course.package_uuid}`,
      warnings
    }
  };
}

function xapiConfig(course, format, scoredAny, settings) {
  return {
    mode: format,
    activityId: activityIri(course),
    title: course.title,
    language: course.language,
    masteryScore: scoredAny && settings.completion === 'all' ? settings.masteryScore / 100 : null
  };
}

async function writeXapiFiles(dir, course, format, scoredAny, settings) {
  if (!XAPI_FORMATS.has(format)) return;
  await fs.promises.copyFile(path.join(RUNTIME_DIR, 'xapi.js'), path.join(dir, 'runtime', 'xapi.js'));
  if (format === 'xapi') await fs.promises.writeFile(path.join(dir, 'tincan.xml'), tincanXml(course));
  else await fs.promises.writeFile(path.join(dir, 'cmi5.xml'), cmi5Xml(course, scoredAny, settings));
}

const GRADED_BLOCKS = new Set(['quiz', 'matching', 'sorting', 'fillBlanks', 'bucketSort', 'assessment']);

async function finishBlockPackage({ dir, course, full, settings, unitsPayload, format, scormVersion, warnings }) {
  const used = new Set(full.blocks.filter((b) => b.type === 'h5p').map((b) => b.data.unitId));
  const units = {};
  for (const u of unitsPayload) if (used.has(u.id)) units[u.id] = u;
  // runtime + font
  await fs.promises.mkdir(path.join(dir, 'runtime', 'fonts'), { recursive: true });
  for (const f of ['blocks.js', 'player.js', 'player.css', 'unit.js']) await fs.promises.copyFile(path.join(RUNTIME_DIR, f), path.join(dir, 'runtime', f));
  if (fs.existsSync(FONT_FILE)) await fs.promises.copyFile(FONT_FILE, path.join(dir, 'runtime', 'fonts', 'Geist-Variable.woff2'));
  // media
  const media = referencedMedia(full.blocks, full.design);
  if (media.length) await fs.promises.mkdir(path.join(dir, 'media'), { recursive: true });
  for (const name of media) {
    const src = mediaPath(full.id, name);
    if (src) await fs.promises.copyFile(src, path.join(dir, 'media', name));
    else warnings.push(`Datei ${name} fehlt und ist nicht im Paket.`);
  }
  // remove packaged units that no block uses (keeps the package small)
  for (const u of unitsPayload) {
    if (!used.has(u.id)) await fs.promises.rm(path.join(dir, path.dirname(u.href)), { recursive: true, force: true });
  }
  const gradedBlocks = full.blocks.filter((b) => GRADED_BLOCKS.has(b.type)).length;
  const scoredUnits = Object.values(units).filter((u) => u.scored).length;
  const scoredAny = gradedBlocks + scoredUnits > 0;
  if (settings.completion === 'all' && !scoredAny) warnings.push('Kein Block vergibt Punkte. Der Kurs gilt als abgeschlossen, sobald alle Lektionen bearbeitet sind.');
  const payload = {
    title: course.title,
    description: course.description,
    language: course.language,
    packageUuid: course.package_uuid,
    scormVersion,
    settings: { completion: settings.completion, masteryScore: settings.masteryScore, navigation: settings.navigation },
    design: full.design,
    blocks: full.blocks,
    units,
    mediaBase: 'media/',
    ...(XAPI_FORMATS.has(format) ? { xapi: xapiConfig(course, format, scoredAny, settings) } : {})
  };
  await fs.promises.writeFile(path.join(dir, 'index.html'), playerHtml(course, payload));
  await writeXapiFiles(dir, course, format, scoredAny, settings);
  if (format === 'scorm12' || format === 'scorm2004') {
    const schemaSrc = path.join(SCHEMA_DIR, format === 'scorm2004' ? 'scorm2004' : 'scorm12');
    for (const f of fs.readdirSync(schemaSrc)) await fs.promises.copyFile(path.join(schemaSrc, f), path.join(dir, f));
  }
  const files = listFiles(dir).filter((f) => f !== 'imsmanifest.xml');
  const contentFiles = files.filter((f) => !f.endsWith('.xsd') && !f.endsWith('.dtd'));
  if (format === 'scorm12') await fs.promises.writeFile(path.join(dir, 'imsmanifest.xml'), manifest12(course, contentFiles, scoredAny, settings));
  if (format === 'scorm2004') await fs.promises.writeFile(path.join(dir, 'imsmanifest.xml'), manifest2004(course, contentFiles));
  return {
    dir,
    report: {
      format,
      mode: 'blocks',
      language: course.language,
      design: full.design.player,
      blocks: full.blocks.length,
      lessons: full.outline.length,
      units: Object.keys(units).length,
      scoredUnits: scoredUnits + gradedBlocks,
      gradedBlocks,
      media: media.length,
      files: files.length + (format === 'scorm12' || format === 'scorm2004' ? 1 : 0),
      completion: settings.completion,
      masteryScore: settings.masteryScore,
      scormVersion: format === 'scorm12' || format === 'scorm2004' ? scormVersion : null,
      ...(XAPI_FORMATS.has(format) ? { activityId: activityIri(course) } : {}),
      packageId: `PP-${course.package_uuid}`,
      warnings
    }
  };
}

export async function exportCourse(user, courseId, format, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  fs.mkdirSync(config.tmpDir, { recursive: true });
  fs.mkdirSync(config.exportsDir, { recursive: true });
  if (format !== 'html') {
    db.prepare("UPDATE courses SET version = version + 1, updated_at = updated_at WHERE id = ?").run(courseId);
  }
  const fresh = db.prepare('SELECT version FROM courses WHERE id = ?').get(courseId);
  const { dir, report } = await buildPackage(user, courseId, format);
  const id = newId('x_');
  const file = path.join(config.exportsDir, `${id}.zip`);
  try {
    await zipDir(dir, file);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
  const size = fs.statSync(file).size;
  report.version = fresh.version;
  report.size = size;
  db.prepare('INSERT INTO exports (id, course_id, user_id, format, version, file, size, report) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    id,
    courseId,
    user.id,
    format,
    fresh.version,
    file,
    size,
    JSON.stringify(report)
  );
  audit(user.id, 'course.export', courseId, { format, exportId: id }, via);
  return { id, courseId, format, version: fresh.version, size, report, filename: downloadName(course.title, fresh.version, format) };
}

export function downloadName(title, version, format) {
  const slug = String(title)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'kurs';
  return `${slug}_v${version}_${format}.zip`;
}

/** Unpacks an export for the in-app LMS preview. Returns the directory. */
export async function ensurePreview(exportRow) {
  const dir = path.join(config.previewDir, exportRow.id);
  if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  const AdmZip = (await import('adm-zip')).default;
  await fs.promises.mkdir(dir, { recursive: true });
  new AdmZip(exportRow.file).extractAllTo(dir, true);
  return dir;
}
