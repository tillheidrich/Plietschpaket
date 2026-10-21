/**
 * MCP server (Streamable HTTP, stateless). Every request is authenticated with an
 * OAuth access token (see oauth.js) and acts as that user with their project rights.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { signValue } from './auth.js';
import * as svc from './services.js';
import { describeSchema, getSemantics, normalizeParams } from './schema.js';
import { exportCourse, FORMATS } from './export/scorm.js';
import { toH5pUser } from './h5p.js';
import { AUTHORING_GUIDE } from './guide.js';
import { jobGate } from './limits.js';
import { kindMatches } from './sniff.js';

const VERSION = '0.1.0';

function ok(data, text) {
  return {
    content: [{ type: 'text', text: text ? `${text}\n\n${JSON.stringify(data, null, 2)}` : JSON.stringify(data, null, 2) }],
    structuredContent: Array.isArray(data) ? { items: data } : data
  };
}

function fail(err) {
  const details = err.details ? `\n- ${err.details.join('\n- ')}` : '';
  return { isError: true, content: [{ type: 'text', text: `${err.message}${details}` }] };
}

function wrap(fn) {
  return async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      if (!err.status) console.error('[mcp]', err);
      return fail(err);
    }
  };
}

const appLink = (path) => `${config.publicUrl}${path}`;

const MIME = { mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', vtt: 'text/vtt', pdf: 'application/pdf' };
function guessMime(name) {
  const ext = String(name || '').split('.').pop().toLowerCase();
  return MIME[ext];
}

export function buildMcpServer(user) {
  const server = new McpServer(
    { name: 'plietschpaket', version: VERSION },
    {
      instructions:
        'Plietschpaket baut interaktive Lernkurse aus H5P-Inhalten und exportiert sie als SCORM-Paket. ' +
        'Struktur: Projekt → Kurs → Einheiten (je ein H5P-Inhalt). Vor dem ersten Inhalt get_authoring_guide lesen. ' +
        'Für jeden Inhaltstyp mit get_content_schema die Felder prüfen; Oberflächentexte werden automatisch befüllt. ' +
        'Antworten des Nutzers sind auf Deutsch zu verfassen, sofern der Kurs nicht anders verlangt.'
    }
  );
  const via = 'mcp';
  const ro = { readOnlyHint: true, openWorldHint: false };
  const rw = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
  const destructive = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

  server.registerTool(
    'get_authoring_guide',
    {
      title: 'Leitfaden für Kursautoren',
      description: 'Arbeitsweise, didaktische Regeln und funktionierende Beispiel-Parameter für die wichtigsten Inhaltstypen. Vor dem ersten create_unit lesen.',
      annotations: ro
    },
    wrap(async () => ({ content: [{ type: 'text', text: AUTHORING_GUIDE }] }))
  );

  server.registerTool(
    'whoami',
    { title: 'Angemeldeter Nutzer', description: 'Zeigt, als wer dieser Zugang handelt.', annotations: ro },
    wrap(async () => ok({ id: user.id, name: user.name, email: user.email, role: user.role, app: config.publicUrl }))
  );

  server.registerTool(
    'list_projects',
    { title: 'Projekte auflisten', description: 'Alle Projekte, auf die der Nutzer Zugriff hat, mit eigener Rolle.', annotations: ro },
    wrap(async () => ok(svc.listProjects(user)))
  );

  server.registerTool(
    'get_project',
    {
      title: 'Projekt anzeigen',
      description: 'Projekt mit Kursen und Mitgliedern.',
      inputSchema: { project_id: z.string() },
      annotations: ro
    },
    wrap(async ({ project_id }) => ok({ ...svc.getProject(user, project_id), url: appLink(`/projects/${project_id}`) }))
  );

  server.registerTool(
    'create_project',
    {
      title: 'Projekt anlegen',
      description: 'Legt ein neues Projekt an. Der Nutzer wird Owner.',
      inputSchema: { name: z.string().min(1).max(200), description: z.string().max(2000).optional() },
      annotations: rw
    },
    wrap(async ({ name, description }) => {
      const p = svc.createProject(user, { name, description }, via);
      return ok({ ...p, url: appLink(`/projects/${p.id}`) }, 'Projekt angelegt.');
    })
  );

  server.registerTool(
    'set_project_member',
    {
      title: 'Mitglied hinzufügen oder Rolle ändern',
      description: 'Gibt einem bestehenden Konto (per E-Mail) Zugriff auf ein Projekt. Rollen: owner, editor, viewer. Nur Owner.',
      inputSchema: { project_id: z.string(), email: z.string().email(), role: z.enum(['owner', 'editor', 'viewer']) },
      annotations: rw
    },
    wrap(async ({ project_id, email, role }) => ok(svc.setMember(user, project_id, { email, role }, via)))
  );

  server.registerTool(
    'list_content_types',
    {
      title: 'Inhaltstypen',
      description: 'Installierte H5P-Inhaltstypen (empfohlene zuerst) mit Hinweis, wofür sie taugen.',
      annotations: ro
    },
    wrap(async () => ok(await svc.listContentTypes()))
  );

  server.registerTool(
    'get_content_schema',
    {
      title: 'Felder eines Inhaltstyps',
      description:
        'JSON-Schema der Parameter eines Inhaltstyps (z. B. "H5P.MultiChoice"). compact=true blendet Oberflächentexte mit Standardwert aus.',
      inputSchema: { content_type: z.string(), compact: z.boolean().optional() },
      annotations: ro
    },
    wrap(async ({ content_type, compact }) => {
      const { editor } = svc.getH5P();
      const resolved = await getSemantics(editor, content_type);
      if (!resolved) throw Object.assign(new Error(`Inhaltstyp ${content_type} ist nicht installiert.`), { status: 404 });
      return ok({ contentType: resolved.lib.ubername, schema: describeSchema(resolved.semantics, { compact: compact !== false }) });
    })
  );

  server.registerTool(
    'validate_params',
    {
      title: 'Parameter prüfen',
      description: 'Prüft Parameter gegen den Inhaltstyp, ohne etwas zu speichern. Gibt die vervollständigten Parameter oder eine Fehlerliste zurück.',
      inputSchema: { content_type: z.string(), params: z.record(z.string(), z.any()) },
      annotations: ro
    },
    wrap(async ({ content_type, params }) => {
      const { editor } = svc.getH5P();
      const { errors, library } = await normalizeParams(editor, content_type, params);
      return ok({ contentType: library?.ubername || content_type, valid: errors.length === 0, errors });
    })
  );

  const settingsSchema = z
    .object({
      scormVersion: z.enum(['1.2', '2004']).optional(),
      completion: z.enum(['all', 'viewed']).optional(),
      masteryScore: z.number().min(0).max(100).optional(),
      navigation: z.enum(['free', 'linear']).optional(),
      showUnitList: z.boolean().optional()
    })
    .optional();

  server.registerTool(
    'create_course',
    {
      title: 'Kurs anlegen',
      description:
        'Neuer Kurs in einem Projekt. language: de|en|fr|it (Sprache der Kursoberfläche und der vorbelegten H5P-Texte). settings: scormVersion 1.2|2004, completion all (alle Einheiten erledigt, Fragen beantwortet) | viewed (alle geöffnet), masteryScore in Prozent, navigation free|linear.',
      inputSchema: {
        project_id: z.string(),
        title: z.string().min(1).max(200),
        description: z.string().max(4000).optional(),
        language: z.string().optional(),
        settings: settingsSchema
      },
      annotations: rw
    },
    wrap(async ({ project_id, title, description, language, settings }) => {
      const c = svc.createCourse(user, project_id, { title, description, language, settings }, via);
      return ok({ ...c, url: appLink(`/courses/${c.id}`) }, 'Kurs angelegt.');
    })
  );

  server.registerTool(
    'get_course',
    { title: 'Kurs anzeigen', description: 'Kurs mit Einstellungen, Einheiten in Reihenfolge und letzten Exporten.', inputSchema: { course_id: z.string() }, annotations: ro },
    wrap(async ({ course_id }) => ok({ ...svc.getCourse(user, course_id), url: appLink(`/courses/${course_id}`) }))
  );

  server.registerTool(
    'update_course',
    {
      title: 'Kurs ändern',
      description: 'Titel, Beschreibung, Sprache oder Einstellungen eines Kurses ändern.',
      inputSchema: {
        course_id: z.string(),
        title: z.string().max(200).optional(),
        description: z.string().max(4000).optional(),
        language: z.string().optional(),
        settings: settingsSchema
      },
      annotations: rw
    },
    wrap(async ({ course_id, ...rest }) => ok(svc.updateCourse(user, course_id, rest, via)))
  );

  server.registerTool(
    'create_language_version',
    {
      title: 'Sprachfassung anlegen',
      description:
        'Kopiert einen Kurs mit allen Einheiten in eine andere Sprache (de, en, fr, it). Oberflächentexte der H5P-Inhalte (Buttons, Rückmeldungen) werden automatisch umgestellt; die eigentlichen Inhalte (Fragen, Texte) danach mit get_unit/update_unit übersetzen.',
      inputSchema: { course_id: z.string(), language: z.enum(['de', 'en', 'fr', 'it']), title: z.string().max(200).optional() },
      annotations: rw
    },
    wrap(async ({ course_id, language, title }) => {
      const source = svc.getCourse(user, course_id);
      const copy = await svc.duplicateCourse(user, course_id, { language, title: title || `${source.title} (${language.toUpperCase()})` }, via);
      return ok({ ...copy, url: appLink(`/courses/${copy.id}`) }, 'Sprachfassung angelegt. Jetzt die Inhalte der Einheiten übersetzen.');
    })
  );

  server.registerTool(
    'create_unit',
    {
      title: 'Einheit anlegen',
      description:
        'Legt eine Einheit (einen H5P-Inhalt) im Kurs an. content_type z. B. "H5P.Column" oder "H5P.MultiChoice". params gemäß get_content_schema. Bei Fehlern kommt eine Liste mit JSON-Pfaden zurück.',
      inputSchema: {
        course_id: z.string(),
        content_type: z.string(),
        title: z.string().min(1).max(200),
        params: z.record(z.string(), z.any()),
        position: z.number().int().min(0).optional()
      },
      annotations: rw
    },
    wrap(async ({ course_id, content_type, title, params, position }) => {
      const unit = await svc.createUnit(user, course_id, { library: content_type, params, title, position }, via);
      return ok({ ...unit, editUrl: appLink(`/units/${unit.id}/edit`) }, 'Einheit angelegt.');
    })
  );

  server.registerTool(
    'get_unit',
    { title: 'Einheit lesen', description: 'Einheit inklusive aktueller H5P-Parameter.', inputSchema: { unit_id: z.string() }, annotations: ro },
    wrap(async ({ unit_id }) => ok(await svc.getUnit(user, unit_id)))
  );

  server.registerTool(
    'update_unit',
    {
      title: 'Einheit ändern',
      description: 'Ersetzt die Parameter (vollständig, nicht teilweise) und/oder ändert Titel und Gewichtung (0–100, Standard 1).',
      inputSchema: {
        unit_id: z.string(),
        params: z.record(z.string(), z.any()).optional(),
        title: z.string().max(200).optional(),
        weight: z.number().min(0).max(100).optional()
      },
      annotations: rw
    },
    wrap(async ({ unit_id, params, title, weight }) => ok(await svc.updateUnit(user, unit_id, { params, title, weight }, via)))
  );

  server.registerTool(
    'reorder_units',
    {
      title: 'Einheiten sortieren',
      description: 'Neue Reihenfolge der Einheiten eines Kurses (alle IDs genau einmal).',
      inputSchema: { course_id: z.string(), unit_ids: z.array(z.string()) },
      annotations: rw
    },
    wrap(async ({ course_id, unit_ids }) => ok(svc.reorderUnits(user, course_id, unit_ids, via)))
  );

  server.registerTool(
    'delete_unit',
    { title: 'Einheit löschen', description: 'Löscht eine Einheit endgültig.', inputSchema: { unit_id: z.string() }, annotations: destructive },
    wrap(async ({ unit_id }) => {
      await svc.deleteUnit(user, unit_id, via);
      return ok({ deleted: unit_id });
    })
  );

  server.registerTool(
    'upload_asset',
    {
      title: 'Mediendatei hochladen',
      description:
        `Lädt ein Bild, Audio, Video oder eine Datei als Base64 hoch (max. ${Math.round(config.mcpUploadBytes / 1048576)} MB; große Videos besser im Browser-Editor). ` +
        'Der Server ruft keine fremden URLs ab. Das Ergebnis direkt in das passende Feld der params einsetzen (bei video/audio als Liste: [ergebnis]). Gilt 24 h bis zur Verwendung.',
      inputSchema: {
        kind: z.enum(['image', 'video', 'audio', 'file']),
        base64: z.string().max(Math.ceil(config.mcpUploadBytes * 1.37) + 1024),
        filename: z.string().max(200),
        mime: z.string().max(100).optional()
      },
      annotations: { ...rw, openWorldHint: false }
    },
    wrap(async ({ kind, base64, filename, mime }) => {
      const data = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
      const type = mime;
      const name = filename;
      if (data.length > config.mcpUploadBytes) throw Object.assign(new Error('Datei zu groß.'), { status: 400 });
      if (!kindMatches(kind, data)) throw Object.assign(new Error('Der Dateiinhalt passt nicht zur angegebenen Art (kind).'), { status: 400 });
      if (data.length > config.maxUploadBytes) throw Object.assign(new Error('Datei zu groß.'), { status: 400 });
      const { editor } = svc.getH5P();
      // h5p-server requires temp files when the SVG sanitizer is active
      fs.mkdirSync(config.tmpDir, { recursive: true });
      const tempFilePath = path.join(config.tmpDir, `mcp-${crypto.randomUUID()}`);
      fs.writeFileSync(tempFilePath, data);
      let result;
      try {
        result = await editor.saveContentFile(
          undefined,
          { name: 'file', type: kind },
          { tempFilePath, mimetype: type || guessMime(name) || 'application/octet-stream', name: name || 'datei', size: data.length },
          toH5pUser(user)
        );
      } finally {
        fs.rmSync(tempFilePath, { force: true });
      }
      return ok(kind === 'image' || kind === 'file' ? result : { path: result.path, mime: result.mime });
    })
  );

  server.registerTool(
    'export_course',
    {
      title: 'Kurs exportieren',
      description: `Erzeugt ein Paket und liefert einen Download-Link (1 h gültig). Formate: ${Object.entries(FORMATS)
        .map(([k, v]) => `${k} (${v.label})`)
        .join(', ')}. Ohne format wird die SCORM-Version aus den Kurseinstellungen genommen.`,
      inputSchema: { course_id: z.string(), format: z.enum(['scorm12', 'scorm2004', 'html']).optional() },
      annotations: rw
    },
    wrap(async ({ course_id, format }) => {
      const course = svc.getCourse(user, course_id);
      const fmt = format || (course.settings.scormVersion === '2004' ? 'scorm2004' : 'scorm12');
      const result = await jobGate.run(user.id, () => exportCourse(user, course_id, fmt, via));
      const sig = signValue(result.id, 3600);
      return ok(
        {
          ...result,
          downloadUrl: appLink(`/api/exports/${result.id}/download?sig=${encodeURIComponent(sig)}`),
          previewUrl: appLink(`/exports/${result.id}/preview`)
        },
        'Paket erstellt. Die Vorschau zeigt, welche Werte ein LMS erhalten würde.'
      );
    })
  );

  return server;
}

/** Express handler for POST/GET/DELETE /mcp (stateless mode). */
export async function handleMcp(req, res) {
  if (req.method !== 'POST') {
    res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Nur POST (zustandsloser Modus).' }, id: null });
    return;
  }
  const server = buildMcpServer(req.user);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] request failed', err);
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Interner Fehler' }, id: null });
  }
}
