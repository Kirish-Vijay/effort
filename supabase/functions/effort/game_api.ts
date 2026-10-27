// The live game: wallet, the 7pm Taxman, the Sunday raid, gear and the weekly table.
// The rules are the same game.js the app and the lab run, loaded from the live site (see rules.ts).
//   POST /game         everything the app needs, after settling any finished days
//   POST /tax_start    open your Taxman fight (7pm–7:05pm your time)
//   POST /tax_finish   save the fight (checkpoints while it runs, then final: true)
//   POST /raid_join    join (or start) this Sunday's squad raid; returns the roster
//   POST /raid_sync    the host phone saves the fight so anyone can pick it up
//   POST /raid_finish  pay out the raid, climb the ladder, settle the week
//   POST /buy | /upgrade | /equip
//   POST /squad_create make a squad and join it
import { rules } from "./rules.ts";

// deno-lint-ignore no-explicit-any
type Any = any;
let G: Any; // the rules (game.js), loaded before each request is handled

// Days before this aren't paid out (the live game started here).
const LAUNCH_DAY = "2026-10-27";
// Squads raid together, so the raid runs on UK time for everyone.
const SQUAD_TZ = "Europe/London";
// No scroll data at all for a day: assume this many minutes.
const NO_SCROLL_MIN = 30;
const DAY_MS = 86400000;

// ---------- dates ----------
function localDate(d: Date | number, tz: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
  } catch {
    return new Date(d).toISOString().slice(0, 10);
  }
}
const addDays = (day: string, n: number) => new Date(Date.parse(day + "T12:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
const dow = (day: string) => new Date(day + "T12:00:00Z").getUTCDay();
const mondayOf = (day: string) => addDays(day, -((dow(day) + 6) % 7));
function offsetMs(t: number, tz: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - Math.floor(t / 1000) * 1000;
}
// hh:mm on a calendar day in a time zone, as a timestamp (handles the clocks changing).
function zoned(day: string, hh: number, mm: number, tz: string) {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - offsetMs(guess, tz);
  t = guess - offsetMs(t, tz);
  return t;
}
function daysFrom(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}
const goodTz = (tz: unknown) => { try { new Intl.DateTimeFormat("en", { timeZone: String(tz) }); return String(tz); } catch { return SQUAD_TZ; } };

// ---------- windows ----------
// An owner test window (groups.test_until) opens both fights now, for real, until it closes.
function taxWindow(now: number, tz: string, test: number | null) {
  const day = localDate(now, tz);
  const opens = zoned(day, G.RULES.windowHour, 0, tz), closes = opens + G.RULES.dailyWindowMin * 60000;
  const next = now < closes ? opens : zoned(addDays(day, 1), G.RULES.windowHour, 0, tz);
  if (test && test > now) return { day, opens: now, closes: test, next: now, open: true, test: true };
  return { day, opens, closes, next, open: now >= opens && now < closes, test: false };
}
function raidWindow(now: number, test: number | null) {
  const today = localDate(now, SQUAD_TZ);
  let sunday = addDays(today, (7 - dow(today)) % 7);
  let opens = zoned(sunday, G.RULES.windowHour, 0, SQUAD_TZ), closes = opens + G.RULES.raidMin * 60000;
  if (now >= closes) { sunday = addDays(sunday, 7); opens = zoned(sunday, G.RULES.windowHour, 0, SQUAD_TZ); closes = opens + G.RULES.raidMin * 60000; }
  if (test && test > now) return { slot: "test:" + new Date(test).toISOString(), weekStart: mondayOf(today), opens: now, closes: test, open: true, test: true };
  return { slot: sunday, weekStart: addDays(sunday, -6), opens, closes, open: now >= opens && now < closes, test: false };
}

// ---------- reading data ----------
const MEMBER_COLS = "id,name,character,gear,raid_pos,tz,created_at,steps_synced_at,steps_source,scroll_synced_at";
async function squadOf(db: Any, playerId: string) {
  const { data: mine } = await db.from("memberships").select("group_id, groups(*)").eq("player_id", playerId).order("joined_at").limit(1);
  const g = mine?.[0]?.groups;
  if (!g) return null;
  const { data: mem } = await db.from("memberships").select(`joined_at, players(${MEMBER_COLS})`).eq("group_id", g.id).order("joined_at");
  return { group: g, members: (mem ?? []).map((m: Any) => ({ ...m.players, joined_at: m.joined_at })) };
}
// steps[id][day], with paralysis penalties taken off.
async function stepsFor(db: Any, ids: string[], from: string, to: string) {
  const out: Record<string, Record<string, number>> = Object.fromEntries(ids.map((id) => [id, {}]));
  if (!ids.length) return out;
  const [st, adj] = await Promise.all([
    db.from("daily_steps").select("player_id,day,steps").in("player_id", ids).gte("day", from).lte("day", to).limit(20000),
    db.from("step_adjust").select("player_id,day,steps").in("player_id", ids).gte("day", from).lte("day", to),
  ]);
  for (const r of st.data ?? []) out[r.player_id][r.day] = r.steps;
  for (const r of adj.data ?? []) out[r.player_id][r.day] = Math.max(0, (out[r.player_id][r.day] ?? 0) - r.steps);
  return out;
}
async function debtFor(db: Any, id: string, day: string) {
  const { data } = await db.from("step_adjust").select("steps").eq("player_id", id).eq("day", day);
  return (data ?? []).reduce((s: number, r: Any) => s + r.steps, 0);
}
async function scrollFor(db: Any, id: string, from: string, to: string) {
  const { data } = await db.from("daily_scroll").select("day,minutes,auto_minutes").eq("player_id", id).gte("day", from).lte("day", to);
  return Object.fromEntries((data ?? []).map((r: Any) => [r.day, r.minutes ?? r.auto_minutes ?? NO_SCROLL_MIN]));
}
const avgOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// Everything in the ledger for these players: wallet, XP and owned gear all come from it.
async function ledgerFor(db: Any, ids: string[]) {
  const { data } = await db.from("ledger").select("player_id,kind,ref,amount,xp,note,at").in("player_id", ids).order("at", { ascending: false }).limit(50000);
  const out: Record<string, Any> = Object.fromEntries(ids.map((id) => [id, { wallet: 0, xp: 0, inv: {}, rows: [] }]));
  for (const r of data ?? []) {
    const L = out[r.player_id];
    L.wallet += r.amount; L.xp += r.xp; L.rows.push(r);
    if (r.kind === "buy" && !(r.ref in L.inv)) L.inv[r.ref] = 0;
    if (r.kind === "upgrade") { const [id, lv] = r.ref.split(":"); L.inv[id] = Math.max(L.inv[id] ?? 0, Number(lv) || 0); }
  }
  return out;
}
const statsOf = (p: Any) => G.stats(p.character || {});
const level = (L: Any) => G.levelOf(L.xp);
const cleanGear = (gear: Any, inv: Record<string, number>) => Object.fromEntries(Object.entries(gear || {}).filter(([slot, id]) => G.itemById(id)?.slot === slot && (id as string) in inv));

// ---------- settling days ----------
const netOf = (E: number, rate: number, knocked: number, steal: number) => E - Math.round(E * rate * (1 - knocked)) + Math.round(E * steal);

// Pays out every finished day since the player last checked: steps → Efforts, minus the Taxman's cut.
// A day you fought him uses the terms you fought for (part of it was paid on the night); a day you
// didn't fight pays the full tax.
async function settleDays(db: Any, player: Any, squad: Any, L: Any, now: number) {
  const tz = player.tz || SQUAD_TZ;
  const today = localDate(now, tz);
  const from = [LAUNCH_DAY, localDate(Date.parse(player.created_at), tz), addDays(today, -21)].sort().pop()!;
  const yesterday = addDays(today, -1);
  if (from > yesterday) return 0;
  const done = new Set(L.rows.filter((r: Any) => r.kind === "day").map((r: Any) => r.ref));
  const days = daysFrom(from, yesterday).filter((d) => !done.has(d));
  if (!days.length) return 0;
  const ids = squad ? squad.members.map((m: Any) => m.id) : [player.id];
  const [steps, scroll, fights] = await Promise.all([
    stepsFor(db, ids, days[0], days[days.length - 1]),
    scrollFor(db, player.id, days[0], days[days.length - 1]),
    db.from("tax_fights").select("*").eq("player_id", player.id).gte("day", days[0]).lte("day", days[days.length - 1]),
  ]);
  const fightOn = Object.fromEntries((fights.data ?? []).map((f: Any) => [f.day, f]));
  const rows = days.map((day) => {
    const s = steps[player.id][day] ?? 0, E = G.effortsFromSteps(s);
    const f = fightOn[day];
    let net, how;
    if (f) { net = netOf(E, Number(f.rate), Number(f.knocked), Number(f.steal_pct)); how = Number(f.knocked) >= 1 ? "knocked him out" : `fought, ${Math.round(Number(f.rate) * (1 - Number(f.knocked)) * 100)}% tax`; }
    else {
      const rate = G.taxRate(s, scroll[day] ?? NO_SCROLL_MIN, avgOf(ids.map((id: string) => steps[id][day] ?? 0)));
      net = E - Math.round(E * rate); how = `didn't fight, ${Math.round(rate * 100)}% tax`;
    }
    const paid = L.rows.filter((r: Any) => r.kind === "tax" && r.ref === day).reduce((a: number, r: Any) => a + r.amount, 0);
    const amount = net - paid;
    return { player_id: player.id, kind: "day", ref: day, amount, xp: Math.max(0, amount), note: `${s.toLocaleString("en-GB")} steps · ${how}` };
  });
  await db.from("ledger").upsert(rows, { onConflict: "player_id,kind,ref", ignoreDuplicates: true });
  return rows.length;
}

// The week's table for a squad: everyone's steps Monday to `to`, plus who's too new to be ranked.
async function weekRows(db: Any, squad: Any, weekStart: string, to: string) {
  const ids = squad.members.map((m: Any) => m.id);
  const steps = await stepsFor(db, ids, weekStart, to);
  const freshAfter = zoned(addDays(weekStart, 3), 0, 0, SQUAD_TZ);
  return squad.members.map((m: Any) => ({
    id: m.id, name: m.name,
    weekSteps: Object.values(steps[m.id]).reduce((a: number, b: Any) => a + (b as number), 0),
    todaySteps: steps[m.id][to] ?? 0,
    fresh: Date.parse(m.joined_at) > freshAfter,
  }));
}

// The weekly settlement: the week's lowest walker pays a cut of their week's Efforts to the top walker.
// Runs when the Sunday raid ends, or the next time anyone opens the app if there was no raid.
async function settleWeek(db: Any, squad: Any, weekStart: string) {
  const ref = `${squad.group.code}:${weekStart}`;
  const { data: done } = await db.from("ledger").select("player_id,amount").eq("kind", "slacker").eq("ref", ref);
  if (done?.length) {
    const from = done.find((r: Any) => r.amount < 0), to = done.find((r: Any) => r.amount > 0);
    return from && to ? { from: from.player_id, to: to.player_id, amount: to.amount } : null;
  }
  const rows = await weekRows(db, squad, weekStart, addDays(weekStart, 6));
  const T = G.weekTable(rows);
  const top = T.rows.find((r: Any) => r.title === "top"), last = T.rows.find((r: Any) => r.title === "last");
  if (!top || !last) return null;
  const amount = Math.round(G.RULES.slackerTax * last.weekSteps / G.RULES.stepsPerEffort);
  if (amount <= 0) return null;
  const { error } = await db.from("ledger").insert([
    { player_id: last.id, kind: "slacker", ref, amount: -amount, note: `Lowest walker this week: paid ${top.name}` },
    { player_id: top.id, kind: "slacker", ref, amount, note: `Top walker this week: ${last.name} paid up` },
  ]);
  if (error) return null; // someone else settled it at the same moment
  return { from: last.id, to: top.id, amount };
}

// The squad as raid fighters, with stride and title from the whole squad's week.
async function rosterFor(db: Any, squad: Any, weekStart: string, to: string) {
  const ids = squad.members.map((m: Any) => m.id);
  const [rows, ledgers] = await Promise.all([weekRows(db, squad, weekStart, to), ledgerFor(db, ids)]);
  const T = G.weekTable(rows);
  return squad.members.map((m: Any) => {
    const row = T.rows.find((r: Any) => r.id === m.id), L = ledgers[m.id];
    return {
      id: m.id, name: m.name, answers: m.character || null, stats: statsOf(m), equipped: cleanGear(m.gear, L.inv), inv: L.inv,
      pos: m.raid_pos || null, weekSteps: row.weekSteps, stride: row.stride, title: row.title, fresh: row.fresh, level: level(L),
    };
  });
}

// ---------- the routes ----------
const GAME_ROUTES = new Set(["game", "tax_start", "tax_finish", "raid_join", "raid_sync", "raid_finish", "buy", "upgrade", "equip"]);
export async function gameRoute(action: string, body: Any, ctx: { db: Any; json: Any; fail: Any; playerByToken: Any }) {
  const { db, json, fail } = ctx;
  if (!GAME_ROUTES.has(action)) return null;
  G = await rules();
  const now = Date.now();
  const player = await ctx.playerByToken(body.token);
  if (!player) return fail("Unknown token", 401);
  const tz = goodTz(player.tz);
  const squad = await squadOf(db, player.id);
  const test = squad?.group.test_until ? Date.parse(squad.group.test_until) : null;

  switch (action) {
    case "game": {
      let L = (await ledgerFor(db, [player.id]))[player.id];
      const settled = await settleDays(db, player, squad, L, now);
      // Last week's table, if nobody's settled it yet (no raid happened).
      const thisMonday = mondayOf(localDate(now, SQUAD_TZ));
      if (squad && squad.members.length >= 2 && Date.parse(squad.group.created_at) < zoned(thisMonday, 0, 0, SQUAD_TZ)) await settleWeek(db, squad, addDays(thisMonday, -7));
      if (settled || squad) L = (await ledgerFor(db, [player.id]))[player.id];
      const today = localDate(now, tz);
      const tw = taxWindow(now, tz, test), rw = raidWindow(now, test);
      const [{ data: fight }, debt, { data: scroll }] = await Promise.all([
        db.from("tax_fights").select("*").eq("player_id", player.id).eq("day", today).maybeSingle(),
        debtFor(db, player.id, today),
        db.from("daily_scroll").select("minutes,auto_minutes").eq("player_id", player.id).eq("day", today).maybeSingle(),
      ]);
      const { data: raw } = await db.from("daily_steps").select("steps").eq("player_id", player.id).eq("day", today).maybeSingle();
      let squadOut = null, raid = null, lastRaid = null;
      if (squad) {
        await finishStale(db, squad, now);
        const week = await weekRows(db, squad, mondayOf(localDate(now, SQUAD_TZ)), localDate(now, SQUAD_TZ));
        const ledgers = await ledgerFor(db, squad.members.map((m: Any) => m.id));
        squadOut = {
          code: squad.group.code, name: squad.group.name, tier: squad.group.tier, test_until: squad.group.test_until,
          members: squad.members.map((m: Any) => {
            const w = week.find((x: Any) => x.id === m.id), Lm = ledgers[m.id];
            return { id: m.id, name: m.name, character: m.character, gear: cleanGear(m.gear, Lm.inv), pos: m.raid_pos, level: level(Lm),
              weekSteps: w.weekSteps, todaySteps: w.todaySteps, fresh: w.fresh, synced: m.steps_synced_at, joined_at: m.joined_at };
          }),
        };
        const [{ data: cur }, { data: last }] = await Promise.all([
          db.from("raids").select("id,slot,tier,status,started_at,ends_at,result").eq("group_id", squad.group.id).eq("slot", rw.slot).maybeSingle(),
          db.from("raids").select("slot,tier,result,ends_at").eq("group_id", squad.group.id).eq("status", "done").order("ends_at", { ascending: false }).limit(1),
        ]);
        raid = cur; lastRaid = last?.[0] ?? null;
      }
      return json({
        ok: true, now,
        me: { id: player.id, name: player.name, platform: player.platform, tz, character: player.character, gear: cleanGear(player.gear, L.inv), pos: player.raid_pos,
          created_at: player.created_at, steps_synced_at: player.steps_synced_at, steps_source: player.steps_source, scroll_synced_at: player.scroll_synced_at, scroll_source: player.scroll_source },
        wallet: L.wallet, xp: L.xp, inv: L.inv,
        today: { day: today, rawSteps: raw?.steps ?? 0, debt, steps: Math.max(0, (raw?.steps ?? 0) - debt),
          scroll: scroll ? scroll.minutes ?? scroll.auto_minutes ?? null : null, noScrollMin: NO_SCROLL_MIN },
        fight, windows: { tax: tw, raid: rw }, squad: squadOut, raid, lastRaid,
        ledger: L.rows.slice(0, 25).map((r: Any) => ({ kind: r.kind, ref: r.ref, amount: r.amount, note: r.note, at: r.at })),
      });
    }

    case "tax_start": {
      const w = taxWindow(now, tz, test);
      const { data: old } = await db.from("tax_fights").select("*").eq("player_id", player.id).eq("day", w.day).maybeSingle();
      if (old?.finished_at) return fail("You've already fought the Taxman today");
      if (old && now < Date.parse(old.ends_at)) return json({ ok: true, fight: old, now, resumed: true, inputs: await taxInputs(db, player, squad, w.day) });
      if (old) return fail("Your fight's over for today");
      if (!w.open) return fail(`The Taxman only takes visitors from ${G.RULES.windowHour}:00 to ${G.RULES.windowHour}:${String(G.RULES.dailyWindowMin).padStart(2, "0")}pm`);
      const inputs = await taxInputs(db, player, squad, w.day);
      const S = G.taxmanSetup(inputs);
      const row = { player_id: player.id, day: w.day, ends_at: new Date(Math.min(w.closes, now + G.RULES.dailyWindowMin * 60000)).toISOString(),
        steps: inputs.steps, efforts: S.efforts, rate: S.taxRate, steal_cap: S.stealCap };
      const { data, error } = await db.from("tax_fights").insert(row).select().single();
      if (error) return fail("You've already started today's fight");
      return json({ ok: true, fight: data, now, inputs });
    }

    case "tax_finish": {
      const day = localDate(now - 120000, tz); // a fight that ends just after midnight still belongs to its day
      const { data: f } = await db.from("tax_fights").select("*").eq("player_id", player.id).eq("day", day).maybeSingle();
      if (!f) return fail("No fight to finish");
      if (f.finished_at) return json({ ok: true, fight: f, already: true });
      if (now > Date.parse(f.ends_at) + 90000) return fail("That fight timed out");
      const knocked = Math.max(Number(f.knocked), Math.min(1, Math.max(0, Number(body.knocked) || 0)));
      const steal = knocked >= 1 ? Math.max(Number(f.steal_pct), Math.min(Number(f.steal_cap), Math.max(0, Number(body.steal_pct) || 0))) : 0;
      const patch: Any = { knocked, steal_pct: steal, taps: Math.max(0, Math.min(100000, Math.round(Number(body.taps) || 0))) };
      if (body.final === true) patch.finished_at = new Date(now).toISOString();
      const { data: saved } = await db.from("tax_fights").update(patch).eq("player_id", player.id).eq("day", day).is("finished_at", null).select().single();
      if (!saved) return json({ ok: true, fight: f, already: true });
      let net = null;
      if (body.final === true) {
        net = netOf(f.efforts, Number(f.rate), knocked, steal);
        await db.from("ledger").upsert({ player_id: player.id, kind: "tax", ref: day, amount: net, xp: Math.max(0, net),
          note: knocked >= 1 ? `Knocked out the Taxman, stole ${Math.round(steal * 100)}%` : `Fought the Taxman down to ${Math.round(Number(f.rate) * (1 - knocked) * 100)}% tax` },
          { onConflict: "player_id,kind,ref", ignoreDuplicates: true });
      }
      return json({ ok: true, fight: saved, net });
    }

    case "raid_join": {
      if (!squad) return fail("Join a squad first");
      const w = raidWindow(now, test);
      let { data: raid } = await db.from("raids").select("*").eq("group_id", squad.group.id).eq("slot", w.slot).maybeSingle();
      if (!raid) {
        if (!w.open) return fail("The raid opens on Sunday at 7pm");
        await db.from("raids").upsert({ group_id: squad.group.id, slot: w.slot, tier: squad.group.tier, seed: crypto.getRandomValues(new Uint32Array(1))[0] >>> 1,
          started_at: new Date(now).toISOString(), ends_at: new Date(w.closes).toISOString() }, { onConflict: "group_id,slot", ignoreDuplicates: true });
        ({ data: raid } = await db.from("raids").select("*").eq("group_id", squad.group.id).eq("slot", w.slot).single());
      }
      const roster = await rosterFor(db, squad, w.weekStart, localDate(now, SQUAD_TZ));
      return json({ ok: true, now, me: player.id, raid, roster, boss: G.bossFor(raid.tier) });
    }

    case "raid_sync": {
      const raid = await squadRaid(db, squad, body.raid_id);
      if (!raid || raid.status !== "live") return json({ ok: true, status: raid?.status ?? "gone", result: raid?.result ?? null });
      const snap = body.snapshot;
      if (snap && JSON.stringify(snap).length < 300000) await db.from("raids").update({ snapshot: snap, snap_at: new Date(now).toISOString() }).eq("id", raid.id).eq("status", "live");
      return json({ ok: true, status: "live" });
    }

    case "raid_finish": {
      const raid = await squadRaid(db, squad, body.raid_id);
      if (!raid) return fail("No such raid", 404);
      const { data: lock } = await db.from("raids").update({ status: "settling" }).eq("id", raid.id).eq("status", "live").select().maybeSingle();
      if (!lock) {
        // Someone else is paying it out (or already has).
        for (let i = 0; i < 10; i++) {
          const { data: r } = await db.from("raids").select("status,result").eq("id", raid.id).single();
          if (r.status === "done") return json({ ok: true, result: r.result });
          await new Promise((res) => setTimeout(res, 400));
        }
        return fail("Still paying out, try again in a moment");
      }
      try {
        const result = await payRaid(db, squad, raid, body, now);
        await db.from("raids").update({ status: "done", result }).eq("id", raid.id);
        return json({ ok: true, result });
      } catch (e) {
        await db.from("raids").update({ status: "live" }).eq("id", raid.id); // let the next attempt try again
        throw e;
      }
    }

    case "buy": {
      const L = (await ledgerFor(db, [player.id]))[player.id];
      const item = G.itemById(body.item);
      if (!item) return fail("No such item");
      if (item.id in L.inv) return fail("You already own that");
      const cls = G.classOf(statsOf(player)).id, lvl = level(L);
      if (item.cls && item.cls !== cls) return fail("That's for another class");
      if (G.tierOf(item.tier).lvl > lvl) return fail(`Unlocks at level ${G.tierOf(item.tier).lvl}`);
      const deal = body.deal === true && G.dealsFor(localDate(now, tz), cls, lvl).includes(item.id);
      const price = G.priceOf(item, deal);
      const { data: bal, error } = await db.rpc("spend", { p_player: player.id, p_kind: "buy", p_ref: item.id, p_amount: price, p_note: `Bought ${item.name}${deal ? " (deal)" : ""}` });
      if (error) throw error;
      if (bal === -1) return fail("Not enough Endeavours");
      if (bal === -2) return fail("You already own that");
      await db.from("players").update({ gear: { ...cleanGear(player.gear, { ...L.inv, [item.id]: 0 }), [item.slot]: item.id } }).eq("id", player.id);
      return json({ ok: true, wallet: bal });
    }

    case "upgrade": {
      const L = (await ledgerFor(db, [player.id]))[player.id];
      const item = G.itemById(body.item);
      if (!item || !(item.id in L.inv)) return fail("You don't own that");
      const up = L.inv[item.id];
      if (up >= G.RULES.upgradeMax) return fail("Already maxed");
      const cost = G.upgradeCost(item, up);
      const { data: bal, error } = await db.rpc("spend", { p_player: player.id, p_kind: "upgrade", p_ref: `${item.id}:${up + 1}`, p_amount: cost, p_note: `Upgraded ${item.name} to +${up + 1}` });
      if (error) throw error;
      if (bal === -1) return fail("Not enough Endeavours");
      if (bal === -2) return fail("Already upgraded");
      return json({ ok: true, wallet: bal });
    }

    case "equip": {
      const L = (await ledgerFor(db, [player.id]))[player.id];
      const patch: Any = {};
      if ("slot" in body) {
        if (!G.SLOTS.includes(body.slot)) return fail("Bad slot");
        const gear = cleanGear(player.gear, L.inv);
        if (body.item) {
          const item = G.itemById(body.item);
          if (!item || item.slot !== body.slot || !(item.id in L.inv)) return fail("You can't equip that");
          gear[body.slot] = item.id;
        } else delete gear[body.slot];
        patch.gear = gear;
      }
      if ("pos" in body) patch.raid_pos = G.POSITIONS.some((p: Any) => p.id === body.pos) ? body.pos : null;
      await db.from("players").update(patch).eq("id", player.id);
      return json({ ok: true });
    }

    default:
      return null;
  }
}

async function taxInputs(db: Any, player: Any, squad: Any, day: string) {
  const ids = squad ? squad.members.map((m: Any) => m.id) : [player.id];
  const [steps, scroll, L] = await Promise.all([stepsFor(db, ids, day, day), scrollFor(db, player.id, day, day), ledgerFor(db, [player.id])]);
  const inv = L[player.id].inv;
  return {
    steps: steps[player.id][day] ?? 0, scrollMin: scroll[day] ?? NO_SCROLL_MIN,
    squadAvg: squad && ids.length > 1 ? avgOf(ids.map((id: string) => steps[id][day] ?? 0)) : 0,
    stats: statsOf(player), equipped: cleanGear(player.gear, inv), inv, level: level(L[player.id]),
  };
}

// A raid whose time is up but nobody paid out (everyone's phone dropped at the end): pay it from the
// host's last saved snapshot.
async function finishStale(db: Any, squad: Any, now: number) {
  const { data } = await db.from("raids").select("*").eq("group_id", squad.group.id).eq("status", "live").lt("ends_at", new Date(now - 60000).toISOString());
  for (const raid of data ?? []) {
    const { data: lock } = await db.from("raids").update({ status: "settling" }).eq("id", raid.id).eq("status", "live").select().maybeSingle();
    if (!lock) continue;
    const s = raid.snapshot;
    const body = s ? {
      how: s.over && s.result ? s.result.how : s.boss.hp <= 0 ? "won" : "timeout", frac: 1 - s.boss.hp / s.boss.max, paralysed: !!s.paralysed, deepDive: s.deepDive || 0,
      members: s.members.map((m: Any) => ({ id: m.id, dmg: m.dmg, healed: m.healed, taken: m.taken })),
    } : { how: "timeout", members: [] };
    try {
      const result = await payRaid(db, squad, raid, body, now);
      await db.from("raids").update({ status: "done", result }).eq("id", raid.id);
    } catch (e) {
      console.error(e);
      await db.from("raids").update({ status: "live" }).eq("id", raid.id);
    }
  }
}

async function squadRaid(db: Any, squad: Any, id: unknown) {
  if (!squad || typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from("raids").select("*").eq("id", id).eq("group_id", squad.group.id).maybeSingle();
  return data;
}

// The host's phone reports how the fight went; the server works out the pay itself from the squad's real
// gear and steps (so the boss's level and everyone's share can't be fiddled), then pays everyone.
async function payRaid(db: Any, squad: Any, raid: Any, body: Any, now: number) {
  const weekStart = raid.slot.startsWith("test:") ? mondayOf(localDate(Date.parse(raid.started_at), SQUAD_TZ)) : addDays(raid.slot, -6);
  const roster = await rosterFor(db, squad, weekStart, localDate(Date.parse(raid.started_at), SQUAD_TZ));
  const report: Record<string, Any> = Object.fromEntries((Array.isArray(body.members) ? body.members : []).filter((m: Any) => m && typeof m.id === "string").map((m: Any) => [m.id, m]));
  const fighters = roster.filter((m: Any) => report[m.id]);
  const how = ["won", "timeout", "wiped"].includes(body.how) ? body.how : "timeout";
  let result: Any = { how, frac: 0, pool: 0, shares: [], boss: G.bossFor(raid.tier).name, tier: raid.tier, settle: null };
  if (fighters.length) {
    const R = G.raidCreate(fighters, { seed: Number(raid.seed), tier: raid.tier, minutes: G.RULES.raidMin });
    const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Number(v) || 0));
    for (const m of R.members) { const r = report[m.id]; m.dmg = n(r.dmg, 1e10); m.healed = n(r.healed, 1e7); m.taken = n(r.taken, 1e7); }
    // Nobody can have dealt more than the boss had.
    const dealt = R.members.reduce((s: number, m: Any) => s + m.dmg, 0);
    if (dealt > R.boss.max) for (const m of R.members) m.dmg *= R.boss.max / dealt;
    const frac = how === "won" ? 1 : Math.min(0.999, n(body.frac, 1), dealt / R.boss.max);
    R.boss.hp = R.boss.max * (1 - frac);
    R.paralysed = body.paralysed === true;
    R.deepDive = Math.round(n(body.deepDive, R.boss.max));
    G.raidEnd(R, how);
    result = { ...R.result, settle: null };
    await db.from("ledger").upsert(result.shares.map((s: Any) => ({
      player_id: s.id, kind: "raid", ref: raid.id, amount: s.reward, xp: Math.max(0, s.reward) + Math.round(s.dmg / 1000),
      note: `${R.boss.name}: ${{ won: "won", timeout: "out of time", wiped: "wiped" }[how as "won"]}`,
    })), { onConflict: "player_id,kind,ref", ignoreDuplicates: true });
    if (R.paralysed) {
      const tomorrow = addDays(localDate(now, SQUAD_TZ), 1);
      await db.from("step_adjust").upsert(fighters.map((m: Any) => ({ player_id: m.id, day: tomorrow, steps: G.RULES.paralysedSteps, reason: "paralysed" })),
        { onConflict: "player_id,day,reason", ignoreDuplicates: true });
    }
    if (how === "won" && raid.tier === squad.group.tier) await db.from("groups").update({ tier: raid.tier + 1 }).eq("id", squad.group.id).eq("tier", raid.tier);
  }
  // Sunday's raid closes the week: settle the walking table for the whole squad (test raids don't).
  if (!raid.slot.startsWith("test:") && squad.members.length >= 2) result.settle = await settleWeek(db, squad, weekStart);
  const s = result.settle;
  result.shares = result.shares.map((x: Any) => {
    const tax = s ? (x.id === s.to ? s.amount : x.id === s.from ? -s.amount : 0) : 0;
    return { ...x, tax, total: x.reward + tax };
  });
  result.names = Object.fromEntries(squad.members.map((m: Any) => [m.id, m.name]));
  return result;
}
