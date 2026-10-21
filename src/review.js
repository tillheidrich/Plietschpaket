/**
 * Review links and comments for block courses.
 * A review link gives people without an account read access to the live course (preview mode) and lets them
 * comment on single blocks or on the course as a whole. Tokens are random (32 bytes) and stored only as SHA-256.
 * Editors see, answer, resolve and delete comments in the editor and over MCP.
 */
import { db, newId, audit } from './db.js';
import { sha256, randomToken } from './auth.js';
import { assertCourse } from './access.js';

class ReviewError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const clean = (s, max) =>
  String(s ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);

function linkOut(row) {
  const open = db.prepare("SELECT COUNT(*) AS n FROM review_comments WHERE link_id = ? AND status = 'open' AND parent_id IS NULL").get(row.id).n;
  const total = db.prepare('SELECT COUNT(*) AS n FROM review_comments WHERE link_id = ?').get(row.id).n;
  return {
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revoked: !!row.revoked,
    active: !row.revoked && (!row.expires_at || row.expires_at > new Date().toISOString()),
    comments: total,
    open
  };
}

export function createReviewLink(user, courseId, { label = '', days = 30 } = {}, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  if (JSON.parse(course.settings || '{}').mode !== 'blocks') throw new ReviewError('Review-Links gibt es für Block-Kurse.');
  const d = Math.max(1, Math.min(365, Math.round(Number(days) || 30)));
  const token = randomToken(32);
  const id = newId('rl_');
  const expires = new Date(Date.now() + d * 86400000).toISOString();
  db.prepare('INSERT INTO review_links (id, course_id, label, token_hash, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, courseId, clean(label, 80), sha256(token), user.id, expires);
  audit(user.id, 'review.link_create', courseId, { link: id, days: d }, via);
  return { ...linkOut(db.prepare('SELECT * FROM review_links WHERE id = ?').get(id)), token };
}

export function listReviewLinks(user, courseId) {
  assertCourse(user, courseId, 'viewer');
  return db.prepare('SELECT * FROM review_links WHERE course_id = ? ORDER BY created_at DESC').all(courseId).map(linkOut);
}

export function revokeReviewLink(user, courseId, linkId, via = 'web') {
  assertCourse(user, courseId, 'editor');
  const res = db.prepare('UPDATE review_links SET revoked = 1 WHERE id = ? AND course_id = ?').run(linkId, courseId);
  if (!res.changes) throw new ReviewError('Link nicht gefunden.', 404);
  audit(user.id, 'review.link_revoke', courseId, { link: linkId }, via);
}

/** Link + course id for a token, or throws 404 (unknown, revoked or expired – no difference visible). */
export function resolveReviewToken(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) throw new ReviewError('Dieser Review-Link ist ungültig oder abgelaufen.', 404);
  const row = db.prepare('SELECT * FROM review_links WHERE token_hash = ?').get(sha256(token));
  if (!row || row.revoked || (row.expires_at && row.expires_at < new Date().toISOString())) throw new ReviewError('Dieser Review-Link ist ungültig oder abgelaufen.', 404);
  return row;
}

function commentOut(c) {
  return {
    id: c.id,
    blockId: c.block_id,
    parentId: c.parent_id,
    author: c.author_name,
    team: !!c.author_user_id,
    body: c.body,
    status: c.status,
    createdAt: c.created_at,
    resolvedAt: c.resolved_at,
    linkId: c.link_id
  };
}

function commentsOf(courseId, { status } = {}) {
  const rows = db.prepare('SELECT * FROM review_comments WHERE course_id = ? ORDER BY created_at').all(courseId);
  const roots = rows.filter((c) => !c.parent_id).map((c) => ({ ...commentOut(c), replies: rows.filter((r) => r.parent_id === c.id).map(commentOut) }));
  return status ? roots.filter((c) => c.status === status) : roots;
}

/** Comments as seen by reviewers through a link: everything on the course (reviewers see each other). */
export function reviewComments(link) {
  const strip = ({ linkId, ...c }) => c;
  return commentsOf(link.course_id).map((c) => ({ ...strip(c), replies: c.replies.map(strip) }));
}

export function courseComments(user, courseId, opts) {
  assertCourse(user, courseId, 'viewer');
  return commentsOf(courseId, opts);
}

function insertComment({ courseId, linkId = null, blockId, parentId, author, userId = null, body }) {
  const text = clean(body, 2000);
  if (!text) throw new ReviewError('Der Kommentar ist leer.');
  const name = clean(author, 80);
  if (!name) throw new ReviewError('Bitte einen Namen angeben.');
  let block = blockId ? clean(blockId, 40) : null;
  if (parentId) {
    const parent = db.prepare('SELECT * FROM review_comments WHERE id = ? AND course_id = ?').get(parentId, courseId);
    if (!parent || parent.parent_id) throw new ReviewError('Antwort auf unbekannten Kommentar.');
    block = parent.block_id;
    if (parent.status === 'resolved') db.prepare("UPDATE review_comments SET status = 'open', resolved_at = NULL, resolved_by = NULL WHERE id = ?").run(parent.id);
  }
  if (block) {
    const blocks = JSON.parse(db.prepare('SELECT blocks FROM courses WHERE id = ?').get(courseId).blocks || '[]');
    if (!blocks.some((b) => b.id === block)) throw new ReviewError('Diesen Block gibt es nicht mehr.');
  }
  const count = db.prepare('SELECT COUNT(*) AS n FROM review_comments WHERE course_id = ?').get(courseId).n;
  if (count >= 5000) throw new ReviewError('Zu viele Kommentare in diesem Kurs.');
  const id = newId('rc_');
  db.prepare('INSERT INTO review_comments (id, course_id, link_id, block_id, parent_id, author_name, author_user_id, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    id,
    courseId,
    linkId,
    block,
    parentId || null,
    name,
    userId,
    text
  );
  return commentOut(db.prepare('SELECT * FROM review_comments WHERE id = ?').get(id));
}

export function addReviewComment(link, { name, body, blockId, parentId }) {
  return insertComment({ courseId: link.course_id, linkId: link.id, blockId, parentId, author: name, body });
}

export function addTeamComment(user, courseId, { body, blockId, parentId }, via = 'web') {
  assertCourse(user, courseId, 'editor');
  const c = insertComment({ courseId, blockId, parentId, author: user.name, userId: user.id, body });
  audit(user.id, 'review.comment', courseId, { comment: c.id }, via);
  return c;
}

export function setCommentStatus(user, courseId, commentId, status, via = 'web') {
  assertCourse(user, courseId, 'editor');
  if (!['open', 'resolved'].includes(status)) throw new ReviewError('Status muss open oder resolved sein.');
  const res = db
    .prepare("UPDATE review_comments SET status = ?, resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') END, resolved_by = CASE WHEN ? = 'resolved' THEN ? END WHERE id = ? AND course_id = ? AND parent_id IS NULL")
    .run(status, status, status, user.name, commentId, courseId);
  if (!res.changes) throw new ReviewError('Kommentar nicht gefunden.', 404);
  audit(user.id, `review.${status}`, courseId, { comment: commentId }, via);
  return commentsOf(courseId).find((c) => c.id === commentId);
}

export function deleteComment(user, courseId, commentId, via = 'web') {
  assertCourse(user, courseId, 'editor');
  const res = db.prepare('DELETE FROM review_comments WHERE id = ? AND course_id = ?').run(commentId, courseId);
  if (!res.changes) throw new ReviewError('Kommentar nicht gefunden.', 404);
  audit(user.id, 'review.delete', courseId, { comment: commentId }, via);
}
