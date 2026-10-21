export const AUTHORING_GUIDE = `# Plietschpaket – Leitfaden für Kursautoren (KI)

## Struktur
Projekt → Kurs → Einheiten. Jede Einheit ist genau ein H5P-Inhalt und erscheint im fertigen Paket als eigener Schritt in der Kursnavigation.
Ein Kurs wird als **ein** SCORM-Paket exportiert. Das LMS bekommt Fortschritt, Gesamtnote (gewichteter Durchschnitt der bewerteten Einheiten) und Bestanden/Nicht bestanden.

## Arbeitsweise
1. list_projects / create_project, dann create_course (Sprache und settings setzen: completion "all" für Kurse mit Wissenscheck, "viewed" für reine Info-Kurse).
2. Pro Lernschritt eine Einheit. Bewährte Abfolge: Einstieg (H5P.Column) → Inhalt (H5P.Column mit Text, Bild, Akkordeon) → Übung (Fragen) → … → Abschlusstest (H5P.QuestionSet).
3. Vor jedem neuen Inhaltstyp get_content_schema aufrufen. Oberflächentexte (Buttons, Feedback) sind vorbelegt und müssen nicht mitgeschickt werden.
4. Texte in Feldern mit format "html" als einfaches HTML (<p>, <strong>, <ul><li>, <h2>/<h3>). Keine Skripte, keine Inline-Styles.
5. Bilder: erst upload_asset (kind "image"), dann das Ergebnis z. B. in H5P.Image → params.file einsetzen. Für H5P.Image ist "alt" Pflicht.
6. Nach dem Anlegen get_course prüfen; zum Schluss export_course und die Vorschau-URL an den Menschen geben.

## Didaktische Regeln
- Eine Einheit = ein Lernziel. Lieber fünf kurze Einheiten als eine lange.
- Fragen prüfen das Lernziel der vorherigen Einheit, nicht Detailwissen.
- Falsche Antwortoptionen müssen plausibel sein. Feedback erklärt das Warum.
- Bei Software-Schulungen: Bedienschritte als nummerierte Liste, UI-Begriffe genau so wie in der Oberfläche schreiben.

## Funktionierende Beispiele (params)

### H5P.Column – Lektionsseite (erste Wahl für Lerninhalte)
{
  "content": [
    { "content": { "library": "H5P.AdvancedText 1.1", "params": { "text": "<h2>Warum Synchronisierung?</h2><p>Kurzer Einstiegstext …</p>" } } },
    { "content": { "library": "H5P.Accordion 1.0", "params": { "panels": [
        { "title": "Was passiert im Hintergrund?", "content": { "library": "H5P.AdvancedText 1.1", "params": { "text": "<p>Erklärung …</p>" } } }
    ] } } },
    { "content": { "library": "H5P.MultiChoice 1.16", "params": {
        "question": "<p>Welche Aussage stimmt?</p>",
        "answers": [
          { "text": "<div>Richtige Aussage</div>", "correct": true, "tipsAndFeedback": { "chosenFeedback": "<div>Genau, weil …</div>" } },
          { "text": "<div>Plausible falsche Aussage</div>", "correct": false, "tipsAndFeedback": { "chosenFeedback": "<div>Nicht ganz: …</div>" } }
        ]
    } } }
  ]
}
Hinweis: Die Versionsnummer hinter dem Bibliotheksnamen darf fehlen oder abweichen – sie wird automatisch auf die installierte Version gesetzt.

### H5P.MultiChoice
{ "question": "<p>Frage?</p>", "answers": [ { "text": "<div>A</div>", "correct": true }, { "text": "<div>B</div>", "correct": false } ], "behaviour": { "singlePoint": false } }

### H5P.TrueFalse
{ "question": "<p>Aussage, die richtig oder falsch ist.</p>", "correct": "true" }

### H5P.Blanks (Lückentext)
{ "text": "<p>Fülle die Lücken.</p>", "questions": [ "<p>Die Hauptstadt von Frankreich ist *Paris*.</p>", "<p>Ein Jahr hat *12/zwölf* Monate.</p>" ] }
Lücken mit *Sternchen*, Alternativen mit /.

### H5P.DragText
{ "taskDescription": "<p>Ziehe die Wörter an die richtige Stelle.</p>", "textField": "Mobile Geräte werden über *MDM* verwaltet und mit *Exchange* synchronisiert." }

### H5P.SingleChoiceSet (schnelles Quiz)
{ "choices": [ { "question": "<p>Frage 1?</p>", "answers": [ "<p>Richtig (immer zuerst)</p>", "<p>Falsch</p>", "<p>Falsch</p>" ] } ] }

### H5P.QuestionSet (Abschlusstest)
{
  "passPercentage": 80,
  "questions": [
    { "library": "H5P.MultiChoice 1.16", "params": { "question": "<p>…</p>", "answers": [ { "text": "<div>…</div>", "correct": true }, { "text": "<div>…</div>", "correct": false } ] } },
    { "library": "H5P.TrueFalse 1.8", "params": { "question": "<p>…</p>", "correct": "false" } }
  ]
}

### H5P.Dialogcards (Lernkarten)
{ "title": "<p>Begriffe</p>", "dialogs": [ { "text": "<p>Begriff</p>", "answer": "<p>Erklärung</p>" } ] }

### H5P.Accordion
{ "panels": [ { "title": "Abschnitt", "content": { "library": "H5P.AdvancedText 1.1", "params": { "text": "<p>…</p>" } } } ] }

### H5P.AppSimulation (App-Simulation – erste Wahl für Software-Trainings)
Schritt-für-Schritt-Übung auf Screenshots, ohne Ton. Lernende tippen die richtige Stelle an; nur so geht es weiter.
Schrittarten (kind): "click" = Aufgabe (zählt für Punkte, braucht area), "info" = Bereich hervorheben + Weiter,
"note" = wichtiger Hinweis, "explore" = mehrere Hinweise (hints) zum Darüberfahren/Antippen.
Koordinaten: area {shape:"rect"|"ellipse", x, y, w, h} als Anteile 0–1 des Screenshots (x/y = linke obere Ecke).
Screenshot leer lassen = Screenshot des vorherigen Schritts wird weiterverwendet (spart Uploads).
Ablauf: Screenshots mit upload_asset (kind "image") hochladen → params bauen → create_unit. Koordinaten schätzen,
die Person kann sie im Browser-Editor (editUrl) per Maus auf dem Screenshot korrigieren.
Für Übungen im Kurs masteryScore 0 setzen (abgeschlossen = bestanden, Punkte werden trotzdem gemeldet).
{"intro":{"kicker":"Kontor · Training","subtitle":"iOS · Deutsch","text":"In dieser Übung fotografierst du einen Beleg und reichst ihn ein."},
 "chapters":[{"title":"Beleg erfassen","steps":[
   {"label":"Neuen Beleg anlegen","detail":"Tippe auf das Plus unten rechts.","kind":"click","screenshot":{"path":"images/…","mime":"image/png","width":828,"height":1792},
    "area":{"shape":"ellipse","x":0.02,"y":0.04,"w":0.15,"h":0.07}},
   {"label":"Die Optionen im Überblick","kind":"explore","hints":[
    {"text":"Hier wählst du die Kostenstelle.","area":{"shape":"rect","x":0.02,"y":0.3,"w":0.96,"h":0.08}},
    {"text":"Betrag und Währung erkennt die App automatisch.","area":{"shape":"rect","x":0.02,"y":0.4,"w":0.96,"h":0.1}}]}]}],
 "theme":{"frame":"phone","sidebarColor":"#1d2230","accentColor":"#e3a33b","buttonColor":"#b3312c","footer":"© Beispiel GmbH"},
 "behaviour":{"scoring":"firstTry","hintAfter":2,"tolerance":25,"allowBack":true,"showVideoFirst":false}}
Video ist optional (video.files oder video.url mit YouTube/Vimeo + behaviour.showVideoFirst true); der Abschluss hängt immer an der Übung.
Varianten (Plattform × Sprache): Pro Plattform einen Kurs bauen, dann create_language_version für EN/FR/IT
(übersetzt Oberflächentexte automatisch), danach mit get_unit/update_unit Texte übersetzen und die Screenshots
der jeweiligen Sprache einsetzen. Koordinaten bleiben gleich, solange die Screenshots dieselbe Anordnung haben.

### H5P.InteractiveVideo (interaktives Video – Video pausiert, Fragen, Buttons, Sprünge)
1. Video hochladen: kurze Clips (bis 25 MB) mit upload_asset (kind "video", Base64; MP4/H.264, optional zusätzlich WebM; über Claude Desktop lokal besser upload_local_file). Größere Videos lädt die Person im Browser-Editor hoch (editUrl der Einheit) – der Server ruft keine fremden URLs ab.
2. Ergebnis als Liste in interactiveVideo.video.files einsetzen.
3. Interaktionen: x/y/width/height in Prozent des Videos, duration in Sekunden ("M:SS" geht auch).
   - pause: true + displayType "poster" = Video hält an und zeigt die Aufgabe groß.
   - displayType "button" = kleiner Button, öffnet den Inhalt beim Klick.
   - Fragen zählen zur Punktzahl; adaptivity.wrong.seekTo springt bei falscher Antwort zurück.
   - H5P.IVHotspot = klickbare Fläche, die zu einer Zeitmarke oder URL springt.
   - H5P.GoToQuestion = Verzweigungsfrage mit Sprungzielen.
4. bookmarks = Kapitelmarken, endscreens = Abgabe-Bildschirm (nötig, damit die Punkte ans LMS gehen).
{"interactiveVideo":{"video":{"files":[{"path":"videos/…","mime":"video/mp4"}]},"assets":{
 "interactions":[
  {"x":5,"y":5,"width":10,"height":10,"duration":{"from":1,"to":9},"pause":false,"displayType":"button","label":"<p>Info</p>",
   "action":{"library":"H5P.Text","params":{"text":"<p>Hintergrundwissen</p>"}}},
  {"x":60,"y":60,"width":20,"height":15,"duration":{"from":2,"to":12},"pause":false,"displayType":"poster",
   "action":{"library":"H5P.IVHotspot","params":{"destination":{"type":"timecode","time":"0:20"},"visuals":{"shape":"rectangular","backgroundColor":"rgba(255,0,0,.3)"},"texts":{"label":"Zu Kapitel 2","alternativeText":"Sprung zu Kapitel 2"}}}},
  {"x":25,"y":15,"width":50,"height":60,"duration":{"from":5,"to":5},"pause":true,"displayType":"poster",
   "action":{"library":"H5P.MultiChoice","params":{"question":"<p>Frage?</p>","answers":[{"text":"<div>Richtig</div>","correct":true},{"text":"<div>Falsch</div>","correct":false}]}},
   "adaptivity":{"wrong":{"seekTo":0,"allowOptOut":false,"message":"Schau dir den Anfang nochmal an.","seekLabel":"Zurück"},"requireCompletion":true}}
 ],
 "bookmarks":[{"time":0,"label":"Intro"},{"time":20,"label":"Kapitel 2"}],
 "endscreens":[{"time":29,"label":"Ende"}]}}}
SCORM 1.2 speichert höchstens 4096 Zeichen Fortschritt. Bei langen Videos mit vielen Fragen scormVersion "2004" wählen.

## Sprachfassungen (DE, EN, FR, IT)
- Kurssprache beim Anlegen setzen. Sie bestimmt die Sprache der Kursnavigation und die vorbelegten H5P-Oberflächentexte.
- Für eine weitere Sprache: create_language_version, dann jede Einheit mit get_unit lesen, Inhalte übersetzen (Fragen, Antworten, Texte, Feedback) und mit update_unit vollständig zurückschreiben. Fachbegriffe und UI-Begriffe der Software exakt so übernehmen, wie sie in der jeweiligen Oberflächensprache heißen.

## Grenzen
- H5P.CoursePresentation, H5P.DragQuestion, H5P.ImageHotspots und H5P.BranchingScenario brauchen Koordinaten bzw. viel Struktur – anlegen ist möglich, Feinschliff besser im Browser-Editor (editUrl).
- update_unit ersetzt die Parameter vollständig: vorher get_unit lesen und das ganze Objekt zurückschicken.
`;
