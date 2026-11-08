// Effort 3D arena: the battle stage for the evening Taxman and the Sunday raid. Camera sits behind your squad
// (Pokémon GO raid style), walkers stand in formation with their backs to you, the boss towers at the far end.
// Loaded as a module; exposes window.Arena3D and fires "arena3d-ready". The lab drives it with game events.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

let buildWalker = null;
try { ({ buildWalker } = await import("./ninja3d.js")); } catch { /* falls back to simple walkers */ }

const INK = 0x1f2a24;
const ROWS = { front: -0.4, mid: 1.1, back: 2.6 };
const BOSS_Z = -5.2;
// Ground warning colour for each boss move, and the colour of each class's special.
const WARN = { swipe: 0xff3b3b, stomp: 0xff3b3b, scream: 0xff3b3b, ooze: 0x5cff4a, spores: 0xffa13d, gust: 0x7ff0ff, grab: 0x9b5cff, slam: 0xff2a00, breath: 0xff7a1a };
const CLASS_FX = { bouncer: 0xffc83d, menace: 0xff4d5e, mad: 0x7dff6a, gremlin: 0xff8a2b, lollipop: 0xfff04a, librarian: 0x9fb4ff, pigeon: 0xe8e8f0, courier: 0x45d483, pickpocket: 0xc77dff, hedge: 0x6fd4ff };

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
// The Taxman's nose: very big but a real one, in his own skin (pass the face's material). No outline and no red bulb:
// a bridge narrowing between the eyes, a slight hump, a rounded tip, wings either side and nostrils underneath. It
// hangs from the top of the bridge (0,0,0): -y runs down the nose, +z out of the face. About 0.34 long at s = 1.
function taxNose(skin, s = 1) {
  const nose = new THREE.Group(), L = 0.34;
  // The body of the nose: a sphere pushed into shape. t runs 0 at the bridge to 1 under the tip, where it meets the lip.
  const geo = new THREE.SphereGeometry(1, 40, 32), p = geo.attributes.position, v = new THREE.Vector3();
  const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = (1 - v.y) / 2;
    const width = 0.032 + 0.05 * Math.pow(t, 1.6) + 0.018 * sm(0.7, 0.92, t);
    const out = (0.03 + 0.21 * sm(0, 0.84, t) + 0.012 * Math.exp(-(((t - 0.38) / 0.13) ** 2))) * (1 - 0.85 * sm(0.86, 1, t));
    p.setXYZ(i, v.x * width, -t * L, v.z > 0 ? v.z * out : v.z * 0.02);
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, skin); nose.add(body);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.064, 24, 18), skin); tip.scale.set(1.1, 0.9, 0.85); tip.position.set(0, -0.8 * L, 0.168); nose.add(tip);
  for (const x of [-1, 1]) {
    const ala = new THREE.Mesh(new THREE.SphereGeometry(0.046, 20, 14), skin); ala.scale.set(0.7, 0.62, 1.3); ala.position.set(x * 0.056, -0.885 * L, 0.07); ala.rotation.y = x * 0.55; nose.add(ala);
    // Nostrils: dark, flattened, tucked under the wings so they show from below and only just from the front.
    const hole = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), toon(0x4a2620)); hole.scale.set(1, 0.4, 1.7); hole.position.set(x * 0.032, -0.95 * L, 0.1); hole.rotation.y = -x * 0.35; nose.add(hole);
  }
  nose.scale.setScalar(s);
  return nose;
}
// A sack of your money, gathered at the neck: the neck sits at (0,0,0) for a fist to close round, the sack hangs
// down -y. Wrinkles bunch up towards the tie, a frill sticks out above it, and the £ is printed on the front.
function moneySack(r = 0.44) {
  const sack = new THREE.Group(), cloth = toon(0xd8a640), cord = toon(0x6b4420);
  const prof = [[0, -2.25], [0.5, -2.2], [0.82, -1.98], [1, -1.62], [0.98, -1.2], [0.8, -0.82], [0.5, -0.5], [0.2, -0.25], [0.14, -0.08], [0.15, 0.08], [0.24, 0.24], [0.33, 0.36], [0.2, 0.4], [0, 0.36]]
    .map(([x, y]) => new THREE.Vector2(x * r, y * r));
  const geo = new THREE.LatheGeometry(prof, 36), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), y = v.y / r, near = Math.exp(-(((y + 0.35) / 0.45) ** 2)) + (y > 0.05 ? 0.8 : 0);
    const k = 1 + 0.07 * near * Math.sin(a * 9 + y * 3) + 0.025 * Math.sin(a * 4 - y * 5);
    p.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  geo.computeVertexNormals();
  sack.add(new THREE.Mesh(geo, cloth));
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.165 * r, 0.05 * r, 8, 20), cord); tie.rotation.x = Math.PI / 2; tie.position.y = -0.17 * r; sack.add(tie);
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  x.fillStyle = "#3d2a10"; x.font = "900 92px Georgia, serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("£", 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * r, 0.9 * r), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  label.position.set(0, -1.6 * r, 1.08 * r); sack.add(label);
  return sack;
}
// The Taxman: a tall grey suit with a top hat, monocle, a very big nose and a sack of your money in his right hand.
function buildTaxman() {
  const root = new THREE.Group();
  const suit = toon(0x7d8a82), dark = toon(0x1f2a24), red = toon(0xd9483b), gold = toon(0xf2b51d, { emissive: 0x332200 }), skin = toon(0xe9d8c4);
  const body = outlined(new THREE.CapsuleGeometry(1.0, 1.8, 8, 20), suit, 1.04); body.position.y = 2.0; body.scale.set(1, 1, 0.85); root.add(body);
  const head = outlined(new THREE.SphereGeometry(0.75, 24, 18), skin); head.position.y = 3.9; root.add(head);
  const brim = outlined(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 28), dark); brim.position.y = 4.5; root.add(brim);
  const hat = outlined(new THREE.CylinderGeometry(0.62, 0.66, 1.1, 24), dark); hat.position.y = 5.05; root.add(hat);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.665, 0.67, 0.18, 24), red); band.position.y = 4.65; root.add(band);
  const eye = (x) => { const e = outlined(new THREE.SphereGeometry(0.16, 16, 12), toon(0xffffff)); e.position.set(x, 4.08, 0.64); const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), dark); p.position.set(0, 0, 0.12); e.add(p); return e; };
  const eL = eye(-0.26), eR = eye(0.26); root.add(eL, eR);
  const mono = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 24), gold); mono.position.set(0.26, 4.08, 0.74); root.add(mono);
  // Same material as the head, set into the face just below the eyes.
  const nose = taxNose(skin, 2.2); nose.position.set(0, 4.12, 0.68); nose.rotation.x = 0.15; root.add(nose);
  const tie = outlined(new THREE.ConeGeometry(0.18, 0.9, 4), red); tie.position.set(0, 2.9, 0.86); tie.rotation.x = Math.PI; root.add(tie);
  const armL = outlined(new THREE.CapsuleGeometry(0.22, 1.3, 6, 12), suit, 1.08); armL.position.set(-1.25, 2.4, 0); armL.rotation.z = -0.35; root.add(armL);
  const armR = outlined(new THREE.CapsuleGeometry(0.22, 1.3, 6, 12), suit, 1.08); armR.position.set(1.25, 2.4, 0); armR.rotation.z = 0.35; root.add(armR);
  // His right fist at the end of the arm, closed round the sack's neck. The sack swings from there (see updateBoss).
  const fist = outlined(new THREE.SphereGeometry(0.26, 16, 12), skin); fist.position.y = -1.0; fist.scale.set(1, 0.9, 1.05); armR.add(fist);
  const bag = moneySack(0.62); bag.position.y = -1.02; armR.add(bag);
  const legL = outlined(new THREE.CapsuleGeometry(0.26, 0.6, 6, 12), dark); legL.position.set(-0.45, 0.55, 0); root.add(legL);
  const legR = outlined(new THREE.CapsuleGeometry(0.26, 0.6, 6, 12), dark); legR.position.set(0.45, 0.55, 0); root.add(legR);
  return { root, height: 5.6, parts: { body, head, hat, armL, armR, bag, legL, legR } };
}
const BUILT_IN = { algorithm: buildAlgorithm, taxman: buildTaxman };

// ---------- models (shared by the arena and the menu portraits) ----------
const gltfCache = new Map();
function loadGltf(url) {
  if (!gltfCache.has(url)) {
    // A failed fetch isn't cached, so the next fight can try again.
    gltfCache.set(url, new GLTFLoader().loadAsync(url).catch((err) => { gltfCache.delete(url); throw err; }));
  }
  return gltfCache.get(url);
}
// A fresh, arena-ready copy of a model: normalised to its height, toon-lit, with its clips resolved by role.
function prepareModel(gltf, spec) {
  // Measure the original once: a fresh skinned clone reports bounds from an unposed skeleton.
  if (!gltf.userData.fit) {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    gltf.userData.fit = { minY: box.min.y, h: box.getSize(new THREE.Vector3()).y };
  }
  const fit = gltf.userData.fit;
  const obj = cloneSkinned(gltf.scene);
  const k = (spec.height || 5.5) / Math.max(0.001, fit.h);
  obj.scale.setScalar(k);
  obj.position.y = -fit.minY * k + (spec.hover || 0);
  obj.rotation.y = spec.rotY || 0;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const src = o.material;
    // Re-light the model with the same toon ramp as everything else, keeping its colours/textures.
    const paint = spec.paint?.[src.name];
    o.material = toon(paint ? new THREE.Color(paint) : src.color ? src.color.clone() : 0xffffff, { map: src.map || null, vertexColors: !!src.vertexColors, transparent: !!src.transparent, opacity: src.opacity ?? 1 });
    o.material.name = src.name || ""; // so accessories can borrow a part's material (the Taxman's nose wears his skin)
    if (spec.tint) o.material.color.lerp(new THREE.Color(spec.tint), 0.35);
  });
  const mixer = new THREE.AnimationMixer(obj), clips = {};
  // Clips are named "CharacterArmature|Idle" and so on; match each role against its list of candidates.
  const byName = new Map(gltf.animations.map((a) => [a.name.replace(/^.*\|/, "").toLowerCase(), a]));
  for (const [role, names] of Object.entries(spec.clips || {})) {
    const clip = names.map((n) => byName.get(n.toLowerCase())).find(Boolean);
    if (clip) clips[role] = mixer.clipAction(clip);
  }
  if (spec.taxman) dressTaxman(obj, byName.get("punch_right"));
  return { obj, mixer, clips, k };
}
// The Business Man model gets the Taxman's top hat, monocle and big nose (in the model's own skin), and his right hand
// closes into a fist round the neck of a sack of your money. punch: the model's Punch_Right clip, which holds a fist
// the whole way through; that pose is held on his fingers every frame. obj.userData.tick() keeps the sack in the fist
// and hanging under it: call it after each mixer update.
function dressTaxman(obj, punch) {
  const bones = [];
  obj.traverse((o) => { if (o.isBone) bones.push(o); });
  const find = (...res) => bones.find((b) => res.some((re) => re.test(b.name)));
  const head = find(/^head$/i, /head/i), hand = find(/fist.?r$/i, /hand.?r$/i, /wrist.?r$/i, /lowerarm.?r$/i);
  let skin = null;
  obj.traverse((o) => { if (o.isMesh && /skin/i.test(o.material?.name || "")) skin = o.material; });
  // Bones carry their own scale and rotation; undo both so accessories are sized in arena units and line up with the
  // model (whichever way the model itself is turned).
  obj.updateMatrixWorld(true);
  const pin = (bone, group) => {
    const ws = bone.getWorldScale(new THREE.Vector3()).x;
    group.scale.setScalar(1 / ws);
    group.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(obj.getWorldQuaternion(new THREE.Quaternion())));
    bone.add(group);
  };
  if (head) {
    const hat = new THREE.Group();
    const dark = toon(0x1f2a24), red = toon(0xd9483b), gold = toon(0xf2b51d, { emissive: 0x221100 });
    const brim = outlined(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 28), dark); hat.add(brim);
    const crown = outlined(new THREE.CylinderGeometry(0.38, 0.41, 0.7, 24), dark); crown.position.y = 0.38; hat.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.415, 0.42, 0.12, 24), red); band.position.y = 0.1; hat.add(band);
    hat.position.set(0, 0.62, 0); hat.rotation.z = -0.08;
    const mono = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 8, 20), gold); mono.position.set(0.13, 0.37, 0.5);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4), gold); chain.position.set(0.22, 0.18, 0.47); chain.rotation.z = 0.4;
    // The nose starts between his eyes and sits on the face, tipped down a touch.
    const nose = taxNose(skin || toon(0xe8c4a0), 1.35); nose.position.set(0, 0.41, 0.47); nose.rotation.x = 0.12;
    const wrap = new THREE.Group(), inner = new THREE.Group(); inner.add(hat, mono, chain, nose); inner.scale.setScalar(0.75); wrap.add(inner);
    pin(head, wrap);
  }
  if (!hand) return;
  const fist = [];
  for (const tr of punch?.tracks || []) {
    const dot = tr.name.lastIndexOf("."), b = bones.find((x) => x.name === tr.name.slice(0, dot));
    if (b && tr.name.slice(dot + 1) === "quaternion" && /^(index|middle|ring|pinky|thumb)\d.?r$/i.test(b.name)) fist.push([b, new THREE.Quaternion().fromArray(tr.values, 0)]);
  }
  const grip = bones.filter((b) => /^(index2|middle2|ring2|thumb2).?r$/i.test(b.name));
  const R = 0.36, sack = moneySack(R), len = 2.25 * R;
  hand.add(sack);
  const at = new THREE.Vector3(), tmp = new THREE.Vector3(), out = new THREE.Vector3(), axis = new THREE.Vector3(), ws = new THREE.Vector3();
  const face = new THREE.Quaternion(), hq = new THREE.Quaternion(), lay = new THREE.Quaternion(), sway = new THREE.Quaternion();
  let last = null, ang = 0, vel = 0;
  obj.userData.tick = (dt = 0) => {
    for (const [b, q] of fist) b.quaternion.copy(q);
    obj.updateWorldMatrix(true, true);
    // The neck sits in the middle of the closed fingers.
    at.set(0, 0, 0);
    if (grip.length) { for (const b of grip) at.add(b.getWorldPosition(tmp)); at.divideScalar(grip.length); } else hand.getWorldPosition(at);
    // A little swing when his hand moves (a damped pendulum, pushed by the hand's sideways speed).
    obj.getWorldQuaternion(face);
    if (last && dt > 0) {
      const push = tmp.subVectors(at, last).applyQuaternion(face.clone().invert()).x / dt;
      vel += (-ang * 60 - vel * 7 - push * 3) * dt; ang = Math.max(-0.7, Math.min(0.7, ang + vel * dt));
    }
    last = (last || new THREE.Vector3()).copy(at);
    // Straight down in the world, label facing the way he faces. Near the floor (knocked down) it lies out flat,
    // away from his body, instead of sinking through.
    const ground = obj.parent ? obj.parent.getWorldPosition(tmp).y : 0, h = at.y - ground;
    lay.identity();
    if (h < len) {
      out.subVectors(at, obj.getWorldPosition(tmp)).setY(0);
      if (out.lengthSq() > 1e-6) { axis.crossVectors(new THREE.Vector3(0, 1, 0), out.normalize()).normalize(); lay.setFromAxisAngle(axis, -Math.acos(Math.max(0, h) / len)); }
    }
    sway.setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang);
    sack.position.copy(hand.worldToLocal(at.clone()));
    sack.quaternion.copy(hand.getWorldQuaternion(hq).invert().multiply(lay).multiply(face).multiply(sway));
    sack.scale.setScalar(1 / hand.getWorldScale(ws).x);
  };
  obj.userData.tick();
}

// ---------- menu portraits ----------
// Renders a boss or a walker once into a transparent PNG, so menus use the same 3D art as the battles.
// One shared offscreen renderer, one render at a time; results are cached for the session.
let pRenderer = null, pQueue = Promise.resolve();
const pCache = new Map();
// What a walker is wearing (wardrobe colours, equipped gear and skin), so a change of outfit renders a fresh portrait.
const wearKey = (a) => (a ? ["_suit", "_band", "_weapon", "_armour", "_trinket"].map((k) => a[k] || "").join(",") + "," + (a._skin?.id || (typeof a._skin === "string" ? a._skin : "")) : "");
function portrait(kind, id, answers, { w = 256, h = 256, frame = "full" } = {}) {
  const key = `${kind}:${id}:${w}x${h}:${frame}${kind === "walker" ? ":" + wearKey(answers) : ""}`;
  if (pCache.has(key)) return pCache.get(key);
  const job = pQueue.then(async () => {
    if (!pRenderer) {
      pRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      pRenderer.setPixelRatio(2);
      pRenderer.outputColorSpace = THREE.SRGBColorSpace;
      pRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      pRenderer.toneMappingExposure = 1.3;
    }
    pRenderer.setSize(w, h, false);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x24305a, 1.5));
    const key1 = new THREE.DirectionalLight(0xffffff, 2.2); key1.position.set(-3, 6, 8); scene.add(key1);
    const rim = new THREE.DirectionalLight(0x8fc3ff, 1.6); rim.position.set(4, 3, -6); scene.add(rim);
    let obj, height, known = null, dispose = () => {};
    if (kind === "walker") {
      const wk = buildWalker ? buildWalker(THREE, answers || {}, { detail: 2, shadow: false }) : simpleWalker(answers);
      wk.group.rotation.y = Math.PI + 0.35; // face the camera, three-quarter turn
      wk.update(0.4);
      obj = wk.group; height = wk.height || 1.6; dispose = () => wk.dispose?.();
    } else {
      const spec = MODELS[id];
      if (spec) {
        const m = prepareModel(await loadGltf(spec.url), spec);
        m.clips.idle?.play(); m.mixer.update(0.45);
        obj = m.obj; height = spec.height || 5.5;
        obj.rotation.y = (spec.rotY || 0) - 0.35;
        obj.userData.tick?.();
        // Skinned meshes report bounds from an unposed skeleton, so frame from the size we normalised to.
        const hv = spec.hover || 0;
        known = new THREE.Box3(new THREE.Vector3(-height * 0.42, hv, -height * 0.3), new THREE.Vector3(height * 0.42, hv + height, height * 0.3));
      } else {
        const b = (BUILT_IN[id] || BUILT_IN.algorithm)();
        obj = b.root; height = b.height; obj.rotation.y = -0.35;
      }
    }
    scene.add(obj);
    obj.updateMatrixWorld(true);
    const box = known || new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    // "head" frames the top of the character (avatars); "full" fits the whole body.
    const fitH = frame === "head" ? size.y * 0.62 : size.y * 1.08;
    const cy = frame === "head" ? box.max.y - fitH * 0.48 : centre.y;
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 200);
    const dist = (fitH / 2) / Math.tan((cam.fov * Math.PI) / 360) * Math.max(1, (size.x / size.y) * (h / w) * 0.9);
    cam.position.set(centre.x, cy + fitH * 0.08, centre.z + dist);
    cam.lookAt(centre.x, cy, centre.z);
    pRenderer.clear();
    pRenderer.render(scene, cam);
    const url = pRenderer.domElement.toDataURL("image/png");
    dispose(); // model clones share geometry with the cached original, so only walkers free theirs
    return url;
  }).catch(() => "");
  pQueue = job;
  pCache.set(key, job);
  return job;
}

// ---------- store preview ----------
// A small live turntable for the skin store: the ninja turning slowly, idling, swinging every few seconds and, in a
// House skin, doing its victory dance, with its trail and aura running. Drag it to turn it yourself (it keeps a
// little momentum, then goes back to spinning on its own). setLook(answers) swaps the skin in place with a quick
// pop, so switching never rebuilds the canvas. It has its own WebGL context (freed by dispose()), draws only while
// on screen, and step(dt) moves it on by hand (tests, or a pane that never paints).
//   const p = Arena3D.preview(host, answers, { spin: 0.45, every: 2.6, detail: 1.5, fx: 1, autoplay: true });
//   p.setLook(otherAnswers);  p.dispose();
function preview(host, answers, opts = {}) {
  const none = { ok: false, walker: null, canvas: null, step() {}, play() {}, setLook() {}, dispose() {} };
  if (!buildWalker || !host) return none;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); } catch { return none; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const cv = renderer.domElement;
  cv.className = "arena3d-preview"; cv.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab";
  host.appendChild(cv);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x24305a, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-3, 6, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fc3ff, 1.5); rim.position.set(4, 3, -6); scene.add(rim);
  const make = (a) => buildWalker(THREE, a || {}, { detail: opts.detail ?? 1.5, fx: (opts.fx ?? 1) * (PHONE ? 0.8 : 1) });
  let w = make(answers);
  scene.add(w.group);
  let yaw = Math.PI + 0.5; // three-quarters on to start
  w.group.rotation.y = yaw;
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50), shot = { y: 1, z: 4, look: 0.7 }, want = { y: 1, z: 4, look: 0.7 };
  const fit = (snap = true) => {
    const r = host.getBoundingClientRect(), W = Math.max(1, r.width), H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    cam.aspect = W / H;
    // Room for a crown overhead and an aura either side.
    const top = (w.height || 1.5) + (w.skinFx?.crown ? 0.4 : 0.15), halfW = w.skinFx?.aura ? 0.9 : 0.72, cy = top / 2;
    const tn = Math.tan((cam.fov * Math.PI) / 360);
    Object.assign(want, { y: cy + 0.3, z: Math.max((top * 0.56) / tn, halfW / (tn * cam.aspect)), look: cy - 0.02 });
    if (snap) Object.assign(shot, want);
    cam.updateProjectionMatrix();
  };
  // The camera eases after the body, so a lunge stays in frame and its trail streams out behind it.
  let body = w.group.getObjectByName("mover") || w.group;
  const follow = new THREE.Vector3(), bodyAt = new THREE.Vector3();
  const aim = (dt) => {
    const k = Math.min(1, dt * 6);
    for (const key2 of ["y", "z", "look"]) shot[key2] += (want[key2] - shot[key2]) * k;
    body.getWorldPosition(bodyAt);
    follow.x += (bodyAt.x - follow.x) * Math.min(1, dt * 7); follow.z += (bodyAt.z - follow.z) * Math.min(1, dt * 7);
    cam.position.set(follow.x, shot.y, shot.z + follow.z); cam.lookAt(follow.x, shot.look, follow.z);
  };
  // The show, on repeat: idle, a swing, a big swing, then a third swing or (House) the dance.
  const every = opts.every ?? 2.6, spin = (opts.spin ?? 0.45) * (CALM ? 0.4 : 1);
  let show, cycle;
  const program = () => {
    const dance = !!w.skinFx?.dance;
    show = dance ? [[every, "attack"], [every * 2, "big"], [every * 3, "cheer"], [every * 3 + 3.4, "idle"]] : [[every, "attack"], [every * 2, "big"], [every * 3, "attack"]];
    cycle = dance ? every * 3 + 4.2 : every * 3.4;
  };
  program();
  let t = 0, raf = 0, last = 0, onScreen = true, gone = false;
  // Turning by hand: drag sideways; let go and it keeps a little momentum, then the spin eases back in.
  let dragging = false, lastX = 0, lastT = 0, vel = 0, idle = 99, pop = 1, old = null;
  const down = (e) => { dragging = true; lastX = e.clientX; lastT = performance.now(); vel = 0; cv.style.cursor = "grabbing"; cv.setPointerCapture?.(e.pointerId); };
  const move = (e) => {
    if (!dragging) return;
    const now = performance.now(), dx = e.clientX - lastX, dt = Math.max(16, now - lastT) / 1000;
    // Smoothed and capped, so one jumpy event can't fling it round twenty times.
    yaw += dx * 0.011; vel = Math.max(-7, Math.min(7, vel * 0.6 + ((dx * 0.011) / dt) * 0.4)); lastX = e.clientX; lastT = now; idle = 0;
  };
  const up = () => { if (!dragging) return; dragging = false; cv.style.cursor = "grab"; if (performance.now() - lastT > 80) vel = 0; };
  cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move);
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up); cv.addEventListener("lostpointercapture", up);
  function step(dt) {
    if (gone) return;
    const prev = t % cycle; t += dt; const now = t % cycle;
    if (opts.autoplay !== false) for (const [at, name] of show) if (now >= prev ? prev < at && at <= now : at > prev || at <= now) w.play(name);
    if (!dragging) {
      idle += dt;
      yaw += vel * dt; vel *= Math.pow(0.04, dt); // momentum dies away in about a second
      yaw += dt * spin * Math.min(1, Math.max(0, (idle - 1.5) / 1.5)); // and the spin comes back after a pause
    }
    w.group.rotation.y = yaw;
    // A new skin pops in: the old one shrinks away as the new one springs up.
    if (pop < 1) {
      pop = Math.min(1, pop + dt / 0.32);
      const back = 1 + 2.2 * (pop - 1) ** 3 + 1.2 * (pop - 1) ** 2; // ease-out-back
      w.group.scale.setScalar(Math.max(0.01, back));
      if (old) { const k = Math.max(0, 1 - pop * 2.2); old.group.scale.setScalar(Math.max(0.01, k)); old.group.rotation.y = yaw; old.update(dt); if (k <= 0) { scene.remove(old.group); old.dispose(); old = null; } }
    }
    w.update(dt);
    aim(dt);
    renderer.render(scene, cam);
  }
  function frame(ms) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (ms - last) / 1000) : 0; last = ms;
    if (onScreen && !document.hidden) step(dt);
  }
  fit(); step(0);
  raf = requestAnimationFrame(frame);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (!gone) { fit(); aim(0); renderer.render(scene, cam); } }) : null;
  ro?.observe(host);
  const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; }) : null;
  io?.observe(host);
  return {
    ok: true, canvas: cv,
    step: (dt = 1 / 60) => step(dt),
    play: (name) => w.play(name),
    get walker() { return w; },
    // Swap to another look in the same canvas: same angle, a quick pop, the framing eases to fit.
    setLook(a) {
      if (gone) return;
      if (old) { scene.remove(old.group); old.dispose(); }
      old = w;
      w = make(a);
      w.group.rotation.y = yaw; w.group.scale.setScalar(0.01);
      scene.add(w.group);
      body = w.group.getObjectByName("mover") || w.group;
      program(); t = 0; pop = 0;
      fit(false);
      if (w.skinFx?.burst) try { w.skinFx.burst("spark", 18); } catch { /* not every skin bursts */ }
    },
    dispose() {
      if (gone) return;
      gone = true;
      cancelAnimationFrame(raf); ro?.disconnect(); io?.disconnect();
      if (old) old.dispose();
      w.dispose(); // its geometry, materials, textures and trails
      renderer.dispose();
      renderer.forceContextLoss(); // browsers cap live WebGL contexts
      cv.remove();
    },
  };
}

// Effects make their own materials; shared geometry, textures and materials are flagged "keep" and survive the effect.
function freeObj(o) {
  o?.traverse?.((x) => {
    if (x.geometry && !x.geometry.userData.keep) x.geometry.dispose();
    for (const m of [].concat(x.material || [])) if (m !== OUTLINE && !m.userData.keep) { if (m.map && !m.map.userData.keep) m.map.dispose(); m.dispose(); }
  });
}

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

// ---------- look and feel ----------
const PHONE = (() => { try { return matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 700; } catch { return false; } })();
const CALM = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
// Effect colours are pushed past white so that they, and not the lit scenery, catch the bloom.
const hdr = (c, k = 2.6) => new THREE.Color(c).multiplyScalar(k);
const keep = (x) => { x.userData.keep = true; return x; };
const GEO = {};
const geo = (name, make) => GEO[name] || (GEO[name] = keep(make()));
const ease = (k) => 1 - (1 - k) ** 3;
const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const rnd = (a, b) => a + Math.random() * (b - a);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const heroScale = (v) => Math.max(0.5, Math.min(2, Number(v) || 1));

// Each boss fights somewhere different: rim light, fog, sky, floor, ring, ambient motes and its attack colours.
// mote: c1/c2 colours, size, rise (up), drift (sideways), wob (wander), flick (twinkle).
const PALETTES = {
  default: { rim: 0x7fb2ff, fog: 0x070d1c, ring: 0x6fb6ff, atk: 0xff3b3b, sky: ["#060a1d", "#1d2a66", "#4a3f8f", "#0a0f26"], win: "rgba(120,190,255,.75)", floor: [44, 60, 112], stone: 0x2b3456, hemi: [0xbcd4ff, 0x101830],
    mote: { c1: 0x9fd0ff, c2: 0xffffff, size: 0.09, rise: 0.4, drift: 0.05, wob: 0.25, flick: 0.3 }, lift: [0.02, 0.03, 0.07], gain: [1.0, 1.0, 1.04] },
  notification: { rim: 0xff5fa2, fog: 0x15060f, ring: 0xff4f9a, atk: 0xff3d7f, sky: ["#12040d", "#3a0f2e", "#7a2257", "#12040d"], win: "rgba(255,120,190,.75)", floor: [96, 40, 80], stone: 0x4a1f3d, hemi: [0xffd6ea, 0x2a0f22],
    mote: { c1: 0xff6fb0, c2: 0xffd0e6, size: 0.11, rise: 0.35, drift: 0.04, wob: 0.35, flick: 0.7 }, lift: [0.06, 0.01, 0.04], gain: [1.05, 0.98, 1.0] },
  autoplay: { rim: 0xff8a3d, fog: 0x120b04, ring: 0xffa13d, atk: 0xff7a2f, sky: ["#0b0803", "#2d1d08", "#6a4012", "#0b0803"], win: "rgba(255,190,90,.7)", floor: [74, 64, 30], stone: 0x3b3418, hemi: [0xffe6c0, 0x1e1608],
    mote: { c1: 0xffc24a, c2: 0xb8ff5a, size: 0.13, rise: 0.16, drift: 0.12, wob: 0.7, flick: 0.2 }, lift: [0.05, 0.035, 0.0], gain: [1.05, 1.0, 0.92] },
  leftonread: { rim: 0xc8d4ff, fog: 0x080a18, ring: 0xaab8ff, atk: 0xb9c8ff, sky: ["#04050f", "#151a3d", "#3a3f72", "#05060f"], win: "rgba(200,210,255,.6)", floor: [48, 52, 86], stone: 0x2a2e4a, hemi: [0xdfe6ff, 0x0e1020],
    mote: { c1: 0xdfe6ff, c2: 0x9fb0ff, size: 0.17, rise: 0.1, drift: 0.32, wob: 0.5, flick: 0.6 }, lift: [0.02, 0.03, 0.07], gain: [0.95, 1.0, 1.08] },
  scroll: { rim: 0x6ff3ff, fog: 0x031417, ring: 0x5fe8ff, atk: 0x7ff0ff, sky: ["#020c10", "#08343d", "#1a6b73", "#020c10"], win: "rgba(130,250,255,.7)", floor: [34, 80, 88], stone: 0x1d3f45, hemi: [0xd0fbff, 0x08181b],
    mote: { c1: 0xaef9ff, c2: 0xffffff, size: 0.08, rise: 0.05, drift: 2.4, wob: 0.15, flick: 0.2 }, lift: [0.0, 0.04, 0.05], gain: [0.96, 1.02, 1.04] },
  kraken: { rim: 0x9b5cff, fog: 0x05061a, ring: 0x7a5cff, atk: 0x9b5cff, sky: ["#02030d", "#0d1240", "#2a1f6e", "#02030d"], win: "rgba(150,140,255,.65)", floor: [42, 40, 98], stone: 0x26224d, hemi: [0xcfc6ff, 0x0a0a24],
    mote: { c1: 0x8fd8ff, c2: 0xc9a6ff, size: 0.13, rise: 0.7, drift: 0.03, wob: 0.45, flick: 0.1 }, lift: [0.03, 0.02, 0.08], gain: [0.98, 0.98, 1.06] },
  algorithm: { rim: 0x4f8bff, fog: 0x050818, ring: 0x3d7bff, atk: 0xff4d3d, sky: ["#03050f", "#0c1a4a", "#2a3a8f", "#03050f"], win: "rgba(110,170,255,.8)", floor: [38, 52, 110], stone: 0x22305a, hemi: [0xbcd4ff, 0x0c1430],
    mote: { c1: 0x7fb2ff, c2: 0xff7a3d, size: 0.09, rise: 0.5, drift: 0.05, wob: 0.2, flick: 0.5 }, lift: [0.01, 0.025, 0.07], gain: [1.04, 1.0, 1.0] },
  dragon: { rim: 0xff6a1a, fog: 0x140503, ring: 0xff7a1a, atk: 0xff4d1a, sky: ["#0a0302", "#3a0d05", "#8a2a0a", "#0a0302"], win: "rgba(255,160,80,.75)", floor: [88, 46, 34], stone: 0x45201a, hemi: [0xffdcc4, 0x200a06],
    mote: { c1: 0xffb35a, c2: 0xff5a1a, size: 0.09, rise: 1.1, drift: 0.12, wob: 0.3, flick: 0.85 }, lift: [0.06, 0.02, 0.0], gain: [1.06, 0.98, 0.9] },
  taxman: { rim: 0xffd166, fog: 0x0b150f, ring: 0xffd166, atk: 0xff3b3b, sky: ["#081410", "#173a2a", "#2f6046", "#0b150f"], win: "rgba(255,214,120,.75)", floor: [52, 92, 66], stone: 0x2c4434, hemi: [0xd8ffe0, 0x203018],
    mote: { c1: 0xffe08a, c2: 0xfff4c0, size: 0.09, rise: 0.4, drift: 0.05, wob: 0.25, flick: 0.4 }, lift: [0.02, 0.04, 0.02], gain: [1.04, 1.02, 0.96] },
};
// Event bosses wear an existing boss's model, so they take that boss's place too.
const EVENT_LOOK = { "ev-newyear": "notification", "ev-spring": "autoplay", "ev-solstice": "dragon", "ev-harvest": "algorithm" };
function paletteFor(def, mode) {
  if (mode === "tax") return PALETTES.taxman;
  const id = String(def?.model || def?.id || "");
  return PALETTES[id] || PALETTES[EVENT_LOOK[id]] || PALETTES.default;
}

// ---------- post-processing ----------
// Loaded on first use and in the background: the arena draws plainly until it arrives, or for good if it can't.
let postMods = null;
function loadPost() {
  return postMods || (postMods = Promise.all([
    import("three/addons/postprocessing/EffectComposer.js"),
    import("three/addons/postprocessing/RenderPass.js"),
    import("three/addons/postprocessing/UnrealBloomPass.js"),
    import("three/addons/postprocessing/ShaderPass.js"),
  ]).then(([a, b, c, d]) => ({ EffectComposer: a.EffectComposer, RenderPass: b.RenderPass, UnrealBloomPass: c.UnrealBloomPass, ShaderPass: d.ShaderPass }))
    .catch((err) => { console.warn("Arena post-processing unavailable", err); return null; }));
}
// Final pass: ACES tone map, a split-tone grade (tinted shadows, warmed or cooled highlights), saturation, contrast, vignette.
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uExposure: { value: 1.3 }, uLift: { value: V3() }, uGain: { value: V3(1, 1, 1) }, uSat: { value: 1.1 }, uContrast: { value: 1.05 }, uVig: { value: 0.4 }, uFlash: { value: V3() } },
  vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uExposure, uSat, uContrast, uVig; uniform vec3 uLift, uGain, uFlash;
    varying vec2 vUv;
    vec3 aces(vec3 c) {
      const mat3 I = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
      const mat3 O = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
      c = I * (c * uExposure / 0.6);
      c = (c * (c + 0.0245786) - 0.000090537) / (c * (0.983729 * c + 0.4329510) + 0.238081);
      return clamp(O * c, 0.0, 1.0);
    }
    vec3 srgb(vec3 c) { return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
    void main() {
      vec4 t = texture2D(tDiffuse, vUv);
      vec3 c = aces(max(t.rgb, 0.0));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max(mix(vec3(l), c, uSat), 0.0);
      c = c * mix(vec3(1.0), uGain, smoothstep(0.15, 0.85, l)) + uLift * (1.0 - l) * clamp(t.a, 0.0, 1.0);
      c = srgb(clamp(c, 0.0, 1.0));
      c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
      float a = clamp(max(t.a, max(c.r, max(c.g, c.b))), 0.0, 1.0);
      float v = smoothstep(0.55, 1.2, length(vUv - 0.5) * 1.414) * uVig;
      c = c * (1.0 - v); c += uFlash * (1.0 - c); // screen flash, after the bloom so it never blows out
      gl_FragColor = vec4(c, max(max(a, v), max(uFlash.r, max(uFlash.g, uFlash.b))));
    }`,
};

// ---------- particles ----------
// One pooled, GPU-animated particle system per blend mode. Each particle is a camera-facing quad whose motion
// (velocity, drag, gravity) is solved in the vertex shader from its birth time, so the CPU only writes on spawn.
// Shapes: 0 soft glow, 1 spark (stretched along its motion), 2 ring, 3 star flare. Old particles are recycled.
const PVERT = `
  attribute vec3 aPos; attribute vec3 aVel; attribute vec4 aCol; attribute vec4 aLife; attribute vec4 aMisc;
  uniform float uTime;
  varying vec2 vUv; varying vec4 vCol; varying float vA; varying float vShape;
  void main() {
    float age = uTime - aLife.x, k = age / aLife.y;
    vUv = position.xy + 0.5; vCol = aCol; vShape = aMisc.w; vA = 0.0;
    if (age < 0.0 || k >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    float d = aMisc.x, e = d > 0.0 ? exp(-d * age) : 1.0, ft = d > 0.0 ? (1.0 - e) / d : age;
    vec3 p = aPos + aVel * ft; p.y -= 0.5 * aLife.w * age * age;
    vec3 vel = aVel * e; vel.y -= aLife.w * age;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = aLife.z * mix(1.0, aMisc.z, k);
    vec2 off = position.xy * size;
    if (aMisc.y > 0.0) {
      vec2 v = (modelViewMatrix * vec4(vel, 0.0)).xy; float L = length(v);
      if (L > 0.001) { vec2 dir = v / L; off = dir * position.y * (size + L * aMisc.y) + vec2(-dir.y, dir.x) * position.x * size * 0.5; }
    }
    mv.xy += off;
    gl_Position = projectionMatrix * mv;
    vA = min(1.0, age * 30.0) * (1.0 - k) * (1.0 - 0.4 * k);
  }`;
const PFRAG = `
  uniform float uAlpha, uGain;
  varying vec2 vUv; varying vec4 vCol; varying float vA; varying float vShape;
  void main() {
    vec2 p = vUv * 2.0 - 1.0; float d = length(p);
    if (d >= 1.0 || vA <= 0.0) discard;
    float a;
    if (vShape < 0.5) a = (1.0 - d) * (1.0 - d);
    else if (vShape < 1.5) a = pow(1.0 - d, 1.4);
    else if (vShape < 2.5) a = smoothstep(0.22, 0.0, abs(d - 0.74)) + 0.1 * (1.0 - d);
    else { float s = max(1.0 - smoothstep(0.0, 0.12, abs(p.x)), 1.0 - smoothstep(0.0, 0.12, abs(p.y))); a = s * (1.0 - d) * 1.5 + pow(1.0 - d, 3.0); }
    a *= vA;
    vec3 c = (vCol.rgb + smoothstep(0.45, 0.0, d) * vCol.a * 2.0) * a * uGain;
    gl_FragColor = vec4(c, a) * uAlpha;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
class Pool {
  constructor(max, additive) {
    this.max = max; this.i = 0; this.time = 0; this.lo = Infinity; this.hi = -1; this.wrapped = false;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    this.a = { aPos: mk(3), aVel: mk(3), aCol: mk(4), aLife: mk(4), aMisc: mk(4) };
    for (let i = 0; i < max; i++) { this.a.aLife.array[i * 4] = -1e6; this.a.aLife.array[i * 4 + 1] = 1; }
    for (const [k, v] of Object.entries(this.a)) g.setAttribute(k, v);
    g.instanceCount = max;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAlpha: { value: additive ? 1 : 0.75 }, uGain: { value: 1 } }, vertexShader: PVERT, fragmentShader: PFRAG,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 20 : 15;
  }
  // o: x,y,z, vx,vy,vz, c (Color), life, size, shape, grav, drag, stretch, end (size at death, x start size), core, delay
  emit(o) {
    const i = this.i, A = this.a;
    this.i = (i + 1) % this.max; if (this.i === 0) this.wrapped = true;
    A.aPos.array.set([o.x, o.y, o.z], i * 3);
    A.aVel.array.set([o.vx || 0, o.vy || 0, o.vz || 0], i * 3);
    A.aCol.array.set([o.c.r, o.c.g, o.c.b, o.core ?? 0.5], i * 4);
    A.aLife.array.set([this.time + (o.delay || 0), o.life || 0.5, o.size || 0.1, o.grav || 0], i * 4);
    A.aMisc.array.set([o.drag || 0, o.stretch || 0, o.end ?? 1, o.shape || 0], i * 4);
    if (i < this.lo) this.lo = i; if (i > this.hi) this.hi = i;
  }
  flush() {
    this.mat.uniforms.uTime.value = this.time;
    if (this.hi < 0) return;
    for (const a of Object.values(this.a)) {
      a.clearUpdateRanges();
      if (!this.wrapped) a.addUpdateRange(this.lo * a.itemSize, (this.hi - this.lo + 1) * a.itemSize);
      a.needsUpdate = true;
    }
    this.lo = Infinity; this.hi = -1; this.wrapped = false;
  }
}
// Ambient motes (embers, spores, bubbles, wisps): a fixed cloud animated entirely on the GPU.
const MVERT = `
  attribute float aSeed;
  uniform float uTime, uRise, uDrift, uWob, uSize, uScale, uFlick, uBoost; uniform vec3 uC1, uC2;
  varying float vA; varying vec3 vC;
  void main() {
    vec3 p = position; float s = 0.6 + aSeed * 0.8;
    p.y = mod(p.y + uTime * uRise * s, 9.0);
    p.x = mod(p.x + 12.0 + uTime * uDrift * s, 24.0) - 12.0;
    p.x += sin(uTime * 0.7 + aSeed * 40.0) * uWob; p.z += cos(uTime * 0.5 + aSeed * 31.0) * uWob * 0.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * s * uScale / max(0.5, -mv.z);
    float fl = 1.0 - uFlick * (0.5 + 0.5 * sin(uTime * (3.0 + aSeed * 5.0) + aSeed * 20.0));
    vA = smoothstep(0.0, 0.8, p.y) * smoothstep(9.0, 7.0, p.y) * fl;
    vC = mix(uC1, uC2, step(0.72, aSeed)) * uBoost;
    gl_Position = projectionMatrix * mv;
  }`;
const MFRAG = `
  varying float vA; varying vec3 vC;
  void main() {
    float d = length(gl_PointCoord * 2.0 - 1.0); if (d >= 1.0) discard;
    float a = (1.0 - d) * (1.0 - d) * vA;
    gl_FragColor = vec4(vC * a, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
function makeMotes(n, mote) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set([(Math.random() - 0.5) * 24, Math.random() * 9, -12 + Math.random() * 18], i * 3); seed[i] = Math.random(); }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uRise: { value: mote.rise }, uDrift: { value: mote.drift }, uWob: { value: mote.wob }, uSize: { value: mote.size }, uScale: { value: 600 },
      uFlick: { value: mote.flick }, uBoost: { value: 1.6 }, uC1: { value: new THREE.Color(mote.c1) }, uC2: { value: new THREE.Color(mote.c2) } },
    vertexShader: MVERT, fragmentShader: MFRAG, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5;
  return pts;
}
// Soft round glow for projectile heads (sprites), and one cached sprite material per colour.
let glowTex = null;
function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,.75)"); g.addColorStop(0.6, "rgba(255,255,255,.18)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (glowTex = keep(new THREE.CanvasTexture(c)));
}
const spriteMats = new Map();
function spriteMat(color, k = 3) {
  const key = `${color}:${k}`;
  if (!spriteMats.has(key)) spriteMats.set(key, keep(new THREE.SpriteMaterial({ map: glow(), color: hdr(color, k), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })));
  return spriteMats.get(key);
}
// Rings that read on a small screen: a bright band with a soft glow and a faint fill, kept a constant world width.
const RVERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const RFRAG = `
  uniform vec3 uCol; uniform float uOp, uW; varying vec2 vUv;
  void main() {
    float d = length(vUv * 2.0 - 1.0); if (d >= 1.0) discard;
    float r = smoothstep(uW, 0.0, abs(d - 0.86));
    float a = (r * 0.7 + r * r * 0.6 + smoothstep(0.86, 0.0, d) * 0.1) * uOp;
    gl_FragColor = vec4(uCol * a + vec3(r * r * r) * a, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const ringMat = (color, k = 2.4) => new THREE.ShaderMaterial({
  uniforms: { uCol: { value: hdr(color, k) }, uOp: { value: 1 }, uW: { value: 0.1 } }, vertexShader: RVERT, fragmentShader: RFRAG,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
});
// Dissolve for the K.O.: boss materials get a world-space noise cut-off with a glowing edge (inert until it starts).
const DNOISE = `
  float dHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float dNoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dHash(i), dHash(i + vec3(1, 0, 0)), f.x), mix(dHash(i + vec3(0, 1, 0)), dHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(dHash(i + vec3(0, 0, 1)), dHash(i + vec3(1, 0, 1)), f.x), mix(dHash(i + vec3(0, 1, 1)), dHash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`;
function patchDissolve(m, U) {
  if (m.userData.dissolve || m.isShaderMaterial) return;
  m.userData.dissolve = true;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uDis: U.dis, uDisH: U.h, uDisBase: U.base, uDisEdge: U.edge });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vDisP;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvDisP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vDisP; uniform float uDis, uDisH, uDisBase; uniform vec3 uDisEdge;\n${DNOISE}`)
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nfloat disN = 1.0;\nif (uDis > 0.0) { disN = 0.6 * dNoise(vDisP * 2.3) + 0.4 * (1.0 - clamp((vDisP.y - uDisBase) / uDisH, 0.0, 1.0)); if (disN < uDis) discard; }")
      .replace("#include <opaque_fragment>", "#include <opaque_fragment>\nif (uDis > 0.0) gl_FragColor.rgb += uDisEdge * (1.0 - smoothstep(0.0, 0.08, disN - uDis));");
  };
  m.customProgramCacheKey = () => "dissolve1";
  m.needsUpdate = true;
}

// ---------- the arena ----------
class Arena {
  constructor(host, opts) {
    this.host = host; this.mode = opts.mode;
    this.pal = paletteFor(opts.boss, opts.mode);
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
    this.scene.fog = new THREE.Fog(this.pal.fog, 18, 40);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    this.scene.add(this.camera); // the flash overlay rides on it
    this.camBase = opts.mode === "tax" ? V3(0.7, 2.9, 7.6) : V3(0, 4.0, 9.2);
    this.lookAt = opts.mode === "tax" ? V3(-0.2, 2.5, this.bossZ + 2) : V3(0, 2.9, this.bossZ + 1.5);
    this.baseFov = 48;
    // Time: real time drives the camera and the clock; game time (frozen by hit-stop, slowed on the K.O.) drives everything else.
    this.shakeAmt = 0; this.t = 0; this.realT = 0; this.fx = []; this.heroes = new Map();
    this.freeze = 0; this.slowmo = null; this.punch = 0; this.moves = []; this.camW = 1; this.flashAmt = 0;
    this.fxScale = 1; this.moteT = 0;
    this.sparks = new Pool(PHONE ? 900 : 1400, true); this.dust = new Pool(PHONE ? 220 : 360, false);
    this.scene.add(this.sparks.mesh, this.dust.mesh);
    const fm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
    this.flashMesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), fm);
    this.flashMesh.position.z = -0.2; this.flashMesh.renderOrder = 9999; this.flashMesh.frustumCulled = false; this.flashMesh.visible = false;
    this.camera.add(this.flashMesh);
    this.buildStage(opts);
    this.boss = null;
    this.loadBoss(opts.boss || { id: opts.mode === "tax" ? "taxman" : "algorithm" });
    for (const m of opts.team || []) this.addHero(m);
    this.layout(true);
    this.resize();
    this.onResize = () => this.resize();
    window.addEventListener("resize", this.onResize);
    // Bloom and grading, unless switched off (opts.post === false, or localStorage ef_fx = "lo"); "hi" keeps it on regardless of speed.
    let pref = ""; try { pref = localStorage.getItem("ef_fx") || ""; } catch { /* private mode */ }
    this.postWanted = opts.post !== false && pref !== "lo";
    this.qualityLock = pref === "hi" || opts.post === "force";
    this.perf = { t: 0, samples: [], good: 0, slow: 0, done: false, last: [] };
    if (this.postWanted) loadPost().then((M) => { if (M && !this.disposed && this.postWanted) this.enablePost(M); });
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------- stage ----------
  buildStage(opts) {
    const S = this.scene, P = this.pal;
    this.hemi = new THREE.HemisphereLight(P.hemi[0], P.hemi[1], 1.3); S.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(-4, 9, 7); S.add(sun);
    // A soft key light from behind the camera so the boss's face reads clearly.
    const key = new THREE.DirectionalLight(0xfff4e0, 1.3); key.position.set(2, 5, 12); key.target.position.set(0, 2, this.bossZ); S.add(key, key.target);
    this.rim = new THREE.PointLight(P.rim, 30, 18); this.rim.position.set(0, 4, this.bossZ - 2.5); S.add(this.rim);
    this.danger = new THREE.PointLight(0xff3b3b, 0, 20); this.danger.position.set(0, 3, this.bossZ + 3); S.add(this.danger);
    // Arena floor: flagstones laid in rings, darker towards the edge, in this boss's stone.
    const floorTex = (() => {
      const N = PHONE ? 768 : 1024, c = document.createElement("canvas"); c.width = c.height = N; const x = c.getContext("2d"), s = N / 1024;
      const base = P.floor;
      x.fillStyle = `rgb(${base.map((v) => v * 0.35).join(",")})`; x.fillRect(0, 0, N, N);
      let seed = 7; const rr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let ring = 0; ring < 9; ring++) {
        const r0 = (40 + ring * 54) * s, r1 = r0 + 50 * s, stones = Math.max(6, Math.round((2 * Math.PI * (r0 / s + 25)) / 62));
        for (let i = 0; i < stones; i++) {
          const a0 = (i / stones) * Math.PI * 2 + ring * 0.3, a1 = ((i + 1) / stones) * Math.PI * 2 + ring * 0.3 - 0.035;
          const shade = 0.75 + rr() * 0.35 - ring * 0.045;
          x.fillStyle = `rgb(${base.map((v) => Math.round(v * shade)).join(",")})`;
          x.beginPath(); x.arc(N / 2, N / 2, r1 - 3 * s, a0, a1); x.arc(N / 2, N / 2, r0 + 3 * s, a1, a0, true); x.closePath(); x.fill();
          x.strokeStyle = "rgba(255,255,255,.06)"; x.lineWidth = 2; x.beginPath(); x.arc(N / 2, N / 2, r1 - 5 * s, a0 + 0.01, a1 - 0.01); x.stroke();
        }
      }
      const v = x.createRadialGradient(N / 2, N / 2, N * 0.18, N / 2, N / 2, N / 2);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.75)");
      x.fillStyle = v; x.fillRect(0, 0, N, N);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    })();
    this.floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 96), this.floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.z = -2; S.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 5.85, 96), new THREE.MeshBasicMaterial({ color: hdr(P.ring, 1.8), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.02, this.bossZ); S.add(ring); this.bossRing = ring;
    const glowM = new THREE.Mesh(new THREE.CircleGeometry(5.6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.ring), transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
    glowM.rotation.x = -Math.PI / 2; glowM.position.set(0, 0.015, this.bossZ); S.add(glowM); this.bossGlow = glowM;
    // Backdrop: a city of glowing towers at night, lit in this boss's colours.
    const skyTex = (() => {
      const W = PHONE ? 1536 : 2048, H = W / 4, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"), s = W / 2048;
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, P.sky[0]); g.addColorStop(0.62, P.sky[1]); g.addColorStop(0.78, P.sky[2]); g.addColorStop(1, P.sky[3]);
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      let seed = 3; const rr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + rr() * 0.6})`; x.fillRect(rr() * W, rr() * H * 0.5, 1.5, 1.5); }
      const dark = new THREE.Color(P.sky[1]).multiplyScalar(0.45).getStyle(), darker = new THREE.Color(P.sky[0]).lerp(new THREE.Color(P.sky[1]), 0.35).getStyle();
      for (let layer = 0; layer < 2; layer++) {
        let px = 0;
        while (px < W) {
          const w = (30 + rr() * 70) * s, h = ((layer ? 120 : 70) + rr() * (layer ? 170 : 110)) * s, top = H * 0.8 - h;
          x.fillStyle = layer ? darker : dark;
          x.fillRect(px, top, w, H - top);
          for (let wy = top + 8 * s; wy < H * 0.8 - 6 * s; wy += 9 * s) for (let wx = px + 5 * s; wx < px + w - 5 * s; wx += 8 * s)
            if (rr() < (layer ? 0.22 : 0.12)) { x.fillStyle = rr() < 0.8 ? P.win : "rgba(255,240,200,.8)"; x.fillRect(wx, wy, 3 * s, 4 * s); }
          px += w + rr() * 10 * s;
        }
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
    })();
    this.skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false });
    const sky = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 22, 48, 1, true, Math.PI * 0.55, Math.PI * 0.9), this.skyMat);
    sky.position.set(0, 8.5, -2); S.add(sky);
    // Standing stones around the edge for depth, each with a beacon in the boss's colour.
    const stone = toon(P.stone);
    this.capMat = new THREE.MeshBasicMaterial({ color: hdr(P.ring, 2.2) });
    const capGeo = new THREE.SphereGeometry(0.12, 10, 8);
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * (0.05 + (i / 13) * 0.9) + Math.PI, r = 12 + (i % 3);
      const h = 1.5 + ((i * 37) % 5) * 0.6;
      const p = outlined(new THREE.CylinderGeometry(0.35, 0.55, h, 6), stone, 1.05);
      p.position.set(Math.cos(a) * r, h / 2, -2 + Math.sin(a) * r * 0.9); p.rotation.y = i; S.add(p);
      const cap = new THREE.Mesh(capGeo, this.capMat);
      cap.position.set(p.position.x, h + 0.15, p.position.z); S.add(cap);
    }
    // Ambient motes in the boss's style.
    this.motes = makeMotes(PHONE ? 110 : 170, P.mote); S.add(this.motes);
    // Colours the stage eases towards (phase changes shift them).
    this.look = { rim: new THREE.Color(P.rim), fog: new THREE.Color(P.fog), ring: new THREE.Color(P.ring), tint: new THREE.Color(1, 1, 1), rimI: 30, boost: 1.6, speed: 1, bloom: 0.55, lift: V3(...P.lift), gain: V3(...P.gain), sat: 1.12, vig: 0.4 };
    this.lookTo = null;
    this.phaseN = 1;
  }
  // Phase 2 leans the palette towards violet, phase 3 towards red, all eased in over a second or so.
  setLook(n) {
    const P = this.pal;
    const mix = (c, to, k) => new THREE.Color(c).lerp(new THREE.Color(to), k);
    this.lookTo = {
      rim: n >= 3 ? mix(P.rim, 0xff2a2a, 0.65) : n === 2 ? mix(P.rim, 0xc77dff, 0.45) : new THREE.Color(P.rim),
      fog: n >= 3 ? mix(P.fog, 0x1c0303, 0.65) : n === 2 ? mix(P.fog, 0x140a22, 0.5) : new THREE.Color(P.fog),
      ring: n >= 3 ? mix(P.ring, 0xff3a2a, 0.6) : n === 2 ? mix(P.ring, 0xc77dff, 0.4) : new THREE.Color(P.ring),
      tint: n >= 3 ? new THREE.Color(1, 0.74, 0.72) : n === 2 ? new THREE.Color(0.94, 0.86, 1) : new THREE.Color(1, 1, 1),
      rimI: [0, 30, 40, 54][Math.min(3, n)], boost: [0, 1.6, 2.0, 2.6][Math.min(3, n)], speed: [0, 1, 1.35, 1.8][Math.min(3, n)], bloom: [0, 0.55, 0.65, 0.8][Math.min(3, n)],
      lift: n >= 3 ? V3(0.07, 0.0, 0.0) : n === 2 ? V3(0.04, 0.0, 0.07) : V3(...P.lift),
      gain: n >= 3 ? V3(1.08, 0.94, 0.9) : V3(...P.gain), sat: n >= 3 ? 1.2 : 1.12, vig: n >= 3 ? 0.55 : n === 2 ? 0.47 : 0.4,
    };
  }
  updateLook(real) {
    const L = this.look, T = this.lookTo;
    if (T) {
      const k = 1 - Math.exp(-real * 2.2);
      for (const c of ["rim", "fog", "ring", "tint"]) L[c].lerp(T[c], k);
      for (const v of ["lift", "gain"]) L[v].lerp(T[v], k);
      for (const s of ["rimI", "boost", "speed", "bloom", "sat", "vig"]) L[s] += (T[s] - L[s]) * k;
    }
    this.rim.color.copy(L.rim); this.rim.intensity = L.rimI;
    this.scene.fog.color.copy(L.fog);
    this.bossRing.material.color.copy(L.ring).multiplyScalar(1.8);
    this.bossGlow.material.color.copy(L.ring);
    this.capMat.color.copy(L.ring).multiplyScalar(2.2);
    this.skyMat.color.copy(L.tint); this.floorMat.color.copy(L.tint);
    this.motes.material.uniforms.uBoost.value = L.boost;
    if (this.post) {
      const u = this.post.grade.uniforms;
      u.uLift.value.copy(L.lift); u.uGain.value.copy(L.gain); u.uSat.value = L.sat; u.uVig.value = L.vig;
      this.post.bloom.strength = L.bloom;
    }
  }

  // ---------- post-processing ----------
  enablePost(M) {
    const r = this.renderer;
    if (this.post || !r.capabilities.isWebGL2) return;
    if (!(r.extensions.has("EXT_color_buffer_float") || r.extensions.has("EXT_color_buffer_half_float"))) return;
    try {
      const size = r.getSize(new THREE.Vector2()), pr = r.getPixelRatio();
      const rt = new THREE.WebGLRenderTarget(Math.max(1, Math.round(size.x * pr)), Math.max(1, Math.round(size.y * pr)), { type: THREE.HalfFloatType, samples: 4 });
      const composer = new M.EffectComposer(r, rt);
      composer.addPass(new M.RenderPass(this.scene, this.camera));
      const bloom = new M.UnrealBloomPass(new THREE.Vector2(size.x, size.y), this.look.bloom, 0.4, 1.2);
      // Bloom adds light, not coverage: keep the scene's alpha so the page behind still shows where nothing is drawn.
      const bm = bloom.blendMaterial || bloom.materialCopy;
      if (bm) Object.assign(bm, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
      // Bloom is soft anyway: render it at reduced resolution (phones lower still).
      const scale = PHONE ? 0.5 : 0.75, setSize = bloom.setSize.bind(bloom);
      bloom.setSize = (w, h) => setSize(Math.max(4, Math.round(w * scale)), Math.max(4, Math.round(h * scale)));
      composer.addPass(bloom);
      const grade = new M.ShaderPass(GRADE); composer.addPass(grade);
      this.post = { composer, bloom, grade };
      this.resize();
      this.updateLook(0);
      this.perfReset();
    } catch (err) {
      console.warn("Arena post-processing off", err);
      this.disablePost();
    }
  }
  disablePost() {
    const P = this.post; if (!P) return;
    this.post = null;
    try { P.bloom.dispose(); P.grade.dispose?.(); P.composer.dispose(); } catch { /* already gone */ }
  }
  // Frame-time watchdog: if the first seconds run slow, drop bloom, then resolution. Ignores hidden/throttled tabs.
  perfReset() { Object.assign(this.perf, { t: 0, samples: [], good: 0, slow: 0, done: false }); }
  monitor(ms) {
    const P = this.perf;
    P.last.push(ms); if (P.last.length > 120) P.last.shift();
    if (P.done || this.qualityLock) return;
    if (document.hidden || ms > 250) { P.samples.length = 0; P.t = 0; return; }
    P.t += ms / 1000;
    if (P.t < 1.5) return; // shaders compiling, models arriving
    P.samples.push(ms);
    if (P.samples.length < 120) return;
    const s = P.samples.slice().sort((a, b) => a - b), med = s[s.length >> 1];
    P.samples.length = 0; P.t = 0.6;
    if (med > 21) {
      P.good = 0;
      if (++P.slow < 2) return; // one slow window can be a model loading; act on two in a row
      P.slow = 0;
      if (this.post) { this.disablePost(); this.postWanted = false; this.fxScale = 0.75; console.info(`Arena: ${med.toFixed(1)}ms frames, bloom off`); }
      else if (this.renderer.getPixelRatio() > 1.01) { this.renderer.setPixelRatio(Math.max(1, this.renderer.getPixelRatio() * 0.75)); this.fxScale = 0.6; this.resize(); console.info(`Arena: ${med.toFixed(1)}ms frames, lower resolution`); }
      else P.done = true;
    } else { P.slow = 0; if (++P.good >= 3 && (this.post || !this.postWanted)) P.done = true; }
  }
  // For the lab and debugging: what quality the arena settled on, and recent frame times.
  stats() {
    const s = this.perf.last.slice().sort((a, b) => a - b);
    return { post: !!this.post, pixelRatio: this.renderer.getPixelRatio(), fxScale: this.fxScale, medianMs: s.length ? +s[s.length >> 1].toFixed(2) : null, p90Ms: s.length ? +s[Math.floor(s.length * 0.9)].toFixed(2) : null, effects: this.fx.length, settled: this.perf.done };
  }
  // Switch bloom on or off at runtime (e.g. from a settings toggle).
  setPost(on) {
    this.qualityLock = true;
    if (!on) { this.postWanted = false; this.disablePost(); return; }
    this.postWanted = true; this.fxScale = 1;
    loadPost().then((M) => { if (M && !this.disposed && this.postWanted) this.enablePost(M); });
  }

  // ---------- boss ----------
  loadBoss(def) {
    const spec = MODELS[def.id] || MODELS[def.model];
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
    loadGltf(spec.url).then((gltf) => {
      if (this.disposed) return;
      const m = prepareModel(gltf, spec);
      const old = this.boss.holder, wasDead = this.boss.dead;
      this.scene.remove(old); freeObj(old);
      this.boss = { mixer: m.mixer, clips: m.clips, hover: spec.hover || 0, tick: m.obj.userData.tick };
      place(m.obj, spec.height || 5.5);
      this.collectMats(m.obj);
      this.bossPlay("idle");
      if (wasDead) this.bossKO();
    }).catch(() => { /* keep the built-in boss */ });
  }
  collectMats(root) {
    const mats = [], all = [], shells = [];
    const U = { dis: { value: 0 }, h: { value: this.boss.height || 5 }, base: { value: 0 }, edge: { value: hdr(this.pal.ring, 4) } };
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      if (o.material === OUTLINE) { shells.push(o); return; }
      for (const m of [].concat(o.material)) { all.push(m); if (m.emissive) mats.push(m); patchDissolve(m, U); }
    });
    for (const m of all) { m.userData.baseOp = m.opacity; m.userData.baseT = m.transparent; }
    Object.assign(this.boss, { mats, allMats: all, shells, fadeK: 1, dis: U });
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
    const w = buildWalker ? buildWalker(THREE, m.answers || {}, { you: !!m.you, fx: this.skinQuality() }) : simpleWalker(m.answers);
    // Heroes are sized by how far they walked this week (m.scale, about 0.85 to 1.3) on top of the mode's own scale.
    const base = this.mode === "tax" ? 0.95 : 1, s = heroScale(m.scale);
    w.group.scale.setScalar(base * s);
    this.scene.add(w.group);
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 32), new THREE.MeshBasicMaterial({ color: m.you ? hdr(0xffcf3f, 1.4) : 0xffffff, transparent: true, opacity: m.you ? 0.9 : 0.35 }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.03; w.group.add(marker);
    if (!buildWalker) this.addShadow(w.group, 0.5); // the 3D walkers bring their own soft shadow
    this.heroes.set(m.id, { w, m, pos: m.pos || "mid", target: new THREE.Vector3(), down: false, base, s, scaleTo: s, scaleFrom: s, scaleK: 1 });
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
    // Spacing follows each neighbour pair's size; on a narrow (portrait) screen a long row closes up to fit,
    // but never tighter than the walkers' own width, so nobody overlaps.
    const r = this.host.getBoundingClientRect(), aspect = r.width / Math.max(1, r.height), tanH = Math.tan(((aspect < 0.7 ? 58 : 48) * Math.PI) / 360) * aspect;
    for (const [row, list] of Object.entries(byRow)) {
      const n = list.length, gap = row === "front" ? 1.9 : 1.75; if (!n) continue;
      const sc = list.map((h) => h.scaleTo ?? 1), want = [], min = [];
      for (let i = 0; i < n - 1; i++) { const a = (sc[i] + sc[i + 1]) / 2; want.push(gap * a); min.push(1.05 * a); }
      const total = want.reduce((a, b) => a + b, 0), floor = min.reduce((a, b) => a + b, 0);
      const room = 2 * (this.camBase.z - ROWS[row]) * tanH * 0.8;
      const k = total > room ? Math.max(floor / total, room / total) : 1;
      let x = (-total * k) / 2 + (row === "mid" ? 0.35 * k : 0);
      list.forEach((h, i) => {
        h.target.set(x, 0, ROWS[row] + (i % 2) * 0.25);
        if (i < n - 1) x += want[i] * k;
        if (snap) h.w.group.position.copy(h.target);
      });
    }
  }
  // Ease a hero to a new size over about 0.4s (and re-space their row).
  setScale(id, s) {
    const h = this.heroes.get(id); if (!h) return;
    s = heroScale(s); if (Math.abs(s - h.scaleTo) < 1e-3) return;
    h.scaleFrom = h.s; h.scaleTo = s; h.scaleK = 0;
    this.layout(false);
  }
  // How much skin effect (trails, auras) each walker draws: phones and a slow arena get less.
  skinQuality() { return this.fxScale * (PHONE ? 0.7 : 1) * (CALM ? 0.6 : 1); }
  updateHero(h, dt, real) {
    if (h.w.skinFx && h.fxK !== this.fxScale) { h.fxK = this.fxScale; h.w.skinFx.quality(this.skinQuality()); }
    if (h.scaleK < 1) { h.scaleK = Math.min(1, h.scaleK + real / 0.4); h.s = h.scaleFrom + (h.scaleTo - h.scaleFrom) * easeIO(h.scaleK); h.w.group.scale.setScalar(h.base * h.s); }
    // The week's big walkers get a faint gold glow at their feet and the odd rising spark.
    const on = h.s > 1.15 && !h.down;
    if (!h.aura && on) {
      h.aura = new THREE.Mesh(geo("plane", () => new THREE.PlaneGeometry(2, 2)), new THREE.MeshBasicMaterial({ map: glow(), color: hdr(0xffd36b, 1.3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      h.aura.rotation.x = -Math.PI / 2; h.aura.position.y = 0.025; h.aura.scale.setScalar(0.9); h.auraK = 0;
      h.w.group.add(h.aura);
    }
    if (!h.aura) return;
    h.auraK = Math.max(0, Math.min(1, h.auraK + (on ? 1 : -1) * real * 2.5));
    h.aura.visible = h.auraK > 0.01;
    h.aura.material.opacity = h.auraK * (0.45 + Math.sin(this.realT * 2.5 + h.s * 7) * 0.12);
    if (on && Math.random() < dt * 4 * this.fxScale) {
      const a = Math.random() * Math.PI * 2, rr = 0.5 * h.w.group.scale.y, p = h.w.group.position;
      this.sparks.emit({ x: p.x + Math.cos(a) * rr, y: 0.1, z: p.z + Math.sin(a) * rr, vy: rnd(0.8, 1.4), c: hdr(0xffd36b, 2.4), life: rnd(1, 1.6), size: 0.06, drag: 0.4, shape: 0, core: 0.8 });
    }
  }
  // A point on a hero at a height in walker units (so it lines up whatever their size).
  chest(h, up = 1) { return h.w.group.position.clone().add(V3(0, up * h.w.group.scale.y, 0)); }
  heroAt(id, up = 0.9) { const h = this.heroes.get(id); return h ? this.chest(h, up) : null; }

  // ---------- impact direction: hit-stop, flash, camera ----------
  // Freeze game time for a beat (camera and shake keep going), kick the camera and optionally flash the screen.
  hitStop(ms, { flash = 0, color = 0xffffff, punch = 0.5, minor = false } = {}) {
    if (minor && this.realT - (this.lastStop ?? -9) < 0.3) return;
    this.lastStop = this.realT;
    this.freeze = Math.max(this.freeze, ms / 1000);
    this.punch = Math.max(this.punch, punch * (CALM ? 0.4 : 1));
    if (flash) this.flashAt(color, flash);
  }
  flashAt(color, amt) {
    if (amt < this.flashAmt * 0.7) return;
    this.flashMesh.material.color.set(color);
    this.flashAmt = Math.max(this.flashAmt, amt * (CALM ? 0.5 : 1));
  }
  // A camera move: offsets for position, look target, FOV and roll, eased in, held, eased out. Tagged moves replace each other.
  // free: the shot is about the boss, so don't pull back to keep the squad in frame (the intro, the K.O.).
  camMove({ pos = [0, 0, 0], look = [0, 0, 0], fov = 0, roll = 0, inT = 0.25, dur = 1, outT = 0.5, hold = false, tag = null, free = false } = {}) {
    const k = CALM ? 0.35 : 1;
    if (tag) this.releaseCam(tag, true);
    const m = { p: V3(...pos).multiplyScalar(k), l: V3(...look).multiplyScalar(k), fov: fov * k, roll: roll * k, inT, dur: Math.max(dur, inT + outT), outT, hold, tag, free, t: 0 };
    this.moves.push(m); return m;
  }
  releaseCam(tag, quick = false) {
    for (const m of this.moves) if (m.tag === tag && !m.gone) {
      m.hold = false;
      if (quick) { m.outT = Math.min(m.outT, 0.25); m.gone = true; }
      m.dur = Math.max(m.t, m.inT) + m.outT;
    }
  }
  envelope(m) {
    if (m.t < m.inT) return ease(m.t / m.inT);
    if (m.hold || m.t < m.dur - m.outT) return 1;
    return Math.max(0, easeIO((m.dur - m.t) / m.outT));
  }
  placeCamera(off, w, extra) {
    const c = this.camera;
    c.position.copy(this.camBase).addScaledVector(off.p, w);
    if (extra) c.position.add(extra);
    c.fov = this.baseFov + off.fov * w;
    c.updateProjectionMatrix();
    const r = off.roll * w; c.up.set(Math.sin(r), Math.cos(r), 0);
    this._look = (this._look || V3()).copy(this.lookAt).addScaledVector(off.l, w);
    c.lookAt(this._look);
    c.updateMatrixWorld();
  }
  // How far out the squad sits on screen (largest |x| or overshoot in y), in normalised device units.
  squadSpread() {
    let worst = 0; const v = this._v || (this._v = V3());
    for (const h of this.heroes.values()) {
      for (const up of [0.15, 1.7]) {
        v.copy(h.w.group.position); v.y += up * h.w.group.scale.y; v.project(this.camera);
        worst = Math.max(worst, Math.abs(v.x), v.y < 0 ? -v.y : v.y * 1.05);
      }
    }
    return worst;
  }
  updateCamera(real) {
    const off = this._off || (this._off = { p: V3(), l: V3(), fov: 0, roll: 0 });
    off.p.set(0, 0, 0); off.l.set(0, 0, 0); off.fov = 0; off.roll = 0;
    for (const m of this.moves) {
      m.t += real;
      if (m.hold && m.t > (m.holdMax || 5)) { m.hold = false; m.dur = m.t + m.outT; }
      const e = this.envelope(m);
      off.p.addScaledVector(m.p, e); off.l.addScaledVector(m.l, e); off.fov += m.fov * e; off.roll += m.roll * e;
    }
    this.moves = this.moves.filter((m) => m.hold || m.t < m.dur);
    // Impact punch: a quick lunge towards the boss and a FOV squeeze.
    if (this.punch > 0) {
      const k = ease(Math.min(1, this.punch));
      off.p.z -= 0.45 * k; off.p.y -= 0.08 * k; off.fov -= 2.5 * k;
      this.punch = Math.max(0, this.punch - real * 5);
    }
    // Keep the squad on screen: scale the move back until everyone fits (or fits as well as the base framing does).
    let w = 1;
    if (this.heroes.size && !this.moves.some((m) => m.free) && (off.p.lengthSq() > 1e-6 || off.l.lengthSq() > 1e-6 || Math.abs(off.fov) > 0.01)) {
      this.placeCamera(off, 0); const allow = Math.max(0.86, this.squadSpread() + 0.01); // centres; leaves room for the walkers' own width
      for (w = 1; w > 0.05; w -= 0.35) { this.placeCamera(off, w); if (this.squadSpread() <= allow) break; }
      w = Math.max(0, w);
    }
    this.camW = w < this.camW ? w : Math.min(w, this.camW + real * 2.5);
    // Breathing sway and shake (in real time, so they carry on through a hit-stop).
    const sh = this.shakeAmt * (CALM ? 0.4 : 1);
    const extra = this._ex || (this._ex = V3());
    extra.set(Math.sin(this.realT * 0.4) * 0.15 + (Math.random() - 0.5) * sh, Math.sin(this.realT * 0.6) * 0.08 + (Math.random() - 0.5) * sh, 0);
    this.placeCamera(off, this.camW, extra);
    this.shakeAmt = Math.max(0, this.shakeAmt - real * 1.6);
  }

  // ---------- events from the game ----------
  heroAttack(id, { crit = false, big = false } = {}) {
    const h = this.heroes.get(id); if (!h || h.down) return;
    h.w.play(big ? "big" : "attack");
    const from = h.w.group.position.clone().add(V3(0, 1.1 * h.w.group.scale.y, -0.3));
    const to = this.bossPoint(0.45 + Math.random() * 0.3, (Math.random() - 0.5) * 1.2);
    const strong = crit || big;
    // Mythic and House skins shoot (and land) in their own spark colour, a touch brighter on the strong ones.
    const sk = h.w.skinFx?.spark ? new THREE.Color(h.w.skinFx.spark).getHex() : null;
    const col = sk ?? (strong ? 0xff9f43 : h.m.you ? 0xffd166 : 0x9fd0ff);
    // Teammates' shots are smaller than yours, so five people tapping at once still leave the boss in view.
    const mine = !!h.m.you;
    this.projectile(from, to, col, (strong ? 0.22 : 0.13) * (mine ? 1 : 0.7), strong, () => {
      if (sk != null && !strong && mine) this.flare(to, sk, 1.2);
      if (!strong || !this.impactOk(mine ? 0.12 : 0.3)) return;
      // Your own hits already got their hit-stop from bossHit; teammates' big ones get a lighter one on landing.
      if (!mine) this.hitStop(big ? 70 : 45, { punch: big ? 0.5 : 0.25, minor: true });
      this.flare(to, sk ?? 0xffc37a, (big ? 2.6 : 1.8) * (mine ? 1 : 0.7));
      if (sk != null && mine) this.shockwave(to, sk, big ? 2.4 : 1.6, 0.3, true);
    }, mine);
  }
  bossHit(crit) {
    const B = this.boss; if (!B) return;
    B.flash = crit ? 0.8 : 0.45;
    B.squash = crit ? 0.14 : 0.06;
    if (crit) { this.shake(0.18); this.hitStop(65, { flash: 0.1, color: 0xffd8a0, punch: 0.55, minor: true }); }
    if (B.mixer && B.clips.hit && Math.random() < (crit ? 0.6 : 0.08)) this.bossPlay("hit", { once: true });
  }
  bossWindup(type, ids = []) {
    const B = this.boss; if (!B) return;
    B.windup = 1;
    const col = this.moveColor(type);
    this.danger.color.set(col); this.danger.intensity = 25;
    if (B.mixer && ["scream", "spores", "breath"].includes(type) && B.clips.roar) this.bossPlay("roar", { once: true });
    if (type === "vanish") { B.ghost = true; this.burst(this.bossPoint(0.5, 0), 0xb9c8ff, 40, 5); this.charge(this.bossPoint(0.5, 0), 0xc9d4ff, 20, 2.5); return; }
    // Big area moves: pull back and tilt so the whole squad and the danger read; the camera returns after the hit.
    if (["slam", "breath", "gust", "stomp"].includes(type)) {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.camMove({ pos: [side * 0.3, 1.0, 1.7], look: [0, -0.35, 0.8], fov: 5, roll: side * 0.035, inT: 0.7, hold: true, outT: 0.9, tag: "area" });
    }
    // Ground telegraphs under whoever is about to be hit, in the move's colour.
    const big = type === "stomp" || type === "slam";
    const spots = ["scream", "spores", "breath"].includes(type) ? [...this.heroes.values()] : ids.map((i) => this.heroes.get(i)).filter(Boolean);
    for (const h of spots) this.decal(h.w.group.position, (big ? (type === "slam" ? 1.9 : 1.4) : 0.9) * Math.max(1, h.w.group.scale.y), col, type === "slam" ? 3.6 : 2.2);
    if (type === "slam") { B.raise = 1; this.danger.intensity = 45; this.charge(this.bossPoint(0.8, 0), 0xff7a2f, 34, 3.6); }
    if (type === "breath") { B.inhale = 1; this.burst(this.bossPoint(0.62, 0), 0xff8a2b, 24, 1.5); this.charge(this.bossPoint(0.62, 0), 0xffb35a, 40, 3); }
    if (type === "gust") this.charge(this.bossPoint(0.55, 0), 0x9ff3ff, 26, 3.5);
  }
  // Generic moves take the boss's own attack colour; signature moves keep their own (they match the HUD).
  moveColor(type) {
    const sig = WARN[type] && !["swipe", "stomp", "scream"].includes(type);
    return sig ? WARN[type] : new THREE.Color(WARN[type] || 0xff3b3b).lerp(new THREE.Color(this.pal.atk), 0.45).getHex();
  }
  bossAttack(type, ids = []) {
    const B = this.boss; if (!B) return;
    B.windup = 0; this.danger.intensity = 0; B.raise = 0; B.inhale = 0;
    const act = { slam: "stomp", ooze: "stomp", gust: "scream", spores: "scream", breath: "scream", grab: "swipe", vanish: "swipe" }[type] || type;
    B.act = `atk-${act}`; B.actT = 0; B.lunge = act === "swipe" || act === "stomp" ? 1 : 0;
    if (B.mixer) this.bossPlay(type === "feast" ? "eat" : act === "stomp" && B.clips.stomp ? "stomp" : act === "scream" && B.clips.roar ? "roar" : "attack", { once: true });
    // Let an area pull-back play through the hit, then ease home.
    for (const m of this.moves) if (m.tag === "area" && m.hold) m.holdMax = m.t + (type === "breath" ? 1.3 : 0.7);
    // A single target: lean the camera a touch towards them.
    if (ids.length === 1 && !["slam", "breath", "gust", "stomp", "scream", "spores"].includes(type)) {
      const h = this.heroes.get(ids[0]);
      if (h) { const p = h.w.group.position; this.camMove({ pos: [p.x * 0.12, -0.05, 0.2], look: [p.x * 0.3, -0.3, 0.6], roll: -p.x * 0.006, inT: 0.2, dur: 0.95, outT: 0.5, tag: "lean" }); }
    }
    const origin = this.bossPoint(0.55, 0);
    const heroAt = (id, up = 0.9) => this.heroAt(id, up);
    if (this.signature(type, ids, origin, heroAt)) return;
    const col = this.moveColor(type);
    if (type === "swipe") {
      for (const id of ids) { const to = heroAt(id, 0.9); if (to) this.slashAt(to, col); }
      this.shake(0.25);
    } else if (type === "stomp") {
      const at = V3(0, 0.05, this.bossZ + 1.5);
      this.shockwave(at, 0xffc878, 9, 0.7); this.shockwave(at, col, 6, 0.5); this.dustRing(at, 5, 0xb59a74, 26); this.shake(0.6);
      this.flashAt(0xffd8a0, 0.08);
    } else if (type === "scream") {
      for (let i = 0; i < 4; i++) setTimeout(() => !this.disposed && this.shockwave(origin.clone(), i % 2 ? 0xff6b8b : col, 14, 0.8, true), i * 110);
      this.shake(0.4);
    } else if (type === "feast") {
      B.feastGlow = 6;
      this.charge(this.bossPoint(0.5, 0), 0x7ee29d, 30, 4);
    }
  }
  // Each boss's own move. Returns true when it handled the type.
  signature(type, ids, origin, heroAt) {
    const B = this.boss;
    if (type === "ooze") {
      for (const id of ids) {
        const to = heroAt(id, 0.6); if (!to) continue;
        this.projectile(origin.clone(), to, 0x7dff6a, 0.32, true, () => { this.burst(to, 0x7dff6a, 22, 4); this.goo(to, 0x5cff4a, 14); this.puddle(to, 0x52d64a, 6); });
      }
      this.shake(0.35); return true;
    }
    if (type === "spores") {
      this.cloud(V3(0, 1.4, ROWS.mid), 0xffa13d, 0x9be15d, 4.2);
      this.shockwave(origin.clone(), 0xffa13d, 10, 0.9, true); this.shake(0.25); return true;
    }
    if (type === "vanish") {
      B.ghost = false;
      const to = heroAt(ids[0], 0);
      if (to) { B.blink = { x: to.x, z: to.z - 2.4, t: 0.9 }; setTimeout(() => { if (this.disposed) return; this.slashAt(this.heroAt(ids[0], 0.9) || to.clone().add(V3(0, 0.9, 0)), 0xc9d4ff); this.hitStop(50, { punch: 0.3, minor: true }); }, 260); }
      this.burst(origin.clone(), 0xb9c8ff, 30, 6); this.flare(origin.clone(), 0xc9d4ff, 4); this.shake(0.45); return true;
    }
    if (type === "gust") {
      for (let i = 0; i < 5; i++) setTimeout(() => { if (this.disposed) return; this.swirl(0x9ff3ff, i); }, i * 90);
      this.shake(0.4); return true;
    }
    if (type === "grab") {
      const id = ids[0], h = this.heroes.get(id); if (!h) return true;
      this.tentacle(id, 0x7a3cff);
      setTimeout(() => { if (this.disposed) return; const at = this.heroAt(id, 0.8); if (at) { this.burst(at, 0xb08aff, 18, 4); this.shockwave(at, 0x9b5cff, 2.2, 0.5, true); } }, 220);
      h.w.play("hurt"); this.shake(0.35); return true;
    }
    if (type === "slam") {
      const at = V3(0, 0.06, this.bossZ + 2);
      this.shockwave(at, 0xff7a2f, 13, 0.9);
      setTimeout(() => !this.disposed && this.shockwave(at, 0xffe0a0, 9, 0.7), 120);
      this.burst(V3(0, 0.3, ROWS.front - 1), 0xc9a27a, 60, 7);
      this.dustRing(at, 8, 0x9c8466, 40);
      this.flare(V3(0, 0.6, this.bossZ + 2.2), 0xffb070, 6);
      this.hitStop(90, { flash: 0.22, color: 0xffb070, punch: 0.4 });
      this.shake(1.1); return true;
    }
    if (type === "breath") { this.fireBreath(ids, origin); this.shake(0.6); return true; }
    return false;
  }
  // A blob of slime on the floor.
  puddle(at, color, life) {
    const m = new THREE.Mesh(geo("disc", () => new THREE.CircleGeometry(1, 28)), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(at.x, 0.03, at.z); this.scene.add(m);
    this.fx.push({ obj: m, life, t: 0, update: (f) => { const k = f.t / f.life; m.scale.setScalar(0.75 * Math.min(1, f.t * 6) * (1 + Math.sin(f.t * 4) * 0.04)); m.material.opacity = 0.7 * (1 - k * k); }, done: () => this.scene.remove(m) });
  }
  // Globs of slime thrown out on a splash.
  goo(at, color, n) {
    const c = new THREE.Color(color).multiplyScalar(1.3);
    for (let i = 0; i < n * this.fxScale; i++) { const a = Math.random() * Math.PI * 2, s = rnd(1.5, 3.5);
      this.sparks.emit({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * s, vy: rnd(2, 5), vz: Math.sin(a) * s, c, life: rnd(0.5, 0.8), size: rnd(0.18, 0.3), end: 0.5, grav: 12, shape: 0, core: 0.2 }); }
  }
  // A drifting cloud: big soft puffs plus bright spores.
  cloud(at, c1, c2, life) {
    const a = new THREE.Color(c1), b = new THREE.Color(c2), n = Math.round(56 * this.fxScale);
    for (let i = 0; i < n; i++) {
      const c = (i % 2 ? a : b).clone().multiplyScalar(0.55);
      this.sparks.emit({ x: at.x + rnd(-4.5, 4.5), y: at.y + rnd(-0.4, 1.4), z: at.z + rnd(-2.2, 2.2), vx: rnd(-0.3, 0.3), vy: rnd(0.1, 0.35), vz: rnd(-0.3, 0.3),
        c, life: life * rnd(0.55, 1), size: rnd(0.7, 1.3), end: 1.8, shape: 0, core: 0, delay: rnd(0, 0.4) });
    }
    for (let i = 0; i < n; i++) {
      const c = hdr(i % 2 ? c1 : c2, 2);
      this.sparks.emit({ x: at.x + rnd(-4.5, 4.5), y: at.y + rnd(-0.6, 1.6), z: at.z + rnd(-2.2, 2.2), vx: rnd(-0.5, 0.5), vy: rnd(0.15, 0.5), vz: rnd(-0.5, 0.5),
        c, life: life * rnd(0.4, 0.9), size: rnd(0.07, 0.13), end: 0.6, shape: 0, core: 0.6, delay: rnd(0, 0.6) });
    }
  }
  // A spinning gust ring rushing from the boss to the squad, with wind streaks.
  swirl(color, i) {
    const ring = new THREE.Mesh(geo("swirl", () => new THREE.TorusGeometry(1, 0.05, 6, 48)), new THREE.MeshBasicMaterial({ color: hdr(color, 2), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.set((Math.random() - 0.5) * 2, 1.2 + Math.random(), this.bossZ + 1.5); this.scene.add(ring);
    const z0 = ring.position.z, z1 = ROWS.back + 1.5, r0 = 1.2 + i * 0.25;
    this.fx.push({ obj: ring, life: 0.8, t: 0, update: (f) => { const k = f.t / f.life; ring.position.z = z0 + (z1 - z0) * k; ring.rotation.z += 0.4; ring.scale.setScalar(r0 * (1 + k * 1.8)); ring.material.opacity = 0.8 * (1 - k); }, done: () => this.scene.remove(ring) });
    const c = hdr(color, 2.2);
    for (let j = 0; j < 12 * this.fxScale; j++) this.sparks.emit({ x: rnd(-5, 5), y: rnd(0.3, 3), z: this.bossZ + rnd(1, 3), vx: rnd(-0.5, 0.5), vy: rnd(-0.2, 0.2), vz: rnd(11, 16),
      c, life: rnd(0.45, 0.7), size: rnd(0.05, 0.09), stretch: 0.07, shape: 1, core: 0.4, delay: rnd(0, 0.1) });
  }
  // A tentacle from the boss to someone, wriggling until they're let go.
  tentacle(id, color) {
    this.untangle(id);
    const h = this.heroes.get(id); if (!h) return;
    const mat = toon(new THREE.Color(color), { emissive: new THREE.Color(color).multiplyScalar(0.25) });
    const N = 14, segs = [], ball = geo("ball", () => new THREE.SphereGeometry(1, 12, 8));
    const group = new THREE.Group(); this.scene.add(group);
    for (let i = 0; i < N; i++) { const s = new THREE.Mesh(ball, mat); s.scale.setScalar(0.34 - i * 0.017); group.add(s); segs.push(s); }
    const ring = new THREE.Mesh(geo("tring", () => new THREE.TorusGeometry(0.55, 0.12, 8, 24)), mat); ring.rotation.x = Math.PI / 2; group.add(ring);
    const f = { obj: group, life: 11, t: 0, id, update: (g) => {
      const a = this.bossPoint(0.35, 0.6), b = this.chest(h, 0.8);
      const grow = Math.min(1, g.t * 4);
      for (let i = 0; i < N; i++) {
        const k = (i / (N - 1)) * grow, p = a.clone().lerp(b, k);
        p.y += Math.sin(k * Math.PI) * 1.6 + Math.sin(g.t * 6 + i * 0.7) * 0.18; p.x += Math.sin(g.t * 4 + i) * 0.15;
        segs[i].position.copy(p);
      }
      ring.position.copy(b); ring.scale.setScalar(grow * h.w.group.scale.y * (1 + Math.sin(g.t * 8) * 0.06));
    }, done: () => this.scene.remove(group) };
    this.fx.push(f); h.grab = f;
  }
  untangle(id) { const h = this.heroes.get(id); if (h?.grab) { h.grab.t = h.grab.life; h.grab = null; } }
  release(id, freed) {
    const h = this.heroes.get(id); if (!h) return;
    this.untangle(id);
    if (freed) { const at = this.chest(h, 1); this.burst(at, 0xd6b8ff, 26, 5); this.flare(at, 0xe0ccff, 2.4); this.shockwave(at, 0xc9a6ff, 2.5, 0.5, true); h.w.play("cheer"); }
  }
  // Fire sweeping across the squad, left to right, then burning at their feet.
  fireBreath(ids, origin) {
    const targets = ids.map((id) => this.heroes.get(id)).filter(Boolean).sort((a, b) => a.w.group.position.x - b.w.group.position.x);
    const mouth = origin.clone().add(V3(0, 0.6, 0)), cols = [hdr(0xffd23d, 3), hdr(0xff8a1a, 2.6), hdr(0xff4a0a, 2.2)], smoke = new THREE.Color(0x2a1a14);
    const tmp = V3(), dir = V3();
    this.danger.color.set(0xff6a1a);
    this.fx.push({ obj: null, life: 1.0, t: 0, acc: 0, puff: 0, update: (f, dt) => {
      const k = Math.min(1, f.t / 0.9);
      tmp.set(-5 + k * 10, 0.6, ROWS.mid);
      dir.copy(tmp).sub(mouth).normalize();
      this.danger.intensity = 30 * (1 - k * 0.5);
      f.acc += dt * (PHONE ? 150 : 230) * this.fxScale;
      while (f.acc >= 1) {
        f.acc -= 1;
        const s = rnd(9, 13);
        this.sparks.emit({ x: mouth.x + rnd(-0.2, 0.2), y: mouth.y + rnd(-0.2, 0.2), z: mouth.z, vx: dir.x * s + rnd(-1.4, 1.4), vy: dir.y * s + rnd(-0.8, 1.2), vz: dir.z * s + rnd(-1.4, 1.4),
          c: cols[(Math.random() * 3) | 0], life: rnd(0.5, 0.75), size: rnd(0.3, 0.55), end: 3.2, drag: 0.7, grav: -1.5, shape: 0, core: 0.5 });
      }
      if ((f.puff += dt) > 0.09) {
        f.puff = 0;
        this.burst(tmp.clone().add(V3(0, 0, rnd(-1.5, 1.5))), 0xff8a2b, 8, 3);
        this.dust.emit({ x: tmp.x, y: 0.8, z: tmp.z + rnd(-1, 1), vx: rnd(-0.4, 0.4), vy: rnd(1, 2), vz: rnd(-0.4, 0.4), c: smoke, life: rnd(0.9, 1.4), size: 0.9, end: 2.6, drag: 1, shape: 0, core: 0 });
      }
    }, done: () => { this.danger.intensity = 0; } });
    setTimeout(() => { if (!this.disposed) for (const h of targets) { this.puddle(h.w.group.position, 0xff5a1a, 3.5); this.embersAt(h.w.group.position, 0xff8a2b); } }, 700);
  }
  // Embers lifting off a burning spot.
  embersAt(at, color) {
    const c = hdr(color, 2.4);
    for (let i = 0; i < 14 * this.fxScale; i++) this.sparks.emit({ x: at.x + rnd(-0.5, 0.5), y: 0.1, z: at.z + rnd(-0.5, 0.5), vx: rnd(-0.3, 0.3), vy: rnd(0.8, 2), vz: rnd(-0.3, 0.3), c, life: rnd(0.8, 1.6), size: rnd(0.05, 0.1), drag: 0.5, shape: 0, core: 0.8, delay: rnd(0, 1.5) });
  }
  // A class special: a punch-in on the boss, a pillar of the class's colour; damage specials also launch a big shot.
  special(id, cls, roll) {
    const h = this.heroes.get(id); if (!h) return;
    const col = CLASS_FX[cls] || 0xffd166, at = h.w.group.position;
    h.w.play(["courier", "hedge", "librarian", "lollipop", "pickpocket"].includes(cls) ? "cast" : "big");
    this.camMove({ pos: [at.x * 0.1, -0.35, -1.9], look: [0, 0.55, 0], fov: -4, inT: 0.22, dur: 1.15, outT: 0.6, tag: "special" });
    this.hitStop(70, { flash: 0.22, color: col, punch: 0.4 });
    this.pillar(at, col); this.shockwave(V3(at.x, 0.06, at.z), col, 4, 0.7);
    this.spiral(at, col);
    const hits = ["bouncer", "mad", "pickpocket"].includes(cls) || (cls === "gremlin" && roll === "crit");
    if (hits) {
      const from = at.clone().add(V3(0, 1.2, -0.3)), to = this.bossPoint(0.5, 0);
      for (let i = 0; i < 3; i++) setTimeout(() => !this.disposed && this.projectile(from.clone(), to.clone().add(V3((Math.random() - 0.5) * 1.4, (Math.random() - 0.5), 0)), col, 0.36, true), i * 90);
      setTimeout(() => {
        if (this.disposed) return;
        this.burst(to, col, 40, 7); this.flare(to, col, 3); this.shockwave(to, col, 5, 0.5, true);
        this.bossHit(true); this.hitStop(100, { flash: 0.3, color: col, punch: 1 }); this.shake(0.5);
        if (this.boss) this.boss.lunge = cls === "bouncer" ? 0 : this.boss.lunge;
      }, 380);
    }
    if (cls === "pigeon") for (let i = 0; i < 18; i++) setTimeout(() => !this.disposed && this.projectile(at.clone().add(V3((Math.random() - 0.5) * 3, 0.5 + Math.random(), 1)), this.bossPoint(0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 3), 0xe8e8f0, 0.12, false), i * 60);
    if (["lollipop", "librarian", "hedge"].includes(cls) || (cls === "gremlin" && roll === "fizzle")) {
      for (const x of this.heroes.values()) if (!x.down) this.shockwave(this.chest(x, 1), col, 1.6 * x.w.group.scale.y, 0.6, true);
    }
    if (cls === "gremlin" && roll === "heal") for (const x of this.heroes.values()) if (!x.down) this.pillar(x.w.group.position, 0x7ee29d);
  }
  // Sparks winding up around someone.
  spiral(at, color) {
    const c = hdr(color, 2.6), n = Math.round(24 * this.fxScale);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 4, r = 0.7;
      this.sparks.emit({ x: at.x + Math.cos(a) * r, y: 0.2 + (i / n) * 0.8, z: at.z + Math.sin(a) * r, vx: -Math.sin(a) * 1.2, vy: rnd(3, 5), vz: Math.cos(a) * 1.2, c, life: rnd(0.5, 0.8), size: rnd(0.08, 0.13), stretch: 0.05, drag: 1.2, shape: 1, core: 0.8, delay: i * 0.012 }); }
  }
  // Back to rest: no wind-up glow, danger light, raise or fade. The app calls this whenever the fight says the boss
  // isn't winding up, so a missed event (a dropped snapshot, a blocked attack) can't leave a glow on it.
  calm() {
    const B = this.boss; if (!B) return;
    if (B.windup || B.raise || B.inhale || this.danger.intensity) { B.windup = 0; B.raise = 0; B.inhale = 0; this.danger.intensity = 0; this.releaseCam("area"); }
  }
  unghost() { if (this.boss) this.boss.ghost = false; }
  // The entrance: start close on the boss, a roar, then pull back to the squad. Taps are locked by the app meanwhile.
  intro(secs = 3.5) {
    const B = this.boss; if (!B) return;
    this.camMove({ pos: [0, -0.6, -4.2], look: [0, 0.9, -1.2], fov: -8, inT: 0.01, hold: true, outT: Math.min(1.4, secs * 0.4), tag: "intro", free: true });
    setTimeout(() => {
      if (this.disposed || this.boss?.dead) return;
      const B2 = this.boss;
      if (B2.mixer && B2.clips.roar) this.bossPlay("roar", { once: true }); else { B2.squash = 0.2; B2.act = "atk-scream"; B2.actT = 0; }
      const at = this.bossPoint(0.5, 0);
      this.shockwave(V3(0, 0.06, this.bossZ), this.look.ring.getHex(), 10, 1.1);
      this.charge(at, this.look.ring.getHex(), 30, 4);
      this.shake(0.45);
    }, 450);
    setTimeout(() => { if (!this.disposed) this.releaseCam("intro"); }, Math.max(600, (secs - 1.2) * 1000));
  }
  // The middle row knocked it off balance.
  stagger(stopped) {
    const B = this.boss; if (!B) return;
    B.windup = 0; B.raise = 0; this.danger.intensity = 0; B.flash = 0.9; B.squash = stopped ? 0.3 : 0.18; B.reel = 1;
    this.releaseCam("area");
    const at = this.bossPoint(0.55, 0);
    this.shockwave(at, 0xfff6d8, stopped ? 7 : 4.5, 0.5, true);
    if (stopped) this.shockwave(at, 0xfff3a0, 10, 0.7, true);
    this.burst(this.bossPoint(0.6, 0), 0xfff3a0, stopped ? 50 : 26, 6);
    this.flare(at, 0xfff3a0, stopped ? 4.2 : 3);
    this.hitStop(stopped ? 120 : 90, { flash: stopped ? 0.24 : 0.15, color: 0xfff6d8, punch: stopped ? 1 : 0.7 });
    this.camMove({ pos: [0, -0.2, -0.9], look: [0, 0.4, 0], fov: -2, inT: 0.12, dur: 0.6, outT: 0.4, tag: "stagger" });
    this.shake(stopped ? 0.6 : 0.3);
  }
  // An attack that bounced off the whole squad.
  blocked() {
    this.calm();
    for (const h of this.heroes.values()) if (!h.down) this.shockwave(this.chest(h, 1), 0x8fd8ff, 1.8 * h.w.group.scale.y, 0.6, true);
    this.shockwave(V3(0, 0.06, ROWS.front - 0.8), 0x8fd8ff, 7, 0.6);
    this.flare(V3(0, 1.2, ROWS.front - 0.8), 0xbfe8ff, 3);
  }
  pulse(fromId, toId) {
    const a = this.heroes.get(fromId), b = this.heroes.get(toId); if (!a || !b) return;
    const p0 = this.chest(a, 1), p1 = this.chest(b, 1), c = hdr(0x7ee29d, 2);
    for (let i = 0; i <= 6; i++) { const p = p0.clone().lerp(p1, i / 6); this.sparks.emit({ x: p.x, y: p.y + Math.sin((i / 6) * Math.PI) * 0.5, z: p.z, vy: 0.4, c, life: 0.45, size: 0.16, end: 0.3, shape: 0, core: 0.6, delay: i * 0.03 }); }
    this.burst(p1, 0x7ee29d, 8, 2);
  }
  hurt(id) {
    const h = this.heroes.get(id); if (!h) return;
    h.w.play("hurt");
    const at = this.chest(h, 1);
    this.burst(at, 0xff5a6a, 8, 3);
    if (h.m.you) { this.shake(0.22); this.flashAt(0xff2a3a, 0.1); }
  }
  down(id) { const h = this.heroes.get(id); if (h) { h.down = true; h.w.play("down"); this.dustRing(h.w.group.position.clone().setY(0.05), 1.2, 0x8a7a66, 10); } }
  revive(id) { const h = this.heroes.get(id); if (h) { h.down = false; h.w.play("revive"); this.pillar(h.w.group.position, 0x7ee29d); } }
  move(id, pos) { const h = this.heroes.get(id); if (h) { h.pos = pos; this.layout(false); } }
  shield(ids, secs = 8) {
    for (const id of ids) {
      const h = this.heroes.get(id); if (!h) continue;
      h.w.play("block");
      const dome = new THREE.Mesh(geo("dome", () => new THREE.SphereGeometry(1.0, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2)), new THREE.MeshBasicMaterial({ color: hdr(0x7fd0ff, 0.9), transparent: true, opacity: 0.26, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      h.w.group.add(dome);
      this.shockwave(V3(h.w.group.position.x, 0.06, h.w.group.position.z), 0x7fd0ff, 1.6, 0.5);
      this.fx.push({ obj: dome, life: secs, t: 0, update: (f) => { const pop = Math.min(1, f.t * 5); dome.material.opacity = (0.16 + Math.sin(f.t * 6) * 0.05) * (f.life - f.t < 0.4 ? (f.life - f.t) / 0.4 : 1); dome.scale.setScalar(ease(pop) * (1 + Math.sin(f.t * 3) * 0.03)); }, done: () => { h.w.group.remove(dome); if (!h.down) h.w.play("idle"); } });
    }
  }
  heal(fromId, toId) {
    const a = this.heroes.get(fromId), b = this.heroes.get(toId); if (!a || !b) return;
    a.w.play("cast");
    this.beam(this.chest(a, 1), this.chest(b, 1), 0x7ee29d);
    this.pillar(b.w.group.position, 0x7ee29d);
  }
  phase(n) {
    this.phaseN = n;
    this.setLook(n);
    const B = this.boss; if (B) B.grow = n === 3 ? 1.12 : n === 2 ? 1.06 : 1;
    if (B?.mixer && B.clips.roar) this.bossPlay("roar", { once: true });
    const col = this.lookTo.rim.getHex(), at = this.bossPoint(0.5, 0);
    this.shockwave(V3(0, 0.06, this.bossZ), col, 12, 1.1); this.shockwave(at, col, 8, 0.8, true);
    this.charge(at, col, 40, 4);
    this.flashAt(col, 0.18);
    this.camMove({ pos: [0, 0.5, 1.0], look: [0, 0.4, 0], fov: 3, inT: 0.4, dur: 1.6, outT: 0.8, tag: "phase" });
    this.shake(0.5);
  }
  bossKO() {
    const B = this.boss; if (!B || B.dead) return;
    B.dead = true; B.act = "ko"; B.actT = 0;
    B.windup = 0; B.raise = 0; B.inhale = 0; B.ghost = false; B.feastGlow = 0; B.flash = 0; this.danger.intensity = 0;
    if (B.mixer && B.clips.death) this.bossPlay("death", { once: true, then: null });
    this.shake(0.7);
    for (const h of this.heroes.values()) if (!h.down) h.w.play("cheer");
    // The finisher, once per fight (a model arriving late re-runs bossKO on the new body): freeze, slow motion, push in, dissolve.
    if (this.koAt == null) {
      this.koAt = this.realT;
      this.moves.length = 0;
      this.hitStop(130, { flash: 0.45, color: 0xffffff, punch: 1 });
      this.slowmo = { t: 0, hold: 1.1, out: 0.7, scale: 0.3 };
      this.camMove({ pos: [0, 0.5, -1.1], look: [0, 0.9, 0], fov: -4, inT: 0.6, dur: 3.2, outT: 0.9, tag: "ko", free: true });
      const at = this.bossPoint(0.5, 0);
      this.shockwave(at, 0xffffff, 9, 0.9, true); this.shockwave(V3(0, 0.06, this.bossZ), this.look.ring.getHex(), 14, 1.2);
      this.burst(at, 0xfff3a0, 70, 8); this.flare(at, 0xffffff, 9);
      // The Taxman stays down so you can go through his pockets; a raid boss burns away.
      if (this.mode === "tax") this.lootStart();
      else {
        this.dissolveAt = this.realT + 1.1;
        setTimeout(() => { if (!this.disposed) { const p = this.bossPoint(0.45, 0); this.burst(p, this.look.ring.getHex(), 30, 6); this.shockwave(p, this.look.ring.getHex(), 5, 0.7, true); this.shake(0.4); } }, 1100);
      }
    }
  }
  // ---------- the Taxman's K.O.: rob him ----------
  // Walk up to the body; from here every tap is a stomp that knocks coins out of him.
  lootStart() {
    this.looting = true;
    setTimeout(() => {
      if (this.disposed) return;
      for (const h of this.heroes.values()) h.target.set(-0.35, 0, this.bossZ + 2.5);
      this.camMove({ pos: [-0.3, -0.7, -3.4], look: [0.1, -1.3, -0.4], fov: -4, inT: 0.9, dur: 99, outT: 0.6, hold: true, tag: "loot" });
    }, 900);
  }
  coins(at, n, up = 4.5) {
    n = Math.min(60, Math.round(n * this.fxScale));
    const gold = hdr(0xffcf3d, 2.2), hi = hdr(0xfff1a0, 2.6);
    for (let i = 0; i < n; i++) {
      this.sparks.emit({ x: at.x + rnd(-0.3, 0.3), y: at.y, z: at.z + rnd(-0.2, 0.3), vx: rnd(-1.6, 1.6), vy: rnd(up * 0.6, up), vz: rnd(-0.4, 1.8),
        c: Math.random() < 0.25 ? hi : gold, life: rnd(0.8, 1.3), size: rnd(0.1, 0.17), end: 0.8, grav: 10, drag: 0.35, shape: 0, core: 0.9 });
    }
  }
  loot(id, { big = false } = {}) {
    const h = this.heroes.get(id), B = this.boss; if (!h || !B) return;
    h.w.play("stomp");
    setTimeout(() => {
      if (this.disposed) return;
      const at = this.bossPoint(0.12, 0.2);
      B.squash = big ? 0.16 : 0.08;
      this.coins(at, big ? 22 : 8, big ? 6 : 4.5);
      this.dustRing(V3(at.x, 0.05, at.z), big ? 1.6 : 1, 0xd8c08a, big ? 14 : 6);
      if (big) { this.shake(0.22); this.hitStop(55, { punch: 0.4, minor: true }); this.flare(at, 0xffd36b, 2.6); }
    }, 130);
  }
  // Pockets empty: a rummage, a fountain of coins, then he fades away.
  lootFinale(id) {
    const h = this.heroes.get(id), B = this.boss; if (!h || !B) return;
    h.w.play("rummage");
    const at = this.bossPoint(0.15, 0.2);
    let n = 0;
    const tick = setInterval(() => {
      if (this.disposed || ++n > 9) return clearInterval(tick);
      this.coins(at, 14, 5 + n * 0.3); B.squash = 0.05;
    }, 160);
    setTimeout(() => {
      if (this.disposed) return;
      h.w.play("cheer");
      this.coins(this.chest(h, 1.4), 40, 7); this.flare(this.chest(h, 1.2), 0xffe27a, 4);
      this.dissolveAt = this.realT + 0.6;
    }, 1500);
  }
  cheer() { for (const h of this.heroes.values()) if (!h.down) h.w.play("cheer"); }

  // ---------- effects ----------
  bossPoint(heightFrac = 0.5, dx = 0) {
    const B = this.boss;
    return new THREE.Vector3(dx, (B?.height || 5) * heightFrac * (B?.holder?.scale.y || 1), this.bossZ + 0.8);
  }
  // At most one big landing flash every `gap` seconds: stacked additive flares turn into a white blob over the boss.
  impactOk(gap) {
    if (this.realT - (this.lastImpact ?? -9) < gap) return false;
    this.lastImpact = this.realT; return true;
  }
  // A glowing shot on a curved path, leaving a continuous trail; bursts on landing.
  projectile(from, to, color, size, big, onHit, mine = true) {
    const head = new THREE.Sprite(spriteMat(color, big ? 3.2 : 2.6)); head.geometry.userData.keep = true;
    const core = new THREE.Sprite(spriteMat(0xffffff, 2)); core.scale.setScalar(0.42); head.add(core);
    head.scale.setScalar(size * 5.5); head.position.copy(from); this.scene.add(head);
    const mid = from.clone().lerp(to, 0.5).add(V3(0, big ? 1.6 : 0.8, 0));
    const trailC = hdr(color, big ? 2.2 : 1.6), prev = from.clone(), a = V3(), b = V3();
    this.fx.push({ obj: head, life: big ? 0.38 : 0.26, t: 0,
      update: (f) => {
        const k = Math.min(1, f.t / f.life);
        a.copy(from).lerp(mid, k); b.copy(mid).lerp(to, k);
        head.position.copy(a.lerp(b, k));
        const n = Math.min(8, Math.ceil(prev.distanceTo(head.position) / (big ? 0.12 : 0.18)));
        for (let i = 1; i <= n; i++) {
          a.copy(prev).lerp(head.position, i / n);
          this.sparks.emit({ x: a.x, y: a.y, z: a.z, vx: rnd(-0.3, 0.3), vy: rnd(-0.1, 0.4), vz: rnd(-0.3, 0.3), c: trailC, life: big ? 0.32 : 0.2, size: size * (big ? 3 : 2.4), end: 0.1, shape: 0, core: 0.3 });
        }
        prev.copy(head.position);
      },
      done: () => {
        this.scene.remove(head);
        // Small landings throw sparks only; the slow glowing embers are kept for the big ones.
        this.burst(to, color, big ? (mine ? 16 : 8) : mine ? 6 : 3, big ? 4.5 : 3, big && mine);
        if (big && mine && this.impactOk(0.25)) this.shockwave(to, color, 2.2, 0.3, true);
        onHit?.();
      } });
  }
  // A star-shaped flash where something lands.
  flare(at, color, size = 2.5) {
    this.sparks.emit({ x: at.x, y: at.y, z: at.z + 0.2, c: hdr(color, 2.4), life: 0.22, size, end: 1.5, shape: 3, core: 1 });
    this.sparks.emit({ x: at.x, y: at.y, z: at.z + 0.2, c: hdr(color, 1.0), life: 0.3, size: size * 0.55, end: 1.8, shape: 0, core: 0.3 });
  }
  // Sparks that streak and fall, plus slower glowing embers.
  burst(at, color, n, speed, embers = true) {
    n = Math.min(80, Math.round(n * this.fxScale));
    const c = hdr(color, 2.4), w = hdr(color, 0.9);
    for (let i = 0; i < n; i++) {
      this.sparks.emit({ x: at.x, y: at.y, z: at.z, vx: (Math.random() - 0.5) * speed * 1.3, vy: Math.random() * speed * 1.2, vz: (Math.random() - 0.2) * speed * 1.3,
        c, life: rnd(0.3, 0.6), size: rnd(0.06, 0.11), end: 0.3, grav: 9, drag: 1.2, stretch: 0.045, shape: 1, core: 0.8 });
    }
    for (let i = 0; i < (embers ? n / 5 : 0); i++) {
      this.sparks.emit({ x: at.x, y: at.y, z: at.z, vx: (Math.random() - 0.5) * speed * 0.5, vy: Math.random() * speed * 0.5, vz: (Math.random() - 0.3) * speed * 0.5,
        c: w, life: rnd(0.5, 0.9), size: rnd(0.22, 0.4), end: 1.6, grav: -0.6, drag: 2, shape: 0, core: 0.2 });
    }
  }
  // Light sucked into a point (wind-ups).
  charge(at, color, n, r) {
    const c = hdr(color, 2.4);
    for (let i = 0; i < n * this.fxScale; i++) {
      const d = V3(rnd(-1, 1), rnd(-1, 1), rnd(-0.5, 1)).normalize().multiplyScalar(r * rnd(0.7, 1)), life = rnd(0.45, 0.7);
      this.sparks.emit({ x: at.x + d.x, y: at.y + d.y, z: at.z + d.z, vx: -d.x / life, vy: -d.y / life, vz: -d.z / life, c, life, size: rnd(0.06, 0.1), stretch: 0.05, shape: 1, core: 0.7, delay: rnd(0, 0.3) });
    }
  }
  // Dust kicked out along the ground.
  dustRing(at, radius, color, n) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n * this.fxScale; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(0, 0.3), s = radius * rnd(1.2, 1.8);
      this.dust.emit({ x: at.x + Math.cos(a) * 0.5, y: 0.25, z: at.z + Math.sin(a) * 0.5, vx: Math.cos(a) * s, vy: rnd(0.4, 1.4), vz: Math.sin(a) * s,
        c, life: rnd(0.8, 1.2), size: rnd(0.5, 0.9), end: 2.4, drag: 2.4, grav: -0.2, shape: 0, core: 0 });
    }
  }
  slashAt(at, color) {
    const g = geo("slash", () => new THREE.TorusGeometry(0.9, 0.07, 6, 28, Math.PI * 0.7));
    for (let i = -1; i <= 1; i++) {
      const arc = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: hdr(color, i ? 1.8 : 2.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      arc.position.copy(at).add(V3(i * 0.25, 0, 0.5)); arc.rotation.set(0, 0, -0.6 + i * 0.1);
      this.scene.add(arc);
      this.fx.push({ obj: arc, life: 0.4, t: 0, update: (f) => { const k = f.t / f.life; arc.material.opacity = 1 - k; arc.rotation.z = -0.6 + i * 0.1 - ease(Math.min(1, k * 2)) * 1.2; arc.scale.setScalar(1 + f.t * 1.5); }, done: () => this.scene.remove(arc) });
    }
    this.burst(at, color, 14, 4);
    this.flare(at, color, 2.2);
  }
  shockwave(at, color, radius, life, vertical = false) {
    const ring = new THREE.Mesh(geo("plane", () => new THREE.PlaneGeometry(2, 2)), ringMat(color));
    ring.position.copy(at);
    if (vertical) ring.lookAt(this.camera.position); else ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 12;
    this.scene.add(ring);
    const u = ring.material.uniforms;
    this.fx.push({ obj: ring, life, t: 0, update: (f) => {
      const k = f.t / f.life, s = 0.5 + radius * ease(k);
      ring.scale.setScalar(s / 0.86);
      u.uW.value = Math.min(0.5, (0.22 * (1 - k) + 0.05) / s);
      u.uOp.value = (1 - k) * (1 - k * 0.3);
    }, done: () => this.scene.remove(ring) });
  }
  decal(at, r, color, life) {
    const d = new THREE.Mesh(geo("decalRing", () => new THREE.RingGeometry(0.75, 1, 48)), new THREE.MeshBasicMaterial({ color: hdr(color, 1.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    const fill = new THREE.Mesh(geo("decalFill", () => new THREE.CircleGeometry(1, 48)), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
    d.rotation.x = fill.rotation.x = -Math.PI / 2; d.position.set(at.x, 0.04, at.z); fill.position.set(at.x, 0.035, at.z);
    d.scale.setScalar(r);
    this.scene.add(d, fill);
    this.fx.push({ obj: d, extra: fill, life, t: 0, update: (f) => { const k = f.t / f.life; d.material.opacity = 0.5 + Math.sin(f.t * 18) * 0.3; fill.material.opacity = 0.28 * k; fill.scale.setScalar(Math.max(0.001, r * k)); }, done: () => this.scene.remove(d, fill) });
  }
  beam(a, b, color) {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(geo("beam", () => new THREE.CylinderGeometry(0.08, 0.08, 1, 8, 1, true)), new THREE.MeshBasicMaterial({ color: hdr(color, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(a).lerp(b, 0.5); m.lookAt(b); m.rotateX(Math.PI / 2);
    this.scene.add(m);
    this.fx.push({ obj: m, life: 0.5, t: 0, update: (f) => { m.material.opacity = 1 - f.t / f.life; m.scale.set(1 + f.t * 3, len, 1 + f.t * 3); }, done: () => this.scene.remove(m) });
    m.scale.y = len;
    const c = hdr(color, 2);
    for (let i = 0; i <= 8; i++) { const p = a.clone().lerp(b, i / 8); this.sparks.emit({ x: p.x, y: p.y, z: p.z, vy: rnd(0.2, 0.8), c, life: 0.5, size: 0.14, end: 0.3, shape: 0, core: 0.6, delay: i * 0.02 }); }
  }
  pillar(at, color) {
    const m = new THREE.Mesh(geo("pillar", () => new THREE.CylinderGeometry(0.6, 0.6, 4, 24, 1, true)), new THREE.MeshBasicMaterial({ color: hdr(color, 1.15), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(at.x, 2, at.z); this.scene.add(m);
    this.fx.push({ obj: m, life: 0.8, t: 0, update: (f) => { const k = f.t / f.life; m.material.opacity = 0.4 * (1 - k) * (1 - k); m.scale.set(1 - k * 0.6, 1 + k, 1 - k * 0.6); }, done: () => this.scene.remove(m) });
    const c = hdr(color, 2.4);
    for (let i = 0; i < 16 * this.fxScale; i++) { const a = Math.random() * Math.PI * 2, r = rnd(0.2, 0.6);
      this.sparks.emit({ x: at.x + Math.cos(a) * r, y: rnd(0, 0.6), z: at.z + Math.sin(a) * r, vy: rnd(3, 6), c, life: rnd(0.4, 0.7), size: rnd(0.06, 0.1), stretch: 0.04, drag: 1, shape: 1, core: 0.8 }); }
    this.burst(V3(at.x, 0.5, at.z), color, 10, 3);
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
    const r = this.host.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Portrait phones need a wider view to fit the boss and the squad.
    this.baseFov = this.camera.aspect < 0.7 ? 58 : 48;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    if (this.post) { this.post.composer.setPixelRatio(this.renderer.getPixelRatio()); this.post.composer.setSize(w, h); }
    this.vpH = h * this.renderer.getPixelRatio();
    if (this.heroes.size) this.layout(false);
  }
  loop() {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now(), ms = this.lastNow ? now - this.lastNow : 16.7;
    this.lastNow = now;
    this.monitor(ms);
    const real = Math.min(0.05, ms / 1000);
    this.realT += real;
    // Hit-stop and the K.O. slow motion scale game time.
    let scale = 1;
    if (this.freeze > 0) { this.freeze -= real; scale = 0; }
    else if (this.slowmo) {
      const s = this.slowmo; s.t += real;
      scale = s.t < s.hold ? s.scale : s.scale + (1 - s.scale) * easeIO(Math.min(1, (s.t - s.hold) / s.out));
      if (s.t >= s.hold + s.out) this.slowmo = null;
    }
    const dt = real * scale;
    this.t += dt;
    this.updateCamera(real);
    // Heroes glide to their spots.
    for (const h of this.heroes.values()) { h.w.group.position.lerp(h.target, Math.min(1, dt * 5)); h.w.update(dt); this.updateHero(h, dt, real); }
    this.updateBoss(dt, real);
    this.updateLook(real);
    this.moteT += dt * this.look.speed;
    const mu = this.motes.material.uniforms;
    mu.uTime.value = this.moteT;
    mu.uScale.value = this.vpH / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.bossRing.material.opacity = 0.4 + Math.sin(this.t * 2) * 0.15;
    for (const f of this.fx) { f.t += dt; f.update?.(f, dt); }
    // Finish effects only after the list is rebuilt: a finish that starts a new effect (a crit's landing ring) would
    // otherwise push it onto the old list and lose it, leaving it stuck on screen for the rest of the fight.
    const ended = [];
    this.fx = this.fx.filter((f) => (f.t >= f.life ? (ended.push(f), false) : true));
    for (const f of ended) { f.done?.(); freeObj(f.obj); freeObj(f.extra); }
    this.sparks.time = this.dust.time = this.t;
    // Without bloom, stacked HDR sparks clip to white: run them a little cooler.
    this.sparks.mat.uniforms.uGain.value = this.post ? 1 : 0.62;
    this.sparks.flush(); this.dust.flush();
    // Screen flash.
    if (this.flashAmt > 0) this.flashAmt = Math.max(0, this.flashAmt - real * 4.5);
    this.flashMesh.visible = !this.post && this.flashAmt > 0.005;
    this.flashMesh.material.opacity = this.flashAmt;
    if (this.post) this.post.grade.uniforms.uFlash.value.set(this.flashMesh.material.color.r, this.flashMesh.material.color.g, this.flashMesh.material.color.b).multiplyScalar(this.flashAmt);
    if (this.post) this.post.composer.render(real);
    else this.renderer.render(this.scene, this.camera);
  }
  updateBoss(dt, real) {
    const B = this.boss; if (!B || !B.holder) return;
    B.actT = (B.actT || 0) + dt;
    B.mixer?.update(dt);
    B.tick?.(dt);
    const H = B.holder;
    const grow = B.grow || 1;
    // Built-in bosses are animated by hand; models use their clips plus these extras.
    let sy = 1, sx = 1, ry = 0, y = 0, z = this.bossZ, rx = 0, x = 0;
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
      if (B.raise) { y += 0.9 + Math.sin(this.t * 18) * 0.06; rx = -0.25; sy += 0.06; }
      if (B.inhale) { sx += 0.1; sy += 0.05; rx = -0.15; }
      if (B.reel) { B.reel = Math.max(0, B.reel - dt * 1.5); rx = 0.35 * Math.sin(B.reel * Math.PI); z -= B.reel * 0.8; }
      if (B.blink) {
        B.blink.t -= dt;
        const k = Math.sin(Math.max(0, Math.min(1, 1 - B.blink.t / 0.9)) * Math.PI);
        x = B.blink.x * k * 0.85; z += (B.blink.z - z) * k * 0.55;
        if (B.blink.t <= 0) B.blink = null;
      }
    } else {
      const k = Math.min(1, B.actT / 1.2);
      if (!B.mixer || !B.clips.death) { rx = -k * 1.4; y = -k * 0.4; }
      sy = 1 - (B.mixer ? 0 : k * 0.1);
      if (B.squash) { sx += B.squash; sy -= B.squash; B.squash *= Math.pow(0.001, dt * 6); if (B.squash < 0.002) B.squash = 0; }
    }
    H.scale.set(sx * grow, sy * grow, sx * grow);
    H.position.set(x, y + (B.hover ? Math.sin(this.t * 1.6) * 0.15 : 0), z);
    // Vanish: fade out to a shimmer, then back.
    const fade = B.ghost ? Math.max(0.1, (B.fadeK ?? 1) - dt * 3) : Math.min(1, (B.fadeK ?? 1) + dt * 5);
    if (fade !== B.fadeK) {
      const was = B.fadeK; B.fadeK = fade;
      for (const m of B.allMats || []) {
        const t = fade < 1 || m.userData.baseT;
        if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; }
        m.opacity = (m.userData.baseOp ?? 1) * fade;
      }
      if ((was >= 1) !== (fade >= 1)) for (const o of B.shells || []) o.visible = fade >= 1 && !this.dissolveAt;
    }
    H.rotation.set(rx, ry, 0);
    // K.O. dissolve: the boss burns away from the top down into rising particles.
    if (this.dissolveAt != null && B.dis) {
      const k = Math.max(0, Math.min(1, (this.realT - this.dissolveAt) / 1.25));
      if (k > 0) {
        if (!B.disStarted) { B.disStarted = true; for (const o of B.shells || []) o.visible = false; }
        const h = (B.height || 5) * H.scale.y;
        B.dis.dis.value = k * 1.05; B.dis.h.value = h; B.dis.base.value = H.position.y + (B.hover || 0);
        if (k < 1) {
          const front = B.dis.base.value + h * (1 - k * 0.9), r = h * 0.22, c1 = hdr(this.look.ring.getHex(), 2.6), c2 = hdr(0xffffff, 1.6);
          for (let i = 0; i < Math.ceil(real * 220 * this.fxScale); i++) {
            const a = Math.random() * Math.PI * 2, rr = r * Math.sqrt(Math.random());
            this.sparks.emit({ x: H.position.x + Math.cos(a) * rr, y: front + rnd(-0.6, 0.3), z: H.position.z + 0.6 + Math.sin(a) * rr * 0.6,
              vx: rnd(-0.8, 0.8), vy: rnd(1.2, 3), vz: rnd(-0.4, 0.8), c: Math.random() < 0.8 ? c1 : c2, life: rnd(0.8, 1.5), size: rnd(0.07, 0.14), drag: 0.6, grav: -0.8, shape: Math.random() < 0.3 ? 1 : 0, stretch: 0.03, core: 0.7 });
          }
        } else H.visible = false;
      }
    }
    // Hit flash: push the emissive up and fade it out.
    if (B.flash > 0) B.flash = Math.max(0, B.flash - Math.max(dt, real * 0.5) * 6); // still fades (slower) through a hit-stop
    const feast = B.feastGlow > 0 ? (B.feastGlow -= dt, 0.25 + Math.sin(this.t * 10) * 0.15) : 0;
    const wind = B.windup ? 0.18 + Math.sin(this.t * 20) * 0.08 : 0;
    const fl = B.flash * 0.28; // with bloom on, a full-white flash blows the whole boss out
    for (const m of B.mats || []) m.emissive.setRGB(fl + feast + wind, fl * 0.9 + feast * 0.7, fl * 0.8);
    // Built-in limbs.
    const parts = B.built?.parts;
    if (parts && !B.dead) {
      const swing = B.act === "atk-swipe" && B.actT < 0.5 ? Math.sin(B.actT / 0.5 * Math.PI) * 1.6 : 0;
      if (parts.armL) parts.armL.rotation.z = -0.5 - Math.sin(this.t * 2.2) * 0.12 - (B.windup ? 0.8 : 0);
      if (parts.armR) parts.armR.rotation.z = 0.5 + Math.sin(this.t * 2.2) * 0.12 + (B.windup ? 0.8 : 0) + swing;
      if (parts.antenna) parts.antenna.userData.main.material.emissive.setRGB(0.4 + Math.sin(this.t * 6) * 0.3, 0.05, 0.05);
      if (parts.bag) parts.bag.rotation.z = -(parts.armR?.rotation.z || 0) + Math.sin(this.t * 3) * 0.12; // hangs from the fist
      if (B.built.drawFace && (Math.floor(this.t * 4) !== B.lastFaceTick)) {
        B.lastFaceTick = Math.floor(this.t * 4);
        B.built.drawFace(B.windup || B.act.startsWith("atk") ? 1 : 0, Math.random() < 0.06);
      }
    }
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    clearTimeout(this.boss?.backT);
    for (const h of this.heroes.values()) h.w.dispose?.();
    this.disablePost();
    this.scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material && o.material !== OUTLINE) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // browsers cap live WebGL contexts; don't leave this one hanging
    this.renderer.domElement.remove();
  }
}

let supportedCache = null;
window.Arena3D = {
  create(host, opts) { return new Arena(host, opts); },
  // Probed once: every probe would otherwise hold a WebGL context open.
  supported() {
    if (supportedCache === null) {
      try { const c = document.createElement("canvas"), gl = c.getContext("webgl2") || c.getContext("webgl"); supportedCache = !!gl; gl?.getExtension("WEBGL_lose_context")?.loseContext(); }
      catch { supportedCache = false; }
    }
    return supportedCache;
  },
  hasWalkers: !!buildWalker,
  portrait,
  preview,
};
window.dispatchEvent(new Event("arena3d-ready"));
