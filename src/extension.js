/**
 * Builds the Claude Desktop extension (.mcpb = zip with manifest.json, server/, icon.png) on demand.
 * The server URL of this instance is filled in as default, so users only paste their access key.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { config } from './config.js';

const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'desktop-extension');
let cached = null;

export async function buildExtension() {
  if (cached) return cached;
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  manifest.user_config.server_url.default = config.publicUrl;
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const chunks = [];
  archive.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    archive.on('end', resolve);
    archive.on('error', reject);
  });
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
  archive.file(path.join(DIR, 'server/index.js'), { name: 'server/index.js' });
  archive.file(path.join(DIR, 'icon.png'), { name: 'icon.png' });
  archive.file(path.join(DIR, 'package.json'), { name: 'package.json' });
  await archive.finalize();
  await done;
  cached = Buffer.concat(chunks);
  return cached;
}

export function extensionHandler(req, res, next) {
  buildExtension()
    .then((buf) => {
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', 'attachment; filename="plietschpaket.mcpb"');
      res.set('Cache-Control', 'private, max-age=300');
      res.send(buf);
    })
    .catch(next);
}
