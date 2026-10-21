// Plietschpaket site: reveal on scroll, mobile menu, hero simulation loop, Claude transcript.
(function () {
  var doc = document.documentElement;
  doc.classList.remove('no-js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // reveal
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
  document.querySelectorAll('.reveal').forEach(function (el) { io ? io.observe(el) : el.classList.add('in'); });

  // menu
  var btn = document.querySelector('.menu-btn');
  if (btn) {
    var toggle = function (open) {
      doc.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', function () { toggle(!doc.classList.contains('menu-open')); });
    document.querySelectorAll('.sheet-menu a').forEach(function (a) { a.addEventListener('click', function () { toggle(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });
  }

  // hero simulation
  var stage = document.querySelector('[data-stage]');
  if (stage) {
    var steps = JSON.parse(stage.getAttribute('data-stage'));
    var imgs = stage.querySelectorAll('.scr img');
    var tap = stage.querySelector('.tap');
    var label = stage.querySelector('.stage-label');
    var num = stage.querySelector('.stage-num');
    var bars = stage.querySelectorAll('.stage-bars i');
    var fb = stage.querySelector('.stage-fb span');
    var i = 0;
    var show = function () {
      var s = steps[i];
      imgs.forEach(function (im, k) { im.classList.toggle('on', k === s.shot); });
      label.classList.add('swap');
      setTimeout(function () { label.textContent = s.label; num.textContent = String(i + 1); label.classList.remove('swap'); }, 260);
      bars.forEach(function (b, k) { b.style.setProperty('--p', k < s.chapter ? 1 : k === s.chapter ? s.part : 0); });
      fb.innerHTML = s.fb;
      tap.classList.remove('go');
      if (s.x != null) {
        tap.style.left = s.x * 100 + '%';
        tap.style.top = s.y * 100 + '%';
        if (!reduce) setTimeout(function () { void tap.offsetWidth; tap.classList.add('go'); }, 900);
      }
    };
    show();
    if (!reduce) setInterval(function () { i = (i + 1) % steps.length; show(); }, 3200);
  }

  // Claude transcript plays once when visible
  var chat = document.querySelector('[data-chat]');
  if (chat) {
    var calls = chat.querySelectorAll('.call');
    var answer = chat.querySelector('.answer');
    var play = function () {
      calls.forEach(function (c, k) { setTimeout(function () { c.classList.add('done'); }, reduce ? 0 : 450 + k * 520); });
      setTimeout(function () { answer.classList.add('on'); }, reduce ? 0 : 450 + calls.length * 520 + 200);
    };
    if (io) {
      var cio = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { play(); cio.disconnect(); } }, { threshold: 0.35 });
      cio.observe(chat);
    } else play();
  }
})();
