/**
 * Course templates for block courses.
 * Built-in templates are didactic skeletons: every text tells the author what belongs there, so a template
 * produces a complete, valid course that only needs real content. Users save own courses as templates
 * (personal, or shared with everybody when an admin saves them). Own templates keep blocks, design and media;
 * H5P blocks are dropped because units are not copied.
 */
import fs from 'node:fs';
import path from 'node:path';
import { db, newId, audit, parseJson } from './db.js';
import { config } from './config.js';
import { assertCourse } from './access.js';
import { referencedMedia, mediaPath, courseMediaDir, newBlockId, normalizeBlocks, normalizeDesign, DEFAULT_DESIGN, THEME_PRESETS } from './blocks.js';

class TemplateError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const p = (s) => `<p>${s}</p>`;
const B = (type, data) => ({ type, data });

// ------------------------------------------------------------------------------------------------ built-in
const BUILTIN = {
  software: {
    category: 'software',
    design: { player: 'studio', theme: { preset: 'slate' } },
    de: {
      name: 'Software-Schulung',
      description: 'Vom Warum über die Bedienschritte bis zum Test. Platz für App-Simulationen und Produktvideo.',
      blocks: () => [
        B('title', { content: 'Worum es geht', kicker: 'Lektion 1' }),
        B('text', { content: p('Beschreibe in zwei, drei Sätzen, welches Problem die Software löst und was Lernende nach dem Kurs können.') + p('Nenne die Rolle, für die der Kurs gedacht ist, und die Version der Software.') }),
        B('callout', { variant: 'key', title: 'Lernziel', content: p('Nach diesem Kurs kannst du … (ein Satz, beobachtbar formuliert).') }),
        B('title', { content: 'Schritt für Schritt', kicker: 'Lektion 2' }),
        B('numberedList', { items: ['Erster Bedienschritt, genau mit den Begriffen der Oberfläche', 'Zweiter Bedienschritt', 'Dritter Bedienschritt'] }),
        B('callout', { variant: 'tip', title: 'Üben', content: p('Füge hier eine App-Simulation ein: unter „Bausteine“ → H5P-Einheiten → „Neue H5P-Einheit“ → App-Simulation. Lernende klicken dann selbst durch die Schritte.') }),
        B('accordion', { items: [{ heading: 'Was tun, wenn die Schaltfläche fehlt?', content: p('Beschreibe den häufigsten Stolperstein und die Lösung.') }, { heading: 'Wo finde ich Hilfe?', content: p('Ansprechpartner, Support-Kanal oder Handbuch.') }] }),
        B('title', { content: 'Wissen prüfen', kicker: 'Lektion 3' }),
        B('sorting', { prompt: 'Bring die Schritte in die richtige Reihenfolge.', items: ['Erster Schritt', 'Zweiter Schritt', 'Dritter Schritt'] }),
        B('quiz', { question: 'Welche Frage prüft das Lernziel dieser Schulung?', options: ['Die richtige Antwort', 'Eine plausible falsche Antwort', 'Noch eine plausible falsche Antwort'], correct: [0], explanation: 'Erkläre, warum die Antwort richtig ist.' }),
        B('title', { content: 'Abschluss', kicker: 'Lektion 4' }),
        B('checklist', { title: 'Das kannst du jetzt', items: ['Ersten Arbeitsschritt allein erledigen', 'Typische Fehler vermeiden', 'Wissen, wo es Hilfe gibt'] }),
        B('assessment', { title: 'Abschlusstest', intro: 'Drei Fragen, bestanden ab 70 %.', passPercent: 70, questions: [{ question: 'Frage 1', options: ['Richtig', 'Falsch'], correct: [0] }, { question: 'Frage 2', options: ['Falsch', 'Richtig'], correct: [1] }, { question: 'Frage 3', options: ['Richtig', 'Falsch', 'Auch falsch'], correct: [0] }] })
      ]
    },
    en: {
      name: 'Software training',
      description: 'From the why to the clicks to the test. Room for app simulations and a product video.',
      blocks: () => [
        B('title', { content: 'What this is about', kicker: 'Lesson 1' }),
        B('text', { content: p('Describe in two or three sentences which problem the software solves and what learners can do after the course.') + p('Name the role the course is meant for and the software version.') }),
        B('callout', { variant: 'key', title: 'Learning goal', content: p('After this course you can … (one sentence, something you can observe).') }),
        B('title', { content: 'Step by step', kicker: 'Lesson 2' }),
        B('numberedList', { items: ['First step, using the exact words of the interface', 'Second step', 'Third step'] }),
        B('callout', { variant: 'tip', title: 'Practice', content: p('Add an app simulation here: Blocks library → H5P units → “New H5P unit” → App simulation. Learners then click through the steps themselves.') }),
        B('accordion', { items: [{ heading: 'What if the button is missing?', content: p('Describe the most common stumbling block and how to get past it.') }, { heading: 'Where do I get help?', content: p('Contact person, support channel or manual.') }] }),
        B('title', { content: 'Check your knowledge', kicker: 'Lesson 3' }),
        B('sorting', { prompt: 'Put the steps in the right order.', items: ['First step', 'Second step', 'Third step'] }),
        B('quiz', { question: 'Which question checks the learning goal of this training?', options: ['The correct answer', 'A plausible wrong answer', 'Another plausible wrong answer'], correct: [0], explanation: 'Explain why the answer is correct.' }),
        B('title', { content: 'Wrap-up', kicker: 'Lesson 4' }),
        B('checklist', { title: 'You can now', items: ['Do the first task on your own', 'Avoid the typical mistakes', 'Know where to get help'] }),
        B('assessment', { title: 'Final test', intro: 'Three questions, pass mark 70 %.', passPercent: 70, questions: [{ question: 'Question 1', options: ['Correct', 'Wrong'], correct: [0] }, { question: 'Question 2', options: ['Wrong', 'Correct'], correct: [1] }, { question: 'Question 3', options: ['Correct', 'Wrong', 'Also wrong'], correct: [0] }] })
      ]
    }
  },
  onboarding: {
    category: 'onboarding',
    design: { player: 'hub', theme: { preset: 'ocean' } },
    de: {
      name: 'Onboarding',
      description: 'Willkommen, Organisation, Werkzeuge und die erste Woche. Startseite mit Kacheln.',
      blocks: () => [
        B('title', { content: 'Willkommen', kicker: 'Start' }),
        B('statement', { content: 'Schön, dass du da bist.', style: 'accent' }),
        B('text', { content: p('Ein persönlicher Gruß der Geschäftsführung oder Teamleitung: Wofür steht das Unternehmen, und warum zählt deine Rolle?') }),
        B('timeline', { items: [{ date: 'Tag 1', title: 'Ankommen, Zugänge, Team kennenlernen' }, { date: 'Woche 1', title: 'Einarbeitung in die wichtigsten Abläufe' }, { date: 'Monat 1', title: 'Erstes Feedbackgespräch' }] }),
        B('title', { content: 'Wer wir sind', kicker: 'Organisation' }),
        B('tabs', { tabs: [{ title: 'Auftrag', content: p('Was wir tun und für wen.') }, { title: 'Werte', content: p('Drei Werte, jeweils mit einem Beispiel aus dem Alltag.') }, { title: 'Struktur', content: p('Bereiche, Standorte, wer wofür zuständig ist.') }] }),
        B('title', { content: 'Werkzeuge und Ansprechpartner', kicker: 'Praktisches' }),
        B('table', { caption: 'Wen du wofür fragst', header: true, rows: [['Thema', 'Ansprechpartner', 'Kanal'], ['IT und Zugänge', 'Name', 'Ticket oder Chat'], ['Urlaub und Zeiten', 'Name', 'Personalportal']] }),
        B('accordion', { items: [{ heading: 'Wie melde ich mich krank?', content: p('Ablauf in zwei Sätzen.') }, { heading: 'Wo finde ich Vorlagen?', content: p('Ort und Link.') }] }),
        B('title', { content: 'Deine erste Woche', kicker: 'Los geht’s' }),
        B('checklist', { title: 'Bis Freitag erledigt', items: ['Alle Zugänge funktionieren', 'Mit jedem Teammitglied kurz gesprochen', 'Erste Aufgabe übernommen'] }),
        B('quiz', { question: 'An wen wendest du dich bei Problemen mit deinem Zugang?', options: ['IT', 'Personalabteilung', 'Geschäftsführung'], correct: [0], explanation: 'Die IT kümmert sich um Zugänge und Geräte.' })
      ]
    },
    en: {
      name: 'Onboarding',
      description: 'Welcome, organisation, tools and the first week. Home page with tiles.',
      blocks: () => [
        B('title', { content: 'Welcome', kicker: 'Start' }),
        B('statement', { content: 'Great to have you here.', style: 'accent' }),
        B('text', { content: p('A personal greeting from management or the team lead: what the company stands for, and why your role matters.') }),
        B('timeline', { items: [{ date: 'Day 1', title: 'Arrive, get your accounts, meet the team' }, { date: 'Week 1', title: 'Learn the most important processes' }, { date: 'Month 1', title: 'First feedback talk' }] }),
        B('title', { content: 'Who we are', kicker: 'Organisation' }),
        B('tabs', { tabs: [{ title: 'Mission', content: p('What we do and for whom.') }, { title: 'Values', content: p('Three values, each with an everyday example.') }, { title: 'Structure', content: p('Departments, locations, who is responsible for what.') }] }),
        B('title', { content: 'Tools and contacts', kicker: 'Practical' }),
        B('table', { caption: 'Whom to ask about what', header: true, rows: [['Topic', 'Contact', 'Channel'], ['IT and accounts', 'Name', 'Ticket or chat'], ['Leave and hours', 'Name', 'HR portal']] }),
        B('accordion', { items: [{ heading: 'How do I call in sick?', content: p('The process in two sentences.') }, { heading: 'Where do I find templates?', content: p('Place and link.') }] }),
        B('title', { content: 'Your first week', kicker: 'Let’s go' }),
        B('checklist', { title: 'Done by Friday', items: ['All accounts work', 'Talked to everyone on the team', 'Took on a first task'] }),
        B('quiz', { question: 'Whom do you contact about problems with your account?', options: ['IT', 'HR', 'Management'], correct: [0], explanation: 'IT takes care of accounts and devices.' })
      ]
    }
  },
  compliance: {
    category: 'compliance',
    design: { player: 'lesson', theme: { preset: 'ink' } },
    de: {
      name: 'Pflichtunterweisung',
      description: 'Regeln, Fallbeispiele und ein Abschlusstest mit Bestehensgrenze. Geführte Navigation.',
      settings: { navigation: 'linear', masteryScore: 80 },
      blocks: () => [
        B('title', { content: 'Warum das wichtig ist', kicker: 'Unterweisung' }),
        B('text', { content: p('Erkläre in wenigen Sätzen, welches Risiko die Regeln verhindern und wer betroffen ist.') }),
        B('callout', { variant: 'warning', title: 'Achtung', content: p('Was passiert, wenn die Regel nicht eingehalten wird? Konkret und ohne Drohkulisse.') }),
        B('title', { content: 'Die Regeln', kicker: 'Wissen' }),
        B('accordion', { items: [{ heading: 'Regel 1', content: p('Die Regel in einem Satz, dann ein Beispiel.') }, { heading: 'Regel 2', content: p('Die Regel in einem Satz, dann ein Beispiel.') }, { heading: 'Regel 3', content: p('Die Regel in einem Satz, dann ein Beispiel.') }] }),
        B('title', { content: 'Fälle aus dem Alltag', kicker: 'Anwenden' }),
        B('flipcard', { cards: [{ front: 'Situation 1: Was tust du?', back: 'Richtige Reaktion mit Begründung.' }, { front: 'Situation 2: Was tust du?', back: 'Richtige Reaktion mit Begründung.' }] }),
        B('quiz', { question: 'Ein realistischer Fall: Was ist richtig?', options: ['Regelkonformes Verhalten', 'Verbreiteter Irrtum', 'Gut gemeint, aber falsch'], correct: [0], explanation: 'Begründung mit Verweis auf die Regel.' }),
        B('title', { content: 'Abschlusstest', kicker: 'Nachweis' }),
        B('assessment', { title: 'Abschlusstest', intro: 'Bestanden ab 80 %. Du kannst den Test wiederholen.', passPercent: 80, shuffle: true, questions: [{ question: 'Frage zu Regel 1', options: ['Richtig', 'Falsch'], correct: [0] }, { question: 'Frage zu Regel 2', options: ['Falsch', 'Richtig'], correct: [1] }, { question: 'Frage zu Regel 3', options: ['Richtig', 'Falsch'], correct: [0] }, { question: 'Fallfrage', options: ['Richtig', 'Falsch', 'Auch falsch'], correct: [0] }] })
      ]
    },
    en: {
      name: 'Compliance training',
      description: 'Rules, cases from daily work and a final test with a pass mark. Guided navigation.',
      settings: { navigation: 'linear', masteryScore: 80 },
      blocks: () => [
        B('title', { content: 'Why this matters', kicker: 'Mandatory training' }),
        B('text', { content: p('Explain in a few sentences which risk the rules prevent and who is affected.') }),
        B('callout', { variant: 'warning', title: 'Caution', content: p('What happens if the rule is not followed? Be concrete without scaremongering.') }),
        B('title', { content: 'The rules', kicker: 'Knowledge' }),
        B('accordion', { items: [{ heading: 'Rule 1', content: p('The rule in one sentence, then an example.') }, { heading: 'Rule 2', content: p('The rule in one sentence, then an example.') }, { heading: 'Rule 3', content: p('The rule in one sentence, then an example.') }] }),
        B('title', { content: 'Cases from daily work', kicker: 'Apply' }),
        B('flipcard', { cards: [{ front: 'Situation 1: what do you do?', back: 'The right reaction and why.' }, { front: 'Situation 2: what do you do?', back: 'The right reaction and why.' }] }),
        B('quiz', { question: 'A realistic case: what is right?', options: ['Compliant behaviour', 'A common misconception', 'Well meant but wrong'], correct: [0], explanation: 'Reasoning with a reference to the rule.' }),
        B('title', { content: 'Final test', kicker: 'Proof' }),
        B('assessment', { title: 'Final test', intro: 'Pass mark 80 %. You can retake the test.', passPercent: 80, shuffle: true, questions: [{ question: 'Question on rule 1', options: ['Correct', 'Wrong'], correct: [0] }, { question: 'Question on rule 2', options: ['Wrong', 'Correct'], correct: [1] }, { question: 'Question on rule 3', options: ['Correct', 'Wrong'], correct: [0] }, { question: 'Case question', options: ['Correct', 'Wrong', 'Also wrong'], correct: [0] }] })
      ]
    }
  },
  product: {
    category: 'sales',
    design: { player: 'magazine', theme: { preset: 'violet' } },
    de: {
      name: 'Produktschulung',
      description: 'Produkt, Kundennutzen, Einwände und ein kurzer Pitch zum Üben. Magazin-Look.',
      blocks: () => [
        B('title', { content: 'Das Produkt', kicker: 'Kapitel 1' }),
        B('text', { content: p('Was ist das Produkt, für wen ist es gemacht, und was macht es anders als die Alternativen?') }),
        B('columns', { leftTitle: 'Für wen', left: p('Zielgruppe in einem Satz.'), rightTitle: 'Wofür', right: p('Der wichtigste Einsatzzweck.') }),
        B('title', { content: 'Nutzen für Kunden', kicker: 'Kapitel 2' }),
        B('comparison', { left: { title: 'Ohne das Produkt', items: ['Typisches Problem 1', 'Typisches Problem 2'] }, right: { title: 'Mit dem Produkt', items: ['Konkreter Nutzen 1', 'Konkreter Nutzen 2'] } }),
        B('title', { content: 'Einwände', kicker: 'Kapitel 3' }),
        B('accordion', { items: [{ heading: '„Das ist zu teuer.“', content: p('Antwort, die den Nutzen beziffert.') }, { heading: '„Wir haben schon eine Lösung.“', content: p('Antwort, die nach dem Status quo fragt.') }] }),
        B('matching', { prompt: 'Ordne jedem Einwand die passende Antwort zu.', pairs: [{ left: 'Zu teuer', right: 'Nutzen beziffern' }, { left: 'Haben wir schon', right: 'Nach Lücken fragen' }, { left: 'Keine Zeit', right: 'Kleinen ersten Schritt anbieten' }] }),
        B('title', { content: 'Dein Pitch', kicker: 'Kapitel 4' }),
        B('fillBlanks', { prompt: 'Vervollständige den Kurz-Pitch.', text: 'Unser Produkt hilft [Zielgruppe], [Problem] zu lösen, indem es [Lösung].' }),
        B('assessment', { title: 'Abschlusscheck', passPercent: 70, questions: [{ question: 'Für wen ist das Produkt gemacht?', options: ['Zielgruppe', 'Andere Gruppe'], correct: [0] }, { question: 'Was ist der wichtigste Nutzen?', options: ['Falsch', 'Richtig'], correct: [1] }] })
      ]
    },
    en: {
      name: 'Product training',
      description: 'Product, customer value, objections and a short pitch to practise. Magazine look.',
      blocks: () => [
        B('title', { content: 'The product', kicker: 'Chapter 1' }),
        B('text', { content: p('What is the product, who is it made for, and what does it do differently from the alternatives?') }),
        B('columns', { leftTitle: 'For whom', left: p('Target group in one sentence.'), rightTitle: 'For what', right: p('The most important use case.') }),
        B('title', { content: 'Customer value', kicker: 'Chapter 2' }),
        B('comparison', { left: { title: 'Without the product', items: ['Typical problem 1', 'Typical problem 2'] }, right: { title: 'With the product', items: ['Concrete benefit 1', 'Concrete benefit 2'] } }),
        B('title', { content: 'Objections', kicker: 'Chapter 3' }),
        B('accordion', { items: [{ heading: '“It is too expensive.”', content: p('An answer that puts a number on the value.') }, { heading: '“We already have a solution.”', content: p('An answer that asks about the status quo.') }] }),
        B('matching', { prompt: 'Match each objection with the right answer.', pairs: [{ left: 'Too expensive', right: 'Quantify the value' }, { left: 'Already have one', right: 'Ask about gaps' }, { left: 'No time', right: 'Offer a small first step' }] }),
        B('title', { content: 'Your pitch', kicker: 'Chapter 4' }),
        B('fillBlanks', { prompt: 'Complete the short pitch.', text: 'Our product helps [target group] to solve [problem] by [solution].' }),
        B('assessment', { title: 'Final check', passPercent: 70, questions: [{ question: 'Who is the product made for?', options: ['Target group', 'Another group'], correct: [0] }, { question: 'What is the main benefit?', options: ['Wrong', 'Correct'], correct: [1] }] })
      ]
    }
  },
  softskills: {
    category: 'softskills',
    design: { player: 'stage', theme: { preset: 'forest' } },
    de: {
      name: 'Gesprächsführung',
      description: 'Situation, Modell, Übung und Reflexion. Bildschirm für Bildschirm, Platz für ein Rollenspiel.',
      blocks: () => [
        B('title', { content: 'Die Situation', kicker: 'Einstieg' }),
        B('statement', { content: 'Ein Satz, der die schwierige Situation auf den Punkt bringt.', style: 'dark' }),
        B('text', { content: p('Beschreibe eine typische Szene aus dem Alltag der Lernenden. Wer sagt was, und wo kippt das Gespräch?') }),
        B('title', { content: 'Das Modell', kicker: 'Verstehen' }),
        B('process', { steps: [{ title: 'Zuhören', content: p('Was genau tust du?') }, { title: 'Spiegeln', content: p('Was genau sagst du?') }, { title: 'Klären', content: p('Welche Frage stellst du?') }, { title: 'Lösen', content: p('Welchen Schritt bietest du an?') }] }),
        B('callout', { variant: 'tip', title: 'Rollenspiel', content: p('Füge hier ein Rollenspiel ein: Bausteine → H5P-Einheiten → „Neue H5P-Einheit“ → Rollenspiel. Lernende entscheiden selbst und sehen die Folgen.') }),
        B('title', { content: 'Üben', kicker: 'Anwenden' }),
        B('bucketSort', { prompt: 'Was hilft, was schadet?', buckets: [{ name: 'Hilft', items: ['Ausreden lassen', 'Gefühl benennen'] }, { name: 'Schadet', items: ['Unterbrechen', 'Rechtfertigen'] }] }),
        B('quiz', { question: 'Was tust du zuerst?', options: ['Zuhören', 'Lösung anbieten', 'Regel erklären'], correct: [0], explanation: 'Wer sich gehört fühlt, wird ruhiger.' }),
        B('title', { content: 'Reflexion', kicker: 'Mitnehmen' }),
        B('essay', { prompt: 'Denk an ein Gespräch der letzten Wochen. Was würdest du heute anders machen?', minWords: 30, sample: p('Eine Musterantwort, die zeigt, worauf es ankommt.') }),
        B('checklist', { title: 'Für dein nächstes Gespräch', items: ['Ausreden lassen', 'Gefühl spiegeln', 'Einen konkreten Schritt nennen'] })
      ]
    },
    en: {
      name: 'Conversation skills',
      description: 'Situation, model, practice and reflection. Screen by screen, with room for a role-play.',
      blocks: () => [
        B('title', { content: 'The situation', kicker: 'Start' }),
        B('statement', { content: 'One sentence that sums up the difficult situation.', style: 'dark' }),
        B('text', { content: p('Describe a typical scene from the learners’ daily work. Who says what, and where does the conversation turn?') }),
        B('title', { content: 'The model', kicker: 'Understand' }),
        B('process', { steps: [{ title: 'Listen', content: p('What exactly do you do?') }, { title: 'Mirror', content: p('What exactly do you say?') }, { title: 'Clarify', content: p('Which question do you ask?') }, { title: 'Solve', content: p('Which step do you offer?') }] }),
        B('callout', { variant: 'tip', title: 'Role-play', content: p('Add a role-play here: Blocks library → H5P units → “New H5P unit” → Role-play. Learners decide for themselves and see the consequences.') }),
        B('title', { content: 'Practice', kicker: 'Apply' }),
        B('bucketSort', { prompt: 'What helps, what hurts?', buckets: [{ name: 'Helps', items: ['Let them finish', 'Name the feeling'] }, { name: 'Hurts', items: ['Interrupt', 'Justify yourself'] }] }),
        B('quiz', { question: 'What do you do first?', options: ['Listen', 'Offer a solution', 'Explain the rule'], correct: [0], explanation: 'People who feel heard calm down.' }),
        B('title', { content: 'Reflection', kicker: 'Take away' }),
        B('essay', { prompt: 'Think of a conversation from the last few weeks. What would you do differently today?', minWords: 30, sample: p('A model answer that shows what matters.') }),
        B('checklist', { title: 'For your next conversation', items: ['Let them finish', 'Mirror the feeling', 'Name one concrete step'] })
      ]
    }
  },
  micro: {
    category: 'micro',
    design: { player: 'focus', theme: { preset: 'sunset' } },
    de: {
      name: 'Micro-Learning',
      description: 'Fünf Minuten, ein Gedanke: kurzer Text, Karten zum Umdrehen, eine Frage. Eine Seite.',
      blocks: () => [
        B('title', { content: 'Ein Gedanke in fünf Minuten', kicker: 'Micro-Learning' }),
        B('text', { content: p('Ein einziger Gedanke, in drei bis fünf Sätzen. Keine Einleitung, kein Fazit.') }),
        B('flipcard', { cards: [{ front: 'Begriff', back: 'Erklärung in einem Satz.' }, { front: 'Begriff', back: 'Erklärung in einem Satz.' }, { front: 'Begriff', back: 'Erklärung in einem Satz.' }] }),
        B('quiz', { question: 'Eine Frage zum Gedanken', options: ['Richtig', 'Falsch'], correct: [0], explanation: 'Kurz erklären.' })
      ]
    },
    en: {
      name: 'Micro-learning',
      description: 'Five minutes, one idea: a short text, flip cards, one question. A single page.',
      blocks: () => [
        B('title', { content: 'One idea in five minutes', kicker: 'Micro-learning' }),
        B('text', { content: p('A single idea in three to five sentences. No introduction, no summary.') }),
        B('flipcard', { cards: [{ front: 'Term', back: 'Explanation in one sentence.' }, { front: 'Term', back: 'Explanation in one sentence.' }, { front: 'Term', back: 'Explanation in one sentence.' }] }),
        B('quiz', { question: 'One question about the idea', options: ['Correct', 'Wrong'], correct: [0], explanation: 'Explain briefly.' })
      ]
    }
  }
};

const templateDir = (id) => path.join(config.dataDir, 'templates', id);
const contentLang = (lang) => (String(lang || '').startsWith('de') ? 'de' : 'en');

function outlineOf(blocks) {
  return blocks.filter((b) => b.type === 'title').map((b) => b.data.content);
}

/** Templates visible to the user (built-in, own, shared). `lang` picks the text of built-in ones. */
export function listTemplates(user, lang = 'de') {
  const l = contentLang(lang);
  const builtin = Object.entries(BUILTIN).map(([id, tpl]) => {
    const blocks = tpl[l].blocks();
    const colors = THEME_PRESETS[tpl.design.theme.preset] || {};
    return { id: `builtin:${id}`, builtin: true, category: tpl.category, name: tpl[l].name, description: tpl[l].description, design: { player: tpl.design.player, theme: { preset: tpl.design.theme.preset, ...colors } }, lessons: outlineOf(blocks), blocks: blocks.length };
  });
  const own = db
    .prepare('SELECT * FROM templates WHERE owner_id = ? OR shared = 1 ORDER BY name')
    .all(user.id)
    .map((t) => {
      const blocks = parseJson(t.blocks, []);
      const design = parseJson(t.design, {});
      return { id: t.id, builtin: false, shared: !!t.shared, mine: t.owner_id === user.id, name: t.name, description: t.description, design: { player: design.player, theme: { preset: design.theme?.preset, primary: design.theme?.primary, accent: design.theme?.accent } }, lessons: outlineOf(blocks), blocks: blocks.length, createdAt: t.created_at };
    });
  return [...builtin, ...own];
}

/** Blocks, design and settings to start a course from, plus a media copier for own templates. */
export function resolveTemplate(user, id, lang) {
  if (typeof id !== 'string' || !id) return null;
  if (id.startsWith('builtin:')) {
    const tpl = BUILTIN[id.slice(8)];
    if (!tpl) throw new TemplateError('Vorlage nicht gefunden.', 404);
    const l = contentLang(lang);
    return { blocks: tpl[l].blocks(), design: tpl.design, settings: tpl[l].settings || {}, copyMedia: () => {} };
  }
  const row = db.prepare('SELECT * FROM templates WHERE id = ? AND (owner_id = ? OR shared = 1)').get(id, user.id);
  if (!row) throw new TemplateError('Vorlage nicht gefunden.', 404);
  return {
    blocks: parseJson(row.blocks, []),
    design: parseJson(row.design, {}),
    settings: parseJson(row.settings, {}),
    copyMedia: (courseId) => {
      const src = templateDir(row.id);
      if (!fs.existsSync(src)) return;
      const dst = courseMediaDir(courseId);
      fs.mkdirSync(dst, { recursive: true });
      for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
    }
  };
}

export function saveAsTemplate(user, courseId, { name, description = '', shared = false }, via = 'web') {
  const { course } = assertCourse(user, courseId, 'editor');
  const n = String(name || '').trim().slice(0, 120);
  if (!n) throw new TemplateError('Name der Vorlage fehlt.');
  if (shared && user.role !== 'admin') throw new TemplateError('Nur Admins können Vorlagen für alle freigeben.', 403);
  const blocks = parseJson(course.blocks, [])
    .filter((b) => b.type !== 'h5p')
    .map((b) => {
      const { issues, ...rest } = b;
      return { ...rest, id: newBlockId() };
    });
  if (!blocks.length) throw new TemplateError('Der Kurs hat keine Blöcke, die in eine Vorlage passen.');
  const design = { ...DEFAULT_DESIGN, ...parseJson(course.design, {}) };
  const settings = parseJson(course.settings, {});
  const id = newId('t_');
  const media = referencedMedia(blocks, design);
  const dir = templateDir(id);
  if (media.length) fs.mkdirSync(dir, { recursive: true });
  for (const m of media) {
    const src = mediaPath(courseId, m);
    if (src) fs.copyFileSync(src, path.join(dir, m));
  }
  db.prepare('INSERT INTO templates (id, owner_id, name, description, shared, blocks, design, settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    id,
    user.id,
    n,
    String(description || '').slice(0, 400),
    shared ? 1 : 0,
    JSON.stringify(blocks),
    JSON.stringify(design),
    JSON.stringify({ navigation: settings.navigation, masteryScore: settings.masteryScore, completion: settings.completion })
  );
  audit(user.id, 'template.create', id, { course: courseId, shared: !!shared }, via);
  return listTemplates(user).find((t) => t.id === id);
}

export function deleteTemplate(user, id, via = 'web') {
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
  if (!row || (row.owner_id !== user.id && user.role !== 'admin')) throw new TemplateError('Vorlage nicht gefunden.', 404);
  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  fs.rmSync(templateDir(id), { recursive: true, force: true });
  audit(user.id, 'template.delete', id, null, via);
}

/** Validates all built-in templates (used by the test suite). */
export function checkBuiltinTemplates() {
  const errors = [];
  for (const [id, tpl] of Object.entries(BUILTIN)) {
    for (const l of ['de', 'en']) {
      try {
        normalizeBlocks(tpl[l].blocks());
        normalizeDesign(tpl.design);
      } catch (err) {
        errors.push(`${id}/${l}: ${err.message}`);
      }
    }
  }
  return errors;
}
