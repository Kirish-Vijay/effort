// Effort season stories as click-through scenes, for EffortStory.play() in story.js.
//
// The story: behind the blue glow of every screen there's a seam, and behind the seam are the realms where the
// creatures live (realms.js draws them). An old brass pedometer, the Long Count, walks a squad through the seam: every
// real step taken together is a step deeper into that week's realm. Six days walking to the creature's lair, the
// seventh mending: the Sunday raid drives it back and the Count stitches the seam shut behind it.
// Chapter k of a season is set in the realm the ladder reaches that week: 1 the Blotmarsh, 2 Puffcap Hollow,
// 3 the Hushfrost Reach, 4 the Spindrift Isles, 5 the Lowmost Deep, 6 the Misrendered Realm, 7 the Gilded Void, then
// round again deeper, 8 to 13 (ending in the Misrendered Realm). Chapters never assume last Sunday's result, so a
// squad a week behind on the ladder still reads them fine.
//
// API (window.EffortStories)
//   EffortStories.chapter(seasonId, k, ctx) -> script   seasonId "s1" (or 1), k = 1..13. Seasons 1-4 are written by
//                                                       hand; 5+ are built from world.js (EffortWorld.legs, the
//                                                       realm cycles, and its beats), deterministic per season and chapter.
//   EffortStories.title(seasonId, k) -> string          the chapter title (the place name for seasons 5+)
//   EffortStories.BOSS_LORE / EffortStories.EVENT_LORE  one line per boss for the raid screen
//   EffortStories.parse(src)                            the little scene language below, for tests
//
// The scene language (one step per line; nesting by two spaces):
//   @bg-name                     background            !shake / !flash / !dark / !light / !glitch / !fade
//   ~ text                       narration             Speaker: text           a line (you, mate, mate2, Morwenna, Taxman, boss:kraken...)
//   Speaker (Shown name): text   name tag override     set flag.name           set a flag
//   ? optional question          a choice; options follow at the same indent as "- Label {flag.name}", each with an
//   - Label {flag.name}          indented body. The flag is optional (and always contains a dot).
//   if flag.name / else          branch, bodies indented
// Text keeps {you} {squad} {mate} {mate2} {steps} for the player to fill. Story flags are prefixed by season (s1., s2.,
// s3., s4.) or g. for the long way down.
(function (root) {
"use strict";

// ---------- parser ----------
const SPEAKER = /^([\p{L}][\p{L}\p{N}'’_-]*(?::[\w-]+)?)(?: \(([^)]*)\))?: (.+)$/u;
function speaker(l) {
  const m = l.match(SPEAKER); if (!m) return null;
  const st = { who: m[1], text: m[3].trim() }; if (m[2]) st.name = m[2].trim(); return st;
}
function parse(src) {
  const lines = String(src).split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim() && !/^\s*\/\//.test(l));
  let i = 0;
  const ind = (l) => l.match(/^ */)[0].length;
  function block(d) {
    const out = [];
    while (i < lines.length) {
      const raw = lines[i], n = ind(raw), l = raw.trim();
      if (n < d) break;
      if (n > d) throw new Error(`Bad indent: "${l}"`);
      if (l === "else" || l.startsWith("- ")) break;
      i++;
      if (l[0] === "@") out.push({ bg: l.slice(1).trim() });
      else if (l[0] === "!") out.push({ fx: l.slice(1).trim() });
      else if (l.startsWith("~ ")) out.push({ narrate: l.slice(2).trim() });
      else if (l.startsWith("card:")) { const [a, b] = l.slice(5).split("|"); out.push(b && b.trim() ? { card: a.trim(), sub: b.trim() } : { card: a.trim() }); }
      else if (/^set [\w.-]+$/.test(l)) out.push({ set: l.slice(4) });
      else if (/^unset [\w.-]+$/.test(l)) out.push({ unset: l.slice(6) });
      else if (/^if [\w.!|&-]+$/.test(l)) {
        const st = { if: l.slice(3).trim(), then: block(d + 2), else: [] };
        if (i < lines.length && ind(lines[i]) === d && lines[i].trim() === "else") { i++; st.else = block(d + 2); }
        out.push(st);
      } else if (l === "?" || l.startsWith("? ")) {
        const st = { choice: [] }, q = l.slice(1).trim();
        if (q) { const sp = speaker(q); if (sp) Object.assign(st, sp); else st.narrate = q; }
        while (i < lines.length && ind(lines[i]) === d && lines[i].trim().startsWith("- ")) {
          let lab = lines[i].trim().slice(2).trim(), flag = null;
          const m = lab.match(/\s*\{([\w-]+\.[\w.-]+)\}\s*$/);
          if (m) { flag = m[1]; lab = lab.slice(0, m.index).trim(); }
          i++;
          const opt = { label: lab, then: block(d + 2) }; if (flag) opt.flag = flag;
          st.choice.push(opt);
        }
        if (!st.choice.length) throw new Error(`Choice with no options: "${l}"`);
        out.push(st);
      } else {
        const sp = speaker(l); if (!sp) throw new Error(`Can't parse: "${l}"`);
        out.push(sp);
      }
    }
    return out;
  }
  const res = block(0);
  if (i < lines.length) throw new Error(`Stray line: "${lines[i].trim()}"`);
  return res;
}
function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }


// ---------- lore for the raid screen ----------
const BOSS_LORE = {
  notification: "Brett: a slime made of every unread buzz. Lives in the Blotmarsh, and is first through the seam when a town sits down.",
  autoplay: "Rory: grew out of 'next episode in 5'. Its spores in Puffcap Hollow sit you back down.",
  leftonread: "Wisp: every message nobody answered, frozen into the Hushfrost Reach. It knows what it's like to be left behind.",
  scroll: "Gale: the endless scroll made into weather. It spins the Spindrift Isles and never stops, so you can't either.",
  kraken: "The Kraken: lives at the bottom of the Lowmost Deep, where it's always three in the morning.",
  algorithm: "Grimm: the Algorithm. Redraws the Misrendered Realm and decides what everyone sees. Wants the Long Count switched off.",
  dragon: "Vex: sleeps in the Gilded Void on a hoard of every hour ever lost to the glow. She counts them.",
  taxman: "The Taxman: collects the Stillness's rent from 6 to 11pm, every day but Sunday. Beat him and keep your Efforts.",
};
const EVENT_LORE = {
  newyear: "Rez: made of every midnight promise. The Stillness loves a plan to start tomorrow.",
  spring: "Atchoo: woke early in the allotment. When the clocks jump, the seams slip open.",
  solstice: "Solveig: sits on the sun and won't let it set. Solveig the innkeeper sleeps right through it.",
  harvest: "Big Marrow Morris: wins the show by sitting on the judges. Sitting is how it all starts.",
  haunted: "The Grey Lady sat down at a bus stop in 1962 to wait. The Stillness kept her.",
  krampus: "Krampus: the Stillness's bailiff. Comes through the seam in December for the idle, and keeps a list.",
};

// ---------- seasons 1-4: titles (seasons.js has the same titles and place names, so the map matches) ----------
const TITLES = {
  s1: ["The Long Count", "Sit Down, Stay a While", "Seen", "The Toll", "They Left Their Boots", "Every Step a Stitch", "The Summit Committee", "She Sat Down", "The Ambush", "The Lantern Book", "Nobody Lets Go", "The Bottom of the Feed", "Home, Twice"],
  s2: ["Over the Ice", "Glitter", "No Signal", "Form B12", "An Apology", "NO", "Pilgrims", "Pull Up the Planks", "The Argument", "Kept Nice and Warm", "The Carvings", "The Maelstrom Stair", "The Last Tollgate"],
  s3: ["The Quick Season", "The Button", "The Boy in the Ice", "Two Clocks", "The Cold Patch", "He Didn't Finish", "The Star That Won't Set", "Fined Twice", "Cap and Bells", "Where Kit Stopped", "Clockwork", "The Sunken Lamp", "The Render Shore"],
  s4: ["Thick Skins", "In Step", "Who Keeps the Lantern", "Thunder Tonic", "The Inkfall", "The Register", "Forty Rungs", "Mothermud", "Head Office", "The Hush Below", "Get Up, Abiah", "The Black Shelf", "Holloway's Letter"],
};
const WRITTEN_NAMES = { s1: "The Long Count", s2: "The Frozen Ledger", s3: "Wait for Me", s4: "The Error Throne" };

// ---------- SEASON 1: The Long Count (from the Blotmarsh to the Gilded Void, and round again) ----------
const S1 = [
// 1 The Long Count: the Last Lamp, then the Blotmarsh (Murkwater Ford)
`@lighthouse-night
~ At the end of the last street in town, where the pavement gives up, there's a lighthouse. Below it is a black sea that isn't on any map.
~ The lamp is lit. Nobody at the council can tell you who pays for it.
Morwenna: There you are. I've had the kettle on since 1994.
you: Sorry, have we met?
Morwenna: Not yet. You're {you}. That's {mate}. The rest of {squad} are pretending they're not scared of the dark.
~ She presses something into your hand. Brass, the size of a pocket watch. Heavy. Warm. Ticking.
Morwenna: The Long Count. Made in 1724 by an ironmaster called Abiah Holloway. Walked everywhere. Wouldn't ride a horse.
!fade
@town-glow
Morwenna: Look back at the town.
~ Every window is lit the same cold blue. Nobody is moving.
Morwenna: When people stop and sit in that glow, the world wears thin behind it. There's a seam back there. Things live on the other side.
Morwenna: Seven of them, at the moment. Each in its own realm. Each very hungry and very patient.
mate: And that thing stops them?
Morwenna: That thing walks you through to them. Every real step you take together carries you one step deeper through the seam.
!fade
@lighthouse-night
Morwenna: Six days you walk, Monday to Saturday, through whichever realm is pushing hardest. By Sunday you reach its lair.
Morwenna: Sunday, you mend. You drive it back, all of you together, and the Count stitches the seam shut behind it.
Morwenna: Walk short in the week and you get there late. What's waiting in the lair will be waiting angry.
Morwenna: And it only counts real steps, on real feet. Shaking it in a sock doesn't count. People have tried.
? Morwenna: So. Will you carry it?
- "Yes. Obviously. Look at it." {s1.eager}
  you: Yes. Obviously. Look at it, it's lovely.
  Morwenna: They all say that. Hold on to the feeling. You'll want it round about the Lowmost Deep.
- "What happened to the ones who didn't make it?" {s1.doubt}
  you: What happened to the ones who didn't make it?
  ~ She takes a long time to answer. The beam goes round twice.
  Morwenna: They stopped.
- "Why don't you carry it?"
  you: Why don't you carry it yourself?
  Morwenna: I'm a lighthouse keeper, my love. I keep the light, so walkers can find their way home. The job doesn't come with legs.
@the-seam
~ She opens the lighthouse door. Where the stairs should be, the air is split down the middle like a badly sewn coat.
~ Through the gap: green dark, and the smell of a pond that has been thinking about things.
~ You step through together. The Count ticks once, loudly, like a door shutting behind you.
@blotmarsh
~ The Blotmarsh. Black water, dead trees, reeds taller than you. Somewhere a bell is ringing under the mud.
~ The stepping stones at Murkwater Ford are slippery. One of them blinks.
~ Out in the fog something wet and round shuffles closer. It's the size of a wheelie bin. It has a little red dot on top, like an unread message.
boss:notification: BZZT. Did you see this? Did you SEE this?
!shake
mate: That's one of them? That's the first one?
~ Somewhere beyond the reeds a crater of warm slime is breathing. That's where he lives. That's where you're going.
~ Then, right behind you, a polite little cough.
Taxman (???): Excuse me. Has anyone declared that pedometer?
~ When you turn round there's nobody there. Just a clipboard-shaped dent in the fog.
~ Back through the seam the lighthouse beam goes round. For a second, just a second, it's the same blue as the windows.`,

// 2 Sit Down, Stay a While: Puffcap Hollow (The Fairy Ring)
`@puffcap
~ Puffcap Hollow. The air is thick and orange and smells of oranges and wet socks. Everything is soft. Everything looks like a cushion.
~ The seam has moved on since the Blotmarsh, wherever you left things there. The Count is pulling you this way now, and it's in a hurry.
~ At the Spore Gate, two giant mushrooms lean together like old friends. Somebody has nailed a tin box to one of them.
~ Inside: a notebook, and a rubber stamp shaped like the Count. The last entry is from 1951. The handwriting gets worse as it goes.
~ "Didn't make it. Sat down in the ring for five minutes. DO NOT SIT IN THE RING."
mate: What ring?
~ Nobody answers. The page after is blank. So is the one after that, and the one after that.
~ The Fairy Ring is a circle of small white mushrooms in a clearing. In the middle, cross-legged, sits a man in a cloak and a festival wristband from 2009.
Druid: Greetings, pilgrims! I am a druid.
mate: Since when?
Druid: Since about 2009. I sat down here for one song, to get my breath back.
~ He shows you his phone. On the screen: Episode 4,212. Next episode in 5...
Druid: I keep meaning to get up. It just starts the next one.
~ Moss has grown up his back like a cardigan. The mushrooms round him are leaning in, very slightly, like an audience.
~ On the far side of the clearing something bright orange stands up out of the puffballs.
boss:autoplay: Next episode in five... four...
!shake
~ Rory. Wherever its spores land, people sit down. The whole ring turns to watch it.
? Rory is between you and the path.
- Fight it here
  ~ You square up. The Count goes ice cold in your hand. Not here. Not yet. Its lair is further in, and Sunday is Sunday.
  mate: Sunday. We'll sort it on Sunday. Go!
- Grab the druid and run {s1.druid}
  ~ You grab an arm each and haul. The moss tears like sticky tape. The druid comes with you, protesting, phone still playing.
  Druid: Wait! It's the good bit!
  ~ Outside the ring he blinks like someone waking up. He sits on a toadstool, remembers what sitting did to him, and stands up very quickly.
- Hold your breath and keep moving
  ~ You hold your breath and walk. Your lungs burn. Your legs keep going. That's the deal.
~ Rory doesn't follow. It doesn't need to. It just counts down and waits for someone to sit.
boss:autoplay: ...three... two...
if s1.druid
  Druid: Which way is out? I've got work on Monday. I've had work on Monday for fifteen years.
  mate: Follow the lighthouse.
  ~ Far off, through a gap in the spores, a beam goes round. He walks towards it, and doesn't look back.
else
  ~ Behind you, in the ring, someone shouts, "Blessed be!" And then, quieter: "Is anyone else getting up?"`,

// 3 Seen: the Hushfrost Reach (Whisper Pass)
`@hushfrost
~ The Hushfrost Reach. Cold and blue and so quiet you can hear your own eyelashes.
~ The seam lets you out at the foot of Whisper Pass. A sign says TALK QUIETLY. Underneath, someone has scratched: OR DON'T. SEE WHAT HAPPENS.
mate: What happens?
~ A small avalanche, about the size of a duvet, slides off the ridge and lands exactly where {mate} was standing a second ago.
~ You climb in silence. Halfway up, every phone in the squad lights at once. Messages from home. Ones you forgot to answer. Weeks old.
!glitch
boss:leftonread: ...seen.
~ Wisp drifts down the pass, quiet as a held breath. It doesn't attack. It just watches you read them.
? Wisp is waiting.
- Answer the messages {s1.answered}
  ~ You answer them. All of them. "Sorry, been walking." "Yes, still alive." "Love you too."
  ~ Wisp looks almost disappointed. It thins out like breath on a window.
- Put the phone away
  ~ You put the phone away. Wisp drifts closer. Cold settles into your fingers, the way guilt does.
  boss:leftonread: ...typing...
  ~ Nobody's typing.
~ Near the top you stop to count heads. Everyone's here.
~ Then you look back down at your footprints in the snow. One line for each of you.
~ And one more. Smaller. A child's, by the size. Coming up behind the last of you, keeping exactly one step back.
mate: Whose are those?
~ They stop where you stopped. There's nothing standing in them.
boss:leftonread: ...wait...
~ The wind takes the word away. When you look again, the small footprints are filling up with snow.`,

// 4 The Toll: the Spindrift Isles (Thunderhead Bridge)
`@spindrift
~ The Spindrift Isles. Islands floating in a grey sky, roped together by bridges that are mostly rope. The wind never stops. Nothing is nailed down, including your hood.
~ Halfway across Thunderhead Bridge there's a toll booth, swinging in the gale. Tonight the Taxman is sitting in it.
~ It's six o'clock. Back home, through the seam, the windows are coming on. Blue. You can feel it out here, like a draught.
Taxman: Good evening. One pound for cars.
mate: There aren't any cars. We're on a rope bridge in the sky.
Taxman: Then the walkers' rate applies. Twenty per cent of every step you've taken today. Plus admin.
you: That's not a real toll.
Taxman: Everything's real if there's a form for it. *produces a form*
Taxman: Allow me to explain. Between six and nine the kettle's on and the sofa's warm. That's when the glow is brightest.
Taxman: That's when the Stillness collects its rent.
mate: The what?
Taxman: The thing at the very bottom of all this. The thing your little monsters are pets of. It doesn't move, and it doesn't like anyone else to. I'm its collector.
Taxman: Every evening, six till nine, I'm owed a fifth of your day's Efforts.
you: And if we don't pay?
Taxman: Then you'll have to stop me. People do try. Some of them even manage it. Be quick and you might pick my pocket. I'd call that theft.
? The Taxman waits, pen poised. The bridge sways.
- "Fine. Every evening, then." {s1.fighttax}
  you: Fine. Every evening, then. Bring your clipboard.
  Taxman: I always do.
- "What does the Stillness want with steps?"
  you: What does a thing that sits still want with steps?
  Taxman: Nobody walks, nobody earns, nothing to tax. Think how tidy that would be.
  Taxman: It doesn't want them, exactly. It wants you not to have them.
- "Who are you really?" {s1.asktax}
  you: Who are you, really?
  Taxman: A civil servant, of a sort. The sort that isn't very civil and doesn't serve you.
~ You notice his eyes keep sliding to the Count. He isn't here for the toll at all.
Taxman: Lovely piece. Holloway's work. I knew the last lot who carried it.
Taxman: Ask your lighthouse keeper what she paid for it.
mate: What's that supposed to mean?
Taxman: It means the meter's running.
~ Then he waves you through. Which is somehow worse than if he'd stopped you.
~ At the far end you look back. The booth is empty and swinging, and the light inside it is blue. High above, something is spinning, waiting for the weekend.`,

// 5 They Left Their Boots: the Lowmost Deep (Wreck of the Merry Ann)
`@lowmost
~ The Lowmost Deep. You walk down the sea floor as if it were a road. The Count says you can breathe here, so you can. Mostly.
~ The Wreck of the Merry Ann lies on its side in the silt. The crew left in a hurry. They left their boots: six pairs in a row on the deck, laces tied.
~ Sitting on the rail is a man in a flat cap, smoking a pipe that can't possibly be lit down here.
Navvy: Evening. Don't mind me. I've been dead since 1874.
mate: You're very relaxed about it.
Navvy: You get used to it. The first hundred years are the worst.
Navvy: Those are our boots. Six of us, railway navvies. Morwenna sent us through.
you: What happened?
Navvy: We found this wreck and sat down in it. Five minutes, out of the current, for a breather.
Navvy: There was a light down in the trench below, and it was lovely, and we just watched it.
Navvy: Back home it used to be the fire in the pub. Then the wireless. Then the telly. Now it's in your pocket.
Navvy: Same glow. Same thing looking out of it.
~ He taps the Count with a cold finger. It skips a beat.
Navvy: Someone's after that. Big lad. Blue. Carries a club. Calls himself Grimm. Where he comes from, they call him the Algorithm.
Navvy: He doesn't want it broken. He wants it switched off. A world that never gets up is a world that never looks away. He decides what everyone sees. He likes it like that.
? Ask him something.
- "Did Morwenna know you'd stop?" {s1.asked}
  Navvy: Did she know? She's been sending squads through for three hundred years.
  Navvy: Some get there. Some don't. Her light stays on either way.
  ~ He says it like he's said it before, to himself, a lot.
- "Can we help you?"
  Navvy: You can keep moving. That's the help.
  Navvy: Every squad that makes it, a few of us get to stand up for a bit.
- "Why are you still here?"
  Navvy: Because I stopped. The Stillness keeps what stops. Keeps it nice and fresh.
~ Down in the trench below, something with a great many arms shifts in its sleep. The water goes cold.
boss:kraken: Down here it's always three in the morning...
~ The navvy stands, slowly, stretching like a man with a hundred and fifty years of cramp.
Navvy: Keep it moving.
~ And he's gone. In the silt where he sat is the shape of six people, sitting very close together. Six pairs of boots, and no feet.`,

// 6 Every Step a Stitch: the Misrendered Realm (The Flicker Gate)
`@misrendered
~ The Misrendered Realm. The sky is the wrong green. The ground flickers like a telly between channels. You walk through the Flicker Gate once and arrive twice.
mate: There are two of you.
you: There are two of you as well.
~ The copies fade after a minute. Nobody enjoys that minute.
~ Everything here is a copy of something from home, done badly. A bus stop with no bus. A museum with three walls.
~ Inside the museum there's a guide. She has two left hands and a badge that says GUIDE GUIDE.
Guide (Museum guide): You're carrying Holloway's Count. We've got a copy of his boots. They're both left ones.
Guide (Museum guide): He said the world was a coat and every step was a stitch. Stop walking, and it comes apart at the seams.
~ She holds the Count under a magnifying glass. On the back, tiny: EVERY STEP A STITCH.
Guide (Museum guide): There's a painting too. His walking party, 1724. It's one of our better copies.
~ Five walkers on a hill. Holloway in the middle, in a three-cornered hat. A boy with a bag. And at the edge, holding a lantern, a woman in a shawl.
mate: {you}. That's Morwenna.
you: It can't be. That's three hundred years old.
Guide (Museum guide): The painter wrote the names on the back. "Mistress Morwenna Pascoe, keeper." And a date. Just the one. 1724.
Guide (Museum guide): Usually you'd write two. Born, and died.
!glitch
~ The lights flicker. Every wall in the museum goes blank, then fills with one word in big blue capitals.
!flash
~ STOP.
~ The capitals are oddly neat. Old-fashioned. Like someone who learned to write with a quill.
~ Outside, far off across the flickering fields, something big and blue sits on a throne made of broken bits. It doesn't come closer. It watches you the way you'd watch a programme you've already seen.
boss:algorithm: STOP.
? You...
- Walk on, right past him {s1.walkon}
  ~ You walk on. It's very hard. Your legs feel as if they're being told, politely, to sit.
- Shout "NO"
  you: NO!
  ~ It echoes twice. The second echo isn't your voice. It's older.
~ The guide waves you off with both left hands.
Guide (Museum guide): Do come again. You will. Everyone does, eventually.`,

// 7 The Summit Committee: the Gilded Void (Moonwharf)
`@gildedvoid
~ The Gilded Void. The sky ran out of sky. You walk a road of old gold light, and under your feet there's nothing, all the way down.
~ Moonwharf is the last dock before nothing. They sell overpriced air in jars.
~ The stall is run by three walkers in their eighties, with flasks. The sign says: THE SUMMIT COMMITTEE. AIR, TEA, ADVICE. ADVICE FREE.
Margaret: Tea? We've walked through every winter since 1971.
mate: Every winter? That's amazing.
Margaret: It's compulsory, dear. We carried the Count in '71. We made it. Thirteen weeks, every lair, chimes and everything.
Margaret: Nobody tells you the bit after. You can't really stop. Not properly. The Count gets into your legs.
Margaret: If we sit still more than a week or two, we start to go a bit see-through.
~ You look closer. You can see the stars through her left hand.
Margaret: Gerald stopped in '98. Lovely man. You can still make him out when the light's right. He's the faint one by the jars.
mate: That's horrible.
Margaret: It's not so bad. Better than the alternative. Biscuit?
!shake
~ Then the stars go out, all of them, in a long line, as something enormous passes in front of them.
~ A ribbon of orange fire lights up the whole Void. For a second you see the hoard: a mountain of gold that goes all the way up to nothing.
boss:dragon: Every hour you gave me, I kept.
Margaret: That's Vex. She keeps every hour anyone ever lost to the glow. Evenings, mostly. Some of yours will be in there.
~ Vex doesn't come down. She only wanted you to see how big the hoard is.
~ Margaret hands you a hand-drawn map of the realms, all seven, with notes in the margins. Leeches here. Mind the ring. Do not trust the Weathervane.
~ And one more note, underlined twice: Ask the keeper's sister what the light is for.
? What do you ask?
- "What's wrong with the light?" {s1.warned}
  Margaret: Ask her sister. We did, in '71. Didn't like the answer.
  Margaret: Walked it anyway. You will too. That's the trouble with good people.
- "Is it worth it?"
  Margaret: We're eighty-six and we've got calves like hams. Yes, it's worth it.
  Margaret: Mostly.
~ As you leave, the Committee is already packing up the stall. They're going round again. They always do.`,

// 8 She Sat Down: the Blotmarsh again, deeper (The Sunken Choir)
`@blotmarsh
~ Back in the Blotmarsh, and it isn't the same Blotmarsh. This time the seam lets you out deeper, past the Wallow, where the water is warm and the trees have faces if you squint.
~ The second time round is always worse. The creatures remember you. So does the mud.
~ The Sunken Choir is a chapel up to its windows in black water. Its bell still rings at night, mostly when nobody's near it.
~ Inside, on the walls, walkers have carved their names for centuries. Squads, with dates. 1724. 1802. 1874. 1911. 1951. 1971.
~ And one name cut deep, then crossed out so hard the stone has cracked.
~ MORWENNA PASCOE. 1724.
~ Under it, smaller, in neat blue capitals: SHE SAT DOWN.
mate: Grimm wrote that.
? You...
- Defend her {s1.defend}
  you: Everyone stops sometimes. That doesn't make her a monster.
  mate: Didn't say it did. Just that somebody was very cross about it.
- Say nothing
  ~ You say nothing. {mate} says nothing. The bell says quite a lot.
- Photograph it for later
  ~ You take a photo. When you check it, the wall in the picture is blank.
  ~ The Count ticks, disapproving.
~ The bell starts ringing. Nobody is near it.
!shake
~ Brett comes up through the chapel floor, bigger than before, with two red dots on top now, as if he's got two unread.
boss:notification: You have 2 unread. You have 2 unread. You have...
~ You go out through a window, single file, holding the Count between you. Brett doesn't follow. He'll see you on Sunday.
~ Behind you the bell rings once more, and a little of the crossed-out name crumbles into the water.`,

// 9 The Ambush: Puffcap Hollow, deeper (The Mycelium Road)
`@puffcap
~ Deeper into Puffcap Hollow. The mushrooms down here are the size of houses, and the white roots under the path twitch when you step on them.
~ The Mycelium Road runs straight through the dark. It's very easy to follow. That's the trouble with it.
~ The spores roll in, thick and sudden. Two shapes are waiting in them.
~ One is huge and blue and carrying a club. The other is holding a clipboard.
Taxman: Ah. Punctual. I do like that in a victim.
boss:algorithm: ...
Taxman: A partnership. He switches it off. I tax what's left. Everyone wins. Mostly me.
mate: You said you worked for the Stillness.
Taxman: Everyone does, eventually. I just got there early and asked about the pension.
!shake
~ It's a short, ugly fight in the spores. Grimm swings slow. The Taxman writes things down. Somewhere in the fog, Rory is counting down.
? {mate} has slipped and fallen behind!
- Go back for them {s1.goback}
  ~ You go back. It costs you ground. Grimm's club misses you by a whisker.
  ~ And the moment you're all together again, the Count surges. Hot. Bright.
- Hold the line and shout
  you: {mate}! Up here! With us!
  ~ {mate} scrambles up. The moment you're all together, the Count surges.
!flash
~ That's when you get it. It has never been counting steps. It's counting how many of you keep going together.
~ Grimm steps back out of the light. So does the Taxman, dabbing at his sleeve where the glow singed it.
Taxman: Interesting. Holloway always said that bit was the trick.
you: You knew him?
Taxman: I've read his file. Lovely penmanship. Very neat capitals.
Taxman: A little tip, free of charge, which is unlike me. Your keeper never told you about the others, did she?
Taxman: Ask yourself why she needs a new squad every single winter.
~ When the spores clear, the Mycelium Road is empty. Far behind you, through the seam, every window in town is blue.`,

// 10 The Lantern Book: the Hushfrost Reach, deeper (Rimehold Bothy)
`@hushfrost
~ The Hushfrost Reach goes on further than you thought. Past Wisp's Hollow the ice is so clear you can see things frozen in it. A cart. A dog. A man in a top hat, mid-sneeze.
~ Then, very high above, for a few seconds: something with wings, far off in the black. A ribbon of orange fire, and the ice lights up gold.
~ Vex, passing over. Checking on her hoard. Checking on you.
@bothy
~ You shelter in Rimehold Bothy: a stone hut with a stove and a visitors' book three hundred years thick.
~ Every entry has the same little drawing in the corner. The Long Count.
~ Walkers who made it. Walkers who didn't. You turn back and back, to the very first page.
~ 1724. The handwriting is shaky, as if it was written with frozen hands.
Morwenna (Morwenna, 1724): I sat down. Only for a moment. The fire was warm and Abiah went on without me.
Morwenna (Morwenna, 1724): Something came out of the fire and sat beside me and offered me a bargain.
Morwenna (Morwenna, 1724): I may keep a light at the edge of the world, for as long as a squad walks through each winter.
Morwenna (Morwenna, 1724): God forgive me. I said yes.
mate: "For as long as a squad walks." Not "finishes". Walks.
you: So she keeps her light whether we make it or not.
? How do you feel about Morwenna?
- She was scared. She did what she could. {s1.forgive}
  you: She was cold and scared and on her own. I might have said yes too.
  mate: Would you, though?
- She's been using us. {s1.betrayed}
  you: She's been feeding squads to that thing for three hundred years.
  mate: Then why give us the Count at all?
- Not sure yet.
  ~ You don't know. Nobody does. The stove ticks as it cools.
~ You add your entry. You draw all of you round the Count.
~ In the morning there are small footprints in the frost outside. They go once round the bothy, as if looking for a way in, and then they sit down by the wall.
~ Nobody says anything. When you leave, you leave the door open a crack.`,

// 11 Nobody Lets Go: the Spindrift Isles, deeper (The Kite Graveyard)
`@spindrift
~ Past Gale's Spindle the islands get smaller and further apart, and the bridges stop being rope and start being ideas.
~ The Kite Graveyard is an island where every kite anyone ever lost ends up, tangled in one dead tree, flapping.
~ In the middle of the wind, spinning, is Gale.
boss:scroll: Just one more. Just one more. Just one more.
~ Gale is the endless scroll made into weather. It never stops, so nothing near it can either.
~ It pulls at your sleeves, your hoods, your attention. It wants you going round and round, not forward.
!shake
? Gale is dragging {mate} towards the edge of the island!
- Grab their hand {s1.held}
  ~ You grab {mate}'s hand. Someone grabs yours. Nobody lets go.
- Shout a rhythm
  you: Left! Left! Left, right, left!
  ~ It's daft. It works. Gale can't scroll you if you're marching.
~ You lean into it together, shoulder to shoulder. Nobody goes over the edge, because nobody lets go.
~ When it finally spins off, the Count is ticking so loudly you can hear it over your own breathing.
~ At the foot of the kite tree there's a flat stone. Scratched into it are names. Squads, with dates. 1724. 1802. 1874. 1911. 1951. 1971.
~ The newest line is only half done. One letter, and then the scratches just stop. Past the stone there's nothing but sky.
you: Someone was carving that when...
mate: When what?
~ Nobody finishes that sentence.
~ You scratch your own names in, all of you, quickly. You make very sure to finish.`,

// 12 The Bottom of the Feed: the Lowmost Deep, deeper (Under the Throat)
`@lowmost
~ The Lowmost Deep again, and deeper. Past the Kraken's Throat the sea floor tilts downhill and keeps going.
~ It's very dark down here, and very still. And then it isn't.
~ The Kraken comes up out of the black. Its eyes are the colour of a phone at three in the morning.
boss:kraken: Down here it's always three in the morning. Come down. Just for a look.
!shake
~ A tentacle whips out and takes the Count right out of your hands.
!dark
~ For one long, awful minute it's gone, ticking somewhere further down, getting fainter.
mate: Without it we can't get home!
? The Count is sinking.
- Go down after it {s1.dove}
  you: Together. Now!
- Grab {mate} and jump
  ~ You grab {mate}'s hand. {mate} grabs the next hand. You all go over the edge at once.
@deep
~ It's cold enough to stop your heart. And it's full of light.
~ Down here are thousands of faces, lit blue, drifting. Eyes open. Thumbs moving. Not drowning. Scrolling.
~ This is the bottom of the feed. Everyone who ever sat up too late ends up a little bit down here.
boss:kraken: Stay. Everyone stays eventually.
~ But the Kraken has never had a whole squad come down after it before. It doesn't know what to do with you.
~ Out of pure surprise, it lets go.
@lowmost
~ You come up gasping onto a shelf of rock, all of you, and the Count comes up with you, glowing brighter than it ever has.
~ Below you the blue faces sink slowly out of sight.
~ One of them, you'd swear, was wearing an anorak from 1951.`,

// 13 Home, Twice: the Misrendered Realm, deeper (The Copy of Home)
`@misrendered
~ The last week. The Count drags you deep into the Misrendered Realm, past the Error Throne and out the other side.
~ And there's your town. Your street, your shops, your bus stop. Only wrong. The windows are painted on. The trees are flat. Nobody is in any of it.
mate: It's a copy. It's a copy of home.
~ Grimm has copied it very carefully. He's even got the litter right.
~ In the middle of the copied high street, under the one lamp post that renders properly, a woman is waiting in a waxed jacket and a tartan scarf. She has Morwenna's eyes.
Ishbel: You'll be the squad. I'm Ishbel. Her sister.
Ishbel: I'm the only thing in here that loads properly. I refuse to be misrendered. It annoys him no end.
Ishbel: Give it here, then. Let's hear it.
~ She opens the back of the Count with a tiny key. It chimes. Once for every week you walked.
~ Thirteen times, loud enough to hear through the seam.
@town-glow
~ Back home, in the real town, people put their phones down and go outside. Not for ever. Just for a walk.
~ The blue in the windows goes out, street by street, like someone walking through a house switching off lamps.
@misrendered
if s1.betrayed
  you: Did you know? About her bargain?
  Ishbel: Know? I was there. I kept walking. She didn't. We've not spoken since.
else
  you: Morwenna wrote in the bothy book. In 1724.
  Ishbel: Aye. I was there. I kept walking. She didn't. We've not spoken since.
Ishbel: Every winter she sends a squad through. Some get here. Some end up in a chapel wall, or the Fairy Ring, or the bottom of the feed.
mate: The 1951 lot?
Ishbel: Still in the ring. Watching. The telly's still on.
Ishbel: Her light stays on either way. You worked that out. Good.
Ishbel: Here's what you haven't. It isn't only her light. Something looks out through it.
~ A van that shouldn't exist pulls up on the copied high street. The Taxman gets out and hands Ishbel an invoice for the chimes, and an envelope for Morwenna.
Taxman: Account renewed. One more winter. Do pass on my regards.
Ishbel: Pass them on yourself, Edwin.
~ He flinches, very slightly, at the name.
~ Ishbel closes the Count and holds it out. The needle has swung round. Not forward. Down.
? Ishbel offers you the Count.
- Take it {s1.took}
  ~ You take it. It's warm. It's always warm.
  if s1.warned
    ~ You think of the Summit Committee's note. You take it anyway. Of course you do.
- "What if we say no?"
  Ishbel: Then it sits on my mantelpiece, and next winter she sends someone else.
  ~ You take it.
Ishbel: Next time, deeper. There's a lot more down there than seven doors, and he never finished the stitching.
Ishbel: Grimm's gone quiet. That's not good news. That's him thinking.
~ Far away, at the end of the last street in town, the lighthouse beam goes round once. For a moment it isn't white at all.`,
];

// ---------- SEASON 2: The Frozen Ledger (seven frozen realms; the Taxman's 1911) ----------
const S2 = [
// 1 Over the Ice: the Blotmarsh, frozen (The Leech Inn)
`@lighthouse-night
~ The lighthouse at the end of the last street is lit, but nobody answers the door. Pinned to it is a note in neat, old-fashioned handwriting.
~ "Gone to see a man about a light. The Count knows the way. Mind the cold. M."
mate: She's not even here?
~ The door swings open on its own. Behind it, the seam. Frost is growing out of the gap like fur.
@blotmarsh
~ The Blotmarsh has frozen solid. Black ice to the horizon, with bubbles trapped in it, and reeds snapped off like breadsticks.
~ Every bubble has a tiny red dot in it. Brett is in there somewhere, under the ice, very cross about it.
~ The Leech Inn stands on stilts in the middle of it all, smoke coming out of the chimney. Rooms by the hour. The leeches charge by the pint, but in this cold they're all asleep.
~ The innkeeper is on the steps with a lantern. She looks at the Count the way you'd look at an old friend who owes you a tenner.
Solveig: The last one came through in 1731. Englishman. Wouldn't get on a horse. I have it in the book.
~ She does have it in the book. Brown ink: "A walker with a brass thing. Going down. Seemed cheerful."
Solveig: And this one. 1911. "Five walkers with the brass thing. One of them carried the purse."
Solveig: He had a little moustache and asked if the inn was VAT registered.
mate: Is that...?
Solveig: I don't know. They never came back up.
~ It's bitter cold. Everything you own is stiff with frost: boots, laces, fingers, plans.
Solveig: In the cold everything takes twice as long. Swapping places on a narrow path takes an age. Decide where you stand before you set off. Not after.
? Solveig asks about Morwenna.
- "She's complicated." {s2.complicated}
  Solveig: Keepers usually are. We all made a deal of some kind. Mine was cheaper.
  mate: What was yours?
  Solveig: I sleep through the longest day, every year. Ask me about it in June.
- "She lied to us."
  Solveig: She told you to walk. Was that a lie?
- "What's in her light?"
  Solveig: The same as in all of ours. A little blue. Just a little. Enough to see by.
~ Down on the ice, someone is unfolding a customs form. It's very long, and it's very cold, and he doesn't seem to feel it.`,

// 2 Glitter: Puffcap Hollow, frozen (Gillwood)
`@puffcap
~ In Gillwood the trees are mushrooms, and this winter the mushrooms are wearing icicles.
~ The orange air has frozen into a fine glitter that hangs in the light and never quite falls.
~ Halfway through the wood, a soft crunch behind you. Then another.
boss:autoplay: Are you still watching? Are you STILL watching?
~ Rory comes out of the frost, bright orange against all that white. It coughs a spore cloud that freezes in the air and comes down like glitter.
~ It still stings. And where it lands, you feel the pull to sit down in the snow. Just for one more.
mate: Don't sit down. Don't any of you sit down.
? It's chaos on the ice!
- Everyone hold your places {s2.held}
  you: Stop shuffling! Hold where you are!
  ~ You plant your feet. Rory skids straight past and lands in a drift with a noise like a dropped trifle.
- Swap places with {mate}
  ~ You try. In the frost it takes for ever. Rory glitters you both mid-swap.
  mate: Lesson learned. Plan first.
~ The frost doesn't care how fast you are. It cares whether you planned.
~ Rory slinks off towards its Burrow to wait for Sunday. You keep going.
~ At the edge of the wood someone takes a group photo. It's terrible: a row of red faces and an orange blur.
~ Later you zoom in on the blur. Far behind it, on the path, someone is standing very still in the snow.
~ A man in an old-fashioned overcoat. Holding a ledger.
~ When you look back down the path for real, there's nobody there.`,

// 3 No Signal: the Hushfrost Reach (The Shivering Stones)
`@hushfrost
~ The Hushfrost Reach in deep winter. There's no phone signal. There never is in here, but this time nobody has brought a spare battery either.
~ For the first hour this feels like an emergency. By the second hour nobody mentions it.
~ By the third, {mate} is telling a story they've been saving for fifteen years.
mate: ...and that's why I'm not allowed back in the soft play.
~ It's the best thing you've heard all week.
~ The Shivering Stones stand in a circle on the ice. Five of them. You count them on the way past, out of habit.
!dark
~ Wisp finds you in the middle of the circle. The cold comes with it.
boss:leftonread: ...seen.
~ It tries what it always tries. The guilt. The unanswered messages.
~ But there's no signal. Nothing buzzes. You're all just here, together, in the snow.
? Wisp hovers between the stones, confused.
- Say hello to it {s2.hello}
  you: Hello, Wisp.
  ~ It flinches, like nobody has spoken to it in a very long time.
- Wave it off
  ~ You wave. It doesn't go. It just watches, like someone at a window.
boss:leftonread: ...wait...
mate: Did it just talk?
boss:leftonread: ...wait for me...
!light
~ Then it fades into the ice and the cold goes with it.
~ An ice-cutter is working at the edge of the circle, sawing blocks. He doesn't look up.
Local (An ice-cutter): The ghost? Been here years. Always says the same thing. We just say sorry and keep walking.
~ On the way out you count the stones again. Six.`,

// 4 Form B12: the Spindrift Isles (The Weathervane)
`@spindrift
~ The Weathervane is an island with a tower on it, and a vane on the tower that points every way at once. Very helpful.
~ At the foot of the tower, a brass plate has been screwed to the door. OFFICE FOR THE REGISTRATION OF FOREIGN WALKING.
@office
~ Inside it's warm and dry and smells of ink. The Taxman has rented the whole ground floor by the month.
Taxman: You are importing a pedometer. And, I would argue, a quantity of steps. Form B12. In triplicate.
mate: We met you on a rope bridge.
Taxman: I've no recollection of a rope bridge. The rope bridge has no recollection of me. It's a very good arrangement.
~ On the shelf behind him are ledgers going back decades. One spine is older than the rest. 1911.
? While he's busy stamping...
- Read the 1911 ledger {s2.ledger}
  ~ You slide it out. One page. Five names in a column, in a careful clerk's hand.
  ~ Four have a line through them. The fifth is the signature at the bottom: E. TALLY, TREASURER.
  ~ The Taxman looks up. You put it back. He goes back to stamping, a little slower.
- "Ishbel called you Edwin."
  Taxman: Ishbel calls a lot of people a lot of things. Form B12. Sign there.
- Leave quietly
  ~ You leave quietly. He doesn't look up. He doesn't need to. He has already written down that you left.
@spindrift
~ You take the long way off the island, partly for the view and partly because he's standing by the short way.
~ Out over the islands Gale is spinning, slow and lazy in the cold, waiting for the weekend.
mate: Five names. Four crossed out.
you: What happens when you get crossed out?
~ Through a gap in the cloud, far below, you can see the seam, and through the seam a lot of windows glowing blue. Some of them have been glowing for a very long time.`,

// 5 An Apology: the Lowmost Deep (Glowmouth Reef)
`@lowmost
~ This winter the Lowmost Deep has a lid on it. The top of the sea has frozen, and the light comes down through the ice green and thin.
~ At Glowmouth Reef the coral glows. So do the teeth.
!shake
~ The Kraken comes up out of the reef bigger than it ever looked, and takes hold of the shelf you're standing on.
boss:kraken: You came into my Deep last winter. All of you at once. Nobody does that.
boss:kraken: I would like an apology.
? The Kraken wants an apology.
- "Sorry." {s2.sorry}
  you: Sorry.
  ~ The Kraken blinks. Nobody has ever said sorry to it. It doesn't know what to do with sorry.
  boss:kraken: ...Accepted. I am still going to eat you on Sunday.
- "No."
  you: No.
  boss:kraken: Fine. Sunday, then.
~ It lets go of the shelf, but slowly, and the whole reef shudders.
~ The frost has got in down here too. Nobody can move quickly. You stay braced where you stand until the reef stops shaking.
~ A diver in a brass helmet watches all this from behind a rock. Afterwards he comes out and shakes everyone's hand very formally.
Local (A diver): I've been down here since 1896. I've never seen anybody talk back to it.
Local (A diver): There was a squad in 1911 who tried. Five of them. One kept asking the Kraken for a receipt.
mate: Did it give him one?
Local (A diver): It did, as it happens. I think it was so surprised.`,

// 6 NO: the Misrendered Realm (Duplicate Hill)
`@misrendered
~ There are two of Duplicate Hill. Both insist they're the real one. You climb the one on the left, which seems more sincere.
~ The Misrendered Realm has frozen too, in its way. The snow comes down in squares.
!shake
~ Halfway up, boulders start coming down. Not falling. Thrown.
~ On the top of the other hill is a big blue shape with a club.
boss:algorithm: STOP.
~ Grimm doesn't come over. He doesn't need to. The cold does his work for him.
~ Every time someone tries to dodge, their boots skate, and swapping places takes an age.
? Boulders incoming!
- Go up in a line, no swapping {s2.line}
  ~ You go up in the order you started, and you don't change it, and every boulder misses.
- Scatter!
  ~ You scatter. Everyone skids. It takes ten minutes to get back in order, and Grimm gets three good throws in.
  ~ Lesson learned, painfully: decide where you stand before you set off.
~ The boulders aren't even real boulders. When they land they turn into flat grey pictures of boulders and fade.
~ At the top there's a stone with a word on it in the neat blue capitals you know: STOP.
~ Underneath, in a different hand: NO.
~ Next to the NO, tiny initials. E.T. And a date. 1911.
you: E.T.
mate: Edwin Tally. The Taxman wrote NO at Grimm. In 1911.
you: So whose side was he on?
~ On the other hill, Grimm stands very still, looking at the NO. Then the snow comes down in squares and you can't see either of them.`,

// 7 Pilgrims: the Gilded Void (The Comet's Tail)
`@gildedvoid
~ The Comet's Tail is a long ribbon of ice and light streaking through the Void. You can hitch a lift, as long as you let go before it reaches the sun.
~ There's a stop halfway along with a little wooden hut and a man with a stamp.
Trond: Pilgrim passports! Stamp, stamp. And the backs of your hands. Stamp.
Trond: For the ones who walk without a reason. They're my favourite. They tend to find one.
~ The Taxman has come too. He has a plan to charge pilgrim dues, backdated three hundred years.
Taxman: With interest it comes to roughly the contents of Vex's hoard.
~ Trond listens to all of it, nods, and hands him a pilgrim passport.
Trond: Walk to the next stop and I'll stamp it.
~ The Taxman looks at the passport for a long time.
? Say something to him?
- "You used to walk, didn't you?" {s2.kind}
  you: You used to walk. Didn't you? In 1911.
  Taxman: In 1911 I was a treasurer. Treasurers carry the purse, not the pedometer.
  Taxman: We walked from the lighthouse at the end of a street not unlike yours. Thirteen weeks. It was very cold. Mabel sang the whole way. Badly.
  ~ He stops, as if he's said far too much.
- "Go on. One stop."
  you: Go on. It's one stop.
  Taxman: I don't walk. I audit walking.
  ~ But he puts the passport in his inside pocket, not the bin.
~ Far out in the Void, something huge turns over on a mountain of gold, and every coin chimes at once.
boss:dragon: Every hour you gave me, I kept.
~ Vex doesn't come. The cold is too much even for her. Her fire comes out as steam.
~ When you let go of the comet, the Taxman is still standing at Trond's hut, looking down the ice at the next stop.`,

// 8 Pull Up the Planks: the Blotmarsh, deeper (Sallowmere)
`@blotmarsh
~ Past Brett's Wallow there's a village on stilts called Sallowmere, out in the middle of the frozen bog, joined to the bank by a long walk of planks.
~ A bog-wife tells you the story while she knits something that might be a sock or might be a net.
Local (A bog-wife): When the tax collector came round, we pulled up the planks.
~ You look at each other. You look back down the walk. A small figure with a clipboard is shouting from the bank.
Taxman: This is a formal notice of assessment! I can see you!
? The planks lift up easily.
- Pull up the planks {s2.planks}
  ~ You pull them up. It's the best afternoon of the season.
  Taxman: I'll be adding this to your file!
  mate: We'd be disappointed if you didn't.
- Leave them down. Let him walk.
  ~ You leave them. He looks at the planks. He looks at his shoes. He doesn't walk.
  ~ For a second he looks like a man who used to be good at this.
~ Under the last plank, frozen into the mud, there's a photograph in a tin frame.
~ A few people in wool, roped together, standing in a line on the ice. The one in the middle is holding something brass and round.
~ Written on the back: Unknown walkers. 1911. Destination not recorded.
~ Four of them are smiling. The one at the end, with a little moustache, is looking at the camera like it owes him money.
Local (A bog-wife): Him on the end came back through, years later. On his own. Never pulled up a plank since.`,

// 9 The Argument: Puffcap Hollow, deeper (The Sleeping Orchard)
`@puffcap
~ The Sleeping Orchard is deep in Puffcap Hollow: rows of mushroom trees, each one with a person asleep at the foot of it, smiling.
~ You walk down the rows on tiptoe. Nobody wakes. The spores here smell of warm toast.
~ At the end of the orchard two shapes are arguing. One is large and blue. One has a clipboard.
Taxman: Stopped somewhere I can tax it. That was the arrangement.
boss:algorithm (Grimm): Stopped. Anywhere.
Taxman: You'd have the whole world sat in an orchard.
boss:algorithm (Grimm): Yes.
Taxman: Where's the revenue in that?
~ Neither of them notices you. Then Grimm says something very quietly, and the Taxman goes white.
boss:algorithm (Grimm): Four of them, Edwin. Still warm. Still waiting. Do you want them waiting for ever?
~ The Taxman doesn't answer. He turns and walks off between the trees, fast, and doesn't look back.
!shake
~ And Rory comes up out of the orchard floor, spores pouring off it, every sleeper sighing at once.
boss:autoplay: Because you watched "Sitting Down", you might like "Sitting Down 2".
? Rory is right there.
- Wake the nearest sleeper {s2.woke}
  ~ You shake a woman awake. She blinks at you, says "What year is it?", and runs. Rory sags, like it's lost a viewer.
- Back away carefully
  ~ You back away down the rows, step by step. Rory doesn't follow. It just settles among the sleepers to wait for Sunday.
mate: Four of them. Still warm.
you: The four names in the ledger.`,

// 10 Kept Nice and Warm: the Hushfrost Reach, deeper (The Snow Shelter)
`@hushfrost
~ Past Wisp's Hollow, a long way down, the Count leads you to a shelter dug into a snowdrift. There's light inside. Warm, yellow light.
~ You crawl in. It's cosy. It's horribly cosy.
~ Four people are sitting round a little stove that gives no heat, in wool and scarves from a hundred years ago. Their eyes are shut. Their breath steams. They're perfectly still.
~ One of them, a woman with a round face, has knitting in her lap. The needles have been halfway through the same stitch for a very long time.
mate: The 1911 squad.
~ There's a gap in the circle, about one person wide. Someone used to sit there.
~ On the stove there's a tin box. Inside is a receipt: Four walkers, kept warm. Paid in full, nightly.
~ Then a voice from the doorway, very quiet, not at all like him.
Taxman: Don't wake them.
~ He's standing in the entrance with snow on his bowler hat. He doesn't come in.
Taxman: If they wake in here, they fade. If they stay asleep, they keep. That's the arrangement.
? The Taxman is waiting for you to leave.
- "Is that Mabel?" {s2.mabel}
  you: Is that Mabel?
  Taxman: She sang the whole way. Badly. She never once stopped singing until she stopped.
  Taxman: Arthur. Ruth. Sidney. Mabel. Out, please. It's draughty with the door open.
- Leave without a word
  ~ You crawl out without a word. As you go past him he takes his hat off, which you've never seen him do.
~ Outside the snow is coming down hard. When you look back, the shelter's light has gone out.
~ The Taxman is still standing by it, perfectly still, as if he's waiting to be told he can go.`,

// 11 The Carvings: the Spindrift Isles, deeper (Gyre Harbour)
`@spindrift
~ Gyre Harbour is the last island before the islands start going round each other in slow circles. Its rocks are covered in carvings, very old: boats, birds, and people.
~ Lots of people, drawn as little stick figures, walking in lines across the rock.
Guide (A carver): Everyone asks about that one.
~ A line of figures walking close together, and one of them holding up something round.
Guide (A carver): We say it's the sun. People have always walked in lines. And somebody always carries the thing that keeps time.
~ Next to it, much newer, much smaller, five figures roped together. Four with smiles scratched on. One with a little moustache.
!shake
~ Gale comes round the harbour wall like a slammed door.
boss:scroll: Refresh. Refresh. Refresh.
~ In the frost Gale can't shove you about so easily. Your boots are stuck fast and you've stopped trying to move.
? Gale is howling at the harbour.
- Hold your rows and hit back {s2.rows}
  ~ You hold your rows. Gale howls and shoves and gets nowhere, then spins off to sulk in its Spindle.
- Get behind the harbour wall
  ~ You duck behind the wall. Gale screams over the top for an hour, then gets bored. Wind always gets bored.
~ On the way out you pass the Taxman, sitting on a bollard, writing in the pilgrim passport.
~ It has two stamps in it now. He sees you looking and puts it away very quickly.`,

// 12 The Maelstrom Stair: the Lowmost Deep, deeper
`@lowmost
~ The Maelstrom Stair is a whirlpool that goes down like a staircase, round and round, into the dark. The water's frozen at the edges into steps.
~ One more week. The end of the season is close enough to taste, and it tastes of salt.
~ The Taxman is walking with you. Not in front, not behind. Alongside, with his clipboard tucked under his arm.
Taxman: Purely for audit purposes.
mate: You've done eleven thousand steps today.
~ He looks horrified. Then, for just a second, rather proud.
!shake
~ The Kraken is coiled round the bottom of the Stair, in the eye of the whirlpool.
boss:kraken: The bottom of the feed is very comfortable. Nobody ever leaves.
? The Stair is narrow and the frost has everything stiff.
- Go down in order, one by one {s2.order}
  ~ You go down in the order you planned. Nobody swaps. Every tentacle misses by inches.
- Let the Taxman go first
  ~ The Taxman goes first, clipboard raised like a shield. The Kraken takes one look at it and retreats, as if it's seen a lot of clipboards and none of them were good news.
~ At the bottom there's a ledge with a view straight down into the black.
~ The Taxman looks down it for a long time.
Taxman: Next week, the last tollgate. I'll be there. I'm always there. It's the one thing I'm good at.`,

// 13 The Last Tollgate: the Misrendered Realm, deeper
`@misrendered
~ The Last Tollgate stands at the far end of the Misrendered Realm, where the road just stops and the world is a grey chequered nothing.
~ The Taxman has set up a folding table in front of it.
Taxman: Efforts, please. Exact change.
~ You're too tired to argue. It's only steps, and he looks so pleased.
~ He counts them twice and writes you a receipt. Sticking out of his top pocket: the pilgrim passport.
? This is your chance.
- "Tell us about 1911, Edwin." {s2.truth}
  ~ He puts his pen down. It's the first time you've ever seen him not holding it.
  Taxman: The thirteenth week. A blizzard in the Hushfrost. Mabel said we should wait it out in the shelter. Just for the night.
  Taxman: Four of them sat down. I was standing up, counting the money, when it came out of the snow-glare.
  Taxman: It offered terms. I've always been good at terms.
  mate: What terms?
  Taxman: They stay, kept nice and warm. I go free, as long as I collect. A fifth of every walker's Efforts, every evening, for as long as there are walkers.
  Taxman: They were good walkers. I was a better accountant.
  you: That's monstrous.
  Taxman: It's paperwork. Paperwork is how monstrous things get done politely.
- "Why do you still carry that passport?"
  Taxman: Sentimental value. I'm told I have some. It's in a drawer somewhere.
  Taxman: Four people sat down in a blizzard in 1911. I was standing up, counting the money.
  Taxman: I'm still counting.
~ The Count chimes. Thirteen times, one for every week, out over the grey nothing.
~ The Taxman flinches at every one. On the ninth, you'd swear he mouths a name.
@town-glow
~ Back home the windows go out one by one, blue to dark, and then, here and there, a warm yellow lamp.
@misrendered
~ When the chimes stop, the needle has swung. It points back the way you came, and down, towards the Hushfrost. Towards something small and cold, waiting.
~ Ishbel sends a text. Nobody knew she had a phone.
Ishbel (Ishbel, by text): Deeper.
Ishbel (Ishbel, by text): And keep counting heads. Next season the numbers go funny.`,
];

// ---------- SEASON 3: Wait for Me (everything faster; Kit, left on the ice in 1732) ----------
const S3 = [
// 1 The Quick Season: the Blotmarsh (Hangman's Willow)
`@the-seam
~ This season the seam opens before you've even reached the lighthouse door. It's waiting for you at the end of the street, flapping like a curtain in a draught.
~ Everything is in a hurry. Your watch runs fast. The Count ticks double-time, like a heart after stairs.
@blotmarsh
~ Hangman's Willow stands at the edge of the Blotmarsh. Nobody was ever hanged here. The tree just looks like that.
~ Under it, a woman in a bobble hat is crouched by the water with a stopwatch and a notebook.
Ingrid: Forty-one years I've been timing the marsh. It breathes, you know. In, out. Every bubble is a breath.
Ingrid: This year it's breathing twice as fast. Everything is. Whatever's down there will be quicker this season.
Ingrid: So will what you get for beating it. It works both ways. Most things do.
~ She measures you too, out of habit. She clicks the stopwatch and writes it down.
Ingrid: Fast.
!shake
~ Brett comes up out of the marsh twice as quick as you remember, bouncing like a dropped jelly.
boss:notification: BZZT BZZT BZZT. You have a new... you have another new... you have...
? Brett's too fast to dodge!
- Stand still and let him bounce off {s3.still}
  ~ You stand together, perfectly still. Brett hits the wall of you at full speed and goes flying back into the reeds.
- Run!
  ~ You run. He's faster. He slimes the back of everyone's coat on the way past, buzzing happily.
~ That night, in the tent, nobody can sleep. Everything outside is going too fast: the frogs, the bubbles, the clouds.
~ In the morning there's frost on the glass of the Count, though it wasn't cold.
~ A small handprint. A child's. From the inside.`,

// 2 The Button: Puffcap Hollow (The Puffball Fields)
`@puffcap
~ The Puffball Fields: every step sends up a cloud, and every cloud makes you sneeze. This season the puffballs are going off like popcorn.
~ Rory has caught up with you, quicker than ever, bounding across the field in great orange leaps.
boss:autoplay: Skip intro? Skip intro? Skip intro?
~ When it coughs out a spore cloud the puffballs all go off at once, and for one beautiful minute the two clouds cancel each other out.
~ Then they don't, and you have both.
? Rory is coming round for another go.
- Keep the rhythm, left, right {s3.rhythm}
  ~ You walk in step through the clouds, breathing on the count. It's fast, everything's fast, and you're getting better at fast.
- Hit the dirt
  ~ You hit the dirt. Puffballs go off all round you. Everyone comes up orange and sneezing, but Rory has bounded past.
~ When the spores settle, {mate} finds something in a squashed puffball. A brass button.
~ Old. English. A tiny lantern stamped on it.
mate: Same lantern as on the Count.
~ The Count ticks louder when you hold the button near it, like a dog that's heard its name.
~ On the back of the button someone has scratched two letters, very carefully, the way a child writes. K.P.`,

// 3 The Boy in the Ice: the Hushfrost Reach (Icetooth Arch)
`@hushfrost
~ Icetooth Arch: icicles the size of lamp posts. Walk under it, not near it.
~ This season they're dripping. Fast. Everything up here has ten weeks to do a year's work, so everything hurries.
~ Under the arch the cold gets suddenly worse. Then a voice. Small. Behind you.
Kit (???): ...you didn't wait...
!glitch
~ You turn round. There's a boy standing in the arch. About ten. Freckles. Wild red hair. A coat from three hundred years ago and a bag across his chest.
~ He's frosted all over, like a window in January. You can see the icicles through him.
Kit (The boy): You can see me. In here, in between, you can see me.
Kit (The boy): I'm Kit. Kit Penhallow. I was Mr Holloway's apprentice. I carried the bag.
? Kit is staring at the Count.
- "What happened to you?" {s3.asked}
  Kit: We crossed the ice at night. Mr Holloway said never stop, whatever happens. The Count won't abide it.
  Kit: I went through. Only up to my knees. I shouted. Nobody turned round.
- "Have you been following us?"
  Kit: I've been trying. You're very fast. Everyone's always very fast.
- Hold out the Count to him {s3.offered}
  ~ Kit reaches for it. His fingers go straight through. He looks at his hand as if it belongs to someone else.
Kit: Is he still out there? Mr Holloway? Did he finish?
you: We don't know.
Kit: Oh.
~ He looks very small. Then the icicles drip, all at once, and Kit is gone.
~ Where he stood, the ice is white with frost in the shape of two small boots.
~ You leave the button there for him. When you look back, it's gone.`,

// 4 Two Clocks: the Spindrift Isles (Kite Rock)
`@spindrift
~ Kite Rock is the first island, and this season it's two islands, drifting side by side, an hour apart.
~ Step off one onto the other and you lose an hour on the way. Step back and you get it back, if you're lucky.
~ The Taxman is standing on the rope bridge between them with a clipboard.
Taxman: Walkers crossing here lose an hour. That hour has to go somewhere. I'd like it to go on my books.
mate: You can't tax an hour that doesn't exist.
Taxman: Watch me.
~ He stamps a form with great satisfaction.
? The Taxman holds out the form.
- Sign it {s3.signed}
  ~ You sign it. He looks deeply pleased. Then the Count ticks double-time to catch up the missing hour, and by evening it's as if he never stamped anything.
  Taxman: That's cheating.
  you: That's Holloway.
- Walk round him
  ~ You walk round him, which on a rope bridge is quite something. He's so surprised he forgets to stamp you.
~ Gale is spinning between the two islands, faster than you've ever seen it, stirring the hours together like soup.
boss:scroll: Next! Next! Next! Next!
~ It doesn't come for you yet. It's busy. But it watches you go.
~ When you count heads at the far side, everyone's there. And, for a second, one more: a small frosted shape at the very back, waving, an hour behind.`,

// 5 The Cold Patch: the Lowmost Deep (Kelpwood)
`@lowmost
~ Kelpwood: long dark weed swaying in the current. Keep your ankles to yourself.
~ A cold patch follows you in. It stays a few steps behind the last of you, all day, never closer, never further.
~ Then, in the middle of the wood, the water goes very dark and very warm, and something enormous uncurls.
boss:kraken: Come down. Just for a look. Just for an hour.
!shake
~ And between you and the Kraken, the cold patch thickens into a shape. Pale. Thin. Hanging in the water like breath.
boss:leftonread: ...seen...
~ Wisp. Here. Down in the Deep, between you and the thing with all the arms.
? Wisp is shielding you. Or it's in the way. It's hard to tell.
- Call it Kit {s3.named}
  you: Kit?
  ~ Wisp goes very still.
  boss:leftonread (Kit): ...nobody says my name...
  ~ The Kraken pulls back, confused. It has never seen Wisp do anything for anybody.
- Stay behind it
  ~ You stay behind it. The Kraken lashes out, hits the cold, and recoils, as if it's touched a frozen window.
~ When the water clears, Wisp is gone, and the Kraken has gone back down to its Throat to sulk.
mate: So Wisp is Kit. Or Kit is Wisp.
you: Or Wisp is what happens to Kit if you leave him on read for three hundred years.
~ That night, nobody wants to be the last in the line. You walk in a clump instead, everyone touching someone's sleeve.`,

// 6 He Didn't Finish: the Misrendered Realm (The Upside Down Inn)
`@misrendered
~ The Upside Down Inn. Breakfast is served on the ceiling. Mind the soup.
~ It's a copy of an old coaching inn, done badly, and the ledger on the front desk is a copy too. Every page is from 1732.
~ The landlord is a grey outline with a moustache drawn on.
Local (A landlord): We keep the old book. Copy of the old book. The real one went somewhere. Copies always outlive things.
~ You turn the pages. Most are blank. One has writing on it, in very neat handwriting, with very neat capitals.
Holloway (A. Holloway, 1732): Lost the boy Kit on the ice. I did not turn back.
Holloway (A. Holloway, 1732): The Count would not abide a stop. I told myself that. I tell myself that still.
Holloway (A. Holloway, 1732): Henceforth it shall count no one walker alone. Only those who go together.
you: That's why. That's why it counts how many of us walk together. He made it that way afterwards. Because of Kit.
? What do you think of Holloway?
- "He should have gone back." {s3.should}
  you: He should have gone back.
  mate: Yes. He should.
- "Kit didn't stop because of him." {s3.blame}
  you: Kit didn't stop. Holloway didn't wait. That's different.
- "Everyone leaves somebody."
  you: Everyone leaves somebody, sometime.
  mate: Not us. Not any more.
!dark
~ At the door, as you leave, something big and blue is waiting, very still, blocking out the wrong green light.
~ Grimm doesn't swing. He looks at the Count, and then at you, and then he speaks. Not STOP. The first words you've ever heard from him.
boss:algorithm (Grimm): He didn't finish.
~ Then he walks off down the flickering road, in no hurry at all.`,

// 7 The Star That Won't Set: the Gilded Void (The Burnt Constellation)
`@gildedvoid
~ The Burnt Constellation: six stars in the shape of a claw. One of them is still smoking.
~ This season it won't stop burning. It hangs over the Void like a sun that's forgotten how to go down, and it never gets dark.
~ Nobody can sleep. Everyone is quick and jumpy and slightly too awake.
!shake
~ Vex comes out of the glare, fast, breathing fire across the gold road.
boss:dragon: One more hour. You won't miss it. You never do.
~ You hold together. The fire is real enough. The road gets hot enough to fry an egg, which somebody tries, afterwards.
~ When Vex has gone back to her Hoard, you lie down on the warm gold and shut your eyes, just for a minute. Not stopping. Resting.
~ And you all dream the same dream.
!fade
@hushfrost
~ Night. Ice. A long black lake frozen solid, and a line of lanterns crossing it.
~ A man in a three-cornered hat at the front, walking fast. A woman with a shawl. Others. And at the back, a boy with a bag, running to keep up.
~ The ice cracks. The boy goes through to his knees.
Kit (Kit, 1732): Mr Holloway! Wait! Wait for me!
~ The lanterns don't stop. Nobody turns round.
? In the dream, you're standing on the ice next to Kit.
- Take his hand {s3.hand}
  ~ You take his hand. In the dream it's warm. He looks up at you, astonished.
- Shout after the lanterns
  you: Stop! He's here! Wait!
  ~ The lanterns don't hear you. They're three hundred years away.
!fade
@gildedvoid
~ You wake up all at once, all of you, with frost on your hands.
~ The star is still burning. Somewhere in the Void a small voice says, "You came back."`,

// 8 Fined Twice: the Blotmarsh, deeper (The Sinking Fair)
`@blotmarsh
~ Deep in the Blotmarsh there's a fair. Stalls, bunting, a carousel, a coconut shy. It's all sinking, very slowly, into the bog.
~ Nobody at the fair has noticed. They're too busy. The carousel goes round with its horses up to their knees in mud.
~ The Taxman has come to do some paperwork. This is a mistake.
~ The fair has a clerk. A bog-clerk, in a hat made of reeds, with a stamp in each hand.
Local (A bog-clerk): Complaint against walkers? Lovely. Form, form, stamp, stamp.
~ She processes his complaint so quickly and so correctly that he ends up fined. Twice.
~ She gives him a receipt. It's written in bog. He reads it for a long time.
mate: What does it say?
Local (A bog-clerk): It says he owes himself an apology.
~ Kit is walking with you today. Not close. A few steps behind the last of you, frosted, quiet. But walking.
~ He watches the carousel go round with an expression you can't read.
Kit: We had a fair in our village. Once a year. Mr Holloway let me go on the horses.
Kit: Before.
? Kit is looking at the carousel.
- Ride it with him {s3.rode}
  ~ You ride the sinking carousel with Kit, round and round, with mud up to the horses' knees. He laughs. It sounds like ice cracking, the good kind, in spring.
- Win him a coconut
  ~ It takes {mate} nine goes. The coconut sinks before Kit can touch it. He laughs anyway.
~ When you leave, Kit is a few steps closer than he was this morning.`,

// 9 Cap and Bells: Puffcap Hollow, deeper
`@puffcap
~ Cap and Bells is a glade of tall thin mushrooms that ring like little bells when the spores blow through them. It's lovely. It makes you want to lie down.
~ Kit doesn't like it. He walks right in the middle of the squad now, between you all, where it's warmest.
~ There's a letter for you, pinned to a mushroom with a hatpin. The handwriting is old-fashioned and neat.
@lighthouse-night
Morwenna (Morwenna, by letter): I hear you found the boy. Kit. I remember him. He carried the bag and whistled.
Morwenna (Morwenna, by letter): I hear you know what I did. I won't defend it. I was cold, and the fire was warm, and I was nineteen.
Morwenna (Morwenna, by letter): And when you see Abiah, ask him why he never came back for either of us.
@puffcap
if s1.betrayed
  ~ You read it twice. You still don't know if you believe her. That's allowed.
else
  ~ You read it twice. Then you fold it up very small and keep it next to the Count.
!shake
~ The bells ring all at once. Rory comes through the glade at speed, spores streaming.
boss:autoplay: Are you still watching? You are. You're still watching.
~ Kit steps out in front of it before anyone can stop him, and blows on it.
~ Frost goes all over Rory like icing sugar. It sneezes. It sneezes again. It goes off into the glade sneezing, outraged.
Kit: I've wanted to do that for ages.
~ Then he looks frightened, as if he's done something wrong, and steps back into the middle of you.`,

// 10 Where Kit Stopped: the Hushfrost Reach, deeper
`@hushfrost
~ The Count brings you to a long black lake, frozen solid, far down in the Hushfrost Reach. You've seen it before. In a dream.
~ Out in the middle there's a hole in the ice, small, the size of a boy. It has never frozen over. Not in three hundred years.
~ Wisp is there. Not Kit. Wisp. The left-behind part. Pale and thin and very cold, hanging over the hole like breath.
boss:leftonread (Kit): You said my name. Nobody's said it since 1732.
boss:leftonread (Kit): Everybody leaves. It's what walking is.
? Wisp is waiting for you to go. Everyone always goes.
- Sit down on the ice with it {s3.sat}
  ~ You sit down on the ice. All of you, in a ring round the hole. Not stopping. Waiting.
  ~ You don't say anything. You just stay. It's what nobody did for Kit. Sometimes that's all it takes.
- Promise to come back {s3.promise}
  you: We'll come back. Every season. We'll come back for you.
  boss:leftonread (Kit): That's what they all say.
  you: We came back this time.
~ The cold gets less. Not gone. Less.
~ When you get up to go, the small frosted boy is standing with you, outside the hole, on the ice.
Kit: Is this what it's like? Going somewhere with people who wait?
mate: Mostly. We're not very fast.
Kit: Good.
~ Behind you, for the first time in three hundred years, the hole in the ice starts, very slowly, to freeze.`,

// 11 Clockwork: the Spindrift Isles, deeper (The Clockwork Isle)
`@spindrift
~ The Clockwork Isle is all cogs. Somebody built it, long ago, to keep time for the other islands. This season it's running fast, and every island is spinning to keep up.
~ And at the centre of the cogs, spinning fastest of all, is Gale.
boss:scroll: There's always more further down. There's always more.
!shake
~ Gale is quicker than ever, like everything, and harder to keep up with.
~ But Kit is counting. Out loud. One, two, three, four. The way you'd count in a rowing boat.
? Kit is counting time.
- Hit back on Kit's count {s3.count}
  ~ You hit back on the count, all together. Gale can't keep up with a rhythm. It wobbles, and spins off sideways into the sky.
- Get Kit out of the wind
  ~ You get Kit behind you. He keeps counting anyway, louder, and you find yourselves stepping in time with him, and it works.
~ Afterwards, the Clockwork Isle starts to slow down. Tick. Tock. Like a heart after stairs, settling.
~ Kit is less frosted today. You can see his freckles properly.
Kit: Mr Holloway made the clock on the Count. He used to let me wind it.
Kit: He'd say, every step a stitch, Kit. And I'd say, what if you drop a stitch? And he'd go quiet.`,

// 12 The Sunken Lamp: the Lowmost Deep, deeper
`@lowmost
~ One more week. Down at the bottom of the Lowmost Deep, half buried in silt, there's a lamp. A lighthouse lamp, huge, the glass as tall as a house.
~ It's lit. Blue. It has been lit for a very long time.
~ Kit stops dead. He won't go any nearer.
Kit: That's where it looks out from.
you: Where what looks out?
Kit: The thing that sits. When people sit in the glow back home, it looks out at them through that. Through the lamps. Through the windows.
Kit: I could feel it, on the ice. Watching. Pleased.
!shake
~ The Kraken is curled round the lamp like a cat round a fire.
boss:kraken: Down here it's always three in the morning.
? The Kraken won't leave the lamp.
- Fight it away from the lamp {s3.lamp}
  ~ You fight it away from the lamp, all together, and the lamp goes dimmer the further it gets. The Kraken doesn't like that at all.
- Go round the long way
  ~ You go round the long way, keeping Kit in the middle. The lamp turns, slowly, to watch you go.
~ When you're past, Kit's hand is in someone's. It isn't cold. Well, it's cold. But it's a hand.
~ The lamp behind you goes round once, slowly, like a beam.`,

// 13 The Render Shore: the Misrendered Realm, deeper
`@misrendered
~ The Render Shore is where the Misrendered Realm runs out. The ground just stops loading, and past it is grey, and then nothing.
~ You stand on the edge together, all of you, and Kit too.
~ The Count chimes. Thirteen times. Out over the nothing, the sound goes on for a very long way.
~ On the thirteenth, Kit puts his hand on the Count. This time it doesn't go through.
Kit: I can feel him. Mr Holloway.
Kit: He's not lost. He's just stopped. He's sitting somewhere warm. He's been sitting there a very long time.
Kit: And he's so cold.
? Kit is holding the Count.
- "We'll find him." {s3.find}
  you: We'll find him. Next season.
  Kit: Will you shout at him?
  you: Probably.
  Kit: Good. Someone should.
- "Do you want to find him?"
  Kit: Yes. No. I want him to have waited. He didn't. I want to see him anyway.
@town-glow
~ Back home the windows go out, street by street. Here and there a door opens and someone goes for a walk.
@misrendered
~ When the chimes stop, the needle swings round. It points back into the Misrendered Realm. Back towards the Upside Down Inn.
~ Towards a table by the window, and somebody sitting at it.
Ishbel (Ishbel, by text): Deeper.
Ishbel (Ishbel, by text): Bring the boy. He's owed a word with somebody.`,
];

// ---------- SEASON 4: The Error Throne (thick skins everywhere; who Grimm really is) ----------
const S4 = [
// 1 Thick Skins: the Blotmarsh (Bogbody Crossing)
`@blotmarsh
~ Bogbody Crossing. The planks are old. The man under them is older.
~ A woman sits on the end of the crossing with her feet in the bog, smoking a clay pipe. She has a jeweller's eyeglass screwed into one eye.
Local (Old Peat): Holloway's Count. Give it here. I'll not drop it. I've not dropped anything since 1840.
~ She opens the case with a tool like a dentist's and holds it up to the fog.
~ Under the dial is a tiny empty socket.
Local (Old Peat): Something was in here. A bead of gold, from the stain on the brass. You don't put a thing like that in a clock unless you went and got it.
Local (Old Peat): There's only one place you get gold like that. The Void. Her hoard.
mate: We are not stealing from a dragon.
Local (Old Peat): Course not. You'll be borrowing.
~ She snaps the Count shut and hands it back.
Local (Old Peat): Everything round here has grown a thick skin this year. The planks. The leeches. Me. Your monsters will too.
Local (Old Peat): Don't wait for the lucky hit. Just hit them a lot.
!shake
~ Brett comes up through the crossing like a seal through ice. He's glossy and tough this season, like a bouncy castle that's been to the gym.
boss:notification: You have 99+ unread. You have 100+ unread. You have...
? Brett's hide is thick as a boot.
- Keep at it, steady, no big moments {s4.steady}
  ~ You keep at it. Steadily. No big moments. Just work. Eventually he gets bored and wobbles off to his Wallow.
- Go for one big hit
  ~ You wind up one enormous hit. It bounces off. Brett looks almost touched by the effort.
~ Under the planks, the bogbody opens one eye.
Local (The man under the planks): Holloway came this way. Paid his toll in Efforts. Said he was going all the way down.
Local (The man under the planks): Never came back up. Mind how you go.
~ He shuts his eye again. The planks settle.`,

// 2 In Step: Puffcap Hollow (Rotroot Stair)
`@puffcap
~ Rotroot Stair: carved by something with very big feet and no sense of rhythm. Some steps are knee-high. Some are an inch.
~ Kit walks with you in plain sight now, most days. In the orange light of Puffcap Hollow he's hardly frosted at all.
~ At the bottom of the stair there's a snail the size of a car, with a saddle on it.
Local (A snail-keeper): Lift down the stair? Very reasonable rates.
~ {mate} gets on. The Count stops ticking at once. It is very clear about this.
mate: It's sulking.
you: It's principled. It only counts walking.
~ {mate} gets off.
!shake
~ Halfway down, Rory stands up out of the roots. Its hide is as thick as a boot now, and spores pour off it in slow orange sheets.
boss:autoplay: Because you watched "Sitting Down", you might like "Sitting Down Again".
? The steps are all different sizes and Rory is right below you.
- Walk in step, all together {s4.instep}
  ~ You walk in step, on the count, whatever size the stair. It's the only thing Rory can't stand: a rhythm. It backs off into the roots, grumbling.
- Splash it from the puddle
  ~ You splash it. Orange things hate cold water. Rory backs into the roots, dripping and furious.
~ At the bottom Kit is laughing so hard he has to sit on a step. Then he remembers, and stands up very quickly.
Kit: Sorry. Sorry. Habit.
you: Sitting's fine. Stopping's the problem.
Kit: How do you tell the difference?
mate: Someone waits for you.`,

// 3 Who Keeps the Lantern: the Hushfrost Reach (The Last Lantern)
`@hushfrost
~ The Last Lantern stands on a post in the snow at the edge of the Hushfrost Reach. Someone keeps it lit. Nobody has ever seen who.
~ Kit goes straight up to it and opens the little glass door and trims the wick, quick and practised.
you: It's you. You keep it lit.
Kit: Since 1732. So people could find their way to me.
Kit: Nobody came. But it seemed rude to let it go out.
~ Wisp is there, a little way off in the snow. It isn't attacking. It's just watching Kit trim the lantern, like someone watching themself in a window.
~ Wisp has a thick skin this season too. Frost on frost. It looks very old.
? Wisp is watching.
- Scratch Kit's name on the lantern post {s4.kitname}
  ~ You scratch it in with a key: KIT PENHALLOW. And the date. Both dates. 1732, and this year.
  ~ Kit reads it three times.
  Kit: Nobody ever wrote my name down before. Except him. In the register.
- Leave something for Wisp
  ~ You tie a bootlace in a bow round the lantern post. Wisp drifts closer, looks at it, and for once doesn't make anyone feel forgotten.
~ Wisp drifts away over the snow towards its Hollow without a fight. Sunday will be different. Today it just wanted to look.
~ When you go, the Last Lantern is burning brighter than you've ever seen it. Kit keeps looking back at it.`,

// 4 Thunder Tonic: the Spindrift Isles (The Broken Mill)
`@spindrift
~ The Broken Mill: its sails spun so fast they took the roof with them. The Taxman has opened an office in what's left.
~ It's very convincing. The queue is very long. He's taxing anyone with a step counter: rope-makers, kite-flyers, a goat.
~ He's going to need a bigger mill.
? Do you queue?
- Leave him a present instead {s4.tonic}
  ~ You buy a bottle of Spindrift Thunder Tonic from a stall on the bridge. It's brewed from lightning and tastes like a hedge on fire.
  ~ You leave it on his desk as a gift. He tries it while you watch. It's a long time before he says anything at all.
  Taxman: ...Is this declared?
- Queue with everybody else
  ~ You queue. It takes two hours. When you reach the front he looks at you, looks at the Count, and waves you through without a word.
  ~ The goat behind you is furious.
~ Out on the islands Gale has grown a hide like a barn door. The big gusts that used to knock it sideways just make it wobble.
boss:scroll: Just one more. Just one more. Just one more.
~ So you stop going for big hits. You keep at it, one after another, steady, until it spins itself out against the mill and goes off to its Spindle to sulk.
~ On the Taxman's desk, under the tonic bottle, there's an itinerary. It's very long. It goes all the way down the page and off the bottom.
mate: Where's he planning to go?
~ At the top, in his tidy hand: Depths, tour of. For after.`,

// 5 The Inkfall: the Lowmost Deep
`@lowmost
~ The Inkfall: where the light gives up. Bring a torch and a strong opinion.
~ You have one torch between you, and plenty of opinions. You walk down into the black in single file, holding on to the person in front.
!dark
~ Something brushes past you in the dark. Slowly. Then something else. Then a great many somethings, all at once.
boss:kraken: The bottom of the feed is very comfortable. Nobody ever leaves.
~ The Kraken's skin is like a wet car tyre this season. Nothing goes in quickly. You just have to keep hitting it in the dark, all of you, together, until it gives.
? It's dark and the Kraken is everywhere.
- Hold hands and keep hitting {s4.dark}
  ~ You hold hands in a ring and hit outwards. It takes a long time. Then the tentacles slide away into the black, sulking.
- Shine the torch in its eye
  ~ You shine the torch in its eye. It hates that. It knows exactly what a light in the eye at three in the morning feels like.
!light
~ When the Kraken has gone, the torch picks out something on the floor of the Inkfall. An old brass lantern, crusted with silt.
~ On the base, engraved: A.H.
~ When you bring it near the Count, it flickers, very faintly, and lights.
~ Kit stares at it.
Kit: He carried that across the ice. I watched it go. I watched it all the way to the other side.
Kit: He must have come down here after. Down all this way. On his own.
~ You take the lantern with you. Nobody suggests otherwise.`,

// 6 The Register: the Misrendered Realm (The Loop Road)
`@misrendered
~ The Loop Road. You've walked this bit before. You'll walk it again.
~ The third time past the same signpost, somebody ties a sock to it. The fourth time, the sock is there. The fifth time, there are two socks.
~ Grimm is waiting where the loop joins up, very still. Something about him is harder now. Rougher. Like old bark.
boss:algorithm: STOP.
!shake
~ He swings. You hit back. Nothing seems to go in.
? Grimm's hide is like iron.
- Stop looking for the perfect hit {s4.together}
  ~ You stop looking for the perfect hit. You just keep going, all of you, together, until he steps back.
- Ask him a question mid-fight
  you: Why do you always write in capitals?
  ~ Grimm stops mid-swing. For one second he looks embarrassed.
  boss:algorithm: ...Penmanship.
  ~ Then he swings again, harder. But you all keep going until he steps back.
~ As he goes, a scrap of paper falls out of a crack in his bark. Old paper. Very neat handwriting.
~ It's a list. Kit Penhallow. Morwenna Pascoe. Ishbel Pascoe. A few others. Each name with a tick.
~ At the bottom: "All accounted for. All left."
mate: That's a register. Like a teacher's.
you: Holloway's register. Why would Grimm have Holloway's register?
~ Kit takes the paper and looks at his own name for a long time.
Kit: He ticked me. I was still on the ice, and he ticked me.
~ When you walk on, the loop lets you go. Behind you, the sock signpost flickers and disappears.`,

// 7 Forty Rungs: the Gilded Void (The Coin Nebula)
`@gildedvoid
~ The Coin Nebula: a cloud of loose gold, drifting. Do not pocket any. She counts.
~ At its edge there's a stargazer with a brass telescope, sitting on nothing, counting the coins and writing them down.
Local (A stargazer): Holloway's Count. May I?
~ She holds it up to the gold light and turns it over. On the back, round the rim, too fine to see unless you know, is a ladder. Tiny rungs, engraved one under another.
Local (A stargazer): Forty of them. That's not decoration. That's a map.
Local (A stargazer): Under the seven realms there's a ladder going down. Forty rungs. Something sits at the bottom.
~ She runs a fingernail down them.
Local (A stargazer): Three are lit. You'll light the fourth when this season's done.
~ Nobody says the obvious thing out loud. Forty is a lot of rungs. Someone does the sum anyway, and goes quiet.
~ Then she taps the empty socket under the dial.
Local (A stargazer): It wants feeding. One coin from the hoard. Holloway took one. Somebody must have taken it back.
? A single gold coin drifts past your nose.
- Take it {s4.coin}
  ~ You take it. Every coin in the nebula stops drifting at once.
- Don't touch it
  ~ You don't touch it. The coin drifts round you twice, as if deciding, and then settles into the socket by itself.
!shake
~ Something huge wakes up on the far side of the gold.
boss:dragon: You have something of mine.
~ Vex is tougher than ever, scales like roof tiles. She doesn't attack properly. She just looks at you, and at the Count, and at the coin in it.
boss:dragon: One hour. You owe me one hour. I'll collect.
~ Then she goes back to her Hoard. The coin fits. The Count ticks once, very loudly, then settles into a deeper sound, like a clock in a cellar.
~ The glass over the dial has gone gold.`,

// 8 Mothermud: the Blotmarsh, deeper
`@blotmarsh
~ Mothermud is the bottom of the Blotmarsh, where all the mud comes from. It's warm. It's soft. It bubbles invitingly, like a bath somebody has run for you.
~ Lie down in it, the mud seems to say. Just for a bit. You've walked such a long way.
~ {mate} starts to kneel.
? {mate} is sinking into the mud!
- Pull them out {s4.pulled}
  ~ You grab {mate} under the arms and haul. The mud lets go with a noise like a disappointed sigh.
- Shout their name
  you: {mate}! Up!
  ~ {mate} blinks, and stands up, and looks at their knees in horror.
~ Kit was quicker than both of you. He's already got hold of {mate}'s sleeve, frosting it white.
Kit: Not today.
~ The Taxman has set up a stall at the edge of the mud: MUD DUTY, PAYABLE ON ALL MUD CARRIED OUT ON BOOTS.
~ A bog-wife from the guild walks up to him and holds up a parchment with a wax seal and nine signatures in mud. He reads it twice. Then he goes away.
~ On a post at the edge of Mothermud someone has written STOP in neat blue capitals.
~ Underneath, in a child's careful letters, scratched with something sharp: NO. K.P.
~ Kit goes red and pretends he hasn't seen it.`,

// 9 Head Office: Puffcap Hollow, deeper (The Rot Cathedral)
`@puffcap
~ The Rot Cathedral: a church grown entirely out of fungus, arches and pews and a spire that drips. The organ plays itself, very slowly, one note an hour.
!dark
~ Halfway down the nave the spores come in thick. In them are two shapes you know.
~ The Taxman has a clipboard. Grimm has his club.
~ And behind them, further back, a third shape. Tall. Horned. With the sound of chains.
boss:krampus (???): ...
~ It doesn't come forward. It just watches, while Grimm swings and the Taxman takes notes.
Taxman: Don't mind him. He's from Head Office. Seasonal. He does December.
? The horned shape is watching you in particular.
- Stare back {s4.stared}
  ~ You stare back. It tilts its horned head, slowly, as if it's reading a list. Then it makes a small tick in the air.
- Keep fighting Grimm
  ~ You ignore it and keep fighting Grimm. Thick skin. Steady hits. Hold together.
!shake
~ The fight is long and heavy and nothing goes in easily, and you hold together.
!light
~ When the spores clear, all three are gone. There are hoofprints in the moss of the aisle.
~ And Rory, very small and very quiet, is hiding under a pew. Even Rory is scared of the horned thing.
mate: The Taxman said Head Office.
you: So the Taxman has a boss. And the horned thing works for it. So does Grimm.
mate: And wherever it is, I bet it's got a lot of windows.`,

// 10 The Hush Below: the Hushfrost Reach, deeper
`@hushfrost
~ The Hush Below is under the Hushfrost Reach: a cave of ice so deep the silence has weight. Kit leads you down. He knows the way.
Kit: He's close now. Mr Holloway. I can feel it. Warm and cold at the same time.
~ At the bottom, in the blue dark, Wisp is waiting.
~ For the first time you see them side by side. Kit, freckled and nearly solid. Wisp, pale and thin and very old. The same height. The same shape, if you squint.
boss:leftonread (Kit): ...wait for me...
Kit: That's the bit of me that's still waiting. On the ice. It never stopped waiting.
? Kit is looking at Wisp.
- "Tell it it can stop soon." {s4.soon}
  Kit: Not yet. Not till he's said sorry. Then it can stop.
  ~ Wisp hears. It drifts back a little, into the ice. Not gone. Waiting, but a different kind.
- Let Kit decide
  ~ You say nothing and let Kit decide. He walks up to Wisp and puts his hand out, and Wisp puts its hand out, and they don't quite touch.
  Kit: Soon.
!shake
~ The ice groans. Wisp still has its job to do. It comes at you, all cold and grief, and you hold together in the dark and see it back to its Hollow.
~ Kit doesn't fight it. He just stands at the back, holding the lantern with A.H. on it, keeping the light on for everyone.`,

// 11 Get Up, Abiah: the Spindrift Isles, deeper (Windward Last)
`@spindrift
~ Windward Last is the last island before the Spindrift Isles give out. A rock, a stone hut and a view of the Misrendered Realm flickering green on the horizon.
~ Inside the hut, on the windowsill, there's a diary. It's in the neat handwriting. The capitals are very neat.
~ Every page says more or less the same thing.
Holloway (Abiah Holloway, diary): Get up, Abiah. Get up and walk.
Holloway (Abiah Holloway, diary): Get up. The boy is behind you. Go back for him.
Holloway (Abiah Holloway, diary): Get up. Tomorrow. Tomorrow, then.
~ The last page just says: Tomorrow.
~ Kit reads it over your shoulder. He doesn't say anything for a long time.
Kit: He knew. He knew he should go back.
!shake
~ Gale comes screaming round the hut, thick-skinned and spinning, trying to blow the diary out of your hands.
boss:scroll: Refresh. Refresh. Refresh.
? Gale wants the diary.
- Hold on to it, all together {s4.diary}
  ~ You hold on to it together, everyone with a corner. Gale tears at it for an hour and gets one page, the one that says Tomorrow, and nothing else.
- Let Kit keep it
  ~ Kit puts the diary inside his coat and holds on. Gale can't get in there. Nothing can.
~ When the wind drops, the needle on the Count is pointing straight at the green flicker on the horizon.
~ At the Misrendered Realm. At something in it that has been sitting very still for a very long time.`,

// 12 The Black Shelf: the Lowmost Deep, deeper
`@lowmost
~ One more week. The Black Shelf is the edge of the Lowmost Deep, where the sea floor just stops and there's a drop into the dark that the Count's needle can't measure.
~ The Kraken is coiled round the edge, thick-skinned and furious, the oldest you've ever seen it.
boss:kraken: Down here it's always three in the morning. And you have kept me up all year.
!shake
? The Kraken is guarding the edge.
- Keep at it, all together {s4.shelf}
  ~ You keep at it, steadily, the way you've learned. No big moments. It takes a long time. In the end the Kraken lets go of the edge and sinks away down its Throat, grumbling.
- Let Kit hold the lantern up
  ~ Kit holds up Holloway's lantern. The Kraken looks at it as if it has seen it before, a very long time ago, and backs away.
~ You stand on the Black Shelf afterwards and look over. Nothing. Black all the way down.
~ The Taxman is there too, a little way along, with his itinerary.
Taxman: Next week, a coffee house. I've booked a table. Not his table. Nobody books his table.
~ Kit is very quiet.
Kit: What if he doesn't want to see me?
mate: Then we'll stand there until he does.
Kit: That might take a while.
you: We're good at standing. We're good at walking. We're very good at waiting.`,

// 13 Holloway's Letter: the Misrendered Realm, deeper (The Table by the Window)
`@misrendered
~ At the back of the Upside Down Inn there's a door. Behind the door is a coffee house, and it's the only perfect thing in the whole Misrendered Realm.
@cafe
~ Marble tables. Bentwood chairs. Waiters in bow ties. Nobody rushes you. Every detail is right. Somebody copied this very lovingly.
~ The head waiter has a letter for you.
Waiter: This has been in the safe since 1734. To be given to "whoever brings in the brass counter".
Waiter: I had stopped expecting to give it to anyone. So had my father. So had his.
~ It's from Abiah Holloway.
Holloway (Abiah Holloway, 1734): I meant to take it all the way down. Seven doors, and under them a ladder, forty rungs, to the thing that sits at the bottom.
Holloway (Abiah Holloway, 1734): Every step a stitch, and there is far more coat below than above.
Holloway (Abiah Holloway, 1734): My knees have filed a complaint and I must stop here. Just for a coffee. Just to rest.
Holloway (Abiah Holloway, 1734): Whoever reads this: it isn't finished.
~ The handwriting is neat. The capitals are very neat.
~ You've seen those capitals before. In the museum. On Duplicate Hill. On a post at the edge of Mothermud.
~ STOP.
!dark
~ At the table by the window, a very large man is reading a menu upside down. He's blue at the edges, in this light.
Waiter: The gentleman by the window has had that table since 1734. He has never ordered.
!glitch
~ Grimm turns round.
boss:algorithm (Grimm): I sat down for a coffee.
boss:algorithm (Grimm): It came out of the window-glow and sat beside me, and it said: you have walked enough. Let others decide where to go.
boss:algorithm (Grimm): I decided for everyone, after that. What they saw. Where they looked. It was all very orderly.
? Grimm. Abiah Holloway. The same man.
- "You left Kit on the ice." {s4.accused}
  you: You left Kit on the ice.
  boss:algorithm (Grimm): I left everyone. Kit. Morwenna. Ishbel. Myself. The Count would not abide a stop, so I made sure I never saw anyone stop.
- "Come with us." {s4.invited}
  you: Come with us. Walk.
  boss:algorithm (Grimm): My knees filed a complaint. I upheld it.
  ~ But his hand, on the table, twitches towards an old three-cornered hat.
- "Why did you write STOP?"
  boss:algorithm (Grimm): Because if anybody finishes it, it means I could have.
~ Then Kit steps out from behind you, holding the lantern with A.H. on the base.
Kit: Mr Holloway.
~ Grimm goes very still. The whole coffee house goes very still. Even the steam from the cups stops.
boss:algorithm (Grimm): Kit.
Kit: You didn't turn round.
boss:algorithm (Grimm): No.
Kit: You could now.
!light
~ The Count chimes. Thirteen times. On the back, the fourth of the forty rungs lights up gold.
~ Grimm flinches at every chime, exactly like the Taxman does.
~ The Taxman is at the next table, drawing up his itinerary. He raises his cup.
Taxman: A tour of the depths. Think of the paperwork.
boss:algorithm (Grimm): Finish it, then. Show me.
@the-glow
~ And far below, under the seven realms, under all forty rungs, something with a hundred small lights for eyes opens them.
~ One by one.
~ Each one the exact cold blue of a phone at three in the morning. Or of a lighthouse beam, seen from very far out.`,
];

const WRITTEN = { s1: S1, s2: S2, s3: S3, s4: S4 };

// ---------- seasons 5+: the long way down ----------
// Ladder order, the same as game.js BOSSES: chapter k meets BOSSES[(k - 1) % 7] in its own realm.
const BOSSES = [["notification", "Brett"], ["autoplay", "Rory"], ["leftonread", "Wisp"], ["scroll", "Gale"], ["kraken", "the Kraken"], ["algorithm", "Grimm"], ["dragon", "Vex"]];
const LAIRS = { notification: "Wallow", autoplay: "Burrow", leftonread: "Hollow", scroll: "Spindle", kraken: "Throat", algorithm: "Error Throne", dragon: "Hoard" };
const REALM_OF = { notification: "blotmarsh", autoplay: "puffcap", leftonread: "hushfrost", scroll: "spindrift", kraken: "lowmost", algorithm: "misrendered", dragon: "gildedvoid" };
const AFFIX_NAMES = { fog: "Fog", frost: "Frost", haste: "Haste", thickhide: "Thick Hide", volatile: "Volatile", leech: "Leech", bloodmoon: "Blood Moon", silence: "Silence", brittle: "Brittle", echo: "Echo" };
const AFFIX_LORE = {
  fog: ["This season the Stillness breathes out fog, and it comes through the seam into every realm.", "You'll see their attacks coming late. Keep your eyes up."],
  frost: ["Everything's stiff with cold this season, every realm of it.", "Swapping places takes twice as long. Decide where you stand before you set off."],
  haste: ["Everything's in a hurry this season, creatures included.", "They swing faster. What you win off them comes faster too."],
  thickhide: ["The creatures have grown thick skins this season.", "Lucky big hits won't do much. Hit them a lot instead."],
  volatile: ["The creatures are jumpy this season.", "They'll use their own nasty trick far more often. Learn it and watch for it."],
  leech: ["This season, every hit that lands, the creature drinks a little back.", "Like a feed that refreshes itself. Don't let up."],
  bloodmoon: ["There's a red moon over every realm this season.", "Under it the creatures hit forty per cent harder. The loot's better too. Of course it is."],
  silence: ["Something is sitting on your specials this season.", "They charge slower. Phones go a bit quieter too, which honestly is fine."],
  brittle: ["Everything's brittle this season.", "The creatures stagger easily, but they hit harder while they're standing."],
  echo: ["This season, everything echoes.", "Every third attack comes again a second later, softer, like a notification you've already dismissed."],
};
// Same rotation as game.js: written seasons, then single twists, then pairs.
const SOLO = ["volatile", "leech", "bloodmoon", "silence", "brittle", "echo", "fog", "frost"];
function affixFor(n) {
  if (n <= 4) return ["fog", "frost", "haste", "thickhide"][n - 1];
  if (n <= 12) return SOLO[(n - 5) % SOLO.length];
  const ids = Object.keys(AFFIX_NAMES), pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push(`${ids[i]}+${ids[j]}`);
  return pairs[((n - 13) * 7) % pairs.length];
}
const BOSS_QUOTES = {
  notification: ["BZZT. Did you see this? Did you SEE this?", "You have 99+ unread. You have 100+ unread. You have...", "Just checking in! Just checking in! Just checking in!", "BZZT. Someone you've never met liked something you never posted."],
  autoplay: ["Next episode in five... four...", "Are you still watching? You are. You're still watching.", "Skip intro? Skip intro? Skip intro?", "Because you watched \"Sitting Down\", you might like \"Sitting Down Again\"."],
  leftonread: ["...seen.", "...typing...", "...seen at 11:42...", "...you never wrote back..."],
  scroll: ["Just one more. Just one more. Just one more.", "Refresh. Refresh. Refresh.", "Next! Next! Next! Next!", "There's always more further down. There's always more."],
  kraken: ["Down here it's always three in the morning.", "Come down. Just for a look. Just for an hour.", "The bottom of the feed is very comfortable. Nobody ever leaves."],
  algorithm: ["STOP.", "You might also like: sitting down.", "Recommended for you: STOP.", "I know where you're going. I've decided it's the sofa."],
  dragon: ["Every hour you gave me, I kept.", "My hoard is made of evenings. Yours are in here somewhere.", "One more hour. You won't miss it. You never do."],
};

// The long arc, one entry per cycle (season 5 = 0): `mid` plays in chapter 7 (the Gilded Void), `end` in chapter 13
// (deep in the Misrendered Realm) before the chimes. "HOL:" at the start of a line is Holloway: still in Grimm's
// shape for the first few seasons, then himself.
const SAGA = [
  // 0 The First Rung
  { mid: `~ On the gold road behind you, half a mile back, something big and blue is walking. Slowly. Limping.
mate: Grimm. He's following us.
~ He stops when you stop. He starts when you start. He doesn't come any closer.
Kit: He sat in a coffee house chair for three hundred years. His legs have forgotten how. Give them time.`,
    end: `~ At {place}, Grimm is waiting on the far side of a flickering stream. He takes something out of a crack in his bark: an old three-cornered hat.
~ He holds it for a long time. Then he puts it on.
Taxman: He's going to follow you all the way down, you know. Badly. At a distance. Writing STOP on things.
you: Why?
Taxman: Because the only way he gets to finish is if you do. He'll never admit it. Neither would I.` },
  // 1 Rising Damp
  { mid: `~ The damp has got into the Void. The gold road is slippery, and Vex's hoard steams.
~ In a puddle on the road you can hear something: a whole evening from 1951, trapped in the water. Laughter, a telly, someone saying "just one more".
Margaret: That'll be the Fairy Ring lot. Their last good evening. She keeps everything.
? The evening is still playing in the puddle.
- Stamp in it {g.stamp}
  ~ You stamp in it. The evening splashes up into the dark and floats away free, like a bubble. Somewhere, very faint, someone says thank you.
- Leave it be
  ~ You leave it be. Some things aren't yours to let go.`,
    end: `~ At {place}, Grimm is sitting on a bench, breathing hard. He has walked the whole week behind you, every step.
HOL: I had forgotten knees. I had forgotten a great deal.
Kit: You'll remember. It comes back. Like pins and needles, but all of you.
~ Grimm looks at Kit for a long time. Then he gets up off the bench, on his own.` },
  // 2 Spore Season
  { mid: `~ Spores have drifted up into the Void. They hang in the gold light like dust in a church.
~ At Moonwharf the Summit Committee are wearing masks made of old tea towels.
Margaret: Gerald's a bit more solid this year. Every squad that keeps walking, he comes back a little. Look, you can see his tie.
~ You can. It's a very bad tie. Gerald waves, faintly.`,
    end: `~ At {place}, on a post, there's the word STOP in neat blue capitals, fresh.
~ Grimm is standing beside it with a stick of chalk. He looks at it for a long time. Then, slowly, underneath, he writes: NO.
~ He looks at it as if somebody else did it.
Kit: That's the first time.
HOL: It is not. It is the second. The first was 1724. I had forgotten.` },
  // 3 The Long Hush
  { mid: `~ In the Void, with the sound turned down, you can hear the Count ticking. And under it, very faint, a second tick, slightly out of time.
~ It's coming from Kit. A heartbeat. Slow, and cold, but there.
Kit: Is that me?
mate: That's you.
Kit: I didn't know I still had one.`,
    end: `~ At {place}, Kit and Holloway walk side by side for a bit. Not talking. Kit's short legs, Holloway's long ones, somehow in step.
~ Then Kit stops and turns round and looks back up the path, and waits for the last of the squad to catch up.
~ Holloway watches him do it. He doesn't say anything. But the next time someone falls behind, he's the one who waits.` },
  // 4 Loose Moorings
  { mid: `~ One of the Spindrift Isles has drifted all the way into the Void. On it is a little stone cottage with smoke coming out of the chimney.
~ Six men in flat caps are sitting outside it, playing cards. You know one of them.
Navvy: Evening. Don't mind us. We're off the wreck. Somebody kept walking long enough that we could stand up for a bit.
Navvy: It's grand. Everything aches. I love it.`,
    end: `~ At {place}, a bridge has only loaded half its planks. Holloway walks out over the gap and holds the missing planks in place with his own hands while you cross.
HOL: Nobody went back for Kit. You went back for me. I am trying to work out why.
you: Because you were behind.
HOL: That's all?
Kit: That's all it ever is.` },
  // 5 Low Water
  { mid: `~ The hoard is spilling. Loose hours tumble down the gold road like coins out of a burst bag.
~ The Taxman picks one up and holds it to his ear. Then he goes very pale.
~ It's an evening from 1911. A snow shelter. Somebody singing, badly.
Taxman: That's Mabel.
~ He listens to the whole song with his hat off, in the middle of the road. Nobody hurries him.`,
    end: `~ At {place}, the Taxman finds you. He's been walking all week. You can tell by his shoes.
Taxman: The four in the shelter. They're getting colder. The terms change as the ladder goes down. I don't like the new terms.
you: Then change them.
Taxman: You don't change terms with the Stillness. You read the small print. I'm reading it.
~ He has a very small magnifying glass. He looks as if he hasn't slept since 1911.` },
  // 6 Copy Errors
  { mid: `~ The Void is loading wrong. Half the stars are squares. There's a copy of Vex's hoard next to the real one, made of yellow cardboard.
~ Vex is furious about this. You can hear her from the dock.
boss:dragon: COPIES. Copies of my GOLD.
~ For once she isn't interested in you at all. You walk the whole Void unbothered while she sets fire to cardboard.`,
    end: `~ At {place}, in a copy of your town, Holloway shows you round. He's proud of it and ashamed of it in exactly equal amounts.
HOL: I copied everything I stopped seeing. Your street. Your bus stop. A thousand towns. I couldn't bear to look at them, so I kept them in here.
? Holloway is standing in the copied high street.
- "Put them back." {g.putback}
  you: Put them back. Let people see them again.
  ~ He lifts a hand. One copied shop flickers and is gone. Back home, a real one, shut for years, has its lights on in the morning.
- "Why copy them at all?"
  HOL: Because I missed them.` },
  // 7 The Gold Rush
  { mid: `~ Loose hours are raining down out of the Void into every realm below. People back home pick them up in their sleep and wake feeling as if they've had an evening off.
~ Vex is beside herself, flying up and down the gold road with a sack.
boss:dragon: Mine. Mine. Mine. That one's mine.
~ One hour lands right in your hand. It's warm. It's one of your own evenings, the one you spent scrolling in March.
? You're holding one of your own lost evenings.
- Keep it {g.kept}
  ~ You keep it. That night you sleep like someone who went for a walk after tea.
- Give it back to the Void
  ~ You let it go. Vex snatches it out of the air, looks at you, and for a second seems almost confused.`,
    end: `~ At {place}, Holloway takes one of his copies apart. The whole of a copied street goes, house by house, like a sandcastle in the tide.
~ Back home, in a real street, somebody opens their curtains for the first time in a year.
HOL: That's one. There are rather a lot.
Kit: You'd better keep going, then.` },
  // 8 Two by Two
  { mid: `~ The realms are thin this season. Through a gap in the Void's floor you can see down into the next realm, and through a gap in that, the next.
~ And at the very bottom, through all of them, a long way down: a hundred small blue lights.
~ They aren't stars. Stars don't blink all at once.`,
    end: `~ At {place}, a letter is waiting, pinned to a post with a hatpin.
@lighthouse-night
Morwenna (Morwenna, by letter): I can see you from here. You're further down than anyone has ever been.
Morwenna (Morwenna, by letter): Be careful. The lights are not stars.
Morwenna (Morwenna, by letter): And tell Abiah I said nothing at all. He'll know what it means.
@misrendered` },
  // 9 The Undertow
  { mid: `~ Everything is sliding downhill. In the Void that means the gold road tilts, and you walk it leaning back, like going down a sand dune.
~ Margaret's stall has slid a mile down the road. The Committee are chasing it with their flasks.
Margaret: Everything's going down this year, dear. Even the tea. Mind you don't go with it.`,
    end: `~ At {place}, Holloway stops in the middle of the flickering road and says something you didn't expect.
HOL: I'm sorry, Kit.
~ Kit doesn't answer straight away.
Kit: Say it again in a year. If you still mean it, I'll believe it.
HOL: That's fair.
Kit: I know it's fair. I've had three hundred years to work out what's fair.` },
  // 10 Lanterns Out
  { mid: `~ Someone has put out the lanterns on the gold road. The Void is very dark without them.
~ You find the culprit at the end of the dock. It isn't the Taxman. It's a little brass snuffer on a long pole, moving on its own, blue at the tip.
~ Kit relights every lantern behind it, one by one, without being asked.`,
    end: `~ At {place}, the Taxman is waiting with a lantern of his own. He holds it up.
Taxman: I want it on record that the lanterns were not me.
mate: We know. We saw the snuffer.
Taxman: Head Office does that. Puts the lights out, so people stay where they are. It's in the small print.
Taxman: I've been reading the small print. There's a great deal of it.` },
  // 11 The Halfway Rung
  { mid: `~ Halfway down the ladder the Void is old. The gold has gone dull, like a brass doorknob nobody polishes.
~ Vex is old down here too. She doesn't fight you. She just watches from her hoard, with one eye.
boss:dragon: You keep giving the hours back. Nobody gives the hours back.
boss:dragon: It's very annoying. I'm counting it.`,
    end: `~ At {place}, twenty rungs down, the Count's ticking has gone so deep you feel it in your feet.
~ Holloway stops and takes his hat off.
HOL: This is as far as I got. I came down this far on my own, and then I went back up and sat down in a coffee house.
HOL: Everything below this I have never seen.
Kit: Nor have we. Come on, then.` },
  // 12 The Hundred Lights
  { mid: `~ From the edge of the Void you can see them clearly now. A hundred small blue lights, far below everything, in a ring.
~ As you watch, they all turn the same way. Towards you.
mate: They're watching us.
Kit: They've always been watching. Now they're looking.`,
    end: `~ At {place}, Holloway draws you a map in the dust. Seven realms. A ladder. And at the bottom, a ring of lights.
HOL: The Taxman calls it Head Office. Morwenna's bargain was made with it. So was mine. So was his.
you: What is it?
HOL: I don't know. I only know it sits. It has always been sitting. And it is very, very tired.` },
  // 13 Head Office
  { mid: `~ The Taxman is walking with you this season, all the way, every day. He complains about everything. He doesn't fall behind once.
~ At Moonwharf, Margaret sells him a jar of air. He pays. He actually pays.
Margaret: Is he all right?
mate: He's got a review at Head Office.
Margaret: Oh, the poor man.`,
    end: `~ At {place}, the Taxman gets his review. It's a letter in blue ink that arrives out of nowhere and unfolds itself.
~ He reads it. He goes white. He reads it again.
Taxman: Collections are down. Steps are up. Walkers keep walking. Head Office is "concerned".
Taxman: They want me to try harder.
? The Taxman is holding the letter.
- "Will you?" {g.taxask}
  Taxman: I have always tried exactly as hard as the terms require. Not a step more.
  ~ He folds the letter into a paper boat and puts it in a flickering puddle.
- Say nothing
  ~ You say nothing. He folds the letter very small and puts it in his pocket, next to the pilgrim passport.` },
  // 14 Old Debts
  { mid: `~ In the Void, on the gold road, you find Mabel's knitting. A long scarf, a hundred years long, unravelling behind someone who walked this way in 1911.
~ The Taxman picks up the end of the wool and follows it, winding it into a ball as he goes.
~ It leads all the way across the Void. He winds all of it.`,
    end: `~ At {place}, the Taxman sits down on a step. Then he remembers, and stands up again, very fast.
Taxman: I've found it. In the small print. Clause nine hundred and four.
Taxman: The four in the shelter go free if the ladder is finished. All forty rungs. By walkers who never once stop.
Taxman: It's a clause written so that nobody could ever meet it. That's how you write clauses.
mate: So we meet it.
Taxman: Yes. I was afraid you'd say that.` },
  // 15 Krampus Weather
  { mid: `~ The horned thing is following. Every week, a realm behind, with its sack and its chains and its list.
~ In the Void you see it clearly for the first time: standing on the gold road, ticking names off in the air with a long black claw.
? Krampus is watching you from the gold road.
- Wave {g.wavedk}
  ~ You wave. It doesn't wave back. But it doesn't tick anything either.
- Walk faster
  ~ You walk faster. All of you. The chains get quieter behind you.`,
    end: `~ At {place}, there are hoofprints in the flickering dust, and a list, dropped. It's very long.
~ It's everyone back home who sat down in the glow this year and didn't get up. Your street is on it. Half of it.
~ At the bottom, in blue: TO BE COLLECTED.
Kit: Not if they get up first.
you: Then we'd better make some noise up there.` },
  // 16 The Boot Fair
  { mid: `~ Boots are coming up out of the Void. Pairs of them, drifting up from the hoard, laces still tied. Every pair is someone who stopped.
~ The 1951 lot's boots. The navvies' boots. Hundreds you don't know.
~ You collect them as you go. By the end of the gold road you're carrying forty pairs between you, and the Count is ticking like mad.`,
    end: `~ At {place}, you line the boots up in a long row along the flickering road. Holloway helps. He's very good at straight lines.
~ In the morning half of them have gone. Walked off in the night, by themselves.
HOL: When somebody at home gets up off the sofa, their boots go back to them. I didn't know that. I had stopped noticing.` },
  // 17 The Sleepers
  { mid: `~ The Void is full of sleepers this season, floating gently along the gold road, each in their own bubble of blue light, each dreaming.
~ One of them is dreaming of you. You can see it in the bubble: your squad, walking, all together, in the rain.
~ The sleeper is smiling.`,
    end: `~ At {place}, Holloway stands over a sleeper on the flickering road: a man in a dressing gown with a remote in his hand.
HOL: I decided what he saw for eleven years. Every evening. He never once chose.
? Holloway is looking at the sleeper.
- "Wake him." {g.woke}
  ~ Holloway bends down and, very gently, takes the remote out of the man's hand. The man stirs, and smiles, and fades upwards, home.
- "Leave him, he's happy."
  HOL: He isn't. That's what I told myself for three hundred years.
  ~ He takes the remote anyway. The man fades upwards, home.` },
  // 18 Wrong Way Up
  { mid: `~ The Void is upside down this season. The gold road runs across the top of the sky and you walk it with your hair hanging down.
~ The hoard is overhead. Every so often a coin falls up.
Margaret: Don't look down, dear. Or up. Whichever one the floor is.`,
    end: `~ At {place}, the whole realm flips the right way up all at once, with a noise like a duvet being shaken out.
~ Holloway is lying flat on his back in the flickering grass, laughing. Actually laughing. Nobody has heard that sound before.
Kit: He used to laugh like that. Before.
Kit: I'd forgotten.` },
  // 19 The Chorus
  { mid: `~ The Void hums a low, slow note, like a finger round the rim of a glass. Every coin in the hoard is singing.
~ Vex is asleep and singing in her sleep, and she sounds like an old woman humming in a kitchen.
~ Nobody wants to wake her. You go past on tiptoe, all the way.`,
    end: `~ At {place}, the Misrendered Realm hums too, but out of tune, like a recorder in a school assembly.
~ Kit hums with it, and slowly it comes into tune.
~ When you put the seven notes together, one from each realm, they almost make a song. Kit knows it.
Kit: Mabel used to sing that. On the ice. Mr Holloway taught it her.` },
  // 20 Weather Swap
  { mid: `~ It's snowing in the Gilded Void. Snow falling on the gold and melting with a hiss.
~ Vex hates it. She keeps breathing fire at the snow, and it keeps coming, and the steam rises in great clouds.
~ You walk through the fog of it with your hoods up, and for once nothing bothers you at all.`,
    end: `~ At {place}, it's sunny, which has never once happened in the Misrendered Realm. Everything is lit up properly. Every copy looks, for a day, like the real thing.
~ Holloway stands in the sun with his eyes shut.
HOL: I had forgotten the sun.
Kit: You keep saying that. What haven't you forgotten?
HOL: You. I never forgot you. That was the whole trouble.` },
  // 21 The Missing Hour
  { mid: `~ The missing hours are here. Every realm's stolen hour, hanging in the Void like lanterns.
~ In one of them everything has stopped, and a boy is sitting on the ice inside it, waiting. Very small. Very frosted.
Kit: That's me. That's the hour I fell in.
? The old hour is hanging in front of you.
- Let it go {g.letgo}
  ~ You let it go. It floats away up the ladder, and the small frosted Kit inside it waves, and is gone.
  Kit: Thank you. I didn't want to keep it.
- Give it to Kit
  ~ Kit takes it and holds it for a long time. Then he lets it go himself.`,
    end: `~ At {place}, Vex is waiting. She has come out of her own realm for the first time anyone knows of, holding the hours she stole in a sack.
boss:dragon: You keep giving them back. I don't understand it. I am trying to understand it.
boss:dragon: Tell me why.
you: Because they're not for keeping.
~ She thinks about this for a long time. Then she empties the sack, and flies home.` },
  // 22 Deep Water
  { mid: `~ There's water in the Void. A trickle, running down the gold road from somewhere above. It tastes of salt.
~ It's coming from the Lowmost Deep, through the hole the Kraken dug. Everything is draining downwards, towards the lights.
~ You follow it all the way across the Void. It runs off the edge and falls for a very long way, and you never hear it land.`,
    end: `~ At {place}, Holloway puts his ear to the flickering ground.
HOL: It's filling up. Down there. Everything that drains goes to it. All the hours. All the water. All the people who sat.
HOL: It isn't eating them. It's keeping them. Like Edwin's four. Nice and warm.
mate: Why?
HOL: Because it's lonely, I think. Things that sit are always lonely.` },
  // 23 The Second Lamp
  { mid: `~ From the edge of the Void you watch the hundred lights far below. One of them has started to go round. Once a minute. Like a beam.
~ It sweeps across the bottom of the world and, for one second, lights you all up blue.
mate: The hundred lights. Head Office. It's a lighthouse.
you: It's her lighthouse.`,
    end: `~ At {place}, Ishbel is waiting. She has walked all the way down, in her waxed jacket, to tell you herself.
Ishbel: Aye. That's what I see from my end. Every night. Her light, going round at the bottom of everything. I'm sorry I never said.
Ishbel: She's not evil. She's been sat down for three hundred years with the light on. Something got in through it, and she's been holding the door.
Ishbel: Get her up. Please.` },
  // 24 Kit's Way
  { mid: `~ Kit leads you across the Void by a way nobody else knows: a path of old footprints in the gold, small ones. His.
Kit: I came this way looking for him. Lots of times. I never found him. But I found all the short cuts.
~ You get across the Void in half the time. Vex doesn't even wake up.`,
    end: `~ At {place}, Kit stops at a small copied house at the end of a copied street.
Kit: That's my house. In the village. He copied it.
~ Holloway stands behind him, hat in his hands.
HOL: I couldn't look at it. So I kept it.
Kit: It's a good copy. You got the door right.
~ Kit opens the door and looks inside for a long time. Then he shuts it gently and comes back.
Kit: It's empty. I'd rather be out here. With people.` },
  // 25 The Register
  { mid: `~ The register turns up in the Void, lying open on the gold road. Holloway's register. Names are going from it one by one, the ink lifting off the page like smoke.
~ The navvies. Gone. Gerald. Gone. The 1951 lot. Gone.
mate: Someone's crossing them off.
Kit: No. Look. They're not crossed off. They're just not on the list any more. Nobody's keeping them.`,
    end: `~ At {place}, Holloway reads the register with you. There are only a few names left on it now.
~ Kit Penhallow. Morwenna Pascoe. Ishbel Pascoe. Edwin Tally. Mabel, Arthur, Ruth, Sidney. Abiah Holloway.
HOL: Everyone still held. Everyone still kept, by something, somewhere.
HOL: When the ladder's done, I think the page goes blank.
Kit: Good.` },
  // 26 Nobody Left
  { mid: `~ The creatures are trying to split you up this season. In the Void the gold road forks every few minutes, and every fork whispers your name from a different side.
~ You hold hands across the Void, all of you, in a line. It's slow, and daft, and nobody goes down the wrong fork once.`,
    end: `~ At {place}, Holloway counts heads at the end of every day, out loud, like a teacher on a school trip.
~ It takes him a while. He keeps counting Kit twice to be sure.
HOL: All accounted for.
~ He stops. He has said that before. On a register.
HOL: All accounted for. Nobody left.` },
  // 27 The Long Sofa
  { mid: `~ There's a sofa in the Gilded Void. A long one, gold velvet, floating by the road with a blanket on it and the telly on.
~ It's exactly right. The cushions are exactly right. Everyone wants to sit on it so badly it hurts.
? The sofa is right there.
- Walk past it, holding hands {g.sofa}
  ~ You walk past it, holding hands, not looking. It follows you for a mile, then drifts off sadly into the dark.
- Push it off the road
  ~ You push it off the road together. It falls into the Void, slowly, the telly still on, getting smaller.`,
    end: `~ At {place}, Holloway stands in front of a copy of a coffee house chair. His chair. The one from 1734.
HOL: Three hundred years in that chair.
~ He picks it up, carries it to the edge of the flickering realm and drops it into the grey. He doesn't look to see it go.` },
  // 28 Glass Floors
  { mid: `~ The floor of the Void has gone as thin as glass. Under the gold road, a very long way down, you can see the lights, and among them a shape.
~ It's sitting. It's enormous. It's very, very still.
~ Kit won't look. He walks the whole Void with his eyes on the back of {mate}'s coat.`,
    end: `~ At {place}, through the thin flickering floor, the shape at the bottom shifts slightly, like someone getting comfortable.
~ The hundred lights all blink at once.
HOL: It knows we're coming.
Taxman: It's always known. Head Office knows everything. It just doesn't do anything about it. That's what makes it Head Office.` },
  // 29 Every Step a Stitch
  { mid: `~ This season you can see your stitches. Behind you on the gold road every step leaves a small gold thread, tying the Void together.
~ By the end of the week there's a long gold seam all the way across the dark, neat as anything.
Margaret: Look at that hemming. Holloway would be proud.
~ Holloway, at the back, coughs, and goes a bit pink.`,
    end: `~ At {place}, the seams of the Misrendered Realm are mending themselves behind you. Copies are coming apart. Real things are coming back.
HOL: I always thought every step a stitch meant keeping the world together.
HOL: It means keeping each other together. The world is just the cloth.` },
  // 30 Under the Lamp
  { mid: `~ The Void is darker this deep. The gold road runs out over the edge and becomes a ladder going down. The last few rungs.
~ At the bottom, upside down, there's a lighthouse. Its lamp points down into the dark, going round, blue.
Kit: That's hers.
~ Nobody says anything else. Nobody needs to.`,
    end: `~ At {place}, Ishbel walks with you for the day. She hasn't walked with anybody since 1724.
Ishbel: She sat down by the fire at the edge of the world, and the fire was the first window. The first glow. Something looked out of it at her.
Ishbel: She let it in, and then she sat in front of the door for three hundred years so it couldn't get any further. That's what the light is. Her, holding the door.
Ishbel: I hated her for sitting. I never once asked why she stayed sat.` },
  // 31 All Hands
  { mid: `~ The Void is crowded. Everyone who ever walked is walking: men in flat caps, Gerald in his bad tie, the 1951 lot in anoraks, the druid with his wristband.
~ The Summit Committee have set up a tea stall halfway across and are doing a roaring trade.
Druid: Blessed be! Mind the queue!`,
    end: `~ At {place}, everyone stops to count heads. It takes all afternoon. There are hundreds of you now.
~ Nobody is left behind. Nobody went on ahead.
~ At the back of the crowd the Taxman is counting too, very carefully, in a notebook. He gets the same number twice. He looks almost happy.` },
  // 32 The Stillness
  { mid: `~ From the bottom of the Void you can see it. Under the upside-down lighthouse, under the lamp, something is sitting in the dark.
~ It isn't a monster. It isn't anything. It's just very tired, and very big, and very comfortable, and it has been sitting there since before there were chairs.
Kit: It's not angry. It's just sat.
mate: That's worse.`,
    end: `~ At {place}, the Taxman reads you the small print one last time.
Taxman: Every bargain it ever made goes back to one door. Her light. Close the door and every bargain ends.
Taxman: Mabel and the others go free. The 1951 lot. Everyone it ever kept nice and warm.
mate: And Morwenna?
Taxman: The small print doesn't say. The small print never says the important thing.` },
  // 33 The Last Rungs
  { mid: `~ The last rungs of the ladder are cold iron, and every one has names scratched into it. Squads, going all the way back.
~ 1724. 1802. 1874. 1911. 1951. 1971. And on the last rung but one, freshly scratched: {squad}.
~ Somebody did that before you got here. The handwriting is a child's.`,
    end: `~ At {place}, Holloway gives you his hat.
HOL: Hold it for me. When we get to the bottom I shall want both hands.
~ It's a very old hat. It smells of coffee and snow.` },
  // 34 The Vote
  { mid: `~ The Void is quiet this season. Even Vex doesn't come out. Everyone is waiting to see what you'll decide.
~ The hundred lights are very close now, just under the floor of the realm. Going round. Once a minute.`,
    end: `~ At {place}, the squad holds a vote, standing up, in a circle.
Taxman: Point of order. What happens to her light when you finish?
HOL: It goes out. The bargain ends. The light goes out, and whatever it has been holding goes free.
mate: And Morwenna?
HOL: I don't know. Nobody has ever finished.
? The squad votes. What do you want for Morwenna?
- She walks the last bit with us {g.votewalk}
  you: She walks the last bit. With us. She hasn't taken a step since 1724. It's time she did.
- Let the light go out, whatever happens {g.votedark}
  you: The light goes out. Whatever that means for her. She chose it, three hundred years ago.
- Ask Ishbel
  Ishbel: Don't ask me. I've been angry at her for three centuries. I'm the wrong person to ask.
  Ishbel: ...Bring her with you. Please.
  set g.votewalk
~ The needle points down, and then, for the first time ever, up. Home.` },
  // 35 The Last Lamp (chapters 12 and 13 are written in full below)
  { mid: `~ The last time through the Gilded Void. Vex is waiting on the gold road, and she has brought the hoard with her. All of it.
boss:dragon: I counted it. Every hour. Every evening anyone ever lost.
boss:dragon: It's yours. All of yours. I'm tired of counting.
~ She opens her wings and the hoard goes up like sparks: millions of lost evenings, floating home up the ladder.
~ Vex, very much lighter, curls up on nothing and goes to sleep. Properly. For the first time.`,
    end: "" },
];
// Season 40 (the last cycle): chapter 12 and the grand finale, written in full.
const FINAL_12 = `@lowmost
~ The bottom of the Lowmost Deep, the very last time. The Kraken's Throat is wide open, and everything is draining into it: water, light, hours.
~ From the edge you can see straight down. The upside-down lighthouse at the bottom of everything, blazing blue. It has never been so bright.
Taxman: Head Office knows you're coming. It's turned everything up.
Holloway: Sunday will be bad. Every one of them will come through at once.
~ Brett. Rory. Wisp. Gale. The Kraken. Something with a club, wearing his old shape. Everything the Stillness ever kept, piling up behind the seam.
~ Holloway sits on a rock, turning his old hat round and round in his hands.
Holloway: She'll be in the lamp room. She always sat as close to the light as she could. Even at nineteen.
you: Will she be glad to see you?
Holloway: No. But she'll be glad to see you. Start there.
mate: So we mend it. Like always.
Kit: Like always.
? One night left before the last rung.
- Get some sleep {g.slept}
  ~ You sleep. Properly. All of you in a row on the rock. Rest is a stop with a morning after it.
- Sit up and talk
  ~ You sit up and talk until three. About the Blotmarsh. About the Fairy Ring. About the druid. Everyone laughs about the druid.
- Write home {g.wrotehome}
  ~ You write back to everyone you ever left on read. Every single one. "Nearly home. Long story."
~ In the morning: the last rung. And then the lamp.`;
const FINAL_13 = `@misrendered
~ The last place in the Misrendered Realm, and under it, the last rung. You climb down together, one after another, Holloway at the back with both hands free.
@lighthouse-night
~ At the bottom there's a lighthouse standing on its head. You go in at the top, which is the bottom, and climb down the stairs, which go up.
!glitch
@the-glow
~ Then you're inside it. The lens. A hundred lights for eyes, all looking at you at once.
~ And in the middle, by the lamp, in a shawl, with a lantern in her lap: Morwenna. Exactly as she was. Sitting down.
Morwenna: There you are. I've had the kettle on since 1994. And before that, since 1724.
Morwenna: Do you know what it is now? The thing in my light?
you: Everyone who ever sat down and didn't get up.
Morwenna: It's tired. That's all it ever was. Tired and frightened and ever so comfortable.
Morwenna: I was the first door it found. I've been sitting in it ever since, so it couldn't come any further.
~ Behind you: the squad. Kit. Holloway, in an old coat, with his three-cornered hat in his hands. The Taxman, clipboard under one arm, unopened.
Holloway: Morwenna. I'm sorry. I should have turned round. For you, and for the boy.
Morwenna: Abiah. You took your time.
if g.votewalk
  you: We voted. You're walking the last bit. With us.
  Morwenna: I've not taken a step since 1724. I don't know if I remember how.
  Kit: You put one foot in front of the other. Then you do it again. I'll show you.
else
  if g.votedark
    you: We voted. The light goes out. Whatever happens to you.
    Morwenna: That's fair. That's more than fair.
    Morwenna: But I'd like to walk out of here on my own feet, if you'll have me. Just as far as the gate.
  else
    you: It's over, Morwenna. Come and walk with us.
    Morwenna: I've not taken a step since 1724. I don't know if I remember how.
? Morwenna holds out her hand.
- Take her hand {g.tookhand}
  ~ You take her hand. It's cold, and then it isn't.
- Give her the Count
  ~ You give her the Long Count. She holds it like something she lost when she was nineteen.
~ She stands up.
!flash
~ The Count chimes. Not thirteen times. Forty times: once for every rung, all the way down and all the way back up.
@lighthouse-night
~ The beam goes out.
!dark
~ For one long breath there's no light at the end of the last street at all.
@town-glow
~ Then, in the town, the windows change one by one. Blue to yellow. Screen to lamp. Someone opens a door. Someone goes for a walk.
!light
~ And up the street come people. Lots of people, coming up out of the glow like swimmers surfacing.
~ A navvy in a flat cap. A man called Gerald, perfectly solid, in a terrible tie. Someone in an anorak from 1951. Four walkers in wool, one of them knitting.
~ Mabel hugs the Taxman so hard his bowler hat falls off. He doesn't pick it up.
~ Kit runs. Not ahead, not behind. Just runs, because he can. Then he turns round and waits for everyone, because he wants to.
@lighthouse-night
Ishbel: Took your time.
~ Ishbel is at the lighthouse gate. Morwenna looks at her sister. Her sister looks at her. Nobody says anything. Nobody needs to.
Holloway: It's finished.
Morwenna: No. Nothing's finished. It just doesn't need holding any more.
~ She gives the Count back to you. It's still ticking. Of course it is.
Morwenna: It'll want walking, every week. Not because the world will stop. Because walking is good, and you're good at it.
Morwenna: Six days walking, the seventh mending. The creatures will still try their luck. The Stillness is very tired, and it loves a sofa.
Morwenna: But it hasn't got a door any more. Only windows. And you know what to do about windows.
~ Behind the lighthouse door the seam flaps in the draught. The needle swings round. Down. Of course it does.`;
// After the first time down the ladder (season 41 on): a gentler loop.
const LAP2 = {
  open: `~ Second time down the ladder. All forty rungs on the back of the Count are lit, and this time each one turns gold as you pass it.
Keeper ({keeper}): The Stillness hasn't got a door any more. But it still tries the windows. Something always comes through on a Sunday.
Taxman: And someone has to hold the clipboard. I volunteered. I missed it, if you can believe that.
~ Holloway walks with you some weeks now, hat on, knees complaining. Kit sends postcards. They all say: still walking.`,
  mid: `~ Halfway through, a postcard from Morwenna. She's walked to the end of the street and back. Twice. She's very pleased with herself.
Morwenna (Morwenna, by postcard): The light at the end of the street is just a light now. White. Boring. I love it.
Morwenna (Morwenna, by postcard): Mind the windows. Keep walking.`,
  end: `~ At {end} the Count chimes, and another rung on its back turns from lit to gold.
Holloway: Every step a stitch. The coat keeps needing them. That's not a failure. That's what coats are for.`,
};

// The generator's pools. {place} {next} {prev} {route} {leg} {keeper} {twist} {boss} {bossid} {bossline} {end} {start}
// {realm} {lair} are filled per chapter; {you} {mate} {mate2} {squad} {steps} are left for the player.
const ARRIVE = [
  "~ {place}. The Count ticks once as you arrive, like a nod.",
  "~ You reach {place} footsore and pleased with yourselves.",
  "~ {place} at last. Somebody cheers. Somebody else sits down on their rucksack, and the Count goes cold until they stand up.",
  "~ The path to {place} is longer than the map says. They always are.",
  "~ You come into {place} in single file, counting heads, the way you always do now.",
];
const LOCALS = [
  `Local (A pedlar): There was a man through here last week asking after you. Bowler hat. Clipboard.
Local (A pedlar): He asked if you'd declared your breakfast.`,
  `Child: Why are you walking?
you: Because when enough people stop, things come through the gaps.
Child: ...Can I come?
mate: Ask your mum. Then walk to school. That counts too.`,
  `Keeper ({keeper}): Holloway's map has a note here, you know. In the margin. "Good bread. Bad bed."
Keeper ({keeper}): Still true. On both counts.`,
  `Local (A night watchman): I've watched this path forty years. Nobody walks it any more. They all just glow at home.
Local (A night watchman): Nice to see some feet.`,
  `Local (A woman with a lantern): You're the ones with the brass thing. My gran said if anyone ever came through with one, give them soup.
~ You get soup. It's excellent soup.`,
];
const SQUAD_CHOICES = [
  `? {mate} wants to rename the group chat.
- "Blister Sisters"
  mate: Perfect. Nobody's allowed to change it ever again.
  ~ It's changed again by Tuesday.
- "Brett's Victims"
  ~ It sticks. Somewhere far behind you, something buzzes, flattered.
- "Long Count, Short Legs"
  ~ {mate2} is offended on behalf of their legs. It's adopted anyway.`,
  `? Snack game: name a worse snack than {mate}'s.
- Fish-paste crisps
  ~ Gasps all round. {mate} concedes. It's the first win in the game since the lighthouse.
- Warm grapes
  mate: That's not a snack, that's a threat.
- A Puffcap Hollow mushroom
  ~ Everyone goes quiet and stares into the middle distance.`,
  `? Who leads today?
- You do
  ~ You lead. You take one wrong turn, own it, and nobody mentions it more than eleven times.
- {mate} does
  ~ {mate} leads, very confidently, in completely the right direction, which is suspicious.
- Whoever's slowest
  ~ The slowest walker leads, so nobody ever falls behind. It's the best idea anyone's had all season.`,
  `? Group photo at {place}. How many goes?
- One. Take it and go.
  ~ One go. Someone's mid-sneeze. It's perfect. It goes on the fridge.
- As many as it takes
  ~ Nine goes. In the one you keep, someone's blinking and someone's pointing at something nobody else saw.`,
  `? {mate} starts a song.
- Join in
  ~ You join in. It's terrible. Everyone joins in. It's still terrible. You do three more miles without noticing.
- Hum along quietly
  ~ You hum. {mate} sings louder to make up for it. The Count ticks in time, mostly.`,
];
const CLIFF = [
  "~ Behind you, on the path you've just walked, something with a club is walking too.",
  "~ That night, through the seam, every window in town glows blue at once, for a single second. Then they're normal again.",
  "~ The Count ticks twice, out of rhythm. It does that when something's following.",
  "~ In the morning there's a word in the frost on the tent: STOP. Somebody has crossed it out.",
  "~ Far below, past the bottom of the realm, a hundred small lights blink. All together. Like eyes.",
  "~ The path on to {next} disappears into the dark. You'll walk it tomorrow. Together.",
  "~ A cold patch follows you out of {place}, a few steps behind the last of you. It feels like someone who doesn't want to be left.",
  "~ Somewhere, faintly, a clipboard snaps shut.",
];
const BANTER = [
  `mate: How far to {next}?
you: Further than yesterday. Less far than tomorrow.
mate: That's not a number.`,
  `mate: Is it me, or is the Count ticking louder?
you: It's you. And it's also louder.`,
  `mate2: My feet have stopped speaking to me.
mate: Mine filed a complaint.
you: Holloway's knees did that. Look how he turned out.
~ Everyone walks a little faster.`,
  `mate: Do you think Morwenna's watching?
you: I think something is.
~ Nobody looks back. Everybody wants to.`,
  `mate: I've worked it out. We've walked about {steps} steps today between us.
you: Is that a lot?
mate: It's enough to make the Taxman cry.`,
  `mate: If I sit down for five minutes, will the world end?
you: Not the world. Just a little bit of a seam somewhere.
mate: ...I'll stand.`,
  `~ {mate} spots a bench with a view and points at it, longingly.
you: Sunday. Benches are for Sunday.
mate: Sundays are for monsters.
you: Benches after monsters.`,
];
const REMIND = [
  "~ The Count only counts real steps, taken together. Back home, every one of them carries you a step further in here.",
  "~ Through the seam, behind you, every window in town is lit. Some of them are blue. Those are the ones that feed this place.",
  "~ Somewhere behind you a seam is fraying where people have sat too long. Your steps are the thread.",
  "~ Six days walking, the seventh mending. Today is a walking day. Most days are.",
  "~ The Count ticks steadily in someone's pocket. While it ticks, nothing gets through for free.",
];
const ENDCHOICE = [
  `? Before you leave {place}...
- Send Ishbel a postcard
  ~ It says: still walking. She'll know what it means.
- Eat the last of the snacks
  ~ You eat the last of the snacks. All of them. Immediately.
- Take one last look
  ~ You take one last look. {place} looks back, the way places do when you've walked to them.`,
  `? The squad pauses at the edge of {place}.
- Count heads
  ~ You count heads. Everybody's here. The Count ticks, satisfied.
- Retie your laces
  ~ You retie your laces. Small things, done properly, are how you get to the bottom of anything.
- Keep going
  ~ You keep going. You always do.`,
];
const FAREWELL = `? The season's done. What now?
- Sleep for a week
  ~ You sleep for one night. It feels like a week. The Count doesn't mind. Rest is a stop with a morning after it.
- Get chips
  ~ You get chips. Wherever you come out of the seam, there's always somewhere doing chips.
- Look at the map
  ~ You look at Holloway's map. The dotted line goes on, down the ladder, rung by rung.`;
const its = (name) => (name === "Vex" ? "her" : "its");
function bossSeg(id, st) {
  const extra = id === "leftonread" && st >= 5 && st < 41 ? "\n~ It isn't Kit, quite. It's the part of him the Stillness still keeps. The left-behind part." :
    id === "algorithm" && st >= 5 && st < 41 ? "\n~ It isn't Holloway. Not the one who walks with you now. It's what's left of him in here, wearing his old shape." : "";
  const shown = id === "algorithm" && st >= 5 ? " (The shape of Grimm)" : "";
  return `!shake
~ Somebody back home has sat down too long. The seam has slipped, and {boss} knows you're in {bosspos} realm.
boss:{bossid}${shown}: {bossline}${extra}
~ {bossbeat}
? {Boss} is between you and {next}.
- Stand together
  ~ You stand together, shoulder to shoulder. {Boss} hits the wall of you and bounces off, for now.
- Keep walking past
  ~ You keep walking, all of you, eyes front. {Boss} follows, sulking, then slinks off towards {lair}.
- Shout {bosspos} name
  you: We know you, {boss}!
  ~ Things from the Stillness hate being named. {Boss} slinks back towards {lair}.
~ It isn't Sunday yet. You'll settle it there. Six days walking, the seventh mending.`;
}
function taxSeg(st) {
  const why = st >= 41 ? "Taxman: Because somebody has to, and I'm good at it, and I find I quite like you lot." :
    st >= 31 ? "Taxman: Because the terms say so until the ladder's done. Nearly there. I can almost smell the lamp." :
      st >= 17 ? "Taxman: Because the terms say so. But I've started walking to work. Don't tell Head Office." :
        "Taxman: Terms are terms. Four people in a snow shelter are kept warm on the strength of my collecting.";
  return `Taxman: Evening. It's nearly six. You know what that means.
~ {taxbeat}
? The Taxman taps his clipboard.
- "See you at six, then."
  Taxman: I'll be there. I'm always there. It's the one thing I'm good at.
- "Why do you still do this?"
  ${why}
- Offer him a biscuit
  Taxman: I'll have to declare that.
  ~ He eats it anyway. Slowly. As if he'd forgotten biscuits.`;
}
function squadSeg() {
  return `~ {squadbeat}
{squadchoice}`;
}
function clueSeg(kind, st) {
  if (kind === "holloway") {
    const line = st >= 41 ? "~ Holloway walks beside you today, hat on, knees complaining. He points out every view as if he built it." :
      st >= 21 ? "~ Holloway walks ahead most days now, rolling rocks off the path and straightening signposts. He writes NO on things." :
        st >= 10 ? "~ Holloway walks with you some days, at the back, saying nothing. When he falls behind, someone always waits." :
          "~ Every day you see him, a long way back: Holloway, in Grimm's big blue shape, following. Stopping when you stop. Starting when you start.";
    return `${line}
? Holloway is watching.
- Wave
  ~ You wave. After a long moment a big hand lifts. Then drops again, quickly, as if it's embarrassed.
- Call him over
  you: Walk with us!
  Holloway: ...Not yet. Soon.
- Leave him be
  ~ You leave him be. Some people have to arrive at things on their own.`;
  }
  if (kind === "lights") {
    const line = st >= 33 ? "~ That night the hundred blue lights are very close, just under the floor of the realm. They go round. Once a minute. Like a beam." :
      st >= 17 ? "~ That night, from a high place, you see them again: a hundred small blue lights, far below the bottom of the realm. Closer than before." :
        "~ That night, from a high place, you see something no map shows: far below the bottom of the realm, a ring of small blue lights. Like eyes.";
    return `${line}
? The lights are watching.
- Watch them back
  ~ You watch them. They blink, all at once, and look away first.
- Turn away
  ~ You turn away. The back of your neck stays cold for an hour.`;
  }
  if (kind === "kit") {
    const line = st >= 41 ? "~ A postcard from Kit. On the front, a picture of the lighthouse. On the back: STILL WALKING. NOT WAITING. K." :
      st >= 30 ? "~ Kit walks with you all afternoon, solid as anyone, telling {mate} about 1732 as if it was last week." :
        "~ There's frost on the inside of the tent this morning, though it isn't cold. Small handwriting: GOING ON AHEAD TO CHECK THE PATH. BACK SOON. K.";
    return `${line}
? You think about Kit.
- Leave a gap in the line for him
  ~ You leave a gap in the line, one person wide. Nobody fills it. Nobody needs to explain why.
- Say his name
  you: Kit.
  ~ Somewhere up ahead, something cold gets a little warmer.`;
  }
  // map note
  const notes = st >= 20 ? ["I miss the boy.", "Morwenna would have liked this view.", "Turn round, Abiah. Turn round.", "Good bread. Bad bed. Worse conscience."] : ["Mind the leeches.", "Good bread. Bad bed.", "Walked this in the rain. Would not recommend.", "Probably something good here."];
  return `~ Holloway's map has a note in the margin here, in his neat hand: "{mapnote}"
? The map is old and soft as cloth.
- Read the rest of the margin
  ~ Most of it is about soup. One line, smudged, might say: wait for me. It's hard to tell whose handwriting.
- Fold it away
  ~ You fold it away carefully. Some things you read once and keep.`.replace("{mapnote}", notes[Math.floor((st * 7) % notes.length)]);
}

function legAt(n) {
  const W = root.EffortWorld, legs = W && W.legs;
  if (!legs || !legs.length) return null;
  const li = (n - 5) % legs.length;
  return { W, legs, li, lap: Math.floor((n - 5) / legs.length), leg: legs[li], next: legs[(li + 1) % legs.length] };
}
function sentences(p) { return String(p).split(/(?<=[.!?])\s+(?=[A-Z"])/).map((s) => s.trim()).filter(Boolean); }
const NPC_KEEPERS = { Kit: "Kit", Margaret: "Margaret", Ishbel: "Ishbel" };

function generated(n, k) {
  const A = legAt(n);
  if (!A) return parse(`@the-seam\n~ The seam opens. The Count ticks. You walk.`);
  const { W, li, lap, leg, next } = A, B = W.beats || {};
  const L = leg.landmarks, keeper = leg.keeper || "the keeper";
  const st = lap > 0 ? 41 + li : n; // story stage: how far down the ladder the story is
  const cr = rng(hash(`s${n}:ch${k}`));
  const pick = (arr) => (arr && arr.length ? arr[Math.floor(cr() * arr.length)] : "");
  const deal = (arr, key) => { if (!arr || !arr.length) return ""; const sh = shuffle(arr.map((_, i) => i), rng(hash(`s${n}:${key}`))); return arr[sh[(k - 1) % sh.length]]; };
  const affix = affixFor(n), twist = affix.split("+").map((a) => AFFIX_NAMES[a]).join(" and ");
  const boss = BOSSES[(k - 1) % BOSSES.length], realm = REALM_OF[boss[0]], deep = k > BOSSES.length;
  const R = (W.REALMS || []).find((x) => x.id === realm) || { name: "the realm" };
  const place = L[k - 1].name, nextName = k < 13 ? L[k].name : next.landmarks[0].name;
  const bossName = boss[1], Boss = bossName[0].toUpperCase() + bossName.slice(1);
  const lair = `${bossName === "the Kraken" ? "the Kraken's" : bossName + "'s"} ${LAIRS[boss[0]]}`;
  const rungs = lap > 0 ? 40 : Math.min(40, n);
  const V = {
    place, next: nextName, prev: L[Math.max(0, k - 2)].name, route: leg.route, leg: leg.name, keeper, twist, n: String(n),
    boss: bossName, Boss, bossid: boss[0], bosspos: its(bossName), bossline: pick(BOSS_QUOTES[boss[0]]), lair, realm: R.name,
    end: L[L.length - 1].name, start: L[0].name, rungs: String(rungs), nextleg: next.name, nextroute: next.route, theme: leg.theme || "",
  };
  const wfill = (t) => String(t || "").replace(/\{place\}/g, place).replace(/\{next\}/g, nextName).replace(/\{route\}/g, leg.route)
    .replace(/\{boss\}/g, Boss).replace(/\{twist\}/g, twist).replace(/\{count\}/g, "the Long Count");
  const beat = (kind, key) => sentences(wfill(deal(B[kind], key)));
  const narr = (lines, max) => lines.slice(0, max).map((s) => `~ ${s}`).join("\n");
  V.bossbeat = beat("boss", "boss").slice(0, 2).join(" ") || "It's a long, messy scrap, and you finish it standing.";
  V.taxbeat = beat("taxman", "tax").slice(0, 2).join(" ") || "He has a new form. It's longer than the last one.";
  V.squadbeat = beat("squad", "squad").slice(0, 3).join(" ") || "The squad keeps going, the way it does.";
  V.squadchoice = deal(SQUAD_CHOICES, "sqc");
  const arrive = (B.arrive && B.arrive[realm] && B.arrive[realm][deep ? "deep" : "near"]) || [];
  const folk = ((B.folk && B.folk[realm]) || []).concat(LOCALS);
  const lairLine = deep ? `~ The second time through ${R.name} is always worse. The creatures remember you. So does the ground.` :
    `~ Somewhere ahead is {lair}. That's where the path ends this week, and that's where you'll be on Sunday.`;
  const parts = [];

  if (k === 1) {
    parts.push(`@lighthouse-night`);
    parts.push(`~ Season {n}: {leg}. {route}.`);
    if (lap > 0) parts.push(LAP2.open);
    else {
      parts.push(pick([
        "Keeper ({keeper}): You'll be Morwenna's lot. Ishbel wrote. She said you'd be late. You're late.",
        "Keeper ({keeper}): Every season has a keeper at Monday camp. I'm this one's. I've had the kettle on since your needle moved.",
        "Keeper ({keeper}): Holloway's dotted line comes right past my door. Nobody's walked it this deep in three hundred years. Until you.",
      ]));
      if (leg.theme) parts.push("Keeper ({keeper}): This time round, {theme}.");
    }
    parts.push("Keeper ({keeper}): I call this season {twist}.");
    for (const a of affix.split("+")) for (const t of AFFIX_LORE[a] || []) parts.push(`Keeper ({keeper}): ${t}`);
    parts.push("Keeper ({keeper}): Six days walking, the seventh mending. And mind the Taxman between six and nine. But you know all that.");
    parts.push(`@the-seam`);
    parts.push(`~ The lighthouse door opens on the seam, the same as ever. The Count ticks once, like a door shutting behind you.`);
    parts.push(`@${realm}`);
    parts.push(narr(beat("opening", "open"), 4));
    parts.push(arrive.length ? `~ ${pick(arrive)}` : "");
    parts.push(lairLine);
    parts.push(pick([
      `? Who's carrying the Count first?
- You take it
  ~ You take it. It's warm. It's always warm.
- Hand it to {mate}
  mate: Oh no. I'll drop it. Fine. Give it here.
- Draw straws
  ~ You draw straws. {mate} loses, and pretends that was the plan all along.`,
      `? What's the squad's rule this season?
- Nobody gets left behind {g.rule}
  ~ Everyone agrees. It's always been the rule. It's nice to say it out loud.
- Whoever complains first buys the coffee
  ~ {mate} complains about the rule immediately and buys the first round.
- No phones at mealtimes
  ~ There's a short, painful silence. Then everyone agrees, and means it, mostly.`,
    ]));
    parts.push(deal(BANTER, "ban"));
    parts.push(pick(CLIFF));
  } else if (k === 13) {
    parts.push(`@${realm}`);
    parts.push(arrive.length ? `~ ${pick(arrive)}` : "");
    parts.push(narr(beat("landmark", "land"), 2));
    if (lap > 0) parts.push(LAP2.end);
    else if (SAGA[li] && SAGA[li].end) parts.push(SAGA[li].end);
    parts.push(narr(beat("finale", "fin"), 3));
    parts.push(`@town-glow`);
    parts.push(`~ Back home, through the seam, the blue goes out of the windows, street by street.`);
    parts.push(lap > 0 ? `~ All forty rungs on the back of the Count are lit, and more of them glow gold now than last time.` :
      `~ When the chimes stop, {rungs} of the forty rungs on the back of the Count are lit.`);
    parts.push(`Ishbel (Ishbel, by text): Deeper. Next: {nextleg}. {nextroute}.`);
    parts.push(pick([`Ishbel (Ishbel, by text): Eat something green.`, `Ishbel (Ishbel, by text): Count heads. Always count heads.`, `Ishbel (Ishbel, by text): Proud of you. Don't tell anyone I said that.`]));
    parts.push(FAREWELL);
  } else {
    parts.push(`@${realm}`);
    parts.push(arrive.length ? `~ ${pick(arrive)}` : "");
    parts.push(pick(ARRIVE));
    parts.push(narr(beat("landmark", "land"), 3));
    parts.push(deal(REMIND, "rem"));
    parts.push(deal(folk, "local"));
    if (k === 7) {
      const mid = lap > 0 ? LAP2.mid : SAGA[li].mid;
      parts.push(mid);
      if (!/(^|\n)\? /.test(mid)) parts.push(deal(ENDCHOICE, "endc"));
    } else if (k === 12) {
      parts.push(`~ One more week. The end of the season is close enough to taste.`);
      parts.push(st >= 10 && st < 41 ? `Holloway: Last stretch. This is where people sit down. I would know.` : `Taxman: Final week. Do try not to make my paperwork any more difficult than usual.`);
      parts.push(`? The light's going. {end} is close.
- Push on tonight
  ~ You push on in the dark. Head torches. Silly songs. The Count ticks louder with every mile.
- Rest and go at dawn {g.rested}
  ~ You rest. Properly. Rest is a stop with a morning after it, and the morning comes, and you go.`);
    } else {
      const kind = { 2: "clue", 3: "boss", 4: "squad", 5: "taxman", 6: "boss", 8: "squad", 9: "boss", 10: "clue", 11: "taxman" }[k];
      if (kind === "boss") parts.push(bossSeg(boss[0], st));
      else if (kind === "taxman") parts.push(taxSeg(st));
      else if (kind === "squad") parts.push(squadSeg());
      else parts.push(clueSeg(["map", "holloway", "lights", "kit"][(n + k) % 4], st));
      if (kind !== "boss") parts.push(lairLine);
    }
    if (k !== 7) parts.push(deal(BANTER, "ban"));
    parts.push(pick(CLIFF));
  }
  let src = parts.filter(Boolean).join("\n");
  // Season 40: the last two chapters are written in full.
  if (lap === 0 && li === A.legs.length - 1 && k === 12) src = FINAL_12;
  if (lap === 0 && li === A.legs.length - 1 && k === 13) src = FINAL_13;
  src = src.replace(/^HOL:/gm, li < 3 && lap === 0 ? "boss:algorithm (Holloway):" : "Holloway:");
  // keepers who are story characters speak as themselves
  src = src.replace(/Keeper \(\{keeper\}\):/g, NPC_KEEPERS[keeper] ? `${NPC_KEEPERS[keeper]}:` : `Keeper (${keeper}):`);
  const KEYS = /\{(place|next|prev|route|leg|keeper|twist|n|boss|Boss|bossid|bosspos|bossline|lair|realm|end|start|rungs|nextleg|nextroute|theme|bossbeat|taxbeat|squadbeat|squadchoice)\}/g;
  src = src.replace(KEYS, (m, key) => V[key] ?? m);
  // second pass for placeholders that came in through the beats
  src = src.replace(KEYS, (m, key) => V[key] ?? m);
  // place names start with "The"; mid-sentence it reads "the" (at the Leech Inn, towards the Kraken's Throat)
  src = src.replace(/([a-z,] )The (?=[A-Z])/g, "$1the ");
  return parse(src);
}

// ---------- public ----------
function seasonNo(seasonId) { const n = typeof seasonId === "number" ? seasonId : Number(String(seasonId || "").replace(/^s/i, "")); return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1; }
const clampK = (k) => Math.max(1, Math.min(13, Math.floor(Number(k) || 1)));
function title(seasonId, k) {
  const n = seasonNo(seasonId); k = clampK(k);
  if (TITLES["s" + n]) return TITLES["s" + n][k - 1];
  const A = legAt(n); return A ? A.leg.landmarks[k - 1].name : `Chapter ${k}`;
}
function seasonName(n) { if (WRITTEN_NAMES["s" + n]) return WRITTEN_NAMES["s" + n]; const A = legAt(n); return A ? A.leg.name : `Season ${n}`; }
function chapter(seasonId, k, ctx) {
  void ctx;
  const n = seasonNo(seasonId); k = clampK(k);
  let body;
  try {
    body = WRITTEN["s" + n] ? parse(WRITTEN["s" + n][k - 1]) : generated(n, k);
  } catch (e) {
    body = [{ bg: "the-seam" }, { narrate: "The seam opens. The Count ticks. You walk." }];
    if (typeof console !== "undefined") console.warn("EffortStories:", e && e.message);
  }
  // the opening scene goes behind the title card
  const lead = body[0] && body[0].bg && Object.keys(body[0]).length === 1 ? [body.shift()] : [];
  const out = [...lead, { card: `Season ${n} · Chapter ${k}`, sub: title(n, k) }, ...body];
  if (k === 13) {
    const A = n > 4 ? legAt(n) : null, finalLap = A && A.lap === 0 && A.li === A.legs.length - 1;
    out.push(finalLap ? { card: "The end of the long way down", sub: "Every step a stitch" } : { card: `End of Season ${n}`, sub: seasonName(n) });
  }
  return JSON.parse(JSON.stringify(out));
}

root.EffortStories = { chapter, title, seasonName, BOSS_LORE, EVENT_LORE, parse };
})(typeof window !== "undefined" ? window : globalThis);
