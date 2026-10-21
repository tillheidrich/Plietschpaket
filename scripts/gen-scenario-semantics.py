#!/usr/bin/env python3
"""Generates semantics.json and the language files of H5P.Scenario.

Run after changing fields or texts:  python3 scripts/gen-scenario-semantics.py
Editor labels exist in English and German; the player texts (l10n defaults) exist in every course language
listed in L10N. Missing languages fall back to English labels.
"""
import json
from pathlib import Path

LIB = Path(__file__).resolve().parent.parent / "h5p" / "libraries" / "H5P.Scenario-1.0"

LOOKS = [
    ("amara", "Amara"), ("ben", "Ben"), ("chen", "Chen"), ("jonas", "Jonas"),
    ("lea", "Lea"), ("mira", "Mira"), ("sofia", "Sofia"), ("yusuf", "Yusuf"), ("custom", "Own image"),
]
BACKGROUNDS = [
    ("service", "Service desk"), ("office", "Open-plan office"), ("meeting", "Meeting room"),
    ("shop", "Shop"), ("warehouse", "Warehouse"), ("clinic", "Reception / clinic"), ("custom", "Own image"),
]
EXPRESSIONS = [("neutral", "Neutral"), ("happy", "Happy"), ("angry", "Angry"), ("worried", "Worried"),
               ("thinking", "Thinking"), ("surprised", "Surprised")]
POSES = [("auto", "Matching the expression"), ("neutral", "Arms down"), ("hips", "Hands on hips"),
         ("crossed", "Arms crossed"), ("explain", "Explaining")]

# Player texts per course language (":name" placeholders are replaced at runtime).
L10N = {
    "en": {
        "start": "Start", "resume": "Continue where you left off", "narration": "Narration",
        "play": "Play narration", "pause": "Pause narration", "next": "Continue", "choose": "What do you do?",
        "decision": "Decision :num", "endingGood": "Strong result", "endingMixed": "Room to improve",
        "endingBad": "That went wrong", "score": "Score: :score of :max", "passed": "Passed",
        "failed": "Not passed yet", "again": "Try again", "recap": "Your decisions", "back": "Back",
    },
    "de": {
        "start": "Starten", "resume": "Dort weitermachen, wo du aufgehört hast", "narration": "Erzählung",
        "play": "Erzählung abspielen", "pause": "Erzählung anhalten", "next": "Weiter", "choose": "Was tust du?",
        "decision": "Entscheidung :num", "endingGood": "Starkes Ergebnis", "endingMixed": "Da geht noch was",
        "endingBad": "Das ging schief", "score": "Punkte: :score von :max", "passed": "Bestanden",
        "failed": "Noch nicht bestanden", "again": "Noch einmal", "recap": "Deine Entscheidungen", "back": "Zurück",
    },
    "fr": {
        "start": "Commencer", "resume": "Reprendre là où vous en étiez", "narration": "Narration",
        "play": "Lire la narration", "pause": "Mettre en pause", "next": "Continuer", "choose": "Que faites-vous ?",
        "decision": "Décision :num", "endingGood": "Excellent résultat", "endingMixed": "Peut mieux faire",
        "endingBad": "Cela a mal tourné", "score": "Score : :score sur :max", "passed": "Réussi",
        "failed": "Pas encore réussi", "again": "Recommencer", "recap": "Vos décisions", "back": "Retour",
    },
    "it": {
        "start": "Inizia", "resume": "Riprendi da dove avevi lasciato", "narration": "Narrazione",
        "play": "Ascolta la narrazione", "pause": "Metti in pausa", "next": "Continua", "choose": "Cosa fai?",
        "decision": "Decisione :num", "endingGood": "Ottimo risultato", "endingMixed": "Si può migliorare",
        "endingBad": "È andata male", "score": "Punteggio: :score su :max", "passed": "Superato",
        "failed": "Non ancora superato", "again": "Riprova", "recap": "Le tue decisioni", "back": "Indietro",
    },
}

L10N_LABELS = {
    "start": "Start button", "resume": "Resume button", "narration": "Narration label", "play": "Play button (screen reader)",
    "pause": "Pause button (screen reader)", "next": "Continue button", "choose": "Prompt above the choices",
    "decision": "Decision counter", "endingGood": "Heading for a good ending", "endingMixed": "Heading for a mixed ending",
    "endingBad": "Heading for a bad ending", "score": "Score line", "passed": "Passed", "failed": "Not passed",
    "again": "Retry button", "recap": "Heading of the decision recap", "back": "Back",
}


def text(name, label, **kw):
    f = {"name": name, "type": "text", "label": label}
    f.update(kw)
    return f


def select(name, label, options, default, **kw):
    f = {"name": name, "type": "select", "label": label, "options": [{"value": v, "label": l} for v, l in options], "default": default}
    f.update(kw)
    return f


SEMANTICS = [
    {"name": "intro", "type": "group", "label": "Start screen", "importance": "high", "expanded": True, "fields": [
        text("kicker", "Label above the title", optional=True, default="Role-play", maxLength=60),
        text("text", "Introduction", widget="textarea", optional=True, maxLength=600,
             description="One or two sentences on the situation and what the learner should practise."),
        {"name": "cover", "type": "image", "label": "Cover image", "optional": True,
         "description": "Optional. Without a cover the first scene is shown in the background."},
    ]},
    {"name": "characters", "type": "list", "label": "Characters", "importance": "high", "entity": "character", "min": 1, "max": 6,
     "field": {"name": "character", "type": "group", "label": "Character", "importance": "high", "fields": [
         text("key", "Short key", importance="high", maxLength=30, regexp={"pattern": "^[a-z0-9_-]+$", "modifiers": ""},
              description="Lower case, no spaces, e.g. customer. Scenes refer to the character by this key."),
         text("name", "Name shown in the speech bubble", importance="high", maxLength=40),
         select("look", "Look", LOOKS, "chen", description="Built-in illustrated characters, or your own image."),
         {"name": "image", "type": "image", "label": "Own image", "optional": True,
          "description": "PNG with transparent background, full body, standing. Used when the look is set to own image."},
         text("color", "Name colour", optional=True, default="#c4b5fd", description="Hex colour, e.g. #c4b5fd."),
     ]}},
    {"name": "scenes", "type": "list", "label": "Scenes", "importance": "high", "entity": "scene", "min": 1, "max": 60,
     "description": "The first scene is where the role-play starts. Each choice points to the key of the next scene or of an ending.",
     "field": {"name": "scene", "type": "group", "label": "Scene", "importance": "high", "fields": [
         text("key", "Short key", importance="high", maxLength=40, regexp={"pattern": "^[a-z0-9_-]+$", "modifiers": ""},
              description="Lower case, no spaces, e.g. greeting."),
         text("situation", "Situation", optional=True, maxLength=280,
              description="Short stage direction at the top, e.g. 'An angry customer approaches the desk.'"),
         select("background", "Background", BACKGROUNDS, "office"),
         {"name": "backgroundImage", "type": "image", "label": "Own background image", "optional": True,
          "description": "Landscape, at least 1600 px wide. Used when the background is set to own image."},
         text("character", "Character key", optional=True, maxLength=30,
              description="Key of the character who speaks. Leave empty for a scene without a character."),
         select("expression", "Expression", EXPRESSIONS, "neutral"),
         select("pose", "Pose", POSES, "auto"),
         select("position", "Position", [("right", "Right"), ("left", "Left"), ("center", "Centre")], "right"),
         text("line", "What the character says", widget="textarea", optional=True, maxLength=600),
         {"name": "audio", "type": "audio", "label": "Narration audio", "optional": True,
          "description": "Optional. Without audio the browser reads the texts aloud if that is switched on."},
         {"name": "choices", "type": "list", "label": "Choices", "entity": "choice", "min": 0, "max": 4, "optional": True,
          "description": "Two to four options. Without choices the scene continues to 'Next scene'.",
          "field": {"name": "choice", "type": "group", "label": "Choice", "fields": [
              text("text", "Answer", importance="high", maxLength=240),
              text("next", "Leads to (key of a scene or ending)", importance="high", maxLength=40),
              text("feedback", "Consequence shown after the choice", widget="textarea", optional=True, maxLength=400),
              {"name": "points", "type": "number", "label": "Points", "default": 0, "min": -10, "max": 10},
              select("tone", "Rating", [("good", "Good"), ("neutral", "Neutral"), ("bad", "Bad")], "neutral"),
          ]}},
         text("nextScene", "Next scene (if there are no choices)", optional=True, maxLength=40),
     ]}},
    {"name": "endings", "type": "list", "label": "Endings", "importance": "high", "entity": "ending", "min": 1, "max": 12,
     "field": {"name": "ending", "type": "group", "label": "Ending", "importance": "high", "fields": [
         text("key", "Short key", importance="high", maxLength=40, regexp={"pattern": "^[a-z0-9_-]+$", "modifiers": ""}),
         text("title", "Title", importance="high", maxLength=120),
         text("text", "What happened", widget="textarea", optional=True, maxLength=800),
         select("rating", "Rating", [("good", "Good"), ("mixed", "Mixed"), ("bad", "Bad")], "good"),
     ]}},
    {"name": "theme", "type": "group", "label": "Look", "importance": "low", "fields": [
        select("mode", "Mode", [("dark", "Dark"), ("light", "Light")], "dark"),
        text("accent", "Accent colour", default="#7c6cf0", description="Hex colour for buttons and progress."),
    ]},
    {"name": "behaviour", "type": "group", "label": "Behaviour", "importance": "low", "fields": [
        select("scoring", "Scoring", [("points", "Points of the chosen answers"), ("none", "No score")], "points"),
        {"name": "passPercent", "type": "number", "label": "Pass mark in percent of the best path", "default": 70, "min": 0, "max": 100},
        {"name": "tts", "type": "boolean", "label": "Read texts aloud with the browser voice when there is no audio", "default": True},
        {"name": "autoNarrate", "type": "boolean", "label": "Start narration automatically in each scene", "default": False},
        {"name": "showFeedback", "type": "boolean", "label": "Show the consequence after each choice", "default": True},
        {"name": "allowRetry", "type": "boolean", "label": "Allow another attempt at the end", "default": True},
    ]},
    {"name": "l10n", "type": "group", "label": "Texts of the user interface", "importance": "low", "common": True,
     "fields": [text(k, L10N_LABELS[k], default=v) for k, v in L10N["en"].items()]},
]

DE = {
    "Start screen": "Startbildschirm", "Label above the title": "Kennzeichnung über dem Titel", "Role-play": "Rollenspiel",
    "Introduction": "Einleitung", "One or two sentences on the situation and what the learner should practise.": "Ein bis zwei Sätze zur Lage und zu dem, was geübt wird.",
    "Cover image": "Titelbild", "Optional. Without a cover the first scene is shown in the background.": "Optional. Ohne Titelbild ist die erste Szene im Hintergrund zu sehen.",
    "Characters": "Figuren", "Character": "Figur", "Short key": "Kurzname",
    "Lower case, no spaces, e.g. customer. Scenes refer to the character by this key.": "Kleinbuchstaben ohne Leerzeichen, z. B. kunde. Szenen verweisen über diesen Kurznamen auf die Figur.",
    "Name shown in the speech bubble": "Name in der Sprechblase", "Look": "Aussehen",
    "Built-in illustrated characters, or your own image.": "Mitgelieferte gezeichnete Figuren oder ein eigenes Bild.",
    "Own image": "Eigenes Bild", "PNG with transparent background, full body, standing. Used when the look is set to own image.": "PNG mit transparentem Hintergrund, ganze Figur stehend. Wird genutzt, wenn als Aussehen „Eigenes Bild“ gewählt ist.",
    "Name colour": "Farbe des Namens", "Hex colour, e.g. #c4b5fd.": "Hex-Farbe, z. B. #c4b5fd.",
    "Scenes": "Szenen", "Scene": "Szene",
    "The first scene is where the role-play starts. Each choice points to the key of the next scene or of an ending.": "Mit der ersten Szene beginnt das Rollenspiel. Jede Antwort verweist auf den Kurznamen der nächsten Szene oder eines Endes.",
    "Lower case, no spaces, e.g. greeting.": "Kleinbuchstaben ohne Leerzeichen, z. B. begruessung.",
    "Situation": "Situation", "Short stage direction at the top, e.g. 'An angry customer approaches the desk.'": "Kurze Regieanweisung oben, z. B. „Ein verärgerter Kunde kommt an den Schalter.“",
    "Background": "Hintergrund", "Own background image": "Eigenes Hintergrundbild",
    "Landscape, at least 1600 px wide. Used when the background is set to own image.": "Querformat, mindestens 1600 px breit. Wird genutzt, wenn als Hintergrund „Eigenes Bild“ gewählt ist.",
    "Character key": "Kurzname der Figur", "Key of the character who speaks. Leave empty for a scene without a character.": "Kurzname der sprechenden Figur. Leer lassen für eine Szene ohne Figur.",
    "Expression": "Gesichtsausdruck", "Pose": "Haltung", "Position": "Position", "Right": "Rechts", "Left": "Links", "Centre": "Mitte",
    "What the character says": "Was die Figur sagt", "Narration audio": "Audio der Erzählung",
    "Optional. Without audio the browser reads the texts aloud if that is switched on.": "Optional. Ohne Audio liest der Browser die Texte vor, wenn das eingeschaltet ist.",
    "Choices": "Antworten", "Choice": "Antwort", "Two to four options. Without choices the scene continues to 'Next scene'.": "Zwei bis vier Möglichkeiten. Ohne Antworten geht es mit „Nächste Szene“ weiter.",
    "Answer": "Antworttext", "Leads to (key of a scene or ending)": "Führt zu (Kurzname einer Szene oder eines Endes)",
    "Consequence shown after the choice": "Folge, die nach der Wahl erscheint", "Points": "Punkte", "Rating": "Bewertung",
    "Good": "Gut", "Neutral": "Neutral", "Bad": "Schlecht", "Mixed": "Gemischt",
    "Next scene (if there are no choices)": "Nächste Szene (wenn es keine Antworten gibt)",
    "Endings": "Enden", "Ending": "Ende", "Title": "Titel", "What happened": "Was passiert ist",
    "Mode": "Modus", "Dark": "Dunkel", "Light": "Hell", "Accent colour": "Akzentfarbe", "Hex colour for buttons and progress.": "Hex-Farbe für Buttons und Fortschritt.",
    "Behaviour": "Verhalten", "Scoring": "Bewertung", "Points of the chosen answers": "Punkte der gewählten Antworten", "No score": "Ohne Punkte",
    "Pass mark in percent of the best path": "Bestehensgrenze in Prozent des besten Wegs",
    "Read texts aloud with the browser voice when there is no audio": "Texte mit der Browser-Stimme vorlesen, wenn kein Audio da ist",
    "Start narration automatically in each scene": "Erzählung in jeder Szene automatisch starten",
    "Show the consequence after each choice": "Nach jeder Wahl die Folge zeigen", "Allow another attempt at the end": "Am Ende einen weiteren Versuch erlauben",
    "Texts of the user interface": "Texte der Oberfläche",
    "Service desk": "Serviceschalter", "Open-plan office": "Großraumbüro", "Meeting room": "Besprechungsraum", "Shop": "Laden",
    "Warehouse": "Lager", "Reception / clinic": "Empfang / Praxis",
    "Happy": "Freundlich", "Angry": "Verärgert", "Worried": "Besorgt", "Thinking": "Nachdenklich", "Surprised": "Überrascht",
    "Matching the expression": "Passend zum Ausdruck", "Arms down": "Arme unten", "Hands on hips": "Hände in den Hüften",
    "Arms crossed": "Arme verschränkt", "Explaining": "Erklärend",
    "Start button": "Start-Button", "Resume button": "Fortsetzen-Button", "Narration label": "Beschriftung Erzählung",
    "Play button (screen reader)": "Abspielen (Screenreader)", "Pause button (screen reader)": "Anhalten (Screenreader)",
    "Continue button": "Weiter-Button", "Prompt above the choices": "Frage über den Antworten", "Decision counter": "Zähler der Entscheidungen",
    "Heading for a good ending": "Überschrift gutes Ende", "Heading for a mixed ending": "Überschrift gemischtes Ende",
    "Heading for a bad ending": "Überschrift schlechtes Ende", "Score line": "Punktezeile", "Passed": "Bestanden", "Not passed": "Nicht bestanden",
    "Retry button": "Neu-starten-Button", "Heading of the decision recap": "Überschrift Rückblick", "Back": "Zurück",
    "Landscape": "Querformat",
}


def translate_field(f, lang):
    """Returns the language-file shape of a semantics field (only translatable keys)."""
    tr = (lambda s: DE.get(s, s)) if lang == "de" else (lambda s: s)
    out = {}
    if "label" in f:
        out["label"] = tr(f["label"])
    if "description" in f:
        out["description"] = tr(f["description"])
    if "entity" in f:
        out["entity"] = f["entity"] if lang != "de" else tr(f["entity"].capitalize()).lower()
    if "options" in f:
        out["options"] = [{"label": tr(o["label"])} for o in f["options"]]
    if f.get("type") == "text" and isinstance(f.get("default"), str) and not f["default"].startswith("#"):
        out["default"] = tr(f["default"])
    if "fields" in f:
        out["fields"] = [translate_field(c, lang) for c in f["fields"]]
    if "field" in f:
        out["field"] = translate_field(f["field"], lang)
    return out


def language_file(lang):
    sem = [translate_field(f, lang) for f in SEMANTICS]
    texts = L10N.get(lang, L10N["en"])
    l10n = next(f for f in sem if f.get("label") in ("Texts of the user interface", "Texte der Oberfläche"))
    for field, key in zip(l10n["fields"], L10N["en"].keys()):
        field["default"] = texts[key]
    # Course language decides the default kicker of the start screen as well.
    kicker = {"de": "Rollenspiel", "fr": "Jeu de rôle", "it": "Gioco di ruolo"}.get(lang, "Role-play")
    sem[0]["fields"][0]["default"] = kicker
    return {"semantics": sem}


def main():
    (LIB / "semantics.json").write_text(json.dumps(SEMANTICS, ensure_ascii=False, indent=2) + "\n")
    (LIB / "language").mkdir(exist_ok=True)
    for lang in L10N:
        name = ".en.json" if lang == "en" else f"{lang}.json"
        (LIB / "language" / name).write_text(json.dumps(language_file(lang), ensure_ascii=False, indent=2) + "\n")
    print("semantics + languages:", ", ".join(L10N))


if __name__ == "__main__":
    main()
