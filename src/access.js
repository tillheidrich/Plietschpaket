import { db, audit } from './db.js';

/** Role ranking inside a project. Admins implicitly have owner rights everywhere. */
const RANK = { viewer: 1, editor: 2, owner: 3 };

export class AccessError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
  }
}

// Admins keep owner rights everywhere (company IT must be able to rescue orphaned projects), but every
// access to a project they are not a member of is written to the audit log (once per day and project).
const adminSeen = new Map();
function noteAdminAccess(user, projectId) {
  const key = `${user.id}:${projectId}:${new Date().toISOString().slice(0, 10)}`;
  if (adminSeen.has(key)) return;
  if (adminSeen.size > 5000) adminSeen.clear();
  adminSeen.set(key, true);
  try {
    audit(user.id, 'admin.project_access', projectId, { reason: 'admin without membership' });
  } catch {
    /* audit must never block access checks */
  }
}

export function projectRole(user, projectId) {
  if (!user) return null;
  const row = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, user.id);
  if (row) return row.role;
  if (user.role === 'admin') {
    noteAdminAccess(user, projectId);
    return 'owner';
  }
  return null;
}

export function assertProject(user, projectId, needed = 'viewer') {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) throw new AccessError('Projekt nicht gefunden.', 404);
  const role = projectRole(user, projectId);
  if (!role) throw new AccessError('Projekt nicht gefunden.', 404);
  if (RANK[role] < RANK[needed]) throw new AccessError('Dafür reichen deine Rechte in diesem Projekt nicht aus.');
  return { project, role };
}

export function assertCourse(user, courseId, needed = 'viewer') {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) throw new AccessError('Kurs nicht gefunden.', 404);
  const { project, role } = assertProject(user, course.project_id, needed);
  return { course, project, role };
}

export function assertUnit(user, unitId, needed = 'viewer') {
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(unitId);
  if (!unit) throw new AccessError('Einheit nicht gefunden.', 404);
  const ctx = assertCourse(user, unit.course_id, needed);
  return { unit, ...ctx };
}

/** Returns the role a user has on an H5P content object (via unit → course → project). */
export function contentRole(user, contentId) {
  if (!user) return null;
  const unit = db
    .prepare('SELECT c.project_id FROM units u JOIN courses c ON c.id = u.course_id WHERE u.content_id = ?')
    .get(String(contentId));
  if (unit) return projectRole(user, unit.project_id);
  // Content that is not (yet) attached to a unit belongs to its creator.
  const owner = db.prepare('SELECT user_id FROM content_owners WHERE content_id = ?').get(String(contentId));
  if (owner && owner.user_id === user.id) return 'owner';
  return user.role === 'admin' && owner ? 'owner' : null;
}

export const atLeast = (role, needed) => !!role && RANK[role] >= RANK[needed];
