// The live game: wallet, the evening Taxman, the Sunday raid, gear and the weekly table.
// The rules are the same game.js the app and the lab run, kept in the database (see rules.ts).
//   POST /game         everything the app needs, after settling any finished days
//   POST /tax_start    open your Taxman fight (any time 6pm–9pm your time; a fight lasts 5 minutes)
//   POST /tax_finish   save the fight (checkpoints while it runs, then final: true)
//   POST /raid_lobby   Sunday 6–9pm: join the lobby, pick the boss, say you're ready (it starts when 4+ are ready)
//   POST /raid_join    once it's started, join the fight; returns the roster
//   POST /raid_sync    the host phone saves the fight so anyone can pick it up
//   POST /raid_finish  pay out the raid, climb the ladder, settle the week
//   POST /buy | /upgrade | /equip
//   POST /season_claim claim a season reward: a story chapter, a track tier or a weekly bounty
//   POST /den_give     put Efforts into a room of the squad's Den
//   POST /wardrobe     buy or wear cosmetics (and wear skins from The House)
//   POST /gamba        buy one of Winny's Gamba Buckets
//   POST /hunt_finish  Wednesday's Midweek Hunt: report the fight, get your share
//   POST /chat_list | /chat_around | /chat_send | /chat_edit | /chat_delete | /chat_search   squad chat (see chat.ts)
//   POST /squad_create make a squad and join it
import { rules } from "./rules.ts";
import { chatLatest, chatRoute } from "./chat.ts";

// deno-lint-ignore no-explicit-any
type Any = any;
let G: Any; // the rules (game.js), loaded before each request is handled

// Days before this aren't paid out (the live game started here).
const LAUNCH_DAY = "2026-10-27";
// Squads raid together, so the raid runs on UK time for everyone.
const SQUAD_TZ = "Europe/London";
// Apps that report on their own (the Effort app, the iPhone open/close automation). Anyone else's app time counts
// as over budget (Game.scrollCounted): not linking never pays.
const scrollLinked = (player: Any) => player?.scroll_source === "auto";
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
// The Taxman's in from 6pm to 9pm; a fight can start any time in between and lasts five minutes.
// An owner test window (groups.test_until) opens both fights now, for real, until it closes.
function taxWindow(now: number, tz: string, test: number | null) {
  const day = localDate(now, tz);
  const opens = zoned(day, G.RULES.windowHour, 0, tz), closes = zoned(day, G.RULES.windowCloseHour ?? 21, 0, tz);
  const next = now < closes ? opens : zoned(addDays(day, 1), G.RULES.windowHour, 0, tz);
  if (test && test > now) return { day, opens: now, closes: test, next: now, open: true, test: true };
  return { day, opens, closes, next, open: now >= opens && now < closes, test: false };
}
// Sunday's lobby opens at 6pm and the raid has to start by 9pm; the fight itself is 15 minutes from then.
const RAID_FROM = 18, RAID_UNTIL = 21;
function raidWindow(now: number, test: number | null) {
  const today = localDate(now, SQUAD_TZ);
  let sunday = addDays(today, (7 - dow(today)) % 7);
  let opens = zoned(sunday, RAID_FROM, 0, SQUAD_TZ), closes = zoned(sunday, RAID_UNTIL, 0, SQUAD_TZ);
  if (now >= closes) { sunday = addDays(sunday, 7); opens = zoned(sunday, RAID_FROM, 0, SQUAD_TZ); closes = zoned(sunday, RAID_UNTIL, 0, SQUAD_TZ); }
  if (test && test > now) return { slot: "test:" + new Date(test).toISOString(), weekStart: mondayOf(today), opens: now, closes: test, open: true, test: true };
  return { slot: sunday, weekStart: addDays(sunday, -6), opens, closes, open: now >= opens && now < closes, test: false };
}

// ---------- reading data ----------
const MEMBER_COLS = "id,name,character,gear,raid_pos,tz,created_at,steps_synced_at,steps_source,scroll_synced_at,cosmetics";
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
  return Object.fromEntries((data ?? []).map((r: Any) => [r.day, r.minutes ?? r.auto_minutes ?? 0]));
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

// The House: everything raised from skins so far (paid through Stripe; see the effort-house function).
async function houseTotal(db: Any) {
  const { data } = await db.from("house_payments").select("pence");
  return { pence: (data ?? []).reduce((a: number, r: Any) => a + (r.pence || 0), 0), count: (data ?? []).length };
}

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
      const rate = G.taxRate(s, G.scrollCounted(s, scroll[day], scrollLinked(player)), avgOf(ids.map((id: string) => steps[id][day] ?? 0)));
      net = E - Math.round(E * rate); how = `didn't fight, ${Math.round(rate * 100)}% tax`;
    }
    const paid = L.rows.filter((r: Any) => r.kind === "tax" && r.ref === day).reduce((a: number, r: Any) => a + r.amount, 0);
    const amount = net - paid;
    return { player_id: player.id, kind: "day", ref: day, amount, xp: Math.max(0, amount), note: `${s.toLocaleString("en-GB")} steps · ${how}` };
  });
  await db.from("ledger").upsert(rows, { onConflict: "player_id,kind,ref", ignoreDuplicates: true });
  return rows.length;
}

// Once the Taxman's settled for today (fought, beaten or missed), today's walking is paid as it comes in, on those
// terms: the whole day, midnight to midnight, so steps after the fight count the same way. It's the day's "tax"
// row, kept up to date; at midnight settleDays pays whatever's left (usually nothing). Returns true if it paid.
async function bankToday(db: Any, player: Any, squad: Any, now: number) {
  const tz = goodTz(player.tz), day = localDate(now, tz), w = taxWindow(now, tz, null);
  if (day < LAUNCH_DAY) return false;
  const { data: f } = await db.from("tax_fights").select("*").eq("player_id", player.id).eq("day", day).maybeSingle();
  if (f ? !f.finished_at && now <= Date.parse(f.ends_at) + 90000 : now < w.closes) return false; // not settled yet
  const ids = squad ? squad.members.map((m: Any) => m.id) : [player.id];
  const [steps, scroll, { data: row }] = await Promise.all([
    stepsFor(db, ids, day, day), scrollFor(db, player.id, day, day),
    db.from("ledger").select("amount").eq("player_id", player.id).eq("kind", "tax").eq("ref", day).maybeSingle(),
  ]);
  const s = steps[player.id][day] ?? 0, E = G.effortsFromSteps(s);
  let net: number, note: string;
  if (f) {
    const knocked = Number(f.knocked), rate = Number(f.rate);
    net = netOf(E, rate, knocked, Number(f.steal_pct));
    note = knocked >= 1 ? `Knocked out the Taxman, stole ${Math.round(Number(f.steal_pct) * 100)}%` : `Fought the Taxman down to ${Math.round(rate * (1 - knocked) * 100)}% tax`;
  } else {
    const rate = G.taxRate(s, G.scrollCounted(s, scroll[day], scrollLinked(player)), avgOf(ids.map((id: string) => steps[id][day] ?? 0)));
    net = E - Math.round(E * rate); note = `Missed the Taxman: ${Math.round(rate * 100)}% tax`;
  }
  note += ` · ${s.toLocaleString("en-GB")} steps so far`;
  if (row && row.amount === net) return false;
  await db.from("ledger").upsert({ player_id: player.id, kind: "tax", ref: day, amount: net, xp: Math.max(0, net), note }, { onConflict: "player_id,kind,ref" });
  return true;
}

// The week's table for a squad: everyone's steps Monday to `to`, plus who's too new to be ranked.
async function weekRows(db: Any, squad: Any, weekStart: string, to: string) {
  const ids = squad.members.map((m: Any) => m.id);
  const steps = await stepsFor(db, ids, weekStart, to);
  const freshAfter = zoned(addDays(weekStart, 3), 0, 0, SQUAD_TZ), saturday = addDays(weekStart, 5);
  return squad.members.map((m: Any) => {
    // Only steps from the day they joined the squad count; days before that aren't theirs to claim.
    const joined = localDate(Date.parse(m.joined_at), SQUAD_TZ), from = joined > weekStart ? joined : weekStart;
    return {
      id: m.id, name: m.name,
      weekSteps: Object.entries(steps[m.id]).reduce((a: number, [day, n]: Any) => a + (day >= from ? n : 0), 0),
      todaySteps: steps[m.id][to] ?? 0,
      fresh: Date.parse(m.joined_at) > freshAfter,
      goalDays: from > saturday ? 0 : daysFrom(from, saturday).length,
    };
  });
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
      id: m.id, name: m.name, answers: m.character || null, wear: m.cosmetics || {}, stats: statsOf(m), equipped: cleanGear(m.gear, L.inv), inv: L.inv,
      pos: m.raid_pos || null, weekSteps: row.weekSteps, stride: row.stride, title: row.title, fresh: row.fresh, goalDays: rows.find((r: Any) => r.id === m.id)?.goalDays ?? 6, level: level(L),
    };
  });
}

// The day the calendar uses for this squad: today in the UK, or (test squads only) groups.season_day.
const gameDay = (squad: Any, now: number) => squad?.group.season_day || localDate(now, SQUAD_TZ);

// ---------- the Den ----------
// Contributions are ledger rows of kind "den", ref "groupId:room:time". Totals and levels per room.
async function denFor(db: Any, squad: Any) {
  const totals: Record<string, number> = Object.fromEntries(G.DEN_ROOMS.map((r: Any) => [r.id, 0]));
  if (!squad) return { totals, levels: {} as Record<string, number> };
  const { data } = await db.from("ledger").select("amount,ref").eq("kind", "den").like("ref", `${squad.group.id}:%`).limit(50000);
  for (const r of data ?? []) { const room = r.ref.split(":")[1]; if (room in totals) totals[room] += -r.amount; }
  const levels = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, G.denLevel(v)]));
  return { totals, levels };
}
// Wardrobe pieces bought with Endeavours, plus skins bought for real money (granted by the effort-house webhook).
const ownedCosmetics = (L: Any) => L.rows.filter((r: Any) => r.kind === "cosmetic" || r.kind === "skin").map((r: Any) => r.ref);

// ---------- the season ----------
// Where the squad is on the journey, this player's track, the chapters that are open, the week's bounties
// (this week's and last week's, so a Sunday bounty can be claimed on Monday) and what's been claimed.
async function seasonState(db: Any, player: Any, squad: Any, L: Any, now: number, den: Any = null) {
  // groups.season_day (set only in the database, for test squads) pretends it's that day for the season.
  const today = squad?.group.season_day || localDate(now, SQUAD_TZ), so = G.seasonOn(today);
  if (!so) return null;
  const S = so.season;
  const claimed = L.rows.filter((r: Any) => r.kind === "season" && r.ref.startsWith(S.id + ":")).map((r: Any) => r.ref);
  const base = { id: S.id, n: S.n, name: S.name, route: S.route, start: S.start, end: so.end, week: so.week, upcoming: !!so.upcoming, affix: S.affix, set: S.set, written: !!S.written,
    miles: 0, total: S.miles[S.miles.length - 1], mySteps: 0, track: 0, chapters: [] as number[], claimed, bounties: [] as Any[] };
  if (so.upcoming) return base;
  const ids = squad ? squad.members.map((m: Any) => m.id) : [player.id];
  const steps = await stepsFor(db, ids, S.start, today);
  const joined = (m: Any) => localDate(Date.parse(m.joined_at || m.created_at), SQUAD_TZ);
  const members = squad ? squad.members : [{ ...player, joined_at: player.created_at }];
  // Each day the squad moves by its average walker, counting only people who'd joined by then.
  const avgs = daysFrom(S.start, today).map((day) => avgOf(members.filter((m: Any) => joined(m) <= day).map((m: Any) => steps[m.id][day] ?? 0)));
  const miles = G.journeyMiles(S, avgs, G.denMods(den?.levels).miles || 0);
  const mySteps = Object.values(steps[player.id] ?? {}).reduce((a: number, n: Any) => a + Number(n), 0);
  const chapters = S.miles.map((_: number, i: number) => i + 1).filter((k: number) => G.chapterOpen(S, k, so.week, miles));
  const bounties: Any[] = [];
  if (squad) {
    const thisMonday = mondayOf(today);
    for (const weekStart of [thisMonday, addDays(thisMonday, -7)]) {
      if (weekStart < S.start) continue;
      const days = daysFrom(weekStart, addDays(weekStart, 6));
      const [fights, raid, rows] = await Promise.all([
        db.from("tax_fights").select("player_id", { count: "exact", head: true }).in("player_id", ids).gte("day", weekStart).lte("day", days[6]).not("finished_at", "is", null),
        db.from("raids").select("status,result,goal").eq("group_id", squad.group.id).eq("slot", days[6]).maybeSingle(),
        weekRows(db, squad, weekStart, today < days[6] ? today : days[6]),
      ]);
      const goalMet = raid.data?.goal ? !!raid.data.goal.met : G.squadGoal(Number(squad.group.tier) || 1, rows).met;
      const wsteps = Object.fromEntries(ids.map((id: string) => [id, Object.fromEntries(days.map((d) => [d, steps[id]?.[d] ?? 0]))]));
      const list = G.bountyProgress(squad.group.code, weekStart, { ids, days, steps: wsteps, taxFights: fights.count ?? 0, goalMet, raidWon: raid.data?.status === "done" && raid.data.result?.how === "won" });
      for (const b of list) bounties.push({ ...b, weekStart, current: weekStart === thisMonday, ref: `${S.id}:b:${weekStart}:${b.slot}` });
    }
  }
  return { ...base, miles, mySteps, track: G.trackTier(mySteps), chapters, bounties };
}

// ---------- this week's boss ----------
// The lobby's choice: last week's boss, one up or one down, plus the event boss while an event is on.
function bossChoice(group: Any, day: string) {
  const last = group.last_tier ? Number(group.last_tier) : null;
  const list = last ? [...new Set([Math.max(1, last - 1), last, last + 1])] : [1];
  const want = Number(group.tier) || 1;
  const ev = G.eventOn(day), event = ev ? G.eventTier(ev.id, last || 1) : null;
  if (event) list.push(event);
  return { list, last, pick: list.includes(want) && !G.isEventTier(want) ? want : list.filter((t) => !G.isEventTier(t)).pop(), event: ev ? { ...ev, tier: event } : null };
}
// How long a player can go without checking in before they count as having left the lobby.
const LOBBY_STALE_MS = 20000;

// ---------- the routes ----------
const GAME_ROUTES = new Set(["game", "tax_start", "tax_finish", "raid_lobby", "raid_join", "raid_sync", "raid_finish", "buy", "upgrade", "equip", "season_claim", "den_give", "wardrobe", "gamba", "hunt_finish",
  "chat_list", "chat_around", "chat_send", "chat_edit", "chat_delete", "chat_search"]);
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
  if (action.startsWith("chat_")) return chatRoute(action, body, { db, json, fail, player, squad });

  switch (action) {
    case "game": {
      let L = (await ledgerFor(db, [player.id]))[player.id];
      const settled = (await settleDays(db, player, squad, L, now)) + (await bankToday(db, player, squad, now) ? 1 : 0);
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
      let squadOut = null, raid = null, lastRaid = null, hunt = null;
      const den = squad ? await denFor(db, squad) : null;
      if (squad) {
        await finishStale(db, squad, now);
        const week = await weekRows(db, squad, mondayOf(localDate(now, SQUAD_TZ)), localDate(now, SQUAD_TZ));
        const ledgers = await ledgerFor(db, squad.members.map((m: Any) => m.id));
        squadOut = {
          code: squad.group.code, name: squad.group.name, tier: squad.group.tier, test_until: squad.group.test_until, bosses: bossChoice(squad.group, gameDay(squad, now)), den,
          members: squad.members.map((m: Any) => {
            const w = week.find((x: Any) => x.id === m.id), Lm = ledgers[m.id];
            return { id: m.id, name: m.name, character: m.character, wear: m.cosmetics || {}, gear: cleanGear(m.gear, Lm.inv), pos: m.raid_pos, level: level(Lm),
              weekSteps: w.weekSteps, todaySteps: w.todaySteps, fresh: w.fresh, goalDays: w.goalDays, synced: m.steps_synced_at, joined_at: m.joined_at };
          }),
        };
        const [{ data: cur }, { data: last }] = await Promise.all([
          db.from("raids").select("id,slot,tier,status,started_at,ends_at,result,goal,fighters").eq("group_id", squad.group.id).eq("slot", rw.slot).maybeSingle(),
          db.from("raids").select("slot,tier,result,ends_at").eq("group_id", squad.group.id).eq("status", "done").order("ends_at", { ascending: false }).limit(1),
        ]);
        raid = cur; lastRaid = last?.[0] ?? null;
        hunt = await huntState(db, player, squad, L, now, den);
        if (raid?.status === "lobby") {
          const { data: lob } = await db.from("raid_lobby").select("player_id,ready,seen").eq("raid_id", raid.id);
          raid.lobby = (lob ?? []).filter((r: Any) => Date.parse(r.seen) > now - LOBBY_STALE_MS).map((r: Any) => ({ id: r.player_id, ready: r.ready }));
        }
      }
      return json({
        ok: true, now,
        me: { id: player.id, name: player.name, platform: player.platform, tz, character: player.character, wear: player.cosmetics || {}, owned: ownedCosmetics(L), gear: cleanGear(player.gear, L.inv), pos: player.raid_pos,
          created_at: player.created_at, steps_synced_at: player.steps_synced_at, steps_source: player.steps_source, scroll_synced_at: player.scroll_synced_at, scroll_source: player.scroll_source },
        wallet: L.wallet, xp: L.xp, inv: L.inv,
        today: { day: today, rawSteps: raw?.steps ?? 0, debt, steps: Math.max(0, (raw?.steps ?? 0) - debt),
          scroll: scroll ? scroll.minutes ?? scroll.auto_minutes ?? null : null, scrollLinked: scrollLinked(player) },
        fight, windows: { tax: tw, raid: rw }, squad: squadOut, raid, lastRaid, season: await seasonState(db, player, squad, L, now, den), hunt, chat: { latest: await chatLatest(db, squad) },
        features: Object.fromEntries(Object.keys(G.FEATURES).map((f) => [f, G.featureOn(f, gameDay(squad, now))])), gameDay: gameDay(squad, now),
        ledger: L.rows.slice(0, 25).map((r: Any) => ({ kind: r.kind, ref: r.ref, amount: r.amount, note: r.note, at: r.at })),
        gamba: { today: L.rows.filter((r: Any) => r.kind === "gamba" && String(r.ref).startsWith(today + ":")).length },
        house: await houseTotal(db),
      });
    }

    case "tax_start": {
      const w = taxWindow(now, tz, test);
      const { data: old } = await db.from("tax_fights").select("*").eq("player_id", player.id).eq("day", w.day).maybeSingle();
      if (old?.finished_at) return fail("You've already fought the Taxman today");
      if (old && now < Date.parse(old.ends_at)) return json({ ok: true, fight: old, now, resumed: true, inputs: await taxInputs(db, player, squad, w.day) });
      if (old) return fail("Your fight's over for today");
      if (!w.open) return fail(`The Taxman only takes visitors from ${G.RULES.windowHour - 12}pm to ${(G.RULES.windowCloseHour ?? 21) - 12}pm`);
      const inputs = await taxInputs(db, player, squad, w.day);
      const S = G.taxmanSetup(inputs);
      const row = { player_id: player.id, day: w.day, ends_at: new Date(now + G.RULES.dailyWindowMin * 60000).toISOString(),
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

    case "raid_lobby": {
      if (!squad) return fail("Join a squad first");
      const w = raidWindow(now, test), choice = bossChoice(squad.group, gameDay(squad, now));
      const sel = () => db.from("raids").select("*").eq("group_id", squad.group.id).eq("slot", w.slot).maybeSingle();
      let { data: raid } = await sel();
      if (!raid) {
        if (!w.open) return fail("The raid lobby opens on Sunday at 6pm");
        await db.from("raids").upsert({ group_id: squad.group.id, slot: w.slot, tier: choice.pick, seed: crypto.getRandomValues(new Uint32Array(1))[0] >>> 1, status: "lobby",
          started_at: new Date(now).toISOString(), ends_at: new Date(w.closes).toISOString() }, { onConflict: "group_id,slot", ignoreDuplicates: true });
        ({ data: raid } = await sel());
      }
      if (raid.status === "lobby") {
        if (now >= w.closes) return fail("Too late: the raid had to start by 9pm");
        const act = String(body.action || "poll");
        if (act === "leave") await db.from("raid_lobby").delete().eq("raid_id", raid.id).eq("player_id", player.id);
        else {
          if (act === "boss") {
            const t = Number(body.tier);
            if (!choice.list.includes(t)) return fail("You can't pick that boss this week");
            // A new boss means everyone says ready again.
            if (t !== raid.tier) { await db.from("raids").update({ tier: t }).eq("id", raid.id).eq("status", "lobby"); await db.from("raid_lobby").update({ ready: false }).eq("raid_id", raid.id); raid.tier = t; }
          }
          const row: Any = { raid_id: raid.id, player_id: player.id, seen: new Date(now).toISOString() };
          if (act === "ready" || act === "unready") row.ready = act === "ready";
          if (act === "boss") row.ready = false;
          await db.from("raid_lobby").upsert(row, { onConflict: "raid_id,player_id" });
        }
        const { data: rows } = await db.from("raid_lobby").select("player_id,ready,seen").eq("raid_id", raid.id);
        const here = (rows ?? []).filter((r: Any) => Date.parse(r.seen) > now - LOBBY_STALE_MS);
        // Four or more here and every one of them ready: it starts, with exactly them, and the week's goal locked in.
        if (here.length >= G.RULES.raidSquadSize && here.every((r: Any) => r.ready)) {
          const { data: fresh } = await sel();
          const roster = await rosterFor(db, squad, w.weekStart, localDate(now, SQUAD_TZ));
          const g = G.squadGoal(fresh.tier, roster), so = G.seasonOn(gameDay(squad, now));
          const affix = so && !so.upcoming ? so.season.affix : null, den = (await denFor(db, squad)).levels;
          await db.from("raids").update({ status: "live", started_at: new Date(now).toISOString(), ends_at: new Date(now + G.RULES.raidMin * 60000).toISOString(),
            goal: { ...g, enraged: !g.met, affix, den }, fighters: here.map((r: Any) => r.player_id) }).eq("id", raid.id).eq("status", "lobby");
        }
        ({ data: raid } = await sel());
        const lobby = (rows ?? []).map((r: Any) => ({ id: r.player_id, ready: r.ready, here: Date.parse(r.seen) > now - LOBBY_STALE_MS }));
        return json({ ok: true, now, raid: { id: raid.id, status: raid.status, tier: raid.tier, fighters: raid.fighters, goal: raid.goal }, lobby, bosses: choice, min: G.RULES.raidSquadSize, closes: w.closes });
      }
      return json({ ok: true, now, raid: { id: raid.id, status: raid.status, tier: raid.tier, fighters: raid.fighters, goal: raid.goal, result: raid.result }, lobby: [], bosses: choice, min: G.RULES.raidSquadSize, closes: w.closes });
    }

    case "raid_join": {
      if (!squad) return fail("Join a squad first");
      const w = raidWindow(now, test);
      const { data: raid } = await db.from("raids").select("*").eq("group_id", squad.group.id).eq("slot", w.slot).maybeSingle();
      if (!raid || raid.status === "lobby") return fail("The raid hasn't started yet. Join the lobby");
      if (raid.status !== "done" && !(raid.fighters || []).includes(player.id)) return fail("This raid started without you. Next week!");
      const roster = (await rosterFor(db, squad, w.weekStart, localDate(now, SQUAD_TZ))).filter((m: Any) => !raid.fighters || raid.fighters.includes(m.id));
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
      await bankToday(db, player, squad, now);
      const L = (await ledgerFor(db, [player.id]))[player.id];
      const item = G.itemById(body.item);
      if (!item) return fail("No such item");
      if (item.id in L.inv) return fail("You already own that");
      const cls = G.classOf(statsOf(player)).id, lvl = level(L);
      if (item.cls && item.cls !== cls) return fail("That's for another class");
      if (G.tierOf(item.tier).lvl > lvl) return fail(`Unlocks at level ${G.tierOf(item.tier).lvl}`);
      if (!G.onSale(item, localDate(now, SQUAD_TZ))) return fail("That's not in the shop right now");
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
      await bankToday(db, player, squad, now);
      const L = (await ledgerFor(db, [player.id]))[player.id];
      const item = G.itemById(body.item);
      if (!item || !(item.id in L.inv)) return fail("You don't own that");
      const up = L.inv[item.id];
      if (up >= G.RULES.upgradeMax) return fail("Already maxed");
      const cost = G.upgradeCost(item, up, (await denFor(db, squad)).levels);
      const { data: bal, error } = await db.rpc("spend", { p_player: player.id, p_kind: "upgrade", p_ref: `${item.id}:${up + 1}`, p_amount: cost, p_note: `Upgraded ${item.name} to +${up + 1}` });
      if (error) throw error;
      if (bal === -1) return fail("Not enough Endeavours");
      if (bal === -2) return fail("Already upgraded");
      return json({ ok: true, wallet: bal });
    }

    case "season_claim": {
      const L = (await ledgerFor(db, [player.id]))[player.id];
      const den = await denFor(db, squad);
      const st = await seasonState(db, player, squad, L, now, den);
      if (!st || st.upcoming) return fail("The season hasn't started");
      const what = String(body.what), k = Math.floor(Number(body.k));
      let ref = "", amount = 0, note = "";
      if (what === "chapter") {
        if (!st.chapters.includes(k)) return fail("That chapter isn't open yet");
        ref = `${st.id}:ch:${k}`; amount = G.RULES.chapterReward; note = `Season ${st.n}, chapter ${k}`;
      } else if (what === "track") {
        if (!(k >= 1 && k <= st.track)) return fail("Walk a bit further first");
        const r = G.trackReward(k);
        ref = `${st.id}:tr:${k}`; amount = r.efforts; note = `Season ${st.n} track, tier ${k}${r.title ? `: ${r.title}` : ""}`;
      } else if (what === "bounty") {
        const b = st.bounties.find((x: Any) => x.ref === String(body.ref));
        if (!b) return fail("No such bounty");
        if (!b.done) return fail("Not done yet");
        ref = b.ref; amount = G.RULES.bountyReward; note = `Bounty: ${b.label}`;
      } else return fail("Nothing to claim");
      amount = Math.round(amount * (1 + (G.denMods(den.levels).season || 0)));
      const { error } = await db.from("ledger").insert({ player_id: player.id, kind: "season", ref, amount, xp: amount, note });
      if (error) return fail(error.code === "23505" ? "Already claimed" : "Couldn't claim that");
      return json({ ok: true, amount, ref, wallet: L.wallet + amount });
    }

    case "den_give": {
      if (!squad) return fail("Join a squad first");
      if (!G.featureOn("den", gameDay(squad, now))) return fail("The Den opens soon");
      const room = G.DEN_ROOMS.find((r: Any) => r.id === body.room);
      if (!room) return fail("No such room");
      const amount = Math.floor(Number(body.amount));
      if (!(amount >= 100 && amount <= 1000000)) return fail("Put in at least 1 Endeavour");
      await bankToday(db, player, squad, now);
      const den = await denFor(db, squad), next = G.denNext(den.totals[room.id]);
      if (!next) return fail(`The ${room.name} is already at level ${G.DEN_MAX}`);
      const give = Math.min(amount, next.need + (() => { let more = 0; for (let L = next.level + 1; L <= G.DEN_MAX; L++) more += G.denCost(L); return more; })());
      const { data: bal, error } = await db.rpc("spend", { p_player: player.id, p_kind: "den", p_ref: `${squad.group.id}:${room.id}:${now}`, p_amount: give, p_note: `Put ${give} into the ${room.name}` });
      if (error) throw error;
      if (bal === -1) return fail("Not enough Endeavours");
      if (bal === -2) return fail("Try again");
      const after = await denFor(db, squad);
      return json({ ok: true, wallet: bal, den: after, gave: give, level: after.levels[room.id] });
    }

    case "wardrobe": {
      if (body.buy) await bankToday(db, player, squad, now);
      const L = (await ledgerFor(db, [player.id]))[player.id], owned = ownedCosmetics(L), day = gameDay(squad, now);
      // Paid skins can be worn from day one; everything else waits for the wardrobe to open.
      const skinOnly = !body.buy && Object.keys(body).filter((k) => ["suit", "band", "title", "skin"].includes(k)).every((k) => k === "skin");
      if (!skinOnly && !G.featureOn("wardrobe", day)) return fail("The wardrobe opens soon");
      if (body.buy) {
        const w = G.wardrobeById(body.buy);
        if (!w) return fail("No such item");
        if (w.event) return fail("That one's won at an event");
        if (owned.includes(w.id)) return fail("You already have it");
        const { data: bal, error } = await db.rpc("spend", { p_player: player.id, p_kind: "cosmetic", p_ref: w.id, p_amount: w.price, p_note: `Bought ${w.name}` });
        if (error) throw error;
        if (bal === -1) return fail("Not enough Endeavours");
        if (bal === -2) return fail("You already have it");
        return json({ ok: true, wallet: bal, owned: [...owned, w.id] });
      }
      const wear: Any = { ...(player.cosmetics || {}) };
      for (const kind of ["suit", "band", "title", "skin"]) {
        if (!(kind in body)) continue;
        const id = body[kind];
        if (id === null) { delete wear[kind]; continue; }
        const w = kind === "skin" ? (G.skinById(id) && { id, kind: "skin" }) : G.wardrobeById(id);
        if (!w || w.kind !== kind || !owned.includes(id)) return fail("You don't have that");
        wear[kind] = id;
      }
      await db.from("players").update({ cosmetics: wear }).eq("id", player.id);
      return json({ ok: true, wear });
    }

    // Winny's Gamba Bucket: pay, roll here (never on the phone), pay out. The odds are Game.GAMBA, public in the app.
    case "gamba": {
      await bankToday(db, player, squad, now);
      const day = localDate(now, tz), L = (await ledgerFor(db, [player.id]))[player.id];
      const today = L.rows.filter((r: Any) => r.kind === "gamba" && String(r.ref).startsWith(day + ":")).length;
      if (today >= G.GAMBA.perDay) return fail(`That's ${G.GAMBA.perDay} buckets today. Winny's closed till midnight`);
      const ref = `${day}:${today + 1}:${crypto.randomUUID().slice(0, 8)}`;
      const { data: bal, error } = await db.rpc("spend", { p_player: player.id, p_kind: "gamba", p_ref: ref, p_amount: G.GAMBA.price, p_note: "Winny's Gamba Bucket" });
      if (error) throw error;
      if (bal === -1) return fail("Not enough Endeavours");
      if (bal === -2) return fail("Try again");
      const u = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
      const k = G.gambaRoll(u), [, win, label] = G.GAMBA.prizes[k];
      if (win > 0) {
        const { error: e2 } = await db.from("ledger").insert({ player_id: player.id, kind: "gamba-win", ref, amount: win, xp: 0, note: `Gamba Bucket: ${label}` });
        if (e2) throw e2;
      }
      return json({ ok: true, prize: k, win, wallet: bal + win, left: G.GAMBA.perDay - today - 1 });
    }

    case "hunt_finish": {
      const L = (await ledgerFor(db, [player.id]))[player.id];
      const den = await denFor(db, squad), st = await huntState(db, player, squad, L, now, den);
      if (!st?.open) return fail("The Hunt is on Wednesdays, noon to 11pm");
      if (st.done) return fail("You've hunted this week");
      const report: Record<string, Any> = Object.fromEntries((Array.isArray(body.members) ? body.members : []).filter((m: Any) => m && typeof m.id === "string").map((m: Any) => [m.id, m]));
      const how = ["won", "timeout", "wiped"].includes(body.how) ? body.how : "timeout";
      const R = G.raidCreate(st.roster, { seed: st.seed, tier: st.tier, minutes: G.HUNT.minutes, affix: st.affix, den: den.levels });
      const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Number(v) || 0));
      for (const m of R.members) { const r = report[m.id] || {}; m.dmg = n(r.dmg, 1e10); m.healed = n(r.healed, 1e7); m.taken = n(r.taken, 1e7); }
      const dealt = R.members.reduce((a: number, m: Any) => a + m.dmg, 0);
      if (dealt > R.boss.max) for (const m of R.members) m.dmg *= R.boss.max / dealt;
      R.boss.hp = R.boss.max * (1 - (how === "won" ? 1 : Math.min(0.999, n(body.frac, 1), dealt / R.boss.max)));
      G.raidEnd(R, how);
      const mine = R.result.shares.find((x: Any) => x.id === player.id), amount = Math.max(0, mine?.reward ?? 0);
      const { error } = await db.from("ledger").insert({ player_id: player.id, kind: "hunt", ref: st.day, amount, xp: amount + Math.round((mine?.dmg ?? 0) / 1000),
        note: `Midweek Hunt: ${R.boss.name}, ${{ won: "won", timeout: "out of time", wiped: "wiped" }[how as "won"]}` });
      if (error) return fail(error.code === "23505" ? "You've hunted this week" : "Couldn't save the Hunt");
      return json({ ok: true, amount, how, boss: R.boss.name, wallet: L.wallet + amount });
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

// Wednesdays, noon to 11pm UK: you and up to three squad-mates (as bots) against the squad's ladder boss.
async function huntState(db: Any, player: Any, squad: Any, L: Any, now: number, den: Any): Promise<Any> {
  const day = gameDay(squad, now);
  if (!squad || !G.featureOn("hunt", day)) return null;
  const hour = squad.group.season_day ? G.HUNT.from : Number(new Intl.DateTimeFormat("en-GB", { timeZone: SQUAD_TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date(now)));
  const open = dow(day) === G.HUNT.weekday && hour >= G.HUNT.from && hour < G.HUNT.to;
  const done = L.rows.some((r: Any) => r.kind === "hunt" && r.ref === day);
  const next = addDays(day, (G.HUNT.weekday - dow(day) + 7) % 7 || (open || done ? 7 : 0));
  const base = { open, done, day, next, minutes: G.HUNT.minutes };
  if (!open) return base;
  const tier = Math.max(1, Number(squad.group.last_tier) || 1), so = G.seasonOn(day);
  const roster = (await rosterFor(db, squad, mondayOf(day), day));
  const me = roster.find((m: Any) => m.id === player.id), mates = roster.filter((m: Any) => m.id !== player.id).slice(0, 3).map((m: Any) => ({ ...m, bot: true }));
  return { ...base, tier, boss: G.bossFor(tier).name, seed: G.hash(`${player.id}:${day}`), affix: so && !so.upcoming ? so.season.affix : null, roster: [me, ...mates], den: den?.levels || {} };
}

async function taxInputs(db: Any, player: Any, squad: Any, day: string) {
  const ids = squad ? squad.members.map((m: Any) => m.id) : [player.id];
  const [steps, scroll, L] = await Promise.all([stepsFor(db, ids, day, day), scrollFor(db, player.id, day, day), ledgerFor(db, [player.id])]);
  const inv = L[player.id].inv;
  return {
    steps: steps[player.id][day] ?? 0, scrollMin: G.scrollCounted(steps[player.id][day] ?? 0, scroll[day], scrollLinked(player)),
    squadAvg: squad && ids.length > 1 ? avgOf(ids.map((id: string) => steps[id][day] ?? 0)) : 0,
    stats: statsOf(player), equipped: cleanGear(player.gear, inv), inv, level: level(L[player.id]), den: (await denFor(db, squad)).levels,
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
  const fighters = roster.filter((m: Any) => report[m.id] && (!raid.fighters || raid.fighters.includes(m.id)));
  const how = ["won", "timeout", "wiped"].includes(body.how) ? body.how : "timeout";
  let result: Any = { how, frac: 0, pool: 0, shares: [], boss: G.bossFor(raid.tier).name, tier: raid.tier, settle: null };
  if (fighters.length) {
    const R = G.raidCreate(fighters, { seed: Number(raid.seed), tier: raid.tier, minutes: G.RULES.raidMin, enraged: !!raid.goal?.enraged, affix: raid.goal?.affix || null, den: raid.goal?.den || null });
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
  }
  if (G.isEventTier(raid.tier)) {
    // Event bosses don't move the ladder. Beating one wins its cosmetic (once).
    const ev = G.EVENTS[Math.floor((raid.tier - 100000) / 1000)], prize = G.WARDROBE.find((w: Any) => w.event === ev?.id);
    if (how === "won" && prize && result.shares?.length) {
      await db.from("ledger").upsert(result.shares.map((x: Any) => ({ player_id: x.id, kind: "cosmetic", ref: prize.id, amount: 0, xp: 0, note: `Won the ${prize.name} (${ev.name})` })),
        { onConflict: "player_id,kind,ref", ignoreDuplicates: true });
      result.prize = prize.id;
    }
  } else {
    // Next week: this boss again, one up or one down (one up is suggested after a win).
    await db.from("groups").update({ last_tier: raid.tier, tier: how === "won" ? raid.tier + 1 : raid.tier }).eq("id", squad.group.id);
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
