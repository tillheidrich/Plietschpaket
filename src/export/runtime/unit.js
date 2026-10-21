/*
 * Plietschpaket unit runtime (runs inside each unit iframe, after the H5P bundle).
 * Talks to the course shell in the parent window. Without a shell (e.g. a unit
 * opened directly) it stays silent.
 *
 * Rules (see business_logic/current/workflows/scorm-runtime.md):
 *  - Only top-level xAPI statements (no contextActivities.parent) count.
 *  - A statement with a score reports that score; anything else only progress.
 *  - H5P "previous state" is loaded from and saved to the shell (→ cmi.suspend_data).
 */
(function () {
  'use strict';
  var UNIT = window.SS_UNIT || {};
  var shell = null;
  try {
    if (window.parent && window.parent !== window && window.parent.ScormStudio) shell = window.parent.ScormStudio;
  } catch (e) {
    shell = null;
  }
  if (typeof H5P === 'undefined' || typeof H5PIntegration === 'undefined') return;

  // Some content types only submit results when reporting is enabled.
  H5PIntegration.reportingIsEnabled = true;
  // Autosave every 10 s; xAPI "completed"/"progressed" also triggers a save.
  H5PIntegration.saveFreq = 10;

  function parseState(raw) {
    if (raw === undefined || raw === null || raw === '') return undefined;
    if (typeof raw !== 'string') return raw;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return undefined;
    }
  }

  H5P.getUserData = function (contentId, dataId, done, subContentId) {
    if (dataId === 'state' && !subContentId && shell) {
      done(undefined, parseState(shell.getState(UNIT.id)));
      return;
    }
    done(undefined, undefined);
  };
  H5P.setUserData = function (contentId, dataId, data) {
    if (dataId !== 'state' || !shell) return;
    try {
      shell.setState(UNIT.id, typeof data === 'string' ? data : JSON.stringify(data));
    } catch (e) {
      /* state not serialisable – ignore */
    }
  };
  H5P.deleteUserData = function (contentId, dataId) {
    if (dataId === 'state' && shell) shell.setState(UNIT.id, null);
  };
  H5P.setFinished = function () {};

  H5P.externalDispatcher.on('xAPI', function (event) {
    if (!shell || !event || !event.data || !event.data.statement) return;
    var st = event.data.statement;
    var ctx = st.context && st.context.contextActivities;
    if (ctx && ctx.parent && ctx.parent.length) return; // sub-content: ignored on purpose
    var verb = (st.verb && st.verb.id) || '';
    var r = st.result;
    if (r && r.score && typeof r.score.max === 'number' && r.score.max > 0 && typeof r.score.raw === 'number') {
      shell.report(UNIT.id, {
        kind: 'score',
        raw: r.score.raw,
        max: r.score.max,
        scaled: Math.max(0, Math.min(1, r.score.raw / r.score.max)),
        success: r.success,
        verb: verb
      });
    } else if (/completed|progressed|answered|experienced|interacted/.test(verb)) {
      shell.report(UNIT.id, { kind: 'progress', verb: verb, completion: r ? r.completion : undefined });
    }
    // persist the resume state right away on progress (not only every 10 s / on page close)
    if (/progressed|completed|answered/.test(verb)) setTimeout(flush, 0);
  });

  function flush() {
    if (!shell) return;
    try {
      var inst = H5P.instances && H5P.instances[0];
      if (inst && typeof inst.getCurrentState === 'function') {
        var s = inst.getCurrentState();
        if (s !== undefined) shell.setState(UNIT.id, JSON.stringify(s));
      }
    } catch (e) {
      /* ignore */
    }
  }
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });

  if (shell) {
    shell.registerUnit(UNIT.id, { flush: flush });
    shell.report(UNIT.id, { kind: 'opened' });
    // Block courses embed units inline: tell the player how tall the content is.
    if (typeof shell.resizeUnit === 'function') {
      var last = 0;
      var send = function () {
        // html/body are 100 % high in H5P iframes, so measure the content wrapper instead of the document
        var wrap = document.querySelector('.ss-unit-wrap');
        var h = wrap ? wrap.offsetTop + wrap.offsetHeight : document.documentElement.scrollHeight;
        if (Math.abs(h - last) > 2) {
          last = h;
          shell.resizeUnit(UNIT.id, h);
        }
      };
      if (window.ResizeObserver) new ResizeObserver(send).observe(document.querySelector('.ss-unit-wrap') || document.documentElement);
      window.addEventListener('load', send);
      setInterval(send, 1500);
      send();
    }
  }
})();
