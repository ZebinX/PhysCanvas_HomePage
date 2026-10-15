(function () {
  'use strict';
  const rail = document.getElementById('ft-toc');
  const navbar = document.querySelector('.ft-navbar');
  const header = document.querySelector('.ft-navbar-inner');
  const toggle = document.getElementById('ft-nav-toggle');
  const mobile = document.getElementById('ft-nav-mobile');
  const footer = document.querySelector('.ft-footer');
  const first = document.getElementById('summary-video');
  const sections = Array.from(document.querySelectorAll('section[id]'));
  const links = Array.from(document.querySelectorAll('#ft-toc a, .ft-nav-links a, #ft-nav-mobile a'));
  const linkedIds = new Set(links.map(link => link.getAttribute('href')).filter(href => href && href.startsWith('#')));
  // Use document order, never the (possibly outdated) order of navigation links.
  const tracked = sections.filter(section => linkedIds.has('#' + section.id));
  let offset = 80;
  let scheduled = false;

  function closeMenu() {
    if (mobile) mobile.classList.remove('is-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  if (toggle && mobile) toggle.addEventListener('click', function () {
    const open = mobile.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  function update() {
    scheduled = false;
    if (navbar) navbar.classList.toggle('is-scrolled', window.scrollY > 8);
    if (rail && first) {
      const pastStart = first.getBoundingClientRect().top <= window.innerHeight * 0.18;
      const atFooter = footer && footer.getBoundingClientRect().top <= window.innerHeight * 0.98;
      rail.classList.toggle('is-visible', pastStart && !atFooter);
    }
    let current = tracked[0];
    tracked.forEach(section => {
      if (section.getBoundingClientRect().top <= offset + 36) current = section;
    });
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) {
      current = tracked[tracked.length - 1];
    }
    links.forEach(link => {
      const active = !!current && link.getAttribute('href') === '#' + current.id;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function scheduleUpdate() {
    if (!scheduled) {
      scheduled = true;
      window.requestAnimationFrame(update);
    }
  }

  function measure() {
    offset = Math.ceil(header ? header.getBoundingClientRect().height : 64) + 16;
    document.documentElement.style.setProperty('--pc-anchor-offset', offset + 'px');
    update();
  }

  function targetFor(hash) {
    if (!hash || !hash.startsWith('#')) return null;
    try {
      return document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch (_) {
      return null;
    }
  }

  function navigate(target, smooth) {
    closeMenu();
    measure();
    const heading = target.id === 'top' ? target : target.querySelector('h2') || target;
    const top = target.id === 'top' ? 0 : Math.max(0, window.scrollY + heading.getBoundingClientRect().top - offset);
    window.scrollTo({top, behavior: smooth ? 'smooth' : 'instant'});
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({preventScroll: true});
    scheduleUpdate();
  }

  document.addEventListener('click', function (event) {
    if (mobile && mobile.classList.contains('is-open') && !event.target.closest('.ft-navbar')) closeMenu();
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const hash = link.getAttribute('href');
    const target = targetFor(hash);
    if (!target || !sections.includes(target)) return;
    event.preventDefault();
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    navigate(target, !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  });

  window.addEventListener('hashchange', function () {
    const target = targetFor(window.location.hash);
    if (target && sections.includes(target)) navigate(target, false);
  });
  window.addEventListener('scroll', scheduleUpdate, {passive: true});
  window.addEventListener('resize', measure);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  measure();
  // Recheck deep links after images/fonts finish establishing the page height.
  let initialLinkPending = true;
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(type => {
    document.addEventListener(type, () => { initialLinkPending = false; }, {passive: true});
  });
  window.addEventListener('load', function () {
    measure();
    const target = targetFor(window.location.hash);
    if (initialLinkPending && target && sections.includes(target)) navigate(target, false);
  });
})();
