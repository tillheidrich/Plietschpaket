/**
 * Server-side translation of user-facing messages. German is the source language;
 * English translations are looked up by exact text or by pattern.
 */
const EN = {
  'Anmeldung erforderlich.': 'Sign-in required.',
  'Bitte eine gültige E-Mail-Adresse angeben.': 'Please enter a valid email address.',
  'Dafür reichen deine Rechte in diesem Projekt nicht aus.': 'Your role in this project does not allow this.',
  'Das aktuelle Passwort stimmt nicht.': 'The current password is incorrect.',
  'Das ist ein SCORM-Paket. Importiert werden können .h5p-Dateien (z. B. aus Lumi: Datei → Speichern) oder Plietschpaket-Projekte.':
    'This is a SCORM package. You can import .h5p files (e.g. from Lumi: File → Save) or Plietschpaket projects.',
  'Datei zu groß.': 'File too large.',
  'Der Kurs hat noch keine Einheiten.': 'The course has no units yet.',
  'Die Parameter passen nicht zum Inhaltstyp.': 'The parameters do not match the content type.',
  'Die Reihenfolge muss alle Einheiten des Kurses genau einmal enthalten.': 'The order must contain every unit of the course exactly once.',
  'Dieser Inhalt gehört bereits zu einer Einheit.': 'This content already belongs to a unit.',
  'Dieser Inhalt gehört jemand anderem.': 'This content belongs to someone else.',
  'Du kannst dein eigenes Konto nicht deaktivieren.': 'You cannot deactivate your own account.',
  'Du kannst dir die Admin-Rolle nicht selbst entziehen.': 'You cannot remove your own admin role.',
  'E-Mail oder Passwort stimmt nicht.': 'Email or password is incorrect.',
  'Ein Projekt braucht mindestens eine verantwortliche Person (Owner).': 'A project needs at least one owner.',
  'Einheit nicht gefunden.': 'Unit not found.',
  'Es gibt bereits ein Konto mit dieser E-Mail-Adresse.': 'An account with this email address already exists.',
  'Es muss mindestens ein aktiver Admin bleiben.': 'At least one active admin must remain.',
  'Export nicht gefunden.': 'Export not found.',
  'Gewichtung muss zwischen 0 und 100 liegen.': 'Weight must be between 0 and 100.',
  'Im Archiv wurden keine .h5p-Dateien gefunden.': 'No .h5p files found in the archive.',
  'Inhaltstyp nicht installiert.': 'Content type not installed.',
  'Kein Nutzer mit dieser E-Mail-Adresse. Ein Admin muss das Konto zuerst anlegen.': 'No user with this email address. An admin has to create the account first.',
  'Keine Bearbeitungsrechte.': 'No permission to edit.',
  'Keine Datei empfangen.': 'No file received.',
  'Kurs nicht gefunden.': 'Course not found.',
  'Name fehlt.': 'Name is missing.',
  'Nicht angemeldet.': 'Not signed in.',
  'Nur für Admins.': 'Admins only.',
  'Nur https-URLs.': 'Only https URLs.',
  'Nutzer nicht gefunden.': 'User not found.',
  'Projekt nicht gefunden.': 'Project not found.',
  'Sicherheitstoken fehlt oder ist abgelaufen. Bitte Seite neu laden.': 'Security token missing or expired. Please reload the page.',
  'Unbekannte Rolle.': 'Unknown role.',
  'Unbekanntes Exportformat.': 'Unknown export format.',
  'Unbekanntes Format.': 'Unknown format.',
  'Unterstützt werden .h5p-Dateien und .zip-Archive (Projekt-Export oder mehrere .h5p).': 'Supported are .h5p files and .zip archives (project export or several .h5p files).',
  'Unvollständige Daten vom Editor.': 'Incomplete data from the editor.',
  'Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.': 'Too many attempts. Please try again in 15 minutes.',
  'project.json ist kein Plietschpaket-Projekt.': 'project.json is not a Plietschpaket project.',
  'Das Passwort muss mindestens 10 Zeichen lang sein.': 'The password must be at least 10 characters long.',
  'Interner Fehler. Details stehen im Server-Log.': 'Internal error. Details are in the server log.',
  'Interner Fehler.': 'Internal error.',
  'Kein Inhalt im Kurs vergibt Punkte. Der Kurs gilt als abgeschlossen, sobald alle Einheiten geöffnet wurden.':
    'No content in this course awards points. The course counts as completed once all units were opened.',
  'Mindestens eine bewertete Einheit hat die Gewichtung 0 und zählt nicht zur Note.': 'At least one scored unit has weight 0 and does not count towards the score.',
  'Projektname': 'Project name',
  'Kurstitel': 'Course title',
  'Titel der Einheit': 'Unit title',
  'Zugangsschlüssel nicht gefunden.': 'Access key not found.',
  'Inhalt nicht gefunden.': 'Content not found.',
  'Der Dateiinhalt passt nicht zur Dateiendung.': 'The file content does not match its extension.',
  'Der Dateiinhalt passt nicht zur angegebenen Art (kind).': 'The file content does not match the given kind.',
  'Es läuft bereits ein Export oder Import. Bitte warten, bis er fertig ist.': 'An export or import is already running. Please wait until it has finished.',
  'Der Server ist gerade ausgelastet. Bitte in einer Minute erneut versuchen.': 'The server is busy. Please try again in a minute.',
  'Zu viele Anfragen. Bitte kurz warten.': 'Too many requests. Please wait a moment.',
  'Eine Datei im Archiv ist zu groß.': 'A file in the archive is too large.',
  'Das Archiv ist entpackt zu groß.': 'The archive is too large when unpacked.',
  'Das Archiv ist ungewöhnlich stark komprimiert und wird aus Sicherheitsgründen abgelehnt.': 'The archive is unusually highly compressed and is rejected for security reasons.'
};

const PATTERNS = [
  [/^Das Archiv enthält zu viele Dateien \(max\. (\d+)\)\.$/, (m) => `The archive contains too many files (max. ${m[1]}).`],
  [/^Höchstens (\d+) aktive Zugangsschlüssel\. Bitte zuerst einen alten widerrufen\.$/, (m) => `At most ${m[1]} active access keys. Please revoke an old one first.`],
  [/^(.+) fehlt\.$/, (m) => `${tr(m[1], 'en')} is missing.`],
  [/^(.+) ist zu lang \(max\. (\d+) Zeichen\)\.$/, (m) => `${tr(m[1], 'en')} is too long (max. ${m[2]} characters).`],
  [/^Die H5P-Datei konnte nicht gelesen werden: (.*)$/s, (m) => `The H5P file could not be read: ${m[1]}`],
  [/^Inhaltstyp "?([^"]+)"? ist nicht installiert\.(.*)$/, (m) => `Content type ${m[1]} is not installed.`],
  [/^(.+): Pflichtfeld fehlt \((.+)\)\.$/, (m) => `${m[1]}: required field missing (${m[2]}).`],
  [/^(.+): mindestens (\d+) Einträge( erforderlich)?\.$/, (m) => `${m[1]}: at least ${m[2]} entries required.`],
  [/^(.+): höchstens (\d+) Einträge\.$/, (m) => `${m[1]}: at most ${m[2]} entries.`],
  [/^(.+): Pflichtfeld fehlt\.$/, (m) => `${m[1]}: required field missing.`],
  [/^(.+): höchstens (\d+) Zeichen\.$/, (m) => `${m[1]}: at most ${m[2]} characters.`],
  [/^(.+): Text ist zu lang\.$/, (m) => `${m[1]}: text is too long.`],
  [/^(.+): Adresse fehlt\.$/, (m) => `${m[1]}: address missing.`],
  [/^(.+): nur https-Adressen sind erlaubt\.$/, (m) => `${m[1]}: only https addresses are allowed.`],
  [/^(.+): Datei fehlt .*$/, (m) => `${m[1]}: file missing (upload it first).`],
  [/^(.+): Datei "(.+)" gibt es in diesem Kurs nicht\.$/, (m) => `${m[1]}: file "${m[2]}" does not exist in this course.`],
  [/^(.+): Zahl erwartet\.$/, (m) => `${m[1]}: number expected.`],
  [/^(.+): mindestens eine richtige Antwort .*$/, (m) => `${m[1]}: mark at least one correct answer.`],
  [/^(.+): Lücken in eckigen Klammern markieren.*$/, (m) => `${m[1]}: mark blanks in square brackets, e.g. [answer|alternative].`],
  [/^(.+): Video-Datei oder YouTube-\/Vimeo-Adresse angeben\.$/, (m) => `${m[1]}: add a video file or a YouTube/Vimeo address.`],
  [/^(.+): nur YouTube oder Vimeo\.$/, (m) => `${m[1]}: YouTube or Vimeo only.`],
  [/^(.+): Einheit gibt es in diesem Kurs nicht\.$/, (m) => `${m[1]}: this unit does not exist in this course.`],
  [/^(\d+) (Block ist|Blöcke sind) noch unvollständig\.$/, (m) => `${m[1]} ${m[1] === '1' ? 'block is' : 'blocks are'} still incomplete.`]
];

export function tr(message, lang) {
  if (!message || lang !== 'en') return message;
  if (EN[message]) return EN[message];
  for (const [re, fn] of PATTERNS) {
    const m = String(message).match(re);
    if (m) return fn(m);
  }
  return message;
}

export function requestLanguage(req) {
  const explicit = req.get('x-ui-lang');
  if (explicit === 'de' || explicit === 'en') return explicit;
  if (req.user && req.user.language) return req.user.language;
  const header = String(req.get('accept-language') || '').toLowerCase();
  return header.startsWith('de') || !header ? 'de' : 'en';
}

export const UI_LANGUAGES = ['de', 'en'];
export const COURSE_LANGUAGES = ['de', 'en', 'fr', 'it'];
