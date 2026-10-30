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
    sig, hue, num, time: a.time, wear: { suit: a._suit || null, band: a._band || null },
    // Equipped gear (_weapon, _armour, _trinket) resolved to looks by character.js, which every page loads first.
    gear: typeof globalThis.Walker?.gear === "function" ? globalThis.Walker.gear(a) : null,
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
// wg: how far the held weapon turns in the fist, on top of its resting grip (so a swing raises it behind you,
// brings it over the top and down in front, instead of just poking forward with the punch).
const CH = ["px", "py", "pz", "rx", "ry", "sway", "top", "sq", "aLx", "aLz", "aRx", "aRz", "glow", "flash", "wg"];
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
    wg: [[0, 0], [0.22, 2.2], [0.5, -3.1, "o"], [0.75, -2.7], [1, 0]],
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
    wg: [[0, 0], [0.4, -1.9], [0.52, -1.9], [0.64, -2.7, "o"], [0.82, -2.5], [1, 0]],
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
    wg: [[0, 0], [0.35, -2.0], [1, 0]],
  } },
  // The Taxman's down: hop and bring everything down on him.
  stomp: { dur: 0.34, k: {
    py: [[0, 0], [0.35, 0.3, "o"], [0.58, -0.03, "i"], [1, 0]],
    rx: [[0, 0], [0.35, 0.1], [0.58, -0.38, "o"], [0.8, -0.2], [1, 0]],
    sq: [[0, 0], [0.35, 0.16], [0.58, -0.26], [0.78, 0.06], [1, 0]],
    aRx: [[0, 0], [0.35, 2.6], [0.58, 0.9, "o"], [1, 0]], aLx: [[0, 0], [0.35, 2.4], [0.58, 0.8, "o"], [1, 0]],
    wg: [[0, 0], [0.35, -1.9], [0.58, -3.0, "o"], [1, 0]],
  } },
  cast: { dur: 0.5, k: {
    aRx: [[0, 0], [0.3, 1.45, "o"], [0.8, 1.45], [1, 0]], aLx: [[0, 0], [0.3, 1.4, "o"], [0.8, 1.4], [1, 0]],
    wg: [[0, 0], [0.3, -1.55, "o"], [0.8, -1.55], [1, 0]],
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
      aRz: 0.3 * Math.sin(2 * Math.PI * p), aLz: -0.3 * Math.sin(2 * Math.PI * p), ry: 0.15 * Math.sin(2 * Math.PI * p), wg: -2.05 };
  },
  // Crouched over the Taxman, digging through his pockets.
  rummage: (time, w, t) => {
    const p = t * 7;
    return { sq: -0.2, rx: -0.42, py: -0.04, aRx: 1.0 + 0.7 * Math.sin(p), aLx: 1.0 + 0.7 * Math.sin(p + Math.PI), aRz: -0.2, aLz: 0.2, wg: -0.9, ry: 0.08 * Math.sin(p * 0.5) };
  },
  block: (time, w, t) => ({ sq: -0.1, rx: -0.12, pz: 0.02, px: 0.006 * Math.sin(t * 50), aRx: 1.9, aRz: -0.75, aLx: 1.9, aLz: 0.75, wg: -1.26 }),
};

// Gear geometry is shared by every ninja on the page (it never changes shape), so it lives here and is never disposed.
const gearGeos = new WeakMap();
function sharedGeo(THREE, key, make) {
  let m = gearGeos.get(THREE);
  if (!m) gearGeos.set(THREE, (m = new Map()));
  let g = m.get(key);
  if (!g) { g = make(); g.userData.keep = true; m.set(key, g); }
  return g;
}
// How brightly legendary-and-up gear glows, by rank (kept low: the arena's bloom picks up anything much over 1.2).
const GEAR_GLOW = [0, 0, 0, 0.45, 0.6, 0.75, 0.9, 1.0, 1.1];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sp = (v, e) => Math.sign(v) * Math.abs(v) ** e;

// ---------- the ninja ----------
// Suit from your colour + dessert, headband and sash from the accents, skin from your number, headwear from
// the hat answer, hood ears from the pet, eyes from your morning, and what's on your back from what you carry.
const SKIN = ["#f6d3b5", "#eab68f", "#cf9468", "#a56c47", "#f3c6a0", "#7c4f33"];
const SUIT = { dawn: [40, 44], noon: [48, 33], golden: [44, 35], night: [26, 20] };
// A hex colour a bit darker (for the shaded side of a wardrobe suit).
const darker = (hex, k = 0.72) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("");
export function ninjaPalette(t) {
  const [s, l] = SUIT[t.time] || SUIT.noon, W = t.wear || {};
  return { suit: W.suit || hsl(t.hue, s, l), dark: W.suit ? darker(W.suit) : hsl(t.hue, s, Math.max(10, l - 12)), band: W.band || t.pal.accent, sash: t.pal.accent2,
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
  const glowMats = []; // emissive gear materials (legendary+), pulsed gently from relic up
  function toon(hex, o = {}) {
    const key = `t|${hex}|${o.gloss ?? 1}|${o.map ? o.map.uuid : ""}|${o.ei || 0}`;
    let m = mcache.get(key);
    if (!m) {
      m = new THREE.MeshToonMaterial({ color: o.map ? 0xffffff : hex, map: o.map || null, gradientMap: gradientMap(THREE) });
      if (o.ei) { m.emissive.set(o.emissive || hex); m.emissiveIntensity = o.ei; glowMats.push(m); }
      m.userData = { wu, gloss: { value: o.gloss ?? 1 }, rim: { value: o.rim ?? 0.32 }, ei: o.ei || 0 };
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
  const NEUTRAL = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, sway: 0, top: 0, sq: 1, aLx: 0, aLz: -0.42, aRx: 0, aRz: 0.42, glow: 0, flash: 0, wg: 0 };
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

  // ---------- gear: weapon in the right fist, armour over the gi, a trinket (after the height, so a raised
  // weapon or a feather doesn't make you "taller" for name tags) ----------
  const gearTicks = []; // (clock, flap) => void, for the bits that bob and sway
  let hold = null, holdRest = 0, holdK = 1;
  const GR = t.gear || {};
  if (GR.weapon || GR.armour || GR.trinket) {
    const SG = (key, make) => sharedGeo(THREE, `${key}|${detail}`, make);
    const seg = (n) => Math.max(3, Math.round(n * detail));
    const gp = (geo, color, parent, o = {}) => part(geo, toon(color, { gloss: o.gloss ?? 0.6, ei: o.ei || 0 }), parent, { outline: o.outline ?? 0.6 });
    const trimOf = (g) => (g.rank >= 1 ? g.color : darker(g.base, 0.7));
    const glowOf = (g) => GEAR_GLOW[Math.min(8, g.rank)] || 0;
    const sph = () => SG("sph", () => new THREE.SphereGeometry(1, seg(12), seg(9)));
    const gcyl = (rt, rb, h, rs = 12) => SG(`cyl${rt}|${rb}|${h}|${rs}`, () => new THREE.CylinderGeometry(rt, rb, h, seg(rs)));
    const gcap = (r, len) => SG(`cap${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, Math.max(2, seg(2)), Math.max(6, seg(8))));
    const gbox = (w, h, d, r) => SG(`box${w}|${h}|${d}|${r || 0}`, () => (r ? roundedBox(THREE, w, h, d, r) : new THREE.BoxGeometry(w, h, d)));
    const gtorus = (R, r, arc = Math.PI * 2) => SG(`tor${R}|${r}|${arc}`, () => new THREE.TorusGeometry(R, r, seg(6), seg(16), arc));
    const goct = () => SG("oct", () => new THREE.OctahedronGeometry(1, 0));
    // A lathe (shell of revolution) round the body's axis; gap leaves the front (-Z) open.
    const glathe = (name, pts, gap = 0) => SG(`lathe${name}|${gap}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg(22), Math.PI + gap / 2, Math.PI * 2 - gap));
    const _p = new THREE.Vector3(), _q = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const cord = (a, b, r, color, parent) => { // a thin rod between two points
      const m = gp(gcyl(r, r, 1, 5), color, parent, { outline: 0 });
      _p.set(...a); _q.set(...b); m.position.copy(_p).add(_q).multiplyScalar(0.5);
      _q.sub(_p); m.scale.y = _q.length(); m.quaternion.setFromUnitVectors(UP, _q.normalize());
      return m;
    };
    const at = (m, x, y, z, s) => { m.position.set(x, y, z); if (s != null) (Array.isArray(s) ? m.scale.set(...s) : m.scale.setScalar(s)); return m; };
    const SZ = 0.88; // torso depth squash, so shells hug the body
    const gearPh = ((t.seed % 1000) / 1000) * Math.PI * 2;

    // ----- weapon: modelled with its grip at the origin and pointing up +Y, in a group that turns in the fist -----
    if (GR.weapon) {
      const g = GR.weapon, b = g.base, tc = g.color, tr = trimOf(g), ei = glowOf(g), r = g.rank, look = g.look;
      hold = new THREE.Group(); hold.position.y = -0.23; armR.add(hold);
      const W = new THREE.Group(); hold.add(W);
      W.rotation.z = look === "bag" ? -0.42 : -0.62; // lean out from the body (bags just hang)
      W.scale.setScalar(look === "staff" ? 1.12 : look === "bag" || look === "fan" ? 1.2 : 1.32); // chunky enough to read on a phone
      holdRest = look === "bag" ? 0 : look === "staff" ? -0.4 : -0.64; holdK = look === "bag" ? 0.25 : look === "staff" ? 0.85 : 1;
      const WOOD = "#3a2a22";
      switch (look) {
        case "sword": {
          gp(gcap(0.024, 0.13), WOOD, W);
          if (r >= 1) at(gp(gcyl(0.03, 0.03, 0.05), tc, W, { outline: 0 }), 0, -0.02, 0);
          at(gp(sph(), tr, W, { ei, outline: 0 }), 0, -0.1, 0, 0.036);
          at(gp(gbox(0.2, 0.036, 0.06, 0.014), tr, W, { ei: r >= 3 ? ei * 0.6 : 0 }), 0, 0.09, 0);
          at(gp(gbox(0.078, 0.44, 0.024, 0.01), b, W, { gloss: 1 }), 0, 0.32, 0);
          const tip = SG("swordtip", () => new THREE.ConeGeometry(0.0545, 0.12, 4).rotateY(Math.PI / 4).scale(1, 1, 0.3));
          at(gp(tip, b, W, { gloss: 1 }), 0, 0.6, 0);
          if (r >= 1) at(gp(gbox(0.02, 0.36, 0.028), tc, W, { outline: 0, ei }), 0, 0.31, 0);
          break;
        }
        case "staff": {
          at(gp(gcap(0.026, 1.0), b, W), 0, 0.12, 0);
          at(gp(gcyl(0.031, 0.031, 0.13), r >= 1 ? tc : "#e9e2cf", W, { outline: 0.4 }), 0, 0, 0);
          for (const y of [0.6, -0.37]) at(gp(gcyl(0.035, 0.035, 0.06), tr, W, { outline: 0 }), 0, y, 0);
          if (r >= 2) { const gem = at(gp(goct(), tc, W, { ei, gloss: 1 }), 0, 0.71, 0, [0.06, 0.085, 0.06]); gem.rotation.y = 0.4; }
          break;
        }
        case "wand": {
          at(gp(gcyl(0.014, 0.022, 0.36, 8), b, W), 0, 0.13, 0);
          if (r >= 1) at(gp(gcyl(0.02, 0.02, 0.03, 8), tc, W, { outline: 0 }), 0, 0.27, 0);
          const star = at(gp(goct(), r >= 1 ? tc : "#fff3b0", W, { ei: Math.max(ei, 0.25), gloss: 1 }), 0, 0.35, 0, [0.045, 0.06, 0.045]);
          star.rotation.y = Math.PI / 4;
          break;
        }
        case "umbrella": {
          at(gp(gcyl(0.012, 0.012, 0.66, 6), "#c9cfd6", W, { outline: 0.4 }), 0, 0.25, 0);
          const hook = at(gp(gtorus(0.045, 0.014, Math.PI), WOOD, W, { outline: 0.5 }), 0.045, -0.08, 0); hook.rotation.z = Math.PI;
          const canopy = SG("umbrella", () => new THREE.LatheGeometry([[0.008, 0.12], [0.06, 0.18], [0.082, 0.24], [0.072, 0.34], [0.04, 0.48], [0.008, 0.6]].map(([x, y]) => new THREE.Vector2(x, y)), seg(10)));
          gp(canopy, r >= 1 ? tc : b, W, { outline: 0.7 });
          at(gp(gcyl(0.072, 0.074, 0.03), r >= 1 ? darker(tc, 0.7) : "#c9a227", W, { outline: 0.4, ei: r >= 3 ? ei : 0 }), 0, 0.3, 0);
          at(gp(sph(), "#c9cfd6", W, { outline: 0 }), 0, 0.61, 0, 0.016);
          break;
        }
        case "bat": {
          at(gp(gcyl(0.022, 0.024, 0.2, 8), r >= 1 ? tc : "#2b2b2b", W, { outline: 0.5 }), 0, 0.02, 0);
          at(gp(gbox(0.11, 0.42, 0.046, 0.018), b, W), 0, 0.33, 0);
          if (r >= 1) for (const y of [0.42, 0.47]) at(gp(gbox(0.113, 0.026, 0.049), tc, W, { outline: 0, ei }), 0, y, 0);
          break;
        }
        case "book": {
          at(gp(gbox(0.2, 0.26, 0.075, 0.012), b, W), 0, 0.16, 0);
          at(gp(gbox(0.19, 0.24, 0.062), "#f4ecd8", W, { outline: 0 }), 0.012, 0.16, 0);
          at(gp(gbox(0.03, 0.27, 0.082, 0.01), tr, W, { outline: 0.5 }), -0.09, 0.16, 0);
          if (r >= 2) for (const z of [-1, 1]) { const e = at(gp(gcyl(0.036, 0.036, 0.012, 14), tc, W, { outline: 0.4, ei }), 0.01, 0.18, z * 0.04); e.rotation.x = Math.PI / 2; }
          break;
        }
        case "spoon": {
          at(gp(gbox(0.032, 0.3, 0.016, 0.007), r >= 1 ? tc : b, W, { outline: 0.5 }), 0, 0.12, 0);
          at(gp(sph(), r >= 3 ? tc : b, W, { gloss: 1, ei }), 0, 0.36, 0, [0.072, 0.095, 0.03]);
          if (/spork|fork/i.test(g.name)) for (const x of [-0.03, 0, 0.03]) at(gp(gbox(0.014, 0.06, 0.014), r >= 3 ? tc : b, W, { outline: 0.4 }), x, 0.465, 0);
          break;
        }
        case "bag": { // hangs from the fist
          at(gp(gtorus(0.055, 0.012), tr, W, { outline: 0.4 }), 0, -0.03, 0);
          at(gp(gbox(0.2, 0.22, 0.1, 0.03), b, W), 0, -0.19, 0);
          if (r >= 1) at(gp(gbox(0.09, 0.075, 0.106, 0.012), tc, W, { outline: 0, ei }), 0, -0.19, 0);
          break;
        }
        case "hammer": {
          at(gp(gcap(0.024, 0.4), "#8a5a2b", W), 0, 0.17, 0);
          const head = new THREE.Group(); head.position.y = 0.45; head.rotation.x = Math.PI / 2; W.add(head);
          gp(gcyl(0.078, 0.078, 0.26, 14), b, head, { gloss: 1 });
          if (r >= 1) for (const y of [-0.11, 0.11]) at(gp(gcyl(0.083, 0.083, 0.035, 14), tc, head, { outline: 0.5, ei }), 0, y, 0);
          break;
        }
        case "fan": {
          const fc = canvas(128, 128), fx = fc.getContext("2d");
          fx.fillStyle = b; fx.fillRect(0, 0, 128, 128);
          fx.strokeStyle = "rgba(31,42,36,.55)"; fx.lineWidth = 2;
          for (let a = 0; a < 360; a += 14) { fx.beginPath(); fx.moveTo(64, 64); fx.lineTo(64 + Math.cos((a * Math.PI) / 180) * 64, 64 + Math.sin((a * Math.PI) / 180) * 64); fx.stroke(); }
          fx.strokeStyle = r >= 1 ? tc : darker(b, 0.75); fx.lineWidth = 12; fx.beginPath(); fx.arc(64, 64, 54, 0, Math.PI * 2); fx.stroke();
          const face = SG("fan", () => new THREE.CylinderGeometry(0.27, 0.27, 0.016, seg(14), 1, false, Math.PI - 1.15, 2.3).rotateX(Math.PI / 2));
          part(face, toon("#ffffff", { gloss: 0.3, map: texture(fc) }), W, { outline: 0.6 });
          at(gp(gbox(0.03, 0.13, 0.022, 0.008), WOOD, W, { outline: 0.5 }), 0, 0.03, 0);
          at(gp(sph(), tr, W, { outline: 0, ei }), 0, 0, 0, 0.022);
          break;
        }
        case "whip": {
          gp(gcap(0.024, 0.13), WOOD, W);
          at(gp(sph(), tr, W, { outline: 0 }), 0, -0.09, 0, 0.032);
          const pts = [[0, 0.08, 0], [0.02, 0.25, -0.02], [0.12, 0.36, -0.05], [0.24, 0.3, -0.05], [0.29, 0.14, -0.02], [0.27, -0.02, 0.02], [0.31, -0.14, 0.04]];
          const lash = SG("lash", () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg(24), 0.013, Math.max(4, seg(5))));
          gp(lash, b, W, { outline: 0.5 });
          if (r >= 1) at(gp(sph(), tc, W, { outline: 0.4, ei }), 0.31, -0.14, 0.04, 0.026);
          break;
        }
        default: { // club
          gp(gcap(0.026, 0.12), WOOD, W);
          at(gp(gcyl(0.078, 0.042, 0.36, 12), b, W), 0, 0.25, 0);
          at(gp(sph(), b, W, { outline: 0 }), 0, 0.43, 0, [0.078, 0.04, 0.078]);
          if (r >= 1) at(gp(gcyl(0.077, 0.075, 0.04, 12), tc, W, { outline: 0.5, ei }), 0, 0.36, 0);
          if (r >= 2) for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2 + 0.4, stud = gp(SG("stud", () => new THREE.ConeGeometry(0.022, 0.05, 6)), tr, W, { outline: 0 });
            stud.position.set(Math.cos(a) * 0.068, 0.27, Math.sin(a) * 0.068); stud.quaternion.setFromUnitVectors(UP, _p.set(Math.cos(a), 0.25, Math.sin(a)).normalize());
          }
        }
      }
    }

    // ----- armour: a shell over the torso (lathed round the body), shoulder trims, sleeves for the soft ones -----
    if (GR.armour) {
      const g = GR.armour, b = g.base, tc = g.color, tr = trimOf(g), ei = glowOf(g), r = g.rank, look = g.look;
      const shell = (name, pts, gap, color, o = {}) => { const m = gp(glathe(name, pts, gap), color, body, { outline: o.outline ?? 0.8, gloss: o.gloss, ei: o.ei }); m.scale.z = SZ; return m; };
      const band = (name, r0, y0, y1, gap, color, o = {}) => shell(name, [[r0, y0], [r0 + 0.002, y1]], gap, color, { outline: 0.5, ...o });
      // Thin strips that follow the shell: a narrow lathe slice offset just outside it, at angle phi (π = front).
      const strip = (name, pts, phi, w, color, o = {}) => {
        const geo = SG(`strip${name}|${w}`, () => new THREE.LatheGeometry(pts.map(([rr, y]) => new THREE.Vector2(rr + 0.008, y)), Math.max(2, seg(2)), -w / 2, w));
        const sq = new THREE.Group(); sq.scale.z = SZ; body.add(sq);
        const m = gp(geo, color, sq, { outline: 0, ei: o.ei }); m.rotation.y = phi; return m;
      };
      const sleeves = () => { for (const pv of [armL, armR]) { at(gp(gcap(0.079, 0.1), b, pv, { outline: 0.8 }), 0, -0.085, 0); if (r >= 1) at(gp(gcyl(0.084, 0.084, 0.03), tr, pv, { outline: 0.4, ei }), 0, -0.15, 0); } };
      const epaulettes = () => { if (r >= 1) for (const d of [-1, 1]) { const ep = at(gp(sph(), tr, body, { outline: 0.5, ei }), d * 0.25, shY + 0.035, 0, [0.095, 0.035, 0.09]); ep.rotation.z = -d * 0.35; } };
      const SASH_Y = TY - 0.07;
      switch (look) {
        case "plate": {
          shell("plate", [[0.27, 0.47], [0.293, 0.52], [0.29, 0.6], [0.262, 0.66], [0.21, 0.71]], 0, b, { gloss: 1 });
          band("platerim", 0.297, 0.465, 0.505, 0, tr, { ei });
          at(gp(gbox(0.022, 0.15, 0.02), darker(b, 0.7), body, { outline: 0 }), 0, 0.585, -0.258);
          if (r >= 2) for (const z of [-1, 1]) { const e = at(gp(gcyl(0.045, 0.045, 0.014, 14), tc, body, { outline: 0.4, ei }), 0, 0.6, z * 0.262); e.rotation.x = Math.PI / 2; }
          const dome = SG("dome", () => new THREE.SphereGeometry(1, seg(14), seg(6), 0, Math.PI * 2, 0, Math.PI / 2));
          for (const d of [-1, 1]) {
            const pd = new THREE.Group(); pd.position.set(d * 0.27, shY - 0.01, 0); pd.rotation.z = -d * 0.45; body.add(pd);
            at(gp(dome, b, pd, { gloss: 1, outline: 0.7 }), 0, 0, 0, [0.12, 0.085, 0.115]);
            const rim = at(gp(gtorus(1, 0.1), tr, pd, { outline: 0.4, ei }), 0, 0.005, 0, [0.12, 0.115, 0.12]); rim.rotation.x = Math.PI / 2;
          }
          break;
        }
        case "robe": {
          shell("robe", [[0.34, 0.1], [0.31, 0.22], [0.279, 0.4], [0.273, 0.54], [0.25, 0.63], [0.2, 0.71]], 0, b);
          band("robehem", 0.343, 0.1, 0.15, 0, tr, { ei });
          band("robebelt", 0.284, SASH_Y - 0.035, SASH_Y + 0.035, 0, C.sash, { outline: 0.6 });
          strip("robefront", [[0.34, 0.1], [0.31, 0.22], [0.279, 0.4]], Math.PI, 0.16, tr, { ei });
          for (const d of [-1, 1]) { const v = at(gp(gbox(0.03, 0.16, 0.02), tr, body, { outline: 0, ei }), d * 0.055, 0.6, -0.232); v.rotation.z = d * 0.55; v.rotation.x = -0.25; }
          sleeves(); epaulettes();
          break;
        }
        case "hoodie": {
          shell("hoodie", [[0.27, 0.3], [0.278, 0.4], [0.274, 0.52], [0.252, 0.62], [0.2, 0.71]], 0, b);
          band("hoodiehem", 0.283, 0.3, 0.35, 0, darker(b, 0.82));
          const pocket = at(gp(gbox(0.22, 0.09, 0.03, 0.01), darker(b, 0.85), body, { outline: 0.5 }), 0, 0.39, -0.232); pocket.rotation.x = 0.08;
          for (const d of [-1, 1]) { cord([d * 0.05, 0.64, -0.215], [d * 0.055, 0.53, -0.238], 0.007, tr, body); at(gp(sph(), tr, body, { outline: 0, ei }), d * 0.055, 0.525, -0.238, 0.014); }
          const hood = at(gp(gtorus(0.22, 0.075, Math.PI), b, body, { outline: 0.7 }), 0, 0.7, 0.02); hood.rotation.x = Math.PI / 2; hood.scale.set(1, SZ, 1);
          sleeves(); epaulettes();
          break;
        }
        case "coat": {
          const pts = [[0.33, 0.2], [0.3, 0.3], [0.281, 0.42], [0.275, 0.54], [0.252, 0.63], [0.2, 0.71]];
          shell("coat", pts, 0.55, b);
          band("coathem", 0.334, 0.2, 0.24, 0.55, tr, { ei });
          shell("coatcollar", [[0.215, 0.66], [0.255, 0.76]], 0.9, darker(b, 0.85), { outline: 0.6 });
          if (r >= 1) for (const s of [-1, 1]) strip("coatedge", pts, Math.PI + s * (0.55 / 2 + 0.03), 0.06, tr, { ei });
          if (r >= 1) for (const y of [0.52, 0.42, 0.32]) { const ph = Math.PI + 0.55 / 2 + 0.11, rr = 0.29; at(gp(sph(), tc, body, { outline: 0, ei }), Math.sin(ph) * rr, y, Math.cos(ph) * rr * SZ, 0.016); }
          sleeves(); epaulettes();
          break;
        }
        default: { // vest
          const pts = [[0.268, 0.3], [0.276, 0.4], [0.272, 0.52], [0.25, 0.62], [0.2, 0.7]];
          shell("vest", pts, 0.75, b);
          band("vesthem", 0.281, 0.295, 0.33, 0.75, tr, { ei });
          if (b === "#d4f23c") band("vesthivis", 0.281, 0.42, 0.46, 0.75, "#eef2f4", { outline: 0 });
          if (r >= 1) for (const s of [-1, 1]) strip("vestedge", pts, Math.PI + s * (0.75 / 2 + 0.03), 0.06, tr, { ei });
          epaulettes();
        }
      }
    }

    // ----- trinket -----
    if (GR.trinket) {
      const g = GR.trinket, b = g.base, tc = g.color, ei = glowOf(g), r = g.rank, look = g.look;
      // Sit on top of any armour shell: chest pieces come forward, belt pieces move out.
      const puff = { plate: 0.045, robe: 0.03, coat: 0.03, hoodie: 0.028, vest: 0.022 }[GR.armour?.look] || 0;
      const out = (x, z) => { const rr = Math.hypot(x, z / SZ) || 1, k = (rr + puff * 1.4) / rr; return [x * k, z * k]; };
      const sway = (pivot, amp, speed, ph) => { const x0 = pivot.rotation.x, z0 = pivot.rotation.z; gearTicks.push((c, flap) => { pivot.rotation.z = z0 + Math.sin(c * speed + ph) * amp * (1 + flap * 3); pivot.rotation.x = x0 + Math.sin(c * speed * 0.7 + ph + 1) * amp * 0.6; }); };
      switch (look) {
        case "amulet": {
          for (const d of [-1, 1]) cord([d * 0.1, 0.675, -0.19 - puff], [0, 0.585, -0.238 - puff], 0.006, b, body);
          const pd = new THREE.Group(); pd.position.set(0, 0.565, -0.236 - puff); body.add(pd);
          const disc = gp(gcyl(0.042, 0.042, 0.018, 14), b, pd, { outline: 0.5, gloss: 1 }); disc.rotation.x = Math.PI / 2;
          at(gp(sph(), tc, pd, { gloss: 1, ei: Math.max(ei, r >= 1 ? 0.15 : 0), outline: 0 }), 0, 0, -0.01, [0.027, 0.027, 0.013]);
          break;
        }
        case "badge": {
          const bd = new THREE.Group(); bd.position.set(-0.118 - puff * 0.4, 0.585, -0.218 - puff); bd.rotation.y = 0.45; body.add(bd);
          const disc = gp(gcyl(0.056, 0.056, 0.016, 16), tc, bd, { outline: 0.5, ei: ei * 0.6 }); disc.rotation.x = Math.PI / 2;
          const ec = canvas(96, 96), ex = ec.getContext("2d");
          ex.fillStyle = b; ex.fillRect(0, 0, 96, 96);
          if (g.e) { ex.font = "64px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"; ex.textAlign = "center"; ex.textBaseline = "middle"; ex.fillText(g.e, 48, 54); }
          else { ex.fillStyle = tc; ex.beginPath(); ex.arc(48, 48, 22, 0, Math.PI * 2); ex.fill(); }
          const face = part(SG("badgeface", () => new THREE.CircleGeometry(0.043, seg(18)).rotateY(Math.PI)), toon("#ffffff", { gloss: 0.2, map: texture(ec) }), bd, { outline: 0 });
          face.position.z = -0.0095;
          break;
        }
        case "orb": {
          const ob = new THREE.Group(); ob.position.set(-0.46, 0.93, 0.06); body.add(ob);
          at(gp(sph(), r >= 1 ? tc : b, ob, { gloss: 1, ei: Math.max(ei, 0.12), outline: 0.6 }), 0, 0, 0, 0.07);
          let ring = null;
          if (r >= 2) { ring = gp(gtorus(1, 0.06), darker(tc, 0.75), ob, { outline: 0, ei: ei * 0.5 }); ring.scale.setScalar(0.105); ring.rotation.x = 1.2; }
          const y0 = ob.position.y, ph = gearPh;
          gearTicks.push((c) => { ob.position.y = y0 + Math.sin(c * 2.1 + ph) * 0.035; if (ring) ring.rotation.z = c * 1.4; });
          break;
        }
        case "bell": {
          const pv = new THREE.Group(); const [bx, bz] = out(0.19, 0.16); pv.position.set(bx, TY - 0.1, bz); body.add(pv);
          const bell = SG("bell", () => new THREE.LatheGeometry([[0.001, 0], [0.016, -0.004], [0.026, -0.024], [0.03, -0.05], [0.044, -0.074], [0.047, -0.084], [0.001, -0.084]].map(([x, y]) => new THREE.Vector2(x, y)), seg(14)));
          at(gp(gtorus(0.014, 0.004), "#3a2a22", pv, { outline: 0 }), 0, 0.008, 0);
          gp(bell, r >= 1 ? tc : b, pv, { gloss: 1, ei, outline: 0.6 });
          at(gp(sph(), INK, pv, { outline: 0 }), 0, -0.088, 0, 0.014);
          sway(pv, 0.18, 3.1, gearPh);
          break;
        }
        case "feather": {
          const kasa = t.hat === "wizard" || t.hat === "bucket";
          const yk = kasa ? HR * 0.62 : HR * 0.48, rk = kasa ? HR * 0.9 : radAtY(yk) + 0.01;
          const pv = new THREE.Group(); pv.position.set(-rk * 0.88, yk, rk * 0.47); pv.rotation.set(0.45, 0, 0.35); head.add(pv);
          at(gp(gcyl(0.008, 0.008, 0.4, 5), "#6b5a45", pv, { outline: 0 }), 0, 0.19, 0);
          at(gp(sph(), b, pv, { outline: 0.6 }), 0, 0.22, 0, [0.055, 0.2, 0.018]);
          at(gp(sph(), tc, pv, { outline: 0.5, ei }), 0, 0.37, 0, [0.045, 0.085, 0.02]);
          sway(pv, 0.06, 4.2, gearPh);
          break;
        }
        default: { // charm, on a short cord from the sash at the left hip
          const pv = new THREE.Group(); const [cx, cz] = out(-0.25, -0.06); pv.position.set(cx, TY - 0.1, cz); body.add(pv);
          at(gp(gcyl(0.006, 0.006, 0.06, 5), INK, pv, { outline: 0 }), 0, -0.03, 0);
          at(gp(sph(), b, pv, { outline: 0, gloss: 1 }), 0, -0.062, 0, 0.012);
          const ch = at(gp(goct(), tc, pv, { gloss: 1, ei, outline: 0.5 }), 0, -0.11, 0, [0.04, 0.05, 0.022]); ch.rotation.y = 0.3;
          sway(pv, 0.2, 2.7, gearPh + 1);
        }
      }
    }
  }
  const pulse = glowMats.length && Math.max(GR.weapon?.rank || 0, GR.armour?.rank || 0, GR.trinket?.rank || 0) >= 5;

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
    if (hold) hold.rotation.x = holdRest + holdK * p.wg;
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
    for (let i = 0; i < gearTicks.length; i++) gearTicks[i](clock, flap);
    if (pulse) { const k = 0.82 + 0.22 * Math.sin(clock * 2.6 + W.phase); for (let i = 0; i < glowMats.length; i++) glowMats[i].emissiveIntensity = glowMats[i].userData.ei * k; }
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
