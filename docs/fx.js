// Effort battle effects: a canvas particle layer (sparks, slashes, shockwaves, coins, damage numbers),
// screen shake, synthesised sound effects (no audio files) and haptics.
(function (root) {
"use strict";

// ---------- particles ----------
let cv = null, ctx = null, host = null, parts = [], raf = 0, dpr = 1, W = 0, H = 0;
function init(el) {
  host = el;
  cv = document.createElement("canvas");
  cv.className = "fx-layer";
  cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6";
  el.appendChild(cv);
  ctx = cv.getContext("2d");
  resize();
  parts = [];
}
function resize() {
  if (!cv || !host) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = host.getBoundingClientRect();
  W = r.width; H = r.height;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
function destroy() { cancelAnimationFrame(raf); raf = 0; parts = []; cv?.remove(); cv = ctx = host = null; MUS.want = false; stopMusic(); }
// Convert a page point to canvas space.
function local(x, y) { const r = host.getBoundingClientRect(); return [x - r.left, y - r.top]; }
function centre(el) { const r = el.getBoundingClientRect(), h = host.getBoundingClientRect(); return [r.left + r.width / 2 - h.left, r.top + r.height / 2 - h.top]; }

function add(p) { if (!ctx) return; parts.push({ t: 0, ...p }); if (!raf) raf = requestAnimationFrame(loop); }
let last = 0;
function loop(now) {
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
  last = now;
  ctx.clearRect(0, 0, W, H);
  parts = parts.filter((p) => (p.t += dt) < p.life);
  for (const p of parts) draw(p, dt);
  if (parts.length) raf = requestAnimationFrame(loop); else { raf = 0; last = 0; }
}
const ease = (k) => 1 - (1 - k) ** 3;
function draw(p, dt) {
  const k = p.t / p.life;
  ctx.save();
  if (p.kind === "spark" || p.kind === "coin" || p.kind === "dust" || p.kind === "confetti" || p.kind === "plus" || p.kind === "star") {
    p.vy += (p.g ?? 900) * dt; p.vx *= p.drag ?? 0.985;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.spin) p.rot = (p.rot || 0) + p.spin * dt;
  }
  ctx.globalAlpha = Math.max(0, 1 - k ** 2);
  if (p.kind === "spark") {
    ctx.strokeStyle = p.color; ctx.lineWidth = p.size * (1 - k); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
  } else if (p.kind === "dust") {
    ctx.fillStyle = p.color; ctx.globalAlpha *= 0.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + k), 0, 7); ctx.fill();
  } else if (p.kind === "coin") {
    ctx.translate(p.x, p.y); ctx.scale(Math.abs(Math.cos((p.rot || 0))), 1);
    ctx.fillStyle = "#f5c542"; ctx.strokeStyle = "#8a5a00"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, p.size, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff6c8"; ctx.beginPath(); ctx.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.3, 0, 7); ctx.fill();
  } else if (p.kind === "confetti") {
    ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
  } else if (p.kind === "plus") {
    ctx.fillStyle = p.color; ctx.font = `900 ${p.size}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText("+", p.x, p.y);
  } else if (p.kind === "star") {
    ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.fillStyle = p.color; star(0, 0, p.size, p.size * 0.45);
  } else if (p.kind === "ring") {
    const r = p.r0 + (p.r1 - p.r0) * ease(k);
    ctx.strokeStyle = p.color; ctx.lineWidth = p.width * (1 - k) + 0.5;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * (p.squash || 1), 0, 0, 7); ctx.stroke();
  } else if (p.kind === "slash") {
    // A crescent swipe that draws on, then fades.
    const len = Math.min(1, k * 3);
    ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    const grad = ctx.createLinearGradient(-p.r, 0, p.r, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)"); grad.addColorStop(0.5, p.color); grad.addColorStop(1, "#fff");
    ctx.strokeStyle = grad; ctx.lineCap = "round";
    ctx.lineWidth = p.width * (1 - k);
    ctx.shadowColor = p.glow || p.color; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(0, p.r * 0.6, p.r, Math.PI * 1.15, Math.PI * (1.15 + 0.7 * len)); ctx.stroke();
  } else if (p.kind === "claw") {
    ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    ctx.strokeStyle = p.color; ctx.lineCap = "round"; ctx.shadowColor = p.color; ctx.shadowBlur = 16;
    const len = Math.min(1, k * 4);
    for (let i = -1; i <= 1; i++) { ctx.lineWidth = p.width * (1 - k); ctx.beginPath(); ctx.moveTo(-p.r, i * p.gap - p.r * 0.4); ctx.lineTo(-p.r + 2 * p.r * len, i * p.gap + p.r * 0.4 * (2 * len - 1)); ctx.stroke(); }
  } else if (p.kind === "glow") {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (0.6 + 0.6 * ease(k)));
    g.addColorStop(0, p.color); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.2, 0, 7); ctx.fill();
  } else if (p.kind === "text") {
    const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.7 : 1.3 - Math.min(0.3, (k - 0.12) * 1.2);
    const y = p.y - ease(k) * (p.rise ?? 70);
    // Full strength until the last third, then a quick fade (a long fade read as grey, low-contrast numbers).
    ctx.globalAlpha = k < 0.66 ? 1 : Math.max(0, 1 - (k - 0.66) / 0.34);
    ctx.translate(p.x + (p.drift || 0) * ease(k), y); ctx.scale(pop, pop);
    ctx.font = `400 ${p.size}px "Lilita One", "Arial Rounded MT Bold", system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineJoin = "round"; ctx.lineWidth = Math.max(5, p.size / 4.2); ctx.strokeStyle = p.stroke || "#0a0f26";
    ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowOffsetY = Math.max(2, p.size / 12);
    ctx.strokeText(p.text, 0, 0);
    ctx.shadowColor = "transparent";
    if (p.grad) { const g = ctx.createLinearGradient(0, -p.size / 2, 0, p.size / 2); g.addColorStop(0, p.grad[0]); g.addColorStop(1, p.grad[1]); ctx.fillStyle = g; } else ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
  } else if (p.kind === "beam") {
    ctx.globalAlpha *= 0.8; ctx.strokeStyle = p.color; ctx.lineWidth = p.width * (1 - k); ctx.lineCap = "round"; ctx.shadowColor = p.color; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.stroke();
  }
  ctx.restore();
}
function star(x, y, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- effect recipes ----------
function sparks(x, y, color = "#ffd166", n = 10, speed = 420) {
  for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), s = rnd(speed * 0.4, speed); add({ kind: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: rnd(0.25, 0.5), size: rnd(2, 4), color, g: 700 }); }
}
// A tap: a quick slash and a few sparks (a crit gets a small flash). Kept light: at 6 taps a second anything bigger
// piles up into a glow that hides the boss.
function tapHit(x, y, { color = "#ffb703", crit = false, dmg = 0, kind = "hit" } = {}) {
  add({ kind: "slash", x, y, angle: rnd(-0.9, 0.3), r: crit ? 56 : 38, width: crit ? 9 : 6, color, life: 0.22 });
  sparks(x, y, crit ? "#ff7a3d" : color, crit ? 9 : 4, crit ? 520 : 380);
  if (crit) { add({ kind: "glow", x, y, r: 46, color: "rgba(255,170,60,.4)", life: 0.18 }); for (let i = 0; i < 2; i++) add({ kind: "star", x, y, vx: rnd(-220, 220), vy: rnd(-380, -160), life: 0.55, size: rnd(5, 8), color: "#ffe066", spin: rnd(-8, 8), g: 900 }); }
  // Crits: bigger, warmer, a dark-red outline. Normal hits: white on a heavy ink outline, so they read on any backdrop.
  if (dmg) number(x, y, kind === "blocked" ? "BLOCKED" : fmtNum(dmg) + (crit ? "!" : ""), { tap: true, ...(crit ? { size: 38, grad: ["#fff6b0", "#ff8a2b"], stroke: "#4a1200", crit: true } : kind === "weak" ? { size: 30, grad: ["#e6fbff", "#2bb3ff"], stroke: "#06253f" } : kind === "blocked" ? { size: 20, color: "#d4dcff" } : { size: 25, color: "#ffffff", stroke: "#0a0f26" }) });
}
// Kept clear of the screen edges so long words like "BIG SWING!" stay readable. Numbers are always formatted.
// tap: damage numbers alternate between a lane left and a lane right of where you hit, with some jitter, and pop
// outwards (a short lift, a long sideways arc) instead of rising up into the boss's face. Only a few show at once,
// and a new one steps past a live one in its lane rather than landing on top of it.
let lane = 0;
function number(x, y, text, o = {}) {
  if (typeof text === "number") text = fmtNum(text);
  if (o.tap) {
    const live = parts.filter((p) => p.tap);
    if (live.length >= 5) live.slice(0, live.length - 4).forEach((p) => (p.t = p.life));
    const side = lane++ % 2 ? 1 : -1;
    x += side * rnd(30, 58); y += rnd(-12, 12);
    for (const p of live) if (p.side === side && p.t < p.life * 0.7 && Math.abs(p.y - y) < 30) y = p.y + 34;
    o = { life: o.crit ? 0.85 : 0.65, rise: rnd(12, 26), drift: side * rnd(46, 76), side, ...o };
  }
  const pad = Math.min(W / 2, String(text).length * 8 + 22); x = Math.max(pad, Math.min(W - pad, x));
  add({ kind: "text", x, y, text, size: 26, color: "#fff", life: 0.75, rise: 110, drift: rnd(-60, 60), ...o });
}
// Drop every floating word and number (the K.O. clears the fight's callouts in one go).
function clearText() { for (const p of parts) if (p.kind === "text") p.t = p.life; }
function fmtNum(n) { return n >= 1e4 ? (n / 1000).toFixed(1) + "k" : Math.max(1, Math.round(n)).toString(); }
function ring(x, y, o = {}) { add({ kind: "ring", x, y, r0: 10, r1: 160, width: 10, color: "rgba(255,255,255,.9)", life: 0.6, ...o }); }
function coins(x, y, n = 8, toX, toY) {
  for (let i = 0; i < n; i++) add({ kind: "coin", x, y, vx: rnd(-260, 260) + (toX != null ? (toX - x) * 0.9 : 0), vy: rnd(-620, -320) + (toY != null ? (toY - y) * 0.6 : 0), life: rnd(0.8, 1.2), size: rnd(6, 9), spin: rnd(6, 14), g: 1100 });
}
function confetti(n = 120) {
  const cols = ["#f2611d", "#f5c542", "#2f7d4f", "#74b6e0", "#d9483b", "#ffffff"];
  for (let i = 0; i < n; i++) add({ kind: "confetti", x: rnd(0, W), y: rnd(-60, -10), vx: rnd(-80, 80), vy: rnd(60, 260), life: rnd(1.8, 3.2), size: rnd(8, 14), color: cols[i % cols.length], spin: rnd(-10, 10), g: 220, drag: 0.995 });
}
function heal(x, y) {
  for (let i = 0; i < 9; i++) add({ kind: "plus", x: x + rnd(-24, 24), y: y + rnd(-6, 10), vx: rnd(-20, 20), vy: rnd(-160, -90), life: rnd(0.8, 1.2), size: rnd(16, 26), color: i % 2 ? "#5fe08f" : "#bff5cf", g: -40 });
  add({ kind: "glow", x, y, r: 50, color: "rgba(95,224,143,.6)", life: 0.6 });
}
function shieldDome(x, y, w) {
  add({ kind: "ring", x, y, r0: w * 0.3, r1: w * 0.62, squash: 0.45, width: 8, color: "rgba(120,200,255,.95)", life: 0.7 });
  add({ kind: "glow", x, y, r: w * 0.5, color: "rgba(120,200,255,.45)", life: 0.7 });
  sparks(x, y, "#a8e1ff", 14, 300);
}
function claw(x, y, color = "#ff4d6d") { add({ kind: "claw", x, y, angle: rnd(-0.5, -0.2), r: 60, gap: 18, width: 9, color, life: 0.45 }); sparks(x, y, color, 12, 500); }
function stompWave(x, y) {
  ring(x, y, { r1: W * 0.9, squash: 0.28, width: 18, color: "rgba(255,200,120,.95)", life: 0.7 });
  ring(x, y, { r1: W * 0.6, squash: 0.28, width: 10, color: "rgba(255,255,255,.8)", life: 0.5 });
  for (let i = 0; i < 26; i++) add({ kind: "dust", x: x + rnd(-W * 0.4, W * 0.4), y: y + rnd(-8, 8), vx: rnd(-60, 60), vy: rnd(-160, -40), life: rnd(0.6, 1), size: rnd(8, 18), color: "#c9b48a", g: 200 });
}
function screamWaves(x, y) {
  for (let i = 0; i < 4; i++) setTimeout(() => ring(x, y, { r0: 30, r1: Math.max(W, H), width: 14 - i * 2, color: `rgba(255,${90 + i * 30},${120 + i * 20},.9)`, life: 0.8 }), i * 110);
}
function beam(x, y, x2, y2, color = "#ffd166", width = 10) { add({ kind: "beam", x, y, x2, y2, color, width, life: 0.3 }); }
function chomp(x, y) { for (let i = 0; i < 14; i++) add({ kind: "spark", x, y, vx: rnd(-300, 300), vy: rnd(-300, 50), life: rnd(0.3, 0.6), size: rnd(3, 6), color: i % 2 ? "#ffcf6e" : "#ff8fa3", g: 600 }); }

function shake(el, strength = 8, ms = 280) {
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const start = performance.now();
  const step = (now) => {
    const k = (now - start) / ms;
    if (k >= 1) { el.style.transform = ""; return; }
    const s = strength * (1 - k);
    el.style.transform = `translate(${rnd(-s, s)}px, ${rnd(-s, s)}px)`;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function flash(el, cls = "fx-flash", ms = 260) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); }

// ---------- sound ----------
// Everything is synthesised. Hits are layered (a click for the transient, a pitched body, a filtered tail),
// a little saturation gives weight, and a shared synthetic room adds space to the bigger moments.
let ac = null, master = null, crunch = null, verbIn = null, noiseBuf = null, voices = 0;
let muted = false;
try { muted = localStorage.getItem("ef_mute") === "1"; } catch { /* ignore */ }
const MAX_VOICES = 72;
function audio() {
  if (muted) return null;
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.5;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.18;
    master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    try {
      // Saturation bus: bodies routed here get thicker without getting louder.
      crunch = ac.createWaveShaper(); crunch.curve = satCurve(2.6); crunch.oversample = "2x";
      const cg = ac.createGain(); cg.gain.value = 0.7; crunch.connect(cg); cg.connect(master);
      // Reverb send: a generated 1.6s decay, high-passed so the lows stay tight.
      verbIn = ac.createGain();
      const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 220;
      const conv = ac.createConvolver(); conv.buffer = impulse(1.6, 2.8);
      const vg = ac.createGain(); vg.gain.value = 0.5;
      verbIn.connect(hp); hp.connect(conv); conv.connect(vg); vg.connect(master);
    } catch { crunch = verbIn = null; }
  }
  if (ac.state === "suspended") ac.resume();
  return ac;
}
function satCurve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }
function impulse(sec, decay) {
  const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decay; }
  return b;
}
// Route a voice's gain node: dry to the master (or through the saturator), optionally some to the room.
function route(g, t, { send = 0, drive = false, pan = 0, dest = null } = {}) {
  let node = g;
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
  node.connect(dest || (drive && crunch ? crunch : master));
  if (send > 0 && verbIn) { const s = ac.createGain(); s.gain.value = send; node.connect(s); s.connect(verbIn); }
}
function voice(src) { voices++; src.onended = () => { voices--; }; }
function tone(freq, { type = "sine", dur = 0.12, vol = 0.4, at = 0, to = null, attack = 0.005, send = 0, drive = false, pan = 0, dest = null, detune = 0 } = {}) {
  const a = audio(); if (!a || voices > MAX_VOICES) return;
  const t = a.currentTime + Math.max(0, at), o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (detune) o.detune.value = detune;
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); route(g, t, { send, drive, pan, dest }); voice(o); o.start(t); o.stop(t + dur + 0.03);
}
function noise({ dur = 0.15, vol = 0.4, at = 0, type = "bandpass", freq = 1200, to = null, q = 1, attack = 0, send = 0, drive = false, pan = 0, dest = null } = {}) {
  const a = audio(); if (!a || voices > MAX_VOICES) return;
  const t = a.currentTime + Math.max(0, at), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random() * 0.5; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  if (attack > 0) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); } else g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); route(g, t, { send, drive, pan, dest }); voice(s); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
}
// Layer helpers.
const click = (at = 0, vol = 0.4, freq = 4000) => noise({ dur: 0.016, vol, type: "highpass", freq, at });
const thump = (f0, f1, dur, vol, at = 0) => { tone(f0, { dur, vol, to: f1, at }); tone(f0 * 2, { type: "triangle", dur: dur * 0.5, vol: vol * 0.5, to: f1 * 2, at, drive: true }); };
const debris = (n, at, spread, vol) => { for (let i = 0; i < n; i++) noise({ dur: rnd(0.02, 0.05), vol: vol * rnd(0.5, 1), freq: rnd(1500, 5000), q: 2, at: at + rnd(0, spread), pan: rnd(-0.6, 0.6) }); };

let lastHit = 0;
const SOUNDS = {
  hit() {
    const now = performance.now(); if (now - lastHit < 35) return; lastHit = now;
    const p = rnd(0.9, 1.12), pan = rnd(-0.25, 0.25);
    click(0, 0.4, 3600 * p);
    tone(200 * p, { type: "triangle", dur: 0.085, vol: 0.42, to: 72, drive: true, pan });
    tone(105 * p, { dur: 0.12, vol: 0.3, to: 48 });
    noise({ dur: 0.13, vol: 0.16, freq: 1500 * p, to: 500, q: 0.9, at: 0.008, send: 0.12, pan });
  },
  crit() {
    click(0, 0.55, 4800);
    noise({ dur: 0.1, vol: 0.42, freq: 3200, to: 900, q: 0.8, drive: true });
    tone(140, { type: "triangle", dur: 0.12, vol: 0.45, to: 55, drive: true });
    thump(92, 38, 0.32, 0.6);
    tone(1568, { dur: 0.5, vol: 0.1, at: 0.015, send: 0.55 }); tone(2349, { dur: 0.38, vol: 0.06, at: 0.025, send: 0.55, detune: 8 });
    noise({ dur: 0.35, vol: 0.1, type: "highpass", freq: 7000, at: 0.03, send: 0.45 });
  },
  blocked() { tone(1900, { type: "square", dur: 0.04, vol: 0.1 }); tone(1300, { type: "square", dur: 0.05, vol: 0.09, at: 0.04 }); tone(2600, { dur: 0.25, vol: 0.05, at: 0.02, send: 0.5 }); },
  weak() { click(0, 0.35, 5000); tone(880, { type: "triangle", dur: 0.08, vol: 0.28 }); tone(1320, { type: "triangle", dur: 0.18, vol: 0.26, at: 0.05, send: 0.3 }); noise({ dur: 0.1, vol: 0.35, freq: 2600 }); thump(110, 50, 0.15, 0.35); },
  coin() { tone(988, { type: "square", dur: 0.07, vol: 0.11 }); tone(1319, { type: "square", dur: 0.24, vol: 0.11, at: 0.07, send: 0.25 }); },
  combo() { [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: "triangle", dur: 0.14, vol: 0.17, at: i * 0.05, send: 0.25 })); },
  ko() {
    click(0, 0.6, 3000); thump(70, 24, 1.1, 0.95);
    noise({ dur: 0.9, vol: 0.55, type: "lowpass", freq: 1400, to: 90, drive: true });
    tone(220, { type: "sawtooth", dur: 0.7, vol: 0.2, to: 50, drive: true });
    debris(8, 0.05, 0.5, 0.22);
    noise({ dur: 1.4, vol: 0.18, freq: 5000, to: 1200, q: 0.6, at: 0.15, send: 0.6 });
    [392, 523, 659, 784].forEach((f, i) => tone(f, { type: "triangle", dur: 0.45, vol: 0.17, at: 0.45 + i * 0.09, send: 0.45 }));
    [1047, 1319, 1568].forEach((f) => tone(f, { type: "triangle", dur: 1.1, vol: 0.08, at: 0.85, send: 0.6 }));
  },
  audit() { tone(440, { type: "square", dur: 0.12, vol: 0.15 }); tone(330, { type: "square", dur: 0.18, vol: 0.15, at: 0.13 }); noise({ dur: 0.35, vol: 0.25, freq: 600, to: 2400 }); },
  receipt() { tone(1568, { dur: 0.1, vol: 0.12 }); tone(2093, { dur: 0.15, vol: 0.12, at: 0.06, send: 0.2 }); },
  warn() { tone(700, { type: "sawtooth", dur: 0.12, vol: 0.11 }); tone(700, { type: "sawtooth", dur: 0.12, vol: 0.11, at: 0.2 }); tone(350, { type: "square", dur: 0.32, vol: 0.05, send: 0.2 }); },
  roar() {
    tone(140, { type: "sawtooth", dur: 0.75, vol: 0.28, to: 60, drive: true }); tone(147, { type: "sawtooth", dur: 0.75, vol: 0.2, to: 58, detune: 12 });
    noise({ dur: 0.75, vol: 0.4, type: "lowpass", freq: 900, to: 200, attack: 0.06, send: 0.3 });
  },
  swipe() { noise({ dur: 0.22, vol: 0.55, freq: 500, to: 4500, q: 2, attack: 0.03 }); click(0.13, 0.4, 2500); thump(160, 60, 0.18, 0.4, 0.13); },
  stomp() { thump(72, 28, 0.6, 0.95); noise({ dur: 0.5, vol: 0.6, type: "lowpass", freq: 500, to: 60, drive: true }); debris(5, 0.04, 0.3, 0.16); noise({ dur: 0.6, vol: 0.1, freq: 900, q: 0.5, send: 0.5 }); },
  scream() { for (let i = 0; i < 3; i++) tone(600 + i * 170, { type: "sawtooth", dur: 0.65, vol: 0.09, to: 300 + i * 80, at: i * 0.03, send: 0.35, drive: true }); noise({ dur: 0.65, vol: 0.28, freq: 1800, q: 4, attack: 0.05 }); },
  feast() { for (let i = 0; i < 4; i++) { noise({ dur: 0.07, vol: 0.5, freq: 900, at: i * 0.14, drive: true }); tone(160, { type: "square", dur: 0.06, vol: 0.12, at: i * 0.14 }); } },
  shield() { noise({ dur: 0.35, vol: 0.32, freq: 300, to: 3200, q: 1.5, attack: 0.04 }); [660, 990, 1320].forEach((f, i) => tone(f, { dur: 0.5, vol: 0.09, at: 0.05 + i * 0.03, send: 0.5 })); },
  // Big Swing: the wind-up whoosh, then the landing when the shot hits.
  swing() { noise({ dur: 0.3, vol: 0.5, freq: 200, to: 1800, q: 1.2, attack: 0.08 }); tone(110, { type: "sawtooth", dur: 0.3, vol: 0.18, to: 230 }); click(0.34, 0.5, 3000); thump(120, 40, 0.3, 0.7, 0.34); noise({ dur: 0.2, vol: 0.25, freq: 1800, to: 500, at: 0.35, send: 0.3 }); },
  heal() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { dur: 0.35, vol: 0.11, at: i * 0.06, send: 0.45 })); },
  hurt() { click(0, 0.35, 2500); tone(260, { type: "square", dur: 0.12, vol: 0.14, to: 120, drive: true }); noise({ dur: 0.12, vol: 0.35, freq: 900 }); thump(90, 45, 0.15, 0.4); },
  down() { tone(392, { type: "triangle", dur: 0.25, vol: 0.24, to: 98 }); tone(196, { type: "triangle", dur: 0.55, vol: 0.2, to: 60, at: 0.2, send: 0.3 }); thump(80, 35, 0.3, 0.5, 0.2); },
  revive() { [392, 494, 587, 784].forEach((f, i) => tone(f, { type: "triangle", dur: 0.35, vol: 0.17, at: i * 0.07, send: 0.4 })); noise({ dur: 0.5, vol: 0.12, freq: 3000, to: 8000, attack: 0.2, send: 0.4 }); },
  tick() { tone(1200, { type: "square", dur: 0.03, vol: 0.08 }); },
  right() { tone(784, { type: "triangle", dur: 0.12, vol: 0.25 }); tone(1175, { type: "triangle", dur: 0.28, vol: 0.25, at: 0.1, send: 0.3 }); },
  wrong() { tone(196, { type: "sawtooth", dur: 0.3, vol: 0.18 }); tone(185, { type: "sawtooth", dur: 0.3, vol: 0.18 }); },
  rare() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, { type: "triangle", dur: 0.28, vol: 0.13, at: i * 0.05, send: 0.4 })); noise({ dur: 0.4, vol: 0.15, freq: 6000, send: 0.3 }); },
  stun() { for (let i = 0; i < 6; i++) tone(1800 - i * 200, { type: "square", dur: 0.05, vol: 0.08, at: i * 0.05, send: 0.2 }); },
  phase() {
    thump(65, 30, 1.0, 0.8); tone(98, { type: "sawtooth", dur: 1.2, vol: 0.26, to: 49, drive: true }); tone(103, { type: "sawtooth", dur: 1.2, vol: 0.16, to: 51 });
    noise({ dur: 1.0, vol: 0.3, type: "lowpass", freq: 400, to: 120, attack: 0.1 });
    noise({ dur: 1.4, vol: 0.12, freq: 1200, to: 4000, q: 3, attack: 0.5, send: 0.6 });
  },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: "triangle", dur: 0.2, vol: 0.2, at: i * 0.1, send: 0.3 })); [1047, 1319, 1568].forEach((f) => tone(f, { type: "triangle", dur: 0.9, vol: 0.11, at: 0.45, send: 0.5 })); },
  lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, { type: "triangle", dur: 0.38, vol: 0.17, at: i * 0.2, send: 0.35 })); },
  buy() { tone(1319, { type: "square", dur: 0.06, vol: 0.1 }); tone(1760, { type: "square", dur: 0.12, vol: 0.1, at: 0.06 }); noise({ dur: 0.15, vol: 0.15, freq: 5000, at: 0.02 }); },
  levelup() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, { type: "triangle", dur: 0.28, vol: 0.15, at: i * 0.07, send: 0.4 })); },
  tap() { tone(900, { type: "triangle", dur: 0.03, vol: 0.08 }); },
  // Class special: a rising charge, a bright chord, then the drop.
  special() {
    noise({ dur: 0.42, vol: 0.45, freq: 200, to: 6000, q: 1.2, attack: 0.3 });
    tone(220, { type: "sawtooth", dur: 0.4, vol: 0.1, to: 880, attack: 0.3, drive: true });
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { type: "sawtooth", dur: 0.26, vol: 0.075, at: 0.08 + i * 0.045, send: 0.35 }));
    click(0.36, 0.6, 3500); thump(80, 32, 0.6, 0.85, 0.36);
    noise({ dur: 0.5, vol: 0.2, freq: 2500, to: 700, at: 0.37, send: 0.4 });
    [1568, 2093].forEach((f, i) => tone(f, { dur: 0.8, vol: 0.06, at: 0.4 + i * 0.03, send: 0.7 }));
  },
  // Stagger: something cracks, glassy, with a bell on top.
  stagger() {
    click(0, 0.6, 5000); tone(1700, { type: "square", dur: 0.05, vol: 0.16 });
    tone(1100, { type: "triangle", dur: 0.4, vol: 0.2, to: 640, send: 0.35 });
    debris(6, 0.01, 0.12, 0.2); thump(110, 45, 0.25, 0.6);
    tone(2217, { dur: 0.7, vol: 0.07, at: 0.04, send: 0.6 }); tone(2960, { dur: 0.5, vol: 0.045, at: 0.05, send: 0.6, detune: -10 });
  },
  // Signature moves.
  ooze() {
    for (let i = 0; i < 3; i++) {
      const at = i * 0.11 + rnd(0, 0.03);
      tone(150 - i * 25, { dur: 0.08, vol: 0.32, to: 340, at });              // blorp up...
      tone(320 - i * 30, { dur: 0.16, vol: 0.3, to: 70, at: at + 0.07 });     // ...and down
      noise({ dur: 0.14, vol: 0.28, type: "lowpass", freq: 900, to: 250, q: 4, at, drive: true });
    }
    noise({ dur: 0.35, vol: 0.2, freq: 700, to: 2200, q: 6, at: 0.32, send: 0.25 }); // the splat
  },
  spores() {
    for (let i = 0; i < 4; i++) noise({ dur: 0.18, vol: 0.32, freq: rnd(2200, 3400), to: 800, q: 1, at: i * 0.13, pan: rnd(-0.5, 0.5) }); // pff, pff
    noise({ dur: 1.3, vol: 0.24, freq: 3000, to: 900, q: 0.7, attack: 0.25, at: 0.1, send: 0.45 });
    tone(233, { type: "triangle", dur: 1.2, vol: 0.08, to: 220, attack: 0.3, send: 0.5 }); tone(247, { type: "triangle", dur: 1.2, vol: 0.06, to: 233, attack: 0.3, send: 0.5 });
  },
  vanish() {
    noise({ dur: 0.65, vol: 0.32, freq: 5000, to: 300, q: 3, attack: 0.35, send: 0.5 });     // reversed-feel suck-in
    tone(1600, { dur: 0.6, vol: 0.1, to: 180, send: 0.6 }); tone(1900, { dur: 0.5, vol: 0.06, to: 220, at: 0.05, send: 0.6 });
    tone(80, { type: "sine", dur: 0.6, vol: 0.3, to: 40, attack: 0.3 });
  },
  appear() {
    noise({ dur: 0.22, vol: 0.5, freq: 300, to: 6000, q: 3 });
    click(0.18, 0.55, 3000); thump(110, 38, 0.35, 0.7, 0.18);
    noise({ dur: 0.4, vol: 0.14, type: "highpass", freq: 6000, at: 0.19, send: 0.5 });
  },
  gust() {
    noise({ dur: 1.1, vol: 0.5, freq: 350, to: 1700, q: 0.7, attack: 0.25 });
    noise({ dur: 0.9, vol: 0.28, freq: 1600, to: 450, q: 2.5, at: 0.2, pan: -0.4 });
    noise({ dur: 0.8, vol: 0.22, freq: 900, to: 2600, q: 3, at: 0.35, pan: 0.4, send: 0.3 });
    tone(55, { dur: 0.9, vol: 0.4, to: 42, attack: 0.2 });
  },
  grab() {
    noise({ dur: 0.16, vol: 0.6, type: "lowpass", freq: 1200, to: 200, drive: true }); click(0, 0.4, 2000);
    tone(110, { type: "square", dur: 0.3, vol: 0.16, to: 65, drive: true });
    for (let i = 0; i < 3; i++) { tone(260, { dur: 0.08, vol: 0.18, to: 110, at: 0.2 + i * 0.1 }); noise({ dur: 0.06, vol: 0.18, type: "lowpass", freq: 800, at: 0.2 + i * 0.1 }); }
    tone(70, { type: "sawtooth", dur: 0.6, vol: 0.08, to: 55, at: 0.15, send: 0.3 }); // creak
  },
  release() {
    click(0, 0.35, 4000); noise({ dur: 0.12, vol: 0.3, freq: 1200, to: 3500, q: 2 });
    [440, 660, 880, 1320].forEach((f, i) => tone(f, { type: "triangle", dur: 0.18, vol: 0.14, at: i * 0.045, send: 0.4 }));
  },
  slam() {
    noise({ dur: 0.18, vol: 0.25, freq: 400, to: 2400, q: 1, attack: 0.12 });           // the club coming down
    click(0.16, 0.7, 2500); thump(58, 22, 1.2, 1.0, 0.16);
    noise({ dur: 0.9, vol: 0.85, type: "lowpass", freq: 700, to: 40, at: 0.16, drive: true });
    noise({ dur: 0.3, vol: 0.4, freq: 2500, q: 1, at: 0.17 });
    debris(10, 0.22, 0.6, 0.2);
    noise({ dur: 1.2, vol: 0.14, freq: 600, q: 0.5, at: 0.18, send: 0.7 });
  },
  breath() {
    noise({ dur: 0.35, vol: 0.3, freq: 300, to: 1200, q: 1, attack: 0.25 });             // inhale
    noise({ dur: 1.4, vol: 0.65, type: "lowpass", freq: 2200, to: 500, at: 0.25, attack: 0.08, drive: true });
    noise({ dur: 1.2, vol: 0.22, freq: 3500, q: 0.5, at: 0.3, send: 0.3 });
    tone(110, { type: "sawtooth", dur: 1.25, vol: 0.16, to: 65, at: 0.25, drive: true });
    for (let i = 0; i < 9; i++) noise({ dur: 0.025, vol: 0.22, type: "highpass", freq: 5000, at: 0.35 + rnd(0, 1.0), pan: rnd(-0.7, 0.7) }); // crackle
  },
  pulse() { tone(880, { dur: 0.2, vol: 0.07, send: 0.5 }); tone(1320, { dur: 0.26, vol: 0.05, at: 0.05, send: 0.5 }); tone(1760, { dur: 0.3, vol: 0.03, at: 0.09, send: 0.6 }); },
};
function play(name) { try { SOUNDS[name]?.(); } catch { /* audio is a nice-to-have */ } }
function setMuted(v) {
  muted = v; try { localStorage.setItem("ef_mute", v ? "1" : "0"); } catch { /* ignore */ }
  if (v && ac) ac.suspend();
  if (!v && MUS.want) startMusic();
}
function buzz(ms = 12) { try { if (!muted && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(ms); } catch { /* not supported on iPhone */ } }

// ---------- raid music ----------
// A quiet synthesised bed: a pad and a plucked bass in phase 1, drums join in phase 2, a faster arpeggio in phase 3.
// Silent unless FX.music(true, phase) is called; muting suspends it, FX.music(false) or FX.destroy() stops it.
const MUS = { want: false, phase: 1, on: false, timer: 0, next: 0, step: 0, bus: null, drone: null };
const BARS = [45, 41, 43, 40]; // A, F, G, E (MIDI): a minor-key loop that never quite resolves
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
function music(on = true, phase = 1) {
  MUS.want = !!on;
  MUS.phase = Math.max(1, Math.min(3, Math.round(Number(phase) || 1)));
  if (!MUS.want) { stopMusic(); return; }
  startMusic();
}
function startMusic() {
  const a = audio(); if (!a) return;
  if (MUS.on) { tuneDrone(); return; }
  MUS.on = true;
  const bus = a.createGain(); bus.gain.setValueAtTime(0.0001, a.currentTime); bus.gain.exponentialRampToValueAtTime(0.2, a.currentTime + 2.5);
  bus.connect(master); MUS.bus = bus;
  // Drone: two detuned saws through a slowly breathing low-pass.
  const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 300; f.Q.value = 3;
  const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency);
  const dg = a.createGain(); dg.gain.value = 0.16; f.connect(dg); dg.connect(bus);
  const oscs = [-9, 9, 0].map((dt, i) => { const o = a.createOscillator(); o.type = i < 2 ? "sawtooth" : "triangle"; o.frequency.value = mtof(i < 2 ? 45 : 57); o.detune.value = dt; o.connect(f); o.start(); return o; });
  lfo.start();
  MUS.drone = { oscs: [...oscs, lfo], f };
  MUS.next = a.currentTime + 0.12; MUS.step = 0;
  tuneDrone();
  MUS.timer = setInterval(schedule, 50);
}
function tuneDrone() {
  if (!MUS.drone || !ac) return;
  MUS.drone.f.frequency.setTargetAtTime([0, 320, 520, 820][MUS.phase], ac.currentTime, 1.2);
}
function stopMusic() {
  if (!MUS.on) return;
  MUS.on = false; clearInterval(MUS.timer); MUS.timer = 0;
  const bus = MUS.bus, drone = MUS.drone; MUS.bus = MUS.drone = null;
  if (!ac || !bus) return;
  try { bus.gain.cancelScheduledValues(ac.currentTime); bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), ac.currentTime); bus.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.5); } catch { /* closing */ }
  setTimeout(() => { for (const o of drone?.oscs || []) try { o.stop(); } catch { /* already stopped */ } try { bus.disconnect(); } catch { /* gone */ } }, 650);
}
function schedule() {
  if (!ac || !MUS.on || muted || ac.state !== "running") return;
  if (MUS.next < ac.currentTime) MUS.next = ac.currentTime + 0.05; // a stall (background tab): skip ahead, don't burst
  const s16 = 60 / [0, 90, 102, 116][MUS.phase] / 4;
  while (MUS.next < ac.currentTime + 0.3) { musicStep(MUS.step, MUS.next - ac.currentTime, s16); MUS.next += s16; MUS.step = (MUS.step + 1) % 64; }
}
function musicStep(step, at, s16) {
  const P = MUS.phase, bar = step >> 4, b = step & 15, root = BARS[bar], dest = MUS.bus;
  if (!dest) return;
  // Pad: the bar's minor chord, long and soft, in the room.
  if (b === 0) [12, 15, 19].forEach((iv, i) => tone(mtof(root + iv + (bar === 3 && iv === 15 ? 1 : 0)), { type: "triangle", dur: s16 * 16, vol: 0.05, attack: s16 * 4, at: at + i * 0.01, send: 0.6, dest }));
  // Bass: plucked eighths (octave jumps for movement); sixteenths when enraged.
  if (b % 2 === 0 || P === 3) tone(mtof(root + (b % 4 === 2 ? 24 : 12)), { type: "sawtooth", dur: s16 * (P === 3 ? 0.9 : 1.6), vol: P === 3 && b % 2 ? 0.035 : 0.06, at, dest });
  if (P === 1 && b === 0 && bar % 2 === 0) tone(mtof(root + 36), { dur: 1.4, vol: 0.04, at, send: 0.8, dest });
  if (P >= 2) {
    if (b % 4 === 0) { tone(150, { dur: 0.16, vol: 0.4, to: 48, at, dest }); noise({ dur: 0.012, vol: 0.12, type: "highpass", freq: 3000, at, dest }); }
    if (b % 4 === 2 || (P === 3 && b % 2 === 1)) noise({ dur: 0.03, vol: P === 3 && b % 2 ? 0.03 : 0.05, type: "highpass", freq: 8000, at, dest });
  }
  if (P === 3) {
    if (b === 4 || b === 12) noise({ dur: 0.13, vol: 0.13, freq: 1600, q: 0.8, at, send: 0.4, dest });
    const arp = [0, 3, 7, 10, 12, 10, 7, 3];
    tone(mtof(root + 24 + arp[b % 8]), { type: "square", dur: s16 * 0.8, vol: 0.022, at, send: 0.35, dest });
  }
}

root.FX = {
  init, destroy, resize, local, centre, add, sparks, tapHit, number, clearText, ring, coins, confetti, heal, shieldDome, claw, stompWave, screamWaves, beam, chomp,
  shake, flash, play, buzz, get muted() { return muted; }, setMuted, unlock: audio, music,
};
})(window);
