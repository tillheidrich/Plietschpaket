# Sicherheit — Plietschpaket

Klasse: **K2** (Konten, Rollen, nicht-öffentliche Firmeninhalte; Einstufung nach OWASP Top 10:2025 / ASVS 5.0)
Stand: 21.10.2026

Neu einstufen auf **K3**, sobald mehrere Firmen/Kunden in einer Instanz arbeiten oder Registrierung für Fremde geöffnet wird.

## Daten
- Konten: Name, E-Mail, Passwort-Hash (scrypt), Sprache, Rolle. Nur Mitarbeitende, vom Admin angelegt.
- Kursinhalte: Texte, Bilder, Videos, Fragen (interne Schulungen, vertraulich, keine besonderen Kategorien nach Art. 9 DSGVO vorgesehen).
- Zugangsdaten: Sitzungen, OAuth-Access/Refresh-Token, persönliche Zugangsschlüssel (`ssp_…`) – alle nur als SHA-256-Hash gespeichert.
- Audit-Log: Aktionen mit Nutzer-ID, Ziel, Kanal (web/mcp).
- Ablage: SQLite und Dateien im Volume `/data` (eine Instanz = ein Unternehmen).

## Wer darf was
- **Admin:** Konten anlegen/deaktivieren, Passwörter zurücksetzen, Audit sehen; zählt in jedem Projekt als Owner.
- **Owner:** Projekt verwalten, Mitglieder und Rollen setzen, löschen.
- **Editor:** Kurse und Einheiten anlegen, bearbeiten, exportieren.
- **Viewer:** lesen, Vorschau, exportieren.
- Nutzer-ID kommt ausschließlich aus der Sitzung bzw. dem geprüften Token. Projekt-/Kurs-/Einheiten-IDs aus der URL werden immer über `src/access.js` gegen die Mitgliedschaft geprüft.
- Claude (MCP) arbeitet mit genau den Rechten des verbundenen Kontos – über OAuth (Weg A) oder persönlichen Zugangsschlüssel (Weg B, lokale Desktop-Erweiterung).

## Das Schlimmste, was passieren kann
1. Jemand ohne Projektzugang liest oder exportiert vertrauliche Schulungsinhalte (IDOR, geleakter Token, signierter Link).
2. Ein hochgeladenes H5P-Paket bringt Schadcode mit, der im Browser anderer Nutzer läuft und deren Sitzung übernimmt.
3. Der Server wird über Import/Export/Upload lahmgelegt oder als Sprungbrett ins interne Netz missbraucht (SSRF).

## Abnahmetests (A01/A07)
| Nr. | Test | Erwartung | automatisiert? |
|---|---|---|---|
| 1 | Nutzer B ruft Projekte/Kurse/Einheiten/Exporte/Vorschau von A auf | 404 | ja (`test/security.mjs`) |
| 2 | MCP-Werkzeuge mit fremden IDs | Fehler „nicht gefunden“ | ja |
| 3 | Passwortwechsel | alle anderen Sitzungen, OAuth-Token und Zugangsschlüssel ungültig | ja |
| 4 | Konto deaktivieren | Sitzungen, OAuth-Token, Zugangsschlüssel ungültig | ja |
| 5 | Login mit unbekannter vs. bekannter Adresse | gleiche Antwort | ja |
| 6 | OAuth: falsche redirect_uri, fehlendes PKCE, Code zweimal | abgelehnt | ja (smoke/security) |
| 7 | Signierter Download-Link nach Ablauf | abgelehnt | ja |

## Bewusste Ausnahmen (Stand 21.10.2026, nächste Prüfung beim Wechsel des Nutzerkreises)
| Regel | Warum hier nicht | Ausgleich |
|---|---|---|
| A07 Magic Link/Passkey statt Passwort | Firmen-IT soll ohne Mailversand betreiben können | scrypt, Drosselung pro IP/Adresse/Paar, Dummy-Hash gegen Timing; SSO (OIDC) als nächster Schritt |
| A01 Keine Admin-Hintertür | Firmen-IT muss verwaiste Projekte retten können; Inhalte sind Firmen-, keine Privatdaten | Jeder Admin-Zugriff ohne Mitgliedschaft steht im Audit-Log (`admin.project_access`) |
| A02 CSP ohne `unsafe-inline`/`unsafe-eval` | H5P-Kern und Inhaltstypen brauchen beides | Neue Inhaltstypen (JS) nur durch Admins (`LIBRARY_INSTALL=admin`), Uploads per `sandbox`-CSP und Magic-Byte-Prüfung; eigener Content-Origin wäre die nächste Stufe |
| A01 Owner kann bestehende Konten per E-Mail hinzufügen | internes Werkzeug, Konten legt nur der Admin an; das Verzeichnis ist firmenintern | Rollen pro Projekt, Audit |
| A03 `image-size` (DoS bei ICNS/HEIF/JXL), `postcss@6` in `postcss-clean` | kein kompatibles Update in `@lumieducation/h5p-server` 10 | Uploads müssen per Magic Bytes zu PNG/JPEG/GIF/WebP/BMP/TIFF passen, bevor `image-size` läuft; `postcss` verarbeitet nur CSS installierter Bibliotheken (nur Admins) |
| A07 H5P-CSRF-Token als `?_csrf=` in URLs | von `h5p-webcomponents` so vorgegeben | Token ist sitzungsgebunden, Referrer-Policy `same-origin` |
| A04 Löschen von Nutzerkonten | bisher nur Deaktivierung (entwertet alle Zugänge) | offen (Issue im Repository) |

## Abweichungen von Upstream
- `H5P.AudioRecorder` wird nicht mitgeliefert (das veröffentlichte Bundle enthält Build-Umgebungsdaten des Herstellers).
- Für alle H5P-Routen mit Inhalts-ID prüft Plietschpaket die Projektrolle selbst, bevor `@lumieducation/h5p-express` antwortet.
  Hinweise an die Upstream-Projekte laufen über deren Sicherheitskanäle.

## Meldung von Lücken
Bitte vertraulich über die GitHub-Funktion „Report a vulnerability“ (Security Advisories) melden. Antwort binnen einer Woche.
