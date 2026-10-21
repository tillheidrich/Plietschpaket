import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const migrations = [
  // 1: core schema
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    branding TEXT NOT NULL DEFAULT '{}',
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE project_members (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (project_id, user_id)
  );
  CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'de',
    settings TEXT NOT NULL DEFAULT '{}',
    package_uuid TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE units (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    library TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    weight REAL NOT NULL DEFAULT 1,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX units_course ON units(course_id, position);
  CREATE TABLE content_owners (
    content_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE exports (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    format TEXT NOT NULL,
    version INTEGER NOT NULL,
    file TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    report TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE oauth_clients (
    client_id TEXT PRIMARY KEY,
    client_secret_hash TEXT,
    name TEXT NOT NULL,
    redirect_uris TEXT NOT NULL,
    auth_method TEXT NOT NULL DEFAULT 'none',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE oauth_codes (
    code_hash TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    scope TEXT NOT NULL,
    resource TEXT,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE oauth_tokens (
    token_hash TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('access','refresh')),
    client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    family TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
  );
  CREATE INDEX oauth_tokens_user ON oauth_tokens(user_id);
  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT,
    via TEXT NOT NULL DEFAULT 'web',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,
  // 2: per-user interface language
  `ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'de';`,
  // 3: personal access keys for local MCP clients (Claude Desktop extension, VPN-only setups)
  `
  CREATE TABLE api_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    hint TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT,
    expires_at INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX api_tokens_user ON api_tokens(user_id);
  `,
  // 4: block courses (flat block list + player design)
  `
  ALTER TABLE courses ADD COLUMN blocks TEXT NOT NULL DEFAULT '[]';
  ALTER TABLE courses ADD COLUMN design TEXT NOT NULL DEFAULT '{}';
  `,
  // 5: custom course languages (admin-defined, on top of the built-in ones)
  `
  CREATE TABLE languages (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dir TEXT NOT NULL DEFAULT 'ltr',
    base TEXT NOT NULL DEFAULT 'en',
    labels TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `
];

db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version));
migrations.forEach((sql, index) => {
  const version = index + 1;
  if (applied.has(version)) return;
  db.transaction(() => {
    db.exec(sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, datetime('now'))").run(version);
  })();
});

export const newId = (prefix = '') => prefix + crypto.randomBytes(9).toString('base64url');

export function audit(userId, action, target, detail, via = 'web') {
  db.prepare('INSERT INTO audit_log (user_id, action, target, detail, via) VALUES (?, ?, ?, ?, ?)').run(
    userId || null,
    action,
    target || null,
    detail ? JSON.stringify(detail) : null,
    via
  );
}

export const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};
