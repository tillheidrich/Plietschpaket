/*
 * Plietschpaket xAPI / cmi5 adapter.
 * The course player and the unit shell speak SCORM 2004. In xAPI and cmi5 packages this file runs first and,
 * when the page was launched with LRS parameters, provides window.API_1484_11 that maps the SCORM data model
 * onto xAPI statements and the xAPI State API:
 *   Initialize → (cmi5: fetch auth token, read LMS.LaunchData) → read saved state → "initialized"
 *   completion_status=completed → "completed" (once)      success_status → "passed" / "failed" (once each)
 *   Commit → state document "pp-suspend" (suspend_data, location, status)    Terminate → "terminated"
 * Without launch parameters (opened directly, LMS preview) it does nothing; the player then finds the
 * LMS simulator or falls back to local storage.
 * Config: window.PP_XAPI = { mode: 'xapi'|'cmi5', activityId, title, language, masteryScore (0..1|null) }
 */
(function () {
  'use strict';
  var X = window.PP_XAPI || {};
  var q = {};
  location.search
    .replace(/^\?/, '')
    .split('&')
    .forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var k = decodeURIComponent((i < 0 ? pair : pair.slice(0, i)).replace(/\+/g, ' '));
      q[k] = decodeURIComponent((i < 0 ? '' : pair.slice(i + 1)).replace(/\+/g, ' '));
    });
  if (!q.endpoint) return;

  var CMI5 = 'https://w3id.org/xapi/cmi5/context/categories/cmi5';
  var MOVEON = 'https://w3id.org/xapi/cmi5/context/categories/moveon';
  var VERBS = {
    launched: 'http://adlnet.gov/expapi/verbs/launched',
    initialized: 'http://adlnet.gov/expapi/verbs/initialized',
    completed: 'http://adlnet.gov/expapi/verbs/completed',
    passed: 'http://adlnet.gov/expapi/verbs/passed',
    failed: 'http://adlnet.gov/expapi/verbs/failed',
    progressed: 'http://adlnet.gov/expapi/verbs/progressed',
    terminated: 'http://adlnet.gov/expapi/verbs/terminated'
  };
  var isCmi5 = !!q.fetch || X.mode === 'cmi5';
  var endpoint = q.endpoint.replace(/\/?$/, '/');
  var actor = null;
  try {
    actor = JSON.parse(q.actor);
    if (Array.isArray(actor)) actor = actor[0]; // old TinCan launch format
    if (actor && Array.isArray(actor.name)) actor.name = actor.name[0];
    if (actor && Array.isArray(actor.mbox)) actor.mbox = actor.mbox[0];
    if (actor && Array.isArray(actor.account)) actor.account = actor.account[0];
  } catch (e) {
    actor = null;
  }
  var activityId = q.activityId || q.activity_id || X.activityId;
  var registration = q.registration || null;
  var auth = q.auth || '';
  var launchData = {};
  var started = Date.now();
  var data = { suspend: '', location: '', completion: 'unknown', success: 'unknown', scaled: null, raw: null, progress: null };
  var sent = { completed: false, passed: false, failed: false, terminated: false };
  var initialized = false;
  var unloading = false;
  var lastError = '0';
  var queue = Promise.resolve();
  window.addEventListener('pagehide', function () {
    unloading = true;
  });

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  function headers(xhrOrObj, json) {
    var h = { 'X-Experience-API-Version': '1.0.3' };
    if (auth) h.Authorization = auth;
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }
  function stateUrl(stateId) {
    var p = 'activities/state?stateId=' + encodeURIComponent(stateId) + '&activityId=' + encodeURIComponent(activityId) + '&agent=' + encodeURIComponent(JSON.stringify(actor));
    if (registration) p += '&registration=' + encodeURIComponent(registration);
    return endpoint + p;
  }
  // The SCORM API is synchronous, so the few reads during Initialize use synchronous requests.
  function syncRequest(method, url, body, extra) {
    try {
      var x = new XMLHttpRequest();
      x.open(method, url, false);
      var h = extra || headers(null, !!body);
      for (var k in h) x.setRequestHeader(k, h[k]);
      x.send(body || null);
      return { status: x.status, text: x.responseText };
    } catch (e) {
      return { status: 0, text: '' };
    }
  }
  // Requests go out immediately (keepalive survives page unload); `queue` lets Terminate wait for all of them.
  function asyncRequest(method, url, body) {
    var p = fetch(url, { method: method, headers: headers(null, true), body: body, keepalive: true, credentials: 'omit' }).catch(function () {});
    queue = Promise.all([queue, p]);
    return p;
  }
  function duration(ms) {
    var s = Math.max(0, Math.round(ms / 10) / 100);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    return 'PT' + (h ? h + 'H' : '') + (m ? m + 'M' : '') + Math.round((s % 60) * 100) / 100 + 'S';
  }
  function context(category) {
    var ctx = JSON.parse(JSON.stringify(launchData.contextTemplate || {}));
    if (registration) ctx.registration = registration;
    if (isCmi5) {
      ctx.contextActivities = ctx.contextActivities || {};
      var cats = ctx.contextActivities.category || [];
      cats.push({ id: CMI5, objectType: 'Activity' });
      if (category === 'moveon') cats.push({ id: MOVEON, objectType: 'Activity' });
      ctx.contextActivities.category = cats;
    }
    return ctx;
  }
  function statement(verb, result, category) {
    var name = {};
    name[X.language || 'en'] = X.title || activityId;
    var st = {
      id: uuid(),
      actor: actor,
      verb: { id: VERBS[verb], display: { 'en-US': verb } },
      object: { id: activityId, objectType: 'Activity', definition: { name: name, type: 'http://adlnet.gov/expapi/activities/course' } },
      context: context(category),
      timestamp: new Date().toISOString()
    };
    if (result) st.result = result;
    asyncRequest('POST', endpoint + 'statements', JSON.stringify(st));
  }
  function mastery() {
    var m = launchData.masteryScore;
    if (typeof m === 'number' && m >= 0 && m <= 1) return m;
    return typeof X.masteryScore === 'number' ? X.masteryScore : null;
  }
  function normalMode() {
    return !isCmi5 || !launchData.launchMode || launchData.launchMode === 'Normal';
  }
  function saveState() {
    if (!actor) return;
    asyncRequest('PUT', stateUrl('pp-suspend'), JSON.stringify({ suspend: data.suspend, location: data.location, completion: data.completion, success: data.success, scaled: data.scaled }));
  }
  function score() {
    var s = {};
    if (data.scaled !== null) s.scaled = Math.max(0, Math.min(1, data.scaled));
    if (data.raw !== null) {
      s.raw = data.raw;
      s.min = 0;
      s.max = 100;
    }
    return s;
  }

  function evaluateSuccess(requested) {
    // cmi5: the LMS mastery score decides; plain xAPI: the course's own decision
    var m = mastery();
    if (isCmi5 && m !== null && data.scaled !== null) return data.scaled >= m ? 'passed' : 'failed';
    return requested;
  }

  var api = {
    Initialize: function () {
      if (initialized) return 'true';
      if (!actor || !activityId) {
        lastError = '101';
        return 'false';
      }
      if (isCmi5 && q.fetch) {
        var res = syncRequest('POST', q.fetch, null, {});
        try {
          var token = JSON.parse(res.text)['auth-token'];
          if (!token) throw new Error('no token');
          auth = 'Basic ' + token;
        } catch (e) {
          lastError = '101';
          return 'false';
        }
      }
      if (isCmi5) {
        var ld = syncRequest('GET', stateUrl('LMS.LaunchData'));
        try {
          launchData = JSON.parse(ld.text) || {};
        } catch (e) {
          launchData = {};
        }
      }
      var saved = syncRequest('GET', stateUrl('pp-suspend'));
      if (saved.status === 200) {
        try {
          var s = JSON.parse(saved.text);
          data.suspend = s.suspend || '';
          data.location = s.location || '';
          data.completion = s.completion || 'unknown';
          data.success = s.success || 'unknown';
          sent.completed = data.completion === 'completed';
          sent.passed = data.success === 'passed';
        } catch (e) {
          /* ignore broken state */
        }
      }
      initialized = true;
      if (!isCmi5) statement('launched');
      statement('initialized');
      return 'true';
    },
    Terminate: function () {
      if (!initialized) return 'false';
      saveState();
      if (!sent.terminated) {
        sent.terminated = true;
        statement('terminated', { duration: duration(Date.now() - started) });
      }
      initialized = false;
      if (isCmi5 && launchData.returnURL && !unloading) {
        queue.then(function () {
          window.top.location.href = launchData.returnURL;
        });
      }
      return 'true';
    },
    GetValue: function (k) {
      switch (k) {
        case 'cmi.suspend_data':
          return data.suspend;
        case 'cmi.location':
          return data.location;
        case 'cmi.completion_status':
          return data.completion;
        case 'cmi.success_status':
          return data.success;
        case 'cmi.entry':
          return data.suspend ? 'resume' : 'ab-initio';
        case 'cmi.mode':
          return !normalMode() ? (launchData.launchMode === 'Review' ? 'review' : 'browse') : 'normal';
        case 'cmi.scaled_passing_score':
          return mastery() === null ? '' : String(mastery());
        case 'cmi.learner_name':
          return (actor && actor.name) || '';
        default:
          return '';
      }
    },
    SetValue: function (k, v) {
      v = String(v);
      switch (k) {
        case 'cmi.suspend_data':
          data.suspend = v.slice(0, 64000);
          break;
        case 'cmi.location':
          data.location = v.slice(0, 1000);
          break;
        case 'cmi.score.scaled':
          data.scaled = Number(v);
          break;
        case 'cmi.score.raw':
          data.raw = Number(v);
          break;
        case 'cmi.progress_measure':
          data.progress = Number(v);
          break;
        case 'cmi.completion_status':
          data.completion = v;
          if (v === 'completed' && !sent.completed && normalMode()) {
            sent.completed = true;
            statement('completed', { completion: true, duration: duration(Date.now() - started) }, 'moveon');
          }
          break;
        case 'cmi.success_status': {
          if (v !== 'passed' && v !== 'failed') {
            data.success = v;
            break;
          }
          var outcome = evaluateSuccess(v);
          data.success = outcome;
          if (!normalMode() || sent[outcome] || sent.passed) break;
          sent[outcome] = true;
          statement(outcome, { success: outcome === 'passed', score: score(), duration: duration(Date.now() - started) }, 'moveon');
          break;
        }
        default:
          break;
      }
      return 'true';
    },
    Commit: function () {
      if (initialized) saveState();
      return 'true';
    },
    GetLastError: function () {
      return lastError;
    },
    GetErrorString: function () {
      return '';
    },
    GetDiagnostic: function () {
      return '';
    }
  };
  window.API_1484_11 = api;
})();
