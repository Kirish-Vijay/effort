(() => {
"use strict";
// The Hunt: a nightly tap game. Reels and phones march at your walker; tap to kill them.
// Today's steps set your power, health, time and stomps. Scrolling over budget (and lingering fog)
// makes the night worse: more enemies, tougher enemies, weaker taps, fog over the screen.

const OPEN_HOUR = 18;
const r1 = (n) => Math.round(n * 10) / 10;

function loadout(day, fog) {
  const steps = day.steps;
  const over = day.scrollSrc === "none" ? 0 : Math.max(0, day.scrollMin - day.budget);
  const debuff = Math.min(1, fog * 0.7 + over / 120);
  return {
    steps, over, fog, debuff,
    power: r1((1 + steps / 2500) * (1 - 0.4 * debuff)),
    hp: Math.round(40 + steps / 250),
    minutes: r1(Math.min(15, Math.max(2, steps / 1000))),
    stomps: Math.floor(steps / 3000),
    spawn: 1 + 1.5 * debuff,
    tough: 1 + debuff,
    grass: debuff < 0.15,
  };
}

const INK = "#1f2a24";
const FOES = {
  reel: { hp: 3, speed: 40, dmg: 4, value: 10, size: 48 },
  swipe: { hp: 1.5, speed: 90, dmg: 3, value: 12, size: 40 },
  autoplay: { hp: 14, speed: 22, dmg: 10, value: 40, size: 66 },
  algo: { hp: 60, speed: 15, dmg: 25, value: 200, size: 100 },
  grass: { hp: 1, speed: 26, dmg: 0, value: 0, size: 44 },
};

function foeSvg(type) {
  const o = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
  const eyes = (y, c = INK) => `<circle cx="17" cy="${y}" r="3.2" fill="${c}"/><circle cx="31" cy="${y}" r="3.2" fill="${c}"/>`;
  switch (type) {
    case "reel": return `<svg viewBox="0 0 48 48"><rect x="10" y="3" width="28" height="42" rx="6" fill="#2b2d36" ${o}/><rect x="14" y="8" width="20" height="32" rx="3" fill="#ff8fb1"/>${eyes(17)}<path d="M21,25 l8,5 l-8,5z" fill="#fff"/></svg>`;
    case "swipe": return `<svg viewBox="0 0 48 48"><rect x="12" y="5" width="24" height="38" rx="6" fill="#2b2d36" ${o}/><rect x="15.5" y="9" width="17" height="30" rx="3" fill="#8fd3ff"/>${eyes(18)}<path d="M18,30 l6,-5 l6,5" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
    case "autoplay": return `<svg viewBox="0 0 48 48"><rect x="3" y="8" width="42" height="30" rx="6" fill="#3b3550" ${o}/><rect x="7" y="12" width="34" height="22" rx="3" fill="#ffd34d"/>${eyes(21)}<path d="M19,28 h10" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M14,38 l-4,7 M34,38 l4,7" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></svg>`;
    case "algo": return `<svg viewBox="0 0 48 48"><rect x="7" y="2" width="34" height="44" rx="8" fill="#1d1f27" ${o}/><rect x="11" y="7" width="26" height="33" rx="4" fill="#e8483f"/><circle cx="24" cy="21" r="9" fill="#fff" stroke="${INK}" stroke-width="2.4"/><circle cx="24" cy="21" r="4.5" fill="${INK}"/><path d="M15,33 l3,-3 l3,3 l3,-3 l3,3 l3,-3 l3,3" fill="none" stroke="#fff" stroke-width="2"/></svg>`;
    case "grass": return `<svg viewBox="0 0 48 48"><path d="M8,42 Q14,20 18,42 Q22,12 26,42 Q30,18 34,42 Q38,24 42,42Z" fill="#5fbf83" ${o}/></svg>`;
    default: return "";
  }
}

function start(root, opts) {
  const L = opts.loadout;
  const S = {
    hp: L.hp, maxHp: L.hp, score: 0, kills: 0, wave: 0, stomps: L.stomps,
    left: L.minutes * 60, elapsed: 0, foes: [], toSpawn: 0, spawnTimer: 0, waveGap: 1.2, ended: false, nextId: 1, grassTimer: 30,
  };
  root.innerHTML = `
    <div class="hunt">
      <div class="hunt-hud">
        <div class="hunt-hp"><div class="bar"><i style="width:100%"></i></div><span class="num" id="h-hp"></span></div>
        <div class="hunt-stats"><span>⏱ <b class="num" id="h-time"></b></span><span>Wave <b class="num" id="h-wave">1</b></span><span><b class="num" id="h-score">0</b> pts</span></div>
      </div>
      <div class="hunt-arena" id="h-arena">
        <div class="hunt-fog" style="opacity:${r1(Math.min(0.92, L.debuff * 1.6))}"></div>
        <div class="hunt-banner" id="h-banner"></div>
        <div class="hunt-walker" id="h-walker">${opts.walkerSvg}</div>
      </div>
      <div class="hunt-controls">
        <button class="btn ghost sm" id="h-quit">Give up</button>
        <button class="btn sun" id="h-stomp">💥 Stomp <b class="num" id="h-stomps"></b></button>
      </div>
    </div>`;
  const $ = (id) => root.querySelector("#" + id);
  const arena = $("h-arena"), walker = $("h-walker");
  let W = arena.clientWidth, H = arena.clientHeight;
  const target = () => ({ x: W / 2, y: H - 64 });
  const onResize = () => { W = arena.clientWidth; H = arena.clientHeight; };
  window.addEventListener("resize", onResize);

  const banner = (text) => { const b = $("h-banner"); b.textContent = text; b.classList.remove("show"); void b.offsetWidth; b.classList.add("show"); };
  const pop = (x, y, text, cls = "") => {
    const el = document.createElement("span");
    el.className = "hunt-pop " + cls; el.textContent = text;
    el.style.left = x + "px"; el.style.top = y + "px";
    arena.append(el); setTimeout(() => el.remove(), 700);
  };
  const shake = () => { arena.classList.remove("shake"); void arena.offsetWidth; arena.classList.add("shake"); };

  function spawn(type, x, y) {
    const f = FOES[type];
    const el = document.createElement("div");
    el.className = `foe foe-${type}`;
    el.style.width = el.style.height = f.size + "px";
    el.innerHTML = foeSvg(type) + (type === "grass" ? "" : `<i class="foe-hp"><b></b></i>`);
    arena.append(el);
    const hp = type === "grass" ? 1 : f.hp * L.tough * (1 + S.wave * 0.06);
    const foe = { id: S.nextId++, type, el, x: x ?? 24 + Math.random() * (W - 48), y: y ?? -f.size, hp, max: hp, f, spawnT: 3.5 };
    S.foes.push(foe);
    return foe;
  }

  function pickType() {
    const w = S.wave, r = Math.random();
    if (w >= 4 && r < 0.08 + 0.12 * L.debuff) return "autoplay";
    if (w >= 2 && r < 0.35) return "swipe";
    return "reel";
  }

  function nextWave() {
    S.wave++;
    S.toSpawn = 5 + 3 * S.wave;
    $("h-wave").textContent = S.wave;
    if (S.wave % 5 === 0) { spawn("algo", W / 2 - 50); banner(`Wave ${S.wave}: The Algorithm`); }
    else banner(`Wave ${S.wave}`);
  }

  function kill(foe, byStomp) {
    foe.el.remove();
    S.foes = S.foes.filter((x) => x !== foe);
    if (foe.type === "grass") {
      const heal = 15;
      S.hp = Math.min(S.maxHp, S.hp + heal);
      pop(foe.x, foe.y, `+${heal} ❤️`, "heal");
      return;
    }
    const pts = Math.round(foe.f.value * (1 + 0.1 * (S.wave - 1)));
    S.score += pts; S.kills++;
    if (!byStomp) pop(foe.x, foe.y - 10, `+${pts}`);
  }

  function hit(foe, dmg, byStomp) {
    foe.hp -= dmg;
    if (!byStomp) pop(foe.x + 10, foe.y - 24, `-${r1(dmg)}`, "dmg");
    foe.el.classList.remove("hit"); void foe.el.offsetWidth; foe.el.classList.add("hit");
    if (foe.hp <= 0) kill(foe, byStomp);
  }

  // Taps hit the nearest foe within reach, so fat fingers still land.
  function onTap(e) {
    if (S.ended) return;
    const rect = arena.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    let best = null, bd = 1e9;
    for (const f of S.foes) {
      const d = Math.hypot(f.x - px, f.y - py);
      if (d < f.f.size * 0.75 + 18 && d < bd) { best = f; bd = d; }
    }
    if (best) hit(best, best.type === "grass" ? 1 : L.power);
    else pop(px, py, "miss", "miss");
  }
  arena.addEventListener("pointerdown", onTap);

  $("h-stomp").addEventListener("click", () => {
    if (S.ended || S.stomps <= 0) return;
    S.stomps--;
    shake();
    banner("STOMP");
    for (const f of [...S.foes]) if (f.type !== "grass") hit(f, L.power * 6, true);
  });
  $("h-quit").addEventListener("click", () => end(false, true));

  function end(survived, quit = false) {
    if (S.ended) return;
    S.ended = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVis);
    arena.removeEventListener("pointerdown", onTap);
    if (survived) S.score = Math.round(S.score * 1.2);
    opts.onEnd({ score: S.score, kills: S.kills, wave: S.wave, seconds: Math.round(S.elapsed), survived, quit });
  }

  let last = performance.now(), raf = 0, paused = false;
  const onVis = () => { paused = document.hidden; last = performance.now(); };
  document.addEventListener("visibilitychange", onVis);

  function frame(now) {
    raf = requestAnimationFrame(frame);
    // The clock runs on real time; movement steps are capped so a dropped frame can't teleport enemies.
    const real = Math.min(1, (now - last) / 1000);
    const dt = Math.min(0.1, real);
    last = now;
    if (paused || S.ended) return;
    S.elapsed += real; S.left -= real;
    if (S.left <= 0) { S.left = 0; render(); end(true); return; }

    // waves
    if (S.toSpawn === 0 && S.foes.every((f) => f.type === "grass")) {
      S.waveGap -= dt;
      if (S.waveGap <= 0) { nextWave(); S.waveGap = 1.2; }
    }
    if (S.toSpawn > 0) {
      S.spawnTimer -= dt;
      if (S.spawnTimer <= 0) {
        spawn(pickType()); S.toSpawn--;
        S.spawnTimer = Math.max(0.22, 1 - 0.05 * S.wave) / L.spawn;
      }
    }
    if (L.grass) { S.grassTimer -= dt; if (S.grassTimer <= 0) { spawn("grass"); S.grassTimer = 45; } }

    // movement + contact
    const t = target();
    const speedUp = 1 + S.wave * 0.04;
    for (const f of [...S.foes]) {
      const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy) || 1;
      const v = f.f.speed * speedUp * dt;
      f.x += (dx / d) * v; f.y += (dy / d) * v;
      if (f.type === "autoplay") { f.spawnT -= dt; if (f.spawnT <= 0) { spawn("reel", f.x, f.y + 20); f.spawnT = 3.5; } }
      if (d < 38 + f.f.size / 3) {
        f.el.remove(); S.foes = S.foes.filter((x) => x !== f);
        if (f.type !== "grass") { S.hp -= f.f.dmg; shake(); pop(t.x, t.y - 60, `-${f.f.dmg} ❤️`, "ouch"); }
      }
    }
    if (S.hp <= 0) { S.hp = 0; render(); end(false); return; }
    render();
  }

  function render() {
    for (const f of S.foes) {
      f.el.style.transform = `translate(${f.x - f.f.size / 2}px, ${f.y - f.f.size / 2}px)`;
      const b = f.el.querySelector(".foe-hp b");
      if (b) b.style.width = Math.max(0, (100 * f.hp) / f.max) + "%";
    }
    $("h-hp").textContent = `${Math.ceil(S.hp)} / ${S.maxHp}`;
    root.querySelector(".hunt-hp .bar i").style.width = (100 * S.hp) / S.maxHp + "%";
    const m = Math.floor(S.left / 60), s = Math.floor(S.left % 60);
    $("h-time").textContent = `${m}:${String(s).padStart(2, "0")}`;
    $("h-score").textContent = S.score.toLocaleString("en-GB");
    $("h-stomps").textContent = S.stomps;
    $("h-stomp").disabled = S.stomps <= 0;
    walker.classList.toggle("hurt", S.hp < S.maxHp * 0.3);
  }

  render();
  raf = requestAnimationFrame(frame);
  return { stop: () => end(false) };
}

window.Hunt = { OPEN_HOUR, loadout, start };
})();
