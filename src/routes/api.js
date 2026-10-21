import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { db, newId, audit, parseJson } from '../db.js';
import { config } from '../config.js';
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  createSession,
  destroySession,
  requireUser,
  requireAdmin,
  requireCsrf,
  publicUser,
  randomToken,
  verifySigned,
  revokeAllCredentials
} from '../auth.js';
import { AccessError, assertCourse, assertUnit, contentRole } from '../access.js';
import * as svc from '../services.js';
import { toH5pUser, resolveUbername } from '../h5p.js';
import { exportCourse, FORMATS, downloadName } from '../export/scorm.js';
import { importFile, exportProjectZip } from '../projectio.js';
import { listConnections, revokeConnection } from '../oauth.js';
import { listApiTokens, createApiToken, revokeApiToken } from '../apitokens.js';
import { tr, requestLanguage, UI_LANGUAGES } from '../i18n.js';
import { RateLimit, limitByIp, jobGate } from '../limits.js';
import { blockCatalog, BLOCK_CATEGORIES, PLAYER_DESIGNS, THEME_PRESETS, FONTS } from '../blocks.js';

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Login throttling: failures per email+IP, per IP (spraying) and per email (distributed guessing).
const WINDOW = 15 * 60_000;
const failPair = new RateLimit({ windowMs: WINDOW, max: 8 });
const failIp = new RateLimit({ windowMs: WINDOW, max: 30 });
const failEmail = new RateLimit({ windowMs: WINDOW, max: 20 });
// Constant work for unknown accounts, so response time does not reveal which emails exist.
const DUMMY_HASH = await hashPassword(randomToken(16));

export function apiRouter() {
  const r = express.Router();
  r.use(express.json({ limit: '25mb' }));
  // Translate {error} payloads into the user's language.
  r.use((req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body) => {
      if (body && typeof body.error === 'string' && res.statusCode >= 400) body = { ...body, error: tr(body.error, requestLanguage(req)) };
      return json(body);
    };
    next();
  });

  // ------------------------------------------------------------------ auth
  r.post(
    '/auth/login',
    ah(async (req, res) => {
      const email = String(req.body.email || '').trim().toLowerCase();
      const key = `${email}|${req.ip}`;
      if (failPair.blocked(key) || failIp.blocked(req.ip) || failEmail.blocked(email)) {
        audit(null, 'auth.login_throttled', email, { ip: req.ip });
        return res.status(429).json({ error: 'Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.' });
      }
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      const passwordOk = await verifyPassword(String(req.body.password || ''), user ? user.password_hash : DUMMY_HASH);
      const valid = user && user.active && passwordOk;
      if (!valid) {
        failPair.hit(key);
        failIp.hit(req.ip);
        failEmail.hit(email);
        audit(user ? user.id : null, 'auth.login_failed', email, { ip: req.ip });
        return res.status(401).json({ error: 'E-Mail oder Passwort stimmt nicht.' });
      }
      failPair.reset(key);
      const csrf = createSession(res, user.id);
      audit(user.id, 'auth.login', user.id);
      res.json({ user: publicUser(user), csrf });
    })
  );

  r.post('/auth/logout', requireCsrf, (req, res) => {
    destroySession(req, res);
    res.json({ ok: true });
  });

  r.get('/me', requireUser, (req, res) => {
    res.json({ user: publicUser(req.user), csrf: req.session?.csrf, app: { publicUrl: config.publicUrl, mcpUrl: `${config.publicUrl}/mcp`, version: process.env.APP_VERSION || '0.1.0' } });
  });

  // Everything below needs a logged-in user and a CSRF token for writes.
  r.use(requireUser, requireCsrf);

  r.patch(
    '/me',
    ah(async (req, res) => {
      if (req.body.language !== undefined) {
        if (!UI_LANGUAGES.includes(req.body.language)) return res.status(400).json({ error: 'Unbekanntes Format.' });
        db.prepare('UPDATE users SET language = ? WHERE id = ?').run(req.body.language, req.user.id);
      }
      if (req.body.name !== undefined) {
        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ error: 'Name fehlt.' });
        db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.slice(0, 120), req.user.id);
      }
      res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
    })
  );

  r.post(
    '/me/password',
    ah(async (req, res) => {
      if (!(await verifyPassword(String(req.body.current || ''), req.user.password_hash))) {
        return res.status(400).json({ error: 'Das aktuelle Passwort stimmt nicht.' });
      }
      const problem = validatePassword(req.body.next);
      if (problem) return res.status(400).json({ error: problem });
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(req.body.next), req.user.id);
      revokeAllCredentials(req.user.id, req.session.id);
      audit(req.user.id, 'auth.password_change', req.user.id);
      res.json({ ok: true });
    })
  );

  r.get('/me/api-tokens', (req, res) => res.json(listApiTokens(req.user.id)));
  r.post(
    '/me/api-tokens',
    ah(async (req, res) => {
      const b = req.body || {};
      // Re-authentication: a hijacked browser session must not be able to mint a long-lived key.
      if (!(await verifyPassword(String(b.password || ''), req.user.password_hash))) {
        audit(req.user.id, 'apitoken.create_denied', req.user.id);
        return res.status(400).json({ error: 'Das aktuelle Passwort stimmt nicht.' });
      }
      const created = createApiToken(req.user.id, { name: b.name, days: b.days });
      res.status(201).json({ created, tokens: listApiTokens(req.user.id) });
    })
  );
  r.delete('/me/api-tokens/:id', (req, res) => {
    if (!revokeApiToken(req.user.id, req.params.id)) return res.status(404).json({ error: 'Zugangsschlüssel nicht gefunden.' });
    res.json(listApiTokens(req.user.id));
  });

  r.get('/me/connections', (req, res) => res.json(listConnections(req.user.id)));
  r.delete('/me/connections/:clientId', (req, res) => {
    revokeConnection(req.user.id, req.params.clientId);
    audit(req.user.id, 'oauth.revoke', req.params.clientId);
    res.json(listConnections(req.user.id));
  });

  // ------------------------------------------------------------------ admin
  r.get('/admin/users', requireAdmin, (_req, res) => {
    res.json(db.prepare('SELECT * FROM users ORDER BY active DESC, name').all().map(publicUser));
  });

  r.post(
    '/admin/users',
    requireAdmin,
    ah(async (req, res) => {
      const email = String(req.body.email || '').trim().toLowerCase();
      const name = String(req.body.name || '').trim();
      const role = req.body.role === 'admin' ? 'admin' : 'user';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' });
      if (!name) return res.status(400).json({ error: 'Name fehlt.' });
      if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Es gibt bereits ein Konto mit dieser E-Mail-Adresse.' });
      const password = req.body.password ? String(req.body.password) : randomToken(12);
      const problem = validatePassword(password);
      if (problem) return res.status(400).json({ error: problem });
      const id = newId('u_');
      db.prepare('INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(id, email, name, await hashPassword(password), role);
      audit(req.user.id, 'admin.user_create', id, { email, role });
      res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)), initialPassword: req.body.password ? undefined : password });
    })
  );

  r.patch(
    '/admin/users/:id',
    requireAdmin,
    ah(async (req, res) => {
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
      if (!target) return res.status(404).json({ error: 'Nutzer nicht gefunden.' });
      const isSelf = target.id === req.user.id;
      if (req.body.role !== undefined) {
        const role = req.body.role === 'admin' ? 'admin' : 'user';
        if (isSelf && role !== 'admin') return res.status(400).json({ error: 'Du kannst dir die Admin-Rolle nicht selbst entziehen.' });
        if (target.role === 'admin' && role !== 'admin') ensureOtherAdmin(target.id);
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, target.id);
      }
      if (req.body.active !== undefined) {
        const active = req.body.active ? 1 : 0;
        if (isSelf && !active) return res.status(400).json({ error: 'Du kannst dein eigenes Konto nicht deaktivieren.' });
        if (target.role === 'admin' && !active) ensureOtherAdmin(target.id);
        db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active, target.id);
        if (!active) revokeAllCredentials(target.id);
      }
      if (req.body.name !== undefined && String(req.body.name).trim()) {
        db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(req.body.name).trim().slice(0, 120), target.id);
      }
      audit(req.user.id, 'admin.user_update', target.id, req.body);
      res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(target.id)));
    })
  );

  r.post(
    '/admin/users/:id/reset-password',
    requireAdmin,
    ah(async (req, res) => {
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
      if (!target) return res.status(404).json({ error: 'Nutzer nicht gefunden.' });
      const password = randomToken(12);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(password), target.id);
      revokeAllCredentials(target.id);
      audit(req.user.id, 'admin.password_reset', target.id);
      res.json({ temporaryPassword: password });
    })
  );

  r.get('/admin/audit', requireAdmin, (req, res) => {
    const limit = Math.min(500, Number(req.query.limit || 100));
    res.json(
      db
        .prepare('SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT ?')
        .all(limit)
        .map((a) => ({ ...a, detail: parseJson(a.detail, null) }))
    );
  });

  r.get(
    '/admin/stats',
    requireAdmin,
    ah(async (_req, res) => {
      const one = (sql) => db.prepare(sql).get().n;
      res.json({
        users: one('SELECT COUNT(*) AS n FROM users WHERE active = 1'),
        projects: one('SELECT COUNT(*) AS n FROM projects'),
        courses: one('SELECT COUNT(*) AS n FROM courses'),
        units: one('SELECT COUNT(*) AS n FROM units'),
        exports: one('SELECT COUNT(*) AS n FROM exports'),
        connections: one("SELECT COUNT(DISTINCT client_id || user_id) AS n FROM oauth_tokens WHERE revoked = 0 AND kind = 'refresh'"),
        contentTypes: (await svc.listContentTypes()).length
      });
    })
  );

  // ------------------------------------------------------------------ content types
  r.get('/content-types', ah(async (_req, res) => res.json(await svc.listContentTypes())));

  // ------------------------------------------------------------------ projects
  r.get('/projects', (req, res) => res.json(svc.listProjects(req.user)));
  r.post('/projects', (req, res) => res.status(201).json(svc.createProject(req.user, req.body)));
  r.get('/projects/:id', (req, res) => res.json(svc.getProject(req.user, req.params.id)));
  r.patch('/projects/:id', (req, res) => res.json(svc.updateProject(req.user, req.params.id, req.body)));
  r.delete(
    '/projects/:id',
    ah(async (req, res) => {
      await svc.deleteProject(req.user, req.params.id);
      res.json({ ok: true });
    })
  );
  r.post('/projects/:id/members', (req, res) => res.json(svc.setMember(req.user, req.params.id, req.body)));
  r.delete('/projects/:id/members/:userId', (req, res) => res.json(svc.removeMember(req.user, req.params.id, req.params.userId)));
  r.get(
    '/projects/:id/export',
    ah(async (req, res) => {
      await jobGate.run(req.user.id, () => exportProjectZip(req.user, req.params.id, res));
    })
  );

  const jobIpLimit = limitByIp(new RateLimit({ windowMs: 10 * 60_000, max: 30 }));
  const uploadLimit = limitByIp(new RateLimit({ windowMs: 10 * 60_000, max: 200 }));
  r.post(
    '/import',
    jobIpLimit,
    ah(async (req, res) => {
      const file = req.files && (req.files.file || Object.values(req.files)[0]);
      if (!file) return res.status(400).json({ error: 'Keine Datei empfangen.' });
      const b = req.body || {};
      const target = { projectId: b.projectId || undefined, courseId: b.courseId || undefined };
      const summary = await jobGate.run(req.user.id, () => importFile(req.user, file.tempFilePath, file.name, target));
      res.status(201).json(summary);
    })
  );

  // ------------------------------------------------------------------ courses
  r.post('/projects/:id/courses', (req, res) => res.status(201).json(svc.createCourse(req.user, req.params.id, req.body)));
  r.get('/courses/:id', (req, res) => res.json(svc.getCourse(req.user, req.params.id)));
  r.patch('/courses/:id', (req, res) => res.json(svc.updateCourse(req.user, req.params.id, req.body)));
  r.delete(
    '/courses/:id',
    ah(async (req, res) => {
      await svc.deleteCourse(req.user, req.params.id);
      res.json({ ok: true });
    })
  );
  r.post('/courses/:id/duplicate', ah(async (req, res) => res.status(201).json(await svc.duplicateCourse(req.user, req.params.id, req.body))));
  r.post('/courses/:id/reorder', (req, res) => res.json(svc.reorderUnits(req.user, req.params.id, req.body.unitIds)));
  r.post(
    '/courses/:id/export',
    jobIpLimit,
    ah(async (req, res) => {
      const format = req.body.format;
      if (!FORMATS[format]) return res.status(400).json({ error: 'Unbekanntes Format.' });
      res.status(201).json(await jobGate.run(req.user.id, () => exportCourse(req.user, req.params.id, format)));
    })
  );

  // ------------------------------------------------------------------ block courses
  r.get('/block-types', (req, res) =>
    res.json({ categories: BLOCK_CATEGORIES, types: blockCatalog(requestLanguage(req), { withSpec: true }), designs: PLAYER_DESIGNS, presets: THEME_PRESETS, fonts: FONTS })
  );
  r.put('/courses/:id/blocks', (req, res) => {
    const out = svc.saveBlocks(req.user, req.params.id, req.body.blocks, { expectedUpdatedAt: req.body.expectedUpdatedAt, draft: req.body.draft === true });
    const lang = requestLanguage(req);
    out.blocks = out.blocks.map((b) => (b.issues ? { ...b, issues: b.issues.map((m) => tr(m, lang)) } : b));
    res.json(out);
  });
  r.post('/courses/:id/blocks', (req, res) => res.status(201).json(svc.insertBlocks(req.user, req.params.id, req.body.blocks, { afterId: req.body.afterId, position: req.body.position })));
  r.patch('/courses/:id/blocks/:blockId', (req, res) => res.json(svc.updateBlock(req.user, req.params.id, req.params.blockId, req.body)));
  r.delete('/courses/:id/blocks/:blockId', (req, res) => res.json(svc.deleteBlocks(req.user, req.params.id, [req.params.blockId])));
  r.post('/courses/:id/blocks/:blockId/move', (req, res) => res.json(svc.moveBlock(req.user, req.params.id, req.params.blockId, req.body)));
  r.put('/courses/:id/design', (req, res) => res.json(svc.setDesign(req.user, req.params.id, req.body || {})));
  r.get('/courses/:id/media', (req, res) => res.json(svc.courseMedia(req.user, req.params.id)));
  r.post(
    '/courses/:id/media',
    uploadLimit,
    express.raw({ type: () => true, limit: config.maxUploadBytes }),
    (req, res) => {
      const name = String(req.get('x-filename') || req.query.name || '');
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Leere Datei.' });
      res.status(201).json(svc.uploadCourseMedia(req.user, req.params.id, decodeURIComponent(name), req.body, config.maxUploadBytes));
    }
  );

  r.post('/courses/:id/units/draft', ah(async (req, res) => res.status(201).json(await svc.createDraftUnit(req.user, req.params.id, req.body.library, req.body.title))));

  // Browser editor: create a unit from the H5P editor payload
  r.post(
    '/courses/:id/units/editor',
    ah(async (req, res) => {
      const { course } = assertCourse(req.user, req.params.id, 'editor');
      const body = req.body;
      if (!body?.library || !body?.params?.params || !body?.params?.metadata) return res.status(400).json({ error: 'Unvollständige Daten vom Editor.' });
      const lib = await resolveUbername(svc.getH5P().editor, body.library);
      if (!lib) return res.status(400).json({ error: 'Inhaltstyp nicht installiert.' });
      const metadata = { ...body.params.metadata, language: body.params.metadata.language || course.language };
      const { id: contentId, metadata: saved } = await svc
        .getH5P()
        .editor.saveOrUpdateContentReturnMetaData(undefined, body.params.params, metadata, lib.ubername, toH5pUser(req.user));
      const unit = svc.attachContent(req.user, course.id, { contentId: String(contentId), title: saved.title || 'Neue Einheit', library: lib.ubername });
      res.status(201).json({ contentId: String(contentId), metadata: saved, unit });
    })
  );

  // ------------------------------------------------------------------ units
  r.get('/units/:id', ah(async (req, res) => res.json(await svc.getUnit(req.user, req.params.id))));
  r.patch('/units/:id', ah(async (req, res) => res.json(await svc.updateUnit(req.user, req.params.id, { title: req.body.title, weight: req.body.weight }))));
  r.delete(
    '/units/:id',
    ah(async (req, res) => {
      await svc.deleteUnit(req.user, req.params.id);
      res.json({ ok: true });
    })
  );
  r.post('/units/:id/move', (req, res) => res.json(svc.moveUnit(req.user, req.params.id, req.body)));
  r.post(
    '/units/:id/editor',
    ah(async (req, res) => {
      const { unit } = assertUnit(req.user, req.params.id, 'editor');
      const body = req.body;
      if (!body?.library || !body?.params?.params || !body?.params?.metadata) return res.status(400).json({ error: 'Unvollständige Daten vom Editor.' });
      const lib = await resolveUbername(svc.getH5P().editor, body.library);
      if (!lib) return res.status(400).json({ error: 'Inhaltstyp nicht installiert.' });
      const { metadata } = await svc
        .getH5P()
        .editor.saveOrUpdateContentReturnMetaData(unit.content_id, body.params.params, body.params.metadata, lib.ubername, toH5pUser(req.user));
      if (lib.ubername !== unit.library) db.prepare('UPDATE units SET library = ? WHERE id = ?').run(lib.ubername, unit.id);
      svc.noteUnitSaved(req.user, unit.id, { title: metadata.title });
      res.json({ contentId: unit.content_id, metadata });
    })
  );

  // H5P models for the web components
  r.get(
    '/h5p/editor-model/:contentId',
    ah(async (req, res) => {
      const { editor } = svc.getH5P();
      const h5pUser = toH5pUser(req.user, req.session.csrf);
      const contentId = req.params.contentId === 'new' ? undefined : req.params.contentId;
      if (contentId) {
        const role = contentRole(req.user, contentId);
        if (!role) throw new AccessError('Inhalt nicht gefunden.', 404);
        if (role === 'viewer') throw new AccessError('Keine Bearbeitungsrechte.');
      }
      const model = await editor.render(contentId, req.user.language || config.language, h5pUser);
      if (!contentId) return res.json(model);
      const content = await editor.getContent(contentId, h5pUser);
      res.json({ ...model, library: content.library, metadata: content.params.metadata, params: content.params.params });
    })
  );

  r.get(
    '/h5p/player-model/:contentId',
    ah(async (req, res) => {
      const { player } = svc.getH5P();
      if (!contentRole(req.user, req.params.contentId)) throw new AccessError('Inhalt nicht gefunden.', 404);
      const model = await player.render(req.params.contentId, toH5pUser(req.user, req.session.csrf), req.user.language || config.language, {
        showCopyButton: false,
        showDownloadButton: false,
        showFrame: false,
        showH5PIcon: false,
        showLicenseButton: false
      });
      res.json(model);
    })
  );

  // ------------------------------------------------------------------ exports
  r.get('/exports/:id', (req, res) => {
    const row = exportForUser(req.user, req.params.id);
    res.json({ id: row.id, courseId: row.course_id, format: row.format, version: row.version, size: row.size, createdAt: row.created_at, report: parseJson(row.report, {}) });
  });

  r.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status || err.httpStatusCode || 500;
    if (status >= 500) console.error('[api]', err);
    const lang = requestLanguage(req);
    res.status(status).json({
      error: tr(status >= 500 ? 'Interner Fehler. Details stehen im Server-Log.' : err.message, lang),
      details: err.details ? err.details.map((d) => tr(d, lang)) : undefined
    });
  });
  return r;
}

function ensureOtherAdmin(excludeId) {
  const n = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id != ?").get(excludeId).n;
  if (!n) throw Object.assign(new Error('Es muss mindestens ein aktiver Admin bleiben.'), { status: 400 });
}

export function exportForUser(user, exportId) {
  const row = db.prepare('SELECT * FROM exports WHERE id = ?').get(exportId);
  if (!row) throw new AccessError('Export nicht gefunden.', 404);
  assertCourse(user, row.course_id, 'viewer');
  return row;
}

/** Download route that also accepts signed links (used by MCP clients). */
export function downloadHandler(req, res, next) {
  try {
    const row = db.prepare('SELECT e.*, c.title FROM exports e JOIN courses c ON c.id = e.course_id WHERE e.id = ?').get(req.params.id);
    if (!row) return res.status(404).send('Export nicht gefunden.');
    const signed = req.query.sig && verifySigned(row.id, String(req.query.sig));
    if (!signed) {
      if (!req.user) return res.redirect(302, `/login?next=${encodeURIComponent(req.originalUrl)}`);
      assertCourse(req.user, row.course_id, 'viewer');
    }
    if (!fs.existsSync(row.file)) return res.status(410).send('Die Datei ist nicht mehr vorhanden. Bitte neu exportieren.');
    res.download(row.file, downloadName(row.title, row.version, row.format));
  } catch (err) {
    next(err);
  }
}

export { path };
