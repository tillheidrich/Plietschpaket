/**
 * Housekeeping (runs hourly and after deletions): removes files and rows nobody can reach any more.
 * Every step is isolated – one failing step never stops the others.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db } from './db.js';
import { getH5P } from './services.js';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const KEEP_EXPORTS_PER_COURSE = Number(process.env.KEEP_EXPORTS_PER_COURSE || 20);
const AUDIT_DAYS = Number(process.env.AUDIT_RETENTION_DAYS || 365);

async function step(name, fn) {
  try {
    const n = await fn();
    if (n) console.log(`[cleanup] ${name}: ${n}`);
  } catch (err) {
    console.error(`[cleanup] ${name} fehlgeschlagen:`, err.message);
  }
}

function olderThan(file, ms) {
  try {
    return Date.now() - fs.statSync(file).mtimeMs > ms;
  } catch {
    return false;
  }
}

export async function runCleanup() {
  const now = Date.now();
  await step('Sitzungen/Token', () => {
    let n = 0;
    n += db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now).changes;
    n += db.prepare('DELETE FROM oauth_codes WHERE expires_at < ?').run(now).changes;
    n += db.prepare('DELETE FROM oauth_tokens WHERE expires_at < ?').run(now).changes;
    n += db.prepare('DELETE FROM api_tokens WHERE expires_at < ? OR revoked = 1').run(now).changes;
    // registered OAuth clients that never got a token within a day
    n += db
      .prepare("DELETE FROM oauth_clients WHERE created_at < datetime('now', '-1 day') AND client_id NOT IN (SELECT DISTINCT client_id FROM oauth_tokens)")
      .run().changes;
    return n;
  });
  await step('alte Exporte', () => {
    const old = db
      .prepare(
        `SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY created_at DESC) AS rn FROM exports) WHERE rn > ?`
      )
      .all(KEEP_EXPORTS_PER_COURSE);
    for (const r of old) db.prepare('DELETE FROM exports WHERE id = ?').run(r.id);
    return old.length;
  });
  await step('verwaiste Exportdateien', () => {
    if (!fs.existsSync(config.exportsDir)) return 0;
    const known = new Set(db.prepare('SELECT id FROM exports').all().map((r) => r.id));
    let n = 0;
    for (const f of fs.readdirSync(config.exportsDir)) {
      const id = f.replace(/\.zip$/, '');
      if (!known.has(id)) {
        fs.rmSync(path.join(config.exportsDir, f), { force: true, recursive: true });
        n++;
      }
    }
    return n;
  });
  await step('Vorschauen', () => {
    if (!fs.existsSync(config.previewDir)) return 0;
    const known = new Set(db.prepare('SELECT id FROM exports').all().map((r) => r.id));
    let n = 0;
    for (const d of fs.readdirSync(config.previewDir)) {
      const p = path.join(config.previewDir, d);
      if (!known.has(d) || olderThan(p, DAY)) {
        fs.rmSync(p, { recursive: true, force: true });
        n++;
      }
    }
    return n;
  });
  await step('Temp-Dateien', () => {
    if (!fs.existsSync(config.tmpDir)) return 0;
    let n = 0;
    for (const f of fs.readdirSync(config.tmpDir)) {
      const p = path.join(config.tmpDir, f);
      if (olderThan(p, 6 * HOUR)) {
        fs.rmSync(p, { recursive: true, force: true });
        n++;
      }
    }
    return n;
  });
  await step('verwaiste H5P-Inhalte', async () => {
    const rows = db
      .prepare(
        "SELECT content_id FROM content_owners WHERE created_at < datetime('now', '-1 day') AND content_id NOT IN (SELECT content_id FROM units)"
      )
      .all();
    const { editor } = getH5P();
    for (const r of rows) {
      try {
        await editor.deleteContent(String(r.content_id), { id: 'system', name: 'system', email: '', type: 'local', role: 'admin' });
      } catch {
        /* already gone */
      }
      db.prepare('DELETE FROM content_owners WHERE content_id = ?').run(r.content_id);
    }
    return rows.length;
  });
  await step('Audit-Log', () => db.prepare(`DELETE FROM audit_log WHERE created_at < datetime('now', '-${AUDIT_DAYS} days')`).run().changes);
}

let running = false;
export function scheduleCleanup() {
  const tick = () => {
    if (running) return;
    running = true;
    runCleanup().finally(() => {
      running = false;
    });
  };
  setInterval(tick, HOUR).unref();
  setTimeout(tick, 30_000).unref();
  return tick;
}
