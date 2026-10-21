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
import { blockCatalog, PLAYER_DESIGNS, THEME_PRESETS, FONTS } from './blocks.js';
import { listLanguages } from './languages.js';

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
        'Zwei Kursarten: (1) Einheiten-Kurs: Projekt → Kurs → Einheiten (je ein H5P-Inhalt). (2) Block-Kurs (settings.mode blocks): Lektionen aus Blöcken wie Text, Bild, Quiz, Zuordnung, Prüfung, mit eigenem Player-Design; H5P-Einheiten lassen sich als Block h5p einbetten. Vor dem ersten Inhalt get_authoring_guide lesen. ' +
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
    'list_languages',
    {
      title: 'Kurssprachen',
      description: 'Alle Kurssprachen: eingebaute und von Admins angelegte, mit Code, Name und Leserichtung (ltr/rtl). Eigene Sprachen nutzen für H5P-Oberflächentexte ihre Basissprache.',
      annotations: ro
    },
    wrap(async () => ok(listLanguages().map((l) => ({ code: l.code, name: l.name, dir: l.dir, builtin: l.builtin, ...(l.builtin ? {} : { base: l.base }) }))))
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
      showUnitList: z.boolean().optional(),
      mode: z.enum(['units', 'blocks']).optional()
    })
    .optional();

  server.registerTool(
    'create_course',
    {
      title: 'Kurs anlegen',
      description:
        'Neuer Kurs in einem Projekt. language: Kurssprache (list_languages; eingebaut de, en, fr, it, es, pt, nl, pl, cs, sv, tr, ar plus eigene Sprachen der Verwaltung). Sie bestimmt die Texte der Kursoberfläche und die vorbelegten H5P-Texte; ar und eigene RTL-Sprachen laufen von rechts nach links. settings: scormVersion 1.2|2004, completion all (alle Einheiten erledigt, Fragen beantwortet) | viewed (alle geöffnet), masteryScore in Prozent, navigation free|linear.',
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
        'Kopiert einen Kurs mit allen Einheiten, Blöcken und Medien in eine andere Kurssprache (Codes aus list_languages). Oberflächentexte der H5P-Inhalte (Buttons, Rückmeldungen) werden automatisch umgestellt; die eigentlichen Inhalte (Fragen, Texte) danach mit get_unit/update_unit übersetzen.',
      inputSchema: { course_id: z.string(), language: z.string().max(20), title: z.string().max(200).optional() },
      annotations: rw
    },
    wrap(async ({ course_id, language, title }) => {
      const source = svc.getCourse(user, course_id);
      const copy = await svc.duplicateCourse(user, course_id, { language, title: title || `${source.title} (${language.toUpperCase()})` }, via);
      return ok({ ...copy, url: appLink(`/courses/${copy.id}`) }, 'Sprachfassung angelegt. Jetzt die Inhalte übersetzen: Blöcke mit get_blocks/save_blocks, H5P-Einheiten mit get_unit/update_unit.');
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

  // ---------------------------------------------------------------- block courses
  const blockSchema = z.object({ type: z.string(), data: z.record(z.string(), z.any()).optional(), narration: z.string().max(240).optional() }).passthrough();
  const courseSummary = (c) => ({
    id: c.id,
    title: c.title,
    mode: c.settings?.mode,
    updatedAt: c.updatedAt || c.updated_at,
    blocks: (c.blocks || []).map((b) => ({ id: b.id, type: b.type, data: b.data, ...(b.narration ? { narration: b.narration } : {}), ...(b.issues ? { issues: b.issues } : {}) })),
    outline: c.outline,
    design: c.design,
    liveUrl: appLink(`/live/${c.id}`),
    editUrl: appLink(`/courses/${c.id}`)
  });

  server.registerTool(
    'list_block_types',
    {
      title: 'Blocktypen',
      description:
        'Alle Blocktypen für Block-Kurse mit Kategorie, Feldern (Name mit ? = optional) und Beispiel. Block-Kurse sind eine flache Liste von Blöcken; ein "title"-Block beginnt eine neue Lektion. Bewertete Blöcke (graded) fließen in die Punktzahl ein. Medienfelder erwarten "media:<datei>" aus upload_course_media. Text-Felder (html) erlauben <p>, <strong>, <em>, <ul>, <ol>, <li>, <a href="https://…">, <br>.',
      inputSchema: { language: z.enum(['de', 'en']).optional() },
      annotations: ro
    },
    wrap(async ({ language }) => ok({ designs: PLAYER_DESIGNS, presets: Object.keys(THEME_PRESETS), fonts: FONTS, types: blockCatalog(language || 'de') }))
  );

  server.registerTool(
    'get_blocks',
    {
      title: 'Blöcke eines Kurses lesen',
      description: 'Blöcke (mit IDs), Gliederung in Lektionen, Design und Live-Vorschau-Link eines Block-Kurses.',
      inputSchema: { course_id: z.string() },
      annotations: ro
    },
    wrap(async ({ course_id }) => ok(courseSummary(svc.getCourse(user, course_id))))
  );

  server.registerTool(
    'save_blocks',
    {
      title: 'Alle Blöcke ersetzen',
      description:
        'Ersetzt die komplette Blockliste eines Kurses und stellt den Kurs auf Block-Modus um. Gut für den ersten Entwurf eines Kurses. Blöcke ohne id bekommen eine. Fehler kommen als Liste mit Blockindex und Feld zurück; dann wird nichts gespeichert.',
      inputSchema: { course_id: z.string(), blocks: z.array(blockSchema).max(800) },
      annotations: rw
    },
    wrap(async ({ course_id, blocks }) => ok(courseSummary(svc.saveBlocks(user, course_id, blocks, {}, via)), 'Blöcke gespeichert.'))
  );

  server.registerTool(
    'insert_blocks',
    {
      title: 'Blöcke einfügen',
      description: 'Fügt Blöcke nach dem Block after_id ein (ohne after_id: an position, sonst am Ende). Gibt die IDs der neuen Blöcke zurück.',
      inputSchema: { course_id: z.string(), blocks: z.array(blockSchema).min(1).max(200), after_id: z.string().optional(), position: z.number().int().min(0).optional() },
      annotations: rw
    },
    wrap(async ({ course_id, blocks, after_id, position }) => {
      const r = svc.insertBlocks(user, course_id, blocks, { afterId: after_id, position }, via);
      return ok({ inserted: r.inserted, outline: r.course.outline, liveUrl: appLink(`/live/${course_id}`) }, 'Blöcke eingefügt.');
    })
  );

  server.registerTool(
    'update_block',
    {
      title: 'Block ändern',
      description: 'Ersetzt data (vollständig) und/oder den Typ eines Blocks; narration = Vertonung als Audiodatei "media:…" aus upload_course_media (leerer String = entfernen).',
      inputSchema: { course_id: z.string(), block_id: z.string(), data: z.record(z.string(), z.any()).optional(), type: z.string().optional(), narration: z.string().max(240).optional() },
      annotations: rw
    },
    wrap(async ({ course_id, block_id, data, type, narration }) => {
      const c = svc.updateBlock(user, course_id, block_id, { data, type, narration }, via);
      return ok(c.blocks.find((b) => b.id === block_id), 'Block geändert.');
    })
  );

  server.registerTool(
    'move_block',
    {
      title: 'Block verschieben',
      description: 'Verschiebt einen Block hinter after_id (leerer String = an den Anfang) oder an position.',
      inputSchema: { course_id: z.string(), block_id: z.string(), after_id: z.string().optional(), position: z.number().int().min(0).optional() },
      annotations: rw
    },
    wrap(async ({ course_id, block_id, after_id, position }) => ok({ outline: svc.moveBlock(user, course_id, block_id, { afterId: after_id, position }, via).outline }))
  );

  server.registerTool(
    'delete_blocks',
    {
      title: 'Blöcke löschen',
      description: 'Löscht Blöcke endgültig.',
      inputSchema: { course_id: z.string(), block_ids: z.array(z.string()).min(1) },
      annotations: destructive
    },
    wrap(async ({ course_id, block_ids }) => ok({ deleted: block_ids, outline: svc.deleteBlocks(user, course_id, block_ids, via).outline }))
  );

  server.registerTool(
    'set_course_design',
    {
      title: 'Design und Player festlegen',
      description:
        `Teiländerung des Designs eines Block-Kurses (wird zusammengeführt). player: ${PLAYER_DESIGNS.join('|')}. ` +
        `theme: { preset: ${Object.keys(THEME_PRESETS).join('|')}|custom, mode: light|dark, primary/accent/background: #hex (nur mit preset custom), font: ${FONTS.join('|')}, fontSize: small|medium|large, radius: sharp|rounded|pill }. ` +
        'cover: { show, image: "media:…", kicker, duration }. logo: "media:…". direction: ltr|rtl. completion: { message, nextUrl (https), nextLabel, restart }. labels: eigene Beschriftungen für Player-Knöpfe (ersetzt alle bisherigen; Schlüssel z. B. start, next, finish, complete, completeText).',
      inputSchema: { course_id: z.string(), design: z.record(z.string(), z.any()) },
      annotations: rw
    },
    wrap(async ({ course_id, design }) => ok(svc.setDesign(user, course_id, design, via), 'Design gespeichert.'))
  );

  server.registerTool(
    'upload_course_media',
    {
      title: 'Medien für Block-Kurs hochladen',
      description:
        `Lädt ein Bild (jpg, png, webp, gif, svg), Audio (mp3, m4a, ogg, wav), Video (mp4, webm), PDF oder Untertitel (vtt) als Base64 in die Mediathek eines Kurses (max. ${Math.round(config.mcpUploadBytes / 1048576)} MB). ` +
        'Ergebnis "ref" (media:<datei>) direkt in Blockfelder einsetzen.',
      inputSchema: { course_id: z.string(), filename: z.string().max(200), base64: z.string().max(Math.ceil(config.mcpUploadBytes * 1.37) + 1024) },
      annotations: rw
    },
    wrap(async ({ course_id, filename, base64 }) => {
      const data = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
      const saved = svc.uploadCourseMedia(user, course_id, filename, data, config.mcpUploadBytes, via);
      return ok({ ...saved, ref: `media:${saved.name}` });
    })
  );

  server.registerTool(
    'list_course_media',
    { title: 'Mediathek eines Kurses', description: 'Hochgeladene Medien eines Block-Kurses.', inputSchema: { course_id: z.string() }, annotations: ro },
    wrap(async ({ course_id }) => ok(svc.courseMedia(user, course_id).map((m) => ({ ...m, ref: `media:${m.name}` }))))
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
