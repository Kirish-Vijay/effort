/* Effort: weekly journey map. Each week the squad walks through the raid boss's realm toward its lair.
   Steal list (research/design-references/README.md): M1 vertical serpentine path, start bottom, lair top;
   M2 dashed trail filling gold with a footprint every ~1k steps; M3 huddle of faces; M4 walk the delta on open;
   M5 named landmark checkpoints; M6 tap a checkpoint for a small card; M7 boss silhouette revealing per
   checkpoint; M8 realm palette, layered props, one ambient particle; M9 summary band; S3 skin trails.
   Exposes window.EffortRealms = { realmFor, html, mount }. All art is inline SVG/CSS drawn here. */
(function () {
  "use strict";

  // ---------- Geometry (one shared world, scaled to the column width) ----------
  const W = 360, H = 1720;
  const XS = [180, 92, 268, 92, 268, 92, 180];
  const Y0 = 1650, Y6 = 360;
  const ATS = [0.14, 0.3, 0.48, 0.66, 0.84];
  const FULL = [0].concat(ATS, [1]);
  const SIDES = ["r", "l", "r", "l", "r"]; // where each checkpoint's landmark sits relative to its node

  const bez = (P, t) => {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * P[0].x + b * P[1].x + c * P[2].x + d * P[3].x, y: a * P[0].y + b * P[1].y + c * P[2].y + d * P[3].y };
  };
  const GEOM = (function build() {
    const stops = XS.map((x, i) => ({ x, y: Y0 - ((Y0 - Y6) * i) / 6 }));
    const segs = [];
    let d = `M${stops[0].x} ${stops[0].y}`, total = 0;
    for (let i = 0; i < 6; i++) {
      const a = stops[i], b = stops[i + 1], k = (a.y - b.y) * 0.55;
      const P = [a, { x: a.x, y: a.y - k }, { x: b.x, y: b.y + k }, b];
      d += `C${P[1].x} ${P[1].y} ${P[2].x} ${P[2].y} ${b.x} ${b.y}`;
      const N = 48, pts = [], cum = [];
      let L = 0;
      for (let j = 0; j <= N; j++) {
        const p = bez(P, j / N);
        if (j) L += Math.hypot(p.x - pts[j - 1].x, p.y - pts[j - 1].y);
        pts.push(p); cum.push(L);
      }
      segs.push({ pts, cum, len: L, start: total });
      total += L;
    }
    return { stops, segs, d, total };
  })();

  // Point on the path for a share p (0..1) of the weekly goal. Checkpoints sit at fixed shares, so each leg of
  // the path covers the steps between two checkpoints.
  function pointAt(p) {
    p = Math.max(0, Math.min(1, p || 0));
    let i = 0;
    while (i < 5 && p > FULL[i + 1]) i++;
    const u = (p - FULL[i]) / (FULL[i + 1] - FULL[i]);
    const s = GEOM.segs[i], want = u * s.len;
    let j = 1;
    while (j < s.cum.length - 1 && s.cum[j] < want) j++;
    const c0 = s.cum[j - 1], c1 = s.cum[j], f = c1 > c0 ? (want - c0) / (c1 - c0) : 0;
    const A = s.pts[j - 1], B = s.pts[j];
    const x = A.x + (B.x - A.x) * f, y = A.y + (B.y - A.y) * f;
    const dx = B.x - A.x, dy = B.y - A.y, dl = Math.hypot(dx, dy) || 1;
    return { x, y, tx: dx / dl, ty: dy / dl, arc: (s.start + want) / GEOM.total, seg: i, idx: j, f };
  }

  // A polyline running alongside the path, offset by `off` units, up to share p. Used for skin trails (S3).
  function trailD(p, off) {
    if (p <= 0) return "";
    const end = pointAt(p);
    const out = [];
    const push = (pt, nx, ny) => out.push(`${(pt.x + nx * off).toFixed(1)} ${(pt.y + ny * off).toFixed(1)}`);
    for (let i = 0; i <= end.seg; i++) {
      const pts = GEOM.segs[i].pts, last = i === end.seg ? end.idx - 1 : pts.length - 1;
      for (let j = i ? 1 : 0; j <= last; j++) {
        const A = pts[Math.max(0, j - 1)], B = pts[Math.min(pts.length - 1, j + 1)];
        const dx = B.x - A.x, dy = B.y - A.y, dl = Math.hypot(dx, dy) || 1;
        push(pts[j], -dy / dl, dx / dl);
      }
    }
    push(end, -end.ty, end.tx);
    return out.length > 1 ? "M" + out.join("L") : "";
  }

  // ---------- Helpers ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Math.max(0, Math.round(n || 0)).toLocaleString("en-GB");
  const pct = (v, of) => ((v / of) * 100).toFixed(3) + "%";
  const okColour = (c) => typeof c === "string" && /^(#[0-9a-f]{3,8}|[a-z]{3,20}|(rgb|hsl)a?\([\d\s.,%]+\))$/i.test(c.trim());
  const possessive = (n) => (/s$/i.test(n) ? n + "'" : n + "'s");
  function rng(seedStr) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
    return function () {
      h += 0x6d2b79f5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let UID = 0;
  // Steps needed to reach a share of the goal (guards against 0.14 * 70000 = 9800.000000000002).
  const needAt = (at, target) => Math.ceil(at * target - 1e-7);

  // ---------- Landmark silhouettes (64x64, ground at ~58). b = body, l = light, s = line, d = dark ----------
  const miniShroom = (x, y) => `M${x - 1.5} ${y}V${y - 7}H${x + 1.5}V${y}ZM${x - 6} ${y - 6}Q${x} ${y - 15} ${x + 6} ${y - 6}Z`;
  const LM = {
    ford: '<path class="l" d="M2 57Q12 53 22 57T42 57T62 57V62H2Z"/><path class="b" d="M6 52V32L8.5 52ZM56 52V28L58.5 52Z"/><ellipse class="b" cx="14" cy="53" rx="9" ry="4"/><ellipse class="b" cx="33" cy="48" rx="9" ry="4"/><ellipse class="b" cx="51" cy="53" rx="8" ry="4"/><circle class="l" cx="35" cy="47" r="1.6"/>',
    hut: '<path class="b" d="M18 58V38H21V58ZM30 58V38H33V58ZM43 58V38H46V58Z"/><path class="b" d="M15 39V24H49V39Z"/><path class="b" d="M10 26L32 9L54 26Z"/><rect class="l" x="28" y="28" width="8" height="7"/>',
    tree: '<path class="s" d="M21 27V42M47 27V44M34 19V31"/><path class="b" d="M28 58L30 40L19 27L22 24L31 35L32 18H36L35 35L46 25L49 28L36 42L37 58Z"/><circle class="l" cx="44" cy="22" r="2"/>',
    chapel: '<path class="b" d="M16 58V32L32 19L48 32V58Z"/><path class="b" d="M27 22V8H37V22Z"/><path class="b" d="M25 9L32 2L39 9Z"/><path class="l" d="M28 58V46A4 4 0 0 1 36 46V58Z"/><circle class="l" cx="32" cy="14" r="2.5"/>',
    bridge: '<path class="s" d="M8 40Q32 26 56 40"/><path class="b" d="M3 44Q32 32 61 44V49Q32 37 3 49Z"/><path class="b" d="M6 58V38H10V58ZM54 58V38H58V58ZM30 58V40H34V58Z"/><circle class="l" cx="8" cy="35" r="3"/>',
    gate: '<path class="b" d="M14 58Q15 42 22 27L26 28Q20 43 21 58Z"/><path class="b" d="M50 58Q49 42 42 27L38 28Q44 43 43 58Z"/><path class="b" d="M4 30Q10 12 32 18Q24 30 4 30Z"/><path class="b" d="M60 30Q54 12 32 18Q40 30 60 30Z"/><circle class="l" cx="14" cy="23" r="2.5"/><circle class="l" cx="24" cy="20" r="2"/><circle class="l" cx="44" cy="21" r="2.5"/><circle class="l" cx="52" cy="25" r="2"/>',
    ring: '<ellipse class="l" cx="32" cy="54" rx="26" ry="6"/><path class="b" d="' + [[20, 49], [44, 49], [32, 47], [8, 54], [56, 54], [18, 59], [46, 59], [32, 61]].map((p) => miniShroom(p[0], p[1])).join("") + '"/>',
    mushroom: '<path class="b" d="M26 58Q24 42 27 30H37Q40 42 38 58Z"/><path class="b" d="M6 32Q32 0 58 32Q32 26 6 32Z"/><circle class="l" cx="20" cy="22" r="3"/><circle class="l" cx="34" cy="14" r="3.5"/><circle class="l" cx="46" cy="24" r="2.5"/><rect class="l" x="30" y="46" width="5" height="7" rx="2"/>',
    puff: '<circle class="b" cx="31" cy="36" r="9"/><circle class="b" cx="20" cy="47" r="11"/><circle class="b" cx="43" cy="49" r="9"/><circle class="l" cx="28" cy="18" r="2"/><circle class="l" cx="36" cy="11" r="1.6"/><circle class="l" cx="22" cy="9" r="1.4"/>',
    stair: '<path class="s" d="M10 58Q8 52 3 49M24 50Q22 45 17 44"/><path class="b" d="M6 58V50H18V42H30V34H42V26H56V58Z"/><rect class="l" x="46" y="34" width="6" height="10" rx="3"/>',
    peaks: '<path class="b" d="M2 58L20 26L28 36L40 14L62 58Z"/><path class="l" d="M40 14L46 26L42 24L38 28L34 24Z"/><path class="l" d="M20 26L24 33L20 31L17 32Z"/>',
    stones: '<path class="b" d="M6 58V34Q9 30 12 34V58ZM18 58V28Q22 23 26 28V58ZM38 58V26Q42 21 46 28V58ZM52 58V36Q55 32 58 36V58ZM29 58V40Q32 36 35 40V58Z"/><path class="l" d="M21 34h2v6h-2ZM41 32h2v6h-2Z"/>',
    icearch: '<path class="b" d="M6 58Q8 20 32 16Q56 20 58 58H48Q48 30 32 28Q16 30 16 58Z"/><path class="l" d="M22 31L24 41L26 30ZM30 28L32 43L34 28ZM39 30L41 39L43 31Z"/>',
    lantern: '<path class="b" d="M28 58V18H32V58ZM22 58H38V54H22Z"/><path class="b" d="M32 20H44V23H32Z"/><path class="b" d="M38 25H50V38H38Z"/><path class="b" d="M36 26L44 18L52 26Z"/><rect class="l" x="41" y="28" width="6" height="8"/>',
    crevasse: '<path class="b" d="M2 46L24 42L29 58H2Z"/><path class="b" d="M62 46L40 42L35 58H62Z"/><path class="d" d="M24 42L29 58H35L40 42L33 46Z"/><circle class="l" cx="30.5" cy="52" r="1.5"/><circle class="l" cx="34" cy="52" r="1.5"/>',
    island: '<path class="b" d="M8 30H56L46 42L38 54L32 46L22 40Z"/><path class="b" d="M18 30V20L24 30ZM40 30V14H44V30Z"/><path class="b" d="M36 16L42 8L48 16Z"/><rect class="l" x="40.5" y="20" width="3" height="4"/>',
    vane: '<path class="s" d="M24 34H40"/><path class="b" d="M31 58V12H33V58ZM24 58H40V55H24Z"/><path class="b" d="M14 22H46L52 18V27L46 23H14Z"/><path class="b" d="M18 21L22 14L26 21Z"/><circle class="l" cx="32" cy="10" r="3"/>',
    ropebridge: '<path class="s" d="M6 28Q32 42 58 28"/><path class="b" d="M4 34Q32 50 60 34V38Q32 54 4 38Z"/><path class="b" d="M4 58V28H8V58ZM56 58V28H60V58Z"/><path class="l" d="M40 4L33 18H38L32 30L45 14H40Z"/>',
    mill: '<path class="b" d="M22 58L26 28H38L42 58Z"/><path class="b" d="M24 29L32 20L40 29Z"/><path class="b" d="M32 22L12 6L10 9L30 24ZM32 22L52 8L54 11L34 24ZM32 22L14 38L17 40L33 24Z"/><rect class="l" x="29" y="40" width="6" height="8" rx="3"/>',
    tornado: '<path class="b" d="M8 12H56Q48 20 44 26Q40 34 36 40Q34 48 32 58Q28 48 26 40Q22 32 18 24Q14 18 8 12Z"/><path class="l" d="M14 16H50L48 19H16ZM20 26H44L42 29H22ZM26 38H38L37 41H27Z"/>',
    buoy: '<path class="l" d="M2 56Q12 52 22 56T42 56T62 56V60H2Z"/><path class="b" d="M22 52L27 28H37L42 52Z"/><path class="b" d="M18 54H46V50H18Z"/><path class="b" d="M28 28V18H36V28Z"/><path class="s" d="M30 34L34 46M34 34L30 46"/><circle class="l" cx="32" cy="14" r="4"/>',
    wreck: '<path class="b" d="M30 40L25 8H28L33 39Z"/><path class="b" d="M27 12L44 20L28 26Z"/><path class="b" d="M4 42L60 34L54 52L14 58Z"/><circle class="l" cx="20" cy="47" r="2.5"/><circle class="l" cx="32" cy="45" r="2.5"/><circle class="l" cx="44" cy="43" r="2.5"/>',
    kelp: '<path class="b" d="M14 58C6 44 22 36 12 22C10 16 14 8 16 6C18 14 16 20 18 24C26 38 12 46 18 58Z"/><path class="b" d="M30 58C24 40 40 32 30 14C29 10 32 4 33 2C35 10 33 14 35 18C44 34 30 42 35 58Z"/><path class="b" d="M46 58C40 46 54 40 46 28C45 24 48 18 49 16C51 22 49 26 51 30C58 42 46 48 51 58Z"/><circle class="l" cx="19" cy="30" r="2"/><circle class="l" cx="34" cy="24" r="2"/><circle class="l" cx="50" cy="36" r="2"/>',
    coral: '<path class="b" d="M10 58Q8 50 14 46Q20 50 18 58Z"/><path class="b" d="M30 58V46L18 34V22H22V32L30 40V18H35V40L44 30V16H48V32L36 46V58Z"/><circle class="l" cx="20" cy="20" r="2.5"/><circle class="l" cx="32.5" cy="16" r="2.5"/><circle class="l" cx="46" cy="14" r="2.5"/>',
    trench: '<path class="b" d="M2 28L20 32L27 58H2Z"/><path class="b" d="M62 28L44 32L37 58H62Z"/><path class="d" d="M20 32L27 58H37L44 32Z"/><circle class="l" cx="32" cy="38" r="1.5"/><circle class="l" cx="31" cy="46" r="1.2"/>',
    portal: '<path class="b" fill-rule="evenodd" d="M12 34A20 24 0 1 0 52 34A20 24 0 1 0 12 34ZM19 34A13 17 0 1 0 45 34A13 17 0 1 0 19 34Z"/><ellipse class="l" cx="32" cy="34" rx="11" ry="15"/><path class="b" d="M8 58H56V54H8Z"/>',
    cube: '<path class="l" d="M36 18L54 28L36 38L18 28Z"/><path class="b" d="M26 14L44 24L26 34L8 24Z"/><path class="b" d="M8 24L26 34V54L8 44Z"/><path class="b" d="M44 24L26 34V54L44 44Z"/>',
    flip: '<path class="b" d="M40 40V56H45V44Z"/><path class="b" d="M14 14H50V34H14Z"/><path class="b" d="M10 34L32 50L54 34Z"/><rect class="l" x="20" y="19" width="8" height="7"/><rect class="l" x="36" y="19" width="8" height="7"/>',
    pixtree: '<path class="b" d="M8 58V48H12V40H16V32H20V24H24V32H28V40H32V48H36V58H24V52H20V58Z"/><path class="b" d="M36 58V44H40V36H44V28H48V36H52V44H56V58Z"/><path class="l" d="M16 40h4v4h-4ZM24 44h4v4h-4ZM44 40h4v4h-4ZM48 48h4v4h-4Z"/>',
    loop: '<path class="b" fill-rule="evenodd" d="M14 30A18 18 0 1 0 50 30A18 18 0 1 0 14 30ZM22 30A10 10 0 1 0 42 30A10 10 0 1 0 22 30Z"/><path class="b" d="M28 46H36L40 58H24Z"/><path class="l" d="M30 13h4v3h-4ZM46 28h3v4h-3ZM15 28h3v4h-3Z"/>',
    moon: '<path class="b" d="M38 6A24 24 0 1 0 56 42A18 18 0 1 1 38 6Z"/><path class="b" d="M10 58H54V54H10ZM14 54V48H18V54ZM46 54V48H50V54Z"/><circle class="l" cx="16" cy="45" r="1.8"/><circle class="l" cx="48" cy="45" r="1.8"/>',
    comet: '<path class="b" d="M38 20L4 52L10 58L46 28Z"/><circle class="b" cx="46" cy="18" r="10"/><circle class="l" cx="46" cy="18" r="5"/>',
    asteroids: '<path class="b" d="M8 40L12 30L22 28L28 36L24 46L12 48Z"/><path class="b" d="M36 20L42 12L54 14L58 26L50 32L38 30Z"/><path class="b" d="M30 58L34 48L44 46L50 54L44 60Z"/><path class="b" d="M14 12h9v9h-9Z"/><path class="l" d="M15.5 15h6v2h-6Z"/>',
    stars: '<path class="s" d="M10 50L20 36L30 40L40 24L52 30L48 16"/><path class="b" d="M10 46L12.5 50L10 54L7.5 50ZM20 32L22.5 36L20 40L17.5 36ZM30 36L32.5 40L30 44L27.5 40ZM40 20L42.5 24L40 28L37.5 24ZM52 26L54.5 30L52 34L49.5 30ZM48 12L50.5 16L48 20L45.5 16Z"/><path class="l" d="M47 10Q44 6 47 2Q50 6 47 10Z"/>',
    coins: '<ellipse class="b" cx="32" cy="54" rx="24" ry="5"/><path class="b" d="M12 52Q32 30 52 52Z"/><circle class="b" cx="14" cy="20" r="5"/><circle class="b" cx="30" cy="12" r="4"/><circle class="b" cx="50" cy="22" r="5"/><circle class="l" cx="14" cy="20" r="2"/><circle class="l" cx="50" cy="22" r="2"/><circle class="l" cx="30" cy="42" r="2"/>',
  };
  // The lair, 100x84: a cave mouth with teeth. Eyes inside light up once the squad is close.
  const LAIR = '<path class="b" d="M2 84L8 52L20 30L36 18L50 14L64 18L80 30L92 52L98 84Z"/><path class="d" d="M26 84Q26 44 50 38Q74 44 74 84Z"/><path class="b" d="M30 52L36 62L40 50ZM46 42L50 54L54 42ZM60 50L64 62L70 52Z"/><circle class="l" cx="43" cy="68" r="3"/><circle class="l" cx="57" cy="68" r="3"/>';

  // ---------- Background props per realm (origin = base centre). eo = even-odd fill ----------
  const PROPS = {
    deadtree: { d: "M-3 0L-2-38L-15-56L-12-58L-1-44L0-70L3-70L3-47L14-62L17-59L4-40L5 0Z" },
    reeds: { d: "M-9 0L-8-30L-6 0ZM-2 0L-1-44L2 0ZM5 0L7-34L9 0ZM-2.5-44h3v-10h-3Z" },
    pool: { d: "M-34 0Q-30-10 0-12Q30-10 34 0Z" },
    mushroom: { d: "M-3 0Q-5-28-2-47H2Q5-28 3 0ZM-24-45Q0-78 24-45Q0-51-24-45Z" },
    toad: { d: "M-14 0Q-15-10-12-15H-8Q-6-10-7 0ZM-22-14Q-10-30 2-14Q-10-17-22-14ZM8 0Q7-14 10-22H14Q16-14 15 0ZM0-21Q12-44 24-21Q12-25 0-21Z" },
    puff: { d: "M-16 0A9 9 0 0 1 2 0ZM0 0A12 12 0 0 1 24 0Z" },
    peak: { d: "M-42 0L-14-58L-2-44L14-82L46 0Z" },
    shard: { d: "M-7 0L-3-50L4-34L8 0Z" },
    drift: { d: "M-36 0Q-12-14 8-8Q24-14 36 0Z" },
    isle: { d: "M-30-40H30L18-26L6-8L0 6L-6-10L-20-24ZM-14-40L-12-54L-8-40ZM9-40V-52H13V-40Z" },
    cloud: { d: "M-30 0A11 11 0 0 1-18-16A16 16 0 0 1 10-20A12 12 0 0 1 32 0Z" },
    pillar: { d: "M-7 0V-40L-3-45L1-39L7-43V0Z" },
    kelp: { d: "M-2 0C-12-20 8-34-2-56C-6-66 0-78 2-82C5-70 2-62 5-56C13-36-4-20 5 0Z" },
    coral: { d: "M-2 0V-14L-14-26V-38H-10V-28L-2-20V-44H3V-22L12-32V-46H16V-30L5-16V0Z" },
    rockarch: { d: "M-34 0Q-30-40 0-44Q30-40 34 0H22Q20-26 0-28Q-20-26-22 0Z" },
    cube: { d: "M0-42L20-31V-9L0 2L-20-9V-31Z" },
    pixels: { d: "M-20 0h10v-10h-10ZM-10-10h10v-10h-10ZM0 0h10v-22h-10ZM12-30h8v-8h-8Z" },
    pyramid: { d: "M-24 0L0-50L24 0ZM-18-58h36v4h-36Z" },
    planet: { d: "M-18 0A18 18 0 1 0 18 0A18 18 0 1 0-18 0ZM-36 2A36 7 0 1 0 36 2A36 7 0 1 0-36 2ZM-27 2A27 4 0 1 0 27 2A27 4 0 1 0-27 2Z", eo: 1 },
    rock: { d: "M-14-2L-10-12L0-16L12-10L14 2L6 12L-8 12Z" },
    moonc: { d: "M-16 0A16 16 0 1 0 16 0A16 16 0 1 0-16 0ZM-8-4A4 4 0 1 0 0-4A4 4 0 1 0-8-4ZM4 6A3 3 0 1 0 10 6A3 3 0 1 0 4 6Z", eo: 1 },
  };

  // ---------- Bosses (160x160). Art is shown as a black silhouette that brightens per checkpoint (M7) ----------
  // .d1 details appear from the 2nd checkpoint, .d2 from the 4th. Eyes live in a separate layer so they glow.
  const BOSS_ART = {
    notification: {
      art: '<path class="k" fill="#6fca45" d="M18 142Q8 104 34 74Q58 44 80 44Q102 44 126 74Q152 104 142 142Q80 154 18 142Z"/><g class="d1"><path fill="#6fca45" class="k" d="M40 140q4 16 9 0ZM110 141q5 18 10 0Z"/><ellipse fill="#c6f59a" cx="58" cy="70" rx="10" ry="6"/><path fill="#2b0f1a" class="k" d="M56 112Q80 130 104 112Q80 120 56 112Z"/></g><g class="d2"><circle fill="#a3e86f" cx="44" cy="120" r="5"/><circle fill="#a3e86f" cx="122" cy="108" r="4"/><path fill="#e8e4d4" class="k" d="M100 124l14-6 4 8-14 6Z"/></g>',
      eyes: [[64, 92, 9, 11], [96, 92, 9, 11]],
    },
    autoplay: {
      art: '<path class="k" fill="#ffd27a" d="M48 66L36 32L62 58ZM112 66L124 32L98 58Z"/><path class="k" fill="#ff8a2a" d="M30 142Q20 96 44 70Q80 40 116 70Q140 96 130 142Z"/><path class="k" fill="#ff8a2a" d="M44 142v10h18v-10ZM98 142v10h18v-10Z"/><g class="d1"><ellipse fill="#ffc070" cx="80" cy="124" rx="30" ry="16"/><path class="k" fill="#3a1206" d="M52 98Q80 122 108 98Z"/><path fill="#fff" d="M62 99l5 9 5-9ZM88 99l5 9 5-9Z"/></g><g class="d2"><circle fill="#ffd27a" class="k" cx="22" cy="60" r="5"/><circle fill="#ffd27a" class="k" cx="138" cy="52" r="6"/><circle fill="#ffd27a" class="k" cx="146" cy="84" r="4"/><circle fill="#ffd27a" class="k" cx="14" cy="92" r="4"/></g>',
      eyes: [[64, 82, 8, 9], [96, 82, 8, 9]],
    },
    leftonread: {
      art: '<path class="k" fill="#dff6ff" d="M40 150Q36 120 38 90Q40 40 80 36Q120 40 122 90Q124 120 120 150Q110 138 100 150Q90 138 80 150Q70 138 60 150Q50 138 40 150Z"/><g class="d1"><path fill="#b6e3f2" d="M44 140Q44 110 50 96Q60 120 58 140Z"/><ellipse class="k" fill="#14303e" cx="80" cy="112" rx="7" ry="9"/></g><g class="d2"><path class="s" stroke="#dff6ff" d="M126 70q14-6 22 4M128 96q12 0 18 10M34 70q-14-6-22 4"/></g>',
      eyes: [[64, 82, 10, 13], [96, 82, 10, 13]],
    },
    scroll: {
      art: '<path class="k" fill="#c9d4e6" d="M20 30Q80 14 140 30Q128 52 112 62Q100 82 92 100Q86 124 82 148Q74 124 70 104Q60 84 46 66Q30 52 20 30Z"/><g class="d1"><path class="s" stroke="#8b9bb8" d="M30 40Q80 56 132 38M50 70Q82 82 110 66M68 100Q82 108 94 98"/></g><g class="d2"><path class="k" fill="#8a5a2b" d="M130 92h14v4h-14ZM132 96v10M142 96v10"/><path class="k" fill="#e8e4d4" d="M14 70l12-4 4 10-12 4Z"/><path class="s" stroke="#ffe14d" d="M146 20l-8 14h6l-8 14"/></g>',
      eyes: [[66, 46, 8, 6], [94, 46, 8, 6]],
    },
    kraken: {
      art: '<path class="k" fill="#c8354f" d="M50 96Q30 122 10 116Q26 138 56 108ZM62 102Q50 136 32 150Q60 150 72 108ZM98 102Q110 136 128 150Q100 150 88 108ZM110 96Q130 122 150 116Q134 138 104 108Z"/><path class="k" fill="#d8425a" d="M44 100Q40 36 80 30Q120 36 116 100Z"/><g class="d1"><circle fill="#ffb0b8" cx="24" cy="120" r="3"/><circle fill="#ffb0b8" cx="40" cy="140" r="3"/><circle fill="#ffb0b8" cx="120" cy="140" r="3"/><circle fill="#ffb0b8" cx="136" cy="120" r="3"/><path class="k" fill="#2b0610" d="M68 94Q80 100 92 94Q80 92 68 94Z"/></g><g class="d2"><circle fill="#a8243b" cx="70" cy="48" r="5"/><circle fill="#a8243b" cx="94" cy="56" r="4"/><circle fill="#a8243b" cx="82" cy="40" r="3"/></g>',
      eyes: [[64, 76, 8, 10], [96, 76, 8, 10]],
    },
    algorithm: {
      art: '<path class="k" fill="#8a5a2b" d="M118 122L134 38Q144 26 150 42L132 124Z"/><path class="k" fill="#3d7fe0" d="M38 152Q34 102 52 84H108Q126 102 122 152Z"/><path class="k" fill="#3d7fe0" d="M108 96Q124 104 128 118L118 124Q112 112 104 108Z"/><path class="k" fill="#4a8ff0" d="M56 88Q52 44 80 42Q108 44 104 88Z"/><g class="d1"><path class="k" fill="#5a3a1a" d="M40 126H120V136H40Z"/><path fill="#fff" class="k" d="M68 78l4-10 4 10ZM84 78l4-10 4 10Z"/></g><g class="d2"><path class="k" fill="#c9d4e6" d="M136 44l-8-4 2 8ZM146 34l2-8 4 8ZM140 60l8 0-4 6Z"/><path fill="#2a5fb0" d="M60 100h12v12h-12ZM88 104h10v10h-10Z"/></g>',
      eyes: [[70, 62, 6, 6], [90, 62, 6, 6]],
    },
    dragon: {
      art: '<path class="k" fill="#b33a2a" d="M54 96L8 60L18 104L40 102L28 128L58 116ZM106 96L152 60L142 104L120 102L132 128L102 116Z"/><path class="k" fill="#ffd27a" d="M60 72L44 30L72 62ZM100 72L116 30L88 62Z"/><path class="k" fill="#e04a32" d="M52 120Q48 70 80 60Q112 70 108 120Q96 140 80 142Q64 140 52 120Z"/><g class="d1"><path class="k" fill="#2b0a06" d="M72 128a3 3 0 0 0 6 0ZM84 128a3 3 0 0 0 6 0Z"/><path fill="#ff9a5a" d="M66 108Q80 116 94 108Q80 112 66 108Z"/></g><g class="d2"><ellipse class="k" fill="#ffc83d" cx="34" cy="148" rx="14" ry="5"/><ellipse class="k" fill="#ffc83d" cx="126" cy="146" rx="16" ry="6"/><circle class="k" fill="#ffe58a" cx="140" cy="134" r="5"/></g>',
      eyes: [[66, 94, 8, 6], [94, 94, 8, 6]],
    },
  };

  // ---------- Realms ----------
  // shape = landmark silhouette key. Lair names are built from the boss name so event bosses read right.
  const REALMS = {
    notification: {
      id: "blotmarsh", key: "swamp", fx: "fog", boss: "Brett", props: ["deadtree", "reeds", "pool"],
      name: "The Blotmarsh", tagline: "Something big, round and damp has been sitting in this swamp for years.",
      cps: [
        ["Murkwater Ford", "The stones are slippery. One of them blinked.", "ford"],
        ["The Leech Inn", "Rooms by the hour. The leeches charge by the pint.", "hut"],
        ["Hangman's Willow", "Nobody was ever hanged here. The tree just looks like that.", "tree"],
        ["The Drowned Chapel", "The bell still rings at night, mostly when nobody is near it.", "chapel"],
        ["Bogbody Crossing", "The planks are old. The man under them is older.", "bridge"],
      ],
      lair: ["Wallow", "A crater of warm slime. It is breathing."],
    },
    autoplay: {
      id: "puffcap", key: "spore", fx: "spores", boss: "Rory", props: ["mushroom", "toad", "puff"],
      name: "Puffcap Hollow", tagline: "The air is thick, orange and a bit too friendly.",
      cps: [
        ["Spore Gate", "Two giant mushrooms leaning together. Hold your breath and walk quickly.", "gate"],
        ["The Fairy Ring", "Step inside and you lose an hour. Step out and you lose another.", "ring"],
        ["Gillwood", "The trees are mushrooms. The mushrooms are watching.", "mushroom"],
        ["The Puffball Fields", "Every step sends up a cloud. Every cloud makes you sneeze.", "puff"],
        ["Rotroot Stair", "Carved by something with very big feet and no sense of rhythm.", "stair"],
      ],
      lair: ["Burrow", "It smells of oranges and wet socks. Something inside is chewing."],
    },
    leftonread: {
      id: "hushfrost", key: "glacier", fx: "snow", boss: "Wisp", props: ["peak", "shard", "drift"],
      name: "The Hushfrost Reach", tagline: "Cold and quiet, and you keep thinking someone is behind you.",
      cps: [
        ["Whisper Pass", "Talk too loudly and the snow answers back, usually as an avalanche.", "peaks"],
        ["The Shivering Stones", "Five stones in a circle. Count them again on the way back.", "stones"],
        ["Icetooth Arch", "Icicles the size of lamp posts. Walk under it, not near it.", "icearch"],
        ["The Last Lantern", "Someone keeps it lit. Nobody has ever seen who.", "lantern"],
        ["Glassdeep Crevasse", "You can see a long way down. Something down there can see up.", "crevasse"],
      ],
      lair: ["Hollow", "Very still, very cold. The footprints behind you are not yours."],
    },
    scroll: {
      id: "spindrift", key: "storm", fx: "storm", boss: "Gale", props: ["isle", "cloud", "pillar"],
      name: "The Spindrift Isles", tagline: "Islands that float, wind that never stops, and nothing nailed down.",
      cps: [
        ["Kite Rock", "The first island. The rope bridge is mostly rope.", "island"],
        ["The Weathervane", "It points every way at once. Very helpful.", "vane"],
        ["Thunderhead Bridge", "Count the seconds between the flashes. Then run.", "ropebridge"],
        ["The Broken Mill", "Its sails spun so fast they took the roof with them.", "mill"],
        ["Eye of the Gust", "Perfectly calm in the middle. That is the worrying part.", "tornado"],
      ],
      lair: ["Spindle", "A tower spinning on its point. Three hundred years and it has never once felt dizzy."],
    },
    kraken: {
      id: "lowmost", key: "abyss", fx: "bubbles", boss: "The Kraken", props: ["kelp", "coral", "rockarch"],
      name: "The Lowmost Deep", tagline: "It came up from down here. Now you are going down there.",
      cps: [
        ["The Last Buoy", "Still ringing. Nobody has rung it on purpose in years.", "buoy"],
        ["Wreck of the Merry Ann", "The crew left in a hurry. They left their boots.", "wreck"],
        ["Kelpwood", "Long, dark and swaying. Keep your ankles to yourself.", "kelp"],
        ["Glowmouth Reef", "The coral glows. So do the teeth.", "coral"],
        ["The Inkfall", "Where the light gives up. Bring a torch and a strong opinion.", "trench"],
      ],
      lair: ["Throat", "A hole in the sea floor that breathes in and out. Mostly in."],
    },
    algorithm: {
      id: "misrendered", key: "glitch", fx: "glitch", boss: "Grimm", props: ["cube", "pixels", "pyramid"],
      name: "The Misrendered Realm", tagline: "Reality failed to load. Something big and blue is enjoying it.",
      cps: [
        ["The Flicker Gate", "Walk through once. You arrive twice.", "portal"],
        ["Duplicate Hill", "There are two of this hill. Both insist they are the real one.", "cube"],
        ["The Upside Down Inn", "Breakfast is served on the ceiling. Mind the soup.", "flip"],
        ["Missing Texture Woods", "The trees are flat squares of nothing. Do not lean on them.", "pixtree"],
        ["The Loop Road", "You have walked this bit before. You will walk it again.", "loop"],
      ],
      lair: ["Error Throne", "A throne of broken bits. He sits on it with his club and waits for you to load."],
    },
    dragon: {
      id: "gildedvoid", key: "space", fx: "stars", boss: "Vex", props: ["planet", "rock", "moonc"],
      name: "The Gilded Void", tagline: "The sky ran out of sky. Out here a dragon keeps everything.",
      cps: [
        ["Moonwharf", "The last dock before nothing. They sell overpriced air.", "moon"],
        ["The Comet's Tail", "Hitch a lift, then let go before it reaches the sun.", "comet"],
        ["The Knights' Drift", "Knights came for the hoard. Their armour is still floating here.", "asteroids"],
        ["The Burnt Constellation", "Six stars in the shape of a claw. One of them is still smoking.", "stars"],
        ["The Coin Nebula", "A cloud of loose gold, drifting. Do not pocket any. She counts.", "coins"],
      ],
      lair: ["Hoard", "A mountain of gold around a sleeping star. The star is not the one asleep."],
    },
  };
  // Event bosses in case the caller passes one through (they wear a base boss's model).
  const EVENT_BASE = { "ev-newyear": "notification", "ev-spring": "autoplay", "ev-solstice": "dragon", "ev-harvest": "algorithm", "ev-haunted": "leftonread", "ev-krampus": "algorithm" };
  const baseId = (id) => (REALMS[id] ? id : REALMS[EVENT_BASE[id]] ? EVENT_BASE[id] : "notification");

  function realmFor(bossId, bossName) {
    const bid = baseId(bossId), R = REALMS[bid], who = bossName || R.boss;
    return {
      id: R.id, bossId: bid, key: R.key, fx: R.fx, name: R.name, tagline: R.tagline,
      checkpoints: R.cps.map((c, i) => ({ name: c[0], lore: c[1], shape: c[2], at: ATS[i] })),
      lair: { name: possessive(who) + " " + R.lair[0], lore: R.lair[1] },
    };
  }

  // ---------- Pieces ----------
  const lmSvg = (shape, cls) => `<svg class="rlm-lm ${cls || ""}" viewBox="0 0 64 64" aria-hidden="true">${LM[shape] || LM.stones}</svg>`;
  const lairSvg = (cls) => `<svg class="rlm-lm rlm-lm--lair ${cls || ""}" viewBox="0 0 100 84" aria-hidden="true">${LAIR}</svg>`;

  function propsLayer(realm, layer, rnd) {
    const shapes = REALMS[realm.bossId].props;
    const cfg = { far: [9, 1.5, 0.8, 0], mid: [12, 0.95, 0.5, 1], near: [10, 1.35, 0.6, 2] }[layer];
    let out = "";
    for (let i = 0; i < cfg[0]; i++) {
      const pr = PROPS[shapes[Math.floor(rnd() * shapes.length)]];
      const y = 140 + ((i + rnd() * 0.8) / cfg[0]) * (H - 120);
      let x;
      if (cfg[3] === 2) x = rnd() < 0.5 ? 4 + rnd() * 34 : 322 + rnd() * 34; // near layer hugs the edges
      else if (cfg[3] === 1) x = rnd() < 0.5 ? rnd() * 80 : 280 + rnd() * 80;
      else x = rnd() * W;
      const s = cfg[1] + rnd() * cfg[2], flip = rnd() < 0.5 ? -1 : 1;
      out += `<path${pr.eo ? ' fill-rule="evenodd"' : ""} transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(s * flip).toFixed(2)} ${s.toFixed(2)})" d="${pr.d}"/>`;
    }
    return `<svg class="rlm-props rlm-${layer}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${out}</svg>`;
  }

  function groundLayer(rnd) {
    // Flat tonal bands with wavy tops, like contour regions on a map. Darker towards the lair.
    let out = "";
    const n = 6;
    for (let i = 0; i < n; i++) {
      const y = 120 + i * ((H - 120) / n), a = 14 + rnd() * 18, ph = rnd() < 0.5 ? 1 : -1;
      out += `<path class="rlm-band b${i % 2}" d="M0 ${y.toFixed(0)}Q90 ${(y - a * ph).toFixed(0)} 180 ${y.toFixed(0)}T360 ${y.toFixed(0)}V${H}H0Z"/>`;
    }
    return `<svg class="rlm-ground" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><rect class="rlm-band top" width="${W}" height="${H}"/>${out}</svg>`;
  }

  function fxLayer(type, rnd) {
    const n = { fog: 5, spores: 12, snow: 16, storm: 9, bubbles: 10, glitch: 3, stars: 18 }[type] || 0;
    let s = "";
    for (let i = 0; i < n; i++) {
      s += `<i style="--x:${(rnd() * 100).toFixed(1)}%;--y:${(rnd() * 100).toFixed(1)}%;--d:${(6 + rnd() * 8).toFixed(1)}s;--dl:-${(rnd() * 14).toFixed(1)}s;--z:${(0.6 + rnd() * 0.9).toFixed(2)};--dx:${(rnd() * 40 - 20).toFixed(0)}px"></i>`;
    }
    if (type === "storm") s += '<b class="fx-flash"></b><svg class="fx-bolt" viewBox="0 0 40 120"><path d="M24 0L6 58H18L8 120L36 46H22L32 0Z"/></svg>';
    if (type === "glitch") s += '<b class="fx-scan"></b><b class="fx-band"></b>';
    if (type === "stars") s += '<b class="fx-shoot"></b>';
    return `<div class="rlm-fx rlm-fx--${type}" aria-hidden="true">${s}</div>`;
  }

  function bossBlock(bossId, name) {
    const B = BOSS_ART[baseId(bossId)];
    const eyes = B.eyes.map((e) => `<ellipse class="eye" cx="${e[0]}" cy="${e[1]}" rx="${e[2]}" ry="${e[3]}"/><ellipse class="pupil" cx="${e[0]}" cy="${e[1] + 1}" rx="${Math.max(2, e[2] * 0.35)}" ry="${Math.max(2, e[3] * 0.5)}"/>`).join("");
    const pips = ATS.map((_, i) => `<i data-pip="${i}"></i>`).join("");
    return `<div class="rlm-boss" style="top:${pct(18, H)}">
      <div class="rlm-medal"><svg class="rlm-boss-art" viewBox="0 0 160 160" aria-hidden="true">${B.art}</svg><svg class="rlm-boss-eyes" viewBox="0 0 160 160" aria-hidden="true">${eyes}</svg></div>
      <div class="rlm-pips" aria-hidden="true">${pips}</div>
      <div class="rlm-plate rlm-boss-name">${esc(name)}</div>
    </div>`;
  }

  function nextHtml(realm, steps, target, todayTxt) {
    if (steps >= target) return `<b class="rlm-done-msg">Lair reached. The raid is Sunday 6pm</b>`;
    let nx = null;
    for (const c of realm.checkpoints) if (steps < needAt(c.at, target)) { nx = { name: c.name, at: needAt(c.at, target) }; break; }
    if (!nx) nx = { name: realm.lair.name, at: target };
    return `<span>Next: <b>${esc(nx.name)}</b> in <b class="num">${fmt(nx.at - steps)}</b></span>${todayTxt ? `<span class="rlm-today">${esc(todayTxt)}</span>` : ""}`;
  }

  function faceBit(m, i, cls) {
    const inner = m.faceHtml ? m.faceHtml : `<span class="rlm-ini">${esc(String(m.name || "?").trim().charAt(0).toUpperCase() || "?")}</span>`;
    return `<span class="rlm-f ${cls}" style="z-index:${30 - i};--bd:${(i * 0.17).toFixed(2)}s" title="${esc(m.name || "")}">${inner}</span>`;
  }

  // ---------- html() ----------
  function html(o) {
    o = o || {};
    const realm = realmFor(o.bossId, o.bossName);
    const bossName = o.bossName || REALMS[realm.bossId].boss;
    const target = Math.max(1, Math.round(+o.target || 0) || 1);
    const steps = Math.max(0, Math.round(+o.steps || 0));
    const prev = Math.max(0, Math.min(steps, o.prevSteps == null ? steps : Math.round(+o.prevSteps || 0)));
    const p = Math.min(1, steps / target), pt = pointAt(p), done = steps >= target;
    const uid = "rlm" + ++UID;
    const rnd = rng(realm.id);
    const members = (Array.isArray(o.members) ? o.members : []).map((m) => ({
      id: m && m.id, name: (m && m.name) || "", faceHtml: (m && m.faceHtml) || "", week: Math.max(0, +(m && m.weekSteps) || 0), today: Math.max(0, +(m && m.todaySteps) || 0), trail: m && okColour(m.trail) ? m.trail.trim() : "",
    }));
    const reachedN = realm.checkpoints.filter((c) => steps >= needAt(c.at, target)).length;
    const walkedToday = members.filter((m) => m.today > 0).length;
    const todayTxt = members.length ? `${walkedToday} of ${members.length} walked today` : "";
    const top = members.slice().sort((a, b) => b.week - a.week)[0];

    // Header (M9)
    const ticks = realm.checkpoints.map((c, i) => `<i class="rlm-tick${steps >= needAt(c.at, target) ? " is-on" : ""}" data-tick="${i}" style="left:${(c.at * 100).toFixed(1)}%"></i>`).join("");
    const head = `<div class="rlm-head">
      <div class="rlm-title"><b class="disp ol-sm">${esc(realm.name)}</b><span>${esc(realm.tagline)}</span></div>
      <div class="rlm-count"><b class="num rlm-now">${fmt(steps)}</b> / <span class="num">${fmt(target)}</span> steps to <b class="rlm-lairname">${esc(realm.lair.name)}</b></div>
      <div class="rlm-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${steps}" aria-label="Squad steps this week"><i class="rlm-bar-fill" style="width:${(p * 100).toFixed(2)}%"></i>${ticks}</div>
      <div class="rlm-next">${nextHtml(realm, steps, target, todayTxt)}</div>
    </div>`;

    // Path, trail, footprints (M1, M2) and skin trails (S3)
    const interval = Math.max(1000, Math.ceil(target / 60 / 1000) * 1000);
    let fps = "";
    for (let k = 1; k * interval <= Math.min(steps, target); k++) {
      const fp = (k * interval) / target, q = pointAt(fp), side = k % 2 ? 1 : -1;
      const x = q.x + -q.ty * 15 * side, y = q.y + q.tx * 15 * side, ang = (Math.atan2(q.ty, q.tx) * 180) / Math.PI + 90;
      fps += `<use href="#${uid}-fp" class="rlm-fp is-on" data-p="${fp.toFixed(5)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(0)})"/>`;
    }
    const offs = [8, -8, 11.5, -11.5];
    const trails = members.filter((m) => m.trail).slice(0, 4).map((m, i) => `<path class="rlm-trail" data-off="${offs[i]}" stroke="${esc(m.trail)}" d="${trailD(p, offs[i])}"/>`).join("");
    const pathSvg = `<svg class="rlm-path" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><g id="${uid}-fp"><ellipse cx="0" cy="1.6" rx="2.5" ry="3.6"/><ellipse cx="0" cy="-4.4" rx="1.9" ry="1.9"/></g></defs>
      <path class="rlm-p-ink" d="${GEOM.d}"/><path class="rlm-p-bed" d="${GEOM.d}"/><path class="rlm-p-dash" d="${GEOM.d}"/>
      <g class="rlm-fps">${fps}</g>${trails}
      <path class="rlm-p-gold" d="${GEOM.d}" pathLength="1000" stroke-dasharray="1000 1000" stroke-dashoffset="${((1 - pt.arc) * 1000).toFixed(2)}"${pt.arc > 0.0005 ? "" : ' style="opacity:0"'}/>
    </svg>`;

    // Checkpoints (M5, M6)
    let nextMarked = false;
    const cps = realm.checkpoints.map((c, i) => {
      const s = GEOM.stops[i + 1], on = steps >= needAt(c.at, target);
      const isNext = !on && !nextMarked; if (isNext) nextMarked = true;
      return `<button type="button" class="rlm-cp side-${SIDES[i]}${on ? " is-on" : ""}${isNext ? " is-next" : ""}" data-realm-cp="${i}" data-at="${c.at}" style="left:${pct(s.x, W)};top:${pct(s.y, H)}" aria-label="${esc(c.name)}${on ? ", reached" : ""}" aria-expanded="false">
        <span class="rlm-cp-disc"></span>
        <span class="rlm-cp-body">${lmSvg(c.shape)}<span class="rlm-plate">${esc(c.name)}</span>${on ? `<span class="rlm-cp-lore">${esc(c.lore)}</span>` : ""}</span>
      </button>`;
    }).join("");
    const L = GEOM.stops[6];
    const lairBtn = `<button type="button" class="rlm-cp rlm-lair${done ? " is-on" : ""}${!done && reachedN === 5 ? " is-next" : ""}" data-realm-cp="5" data-at="1" style="left:${pct(L.x, W)};top:${pct(L.y, H)}" aria-label="${esc(realm.lair.name)}${done ? ", reached" : ""}" aria-expanded="false">
      <span class="rlm-lair-art">${lairSvg()}</span>
      <span class="rlm-cp-body"><span class="rlm-plate">${esc(realm.lair.name)}</span>${done ? `<span class="rlm-cp-lore">${esc(realm.lair.lore)}</span>` : ""}</span>
    </button>`;
    const S = GEOM.stops[0];
    const start = `<div class="rlm-start" style="left:${pct(S.x, W)};top:${pct(S.y, H)}"><span class="rlm-start-dot"></span><span class="rlm-plate">Monday camp</span></div>`;

    // Huddle (M3): today's walkers at the front and bobbing, zero-steppers greyed at the back.
    const order = members.slice().sort((a, b) => (b.today > 0) - (a.today > 0) || b.today - a.today || b.week - a.week);
    const shown = order.slice(0, 7), extra = order.length - shown.length;
    let faces = shown.map((m, i) => faceBit(m, i, m.today > 0 ? "is-walk" : "is-zero")).join("");
    if (extra > 0) faces += `<span class="rlm-f rlm-more" style="z-index:1">+${extra}</span>`;
    if (!members.length) faces = `<span class="rlm-f rlm-token" style="z-index:1"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h5l1 8 6 3v4H6l-1-7Z"/><path d="M6 21h13" /></svg></span>`;
    const nFaces = Math.max(1, shown.length + (extra > 0 ? 1 : 0));
    const hw = Math.round((30 + (nFaces - 1) * 20) / 2) + 8;
    const huddle = `<span class="rlm-pin" aria-hidden="true"></span><div class="rlm-huddle" role="img" aria-label="Squad: ${fmt(steps)} of ${fmt(target)} steps">${faces}</div>`;

    // Cards (M6, kept simple: lore + top walker this week)
    const topLine = top && top.week > 0 ? `<div class="rlm-card-top"><span class="rlm-card-face">${top.faceHtml || `<span class="rlm-ini">${esc(top.name.charAt(0).toUpperCase() || "?")}</span>`}</span><span>Top walker this week: <b>${esc(top.name)}</b>, <span class="num">${fmt(top.week)}</span> steps</span></div>` : "";
    const cardOf = (i, name, lore, on, need, art) => `<div class="rlm-card${on ? " is-on" : ""}" data-realm-card="${i}" role="dialog" aria-label="${esc(name)}" hidden>
      <div class="rlm-card-row"><span class="rlm-card-art">${art}</span><div class="grow"><b class="disp">${esc(name)}</b><small>${on ? "Reached" : `Still ahead, <span class="num">${fmt(need)}</span> more steps`}</small></div>
      <button type="button" class="rlm-x" data-realm-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <p>${on ? esc(lore) : "The squad hasn't got here yet. Walk on to find out what's waiting."}</p>${topLine}
    </div>`;
    const cards = realm.checkpoints.map((c, i) => {
      const at = needAt(c.at, target), on = steps >= at;
      return cardOf(i, c.name, c.lore, on, at - steps, lmSvg(c.shape, on ? "is-lit" : ""));
    }).join("") + cardOf(5, realm.lair.name, realm.lair.lore, done, target - steps, lairSvg(done ? "is-lit" : ""));

    return `<div class="rlm rlm--${realm.key}${done ? " is-done" : ""}" role="region" aria-label="Journey map: ${esc(realm.name)}" data-realm="${realm.key}" data-boss="${esc(realm.bossId)}" data-boss-name="${esc(bossName)}" data-stage="${reachedN}" data-steps="${steps}" data-prev="${prev}" data-target="${target}" data-today="${esc(todayTxt)}">
      ${head}
      <div class="rlm-view">
        <div class="rlm-scroll" tabindex="0" aria-label="Map, scroll to look around">
          <div class="rlm-world" style="--hx:${pct(pt.x, W)};--hy:${pct(pt.y, H)};--hw:${hw}px">
            ${groundLayer(rnd)}${propsLayer(realm, "far", rnd)}${propsLayer(realm, "mid", rnd)}${pathSvg}${propsLayer(realm, "near", rnd)}
            ${bossBlock(realm.bossId, bossName)}${lairBtn}${cps}${start}${huddle}
          </div>
        </div>
        ${fxLayer(realm.fx, rnd)}
        ${cards}
      </div>
    </div>`;
  }

  // ---------- mount() ----------
  function mount(rootEl) {
    const el = rootEl && (rootEl.classList && rootEl.classList.contains("rlm") ? rootEl : rootEl.querySelector && rootEl.querySelector(".rlm"));
    if (!el) return { dispose() {} };
    const q = (s) => el.querySelector(s), qa = (s) => Array.prototype.slice.call(el.querySelectorAll(s));
    const sc = q(".rlm-scroll"), world = q(".rlm-world"), gold = q(".rlm-p-gold"), now = q(".rlm-now"), fill = q(".rlm-bar-fill"), next = q(".rlm-next"), bar = q(".rlm-bar");
    const trails = qa(".rlm-trail"), fps = qa(".rlm-fp"), cps = qa(".rlm-cp"), ticks = qa(".rlm-tick"), cards = qa(".rlm-card");
    const far = q(".rlm-far"), mid = q(".rlm-mid");
    const steps = +el.dataset.steps || 0, prev = +el.dataset.prev || 0, target = +el.dataset.target || 1;
    const realm = realmFor(el.dataset.boss, el.dataset.bossName), todayTxt = el.dataset.today || "";
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, timer = 0, follow = true, lastNext = next ? next.innerHTML : "", parRaf = 0;

    const yPx = (s) => (pointAt(Math.min(1, s / target)).y / H) * world.offsetHeight;
    const scrollToSteps = (s) => { if (sc) sc.scrollTop = Math.max(0, yPx(s) - sc.clientHeight * 0.55); };

    function place(s, animating) {
      const p = Math.min(1, s / target), pt = pointAt(p);
      world.style.setProperty("--hx", pct(pt.x, W));
      world.style.setProperty("--hy", pct(pt.y, H));
      if (gold) { gold.setAttribute("stroke-dashoffset", ((1 - pt.arc) * 1000).toFixed(2)); gold.style.opacity = pt.arc > 0.0005 ? "" : "0"; }
      trails.forEach((t) => t.setAttribute("d", trailD(p, +t.dataset.off || 0)));
      fps.forEach((f) => f.classList.toggle("is-on", +f.dataset.p <= p + 1e-6));
      let stage = 0, nextSet = false;
      cps.forEach((b) => {
        const on = s >= needAt(+b.dataset.at, target);
        if (on && b.dataset.realmCp !== "5") stage++;
        if (animating && on && !b.classList.contains("is-on")) b.classList.add("is-pop");
        b.classList.toggle("is-on", on);
      });
      cps.slice().sort((a, b) => +a.dataset.at - +b.dataset.at).forEach((b) => { const n = !b.classList.contains("is-on") && !nextSet; if (n) nextSet = true; b.classList.toggle("is-next", n); });
      ticks.forEach((t, i) => t.classList.toggle("is-on", s >= needAt(ATS[i], target)));
      el.dataset.stage = String(stage);
      el.classList.toggle("is-done", s >= target);
      if (now) now.textContent = fmt(s);
      if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
      if (bar) bar.setAttribute("aria-valuenow", String(Math.round(s)));
      if (next) { const h = nextHtml(realm, Math.round(s), target, todayTxt); if (h !== lastNext) { next.innerHTML = h; lastNext = h; } }
    }

    function parallax() {
      parRaf = 0;
      if (reduce || !sc) return;
      const st = sc.scrollTop;
      if (far) far.style.transform = `translate3d(0,${(st * 0.22).toFixed(1)}px,0)`;
      if (mid) mid.style.transform = `translate3d(0,${(st * 0.1).toFixed(1)}px,0)`;
    }
    const onScroll = () => { if (!parRaf) parRaf = requestAnimationFrame(parallax); };
    const stopFollow = () => { follow = false; };

    function closeCards() {
      cards.forEach((c) => { c.hidden = true; });
      cps.forEach((b) => b.setAttribute("aria-expanded", "false"));
    }
    function openCard(i) {
      const card = cards.find((c) => c.dataset.realmCard === String(i));
      if (!card) return;
      const wasOpen = !card.hidden;
      closeCards();
      if (wasOpen) return;
      card.hidden = false;
      const b = cps.find((x) => x.dataset.realmCp === String(i));
      if (b) b.setAttribute("aria-expanded", "true");
    }
    const onClick = (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      const x = t.closest("[data-realm-close]");
      if (x && el.contains(x)) { closeCards(); return; }
      const b = t.closest("[data-realm-cp]");
      if (b && el.contains(b)) openCard(b.dataset.realmCp);
    };
    const onKey = (e) => { if (e.key === "Escape") closeCards(); };

    el.addEventListener("click", onClick);
    el.addEventListener("keydown", onKey);
    if (sc) {
      sc.addEventListener("scroll", onScroll, { passive: true });
      ["pointerdown", "wheel", "touchstart"].forEach((ev) => sc.addEventListener(ev, stopFollow, { passive: true }));
    }

    // M4: walk the steps gained since the last visit, then settle.
    if (!reduce && prev < steps && !document.hidden && typeof requestAnimationFrame === "function") {
      place(prev, false);
      scrollToSteps(prev);
      parallax();
      const dur = 1500;
      timer = setTimeout(() => {
        const t0 = performance.now();
        const tick = (tnow) => {
          const k = Math.min(1, (tnow - t0) / dur), e = 1 - Math.pow(1 - k, 3);
          place(prev + (steps - prev) * e, true);
          if (follow) scrollToSteps(prev + (steps - prev) * e);
          raf = k < 1 ? requestAnimationFrame(tick) : 0;
        };
        raf = requestAnimationFrame(tick);
      }, 350);
    } else {
      scrollToSteps(steps);
      parallax();
    }

    return {
      dispose() {
        if (raf) cancelAnimationFrame(raf);
        if (parRaf) cancelAnimationFrame(parRaf);
        clearTimeout(timer);
        el.removeEventListener("click", onClick);
        el.removeEventListener("keydown", onKey);
        if (sc) {
          sc.removeEventListener("scroll", onScroll);
          ["pointerdown", "wheel", "touchstart"].forEach((ev) => sc.removeEventListener(ev, stopFollow));
        }
      },
    };
  }

  window.EffortRealms = { realmFor, html, mount };
})();
