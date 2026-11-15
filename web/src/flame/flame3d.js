// Flame Sandbox renderer: a TEACHING MODEL of a candle flame, not a simulation. It solves no physics and computes
// no number that the site shows. Shape, colour and flicker follow the qualitative description in NASA's challenge
// video (2:37-3:12) and page: Earth = flickering yellow teardrop (buoyancy carries soot up); microgravity = steady,
// soot-free, dim blue sphere. Partial gravity has no data, so the model draws only the two bounding outlines.
//
// Three.js scene: a lit wax candle (meshes) + a ray-marched emissive volume (ShaderMaterial on a box).
// Performance: capped pixel ratio with automatic step-down, step count that adapts to frame time,
// render loop paused when off-screen or the page is hidden, single still frame under prefers-reduced-motion.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, BoxGeometry, CylinderGeometry, CircleGeometry, ShaderMaterial,
  MeshStandardMaterial, PointLight, AmbientLight, Vector3, Color, CustomBlending, OneFactor, OneMinusSrcAlphaFactor,
} from 'three';

const BOX_MIN = new Vector3(-1.25, -0.68, -0.85);
const BOX_MAX = new Vector3(1.25, 1.45, 0.85);
const WICK_TOP = -0.5;
const CANDLE_TOP = -0.62;

const vert = /* glsl */`
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const frag = /* glsl */`
  precision highp float;
  uniform float uTime, uBuoy, uSoot, uFlick, uFlow, uBright, uGhost, uSteps, uSize;
  uniform vec3 uBoxMin, uBoxMax;
  varying vec3 vWorld;
  const vec3 WICK = vec3(0.0, ${WICK_TOP.toFixed(3)}, 0.0);

  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  vec2 hitBox(vec3 o, vec3 d) {
    vec3 inv = 1.0 / d;
    vec3 t0 = (uBoxMin - o) * inv, t1 = (uBoxMax - o) * inv;
    vec3 a = min(t0, t1), b = max(t0, t1);
    return vec2(max(max(a.x, a.y), a.z), min(min(b.x, b.y), b.z));
  }

  // One flame configuration. buoy: 1 = Earth gravity, 0 = none. soot: yellow soot glow. flick: flicker.
  // flow: sideways forced flow (+x). outline: 1 = draw only the reaction sheet (used for the partial-gravity bounds).
  // Returns rgb emission and an absorption coefficient (soot is slightly opaque).
  vec4 flame(vec3 p, float buoy, float soot, float flick, float flow, vec3 sheetCol, float outline) {
    vec2 ax = vec2(flow, buoy);
    float m = clamp(length(ax), 0.0, 1.25);
    vec3 dir = m > 1e-3 ? vec3(normalize(ax), 0.0) : vec3(0.0, 1.0, 0.0);
    float R = 0.24 * mix(1.3, 1.0, clamp(m, 0.0, 1.0));      // no buoyancy: a wider, diffusion-fed shell
    R *= mix(uSize, 1.0, outline);                           // O2 sets the size of the drawn flame (qualitative); outlines keep theirs
    float L = R * (1.0 + 2.4 * m);                           // half-length along the flame axis
    vec3 q = p - WICK;
    if (flick > 0.0) {                                       // rising wobble, stronger toward the tip
      float h = clamp(dot(q, dir) / (2.0 * L), 0.0, 1.0);
      vec3 nq = q * 3.2 - dir * uTime * 4.2;
      vec2 n = vec2(noise(nq), noise(nq + vec3(5.2, 1.3, 2.8))) - 0.5;
      q.xz += flick * n * 0.34 * h * h;
      L *= 1.0 + flick * 0.22 * (noise(vec3(uTime * 2.6, 0.0, 0.0)) - 0.5);
    }
    float s = dot(q, dir);
    float r = length(q - s * dir);
    float c = L * 0.80 - R * 0.38;                           // the wick sits low inside the flame
    float u = (s - c) / L;                                   // -1 base .. +1 tip
    float taper = mix(1.0, 1.0 - 0.82 * smoothstep(-0.3, 1.0, u), clamp(m, 0.0, 1.0));
    float rho = R * sqrt(max(0.0, 1.0 - u * u)) * taper;
    float d = r - rho;
    if (abs(u) > 1.0) d = max(d, (abs(u) - 1.0) * L);
    float sheet = exp(-(d * d) / 0.0011);
    float baseOnly = mix(1.0, 1.0 - smoothstep(-0.8, -0.15, u), soot * (1.0 - outline));
    vec3 col = sheetCol * sheet * baseOnly;
    if (soot > 0.0 && outline < 0.5) {
      float inside = smoothstep(0.03, -0.05, d);
      float up = smoothstep(-0.75, -0.05, u);
      float core = clamp(-d / max(rho, 1e-3), 0.0, 1.0);
      float dark = smoothstep(0.07, 0.24, length(p - WICK));  // dark zone around the wick
      float dens = soot * inside * up * dark;
      col += mix(vec3(1.0, 0.42, 0.06), vec3(1.0, 0.9, 0.6), core) * dens * 6.0;
      return vec4(col, dens * 1.6);
    }
    return vec4(col, 0.0);
  }

  vec4 emission(vec3 p) {
    vec3 blue = vec3(0.20, 0.42, 1.0) * 1.55;
    vec4 e = vec4(0.0);
    if (uGhost < 0.999) e = flame(p, uBuoy, uSoot, uFlick, uFlow, blue, 0.0);
    if (uGhost > 0.001) {
      vec4 g = flame(p, 1.0, 1.0, 0.0, uFlow, vec3(1.0, 0.62, 0.16) * 1.3, 1.0)
             + flame(p, 0.0, 0.0, 0.0, uFlow, blue, 1.0);
      e = mix(e, g, uGhost);
    }
    return e * vec4(vec3(uBright), 1.0);
  }

  void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorld - cameraPosition);
    vec2 t = hitBox(ro, rd);
    t.x = max(t.x, 0.0);
    if (t.x >= t.y) discard;
    float dt = (t.y - t.x) / uSteps;
    float jitter = hash(vec3(gl_FragCoord.xy, fract(uTime)));
    vec3 col = vec3(0.0);
    float T = 1.0;
    for (int i = 0; i < 64; i++) {
      if (float(i) >= uSteps) break;
      vec3 p = ro + rd * (t.x + (float(i) + jitter) * dt);
      // Wick: opaque, its tip glowing faintly
      if (length(p.xz) < 0.022 && p.y < WICK.y && p.y > ${CANDLE_TOP.toFixed(3)}) {
        float tip = smoothstep(WICK.y - 0.05, WICK.y, p.y);
        col += T * mix(vec3(0.03), vec3(0.9, 0.25, 0.05) * mix(0.35, 1.0, uSoot), tip);
        T = 0.0;
        break;
      }
      vec4 e = emission(p);
      col += T * e.rgb * dt;
      T *= exp(-e.a * dt);
      if (T < 0.02) break;
    }
    col = 1.0 - exp(-col * 1.25);
    gl_FragColor = vec4(col, 1.0 - T);
  }`;

const VISUAL = {
  earth: { buoy: 1, soot: 1, flick: 1, ghost: 0, light: new Color(1.0, 0.62, 0.25), lightI: 2.4 },
  micro: { buoy: 0, soot: 0, flick: 0, ghost: 0, light: new Color(0.35, 0.5, 1.0), lightI: 0.9 },
  partial: { buoy: 0, soot: 0, flick: 0, ghost: 1, light: new Color(0.7, 0.6, 0.6), lightI: 1.2 },
};

export function visualFor(gravity) {
  return gravity === 'earth' ? 'earth' : gravity === 'micro' ? 'micro' : 'partial';
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{reduced: boolean, onFrame?: () => void}} opts
 * @returns {{set: (t: {gravity: string, o2: number, flow: number, out?: boolean}) => void, setPaused: (b: boolean) => void, dispose: () => void}}
 */
export function createFlame(canvas, opts) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'default' });
  renderer.setClearColor(0x07080b, 1);
  const maxDpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let dpr = maxDpr;
  renderer.setPixelRatio(dpr);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.2, 4.7);
  camera.lookAt(0, 0.02, 0);

  const wax = new MeshStandardMaterial({ color: 0xeee4cf, roughness: 0.6, metalness: 0, emissive: 0x1a1612 });
  const candle = new Mesh(new CylinderGeometry(0.17, 0.18, 2.2, 48, 1, false), wax);
  candle.position.y = CANDLE_TOP - 1.1;
  const pool = new Mesh(new CircleGeometry(0.15, 40), new MeshStandardMaterial({ color: 0xf6efe0, roughness: 0.25, emissive: 0x2a2015 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = CANDLE_TOP + 0.002;
  const light = new PointLight(0xffa040, 2.4, 0, 1.6);
  light.position.set(0, -0.15, 0.25);
  scene.add(candle, pool, light, new AmbientLight(0x5a6478, 0.55));

  const uniforms = {
    uTime: { value: 0 }, uBuoy: { value: 1 }, uSoot: { value: 1 }, uFlick: { value: 1 }, uFlow: { value: 0 },
    uBright: { value: 1 }, uGhost: { value: 0 }, uSteps: { value: 44 }, uSize: { value: 1 },
    uBoxMin: { value: BOX_MIN }, uBoxMax: { value: BOX_MAX },
  };
  const mat = new ShaderMaterial({
    uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, depthTest: false,
    blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor,
  });
  const size = BOX_MAX.clone().sub(BOX_MIN);
  const vol = new Mesh(new BoxGeometry(size.x, size.y, size.z), mat);
  vol.position.copy(BOX_MIN.clone().add(BOX_MAX).multiplyScalar(0.5));
  vol.renderOrder = 2;
  scene.add(vol);

  // Current and target visual parameters; the loop eases current -> target (the morph).
  const cur = { buoy: 1, soot: 1, flick: 1, ghost: 0, flow: 0, bright: 1, size: 1, alive: 1, lightI: 2.4, light: new Color(1, 0.62, 0.25) };
  let tgt = { ...cur, light: cur.light.clone() };

  const resize = () => {
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the flame framed on tall phone canvases: pull back when the view is narrow.
    camera.position.z = (w / h < 0.9 ? 4.7 / Math.max(w / h, 0.55) * 0.9 : 4.7) * (w < 520 ? 0.82 : 1);
    camera.updateProjectionMatrix();
    draw(0);
  };

  let t0 = performance.now();
  let last = t0;
  let time = 0;
  let running = false;
  let paused = false;
  let visible = true;
  let frames = 0; let slow = 0;

  function step(dt) {
    const k = opts.reduced ? 1 : 1 - Math.exp(-dt / 0.45);
    for (const key of ['buoy', 'soot', 'flick', 'ghost', 'flow', 'bright', 'size', 'lightI']) cur[key] += (tgt[key] - cur[key]) * k;
    // Going out is slower than coming back (a visible shrink and fade); relighting is quick.
    const ka = opts.reduced ? 1 : 1 - Math.exp(-dt / (tgt.alive < cur.alive ? 0.9 : 0.35));
    cur.alive += (tgt.alive - cur.alive) * ka;
    cur.light.lerp(tgt.light, k);
  }

  function draw(dt) {
    step(dt);
    uniforms.uTime.value = time;
    uniforms.uBuoy.value = cur.buoy; uniforms.uSoot.value = cur.soot; uniforms.uFlick.value = cur.flick;
    uniforms.uGhost.value = cur.ghost; uniforms.uFlow.value = cur.flow; uniforms.uBright.value = cur.bright * cur.alive;
    uniforms.uSize.value = cur.size * (0.25 + 0.75 * cur.alive);
    const flicker = cur.flick * (Math.sin(time * 11.3) * 0.05 + Math.sin(time * 7.1) * 0.06);
    light.intensity = cur.lightI * cur.bright * cur.alive * (1 + flicker);
    light.color.copy(cur.light);
    light.position.x = cur.flow * 0.35;
    renderer.render(scene, camera);
  }

  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt;
    draw(dt);
    // Adaptive quality: if frames run slow (> ~24 ms average), drop ray-march steps, then resolution.
    frames++; slow += dt;
    if (frames === 45) {
      const avg = slow / frames;
      if (avg > 0.024) {
        if (uniforms.uSteps.value > 28) uniforms.uSteps.value -= 8;
        else if (dpr > 0.75) { dpr = Math.max(0.75, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); }
      }
      frames = 0; slow = 0;
    }
    opts.onFrame?.();
  }

  function sync() {
    const want = !opts.reduced && !paused && visible && !document.hidden;
    if (want && !running) { last = performance.now(); renderer.setAnimationLoop(loop); running = true; }
    if (!want && running) { renderer.setAnimationLoop(null); running = false; }
  }

  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; sync(); }, { threshold: 0.01 });
  io.observe(canvas);
  const onVis = () => sync();
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Still frame for reduced motion: settle the morph instantly, show a representative instant.
  const settle = () => { if (opts.reduced) time = 1.7; step(10); draw(0); };

  return {
    // out: true only when the page's evidence panel says the conditions are below NASA's measured boundary
    // (BASS-II eq. 6.1, computed in tabs/sandbox.js). The model itself decides nothing.
    set({ gravity, o2, flow, out = false }) {
      const v = VISUAL[visualFor(gravity)];
      // O2 sets size, brightness and (where the flame flickers at all) flicker energy. Qualitative: small and dim near
      // 15% O2, large and bright from 30% up, after the challenge page ("making materials much more flammable").
      const f = Math.min(Math.max((o2 - 15) / 15, 0), 1);
      tgt = {
        buoy: v.buoy, soot: v.soot, flick: v.flick * (0.45 + 1.1 * f), ghost: v.ghost,
        flow: Math.min(Math.max(flow, 0) / 60, 1) * (v.buoy ? 0.75 : 1.05),
        bright: 0.4 + 0.95 * f,
        size: 0.62 + 0.55 * f,
        alive: out ? 0 : 1,
        lightI: v.lightI, light: v.light.clone(),
      };
      if (opts.reduced || paused || !running) settle();
      sync();
    },
    setPaused(b) { paused = b; if (b) draw(0); sync(); },
    dispose() {
      renderer.setAnimationLoop(null);
      io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
