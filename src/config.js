import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const APP_ROOT = path.resolve(here, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(APP_ROOT, 'data'));

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const isProduction = process.env.NODE_ENV === 'production';
// Fail closed: in production the external URL must be configured explicitly (OAuth issuer, cookies, links).
if (isProduction && !process.env.PUBLIC_URL) {
  console.error('[config] PUBLIC_URL fehlt. Bitte die externe Adresse setzen, z. B. https://scorm.firma.de');
  process.exit(1);
}
const publicUrl = (process.env.PUBLIC_URL || 'http://localhost:8080').replace(/\/+$/, '');
const PLACEHOLDER_PASSWORDS = ['change-me-please', 'changeme', 'admin', 'password'];
if (isProduction && PLACEHOLDER_PASSWORDS.includes(String(process.env.ADMIN_PASSWORD || '').toLowerCase())) {
  console.error('[config] ADMIN_PASSWORD ist noch der Platzhalter aus der Vorlage. Bitte ein eigenes Passwort setzen.');
  process.exit(1);
}
const trustProxyRaw = process.env.TRUST_PROXY;

export const config = {
  port: Number(process.env.PORT || 8080),
  isProduction,
  // largest file accepted by the MCP tool upload_asset (base64 in JSON, so the request is ~1.37× larger)
  mcpUploadBytes: Math.max(1, Number(process.env.MCP_UPLOAD_MB || 100)) * 1024 * 1024,
  // hops (number) or "false"; default 1 = one reverse proxy (Traefik) in front
  trustProxy: trustProxyRaw === undefined || trustProxyRaw === '' ? 1 : /^\d+$/.test(trustProxyRaw) ? Number(trustProxyRaw) : bool(trustProxyRaw, false),
  oauthRedirectHosts: String(process.env.OAUTH_REDIRECT_HOSTS || 'claude.ai,claude.com')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
  publicUrl,
  secureCookies: publicUrl.startsWith('https://'),
  dataDir: DATA_DIR,
  // existing installations keep their database file from before the rename
  dbFile: fs.existsSync(path.join(DATA_DIR, 'scorm-studio.sqlite')) ? path.join(DATA_DIR, 'scorm-studio.sqlite') : path.join(DATA_DIR, 'plietschpaket.sqlite'),
  h5p: {
    bundledCore: path.join(APP_ROOT, 'h5p/core'),
    bundledEditor: path.join(APP_ROOT, 'h5p/editor'),
    bundledLibraries: path.join(APP_ROOT, 'h5p/libraries'),
    libraries: path.join(DATA_DIR, 'h5p/libraries'),
    content: path.join(DATA_DIR, 'h5p/content'),
    temporary: path.join(DATA_DIR, 'h5p/temporary'),
    userData: path.join(DATA_DIR, 'h5p/user-data'),
    configFile: path.join(DATA_DIR, 'h5p/config.json')
  },
  exportsDir: path.join(DATA_DIR, 'exports'),
  previewDir: path.join(DATA_DIR, 'previews'),
  tmpDir: path.join(DATA_DIR, 'tmp'),
  language: process.env.UI_LANGUAGE || 'de',
  allowHub: bool(process.env.ALLOW_HUB, false),
  libraryInstall: process.env.LIBRARY_INSTALL === 'all' ? 'all' : 'admin',
  seedAdmin: {
    email: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'Admin'
  },
  sessionDays: Number(process.env.SESSION_DAYS || 14),
  oauth: {
    accessTokenTtl: Number(process.env.OAUTH_ACCESS_TTL || 3600),
    refreshTokenTtl: Number(process.env.OAUTH_REFRESH_TTL || 60 * 60 * 24 * 30),
    codeTtl: 300
  },
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 512) * 1024 * 1024
};
