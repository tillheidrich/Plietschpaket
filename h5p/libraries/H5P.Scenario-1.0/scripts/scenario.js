/**
 * H5P.Scenario – branching role-play with characters, backgrounds, narration and scored decisions.
 *
 * Model: characters[], scenes[] (first scene starts), endings[]. A choice points to the key of a scene or an ending.
 * Score = sum of the points of the chosen answers; max score = best reachable path (cycles are cut).
 * Reports xAPI "progressed" after each decision and one "completed" (scored when scoring is on).
 * State for resume: { v: 1, s: sceneKey, h: [[sceneKey, choiceIndex]], e: endingKey, d: done }.
 */
H5P.Scenario = (function ($, EventDispatcher) {
  'use strict';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function tpl(text, vars) {
    return String(text || '').replace(/:(\w+)/g, function (m, k) {
      return vars[k] !== undefined ? vars[k] : m;
    });
  }

  function validColor(c, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? c : fallback;
  }

  var LETTERS = 'ABCD';

  function Scenario(params, contentId, extras) {
    EventDispatcher.call(this);
    var self = this;
    extras = extras || {};
    this.contentId = contentId;
    this.params = $.extend(true, {}, Scenario.DEFAULTS, params || {});
    this.l = this.params.l10n;
    this.title = (extras.metadata && extras.metadata.title) || '';
    this.lang = (extras.metadata && extras.metadata.defaultLanguage) || document.documentElement.lang || 'en';

    this.characters = {};
    (this.params.characters || []).forEach(function (c) {
      if (c && c.key) self.characters[c.key] = c;
    });
    this.scenes = {};
    this.order = [];
    (this.params.scenes || []).forEach(function (s) {
      if (s && s.key && !self.scenes[s.key]) {
        self.scenes[s.key] = s;
        self.order.push(s.key);
      }
    });
    this.endings = {};
    (this.params.endings || []).forEach(function (e) {
      if (e && e.key) self.endings[e.key] = e;
    });
    this.firstEnding = (this.params.endings || [])[0] || { key: '_end', title: '', rating: 'mixed' };
    this.maxScore = this.computeMax();
    this.scored = this.params.behaviour.scoring !== 'none' && this.maxScore > 0;

    var prev = extras.previousState;
    if (typeof prev === 'string') {
      try {
        prev = JSON.parse(prev);
      } catch (e) {
        prev = null;
      }
    }
    this.state = { s: this.order[0] || null, h: [], e: null, d: false };
    if (prev && prev.v === 1 && Array.isArray(prev.h)) {
      this.state.h = prev.h.filter(function (x) {
        return Array.isArray(x) && self.scenes[x[0]];
      });
      this.state.s = self.scenes[prev.s] ? prev.s : this.state.s;
      this.state.e = self.endings[prev.e] ? prev.e : null;
      this.state.d = !!prev.d;
      this.resumable = !this.state.d && this.state.h.length > 0;
    }
  }

  Scenario.prototype = Object.create(EventDispatcher.prototype);
  Scenario.prototype.constructor = Scenario;

  Scenario.DEFAULTS = {
    intro: { kicker: 'Role-play', text: '' },
    characters: [],
    scenes: [],
    endings: [],
    theme: { mode: 'dark', accent: '#7c6cf0' },
    behaviour: { scoring: 'points', passPercent: 70, tts: true, autoNarrate: false, showFeedback: true, allowRetry: true },
    l10n: {
      start: 'Start', resume: 'Continue where you left off', narration: 'Narration', play: 'Play narration',
      pause: 'Pause narration', next: 'Continue', choose: 'What do you do?', decision: 'Decision :num',
      endingGood: 'Strong result', endingMixed: 'Room to improve', endingBad: 'That went wrong',
      score: 'Score: :score of :max', passed: 'Passed', failed: 'Not passed yet', again: 'Try again',
      recap: 'Your decisions', back: 'Back'
    }
  };

  // ------------------------------------------------------------------ scoring
  Scenario.prototype.computeMax = function () {
    var self = this;
    var memo = {};
    function best(key, seen) {
      if (!self.scenes[key]) return 0;
      if (memo[key] !== undefined) return memo[key];
      if (seen[key]) return 0;
      seen[key] = true;
      var s = self.scenes[key];
      var choices = (s.choices || []).filter(function (c) {
        return c && c.text;
      });
      var v = 0;
      if (choices.length) {
        v = -Infinity;
        choices.forEach(function (c) {
          v = Math.max(v, (Number(c.points) || 0) + best(c.next, seen));
        });
      } else if (s.nextScene) {
        v = best(s.nextScene, seen);
      }
      delete seen[key];
      memo[key] = Math.max(0, v);
      return memo[key];
    }
    return this.order.length ? best(this.order[0], {}) : 0;
  };

  Scenario.prototype.rawScore = function () {
    var self = this;
    return this.state.h.reduce(function (sum, x) {
      var s = self.scenes[x[0]];
      var c = s && (s.choices || [])[x[1]];
      return sum + (c ? Number(c.points) || 0 : 0);
    }, 0);
  };

  Scenario.prototype.getScore = function () {
    return Math.max(0, Math.min(this.maxScore, this.rawScore()));
  };
  Scenario.prototype.getMaxScore = function () {
    return this.scored ? this.maxScore : 0;
  };
  Scenario.prototype.getAnswerGiven = function () {
    return this.state.h.length > 0 || this.state.d;
  };
  Scenario.prototype.getCurrentState = function () {
    return { v: 1, s: this.state.s, h: this.state.h, e: this.state.e, d: this.state.d };
  };
  Scenario.prototype.resetTask = function () {
    this.restart();
  };

  // ------------------------------------------------------------------ layout
  Scenario.prototype.attach = function ($container) {
    var self = this;
    var t = this.params.theme;
    var root = el('div', 'h5p-scenario sc-' + (t.mode === 'light' ? 'light' : 'dark'));
    root.style.setProperty('--sc-accent', validColor(t.accent, '#7c6cf0'));
    this.root = root;

    // stage
    var stage = el('div', 'sc-stage');
    this.$bg = el('div', 'sc-bg');
    this.$char = el('div', 'sc-char');
    this.$situation = el('div', 'sc-situation');
    this.$situation.appendChild(el('i', 'sc-situation-bar'));
    this.$situationText = el('p', 'sc-situation-text');
    this.$situation.appendChild(this.$situationText);
    this.$bubble = el('div', 'sc-bubble');
    this.$bubble.setAttribute('aria-live', 'polite');
    this.$speaker = el('div', 'sc-speaker');
    this.$line = el('p', 'sc-line');
    this.$bubble.appendChild(this.$speaker);
    this.$bubble.appendChild(this.$line);
    stage.appendChild(this.$bg);
    stage.appendChild(this.$char);
    stage.appendChild(this.$situation);
    stage.appendChild(this.$bubble);
    this.$overlay = el('div', 'sc-overlay');
    this.$overlay.hidden = true;
    stage.appendChild(this.$overlay);
    this.$stage = stage;

    // narration bar
    var narr = el('div', 'sc-narr');
    this.$play = el('button', 'sc-play');
    this.$play.type = 'button';
    this.$play.setAttribute('aria-label', this.l.play);
    this.$play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="sc-i-play" d="M8 5.5v13l11-6.5z"/><path class="sc-i-pause" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
    this.$track = el('div', 'sc-track');
    this.$fill = el('i', 'sc-fill');
    this.$track.appendChild(this.$fill);
    this.$narrLabel = el('span', 'sc-narr-label');
    narr.appendChild(this.$play);
    narr.appendChild(this.$track);
    narr.appendChild(this.$narrLabel);
    this.$narr = narr;

    // choices / feedback
    this.$prompt = el('div', 'sc-prompt');
    this.$choices = el('div', 'sc-choices');
    this.$choices.setAttribute('role', 'group');
    this.$feedback = el('div', 'sc-feedback');
    this.$feedback.hidden = true;
    this.$feedback.setAttribute('role', 'status');

    root.appendChild(stage);
    root.appendChild(narr);
    root.appendChild(this.$prompt);
    root.appendChild(this.$choices);
    root.appendChild(this.$feedback);
    $container.addClass('h5p-scenario-container').empty().append(root);

    this.audio = new Audio();
    this.audio.preload = 'none';
    this.audio.addEventListener('timeupdate', function () {
      if (self.audio.duration) self.setProgress(self.audio.currentTime / self.audio.duration);
    });
    this.audio.addEventListener('ended', function () {
      self.setPlaying(false);
      self.setProgress(1);
    });
    this.$play.addEventListener('click', function () {
      if (self.playing) self.stopNarration();
      else self.narrate();
    });

    if (!this.order.length) {
      this.$line.textContent = '';
      return;
    }
    if (this.state.d) this.showEnding(this.endings[this.state.e] || this.firstEnding, true);
    else this.showStart();
  };

  Scenario.prototype.resize = function () {
    this.trigger('resize');
  };

  // ------------------------------------------------------------------ media
  Scenario.prototype.renderBackground = function (scene) {
    var key = scene.background || 'office';
    var img = scene.backgroundImage && scene.backgroundImage.path;
    var id = key === 'custom' && img ? 'img:' + img : 'svg:' + key;
    if (this.bgId === id) return;
    this.bgId = id;
    var layer = el('div', 'sc-bg-layer');
    if (key === 'custom' && img) {
      var im = el('img');
      im.alt = '';
      im.src = H5P.getPath(img, this.contentId);
      layer.appendChild(im);
    } else {
      layer.innerHTML = H5P.ScenarioArt.background(key);
    }
    var old = this.$bg.lastChild;
    this.$bg.appendChild(layer);
    requestAnimationFrame(function () {
      layer.classList.add('is-on');
    });
    if (old) {
      setTimeout(function () {
        if (old.parentNode) old.parentNode.removeChild(old);
      }, 700);
    }
  };

  Scenario.prototype.renderCharacter = function (scene) {
    var c = this.characters[scene.character];
    var pos = ['left', 'right', 'center'].indexOf(scene.position) >= 0 ? scene.position : 'right';
    this.root.classList.toggle('sc-char-left', pos === 'left');
    this.root.classList.toggle('sc-has-char', !!c);
    if (!c) {
      this.$char.innerHTML = '';
      this.charId = null;
      return;
    }
    var expr = scene.expression || 'neutral';
    var pose = scene.pose && scene.pose !== 'auto' ? scene.pose : null;
    var custom = c.look === 'custom' && c.image && c.image.path;
    var id = c.key + '|' + (custom ? 'img' : expr + '|' + pose) + '|' + pos;
    if (this.charId === id) return;
    var sameChar = this.charId && this.charId.split('|')[0] === c.key;
    this.charId = id;
    var fig = el('div', 'sc-figure-wrap pos-' + pos + (sameChar ? ' is-swap' : ''));
    if (custom) {
      var im = el('img', 'sc-figure');
      im.alt = '';
      im.src = H5P.getPath(c.image.path, this.contentId);
      fig.appendChild(im);
    } else {
      fig.innerHTML = H5P.ScenarioArt.character(c.look, expr, pose);
    }
    this.$char.innerHTML = '';
    this.$char.appendChild(fig);
    requestAnimationFrame(function () {
      fig.classList.add('is-on');
    });
  };

  // ------------------------------------------------------------------ narration
  Scenario.prototype.parts = function (scene) {
    return [scene.situation, scene.line].filter(function (s) {
      return s && String(s).trim();
    });
  };

  Scenario.prototype.canSpeak = function () {
    return this.params.behaviour.tts && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
  };

  Scenario.prototype.setPlaying = function (on) {
    this.playing = on;
    this.$play.classList.toggle('is-playing', on);
    this.$play.setAttribute('aria-label', on ? this.l.pause : this.l.play);
  };

  Scenario.prototype.setProgress = function (p) {
    this.$fill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, p)) + ')';
  };

  Scenario.prototype.setNarrLabel = function (part, total) {
    this.$narrLabel.textContent = this.l.narration + (total > 1 ? ' ' + part + '/' + total : '');
  };

  Scenario.prototype.stopNarration = function () {
    try {
      this.audio.pause();
    } catch (e) {
      /* ignore */
    }
    if (this.canSpeak()) window.speechSynthesis.cancel();
    this.speakToken = (this.speakToken || 0) + 1;
    this.setPlaying(false);
  };

  Scenario.prototype.narrate = function () {
    var self = this;
    var scene = this.scenes[this.state.s];
    if (!scene) return;
    this.stopNarration();
    if (scene.audio && scene.audio.length && scene.audio[0].path) {
      this.audio.src = H5P.getPath(scene.audio[0].path, this.contentId);
      this.audio.currentTime = 0;
      var p = this.audio.play();
      if (p && p.catch) p.catch(function () {
        self.setPlaying(false);
      });
      this.setPlaying(true);
      return;
    }
    if (!this.canSpeak()) return;
    var parts = this.parts(scene);
    var total = parts.join(' ').length || 1;
    var done = 0;
    var token = this.speakToken;
    var voices = window.speechSynthesis.getVoices() || [];
    var lang = String(this.lang || 'en').slice(0, 2);
    var voice = voices.filter(function (v) {
      return String(v.lang || '').slice(0, 2) === lang;
    })[0];
    this.setPlaying(true);
    var speak = function (i) {
      if (token !== self.speakToken) return;
      if (i >= parts.length) {
        self.setPlaying(false);
        self.setProgress(1);
        return;
      }
      self.setNarrLabel(i + 1, parts.length);
      var u = new SpeechSynthesisUtterance(parts[i]);
      u.lang = self.lang;
      if (voice) u.voice = voice;
      u.rate = 1;
      u.onboundary = function (e) {
        self.setProgress((done + (e.charIndex || 0)) / total);
      };
      u.onend = function () {
        done += parts[i].length + 1;
        self.setProgress(done / total);
        speak(i + 1);
      };
      u.onerror = function () {
        self.setPlaying(false);
      };
      window.speechSynthesis.speak(u);
    };
    speak(0);
  };

  // ------------------------------------------------------------------ flow
  Scenario.prototype.showStart = function () {
    var self = this;
    var first = this.scenes[this.order[0]];
    this.renderBackground(first);
    this.renderCharacter({ character: null });
    this.root.classList.add('sc-at-start');
    var o = this.$overlay;
    o.innerHTML = '';
    o.className = 'sc-overlay sc-start';
    o.hidden = false;
    if (this.params.intro.cover && this.params.intro.cover.path) {
      var cov = el('img', 'sc-cover');
      cov.alt = '';
      cov.src = H5P.getPath(this.params.intro.cover.path, this.contentId);
      o.appendChild(cov);
    }
    var card = el('div', 'sc-start-card');
    if (this.params.intro.kicker) card.appendChild(el('span', 'sc-kicker', this.params.intro.kicker));
    card.appendChild(el('h2', 'sc-start-title', this.title));
    if (this.params.intro.text) card.appendChild(el('p', 'sc-start-text', this.params.intro.text));
    var row = el('div', 'sc-start-actions');
    var start = el('button', 'sc-btn sc-btn-primary', this.resumable ? this.l.resume : this.l.start);
    start.type = 'button';
    start.addEventListener('click', function () {
      self.root.classList.remove('sc-at-start');
      o.hidden = true;
      self.showScene(self.resumable ? self.state.s : self.order[0], true);
    });
    row.appendChild(start);
    if (this.resumable) {
      var fresh = el('button', 'sc-btn sc-btn-ghost', this.l.again);
      fresh.type = 'button';
      fresh.addEventListener('click', function () {
        self.resumable = false;
        self.restart();
      });
      row.appendChild(fresh);
    }
    card.appendChild(row);
    o.appendChild(card);
    this.$narr.hidden = true;
    this.$prompt.textContent = '';
    this.$choices.innerHTML = '';
    this.$feedback.hidden = true;
    this.resize();
  };

  Scenario.prototype.restart = function () {
    this.stopNarration();
    this.state = { s: this.order[0], h: [], e: null, d: false };
    this.$overlay.hidden = true;
    this.root.classList.remove('sc-at-start', 'sc-at-end');
    this.showScene(this.order[0], true);
    this.save();
  };

  Scenario.prototype.showScene = function (key) {
    var self = this;
    var scene = this.scenes[key];
    if (!scene) return this.finish(this.endings[key] || this.firstEnding);
    this.stopNarration();
    this.state.s = key;
    this.$overlay.hidden = true;
    this.root.classList.remove('sc-at-end');
    this.renderBackground(scene);
    this.renderCharacter(scene);

    this.$situationText.textContent = scene.situation || '';
    this.$situation.hidden = !scene.situation;
    var c = this.characters[scene.character];
    this.$speaker.textContent = c ? c.name || '' : '';
    this.$speaker.style.color = c ? validColor(c.color, '') : '';
    this.$speaker.hidden = !c || !c.name;
    this.$line.textContent = scene.line || '';
    this.$bubble.hidden = !scene.line;
    this.$bubble.classList.remove('is-on');
    requestAnimationFrame(function () {
      self.$bubble.classList.add('is-on');
    });

    var hasAudio = scene.audio && scene.audio.length && scene.audio[0].path;
    this.$narr.hidden = !(hasAudio || (this.canSpeak() && this.parts(scene).length));
    this.setProgress(0);
    this.setNarrLabel(1, hasAudio ? 1 : this.parts(scene).length);

    this.$feedback.hidden = true;
    this.$choices.innerHTML = '';
    var choices = (scene.choices || []).filter(function (x) {
      return x && x.text;
    });
    var num = this.state.h.length + 1;
    if (choices.length) {
      this.$prompt.innerHTML = '';
      this.$prompt.appendChild(el('span', 'sc-prompt-count', tpl(this.l.decision, { num: num })));
      this.$prompt.appendChild(el('span', 'sc-prompt-text', this.l.choose));
      (scene.choices || []).forEach(function (ch, idx) {
        if (!ch || !ch.text) return;
        var b = el('button', 'sc-choice');
        b.type = 'button';
        b.appendChild(el('span', 'sc-letter', LETTERS.charAt(self.$choices.children.length)));
        b.appendChild(el('span', 'sc-choice-text', ch.text));
        b.addEventListener('click', function () {
          self.choose(idx, b);
        });
        self.$choices.appendChild(b);
      });
    } else {
      this.$prompt.textContent = '';
      var next = el('button', 'sc-btn sc-btn-primary sc-continue', this.l.next);
      next.type = 'button';
      next.addEventListener('click', function () {
        self.go(scene.nextScene || self.firstEnding.key);
      });
      this.$choices.appendChild(next);
    }
    this.save();
    this.resize();
    if (this.params.behaviour.autoNarrate) this.narrate();
  };

  Scenario.prototype.choose = function (idx, button) {
    var self = this;
    var scene = this.scenes[this.state.s];
    var ch = scene.choices[idx];
    this.stopNarration();
    [].forEach.call(this.$choices.children, function (b) {
      b.disabled = true;
      if (b !== button) b.classList.add('is-dim');
    });
    button.classList.add('is-picked', 'tone-' + (ch.tone || 'neutral'));
    this.state.h.push([this.state.s, idx]);
    this.triggerXAPI('progressed');
    this.save();
    if (this.params.behaviour.showFeedback && ch.feedback) {
      var f = this.$feedback;
      f.innerHTML = '';
      f.className = 'sc-feedback tone-' + (ch.tone || 'neutral');
      f.appendChild(el('i', 'sc-fb-icon'));
      var body = el('div', 'sc-fb-body');
      body.appendChild(el('p', 'sc-fb-text', ch.feedback));
      var go = el('button', 'sc-btn sc-btn-primary', this.l.next);
      go.type = 'button';
      go.addEventListener('click', function () {
        self.go(ch.next);
      });
      body.appendChild(go);
      f.appendChild(body);
      f.hidden = false;
      this.resize();
      setTimeout(function () {
        try {
          go.focus({ preventScroll: true });
        } catch (e) {
          /* ignore */
        }
      }, 50);
    } else {
      setTimeout(function () {
        self.go(ch.next);
      }, 450);
    }
  };

  Scenario.prototype.go = function (key) {
    if (this.scenes[key]) this.showScene(key);
    else this.finish(this.endings[key] || this.firstEnding);
  };

  Scenario.prototype.finish = function (ending) {
    this.state.e = ending.key;
    this.state.d = true;
    this.save();
    if (this.scored) {
      var score = this.getScore();
      var passed = (score / this.maxScore) * 100 >= Number(this.params.behaviour.passPercent || 0);
      this.triggerXAPIScored(score, this.maxScore, 'completed', true, passed);
    } else {
      this.triggerXAPI('completed');
    }
    this.showEnding(ending);
  };

  Scenario.prototype.showEnding = function (ending) {
    var self = this;
    this.stopNarration();
    this.root.classList.add('sc-at-end');
    this.$narr.hidden = true;
    this.$prompt.textContent = '';
    this.$choices.innerHTML = '';
    this.$feedback.hidden = true;
    var last = this.scenes[this.state.s] || this.scenes[this.order[0]];
    if (last) this.renderBackground(last);
    var rating = ['good', 'mixed', 'bad'].indexOf(ending.rating) >= 0 ? ending.rating : 'mixed';
    var o = this.$overlay;
    o.innerHTML = '';
    o.className = 'sc-overlay sc-end rating-' + rating;
    var card = el('div', 'sc-end-card');
    card.appendChild(el('span', 'sc-end-badge', this.l['ending' + rating.charAt(0).toUpperCase() + rating.slice(1)]));
    card.appendChild(el('h2', 'sc-end-title', ending.title || ''));
    if (ending.text) card.appendChild(el('p', 'sc-end-text', ending.text));
    if (this.scored) {
      var score = this.getScore();
      var pct = Math.round((score / this.maxScore) * 100);
      var passed = pct >= Number(this.params.behaviour.passPercent || 0);
      var sc = el('div', 'sc-score ' + (passed ? 'is-passed' : 'is-failed'));
      var bar = el('div', 'sc-score-bar');
      var fill = el('i');
      bar.appendChild(fill);
      sc.appendChild(el('div', 'sc-score-line', tpl(this.l.score, { score: score, max: this.maxScore })));
      sc.appendChild(bar);
      sc.appendChild(el('div', 'sc-score-verdict', passed ? this.l.passed : this.l.failed));
      card.appendChild(sc);
      requestAnimationFrame(function () {
        setTimeout(function () {
          fill.style.transform = 'scaleX(' + pct / 100 + ')';
        }, 120);
      });
    }
    if (this.state.h.length) {
      card.appendChild(el('h3', 'sc-recap-title', this.l.recap));
      var list = el('ol', 'sc-recap');
      this.state.h.forEach(function (x) {
        var s = self.scenes[x[0]];
        var ch = s && s.choices && s.choices[x[1]];
        if (!ch) return;
        var li = el('li', 'tone-' + (ch.tone || 'neutral'));
        li.appendChild(el('i'));
        li.appendChild(el('span', '', ch.text));
        list.appendChild(li);
      });
      card.appendChild(list);
    }
    if (this.params.behaviour.allowRetry) {
      var again = el('button', 'sc-btn sc-btn-primary', this.l.again);
      again.type = 'button';
      again.addEventListener('click', function () {
        self.restart();
      });
      card.appendChild(again);
    }
    o.appendChild(card);
    o.hidden = false;
    this.renderCharacter({ character: null });
    this.resize();
  };

  Scenario.prototype.save = function () {
    // H5P core stores getCurrentState() on its own interval; this nudges an immediate commit in our runtime.
    this.trigger('kl-state');
  };

  return Scenario;
})(H5P.jQuery, H5P.EventDispatcher);
