(() => {
  const hero = document.getElementById('top');
  const videos = Array.from(hero.querySelectorAll('video'));
  const mobile = matchMedia('(max-width: 768px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  let visible = true;
  const control = document.createElement('div');
  control.className = 'pc-playback';
  const button = document.createElement('button');
  button.className = 'button is-light is-rounded';
  button.type = 'button';
  control.append(button);
  hero.append(control);
  function update() {
    const selected = mobile.matches ? videos[1] : videos[0];
    if (selected.dataset.poster) {
      selected.poster = selected.dataset.poster;
      delete selected.dataset.poster;
    }
    videos.forEach(v => {
      if (v === selected && !paused && visible && !document.hidden) {
        const source = v.querySelector('source[data-src]');
        if (source) {
          source.src = source.dataset.src;
          delete source.dataset.src;
          v.load();
        }
        v.preload = 'auto';
        v.play().catch(error => {
          if (error.name === 'AbortError') return;
          if (v === (mobile.matches ? videos[1] : videos[0]) && visible && !document.hidden) {
            paused = true;
            update();
          }
        });
      }
      else v.pause();
    });
    const label = paused ? 'Play background video' : 'Pause background video';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = `<span class="icon"><i class="fa-solid ${paused ? 'fa-play' : 'fa-pause'}" aria-hidden="true"></i></span>`;
  }
  button.addEventListener('click', () => { paused = !paused; update(); });
  mobile.addEventListener('change', update);
  reduced.addEventListener('change', () => { paused = reduced.matches; update(); });
  document.addEventListener('visibilitychange', update);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      update();
    }, {threshold: 0}).observe(hero);
  } else update();
})();
