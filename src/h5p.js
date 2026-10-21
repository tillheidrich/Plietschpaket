import fs from 'node:fs';
import path from 'node:path';
import i18next from 'i18next';
import FsBackend from 'i18next-fs-backend';
import * as H5P from '@lumieducation/h5p-server';
import SvgSanitizerModule from '@lumieducation/h5p-svg-sanitizer';
import { createRequire } from 'node:module';
import { config } from './config.js';
import { contentRole, atLeast } from './access.js';
import { db } from './db.js';

const require = createRequire(import.meta.url);
const SvgSanitizer = SvgSanitizerModule.default || SvgSanitizerModule;

const { ContentPermission, GeneralPermission, TemporaryFilePermission, UserDataPermission } = H5P;

/** Maps a DB user row to the user object h5p-server expects. */
export function toH5pUser(row, csrf) {
  if (!row) return { id: 'anonymous', name: 'Anonymous', email: '', type: 'local', role: 'anonymous' };
  return { id: row.id, name: row.name, email: row.email, type: 'local', role: row.role, csrf };
}

/**
 * Records the creator of every new content object right away. Until the content is attached to a unit,
 * only its creator may edit it – this also lets non-admins import .h5p packages (the importer writes
 * content files immediately after creating the content and needs edit rights on the new id).
 */
class OwnedContentStorage extends H5P.fsImplementations.FileContentStorage {
  async addContent(metadata, content, user, id) {
    const isNew = id === undefined || id === null;
    const newId = await super.addContent(metadata, content, user, id);
    if (isNew && user && user.id && user.role !== 'anonymous') {
      db.prepare('INSERT OR IGNORE INTO content_owners (content_id, user_id) VALUES (?, ?)').run(String(newId), user.id);
    }
    return newId;
  }
}

class ProjectPermissionSystem {
  async checkForContent(user, permission, contentId) {
    if (!user || user.role === 'anonymous') return false;
    if (permission === ContentPermission.Create || permission === ContentPermission.List) return true;
    if (contentId === undefined || contentId === null) return true;
    const role = contentRole(user, contentId);
    switch (permission) {
      case ContentPermission.View:
      case ContentPermission.Download:
      case ContentPermission.Embed:
        return atLeast(role, 'viewer');
      case ContentPermission.Edit:
        return atLeast(role, 'editor');
      case ContentPermission.Delete:
        return atLeast(role, 'editor');
      default:
        return false;
    }
  }

  async checkForUserData(user, _permission, contentId) {
    if (!user || user.role === 'anonymous') return false;
    return atLeast(contentRole(user, contentId), 'viewer');
  }

  async checkForTemporaryFile(user, _permission) {
    return !!user && user.role !== 'anonymous';
  }

  async checkForGeneralAction(user, permission) {
    if (!user || user.role === 'anonymous') return false;
    if (user.role === 'admin') return true;
    switch (permission) {
      case GeneralPermission.CreateRestricted:
        return true;
      case GeneralPermission.InstallRecommended:
      case GeneralPermission.UpdateAndInstallLibraries:
        return config.libraryInstall === 'all';
      default:
        return false;
    }
  }
}

function copyMissingLibraries() {
  fs.mkdirSync(config.h5p.libraries, { recursive: true });
  if (!fs.existsSync(config.h5p.bundledLibraries)) return 0;
  let copied = 0;
  const patchOf = (dir) => {
    try {
      return Number(JSON.parse(fs.readFileSync(path.join(dir, 'library.json'), 'utf8')).patchVersion) || 0;
    } catch {
      return -1;
    }
  };
  for (const name of fs.readdirSync(config.h5p.bundledLibraries)) {
    const source = path.join(config.h5p.bundledLibraries, name);
    const target = path.join(config.h5p.libraries, name);
    if (fs.existsSync(target)) {
      // Bundled libraries are trusted (shipped with the image): newer patch versions replace older ones.
      if (patchOf(source) <= patchOf(target)) continue;
      fs.rmSync(target, { recursive: true, force: true });
    }
    fs.cpSync(source, target, { recursive: true });
    copied += 1;
  }
  return copied;
}

async function loadConfig() {
  fs.mkdirSync(path.dirname(config.h5p.configFile), { recursive: true });
  const defaults = {
    baseUrl: '/h5p',
    fetchingDisabled: config.allowHub ? 0 : 1,
    siteType: 'local',
    sendUsageStatistics: false,
    contentUserStateSaveInterval: false,
    maxFileSize: config.maxUploadBytes,
    maxTotalSize: config.maxUploadBytes,
    enableLrsContentTypes: true,
    contentHubEnabled: false,
    contentWhitelist:
      'json png jpg jpeg gif bmp tif tiff webp eot ttf woff woff2 otf webm mp4 ogg mp3 m4a wav txt pdf rtf doc docx xls xlsx ppt pptx odt ods odp csv diff patch md textile vtt webvtt gltf glb'
  };
  // We always (re)write the managed keys so env changes take effect on restart.
  let stored = {};
  try {
    stored = JSON.parse(fs.readFileSync(config.h5p.configFile, 'utf8'));
  } catch {
    stored = {};
  }
  fs.writeFileSync(config.h5p.configFile, JSON.stringify({ ...stored, ...defaults }, null, 2));
  return new H5P.H5PConfig(new H5P.fsImplementations.JsonStorage(config.h5p.configFile)).load();
}

export async function createTranslator() {
  const translationsDir = path.join(path.dirname(require.resolve('@lumieducation/h5p-server')), '..', 'assets', 'translations');
  const t = await i18next.use(FsBackend).init({
    backend: { loadPath: path.join(translationsDir, '{{ns}}/{{lng}}.json') },
    defaultNS: 'server',
    fallbackLng: 'en',
    ns: ['client', 'copyright-semantics', 'hub', 'library-metadata', 'metadata-semantics', 'server', 'storage-file-implementations'],
    preload: ['en', 'de']
  });
  return t;
}

export async function createH5P() {
  for (const dir of [config.h5p.content, config.h5p.temporary, config.h5p.userData]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const copied = copyMissingLibraries();
  if (copied) console.log(`[h5p] ${copied} mitgelieferte Bibliotheken nach ${config.h5p.libraries} kopiert.`);

  const h5pConfig = await loadConfig();
  const t = await createTranslator();
  const translate = (key, language) => t(key, { lng: language });

  const urlGenerator = new H5P.UrlGenerator(h5pConfig, {
    queryParamGenerator: (user) => (user && user.csrf ? { name: '_csrf', value: user.csrf } : { name: '', value: '' }),
    protectAjax: true,
    protectContentUserData: true,
    protectSetFinished: true
  });

  const permissionSystem = new ProjectPermissionSystem();
  const editor = new H5P.H5PEditor(
    new H5P.fsImplementations.InMemoryStorage(),
    h5pConfig,
    new H5P.fsImplementations.FileLibraryStorage(config.h5p.libraries),
    new OwnedContentStorage(config.h5p.content),
    new H5P.fsImplementations.DirectoryTemporaryFileStorage(config.h5p.temporary),
    translate,
    urlGenerator,
    {
      enableHubLocalization: true,
      enableLibraryNameLocalization: true,
      permissionSystem,
      fileSanitizers: [new SvgSanitizer()]
    },
    new H5P.fsImplementations.FileContentUserDataStorage(config.h5p.userData)
  );
  editor.setRenderer((model) => model);

  const player = new H5P.H5PPlayer(
    editor.libraryStorage,
    editor.contentStorage,
    h5pConfig,
    undefined,
    urlGenerator,
    translate,
    { permissionSystem },
    editor.contentUserDataStorage
  );
  player.setRenderer((model) => model);

  return { editor, player, h5pConfig, translate, i18n: t };
}

/** Returns the newest installed version of a library as "Machine.Name major.minor". */
export async function resolveUbername(editor, nameOrUbername) {
  const trimmed = String(nameOrUbername).trim();
  const m = trimmed.match(/^([A-Za-z0-9_.-]+)(?:[ -](\d+)\.(\d+))?$/);
  if (!m) return null;
  const [, machineName, major, minor] = m;
  const installed = await editor.libraryStorage.getInstalledLibraryNames(machineName);
  if (!installed.length) return null;
  const candidates = installed
    .filter((l) => (major === undefined ? true : l.majorVersion === Number(major) && l.minorVersion === Number(minor)))
    .sort((a, b) => b.majorVersion - a.majorVersion || b.minorVersion - a.minorVersion || b.patchVersion - a.patchVersion);
  const lib = candidates[0];
  return lib ? { machineName: lib.machineName, majorVersion: lib.majorVersion, minorVersion: lib.minorVersion, ubername: `${lib.machineName} ${lib.majorVersion}.${lib.minorVersion}` } : null;
}

export { H5P };
