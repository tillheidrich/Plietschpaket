/**
 * Domain operations shared by the web API and the MCP server.
 * Every function takes the acting user (DB row) first and enforces project rights.
 */
import crypto from 'node:crypto';
import { db, newId, audit, parseJson } from './db.js';
import { assertProject, assertCourse, assertUnit, AccessError, projectRole } from './access.js';
import { toH5pUser, resolveUbername } from './h5p.js';
import { normalizeParams, relocalizeParams } from './schema.js';
import { normalizeBlocks, normalizeDesign, outline, mediaPath, saveMedia, listMedia, courseMediaDir, newBlockId, DEFAULT_DESIGN } from './blocks.js';
import fs from 'node:fs';
import { isCourseLanguage, h5pLanguage } from './languages.js';

export const DEFAULT_COURSE_SETTINGS = {
  scormVersion: '1.2', // '1.2' | '2004'
  completion: 'all', // 'all' = all units finished | 'viewed' = all units opened
  masteryScore: 80, // percent, only relevant when scored units exist
  navigation: 'free', // 'free' | 'linear'
  showUnitList: true,
  mode: 'units' // 'units' = H5P units in the course shell | 'blocks' = block course with own player
};

let h5p = null;
export const setH5P = (value) => {
  h5p = value;
};
export const getH5P = () => h5p;

const touchCourse = (courseId) => db.prepare("UPDATE courses SET updated_at = datetime('now') WHERE id = ?").run(courseId);
const touchProject = (projectId) => db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(projectId);

export class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.status = 400;
    this.details = details;
  }
}

function requireText(value, label, max = 200) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) throw new ValidationError(`${label} fehlt.`);
  if (v.length > max) throw new ValidationError(`${label} ist zu lang (max. ${max} Zeichen).`);
  return v;
}

// ---------------------------------------------------------------------------
// Projects & members
// ---------------------------------------------------------------------------

export function listProjects(user) {
  const rows =
    user.role === 'admin'
      ? db.prepare(`SELECT p.*, 'owner' AS my_role FROM projects p ORDER BY p.updated_at DESC`).all()
      : db
          .prepare(
            `SELECT p.*, m.role AS my_role FROM projects p JOIN project_members m ON m.project_id = p.id
             WHERE m.user_id = ? ORDER BY p.updated_at DESC`
          )
          .all(user.id);
  const counts = db.prepare('SELECT COUNT(*) AS n FROM courses WHERE project_id = ?');
  const members = db.prepare('SELECT COUNT(*) AS n FROM project_members WHERE project_id = ?');
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    myRole: p.my_role,
    courseCount: counts.get(p.id).n,
    memberCount: members.get(p.id).n,
    updatedAt: p.updated_at,
    createdAt: p.created_at
  }));
}

export function getProject(user, projectId) {
  const { project, role } = assertProject(user, projectId);
  const courses = db.prepare('SELECT * FROM courses WHERE project_id = ? ORDER BY position, created_at').all(projectId);
  const unitCount = db.prepare('SELECT COUNT(*) AS n FROM units WHERE course_id = ?');
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    branding: parseJson(project.branding, {}),
    myRole: role,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    courses: courses.map((c) => ({ ...courseSummary(c), unitCount: unitCount.get(c.id).n })),
    members: listMembers(user, projectId)
  };
}

export function createProject(user, { name, description = '' }, via = 'web') {
  const id = newId('p_');
  db.transaction(() => {
    db.prepare('INSERT INTO projects (id, name, description, created_by) VALUES (?, ?, ?, ?)').run(
      id,
      requireText(name, 'Projektname'),
      String(description || '').slice(0, 2000),
      user.id
    );
    db.prepare("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')").run(id, user.id);
  })();
  audit(user.id, 'project.create', id, { name }, via);
  return getProject(user, id);
}

export function updateProject(user, projectId, { name, description, branding }, via = 'web') {
  assertProject(user, projectId, 'editor');
  if (name !== undefined) db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(requireText(name, 'Projektname'), projectId);
  if (description !== undefined) db.prepare('UPDATE projects SET description = ? WHERE id = ?').run(String(description).slice(0, 2000), projectId);
  if (branding !== undefined) db.prepare('UPDATE projects SET branding = ? WHERE id = ?').run(JSON.stringify(sanitizeBranding(branding)), projectId);
  touchProject(projectId);
  audit(user.id, 'project.update', projectId, null, via);
  return getProject(user, projectId);
}

function sanitizeBranding(b = {}) {
  const color = (v) => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : undefined);
  return {
    primaryColor: color(b.primaryColor),
    accentColor: color(b.accentColor),
    fontFamily: typeof b.fontFamily === 'string' ? b.fontFamily.replace(/[^\w\s,'"-]/g, '').slice(0, 120) : undefined,
    organization: typeof b.organization === 'string' ? b.organization.slice(0, 120) : undefined
  };
}

export async function deleteProject(user, projectId, via = 'web') {
  assertProject(user, projectId, 'owner');
  const contentIds = db
    .prepare('SELECT u.content_id FROM units u JOIN courses c ON c.id = u.course_id WHERE c.project_id = ?')
    .all(projectId)
    .map((r) => r.content_id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  for (const cid of contentIds) await deleteH5pContent(cid, user);
  audit(user.id, 'project.delete', projectId, null, via);
}

export function listMembers(user, projectId) {
  assertProject(user, projectId);
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, m.role FROM project_members m JOIN users u ON u.id = m.user_id
       WHERE m.project_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, u.name`
    )
    .all(projectId);
}

const ROLES = ['owner', 'editor', 'viewer'];

export function setMember(user, projectId, { email, userId, role }, via = 'web') {
  assertProject(user, projectId, 'owner');
  if (!ROLES.includes(role)) throw new ValidationError('Unbekannte Rolle.');
  const target = userId
    ? db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    : db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!target) throw new ValidationError('Kein Nutzer mit dieser E-Mail-Adresse. Ein Admin muss das Konto zuerst anlegen.');
  const current = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, target.id);
  if (current && current.role === 'owner' && role !== 'owner') ensureAnotherOwner(projectId, target.id);
  db.prepare(
    `INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)
     ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role`
  ).run(projectId, target.id, role);
  audit(user.id, 'project.member_set', projectId, { member: target.id, role }, via);
  return listMembers(user, projectId);
}

function ensureAnotherOwner(projectId, leavingUserId) {
  const others = db
    .prepare("SELECT COUNT(*) AS n FROM project_members WHERE project_id = ? AND role = 'owner' AND user_id != ?")
    .get(projectId, leavingUserId).n;
  if (!others) throw new ValidationError('Ein Projekt braucht mindestens eine verantwortliche Person (Owner).');
}

export function removeMember(user, projectId, memberId, via = 'web') {
  const isSelf = memberId === user.id;
  if (!isSelf) assertProject(user, projectId, 'owner');
  else assertProject(user, projectId);
  const current = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, memberId);
  if (!current) return listMembers(user, projectId);
  if (current.role === 'owner') ensureAnotherOwner(projectId, memberId);
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, memberId);
  audit(user.id, 'project.member_remove', projectId, { member: memberId }, via);
  return projectRole(user, projectId) ? listMembers(user, projectId) : [];
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

function courseSummary(c) {
  return {
    id: c.id,
    projectId: c.project_id,
    title: c.title,
    description: c.description,
    language: c.language,
    settings: { ...DEFAULT_COURSE_SETTINGS, ...parseJson(c.settings, {}) },
    version: c.version,
    packageUuid: c.package_uuid,
    updatedAt: c.updated_at
  };
}

export function getCourse(user, courseId) {
  const { course, role, project } = assertCourse(user, courseId);
  const units = db.prepare('SELECT * FROM units WHERE course_id = ? ORDER BY position, created_at').all(courseId);
  const exportsList = db
    .prepare('SELECT id, format, version, size, created_at, report FROM exports WHERE course_id = ? ORDER BY created_at DESC LIMIT 10')
    .all(courseId)
    .map((e) => ({ id: e.id, format: e.format, version: e.version, size: e.size, createdAt: e.created_at, report: parseJson(e.report, {}) }));
  return {
    ...courseSummary(course),
    projectName: project.name,
    myRole: role,
    units: units.map(unitSummary),
    exports: exportsList,
    blocks: parseJson(course.blocks, []),
    design: { ...DEFAULT_DESIGN, ...parseJson(course.design, {}) },
    outline: outline(parseJson(course.blocks, []))
  };
}

export function createCourse(user, projectId, { title, description = '', language = 'de', settings = {} }, via = 'web') {
  assertProject(user, projectId, 'editor');
  const id = newId('c_');
  const pos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM courses WHERE project_id = ?').get(projectId).p;
  db.prepare(
    'INSERT INTO courses (id, project_id, title, description, language, settings, package_uuid, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    projectId,
    requireText(title, 'Kurstitel'),
    String(description || '').slice(0, 4000),
    normalizeLanguage(language),
    JSON.stringify(sanitizeSettings(settings)),
    crypto.randomUUID(),
    pos
  );
  touchProject(projectId);
  audit(user.id, 'course.create', id, { title }, via);
  return getCourse(user, id);
}

function normalizeLanguage(l) {
  const code = String(l || 'de').trim().toLowerCase();
  if (!isCourseLanguage(code)) throw new ValidationError(`Unbekannte Kurssprache "${code}". Verfügbar sind die eingebauten Sprachen und die in der Verwaltung angelegten.`);
  return code;
}

function sanitizeSettings(input = {}) {
  const s = { ...DEFAULT_COURSE_SETTINGS };
  if (['1.2', '2004'].includes(String(input.scormVersion))) s.scormVersion = String(input.scormVersion);
  if (['all', 'viewed'].includes(input.completion)) s.completion = input.completion;
  if (input.masteryScore !== undefined) {
    const m = Number(input.masteryScore);
    if (!Number.isNaN(m) && m >= 0 && m <= 100) s.masteryScore = Math.round(m);
  }
  if (['free', 'linear'].includes(input.navigation)) s.navigation = input.navigation;
  if (input.showUnitList !== undefined) s.showUnitList = !!input.showUnitList;
  if (['units', 'blocks'].includes(input.mode)) s.mode = input.mode;
  return s;
}

export function updateCourse(user, courseId, { title, description, language, settings }, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  if (title !== undefined) db.prepare('UPDATE courses SET title = ? WHERE id = ?').run(requireText(title, 'Kurstitel'), courseId);
  if (description !== undefined) db.prepare('UPDATE courses SET description = ? WHERE id = ?').run(String(description).slice(0, 4000), courseId);
  if (language !== undefined) db.prepare('UPDATE courses SET language = ? WHERE id = ?').run(normalizeLanguage(language), courseId);
  if (settings !== undefined) {
    const merged = sanitizeSettings({ ...parseJson(course.settings, {}), ...settings });
    db.prepare('UPDATE courses SET settings = ? WHERE id = ?').run(JSON.stringify(merged), courseId);
  }
  touchCourse(courseId);
  touchProject(course.project_id);
  audit(user.id, 'course.update', courseId, null, via);
  return getCourse(user, courseId);
}

export async function deleteCourse(user, courseId, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  const contentIds = db.prepare('SELECT content_id FROM units WHERE course_id = ?').all(courseId).map((r) => r.content_id);
  db.prepare('DELETE FROM courses WHERE id = ?').run(courseId);
  for (const cid of contentIds) await deleteH5pContent(cid, user);
  fs.rmSync(courseMediaDir(courseId), { recursive: true, force: true });
  touchProject(course.project_id);
  audit(user.id, 'course.delete', courseId, null, via);
}

export async function duplicateCourse(user, courseId, { title, projectId, language } = {}, via = 'web') {
  const source = getCourse(user, courseId);
  const targetProject = projectId || source.projectId;
  assertProject(user, targetProject, 'editor');
  const copy = createCourse(user, targetProject, {
    title: title || `${source.title} (Kopie)`,
    description: source.description,
    language: language || source.language,
    settings: source.settings
  }, via);
  const unitMap = {};
  for (const unit of source.units) {
    const full = await getUnit(user, unit.id);
    const params = await relocalizeParams(h5p.editor, full.library, full.params, h5pLanguage(source.language), h5pLanguage(copy.language));
    const created = await createUnit(user, copy.id, { library: full.library, params, title: full.title, skipValidation: true }, via);
    await copyContentFiles(full.contentId, created.contentId, user);
    if (unit.weight !== 1) db.prepare('UPDATE units SET weight = ? WHERE id = ?').run(unit.weight, created.id);
    unitMap[unit.id] = created.id;
  }
  if (source.blocks.length || source.settings.mode === 'blocks') {
    const srcDir = courseMediaDir(source.id);
    if (fs.existsSync(srcDir)) fs.cpSync(srcDir, courseMediaDir(copy.id), { recursive: true });
    const blocks = source.blocks.map((b) => (b.type === 'h5p' ? { ...b, data: { ...b.data, unitId: unitMap[b.data.unitId] || b.data.unitId } } : b));
    db.prepare('UPDATE courses SET blocks = ?, design = ? WHERE id = ?').run(JSON.stringify(blocks), JSON.stringify(source.design), copy.id);
  }
  return getCourse(user, copy.id);
}

/** Copies all media files (images, videos …) of one H5P content into another. */
async function copyContentFiles(fromId, toId, user) {
  const storage = h5p.editor.contentStorage;
  const h5pUser = toH5pUser({ ...user, role: 'admin' });
  const files = await storage.listFiles(String(fromId), h5pUser);
  for (const file of files) {
    const stream = await storage.getFileStream(String(fromId), file, h5pUser);
    await storage.addFile(String(toId), file, stream, h5pUser);
  }
  return files.length;
}

// ---------------------------------------------------------------------------
// Units (one H5P content each)
// ---------------------------------------------------------------------------

function unitSummary(u) {
  return {
    id: u.id,
    courseId: u.course_id,
    contentId: u.content_id,
    title: u.title,
    library: u.library,
    contentType: u.library.split(' ')[0],
    position: u.position,
    weight: u.weight,
    updatedAt: u.updated_at
  };
}

export async function getUnit(user, unitId) {
  const { unit, role } = assertUnit(user, unitId);
  const content = await h5p.editor.getContent(unit.content_id, toH5pUser(user));
  return {
    ...unitSummary(unit),
    myRole: role,
    params: content.params.params,
    metadata: content.params.metadata
  };
}

function baseMetadata(title, ubername, language) {
  return {
    title,
    mainLibrary: ubername.split(' ')[0],
    language: language || 'de',
    defaultLanguage: language || 'de',
    license: 'U',
    embedTypes: ['iframe']
  };
}

/** Creates a unit from content parameters (used by MCP and course duplication). */
export async function createUnit(user, courseId, { library, params, title, position, skipValidation = false }, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  const lib = await resolveUbername(h5p.editor, library);
  if (!lib) throw new ValidationError(`Inhaltstyp "${library}" ist nicht installiert. list_content_types zeigt die verfügbaren Typen.`);
  const unitTitle = requireText(title, 'Titel der Einheit');
  let finalParams = params;
  if (!skipValidation) {
    const { params: normalized, errors } = await normalizeParams(h5p.editor, lib.ubername, params, h5pLanguage(course.language));
    if (errors.length) throw new ValidationError('Die Parameter passen nicht zum Inhaltstyp.', errors);
    finalParams = normalized;
  }
  const { id: contentId } = await h5p.editor.saveOrUpdateContentReturnMetaData(
    undefined,
    finalParams,
    baseMetadata(unitTitle, lib.ubername, h5pLanguage(course.language)),
    lib.ubername,
    toH5pUser(user)
  );
  return attachContent(user, courseId, { contentId: String(contentId), title: unitTitle, library: lib.ubername, position }, via);
}

/** Creates an empty unit of a content type so the browser editor can open it directly. */
export async function createDraftUnit(user, courseId, library, title, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  const lib = await resolveUbername(h5p.editor, library);
  if (!lib) throw new ValidationError(`Inhaltstyp "${library}" ist nicht installiert.`);
  const { params } = await normalizeParams(h5p.editor, lib.ubername, {}, h5pLanguage(course.language));
  return createUnit(user, courseId, { library: lib.ubername, params, title: String(title || 'Neue Einheit').slice(0, 200), skipValidation: true }, via);
}

/** Links an existing H5P content (e.g. saved by the browser editor or imported) to a course. */
export function attachContent(user, courseId, { contentId, title, library, position }, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  const existing = db.prepare('SELECT * FROM units WHERE content_id = ?').get(String(contentId));
  if (existing) throw new ValidationError('Dieser Inhalt gehört bereits zu einer Einheit.');
  const owner = db.prepare('SELECT user_id FROM content_owners WHERE content_id = ?').get(String(contentId));
  if (owner && owner.user_id !== user.id && user.role !== 'admin') throw new AccessError('Dieser Inhalt gehört jemand anderem.');
  const id = newId('u_');
  db.transaction(() => {
    const max = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM units WHERE course_id = ?').get(courseId).p;
    let pos = max;
    if (Number.isInteger(position) && position >= 0 && position < max) {
      db.prepare('UPDATE units SET position = position + 1 WHERE course_id = ? AND position >= ?').run(courseId, position);
      pos = position;
    }
    db.prepare('INSERT INTO units (id, course_id, content_id, title, library, position, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id,
      courseId,
      String(contentId),
      title,
      library,
      pos,
      user.id
    );
    db.prepare('DELETE FROM content_owners WHERE content_id = ?').run(String(contentId));
  })();
  touchCourse(courseId);
  touchProject(course.project_id);
  audit(user.id, 'unit.create', id, { courseId, library }, via);
  return unitSummary(db.prepare('SELECT * FROM units WHERE id = ?').get(id));
}

export async function updateUnit(user, unitId, { params, title, weight, metadata }, via = 'web') {
  const { unit, course } = assertUnit(user, unitId, 'editor');
  if (params !== undefined) {
    const { params: normalized, errors } = await normalizeParams(h5p.editor, unit.library, params, h5pLanguage(course.language));
    if (errors.length) throw new ValidationError('Die Parameter passen nicht zum Inhaltstyp.', errors);
    const current = await h5p.editor.getContent(unit.content_id, toH5pUser(user));
    await h5p.editor.saveOrUpdateContentReturnMetaData(
      unit.content_id,
      normalized,
      { ...baseMetadata(title || unit.title, unit.library, h5pLanguage(course.language)), ...(current.params.metadata || {}), ...(metadata || {}), title: title || unit.title },
      unit.library,
      toH5pUser(user)
    );
  }
  if (title !== undefined) db.prepare('UPDATE units SET title = ? WHERE id = ?').run(requireText(title, 'Titel der Einheit'), unitId);
  if (weight !== undefined) {
    const w = Number(weight);
    if (Number.isNaN(w) || w < 0 || w > 100) throw new ValidationError('Gewichtung muss zwischen 0 und 100 liegen.');
    db.prepare('UPDATE units SET weight = ? WHERE id = ?').run(w, unitId);
  }
  db.prepare("UPDATE units SET updated_at = datetime('now') WHERE id = ?").run(unitId);
  touchCourse(unit.course_id);
  audit(user.id, 'unit.update', unitId, null, via);
  return unitSummary(db.prepare('SELECT * FROM units WHERE id = ?').get(unitId));
}

/** Called after the browser editor saved a content object belonging to a unit. */
export function noteUnitSaved(user, unitId, { title }) {
  const { unit } = assertUnit(user, unitId, 'editor');
  if (title) db.prepare('UPDATE units SET title = ? WHERE id = ?').run(String(title).slice(0, 200), unitId);
  db.prepare("UPDATE units SET updated_at = datetime('now') WHERE id = ?").run(unitId);
  touchCourse(unit.course_id);
}

export async function deleteUnit(user, unitId, via = 'web') {
  const { unit } = assertUnit(user, unitId, 'editor');
  db.prepare('DELETE FROM units WHERE id = ?').run(unitId);
  renumber(unit.course_id);
  await deleteH5pContent(unit.content_id, user);
  touchCourse(unit.course_id);
  audit(user.id, 'unit.delete', unitId, null, via);
}

function renumber(courseId) {
  const ids = db.prepare('SELECT id FROM units WHERE course_id = ? ORDER BY position, created_at').all(courseId);
  const upd = db.prepare('UPDATE units SET position = ? WHERE id = ?');
  db.transaction(() => ids.forEach((r, i) => upd.run(i, r.id)))();
}

export function reorderUnits(user, courseId, orderedIds, via = 'web') {
  assertCourse(user, courseId, 'editor');
  const current = db.prepare('SELECT id FROM units WHERE course_id = ?').all(courseId).map((r) => r.id);
  if (!Array.isArray(orderedIds) || orderedIds.length !== current.length || !orderedIds.every((id) => current.includes(id))) {
    throw new ValidationError('Die Reihenfolge muss alle Einheiten des Kurses genau einmal enthalten.');
  }
  const upd = db.prepare('UPDATE units SET position = ? WHERE id = ?');
  db.transaction(() => orderedIds.forEach((id, i) => upd.run(i, id)))();
  touchCourse(courseId);
  audit(user.id, 'unit.reorder', courseId, null, via);
  return getCourse(user, courseId);
}

export function moveUnit(user, unitId, { position, courseId }, via = 'web') {
  const { unit } = assertUnit(user, unitId, 'editor');
  if (courseId && courseId !== unit.course_id) {
    const target = assertCourse(user, courseId, 'editor');
    const source = assertCourse(user, unit.course_id, 'editor');
    if (target.course.project_id !== source.course.project_id && user.role !== 'admin') {
      // moving across projects is allowed when the user may edit both
    }
    const max = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM units WHERE course_id = ?').get(courseId).p;
    db.prepare('UPDATE units SET course_id = ?, position = ? WHERE id = ?').run(courseId, max, unitId);
    renumber(unit.course_id);
  }
  const cid = courseId || unit.course_id;
  if (Number.isInteger(position)) {
    const ids = db.prepare('SELECT id FROM units WHERE course_id = ? ORDER BY position').all(cid).map((r) => r.id).filter((id) => id !== unitId);
    ids.splice(Math.max(0, Math.min(position, ids.length)), 0, unitId);
    reorderUnits(user, cid, ids, via);
  }
  return getCourse(user, cid);
}

export function registerContentOwner(contentId, userId) {
  db.prepare('INSERT OR IGNORE INTO content_owners (content_id, user_id) VALUES (?, ?)').run(String(contentId), userId);
}

async function deleteH5pContent(contentId, user) {
  try {
    await h5p.editor.deleteContent(String(contentId), toH5pUser({ ...user, role: 'admin' }));
  } catch (err) {
    console.warn(`[h5p] Inhalt ${contentId} konnte nicht gelöscht werden: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Content types
// ---------------------------------------------------------------------------

let typeCache = null;
export function invalidateContentTypes() {
  typeCache = null;
}

export async function listContentTypes() {
  if (typeCache) return typeCache;
  const names = await h5p.editor.libraryStorage.getInstalledLibraryNames();
  const latest = new Map();
  for (const n of names) {
    const prev = latest.get(n.machineName);
    if (!prev || n.majorVersion > prev.majorVersion || (n.majorVersion === prev.majorVersion && n.minorVersion > prev.minorVersion)) {
      latest.set(n.machineName, n);
    }
  }
  const out = [];
  for (const lib of latest.values()) {
    const meta = await h5p.editor.libraryStorage.getLibrary(lib);
    if (!meta.runnable) continue;
    const folder = `${lib.machineName}-${lib.majorVersion}.${lib.minorVersion}`;
    let icon = null;
    try {
      if (await h5p.editor.libraryStorage.fileExists(lib, 'icon.svg')) icon = `/h5p/libraries/${folder}/icon.svg`;
    } catch {
      /* no icon */
    }
    out.push({
      machineName: lib.machineName,
      ubername: `${lib.machineName} ${lib.majorVersion}.${lib.minorVersion}`,
      title: meta.title,
      icon,
      description: CONTENT_TYPE_NOTES[lib.machineName] || '',
      descriptionEn: CONTENT_TYPE_NOTES_EN[lib.machineName] || ''
    });
  }
  out.sort((a, b) => (RECOMMENDED.indexOf(a.machineName) + 1 || 999) - (RECOMMENDED.indexOf(b.machineName) + 1 || 999) || a.title.localeCompare(b.title));
  typeCache = out;
  return out;
}

export const RECOMMENDED = [
  'H5P.AppSimulation',
  'H5P.Scenario',
  'H5P.Column',
  'H5P.MultiChoice',
  'H5P.TrueFalse',
  'H5P.Blanks',
  'H5P.DragText',
  'H5P.DragQuestion',
  'H5P.ImageHotspots',
  'H5P.Accordion',
  'H5P.Dialogcards',
  'H5P.QuestionSet',
  'H5P.SingleChoiceSet',
  'H5P.MarkTheWords',
  'H5P.Summary',
  'H5P.CoursePresentation',
  'H5P.InteractiveVideo',
  'H5P.InteractiveBook',
  'H5P.BranchingScenario'
];

export const CONTENT_TYPE_NOTES = {
  'H5P.Scenario': 'Szenario: verzweigtes Rollenspiel mit gezeichneten Figuren oder eigenen Fotos, Hintergründen, Sprechblase und Erzählung (Audio oder Browser-Stimme). Jede Antwort führt zu einer anderen Szene oder einem Ende und gibt Punkte. Bewertet. Erste Wahl für Gesprächs- und Entscheidungstrainings.',
  'H5P.AppSimulation': 'App-Simulation: Schritt-für-Schritt-Übung auf Screenshots. Lernende tippen die richtige Stelle an, Info-, Hinweis- und Erkunden-Schritte mit Hover-Erklärungen, fester Abschluss. Ohne Ton, Video optional. Bewertet (erster Versuch). Erste Wahl für Software-Trainings.',
  'H5P.Column': 'Lektionsseite im Stil von Rise: stapelt beliebige Blöcke untereinander (Text, Bild, Akkordeon, Fragen …). Erste Wahl für Lerninhalte.',
  'H5P.MultiChoice': 'Multiple-Choice-Frage mit einer oder mehreren richtigen Antworten, Feedback je Antwort. Bewertet.',
  'H5P.TrueFalse': 'Richtig/Falsch-Aussage. Bewertet.',
  'H5P.Blanks': 'Lückentext: Lücken mit *Sternchen* markieren, Alternativen mit /. Bewertet.',
  'H5P.DragText': 'Wörter in Lücken ziehen; Zielwörter mit *Sternchen* markieren. Bewertet.',
  'H5P.DragQuestion': 'Drag & Drop auf eine Fläche/ein Bild mit Zielzonen. Bewertet. Koordinaten sind aufwendig – lieber im Browser-Editor feinjustieren.',
  'H5P.ImageHotspots': 'Bild mit anklickbaren Infopunkten (Koordinaten in Prozent). Nicht bewertet.',
  'H5P.Accordion': 'Aufklappbare Abschnitte für Zusatzwissen. Nicht bewertet.',
  'H5P.Dialogcards': 'Lernkarten mit Vorder- und Rückseite. Nicht bewertet.',
  'H5P.QuestionSet': 'Quiz aus mehreren Fragen (MultiChoice, TrueFalse, Blanks, DragText …) mit Endauswertung. Bewertet.',
  'H5P.SingleChoiceSet': 'Schnelles Quiz: je Frage eine richtige Antwort (die erste in der Liste). Bewertet.',
  'H5P.MarkTheWords': 'Richtige Wörter im Text anklicken; Zielwörter mit *Sternchen*. Bewertet.',
  'H5P.Summary': 'Zusammenfassung: je Block die richtige Aussage wählen (erste Aussage ist richtig). Bewertet.',
  'H5P.CoursePresentation': 'Folien mit frei platzierten Elementen. Für KI-Erstellung aufwendig (Positionen).',
  'H5P.InteractiveVideo': 'Video mit Fragen und Einblendungen an Zeitpunkten. Für Schulungsvideos.',
  'H5P.InteractiveBook': 'Buch mit Kapiteln (jede Seite eine Column) und Fortschrittsanzeige.',
  'H5P.BranchingScenario': 'Verzweigtes Szenario mit Entscheidungen. Komplex, besser im Browser-Editor bauen.'
};

export const CONTENT_TYPE_NOTES_EN = {
  'H5P.Scenario': 'Scenario: branching role-play with illustrated characters or your own photos, backgrounds, speech bubble and narration (audio or browser voice). Each answer leads to another scene or an ending and gives points. Scored. First choice for conversation and decision training.',
  'H5P.AppSimulation': 'App simulation: step-by-step practice on screenshots. Learners tap the right spot; info, note and explore steps with hover hints; fixed completion screen. No audio, optional video. Scored (first try). First choice for software training.',
  'H5P.Column': 'Rise-style lesson page: stacks any blocks vertically (text, image, accordion, questions …). First choice for learning content.',
  'H5P.MultiChoice': 'Multiple choice question with one or more correct answers and feedback per answer. Scored.',
  'H5P.TrueFalse': 'True/false statement. Scored.',
  'H5P.Blanks': 'Fill in the blanks: mark gaps with *asterisks*, alternatives with /. Scored.',
  'H5P.DragText': 'Drag words into gaps; mark target words with *asterisks*. Scored.',
  'H5P.DragQuestion': 'Drag and drop onto an area or image with drop zones. Scored. Coordinates are fiddly – fine-tune in the browser editor.',
  'H5P.ImageHotspots': 'Image with clickable info points (coordinates in percent). Not scored.',
  'H5P.Accordion': 'Collapsible sections for extra knowledge. Not scored.',
  'H5P.Dialogcards': 'Flashcards with front and back. Not scored.',
  'H5P.QuestionSet': 'Quiz made of several questions with a final result. Scored.',
  'H5P.SingleChoiceSet': 'Quick quiz: one correct answer per question (always the first one). Scored.',
  'H5P.MarkTheWords': 'Click the right words in a text; mark targets with *asterisks*. Scored.',
  'H5P.Summary': 'Summary: pick the correct statement per block (the first one is correct). Scored.',
  'H5P.CoursePresentation': 'Slides with freely placed elements. Laborious for AI creation (positions).',
  'H5P.InteractiveVideo': 'Video with questions and overlays at points in time. For training videos.',
  'H5P.InteractiveBook': 'Book with chapters (each page a column) and a progress indicator.',
  'H5P.BranchingScenario': 'Branching scenario with decisions. Complex, better built in the browser editor.'
};

export { courseSummary, unitSummary, sanitizeSettings };

// ---------------------------------------------------------------------------
// Block courses
// ---------------------------------------------------------------------------

function blockCtx(courseId) {
  const unitIds = new Set(db.prepare('SELECT id FROM units WHERE course_id = ?').all(courseId).map((r) => r.id));
  return { mediaExists: (name) => !!mediaPath(courseId, name), unitExists: (id) => unitIds.has(id) };
}

/** strictIds: 'all' | Set of block ids that must be valid; other incomplete blocks are kept as drafts. */
function storeBlocks(user, course, blocks, via, action, strictIds = 'all') {
  const clean = normalizeBlocks(blocks, blockCtx(course.id), { draft: true, strictIds });
  const settings = { ...parseJson(course.settings, {}), mode: 'blocks' };
  db.prepare("UPDATE courses SET blocks = ?, settings = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(clean), JSON.stringify(sanitizeSettings(settings)), course.id);
  touchProject(course.project_id);
  audit(user.id, action, course.id, { blocks: clean.length }, via);
  return clean;
}

/** Replaces the whole block list. `expectedUpdatedAt` guards against overwriting a newer save. */
export function saveBlocks(user, courseId, blocks, { expectedUpdatedAt, draft = false } = {}, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  if (expectedUpdatedAt && expectedUpdatedAt !== course.updated_at) {
    throw Object.assign(new Error('Der Kurs wurde inzwischen von jemand anderem gespeichert. Bitte neu laden.'), { status: 409 });
  }
  storeBlocks(user, course, blocks, via, 'course.blocks.save', draft ? null : 'all');
  return getCourse(user, courseId);
}

/** Inserts blocks after the block with id `afterId` (or at the end / at `position`). */
export function insertBlocks(user, courseId, blocks, { afterId, position } = {}, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  const list = parseJson(course.blocks, []);
  let at = list.length;
  if (afterId) {
    const i = list.findIndex((b) => b.id === afterId);
    if (i === -1) throw new ValidationError(`Block ${afterId} gibt es nicht.`);
    at = i + 1;
  } else if (position !== undefined) at = Math.max(0, Math.min(list.length, Number(position) || 0));
  const fresh = (Array.isArray(blocks) ? blocks : []).map((b) => ({ ...b, id: newBlockId() }));
  list.splice(at, 0, ...fresh);
  const clean = storeBlocks(user, course, list, via, 'course.blocks.insert', new Set(fresh.map((b) => b.id)));
  return { inserted: clean.slice(at, at + fresh.length).map((b) => b.id), course: getCourse(user, courseId) };
}

export function updateBlock(user, courseId, blockId, { data, type, narration }, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  const list = parseJson(course.blocks, []);
  const i = list.findIndex((b) => b.id === blockId);
  if (i === -1) throw new ValidationError(`Block ${blockId} gibt es nicht.`);
  list[i] = { ...list[i], ...(type ? { type } : {}), data: data !== undefined ? data : list[i].data };
  if (narration !== undefined) list[i].narration = narration || undefined;
  storeBlocks(user, course, list, via, 'course.blocks.update', new Set([blockId]));
  return getCourse(user, courseId);
}

export function deleteBlocks(user, courseId, blockIds, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  const drop = new Set(blockIds);
  const list = parseJson(course.blocks, []).filter((b) => !drop.has(b.id));
  storeBlocks(user, course, list, via, 'course.blocks.delete', null);
  return getCourse(user, courseId);
}

export function moveBlock(user, courseId, blockId, { afterId, position }, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  const list = parseJson(course.blocks, []);
  const i = list.findIndex((b) => b.id === blockId);
  if (i === -1) throw new ValidationError(`Block ${blockId} gibt es nicht.`);
  const [b] = list.splice(i, 1);
  let at = list.length;
  if (afterId === null || afterId === '') at = 0;
  else if (afterId) {
    const j = list.findIndex((x) => x.id === afterId);
    if (j === -1) throw new ValidationError(`Block ${afterId} gibt es nicht.`);
    at = j + 1;
  } else if (position !== undefined) at = Math.max(0, Math.min(list.length, Number(position) || 0));
  list.splice(at, 0, b);
  storeBlocks(user, course, list, via, 'course.blocks.move', null);
  return getCourse(user, courseId);
}

export function setDesign(user, courseId, design, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  const current = { ...DEFAULT_DESIGN, ...parseJson(course.design, {}) };
  const merged = {
    ...current,
    ...design,
    theme: { ...current.theme, ...(design.theme || {}) },
    cover: { ...current.cover, ...(design.cover || {}) },
    completion: { ...current.completion, ...(design.completion || {}) },
    labels: design.labels && typeof design.labels === 'object' ? design.labels : current.labels
  };
  const clean = normalizeDesign(merged, blockCtx(courseId));
  db.prepare("UPDATE courses SET design = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(clean), courseId);
  audit(user.id, 'course.design', courseId, null, via);
  return getCourse(user, courseId);
}

export function uploadCourseMedia(user, courseId, filename, buf, maxBytes, via = 'web') {
  assertCourse(user, courseId, 'editor');
  const saved = saveMedia(courseId, filename, buf, maxBytes);
  audit(user.id, 'course.media.upload', courseId, { name: saved.name, size: saved.size }, via);
  return saved;
}

export function courseMedia(user, courseId) {
  assertCourse(user, courseId, 'viewer');
  return listMedia(courseId);
}

/** Absolute path of a media file the user may read (viewer role), or null. */
export function courseMediaFile(user, courseId, name) {
  assertCourse(user, courseId, 'viewer');
  return mediaPath(courseId, name);
}

