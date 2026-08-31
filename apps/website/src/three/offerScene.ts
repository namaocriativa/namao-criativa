import * as THREE from 'three';

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountOfferScene(canvas: HTMLCanvasElement, host: HTMLElement) {
  if (reducedMotion()) return () => {};

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
  camera.position.z = 5.2;

  const knotGeo = new THREE.TorusKnotGeometry(1.15, 0.28, 160, 16);
  const knot = new THREE.Mesh(
    knotGeo,
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    }),
  );
  scene.add(knot);

  const octaGeo = new THREE.OctahedronGeometry(2.15, 0);
  const octa = new THREE.LineSegments(
    new THREE.EdgesGeometry(octaGeo),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
    }),
  );
  scene.add(octa);

  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let raf = 0;
  let running = false;
  const clock = new THREE.Clock();

  const tick = () => {
    const t = clock.getElapsedTime();
    const scroll = window.scrollY * 0.0014;
    knot.rotation.x = t * 0.18 + scroll;
    knot.rotation.y = t * 0.27 + scroll * 0.6;
    octa.rotation.y = t * -0.08 + scroll * 0.4;
    octa.rotation.z = t * 0.05;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  const start = () => {
    if (running) return;
    running = true;
    clock.start();
    raf = requestAnimationFrame(tick);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) start();
      else stop();
    },
    { threshold: 0.08 },
  );
  io.observe(host);

  const dispose = () => {
    stop();
    io.disconnect();
    ro.disconnect();
    knotGeo.dispose();
    octaGeo.dispose();
    (octa.geometry as THREE.BufferGeometry).dispose();
    (knot.material as THREE.Material).dispose();
    (octa.material as THREE.Material).dispose();
    renderer.dispose();
  };

  window.addEventListener('beforeunload', dispose);
  return dispose;
}
