// Effort 3D arena: the battle stage for the 7pm Taxman and the Sunday raid. Camera sits behind your squad
// (Pokémon GO raid style), walkers stand in formation with their backs to you, the boss towers at the far end.
// Loaded as a module; exposes window.Arena3D and fires "arena3d-ready". The lab drives it with game events.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

let buildWalker = null;
try { ({ buildWalker } = await import("./walker3d.js")); } catch { /* falls back to simple walkers */ }

const INK = 0x1f2a24;
const ROWS = { front: -0.4, mid: 1.1, back: 2.6 };
const BOSS_Z = -5.2;

// Boss models. Filled in once the CC0 models are chosen; anything missing uses a built-in boss.
const MODELS = (window.EffortModels || {});

// ---------- shared materials ----------
function gradientMap(steps = 3) {
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) { const v = Math.round(90 + (165 * i) / (steps - 1)); data.set([v, v, v, 255], i * 4); }
  const t = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}
const GRAD = gradientMap(3);
const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...o });
const OUTLINE = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
function outlined(geo, mat, k = 1.06) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat); g.add(m);
  const o = new THREE.Mesh(geo, OUTLINE); o.scale.setScalar(k); g.add(o);
  g.userData.main = m;
  return g;
}

// ---------- built-in bosses ----------
function faceTexture(draw) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 384;
  const x = c.getContext("2d"); draw(x, c);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, canvas: c, ctx: x };
}
// The Algorithm: a towering phone with a face on its screen.
function buildAlgorithm() {
  const root = new THREE.Group();
  const body = outlined(new RoundedBoxGeometry(2.4, 4, 0.7, 6, 0.35), toon(0x2a2f3a), 1.04);
  body.position.y = 3; root.add(body);
  const face = faceTexture((x, c) => {
    const g = x.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, "#8fd3ff"); g.addColorStop(1, "#3b82c4");
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.5), new THREE.MeshBasicMaterial({ map: face.tex }));
  screen.position.set(0, 3, 0.36); root.add(screen);
  const drawFace = (mood = 0, blink = false) => {
    const { ctx: x, canvas: c } = face;
    const g = x.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, mood > 0.5 ? "#ff9a9a" : "#8fd3ff"); g.addColorStop(1, mood > 0.5 ? "#c4383b" : "#3b82c4");
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "rgba(255,255,255,.18)"; for (let i = 0; i < 6; i++) x.fillRect(20, 230 + i * 24, 216 - (i % 3) * 40, 12);
    x.fillStyle = "#fff"; x.strokeStyle = "#1f2a24"; x.lineWidth = 8;
    for (const ex of [80, 176]) { x.beginPath(); x.ellipse(ex, 110, 34, blink ? 4 : 38, 0, 0, 7); x.fill(); x.stroke(); if (!blink) { x.fillStyle = "#1f2a24"; x.beginPath(); x.arc(ex + 6, 116, 15, 0, 7); x.fill(); x.fillStyle = "#fff"; } }
    x.strokeStyle = "#1f2a24"; x.fillStyle = "#1f2a24"; x.beginPath();
    if (mood > 0.5) { x.moveTo(60, 200); x.quadraticCurveTo(128, 150, 196, 200); x.lineTo(196, 214); x.quadraticCurveTo(128, 175, 60, 214); x.fill(); }
    else { x.moveTo(60, 185); for (let i = 0; i <= 8; i++) x.lineTo(60 + i * 17, 185 + (i % 2 ? 22 : 0)); x.stroke(); }
    face.tex.needsUpdate = true;
  };
  drawFace();
  const notch = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.14, 0.1, 2, 0.05), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  notch.position.set(0, 4.75, 0.38); root.add(notch);
  const limb = (len, r) => outlined(new THREE.CapsuleGeometry(r, len, 6, 12), toon(0x4d3a7a), 1.08);
  const armL = limb(1.6, 0.22), armR = limb(1.6, 0.22);
  armL.position.set(-1.55, 3.2, 0); armR.position.set(1.55, 3.2, 0);
  armL.rotation.z = -0.5; armR.rotation.z = 0.5; root.add(armL, armR);
  const legL = limb(0.8, 0.26), legR = limb(0.8, 0.26);
  legL.position.set(-0.6, 0.6, 0); legR.position.set(0.6, 0.6, 0); root.add(legL, legR);
  const antenna = outlined(new THREE.SphereGeometry(0.18, 16, 12), toon(0xff5d5d, { emissive: 0x661111 }));
  antenna.position.set(0, 5.35, 0); root.add(antenna);
  return { root, height: 5.4, parts: { body, armL, armR, legL, legR, antenna, screen }, drawFace };
}
// The Taxman: a tall grey suit with a top hat, monocle and a sack of your money.
function buildTaxman() {
  const root = new THREE.Group();
  const suit = toon(0x7d8a82), dark = toon(0x1f2a24), red = toon(0xd9483b), gold = toon(0xf2b51d, { emissive: 0x332200 }), skin = toon(0xe9d8c4);
  const body = outlined(new THREE.CapsuleGeometry(1.0, 1.8, 8, 20), suit, 1.04); body.position.y = 2.0; body.scale.set(1, 1, 0.85); root.add(body);
  const head = outlined(new THREE.SphereGeometry(0.75, 24, 18), skin); head.position.y = 3.9; root.add(head);
  const brim = outlined(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 28), dark); brim.position.y = 4.5; root.add(brim);
  const hat = outlined(new THREE.CylinderGeometry(0.62, 0.66, 1.1, 24), dark); hat.position.y = 5.05; root.add(hat);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.665, 0.67, 0.18, 24), red); band.position.y = 4.65; root.add(band);
  const eye = (x) => { const e = outlined(new THREE.SphereGeometry(0.16, 16, 12), toon(0xffffff)); e.position.set(x, 4.0, 0.66); const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), dark); p.position.set(0, 0, 0.12); e.add(p); return e; };
  const eL = eye(-0.26), eR = eye(0.26); root.add(eL, eR);
  const mono = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 24), gold); mono.position.set(0.26, 4.0, 0.74); root.add(mono);
  const tie = outlined(new THREE.ConeGeometry(0.18, 0.9, 4), red); tie.position.set(0, 2.9, 0.86); tie.rotation.x = Math.PI; root.add(tie);
  const armL = outlined(new THREE.CapsuleGeometry(0.22, 1.3, 6, 12), suit, 1.08); armL.position.set(-1.25, 2.4, 0); armL.rotation.z = -0.35; root.add(armL);
  const armR = outlined(new THREE.CapsuleGeometry(0.22, 1.3, 6, 12), suit, 1.08); armR.position.set(1.25, 2.4, 0); armR.rotation.z = 0.35; root.add(armR);
  const bag = outlined(new THREE.SphereGeometry(0.7, 20, 16), gold); bag.position.set(1.9, 1.3, 0.3); bag.scale.set(1, 1.15, 1); root.add(bag);
  const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 0.3, 12), gold); knot.position.set(1.9, 2.15, 0.3); root.add(knot);
  const legL = outlined(new THREE.CapsuleGeometry(0.26, 0.6, 6, 12), dark); legL.position.set(-0.45, 0.55, 0); root.add(legL);
  const legR = outlined(new THREE.CapsuleGeometry(0.26, 0.6, 6, 12), dark); legR.position.set(0.45, 0.55, 0); root.add(legR);
  return { root, height: 5.6, parts: { body, head, hat, armL, armR, bag, legL, legR } };
}
const BUILT_IN = { algorithm: buildAlgorithm, taxman: buildTaxman };

// ---------- fallback walker ----------
function simpleWalker(answers) {
  const hue = Number(answers?.hue) || 30;
  const g = new THREE.Group();
  const body = outlined(new THREE.CapsuleGeometry(0.45, 0.6, 8, 16), toon(new THREE.Color(`hsl(${hue}, 65%, 60%)`)));
  body.position.y = 0.8; g.add(body);
  let t = 0, act = null, actT = 0;
  return {
    group: g, height: 1.6,
    update(dt) { t += dt; actT += dt; body.position.y = 0.8 + Math.sin(t * 3) * 0.04; if (act === "attack") body.position.z = -Math.sin(Math.min(1, actT / 0.35) * Math.PI) * 0.6; if (act === "down") g.rotation.x = Math.min(1.4, actT * 4); },
    play(a) { act = a; actT = 0; if (a === "revive" || a === "idle") g.rotation.x = 0; },
    setTint() {}, dispose() {},
  };
}

// ---------- the arena ----------
class Arena {
  constructor(host, opts) {
    this.host = host; this.mode = opts.mode;
    this.bossZ = opts.mode === "tax" ? BOSS_Z + 1.4 : BOSS_Z; // the Taxman stands closer: it's a one-on-one
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    const cv = this.renderer.domElement;
    cv.className = "arena3d"; cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    host.prepend(cv);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(opts.mode === "tax" ? 0x0b150f : 0x070d1c, 14, 34);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    this.camBase = opts.mode === "tax" ? new THREE.Vector3(0.7, 2.9, 7.6) : new THREE.Vector3(0, 4.0, 9.2);
    this.lookAt = opts.mode === "tax" ? new THREE.Vector3(-0.2, 2.5, this.bossZ + 2) : new THREE.Vector3(0, 2.9, this.bossZ + 1.5);
    this.shakeAmt = 0; this.t = 0; this.fx = []; this.heroes = new Map();
    this.buildStage(opts);
    this.boss = null;
    this.loadBoss(opts.boss || { id: opts.mode === "tax" ? "taxman" : "algorithm" });
    for (const m of opts.team || []) this.addHero(m);
    this.layout(true);
    this.resize();
    this.onResize = () => this.resize();
    window.addEventListener("resize", this.onResize);
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  buildStage(opts) {
    const S = this.scene;
    const tax = opts.mode === "tax";
    S.add(new THREE.HemisphereLight(tax ? 0xd8ffe0 : 0xbcd4ff, tax ? 0x203018 : 0x101830, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(-4, 9, 7); S.add(sun);
    // A soft key light from behind the camera so the boss's face reads clearly.
    const key = new THREE.DirectionalLight(0xfff4e0, 1.3); key.position.set(2, 5, 12); key.target.position.set(0, 2, this.bossZ); S.add(key, key.target);
    this.rim = new THREE.PointLight(tax ? 0xffd166 : 0x7fb2ff, 30, 18); this.rim.position.set(0, 4, this.bossZ - 2.5); S.add(this.rim);
    this.danger = new THREE.PointLight(0xff3b3b, 0, 20); this.danger.position.set(0, 3, this.bossZ + 3); S.add(this.danger);
    // Arena floor: a big disc with a glowing rune ring.
    const floorTex = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d");
      const g = x.createRadialGradient(256, 256, 20, 256, 256, 256);
      g.addColorStop(0, tax ? "#4a7a55" : "#3a4f86"); g.addColorStop(0.7, tax ? "#22382a" : "#1a2546"); g.addColorStop(1, tax ? "#0b150f" : "#070d1c");
      x.fillStyle = g; x.fillRect(0, 0, 512, 512);
      x.strokeStyle = "rgba(255,255,255,.08)"; x.lineWidth = 2;
      for (let r = 60; r < 256; r += 48) { x.beginPath(); x.arc(256, 256, r, 0, 7); x.stroke(); }
      for (let a = 0; a < 12; a++) { x.beginPath(); x.moveTo(256, 256); x.lineTo(256 + Math.cos(a / 12 * 6.283) * 256, 256 + Math.sin(a / 12 * 6.283) * 256); x.stroke(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshLambertMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = -2; S.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 5.9, 64), new THREE.MeshBasicMaterial({ color: tax ? 0xffd166 : 0x6fb6ff, transparent: true, opacity: 0.55 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.02, this.bossZ); S.add(ring); this.bossRing = ring;
    // Standing stones around the edge for depth.
    const stone = toon(tax ? 0x2c4434 : 0x2b3456);
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * (0.05 + (i / 13) * 0.9) + Math.PI, r = 12 + (i % 3);
      const h = 1.5 + ((i * 37) % 5) * 0.6;
      const p = outlined(new THREE.CylinderGeometry(0.35, 0.55, h, 6), stone, 1.05);
      p.position.set(Math.cos(a) * r, h / 2, -2 + Math.sin(a) * r * 0.9); p.rotation.y = i; S.add(p);
    }
    // Drifting embers.
    const n = 160, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 24; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = -12 + Math.random() * 18; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.embers = new THREE.Points(geo, new THREE.PointsMaterial({ color: tax ? 0xffe08a : 0x9fd0ff, size: 0.07, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    S.add(this.embers);
  }

  // ---------- boss ----------
  loadBoss(def) {
    const spec = MODELS[def.id];
    const place = (obj, height) => {
      const holder = new THREE.Group(); holder.add(obj); holder.position.set(0, 0, this.bossZ);
      this.scene.add(holder);
      this.boss = { ...this.boss, holder, obj, height, flash: 0, act: "idle", actT: 0, dead: false, baseScale: holder.scale.x };
      this.addShadow(holder, height * 0.35);
    };
    const builtIn = () => {
      const b = (BUILT_IN[def.id] || BUILT_IN[this.mode === "tax" ? "taxman" : "algorithm"])();
      this.boss = { built: b };
      place(b.root, b.height);
      this.collectMats(b.root);
    };
    if (!spec) return builtIn();
    builtIn(); // show something straight away; swap in the model when it arrives
    new GLTFLoader().load(spec.url, (gltf) => {
      const obj = gltf.scene;
      const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
      const k = (spec.height || 5.5) / Math.max(0.001, size.y);
      obj.scale.setScalar(k);
      obj.position.y = -box.min.y * k + (spec.hover || 0);
      obj.rotation.y = spec.rotY || 0;
      obj.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        const src = o.material;
        // Re-light the model with the same toon ramp as everything else, keeping its colours/textures.
        o.material = toon(src.color ? src.color.clone() : 0xffffff, { map: src.map || null, vertexColors: !!src.vertexColors, transparent: !!src.transparent, opacity: src.opacity ?? 1 });
        if (spec.tint) o.material.color.lerp(new THREE.Color(spec.tint), 0.35);
      });
      const old = this.boss.holder, wasDead = this.boss.dead;
      this.scene.remove(old);
      this.boss = { gltf, mixer: new THREE.AnimationMixer(obj), clips: {}, hover: spec.hover || 0 };
      // Clips are named "CharacterArmature|Idle" and so on; match each role against its list of candidates.
      const byName = new Map(gltf.animations.map((a) => [a.name.replace(/^.*\|/, "").toLowerCase(), a]));
      for (const [role, names] of Object.entries(spec.clips || {})) {
        const clip = names.map((n) => byName.get(n.toLowerCase())).find(Boolean);
        if (clip) this.boss.clips[role] = this.boss.mixer.clipAction(clip);
      }
      if (spec.taxman) this.dressTaxman(obj, k);
      place(obj, spec.height || 5.5);
      this.collectMats(obj);
      this.bossPlay("idle");
      if (wasDead) this.bossKO();
    }, undefined, () => { /* keep the built-in boss */ });
  }
  // The Business Man model gets the Taxman's top hat, monocle and a sack of your money, pinned to his bones.
  dressTaxman(obj, k) {
    const bones = [];
    obj.traverse((o) => { if (o.isBone) bones.push(o); });
    const find = (...res) => bones.find((b) => res.some((re) => re.test(b.name)));
    const head = find(/^head$/i, /head/i), hand = find(/fist.?r$/i, /hand.?r$/i, /wrist.?r$/i, /lowerarm.?r$/i);
    // Bones carry their own scale and rotation; undo both so accessories are sized and oriented in arena units.
    obj.updateMatrixWorld(true);
    const pin = (bone, group) => {
      const ws = bone.getWorldScale(new THREE.Vector3()).x;
      group.scale.setScalar(1 / ws);
      group.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
      bone.add(group);
    };
    if (head) {
      const hat = new THREE.Group();
      const dark = toon(0x1f2a24), red = toon(0xd9483b), gold = toon(0xf2b51d, { emissive: 0x221100 });
      const brim = outlined(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 28), dark); hat.add(brim);
      const crown = outlined(new THREE.CylinderGeometry(0.38, 0.41, 0.7, 24), dark); crown.position.y = 0.38; hat.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.415, 0.42, 0.12, 24), red); band.position.y = 0.1; hat.add(band);
      hat.position.set(0, 0.62, 0); hat.rotation.z = -0.08;
      const mono = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 8, 20), gold); mono.position.set(0.14, 0.32, 0.38);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4), gold); chain.position.set(0.24, 0.12, 0.36); chain.rotation.z = 0.4;
      const wrap = new THREE.Group(), inner = new THREE.Group(); inner.add(hat, mono, chain); inner.scale.setScalar(0.75); wrap.add(inner);
      pin(head, wrap);
    }
    if (hand) {
      const gold = toon(0xf2b51d, { emissive: 0x221100 });
      const bag = new THREE.Group();
      const sack = outlined(new THREE.SphereGeometry(0.42, 20, 16), gold); sack.scale.set(1, 1.15, 1); sack.position.y = -0.5; bag.add(sack);
      const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.22, 12), gold); knot.position.y = -0.05; bag.add(knot);
      const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
      x.fillStyle = "#1f2a24"; x.font = "900 96px Arial"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("£", 64, 70);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
      label.position.set(0, -0.5, 0.43); bag.add(label);
      const wrap = new THREE.Group(); bag.scale.setScalar(1.0); wrap.add(bag);
      pin(hand, wrap);
    }
  }
  collectMats(root) {
    const mats = [];
    root.traverse((o) => { if (o.isMesh && o.material && o.material.emissive && o.material !== OUTLINE) mats.push(o.material); });
    this.boss.mats = mats;
  }
  bossPlay(name, { once = false, then = "idle" } = {}) {
    const B = this.boss;
    B.act = name; B.actT = 0;
    if (!B.mixer) return;
    const a = B.clips[name] || (name !== "idle" && B.clips.attack) || B.clips.idle;
    if (!a) return;
    const prev = B.current;
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
    a.fadeIn(0.15).play();
    if (prev && prev !== a) prev.fadeOut(0.15);
    B.current = a;
    if (once && then) {
      const dur = a.getClip().duration * 1000;
      clearTimeout(B.backT); B.backT = setTimeout(() => { if (!B.dead) this.bossPlay(then); }, Math.max(300, dur - 150));
    }
  }

  // ---------- heroes ----------
  addHero(m) {
    const w = buildWalker ? buildWalker(THREE, m.answers || {}, { you: !!m.you }) : simpleWalker(m.answers);
    const scale = this.mode === "tax" ? 0.95 : 1;
    w.group.scale.setScalar(scale);
    this.scene.add(w.group);
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 32), new THREE.MeshBasicMaterial({ color: m.you ? 0xffcf3f : 0xffffff, transparent: true, opacity: m.you ? 0.9 : 0.35 }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.03; w.group.add(marker);
    if (!buildWalker) this.addShadow(w.group, 0.5); // the 3D walkers bring their own soft shadow
    this.heroes.set(m.id, { w, m, pos: m.pos || "mid", target: new THREE.Vector3(), down: false });
  }
  addShadow(parent, r) {
    const tex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const s = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.4, r * 2.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.rotation.x = -Math.PI / 2; s.position.y = 0.01; parent.add(s);
  }
  // Place everyone: in the raid, rows at set depths spread across; in the Taxman fight, just you, front-left.
  layout(snap) {
    if (this.mode === "tax") {
      for (const h of this.heroes.values()) { h.target.set(-0.55, 0, 3.3); if (snap) h.w.group.position.copy(h.target); }
      return;
    }
    const byRow = { front: [], mid: [], back: [] };
    for (const h of this.heroes.values()) byRow[h.pos].push(h);
    for (const [row, list] of Object.entries(byRow)) {
      const n = list.length, gap = row === "front" ? 1.9 : 1.75;
      list.forEach((h, i) => {
        h.target.set((i - (n - 1) / 2) * gap + (row === "mid" ? 0.35 : 0), 0, ROWS[row] + (i % 2) * 0.25);
        if (snap) h.w.group.position.copy(h.target);
      });
    }
  }

  // ---------- events from the game ----------
  heroAttack(id, { crit = false, big = false } = {}) {
    const h = this.heroes.get(id); if (!h || h.down) return;
    h.w.play(big ? "big" : "attack");
    const from = h.w.group.position.clone().add(new THREE.Vector3(0, 1.1 * h.w.group.scale.y, -0.3));
    const to = this.bossPoint(0.45 + Math.random() * 0.3, (Math.random() - 0.5) * 1.2);
    this.projectile(from, to, crit || big ? 0xff9f43 : h.m.you ? 0xffd166 : 0x9fd0ff, crit || big ? 0.22 : 0.13, crit || big);
  }
  bossHit(crit) {
    const B = this.boss; if (!B) return;
    B.flash = crit ? 1 : 0.6;
    B.squash = crit ? 0.14 : 0.06;
    if (crit) this.shake(0.18);
    if (B.mixer && B.clips.hit && Math.random() < (crit ? 0.6 : 0.08)) this.bossPlay("hit", { once: true });
  }
  bossWindup(type, ids = []) {
    const B = this.boss; if (!B) return;
    B.windup = 1;
    this.danger.intensity = 25;
    if (B.mixer && type === "scream" && B.clips.roar) this.bossPlay("roar", { once: true });
    // Ground telegraphs under whoever is about to be hit.
    const spots = type === "scream" ? [...this.heroes.values()] : ids.map((i) => this.heroes.get(i)).filter(Boolean);
    for (const h of spots) this.decal(h.w.group.position, type === "stomp" ? 1.4 : 0.9, 0xff3b3b, 2.2);
  }
  bossAttack(type, ids = []) {
    const B = this.boss; if (!B) return;
    B.windup = 0; this.danger.intensity = 0;
    B.act = `atk-${type}`; B.actT = 0; B.lunge = type === "swipe" || type === "stomp" ? 1 : 0;
    if (B.mixer) this.bossPlay(type === "feast" ? "eat" : type === "stomp" && B.clips.stomp ? "stomp" : type === "scream" && B.clips.roar ? "roar" : "attack", { once: true });
    const origin = this.bossPoint(0.55, 0);
    if (type === "swipe") {
      for (const id of ids) { const h = this.heroes.get(id); if (h) this.slashAt(h.w.group.position.clone().add(new THREE.Vector3(0, 0.9, 0)), 0xff4d6d); }
      this.shake(0.25);
    } else if (type === "stomp") {
      this.shockwave(new THREE.Vector3(0, 0.05, this.bossZ + 1.5), 0xffc878, 9, 0.7); this.shake(0.6);
    } else if (type === "scream") {
      for (let i = 0; i < 4; i++) setTimeout(() => this.shockwave(origin.clone(), 0xff6b8b, 14, 0.8, true), i * 110);
      this.shake(0.4);
    } else if (type === "feast") {
      B.feastGlow = 6;
    }
  }
  hurt(id) { const h = this.heroes.get(id); if (h) { h.w.play("hurt"); if (h.m.you) this.shake(0.22); } }
  down(id) { const h = this.heroes.get(id); if (h) { h.down = true; h.w.play("down"); } }
  revive(id) { const h = this.heroes.get(id); if (h) { h.down = false; h.w.play("revive"); this.pillar(h.w.group.position, 0x7ee29d); } }
  move(id, pos) { const h = this.heroes.get(id); if (h) { h.pos = pos; this.layout(false); } }
  shield(ids, secs = 8) {
    for (const id of ids) {
      const h = this.heroes.get(id); if (!h) continue;
      h.w.play("block");
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      h.w.group.add(dome);
      this.fx.push({ obj: dome, life: secs, t: 0, update: (f) => { dome.material.opacity = 0.22 + Math.sin(f.t * 6) * 0.08; dome.scale.setScalar(1 + Math.sin(f.t * 3) * 0.03); }, done: () => { h.w.group.remove(dome); if (!h.down) h.w.play("idle"); } });
    }
  }
  heal(fromId, toId) {
    const a = this.heroes.get(fromId), b = this.heroes.get(toId); if (!a || !b) return;
    a.w.play("cast");
    this.beam(a.w.group.position.clone().add(new THREE.Vector3(0, 1, 0)), b.w.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x7ee29d);
    this.pillar(b.w.group.position, 0x7ee29d);
  }
  phase(n) {
    this.rim.color.set(n === 3 ? 0xff4040 : n === 2 ? 0xc77dff : 0x7fb2ff);
    this.scene.fog.color.set(n === 3 ? 0x1a0505 : n === 2 ? 0x120a1e : 0x070d1c);
    const B = this.boss; if (B) B.grow = n === 3 ? 1.12 : n === 2 ? 1.06 : 1;
    if (B?.mixer && B.clips.roar) this.bossPlay("roar", { once: true });
    this.shake(0.5);
  }
  bossKO() {
    const B = this.boss; if (!B || B.dead) return;
    B.dead = true; B.act = "ko"; B.actT = 0;
    if (B.mixer && B.clips.death) this.bossPlay("death", { once: true, then: null });
    this.shake(0.7);
    for (const h of this.heroes.values()) if (!h.down) h.w.play("cheer");
  }
  cheer() { for (const h of this.heroes.values()) if (!h.down) h.w.play("cheer"); }

  // ---------- effects ----------
  bossPoint(heightFrac = 0.5, dx = 0) {
    const B = this.boss;
    return new THREE.Vector3(dx, (B?.height || 5) * heightFrac * (B?.holder?.scale.y || 1), this.bossZ + 0.8);
  }
  projectile(from, to, color, size, big) {
    const core = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(size * 2.4, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.add(glow); core.position.copy(from); this.scene.add(core);
    const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, big ? 1.6 : 0.8, 0));
    const trail = [];
    this.fx.push({ obj: core, life: big ? 0.38 : 0.26, t: 0,
      update: (f) => {
        const k = f.t / f.life, a = from.clone().lerp(mid, k), b = mid.clone().lerp(to, k);
        core.position.copy(a.lerp(b, k));
        if (trail.length < 6 && Math.random() < 0.7) { const s = new THREE.Mesh(new THREE.SphereGeometry(size * 0.8, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); s.position.copy(core.position); this.scene.add(s); trail.push(s); this.fx.push({ obj: s, life: 0.25, t: 0, update: (g) => { s.material.opacity = 0.6 * (1 - g.t / g.life); s.scale.setScalar(1 - g.t / g.life); }, done: () => this.scene.remove(s) }); }
      },
      done: () => { this.scene.remove(core); this.burst(to, color, big ? 22 : 10, big ? 5 : 3); } });
  }
  burst(at, color, n, speed) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { pos.set([at.x, at.y, at.z], i * 3); vel.push(new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed, (Math.random() - 0.2) * speed)); }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(pts);
    this.fx.push({ obj: pts, life: 0.5, t: 0, update: (f, dt) => { const p = geo.attributes.position; for (let i = 0; i < n; i++) { vel[i].y -= 9 * dt; p.setXYZ(i, p.getX(i) + vel[i].x * dt, p.getY(i) + vel[i].y * dt, p.getZ(i) + vel[i].z * dt); } p.needsUpdate = true; pts.material.opacity = 1 - f.t / f.life; }, done: () => this.scene.remove(pts) });
  }
  slashAt(at, color) {
    for (let i = -1; i <= 1; i++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 24, Math.PI * 0.7), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      arc.position.copy(at).add(new THREE.Vector3(i * 0.25, 0, 0.5)); arc.rotation.set(0, 0, -0.6 + i * 0.1);
      this.scene.add(arc);
      this.fx.push({ obj: arc, life: 0.4, t: 0, update: (f) => { arc.material.opacity = 1 - f.t / f.life; arc.rotation.z -= 0.15; arc.scale.setScalar(1 + f.t * 1.5); }, done: () => this.scene.remove(arc) });
    }
    this.burst(at, color, 14, 4);
  }
  shockwave(at, color, radius, life, vertical = false) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.copy(at);
    if (vertical) ring.lookAt(this.camera.position); else ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.fx.push({ obj: ring, life, t: 0, update: (f) => { const k = f.t / f.life; ring.scale.setScalar(0.5 + radius * (1 - (1 - k) ** 3)); ring.material.opacity = 1 - k; }, done: () => this.scene.remove(ring) });
  }
  decal(at, r, color, life) {
    const d = new THREE.Mesh(new THREE.RingGeometry(r * 0.75, r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
    d.rotation.x = fill.rotation.x = -Math.PI / 2; d.position.set(at.x, 0.04, at.z); fill.position.set(at.x, 0.035, at.z);
    this.scene.add(d, fill);
    this.fx.push({ obj: d, life, t: 0, update: (f) => { const k = f.t / f.life; d.material.opacity = 0.5 + Math.sin(f.t * 18) * 0.3; fill.material.opacity = 0.25 * k; fill.scale.setScalar(k); }, done: () => this.scene.remove(d, fill) });
  }
  beam(a, b, color) {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, len, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(a).lerp(b, 0.5); m.lookAt(b); m.rotateX(Math.PI / 2);
    this.scene.add(m);
    this.fx.push({ obj: m, life: 0.5, t: 0, update: (f) => { m.material.opacity = 1 - f.t / f.life; m.scale.set(1 + f.t * 3, 1, 1 + f.t * 3); }, done: () => this.scene.remove(m) });
  }
  pillar(at, color) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4, 24, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(at.x, 2, at.z); this.scene.add(m);
    this.fx.push({ obj: m, life: 0.8, t: 0, update: (f) => { const k = f.t / f.life; m.material.opacity = 0.5 * (1 - k); m.scale.set(1 - k * 0.6, 1 + k, 1 - k * 0.6); }, done: () => this.scene.remove(m) });
    this.burst(new THREE.Vector3(at.x, 0.5, at.z), color, 16, 3);
  }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  // Where something is on screen, in px relative to the host (for damage numbers and nameplates).
  screenOf(what, heightFrac = 1) {
    let v;
    if (what === "boss") v = this.bossPoint(heightFrac, 0);
    else { const h = this.heroes.get(what); if (!h) return null; v = h.w.group.position.clone(); v.y += (h.w.height || 1.6) * h.w.group.scale.y * heightFrac + 0.15; }
    v.project(this.camera);
    const r = this.host.getBoundingClientRect();
    return [(v.x * 0.5 + 0.5) * r.width, (-v.y * 0.5 + 0.5) * r.height];
  }

  // ---------- frame ----------
  resize() {
    const r = this.host.getBoundingClientRect();
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / Math.max(1, r.height);
    // Portrait phones need a wider view to fit the boss and the squad.
    this.camera.fov = this.camera.aspect < 0.7 ? 58 : 48;
    this.camera.updateProjectionMatrix();
  }
  loop() {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;
    // Camera: slow breathing sway plus shake.
    const sway = new THREE.Vector3(Math.sin(this.t * 0.4) * 0.15, Math.sin(this.t * 0.6) * 0.08, 0);
    const sh = this.shakeAmt;
    this.camera.position.copy(this.camBase).add(sway).add(new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, 0));
    this.camera.lookAt(this.lookAt);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.6);
    // Heroes glide to their spots.
    for (const h of this.heroes.values()) { h.w.group.position.lerp(h.target, Math.min(1, dt * 5)); h.w.update(dt); }
    this.updateBoss(dt);
    // Embers drift up.
    const p = this.embers.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * 0.4; if (y > 9) y = 0; p.setY(i, y); }
    p.needsUpdate = true;
    this.bossRing.material.opacity = 0.4 + Math.sin(this.t * 2) * 0.15;
    for (const f of this.fx) { f.t += dt; f.update?.(f, dt); }
    this.fx = this.fx.filter((f) => { if (f.t >= f.life) { f.done?.(); return false; } return true; });
    this.renderer.render(this.scene, this.camera);
  }
  updateBoss(dt) {
    const B = this.boss; if (!B || !B.holder) return;
    B.actT = (B.actT || 0) + dt;
    B.mixer?.update(dt);
    const H = B.holder;
    const grow = B.grow || 1;
    // Built-in bosses are animated by hand; models use their clips plus these extras.
    let sy = 1, sx = 1, ry = 0, y = 0, z = this.bossZ, rx = 0;
    if (B.mixer && B.lunge) { B.lunge = Math.max(0, B.lunge - dt * 1.6); z += Math.sin(B.lunge * Math.PI) * 2.2; }
    if (!B.dead) {
      sy += Math.sin(this.t * 2.2) * 0.02; sx -= Math.sin(this.t * 2.2) * 0.012;
      if (B.windup) { const w = Math.sin(this.t * 20) * 0.02; sx += 0.06 + w; sy += 0.06 + w; ry = Math.sin(this.t * 14) * 0.05; }
      const k = B.mixer ? 99 : B.actT;
      if (B.act === "atk-swipe" && k < 0.5) { ry = Math.sin(k / 0.5 * Math.PI) * 0.7; z += Math.sin(k / 0.5 * Math.PI) * 1.5; }
      if (B.act === "atk-stomp" && k < 0.6) { y = Math.sin(Math.min(1, k / 0.35) * Math.PI) * 1.6; if (k > 0.35) { sy -= 0.15 * Math.sin((k - 0.35) / 0.25 * Math.PI); sx += 0.1 * Math.sin((k - 0.35) / 0.25 * Math.PI); } }
      if (B.act === "atk-scream" && k < 0.7) { const s = Math.sin(k / 0.7 * Math.PI); sx += 0.15 * s; sy += 0.15 * s; rx = -0.2 * s; }
      if (B.act === "atk-feast" && k < 1.2) { sy -= 0.08 * Math.abs(Math.sin(k * 10)); }
      if (B.squash) { sx += B.squash; sy -= B.squash; B.squash *= Math.pow(0.001, dt * 6); if (B.squash < 0.002) B.squash = 0; }
    } else {
      const k = Math.min(1, B.actT / 1.2);
      if (!B.mixer || !B.clips.death) { rx = -k * 1.4; y = -k * 0.4; }
      sy = 1 - (B.mixer ? 0 : k * 0.1);
    }
    H.scale.set(sx * grow, sy * grow, sx * grow);
    H.position.set(0, y + (B.hover ? Math.sin(this.t * 1.6) * 0.15 : 0), z);
    H.rotation.set(rx, ry, 0);
    // Hit flash: push the emissive up and fade it out.
    if (B.flash > 0) B.flash = Math.max(0, B.flash - dt * 6);
    const feast = B.feastGlow > 0 ? (B.feastGlow -= dt, 0.25 + Math.sin(this.t * 10) * 0.15) : 0;
    const wind = B.windup ? 0.18 + Math.sin(this.t * 20) * 0.08 : 0;
    for (const m of B.mats || []) m.emissive.setRGB(B.flash + feast + wind, B.flash * 0.9 + feast * 0.7, B.flash * 0.8);
    // Built-in limbs.
    const parts = B.built?.parts;
    if (parts && !B.dead) {
      const swing = B.act === "atk-swipe" && B.actT < 0.5 ? Math.sin(B.actT / 0.5 * Math.PI) * 1.6 : 0;
      if (parts.armL) parts.armL.rotation.z = -0.5 - Math.sin(this.t * 2.2) * 0.12 - (B.windup ? 0.8 : 0);
      if (parts.armR) parts.armR.rotation.z = 0.5 + Math.sin(this.t * 2.2) * 0.12 + (B.windup ? 0.8 : 0) + swing;
      if (parts.antenna) parts.antenna.userData.main.material.emissive.setRGB(0.4 + Math.sin(this.t * 6) * 0.3, 0.05, 0.05);
      if (parts.bag) parts.bag.rotation.z = Math.sin(this.t * 3) * 0.12;
      if (B.built.drawFace && (Math.floor(this.t * 4) !== B.lastFaceTick)) {
        B.lastFaceTick = Math.floor(this.t * 4);
        B.built.drawFace(B.windup || B.act.startsWith("atk") ? 1 : 0, Math.random() < 0.06);
      }
    }
  }
  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    for (const h of this.heroes.values()) h.w.dispose?.();
    this.scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material && o.material !== OUTLINE) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

window.Arena3D = {
  create(host, opts) { return new Arena(host, opts); },
  supported() { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } },
  hasWalkers: !!buildWalker,
};
window.dispatchEvent(new Event("arena3d-ready"));
