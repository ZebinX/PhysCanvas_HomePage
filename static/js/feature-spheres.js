(function () {
  'use strict';
  const section = document.getElementById('feature-spheres');
  if (!section) return;
  const data = window.PC_FEATURE_SPHERES;
  const THREE = window.THREE;
  const status = document.getElementById('feature-spheres-status');
  if (!data || !THREE) {
    status.hidden = false;
    status.textContent = 'The feature visualization could not be loaded.';
    return;
  }
  const rotateButton = document.getElementById('feature-rotate');
  const syncButton = document.getElementById('feature-sync');
  const modeButtons = Array.from(section.querySelectorAll('[data-feature-mode]'));
  const modalityInputs = Array.from(section.querySelectorAll('[data-feature-modality]'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Set(data.modalities.map(item => item.id));
  const views = [];
  let mode = 'both';
  let synchronized = true;
  let rotating = !reducedMotion.matches;
  let visible = false;
  let initialized = false;
  let animation = 0;
  let lastTime = 0;

  function decode(encoded, Type) {
    const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    return new Type(bytes.buffer);
  }

  function rotationButton() {
    rotateButton.setAttribute('aria-pressed', String(rotating));
    const label = rotating ? 'Pause rotation' : 'Resume rotation';
    rotateButton.setAttribute('aria-label', label);
    rotateButton.title = label;
    rotateButton.firstElementChild.className = rotating ? 'fa-solid fa-pause' : 'fa-solid fa-play';
  }

  function render(view) {
    view.group.rotation.set(view.pitch, view.yaw, 0, 'YXZ');
    view.renderer.render(view.scene, view.camera);
    view.canvas.dataset.rendered = 'true';
    view.canvas.dataset.yaw = view.yaw.toFixed(4);
    view.canvas.dataset.frame = String(++view.frames);
  }

  function updateSurface(view) {
    const colors = view.surface.geometry.attributes.color;
    const palette = data.modalities.map(modality => new THREE.Color(modality.color));
    const base = new THREE.Color('#edf2f6');
    const enabled = data.modalities.map(modality => active.has(modality.id));
    const number = enabled.filter(Boolean).length;
    for (let i = 0; i < colors.count; i++) {
      let total = 0, r = 0, g = 0, b = 0;
      for (let k = 0; k < 4; k++) {
        if (!enabled[k]) continue;
        const d = view.density[i * 4 + k] * data.densityScale;
        total += d;
        r += d * palette[k].r; g += d * palette[k].g; b += d * palette[k].b;
      }
      const strength = mode === 'points' ? 0 : .88 * Math.sqrt(Math.min(1, total / Math.max(1, number) / data.densityCap));
      const denominator = Math.max(total, 1e-20);
      colors.setXYZ(i, base.r * (1 - strength) + r / denominator * strength,
        base.g * (1 - strength) + g / denominator * strength,
        base.b * (1 - strength) + b / denominator * strength);
    }
    colors.needsUpdate = true;
    view.points.forEach(points => { points.visible = mode !== 'density' && active.has(points.userData.modality); });
    render(view);
  }

  function createView(figure, stage) {
    const canvas = figure.querySelector('canvas');
    const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, preserveDrawingBuffer: true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xf8fafb, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1.12, 1.12, 1.12, -1.12, .1, 20);
    camera.position.set(0, 0, 4);
    const group = new THREE.Group();
    scene.add(group);
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const light = new THREE.DirectionalLight(0xffffff, 1.3);
    light.position.set(-2, 3, 4); scene.add(light);
    const geometry = new THREE.SphereGeometry(1, data.widthSegments, data.heightSegments);
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
    const surface = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({vertexColors: true}));
    group.add(surface);
    const positions = decode(stage.positions, Float32Array);
    const labels = decode(stage.labels, Uint8Array);
    const points = data.modalities.map(modality => {
      const ids = [];
      labels.forEach((label, index) => { if (label === modality.id) ids.push(index); });
      const xyz = new Float32Array(ids.length * 3);
      ids.forEach((id, j) => { for (let k = 0; k < 3; k++) xyz[j * 3 + k] = positions[id * 3 + k] * 1.004; });
      const pointGeometry = new THREE.BufferGeometry();
      pointGeometry.setAttribute('position', new THREE.BufferAttribute(xyz, 3));
      const material = new THREE.ShaderMaterial({
        uniforms: {color: {value: new THREE.Color(modality.color)}, pointSize: {value: 3.5 * renderer.getPixelRatio()}},
        vertexShader: 'uniform float pointSize; void main(){ gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize=pointSize; }',
        fragmentShader: 'uniform vec3 color; void main(){ float r=length(gl_PointCoord-vec2(.5)); if(r>.5) discard; gl_FragColor=vec4(color,.94*(1.0-smoothstep(.35,.5,r)));\n#include <colorspace_fragment>\n}',
        transparent: true, depthWrite: false, depthTest: true,
      });
      const cloud = new THREE.Points(pointGeometry, material);
      cloud.userData = {modality: modality.id, name: modality.name, ids};
      group.add(cloud);
      return cloud;
    });
    const view = {renderer, scene, camera, group, surface, points, canvas, frames: 0,
      density: decode(stage.density, Uint16Array),
      pitch: Math.PI, yaw: 0, dragging: false};
    canvas.dataset.pointCount = String(stage.count);
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.setSize(rect.width, rect.height, false);
      const aspect = rect.width / rect.height;
      camera.left = -1.12 * aspect; camera.right = 1.12 * aspect;
      camera.updateProjectionMatrix(); render(view);
    };
    view.observer = new ResizeObserver(resize);
    view.observer.observe(canvas.parentElement);
    resize();
    bindRotation(view);
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); rotating = false; rotationButton();
      status.hidden = false; status.textContent = 'The graphics context was interrupted. Reload to restore the spheres.';
    });
    updateSurface(view);
    return view;
  }

  function changeRotation(view, dx, dy) {
    rotating = false; rotationButton();
    const targets = synchronized ? views : [view];
    targets.forEach(item => {
      item.yaw += dx;
      item.pitch = Math.max(Math.PI - 1.3, Math.min(Math.PI + 1.3, item.pitch + dy));
      render(item);
    });
  }

  function bindRotation(view) {
    const canvas = view.canvas;
    let previousX = 0, previousY = 0;
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary) return;
      if (event.pointerType === 'mouse') event.preventDefault();
      view.dragging = true; previousX = event.clientX; previousY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (view.dragging) {
        const dx = (event.clientX - previousX) / canvas.clientWidth * 3;
        const dy = event.pointerType === 'touch' ? 0 : (event.clientY - previousY) / canvas.clientHeight * 2;
        changeRotation(view, dx, dy);
        previousX = event.clientX; previousY = event.clientY;
        return;
      }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => canvas.addEventListener(name, () => { view.dragging = false; }));
    canvas.addEventListener('keydown', event => {
      const delta = {ArrowLeft: [-.14, 0], ArrowRight: [.14, 0], ArrowUp: [0, -.14], ArrowDown: [0, .14]}[event.key];
      if (delta) { event.preventDefault(); changeRotation(view, ...delta); }
    });
  }

  function tick(now) {
    animation = 0;
    if (!visible || document.hidden || !rotating) { lastTime = 0; return; }
    if (!lastTime) lastTime = now;
    if (now - lastTime >= 30) {
      const dt = Math.min(.08, (now - lastTime) / 1000);
      views.forEach(view => { if (!view.dragging) { view.yaw += dt * .055; render(view); } });
      lastTime = now;
    }
    animation = requestAnimationFrame(tick);
  }

  function animate() {
    if (visible && !document.hidden && rotating && !animation) animation = requestAnimationFrame(tick);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    try {
      section.querySelectorAll('[data-feature-stage]').forEach((figure, i) => views.push(createView(figure, data.stages[i])));
    } catch (error) {
      rotating = false; rotationButton();
      status.hidden = false; status.textContent = 'WebGL is unavailable. Enable hardware acceleration to view the feature spheres.';
      console.error('Feature sphere initialization failed:', error);
    }
  }

  modeButtons.forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.featureMode;
    modeButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    views.forEach(updateSurface);
  }));
  modalityInputs.forEach(input => input.addEventListener('change', () => {
    const id = Number(input.dataset.featureModality);
    if (input.checked) active.add(id); else active.delete(id);
    views.forEach(updateSurface);
  }));
  rotateButton.addEventListener('click', () => { rotating = !rotating; rotationButton(); animate(); });
  syncButton.addEventListener('click', () => {
    synchronized = !synchronized;
    syncButton.setAttribute('aria-pressed', String(synchronized));
    if (synchronized && views.length) views.forEach(view => { view.yaw = views[0].yaw; view.pitch = views[0].pitch; render(view); });
  });
  document.getElementById('feature-reset').addEventListener('click', () => {
    rotating = false; rotationButton();
    views.forEach(view => { view.pitch = Math.PI; view.yaw = 0; render(view); });
  });
  document.addEventListener('visibilitychange', animate);
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { rotating = false; rotationButton(); } });
  rotationButton();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) { init(); animate(); }
    }, {rootMargin: '120px'}).observe(section);
  } else { visible = true; init(); animate(); }
})();
