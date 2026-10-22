#!/usr/bin/env python3
"""Builds the Plietschpaket site into site/dist (English at /, German at /de/, imprint at /impressum/).

No dependencies beyond Python 3. Usage: python3 site/build.py [--base https://example.org/path/]
"""
import html
import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DIST = HERE / "dist"
BASE = "https://plietschpaket.heidrich-digital.de/"
if "--base" in sys.argv:
    BASE = sys.argv[sys.argv.index("--base") + 1].rstrip("/") + "/"

# Tap targets on the Kontor demo screens (relative to the phone screen).
def stage(labels, fbs):
    pos = [(None, None), (0.872, 0.849), (None, None), (0.5, 0.878), (0.5, 0.545), (0.5, 0.684), (0.507, 0.623)]
    shots = [0, 0, 1, 1, 2, 2, 3]
    chapters = [(0, 0.5), (0, 1), (1, 0.5), (1, 1), (2, 0.33), (2, 0.66), (2, 1)]
    out = []
    for k, label in enumerate(labels):
        out.append({"shot": shots[k], "label": label, "chapter": chapters[k][0], "part": chapters[k][1], "x": pos[k][0], "y": pos[k][1], "fb": fbs[k]})
    return json.dumps(out, ensure_ascii=False)


def ticker(items):
    return "".join(f"<span>{html.escape(i)}</span>" for i in items)


EN = {
    "title": "Plietschpaket · Software training people actually click through",
    "description": "Self-hosted authoring tool for interactive e-learning. Product video plus hands-on app simulation, exported as SCORM 1.2, SCORM 2004, xAPI, cmi5 or HTML. Claude can build the courses over MCP.",
    "skip": "Skip to content", "nav_label": "Main", "menu": "Menu",
    "nav_how": "How it works", "nav_features": "Features", "nav_host": "Self-hosting",
    "eyebrow": "Low German for “the clever package”",
    "h1": "Software training people <em>actually click through</em>",
    "hero_lead": "Show the product in a short video, then let people practise the same steps on real screenshots. Plietschpaket packs both into a SCORM file your LMS already understands.",
    "cta_github": "Get it on GitHub", "cta_how": "See how it works",
    "say": "Say it <b>PLEETCH-pa-kate</b>. Open source, GPL-3.0, runs in one Docker container.",
    "stage_kicker": "Kontor · Expenses", "stage_title": "Submit a receipt in Kontor", "stage_meta": "4 minutes · iPhone",
    "stage_first": "This is your list of receipts",
    "alt_screen": "Practice screen of the fictional expense app Kontor",
    "float_text": "passed · score 80",
    "how_eyebrow": "One course, three parts",
    "how_h2": "Show it. <em>Let them do it.</em> Tell the LMS.",
    "how_lead": "Most software training stops after the video. People nod along, close the tab and still don't know where the button is. A Plietschpaket course keeps going until they have pressed it themselves.",
    "s1_h": "Show the product",
    "s1_p": "Start with your screen recording or an avatar video, from a file or embedded from YouTube or Vimeo. Interactive video adds buttons, questions that pause playback and jumps between chapters.",
    "s1_l1": "Questions that stop the video until someone answers", "s1_l2": "Chapter jumps and clickable hotspots", "s1_l3": "Subtitles as WebVTT in every course language",
    "s1_alt": "Interactive video paused at a question",
    "q_title": "Where do you add a new receipt?", "q_a": "In the profile", "q_b": "The plus button on the receipt list", "q_c": "Under approvals",
    "s2_h": "Let them practise",
    "s2_p": "The app simulation turns screenshots into a guided exercise. You drag the click area onto the screenshot, write one line of instruction and move on. Learners tap, get a hint after two misses and see what they got right on the first try.",
    "s2_l1": "Tap tasks, notes, info steps and explore steps with hover hints", "s2_l2": "Phone, tablet or desktop frame", "s2_l3": "Resume where they left off, keyboard alternative included",
    "s2_alt": "App simulation running in the LMS preview",
    "s3_h": "Report to the LMS",
    "s3_p": "Export SCORM 1.2, SCORM 2004, xAPI, cmi5 or plain HTML. Before you upload anything, the built-in LMS simulator shows exactly which values the package will send: status, score, bookmark, suspend data.",
    "s3_l1": "Completion rules and pass mark per course", "s3_l2": "One SCO, so every LMS handles it the same way", "s3_l3": "Version numbers on every export",
    "lms_title": "What the LMS receives",
    "feat_eyebrow": "Everything else", "feat_h2": "Built for the people who make the training",
    "f1_h": "Courses built from blocks", "f1_p": "Stack text, images, accordions, processes, scenarios and knowledge checks. The live preview shows every change straight away on desktop, tablet and phone.",
    "f1_alt": "Block editor in Plietschpaket with outline, block form and live preview",
    "f2_h": "Build together, sign off outside", "f2_p": "An admin creates the accounts, each project has owners, editors and viewers. Subject experts get a review link and comment right on the block, no account needed.",
    "rv_quote": "Step 3: the button is called Submit now, not Send.", "rv_who": "Finance team · via review link",
    "f3_h": "Twelve course languages", "f3_p": "One click creates a language version with all media. Player buttons follow along, and Arabic runs right to left.",
    "f4_h": "55 H5P content types", "f4_p": "Interactive video, quizzes, branching and drag and drop sit next to the app simulation. All of it is H5P, so nothing is locked in.",
    "t1": "Quiz", "t2": "Branching", "t3": "Drag and drop", "t4": "Hotspots",
    "f5_h": "Bring it in, take it out", "f5_p": ".h5p files from Lumi, Rise 360 exports and click-practice packages become editable courses. Going back works too: every unit exports as .h5p for Lumi.",
    "ok": "imported", "ok_out": "to Lumi",
    "c_h2": "Describe the course. <em>Claude builds it.</em>",
    "c_lead": "Plietschpaket is its own OAuth server and speaks MCP. Claude reads the authoring guide, writes the units, uploads your screenshots and exports the package. It works with the rights of whoever signed in, nothing more.",
    "p1_tag": "Public server", "p1_h": "Add it as a connector", "p1_p": "Paste the /mcp address into Claude, sign in, confirm. That's the whole setup.",
    "p2_tag": "Behind a VPN", "p2_h": "Use the desktop extension", "p2_p": "Connectors come from the cloud and can't see your intranet. The .mcpb extension runs on the laptop and talks to the server directly.",
    "c_msg": "Build a short course for new sales staff on submitting a receipt in Kontor. Screenshots are in the Kontor folder. German first, then English, and finish with three questions.",
    "c1": "Kontor · Expenses", "c2": "4 screenshots", "c3": "8 steps", "c4": "3 questions",
    "c_answer": "Done. The course has a practice part with 8 steps and a short check at the end, in German and English. The SCORM 1.2 package is ready under Exports, and the preview shows what your LMS will receive.",
    "h_eyebrow": "Self-hosting", "h_h2": "Your server, <em>your data</em>",
    "h_lead": "One container, one volume, SQLite inside. Put it behind the reverse proxy you already run and the IT department can sign it off in an afternoon.",
    "code_c1": "set ADMIN_PASSWORD and APP_SECRET", "code_c2": "behind your TLS proxy:",
    "k1_h": "Security baseline written down", "k1_p": "Threat model, OWASP checks and the deliberate exceptions live in SECURITY.md.",
    "k2_h": "Access you can revoke", "k2_p": "OAuth 2.1 with PKCE, hashed personal keys that expire, sessions that end on password change.",
    "k3_h": "Locked-down by default", "k3_p": "Strict CSP per route, rate limits, upload sniffing, and only admins may install new content types.",
    "k4_h": "Nothing phones home", "k4_p": "No telemetry, no H5P Hub unless you switch it on. Claude is optional.",
    "faq_h2": "Questions people ask",
    "q1": "Why the odd name?", "a1": "Plietsch is Low German, the dialect of the north German coast, and means clever or quick on the uptake. A Plietschpaket is a clever package, which is what the SCORM file is.",
    "q2": "Does it cost anything?", "a2": "No. The code is GPL-3.0 and you run it yourself. You only pay for your server and, if you use it, your Claude plan.",
    "q3": "Which LMS does it work with?", "a3": "Anything that imports SCORM 1.2 or SCORM 2004 4th edition, which covers Moodle, ILIAS, Cornerstone, SAP SuccessFactors, Docebo and most others. The package uses a single SCO, so there are no navigation surprises. For a learning record store there is xAPI and cmi5.",
    "q4": "Do I need Claude?", "a4": "No. Every feature works in the browser editor. Claude is a second way in for people who prefer to describe a course rather than click it together.",
    "q5": "Can I import our existing Lumi files?", "a5": "Yes. Save them as .h5p in Lumi and import them, one by one or as a ZIP. Rise 360 exports work the same way. And back: every unit downloads as .h5p that Lumi opens.",
    "f_h2": "Take it for a spin on <em>your own server</em>",
    "f_p": "Clone the repo, run docker compose, sign in with the admin account. The demo course from this page sits in the examples folder and makes a good first import.",
    "foot_line": " · Made in northern Germany · GPL-3.0", "foot_nav": "Footer", "foot_security": "Security", "foot_legal": "Imprint",
    "stage_json": stage(
        ["This is your list of receipts", "Tap the plus to add a receipt", "Fit the receipt inside the frame", "Take the photo", "Pick the right cost centre", "Submit the receipt", "Close the dialog"],
        ["Info step · <b>Next</b> to continue", "Task · <b>correct</b> on the first try", "Note · Kontor finds the edges itself", "Task · <b>correct</b> on the first try", "Task · <b>correct</b> after a hint", "Task · <b>correct</b> on the first try", "Done · <b>4 of 5</b> on the first try"],
    ),
    "ticker": ticker(["SCORM 1.2", "SCORM 2004 4th edition", "xAPI", "cmi5", "H5P", "MCP", "OAuth 2.1", "Docker", "12 course languages", "Rise 360 import", "Moodle", "ILIAS", "SuccessFactors", "Cornerstone"]),
}

DE = dict(EN)
DE.update({
    "title": "Plietschpaket · Softwareschulungen, die man selbst durchklickt",
    "description": "Selbst gehostetes Autorenwerkzeug für interaktives E-Learning. Produktvideo und App-Simulation zum Mitmachen, exportiert als SCORM 1.2, SCORM 2004, xAPI, cmi5 oder HTML. Claude baut die Kurse auf Wunsch über MCP.",
    "skip": "Zum Inhalt", "nav_label": "Hauptmenü", "menu": "Menü",
    "nav_how": "So geht's", "nav_features": "Funktionen", "nav_host": "Selbst betreiben",
    "eyebrow": "Plattdeutsch für „das schlaue Paket“",
    "h1": "Softwareschulungen, die man <em>selbst durchklickt</em>",
    "hero_lead": "Erst zeigt ein kurzes Video das Produkt, dann üben die Leute dieselben Schritte auf echten Screenshots. Plietschpaket packt beides in eine SCORM-Datei, die euer LMS schon kennt.",
    "cta_github": "Auf GitHub holen", "cta_how": "So funktioniert's",
    "say": "Open Source unter GPL-3.0, läuft in einem einzigen Docker-Container.",
    "stage_kicker": "Kontor · Spesen", "stage_title": "Einen Beleg in Kontor erfassen", "stage_meta": "4 Minuten · iPhone",
    "stage_first": "Das ist deine Belegliste",
    "alt_screen": "Übungsbildschirm der fiktiven Spesen-App Kontor",
    "float_text": "passed · 80 Punkte",
    "how_eyebrow": "Ein Kurs, drei Teile",
    "how_h2": "Zeigen. <em>Selbst machen lassen.</em> Ans LMS melden.",
    "how_lead": "Die meisten Softwareschulungen hören nach dem Video auf. Alle nicken, schließen den Tab und wissen trotzdem nicht, wo der Knopf ist. Ein Kurs aus Plietschpaket geht weiter, bis sie ihn selbst gedrückt haben.",
    "s1_h": "Das Produkt zeigen",
    "s1_p": "Am Anfang steht eure Bildschirmaufnahme oder ein Avatar-Video, als Datei oder eingebettet von YouTube oder Vimeo. Mit interaktivem Video kommen Buttons dazu, Fragen, die das Video anhalten, und Sprünge zwischen Kapiteln.",
    "s1_l1": "Fragen, die das Video stoppen, bis jemand antwortet", "s1_l2": "Kapitelsprünge und klickbare Hotspots", "s1_l3": "Untertitel als WebVTT in jeder Kurssprache",
    "s1_alt": "Interaktives Video, angehalten bei einer Frage",
    "q_title": "Wo legst du einen neuen Beleg an?", "q_a": "Im Profil", "q_b": "Über das Plus in der Belegliste", "q_c": "Unter Freigaben",
    "s2_h": "Selbst üben lassen",
    "s2_p": "Die App-Simulation macht aus Screenshots eine geführte Übung. Ihr zieht den Klickbereich auf dem Screenshot auf, schreibt eine Zeile Anweisung und geht weiter. Lernende tippen, bekommen nach zwei Fehlversuchen einen Hinweis und sehen am Ende, was beim ersten Versuch saß.",
    "s2_l1": "Aufgaben, Hinweise, Info- und Erkunden-Schritte", "s2_l2": "Rahmen für Telefon, Tablet oder Desktop", "s2_l3": "Fortsetzen nach Unterbrechung, Tastatur-Alternative inklusive",
    "s2_alt": "App-Simulation in der LMS-Vorschau",
    "s3_h": "Ans LMS melden",
    "s3_p": "Export als SCORM 1.2, SCORM 2004, xAPI, cmi5 oder einfaches HTML. Noch vor dem Hochladen zeigt der eingebaute LMS-Simulator, welche Werte das Paket sendet: Status, Punkte, Lesezeichen, Fortschritt.",
    "s3_l1": "Abschlussregel und Bestehensgrenze je Kurs", "s3_l2": "Ein SCO, damit jedes LMS gleich damit umgeht", "s3_l3": "Versionsnummer an jedem Export",
    "lms_title": "Das bekäme das LMS",
    "feat_eyebrow": "Alles andere", "feat_h2": "Gebaut für die Leute, die Schulungen machen",
    "f1_h": "Kurse aus Bausteinen", "f1_p": "Text, Bilder, Akkordeons, Abläufe, Szenarien und Wissensfragen untereinander stapeln. Die Live-Vorschau zeigt jede Änderung sofort, auf Desktop, Tablet und Telefon.",
    "f1_alt": "Block-Editor in Plietschpaket mit Gliederung, Bausteinformular und Live-Vorschau",
    "f2_h": "Gemeinsam bauen, extern abnehmen", "f2_p": "Ein Admin legt die Konten an, jedes Projekt hat Owner, Editoren und Leser. Die Fachabteilung bekommt einen Review-Link und kommentiert direkt am Baustein, ganz ohne Konto.",
    "rv_quote": "Schritt 3: Der Knopf heißt jetzt Einreichen, nicht Senden.", "rv_who": "Fachbereich Finanzen · per Review-Link",
    "f3_h": "Zwölf Kurssprachen", "f3_p": "Ein Klick macht eine Sprachfassung mit allen Medien. Die Knöpfe im Player ziehen mit, Arabisch läuft von rechts nach links.",
    "f4_h": "55 H5P-Inhaltstypen", "f4_p": "Interaktives Video, Quiz, Verzweigung und Drag & Drop stehen neben der App-Simulation. Alles ist H5P, also nichts ist eingesperrt.",
    "t1": "Quiz", "t2": "Verzweigung", "t3": "Drag & Drop", "t4": "Hotspots",
    "f5_h": "Mitbringen und mitnehmen", "f5_p": ".h5p-Dateien aus Lumi, Exporte aus Rise 360 und Klick-Übungspakete werden zu bearbeitbaren Kursen. Zurück geht es auch: jede Einheit als .h5p für Lumi.",
    "ok": "importiert", "ok_out": "für Lumi",
    "c_h2": "Kurs beschreiben. <em>Claude baut ihn.</em>",
    "c_lead": "Plietschpaket ist sein eigener OAuth-Server und spricht MCP. Claude liest den Autorenleitfaden, schreibt die Einheiten, lädt eure Screenshots hoch und exportiert das Paket. Dabei hat es genau die Rechte der Person, die sich angemeldet hat.",
    "p1_tag": "Öffentlicher Server", "p1_h": "Als Konnektor hinzufügen", "p1_p": "Die /mcp-Adresse in Claude eintragen, anmelden, zustimmen. Mehr ist es nicht.",
    "p2_tag": "Hinter dem VPN", "p2_h": "Desktop-Erweiterung nutzen", "p2_p": "Konnektoren kommen aus der Cloud und sehen euer Intranet nicht. Die .mcpb-Erweiterung läuft auf dem Laptop und spricht direkt mit dem Server.",
    "c_msg": "Bau einen kurzen Kurs für neue Leute im Vertrieb: Beleg in Kontor erfassen. Die Screenshots liegen im Ordner Kontor. Erst Deutsch, dann Englisch, und am Ende drei Fragen.",
    "c1": "Kontor · Spesen", "c2": "4 Screenshots", "c3": "8 Schritte", "c4": "3 Fragen",
    "c_answer": "Fertig. Der Kurs hat einen Übungsteil mit 8 Schritten und einen kurzen Test am Ende, auf Deutsch und Englisch. Das SCORM-1.2-Paket liegt unter Exporte, und die Vorschau zeigt, was euer LMS bekommt.",
    "h_eyebrow": "Selbst betreiben", "h_h2": "Euer Server, <em>eure Daten</em>",
    "h_lead": "Ein Container, ein Volume, SQLite drin. Hinter den Reverse Proxy, den ihr ohnehin habt, und die IT kann es an einem Nachmittag abnehmen.",
    "code_c1": "ADMIN_PASSWORD und APP_SECRET setzen", "code_c2": "hinter eurem TLS-Proxy:",
    "k1_h": "Sicherheitsstandard aufgeschrieben", "k1_p": "Bedrohungsmodell, OWASP-Prüfungen und bewusste Ausnahmen stehen in SECURITY.md.",
    "k2_h": "Zugänge, die man widerrufen kann", "k2_p": "OAuth 2.1 mit PKCE, gehashte persönliche Schlüssel mit Ablaufdatum, Sitzungen enden beim Passwortwechsel.",
    "k3_h": "Von Haus aus dicht", "k3_p": "Strenge CSP je Route, Rate-Limits, Prüfung hochgeladener Dateien, neue Inhaltstypen nur durch Admins.",
    "k4_h": "Nichts telefoniert nach Hause", "k4_p": "Keine Telemetrie, kein H5P-Hub, solange ihr ihn nicht einschaltet. Claude ist optional.",
    "faq_h2": "Was oft gefragt wird",
    "q1": "Warum dieser Name?", "a1": "Plietsch ist Plattdeutsch und heißt schlau, aufgeweckt. Ein Plietschpaket ist also ein schlaues Paket, und genau das ist die SCORM-Datei am Ende.",
    "q2": "Was kostet das?", "a2": "Nichts. Der Code steht unter GPL-3.0, ihr betreibt ihn selbst. Kosten entstehen nur für euren Server und, falls genutzt, euren Claude-Tarif.",
    "q3": "Mit welchem LMS funktioniert es?", "a3": "Mit allem, was SCORM 1.2 oder SCORM 2004 4th Edition importiert, also Moodle, ILIAS, Cornerstone, SAP SuccessFactors, Docebo und den meisten anderen. Das Paket besteht aus einem einzigen SCO, damit es bei der Navigation keine Überraschungen gibt. Für einen Learning Record Store gibt es xAPI und cmi5.",
    "q4": "Brauche ich Claude?", "a4": "Nein. Jede Funktion geht im Browser-Editor. Claude ist ein zweiter Weg für alle, die einen Kurs lieber beschreiben als zusammenklicken.",
    "q5": "Können wir vorhandene Lumi-Dateien übernehmen?", "a5": "Ja. In Lumi als .h5p speichern und importieren, einzeln oder als ZIP. Exporte aus Rise 360 gehen genauso. Und zurück: Jede Einheit lässt sich als .h5p laden, die Lumi öffnet.",
    "f_h2": "Probiert es auf <em>eurem eigenen Server</em> aus",
    "f_p": "Repo klonen, docker compose starten, mit dem Admin-Konto anmelden. Der Demo-Kurs von dieser Seite liegt im Ordner examples und eignet sich gut als erster Import.",
    "foot_line": " · Gebaut in Norddeutschland · GPL-3.0", "foot_nav": "Fußzeile", "foot_security": "Sicherheit", "foot_legal": "Impressum",
    "stage_json": stage(
        ["Das ist deine Belegliste", "Tippe auf das Plus, um einen Beleg zu erfassen", "Richte den Beleg im Rahmen aus", "Löse die Aufnahme aus", "Wähle die passende Kostenstelle", "Reiche den Beleg ein", "Schließe den Vorgang ab"],
        ["Info-Schritt · <b>Weiter</b> zum Fortfahren", "Aufgabe · <b>richtig</b> beim ersten Versuch", "Hinweis · Kontor erkennt den Rand selbst", "Aufgabe · <b>richtig</b> beim ersten Versuch", "Aufgabe · <b>richtig</b> nach einem Hinweis", "Aufgabe · <b>richtig</b> beim ersten Versuch", "Geschafft · <b>4 von 5</b> beim ersten Versuch"],
    ),
    "ticker": ticker(["SCORM 1.2", "SCORM 2004 4th Edition", "xAPI", "cmi5", "H5P", "MCP", "OAuth 2.1", "Docker", "12 Kurssprachen", "Rise-360-Import", "Moodle", "ILIAS", "SuccessFactors", "Cornerstone"]),
})

IMPRESSUM = """<!doctype html>
<html lang="de" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Impressum · Plietschpaket</title><meta name="robots" content="noindex">
<link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap">
<link rel="stylesheet" href="../assets/site.css"></head>
<body>
<header class="nav"><a class="brand" href="../"><span class="mark" aria-hidden="true"></span>Plietschpaket</a><a class="lang" href="../de/">Deutsch</a><a class="lang" href="../">English</a></header>
<main class="legal"><div class="wrap"><div class="bezel"><div class="core">
<h1>Impressum</h1>
<h2>Angaben gemäß § 5 DDG</h2>
<p>Till Heidrich – Content Creation<br>Rotdornweg 17<br>21255 Tostedt<br>Deutschland</p>
<h2>Kontakt</h2>
<p>Telefon: 0157 73953819<br>E-Mail: info@tillheidrich.de</p>
<h2>Umsatzsteuer</h2>
<p>Kleinunternehmer nach § 19 UStG, daher keine Umsatzsteuer-Identifikationsnummer.</p>
<h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
<p>Till Heidrich, Anschrift wie oben</p>
<h2>Hosting und Datenschutz</h2>
<p>Diese Seite liegt bei GitHub Pages (GitHub Inc., USA). Beim Aufruf verarbeitet GitHub technisch notwendige Verbindungsdaten wie die IP-Adresse. Schriften kommen von Google Fonts. Diese Seite setzt keine Cookies und nutzt kein Tracking.</p>
<h2>Haftung für Links</h2>
<p>Für Inhalte verlinkter externer Seiten sind ausschließlich deren Betreiber verantwortlich.</p>
</div></div></div></main>
</body></html>
"""


def render(tpl, strings, lang):
    root = "" if lang == "en" else "../"
    other = "de" if lang == "en" else "en"
    ctx = dict(strings)
    ctx.update({
        "lang": lang, "root": root, "base": BASE, "home": "./" if lang == "en" else "./",
        "canonical": BASE if lang == "en" else BASE + "de/",
        "url_en": BASE, "url_de": BASE + "de/",
        "other_lang": other, "other_href": ("de/" if lang == "en" else "../"),
        "other_label": "Deutsch" if lang == "en" else "English",
    })
    ctx["stage_json"] = html.escape(ctx["stage_json"], quote=True).replace("&#x27;", "&#39;")

    def sub(m):
        key = m.group(1)
        if key not in ctx:
            raise KeyError(f"missing string {key!r} for {lang}")
        return str(ctx[key])

    return re.sub(r"\{\{(\w+)\}\}", sub, tpl)


def main():
    tpl = (HERE / "src" / "index.html").read_text(encoding="utf-8")
    if DIST.exists():
        shutil.rmtree(DIST)
    (DIST / "de").mkdir(parents=True)
    (DIST / "impressum").mkdir()
    shutil.copytree(HERE / "assets", DIST / "assets")
    (DIST / "index.html").write_text(render(tpl, EN, "en"), encoding="utf-8")
    (DIST / "de" / "index.html").write_text(render(tpl, DE, "de"), encoding="utf-8")
    (DIST / "impressum" / "index.html").write_text(IMPRESSUM, encoding="utf-8")
    (DIST / ".nojekyll").write_text("")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {BASE}sitemap.xml\n")
    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"<url><loc>{BASE}</loc></url><url><loc>{BASE}de/</loc></url></urlset>\n"
    )
    print(f"built {DIST} for {BASE}")


if __name__ == "__main__":
    main()
