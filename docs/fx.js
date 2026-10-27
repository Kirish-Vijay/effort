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
function destroy() { cancelAnimationFrame(raf); raf = 0; parts = []; cv?.remove(); cv = ctx = host = null; }
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
    ctx.translate(p.x + (p.drift || 0) * k, y); ctx.scale(pop, pop);
    ctx.font = `800 ${p.size}px "Bricolage Grotesque", system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineJoin = "round"; ctx.lineWidth = Math.max(4, p.size / 5); ctx.strokeStyle = p.stroke || "#1f2a24";
    ctx.strokeText(p.text, 0, 0);
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
function tapHit(x, y, { color = "#ffb703", crit = false, dmg = 0, kind = "hit" } = {}) {
  add({ kind: "slash", x, y, angle: rnd(-0.9, 0.3), r: crit ? 70 : 46, width: crit ? 12 : 8, color, life: 0.28 });
  sparks(x, y, crit ? "#ff7a3d" : color, crit ? 18 : 8, crit ? 620 : 420);
  if (crit) { add({ kind: "glow", x, y, r: 90, color: "rgba(255,170,60,.55)", life: 0.25 }); for (let i = 0; i < 5; i++) add({ kind: "star", x, y, vx: rnd(-260, 260), vy: rnd(-420, -160), life: 0.7, size: rnd(6, 10), color: "#ffe066", spin: rnd(-8, 8), g: 900 }); }
  if (dmg) number(x + rnd(-14, 14), y - 26, kind === "blocked" ? "BLOCKED" : fmtNum(dmg) + (crit ? "!" : ""), crit ? { size: 40, grad: ["#fff3a0", "#ff7a3d"] } : kind === "weak" ? { size: 34, grad: ["#c8f7ff", "#2bb3ff"] } : kind === "blocked" ? { size: 20, color: "#b8c4ff" } : { size: 26, color: "#fff" });
}
// Kept clear of the screen edges so long words like "BIG SWING!" stay readable.
function number(x, y, text, o = {}) { const pad = Math.min(W / 2, String(text).length * 7 + 20); x = Math.max(pad, Math.min(W - pad, x)); add({ kind: "text", x, y, text, size: 26, color: "#fff", life: 0.75, rise: 110, drift: rnd(-60, 60), ...o }); }
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
let ac = null, master = null, noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem("ef_mute") === "1"; } catch { /* ignore */ }
function audio() {
  if (muted) return null;
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.5;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === "suspended") ac.resume();
  return ac;
}
function tone(freq, { type = "sine", dur = 0.12, vol = 0.4, at = 0, to = null, attack = 0.005 } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise({ dur = 0.15, vol = 0.4, at = 0, type = "bandpass", freq = 1200, to = null, q = 1 } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + at, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}
let lastHit = 0;
const SOUNDS = {
  hit() { const now = performance.now(); if (now - lastHit < 35) return; lastHit = now; const p = rnd(0.9, 1.15); noise({ dur: 0.07, vol: 0.5, freq: 2400 * p, q: 0.8 }); tone(180 * p, { type: "triangle", dur: 0.08, vol: 0.5, to: 70 }); },
  crit() { noise({ dur: 0.12, vol: 0.6, freq: 3200, q: 0.7 }); tone(520, { type: "square", dur: 0.08, vol: 0.18, to: 1040 }); tone(1560, { dur: 0.25, vol: 0.2, at: 0.03 }); tone(90, { type: "sine", dur: 0.2, vol: 0.6, to: 45 }); },
  blocked() { tone(1900, { type: "square", dur: 0.04, vol: 0.12 }); tone(1300, { type: "square", dur: 0.05, vol: 0.1, at: 0.04 }); },
  weak() { tone(880, { type: "triangle", dur: 0.08, vol: 0.3 }); tone(1320, { type: "triangle", dur: 0.14, vol: 0.3, at: 0.05 }); noise({ dur: 0.1, vol: 0.4, freq: 2600 }); },
  coin() { tone(988, { type: "square", dur: 0.07, vol: 0.12 }); tone(1319, { type: "square", dur: 0.22, vol: 0.12, at: 0.07 }); },
  combo() { [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: "triangle", dur: 0.12, vol: 0.18, at: i * 0.05 })); },
  ko() { tone(220, { type: "sawtooth", dur: 0.5, vol: 0.25, to: 55 }); noise({ dur: 0.5, vol: 0.5, type: "lowpass", freq: 900, to: 100 }); [392, 523, 659, 784].forEach((f, i) => tone(f, { type: "triangle", dur: 0.25, vol: 0.2, at: 0.35 + i * 0.08 })); },
  audit() { tone(440, { type: "square", dur: 0.12, vol: 0.15 }); tone(330, { type: "square", dur: 0.18, vol: 0.15, at: 0.13 }); noise({ dur: 0.35, vol: 0.25, freq: 600, to: 2400 }); },
  receipt() { tone(1568, { dur: 0.1, vol: 0.12 }); tone(2093, { dur: 0.15, vol: 0.12, at: 0.06 }); },
  warn() { tone(700, { type: "sawtooth", dur: 0.12, vol: 0.12 }); tone(700, { type: "sawtooth", dur: 0.12, vol: 0.12, at: 0.2 }); },
  roar() { tone(140, { type: "sawtooth", dur: 0.7, vol: 0.3, to: 60 }); tone(147, { type: "sawtooth", dur: 0.7, vol: 0.2, to: 58 }); noise({ dur: 0.7, vol: 0.4, type: "lowpass", freq: 800, to: 200 }); },
  swipe() { noise({ dur: 0.25, vol: 0.6, freq: 500, to: 4000, q: 2 }); tone(200, { type: "sawtooth", dur: 0.2, vol: 0.15, to: 90, at: 0.12 }); },
  stomp() { tone(70, { type: "sine", dur: 0.5, vol: 0.9, to: 30 }); noise({ dur: 0.45, vol: 0.7, type: "lowpass", freq: 400, to: 60 }); },
  scream() { for (let i = 0; i < 3; i++) tone(600 + i * 170, { type: "sawtooth", dur: 0.6, vol: 0.1, to: 300 + i * 80, at: i * 0.03 }); noise({ dur: 0.6, vol: 0.3, freq: 1800, q: 4 }); },
  feast() { for (let i = 0; i < 4; i++) { noise({ dur: 0.06, vol: 0.5, freq: 900, at: i * 0.14 }); tone(160, { type: "square", dur: 0.06, vol: 0.12, at: i * 0.14 }); } },
  shield() { noise({ dur: 0.35, vol: 0.35, freq: 300, to: 3000, q: 1.5 }); [660, 990, 1320].forEach((f, i) => tone(f, { dur: 0.4, vol: 0.1, at: 0.05 + i * 0.03 })); },
  swing() { noise({ dur: 0.3, vol: 0.5, freq: 200, to: 1600, q: 1.2 }); tone(110, { type: "sawtooth", dur: 0.3, vol: 0.2, to: 220 }); },
  heal() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { dur: 0.3, vol: 0.12, at: i * 0.06 })); },
  hurt() { tone(260, { type: "square", dur: 0.12, vol: 0.15, to: 120 }); noise({ dur: 0.1, vol: 0.4, freq: 900 }); },
  down() { tone(392, { type: "triangle", dur: 0.25, vol: 0.25, to: 98 }); tone(196, { type: "triangle", dur: 0.5, vol: 0.2, to: 60, at: 0.2 }); },
  revive() { [392, 494, 587, 784].forEach((f, i) => tone(f, { type: "triangle", dur: 0.3, vol: 0.18, at: i * 0.07 })); },
  tick() { tone(1200, { type: "square", dur: 0.03, vol: 0.08 }); },
  right() { tone(784, { type: "triangle", dur: 0.12, vol: 0.25 }); tone(1175, { type: "triangle", dur: 0.25, vol: 0.25, at: 0.1 }); },
  wrong() { tone(196, { type: "sawtooth", dur: 0.3, vol: 0.18 }); tone(185, { type: "sawtooth", dur: 0.3, vol: 0.18 }); },
  rare() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, { type: "triangle", dur: 0.25, vol: 0.14, at: i * 0.05 })); noise({ dur: 0.4, vol: 0.15, freq: 6000 }); },
  stun() { for (let i = 0; i < 6; i++) tone(1800 - i * 200, { type: "square", dur: 0.05, vol: 0.08, at: i * 0.05 }); },
  phase() { tone(98, { type: "sawtooth", dur: 1, vol: 0.3, to: 49 }); noise({ dur: 0.8, vol: 0.3, type: "lowpass", freq: 300 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: "triangle", dur: 0.18, vol: 0.2, at: i * 0.1 })); [1047, 1319, 1568].forEach((f) => tone(f, { type: "triangle", dur: 0.8, vol: 0.12, at: 0.45 })); },
  lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, { type: "triangle", dur: 0.35, vol: 0.18, at: i * 0.2 })); },
  buy() { tone(1319, { type: "square", dur: 0.06, vol: 0.1 }); tone(1760, { type: "square", dur: 0.12, vol: 0.1, at: 0.06 }); noise({ dur: 0.15, vol: 0.15, freq: 5000, at: 0.02 }); },
  levelup() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, { type: "triangle", dur: 0.25, vol: 0.16, at: i * 0.07 })); },
  tap() { tone(900, { type: "triangle", dur: 0.03, vol: 0.08 }); },
};
function play(name) { try { SOUNDS[name]?.(); } catch { /* audio is a nice-to-have */ } }
function setMuted(v) { muted = v; try { localStorage.setItem("ef_mute", v ? "1" : "0"); } catch { /* ignore */ } if (v && ac) ac.suspend(); }
function buzz(ms = 12) { try { if (!muted && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(ms); } catch { /* not supported on iPhone */ } }

root.FX = {
  init, destroy, resize, local, centre, add, sparks, tapHit, number, ring, coins, confetti, heal, shieldDome, claw, stompWave, screamWaves, beam, chomp,
  shake, flash, play, buzz, get muted() { return muted; }, setMuted, unlock: audio,
};
})(window);
