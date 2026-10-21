/**
 * Block Studio: blocks saved for reuse ("Eigene Bausteine"). Any block except H5P blocks can be saved; its media
 * files are copied, so the block works in every course. Owners see their own blocks, everybody sees shared ones
 * (only admins share).
 */
import fs from 'node:fs';
import path from 'node:path';
import { db, newId, audit, parseJson } from './db.js';
import { config } from './config.js';
import { assertCourse } from './access.js';
import { referencedMedia, mediaPath, courseMediaDir, BLOCK_TYPES, blockSummary } from './blocks.js';

class CustomBlockError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const dirOf = (id) => path.join(config.dataDir, 'custom-blocks', id);
const out = (r, user) => ({ id: r.id, name: r.name, type: r.type, shared: !!r.shared, mine: r.owner_id === user.id, summary: blockSummary({ data: parseJson(r.data, {}) }), createdAt: r.created_at });

export function listCustomBlocks(user) {
  return db.prepare('SELECT * FROM custom_blocks WHERE owner_id = ? OR shared = 1 ORDER BY name').all(user.id).map((r) => out(r, user));
}

export function saveCustomBlock(user, courseId, blockId, { name, shared = false }, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  const block = parseJson(course.blocks, []).find((b) => b.id === blockId);
  if (!block) throw new CustomBlockError('Diesen Block gibt es nicht mehr.', 404);
  if (block.type === 'h5p' || !BLOCK_TYPES[block.type]) throw new CustomBlockError('H5P-Blöcke lassen sich nicht als eigener Baustein speichern.');
  if (block.issues) throw new CustomBlockError('Der Block ist noch unvollständig.');
  if (shared && user.role !== 'admin') throw new CustomBlockError('Nur Admins können Bausteine für alle freigeben.', 403);
  const n = String(name || '').trim().slice(0, 80);
  if (!n) throw new CustomBlockError('Name des Bausteins fehlt.');
  if (db.prepare('SELECT COUNT(*) AS n FROM custom_blocks WHERE owner_id = ?').get(user.id).n >= 200) throw new CustomBlockError('Höchstens 200 eigene Bausteine.');
  const id = newId('cb_');
  const media = referencedMedia([block], {});
  if (media.length) fs.mkdirSync(dirOf(id), { recursive: true });
  for (const m of media) {
    const src = mediaPath(courseId, m);
    if (src) fs.copyFileSync(src, path.join(dirOf(id), m));
  }
  db.prepare('INSERT INTO custom_blocks (id, owner_id, name, shared, type, data) VALUES (?, ?, ?, ?, ?, ?)').run(id, user.id, n, shared ? 1 : 0, block.type, JSON.stringify(block.data));
  audit(user.id, 'customblock.create', id, { course: courseId, type: block.type }, via);
  return out(db.prepare('SELECT * FROM custom_blocks WHERE id = ?').get(id), user);
}

/** Copies the block's media into the course and returns { type, data } ready to insert. */
export function useCustomBlock(user, courseId, id) {
  assertCourse(user, courseId, 'editor');
  const r = db.prepare('SELECT * FROM custom_blocks WHERE id = ? AND (owner_id = ? OR shared = 1)').get(id, user.id);
  if (!r) throw new CustomBlockError('Baustein nicht gefunden.', 404);
  const src = dirOf(id);
  if (fs.existsSync(src)) {
    const dst = courseMediaDir(courseId);
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) if (!fs.existsSync(path.join(dst, f))) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  }
  return { type: r.type, data: parseJson(r.data, {}) };
}

export function deleteCustomBlock(user, id, via = 'web') {
  const r = db.prepare('SELECT * FROM custom_blocks WHERE id = ?').get(id);
  if (!r || (r.owner_id !== user.id && user.role !== 'admin')) throw new CustomBlockError('Baustein nicht gefunden.', 404);
  db.prepare('DELETE FROM custom_blocks WHERE id = ?').run(id);
  fs.rmSync(dirOf(id), { recursive: true, force: true });
  audit(user.id, 'customblock.delete', id, null, via);
}
