import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import fileUpload from 'express-fileupload';
import { h5pAjaxExpressRouter } from '@lumieducation/h5p-express';
import { config, APP_ROOT } from './config.js';
import { db } from './db.js';
import { seedAdmin, sessionMiddleware, purgeExpired } from './auth.js';
import { createH5P, toH5pUser } from './h5p.js';
import { contentRole, atLeast } from './access.js';
import { setH5P, getCourse, courseMediaFile } from './services.js';
import { apiRouter, downloadHandler, exportForUser } from './routes/api.js';
import { oauthRouter, bearerAuth, MCP_PATH } from './oauth.js';
import { handleMcp } from './mcp.js';
import { extensionHandler } from './extension.js';
import { ensurePreview, playerHtml } from './export/scorm.js';
import { mediaMime, PLAYER_DESIGNS } from './blocks.js';
import { previewPage } from './preview.js';
import { scheduleCleanup } from './cleanup.js';
import { checkUploadFile } from './sniff.js';

for (const dir of [config.dataDir, config.tmpDir, config.exportsDir, config.previewDir]) fs.mkdirSync(dir, { recursive: true });

await seedAdmin();
const h5p = await createH5P();
setH5P(h5p);

const app = express();
app.disable('x-powered-by');
// Number of reverse-proxy hops in front of the app (Traefik/Coolify = 1). Only trust X-Forwarded-For
// from there; the container port must not be published directly (see README).
app.set('trust proxy', config.trustProxy);

// ---------------------------------------------------------------- security headers (all responses)
const EMBED_HOSTS = 'https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com';
const APP_CSP = [
  "default-src 'self'",
  // H5P core and content types need inline scripts/styles and eval (jQuery, editor widgets).
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://player.vimeo.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com https://i.vimeocdn.com",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  `frame-src 'self' ${EMBED_HOSTS}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'"
].join('; ');
// After consent the browser is redirected to the client (claude.ai or a loopback port of a desktop client).
const OAUTH_CSP = "default-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; script-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https: http://localhost:* http://127.0.0.1:* http://[::1]:*";
// User-supplied files (uploads, temp files): never executable, never framed.
const FILE_CSP = "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'";
const API_CSP = "default-src 'none'; frame-ancestors 'none'";
const INLINE_FILE = /\.(png|jpe?g|gif|webp|bmp|tiff?|mp4|webm|ogg|mp3|m4a|wav|vtt|webvtt|woff2?|ttf|otf|eot|json)$/i;

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)');
  if (config.secureCookies) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  const p = req.path;
  if (p.startsWith('/oauth/')) {
    res.set('Content-Security-Policy', OAUTH_CSP);
    res.set('X-Frame-Options', 'DENY');
  } else if (/^\/h5p\/(content|temp-files)\//.test(p)) {
    res.set('Content-Security-Policy', FILE_CSP);
    if (!INLINE_FILE.test(p)) res.set('Content-Disposition', 'attachment');
  } else if (p.startsWith('/api/') || p === MCP_PATH || p.startsWith('/.well-known/')) {
    res.set('Content-Security-Policy', API_CSP);
  } else {
    res.set('Content-Security-Policy', APP_CSP);
    res.set('X-Frame-Options', 'SAMEORIGIN');
  }
  next();
});
app.get('/robots.txt', (_req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));

// CORS for the machine-facing endpoints (MCP inspector, desktop clients).
const corsPaths = [MCP_PATH, '/.well-known/', '/oauth/token', '/oauth/register', '/oauth/revoke'];
app.use((req, res, next) => {
  if (!corsPaths.some((p) => req.path === p || req.path.startsWith(p))) return next();
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID');
  res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.set('Access-Control-Expose-Headers', 'WWW-Authenticate, Mcp-Session-Id');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.get('/healthz', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[healthz]', err);
    res.status(503).json({ status: 'error' });
  }
});

// MCP (bearer token, no cookies)
// Auth before body parsing: unauthenticated clients cannot make us buffer large bodies.
app.post(MCP_PATH, bearerAuth, express.json({ limit: Math.ceil(config.mcpUploadBytes * 1.4) + 1024 * 1024 }), handleMcp);
app.get(MCP_PATH, bearerAuth, handleMcp);
app.delete(MCP_PATH, bearerAuth, handleMcp);

app.use(
  fileUpload({
    limits: { fileSize: config.maxUploadBytes },
    useTempFiles: true,
    tempFileDir: config.tmpDir,
    abortOnLimit: true
  })
);
app.use((req, res, next) => {
  // remove temp upload files once the request is done
  res.on('finish', () => {
    if (!req.files) return;
    for (const f of Object.values(req.files).flat()) {
      if (f.tempFilePath) fs.promises.rm(f.tempFilePath, { force: true }).catch(() => {});
    }
  });
  next();
});

app.use(sessionMiddleware);
app.use(oauthRouter());
app.get('/api/exports/:id/download', downloadHandler);
app.use('/api', apiRouter());

// --------------------------------------------------------------- H5P endpoints
const h5pRouter = h5pAjaxExpressRouter(h5p.editor, config.h5p.bundledCore, config.h5p.bundledEditor, undefined, 'auto');
app.use(
  h5p.h5pConfig.baseUrl,
  (req, res, next) => {
    if (!req.user) return res.status(401).send('Nicht angemeldet.');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const sent = req.query._csrf || req.get('x-csrf-token');
      if (!sent || sent !== req.session.csrf) return res.status(403).send('Sicherheitstoken fehlt.');
    }
    // Content-bound routes: check the project role ourselves (h5p-server's download route skips its
    // permission system, see Lumi PackageExporter) and answer 404 for foreign or unknown content.
    const m = req.path.match(/^\/(?:content|params|download)\/([^/]+)/);
    if (m) {
      if (!atLeast(contentRole(req.user, m[1]), 'viewer')) return res.status(404).send('Nicht gefunden.');
    }
    // Uploads through the H5P editor: content must match the file extension (magic bytes).
    if (req.files) {
      for (const f of Object.values(req.files).flat()) {
        const problem = f.tempFilePath ? checkUploadFile(f.tempFilePath, f.name) : null;
        if (problem) return res.status(400).json({ success: false, message: problem, errorCode: 'upload-rejected' });
      }
    }
    req.dbUser = req.user;
    req.user = toH5pUser(req.user, req.session.csrf);
    const lng = req.dbUser.language || config.language;
    req.t = (key, opts) => h5p.i18n(key, { lng, ...(opts || {}) });
    req.language = lng;
    next();
  },
  express.json({ limit: '50mb' }),
  express.urlencoded({ extended: true, limit: '5mb' }),
  h5pRouter
);

// --------------------------------------------------------------- export previews (LMS simulator)
app.get('/exports/:id/preview', async (req, res, next) => {
  try {
    if (!req.user) return res.redirect(302, `/login?next=${encodeURIComponent(req.originalUrl)}`);
    const row = exportForUser(req.user, req.params.id);
    await ensurePreview(row);
    res.send(previewPage(row, req.user.language || 'de'));
  } catch (err) {
    next(err);
  }
});
app.get('/exports/:id/pkg/*splat', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).send('Nicht angemeldet.');
    const row = exportForUser(req.user, req.params.id);
    const dir = await ensurePreview(row);
    const rel = [].concat(req.params.splat).join('/');
    const file = path.resolve(dir, rel);
    if (!file.startsWith(dir + path.sep)) return res.status(400).end();
    res.sendFile(file, (err) => err && next());
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------- Claude Desktop extension
app.get('/downloads/scorm-studio.mcpb', (_req, res) => res.redirect(301, '/downloads/plietschpaket.mcpb'));
app.get('/downloads/plietschpaket.mcpb', (req, res, next) => {
  if (!req.user) return res.redirect(302, '/login?next=/connect');
  extensionHandler(req, res, next);
});

// --------------------------------------------------------------- block courses: runtime, media, live preview
const RUNTIME_FILES = new Set(['blocks.js', 'player.js', 'player.css']);
app.get('/runtime/:file', (req, res, next) => {
  if (!RUNTIME_FILES.has(req.params.file)) return next();
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(APP_ROOT, 'src/export/runtime', req.params.file));
});
app.get('/runtime/fonts/Geist-Variable.woff2', (_req, res) => res.sendFile(path.join(APP_ROOT, 'public/assets/fonts/Geist-Variable.woff2')));
app.get('/course-media/:courseId/:name', (req, res, next) => {
  try {
    if (!req.user) return res.status(401).send('Nicht angemeldet.');
    const file = courseMediaFile(req.user, req.params.courseId, req.params.name);
    if (!file) return res.status(404).send('Nicht gefunden.');
    const mime = mediaMime(req.params.name);
    const inline = /^(image|video|audio)\//.test(mime) || mime === 'text/vtt' || mime === 'application/pdf';
    // User files are never executable; PDFs may be framed by our own pages (PDF block).
    res.set('Content-Security-Policy', mime === 'application/pdf' ? "default-src 'none'; frame-ancestors 'self'" : FILE_CSP);
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('Cache-Control', 'private, max-age=300');
    if (!inline) res.set('Content-Disposition', 'attachment');
    res.type(mime).sendFile(file);
  } catch (err) {
    next(err);
  }
});
app.get('/live/:courseId', (req, res, next) => {
  try {
    if (!req.user) return res.redirect(302, `/login?next=${encodeURIComponent(req.originalUrl)}`);
    const full = getCourse(req.user, req.params.courseId);
    const design = { ...full.design };
    if (PLAYER_DESIGNS.includes(req.query.design)) design.player = req.query.design;
    const units = Object.fromEntries(full.units.map((u) => [u.id, { title: u.title, library: String(u.library).split(' ')[0], href: null }]));
    const payload = {
      title: full.title,
      description: full.description,
      language: full.language,
      packageUuid: full.packageUuid,
      scormVersion: full.settings.scormVersion,
      settings: { completion: full.settings.completion, masteryScore: full.settings.masteryScore, navigation: full.settings.navigation },
      design,
      blocks: full.blocks,
      units,
      mediaBase: `/course-media/${encodeURIComponent(full.id)}/`,
      preview: true
    };
    res.set('Cache-Control', 'no-store');
    res.send(playerHtml(full, payload, { assetBase: '/runtime/' }));
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------- static + SPA
app.use('/assets', express.static(path.join(APP_ROOT, 'public/assets'), { maxAge: '1h' }));
app.use('/vendor', express.static(path.join(APP_ROOT, 'public/vendor'), { maxAge: '7d', immutable: false }));
app.get('/favicon.svg', (_req, res) => res.sendFile(path.join(APP_ROOT, 'public/assets/favicon.svg')));

const spaIndex = path.join(APP_ROOT, 'public/index.html');
app.get(['/', '/login', '/projects', '/projects/*splat', '/courses/*splat', '/units/*splat', '/admin', '/admin/*splat', '/account', '/import', '/connect'], (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(spaIndex);
});

app.use((err, req, res, _next) => {
  const status = err.status || err.httpStatusCode || 500;
  if (status >= 500) console.error('[server]', err);
  if (res.headersSent) return;
  if (req.path.startsWith('/api') || req.accepts(['json', 'html']) === 'json') {
    res.status(status).json({ error: status >= 500 ? 'Interner Fehler.' : err.message });
  } else {
    res.status(status).send(status >= 500 ? 'Interner Fehler.' : err.message);
  }
});

setInterval(purgeExpired, 60 * 60 * 1000).unref();
purgeExpired();
scheduleCleanup();

app.listen(config.port, () => {
  console.log(`[plietschpaket] läuft auf Port ${config.port} · ${config.publicUrl}`);
});
