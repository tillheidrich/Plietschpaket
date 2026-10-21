/*
 * Plietschpaket block renderers. Pure DOM, no dependencies; used by the course player (player.js) and by the
 * editor's live preview. Each renderer returns an element. Interactive blocks report through ctx.
 *
 * ctx = {
 *   url(ref)                 → URL for "media:<file>" references
 *   label(key, vars)         → translated UI text
 *   state(blockId)           → saved state object of a block (or undefined)
 *   save(blockId, state)     → store state (score in state.s as 0..1, done in state.c)
 *   unit(unitId)             → { href, title } of an H5P unit or null
 *   lang                     → course language
 *   preview                  → true in the editor (no LMS, H5P units as placeholder)
 * }
 */
(function (root) {
  'use strict';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function html(tag, cls, markup) {
    var e = el(tag, cls);
    e.innerHTML = markup || ''; // markup is sanitised on the server (allowlist)
    return e;
  }
  function btn(cls, text, onClick) {
    var b = el('button', cls, text);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }
  var uid = 0;
  function nextId(p) {
    uid += 1;
    return (p || 'pp') + '-' + uid;
  }
  function shuffle(arr, seed) {
    var a = arr.slice();
    var s = seed || 7;
    for (var i = a.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      var j = Math.floor((s / 233280) * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  function seedOf(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
    return h + 1;
  }
  function icon(name) {
    var P = {
      check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
      x: '<path d="M6 6l12 12M18 6L6 18"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
      tip: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
      warning: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
      success: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
      key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l2 2M15 8l2 2"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      up: '<path d="M6 15l6-6 6 6"/>',
      down: '<path d="M6 9l6 6 6-6"/>',
      left: '<path d="M15 6l-6 6 6 6"/>',
      right: '<path d="M9 6l6 6-6 6"/>',
      file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
      link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L12 6.3"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      play: '<path d="M8 5v14l11-7z"/>'
    };
    return '<svg class="pp-ico" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }
  function feedback(ok, text, partial) {
    var f = el('div', 'pp-feedback ' + (ok ? 'is-ok' : partial ? 'is-partial' : 'is-wrong'));
    f.setAttribute('role', 'status');
    f.innerHTML = icon(ok ? 'check' : 'x');
    f.appendChild(el('div', 'pp-feedback-text', text));
    return f;
  }

  // ------------------------------------------------------------------ content
  var R = {};

  R.title = function (b, ctx) {
    var d = b.data;
    var w = el('header', 'pp-b-title' + (d.image ? ' has-image' : ''));
    if (d.image) {
      var img = el('img', 'pp-title-img');
      img.src = ctx.url(d.image);
      img.alt = '';
      w.appendChild(img);
    }
    var inner = el('div', 'pp-title-inner');
    if (d.kicker) inner.appendChild(el('span', 'pp-kicker', d.kicker));
    inner.appendChild(el('h2', 'pp-h1', d.content));
    inner.appendChild(el('i', 'pp-title-rule'));
    w.appendChild(inner);
    return w;
  };
  R.subtitle = function (b) {
    return el('h3', 'pp-b-subtitle pp-h2', b.data.content);
  };
  R.text = function (b) {
    return html('div', 'pp-b-text pp-prose', b.data.content);
  };
  R.list = function (b) {
    var ul = el('ul', 'pp-b-list');
    b.data.items.forEach(function (t) {
      ul.appendChild(el('li', '', t));
    });
    return ul;
  };
  R.numberedList = function (b) {
    var ol = el('ol', 'pp-b-numbered');
    b.data.items.forEach(function (t, i) {
      var li = el('li');
      li.appendChild(el('span', 'pp-num', String(i + 1)));
      li.appendChild(el('span', '', t));
      ol.appendChild(li);
    });
    return ol;
  };
  R.callout = function (b, ctx) {
    var v = b.data.variant || 'info';
    var w = el('aside', 'pp-b-callout v-' + v);
    var ic = el('span', 'pp-callout-icon');
    ic.innerHTML = icon(v);
    w.appendChild(ic);
    var body = el('div', 'pp-callout-body');
    body.appendChild(el('div', 'pp-callout-title', b.data.title || ctx.label('callout_' + v)));
    body.appendChild(html('div', 'pp-prose', b.data.content));
    w.appendChild(body);
    return w;
  };
  R.quote = function (b, ctx) {
    var f = el('figure', 'pp-b-quote');
    f.appendChild(el('blockquote', '', b.data.content));
    if (b.data.author || b.data.image) {
      var cap = el('figcaption');
      if (b.data.image) {
        var img = el('img');
        img.src = ctx.url(b.data.image);
        img.alt = '';
        cap.appendChild(img);
      }
      if (b.data.author) cap.appendChild(el('span', '', b.data.author));
      f.appendChild(cap);
    }
    return f;
  };
  R.statement = function (b) {
    var w = el('div', 'pp-b-statement s-' + (b.data.style || 'accent'));
    w.appendChild(el('p', '', b.data.content));
    return w;
  };
  R.accordion = function (b) {
    var w = el('div', 'pp-b-accordion');
    b.data.items.forEach(function (it) {
      var d = el('details');
      var s = el('summary');
      s.appendChild(el('span', '', it.heading));
      var chev = el('span', 'pp-chev');
      chev.innerHTML = icon('down');
      s.appendChild(chev);
      d.appendChild(s);
      d.appendChild(html('div', 'pp-acc-body pp-prose', it.content));
      w.appendChild(d);
    });
    return w;
  };
  R.tabs = function (b, ctx) {
    var w = el('div', 'pp-b-tabs');
    var list = el('div', 'pp-tablist');
    list.setAttribute('role', 'tablist');
    var panels = [];
    var tabs = [];
    var base = nextId('tab');
    b.data.tabs.forEach(function (t, i) {
      var tab = btn('pp-tab', t.title);
      tab.setAttribute('role', 'tab');
      tab.id = base + '-t' + i;
      tab.setAttribute('aria-controls', base + '-p' + i);
      var panel = el('div', 'pp-tabpanel');
      panel.setAttribute('role', 'tabpanel');
      panel.id = base + '-p' + i;
      panel.setAttribute('aria-labelledby', tab.id);
      if (t.image) {
        var img = el('img', 'pp-tab-img');
        img.src = ctx.url(t.image);
        img.alt = '';
        panel.appendChild(img);
      }
      panel.appendChild(html('div', 'pp-prose', t.content));
      tabs.push(tab);
      panels.push(panel);
      list.appendChild(tab);
    });
    function select(i) {
      tabs.forEach(function (t, k) {
        t.setAttribute('aria-selected', String(k === i));
        t.tabIndex = k === i ? 0 : -1;
        panels[k].hidden = k !== i;
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        select(i);
      });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          var n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          select(n);
          tabs[n].focus();
        }
      });
    });
    w.appendChild(list);
    panels.forEach(function (p) {
      w.appendChild(p);
    });
    select(0);
    return w;
  };
  R.timeline = function (b) {
    var ol = el('ol', 'pp-b-timeline');
    b.data.items.forEach(function (it) {
      var li = el('li');
      li.appendChild(el('i', 'pp-tl-dot'));
      if (it.date) li.appendChild(el('span', 'pp-tl-date', it.date));
      li.appendChild(el('strong', 'pp-tl-title', it.title));
      if (it.content) li.appendChild(html('div', 'pp-prose pp-tl-body', it.content));
      ol.appendChild(li);
    });
    return ol;
  };
  R.divider = function (b) {
    var w = el('div', 'pp-b-divider' + (b.data.label ? ' has-label' : ''));
    w.setAttribute('role', 'separator');
    if (b.data.label) w.appendChild(el('span', '', b.data.label));
    return w;
  };
  R.process = function (b, ctx) {
    var steps = b.data.steps;
    var w = el('div', 'pp-b-process');
    var rail = el('ol', 'pp-proc-rail');
    var stage = el('div', 'pp-proc-stage');
    stage.setAttribute('aria-live', 'polite');
    var nav = el('div', 'pp-proc-nav');
    var prev = btn('pp-btn pp-btn-ghost', ctx.label('prev'));
    var next = btn('pp-btn pp-btn-primary', ctx.label('next'));
    var cur = 0;
    var dots = steps.map(function (s, i) {
      var li = el('li');
      var d = btn('pp-proc-dot', String(i + 1), function () {
        show(i);
      });
      d.setAttribute('aria-label', s.title);
      li.appendChild(d);
      rail.appendChild(li);
      return d;
    });
    function show(i) {
      cur = i;
      stage.innerHTML = '';
      stage.appendChild(el('span', 'pp-proc-count', ctx.label('step', { num: i + 1, total: steps.length })));
      stage.appendChild(el('h4', 'pp-h3', steps[i].title));
      if (steps[i].content) stage.appendChild(html('div', 'pp-prose', steps[i].content));
      dots.forEach(function (d, k) {
        d.classList.toggle('is-current', k === i);
        d.classList.toggle('is-done', k < i);
        d.setAttribute('aria-current', k === i ? 'step' : 'false');
      });
      prev.disabled = i === 0;
      next.disabled = i === steps.length - 1;
    }
    prev.addEventListener('click', function () {
      show(Math.max(0, cur - 1));
    });
    next.addEventListener('click', function () {
      show(Math.min(steps.length - 1, cur + 1));
    });
    nav.appendChild(prev);
    nav.appendChild(next);
    w.appendChild(rail);
    w.appendChild(stage);
    w.appendChild(nav);
    show(0);
    return w;
  };
  R.columns = function (b) {
    var w = el('div', 'pp-b-columns');
    [['leftTitle', 'left'], ['rightTitle', 'right']].forEach(function (k) {
      var c = el('div', 'pp-col');
      if (b.data[k[0]]) c.appendChild(el('h4', 'pp-h3', b.data[k[0]]));
      c.appendChild(html('div', 'pp-prose', b.data[k[1]]));
      w.appendChild(c);
    });
    return w;
  };
  R.furtherReading = function (b, ctx) {
    var w = el('div', 'pp-b-reading');
    w.appendChild(el('div', 'pp-eyebrow', b.data.title || ctx.label('furtherReading')));
    b.data.links.forEach(function (l) {
      var a = el('a', 'pp-reading-link');
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      var ic = el('span', 'pp-reading-icon');
      ic.innerHTML = icon('link');
      a.appendChild(ic);
      var t = el('span', 'pp-reading-text');
      t.appendChild(el('strong', '', l.title));
      if (l.description) t.appendChild(el('span', '', l.description));
      a.appendChild(t);
      w.appendChild(a);
    });
    return w;
  };

  // ------------------------------------------------------------------ media
  function img(ctx, ref, alt, cls) {
    var i = el('img', cls);
    i.src = ctx.url(ref);
    i.alt = alt || '';
    i.loading = 'lazy';
    i.decoding = 'async';
    return i;
  }
  R.imageText = function (b, ctx) {
    var w = el('div', 'pp-b-imagetext side-' + (b.data.side || 'left'));
    var fig = el('div', 'pp-it-media');
    fig.appendChild(img(ctx, b.data.image, b.data.alt));
    var body = el('div', 'pp-it-body');
    if (b.data.title) body.appendChild(el('h4', 'pp-h3', b.data.title));
    body.appendChild(html('div', 'pp-prose', b.data.content));
    w.appendChild(fig);
    w.appendChild(body);
    return w;
  };
  R.image = function (b, ctx) {
    var f = el('figure', 'pp-b-image size-' + (b.data.size || 'wide'));
    f.appendChild(img(ctx, b.data.image, b.data.alt));
    if (b.data.caption) f.appendChild(el('figcaption', '', b.data.caption));
    return f;
  };
  R.gallery = function (b, ctx) {
    var imgs = b.data.images;
    if (b.data.layout === 'carousel') {
      var w = el('div', 'pp-b-carousel');
      var track = el('div', 'pp-car-track');
      imgs.forEach(function (it) {
        var f = el('figure', 'pp-car-slide');
        f.appendChild(img(ctx, it.image, it.alt));
        if (it.caption) f.appendChild(el('figcaption', '', it.caption));
        track.appendChild(f);
      });
      var prev = btn('pp-car-btn prev', '');
      prev.innerHTML = icon('left');
      prev.setAttribute('aria-label', ctx.label('prev'));
      var next = btn('pp-car-btn next', '');
      next.innerHTML = icon('right');
      next.setAttribute('aria-label', ctx.label('next'));
      var go = function (dir) {
        track.scrollBy({ left: dir * track.clientWidth, behavior: 'smooth' });
      };
      prev.addEventListener('click', function () {
        go(-1);
      });
      next.addEventListener('click', function () {
        go(1);
      });
      w.appendChild(track);
      w.appendChild(prev);
      w.appendChild(next);
      return w;
    }
    var g = el('div', 'pp-b-gallery n-' + Math.min(4, imgs.length));
    imgs.forEach(function (it) {
      var bt = btn('pp-gal-item');
      bt.appendChild(img(ctx, it.image, it.alt));
      bt.setAttribute('aria-label', it.alt || it.caption || ctx.label('enlarge'));
      bt.addEventListener('click', function () {
        lightbox(ctx, it);
      });
      g.appendChild(bt);
    });
    return g;
  };
  function lightbox(ctx, it) {
    var d = el('dialog', 'pp-lightbox');
    var f = el('figure');
    f.appendChild(img(ctx, it.image, it.alt));
    if (it.caption) f.appendChild(el('figcaption', '', it.caption));
    var close = btn('pp-lb-close', '');
    close.innerHTML = icon('x');
    close.setAttribute('aria-label', ctx.label('close'));
    close.addEventListener('click', function () {
      d.close();
    });
    d.appendChild(close);
    d.appendChild(f);
    d.addEventListener('close', function () {
      d.remove();
    });
    d.addEventListener('click', function (e) {
      if (e.target === d) d.close();
    });
    document.body.appendChild(d);
    if (d.showModal) d.showModal();
  }
  function embedUrl(url) {
    var m = String(url || '').match(/^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtube-nocookie\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{6,20})/);
    if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0&modestbranding=1';
    m = String(url || '').match(/^https:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{5,12})/);
    if (m) return 'https://player.vimeo.com/video/' + m[1] + '?dnt=1';
    return null;
  }
  R.video = function (b, ctx) {
    var f = el('figure', 'pp-b-video');
    var src = b.data.url && embedUrl(b.data.url);
    if (src) {
      var fr = el('iframe');
      fr.src = src;
      fr.title = b.data.title || 'Video';
      fr.allow = 'fullscreen; picture-in-picture';
      fr.setAttribute('allowfullscreen', '');
      fr.loading = 'lazy';
      f.appendChild(fr);
    } else if (b.data.file) {
      var v = el('video');
      v.controls = true;
      v.preload = 'metadata';
      v.playsInline = true;
      if (b.data.poster) v.poster = ctx.url(b.data.poster);
      var s = el('source');
      s.src = ctx.url(b.data.file);
      v.appendChild(s);
      if (b.data.captions) {
        var t = el('track');
        t.kind = 'captions';
        t.src = ctx.url(b.data.captions);
        t.srclang = String(ctx.lang || 'de').slice(0, 2);
        t.label = ctx.label('captions');
        t.default = true;
        v.appendChild(t);
      }
      v.addEventListener('ended', function () {
        ctx.save(b.id, { c: 1 });
      });
      f.appendChild(v);
    }
    if (b.data.title) f.appendChild(el('figcaption', '', b.data.title));
    return f;
  };
  R.audio = function (b, ctx) {
    var w = el('div', 'pp-b-audio');
    if (b.data.title) w.appendChild(el('div', 'pp-audio-title', b.data.title));
    var a = el('audio');
    a.controls = true;
    a.preload = 'metadata';
    a.src = ctx.url(b.data.file);
    w.appendChild(a);
    if (b.data.transcript) {
      var d = el('details', 'pp-transcript');
      d.appendChild(el('summary', '', ctx.label('transcript')));
      d.appendChild(html('div', 'pp-prose', b.data.transcript));
      w.appendChild(d);
    }
    return w;
  };
  R.file = function (b, ctx) {
    var a = el('a', 'pp-b-file');
    a.href = ctx.url(b.data.file);
    a.setAttribute('download', '');
    var ic = el('span', 'pp-file-icon');
    ic.innerHTML = icon('file');
    a.appendChild(ic);
    var t = el('span', 'pp-file-text');
    t.appendChild(el('strong', '', b.data.name));
    t.appendChild(el('span', '', b.data.description || ctx.label('download')));
    a.appendChild(t);
    a.appendChild(el('span', 'pp-file-cta', ctx.label('download')));
    return a;
  };
  R.banner = function (b, ctx) {
    var w = el('div', 'pp-b-banner');
    w.appendChild(img(ctx, b.data.image, ''));
    var t = el('div', 'pp-banner-text');
    t.appendChild(el('h3', 'pp-h1', b.data.heading));
    if (b.data.text) t.appendChild(el('p', '', b.data.text));
    w.appendChild(t);
    return w;
  };

  // ------------------------------------------------------------------ interactive helpers
  function isCorrectSet(chosen, correct) {
    if (chosen.length !== correct.length) return false;
    for (var i = 0; i < correct.length; i++) if (chosen.indexOf(correct[i]) === -1) return false;
    return true;
  }
  function questionView(q, ctx, opts) {
    // returns { el, check(): {ok, chosen} , lock(chosen) }
    var multiple = q.multiple || (q.correct && q.correct.length > 1);
    var w = el('fieldset', 'pp-q');
    var lg = el('legend', 'pp-q-text', q.question);
    w.appendChild(lg);
    if (multiple) w.appendChild(el('div', 'pp-q-hint', ctx.label('selectAll')));
    var name = nextId('q');
    var order = q.options.map(function (_, i) {
      return i;
    });
    if (opts && opts.shuffle) order = shuffle(order, seedOf(q.question));
    var inputs = [];
    order.forEach(function (i) {
      var lab = el('label', 'pp-opt');
      var inp = el('input');
      inp.type = multiple ? 'checkbox' : 'radio';
      inp.name = name;
      inp.value = String(i);
      lab.appendChild(inp);
      lab.appendChild(el('span', 'pp-opt-mark'));
      lab.appendChild(el('span', 'pp-opt-text', q.options[i]));
      inputs.push(inp);
      w.appendChild(lab);
    });
    return {
      el: w,
      chosen: function () {
        return inputs
          .filter(function (x) {
            return x.checked;
          })
          .map(function (x) {
            return Number(x.value);
          });
      },
      onChange: function (fn) {
        inputs.forEach(function (x) {
          x.addEventListener('change', fn);
        });
      },
      lock: function (chosen, reveal) {
        inputs.forEach(function (x) {
          var i = Number(x.value);
          x.checked = chosen.indexOf(i) !== -1;
          x.disabled = true;
          var lab = x.parentNode;
          if (reveal && q.correct.indexOf(i) !== -1) lab.classList.add('is-correct');
          if (chosen.indexOf(i) !== -1 && q.correct.indexOf(i) === -1) lab.classList.add('is-wrong');
        });
      }
    };
  }

  function graded(b, ctx, root, build) {
    // shared wrapper: renders, restores a saved answer, reports score
    var saved = ctx.state(b.id);
    build(saved, function (score, response) {
      ctx.save(b.id, { s: score, c: 1, r: response });
    });
    root.classList.add('pp-graded');
    return root;
  }

  // ------------------------------------------------------------------ interactive
  R.quiz = function (b, ctx) {
    var w = el('div', 'pp-b-quiz pp-card');
    return graded(b, ctx, w, function (saved, report) {
      w.appendChild(el('div', 'pp-eyebrow', ctx.label('knowledgeCheck')));
      var qv = questionView(b.data, ctx, { shuffle: false });
      w.appendChild(qv.el);
      var actions = el('div', 'pp-actions');
      var submit = btn('pp-btn pp-btn-primary', ctx.label('check'));
      submit.disabled = true;
      qv.onChange(function () {
        submit.disabled = !qv.chosen().length;
      });
      var fbSlot = el('div');
      function show(chosen) {
        var ok = isCorrectSet(chosen, b.data.correct);
        qv.lock(chosen, true);
        submit.remove();
        fbSlot.innerHTML = '';
        fbSlot.appendChild(feedback(ok, ok ? ctx.label('correct') : ctx.label('incorrect')));
        if (b.data.explanation) fbSlot.appendChild(el('p', 'pp-explain', b.data.explanation));
        return ok;
      }
      submit.addEventListener('click', function () {
        var chosen = qv.chosen();
        var ok = show(chosen);
        report(ok ? 1 : 0, chosen);
      });
      actions.appendChild(submit);
      w.appendChild(actions);
      w.appendChild(fbSlot);
      if (saved && saved.r) show(saved.r);
    });
  };

  R.flipcard = function (b, ctx) {
    var w = el('div', 'pp-b-flip n-' + Math.min(3, b.data.cards.length));
    b.data.cards.forEach(function (c) {
      var card = btn('pp-flip');
      card.setAttribute('aria-pressed', 'false');
      var inner = el('span', 'pp-flip-inner');
      var front = el('span', 'pp-flip-face pp-flip-front');
      if (c.image) front.appendChild(img(ctx, c.image, ''));
      front.appendChild(el('span', 'pp-flip-text', c.front));
      front.appendChild(el('span', 'pp-flip-hint', ctx.label('flip')));
      var back = el('span', 'pp-flip-face pp-flip-back');
      back.appendChild(el('span', 'pp-flip-text', c.back));
      inner.appendChild(front);
      inner.appendChild(back);
      card.appendChild(inner);
      card.addEventListener('click', function () {
        var on = !card.classList.contains('is-flipped');
        card.classList.toggle('is-flipped', on);
        card.setAttribute('aria-pressed', String(on));
      });
      w.appendChild(card);
    });
    return w;
  };

  R.matching = function (b, ctx) {
    var w = el('div', 'pp-b-matching pp-card');
    return graded(b, ctx, w, function (saved, report) {
      w.appendChild(el('div', 'pp-eyebrow', ctx.label('matching')));
      if (b.data.prompt) w.appendChild(el('p', 'pp-q-text', b.data.prompt));
      var rights = shuffle(
        b.data.pairs.map(function (p, i) {
          return i;
        }),
        seedOf(b.id)
      );
      var rows = [];
      var list = el('div', 'pp-match-rows');
      b.data.pairs.forEach(function (p, i) {
        var row = el('label', 'pp-match-row');
        row.appendChild(el('span', 'pp-match-left', p.left));
        var sel = el('select', 'pp-select');
        var o0 = el('option', '', ctx.label('choose'));
        o0.value = '';
        sel.appendChild(o0);
        rights.forEach(function (ri) {
          var o = el('option', '', b.data.pairs[ri].right);
          o.value = String(ri);
          sel.appendChild(o);
        });
        row.appendChild(sel);
        rows.push({ sel: sel, row: row, i: i });
        list.appendChild(row);
      });
      w.appendChild(list);
      var submit = btn('pp-btn pp-btn-primary', ctx.label('check'));
      var fb = el('div');
      function lock(resp) {
        var good = 0;
        rows.forEach(function (r, k) {
          r.sel.value = resp[k] === undefined ? '' : String(resp[k]);
          r.sel.disabled = true;
          var ok = Number(resp[k]) === r.i;
          if (ok) good++;
          r.row.classList.add(ok ? 'is-correct' : 'is-wrong');
          if (!ok) r.row.appendChild(el('span', 'pp-match-solution', b.data.pairs[r.i].right));
        });
        submit.remove();
        var score = good / rows.length;
        fb.appendChild(feedback(score === 1, ctx.label('result', { good: good, total: rows.length }), score > 0));
        return score;
      }
      submit.addEventListener('click', function () {
        var resp = rows.map(function (r) {
          return r.sel.value === '' ? -1 : Number(r.sel.value);
        });
        report(lock(resp), resp);
      });
      var a = el('div', 'pp-actions');
      a.appendChild(submit);
      w.appendChild(a);
      w.appendChild(fb);
      if (saved && saved.r) lock(saved.r);
    });
  };

  R.sorting = function (b, ctx) {
    var w = el('div', 'pp-b-sorting pp-card');
    return graded(b, ctx, w, function (saved, report) {
      w.appendChild(el('div', 'pp-eyebrow', ctx.label('sorting')));
      if (b.data.prompt) w.appendChild(el('p', 'pp-q-text', b.data.prompt));
      var items = b.data.items;
      var order = shuffle(
        items.map(function (_, i) {
          return i;
        }),
        seedOf(b.id)
      );
      if (order.every(function (v, i) { return v === i; })) order.reverse();
      var list = el('ol', 'pp-sort-list');
      var locked = false;
      function render() {
        list.innerHTML = '';
        order.forEach(function (idx, pos) {
          var li = el('li', 'pp-sort-item');
          li.draggable = !locked;
          li.dataset.pos = String(pos);
          li.appendChild(el('span', 'pp-sort-grip', '⋮⋮'));
          li.appendChild(el('span', 'pp-sort-text', items[idx]));
          if (!locked) {
            var up = btn('pp-icon-btn', '');
            up.innerHTML = icon('up');
            up.setAttribute('aria-label', ctx.label('moveUp'));
            up.disabled = pos === 0;
            up.addEventListener('click', function () {
              move(pos, pos - 1);
            });
            var dn = btn('pp-icon-btn', '');
            dn.innerHTML = icon('down');
            dn.setAttribute('aria-label', ctx.label('moveDown'));
            dn.disabled = pos === order.length - 1;
            dn.addEventListener('click', function () {
              move(pos, pos + 1);
            });
            li.appendChild(up);
            li.appendChild(dn);
            li.addEventListener('dragstart', function (e) {
              e.dataTransfer.setData('text/plain', String(pos));
              li.classList.add('is-drag');
            });
            li.addEventListener('dragend', function () {
              li.classList.remove('is-drag');
            });
            li.addEventListener('dragover', function (e) {
              e.preventDefault();
            });
            li.addEventListener('drop', function (e) {
              e.preventDefault();
              move(Number(e.dataTransfer.getData('text/plain')), pos);
            });
          } else {
            li.classList.add(idx === pos ? 'is-correct' : 'is-wrong');
          }
          list.appendChild(li);
        });
      }
      function move(from, to) {
        if (to < 0 || to >= order.length) return;
        var v = order.splice(from, 1)[0];
        order.splice(to, 0, v);
        render();
        var f = list.children[to] && list.children[to].querySelector('.pp-icon-btn');
        if (f) f.focus();
      }
      var submit = btn('pp-btn pp-btn-primary', ctx.label('check'));
      var fb = el('div');
      function lock(resp) {
        order = resp.slice();
        locked = true;
        render();
        submit.remove();
        var good = order.filter(function (v, i) {
          return v === i;
        }).length;
        fb.appendChild(feedback(good === order.length, ctx.label('result', { good: good, total: order.length }), good > 0));
        return good / order.length;
      }
      submit.addEventListener('click', function () {
        var resp = order.slice();
        report(lock(resp), resp);
      });
      w.appendChild(list);
      var a = el('div', 'pp-actions');
      a.appendChild(submit);
      w.appendChild(a);
      w.appendChild(fb);
      render();
      if (saved && saved.r) lock(saved.r);
    });
  };

  R.fillBlanks = function (b, ctx) {
    var w = el('div', 'pp-b-blanks pp-card');
    return graded(b, ctx, w, function (saved, report) {
      w.appendChild(el('div', 'pp-eyebrow', ctx.label('fillBlanks')));
      if (b.data.prompt) w.appendChild(el('p', 'pp-q-text', b.data.prompt));
      var p = el('p', 'pp-blanks-text');
      var gaps = [];
      var re = /\[([^\]]+)\]/g;
      var last = 0;
      var m;
      var text = b.data.text;
      while ((m = re.exec(text))) {
        p.appendChild(document.createTextNode(text.slice(last, m.index)));
        var answers = m[1].split('|').map(function (s) {
          return s.trim();
        });
        var inp = el('input', 'pp-gap');
        inp.type = 'text';
        inp.autocomplete = 'off';
        inp.spellcheck = false;
        inp.setAttribute('aria-label', ctx.label('gap', { num: gaps.length + 1 }));
        inp.size = Math.max(4, answers[0].length + 1);
        gaps.push({ inp: inp, answers: answers });
        p.appendChild(inp);
        last = re.lastIndex;
      }
      p.appendChild(document.createTextNode(text.slice(last)));
      w.appendChild(p);
      var submit = btn('pp-btn pp-btn-primary', ctx.label('check'));
      var fb = el('div');
      var norm = function (s) {
        s = String(s || '').trim().replace(/\s+/g, ' ');
        return b.data.caseSensitive ? s : s.toLowerCase();
      };
      function lock(resp) {
        var good = 0;
        gaps.forEach(function (g, i) {
          g.inp.value = resp[i] || '';
          g.inp.disabled = true;
          var ok = g.answers.some(function (a) {
            return norm(a) === norm(resp[i]);
          });
          if (ok) good++;
          g.inp.classList.add(ok ? 'is-correct' : 'is-wrong');
          if (!ok) {
            var sol = el('span', 'pp-gap-solution', g.answers[0]);
            g.inp.after(sol);
          }
        });
        submit.remove();
        fb.appendChild(feedback(good === gaps.length, ctx.label('result', { good: good, total: gaps.length }), good > 0));
        return gaps.length ? good / gaps.length : 1;
      }
      submit.addEventListener('click', function () {
        var resp = gaps.map(function (g) {
          return g.inp.value;
        });
        report(lock(resp), resp);
      });
      var a = el('div', 'pp-actions');
      a.appendChild(submit);
      w.appendChild(a);
      w.appendChild(fb);
      if (saved && saved.r) lock(saved.r);
    });
  };

  R.hotspot = function (b, ctx) {
    var w = el('div', 'pp-b-hotspot');
    var stage = el('div', 'pp-hs-stage');
    stage.appendChild(img(ctx, b.data.image, b.data.alt));
    var pop = el('div', 'pp-hs-pop');
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    var open = null;
    b.data.spots.forEach(function (s, i) {
      var p = btn('pp-hs-pin', String(i + 1));
      p.style.left = s.x * 100 + '%';
      p.style.top = s.y * 100 + '%';
      p.setAttribute('aria-label', s.title);
      p.setAttribute('aria-expanded', 'false');
      p.addEventListener('click', function () {
        if (open === i) {
          pop.hidden = true;
          open = null;
          p.setAttribute('aria-expanded', 'false');
          return;
        }
        open = i;
        [].forEach.call(stage.querySelectorAll('.pp-hs-pin'), function (x) {
          x.setAttribute('aria-expanded', 'false');
          x.classList.remove('is-open');
        });
        p.setAttribute('aria-expanded', 'true');
        p.classList.add('is-open', 'is-seen');
        pop.innerHTML = '';
        pop.appendChild(el('strong', '', s.title));
        if (s.content) pop.appendChild(html('div', 'pp-prose', s.content));
        pop.style.left = Math.min(70, Math.max(2, s.x * 100 - 14)) + '%';
        pop.style.top = (s.y > 0.6 ? s.y * 100 - 4 : s.y * 100 + 6) + '%';
        pop.classList.toggle('is-above', s.y > 0.6);
        pop.hidden = false;
      });
      stage.appendChild(p);
    });
    stage.appendChild(pop);
    w.appendChild(stage);
    w.appendChild(el('p', 'pp-hint', ctx.label('hotspotHint')));
    return w;
  };

  R.bucketSort = function (b, ctx) {
    var w = el('div', 'pp-b-bucket pp-card');
    return graded(b, ctx, w, function (saved, report) {
      w.appendChild(el('div', 'pp-eyebrow', ctx.label('bucketSort')));
      if (b.data.prompt) w.appendChild(el('p', 'pp-q-text', b.data.prompt));
      var all = [];
      b.data.buckets.forEach(function (bk, bi) {
        bk.items.forEach(function (t) {
          all.push({ t: t, bucket: bi });
        });
      });
      all = shuffle(all, seedOf(b.id));
      var placed = all.map(function () {
        return -1;
      });
      var pool = el('div', 'pp-bk-pool');
      var bins = el('div', 'pp-bk-bins n-' + b.data.buckets.length);
      var binEls = b.data.buckets.map(function (bk, bi) {
        var bin = el('div', 'pp-bk-bin');
        bin.appendChild(el('div', 'pp-bk-name', bk.name));
        var drop = el('div', 'pp-bk-drop');
        drop.dataset.bin = String(bi);
        drop.addEventListener('dragover', function (e) {
          e.preventDefault();
          drop.classList.add('is-over');
        });
        drop.addEventListener('dragleave', function () {
          drop.classList.remove('is-over');
        });
        drop.addEventListener('drop', function (e) {
          e.preventDefault();
          drop.classList.remove('is-over');
          place(Number(e.dataTransfer.getData('text/plain')), bi);
        });
        bin.appendChild(drop);
        bins.appendChild(bin);
        return drop;
      });
      var locked = false;
      function chip(i) {
        var c = el('div', 'pp-chip');
        c.draggable = !locked;
        c.appendChild(el('span', '', all[i].t));
        if (!locked) {
          var sel = el('select', 'pp-chip-select');
          sel.setAttribute('aria-label', ctx.label('chooseCategory', { item: all[i].t }));
          var o0 = el('option', '', '…');
          o0.value = '-1';
          sel.appendChild(o0);
          b.data.buckets.forEach(function (bk, bi) {
            var o = el('option', '', bk.name);
            o.value = String(bi);
            sel.appendChild(o);
          });
          sel.value = String(placed[i]);
          sel.addEventListener('change', function () {
            place(i, Number(sel.value));
          });
          c.appendChild(sel);
          c.addEventListener('dragstart', function (e) {
            e.dataTransfer.setData('text/plain', String(i));
          });
        } else {
          c.classList.add(placed[i] === all[i].bucket ? 'is-correct' : 'is-wrong');
        }
        return c;
      }
      function render() {
        pool.innerHTML = '';
        binEls.forEach(function (d) {
          d.innerHTML = '';
        });
        all.forEach(function (_, i) {
          (placed[i] === -1 ? pool : binEls[placed[i]]).appendChild(chip(i));
        });
        pool.hidden = locked && !pool.children.length;
        submit.disabled = placed.some(function (p) {
          return p === -1;
        });
      }
      function place(i, bi) {
        if (locked) return;
        placed[i] = bi;
        render();
      }
      var submit = btn('pp-btn pp-btn-primary', ctx.label('check'));
      var fb = el('div');
      function lock(resp) {
        placed = resp.slice();
        locked = true;
        render();
        submit.remove();
        var good = all.filter(function (it, i) {
          return placed[i] === it.bucket;
        }).length;
        fb.appendChild(feedback(good === all.length, ctx.label('result', { good: good, total: all.length }), good > 0));
        return good / all.length;
      }
      submit.addEventListener('click', function () {
        var resp = placed.slice();
        report(lock(resp), resp);
      });
      w.appendChild(pool);
      w.appendChild(bins);
      var a = el('div', 'pp-actions');
      a.appendChild(submit);
      w.appendChild(a);
      w.appendChild(fb);
      render();
      if (saved && saved.r) lock(saved.r);
    });
  };

  R.essay = function (b, ctx) {
    var w = el('div', 'pp-b-essay pp-card');
    var saved = ctx.state(b.id) || {};
    w.appendChild(el('div', 'pp-eyebrow', ctx.label('essay')));
    w.appendChild(el('p', 'pp-q-text', b.data.prompt));
    var ta = el('textarea', 'pp-textarea');
    ta.rows = 7;
    ta.value = saved.t || '';
    ta.setAttribute('aria-label', b.data.prompt);
    var meta = el('div', 'pp-essay-meta');
    var count = function () {
      var n = (ta.value.trim().match(/\S+/g) || []).length;
      meta.textContent = ctx.label('words', { n: n }) + (b.data.minWords ? ' · ' + ctx.label('minWords', { n: b.data.minWords }) : '');
      submit.disabled = n < (b.data.minWords || 1);
    };
    var submit = btn('pp-btn pp-btn-primary', ctx.label('submit'));
    var out = el('div');
    function done() {
      ta.readOnly = true;
      submit.remove();
      out.appendChild(feedback(true, ctx.label('submitted')));
      if (b.data.sample) {
        var d = el('details', 'pp-sample');
        d.appendChild(el('summary', '', ctx.label('sampleAnswer')));
        d.appendChild(html('div', 'pp-prose', b.data.sample));
        out.appendChild(d);
      }
    }
    ta.addEventListener('input', count);
    submit.addEventListener('click', function () {
      ctx.save(b.id, { c: 1, t: ta.value.slice(0, 8000) });
      done();
    });
    w.appendChild(ta);
    w.appendChild(meta);
    var a = el('div', 'pp-actions');
    a.appendChild(submit);
    w.appendChild(a);
    w.appendChild(out);
    count();
    if (saved.c) done();
    return w;
  };

  R.checklist = function (b, ctx) {
    var w = el('div', 'pp-b-checklist pp-card');
    var saved = ctx.state(b.id) || {};
    var ticks = saved.k || [];
    if (b.data.title) w.appendChild(el('h4', 'pp-h3', b.data.title));
    var bar = el('div', 'pp-check-progress');
    var fill = el('i');
    bar.appendChild(fill);
    w.appendChild(bar);
    var list = el('ul', 'pp-check-list');
    var boxes = b.data.items.map(function (t, i) {
      var li = el('li');
      var lab = el('label', 'pp-check');
      var inp = el('input');
      inp.type = 'checkbox';
      inp.checked = ticks.indexOf(i) !== -1;
      lab.appendChild(inp);
      lab.appendChild(el('span', 'pp-check-box'));
      lab.appendChild(el('span', 'pp-check-text', t));
      li.appendChild(lab);
      list.appendChild(li);
      inp.addEventListener('change', update);
      return inp;
    });
    function update() {
      var k = [];
      boxes.forEach(function (x, i) {
        if (x.checked) k.push(i);
      });
      fill.style.transform = 'scaleX(' + k.length / boxes.length + ')';
      ctx.save(b.id, { k: k, c: k.length === boxes.length ? 1 : 0 });
    }
    w.appendChild(list);
    fill.style.transform = 'scaleX(' + ticks.length / boxes.length + ')';
    return w;
  };

  R.assessment = function (b, ctx) {
    var d = b.data;
    var w = el('section', 'pp-b-assessment pp-card');
    w.classList.add('pp-graded');
    var saved = ctx.state(b.id) || {};
    var qs = d.questions;
    var timer = null;

    function intro() {
      clearInterval(timer);
      w.innerHTML = '';
      w.appendChild(el('div', 'pp-eyebrow', ctx.label('assessment')));
      w.appendChild(el('h3', 'pp-h2', d.title || ctx.label('assessment')));
      if (d.intro) w.appendChild(el('p', 'pp-lead', d.intro));
      var facts = el('ul', 'pp-as-facts');
      facts.appendChild(el('li', '', ctx.label('questions', { n: qs.length })));
      facts.appendChild(el('li', '', ctx.label('passMark', { n: d.passPercent })));
      if (d.timeLimit) facts.appendChild(el('li', '', ctx.label('timeLimit', { n: d.timeLimit })));
      w.appendChild(facts);
      if (typeof saved.s === 'number') w.appendChild(resultCard(saved, false));
      var a = el('div', 'pp-actions');
      a.appendChild(btn('pp-btn pp-btn-primary', typeof saved.s === 'number' ? ctx.label('retry') : ctx.label('startTest'), run));
      w.appendChild(a);
    }

    function run() {
      var order = qs.map(function (_, i) {
        return i;
      });
      if (d.shuffle) order = shuffle(order, Date.now() % 997);
      var answers = [];
      var i = 0;
      var deadline = d.timeLimit ? Date.now() + d.timeLimit * 60000 : 0;
      w.innerHTML = '';
      var head = el('div', 'pp-as-head');
      var count = el('span', 'pp-as-count');
      var clock = el('span', 'pp-as-clock');
      head.appendChild(count);
      if (deadline) head.appendChild(clock);
      var prog = el('div', 'pp-as-progress');
      var fill = el('i');
      prog.appendChild(fill);
      var slot = el('div', 'pp-as-slot');
      w.appendChild(head);
      w.appendChild(prog);
      w.appendChild(slot);
      if (deadline) {
        var tick = function () {
          var left = Math.max(0, deadline - Date.now());
          var mm = Math.floor(left / 60000);
          var ss = Math.floor((left % 60000) / 1000);
          clock.innerHTML = icon('clock') + mm + ':' + (ss < 10 ? '0' : '') + ss;
          clock.classList.toggle('is-low', left < 60000);
          if (!left) {
            clearInterval(timer);
            finish();
          }
        };
        timer = setInterval(tick, 500);
        tick();
      }
      function show() {
        var q = qs[order[i]];
        count.textContent = ctx.label('questionOf', { num: i + 1, total: order.length });
        fill.style.transform = 'scaleX(' + i / order.length + ')';
        slot.innerHTML = '';
        var qv = questionView(q, ctx, { shuffle: d.shuffle });
        slot.appendChild(qv.el);
        var a = el('div', 'pp-actions');
        var next = btn('pp-btn pp-btn-primary', i === order.length - 1 ? ctx.label('finishTest') : ctx.label('confirm'));
        next.disabled = true;
        qv.onChange(function () {
          next.disabled = !qv.chosen().length;
        });
        next.addEventListener('click', function () {
          answers[order[i]] = qv.chosen();
          i++;
          if (i < order.length) show();
          else finish();
        });
        a.appendChild(next);
        slot.appendChild(a);
        slot.classList.remove('is-in');
        void slot.offsetWidth;
        slot.classList.add('is-in');
      }
      function finish() {
        clearInterval(timer);
        var good = 0;
        qs.forEach(function (q, k) {
          if (answers[k] && isCorrectSet(answers[k], q.correct)) good++;
        });
        var score = good / qs.length;
        var best = typeof saved.s === 'number' ? Math.max(saved.s, score) : score;
        saved = { s: best, c: 1, last: score, good: good, r: answers.map(function (x) { return x || []; }) };
        ctx.save(b.id, saved);
        w.innerHTML = '';
        w.appendChild(el('div', 'pp-eyebrow', ctx.label('assessment')));
        w.appendChild(resultCard(saved, true));
        if (d.showReview) w.appendChild(review(answers));
        var a = el('div', 'pp-actions');
        a.appendChild(btn('pp-btn pp-btn-ghost', ctx.label('retry'), run));
        w.appendChild(a);
      }
      show();
    }

    function resultCard(s, animate) {
      var pct = Math.round((typeof s.last === 'number' ? s.last : s.s) * 100);
      var passed = pct >= d.passPercent;
      var c = el('div', 'pp-as-result ' + (passed ? 'is-passed' : 'is-failed'));
      var ring = el('div', 'pp-ring');
      ring.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="pp-ring-bg"/><circle cx="60" cy="60" r="52" class="pp-ring-fg" stroke-dasharray="326.7" stroke-dashoffset="326.7"/></svg>';
      var num = el('span', 'pp-ring-num', animate ? '0%' : pct + '%');
      ring.appendChild(num);
      c.appendChild(ring);
      var t = el('div', 'pp-as-result-text');
      t.appendChild(el('strong', '', passed ? ctx.label('passed') : ctx.label('failed')));
      t.appendChild(el('span', '', ctx.label('passMark', { n: d.passPercent })));
      c.appendChild(t);
      var fg = ring.querySelector('.pp-ring-fg');
      var run = function () {
        fg.style.strokeDashoffset = String(326.7 * (1 - pct / 100));
        if (!animate) return;
        var start = null;
        var step = function (ts) {
          if (!start) start = ts;
          var p = Math.min(1, (ts - start) / 1100);
          num.textContent = Math.round(pct * (1 - Math.pow(1 - p, 3))) + '%';
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };
      setTimeout(run, animate ? 120 : 0);
      return c;
    }

    function review(answers) {
      var dl = el('details', 'pp-as-review');
      dl.appendChild(el('summary', '', ctx.label('reviewAnswers')));
      qs.forEach(function (q, k) {
        var ok = answers[k] && isCorrectSet(answers[k], q.correct);
        var item = el('div', 'pp-as-rev-item ' + (ok ? 'is-ok' : 'is-wrong'));
        item.innerHTML = icon(ok ? 'check' : 'x');
        var t = el('div');
        t.appendChild(el('strong', '', q.question));
        t.appendChild(
          el(
            'span',
            '',
            q.correct
              .map(function (c) {
                return q.options[c];
              })
              .join(' · ')
          )
        );
        if (q.explanation) t.appendChild(el('p', 'pp-explain', q.explanation));
        item.appendChild(t);
        dl.appendChild(item);
      });
      return dl;
    }

    intro();
    return w;
  };

  // ------------------------------------------------------------------ advanced
  R.table = function (b) {
    var w = el('div', 'pp-b-table');
    var t = el('table');
    if (b.data.caption) t.appendChild(el('caption', '', b.data.caption));
    b.data.rows.forEach(function (row, i) {
      var tr = el('tr');
      row.forEach(function (cell) {
        tr.appendChild(el(i === 0 && b.data.header ? 'th' : 'td', '', cell));
      });
      if (i === 0 && b.data.header) {
        var thead = el('thead');
        thead.appendChild(tr);
        t.appendChild(thead);
      } else {
        var tb = t.querySelector('tbody') || t.appendChild(el('tbody'));
        tb.appendChild(tr);
      }
    });
    w.appendChild(t);
    return w;
  };
  R.embed = function (b) {
    var f = el('figure', 'pp-b-embed');
    var fr = el('iframe');
    fr.src = b.data.url;
    fr.title = b.data.title || 'Embed';
    fr.style.height = (b.data.height || 480) + 'px';
    fr.loading = 'lazy';
    fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation');
    fr.setAttribute('referrerpolicy', 'no-referrer');
    f.appendChild(fr);
    if (b.data.title) f.appendChild(el('figcaption', '', b.data.title));
    return f;
  };
  R.pdf = function (b, ctx) {
    var f = el('figure', 'pp-b-pdf');
    var o = el('iframe');
    o.src = ctx.url(b.data.file);
    o.title = b.data.title || 'PDF';
    o.style.height = (b.data.height || 720) + 'px';
    f.appendChild(o);
    var cap = el('figcaption');
    if (b.data.title) cap.appendChild(el('span', '', b.data.title));
    var a = el('a', '', ctx.label('download'));
    a.href = ctx.url(b.data.file);
    a.setAttribute('download', '');
    cap.appendChild(a);
    f.appendChild(cap);
    return f;
  };
  R.graph = function (b) {
    var d = b.data;
    var f = el('figure', 'pp-b-graph');
    if (d.title) f.appendChild(el('figcaption', 'pp-graph-title', d.title));
    var W = 640;
    var H = 300;
    var pad = { l: 46, r: 16, t: 16, b: 40 };
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', (d.title || '') + ': ' + d.labels.join(', '));
    function s(tag, attrs, text) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (text !== undefined) e.textContent = text;
      svg.appendChild(e);
      return e;
    }
    var colors = ['var(--pp-accent)', 'var(--pp-primary)', '#e3a33b', '#4caf7d', '#7c6cf0', '#e05780'];
    if (d.chartType === 'pie') {
      var vals = d.series[0].values;
      var total = vals.reduce(function (a, v) {
        return a + Math.max(0, v);
      }, 0) || 1;
      var cx = 170;
      var cy = H / 2;
      var r = 120;
      var ang = -Math.PI / 2;
      vals.forEach(function (v, i) {
        var a2 = ang + (Math.max(0, v) / total) * Math.PI * 2;
        var large = a2 - ang > Math.PI ? 1 : 0;
        s('path', {
          d: 'M' + cx + ',' + cy + ' L' + (cx + r * Math.cos(ang)) + ',' + (cy + r * Math.sin(ang)) + ' A' + r + ',' + r + ' 0 ' + large + ' 1 ' + (cx + r * Math.cos(a2)) + ',' + (cy + r * Math.sin(a2)) + ' Z',
          fill: colors[i % colors.length],
          stroke: 'var(--pp-surface)',
          'stroke-width': 2
        });
        ang = a2;
        s('rect', { x: 340, y: 40 + i * 28, width: 14, height: 14, rx: 3, fill: colors[i % colors.length] });
        s('text', { x: 362, y: 52 + i * 28, class: 'pp-gt' }, d.labels[i] + ' · ' + Math.round((v / total) * 100) + '%');
      });
    } else {
      var all = [];
      d.series.forEach(function (se) {
        all = all.concat(se.values);
      });
      var rawMax = Math.max.apply(null, all.concat([0]));
      var rawMin = Math.min.apply(null, all.concat([0]));
      var step = niceStep((rawMax - rawMin) / 4 || 1);
      var max = Math.ceil(rawMax / step) * step;
      var min = Math.floor(rawMin / step) * step;
      var span = max - min || 1;
      var iw = W - pad.l - pad.r;
      var ih = H - pad.t - pad.b;
      var y = function (v) {
        return pad.t + ih - ((v - min) / span) * ih;
      };
      for (var gv = min; gv <= max + step / 2; gv += step) {
        s('line', { x1: pad.l, x2: W - pad.r, y1: y(gv), y2: y(gv), class: 'pp-grid' });
        s('text', { x: pad.l - 8, y: y(gv) + 4, 'text-anchor': 'end', class: 'pp-gt' }, fmt(gv) + (d.unit ? ' ' + d.unit : ''));
      }
      var n = d.labels.length;
      var bandW = iw / n;
      d.labels.forEach(function (l, i) {
        s('text', { x: pad.l + bandW * (i + 0.5), y: H - 14, 'text-anchor': 'middle', class: 'pp-gt' }, l);
      });
      d.series.forEach(function (se, si) {
        if (d.chartType === 'line') {
          var pts = se.values.map(function (v, i) {
            return pad.l + bandW * (i + 0.5) + ',' + y(v);
          });
          s('polyline', { points: pts.join(' '), fill: 'none', stroke: colors[si % colors.length], 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
          se.values.forEach(function (v, i) {
            s('circle', { cx: pad.l + bandW * (i + 0.5), cy: y(v), r: 4.5, fill: colors[si % colors.length] });
          });
        } else {
          var groupW = Math.min(bandW * 0.7, 96 * d.series.length);
          var bw = groupW / d.series.length;
          se.values.forEach(function (v, i) {
            var x = pad.l + bandW * i + (bandW - groupW) / 2 + bw * si;
            s('rect', { x: x, y: Math.min(y(v), y(0)), width: bw - 2, height: Math.abs(y(v) - y(0)), rx: 3, fill: colors[si % colors.length] });
          });
        }
      });
    }
    f.appendChild(svg);
    if (d.series.length > 1 && d.chartType !== 'pie') {
      var lg = el('div', 'pp-legend');
      d.series.forEach(function (se, si) {
        var it = el('span');
        var sw = el('i');
        sw.style.background = colors[si % colors.length];
        it.appendChild(sw);
        it.appendChild(document.createTextNode(se.name || ''));
        lg.appendChild(it);
      });
      f.appendChild(lg);
    }
    return f;
  };
  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function fmt(v) {
    var r = Math.round(v * 100) / 100;
    return Math.abs(r) >= 1000 ? r.toLocaleString() : String(r);
  }
  R.comparison = function (b) {
    var w = el('div', 'pp-b-compare');
    ['left', 'right'].forEach(function (side) {
      var c = el('div', 'pp-cmp-col cmp-' + side);
      c.appendChild(el('h4', 'pp-h3', b.data[side].title));
      var ul = el('ul');
      b.data[side].items.forEach(function (t) {
        ul.appendChild(el('li', '', t));
      });
      c.appendChild(ul);
      w.appendChild(c);
    });
    w.appendChild(el('span', 'pp-cmp-vs', 'vs'));
    return w;
  };
  R.h5p = function (b, ctx) {
    var u = ctx.unit(b.data.unitId);
    var w = el('div', 'pp-b-h5p');
    if (!u) {
      w.appendChild(el('p', 'pp-hint', ctx.label('missingUnit')));
      return w;
    }
    if (ctx.preview || !u.href) {
      var ph = el('div', 'pp-h5p-placeholder');
      ph.appendChild(el('strong', '', u.title));
      ph.appendChild(el('span', '', u.library || 'H5P'));
      w.appendChild(ph);
      return w;
    }
    var fr = el('iframe', 'pp-h5p-frame');
    fr.src = u.href;
    fr.title = u.title;
    fr.setAttribute('allow', 'fullscreen; autoplay; microphone');
    fr.setAttribute('allowfullscreen', '');
    fr.style.height = (b.data.height || 600) + 'px';
    fr.dataset.unit = b.data.unitId;
    fr.dataset.fixed = b.data.height ? '1' : '';
    w.appendChild(fr);
    return w;
  };

  function render(block, ctx) {
    var fn = R[block.type];
    var wrap = el('div', 'pp-block pp-t-' + block.type + (block.issues ? ' is-draft' : ''));
    wrap.id = 'block-' + block.id;
    wrap.dataset.block = block.id;
    if (root.PP_MARKS && root.PP_MARKS[block.id]) wrap.setAttribute('data-comments', String(root.PP_MARKS[block.id]));
    try {
      if (block.issues && ctx.preview) {
        // editor preview of a draft: never render half-filled media or questions
        var ph = el('div', 'pp-draft');
        ph.appendChild(el('strong', '', ctx.label('draftBlock')));
        ph.appendChild(el('span', '', block.issues[0] || ''));
        wrap.appendChild(ph);
        return wrap;
      }
      wrap.appendChild(fn ? fn(block, ctx) : el('p', 'pp-hint', block.type));
    } catch (e) {
      wrap.appendChild(el('p', 'pp-hint', ctx.label('blockError')));
      if (window.console) console.error(e);
    }
    if (block.narration && ctx.narration !== false) {
      var a = el('audio', 'pp-narration');
      a.controls = true;
      a.preload = 'none';
      a.src = ctx.url(block.narration);
      a.setAttribute('aria-label', ctx.label('listen'));
      if (ctx.listenAbove) wrap.insertBefore(a, wrap.firstChild);
      else wrap.appendChild(a);
    }
    return wrap;
  }

  root.PPBlocks = {
    render: render,
    renderers: R,
    graded: { quiz: 1, matching: 1, sorting: 1, fillBlanks: 1, bucketSort: 1, assessment: 1 },
    icon: icon
  };
})(window);
