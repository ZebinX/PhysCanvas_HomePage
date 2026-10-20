(() => {
  'use strict';
  const pending = new Map();
  function loadScript(src) {
    if (!pending.has(src)) {
      pending.set(src, new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => { script.remove(); pending.delete(src); reject(new Error(`Could not load ${src}`)); };
        document.head.append(script);
      }));
    }
    return pending.get(src);
  }
  window.PhysCanvasAssets = {loadScript};
  const modules = [
    ['contact-explorer', ['static/js/contact-index.js', 'static/js/contact-explorer.js?v=20261020-lazy']],
    ['feature-spheres', ['static/vendor/three-r160/three.min.js', 'assets/feature-spheres/data.js?v=20261015-labels', 'static/js/feature-spheres.js']],
  ];
  modules.forEach(([id, scripts]) => {
    const section = document.getElementById(id);
    if (!section) return;
    let running = false;
    async function activate() {
      if (running) return;
      running = true;
      section.setAttribute('aria-busy', 'true');
      try {
        for (const src of scripts) await loadScript(src);
        section.dataset.initialized = 'true';
        if (observer) observer.disconnect();
      } catch (error) {
        running = false;
        console.error(error);
      } finally {
        section.removeAttribute('aria-busy');
      }
    }
    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) activate();
      }, {rootMargin: '300px'}) : null;
    if (observer) observer.observe(section);
    else activate();
    section.addEventListener('pointerenter', activate, {passive: true});
    section.addEventListener('focusin', activate);
  });

  // Posters below the fold otherwise download even when a video uses preload=none.
  const media = document.querySelectorAll('video[data-poster], video source[data-src]');
  function activatePoster(video) {
    if (video.dataset.poster) {
      video.poster = video.dataset.poster;
      delete video.dataset.poster;
    }
  }
  function activateMedia(video) {
    activatePoster(video);
    const source = video.querySelector('source[data-src]');
    if (source) {
      source.src = source.dataset.src;
      delete source.dataset.src;
      video.load();
    }
  }
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        activatePoster(entry.target);
        observer.unobserve(entry.target);
      }
    }), {rootMargin: '300px'}) : null;
  const sourceObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        activateMedia(entry.target);
        sourceObserver.unobserve(entry.target);
      }
    })) : null;
  const videos = new Set(Array.from(media, item => item.closest('video')));
  videos.forEach(video => {
    if (video.closest('#top')) return;
    if (observer) {
      observer.observe(video);
      sourceObserver.observe(video);
    }
    else activateMedia(video);
    video.addEventListener('pointerdown', () => activateMedia(video), {once: true});
    video.addEventListener('focus', () => activateMedia(video), {once: true});
  });
})();
