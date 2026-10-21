/*
 * Plietschpaket course shell. One SCO that hosts all units in an iframe and
 * talks to the LMS (SCORM 1.2 or 2004 4th Ed.). Without an LMS it falls back to
 * localStorage so HTML exports keep progress too.
 */
(function () {
  'use strict';
  var C = window.SS_COURSE;
  var V = C.scormVersion === '2004' ? '2004' : '1.2';
  var LIMIT = V === '2004' ? 64000 : 4096;
  var startedAt = Date.now();
  var unitWindows = {};
  var finished = false;

  // ------------------------------------------------------------------ LMS API
  function scan(win, name) {
    var hops = 0;
    while (win && hops < 12) {
      try {
        if (win[name]) return win[name];
      } catch (e) {
        /* cross-origin frame */
      }
      if (!win.parent || win.parent === win) break;
      win = win.parent;
      hops += 1;
    }
    return null;
  }
  var apiName = V === '2004' ? 'API_1484_11' : 'API';
  var api = scan(window, apiName);
  if (!api && window.opener) api = scan(window.opener, apiName);

  var lms = {
    connected: false,
    init: function () {
      if (!api) return false;
      var ok = V === '2004' ? api.Initialize('') : api.LMSInitialize('');
      this.connected = String(ok) === 'true';
      return this.connected;
    },
    get: function (key) {
      if (!this.connected) return '';
      var v = V === '2004' ? api.GetValue(key) : api.LMSGetValue(key);
      return v === null || v === undefined ? '' : String(v);
    },
    set: function (key, value) {
      if (!this.connected) return false;
      var ok = V === '2004' ? api.SetValue(key, String(value)) : api.LMSSetValue(key, String(value));
      return String(ok) === 'true';
    },
    commit: function () {
      if (!this.connected) return false;
      return String(V === '2004' ? api.Commit('') : api.LMSCommit('')) === 'true';
    },
    finish: function () {
      if (!this.connected) return false;
      var ok = V === '2004' ? api.Terminate('') : api.LMSFinish('');
      this.connected = false;
      return String(ok) === 'true';
    }
  };

  var storageKey = 'plietschpaket:' + C.packageUuid;
  var local = {
    read: function () {
      try {
        return window.localStorage.getItem(storageKey) || '';
      } catch (e) {
        return '';
      }
    },
    write: function (v) {
      try {
        window.localStorage.setItem(storageKey, v);
      } catch (e) {
        /* private mode */
      }
    }
  };

  // ------------------------------------------------------------------ state
  var state = { v: 1, u: {}, cur: 0 };
  lms.init();
  var raw = lms.connected ? lms.get('cmi.suspend_data') : local.read();
  if (raw) {
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.v === 1 && parsed.u) state = parsed;
    } catch (e) {
      /* corrupt suspend data – start fresh */
    }
  }
  C.units.forEach(function (u) {
    if (!state.u[u.id]) state.u[u.id] = {};
  });
  if (lms.connected) {
    var loc = lms.get(V === '2004' ? 'cmi.location' : 'cmi.core.lesson_location');
    if (loc && !isNaN(Number(loc))) state.cur = Number(loc);
    if (V === '1.2') {
      var status = lms.get('cmi.core.lesson_status');
      if (!status || status === 'not attempted') lms.set('cmi.core.lesson_status', 'incomplete');
      lms.set('cmi.core.score.min', '0');
      lms.set('cmi.core.score.max', '100');
    } else {
      if (lms.get('cmi.completion_status') !== 'completed') lms.set('cmi.completion_status', 'incomplete');
      lms.set('cmi.score.min', '0');
      lms.set('cmi.score.max', '100');
    }
  }
  if (state.cur < 0 || state.cur >= C.units.length) state.cur = 0;

  function unitDone(u) {
    var s = state.u[u.id] || {};
    if (u.finish && !u.scored) return !!s.c;
    if (C.settings.completion === 'viewed') return u.finish ? !!s.c : !!s.o;
    return u.scored ? typeof s.s === 'number' : !!s.o;
  }

  function evaluate() {
    var done = 0;
    var weightSum = 0;
    var scoreSum = 0;
    var scoredCount = 0;
    var scoredAnswered = 0;
    C.units.forEach(function (u) {
      var s = state.u[u.id] || {};
      if (unitDone(u)) done += 1;
      if (u.scored) {
        scoredCount += 1;
        if (typeof s.s === 'number') {
          scoredAnswered += 1;
          weightSum += u.weight;
          scoreSum += s.s * u.weight;
        }
      }
    });
    var complete = done === C.units.length;
    var allScored = scoredCount > 0 && scoredAnswered === scoredCount;
    var totalWeight = C.units.reduce(function (acc, u) {
      return acc + (u.scored ? u.weight : 0);
    }, 0);
    // Units that were never answered count as 0 in the final score.
    var scaled = totalWeight > 0 ? scoreSum / totalWeight : null;
    var passed = scaled !== null ? scaled * 100 >= C.settings.masteryScore - 1e-9 : null;
    return {
      done: done,
      total: C.units.length,
      complete: complete,
      scaled: scaled,
      partialScaled: weightSum > 0 ? scoreSum / weightSum : null,
      scored: scoredCount > 0,
      allScored: allScored,
      passed: passed
    };
  }

  function buildSuspend() {
    var copy = JSON.parse(JSON.stringify(state));
    var text = JSON.stringify(copy);
    if (text.length <= LIMIT) return text;
    // Too long for the LMS: drop H5P states, completed units and largest first.
    var ids = Object.keys(copy.u).filter(function (id) {
      return copy.u[id].st;
    });
    ids.sort(function (a, b) {
      var ca = isDoneById(a) ? 1 : 0;
      var cb = isDoneById(b) ? 1 : 0;
      if (ca !== cb) return cb - ca;
      return String(copy.u[b].st).length - String(copy.u[a].st).length;
    });
    for (var i = 0; i < ids.length && text.length > LIMIT; i += 1) {
      delete copy.u[ids[i]].st;
      text = JSON.stringify(copy);
    }
    return text.length <= LIMIT ? text : JSON.stringify({ v: 1, u: strip(copy.u), cur: copy.cur });
  }
  function strip(units) {
    var out = {};
    Object.keys(units).forEach(function (id) {
      var s = units[id];
      out[id] = { o: s.o, s: s.s };
    });
    return out;
  }
  function isDoneById(id) {
    for (var i = 0; i < C.units.length; i += 1) if (C.units[i].id === id) return unitDone(C.units[i]);
    return false;
  }

  function sessionTime() {
    var secs = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    if (V === '2004') return 'PT' + secs + 'S';
    var h = Math.floor(secs / 3600);
    var m = Math.floor((secs % 3600) / 60);
    var s = secs % 60;
    var pad = function (n, l) {
      n = String(n);
      while (n.length < l) n = '0' + n;
      return n;
    };
    return pad(h, 4) + ':' + pad(m, 2) + ':' + pad(s, 2);
  }

  var saveTimer = null;
  function save(immediate) {
    if (saveTimer) clearTimeout(saveTimer);
    var run = function () {
      saveTimer = null;
      var ev = evaluate();
      var suspend = buildSuspend();
      if (!lms.connected) {
        local.write(suspend);
        render(ev);
        return;
      }
      lms.set('cmi.suspend_data', suspend);
      lms.set(V === '2004' ? 'cmi.location' : 'cmi.core.lesson_location', String(state.cur));
      var reportScale = ev.scaled;
      if (ev.scored && reportScale !== null && ev.allScored) {
        var rawScore = Math.round(reportScale * 10000) / 100;
        if (V === '2004') {
          lms.set('cmi.score.raw', rawScore);
          lms.set('cmi.score.scaled', Math.round(reportScale * 10000) / 10000);
        } else {
          lms.set('cmi.core.score.raw', rawScore);
        }
      }
      if (V === '2004') {
        lms.set('cmi.progress_measure', Math.round((ev.done / ev.total) * 1000) / 1000);
        if (ev.complete) lms.set('cmi.completion_status', 'completed');
        if (ev.scored && ev.complete && ev.allScored && C.settings.completion !== 'viewed') {
          lms.set('cmi.success_status', ev.passed ? 'passed' : 'failed');
        }
      } else if (ev.complete) {
        if (ev.scored && ev.allScored && C.settings.completion !== 'viewed') {
          lms.set('cmi.core.lesson_status', ev.passed ? 'passed' : 'failed');
        } else {
          lms.set('cmi.core.lesson_status', 'completed');
        }
      }
      lms.commit();
      render(ev);
    };
    if (immediate) run();
    else saveTimer = setTimeout(run, 400);
  }

  // ------------------------------------------------------------------ API for units
  window.ScormStudio = {
    getState: function (unitId) {
      return state.u[unitId] ? state.u[unitId].st : undefined;
    },
    setState: function (unitId, st) {
      if (!state.u[unitId]) return;
      if (st === null) delete state.u[unitId].st;
      else state.u[unitId].st = st;
      save(false);
    },
    registerUnit: function (unitId, handle) {
      unitWindows[unitId] = handle;
    },
    report: function (unitId, data) {
      var s = state.u[unitId];
      if (!s) return;
      if (data.kind === 'opened') s.o = 1;
      if (data.verb && /\/completed$/.test(data.verb)) s.c = 1;
      if (data.kind === 'progress') s.o = 1;
      if (data.kind === 'score') {
        s.o = 1;
        s.s = Math.round(data.scaled * 10000) / 10000;
        s.b = Math.max(s.b || 0, s.s);
      }
      save(data.kind === 'score');
    }
  };

  // ------------------------------------------------------------------ UI
  var frame = document.getElementById('ss-frame');
  var list = document.getElementById('ss-units');
  var prevBtn = document.getElementById('ss-prev');
  var nextBtn = document.getElementById('ss-next');
  var bar = document.getElementById('ss-progress-bar');
  var progressText = document.getElementById('ss-progress-text');
  var scoreText = document.getElementById('ss-score');
  var menuBtn = document.getElementById('ss-menu');
  var L = C.labels;

  function accessible(index) {
    if (C.settings.navigation !== 'linear') return true;
    for (var i = 0; i < index; i += 1) if (!unitDone(C.units[i])) return false;
    return true;
  }

  function open(index) {
    if (index < 0 || index >= C.units.length || !accessible(index)) return;
    var current = C.units[state.cur];
    if (current && unitWindows[current.id]) unitWindows[current.id].flush();
    state.cur = index;
    frame.src = C.units[index].href;
    frame.title = C.units[index].title;
    document.body.classList.remove('ss-menu-open');
    save(false);
    render(evaluate());
  }

  function render(ev) {
    if (!list) return;
    list.innerHTML = '';
    C.units.forEach(function (u, i) {
      var s = state.u[u.id] || {};
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ss-unit' + (i === state.cur ? ' is-current' : '') + (unitDone(u) ? ' is-done' : '');
      btn.disabled = !accessible(i);
      var mark = document.createElement('span');
      mark.className = 'ss-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = unitDone(u) ? '✓' : String(i + 1);
      var label = document.createElement('span');
      label.className = 'ss-unit-title';
      label.textContent = u.title;
      btn.appendChild(mark);
      btn.appendChild(label);
      if (typeof s.s === 'number') {
        var sc = document.createElement('span');
        sc.className = 'ss-unit-score';
        sc.textContent = Math.round(s.s * 100) + ' %';
        btn.appendChild(sc);
      }
      btn.setAttribute('aria-current', i === state.cur ? 'step' : 'false');
      btn.addEventListener('click', function () {
        open(i);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
    var pct = ev.total ? Math.round((ev.done / ev.total) * 100) : 0;
    if (bar) bar.style.width = pct + '%';
    if (progressText) progressText.textContent = L.progress.replace('{done}', ev.done).replace('{total}', ev.total);
    if (scoreText) {
      if (ev.scored && ev.partialScaled !== null) {
        scoreText.textContent = L.score.replace('{score}', Math.round((ev.allScored ? ev.scaled : ev.partialScaled) * 100));
        scoreText.hidden = false;
      } else scoreText.hidden = true;
    }
    if (prevBtn) prevBtn.disabled = state.cur <= 0;
    if (nextBtn) nextBtn.disabled = state.cur >= C.units.length - 1 || !accessible(state.cur + 1);
  }

  if (prevBtn) prevBtn.addEventListener('click', function () { open(state.cur - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { open(state.cur + 1); });
  if (menuBtn) menuBtn.addEventListener('click', function () { document.body.classList.toggle('ss-menu-open'); });

  function finish() {
    if (finished) return;
    finished = true;
    var current = C.units[state.cur];
    if (current && unitWindows[current.id]) unitWindows[current.id].flush();
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
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') save(true);
  });

  if (!lms.connected && api) {
    var warn = document.getElementById('ss-lms-warning');
    if (warn) warn.hidden = false;
  }
  var start = state.cur;
  while (start > 0 && !accessible(start)) start -= 1;
  state.cur = -1;
  open(start);
})();
