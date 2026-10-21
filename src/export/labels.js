/**
 * Learner-facing texts for every built-in course language.
 *  PLAYER   – block-course player (src/export/runtime/player.js + blocks.js)
 *  SHELL    – unit-course shell (src/export/runtime/shell.js)
 *  APPSIM   – default UI texts of H5P.AppSimulation (l10n group + intro kicker)
 *  SCENARIO – default UI texts of H5P.Scenario (l10n group + intro kicker)
 * Placeholders: {name} in PLAYER/SHELL, :name in APPSIM/SCENARIO (H5P convention).
 * Missing keys fall back to English. Custom languages (admin) override on top.
 */

export const PLAYER = {
  de: {
    start: 'Kurs starten', resume: 'Weitermachen', restart: 'Von vorn beginnen', lessons: 'Lektionen', lesson: 'Lektion', lessonOf: 'Lektion {num} von {total}', minutes: 'Dauer',
    prev: 'Zurück', next: 'Weiter', nextLesson: 'Nächste Lektion', prevLesson: 'Vorherige Lektion', finish: 'Kurs abschließen', menu: 'Inhalt', close: 'Schließen',
    progress: '{pct} % erledigt', complete: 'Kurs abgeschlossen', completeText: 'Du hast alle Lektionen bearbeitet.', score: 'Ergebnis', passed: 'Bestanden', failed: 'Noch nicht bestanden',
    exit: 'Kurs verlassen', overview: 'Kursübersicht', whatYouLearn: 'Das erwartet dich', locked: 'Erst die vorherigen Lektionen abschließen', continueLocked: 'Erst die Aufgabe oben bearbeiten',
    home: 'Übersicht', backHome: 'Zur Übersicht', screenOf: '{num} / {total}', check: 'Prüfen', correct: 'Richtig!', incorrect: 'Leider nicht richtig.', result: '{good} von {total} richtig',
    knowledgeCheck: 'Wissensfrage', selectAll: 'Mehrere Antworten möglich', matching: 'Zuordnen', sorting: 'Reihenfolge', fillBlanks: 'Lückentext', bucketSort: 'Sortieren', essay: 'Deine Antwort',
    assessment: 'Abschlusstest', choose: 'Auswählen …', chooseCategory: 'Kategorie für {item}', moveUp: 'Nach oben', moveDown: 'Nach unten', gap: 'Lücke {num}', flip: 'Zum Umdrehen tippen',
    step: 'Schritt {num} von {total}', furtherReading: 'Weiterlesen', download: 'Herunterladen', transcript: 'Transkript', captions: 'Untertitel', enlarge: 'Vergrößern',
    hotspotHint: 'Tippe auf die Punkte im Bild.', words: '{n} Wörter', minWords: 'mindestens {n}', submit: 'Abgeben', submitted: 'Gespeichert.', sampleAnswer: 'Musterlösung ansehen',
    questions: '{n} Fragen', passMark: 'Bestanden ab {n} %', timeLimit: '{n} Minuten Zeit', startTest: 'Test starten', retry: 'Nochmal versuchen', questionOf: 'Frage {num} von {total}',
    confirm: 'Antwort bestätigen', finishTest: 'Test abschließen', reviewAnswers: 'Antworten ansehen', listen: 'Anhören', missingUnit: 'Diese Einheit fehlt.',
    blockError: 'Dieser Block konnte nicht angezeigt werden.', draftBlock: 'Block noch unvollständig', callout_info: 'Hinweis', callout_tip: 'Tipp', callout_warning: 'Achtung',
    callout_success: 'Gut zu wissen', callout_key: 'Merke', lmsWarning: 'Keine Verbindung zur Lernplattform. Dein Fortschritt wird nur in diesem Browser gespeichert.'
  },
  en: {
    start: 'Start course', resume: 'Continue', restart: 'Start over', lessons: 'Lessons', lesson: 'Lesson', lessonOf: 'Lesson {num} of {total}', minutes: 'Duration',
    prev: 'Back', next: 'Next', nextLesson: 'Next lesson', prevLesson: 'Previous lesson', finish: 'Finish course', menu: 'Contents', close: 'Close',
    progress: '{pct}% complete', complete: 'Course complete', completeText: 'You have worked through every lesson.', score: 'Score', passed: 'Passed', failed: 'Not passed yet',
    exit: 'Exit course', overview: 'Course overview', whatYouLearn: 'What you will learn', locked: 'Finish the previous lessons first', continueLocked: 'Complete the activity above first',
    home: 'Overview', backHome: 'Back to overview', screenOf: '{num} / {total}', check: 'Check', correct: 'Correct!', incorrect: 'Not quite.', result: '{good} of {total} correct',
    knowledgeCheck: 'Knowledge check', selectAll: 'Select all that apply', matching: 'Matching', sorting: 'Sorting', fillBlanks: 'Fill in the blanks', bucketSort: 'Sort into groups', essay: 'Your answer',
    assessment: 'Assessment', choose: 'Choose …', chooseCategory: 'Group for {item}', moveUp: 'Move up', moveDown: 'Move down', gap: 'Blank {num}', flip: 'Tap to flip',
    step: 'Step {num} of {total}', furtherReading: 'Further reading', download: 'Download', transcript: 'Transcript', captions: 'Captions', enlarge: 'Enlarge',
    hotspotHint: 'Tap the points on the image.', words: '{n} words', minWords: 'at least {n}', submit: 'Submit', submitted: 'Saved.', sampleAnswer: 'See a model answer',
    questions: '{n} questions', passMark: 'Pass mark {n}%', timeLimit: '{n} minutes', startTest: 'Start test', retry: 'Try again', questionOf: 'Question {num} of {total}',
    confirm: 'Confirm answer', finishTest: 'Finish test', reviewAnswers: 'Review answers', listen: 'Listen', missingUnit: 'This unit is missing.',
    blockError: 'This block could not be shown.', draftBlock: 'Block not finished yet', callout_info: 'Note', callout_tip: 'Tip', callout_warning: 'Caution',
    callout_success: 'Good to know', callout_key: 'Key takeaway', lmsWarning: 'No connection to the learning platform. Progress is only stored in this browser.'
  },
  fr: {
    start: 'Commencer le cours', resume: 'Reprendre', restart: 'Recommencer', lessons: 'Leçons', lesson: 'Leçon', lessonOf: 'Leçon {num} sur {total}', minutes: 'Durée',
    prev: 'Retour', next: 'Suivant', nextLesson: 'Leçon suivante', prevLesson: 'Leçon précédente', finish: 'Terminer le cours', menu: 'Sommaire', close: 'Fermer',
    progress: '{pct} % terminé', complete: 'Cours terminé', completeText: 'Vous avez parcouru toutes les leçons.', score: 'Résultat', passed: 'Réussi', failed: 'Pas encore réussi',
    exit: 'Quitter le cours', overview: 'Aperçu du cours', whatYouLearn: 'Au programme', locked: 'Terminez d’abord les leçons précédentes', continueLocked: 'Faites d’abord l’activité ci-dessus',
    home: 'Aperçu', backHome: 'Retour à l’aperçu', screenOf: '{num} / {total}', check: 'Vérifier', correct: 'Correct !', incorrect: 'Pas tout à fait.', result: '{good} sur {total} corrects',
    knowledgeCheck: 'Question de connaissances', selectAll: 'Plusieurs réponses possibles', matching: 'Associer', sorting: 'Remettre dans l’ordre', fillBlanks: 'Texte à trous', bucketSort: 'Classer', essay: 'Votre réponse',
    assessment: 'Évaluation finale', choose: 'Choisir …', chooseCategory: 'Catégorie pour {item}', moveUp: 'Monter', moveDown: 'Descendre', gap: 'Trou {num}', flip: 'Touchez pour retourner',
    step: 'Étape {num} sur {total}', furtherReading: 'Pour aller plus loin', download: 'Télécharger', transcript: 'Transcription', captions: 'Sous-titres', enlarge: 'Agrandir',
    hotspotHint: 'Touchez les points sur l’image.', words: '{n} mots', minWords: 'au moins {n}', submit: 'Envoyer', submitted: 'Enregistré.', sampleAnswer: 'Voir une réponse modèle',
    questions: '{n} questions', passMark: 'Réussi à partir de {n} %', timeLimit: '{n} minutes', startTest: 'Commencer le test', retry: 'Réessayer', questionOf: 'Question {num} sur {total}',
    confirm: 'Valider la réponse', finishTest: 'Terminer le test', reviewAnswers: 'Voir les réponses', listen: 'Écouter', missingUnit: 'Cette unité est introuvable.',
    blockError: 'Ce bloc n’a pas pu être affiché.', draftBlock: 'Bloc pas encore terminé', callout_info: 'Remarque', callout_tip: 'Astuce', callout_warning: 'Attention',
    callout_success: 'Bon à savoir', callout_key: 'À retenir', lmsWarning: 'Pas de connexion à la plateforme de formation. La progression est enregistrée uniquement dans ce navigateur.'
  },
  it: {
    start: 'Inizia il corso', resume: 'Continua', restart: 'Ricomincia', lessons: 'Lezioni', lesson: 'Lezione', lessonOf: 'Lezione {num} di {total}', minutes: 'Durata',
    prev: 'Indietro', next: 'Avanti', nextLesson: 'Lezione successiva', prevLesson: 'Lezione precedente', finish: 'Concludi il corso', menu: 'Indice', close: 'Chiudi',
    progress: '{pct}% completato', complete: 'Corso completato', completeText: 'Hai svolto tutte le lezioni.', score: 'Risultato', passed: 'Superato', failed: 'Non ancora superato',
    exit: 'Esci dal corso', overview: 'Panoramica del corso', whatYouLearn: 'Cosa ti aspetta', locked: 'Completa prima le lezioni precedenti', continueLocked: 'Completa prima l’attività qui sopra',
    home: 'Panoramica', backHome: 'Torna alla panoramica', screenOf: '{num} / {total}', check: 'Verifica', correct: 'Esatto!', incorrect: 'Non proprio.', result: '{good} su {total} corrette',
    knowledgeCheck: 'Domanda di verifica', selectAll: 'Più risposte possibili', matching: 'Abbinamento', sorting: 'Ordinamento', fillBlanks: 'Completa il testo', bucketSort: 'Classifica', essay: 'La tua risposta',
    assessment: 'Test finale', choose: 'Scegli …', chooseCategory: 'Categoria per {item}', moveUp: 'Sposta su', moveDown: 'Sposta giù', gap: 'Spazio {num}', flip: 'Tocca per girare',
    step: 'Passo {num} di {total}', furtherReading: 'Approfondimenti', download: 'Scarica', transcript: 'Trascrizione', captions: 'Sottotitoli', enlarge: 'Ingrandisci',
    hotspotHint: 'Tocca i punti sull’immagine.', words: '{n} parole', minWords: 'almeno {n}', submit: 'Invia', submitted: 'Salvato.', sampleAnswer: 'Vedi una risposta modello',
    questions: '{n} domande', passMark: 'Superato da {n}%', timeLimit: '{n} minuti', startTest: 'Inizia il test', retry: 'Riprova', questionOf: 'Domanda {num} di {total}',
    confirm: 'Conferma la risposta', finishTest: 'Concludi il test', reviewAnswers: 'Rivedi le risposte', listen: 'Ascolta', missingUnit: 'Questa unità non è disponibile.',
    blockError: 'Questo blocco non può essere visualizzato.', draftBlock: 'Blocco non ancora completo', callout_info: 'Nota', callout_tip: 'Suggerimento', callout_warning: 'Attenzione',
    callout_success: 'Buono a sapersi', callout_key: 'Da ricordare', lmsWarning: 'Nessuna connessione alla piattaforma di apprendimento. I progressi vengono salvati solo in questo browser.'
  },
  es: {
    start: 'Empezar el curso', resume: 'Continuar', restart: 'Empezar de nuevo', lessons: 'Lecciones', lesson: 'Lección', lessonOf: 'Lección {num} de {total}', minutes: 'Duración',
    prev: 'Atrás', next: 'Siguiente', nextLesson: 'Lección siguiente', prevLesson: 'Lección anterior', finish: 'Terminar el curso', menu: 'Contenido', close: 'Cerrar',
    progress: '{pct} % completado', complete: 'Curso completado', completeText: 'Has completado todas las lecciones.', score: 'Resultado', passed: 'Aprobado', failed: 'Aún no aprobado',
    exit: 'Salir del curso', overview: 'Resumen del curso', whatYouLearn: 'Qué vas a aprender', locked: 'Completa primero las lecciones anteriores', continueLocked: 'Completa primero la actividad de arriba',
    home: 'Resumen', backHome: 'Volver al resumen', screenOf: '{num} / {total}', check: 'Comprobar', correct: '¡Correcto!', incorrect: 'No del todo.', result: '{good} de {total} correctas',
    knowledgeCheck: 'Pregunta de comprobación', selectAll: 'Puede haber varias respuestas', matching: 'Relacionar', sorting: 'Ordenar', fillBlanks: 'Completar huecos', bucketSort: 'Clasificar', essay: 'Tu respuesta',
    assessment: 'Evaluación final', choose: 'Elegir …', chooseCategory: 'Categoría para {item}', moveUp: 'Subir', moveDown: 'Bajar', gap: 'Hueco {num}', flip: 'Toca para girar',
    step: 'Paso {num} de {total}', furtherReading: 'Más información', download: 'Descargar', transcript: 'Transcripción', captions: 'Subtítulos', enlarge: 'Ampliar',
    hotspotHint: 'Toca los puntos de la imagen.', words: '{n} palabras', minWords: 'al menos {n}', submit: 'Enviar', submitted: 'Guardado.', sampleAnswer: 'Ver una respuesta modelo',
    questions: '{n} preguntas', passMark: 'Aprobado desde el {n} %', timeLimit: '{n} minutos', startTest: 'Empezar la prueba', retry: 'Intentar de nuevo', questionOf: 'Pregunta {num} de {total}',
    confirm: 'Confirmar respuesta', finishTest: 'Terminar la prueba', reviewAnswers: 'Revisar respuestas', listen: 'Escuchar', missingUnit: 'Falta esta unidad.',
    blockError: 'Este bloque no se ha podido mostrar.', draftBlock: 'Bloque aún incompleto', callout_info: 'Nota', callout_tip: 'Consejo', callout_warning: 'Atención',
    callout_success: 'Bueno saberlo', callout_key: 'Recuerda', lmsWarning: 'Sin conexión con la plataforma de aprendizaje. El progreso solo se guarda en este navegador.'
  },
  pt: {
    start: 'Iniciar o curso', resume: 'Continuar', restart: 'Recomeçar', lessons: 'Lições', lesson: 'Lição', lessonOf: 'Lição {num} de {total}', minutes: 'Duração',
    prev: 'Voltar', next: 'Seguinte', nextLesson: 'Próxima lição', prevLesson: 'Lição anterior', finish: 'Concluir o curso', menu: 'Conteúdo', close: 'Fechar',
    progress: '{pct}% concluído', complete: 'Curso concluído', completeText: 'Concluiu todas as lições.', score: 'Resultado', passed: 'Aprovado', failed: 'Ainda não aprovado',
    exit: 'Sair do curso', overview: 'Visão geral do curso', whatYouLearn: 'O que vai aprender', locked: 'Conclua primeiro as lições anteriores', continueLocked: 'Conclua primeiro a atividade acima',
    home: 'Visão geral', backHome: 'Voltar à visão geral', screenOf: '{num} / {total}', check: 'Verificar', correct: 'Correto!', incorrect: 'Não exatamente.', result: '{good} de {total} corretas',
    knowledgeCheck: 'Pergunta de verificação', selectAll: 'Várias respostas possíveis', matching: 'Associar', sorting: 'Ordenar', fillBlanks: 'Preencher lacunas', bucketSort: 'Classificar', essay: 'A sua resposta',
    assessment: 'Avaliação final', choose: 'Escolher …', chooseCategory: 'Categoria para {item}', moveUp: 'Mover para cima', moveDown: 'Mover para baixo', gap: 'Lacuna {num}', flip: 'Toque para virar',
    step: 'Passo {num} de {total}', furtherReading: 'Para saber mais', download: 'Transferir', transcript: 'Transcrição', captions: 'Legendas', enlarge: 'Ampliar',
    hotspotHint: 'Toque nos pontos da imagem.', words: '{n} palavras', minWords: 'pelo menos {n}', submit: 'Enviar', submitted: 'Guardado.', sampleAnswer: 'Ver uma resposta modelo',
    questions: '{n} perguntas', passMark: 'Aprovado a partir de {n}%', timeLimit: '{n} minutos', startTest: 'Iniciar o teste', retry: 'Tentar novamente', questionOf: 'Pergunta {num} de {total}',
    confirm: 'Confirmar resposta', finishTest: 'Concluir o teste', reviewAnswers: 'Rever respostas', listen: 'Ouvir', missingUnit: 'Esta unidade não está disponível.',
    blockError: 'Não foi possível mostrar este bloco.', draftBlock: 'Bloco ainda incompleto', callout_info: 'Nota', callout_tip: 'Dica', callout_warning: 'Atenção',
    callout_success: 'Bom saber', callout_key: 'A reter', lmsWarning: 'Sem ligação à plataforma de aprendizagem. O progresso só é guardado neste navegador.'
  },
  nl: {
    start: 'Cursus starten', resume: 'Verdergaan', restart: 'Opnieuw beginnen', lessons: 'Lessen', lesson: 'Les', lessonOf: 'Les {num} van {total}', minutes: 'Duur',
    prev: 'Terug', next: 'Volgende', nextLesson: 'Volgende les', prevLesson: 'Vorige les', finish: 'Cursus afronden', menu: 'Inhoud', close: 'Sluiten',
    progress: '{pct}% voltooid', complete: 'Cursus voltooid', completeText: 'Je hebt alle lessen doorgewerkt.', score: 'Resultaat', passed: 'Geslaagd', failed: 'Nog niet geslaagd',
    exit: 'Cursus verlaten', overview: 'Cursusoverzicht', whatYouLearn: 'Wat je leert', locked: 'Rond eerst de vorige lessen af', continueLocked: 'Maak eerst de opdracht hierboven',
    home: 'Overzicht', backHome: 'Terug naar het overzicht', screenOf: '{num} / {total}', check: 'Controleren', correct: 'Goed!', incorrect: 'Niet helemaal.', result: '{good} van {total} goed',
    knowledgeCheck: 'Kennisvraag', selectAll: 'Meerdere antwoorden mogelijk', matching: 'Koppelen', sorting: 'Volgorde', fillBlanks: 'Invultekst', bucketSort: 'Indelen', essay: 'Jouw antwoord',
    assessment: 'Eindtoets', choose: 'Kiezen …', chooseCategory: 'Categorie voor {item}', moveUp: 'Omhoog', moveDown: 'Omlaag', gap: 'Open plek {num}', flip: 'Tik om om te draaien',
    step: 'Stap {num} van {total}', furtherReading: 'Verder lezen', download: 'Downloaden', transcript: 'Transcript', captions: 'Ondertitels', enlarge: 'Vergroten',
    hotspotHint: 'Tik op de punten in de afbeelding.', words: '{n} woorden', minWords: 'minstens {n}', submit: 'Indienen', submitted: 'Opgeslagen.', sampleAnswer: 'Voorbeeldantwoord bekijken',
    questions: '{n} vragen', passMark: 'Geslaagd vanaf {n}%', timeLimit: '{n} minuten', startTest: 'Toets starten', retry: 'Opnieuw proberen', questionOf: 'Vraag {num} van {total}',
    confirm: 'Antwoord bevestigen', finishTest: 'Toets afronden', reviewAnswers: 'Antwoorden bekijken', listen: 'Beluisteren', missingUnit: 'Deze eenheid ontbreekt.',
    blockError: 'Dit blok kon niet worden weergegeven.', draftBlock: 'Blok nog niet af', callout_info: 'Opmerking', callout_tip: 'Tip', callout_warning: 'Let op',
    callout_success: 'Goed om te weten', callout_key: 'Onthoud', lmsWarning: 'Geen verbinding met het leerplatform. Je voortgang wordt alleen in deze browser opgeslagen.'
  },
  pl: {
    start: 'Rozpocznij kurs', resume: 'Kontynuuj', restart: 'Zacznij od nowa', lessons: 'Lekcje', lesson: 'Lekcja', lessonOf: 'Lekcja {num} z {total}', minutes: 'Czas trwania',
    prev: 'Wstecz', next: 'Dalej', nextLesson: 'Następna lekcja', prevLesson: 'Poprzednia lekcja', finish: 'Zakończ kurs', menu: 'Spis treści', close: 'Zamknij',
    progress: 'Ukończono {pct}%', complete: 'Kurs ukończony', completeText: 'Przerobiono wszystkie lekcje.', score: 'Wynik', passed: 'Zaliczone', failed: 'Jeszcze nie zaliczone',
    exit: 'Opuść kurs', overview: 'Przegląd kursu', whatYouLearn: 'Czego się nauczysz', locked: 'Najpierw ukończ poprzednie lekcje', continueLocked: 'Najpierw wykonaj zadanie powyżej',
    home: 'Przegląd', backHome: 'Powrót do przeglądu', screenOf: '{num} / {total}', check: 'Sprawdź', correct: 'Dobrze!', incorrect: 'Nie do końca.', result: 'Poprawne: {good} z {total}',
    knowledgeCheck: 'Pytanie kontrolne', selectAll: 'Możliwych jest kilka odpowiedzi', matching: 'Dopasowanie', sorting: 'Kolejność', fillBlanks: 'Uzupełnij luki', bucketSort: 'Przyporządkuj', essay: 'Twoja odpowiedź',
    assessment: 'Test końcowy', choose: 'Wybierz …', chooseCategory: 'Kategoria dla: {item}', moveUp: 'W górę', moveDown: 'W dół', gap: 'Luka {num}', flip: 'Dotknij, aby odwrócić',
    step: 'Krok {num} z {total}', furtherReading: 'Więcej informacji', download: 'Pobierz', transcript: 'Transkrypcja', captions: 'Napisy', enlarge: 'Powiększ',
    hotspotHint: 'Dotknij punktów na obrazie.', words: 'Słowa: {n}', minWords: 'co najmniej {n}', submit: 'Wyślij', submitted: 'Zapisano.', sampleAnswer: 'Zobacz przykładową odpowiedź',
    questions: 'Pytania: {n}', passMark: 'Zaliczenie od {n}%', timeLimit: 'Czas: {n} min', startTest: 'Rozpocznij test', retry: 'Spróbuj ponownie', questionOf: 'Pytanie {num} z {total}',
    confirm: 'Potwierdź odpowiedź', finishTest: 'Zakończ test', reviewAnswers: 'Przejrzyj odpowiedzi', listen: 'Posłuchaj', missingUnit: 'Brak tej jednostki.',
    blockError: 'Nie udało się wyświetlić tego bloku.', draftBlock: 'Blok jeszcze niegotowy', callout_info: 'Uwaga', callout_tip: 'Wskazówka', callout_warning: 'Ostrożnie',
    callout_success: 'Warto wiedzieć', callout_key: 'Zapamiętaj', lmsWarning: 'Brak połączenia z platformą szkoleniową. Postęp jest zapisywany tylko w tej przeglądarce.'
  },
  cs: {
    start: 'Spustit kurz', resume: 'Pokračovat', restart: 'Začít znovu', lessons: 'Lekce', lesson: 'Lekce', lessonOf: 'Lekce {num} z {total}', minutes: 'Délka',
    prev: 'Zpět', next: 'Další', nextLesson: 'Další lekce', prevLesson: 'Předchozí lekce', finish: 'Dokončit kurz', menu: 'Obsah', close: 'Zavřít',
    progress: 'Hotovo {pct} %', complete: 'Kurz dokončen', completeText: 'Prošli jste všechny lekce.', score: 'Výsledek', passed: 'Splněno', failed: 'Zatím nesplněno',
    exit: 'Opustit kurz', overview: 'Přehled kurzu', whatYouLearn: 'Co se naučíte', locked: 'Nejprve dokončete předchozí lekce', continueLocked: 'Nejprve dokončete úlohu výše',
    home: 'Přehled', backHome: 'Zpět na přehled', screenOf: '{num} / {total}', check: 'Zkontrolovat', correct: 'Správně!', incorrect: 'Ne tak docela.', result: 'Správně {good} z {total}',
    knowledgeCheck: 'Kontrolní otázka', selectAll: 'Možných je více odpovědí', matching: 'Přiřazení', sorting: 'Pořadí', fillBlanks: 'Doplňte mezery', bucketSort: 'Roztřídit', essay: 'Vaše odpověď',
    assessment: 'Závěrečný test', choose: 'Vyberte …', chooseCategory: 'Kategorie pro {item}', moveUp: 'Nahoru', moveDown: 'Dolů', gap: 'Mezera {num}', flip: 'Klepnutím otočte',
    step: 'Krok {num} z {total}', furtherReading: 'Další čtení', download: 'Stáhnout', transcript: 'Přepis', captions: 'Titulky', enlarge: 'Zvětšit',
    hotspotHint: 'Klepněte na body v obrázku.', words: 'Slov: {n}', minWords: 'nejméně {n}', submit: 'Odeslat', submitted: 'Uloženo.', sampleAnswer: 'Zobrazit vzorovou odpověď',
    questions: 'Otázek: {n}', passMark: 'Splněno od {n} %', timeLimit: 'Čas: {n} min', startTest: 'Spustit test', retry: 'Zkusit znovu', questionOf: 'Otázka {num} z {total}',
    confirm: 'Potvrdit odpověď', finishTest: 'Dokončit test', reviewAnswers: 'Zobrazit odpovědi', listen: 'Poslechnout', missingUnit: 'Tato jednotka chybí.',
    blockError: 'Tento blok nelze zobrazit.', draftBlock: 'Blok ještě není hotový', callout_info: 'Poznámka', callout_tip: 'Tip', callout_warning: 'Pozor',
    callout_success: 'Dobré vědět', callout_key: 'Zapamatujte si', lmsWarning: 'Žádné spojení s výukovou platformou. Postup se ukládá jen v tomto prohlížeči.'
  },
  sv: {
    start: 'Starta kursen', resume: 'Fortsätt', restart: 'Börja om', lessons: 'Lektioner', lesson: 'Lektion', lessonOf: 'Lektion {num} av {total}', minutes: 'Längd',
    prev: 'Tillbaka', next: 'Nästa', nextLesson: 'Nästa lektion', prevLesson: 'Föregående lektion', finish: 'Avsluta kursen', menu: 'Innehåll', close: 'Stäng',
    progress: '{pct} % klart', complete: 'Kursen är klar', completeText: 'Du har gått igenom alla lektioner.', score: 'Resultat', passed: 'Godkänd', failed: 'Inte godkänd än',
    exit: 'Lämna kursen', overview: 'Kursöversikt', whatYouLearn: 'Det här lär du dig', locked: 'Gör klart de tidigare lektionerna först', continueLocked: 'Gör uppgiften ovan först',
    home: 'Översikt', backHome: 'Tillbaka till översikten', screenOf: '{num} / {total}', check: 'Kontrollera', correct: 'Rätt!', incorrect: 'Inte riktigt.', result: '{good} av {total} rätt',
    knowledgeCheck: 'Kunskapsfråga', selectAll: 'Flera svar möjliga', matching: 'Para ihop', sorting: 'Ordning', fillBlanks: 'Lucktext', bucketSort: 'Sortera', essay: 'Ditt svar',
    assessment: 'Sluttest', choose: 'Välj …', chooseCategory: 'Kategori för {item}', moveUp: 'Flytta upp', moveDown: 'Flytta ned', gap: 'Lucka {num}', flip: 'Tryck för att vända',
    step: 'Steg {num} av {total}', furtherReading: 'Läs mer', download: 'Ladda ned', transcript: 'Transkription', captions: 'Undertexter', enlarge: 'Förstora',
    hotspotHint: 'Tryck på punkterna i bilden.', words: '{n} ord', minWords: 'minst {n}', submit: 'Skicka in', submitted: 'Sparat.', sampleAnswer: 'Visa ett exempelsvar',
    questions: '{n} frågor', passMark: 'Godkänd från {n} %', timeLimit: '{n} minuter', startTest: 'Starta testet', retry: 'Försök igen', questionOf: 'Fråga {num} av {total}',
    confirm: 'Bekräfta svaret', finishTest: 'Avsluta testet', reviewAnswers: 'Visa svaren', listen: 'Lyssna', missingUnit: 'Den här enheten saknas.',
    blockError: 'Det här blocket kunde inte visas.', draftBlock: 'Blocket är inte klart än', callout_info: 'Obs', callout_tip: 'Tips', callout_warning: 'Varning',
    callout_success: 'Bra att veta', callout_key: 'Kom ihåg', lmsWarning: 'Ingen anslutning till lärplattformen. Dina framsteg sparas bara i den här webbläsaren.'
  },
  tr: {
    start: 'Kursu başlat', resume: 'Devam et', restart: 'Baştan başla', lessons: 'Dersler', lesson: 'Ders', lessonOf: 'Ders {num} / {total}', minutes: 'Süre',
    prev: 'Geri', next: 'İleri', nextLesson: 'Sonraki ders', prevLesson: 'Önceki ders', finish: 'Kursu bitir', menu: 'İçerik', close: 'Kapat',
    progress: '%{pct} tamamlandı', complete: 'Kurs tamamlandı', completeText: 'Tüm dersleri tamamladınız.', score: 'Sonuç', passed: 'Başarılı', failed: 'Henüz başarılı değil',
    exit: 'Kurstan çık', overview: 'Kursa genel bakış', whatYouLearn: 'Neler öğreneceksiniz', locked: 'Önce önceki dersleri tamamlayın', continueLocked: 'Önce yukarıdaki etkinliği tamamlayın',
    home: 'Genel bakış', backHome: 'Genel bakışa dön', screenOf: '{num} / {total}', check: 'Kontrol et', correct: 'Doğru!', incorrect: 'Tam olarak değil.', result: '{total} sorudan {good} doğru',
    knowledgeCheck: 'Bilgi sorusu', selectAll: 'Birden fazla cevap mümkün', matching: 'Eşleştirme', sorting: 'Sıralama', fillBlanks: 'Boşluk doldurma', bucketSort: 'Gruplara ayır', essay: 'Cevabınız',
    assessment: 'Final testi', choose: 'Seçin …', chooseCategory: '{item} için kategori', moveUp: 'Yukarı taşı', moveDown: 'Aşağı taşı', gap: 'Boşluk {num}', flip: 'Çevirmek için dokunun',
    step: 'Adım {num} / {total}', furtherReading: 'Daha fazla bilgi', download: 'İndir', transcript: 'Döküm', captions: 'Altyazılar', enlarge: 'Büyüt',
    hotspotHint: 'Görseldeki noktalara dokunun.', words: '{n} kelime', minWords: 'en az {n}', submit: 'Gönder', submitted: 'Kaydedildi.', sampleAnswer: 'Örnek cevabı göster',
    questions: '{n} soru', passMark: '%{n} ile geçer', timeLimit: '{n} dakika', startTest: 'Testi başlat', retry: 'Tekrar dene', questionOf: 'Soru {num} / {total}',
    confirm: 'Cevabı onayla', finishTest: 'Testi bitir', reviewAnswers: 'Cevapları gör', listen: 'Dinle', missingUnit: 'Bu ünite bulunamadı.',
    blockError: 'Bu blok görüntülenemedi.', draftBlock: 'Blok henüz tamamlanmadı', callout_info: 'Not', callout_tip: 'İpucu', callout_warning: 'Dikkat',
    callout_success: 'Bilmekte fayda var', callout_key: 'Unutmayın', lmsWarning: 'Öğrenme platformuna bağlantı yok. İlerlemeniz yalnızca bu tarayıcıda kaydediliyor.'
  },
  ar: {
    start: 'ابدأ الدورة', resume: 'تابع', restart: 'ابدأ من جديد', lessons: 'الدروس', lesson: 'الدرس', lessonOf: 'الدرس {num} من {total}', minutes: 'المدة',
    prev: 'السابق', next: 'التالي', nextLesson: 'الدرس التالي', prevLesson: 'الدرس السابق', finish: 'إنهاء الدورة', menu: 'المحتوى', close: 'إغلاق',
    progress: 'اكتمل {pct}٪', complete: 'اكتملت الدورة', completeText: 'لقد أنهيت جميع الدروس.', score: 'النتيجة', passed: 'ناجح', failed: 'لم تنجح بعد',
    exit: 'الخروج من الدورة', overview: 'نظرة عامة على الدورة', whatYouLearn: 'ما ستتعلمه', locked: 'أكمل الدروس السابقة أولًا', continueLocked: 'أكمل النشاط أعلاه أولًا',
    home: 'نظرة عامة', backHome: 'العودة إلى النظرة العامة', screenOf: '{num} / {total}', check: 'تحقق', correct: 'صحيح!', incorrect: 'ليس تمامًا.', result: '{good} من {total} صحيحة',
    knowledgeCheck: 'سؤال معرفي', selectAll: 'يمكن اختيار أكثر من إجابة', matching: 'المطابقة', sorting: 'الترتيب', fillBlanks: 'املأ الفراغات', bucketSort: 'التصنيف', essay: 'إجابتك',
    assessment: 'الاختبار النهائي', choose: 'اختر …', chooseCategory: 'فئة {item}', moveUp: 'نقل لأعلى', moveDown: 'نقل لأسفل', gap: 'الفراغ {num}', flip: 'انقر للقلب',
    step: 'الخطوة {num} من {total}', furtherReading: 'قراءات إضافية', download: 'تنزيل', transcript: 'النص المكتوب', captions: 'الترجمة', enlarge: 'تكبير',
    hotspotHint: 'انقر على النقاط في الصورة.', words: '{n} كلمة', minWords: '{n} على الأقل', submit: 'إرسال', submitted: 'تم الحفظ.', sampleAnswer: 'عرض إجابة نموذجية',
    questions: '{n} أسئلة', passMark: 'النجاح من {n}٪', timeLimit: '{n} دقيقة', startTest: 'ابدأ الاختبار', retry: 'حاول مرة أخرى', questionOf: 'السؤال {num} من {total}',
    confirm: 'تأكيد الإجابة', finishTest: 'إنهاء الاختبار', reviewAnswers: 'مراجعة الإجابات', listen: 'استمع', missingUnit: 'هذه الوحدة غير موجودة.',
    blockError: 'تعذر عرض هذا العنصر.', draftBlock: 'العنصر غير مكتمل بعد', callout_info: 'ملاحظة', callout_tip: 'نصيحة', callout_warning: 'تنبيه',
    callout_success: 'معلومة مفيدة', callout_key: 'تذكّر', lmsWarning: 'لا يوجد اتصال بمنصة التعلم. يتم حفظ تقدمك في هذا المتصفح فقط.'
  }
};

export const SHELL = {
  de: { progress: '{done} von {total} erledigt', score: 'Ergebnis: {score} %', prev: 'Zurück', next: 'Weiter', menu: 'Inhalt', lmsWarning: 'Die Verbindung zur Lernplattform konnte nicht hergestellt werden. Dein Fortschritt wird nur in diesem Browser gespeichert.' },
  en: { progress: '{done} of {total} done', score: 'Score: {score} %', prev: 'Back', next: 'Next', menu: 'Contents', lmsWarning: 'Could not connect to the learning platform. Progress is only stored in this browser.' },
  fr: { progress: '{done} sur {total} terminés', score: 'Résultat : {score} %', prev: 'Retour', next: 'Suivant', menu: 'Sommaire', lmsWarning: 'Connexion à la plateforme impossible. La progression est enregistrée uniquement dans ce navigateur.' },
  it: { progress: '{done} di {total} completati', score: 'Risultato: {score} %', prev: 'Indietro', next: 'Avanti', menu: 'Indice', lmsWarning: 'Impossibile connettersi alla piattaforma di apprendimento. I progressi vengono salvati solo in questo browser.' },
  es: { progress: '{done} de {total} completados', score: 'Resultado: {score} %', prev: 'Atrás', next: 'Siguiente', menu: 'Contenido', lmsWarning: 'No se pudo conectar con la plataforma de aprendizaje. El progreso solo se guarda en este navegador.' },
  pt: { progress: '{done} de {total} concluídos', score: 'Resultado: {score}%', prev: 'Voltar', next: 'Seguinte', menu: 'Conteúdo', lmsWarning: 'Não foi possível ligar à plataforma de aprendizagem. O progresso só é guardado neste navegador.' },
  nl: { progress: '{done} van {total} klaar', score: 'Resultaat: {score}%', prev: 'Terug', next: 'Volgende', menu: 'Inhoud', lmsWarning: 'Geen verbinding met het leerplatform. Je voortgang wordt alleen in deze browser opgeslagen.' },
  pl: { progress: 'Ukończono {done} z {total}', score: 'Wynik: {score}%', prev: 'Wstecz', next: 'Dalej', menu: 'Spis treści', lmsWarning: 'Brak połączenia z platformą szkoleniową. Postęp jest zapisywany tylko w tej przeglądarce.' },
  cs: { progress: 'Hotovo {done} z {total}', score: 'Výsledek: {score} %', prev: 'Zpět', next: 'Další', menu: 'Obsah', lmsWarning: 'Nepodařilo se připojit k výukové platformě. Postup se ukládá jen v tomto prohlížeči.' },
  sv: { progress: '{done} av {total} klara', score: 'Resultat: {score} %', prev: 'Tillbaka', next: 'Nästa', menu: 'Innehåll', lmsWarning: 'Ingen anslutning till lärplattformen. Dina framsteg sparas bara i den här webbläsaren.' },
  tr: { progress: '{total} üniteden {done} tamamlandı', score: 'Sonuç: %{score}', prev: 'Geri', next: 'İleri', menu: 'İçerik', lmsWarning: 'Öğrenme platformuna bağlanılamadı. İlerlemeniz yalnızca bu tarayıcıda kaydediliyor.' },
  ar: { progress: 'اكتمل {done} من {total}', score: 'النتيجة: {score}٪', prev: 'السابق', next: 'التالي', menu: 'المحتوى', lmsWarning: 'تعذر الاتصال بمنصة التعلم. يتم حفظ تقدمك في هذا المتصفح فقط.' }
};

/** Default UI texts of H5P.AppSimulation per language (only languages without a hand-made language file). */
export const APPSIM = {
  es: { kicker: 'Formación', start: 'Empezar', resume: 'Continuar donde lo dejaste', watch: 'Ver el vídeo', toPractice: 'Ahora practícalo', next: 'Siguiente', back: 'Atrás', doIt: 'Toca el lugar correcto de la pantalla.', explore: 'Señala o toca las zonas marcadas para saber más.', miss: 'No del todo. Inténtalo de nuevo.', hint: 'Aquí está: toca la zona resaltada.', good: 'Correcto.', showMe: 'Muéstrame este paso', chapter: 'Capítulo :num de :total', step: 'Paso :num de :total', doneTitle: '¡Bien hecho!', doneText: 'Has completado esta formación. Encontrarás más formaciones en tu plataforma de aprendizaje.', score: 'Resuelto al primer intento: :score de :total', again: 'Empezar de nuevo', screenLabel: 'Pantalla de la aplicación' },
  pt: { kicker: 'Formação', start: 'Iniciar', resume: 'Continuar de onde parou', watch: 'Ver o vídeo', toPractice: 'Agora pratique', next: 'Seguinte', back: 'Voltar', doIt: 'Toque no sítio certo do ecrã.', explore: 'Aponte ou toque nas áreas marcadas para saber mais.', miss: 'Não exatamente. Tente outra vez.', hint: 'Está aqui: toque na área destacada.', good: 'Correto.', showMe: 'Mostrar este passo', chapter: 'Capítulo :num de :total', step: 'Passo :num de :total', doneTitle: 'Muito bem!', doneText: 'Concluiu esta formação. Encontra mais formações na sua plataforma de aprendizagem.', score: 'Resolvido à primeira: :score de :total', again: 'Recomeçar', screenLabel: 'Ecrã da aplicação' },
  nl: { kicker: 'Training', start: 'Starten', resume: 'Verdergaan waar je was', watch: 'Video bekijken', toPractice: 'Nu zelf oefenen', next: 'Volgende', back: 'Terug', doIt: 'Tik op de juiste plek op het scherm.', explore: 'Wijs of tik op de gemarkeerde gebieden voor meer informatie.', miss: 'Niet helemaal. Probeer het nog eens.', hint: 'Hier is het: tik op de gemarkeerde plek.', good: 'Goed.', showMe: 'Laat deze stap zien', chapter: 'Hoofdstuk :num van :total', step: 'Stap :num van :total', doneTitle: 'Goed gedaan!', doneText: 'Je hebt deze training afgerond. Meer trainingen vind je op je leerplatform.', score: 'In één keer goed: :score van :total', again: 'Opnieuw beginnen', screenLabel: 'App-scherm' },
  pl: { kicker: 'Szkolenie', start: 'Start', resume: 'Kontynuuj od miejsca przerwania', watch: 'Obejrzyj film', toPractice: 'Teraz przećwicz', next: 'Dalej', back: 'Wstecz', doIt: 'Dotknij właściwego miejsca na ekranie.', explore: 'Wskaż lub dotknij zaznaczonych obszarów, aby dowiedzieć się więcej.', miss: 'Nie do końca. Spróbuj ponownie.', hint: 'Tutaj: dotknij podświetlonego miejsca.', good: 'Dobrze.', showMe: 'Pokaż ten krok', chapter: 'Rozdział :num z :total', step: 'Krok :num z :total', doneTitle: 'Świetnie!', doneText: 'Szkolenie zostało ukończone. Więcej szkoleń znajdziesz na swojej platformie szkoleniowej.', score: 'Za pierwszym razem: :score z :total', again: 'Zacznij od nowa', screenLabel: 'Ekran aplikacji' },
  cs: { kicker: 'Školení', start: 'Začít', resume: 'Pokračovat, kde jste skončili', watch: 'Přehrát video', toPractice: 'Teď si to vyzkoušejte', next: 'Další', back: 'Zpět', doIt: 'Klepněte na správné místo na obrazovce.', explore: 'Ukažte nebo klepněte na označené oblasti a dozvíte se víc.', miss: 'Ne tak docela. Zkuste to znovu.', hint: 'Tady to je: klepněte na zvýrazněné místo.', good: 'Správně.', showMe: 'Ukázat tento krok', chapter: 'Kapitola :num z :total', step: 'Krok :num z :total', doneTitle: 'Výborně!', doneText: 'Toto školení jste dokončili. Další školení najdete na své výukové platformě.', score: 'Napoprvé vyřešeno: :score z :total', again: 'Začít znovu', screenLabel: 'Obrazovka aplikace' },
  sv: { kicker: 'Utbildning', start: 'Starta', resume: 'Fortsätt där du slutade', watch: 'Titta på videon', toPractice: 'Öva nu själv', next: 'Nästa', back: 'Tillbaka', doIt: 'Tryck på rätt ställe på skärmen.', explore: 'Peka eller tryck på de markerade områdena för att läsa mer.', miss: 'Inte riktigt. Försök igen.', hint: 'Här är det: tryck på det markerade stället.', good: 'Rätt.', showMe: 'Visa det här steget', chapter: 'Kapitel :num av :total', step: 'Steg :num av :total', doneTitle: 'Bra jobbat!', doneText: 'Du har slutfört den här utbildningen. Fler utbildningar finns på din lärplattform.', score: 'Rätt på första försöket: :score av :total', again: 'Börja om', screenLabel: 'Appskärm' },
  tr: { kicker: 'Eğitim', start: 'Başla', resume: 'Kaldığın yerden devam et', watch: 'Videoyu izle', toPractice: 'Şimdi uygula', next: 'İleri', back: 'Geri', doIt: 'Ekranda doğru yere dokunun.', explore: 'Daha fazla bilgi için işaretli alanlara dokunun.', miss: 'Tam olarak değil. Tekrar deneyin.', hint: 'Burada: vurgulanan yere dokunun.', good: 'Doğru.', showMe: 'Bu adımı göster', chapter: 'Bölüm :num / :total', step: 'Adım :num / :total', doneTitle: 'Tebrikler!', doneText: 'Bu eğitimi tamamladınız. Diğer eğitimleri öğrenme platformunuzda bulabilirsiniz.', score: 'İlk denemede çözülen: :score / :total', again: 'Baştan başla', screenLabel: 'Uygulama ekranı' },
  ar: { kicker: 'تدريب', start: 'ابدأ', resume: 'تابع من حيث توقفت', watch: 'شاهد الفيديو', toPractice: 'تدرّب الآن', next: 'التالي', back: 'السابق', doIt: 'انقر على المكان الصحيح في الشاشة.', explore: 'أشر إلى المناطق المحددة أو انقر عليها لمعرفة المزيد.', miss: 'ليس تمامًا. حاول مرة أخرى.', hint: 'هنا: انقر على المنطقة المميزة.', good: 'صحيح.', showMe: 'أرني هذه الخطوة', chapter: 'الفصل :num من :total', step: 'الخطوة :num من :total', doneTitle: 'أحسنت!', doneText: 'لقد أكملت هذا التدريب. ستجد المزيد من التدريبات في منصة التعلم الخاصة بك.', score: 'حُلّت من المحاولة الأولى: :score من :total', again: 'ابدأ من جديد', screenLabel: 'شاشة التطبيق' }
};

/** Default UI texts of H5P.Scenario per language (only languages without a hand-made language file). */
export const SCENARIO = {
  es: { kicker: 'Juego de rol', start: 'Empezar', resume: 'Continuar donde lo dejaste', narration: 'Narración', play: 'Reproducir narración', pause: 'Pausar narración', next: 'Continuar', choose: '¿Qué haces?', decision: 'Decisión :num', endingGood: 'Muy buen resultado', endingMixed: 'Se puede mejorar', endingBad: 'Esto salió mal', score: 'Puntuación: :score de :max', passed: 'Aprobado', failed: 'Aún no aprobado', again: 'Intentar de nuevo', recap: 'Tus decisiones', back: 'Atrás' },
  pt: { kicker: 'Role-play', start: 'Iniciar', resume: 'Continuar de onde parou', narration: 'Narração', play: 'Reproduzir narração', pause: 'Pausar narração', next: 'Continuar', choose: 'O que faz?', decision: 'Decisão :num', endingGood: 'Ótimo resultado', endingMixed: 'Há margem para melhorar', endingBad: 'Correu mal', score: 'Pontuação: :score de :max', passed: 'Aprovado', failed: 'Ainda não aprovado', again: 'Tentar novamente', recap: 'As suas decisões', back: 'Voltar' },
  nl: { kicker: 'Rollenspel', start: 'Starten', resume: 'Verdergaan waar je was', narration: 'Voorlezen', play: 'Voorlezen starten', pause: 'Voorlezen pauzeren', next: 'Verder', choose: 'Wat doe je?', decision: 'Beslissing :num', endingGood: 'Sterk resultaat', endingMixed: 'Kan beter', endingBad: 'Dat ging mis', score: 'Score: :score van :max', passed: 'Geslaagd', failed: 'Nog niet geslaagd', again: 'Opnieuw proberen', recap: 'Jouw beslissingen', back: 'Terug' },
  pl: { kicker: 'Odgrywanie ról', start: 'Start', resume: 'Kontynuuj od miejsca przerwania', narration: 'Narracja', play: 'Odtwórz narrację', pause: 'Wstrzymaj narrację', next: 'Dalej', choose: 'Co robisz?', decision: 'Decyzja :num', endingGood: 'Świetny wynik', endingMixed: 'Jest co poprawić', endingBad: 'Nie poszło dobrze', score: 'Wynik: :score z :max', passed: 'Zaliczone', failed: 'Jeszcze nie zaliczone', again: 'Spróbuj ponownie', recap: 'Twoje decyzje', back: 'Wstecz' },
  cs: { kicker: 'Hraní rolí', start: 'Začít', resume: 'Pokračovat, kde jste skončili', narration: 'Komentář', play: 'Přehrát komentář', pause: 'Pozastavit komentář', next: 'Pokračovat', choose: 'Co uděláte?', decision: 'Rozhodnutí :num', endingGood: 'Skvělý výsledek', endingMixed: 'Je co zlepšovat', endingBad: 'Tohle se nepovedlo', score: 'Skóre: :score z :max', passed: 'Splněno', failed: 'Zatím nesplněno', again: 'Zkusit znovu', recap: 'Vaše rozhodnutí', back: 'Zpět' },
  sv: { kicker: 'Rollspel', start: 'Starta', resume: 'Fortsätt där du slutade', narration: 'Uppläsning', play: 'Spela uppläsning', pause: 'Pausa uppläsning', next: 'Fortsätt', choose: 'Vad gör du?', decision: 'Beslut :num', endingGood: 'Starkt resultat', endingMixed: 'Det finns mer att hämta', endingBad: 'Det gick snett', score: 'Poäng: :score av :max', passed: 'Godkänd', failed: 'Inte godkänd än', again: 'Försök igen', recap: 'Dina beslut', back: 'Tillbaka' },
  tr: { kicker: 'Rol oyunu', start: 'Başla', resume: 'Kaldığın yerden devam et', narration: 'Anlatım', play: 'Anlatımı oynat', pause: 'Anlatımı duraklat', next: 'Devam', choose: 'Ne yaparsınız?', decision: 'Karar :num', endingGood: 'Güçlü sonuç', endingMixed: 'Geliştirilebilir', endingBad: 'Bu iyi gitmedi', score: 'Puan: :score / :max', passed: 'Başarılı', failed: 'Henüz başarılı değil', again: 'Tekrar dene', recap: 'Kararlarınız', back: 'Geri' },
  ar: { kicker: 'لعب الأدوار', start: 'ابدأ', resume: 'تابع من حيث توقفت', narration: 'السرد الصوتي', play: 'تشغيل السرد', pause: 'إيقاف السرد مؤقتًا', next: 'متابعة', choose: 'ماذا ستفعل؟', decision: 'القرار :num', endingGood: 'نتيجة قوية', endingMixed: 'يمكن التحسين', endingBad: 'لم تسر الأمور جيدًا', score: 'النقاط: :score من :max', passed: 'ناجح', failed: 'لم تنجح بعد', again: 'حاول مرة أخرى', recap: 'قراراتك', back: 'السابق' }
};
