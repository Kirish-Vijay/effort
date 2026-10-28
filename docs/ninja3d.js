// ninja3d.js: the 3D toon ninja every player is (2D version: character.js).
// Same quiz answers → same ninja: suit colour, headband and sash, skin, eyes, headwear, hood ears, chest badge and
// what's on their back. Built from three.js primitives, cel-shaded (MeshToonMaterial + 3-step gradient) with an ink
// inverted-hull outline, on the same rig and keyframed actions the battles have always used.
// three.js is passed in, never imported, so this file works with whatever copy the page loaded.
//
//   const w = buildWalker(THREE, answers, opts);  scene.add(w.group);  ...  w.update(dt);  w.play("attack");
//   opts: { detail: 1 (0.5..2; 2 for close-up menus), outline: 0.024, shadow: true (soft blob shadow),
//           castShadow: false, castColor: "#5dff95", phase: number }

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
    sig, hue, num, time: a.time,
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

// ---------- the ninja ----------
// Suit from your colour + dessert, headband and sash from the accents, skin from your number, headwear from
// the hat answer, hood ears from the pet, eyes from your morning, and what's on your back from what you carry.
const SKIN = ["#f6d3b5", "#eab68f", "#cf9468", "#a56c47", "#f3c6a0", "#7c4f33"];
const SUIT = { dawn: [40, 44], noon: [48, 33], golden: [44, 35], night: [26, 20] };
export function ninjaPalette(t) {
  const [s, l] = SUIT[t.time] || SUIT.noon;
  return { suit: hsl(t.hue, s, l), dark: hsl(t.hue, s, Math.max(10, l - 12)), band: t.pal.accent, sash: t.pal.accent2,
    wrap: "#ece6d6", skin: SKIN[t.num % SKIN.length], metal: "#cfd8e0", straw: "#d9b46a", wood: "#3a2a22" };
}

/**
 * buildWalker(THREE, answers, opts) → { group, height, update(dt), play(action), setTint(color|null), dispose() }
 * group: feet at y=0, ~1.5 tall, facing -Z.  Actions: idle, attack, big, hurt, down, revive, cheer, block, cast.
 */
export function buildWalker(THREE, answers, opts = {}) {
  const t = traits(answers || {});
  const C = ninjaPalette(t);
  const detail = clamp(opts.detail || 1, 0.5, 2);
  const OUT = opts.outline ?? 0.024;

  // ---------- resources (per ninja, so dispose() never touches another one) ----------
  const geos = new Set(), mats = new Set(), texs = new Set();
  const gcache = new Map(), mcache = new Map();
  const G = (key, make) => { let g = gcache.get(key); if (!g) { g = make(); gcache.set(key, g); geos.add(g); } return g; };
  const wu = {
    uTint: { value: new THREE.Color(0, 0, 0) }, uTintAmt: { value: 0 },
    uFlash: { value: new THREE.Color(1, 0.2, 0.2) }, uFlashAmt: { value: 0 }, uOutScale: { value: 1 },
  };
  function toon(hex, o = {}) {
    const key = `t|${hex}|${o.gloss ?? 1}|${o.map ? o.map.uuid : ""}`;
    let m = mcache.get(key);
    if (!m) {
      m = new THREE.MeshToonMaterial({ color: o.map ? 0xffffff : hex, map: o.map || null, gradientMap: gradientMap(THREE) });
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
  // A mesh plus its ink hull, which shares the geometry and is pushed out along the normals.
  function part(geo, mat, parent, o = {}) {
    const m = new THREE.Mesh(geo, mat);
    if (opts.castShadow) m.castShadow = true;
    const w = o.outline ?? 1;
    if (w) m.add(new THREE.Mesh(geo, inkMat(+(OUT * w).toFixed(4))));
    if (parent) parent.add(m);
    return m;
  }
  const mesh = (geo, color, parent, o = {}) => part(geo, toon(color, { gloss: o.gloss ?? 0.5, map: o.map }), parent, o);
  const sphere = (w, h) => G(`s${w}|${h}`, () => new THREE.SphereGeometry(1, Math.round(w * detail), Math.round(h * detail)));
  const capsule = (r, len, cs, rs) => G(`c${r}|${len}|${cs}|${rs}`, () => new THREE.CapsuleGeometry(r, len, Math.max(2, Math.round(cs * detail)), Math.max(6, Math.round(rs * detail))));
  const cyl = (rt, rb, h, rs, open = false) => G(`y${rt}|${rb}|${h}|${rs}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, Math.round(rs * detail), 1, open));
  const box = (w, h, d) => G(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
  const canvas = (w, h) => (typeof OffscreenCanvas !== "undefined" && !opts.domCanvas ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h }));
  const texture = (cv) => { const x = new THREE.CanvasTexture(cv); x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 4; texs.add(x); return x; };

  // ---------- rig (same as the old walker, so the battle animations drive it unchanged) ----------
  const BW = 0.3 * t.scaleX;
  const Y0 = 0.18;
  const group = new THREE.Group(); group.name = "walker";
  const mover = new THREE.Group(); group.add(mover);
  const TPX = BW * 1.05;
  const tp = new THREE.Group(); tp.position.x = TPX; mover.add(tp);
  const tpc = new THREE.Group(); tpc.position.x = -TPX; tp.add(tpc);
  const squash = new THREE.Group(); squash.position.y = Y0; tpc.add(squash);
  const lean = new THREE.Group(); squash.add(lean);
  const body = new THREE.Group(); body.position.y = -Y0; lean.add(body);
  const baseTilt = (t.tilt * Math.PI) / 180 * 0.5;
  const wobblers = [];

  // ---------- legs + split-toe boots ----------
  for (const d of [-1, 1]) {
    const leg = mesh(capsule(0.075, 0.1, 2, 8), C.suit, tpc, { outline: 0.8 }); leg.position.set(d * 0.12, 0.2, 0);
    const wrapL = mesh(cyl(0.082, 0.082, 0.05, 12), C.wrap, tpc, { outline: 0.6 }); wrapL.position.set(d * 0.12, 0.14, 0);
    const boot = mesh(sphere(10, 7), C.dark, tpc); boot.position.set(d * 0.125, 0.06, -0.035); boot.scale.set(0.105, 0.07, 0.15);
    const toe = mesh(sphere(8, 6), C.dark, tpc, { outline: 0.6 }); toe.position.set(d * 0.15, 0.06, -0.15); toe.scale.set(0.04, 0.045, 0.05);
  }

  // ---------- torso: a short gi with a crossed collar, a sash with a knot, and a badge ----------
  const TY = 0.52;
  const torso = mesh(capsule(0.25, 0.14, 4, 14), C.suit, body); torso.position.y = TY; torso.scale.z = 0.86;
  for (const d of [-1, 1]) { // the gi's crossed collar
    const lap = mesh(box(0.035, 0.24, 0.02), C.dark, body, { outline: 0 });
    lap.position.set(d * 0.05, TY + 0.12, -0.212); lap.rotation.z = d * 0.55;
  }
  const sash = mesh(cyl(0.262, 0.262, 0.075, 22), C.sash, body, { outline: 0.7 }); sash.position.y = TY - 0.07; sash.scale.z = 0.87;
  const knot = mesh(sphere(8, 6), C.sash, body, { outline: 0.7 }); knot.position.set(-0.13, TY - 0.07, -0.2); knot.scale.setScalar(0.045);
  for (const k of [0, 1]) {
    const tail = mesh(box(0.035, 0.11, 0.015), C.sash, body, { outline: 0.6 });
    tail.position.set(-0.13 - k * 0.035, TY - 0.14, -0.205); tail.rotation.z = -0.25 + k * 0.5;
  }
  {
    const bc = canvas(128, 128), bx = bc.getContext("2d");
    bx.fillStyle = C.wrap; bx.beginPath(); bx.arc(64, 64, 60, 0, Math.PI * 2); bx.fill();
    bx.lineWidth = 6; bx.strokeStyle = INK; bx.stroke();
    bx.translate(64, 64); bx.scale(5.5, 5.5); drawSigil(bx, t.month % 12, C.band);
    const badge = mesh(cyl(0.055, 0.055, 0.012, 20), C.wrap, body, { outline: 0, map: texture(bc) });
    badge.position.set(0.1, TY + 0.1, -0.214); badge.rotation.x = -Math.PI / 2;
  }

  // ---------- what's on your back ----------
  {
    const back = new THREE.Group(); back.position.set(0.02, TY + 0.12, 0.24); body.add(back);
    if (t.carry === "stick") { // a bo staff
      back.rotation.z = 0.5;
      const staff = mesh(capsule(0.025, 0.95, 2, 8), "#8a5a2b", back); staff.position.y = 0.05;
      for (const y of [-0.3, 0.4]) { const w = mesh(cyl(0.03, 0.03, 0.05, 10), C.band, back, { outline: 0.5 }); w.position.y = y; }
    } else if (t.carry === "book") { // a scroll
      back.rotation.z = Math.PI / 2 - 0.25;
      const sc = mesh(cyl(0.06, 0.06, 0.42, 14), "#efe3c4", back); sc.position.y = 0;
      for (const y of [-0.23, 0.23]) { const end = mesh(cyl(0.07, 0.07, 0.04, 14), C.wood, back, { outline: 0.6 }); end.position.y = y; }
      const tie = mesh(cyl(0.064, 0.064, 0.03, 14), C.band, back, { outline: 0 }); tie.position.y = 0.02;
    } else { // a katana, its grip poking out past the head
      back.position.set(0, TY - 0.02, 0.25); back.rotation.z = -0.84;
      const sheath = mesh(capsule(0.032, 0.56, 2, 8), C.wood, back); sheath.position.y = 0;
      const guard = mesh(cyl(0.07, 0.07, 0.022, 14), "#c9a227", back, { outline: 0.6 }); guard.position.y = 0.32;
      const grip = mesh(capsule(0.03, 0.17, 2, 8), C.band, back); grip.position.y = 0.45;
      for (const y of [0.4, 0.45, 0.5]) { const w = mesh(box(0.064, 0.012, 0.064), C.dark, back, { outline: 0 }); w.position.y = y; w.rotation.y = 0.78; }
    }
    if (t.carry === "backpack" || t.carry === "camera") { // a pouch on the sash
      const pouch = mesh(G("pouch", () => roundedBox(THREE, 0.12, 0.1, 0.07, 0.025)), C.dark, body); pouch.position.set(0.2, TY - 0.1, -0.12); pouch.rotation.y = 0.6;
    }
  }

  // ---------- head: a hood with an eye slit, painted on (so it stays crisp from any angle) ----------
  const HR = 0.4 * (0.96 + (t.scaleY - 0.92) * 0.35), HY = 1.0, HSY = 0.94;
  const head = new THREE.Group(); head.position.y = HY; body.add(head);
  const EYE_U = 0.75, EYE_V = 0.53, GAP = 0.05 + (t.eyeGap - 15) * 0.0025;
  function faceTex(ko) {
    const W = 1024, H = 512, c = canvas(W, H), x = c.getContext("2d");
    x.fillStyle = C.suit; x.fillRect(0, 0, W, H);
    // hood seam down the back and a soft darker crown
    x.fillStyle = C.dark; x.globalAlpha = 0.35; x.fillRect(0, 0, W, H * 0.12); x.globalAlpha = 1;
    x.strokeStyle = C.dark; x.lineWidth = 6; x.beginPath(); x.moveTo(W * 0.25, 0); x.lineTo(W * 0.25, H * 0.9); x.stroke();
    // the eye slit
    const sx = W * 0.6, sw = W * 0.3, sy = H * 0.43, sh = H * 0.19;
    x.fillStyle = C.skin; x.beginPath(); x.roundRect(sx, sy, sw, sh, 26); x.fill();
    x.lineWidth = 7; x.strokeStyle = INK; x.stroke();
    const ex = (k) => W * (EYE_U + k * GAP), ey = H * EYE_V, R = H * 0.05;
    x.lineCap = "round"; x.lineJoin = "round";
    const line = (pts, w = 9) => { x.lineWidth = w; x.strokeStyle = INK; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); };
    for (const k of [-1, 1]) {
      const X = ex(k);
      if (ko) { line([[X - R, ey - R], [X + R, ey + R]]); line([[X + R, ey - R], [X - R, ey + R]]); continue; }
      switch (t.eyes) {
        case "snooze": line([[X - R * 1.1, ey], [X + R * 1.1, ey]], 10); line([[X - R, ey + R * 0.5], [X + R, ey + R * 0.5]], 5); break;
        case "music": x.lineWidth = 9; x.strokeStyle = INK; x.beginPath(); x.arc(X, ey + R * 0.5, R, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); break;
        case "scroll": x.lineWidth = 5; x.strokeStyle = INK; x.beginPath(); for (let a = 0; a < 12; a += 0.2) { const r = (a / 12) * R * 1.1; x.lineTo(X + Math.cos(a) * r, ey + Math.sin(a) * r); } x.stroke(); break;
        default: {
          const big = t.eyes === "stretch" ? 1.15 : 1;
          x.fillStyle = "#fff"; x.beginPath(); x.ellipse(X, ey, R * 1.05 * big, R * 0.95 * big, 0, 0, Math.PI * 2); x.fill(); x.lineWidth = 5; x.strokeStyle = INK; x.stroke();
          x.fillStyle = INK; x.beginPath(); x.ellipse(X + k * -R * 0.12, ey + R * 0.1, R * 0.55 * big, R * 0.62 * big, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = "#fff"; x.beginPath(); x.arc(X + R * 0.2, ey - R * 0.22, R * 0.2, 0, Math.PI * 2); x.fill();
        }
      }
      // determined brows on the slit's top edge (not for sleepy or happy eyes)
      if (!["snooze", "music"].includes(t.eyes)) line([[X + k * R * 1.4, sy + sh * 0.12], [X - k * R * 0.6, sy + sh * 0.3]], 8);
    }
    if (t.cheeks && !ko) { x.fillStyle = "#ff8a8a"; x.globalAlpha = 0.5; for (const k of [-1, 1]) { x.beginPath(); x.ellipse(ex(k) + k * R * 1.8, ey + R * 1.1, R * 0.7, R * 0.35, 0, 0, Math.PI * 2); x.fill(); } x.globalAlpha = 1; }
    return texture(c);
  }
  const headGeo = sphere(32, 24);
  const faceMat = toon("#ffffff", { gloss: 0.15, map: faceTex(false) }), koMat = toon("#ffffff", { gloss: 0.15, map: faceTex(true) });
  const skull = part(headGeo, faceMat, head); skull.scale.set(HR, HR * HSY, HR);
  // hood ears from your pet
  if (["fox", "cat"].includes(t.feature)) for (const d of [-1, 1]) {
    const ear = mesh(G("ear", () => new THREE.ConeGeometry(0.09, 0.2, Math.round(10 * detail))), C.suit, head); ear.position.set(d * HR * 0.55, HR * 0.78, 0.02); ear.rotation.z = -d * 0.35;
  } else if (t.feature === "bear") for (const d of [-1, 1]) {
    const ear = mesh(sphere(10, 8), C.suit, head); ear.position.set(d * HR * 0.62, HR * 0.72, 0.04); ear.scale.set(0.085, 0.085, 0.05);
  }

  // ---------- headwear ----------
  const radAtY = (y) => HR * Math.sqrt(Math.max(0, 1 - (y / (HR * HSY)) ** 2));
  if (t.hat === "wizard" || t.hat === "bucket") { // a straw kasa
    const tall = t.hat === "wizard";
    const kasa = mesh(G(`kasa${tall}`, () => new THREE.ConeGeometry(HR * 1.55, tall ? 0.42 : 0.26, Math.round(28 * detail))), C.straw, head);
    kasa.position.y = HR * 0.78 + (tall ? 0.16 : 0.08);
    const rim = mesh(cyl(HR * 0.86, HR * 0.86, 0.05, 22), C.band, head, { outline: 0.6 }); rim.position.y = HR * 0.6;
  } else { // the headband, tied at the back
    const y0 = HR * 0.36, y1 = HR * 0.6;
    const band = mesh(cyl(radAtY(y1) + 0.014, radAtY(y0) + 0.014, y1 - y0, 28, true), C.band, head, { outline: 0.7, gloss: 0.15 });
    band.position.y = (y0 + y1) / 2;
    const yk = (y0 + y1) / 2, rk = radAtY(yk) + 0.02;
    const knotB = mesh(sphere(8, 6), C.band, head, { outline: 0.7 }); knotB.position.set(0, yk, rk); knotB.scale.setScalar(0.045);
    const long = t.hat === "band" ? 1.6 : 1;
    for (const [k, rz] of [[0, 0.35], [1, -0.25]]) {
      const pivot = new THREE.Group(); pivot.position.set(k ? -0.02 : 0.02, yk, rk + 0.01); head.add(pivot);
      const tail = mesh(box(0.06, 0.24 * long, 0.014), C.band, pivot, { outline: 0.6 }); tail.position.y = -0.12 * long;
      pivot.rotation.set(0.75, 0, rz); wobblers.push(pivot);
    }
    if (t.hat === "cap") { // a metal forehead plate
      const plate = mesh(G("plate", () => roundedBox(THREE, 0.2, 0.09, 0.02, 0.012)), C.metal, head, { outline: 0.6, gloss: 1 });
      plate.position.set(0, yk, -(radAtY(yk) + 0.022)); plate.rotation.x = -0.25;
    } else if (t.hat === "flowers") {
      const fl = new THREE.Group(); fl.position.set(-radAtY(yk) * 0.62, yk + 0.02, -radAtY(yk) * 0.78); fl.rotation.y = 0.7; head.add(fl);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, p = mesh(sphere(8, 6), "#ff9ec7", fl, { outline: 0.5 }); p.position.set(Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0); p.scale.setScalar(0.028); }
      const mid = mesh(sphere(8, 6), "#ffd34d", fl, { outline: 0.5 }); mid.scale.setScalar(0.022); mid.position.z = -0.01;
    } else if (t.hat === "beanie") { // a topknot
      const bun = mesh(sphere(12, 10), C.dark, head); bun.position.set(0, HR * HSY + 0.05, 0.04); bun.scale.setScalar(0.09);
      const tie = mesh(cyl(0.05, 0.06, 0.04, 12), C.band, head, { outline: 0.6 }); tie.position.set(0, HR * HSY - 0.0, 0.04);
    }
  }

  // ---------- arms (L = the ninja's left = -X = viewer-right in front view) ----------
  const NEUTRAL = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, sway: 0, top: 0, sq: 1, aLx: 0, aLz: -0.42, aRx: 0, aRz: 0.42, glow: 0, flash: 0 };
  const shY = TY + 0.17, ARM = 0.25;
  const glowMat = new THREE.MeshBasicMaterial({ color: opts.castColor || "#5dff95", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  mats.add(glowMat);
  const glows = [];
  function makeArm(d) {
    const pivot = new THREE.Group(); pivot.position.set(-d * 0.25, shY, 0); body.add(pivot);
    const a = mesh(capsule(0.068, 0.12, 2, 8), C.suit, pivot); a.position.y = -0.09;
    const w = mesh(cyl(0.074, 0.074, 0.05, 12), C.wrap, pivot, { outline: 0.6 }); w.position.y = -0.17;
    const fist = mesh(sphere(10, 8), C.dark, pivot); fist.position.y = -0.23; fist.scale.setScalar(0.072);
    const gl = new THREE.Mesh(sphere(8, 6), glowMat); gl.position.y = -ARM; gl.scale.setScalar(0.001); pivot.add(gl); glows.push(gl);
    return pivot;
  }
  const armL = makeArm(1), armR = makeArm(-1);
  armL.rotation.set(NEUTRAL.aLx, 0, NEUTRAL.aLz); armR.rotation.set(NEUTRAL.aRx, 0, NEUTRAL.aRz);

  // ---------- blob shadow ----------
  let shadow = null;
  if (opts.shadow !== false) {
    const sc = canvas(64, 64), sx = sc.getContext("2d"), gr = sx.createRadialGradient(32, 32, 4, 32, 32, 31);
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
  const bbox = new THREE.Box3();
  mover.traverse((o) => { if (o.isMesh && o.material !== glowMat && !(o.material && o.material.side === THREE.BackSide && o.material.isMeshBasicMaterial)) bbox.expandByObject(o); });
  const height = bbox.max.y;

  // ---------- animation ----------
  const ph = (t.seed % 1000) / 1000;
  const W = { phase: opts.phase ?? ph * Math.PI * 2, omega: (2 * Math.PI) / (1.5 + ph * 0.5) };
  let clock = 0, act = { name: "idle", t: 0 }, downed = false, fromDown = false;
  let cur = { ...NEUTRAL }, from = null, blend = 1, blendDur = 0.1;
  const _a = new THREE.Vector3();

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
    skull.material = downed ? koMat : faceMat;
    // headband tails flutter, harder when cheering or attacking
    const flap = act.name === "cheer" || act.name === "attack" || act.name === "big" ? 0.3 : 0.12;
    wobblers.forEach((w, i) => { w.rotation.x = w.userData.rx0 + Math.sin(clock * 5.5 + i * 1.3 + W.phase) * flap - (p.pz < 0 ? p.pz * 0.8 : 0); });
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
    colors: { body: C.suit, belly: C.wrap, accent: C.band },
  };
}

// ---------- geometry helpers ----------
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
