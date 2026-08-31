import * as THREE from 'three';

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountHeroScene(canvas: HTMLCanvasElement, section: HTMLElement) {
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
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 40);
  camera.position.z = 6.2;

  const ico = new THREE.IcosahedronGeometry(2.15, 2);
  const points = new THREE.Points(
    ico,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.03,
      transparent: true,
      opacity: 0.72,
      sizeAttenuation: true,
      depthWrite: false,
    }),
  );
  scene.add(points);

  const wireGeo = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.15, 0));
  const wire = new THREE.LineSegments(
    wireGeo,
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.16,
    }),
  );
  scene.add(wire);

  const cloudCount = 260;
  const cloudPos = new Float32Array(cloudCount * 3);
  for (let i = 0; i < cloudCount; i += 1) {
    const radius = 3.1 + Math.random() * 2.8;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    cloudPos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    cloudPos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    cloudPos[i * 3 + 2] = radius * Math.cos(phi);
  }
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3));
  const cloud = new THREE.Points(
    cloudGeo,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.015,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
  );
  scene.add(cloud);

  const noiseMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      void main() {
        float n = hash(vUv * vec2(720.0, 420.0) + uTime);
        float vig = smoothstep(1.15, 0.22, distance(vUv, vec2(0.5)));
        gl_FragColor = vec4(1.0, 1.0, 1.0, n * 0.04 + (1.0 - vig) * 0.07);
      }
    `,
  });
  const noiseQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), noiseMat);
  noiseQuad.frustumCulled = false;
  noiseQuad.renderOrder = 10;
  scene.add(noiseQuad);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointerMove = (event: PointerEvent) => {
    const rect = section.getBoundingClientRect();
    mouse.tx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.ty = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };
  section.addEventListener('pointermove', onPointerMove, { passive: true });

  const resize = () => {
    const width = section.clientWidth;
    const height = section.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(section);
  resize();

  let raf = 0;
  let running = false;
  const clock = new THREE.Clock();

  const tick = () => {
    const t = clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * 0.045;
    mouse.y += (mouse.ty - mouse.y) * 0.045;

    points.rotation.y = t * 0.09 + mouse.x * 0.45;
    points.rotation.x = t * 0.04 + mouse.y * 0.28;
    wire.rotation.copy(points.rotation);
    cloud.rotation.y = t * -0.03 + mouse.x * 0.2;
    cloud.rotation.x = mouse.y * 0.12;
    noiseMat.uniforms.uTime.value = t * 12;

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
    { threshold: 0.05 },
  );
  io.observe(section);

  const dispose = () => {
    stop();
    io.disconnect();
    ro.disconnect();
    section.removeEventListener('pointermove', onPointerMove);
    ico.dispose();
    wireGeo.dispose();
    cloudGeo.dispose();
    noiseQuad.geometry.dispose();
    noiseMat.dispose();
    (points.material as THREE.Material).dispose();
    (wire.material as THREE.Material).dispose();
    (cloud.material as THREE.Material).dispose();
    renderer.dispose();
  };

  window.addEventListener('beforeunload', dispose);
  return dispose;
}
