/*
 * Plietschpaket block course player. One SCO; talks to the LMS (SCORM 1.2 / 2004) or, without an LMS, keeps
 * progress in localStorage. Layouts ("designs"): studio, classic, focus, stage, lesson, magazine, journey, hub.
 *
 * Lessons start at "title" blocks. A lesson counts as done once opened (paged designs), scrolled through (focus,
 * magazine) or fully revealed (lesson, stage). Graded blocks and scored H5P units make up the score: every
 * graded item weighs the same; items never answered count 0.
 *
 * window.PP_COURSE = { title, description, language, design, blocks, units, settings, labels, scormVersion,
 *                      packageUuid, mediaBase, preview }
 */
(function () {
  'use strict';
  var C = window.PP_COURSE;
  var B = window.PPBlocks;
  var D = C.design || {};
  var V = C.scormVersion === '2004' ? '2004' : '1.2';
  var LIMIT = V === '2004' ? 64000 : 4096;
  var startedAt = Date.now();
  var unitWindows = {};
  var finished = false;
  var doc = document;

  // ------------------------------------------------------------------ labels
  var LABELS = {
    de: { start: 'Kurs starten', resume: 'Weitermachen', restart: 'Von vorn beginnen', lessons: 'Lektionen', lesson: 'Lektion', lessonOf: 'Lektion {num} von {total}', minutes: 'Dauer', prev: 'Zurück', next: 'Weiter', nextLesson: 'Nächste Lektion', prevLesson: 'Vorherige Lektion', finish: 'Kurs abschließen', menu: 'Inhalt', close: 'Schließen', progress: '{pct} % erledigt', complete: 'Kurs abgeschlossen', completeText: 'Du hast alle Lektionen bearbeitet.', score: 'Ergebnis', passed: 'Bestanden', failed: 'Noch nicht bestanden', exit: 'Kurs verlassen', overview: 'Kursübersicht', whatYouLearn: 'Das erwartet dich', locked: 'Erst die vorherigen Lektionen abschließen', continueLocked: 'Erst die Aufgabe oben bearbeiten', home: 'Übersicht', backHome: 'Zur Übersicht', screenOf: '{num} / {total}', check: 'Prüfen', correct: 'Richtig!', incorrect: 'Leider nicht richtig.', result: '{good} von {total} richtig', knowledgeCheck: 'Wissensfrage', selectAll: 'Mehrere Antworten möglich', matching: 'Zuordnen', sorting: 'Reihenfolge', fillBlanks: 'Lückentext', bucketSort: 'Sortieren', essay: 'Deine Antwort', assessment: 'Abschlusstest', choose: 'Auswählen …', chooseCategory: 'Kategorie für {item}', moveUp: 'Nach oben', moveDown: 'Nach unten', gap: 'Lücke {num}', flip: 'Zum Umdrehen tippen', step: 'Schritt {num} von {total}', furtherReading: 'Weiterlesen', download: 'Herunterladen', transcript: 'Transkript', captions: 'Untertitel', enlarge: 'Vergrößern', hotspotHint: 'Tippe auf die Punkte im Bild.', words: '{n} Wörter', minWords: 'mindestens {n}', submit: 'Abgeben', submitted: 'Gespeichert.', sampleAnswer: 'Musterlösung ansehen', questions: '{n} Fragen', passMark: 'Bestanden ab {n} %', timeLimit: '{n} Minuten Zeit', startTest: 'Test starten', retry: 'Nochmal versuchen', questionOf: 'Frage {num} von {total}', confirm: 'Antwort bestätigen', finishTest: 'Test abschließen', reviewAnswers: 'Antworten ansehen', listen: 'Anhören', missingUnit: 'Diese Einheit fehlt.', blockError: 'Dieser Block konnte nicht angezeigt werden.', draftBlock: 'Block noch unvollständig', callout_info: 'Hinweis', callout_tip: 'Tipp', callout_warning: 'Achtung', callout_success: 'Gut zu wissen', callout_key: 'Merke', lmsWarning: 'Keine Verbindung zur Lernplattform. Dein Fortschritt wird nur in diesem Browser gespeichert.' },
    en: { start: 'Start course', resume: 'Continue', restart: 'Start over', lessons: 'Lessons', lesson: 'Lesson', lessonOf: 'Lesson {num} of {total}', minutes: 'Duration', prev: 'Back', next: 'Next', nextLesson: 'Next lesson', prevLesson: 'Previous lesson', finish: 'Finish course', menu: 'Contents', close: 'Close', progress: '{pct}% complete', complete: 'Course complete', completeText: 'You have worked through every lesson.', score: 'Score', passed: 'Passed', failed: 'Not passed yet', exit: 'Exit course', overview: 'Course overview', whatYouLearn: 'What you will learn', locked: 'Finish the previous lessons first', continueLocked: 'Complete the activity above first', home: 'Overview', backHome: 'Back to overview', screenOf: '{num} / {total}', check: 'Check', correct: 'Correct!', incorrect: 'Not quite.', result: '{good} of {total} correct', knowledgeCheck: 'Knowledge check', selectAll: 'Select all that apply', matching: 'Matching', sorting: 'Sorting', fillBlanks: 'Fill in the blanks', bucketSort: 'Sort into groups', essay: 'Your answer', assessment: 'Assessment', choose: 'Choose …', chooseCategory: 'Group for {item}', moveUp: 'Move up', moveDown: 'Move down', gap: 'Blank {num}', flip: 'Tap to flip', step: 'Step {num} of {total}', furtherReading: 'Further reading', download: 'Download', transcript: 'Transcript', captions: 'Captions', enlarge: 'Enlarge', hotspotHint: 'Tap the points on the image.', words: '{n} words', minWords: 'at least {n}', submit: 'Submit', submitted: 'Saved.', sampleAnswer: 'See a model answer', questions: '{n} questions', passMark: 'Pass mark {n}%', timeLimit: '{n} minutes', startTest: 'Start test', retry: 'Try again', questionOf: 'Question {num} of {total}', confirm: 'Confirm answer', finishTest: 'Finish test', reviewAnswers: 'Review answers', listen: 'Listen', missingUnit: 'This unit is missing.', blockError: 'This block could not be shown.', draftBlock: 'Block not finished yet', callout_info: 'Note', callout_tip: 'Tip', callout_warning: 'Caution', callout_success: 'Good to know', callout_key: 'Key takeaway', lmsWarning: 'No connection to the learning platform. Progress is only stored in this browser.' }
  };
  var lang = String(C.language || 'de').slice(0, 2);
  var L = Object.assign({}, LABELS.en, LABELS[lang] || {}, C.labels || {}, D.labels || {});
  function label(key, vars) {
    var s = L[key] !== undefined ? L[key] : key;
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  // ------------------------------------------------------------------ LMS
  function scan(win, name) {
    var hops = 0;
    while (win && hops < 12) {
      try {
        if (win[name]) return win[name];
      } catch (e) {
        /* cross-origin */
      }
      if (!win.parent || win.parent === win) break;
      win = win.parent;
      hops += 1;
    }
    return null;
  }
  var apiName = V === '2004' ? 'API_1484_11' : 'API';
  var api = C.preview ? null : scan(window, apiName) || (window.opener ? scan(window.opener, apiName) : null);
  var lms = {
    connected: false,
    init: function () {
      if (!api) return false;
      this.connected = String(V === '2004' ? api.Initialize('') : api.LMSInitialize('')) === 'true';
      return this.connected;
    },
    get: function (k) {
      if (!this.connected) return '';
      var v = V === '2004' ? api.GetValue(k) : api.LMSGetValue(k);
      return v === null || v === undefined ? '' : String(v);
    },
    set: function (k, v) {
      if (!this.connected) return false;
      return String(V === '2004' ? api.SetValue(k, String(v)) : api.LMSSetValue(k, String(v))) === 'true';
    },
    commit: function () {
      if (this.connected) return String(V === '2004' ? api.Commit('') : api.LMSCommit('')) === 'true';
    },
    finish: function () {
      if (!this.connected) return;
      if (V === '2004') api.Terminate('');
      else api.LMSFinish('');
      this.connected = false;
    }
  };
  var storageKey = 'plietschpaket:' + C.packageUuid;
  var local = {
    read: function () {
      try {
        return C.preview ? '' : window.localStorage.getItem(storageKey) || '';
      } catch (e) {
        return '';
      }
    },
    write: function (v) {
      try {
        if (!C.preview) window.localStorage.setItem(storageKey, v);
      } catch (e) {
        /* private mode */
      }
    }
  };

  // ------------------------------------------------------------------ model
  var lessons = [];
  C.blocks.forEach(function (b) {
    if (b.type === 'title' || !lessons.length) lessons.push({ title: b.type === 'title' ? b.data.content : C.title, image: b.type === 'title' ? b.data.image : null, blocks: [] });
    lessons[lessons.length - 1].blocks.push(b);
  });
  if (!lessons.length) lessons.push({ title: C.title, blocks: [] });
  lessons.forEach(function (l, i) {
    l.index = i;
    // screens for stage / lesson designs: split at dividers and after graded blocks
    l.screens = [[]];
    l.blocks.forEach(function (b, k) {
      var cur = l.screens[l.screens.length - 1];
      if (b.type === 'divider' && cur.length) {
        l.screens.push([]);
        return;
      }
      cur.push(b);
      var gradedHere = B.graded[b.type] || (b.type === 'h5p' && C.units[b.data.unitId] && C.units[b.data.unitId].scored);
      if (gradedHere && k < l.blocks.length - 1) l.screens.push([]);
    });
    l.screens = l.screens.filter(function (s) {
      return s.length;
    });
    if (!l.screens.length) l.screens = [[]];
  });
  var gradedItems = [];
  C.blocks.forEach(function (b) {
    if (B.graded[b.type]) gradedItems.push({ kind: 'block', id: b.id });
    if (b.type === 'h5p' && C.units[b.data.unitId] && C.units[b.data.unitId].scored) gradedItems.push({ kind: 'unit', id: b.data.unitId });
  });

  var state = { v: 2, les: {}, scr: {}, b: {}, u: {}, cur: -1, started: 0 };
  lms.init();
  var raw = lms.connected ? lms.get('cmi.suspend_data') : local.read();
  if (raw) {
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.v === 2) state = Object.assign(state, parsed);
    } catch (e) {
      /* corrupt – start fresh */
    }
  }
  if (lms.connected) {
    if (V === '1.2') {
      var st = lms.get('cmi.core.lesson_status');
      if (!st || st === 'not attempted') lms.set('cmi.core.lesson_status', 'incomplete');
      lms.set('cmi.core.score.min', '0');
      lms.set('cmi.core.score.max', '100');
    } else {
      if (lms.get('cmi.completion_status') !== 'completed') lms.set('cmi.completion_status', 'incomplete');
      lms.set('cmi.score.min', '0');
      lms.set('cmi.score.max', '100');
    }
  }

  function itemScore(it) {
    var s = it.kind === 'block' ? state.b[it.id] : state.u[it.id];
    return s && typeof s.s === 'number' ? s.s : null;
  }
  function lessonDone(i) {
    if (!state.les[i]) return false;
    var l = lessons[i];
    return l.blocks.every(function (b) {
      if (B.graded[b.type]) return !!(state.b[b.id] && state.b[b.id].c);
      if (b.type === 'h5p' && C.units[b.data.unitId] && (C.units[b.data.unitId].scored || C.units[b.data.unitId].finish)) {
        var u = state.u[b.data.unitId] || {};
        return C.units[b.data.unitId].scored ? typeof u.s === 'number' : !!u.c;
      }
      return true;
    });
  }
  function evaluate() {
    var done = 0;
    lessons.forEach(function (l, i) {
      if (lessonDone(i)) done++;
    });
    var answered = 0;
    var sum = 0;
    gradedItems.forEach(function (it) {
      var s = itemScore(it);
      if (s !== null) {
        answered++;
        sum += s;
      }
    });
    var scored = gradedItems.length > 0;
    var scaled = scored ? sum / gradedItems.length : null;
    return {
      done: done,
      total: lessons.length,
      complete: done === lessons.length,
      scored: scored,
      allAnswered: answered === gradedItems.length,
      scaled: scaled,
      passed: scaled !== null ? scaled * 100 >= (C.settings.masteryScore || 0) - 1e-9 : null,
      pct: Math.round((done / lessons.length) * 100)
    };
  }
  function suspend() {
    var text = JSON.stringify(state);
    if (text.length <= LIMIT) return text;
    var copy = JSON.parse(text);
    Object.keys(copy.u).forEach(function (id) {
      if (text.length > LIMIT) {
        delete copy.u[id].st;
        text = JSON.stringify(copy);
      }
    });
    Object.keys(copy.b).forEach(function (id) {
      if (text.length > LIMIT && copy.b[id].r) {
        delete copy.b[id].r;
        delete copy.b[id].t;
        text = JSON.stringify(copy);
      }
    });
    return text;
  }
  function sessionTime() {
    var secs = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    if (V === '2004') return 'PT' + secs + 'S';
    var pad = function (n, l) {
      n = String(n);
      while (n.length < l) n = '0' + n;
      return n;
    };
    return pad(Math.floor(secs / 3600), 4) + ':' + pad(Math.floor((secs % 3600) / 60), 2) + ':' + pad(secs % 60, 2);
  }
  var timerSave = null;
  function save(now) {
    clearTimeout(timerSave);
    var run = function () {
      var ev = evaluate();
      var text = suspend();
      paintProgress(ev);
      if (!lms.connected) {
        local.write(text);
        return;
      }
      lms.set('cmi.suspend_data', text);
      lms.set(V === '2004' ? 'cmi.location' : 'cmi.core.lesson_location', String(Math.max(0, state.cur)));
      if (ev.scored && ev.allAnswered) {
        var rawScore = Math.round(ev.scaled * 10000) / 100;
        if (V === '2004') {
          lms.set('cmi.score.raw', rawScore);
          lms.set('cmi.score.scaled', Math.round(ev.scaled * 10000) / 10000);
        } else lms.set('cmi.core.score.raw', rawScore);
      }
      var passFail = C.settings.completion !== 'viewed' && ev.scored;
      if (V === '2004') {
        lms.set('cmi.progress_measure', Math.round((ev.done / ev.total) * 1000) / 1000);
        if (ev.complete) lms.set('cmi.completion_status', 'completed');
        if (passFail && ev.complete && ev.allAnswered) lms.set('cmi.success_status', ev.passed ? 'passed' : 'failed');
      } else if (ev.complete) {
        lms.set('cmi.core.lesson_status', passFail && ev.allAnswered ? (ev.passed ? 'passed' : 'failed') : 'completed');
      }
      lms.commit();
    };
    if (now) run();
    else timerSave = setTimeout(run, 350);
  }

  // H5P units inside iframes talk to us through the same API as the classic course shell.
  window.ScormStudio = {
    getState: function (id) {
      return state.u[id] ? state.u[id].st : undefined;
    },
    setState: function (id, st) {
      state.u[id] = state.u[id] || {};
      if (st === null) delete state.u[id].st;
      else state.u[id].st = st;
      save(false);
    },
    registerUnit: function (id, handle) {
      unitWindows[id] = handle;
    },
    report: function (id, data) {
      var s = (state.u[id] = state.u[id] || {});
      if (data.kind === 'opened' || data.kind === 'progress') s.o = 1;
      if (data.verb && /\/completed$/.test(data.verb)) s.c = 1;
      if (data.kind === 'score') {
        s.o = 1;
        s.s = Math.round(data.scaled * 10000) / 10000;
      }
      save(data.kind === 'score');
      refreshGates();
    },
    resizeUnit: function (id, h) {
      [].forEach.call(doc.querySelectorAll('iframe[data-unit="' + id + '"]'), function (f) {
        if (!f.dataset.fixed) f.style.height = Math.max(240, Math.min(4000, Math.round(h) + 8)) + 'px';
      });
    }
  };

  // ------------------------------------------------------------------ helpers
  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function btn(cls, text, fn) {
    var b = el('button', cls, text);
    b.type = 'button';
    if (fn) b.addEventListener('click', fn);
    return b;
  }
  function url(ref) {
    var m = String(ref || '').match(/^media:(.+)$/);
    return m ? C.mediaBase + encodeURIComponent(m[1]) : '';
  }
  var ctx = {
    url: url,
    label: label,
    lang: C.language,
    preview: !!C.preview,
    listenAbove: D.listenPosition === 'above',
    state: function (id) {
      return state.b[id];
    },
    save: function (id, s) {
      state.b[id] = Object.assign({}, state.b[id] || {}, s);
      save(typeof s.s === 'number');
      refreshGates();
    },
    unit: function (id) {
      return C.units[id] || null;
    }
  };
  function accessible(i) {
    if (C.settings.navigation !== 'linear') return true;
    for (var k = 0; k < i; k++) if (!lessonDone(k)) return false;
    return true;
  }
  function flushUnits() {
    Object.keys(unitWindows).forEach(function (id) {
      try {
        unitWindows[id].flush();
      } catch (e) {
        /* ignore */
      }
    });
  }

  // ------------------------------------------------------------------ theme
  var T = D.theme || {};
  var rootStyle = doc.documentElement.style;
  rootStyle.setProperty('--pp-primary', T.primary || '#1d2230');
  rootStyle.setProperty('--pp-accent', T.accent || '#b3312c');
  if (T.background) rootStyle.setProperty('--pp-page', T.background);
  var FONT = {
    Geist: '"Geist", system-ui, sans-serif', Inter: '"Inter", system-ui, sans-serif', Poppins: '"Poppins", system-ui, sans-serif', 'Source Sans 3': '"Source Sans 3", system-ui, sans-serif',
    Lato: '"Lato", system-ui, sans-serif', Montserrat: '"Montserrat", system-ui, sans-serif', Merriweather: '"Merriweather", Georgia, serif', Georgia: 'Georgia, "Times New Roman", serif', System: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  };
  rootStyle.setProperty('--pp-font', FONT[T.font] || FONT.Geist);
  doc.documentElement.classList.add('pp-mode-' + (T.mode === 'dark' ? 'dark' : 'light'), 'pp-size-' + (T.fontSize || 'medium'), 'pp-radius-' + (T.radius || 'rounded'), 'pp-design-' + (D.player || 'studio'));
  doc.documentElement.dir = D.direction === 'rtl' ? 'rtl' : 'ltr';

  // ------------------------------------------------------------------ layout
  var app = doc.getElementById('pp-app');
  var progressEls = [];
  function paintProgress(ev) {
    ev = ev || evaluate();
    progressEls.forEach(function (p) {
      if (p.bar) p.bar.style.transform = 'scaleX(' + ev.done / ev.total + ')';
      if (p.text) p.text.textContent = label('progress', { pct: ev.pct });
    });
    if (sidebarList) paintSidebar();
    if (hubGrid) paintHub();
  }
  function progressWidget(cls) {
    var w = el('div', 'pp-progress ' + (cls || ''));
    var track = el('div', 'pp-progress-track');
    var bar = el('i', 'pp-progress-bar');
    track.appendChild(bar);
    var text = el('span', 'pp-progress-text');
    w.appendChild(track);
    w.appendChild(text);
    progressEls.push({ bar: bar, text: text });
    return w;
  }
  function logo() {
    if (!D.logo) return null;
    var i = el('img', 'pp-logo');
    i.src = url(D.logo);
    i.alt = '';
    return i;
  }

  var view = el('main', 'pp-view');
  view.id = 'pp-main';
  view.tabIndex = -1;
  var sidebarList = null;
  var hubGrid = null;
  var design = D.player || 'studio';
  var paged = ['studio', 'classic', 'stage', 'hub', 'journey', 'magazine'].indexOf(design) !== -1;

  function topbar(withMenu) {
    var h = el('header', 'pp-top');
    if (withMenu) {
      var mb = btn('pp-menu-btn', '');
      mb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
      mb.setAttribute('aria-label', label('menu'));
      mb.setAttribute('aria-controls', 'pp-side');
      mb.addEventListener('click', function () {
        doc.body.classList.toggle('pp-side-open');
      });
      h.appendChild(mb);
    }
    var lg = logo();
    if (lg) h.appendChild(lg);
    h.appendChild(el('div', 'pp-top-title', C.title));
    h.appendChild(progressWidget('pp-top-progress'));
    return h;
  }

  function sidebar() {
    var s = el('nav', 'pp-side');
    s.id = 'pp-side';
    s.setAttribute('aria-label', label('menu'));
    var head = el('div', 'pp-side-head');
    var lg = logo();
    if (lg) head.appendChild(lg);
    head.appendChild(el('div', 'pp-side-kicker', label('overview')));
    head.appendChild(el('div', 'pp-side-title', C.title));
    head.appendChild(progressWidget('pp-side-progress'));
    s.appendChild(head);
    sidebarList = el('ol', 'pp-side-list');
    s.appendChild(sidebarList);
    var scrim = btn('pp-scrim', '');
    scrim.setAttribute('aria-label', label('close'));
    scrim.addEventListener('click', function () {
      doc.body.classList.remove('pp-side-open');
    });
    s.appendChild(scrim);
    return s;
  }
  function paintSidebar() {
    sidebarList.innerHTML = '';
    lessons.forEach(function (l, i) {
      var li = el('li');
      var b = btn('pp-side-item' + (i === state.cur ? ' is-current' : '') + (lessonDone(i) ? ' is-done' : ''), '');
      b.disabled = !accessible(i);
      b.setAttribute('aria-current', i === state.cur ? 'page' : 'false');
      var mark = el('span', 'pp-side-mark', lessonDone(i) ? '' : String(i + 1));
      if (lessonDone(i)) mark.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
      b.appendChild(mark);
      b.appendChild(el('span', 'pp-side-label', l.title));
      b.addEventListener('click', function () {
        if (design === 'focus' || design === 'lesson') scrollToLesson(i);
        else openLesson(i);
        doc.body.classList.remove('pp-side-open');
      });
      li.appendChild(b);
      sidebarList.appendChild(li);
    });
  }

  // ------------------------------------------------------------------ cover
  function cover(onStart) {
    var c = el('section', 'pp-cover');
    var hero = el('div', 'pp-cover-hero');
    if (D.cover && D.cover.image) {
      var im = el('img', 'pp-cover-img');
      im.src = url(D.cover.image);
      im.alt = '';
      hero.appendChild(im);
    }
    var inner = el('div', 'pp-cover-inner');
    var lg = logo();
    if (lg) inner.appendChild(lg);
    inner.appendChild(el('span', 'pp-kicker', (D.cover && D.cover.kicker) || 'E-Learning'));
    inner.appendChild(el('h1', 'pp-cover-title', C.title));
    if (C.description) inner.appendChild(el('p', 'pp-cover-desc', C.description));
    hero.appendChild(inner);
    c.appendChild(hero);
    var meta = el('div', 'pp-cover-meta');
    if (D.cover && D.cover.duration) meta.appendChild(el('span', '', label('minutes') + ' · ' + D.cover.duration));
    meta.appendChild(el('span', '', lessons.length + ' ' + label('lessons')));
    c.appendChild(meta);
    var actions = el('div', 'pp-cover-actions');
    var started = state.cur >= 0 || Object.keys(state.les).length;
    actions.appendChild(btn('pp-btn pp-btn-primary pp-btn-lg', started ? label('resume') : label('start'), onStart));
    if (started) actions.appendChild(btn('pp-btn pp-btn-ghost', label('restart'), restart));
    c.appendChild(actions);
    var ov = el('div', 'pp-cover-overview');
    ov.appendChild(el('div', 'pp-eyebrow', label('whatYouLearn')));
    var ol = el('ol');
    lessons.forEach(function (l, i) {
      var li = el('li' + '');
      li.appendChild(el('span', 'pp-ov-num', String(i + 1)));
      li.appendChild(el('span', '', l.title));
      ol.appendChild(li);
    });
    ov.appendChild(ol);
    c.appendChild(ov);
    return c;
  }

  // ------------------------------------------------------------------ lessons
  function lessonHead(l) {
    var h = el('div', 'pp-lesson-head');
    h.appendChild(el('span', 'pp-lesson-count', label('lessonOf', { num: l.index + 1, total: lessons.length })));
    return h;
  }
  function renderBlocks(list, into) {
    list.forEach(function (b) {
      into.appendChild(B.render(b, ctx));
    });
  }
  function lessonNav(i) {
    var n = el('nav', 'pp-lesson-nav');
    if (i > 0) {
      var p = btn('pp-btn pp-btn-ghost pp-nav-prev', label('prevLesson'), function () {
        openLesson(i - 1);
      });
      n.appendChild(p);
    } else n.appendChild(el('span'));
    if (i < lessons.length - 1) {
      var nx = btn('pp-btn pp-btn-primary pp-nav-next', '', function () {
        if (!lessonDone(i)) {
          gateHint(n);
          return;
        }
        openLesson(i + 1);
      });
      nx.appendChild(el('span', 'pp-nav-kicker', label('nextLesson')));
      nx.appendChild(el('span', 'pp-nav-title', lessons[i + 1].title));
      n.appendChild(nx);
    } else {
      n.appendChild(btn('pp-btn pp-btn-primary', label('finish'), function () {
        if (!lessonDone(i)) {
          gateHint(n);
          return;
        }
        showComplete();
      }));
    }
    return n;
  }
  function gateHint(where) {
    if (C.settings.navigation !== 'linear') return;
    var h = where.querySelector('.pp-gate-hint') || where.appendChild(el('p', 'pp-gate-hint', label('continueLocked')));
    h.classList.remove('is-shake');
    void h.offsetWidth;
    h.classList.add('is-shake');
  }
  var gateWatchers = [];
  function refreshGates() {
    gateWatchers.forEach(function (fn) {
      fn();
    });
  }

  function openLesson(i) {
    if (i < 0 || i >= lessons.length || !accessible(i)) return;
    flushUnits();
    unitWindows = {};
    gateWatchers = [];
    state.cur = i;
    state.les[i] = 1;
    var l = lessons[i];
    view.innerHTML = '';
    view.className = 'pp-view pp-view-' + design;
    if (design === 'hub' || design === 'journey') view.appendChild(btn('pp-back-home', '← ' + label('backHome'), showHome));
    var titled = l.blocks[0] && l.blocks[0].type === 'title' && l.blocks[0].data.kicker;
    if (design === 'magazine') {
      view.appendChild(magazineHero(l));
    } else if (design !== 'stage' && !titled) view.appendChild(lessonHead(l));
    var body = el('article', 'pp-lesson');
    if (design === 'stage') {
      stageLesson(l, body);
    } else {
      renderBlocks(design === 'magazine' ? l.blocks.filter(function (b, k) { return !(k === 0 && b.type === 'title'); }) : l.blocks, body);
      view.appendChild(body);
      view.appendChild(lessonNav(i));
    }
    save(false);
    paintProgress();
    window.scrollTo(0, 0);
    view.scrollTop = 0;
    view.focus({ preventScroll: true });
  }

  function magazineHero(l) {
    var h = el('header', 'pp-mag-hero' + (l.image ? ' has-image' : ''));
    if (l.image) {
      var im = el('img');
      im.src = url(l.image);
      im.alt = '';
      h.appendChild(im);
    }
    var t = el('div', 'pp-mag-hero-text');
    t.appendChild(el('span', 'pp-kicker', label('lessonOf', { num: l.index + 1, total: lessons.length })));
    t.appendChild(el('h2', 'pp-mag-title', l.title));
    h.appendChild(t);
    return h;
  }

  function stageLesson(l, body) {
    var i = l.index;
    var key = String(i);
    var cur = Math.min(state.scr[key] || 0, l.screens.length - 1);
    var frame = el('div', 'pp-stage-frame');
    var head = el('div', 'pp-stage-head');
    var dots = el('div', 'pp-stage-dots');
    var count = el('span', 'pp-stage-count');
    head.appendChild(el('span', 'pp-stage-lesson', l.title));
    head.appendChild(count);
    var card = el('div', 'pp-stage-card');
    var nav = el('div', 'pp-stage-nav');
    var prev = btn('pp-btn pp-btn-ghost', label('prev'));
    var next = btn('pp-btn pp-btn-primary', label('next'));
    nav.appendChild(prev);
    nav.appendChild(dots);
    nav.appendChild(next);
    frame.appendChild(head);
    frame.appendChild(card);
    frame.appendChild(nav);
    body.appendChild(frame);
    view.appendChild(body);
    function screenDone(k) {
      return l.screens[k].every(function (b) {
        return !B.graded[b.type] || (state.b[b.id] && state.b[b.id].c);
      });
    }
    function show(k) {
      cur = k;
      state.scr[key] = Math.max(state.scr[key] || 0, k);
      card.innerHTML = '';
      renderBlocks(l.screens[k], card);
      card.classList.remove('is-in');
      void card.offsetWidth;
      card.classList.add('is-in');
      count.textContent = label('screenOf', { num: k + 1, total: l.screens.length });
      dots.innerHTML = '';
      l.screens.forEach(function (_, d) {
        var dot = el('i', d === k ? 'is-current' : d < k ? 'is-done' : '');
        dots.appendChild(dot);
      });
      prev.disabled = k === 0 && i === 0;
      var last = k === l.screens.length - 1;
      next.textContent = last ? (i === lessons.length - 1 ? label('finish') : label('nextLesson')) : label('next');
      gate();
      save(false);
    }
    function gate() {
      var ok = screenDone(cur) || C.settings.navigation !== 'linear';
      next.classList.toggle('is-locked', !ok);
      next.setAttribute('aria-disabled', String(!ok));
    }
    gateWatchers.push(gate);
    prev.addEventListener('click', function () {
      if (cur > 0) show(cur - 1);
      else if (i > 0) openLesson(i - 1);
    });
    next.addEventListener('click', function () {
      if (next.classList.contains('is-locked')) {
        gateHint(nav);
        return;
      }
      if (cur < l.screens.length - 1) show(cur + 1);
      else if (i < lessons.length - 1) openLesson(i + 1);
      else showComplete();
    });
    show(cur);
  }

  // single-scroll designs: focus (all at once) and lesson (revealed by Continue)
  var observer = null;
  function scrollDesign() {
    view.innerHTML = '';
    view.className = 'pp-view pp-view-' + design;
    gateWatchers = [];
    var reveal = design === 'lesson';
    var chunks = [];
    lessons.forEach(function (l) {
      l.screens.forEach(function (s, k) {
        chunks.push({ lesson: l.index, first: k === 0, blocks: s });
      });
    });
    var shown = reveal ? Math.max(1, state.scr.all || 1) : chunks.length;
    var holder = el('div', 'pp-scroll');
    view.appendChild(holder);
    var cont = null;
    function chunkDone(c) {
      return c.blocks.every(function (b) {
        return !B.graded[b.type] || (state.b[b.id] && state.b[b.id].c);
      });
    }
    function paint() {
      holder.innerHTML = '';
      chunks.slice(0, shown).forEach(function (c, idx) {
        var sec = el('section', 'pp-chunk' + (c.first ? ' is-lesson-start' : ''));
        sec.dataset.lesson = String(c.lesson);
        if (c.first) {
          sec.id = 'lesson-' + c.lesson;
          var lb = lessons[c.lesson].blocks[0];
          if (!(lb && lb.type === 'title' && lb.data.kicker)) sec.appendChild(lessonHead(lessons[c.lesson]));
        }
        renderBlocks(c.blocks, sec);
        if (idx === shown - 1 && reveal) sec.classList.add('is-new');
        holder.appendChild(sec);
      });
      if (cont) cont.remove();
      cont = el('div', 'pp-continue');
      if (shown < chunks.length) {
        var b = btn('pp-btn pp-btn-primary pp-btn-lg', label('next'), function () {
          if (b.classList.contains('is-locked')) {
            gateHint(cont);
            return;
          }
          shown++;
          state.scr.all = shown;
          lessons.forEach(function (l) {
            if (chunks.slice(0, shown).some(function (c) { return c.lesson === l.index; })) state.les[l.index] = 1;
          });
          paint();
          var last = holder.lastChild;
          if (last && last.scrollIntoView) last.scrollIntoView({ behavior: 'smooth', block: 'start' });
          save(false);
        });
        var gate = function () {
          var ok = chunkDone(chunks[shown - 1]) || C.settings.navigation !== 'linear';
          b.classList.toggle('is-locked', !ok);
          b.setAttribute('aria-disabled', String(!ok));
        };
        gateWatchers = [gate];
        gate();
        cont.appendChild(b);
      } else {
        cont.appendChild(btn('pp-btn pp-btn-primary pp-btn-lg', label('finish'), function () {
          lessons.forEach(function (l) {
            state.les[l.index] = 1;
          });
          var ev = evaluate();
          if (!ev.complete && C.settings.navigation === 'linear') {
            gateHint(cont);
            return;
          }
          showComplete();
        }));
      }
      view.appendChild(cont);
      watchLessons();
      paintProgress();
    }
    paint();
    if (!reveal && state.cur > 0) scrollToLesson(state.cur);
  }
  function watchLessons() {
    if (!('IntersectionObserver' in window)) return;
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            var i = Number(e.target.dataset.lesson);
            state.les[i] = 1;
            state.cur = i;
            save(false);
          }
        });
      },
      { rootMargin: '0px 0px -40% 0px' }
    );
    [].forEach.call(view.querySelectorAll('.pp-chunk'), function (s) {
      observer.observe(s);
    });
  }
  function scrollToLesson(i) {
    var t = doc.getElementById('lesson-' + i);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ------------------------------------------------------------------ hub & journey homes
  function showHome() {
    flushUnits();
    view.innerHTML = '';
    view.className = 'pp-view pp-view-' + design + ' is-home';
    var head = el('div', 'pp-home-head');
    head.appendChild(el('span', 'pp-kicker', label('overview')));
    head.appendChild(el('h1', 'pp-h1', C.title));
    head.appendChild(progressWidget('pp-home-progress'));
    view.appendChild(head);
    if (design === 'journey') {
      hubGrid = null;
      view.appendChild(journeyMap());
    } else {
      hubGrid = el('div', 'pp-hub-grid');
      view.appendChild(hubGrid);
      paintHub();
    }
    var ev = evaluate();
    var fin = btn('pp-btn pp-btn-primary pp-btn-lg pp-home-finish', label('finish'), showComplete);
    fin.disabled = !ev.complete;
    view.appendChild(fin);
    paintProgress();
  }
  function paintHub() {
    if (!hubGrid || !hubGrid.isConnected) return;
    hubGrid.innerHTML = '';
    lessons.forEach(function (l, i) {
      var t = btn('pp-hub-tile' + (lessonDone(i) ? ' is-done' : '') + (accessible(i) ? '' : ' is-locked'), '');
      t.disabled = !accessible(i);
      var media = el('span', 'pp-hub-media');
      if (l.image) {
        var im = el('img');
        im.src = url(l.image);
        im.alt = '';
        media.appendChild(im);
      } else media.appendChild(el('span', 'pp-hub-num', String(i + 1).padStart ? String(i + 1).padStart(2, '0') : String(i + 1)));
      t.appendChild(media);
      var tx = el('span', 'pp-hub-text');
      tx.appendChild(el('span', 'pp-hub-kicker', label('lesson') + ' ' + (i + 1)));
      tx.appendChild(el('strong', '', l.title));
      tx.appendChild(el('span', 'pp-hub-state', lessonDone(i) ? '✓' : accessible(i) ? label('next') + ' →' : label('locked')));
      t.appendChild(tx);
      t.addEventListener('click', function () {
        openLesson(i);
      });
      hubGrid.appendChild(t);
    });
  }
  function journeyMap() {
    var w = el('div', 'pp-journey');
    var n = lessons.length;
    var H = Math.max(420, n * 150 + 60);
    var pts = lessons.map(function (_, i) {
      return { x: i % 2 ? 72 : 28, y: 70 + i * 150 };
    });
    var NS = 'http://www.w3.org/2000/svg';
    var svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    var d = 'M' + pts[0].x + ',' + pts[0].y;
    for (var k = 1; k < n; k++) {
      var a = pts[k - 1];
      var b = pts[k];
      d += ' C' + a.x + ',' + (a.y + 80) + ' ' + b.x + ',' + (b.y - 80) + ' ' + b.x + ',' + b.y;
    }
    var path = doc.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'pp-journey-path');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(path);
    w.appendChild(svg);
    w.style.height = H + 'px';
    lessons.forEach(function (l, i) {
      var node = btn('pp-journey-node' + (lessonDone(i) ? ' is-done' : '') + (accessible(i) ? '' : ' is-locked') + (i % 2 ? ' is-right' : ''), '');
      node.disabled = !accessible(i);
      node.style.top = pts[i].y + 'px';
      node.style.left = pts[i].x + '%';
      node.appendChild(el('span', 'pp-journey-dot', lessonDone(i) ? '✓' : String(i + 1)));
      var lab = el('span', 'pp-journey-label');
      lab.appendChild(el('span', 'pp-hub-kicker', label('lesson') + ' ' + (i + 1)));
      lab.appendChild(el('strong', '', l.title));
      node.appendChild(lab);
      node.addEventListener('click', function () {
        openLesson(i);
      });
      w.appendChild(node);
    });
    return w;
  }

  // ------------------------------------------------------------------ completion
  function showComplete() {
    flushUnits();
    lessons.forEach(function (l, i) {
      if (state.cur === i) state.les[i] = 1;
    });
    state.fin = 1;
    save(true);
    var ev = evaluate();
    view.innerHTML = '';
    view.className = 'pp-view pp-view-complete';
    var c = el('section', 'pp-complete');
    var badge = el('div', 'pp-complete-badge');
    badge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    c.appendChild(badge);
    c.appendChild(el('h1', 'pp-h1', label('complete')));
    c.appendChild(el('p', 'pp-lead', (D.completion && D.completion.message) || label('completeText')));
    if (ev.scored) {
      var pct = Math.round((ev.scaled || 0) * 100);
      var sc = el('div', 'pp-complete-score ' + (ev.passed ? 'is-passed' : 'is-failed'));
      sc.appendChild(el('span', 'pp-complete-num', pct + '%'));
      sc.appendChild(el('span', '', label('score') + ' · ' + (ev.passed ? label('passed') : label('failed'))));
      c.appendChild(sc);
    }
    var a = el('div', 'pp-actions pp-complete-actions');
    if (D.completion && D.completion.nextUrl) {
      var nx = el('a', 'pp-btn pp-btn-primary', D.completion.nextLabel || label('next'));
      nx.href = D.completion.nextUrl;
      nx.target = '_top';
      a.appendChild(nx);
    }
    if (!D.completion || D.completion.restart !== false) a.appendChild(btn('pp-btn pp-btn-ghost', label('restart'), restart));
    if (lms.connected) a.appendChild(btn('pp-btn pp-btn-ghost', label('exit'), function () {
      finish();
      try {
        window.top.close();
      } catch (e) {
        /* LMS decides */
      }
    }));
    c.appendChild(a);
    view.appendChild(c);
    paintProgress(ev);
    window.scrollTo(0, 0);
  }

  function restart() {
    state = { v: 2, les: {}, scr: {}, b: {}, u: {}, cur: -1, started: 1 };
    save(true);
    begin();
  }

  // ------------------------------------------------------------------ boot
  function begin() {
    state.started = 1;
    if (design === 'hub' || design === 'journey') showHome();
    else if (paged) openLesson(Math.max(0, Math.min(state.cur, lessons.length - 1)));
    else scrollDesign();
  }
  function frameShell() {
    doc.body.innerHTML = '';
    var withSide = design === 'studio' || design === 'classic';
    if (withSide) doc.body.appendChild(sidebar());
    var mainCol = el('div', 'pp-main-col');
    mainCol.appendChild(topbar(withSide));
    if (!lms.connected && api) mainCol.appendChild(el('p', 'pp-warning', label('lmsWarning')));
    mainCol.appendChild(view);
    doc.body.appendChild(mainCol);
    doc.body.classList.add('pp-body', withSide ? 'has-side' : 'no-side');
  }

  frameShell();
  if (D.cover && D.cover.show !== false && !state.fin) {
    view.innerHTML = '';
    view.className = 'pp-view pp-view-cover';
    view.appendChild(cover(begin));
    paintProgress();
  } else if (state.fin) showComplete();
  else begin();

  function finish() {
    if (finished) return;
    finished = true;
    flushUnits();
    save(true);
    if (lms.connected) {
      var ev = evaluate();
      if (V === '2004') {
        lms.set('cmi.session_time', sessionTime());
        lms.set('cmi.exit', ev.complete ? 'normal' : 'suspend');
      } else {
        lms.set('cmi.core.session_time', sessionTime());
        lms.set('cmi.core.exit', ev.complete ? '' : 'suspend');
      }
      lms.commit();
      lms.finish();
    }
  }
  window.addEventListener('pagehide', finish);
  window.addEventListener('beforeunload', finish);
  doc.addEventListener('visibilitychange', function () {
    if (doc.visibilityState === 'hidden') save(true);
  });
  // ------------------------------------------------------------------ editor preview bridge (same origin only)
  if (C.preview && window.parent !== window) {
    var gotoBlock = function (blockId) {
      var li = -1, si = 0, chunk = 0, seen = 0;
      lessons.forEach(function (l, i) {
        l.screens.forEach(function (s, k) {
          if (li === -1 && s.some(function (b) { return b.id === blockId; })) {
            li = i;
            si = k;
            chunk = seen;
          }
          seen++;
        });
      });
      if (li < 0) return;
      state.started = 1;
      if (paged) {
        state.scr[String(li)] = si;
        openLesson(li);
      } else {
        if (design === 'lesson') state.scr.all = Math.max(state.scr.all || 1, chunk + 1);
        if (!doc.getElementById('block-' + blockId)) scrollDesign();
      }
      var t = doc.getElementById('block-' + blockId);
      if (t) {
        t.scrollIntoView({ block: 'center' });
        t.classList.add('pp-flash');
        setTimeout(function () { t.classList.remove('pp-flash'); }, 1400);
      }
    };
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.type !== 'pp-goto') return;
      gotoBlock(String(e.data.blockId || ''));
    });
    doc.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('[data-block]');
      if (b) window.parent.postMessage({ type: 'pp-select', blockId: b.dataset.block }, location.origin);
    }, true);
    window.parent.postMessage({ type: 'pp-ready' }, location.origin);
  }
  window.PPPlayer = { state: function () { return state; }, evaluate: evaluate, openLesson: openLesson, lessons: lessons };
})();
