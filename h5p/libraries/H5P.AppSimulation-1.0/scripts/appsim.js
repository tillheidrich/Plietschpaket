/**
 * H5P.AppSimulation – step-by-step software simulation on screenshots.
 *
 * Step types:
 *   click   – learner has to tap the right spot (scored: first try = 1 point)
 *   info    – an area is highlighted, continue with "Next"
 *   note    – like info, marked as an important hint
 *   explore – several hint areas (hover / tap / keyboard), continue with "Next"
 *
 * Reports via xAPI: "progressed" while working and one top-level "completed" statement at the
 * end – with score (tasks solved on the first try) unless scoring is "none".
 * State for resume: getCurrentState() → { v, i, r, p, d }.
 */
H5P.AppSimulation = (function ($, EventDispatcher) {
  'use strict';

  var FRAMES = { phone: 1, tablet: 1, none: 1 };

  function clamp(n, min, max) {
    n = Number(n);
    if (isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function validColor(c, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? c : fallback;
  }

  function tpl(text, vars) {
    return String(text || '').replace(/:(\w+)/g, function (m, k) {
      return vars[k] !== undefined ? vars[k] : m;
    });
  }

  // Only YouTube and Vimeo are embedded (privacy-enhanced YouTube domain).
  function embedUrl(url) {
    var m = String(url || '').match(/^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtube-nocookie\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{6,20})/);
    if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0&modestbranding=1';
    m = String(url || '').match(/^https:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{5,12})/);
    if (m) return 'https://player.vimeo.com/video/' + m[1] + '?dnt=1';
    return null;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function AppSimulation(params, contentId, extras) {
    EventDispatcher.call(this);
    var self = this;
    extras = extras || {};
    this.contentId = contentId;
    this.extras = extras;
    this.params = $.extend(true, {}, AppSimulation.DEFAULTS, params || {});
    this.l = this.params.l10n;
    this.title = (extras.metadata && extras.metadata.title) || '';

    // Flatten chapters → steps; inherit screenshots from the previous step.
    this.chapters = [];
    this.steps = [];
    var lastShot = null;
    (this.params.chapters || []).forEach(function (ch, ci) {
      var chapter = { title: ch.title || '', index: ci, first: self.steps.length };
      (ch.steps || []).forEach(function (st) {
        var shot = st.screenshot && st.screenshot.path ? st.screenshot : lastShot;
        if (shot) lastShot = shot;
        var kind = ['click', 'info', 'note', 'explore'].indexOf(st.kind) >= 0 ? st.kind : 'click';
        var area = st.area && typeof st.area.x === 'number' ? st.area : null;
        if (kind === 'click' && !area) kind = 'info';
        self.steps.push({
          chapter: ci,
          label: st.label || '',
          detail: st.detail || '',
          kind: kind,
          shot: shot,
          area: area,
          hints: (st.hints || []).filter(function (h) {
            return h && h.area && typeof h.area.x === 'number';
          })
        });
      });
      chapter.count = self.steps.length - chapter.first;
      if (chapter.count) self.chapters.push(chapter);
    });
    this.taskCount = this.steps.filter(function (s) {
      return s.kind === 'click';
    }).length;
    this.scored = this.params.behaviour.scoring !== 'none' && this.taskCount > 0;

    // Progress state
    var prev = extras.previousState;
    if (typeof prev === 'string') {
      try {
        prev = JSON.parse(prev);
      } catch (e) {
        prev = null;
      }
    }
    this.state = { i: 0, r: '', p: 'start', d: false };
    if (prev && prev.v === 1 && typeof prev.i === 'number' && this.steps.length) {
      this.state.i = clamp(prev.i, 0, this.steps.length - 1);
      this.state.r = typeof prev.r === 'string' ? prev.r.slice(0, this.steps.length) : '';
      this.state.d = !!prev.d;
      this.resumable = !prev.d && (prev.i > 0 || this.state.r.length > 0);
    }
    this.misses = 0;
    this.solved = false;
  }

  AppSimulation.prototype = Object.create(EventDispatcher.prototype);
  AppSimulation.prototype.constructor = AppSimulation;

  AppSimulation.DEFAULTS = {
    intro: { kicker: 'Training', subtitle: '', text: '' },
    chapters: [],
    video: {},
    theme: { frame: 'phone', sidebarColor: '#1d2230', accentColor: '#e3a33b', buttonColor: '#b3312c', footer: '' },
    behaviour: { scoring: 'firstTry', hintAfter: 2, tolerance: 25, allowBack: true, showVideoFirst: false },
    l10n: {
      start: 'Start',
      resume: 'Continue where you left off',
      watch: 'Watch the video',
      toPractice: 'Now practise it',
      next: 'Next',
      back: 'Back',
      doIt: 'Tap the right spot on the screen.',
      explore: 'Point at or tap the marked areas to learn more.',
      miss: 'Not quite. Try again.',
      hint: 'Here it is: tap the highlighted spot.',
      good: 'Correct.',
      showMe: 'Show me this step',
      chapter: 'Chapter :num of :total',
      step: 'Step :num of :total',
      doneTitle: 'Well done!',
      doneText: 'You have completed this training. You will find more trainings in your learning platform.',
      score: 'Solved on the first try: :score of :total',
      again: 'Start again',
      screenLabel: 'App screen'
    }
  };

  // ------------------------------------------------------------------ public H5P API
  AppSimulation.prototype.getScore = function () {
    return (this.state.r.match(/1/g) || []).length;
  };
  AppSimulation.prototype.getMaxScore = function () {
    return this.scored ? this.taskCount : 0;
  };
  AppSimulation.prototype.getAnswerGiven = function () {
    return this.state.r.length > 0 || this.state.d;
  };
  AppSimulation.prototype.getCurrentState = function () {
    return { v: 1, i: this.state.i, r: this.state.r, d: this.state.d };
  };
  AppSimulation.prototype.resetTask = function () {
    this.state = { i: 0, r: '', p: 'practice', d: false };
    this.showStep();
  };

  AppSimulation.prototype.attach = function ($container) {
    var self = this;
    var t = this.params.theme;
    var root = el('div', 'h5p-appsim frame-' + (FRAMES[t.frame] ? t.frame : 'phone'));
    root.style.setProperty('--as-side', validColor(t.sidebarColor, '#1d2230'));
    root.style.setProperty('--as-accent', validColor(t.accentColor, '#e3a33b'));
    root.style.setProperty('--as-button', validColor(t.buttonColor, '#b3312c'));
    this.root = root;

    // Sidebar
    var side = el('aside', 'as-side');
    if (this.params.intro.logo && this.params.intro.logo.path) {
      var logo = el('img', 'as-logo');
      logo.src = H5P.getPath(this.params.intro.logo.path, this.contentId);
      logo.alt = '';
      side.appendChild(logo);
    }
    if (this.params.intro.kicker) side.appendChild(el('span', 'as-kicker', this.params.intro.kicker));
    side.appendChild(el('h2', 'as-title', this.title));
    if (this.params.intro.subtitle) side.appendChild(el('div', 'as-meta', this.params.intro.subtitle));
    this.$bars = el('div', 'as-bars');
    this.$bars.setAttribute('aria-hidden', 'true');
    this.chapters.forEach(function () {
      self.$bars.appendChild(el('i'));
    });
    side.appendChild(this.$bars);
    this.$chap = el('div', 'as-chap');
    side.appendChild(this.$chap);
    var box = el('div', 'as-stepbox');
    this.$num = el('div', 'as-num');
    this.$num.setAttribute('aria-hidden', 'true');
    this.$label = el('h3', 'as-label');
    this.$detail = el('p', 'as-detail');
    box.appendChild(this.$num);
    box.appendChild(this.$label);
    box.appendChild(this.$detail);
    side.appendChild(box);
    this.$feedback = el('div', 'as-feedback');
    this.$feedback.setAttribute('role', 'status');
    this.$feedback.setAttribute('aria-live', 'polite');
    side.appendChild(this.$feedback);
    var nav = el('div', 'as-nav');
    this.$back = el('button', 'as-btn as-sec as-back', '‹');
    this.$back.type = 'button';
    this.$back.setAttribute('aria-label', this.l.back);
    this.$showMe = el('button', 'as-btn as-sec as-showme', this.l.showMe);
    this.$showMe.type = 'button';
    this.$next = el('button', 'as-btn as-next', this.l.next);
    this.$next.type = 'button';
    nav.appendChild(this.$back);
    nav.appendChild(this.$showMe);
    nav.appendChild(this.$next);
    side.appendChild(nav);
    if (t.footer) side.appendChild(el('div', 'as-footer', t.footer));

    // Device + screen
    var main = el('div', 'as-main');
    this.$device = el('div', 'as-device');
    this.$screen = el('div', 'as-screen');
    this.$screen.setAttribute('role', 'img');
    this.$shot = el('img', 'as-shot');
    this.$shot.alt = '';
    this.$shot.draggable = false;
    this.$mark = el('div', 'as-mark is-hidden');
    this.$hints = el('div', 'as-hints');
    this.$screen.appendChild(this.$shot);
    this.$screen.appendChild(this.$hints);
    this.$screen.appendChild(this.$mark);
    this.$device.appendChild(this.$screen);
    main.appendChild(this.$device);

    // Overlays: start, video, done
    this.$start = el('div', 'as-overlay as-start');
    this.$done = el('div', 'as-overlay as-done');
    this.$done.hidden = true;
    this.$video = el('div', 'as-overlay as-videowrap');
    this.$video.hidden = true;
    main.appendChild(this.$start);
    main.appendChild(this.$done);
    main.appendChild(this.$video);

    root.appendChild(side);
    root.appendChild(main);
    $container.addClass('h5p-appsim-container').empty().append(root);

    // Events
    this.$screen.addEventListener('click', function (e) {
      self.onScreenClick(e);
    });
    this.$next.addEventListener('click', function () {
      self.advance();
    });
    this.$back.addEventListener('click', function () {
      if (self.state.i > 0) {
        self.state.i -= 1;
        self.showStep();
      }
    });
    this.$showMe.addEventListener('click', function () {
      self.reveal(true);
    });
    this.$shot.addEventListener('load', function () {
      self.layout();
    });
    this.on('resize', function () {
      self.layout();
    });
    window.addEventListener('resize', function () {
      self.fitDevice();
    });

    if (!this.steps.length) {
      this.$start.appendChild(el('p', 'as-empty', 'No steps yet.'));
      return;
    }
    if (this.state.d) this.showDone();
    else this.renderStart();
  };

  // ------------------------------------------------------------------ screens
  AppSimulation.prototype.renderStart = function () {
    var self = this;
    var s = this.$start;
    s.innerHTML = '';
    s.hidden = false;
    this.root.classList.add('is-overlay');
    s.appendChild(el('h2', 'as-big', this.title));
    if (this.params.intro.text) s.appendChild(el('p', 'as-lead', this.params.intro.text));
    var minutes = Math.max(1, Math.round((this.steps.length * 12) / 60));
    var meta = el('div', 'as-startmeta');
    meta.appendChild(el('span', null, '~' + minutes + ' min'));
    s.appendChild(meta);
    var list = el('ol', 'as-chapters');
    this.chapters.forEach(function (c) {
      var li = el('li');
      li.appendChild(el('span', 'as-chapnum', String(c.index + 1).padStart(2, '0')));
      li.appendChild(el('span', null, c.title));
      list.appendChild(li);
    });
    s.appendChild(list);
    var row = el('div', 'as-row');
    var v = this.params.video || {};
    var hasVideo = this.params.behaviour.showVideoFirst && ((v.files && v.files.length) || embedUrl(v.url));
    if (hasVideo) {
      var w = el('button', 'as-btn as-sec', this.l.watch);
      w.type = 'button';
      w.addEventListener('click', function () {
        self.playVideo();
      });
      row.appendChild(w);
    }
    var go = el('button', 'as-btn', this.resumable ? this.l.resume : this.l.start);
    go.type = 'button';
    go.addEventListener('click', function () {
      self.state.p = 'practice';
      s.hidden = true;
      self.showStep();
    });
    row.appendChild(go);
    s.appendChild(row);
    this.trigger('resize');
  };

  AppSimulation.prototype.playVideo = function () {
    var self = this;
    var v = this.params.video;
    var wrap = this.$video;
    wrap.innerHTML = '';
    var embed = !(v.files && v.files.length) ? embedUrl(v.url) : null;
    if (embed) {
      var frame = el('iframe', 'as-embed');
      frame.src = embed;
      frame.title = this.l.watch;
      frame.allow = 'fullscreen; picture-in-picture; encrypted-media';
      frame.setAttribute('allowfullscreen', '');
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      wrap.appendChild(frame);
      var ebar = el('div', 'as-videobar');
      var ego = el('button', 'as-btn', this.l.toPractice);
      ego.type = 'button';
      ego.addEventListener('click', function () {
        wrap.hidden = true;
        wrap.innerHTML = '';
        self.state.p = 'practice';
        self.showStep();
      });
      ebar.appendChild(ego);
      wrap.appendChild(ebar);
      this.$start.hidden = true;
      wrap.hidden = false;
      this.trigger('resize');
      return;
    }
    var video = el('video');
    video.controls = true;
    video.setAttribute('playsinline', '');
    video.preload = 'metadata';
    (v.files || []).forEach(function (f) {
      if (!f || !f.path) return;
      var src = el('source');
      src.src = H5P.getPath(f.path, self.contentId);
      if (f.mime) src.type = f.mime;
      video.appendChild(src);
    });
    if (v.captions && v.captions.path) {
      var track = el('track');
      track.kind = 'captions';
      track.src = H5P.getPath(v.captions.path, this.contentId);
      track.srclang = v.captionsLanguage || 'en';
      track.label = (v.captionsLanguage || 'en').toUpperCase();
      track.default = true;
      video.appendChild(track);
    }
    wrap.appendChild(video);
    var bar = el('div', 'as-videobar');
    var go = el('button', 'as-btn', this.l.toPractice);
    go.type = 'button';
    go.addEventListener('click', function () {
      video.pause();
      wrap.hidden = true;
      wrap.innerHTML = '';
      self.state.p = 'practice';
      self.showStep();
    });
    bar.appendChild(go);
    wrap.appendChild(bar);
    this.$start.hidden = true;
    wrap.hidden = false;
    video.play().catch(function () {});
    this.trigger('resize');
  };

  AppSimulation.prototype.showStep = function () {
    var self = this;
    var i = this.state.i;
    var s = this.steps[i];
    if (!s) return;
    this.$start.hidden = true;
    this.$done.hidden = true;
    this.root.classList.remove('is-overlay');
    this.misses = 0;
    this.solved = false;
    this.setFeedback('', '');

    // sidebar
    [].forEach.call(this.$bars.children, function (b, k) {
      b.className = k < s.chapter ? 'done' : k === s.chapter ? 'on' : '';
    });
    var chapter = this.chapters.filter(function (c) {
      return c.index === s.chapter;
    })[0];
    var chapterPos = this.chapters.indexOf(chapter);
    this.$chap.innerHTML = '';
    var b = el('b', null, tpl(this.l.chapter, { num: chapterPos + 1, total: this.chapters.length }));
    this.$chap.appendChild(b);
    this.$chap.appendChild(document.createTextNode(' ' + (chapter ? chapter.title : '')));
    this.$num.textContent = s.kind === 'note' ? '!' : String(i + 1);
    this.$num.className = 'as-num' + (s.kind === 'note' ? ' is-note' : '');
    this.$num.style.setProperty('--p', String((i + 1) / this.steps.length));
    this.$label.textContent = s.label;
    this.$label.setAttribute('aria-label', tpl(this.l.step, { num: i + 1, total: this.steps.length }) + ': ' + s.label);
    this.$detail.textContent = s.detail;
    this.$detail.hidden = !s.detail;

    // screen
    if (s.shot && s.shot.path) {
      var src = H5P.getPath(s.shot.path, this.contentId);
      if (this.$shot.getAttribute('src') !== src) this.$shot.src = src;
      if (s.shot.width && s.shot.height) this.$screen.style.aspectRatio = s.shot.width + ' / ' + s.shot.height;
    }
    this.$screen.setAttribute('aria-label', this.l.screenLabel + ': ' + s.label);
    this.$screen.classList.toggle('is-task', s.kind === 'click');
    this.$mark.className = 'as-mark is-hidden' + (s.area && s.area.shape === 'ellipse' ? ' is-round' : '');
    this.$hints.innerHTML = '';

    var task = s.kind === 'click';
    this.$next.hidden = task;
    this.$showMe.hidden = !task;
    this.$back.hidden = !this.params.behaviour.allowBack;
    this.$back.disabled = i === 0;

    if (task) {
      // Already solved earlier (going back/resume): show as solved.
      if (this.state.r.charAt(this.taskIndex(i)) !== '') {
        this.solved = true;
        this.$next.hidden = false;
        this.$showMe.hidden = true;
        this.showMark();
      } else {
        this.setFeedback(this.l.doIt, '');
      }
    } else if (s.kind === 'explore') {
      this.setFeedback(this.l.explore, '');
      s.hints.forEach(function (h, k) {
        var btn = el('button', 'as-hint' + (h.area.shape === 'ellipse' ? ' is-round' : ''));
        btn.type = 'button';
        btn.setAttribute('aria-label', h.text);
        btn.dataset.k = String(k);
        var tip = el('span', 'as-tip', h.text);
        tip.setAttribute('role', 'tooltip');
        btn.appendChild(tip);
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          [].forEach.call(self.$hints.children, function (o) {
            if (o !== btn) o.classList.remove('is-open');
          });
          btn.classList.toggle('is-open');
        });
        self.$hints.appendChild(btn);
      });
    } else if (s.area && s.area.w > 0 && s.area.h > 0) {
      this.showMark();
    }

    this.layout();
    this.saveProgress();
    this.trigger('resize');
    // focus the instruction for screen readers / keyboard users
    try {
      this.$label.setAttribute('tabindex', '-1');
      if (this.root.contains(document.activeElement) || document.activeElement === document.body) this.$label.focus({ preventScroll: true });
    } catch (e) {
      /* ignore */
    }
  };

  AppSimulation.prototype.taskIndex = function (stepIndex) {
    var n = 0;
    for (var k = 0; k < stepIndex; k++) if (this.steps[k].kind === 'click') n++;
    return n;
  };

  AppSimulation.prototype.showMark = function () {
    this.$mark.classList.remove('is-hidden');
  };

  var FEEDBACK_ICONS = {
    ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    err: '<path d="M7 7l10 10M17 7 7 17"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'
  };
  AppSimulation.prototype.setFeedback = function (text, kind) {
    var f = this.$feedback;
    f.innerHTML = '';
    f.className = 'as-feedback' + (kind ? ' is-' + kind : '');
    if (!text) return;
    var ic = FEEDBACK_ICONS[kind || 'info'];
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ic;
    f.appendChild(svg);
    f.appendChild(el('span', null, text));
  };

  // Places the highlight and hint areas (percent based, so it survives resizing).
  AppSimulation.prototype.layout = function () {
    var s = this.steps[this.state.i];
    if (!s) return;
    var place = function (node, a, pad) {
      pad = pad || 0;
      node.style.left = (a.x * 100 - pad) + '%';
      node.style.top = (a.y * 100 - pad) + '%';
      node.style.width = (a.w * 100 + 2 * pad) + '%';
      node.style.height = (a.h * 100 + 2 * pad) + '%';
    };
    if (s.area) place(this.$mark, s.area, 0.4);
    var hints = this.$hints.children;
    for (var k = 0; k < hints.length; k++) {
      var h = s.hints[Number(hints[k].dataset.k)];
      if (h) place(hints[k], h.area, 0);
    }
    this.fitDevice();
  };

  // Keeps the device inside the available area while respecting the screenshot ratio.
  AppSimulation.prototype.fitDevice = function () {
    var main = this.$device.parentNode;
    if (!main || !this.$shot.naturalWidth) return;
    var ratio = this.$shot.naturalWidth / this.$shot.naturalHeight;
    // padding of the device frame in % of its width (see CSS), applied on all four sides
    var p = this.root.classList.contains('frame-none') ? 0 : this.root.classList.contains('frame-tablet') ? 0.022 : 0.026;
    var availW = main.clientWidth * 0.92;
    var availH = main.clientHeight * 0.92;
    if (availH < 200) availH = 200;
    // device height = width × ((1 − 2p) / ratio + 2p)
    var w = availH / ((1 - 2 * p) / ratio + 2 * p);
    if (w > availW) w = availW;
    this.$device.style.width = Math.floor(w) + 'px';
  };

  // ------------------------------------------------------------------ interaction
  AppSimulation.prototype.onScreenClick = function (e) {
    var s = this.steps[this.state.i];
    if (!s || s.kind !== 'click' || this.solved || this.state.p !== 'practice') return;
    var r = this.$screen.getBoundingClientRect();
    var px = (e.clientX - r.left) / r.width;
    var py = (e.clientY - r.top) / r.height;
    if (this.hit(s.area, px, py, r.width / r.height)) this.correct();
    else this.miss();
  };

  AppSimulation.prototype.hit = function (a, px, py, aspect) {
    var tol = clamp(this.params.behaviour.tolerance, 0, 100) / 100;
    // tolerance relative to the area, but at least ~2.5 % of the screen width
    var minPadX = 0.025;
    var minPadY = 0.025 * aspect;
    var padX = Math.max(a.w * tol / 2, minPadX);
    var padY = Math.max(a.h * tol / 2, minPadY);
    var x0 = a.x - padX;
    var y0 = a.y - padY;
    var x1 = a.x + a.w + padX;
    var y1 = a.y + a.h + padY;
    if (a.shape === 'ellipse') {
      var cx = (x0 + x1) / 2;
      var cy = (y0 + y1) / 2;
      var rx = (x1 - x0) / 2;
      var ry = (y1 - y0) / 2;
      return Math.pow((px - cx) / rx, 2) + Math.pow((py - cy) / ry, 2) <= 1;
    }
    return px >= x0 && px <= x1 && py >= y0 && py <= y1;
  };

  AppSimulation.prototype.correct = function () {
    var self = this;
    this.solved = true;
    this.showMark();
    this.setFeedback(this.l.good, 'ok');
    this.record(this.misses === 0 ? '1' : '0');
    setTimeout(function () {
      self.advance();
    }, 700);
  };

  AppSimulation.prototype.miss = function () {
    var self = this;
    this.misses += 1;
    this.$screen.classList.remove('is-shake');
    void this.$screen.offsetWidth;
    this.$screen.classList.add('is-shake');
    var limit = clamp(this.params.behaviour.hintAfter, 1, 5);
    if (this.misses >= limit) {
      this.showMark();
      this.setFeedback(this.l.hint, 'err');
    } else {
      this.setFeedback(this.l.miss, 'err');
    }
    setTimeout(function () {
      self.$screen.classList.remove('is-shake');
    }, 400);
  };

  // Keyboard / assistive path: reveal the step without tapping (no point).
  AppSimulation.prototype.reveal = function () {
    this.misses = Math.max(this.misses, 1);
    this.solved = true;
    this.showMark();
    this.setFeedback(this.l.hint, 'err');
    this.record('0');
    this.$showMe.hidden = true;
    this.$next.hidden = false;
    this.$next.focus();
  };

  AppSimulation.prototype.record = function (value) {
    var idx = this.taskIndex(this.state.i);
    if (this.state.r.charAt(idx) !== '') return; // only the first attempt counts
    while (this.state.r.length < idx) this.state.r += '0';
    this.state.r = this.state.r.slice(0, idx) + value + this.state.r.slice(idx + 1);
    this.saveProgress();
  };

  AppSimulation.prototype.advance = function () {
    if (this.state.i < this.steps.length - 1) {
      this.state.i += 1;
      this.showStep();
    } else {
      this.finish();
    }
  };

  AppSimulation.prototype.finish = function () {
    this.state.d = true;
    this.state.p = 'done';
    this.saveProgress();
    if (this.scored) {
      var score = this.getScore();
      this.triggerXAPIScored(score, this.taskCount, 'completed', true, undefined);
    } else {
      this.triggerXAPI('completed');
    }
    this.showDone();
  };

  AppSimulation.prototype.showDone = function () {
    var self = this;
    var d = this.$done;
    d.innerHTML = '';
    this.root.classList.add('is-overlay');
    d.appendChild(el('h2', 'as-big', this.l.doneTitle));
    d.appendChild(el('p', 'as-lead', this.l.doneText));
    if (this.scored) {
      var ring = el('div', 'as-ring');
      ring.style.setProperty('--p', String(this.taskCount ? this.getScore() / this.taskCount : 0));
      ring.appendChild(el('b', null, this.getScore() + '/' + this.taskCount));
      ring.setAttribute('aria-hidden', 'true');
      d.insertBefore(ring, d.firstChild);
      d.appendChild(el('p', 'as-score', tpl(this.l.score, { score: this.getScore(), total: this.taskCount })));
    }
    var again = el('button', 'as-btn as-sec', this.l.again);
    again.type = 'button';
    again.addEventListener('click', function () {
      self.state = { i: 0, r: '', p: 'practice', d: false };
      self.resumable = false;
      self.showStep();
    });
    var row = el('div', 'as-row');
    row.appendChild(again);
    d.appendChild(row);
    this.$start.hidden = true;
    d.hidden = false;
    this.trigger('resize');
  };

  AppSimulation.prototype.saveProgress = function () {
    // H5P core saves getCurrentState() on its own interval; nudge it on changes.
    if (this.state.p === 'practice' || this.state.d) {
      this.triggerXAPI('progressed');
    }
  };

  return AppSimulation;
})(H5P.jQuery, H5P.EventDispatcher);
