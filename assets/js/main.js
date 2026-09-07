/* Casa Quirón — comportamiento del sitio de especificación.
   Sin dependencias externas. */
(function () {
  'use strict';

  var toc     = document.getElementById('indice');
  var toggle  = document.getElementById('nav-toggle');
  var scrim   = document.getElementById('nav-scrim');
  var bar     = document.getElementById('progress-bar');
  var totop   = document.getElementById('totop');
  var links   = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
  var targets = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });

  /* --- índice lateral en celular --- */
  function setNav(open) {
    toc.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    scrim.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  }
  toggle.addEventListener('click', function () {
    setNav(toggle.getAttribute('aria-expanded') !== 'true');
  });
  scrim.addEventListener('click', function () { setNav(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { setNav(false); }
  });
  links.forEach(function (a) {
    a.addEventListener('click', function () {
      if (window.matchMedia('(max-width: 67.999rem)').matches) { setNav(false); }
    });
  });

  /* --- sección activa + barra de progreso + botón subir --- */
  function onScroll() {
    var doc  = document.documentElement;
    var max  = doc.scrollHeight - doc.clientHeight;
    var y    = window.scrollY || doc.scrollTop;

    if (bar) { bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%'; }
    if (totop) { totop.classList.toggle('show', y > 600); }

    var current = -1;
    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      if (el && el.getBoundingClientRect().top <= 120) { current = i; }
    }
    links.forEach(function (a, i) { a.classList.toggle('active', i === current); });
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(function () { onScroll(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  totop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* --- resaltar una regla enlazada directamente (#rn-06) --- */
  function flagHash() {
    var id = window.location.hash.replace('#', '');
    if (!id) { return; }
    var el = document.getElementById(id);
    if (el && el.tagName === 'LI') {
      el.style.borderLeftColor = 'var(--accent-2)';
    }
  }
  window.addEventListener('hashchange', flagHash);
  flagHash();
})();
