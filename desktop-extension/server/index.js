#!/usr/bin/env node
// Plietschpaket – lokale MCP-Brücke für Claude Desktop (stdio ↔ HTTPS).
// Läuft auf dem Rechner der Nutzerin/des Nutzers und erreicht den Server dort, wo der Rechner ihn erreicht
// (z. B. nur über VPN). Keine Abhängigkeiten, nur Node-Bordmittel.
//
// Umgebung:
//   PLIETSCHPAKET_URL    Basis-URL, z. B. https://scorm.intern.example (ohne /mcp)
//   PLIETSCHPAKET_TOKEN  persönlicher Zugangsschlüssel (Konto → Claude Desktop), beginnt mit ssp_
//   PLIETSCHPAKET_CA     optional: Pfad zu einer PEM-Datei mit internem Stammzertifikat
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import readline from 'node:readline';
import os from 'node:os';
import path from 'node:path';

const VERSION = '1.1.0';
const base = String((process.env.PLIETSCHPAKET_URL || process.env.SCORM_STUDIO_URL) || '').trim().replace(/\/+$/, '').replace(/\/mcp$/, '');
const token = String((process.env.PLIETSCHPAKET_TOKEN || process.env.SCORM_STUDIO_TOKEN) || '').trim();
const caPath = String((process.env.PLIETSCHPAKET_CA || process.env.SCORM_STUDIO_CA) || '').trim();
const log = (...a) => process.stderr.write(`[plietschpaket-bridge] ${a.join(' ')}\n`);

let endpoint;
try {
  endpoint = new URL(`${base}/mcp`);
  if (!/^https?:$/.test(endpoint.protocol)) throw new Error('protocol');
} catch {
  log('PLIETSCHPAKET_URL fehlt oder ist ungültig.');
}
const isLocal = endpoint && ['localhost', '127.0.0.1', '::1'].includes(endpoint.hostname);
if (endpoint && endpoint.protocol === 'http:' && !isLocal) {
  log('Unverschlüsseltes http ist nur für localhost erlaubt.');
  endpoint = null;
}
let ca;
if (caPath) {
  try {
    ca = fs.readFileSync(caPath);
  } catch (e) {
    log(`Zertifikatsdatei nicht lesbar: ${caPath}`);
  }
}
const agent = endpoint && endpoint.protocol === 'https:' ? new https.Agent({ keepAlive: true, ...(ca ? { ca } : {}) }) : new http.Agent({ keepAlive: true });

let protocolVersion = null;

function write(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}
function rpcError(id, code, message) {
  if (id === undefined || id === null) return;
  write({ jsonrpc: '2.0', id, error: { code, message } });
}

function post(body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'content-length': data.length,
      authorization: `Bearer ${token}`,
      'user-agent': `plietschpaket-bridge/${VERSION}`
    };
    if (protocolVersion) headers['mcp-protocol-version'] = protocolVersion;
    const req = (endpoint.protocol === 'https:' ? https : http).request(endpoint, { method: 'POST', headers, agent, timeout: 300000 }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > 50 * 1024 * 1024) req.destroy(new Error('Antwort zu groß.'));
        else chunks.push(c);
      });
      res.on('end', () => resolve({ status: res.statusCode, type: String(res.headers['content-type'] || ''), text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('Zeitüberschreitung beim Server.')));
    req.on('error', reject);
    req.end(data);
  });
}

function parseBody(type, text) {
  if (!text.trim()) return [];
  if (type.includes('text/event-stream')) {
    const out = [];
    for (const block of text.split(/\r?\n\r?\n/)) {
      const payload = block
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (payload) out.push(JSON.parse(payload));
    }
    return out;
  }
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

// ------------------------------------------------------------------ local tool: upload_local_file
// Runs on this computer: reads a media file and sends it to the server tool upload_asset.
// Only media types are readable, so a manipulated prompt cannot exfiltrate arbitrary local files.
const LOCAL_TYPES = {
  png: ['image', 'image/png'], jpg: ['image', 'image/jpeg'], jpeg: ['image', 'image/jpeg'], gif: ['image', 'image/gif'], webp: ['image', 'image/webp'],
  mp4: ['video', 'video/mp4'], webm: ['video', 'video/webm'], m4v: ['video', 'video/mp4'],
  mp3: ['audio', 'audio/mpeg'], m4a: ['audio', 'audio/mp4'], wav: ['audio', 'audio/wav'], ogg: ['audio', 'audio/ogg'],
  vtt: ['file', 'text/vtt']
};
const MAX_LOCAL_BYTES = 100 * 1024 * 1024;
const LOCAL_TOOL = {
  name: 'upload_local_file',
  title: 'Datei von diesem Rechner hochladen',
  description:
    'Lädt eine Mediendatei (Bild, Video, Audio, Untertitel .vtt) direkt von diesem Rechner nach Plietschpaket hoch, ohne sie in den Chat zu kopieren. ' +
    'Ergebnis wie bei upload_asset: in das passende Feld der params einsetzen. path = absoluter Pfad oder ~/…',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string', description: 'Absoluter Pfad, z. B. ~/Screenshots/ios-de/01.png' } },
    required: ['path'],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
};

function localToolResult(id, text, isError) {
  write({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: !!isError } });
}

async function uploadLocalFile(msg) {
  const id = msg.id;
  const raw = String((msg.params && msg.params.arguments && msg.params.arguments.path) || '').trim();
  if (!raw) return localToolResult(id, 'path fehlt.', true);
  const file = path.resolve(raw.replace(/^~(?=$|[\\/])/, os.homedir()));
  const ext = path.extname(file).slice(1).toLowerCase();
  const type = LOCAL_TYPES[ext];
  if (!type) return localToolResult(id, `Nur Mediendateien erlaubt (${Object.keys(LOCAL_TYPES).join(', ')}).`, true);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return localToolResult(id, `Datei nicht gefunden: ${file}`, true);
  }
  if (!stat.isFile()) return localToolResult(id, 'Das ist keine Datei.', true);
  if (stat.size > MAX_LOCAL_BYTES) return localToolResult(id, 'Datei zu groß (max. 100 MB).', true);
  const data = fs.readFileSync(file);
  return handle({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name: 'upload_asset', arguments: { kind: type[0], base64: data.toString('base64'), filename: path.basename(file), mime: type[1] } }
  });
}

async function handle(msg) {
  const id = msg && msg.id;
  if (!endpoint) return rpcError(id, -32000, 'Plietschpaket-Adresse fehlt oder ist ungültig. In Claude Desktop unter Einstellungen → Erweiterungen → Plietschpaket eintragen.');
  if (!token) return rpcError(id, -32000, 'Zugangsschlüssel fehlt. In Plietschpaket unter Konto → Claude Desktop erzeugen und in der Erweiterung eintragen.');
  if (msg.method === 'initialize' && msg.params && msg.params.protocolVersion) protocolVersion = msg.params.protocolVersion;
  if (msg.method === 'tools/call' && msg.params && msg.params.name === LOCAL_TOOL.name) return uploadLocalFile(msg);
  let res;
  try {
    res = await post(msg);
  } catch (e) {
    return rpcError(id, -32000, `Plietschpaket nicht erreichbar (${e.code || e.message}). Besteht die VPN-Verbindung? Adresse: ${endpoint.origin}`);
  }
  if (res.status === 401) return rpcError(id, -32001, 'Zugangsschlüssel ungültig, abgelaufen oder widerrufen. Bitte unter Konto → Claude Desktop einen neuen erzeugen.');
  if (res.status === 202 || res.status === 204) return;
  if (res.status >= 400 && !res.type.includes('json')) return rpcError(id, -32000, `Serverfehler ${res.status}.`);
  let messages;
  try {
    messages = parseBody(res.type, res.text);
  } catch {
    return rpcError(id, -32000, `Unerwartete Antwort vom Server (${res.status}).`);
  }
  for (const m of messages) {
    // announce the local tool alongside the server tools
    if (msg.method === 'tools/list' && m.result && Array.isArray(m.result.tools)) m.result.tools.push(LOCAL_TOOL);
    write(m);
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  const batch = Array.isArray(msg) ? msg : [msg];
  for (const m of batch) handle(m).catch((e) => rpcError(m && m.id, -32603, e.message));
});
rl.on('close', () => process.exit(0));
log(`gestartet, Ziel ${endpoint ? endpoint.origin : '(nicht konfiguriert)'}`);
