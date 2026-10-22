/**
 * Project import/export.
 *  - Export: ZIP with project.json + one .h5p per unit (re-importable, also openable in Lumi).
 *  - Import: our project ZIP, a single .h5p (e.g. from Lumi), or a ZIP full of .h5p files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { ZipArchive } from 'archiver';
import AdmZip from 'adm-zip';
import { config } from './config.js';
import { audit, parseJson } from './db.js';
import { assertProject, assertCourse } from './access.js';
import { toH5pUser } from './h5p.js';
import { getH5P, getProject, getCourse, createProject, createCourse, createUnit, attachContent, updateUnit, ValidationError, invalidateContentTypes } from './services.js';
import { detectAppSimPackage, buildAppSimParams } from './import/appsim.js';
import { detectRisePackage, riseToBlocks } from './import/rise.js';
import { saveMedia } from './blocks.js';
import { saveBlocks } from './services.js';

const FORMAT = 'plietschpaket-project';
const LEGACY_FORMATS = ['scorm-studio-project'];

export async function exportProjectZip(user, projectId, res) {
  assertProject(user, projectId, 'viewer');
  const project = getProject(user, projectId);
  const { editor } = getH5P();
  const h5pUser = toH5pUser(user);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const manifest = {
    format: FORMAT,
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    project: { name: project.name, description: project.description, branding: project.branding },
    courses: []
  };
  const tmp = await fs.promises.mkdtemp(path.join(config.tmpDir, 'pexp-'));
  try {
    for (const c of project.courses) {
      const course = getCourse(user, c.id);
      const entry = { title: course.title, description: course.description, language: course.language, settings: course.settings, units: [] };
      for (const u of course.units) {
        const file = path.join(tmp, `${u.id}.h5p`);
        await editor.exportContent(u.contentId, fs.createWriteStream(file), h5pUser);
        await waitForFile(file);
        archive.file(file, { name: `units/${u.id}.h5p` });
        entry.units.push({ title: u.title, library: u.library, weight: u.weight, file: `units/${u.id}.h5p` });
      }
      manifest.courses.push(entry);
    }
    archive.append(JSON.stringify(manifest, null, 2), { name: 'project.json' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slug(project.name)}_projekt.zip"`);
    const done = pipeline(archive, res);
    await archive.finalize();
    await done;
    audit(user.id, 'project.export', projectId);
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true });
  }
}

async function waitForFile(file) {
  // exportContent resolves when the stream was handed over; wait until it is flushed.
  for (let i = 0; i < 50; i += 1) {
    try {
      const st = fs.statSync(file);
      if (st.size > 0) {
        await new Promise((r) => setTimeout(r, 30));
        if (fs.statSync(file).size === st.size) return;
      }
    } catch {
      /* not yet there */
    }
    await new Promise((r) => setTimeout(r, 60));
  }
}

const slug = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'projekt';

// Zip-bomb protection: look at the declared sizes before anything is unpacked into memory.
const MAX_ENTRIES = 2000;
const MAX_TOTAL_UNPACKED = Math.max(2 * 1024 ** 3, config.maxUploadBytes * 3);
function checkZipLimits(entries) {
  if (entries.length > MAX_ENTRIES) throw new ValidationError(`Das Archiv enthält zu viele Dateien (max. ${MAX_ENTRIES}).`);
  let total = 0;
  for (const e of entries) {
    const size = Number(e.header.size) || 0;
    const packed = Number(e.header.compressedSize) || 0;
    if (size > config.maxUploadBytes) throw new ValidationError('Eine Datei im Archiv ist zu groß.');
    if (size > 10 * 1024 * 1024 && packed > 0 && size / packed > 200) throw new ValidationError('Das Archiv ist ungewöhnlich stark komprimiert und wird aus Sicherheitsgründen abgelehnt.');
    total += size;
  }
  if (total > MAX_TOTAL_UNPACKED) throw new ValidationError('Das Archiv ist entpackt zu groß.');
}

/** Imports one .h5p file as a new unit at the end of a course. */
export async function importH5pIntoCourse(user, courseId, filePath, { title } = {}, via = 'web') {
  assertCourse(user, courseId, 'editor');
  const { editor } = getH5P();
  let result;
  try {
    result = await editor.packageImporter.addPackageLibrariesAndContent(filePath, toH5pUser(user));
  } catch (err) {
    let size = -1;
    try {
      size = fs.statSync(filePath).size;
    } catch {
      /* file missing */
    }
    console.warn(`[import] .h5p fehlgeschlagen: ${err.message} (Datei ${path.basename(filePath)}, Größe ${size})`);
    throw new ValidationError(`Die H5P-Datei konnte nicht gelesen werden: ${err.message}`);
  }
  if (result.installedLibraries && result.installedLibraries.length) invalidateContentTypes();
  const meta = result.metadata;
  const library = `${meta.mainLibrary} ${findMainVersion(meta)}`;
  const unitTitle = (title || meta.title || path.basename(filePath, '.h5p')).toString().slice(0, 200);
  return attachContent(user, courseId, { contentId: String(result.id), title: unitTitle, library }, via);
}

function findMainVersion(meta) {
  const dep = (meta.preloadedDependencies || []).find((d) => d.machineName === meta.mainLibrary);
  return dep ? `${dep.majorVersion}.${dep.minorVersion}` : '1.0';
}

/**
 * Generic import entry point.
 * @param target { projectId?, courseId? } – where to import into. Without target a new project is created.
 */
export async function importFile(user, filePath, originalName, target = {}, via = 'web') {
  const lower = String(originalName || filePath).toLowerCase();
  const summary = { projectId: null, courses: [], units: 0, skipped: [] };

  if (lower.endsWith('.h5p')) {
    let courseId = target.courseId;
    let projectId = target.projectId;
    if (!courseId) {
      if (!projectId) projectId = createProject(user, { name: baseName(originalName) }, via).id;
      courseId = createCourse(user, projectId, { title: baseName(originalName) }, via).id;
    }
    const course = assertCourse(user, courseId, 'editor').course;
    await importH5pIntoCourse(user, courseId, filePath, {}, via);
    summary.projectId = course.project_id;
    summary.courses.push(courseId);
    summary.units = 1;
    audit(user.id, 'import.h5p', courseId, { file: originalName }, via);
    return summary;
  }

  if (!lower.endsWith('.zip')) throw new ValidationError('Unterstützt werden .h5p-Dateien und .zip-Archive (Projekt-Export oder mehrere .h5p).');
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries().filter((e) => !e.isDirectory && !e.entryName.startsWith('__MACOSX/'));
  checkZipLimits(entries);
  const manifestEntry = entries.find((e) => e.entryName === 'project.json');
  const tmp = await fs.promises.mkdtemp(path.join(config.tmpDir, 'pimp-'));
  try {
    if (manifestEntry) {
      const manifest = parseJson(manifestEntry.getData().toString('utf8'), null);
      if (!manifest || (manifest.format !== FORMAT && !LEGACY_FORMATS.includes(manifest.format))) throw new ValidationError('project.json ist kein Plietschpaket-Projekt.');
      let projectId = target.projectId;
      if (projectId) assertProject(user, projectId, 'editor');
      else projectId = createProject(user, { name: manifest.project?.name || baseName(originalName), description: manifest.project?.description || '' }, via).id;
      summary.projectId = projectId;
      for (const c of manifest.courses || []) {
        const course = createCourse(user, projectId, { title: c.title || 'Kurs', description: c.description, language: c.language, settings: c.settings }, via);
        summary.courses.push(course.id);
        for (const u of c.units || []) {
          const entry = entries.find((e) => e.entryName === u.file);
          if (!entry) {
            summary.skipped.push(`${u.title}: Datei ${u.file} fehlt`);
            continue;
          }
          const file = path.join(tmp, path.basename(u.file));
          fs.writeFileSync(file, entry.getData());
          try {
            const unit = await importH5pIntoCourse(user, course.id, file, { title: u.title }, via);
            if (u.weight !== undefined && u.weight !== 1) await updateUnit(user, unit.id, { weight: u.weight }, via);
            summary.units += 1;
          } catch (err) {
            summary.skipped.push(`${u.title}: ${err.message}`);
          }
        }
      }
      if (manifest.project?.branding && !target.projectId) {
        const { updateProject } = await import('./services.js');
        updateProject(user, projectId, { branding: manifest.project.branding }, via);
      }
      audit(user.id, 'import.project', projectId, { file: originalName, units: summary.units }, via);
      return summary;
    }

    // Articulate Rise 360 export → block course
    const rise = detectRisePackage(entries);
    if (rise) {
      let projectId = target.projectId;
      const courseTitle = String(rise.data.course?.title || baseName(originalName)).replace(/<[^>]*>/g, '').slice(0, 200) || 'Rise';
      if (!projectId) projectId = createProject(user, { name: courseTitle }, via).id;
      summary.projectId = projectId;
      const courseId = createCourse(user, projectId, { title: courseTitle, language: target.language || 'de', settings: { mode: 'blocks' } }, via).id;
      summary.courses.push(courseId);
      const byName = new Map();
      for (const e of entries) if (!e.isDirectory) byName.set(path.posix.basename(e.entryName).toLowerCase(), e);
      const saved = new Map();
      let missing = 0;
      const addMedia = (key) => {
        const name = path.posix.basename(String(key).split(/[?#]/)[0]).toLowerCase();
        if (saved.has(name)) return saved.get(name);
        const entry = byName.get(name);
        let ref = null;
        if (entry) {
          try {
            ref = saveMedia(courseId, name, entry.getData(), config.maxUploadBytes).ref;
          } catch {
            ref = null;
          }
        }
        if (!ref) missing++;
        saved.set(name, ref);
        return ref;
      };
      const built = riseToBlocks(rise.data, addMedia);
      const course = saveBlocks(user, courseId, built.blocks, { draft: true }, via);
      if (built.description) {
        const { updateCourse } = await import('./services.js');
        updateCourse(user, courseId, { description: built.description }, via);
      }
      summary.units = 0;
      summary.converted = { from: 'Rise 360', lessons: built.stats.lessons, blocks: course.blocks.length, mapped: built.stats.mapped, asText: built.stats.fallback, media: [...saved.values()].filter(Boolean).length, missingMedia: missing, incomplete: course.blocks.filter((b) => b.issues).length };
      audit(user.id, 'import.rise', courseId, { file: originalName, ...summary.converted }, via);
      return summary;
    }

    // Click-practice packages (course.json + screenshots) → editable App-Simulation unit
    const appsim = detectAppSimPackage(entries);
    if (appsim) {
      const { editor } = getH5P();
      const built = await buildAppSimParams(appsim, { editor, user });
      let courseId = target.courseId;
      if (courseId) {
        summary.projectId = assertCourse(user, courseId, 'editor').course.project_id;
      } else {
        let projectId = target.projectId;
        if (!projectId) projectId = createProject(user, { name: built.title }, via).id;
        summary.projectId = projectId;
        // Practice, not an exam: completion counts, the score is still reported to the LMS.
        courseId = createCourse(user, projectId, { title: built.title, language: built.language, settings: { masteryScore: 0 } }, via).id;
      }
      summary.courses.push(courseId);
      await createUnit(user, courseId, { library: 'H5P.AppSimulation', params: built.params, title: built.title }, via);
      summary.units = 1;
      summary.converted = { from: 'click-practice package', steps: built.stats.steps, media: built.stats.media };
      audit(user.id, 'import.appsim_package', courseId, { file: originalName, steps: built.stats.steps }, via);
      return summary;
    }

    const h5pEntries = entries.filter((e) => e.entryName.toLowerCase().endsWith('.h5p')).sort((a, b) => a.entryName.localeCompare(b.entryName, 'de'));
    if (!h5pEntries.length) {
      if (entries.some((e) => e.entryName.endsWith('imsmanifest.xml'))) {
        throw new ValidationError('Das ist ein SCORM-Paket. Importiert werden können .h5p-Dateien (z. B. aus Lumi: Datei → Speichern) oder Plietschpaket-Projekte.');
      }
      throw new ValidationError('Im Archiv wurden keine .h5p-Dateien gefunden.');
    }
    let courseId = target.courseId;
    if (courseId) {
      summary.projectId = assertCourse(user, courseId, 'editor').course.project_id;
    } else {
      let projectId = target.projectId;
      if (!projectId) projectId = createProject(user, { name: baseName(originalName) }, via).id;
      summary.projectId = projectId;
      courseId = createCourse(user, projectId, { title: baseName(originalName) }, via).id;
    }
    summary.courses.push(courseId);
    for (const e of h5pEntries) {
      const file = path.join(tmp, `${summary.units}-${path.basename(e.entryName)}`);
      fs.writeFileSync(file, e.getData());
      try {
        await importH5pIntoCourse(user, courseId, file, { title: baseName(e.entryName) }, via);
        summary.units += 1;
      } catch (err) {
        summary.skipped.push(`${e.entryName}: ${err.message}`);
      }
    }
    audit(user.id, 'import.h5p_bundle', courseId, { file: originalName, units: summary.units }, via);
    return summary;
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true });
  }
}

const baseName = (name) =>
  path
    .basename(String(name || 'Import'))
    .replace(/\.(h5p|zip)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .slice(0, 200) || 'Import';

export { getCourse };

/**
 * Lumi and other H5P editors open .h5p files, not SCORM packages. These exports hand out the H5P units of a course:
 * one unit as .h5p, or the whole course as a ZIP with numbered .h5p files. The files contain the libraries, so
 * Lumi can open App simulation and Role-play as well. Blocks of block courses have no H5P form and are not included.
 */
export async function exportUnitH5p(user, unitId, res) {
  const unit = await getUnitForExport(user, unitId);
  const { editor } = getH5P();
  const tmp = await fs.promises.mkdtemp(path.join(config.tmpDir, 'h5p-'));
  try {
    const file = path.join(tmp, 'unit.h5p');
    await editor.exportContent(unit.contentId, fs.createWriteStream(file), toH5pUser(user));
    await waitForFile(file);
    const data = await fs.promises.readFile(file);
    audit(user.id, 'unit.export_h5p', unitId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slug(unit.title)}.h5p"`);
    res.end(data);
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true });
  }
}

async function getUnitForExport(user, unitId) {
  const { getUnit } = await import('./services.js');
  return getUnit(user, unitId);
}

export async function exportCourseH5pZip(user, courseId, res) {
  const course = getCourse(user, courseId);
  if (!course.units.length) throw new ValidationError('Der Kurs enthält keine H5P-Einheiten, die Lumi öffnen könnte.');
  const { editor } = getH5P();
  const h5pUser = toH5pUser(user);
  const tmp = await fs.promises.mkdtemp(path.join(config.tmpDir, 'lumi-'));
  try {
    const archive = new ZipArchive({ zlib: { level: 6 } });
    const lines = [];
    for (const [i, u] of course.units.entries()) {
      const name = `${String(i + 1).padStart(2, '0')}-${slug(u.title)}.h5p`;
      const file = path.join(tmp, name);
      await editor.exportContent(u.contentId, fs.createWriteStream(file), h5pUser);
      await waitForFile(file);
      archive.file(file, { name });
      lines.push(`${name}  ${u.title}`);
    }
    const blockNote =
      course.settings.mode === 'blocks'
        ? '\nDieser Kurs ist ein Block-Kurs. Lumi kennt nur H5P-Inhalte, deshalb enthält dieses Archiv nur die eingebundenen H5P-Einheiten.\nText-, Bild- und Fragenblöcke gibt es nur in Plietschpaket und im SCORM-Paket.\n'
        : '';
    archive.append(`${course.title}\n\nJede .h5p-Datei lässt sich in Lumi öffnen (Datei → Öffnen) und nach der Bearbeitung über „Importieren“ wieder in Plietschpaket laden.\n${blockNote}\n${lines.join('\n')}\n`, { name: 'LIESMICH.txt' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slug(course.title)}_h5p.zip"`);
    const done = pipeline(archive, res);
    await archive.finalize();
    await done;
    audit(user.id, 'course.export_h5p', courseId, { units: course.units.length });
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true });
  }
}
