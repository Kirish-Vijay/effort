// walker3d.js: the 3D toon version of the Effort walker (2D original: character.js).
// Same quiz answers → same character: body shape family, palette + hue, belly, land pattern, creature ears/tail,
// eye + mouth style, cheeks/freckles, birth-month badge, hat and carried item. Everything is built from three.js
// primitives, cel-shaded (MeshToonMaterial + 3-step gradient) with an ink inverted-hull outline.
// three.js is passed in, never imported, so this file works with whatever copy the page loaded.
//
//   const w = buildWalker(THREE, answers, opts);  scene.add(w.group);  ...  w.update(dt);  w.play("attack");
//   opts: { detail: 1 (0.5..2, body tessellation; 2 for close-up menus), texSize: 1024, outline: 0.024,
//           shadow: true (soft blob shadow), castShadow: false, castColor: "#5dff95", phase: number }

const INK = "#1f2a24";
const IDS = ["time", "pace", "land", "carry", "creature", "morning", "laugh", "hat", "hue", "month", "number", "word"];

// ---------- the same seeded randomness + traits as character.js ----------
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0) * 4294967296 + (h1 >>> 0);
}
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}
const PALETTES = {
  dawn: (h) => ({ body: hsl(h, 62, 80), shade: hsl(h, 50, 68), belly: hsl(h + 10, 70, 90), pattern: hsl(h - 12, 55, 66) }),
  noon: (h) => ({ body: hsl(h, 78, 62), shade: hsl(h, 70, 50), belly: hsl(h + 8, 85, 82), pattern: hsl(h - 10, 70, 48) }),
  golden: (h) => ({ body: hsl(h + 14, 62, 60), shade: hsl(h + 8, 55, 47), belly: hsl(h + 30, 75, 80), pattern: hsl(h - 4, 58, 45) }),
  night: (h) => ({ body: hsl(h, 40, 42), shade: hsl(h, 38, 32), belly: hsl(h, 38, 60), pattern: hsl(h + 18, 45, 30) }),
};
const SHAPES = {
  amble: { n: 2.2, wf: () => 1 },
  stroll: { n: 2.3, wf: (t) => 1 - 0.07 * Math.sin(Math.PI * t) },
  march: { n: 3.6, wf: () => 1 },
  strut: { n: 2.5, wf: () => 1 },
  wander: { n: 2.2, wf: (t) => 0.78 + 0.32 * t },
  dash: { n: 2.4, wf: (t) => 0.62 + 0.48 * t },
};
const signature = (a) => IDS.map((id) => String(a[id] ?? "").trim().toLowerCase()).join("|");
function traits(a) {
  const sig = signature(a);
  const r = rng(hash(sig));
  const word = rng(hash("w:" + String(a.word || "").trim().toLowerCase()));
  const num = Math.max(1, Math.min(99, Number(a.number) || 7));
  const hue = Number.isFinite(Number(a.hue)) ? Number(a.hue) : Math.floor(r() * 360);
  const pal = (PALETTES[a.time] || PALETTES.noon)(hue);
  return {
    sig, hue, num,
    pal: { ...pal, accent: hsl(hue + 150 + num * 3, 72, 54), accent2: hsl(hue + 200 + num * 5, 68, 62), cheek: "#ff8a8a" },
    shape: SHAPES[a.pace] ? a.pace : "stroll",
    pattern: a.land || "forest", carry: a.carry || "none", feature: a.creature || "bear",
    eyes: a.morning || "coffee", mouth: a.laugh || "giggle", hat: a.hat || "none", month: Number(a.month) || 0,
    scaleX: 0.92 + word() * 0.18, scaleY: 0.92 + word() * 0.16, tilt: (word() - 0.5) * 8,
    eyeGap: 15 + word() * 9, eyeY: 0.36 + word() * 0.1, cheeks: word() > 0.35, freckles: num % 6,
    seed: hash(sig + "#detail"),
  };
}

/** UI colours for a walker: { body, belly, accent } as #rrggbb. */
export function walkerColors(answers) {
  const p = traits(answers || {}).pal;
  return { body: p.body, belly: p.belly, accent: p.accent };
}

// ---------- shaders: cel shading extras + ink hull ----------
const TOON_UNI = "uniform vec3 uTint; uniform float uTintAmt; uniform vec3 uFlash; uniform float uFlashAmt; uniform float uGloss; uniform float uRim;";
const TOON_FRAG = `{
  vec3 wkV = normalize( vViewPosition );
  float wkNV = clamp( dot( normal, wkV ), 0.0, 1.0 );
  vec3 wkBase = diffuseColor.rgb;
  outgoingLight += wkBase * 0.10;
  outgoingLight += wkBase * uRim * smoothstep( 0.66, 0.74, 1.0 - wkNV );
  float wkSp = dot( normal, normalize( vec3( -0.42, 0.62, 0.66 ) ) );
  outgoingLight = mix( outgoingLight, vec3( 1.0 ), uGloss * 0.85 * smoothstep( 0.972, 0.982, wkSp ) );
  outgoingLight = mix( outgoingLight, uTint, uTintAmt );
  outgoingLight = mix( outgoingLight, uFlash, uFlashAmt );
}`;
function toonCompile(shader) {
  const u = this.userData;
  Object.assign(shader.uniforms, { uTint: u.wu.uTint, uTintAmt: u.wu.uTintAmt, uFlash: u.wu.uFlash, uFlashAmt: u.wu.uFlashAmt, uGloss: u.gloss, uRim: u.rim });
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\n" + TOON_UNI)
    .replace("#include <opaque_fragment>", TOON_FRAG + "\n#include <opaque_fragment>");
}
function inkCompile(shader) {
  const u = this.userData;
  shader.uniforms.uOutline = u.width;
  shader.uniforms.uOutScale = u.wu.uOutScale;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nuniform float uOutline; uniform float uOutScale;")
    .replace("#include <project_vertex>", `vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
  mvPosition.xyz += normalize( normalMatrix * normal ) * uOutline * uOutScale;
  gl_Position = projectionMatrix * mvPosition;`);
}

const gradCache = new WeakMap();
function gradientMap(THREE) {
  let g = gradCache.get(THREE);
  if (!g) {
    g = new THREE.DataTexture(new Uint8Array([92, 178, 255]), 3, 1, THREE.RedFormat);
    g.minFilter = g.magFilter = THREE.NearestFilter;
    g.generateMipmaps = false;
    g.needsUpdate = true;
    gradCache.set(THREE, g);
  }
  return g;
}

// ---------- animation helpers ----------
const EASE = {
  s: (x) => x * x * (3 - 2 * x),
  o: (x) => 1 - (1 - x) * (1 - x) * (1 - x),
  i: (x) => x * x * x,
  l: (x) => x,
};
function kf(p, keys) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    if (p <= t1) {
      const [t0, v0] = keys[i - 1];
      return v0 + (v1 - v0) * EASE[e || "s"]((p - t0) / (t1 - t0 || 1));
    }
  }
  return keys[keys.length - 1][1];
}
const CH = ["px", "py", "pz", "rx", "ry", "sway", "top", "sq", "aLx", "aLz", "aRx", "aRz", "glow", "flash"];
// One-shot actions: keyframed offsets from the rest pose over p = 0..1.
const ACTIONS = {
  attack: { dur: 0.35, k: {
    pz: [[0, 0], [0.22, 0.06], [0.5, -0.42, "o"], [0.75, -0.3], [1, 0]],
    py: [[0, 0], [0.22, 0], [0.4, 0.16, "o"], [0.56, 0, "i"], [1, 0]],
    rx: [[0, 0], [0.22, 0.16], [0.5, -0.4, "o"], [0.75, -0.18], [1, 0]],
    ry: [[0, 0], [0.22, 0.25], [0.5, -0.3], [1, 0]],
    sq: [[0, 0], [0.22, -0.18], [0.38, 0.14], [0.56, -0.12], [0.75, 0.03], [1, 0]],
    aRx: [[0, 0], [0.22, -0.9], [0.5, 2.0, "o"], [0.7, 1.7], [1, 0]],
    aRz: [[0, 0], [0.22, 0.2], [0.5, -0.65], [1, 0]],
    aLx: [[0, 0], [0.5, -0.5], [1, 0]],
  } },
  big: { dur: 0.7, k: {
    py: [[0, 0], [0.4, 0], [0.52, 0.38, "o"], [0.63, 0, "i"], [1, 0]],
    pz: [[0, 0], [0.4, 0.1], [0.63, -0.38], [0.82, -0.32], [1, 0]],
    rx: [[0, 0], [0.4, 0.18], [0.54, -0.15], [0.64, -0.5, "o"], [0.82, -0.4], [1, 0]],
    sq: [[0, 0], [0.4, -0.15], [0.52, 0.24], [0.64, -0.3], [0.75, 0.08], [0.88, -0.03], [1, 0]],
    aRx: [[0, 0], [0.4, 2.8], [0.52, 3.0], [0.64, 1.2, "o"], [0.82, 1.0], [1, 0]],
    aLx: [[0, 0], [0.4, 2.8], [0.52, 3.0], [0.64, 1.2, "o"], [0.82, 1.0], [1, 0]],
    aRz: [[0, 0], [0.4, -0.25], [0.64, -0.1], [1, 0]],
    aLz: [[0, 0], [0.4, 0.25], [0.64, 0.1], [1, 0]],
  } },
  hurt: { dur: 0.3, flash: "#ff3b30", k: {
    pz: [[0, 0], [0.22, 0.17, "o"], [1, 0]],
    rx: [[0, 0], [0.2, 0.42, "o"], [1, 0]],
    sq: [[0, 0], [0.2, -0.2], [0.5, 0.06], [1, 0]],
    aRx: [[0, 0], [0.2, -0.7], [1, 0]], aLx: [[0, 0], [0.2, -0.5], [1, 0]],
    aRz: [[0, 0], [0.2, 0.6], [1, 0]], aLz: [[0, 0], [0.2, -0.6], [1, 0]],
    flash: [[0, 0.8], [1, 0]],
  } },
  down: { dur: 0.7, hold: true, flash: "#ff3b30", k: {
    top: [[0, 0], [0.18, -0.06], [0.72, 1, "i"], [0.84, 0.9, "o"], [1, 1, "i"]],
    py: [[0, 0], [0.18, 0.04], [0.72, 0]],
    sq: [[0, 0], [0.18, -0.12], [0.7, 0.02], [0.8, -0.15], [1, 0]],
    aRz: [[0, 0], [0.7, 1.6], [1, 1.3]], aLz: [[0, 0], [0.7, -0.8], [1, -0.6]],
    flash: [[0, 0.6], [0.35, 0]],
  } },
  revive: { dur: 0.55, flash: "#fff1a8", k: {
    top: [[0, 1], [0.45, 0, "o"], [1, 0]],
    py: [[0, 0], [0.3, 0.32, "o"], [0.6, 0, "i"], [1, 0]],
    sq: [[0, 0], [0.3, 0.2], [0.62, -0.2], [0.8, 0.06], [1, 0]],
    aRx: [[0, 0], [0.35, 2.6], [1, 0]], aLx: [[0, 0], [0.35, 2.4], [1, 0]],
    flash: [[0, 0], [0.25, 0.55], [1, 0]],
  } },
  cast: { dur: 0.5, k: {
    aRx: [[0, 0], [0.3, 1.45, "o"], [0.8, 1.45], [1, 0]], aLx: [[0, 0], [0.3, 1.4, "o"], [0.8, 1.4], [1, 0]],
    aRz: [[0, 0], [0.3, -0.3], [0.8, -0.3], [1, 0]], aLz: [[0, 0], [0.3, 0.3], [0.8, 0.3], [1, 0]],
    glow: [[0, 0], [0.3, 1], [0.8, 1], [1, 0]],
    sq: [[0, 0], [0.3, 0.06], [0.8, 0.04], [1, 0]],
    py: [[0, 0], [0.4, 0.05], [1, 0]],
    flash: [[0, 0], [0.4, 0.16], [1, 0]],
  } },
};
const LOOPS = {
  idle: (time, w) => {
    const a = w.omega * time + w.phase;
    return { sq: 0.028 * Math.sin(a), aRz: 0.06 * Math.sin(a + 0.8), aLz: -0.04 * Math.sin(a + 0.5), aRx: 0.07 * Math.sin(a * 0.5 + 1),
      sway: 0.03 * Math.sin(a * 0.5 + w.phase), ry: 0.04 * Math.sin(a * 0.37 + 2) };
  },
  cheer: (time, w, t) => {
    const p = (t % 0.5) / 0.5, h = Math.sin(Math.PI * p);
    return { py: 0.2 * h, sq: 0.18 * (h - 0.4), aRx: 2.7 + 0.2 * Math.sin(4 * Math.PI * p), aLx: 2.5 + 0.2 * Math.sin(4 * Math.PI * p + 1),
      aRz: 0.3 * Math.sin(2 * Math.PI * p), aLz: -0.3 * Math.sin(2 * Math.PI * p), ry: 0.15 * Math.sin(2 * Math.PI * p) };
  },
  block: (time, w, t) => ({ sq: -0.1, rx: -0.12, pz: 0.02, px: 0.006 * Math.sin(t * 50), aRx: 1.9, aRz: -0.75, aLx: 1.9, aLz: 0.75 }),
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sp = (v, e) => Math.sign(v) * Math.abs(v) ** e;

/**
 * buildWalker(THREE, answers, opts) → { group, height, update(dt), play(action), setTint(color|null), dispose() }
 * group: feet at y=0, ~1.5-1.8 tall, facing -Z.  Actions: idle, attack, big, hurt, down, revive, cheer, block, cast.
 */
export function buildWalker(THREE, answers, opts = {}) {
  const V3 = THREE.Vector3;
  const t = traits(answers || {});
  const pal = t.pal;
  const rnd = rng(t.seed + 101);
  const detail = clamp(opts.detail || 1, 0.5, 2);
  const OUT = opts.outline ?? 0.024;

  // ---------- resources (per walker, so dispose() never touches another walker) ----------
  const geos = new Set(), mats = new Set(), texs = new Set();
  const gcache = new Map(), mcache = new Map();
  const G = (key, make) => { let g = gcache.get(key); if (!g) { g = make(); gcache.set(key, g); geos.add(g); } return g; };
  const wu = {
    uTint: { value: new THREE.Color(0, 0, 0) }, uTintAmt: { value: 0 },
    uFlash: { value: new THREE.Color(1, 0.2, 0.2) }, uFlashAmt: { value: 0 }, uOutScale: { value: 1 },
  };
  function toon(hex, o = {}) {
    const key = `t|${hex}|${o.gloss ?? 1}|${o.side || 0}|${o.map ? o.map.uuid : ""}`;
    let m = mcache.get(key);
    if (!m) {
      m = new THREE.MeshToonMaterial({ color: o.map ? 0xffffff : hex, map: o.map || null, gradientMap: gradientMap(THREE), side: o.side || THREE.FrontSide });
      m.userData = { wu, gloss: { value: o.gloss ?? 1 }, rim: { value: o.rim ?? 0.32 } };
      m.onBeforeCompile = toonCompile;
      mcache.set(key, m); mats.add(m);
    }
    return m;
  }
  function inkMat(w) {
    const key = "ink|" + w;
    let m = mcache.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
      m.userData = { wu, width: { value: w } };
      m.onBeforeCompile = inkCompile;
      mcache.set(key, m); mats.add(m);
    }
    return m;
  }
  // A mesh plus (optionally) its ink hull, which shares the geometry and is pushed out along the normals.
  function part(geo, mat, parent, o = {}) {
    const m = new THREE.Mesh(geo, mat);
    if (opts.castShadow) m.castShadow = true;
    const w = o.outline ?? 1;
    if (w) {
      const ink = new THREE.Mesh(geo, inkMat(o.hull ? 0 : +(OUT * w).toFixed(4)));
      if (o.hull) ink.scale.setScalar(o.hull);
      m.add(ink);
    }
    if (parent) parent.add(m);
    return m;
  }

  // ---------- body: a superellipsoid "bean" whose profile is the 2D body outline ----------
  const shape = SHAPES[t.shape];
  const n = shape.n, nc = 2 + Math.max(0, n - 2.2) * 0.45;
  const BW = 0.47 * t.scaleX, BH = 0.52 * t.scaleY, DEPTH = 0.86;
  const Y0 = 0.18, YC = Y0 + BH, TOP = YC + BH;
  const bwS = 50 * t.scaleX, bhS = 54 * t.scaleY; // 2D body half-size in svg units
  const K = BH / bhS; // svg unit → world
  // Profile (2D superellipse outline, latitude ph) and cross-section (superellipse, angle th). Both are
  // re-parameterised by arc length so mesh rings/columns and the painted texture spread evenly over the surface.
  const profR = (ph) => BW * Math.abs(Math.cos(ph)) ** (2 / n) * shape.wf((sp(Math.sin(ph), 2 / n) + 1) / 2);
  const profY = (ph) => YC - BH * sp(Math.sin(ph), 2 / n);
  const PT = arcTable(720, -Math.PI / 2, Math.PI / 2, (ph) => [profR(ph), profY(ph)]);
  const CT = arcTable(720, -Math.PI, Math.PI, (th) => [sp(Math.sin(th), 2 / nc), DEPTH * sp(Math.cos(th), 2 / nc)]);
  const phiOfS = (s) => lookup(PT.L, PT.a, s), sOfPhi = (ph) => lookup(PT.a, PT.L, ph);
  const thOfU = (u) => lookup(CT.L, CT.a, u - Math.floor(u)), uOfTh = (th) => lookup(CT.a, CT.L, th);
  const sOfYY = (yy) => sOfPhi(Math.asin(clamp(sp(yy, n / 2), -1, 1)));
  const yyOfS = (s) => sp(Math.sin(phiOfS(s)), 2 / n);
  const radAt = (s) => profR(phiOfS(s));
  // u: 0..1 around (0.5 = front, seam at the back), s: 0 top .. 1 bottom. Front faces -Z, viewer-right is -X.
  function P(u, s, out = new V3()) {
    const ph = phiOfS(s), R = profR(ph), th = thOfU(u);
    return out.set(-R * sp(Math.sin(th), 2 / nc), profY(ph), -R * DEPTH * sp(Math.cos(th), 2 / nc));
  }
  const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3();
  function normalAt(u, s, out = new V3()) {
    const e = 1e-3, s0 = clamp(s - e, 0.001, 0.999), s1 = clamp(s + e, 0.001, 0.999);
    P(u - e, s, _a); P(u + e, s, _b); _c.subVectors(_b, _a);
    P(u, s0, _a); P(u, s1, _b); _d.subVectors(_b, _a);
    return out.crossVectors(_d, _c).normalize();
  }
  // 2D (svg offsets from body centre: x right, y down) → surface (u, s).
  function frontUS(X, Y) {
    const s = sOfYY(clamp(Y / bhS, -0.999, 0.999));
    const R = radAt(s) || 1e-4;
    const f = clamp((X * BW / bwS) / R, -1, 1);
    return { u: uOfTh(Math.asin(sp(f, nc / 2))), s };
  }
  const UP = new V3(0, 1, 0), FRONT = new V3(0, 0, -1);
  function quatZ(z, upHint = UP) { // local +z = z, +y ≈ up, +x = viewer-right
    const x = new V3().crossVectors(upHint, z);
    if (x.lengthSq() < 1e-6) x.set(-1, 0, 0);
    x.normalize();
    const y = new V3().crossVectors(z, x).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  function quatY(y, zHint = FRONT) { // local +y = y, +z ≈ zHint
    y = y.clone().normalize();
    const z = zHint.clone().sub(y.clone().multiplyScalar(zHint.dot(y)));
    if (z.lengthSq() < 1e-6) z.set(0, 0, -1);
    z.normalize();
    const x = new V3().crossVectors(y, z).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  function mount(obj, u, s, lift = 0, parent) {
    const p = P(u, s), nrm = normalAt(u, s);
    obj.position.copy(p).addScaledVector(nrm, lift);
    obj.quaternion.copy(quatZ(nrm));
    (parent || body).add(obj);
    return { p, nrm };
  }

  // ---------- rig ----------
  const group = new THREE.Group(); group.name = "walker";
  const mover = new THREE.Group(); group.add(mover);
  const TPX = BW * 1.05;
  const tp = new THREE.Group(); tp.position.x = TPX; mover.add(tp);
  const tpc = new THREE.Group(); tpc.position.x = -TPX; tp.add(tpc);
  const squash = new THREE.Group(); squash.position.y = Y0; tpc.add(squash);
  const lean = new THREE.Group(); squash.add(lean);
  const body = new THREE.Group(); body.position.y = -Y0; lean.add(body);
  const baseTilt = (t.tilt * Math.PI) / 180;

  const NS = Math.round(24 * detail), NR = Math.round(16 * detail);
  const bodyGeo = (() => {
    const pos = new Float32Array((NR + 1) * (NS + 1) * 3), uv = new Float32Array((NR + 1) * (NS + 1) * 2), nor = new Float32Array(pos.length);
    const v = new V3();
    for (let j = 0; j <= NR; j++) for (let i = 0; i <= NS; i++) {
      const k = j * (NS + 1) + i;
      P(i / NS, j / NR, v); pos.set([v.x, v.y, v.z], k * 3); uv.set([i / NS, 1 - j / NR], k * 2);
    }
    const id = (i, j) => j * (NS + 1) + i;
    const weld = (i, j) => (j === 0 ? 0 : j === NR ? 1 : 2 + (j - 1) * NS + (i % NS));
    const acc = new Float32Array((2 + (NR - 1) * NS) * 3);
    const idx = [];
    const va = new V3(), vb = new V3(), vc = new V3();
    const addTri = (a, b, c, ia, ib, ic) => {
      idx.push(a, b, c);
      va.fromArray(pos, a * 3); vb.fromArray(pos, b * 3); vc.fromArray(pos, c * 3);
      vb.sub(va); vc.sub(va); va.crossVectors(vb, vc);
      for (const w of [ia, ib, ic]) { acc[w * 3] += va.x; acc[w * 3 + 1] += va.y; acc[w * 3 + 2] += va.z; }
    };
    for (let j = 0; j < NR; j++) for (let i = 0; i < NS; i++) {
      const a = id(i, j), b = id(i + 1, j), c = id(i, j + 1), d = id(i + 1, j + 1);
      if (j > 0) addTri(a, c, b, weld(i, j), weld(i, j + 1), weld(i + 1, j));
      if (j < NR - 1) addTri(b, c, d, weld(i + 1, j), weld(i, j + 1), weld(i + 1, j + 1));
    }
    for (let j = 0; j <= NR; j++) for (let i = 0; i <= NS; i++) {
      const w = weld(i, j);
      v.set(acc[w * 3], acc[w * 3 + 1], acc[w * 3 + 2]);
      if (j === 0) v.set(0, 1, 0); else if (j === NR) v.set(0, -1, 0);
      v.normalize(); nor.set([v.x, v.y, v.z], id(i, j) * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    geos.add(g);
    return g;
  })();

  // ---------- body paint: belly, land pattern, straps, badge and the 2D-style face details ----------
  const TW = opts.texSize || 1024, TH = TW / 2;
  const cvs = typeof OffscreenCanvas !== "undefined" && !opts.domCanvas ? new OffscreenCanvas(TW, TH) : Object.assign(document.createElement("canvas"), { width: TW, height: TH });
  const ctx = cvs.getContext("2d");
  function pxScale(u, s) { // canvas px per svg unit at (u, s), horizontally and vertically
    const e = 1e-3, s0 = clamp(s - e, 0.002, 0.998), s1 = clamp(s + e, 0.002, 0.998);
    P(u - e, s, _a); P(u + e, s, _b); const pu = _a.distanceTo(_b) / (2 * e);
    P(u, s0, _a); P(u, s1, _b); const ps = _a.distanceTo(_b) / (s1 - s0);
    return [Math.min((TW * K) / Math.max(pu, 1e-4), TW * 0.05), (TH * K) / Math.max(ps, 1e-4)];
  }
  function stamp(u, s, fn, scale = 1) { // draw fn in svg units centred on (u, s), wrapping round the seam
    const [ax, ay] = pxScale(u, s);
    for (const du of [0, -1, 1]) {
      const x = (u + du) * TW;
      if (x < -TW * 0.15 || x > TW * 1.15) continue;
      ctx.save(); ctx.setTransform(ax * scale, 0, 0, ay * scale, x, s * TH); fn(ctx); ctx.restore();
    }
  }
  const stampF = (X, Y, fn, scale) => { const { u, s } = frontUS(X, Y); stamp(u, s, fn, scale); };
  const path = (c, d, fill, stroke, w) => {
    const p = new Path2D(d);
    if (fill) { c.fillStyle = fill; c.fill(p); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round"; c.stroke(p); }
  };
  const ell = (c, x, y, rx, ry, fill, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); };

  ctx.fillStyle = pal.body; ctx.fillRect(0, 0, TW, TH);
  // belly: the 2D ellipse, mapped point by point onto the front
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const { u, s } = frontUS(bwS * 0.72 * Math.cos(a), bhS * 0.55 + bhS * 0.6 * Math.sin(a));
    i ? ctx.lineTo(u * TW, s * TH) : ctx.moveTo(u * TW, s * TH);
  }
  ctx.fillStyle = pal.belly; ctx.fill();
  // land pattern, all the way round so it reads from behind too
  {
    const r = rng(t.seed + 7), pc = pal.pattern;
    const sy = (yy) => sOfYY(clamp(yy, -0.99, 0.99)) * TH;
    switch (t.pattern) {
      case "mountains": {
        const N = 10;
        ctx.beginPath(); ctx.moveTo(-10, TH + 5);
        for (let i = 0; i <= N * 2; i++) ctx.lineTo((i / (N * 2)) * TW, sy(i % 2 ? 0.02 : 0.3));
        ctx.lineTo(TW + 10, TH + 5); ctx.closePath(); ctx.fillStyle = pc; ctx.fill();
        // snow caps on the peaks
        for (let i = 1; i < N * 2; i += 2) {
          const x = (i / (N * 2)) * TW, y0 = sy(0.02), y1 = sy(0.1), dx = (TW / (N * 2)) * 0.32;
          ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + dx, y1); ctx.lineTo(x + dx * 0.3, y1 - 2); ctx.lineTo(x, y1 + 3); ctx.lineTo(x - dx * 0.4, y1 - 2); ctx.lineTo(x - dx, y1); ctx.closePath();
          ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fill();
        }
        break;
      }
      case "coast": for (const k of [0.1, 0.35, 0.6]) {
        const s = sOfYY(k), [, ay] = pxScale(0.5, s);
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) { const u = i / 160; const y = s * TH - 4 * ay * Math.sin(u * Math.PI * 2 * 6); i ? ctx.lineTo(u * TW, y) : ctx.moveTo(u * TW, y); }
        ctx.strokeStyle = pc; ctx.lineWidth = 6.5 * ay; ctx.lineCap = "round"; ctx.stroke();
      } break;
      case "forest": for (let i = 0; i < 20; i++) {
        const u = (i + r() * 0.8) / 20, yy = -0.25 + r() * 1.15, rot = r() * Math.PI;
        stamp(u, sOfYY(yy), (c) => { ell(c, 0, 0, 7.5, 3.8, pc, rot); });
      } break;
      case "city": for (let g = 0; g < 4; g++) for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
        if (r() <= 0.25) continue;
        stamp(0.5 + g * 0.25, sOfYY(0.22 + (i * 13 + 4) / bhS), (c) => { c.fillStyle = pc; c.beginPath(); c.roundRect(-26 + j * 14, -4, 9, 8, 1.5); c.fill(); });
      } break;
      case "desert": for (let i = 0; i < 40; i++) {
        const rad = 1.6 + r() * 2.4, u = r(), yy = -0.45 + r() * 1.4;
        stamp(u, sOfYY(yy), (c) => ell(c, 0, 0, rad, rad, pc));
      } break;
      case "tundra": for (let i = 0; i < 18; i++) {
        const u = (i + r() * 0.7) / 18, yy = -0.35 + r() * 1.2;
        stamp(u, sOfYY(yy), (c) => { c.globalAlpha = 0.9; path(c, "M-4,0 h8 M0,-4 v8 M-3,-3 l6,6 M3,-3 l-6,6", null, "#ffffff", 1.8); }, 1.3);
      } break;
    }
  }
  // straps (backpack) / camera strap, as in the 2D front view
  const strokeFront = (pts, color, w) => {
    ctx.beginPath();
    pts.forEach(([X, Y], i) => { const { u, s } = frontUS(X, Y); i ? ctx.lineTo(u * TW, s * TH) : ctx.moveTo(u * TW, s * TH); });
    const { u, s } = frontUS(pts[1][0], pts[1][1]);
    ctx.strokeStyle = color; ctx.lineWidth = w * pxScale(u, s)[0]; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
  };
  const bez = (p0, p1, p2, N = 12) => Array.from({ length: N + 1 }, (_, i) => { const q = i / N; return [0, 1].map((k) => (1 - q) ** 2 * p0[k] + 2 * (1 - q) * q * p1[k] + q * q * p2[k]); });
  if (t.carry === "backpack") for (const d of [-1, 1]) {
    const pts = bez([d * bwS * 0.8, -bhS * 0.62], [d * bwS * 0.6, -bhS * 0.05], [d * bwS * 0.74, bhS * 0.42]);
    strokeFront(pts, INK, 8.5); strokeFront(pts, pal.accent, 5.5);
  }
  if (t.carry === "camera") for (const d of [-1, 1]) strokeFront(bez([d * bwS * 0.55, -bhS * 0.85], [d * bwS * 0.3, -bhS * 0.2], [0, 4]), INK, 3);
  // birth-month badge
  stampF(-bwS * 0.42, bhS * 0.3, (c) => {
    c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fillStyle = "#fffdf6"; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    drawSigil(c, t.month % 12, pal.accent);
  }, 1.1);
  // face
  const E = 1.25; // eyes a touch bigger than 2D so they read on a phone
  const eyeYS = bhS * (2 * t.eyeY - 1), gap = t.eyeGap;
  if (t.cheeks) for (const d of [-1, 1]) stampF(d * (gap + 9), eyeYS + 13, (c) => { c.globalAlpha = 0.6; ell(c, 0, 0, 6.5, 3.8, pal.cheek); });
  {
    const fr = rng(t.seed + 3);
    for (let i = 0; i < t.freckles; i++) {
      const X = (i % 2 ? 1 : -1) * (gap + 4 + fr() * 8), Y = eyeYS + 7 + fr() * 6;
      stampF(X, Y, (c) => { c.globalAlpha = 0.55; ell(c, 0, 0, 1.4, 1.4, INK); });
    }
  }
  const eye3d = ["coffee", "out", "stretch"].includes(t.eyes) ? t.eyes : null;
  for (const d of [-1, 1]) stampF(d * gap, eyeYS, (c) => {
    switch (t.eyes) {
      case "coffee": ell(c, 0, 0, 8.9, 8.9, INK); break; // ink rim under the 3D eyeball
      case "out": path(c, `M${-7 * d},-9.5 L${6 * d},-5`, null, INK, 3.2); break;
      case "snooze": path(c, "M-7,0 Q0,7 7,0", null, INK, 3); break;
      case "music": path(c, "M-7,3 Q0,-6 7,3", null, INK, 3); break;
      case "stretch": path(c, `M${3 * d},-5.5 l${4 * d},-4 M${5.5 * d},-2 l${5 * d},-2`, null, INK, 2); break;
      case "scroll": path(c, "M0,0 m-1,0 a1,1 0 1,1 2,0 a2.5,2.5 0 1,1 -5,0 a4,4 0 1,1 8,0 a5.5,5.5 0 1,1 -11,0", null, INK, 2); break;
    }
  }, E);
  stampF(0, eyeYS + (t.feature === "crow" ? 27 : 17), (c) => {
    switch (t.mouth) {
      case "giggle": path(c, "M-7,0 Q0,7 7,0", null, INK, 3); break;
      case "snort": path(c, "M-8,-1 H8 Q8,11 0,11 Q-8,11 -8,-1Z", INK); ell(c, 0, 8, 4, 2.4, "#ff8f9a"); break;
      case "cackle": path(c, "M-12,-2 Q0,13 12,-2Z", INK); c.fillStyle = "#fff"; c.fillRect(-6, -2, 5, 4); break;
      case "silent": path(c, "M-6,2 q3,-2 6,0 t6,0", null, INK, 3); break;
      case "boom": ell(c, 0, 5, 8, 9, INK); ell(c, 0, 10, 5, 3, "#ff8f9a"); break;
      case "wheeze": path(c, "M-9,2 l4.5,-4 l4.5,4 l4.5,-4 l4.5,4", null, INK, 2.6); break;
      default: path(c, "M-6,3 H6", null, INK, 3);
    }
  }, 1.15);
  const bodyTex = new THREE.CanvasTexture(cvs);
  bodyTex.colorSpace = THREE.SRGBColorSpace;
  bodyTex.anisotropy = 4;
  texs.add(bodyTex);
  part(bodyGeo, toon("#ffffff", { map: bodyTex }), body);

  // ---------- shared little geometries ----------
  const sphere = (w = 10, h = 7) => G(`sph${w}x${h}`, () => new THREE.SphereGeometry(1, w, h));
  const dome = (w = 12, h = 4) => G(`dome${w}x${h}`, () => new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)); // pole on +z
  const capDome = (w = 16, h = 5) => G(`cdome${w}x${h}`, () => new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI / 2)); // pole on +y
  const lathe = (key, pts, segs = 12) => G(key, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs));
  const capsule = (r, len, cs = 3, rs = 8) => G(`cap${r}|${len}|${cs}|${rs}`, () => new THREE.CapsuleGeometry(r, len, cs, rs));
  const roundBox = (w, h, d, r, s = 1) => G(`rb${w}|${h}|${d}|${r}|${s}`, () => roundedBox(THREE, w, h, d, r, s));
  const mesh = (geo, color, parent, o = {}) => part(geo, toon(color, o), parent, o);

  // ---------- eyes (3D for dot styles, painted for the rest) ----------
  const eyes = new THREE.Group(); body.add(eyes);
  if (eye3d) for (const d of [-1, 1]) {
    const { u, s } = frontUS(d * gap, eyeYS);
    const eg = new THREE.Group(); mount(eg, u, s, -0.004, eyes);
    if (eye3d === "coffee") {
      const rw = 7.5 * E * K, rp = 4.1 * E * K;
      mesh(dome(12, 4), "#ffffff", eg, { outline: 0, gloss: 0.6 }).scale.set(rw, rw, rw * 0.5);
      const ox = 1.1 * E * K, oy = -1 * E * K;
      const zz = rw * 0.5 * Math.sqrt(Math.max(0, 1 - (ox * ox + oy * oy) / (rw * rw)));
      const pn = new V3(ox / (rw * rw), oy / (rw * rw), zz / (rw * rw * 0.25)).normalize();
      const pup = mesh(dome(10, 3), INK, eg, { outline: 0, gloss: 0.9 });
      pup.position.set(ox, oy, zz - 0.002); pup.quaternion.copy(quatZ(pn)); pup.scale.set(rp, rp, rp * 0.45);
      const hl = mesh(dome(6, 2), "#ffffff", eg, { outline: 0, gloss: 0 });
      hl.position.set(ox + 1.5 * E * K, oy + 1.9 * E * K, zz + rp * 0.25); hl.scale.setScalar(1.5 * E * K).multiply(new V3(1, 1, 0.4));
    } else {
      const rb = (eye3d === "out" ? 4.4 : 5.2) * E * K;
      mesh(dome(10, 4), INK, eg, { outline: 0, gloss: 1 }).scale.set(rb, rb, rb * 0.6);
      const hl = mesh(dome(6, 2), "#ffffff", eg, { outline: 0, gloss: 0 });
      hl.position.set(rb * 0.35, rb * 0.38, rb * 0.5); hl.scale.set(rb * 0.32, rb * 0.32, rb * 0.15);
    }
  }
  if (t.feature === "crow") {
    const { u, s } = frontUS(0, eyeYS + 14);
    const bk = new THREE.Group(); mount(bk, u, s, -0.01);
    const g = lathe("beak", [[0.07, 0], [0.065, 0.03], [0.04, 0.08], [0.012, 0.125], [0, 0.13]], 10);
    const m = mesh(g, "#f2a01c", bk, { outline: 0.6, gloss: 0.6 }); m.rotation.x = Math.PI / 2 + 0.25; m.scale.set(1, 1, 0.7);
  }

  // ---------- creature: ears/antennae on top, a tail (or wings, or a pet) on the back ----------
  const featureGroup = new THREE.Group(); body.add(featureGroup);
  const wobblers = []; // antenna / stalk groups that bob a little
  function earAt(d, yy, uOff = 0.25, axisUp = 1.5) {
    const s = sOfYY(yy), u = 0.5 + d * uOff;
    const p = P(u, s), nrm = normalAt(u, s);
    const g = new THREE.Group();
    g.position.copy(p).addScaledVector(nrm, -0.02);
    g.quaternion.copy(quatY(nrm.clone().add(UP.clone().multiplyScalar(axisUp))));
    featureGroup.add(g);
    return g;
  }
  const covered = ["beanie", "cap", "bucket", "wizard"].includes(t.hat);
  switch (t.feature) {
    case "fox": case "cat": {
      const big = t.feature === "fox";
      const h = big ? 0.27 : 0.2, w = big ? 0.125 : 0.105;
      const g = lathe(`ear${big}`, [[w, 0], [w * 0.92, h * 0.25], [w * 0.55, h * 0.65], [w * 0.15, h * 0.95], [0, h]], 8);
      for (const d of [-1, 1]) {
        const e = earAt(d, -0.78, 0.22, 1.2);
        mesh(g, pal.body, e).scale.set(1, 1, 0.5);
        const inner = mesh(g, big ? pal.belly : pal.cheek, e, { outline: 0, gloss: 0.3 });
        inner.scale.set(0.58, 0.72, 0.22); inner.position.set(0, 0.03, 0.035);
      }
      break;
    }
    case "bear": for (const d of [-1, 1]) {
      const e = earAt(d, -0.8, 0.21, 1.4);
      mesh(sphere(8, 6), pal.body, e).scale.set(0.12, 0.12, 0.075);
      const inner = mesh(sphere(6, 4), pal.belly, e, { outline: 0 }); inner.scale.set(0.068, 0.068, 0.03); inner.position.set(0, 0.012, 0.05);
    } break;
    case "owl": for (const d of [-1, 1]) {
      const e = earAt(d, -0.78, 0.22, 1.1);
      const g = G(`tuft${d}`, () => bend(new THREE.LatheGeometry([[0.08, 0], [0.07, 0.07], [0.04, 0.15], [0.012, 0.22], [0, 0.23]].map(([x, y]) => new THREE.Vector2(x, y)), 9), -d * 0.14, 0.23));
      mesh(g, pal.shade, e).scale.set(1, 1, 0.55);
    } break;
    case "frog": for (const d of [-1, 1]) {
      const e = earAt(d, -0.84, 0.12, 0.6);
      const b = mesh(sphere(9, 6), pal.body, e); b.scale.set(0.13, 0.13, 0.13); b.position.y = 0.035;
    } break;
    case "snail": for (const d of [-1, 1]) {
      const e = covered ? earAt(d, -0.7, 0.19, 1.6) : earAt(d, -0.94, 0.07, 1.2);
      const w = new THREE.Group(); e.add(w); w.rotation.z = -d * 0.35; wobblers.push(w);
      const st = mesh(capsule(0.017, 0.2, 2, 5), INK, w, { outline: 0, gloss: 0 }); st.position.y = 0.1;
      const ball = mesh(sphere(7, 5), pal.accent, w); ball.scale.setScalar(0.052); ball.position.y = 0.23;
    } break;
    case "moth": for (const d of [-1, 1]) {
      const e = covered ? earAt(d, -0.7, 0.19, 1.6) : earAt(d, -0.93, 0.06, 1.2);
      const w = new THREE.Group(); e.add(w); wobblers.push(w);
      const curve = new THREE.QuadraticBezierCurve3(new V3(0, 0, 0), new V3(-d * 0.02, 0.18, 0), new V3(-d * 0.2, 0.26, 0.02));
      mesh(G(`ant${d}`, () => new THREE.TubeGeometry(curve, 8, 0.013, 4)), INK, w, { outline: 0, gloss: 0 });
      const f = mesh(sphere(8, 5), pal.shade, w, { outline: 0.6 });
      const mid = curve.getPoint(0.72), tan = curve.getTangent(0.72);
      f.position.copy(mid); f.quaternion.copy(quatY(tan)); f.scale.set(0.045, 0.1, 0.014);
    } break;
  }
  // back attachments live in a frame at the back centre: +z out of the back, +x = screen-right seen from behind
  const backFrame = (yy) => { const g = new THREE.Group(); mount(g, 0, sOfYY(yy), -0.01); return g; };
  const tail = new THREE.Group();
  switch (t.feature) {
    case "fox": {
      const g = backFrame(0.62); g.add(tail);
      tail.quaternion.copy(quatY(new V3(0.55, 0.75, 0.38), new V3(0, 0, 1)));
      const tl = (key, pts) => G(key, () => bend(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 9), -0.05, 0.44, 0.2));
      mesh(tl("foxtail", [[0.02, 0], [0.08, 0.05], [0.125, 0.15], [0.125, 0.27], [0.1, 0.34]]), pal.body, tail);
      mesh(tl("foxtip", [[0.102, 0.33], [0.085, 0.38], [0.045, 0.42], [0, 0.44]]), pal.belly, tail);
      break;
    }
    case "cat": {
      const g = backFrame(0.62); g.add(tail);
      const curve = new THREE.CatmullRomCurve3([new V3(0, 0, -0.03), new V3(0.04, 0.02, 0.12), new V3(0.12, 0.15, 0.2), new V3(0.11, 0.31, 0.19), new V3(0.04, 0.37, 0.13)]);
      mesh(G("cattail", () => new THREE.TubeGeometry(curve, 14, 0.036, 6)), pal.body, tail);
      const tip = mesh(sphere(8, 5), pal.body, tail); tip.position.copy(curve.getPoint(1)); tip.scale.setScalar(0.036);
      break;
    }
    case "bear": {
      const g = backFrame(0.68); g.add(tail);
      mesh(sphere(8, 6), pal.body, tail).scale.setScalar(0.075);
      break;
    }
    case "owl": case "crow": {
      const g = backFrame(0.7); g.add(tail);
      tail.quaternion.copy(quatY(new V3(0, -0.45, 0.9), new V3(0, 1, 0)));
      const col = t.feature === "crow" ? mixHex(pal.shade, INK, 0.45) : pal.shade;
      for (const k of [-1, 0, 1]) {
        const f = mesh(sphere(8, 5), col, tail);
        f.rotation.z = k * 0.42; f.position.set(-Math.sin(k * 0.42) * 0.12, Math.cos(k * 0.42) * 0.12, 0); f.scale.set(0.055, 0.15, 0.022);
      }
      break;
    }
    case "moth": {
      const g = backFrame(-0.25); g.add(tail);
      for (const d of [-1, 1]) {
        const up = mesh(sphere(9, 5), pal.accent2, tail, { gloss: 0.5 });
        up.position.set(d * 0.17, 0.1, 0.05); up.rotation.set(0, d * 0.35, d * 0.5); up.scale.set(0.2, 0.13, 0.022);
        const spot = mesh(sphere(7, 3), pal.pattern, up, { outline: 0 }); spot.position.set(0.25, 0.1, 0.9); spot.scale.set(0.35, 0.45, 0.4);
        const lo = mesh(sphere(7, 4), pal.accent2, tail, { gloss: 0.5 });
        lo.position.set(d * 0.11, -0.1, 0.04); lo.rotation.set(0, d * 0.3, -d * 0.45); lo.scale.set(0.12, 0.085, 0.02);
      }
      break;
    }
    case "snail": { // a tiny pet snail riding on the right shoulder
      const pet = new THREE.Group(); const { nrm } = mount(pet, 0.24, sOfYY(-0.3), -0.012);
      pet.quaternion.copy(quatY(nrm.clone().multiplyScalar(0.7).add(new V3(0, 1, 0)), new V3(0, 0, -1)));
      tail.scale.setScalar(1.9); pet.add(tail);
      const foot = mesh(capsule(0.03, 0.09, 1, 6), "#e9c27a", tail); foot.rotation.x = Math.PI / 2; foot.position.set(0, 0.022, 0);
      const shell = mesh(sphere(8, 6), "#c77d3a", tail); shell.position.set(0, 0.075, 0.025); shell.scale.set(0.045, 0.058, 0.058);
      const sw = mesh(G("swirl", () => new THREE.TorusGeometry(0.022, 0.0065, 4, 12)), INK, tail, { outline: 0, gloss: 0 });
      sw.position.set(0.046, 0.075, 0.025); sw.rotation.y = Math.PI / 2;
      for (const d of [-1, 1]) {
        const st = mesh(capsule(0.006, 0.04, 1, 4), INK, tail, { outline: 0, gloss: 0 });
        st.position.set(d * 0.012, 0.055, -0.07); st.rotation.x = -0.5;
        const b = mesh(sphere(6, 4), INK, tail, { outline: 0 }); b.position.set(d * 0.013, 0.075, -0.082); b.scale.setScalar(0.009);
      }
      break;
    }
  }

  // ---------- feet + legs ----------
  const legX = BW * 0.42;
  for (const d of [-1, 1]) {
    const leg = mesh(capsule(0.06, 0.1, 1, 6), pal.shade, tpc, { outline: 0 }); leg.position.set(d * legX, 0.17, 0);
    const shoe = mesh(sphere(8, 5), pal.accent2, tpc); shoe.position.set(d * legX * 1.05, 0.07, -0.035); shoe.scale.set(0.115, 0.075, 0.16);
  }

  // ---------- arms (L = the walker's left = -X = viewer-right in front view; it holds the item) ----------
  const held = ["umbrella", "stick", "book"].includes(t.carry);
  const NEUTRAL = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, sway: 0, top: 0, sq: 1, aLx: held ? 0.25 : 0, aLz: held ? -0.3 : -0.42, aRx: 0, aRz: 0.42, glow: 0, flash: 0 };
  const shR = radAt(sOfYY(-0.04)), shY = YC + BH * 0.04;
  const ARM = 0.21;
  const armGeo = capsule(0.068, 0.15, 2, 6);
  const glowMat = new THREE.MeshBasicMaterial({ color: opts.castColor || "#5dff95", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  mats.add(glowMat);
  const glows = [];
  function makeArm(d) {
    const pivot = new THREE.Group(); pivot.position.set(-d * shR * 0.9, shY, 0); body.add(pivot);
    const a = mesh(armGeo, pal.body, pivot); a.position.y = -0.105;
    const gl = new THREE.Mesh(sphere(8, 6), glowMat); gl.position.y = -ARM; gl.scale.setScalar(0.001); pivot.add(gl); glows.push(gl);
    return pivot;
  }
  const armL = makeArm(1), armR = makeArm(-1);
  armL.rotation.set(NEUTRAL.aLx, 0, NEUTRAL.aLz); armR.rotation.set(NEUTRAL.aRx, 0, NEUTRAL.aRz);

  // ---------- hat ----------
  let hatTop = TOP;
  const hat = new THREE.Group(); body.add(hat);
  {
    const c = pal.accent, c2 = pal.accent2;
    const at = (yy) => { const s = sOfYY(yy); hat.position.y = YC - BH * yy; return { r: radAt(s) * 1.05, capH: TOP - (YC - BH * yy) }; };
    switch (t.hat) {
      case "beanie": {
        const { r, capH } = at(-0.7); const h = capH + 0.16;
        mesh(capDome(14, 4), c, hat, { gloss: 0.5 }).scale.set(r, h, r * DEPTH);
        const band = mesh(G(`band${r.toFixed(3)}`, () => new THREE.TorusGeometry(r, 0.055, 4, 16).rotateX(Math.PI / 2)), c2, hat, { outline: 0.8, gloss: 0.4 }); band.scale.z = DEPTH; band.position.y = 0.03;
        const pom = mesh(sphere(8, 5), c2, hat); pom.position.y = h + 0.045; pom.scale.setScalar(0.08);
        hatTop = hat.position.y + h + 0.12;
        break;
      }
      case "cap": {
        const { r, capH } = at(-0.68); const h = capH + 0.08;
        mesh(capDome(14, 4), c, hat, { gloss: 0.5 }).scale.set(r, h, r * DEPTH);
        const brim = mesh(sphere(12, 4), c2, hat); brim.position.set(0, 0.02, r * DEPTH * 0.92); brim.rotation.x = 0.18; brim.scale.set(r * 0.82, 0.028, r * 0.62);
        const btn = mesh(sphere(6, 4), c2, hat, { outline: 0.6 }); btn.position.y = h; btn.scale.setScalar(0.03);
        hatTop = hat.position.y + h + 0.03;
        break;
      }
      case "bucket": {
        const { r, capH } = at(-0.66); const h = capH + 0.1;
        const prof = [[r * 0.9, -0.03], [r * 1.0, -0.045], [r * 1.5, -0.09], [r * 1.56, -0.07], [r * 1.5, -0.045], [r * 1.02, 0.0], [r * 0.98, 0.05], [r * 0.86, h - 0.025], [r * 0.78, h], [0.001, h + 0.004]];
        mesh(lathe(`bucket${r.toFixed(3)}`, prof, 16), c, hat, { gloss: 0.4 });
        const band = mesh(G(`bband${r.toFixed(3)}`, () => new THREE.TorusGeometry(r * 0.985, 0.03, 4, 18).rotateX(Math.PI / 2)), c2, hat, { outline: 0 }); band.position.y = 0.065; band.scale.set(1, 1.3, 1);
        hatTop = hat.position.y + h;
        break;
      }
      case "flowers": {
        const { r } = at(-0.74);
        const petals = G("petals", () => { const g = new THREE.SphereGeometry(1, 15, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), m = 0.74 + 0.26 * Math.abs(Math.cos(2.5 * a)); p.setX(i, x * m); p.setZ(i, z * m); } g.computeVertexNormals(); return g; });
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          const f = new THREE.Group(); hat.add(f);
          const dir = new V3(Math.sin(a), 0, -Math.cos(a) * DEPTH);
          f.position.set(dir.x * r * 0.9, 0.05 + (k % 2) * 0.025, dir.z * r * 0.9);
          f.quaternion.copy(quatY(dir.clone().normalize().multiplyScalar(1.5).add(new V3(0, 1, 0))));
          mesh(petals, k % 2 ? c2 : c, f, { outline: 0.7, gloss: 0.5 }).scale.set(0.125, 0.045, 0.125);
          const ctr = mesh(sphere(7, 4), "#ffd34d", f, { outline: 0 }); ctr.position.y = 0.032; ctr.scale.set(0.048, 0.032, 0.048);
        }
        hatTop = TOP + 0.02;
        break;
      }
      case "wizard": {
        const { r, capH } = at(-0.72); const h = capH + 0.55;
        const cone = G(`wiz${r.toFixed(3)}`, () => bend(new THREE.LatheGeometry([[r, 0], [r * 0.78, h * 0.3], [r * 0.5, h * 0.6], [r * 0.22, h * 0.86], [0.03, h * 0.99], [0, h]].map(([x, y]) => new THREE.Vector2(x, y)), 14), -0.16, h, 0.1));
        mesh(cone, c, hat, { gloss: 0.35 }).scale.z = 0.95;
        const brim = mesh(lathe(`wbrim${r.toFixed(3)}`, [[r * 0.92, -0.02], [r * 1.42, -0.035], [r * 1.52, -0.012], [r * 1.42, 0.016], [r * 0.92, 0.03]], 16), c, hat);
        brim.scale.z = 0.92;
        const star = G("star", () => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 0.032 : 0.075; i ? s.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, -Math.sin(a) * rr); } return new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false }).translate(0, 0, -0.011); });
        for (const back of [0, 1]) {
          const sc = back ? 0.62 : 1, y = h * (back ? 0.42 : 0.28);
          const rr = r * (back ? 0.63 : 0.76) * 0.95;
          const st = mesh(star, "#ffd34d", hat, { hull: 1.18, gloss: 0.8 });
          st.position.set(-0.16 * (y / h) ** 2 * (back ? 1 : 1), y, back ? rr + 0.1 * (y / h) ** 2 : -rr + 0.1 * (y / h) ** 2);
          st.rotation.set(back ? -0.45 : 0.45, back ? Math.PI : 0, back ? -0.2 : 0.2); st.scale.setScalar(sc);
        }
        hatTop = hat.position.y + h;
        break;
      }
      case "band": {
        const { r } = at(-0.6);
        const band = mesh(G(`sband${r.toFixed(3)}`, () => new THREE.TorusGeometry(r * 0.97, 0.055, 4, 18).rotateX(Math.PI / 2)), c, hat); band.scale.set(1, 1.15, DEPTH);
        const knot = new THREE.Group(); knot.position.set(0, 0, r * DEPTH * 0.97); hat.add(knot);
        mesh(sphere(8, 5), c, knot).scale.set(0.05, 0.045, 0.04);
        for (const d of [-1, 1]) {
          const tie = mesh(capsule(0.03, 0.15, 1, 5), c, knot);
          tie.position.set(d * 0.05, -0.08, 0.035); tie.rotation.set(0.55, 0, d * 0.5); tie.scale.set(1, 1, 0.45);
          wobblers.push(tie);
        }
        hatTop = TOP;
        break;
      }
      default: { // no hat: "the hair is the personality" (a little tuft)
        hat.position.y = TOP - 0.02;
        const g = lathe("tuft", [[0.045, 0], [0.04, 0.04], [0.02, 0.1], [0, 0.13]], 7);
        [[-0.045, 0.45, 0.8], [0.0, 0.0, 1.0], [0.045, -0.5, 0.75]].forEach(([x, rz, sc]) => {
          const m = mesh(g, pal.shade, hat, { outline: 0.7 }); m.position.set(x, 0, -0.01); m.rotation.set(-0.25, 0, rz); m.scale.setScalar(sc);
        });
        hatTop = TOP + 0.1;
      }
    }
  }

  // ---------- carried item ----------
  const holder = new THREE.Group();
  holder.position.y = -ARM;
  holder.quaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler(NEUTRAL.aLx, 0, NEUTRAL.aLz)).invert());
  armL.add(holder);
  const handWorld = new V3(0, -ARM, 0).applyEuler(new THREE.Euler(NEUTRAL.aLx, 0, NEUTRAL.aLz)).add(armL.position);
  switch (t.carry) {
    case "backpack": {
      const g = backFrame(0.12);
      const H = 0.5 * t.scaleY;
      mesh(roundBox(0.44, H, 0.2, 0.07, 1), pal.accent, g, { gloss: 0.5 }).position.z = 0.07;
      const pocket = mesh(roundBox(0.3, 0.17, 0.08, 0.035, 1), pal.accent2, g, { outline: 0.7 }); pocket.position.set(0, -H * 0.18, 0.18);
      const flap = mesh(roundBox(0.4, 0.12, 0.08, 0.035, 1), mixHex(pal.accent, INK, 0.18), g, { outline: 0.7 }); flap.position.set(0, H * 0.4, 0.15); flap.rotation.x = 0.25;
      const loop = mesh(G("loop", () => new THREE.TorusGeometry(0.045, 0.014, 4, 10, Math.PI)), INK, g, { outline: 0, gloss: 0 }); loop.position.set(0, H * 0.5, 0.06);
      break;
    }
    case "umbrella": {
      const canopyY = Math.max(hatTop, TOP) + 0.12;
      const len = canopyY - handWorld.y;
      const shaft = mesh(G(`shaft${len.toFixed(3)}`, () => new THREE.CylinderGeometry(0.014, 0.014, len + 0.05, 6, 1, true).translate(0, len / 2, 0)), INK, holder, { outline: 0, gloss: 0 });
      shaft.rotation.z = -0.12;
      const hook = mesh(G("hook", () => new THREE.TorusGeometry(0.045, 0.016, 4, 8, Math.PI)), INK, holder, { outline: 0, gloss: 0 }); hook.position.set(0.045, -0.02, 0); hook.rotation.z = Math.PI;
      const top = new THREE.Group(); top.position.set(-Math.sin(-0.12) * len, len * Math.cos(0.12), 0); top.rotation.z = -0.12; holder.add(top);
      const canopy = G("canopy", () => {
        const g = new THREE.SphereGeometry(1, 16, 5, 0, Math.PI * 2, 0, Math.PI * 0.42);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), lat = 1 - y; // 0 at top
          const m = 1 - 0.09 * lat * (1 - Math.abs(Math.cos(4 * a)));
          p.setXYZ(i, x * m, y + 0.12 * lat * (1 - Math.abs(Math.cos(4 * a))), z * m);
        }
        g.computeVertexNormals();
        return g.translate(0, -Math.cos(Math.PI * 0.42), 0);
      });
      const cm = mesh(canopy, pal.accent, top, { gloss: 0.45 }); cm.scale.set(0.44, 0.34, 0.44);
      const under = new THREE.Mesh(canopy, toon(mixHex(pal.accent, INK, 0.35), { side: THREE.BackSide, gloss: 0 })); cm.add(under);
      const tip = mesh(sphere(6, 4), pal.accent2, top, { outline: 0.6 }); tip.position.y = 0.34 * (1 - Math.cos(Math.PI * 0.42)) + 0.02; tip.scale.setScalar(0.03);
      break;
    }
    case "stick": {
      const len = 1.06, bottom = -handWorld.y + 0.02;
      const st = mesh(capsule(0.032, len, 2, 6), "#8a5a2b", holder, { gloss: 0.3 }); st.position.y = bottom + len / 2 + 0.03; st.rotation.z = -0.05;
      const twig = mesh(capsule(0.018, 0.12, 2, 5), "#8a5a2b", holder, { gloss: 0.3 }); twig.position.set(-0.05, bottom + len * 0.82, 0); twig.rotation.z = 0.9;
      const leaf = mesh(sphere(6, 4), "#5fa94a", holder, { outline: 0.6 }); leaf.position.set(-0.1, bottom + len * 0.86, 0); leaf.scale.set(0.035, 0.018, 0.022); leaf.rotation.z = 0.5;
      break;
    }
    case "book": {
      const bk = new THREE.Group(); bk.position.set(-0.02, 0.02, -0.06); bk.rotation.set(0.15, 0.7, 0.1); holder.add(bk);
      mesh(roundBox(0.06, 0.26, 0.2, 0.02, 1), pal.accent, bk);
      const pages = mesh(roundBox(0.045, 0.235, 0.19, 0.01, 1), "#fffdf2", bk, { outline: 0, gloss: 0 }); pages.position.set(0, 0, -0.02);
      break;
    }
    case "camera": {
      const cam = new THREE.Group(); mount(cam, 0.5, frontUS(0, 9).s, 0.0);
      mesh(roundBox(0.3, 0.2, 0.11, 0.04, 1), "#3a3f45", cam).position.z = 0.03;
      const lens = mesh(lathe("lens", [[0.072, 0], [0.072, 0.05], [0.06, 0.07], [0, 0.075]], 14), "#2b2f35", cam); lens.rotation.x = Math.PI / 2; lens.position.z = 0.07;
      const glass = mesh(dome(12, 3), "#9ad1ff", cam, { outline: 0, gloss: 1.2 }); glass.position.z = 0.145; glass.scale.set(0.05, 0.05, 0.022);
      const flash = mesh(roundBox(0.06, 0.035, 0.03, 0.01, 1), "#e9eef2", cam, { outline: 0.6 }); flash.position.set(0.09, 0.07, 0.085);
      break;
    }
    case "headphones": {
      const s = frontUS(0, eyeYS).s, hy = YC - BH * yyOfS(s), r = radAt(s) + 0.03;
      const top = Math.max(TOP + 0.05, hatTop + (t.hat === "wizard" ? -0.35 : 0.02));
      const pts = [];
      for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI; pts.push(new V3(Math.cos(a) * r, hy + Math.sin(a) * (top - hy), 0.02)); }
      mesh(G("hpband", () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.026, 4)), "#2f343b", body, { outline: 0.7, gloss: 0.4 });
      for (const d of [-1, 1]) {
        const cup = mesh(sphere(8, 5), pal.accent, body); cup.position.set(d * (r + 0.012), hy, 0.02); cup.scale.set(0.06, 0.105, 0.088);
      }
      break;
    }
  }

  // ---------- blob shadow ----------
  let shadow = null;
  if (opts.shadow !== false) {
    const sc = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(64, 64) : Object.assign(document.createElement("canvas"), { width: 64, height: 64 });
    const sx = sc.getContext("2d"), gr = sx.createRadialGradient(32, 32, 4, 32, 32, 31);
    gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(0.6, "rgba(0,0,0,0.3)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64);
    const st = new THREE.CanvasTexture(sc); texs.add(st);
    const sm = new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false }); mats.add(sm);
    shadow = new THREE.Mesh(G("shadow", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), sm);
    shadow.position.y = 0.004; shadow.scale.set(BW * 2.6, 1, BW * 2.3); shadow.renderOrder = -1;
    group.add(shadow);
  }

  wobblers.forEach((w) => { w.userData.rx0 = w.rotation.x; });

  // ---------- height (rest pose, before anything moves) ----------
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  mover.traverse((o) => { if (o.isMesh && o.material !== glowMat && !(o.material && o.material.side === THREE.BackSide && o.material.isMeshBasicMaterial)) box.expandByObject(o); });
  const height = box.max.y;

  // ---------- animation state ----------
  const ph = (t.seed % 1000) / 1000;
  const W = { phase: opts.phase ?? ph * Math.PI * 2, omega: (2 * Math.PI) / (1.5 + ph * 0.5) };
  let clock = 0, act = { name: "idle", t: 0 }, downed = false, fromDown = false;
  let cur = { ...NEUTRAL }, from = null, blend = 1, blendDur = 0.1;
  let nextBlink = 1.5 + rnd() * 3, blinkT = -1;
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();

  function evalPose() {
    const p = { ...NEUTRAL };
    const A = ACTIONS[act.name];
    if (A) {
      const q = clamp(act.t / A.dur, 0, 1);
      for (const ch in A.k) {
        if (ch === "top" && act.name === "revive" && !fromDown) continue;
        p[ch] += kf(q, A.k[ch]);
      }
    } else {
      const d = (LOOPS[act.name] || LOOPS.idle)(clock, W, act.t);
      for (const ch in d) p[ch] += d[ch];
    }
    return p;
  }
  function applyPose(p) {
    mover.position.set(p.px, p.py, p.pz);
    mover.rotation.set(p.rx, p.ry, 0);
    tp.rotation.z = -1.45 * p.top;
    const sq = Math.max(0.4, p.sq);
    squash.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    lean.rotation.z = baseTilt + p.sway;
    armL.rotation.set(p.aLx, 0, p.aLz);
    // the held item mostly stays upright (like holding an umbrella), following the arm swing only a little
    _q.setFromEuler(armL.rotation).invert();
    _e.set(clamp((p.aLx - NEUTRAL.aLx) * 0.15, -0.35, 0.35), 0, clamp((p.aLz - NEUTRAL.aLz) * 0.15, -0.3, 0.3));
    holder.quaternion.copy(_q).multiply(_q2.setFromEuler(_e));
    armR.rotation.set(p.aRx, 0, p.aRz);
    const g = clamp(p.glow, 0, 1);
    glowMat.opacity = 0.6 * g;
    for (const gl of glows) { gl.visible = g > 0.01; gl.scale.setScalar(0.001 + g * (0.09 + 0.015 * Math.sin(clock * 20))); }
    wu.uFlashAmt.value = clamp(p.flash, 0, 1);
    if (shadow) { const k = clamp(1 - p.py * 1.4, 0.4, 1) * (1 - 0.3 * p.top); shadow.material.opacity = k; shadow.scale.set(BW * 2.6 * (1 + 0.6 * p.top) * k, 1, BW * 2.3 * k); shadow.position.x = p.px + p.top * BW * 0.9; shadow.position.z = p.pz; }
  }

  function update(dt) {
    dt = clamp(Number(dt) || 0, 0, 0.1);
    clock += dt; act.t += dt;
    const A = ACTIONS[act.name];
    if (A && act.t >= A.dur && !A.hold) startAction("idle", 0.15);
    let p = evalPose();
    if (from && blend < 1) {
      blend = Math.min(1, blend + dt / blendDur);
      const k = EASE.s(blend);
      for (const ch of CH) p[ch] = from[ch] + (p[ch] - from[ch]) * k;
    }
    cur = p;
    applyPose(p);
    // secondary motion: blinks, tail wag, antennae bob
    if (eye3d) {
      if (blinkT < 0 && clock > nextBlink && !downed) { blinkT = 0; nextBlink = clock + 2.2 + rnd() * 3.5; }
      if (blinkT >= 0) { blinkT += dt; const b = Math.sin(clamp(blinkT / 0.14, 0, 1) * Math.PI); eyes.scale.y = 1 - 0.88 * b; if (blinkT > 0.14) { blinkT = -1; eyes.scale.y = 1; } }
      if (downed) eyes.scale.y = 0.15; else if (blinkT < 0) eyes.scale.y = 1;
    }
    const wag = act.name === "cheer" ? 9 : 3;
    tail.rotation.y = Math.sin(clock * wag + W.phase) * (t.feature === "fox" || t.feature === "cat" ? 0.22 : 0.08);
    wobblers.forEach((w, i) => { w.rotation.x = w.userData.rx0 + Math.sin(clock * 4.2 + i * 1.7 + W.phase) * 0.08; });
    group.getWorldScale(_a); wu.uOutScale.value = (_a.x + _a.y + _a.z) / 3;
  }
  function startAction(name, bd) {
    from = { ...cur }; blend = 0; blendDur = bd;
    act = { name, t: 0 };
    const A = ACTIONS[name];
    if (A && A.flash) wu.uFlash.value.set(A.flash);
    if (name === "cast") wu.uFlash.value.set(opts.castColor || "#5dff95");
  }
  function play(name) {
    if (!ACTIONS[name] && !LOOPS[name]) name = "idle";
    if (downed && !["revive", "down", "idle"].includes(name)) return;
    if (downed && name === "down") return;
    fromDown = downed && name === "revive";
    startAction(name, name === "idle" ? 0.15 : name === "revive" && fromDown ? 0.01 : 0.06);
    downed = name === "down";
  }
  function setTint(color) {
    if (color == null || color === false) { wu.uTintAmt.value = 0; return; }
    wu.uTint.value.set(color); wu.uTintAmt.value = 0.42;
  }
  function dispose() {
    if (group.parent) group.parent.remove(group);
    geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); texs.forEach((x) => x.dispose());
    geos.clear(); mats.clear(); texs.clear();
  }
  update(0);
  return {
    group, height, update, play, setTint, dispose,
    get action() { return act.name; },
    colors: { body: pal.body, belly: pal.belly, accent: pal.accent },
  };
}

// ---------- geometry helpers ----------
function arcTable(N, a0, a1, pt) { // angle samples + normalised cumulative arc length of a 2D curve
  const a = new Float64Array(N + 1), L = new Float64Array(N + 1);
  let prev = pt(a0), acc = 0;
  for (let i = 0; i <= N; i++) {
    const ang = a0 + ((a1 - a0) * i) / N, p = pt(ang);
    if (i) acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    a[i] = ang; L[i] = acc; prev = p;
  }
  for (let i = 0; i <= N; i++) L[i] /= acc;
  return { a, L };
}
function lookup(xs, ys, x) { // piecewise-linear y(x) for ascending xs
  let lo = 0, hi = xs.length - 1;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[hi]) return ys[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
  return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / (xs[hi] - xs[lo] || 1);
}
function roundedBox(THREE, w, h, d, r, s = 1) {
  const m = 2 * s + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, m, m, m);
  const p = g.attributes.position, nrm = g.attributes.normal;
  const half = [w / 2, h / 2, d / 2];
  const o = [0, 0, 0], inner = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    const c = [p.getX(i), p.getY(i), p.getZ(i)];
    for (let k = 0; k < 3; k++) {
      const gi = Math.round((c[k] + 0.5) * m), lim = half[k] - r;
      if (gi < s) { o[k] = -(1 - gi / s); inner[k] = -lim; }
      else if (gi > s + 1) { o[k] = (gi - s - 1) / s; inner[k] = lim; }
      else { o[k] = 0; inner[k] = -lim + (gi - s) * 2 * lim; }
    }
    const L = Math.hypot(o[0], o[1], o[2]) || 1;
    p.setXYZ(i, inner[0] + (o[0] / L) * r, inner[1] + (o[1] / L) * r, inner[2] + (o[2] / L) * r);
    nrm.setXYZ(i, o[0] / L, o[1] / L, o[2] / L);
  }
  return g;
}
// Bend a +y-up geometry sideways (x) and optionally back (z) more toward the tip.
function bend(g, bx, h, bz = 0) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = Math.max(0, p.getY(i) / h) ** 2;
    p.setX(i, p.getX(i) + bx * k); p.setZ(i, p.getZ(i) + bz * k);
  }
  g.computeVertexNormals();
  return g;
}
function mixHex(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (v, s) => (v >> s) & 255;
  return "#" + [16, 8, 0].map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * k).toString(16).padStart(2, "0")).join("");
}
function drawSigil(c, i, col) {
  const P2 = (d) => { c.fillStyle = col; c.fill(new Path2D(d)); };
  const dot = (x, y, r, f = col) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = f; c.fill(); };
  switch (i) {
    case 0: dot(0, 0, 4.5); break;
    case 1: P2("M0,-6 L1.8,-1.8 L6,-1.6 L2.6,1.4 L3.8,6 L0,3.3 L-3.8,6 L-2.6,1.4 L-6,-1.6 L-1.8,-1.8Z"); break;
    case 2: P2("M0,5 C-8,-1 -4,-7 0,-2.5 C4,-7 8,-1 0,5Z"); break;
    case 3: P2("M0,-5.5 L5.5,4.5 L-5.5,4.5Z"); break;
    case 4: P2("M0,-6 L5,0 L0,6 L-5,0Z"); break;
    case 5: P2("M2,-6 A6,6 0 1,0 2,6 A4.5,4.5 0 1,1 2,-6Z"); break;
    case 6: dot(0, 0, 3); c.strokeStyle = col; c.lineWidth = 1.8; c.lineCap = "round"; c.stroke(new Path2D("M0,-7 v2.5 M0,4.5 v2.5 M-7,0 h2.5 M4.5,0 h2.5")); break;
    case 7: P2("M-5,5 Q-5,-5 5,-5 Q5,5 -5,5Z"); break;
    case 8: P2("M0,-6 Q5,1 0,5 Q-5,1 0,-6Z"); break;
    case 9: c.fillStyle = col; c.beginPath(); c.roundRect(-4.5, -4.5, 9, 9, 1.5); c.fill(); break;
    case 10: P2("M1,-6 L-3.5,1 H0 L-1,6 L3.5,-1 H0Z"); break;
    case 11: for (let k = 0; k < 5; k++) { const a = (k * 72 * Math.PI) / 180; dot(3.4 * Math.cos(a), 3.4 * Math.sin(a), 2.6); } dot(0, 0, 1.8, "#fff"); break;
  }
}
