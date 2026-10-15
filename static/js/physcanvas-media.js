(() => {
  const hero = document.getElementById('top');
  const videos = Array.from(hero.querySelectorAll('video'));
  const mobile = matchMedia('(max-width: 768px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  const control = document.createElement('div');
  control.className = 'pc-playback';
  const button = document.createElement('button');
  button.className = 'button is-light is-rounded';
  button.type = 'button';
  control.append(button);
  hero.append(control);
  function update() {
    const selected = mobile.matches ? videos[1] : videos[0];
    videos.forEach(v => {
      if (v === selected && !paused && !document.hidden) {
        v.preload = 'auto';
        v.play().catch(() => {
          if (v === (mobile.matches ? videos[1] : videos[0]) && !document.hidden) {
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
  update();
})();
