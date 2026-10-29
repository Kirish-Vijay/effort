// Effort season stories as click-through scenes, for EffortStory.play() in story.js.
//
// API (window.EffortStories)
//   EffortStories.chapter(seasonId, k, ctx) -> script   seasonId "s1" (or 1), k = 1..13. Seasons 1-4 are written by
//                                                       hand; 5+ are built from world.js (EffortWorld.legs and beats),
//                                                       deterministic per season and chapter.
//   EffortStories.title(seasonId, k) -> string          the chapter title (the landmark name for seasons 5+)
//   EffortStories.BOSS_LORE / EffortStories.EVENT_LORE  one line per boss for the raid screen
//   EffortStories.parse(src)                            the little scene language below, for tests
//
// The scene language (one step per line; nesting by two spaces):
//   @bg-name                     background            !shake / !flash / !dark / !light / !glitch / !fade
//   ~ text                       narration             Speaker: text           a line (you, mate, mate2, Morwenna, Taxman, boss:kraken…)
//   Speaker (Shown name): text   name tag override     set flag.name           set a flag
//   ? optional question          a choice; options follow at the same indent as "- Label {flag.name}", each with an
//   - Label {flag.name}          indented body. The flag is optional (and always contains a dot).
//   if flag.name / else          branch, bodies indented
// Text keeps {you} {squad} {mate} {mate2} {steps} for the player to fill. Story flags are prefixed by season (s1., s2.,
// s3., s4.) or g. for the long way round.
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
  notification: "Brett: a slime made of every unread buzz. First through the seam when a town sits down.",
  autoplay: "Rory: crawled out of the swamp of 'next episode in 5'. Its spores sit you back down.",
  leftonread: "Wisp: every message nobody answered. It knows exactly what it's like to be left behind.",
  scroll: "Gale: the endless scroll made into weather. It never stops spinning, so you can't either.",
  kraken: "The Kraken: lives at the bottom of the feed, where it's always three in the morning.",
  algorithm: "Grimm: the Algorithm. Decides what everyone sees, and wants the Long Count switched off.",
  dragon: "Vex: sleeps on a hoard of every hour ever lost to the glow. The last one before dawn.",
  taxman: "The Taxman: collects the Stillness's rent from 6 to 9pm. Beat him and keep your steps.",
};
const EVENT_LORE = {
  newyear: "Rez: made of every midnight promise. The Stillness loves a plan to start tomorrow.",
  spring: "Atchoo: woke early in the allotment. When the clocks jump, the seams slip open.",
  solstice: "Solveig: sits on the sun and won't let it set. The Lindesnes keeper sleeps through it.",
  harvest: "Big Marrow Morris: wins the show by sitting on the judges. Sitting is how it all starts.",
  haunted: "The Grey Lady sat down at a bus stop in 1962 to wait. The Stillness kept her.",
  krampus: "Krampus: the Stillness's bailiff. Comes in December for the idle, and keeps a list.",
};

// ---------- seasons 1-4: titles (kept from seasons.js so the map still matches) ----------
const TITLES = {
  s1: ["The Long Count", "Fog on the Moor", "The Tor", "The Toll", "Every Step a Stitch", "The Right to Roam", "Twenty-Four Arches", "Above the Clouds", "The Wall", "The Ambush", "The Dark Glen", "Something in the Loch", "The End of the Road"],
  s2: ["Over the Water", "The Pulpit", "Two Hundred Days of Rain", "The Navvy Road", "Pull Up the Ladder", "The Troll Road", "Pilgrims", "The Hole in the Mountain", "The Circle", "The Maelstrom", "Unknown Walkers", "The Carvings", "The Top of the Map"],
  s3: ["The Ore Line", "The Town That Moved", "Midges", "The Church Town", "Two Clocks", "Nowhere Dark", "Sand", "Midsummer", "The Lace Town", "He Didn't Finish", "The Southern Tip", "Everyman's Right", "Across the Water"],
  s4: ["Honey Glass", "Mud", "The Sixth Hangar", "The Hill of Crosses", "The Sun Stone", "Witches' Hill", "The Lakes", "The Shipyard Gate", "Three Hundred and Sixty", "Calisia", "The Gate in the Mountains", "The Emperor's Diary", "Holloway's Letter"],
};
const WRITTEN_NAMES = { s1: "The Long Way Up", s2: "The Northern Line", s3: "Sun Over the Gulf", s4: "The Amber Road" };

// ---------- SEASON 1: The Long Way Up (Land's End to John o' Groats) ----------
const S1 = [
// 1 The Long Count — Land's End
`@lighthouse-night
~ Land's End. The last bit of England, and the wind wants it back.
~ The lighthouse is lit. The guidebook says it was automated in 1994. The guidebook is wrong.
Morwenna: There you are. I've had the kettle on since 1994.
you: Sorry, have we met?
Morwenna: Not yet. You're {you}. That's {mate}. The rest of {squad} are dawdling in the car park.
~ She presses something into your hand. Brass, the size of a pocket watch. Heavy. Warm. Ticking.
Morwenna: The Long Count. Made in 1724 by an ironmaster called Abiah Holloway.
Morwenna: Every winter somebody walks it to John o' Groats. A thousand miles. Thirteen weeks.
mate: And if nobody does?
!fade
@town-glow
Morwenna: Look behind you.
~ The town below. Every window lit the same cold blue. Nobody is moving.
Morwenna: That's what the country does when it stops. It sits. It glows. It waits for the next thing.
Morwenna: And when enough people stop at once, the seams come loose. Things come through.
!fade
@lighthouse-night
Morwenna: The Count only moves on real steps. Feet on the ground. Shaking it in a sock doesn't count. People have tried.
Morwenna: And it only counts steps you take together. One of you sits a day out, it goes cold.
Morwenna: Six days you walk. That's the thread. Sundays, you mend.
you: Mend what?
Morwenna: Whatever came through in the week. You drive it back before the seam closes. All of you, together.
Morwenna: Walk short in the week and the seam's loose. What comes through on Sunday comes through angry.
? Morwenna: So. Will you carry it?
- "Yes. Obviously. Look at it." {s1.eager}
  you: Yes. Obviously. Look at it, it's lovely.
  Morwenna: They all say that. Hold on to the feeling. You'll want it round about Stoke.
- "What happened to the ones who didn't make it?" {s1.doubt}
  you: What happened to the ones who didn't make it?
  ~ She takes a long time to answer. The beam goes round twice.
  Morwenna: They stopped.
- "Why don't you carry it?"
  you: Why don't you carry it yourself?
  Morwenna: I'm a lighthouse keeper, my love. I keep the light. The job doesn't come with legs.
~ Out in the fog, something wet and round shuffles closer. It's the size of a wheelie bin. It has a little red dot on top, like an unread message.
boss:notification: BZZT. Did you see this? Did you SEE this?
!shake
Morwenna: That's Brett. First one through, always. Don't look at him too long.
~ Then, right behind you, a polite little cough.
Taxman (???): Excuse me. Has anyone declared that pedometer?
~ When you turn round, there's nobody there. Just a clipboard-shaped dent in the fog.
Morwenna: Ah. Him. We'll talk about him later.
~ The beam sweeps out over the sea. For a second, just a second, it's the same blue as the windows.`,

// 2 Fog on the Moor — Dartmoor
`@moor-fog
~ Dartmoor is fog all the way down.
~ The ponies watch you go past like they've seen a lot of walkers and rated none of them.
mate: Is anyone else hearing a sort of... slap?
~ Slap. Slap. Somewhere in the mist, something damp is keeping pace.
boss:notification: BZZT. You have one new— BZZT. You have two new—
mate: It's Brett. He's followed us all the way from Cornwall.
~ Wherever Brett goes, he leaves a trail. You decide not to look at it.
~ Every time he buzzes, your pocket buzzes too. Every time you look, he gets a little bigger.
? What do you do?
- Check your phone
  ~ You check. It's nothing. It's never anything. Brett swells like a happy balloon.
  boss:notification: BZZT! Thank you for your attention!
  mate: Don't feed him!
- Put it on silent {s1.silent}
  ~ You flick the switch. Brett sags a little, like a bouncy castle at the end of a party.
  boss:notification: ...bzzt?
- Keep walking and don't look back
  ~ You keep walking. The slapping falls behind. Not far behind. But behind.
~ In a hollow under a granite tor you find a letterbox: walkers hide them out here, with a rubber stamp and a notebook.
~ The last entry is from 1951. The handwriting gets worse as it goes.
~ "Didn't make it. Got as far as Stoke. DO NOT STOP AT THE SERVICES."
mate: What happens at the services?
~ Nobody answers. Under the entry, pressed so hard it tore the page, is a little drawing of the Count.
~ The page after is blank. So is the one after that. And the one after that.
you: Who were they?
~ The Count ticks faster as you climb out of the fog. It likes it out here.
~ So, you notice, do you.
~ Behind you, much fainter now: BZZT.`,

// 3 The Tor — Glastonbury
`@tor-sunset
~ There's a man on top of Glastonbury Tor in a cloak and a festival wristband from 2009.
Druid: Greetings, pilgrims! I am a druid.
mate: Since when?
Druid: Since about 2009.
Druid: That device of yours runs on intention, ley lines and quads.
~ He's wrong about the ley lines. He's right about something else.
~ On days you all walk, the Count glows in your hand. On days somebody sits it out, it goes cold.
Druid: I only came up for one night. To see the sunrise.
~ He shows you his phone. On the screen: Episode 4,212. Next episode in 5...
Druid: I keep meaning to go down. It just... starts the next one.
~ Down on the Levels, where the swamp mist lies, something bright orange stands up.
boss:autoplay: Next episode in five... four...
!shake
~ Rory comes up the hill at sunset, flattening a field of abandoned tents. Wherever its spores land, people sit down.
? Rory is between you and the path.
- Fight it here
  ~ You square up. The Count goes ice cold in your hand. It doesn't want a fight today. It wants you moving.
  mate: Sunday. We'll sort it on Sunday. Go!
- Grab the druid and run {s1.druid}
  ~ You grab an arm each. The druid comes with you, protesting, phone still playing.
  Druid: Wait! It's the good bit!
  ~ At the bottom of the hill he blinks like someone waking up, sits on a bench, cries a bit, and thanks you.
- Keep moving
  ~ The Count says keep moving, so you keep moving.
~ Rory doesn't follow. It doesn't have to. It just counts down and waits for someone to stop.
boss:autoplay: ...three... two...
if s1.druid
  Druid: Can someone give me a lift to Frome?
  mate: We're walking.
  Druid: ...To Frome?
else
  ~ From the top of the Tor, someone shouts, "Blessed be!" And then, quieter: "Can someone give me a lift to Frome?"`,

// 4 The Toll — Clifton Suspension Bridge
`@bridge-night
~ The Clifton Suspension Bridge has a toll booth. Tonight, the Taxman is sitting in it.
~ It's six o'clock. All along the gorge, the windows are coming on. Blue.
Taxman: Good evening. One pound for cars.
Taxman: For walkers, the toll is twenty per cent of every step you've taken today. Plus admin.
you: That's not a real toll.
Taxman: Everything's real if there's a form for it. *produces a form*
Taxman: Allow me to explain. Between six and nine, the kettle's on and the sofa's warm.
Taxman: That's when the glow is brightest. That's when the Stillness collects its rent.
mate: The what?
Taxman: The thing behind the windows. The thing your little monsters crawl out of. I'm its collector.
Taxman: Every evening, six till nine, I'm owed a fifth of your day's steps.
you: And if we don't pay?
Taxman: Then you'll have to stop me. People do try. Some of them even manage it.
Taxman: Beat me and you keep your steps. Be quick about it and you might even pick my pocket. I'd call that theft.
? The Taxman waits, pen poised.
- "Fine. Every evening, then." {s1.fighttax}
  you: Fine. Every evening, then. Bring your clipboard.
  Taxman: I always do.
- "What does the Stillness want with steps?"
  you: What does a thing that sits still want with steps?
  Taxman: Steps nobody walks are steps nobody has to tax. Think how tidy that would be.
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
~ Halfway across, you look back. The booth is empty. The light inside it is blue.`,

// 5 Every Step a Stitch — Ironbridge
`@gorge-night
~ Ironbridge: where the modern world was hammered together. There's a museum, and a guide who stays late for you.
Guide (Museum guide): You're carrying Holloway's Count. Don't look so surprised. We've got his boots in the basement.
Guide (Museum guide): Abiah Holloway, ironmaster. Walked everywhere. Wouldn't ride a horse.
Guide (Museum guide): He said the country was a coat, and every step was a stitch. Stop walking, and it comes apart at the seams.
~ She holds the Count under a magnifying glass. On the back, tiny: EVERY STEP A STITCH.
Guide (Museum guide): There's a painting too. His walking party, 1724. Want to see?
~ It's a dark little oil painting. Five walkers on a hill. Holloway in the middle, in a three-cornered hat.
~ And at the edge, holding a lantern, a woman with a shawl over her head.
mate: {you}. That's Morwenna.
you: It can't be. It's three hundred years old.
Guide (Museum guide): The painter wrote the names on the back. Let me see. "Mistress Morwenna Pascoe, of Land's End."
!glitch
~ The museum lights flicker. The air goes cold.
~ Every one of your phones lights up at once. Messages from home. Ones you forgot to answer. Weeks old.
boss:leftonread: ...seen.
~ Wisp drifts down the gorge, quiet as a held breath. It doesn't attack. It just watches you read them.
? Wisp is waiting.
- Answer the messages {s1.answered}
  ~ You answer them. All of them. "Sorry, been walking." "Yes, still alive." "Love you too."
  ~ Wisp looks almost disappointed. It thins out like breath on a window.
- Put the phone away
  ~ You put the phone away. Wisp drifts closer. Cold settles in your fingers, the way guilt does.
  boss:leftonread: ...typing...
  ~ Nobody's typing.
~ When the cold lifts, the guide is turning the painting over again.
Guide (Museum guide): Funny. There's a date under her name. Just the one. 1724.
Guide (Museum guide): Usually you'd write two. Born, and died.`,

// 6 The Right to Roam — Kinder Scout
`@plateau-wind
~ In 1932, four hundred walkers climbed Kinder Scout because they'd been told they weren't allowed.
~ Some of them went to prison for it. The moors are open now because they did.
mate: Bit windy for a protest.
~ The plateau doesn't care about history. The wind up here is enormous. And in the middle of it, spinning, is Gale.
boss:scroll: Just one more. Just one more. Just one more.
~ Gale is the endless scroll, made into weather. It never stops, so nothing near it can either.
~ It pulls at your sleeves, your hoods, your attention. It wants you going round and round, not forward.
!shake
? Gale is dragging {mate} towards the edge!
- Grab their hand {s1.held}
  ~ You grab {mate}'s hand. Someone grabs yours. Nobody lets go.
- Shout a rhythm
  you: Left! Left! Left, right, left!
  ~ It's daft. It works. Gale can't scroll you if you're marching.
~ You lean into it together, shoulder to shoulder, and nobody goes over the edge, because nobody lets go.
~ When it finally passes, the Count is ticking so loudly you can hear it over your own breathing.
~ Halfway across the bog you find a small brass plaque for the trespassers. Someone has pinned a fresh flower to it.
mate: Fresh. Like, today fresh.
~ Under the plaque, scratched into the gritstone, are names. Squads, with dates. 1724. 1802. 1874. 1911. 1951. 1971.
~ The newest line is only half done. One letter, and then the scratches just stop.
you: Someone was carving that when...
mate: When what?
~ Nobody finishes that sentence either.
~ You scratch your own names in, all of you, quickly. You make very sure to finish.`,

// 7 Twenty-Four Arches — Ribblehead
`@viaduct-night
~ A steam train crosses Ribblehead Viaduct as you reach it, all twenty-four arches lit by the firebox.
~ Under the middle arch, a navvy in a flat cap sits on a sleeper, smoking a pipe that isn't lit.
Navvy: Evening. Don't mind me. I've been dead since 1874.
mate: You're very relaxed about it.
Navvy: You get used to it. First hundred years are the worst.
Navvy: I carried that once. Morwenna sent us. Six of us, from Penzance.
you: What happened?
Navvy: We sat down. Right here. Five minutes, out of the wind, for a breather.
Navvy: There was a pub fire down in the valley, and the light from it was lovely, and we just... watched it.
Navvy: It used to be the fire in the pub. Then the wireless. Then the telly. Now it's in your pocket.
Navvy: Same glow. Same thing looking out of it.
~ He taps the Count with a cold finger. It skips a beat.
Navvy: Someone's after that. Big lad. Blue. Carries a club. Calls himself Grimm. Where he comes from, they call him the Algorithm.
Navvy: He doesn't want it broken. He wants it switched off.
Navvy: A country that never gets up is a country that never looks away. He decides what everyone sees. He likes it like that.
? Ask him something.
- "Did Morwenna know you'd stop?" {s1.asked}
  Navvy: Did she know? She's been sending squads up this road for three hundred years.
  Navvy: Some get there. Some don't. Her light stays on either way.
  ~ He says it like he's said it before, to himself, a lot.
- "Can we help you?"
  Navvy: You can keep moving. That's the help.
  Navvy: Every squad that gets there, a few of us get to stand up for a bit.
- "Why are you still here?"
  Navvy: Because I stopped. The Stillness keeps what stops. Keeps it nice and fresh.
~ The train whistles. The navvy stands, slowly, and stretches like a man with a hundred and fifty years of cramp.
Navvy: Keep it moving.
~ And he's gone, and so is the train, and the arches are dark.
~ In the dust where he sat is the shape of six people, sitting very close together.`,

// 8 Above the Clouds — Scafell Pike
`@peak-cloud
~ Scafell Pike, the highest point in England. You see none of it. You're in cloud from the first cairn to the top.
~ In the summit shelter: three walkers in their eighties, with flasks. The Summit Committee.
Margaret: Tea? We've climbed it every winter since 1971.
mate: Every winter? That's amazing.
Margaret: It's compulsory, dear. We carried the Count in '71. We made it. Thirteen weeks, John o' Groats, chimes and everything.
Margaret: Nobody tells you the bit after.
you: What's the bit after?
Margaret: You can't really stop. Not properly. Not ever. The Count gets into your legs.
Margaret: If we sit still more than a week or two, we start to go a bit... see-through.
~ You look closer. You can see the cairn through her left hand.
Margaret: Gerald stopped in '98. Lovely man. You can still make him out on a clear day.
mate: That's horrible.
Margaret: It's not so bad. Better than the alternative. Biscuit?
~ She reads the Count like a fuel gauge.
Margaret: Six hundred miles. Not bad. The hard part's north of the Wall.
~ She hands you a hand-drawn map of Scotland. The margin notes say: Bothy here. Midges here. Do not trust the ferry timetable.
~ And one more note, underlined twice: Ask the keeper's sister what the light is for.
? What do you ask?
- "What's wrong with the light?" {s1.warned}
  Margaret: Ask her sister. We did, in '71. Didn't like the answer.
  Margaret: Walked it anyway. You will too. That's the trouble with good people.
- "Is it worth it?"
  Margaret: We're eighty-six and we've got calves like hams. Yes, it's worth it.
  Margaret: Mostly.
~ On the way down, the cloud breaks for one minute and you can see all the way to the sea.
~ Behind you, three small figures are already climbing back up.`,

// 9 The Wall — Hadrian's Wall
`@wall-dusk
~ Hadrian's Wall runs coast to coast. A man dressed as a Roman centurion insists on checking your papers.
Centurion: Halt! Business north of the Wall?
~ You show him the Count. He goes pale under the helmet.
Centurion: Then you'd better hurry. There were marks on the stones this morning. Big ones. Like a club.
Centurion: I'm not really a centurion. I'm a re-enactor from Hexham. But I know a club mark when I see one.
~ Further along, a whole section of wall has been knocked flat. Scratched into the turf, in big blue capitals, one word.
!flash
~ STOP.
mate: Grimm.
~ The capitals are oddly neat. Old-fashioned. Like someone who learned to write with a quill.
Centurion: There's something else. Walkers have carved names in these stones for centuries. Come and look.
~ Squads. Dates. And one name, cut deep, then crossed out so hard the stone cracked.
~ MORWENNA PASCOE. 1724.
~ Under it, smaller, in the same neat capitals: SHE SAT DOWN.
? You...
- Defend her {s1.defend}
  you: Everyone stops sometimes. That doesn't make her a monster.
  Centurion: Didn't say it did. Just saying somebody was very cross about it.
- Say nothing
  ~ You say nothing. {mate} says nothing. The wind says quite a lot.
- Photograph it for later
  ~ You take a photo. When you check it, the stone in the picture is blank.
  ~ The Count ticks, disapproving.
~ You go over the rubble single file, holding the Count between you.
~ On the far side, the wind smells of heather. Behind you, something big is walking along the Wall, keeping pace.
boss:algorithm: STOP.
~ You don't.`,

// 10 The Ambush — Arthur's Seat
`@city-night
~ Edinburgh is built on stairs. You climb every one of them on the way up Arthur's Seat.
~ At the top, the fog rolls in off the Forth, thick and sudden. Two shapes are waiting in it.
~ One is huge and blue and carrying a club. The other is holding a clipboard.
Taxman: Ah. Punctual. I do like that in a victim.
boss:algorithm: ...
Taxman: A partnership. He switches it off. I tax what's left. Everyone wins. Mostly me.
mate: You said you worked for the Stillness.
Taxman: Everyone does, eventually. I just got there early and asked for a pension.
!shake
~ It's a short, ugly fight in the fog. Grimm swings slow. The Taxman writes things down.
? {mate} has slipped and fallen behind!
- Go back for them {s1.goback}
  ~ You go back. It costs you ground. Grimm's club misses you by a whisker.
  ~ And the moment you're all together again, the Count surges. Hot. Bright.
- Hold the line and shout
  you: {mate}! Up here! With us!
  ~ {mate} scrambles up. The moment you're all together, the Count surges.
!flash
~ That's when you get it. It's never been counting steps. It's counting how many of you keep going together.
~ Grimm steps back out of the light. So does the Taxman, dabbing at his sleeve where the glow singed it.
Taxman: Interesting. Holloway always said that bit was the trick.
you: You knew him?
Taxman: I've read his file. Lovely penmanship. Very neat capitals.
Taxman: A little tip, free of charge, which is unlike me. Your keeper never told you about the others, did she?
Taxman: Ask yourself why she needs a new squad every single winter.
~ When the fog clears, Edinburgh is all lights. Every one of them blue.`,

// 11 The Dark Glen — Glencoe
`@glen-snow
~ Glencoe in winter is the most beautiful place you have ever been. You would like to leave it immediately.
~ Snow on the Buachaille. Wind down the glen. And high on the ridge, for a few seconds, something with wings.
!flash
~ A long ribbon of orange fire lights up the whole valley.
boss:dragon: Every hour you gave me, I kept.
mate: That's Vex. That's the last one. That's the end of the list.
~ Vex sleeps on a hoard. Not gold. Hours. Every hour anyone ever lost to the glow.
~ It doesn't come down. It doesn't need to. It just wanted you to see how big the hoard is.
@bothy
~ You shelter in a bothy with a stove and a visitors' book three hundred years thick.
~ Every entry has the same little drawing in the corner. The Long Count.
~ Walkers who made it. Walkers who didn't. You turn back and back, to the very first page.
~ 1724. The handwriting is shaky, as if written with frozen hands.
Morwenna (Morwenna, 1724): I sat down. Only for a moment. The fire was warm and Abiah went on without me.
Morwenna (Morwenna, 1724): Something came out of the fire and sat beside me and offered me a bargain.
Morwenna (Morwenna, 1724): I may keep a light at Land's End, for as long as a squad walks each winter.
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
~ Outside the snow keeps falling, and somewhere above the glen, Vex settles back on its hoard to wait.`,

// 12 Something in the Loch — Loch Ness
`@loch-dark
~ Loch Ness is deep and black and very still. And then it isn't.
Local (Man from the visitor centre): That's not Nessie. Nessie's a lovely girl. She'd never.
Local (Man from the visitor centre): That's her cousin. From somewhere much deeper.
~ The Kraken comes up under the ruins of Urquhart Castle. Its eyes are the colour of a phone at 3am.
boss:kraken: Down here it's always three in the morning. Come down. Just for a look.
!shake
~ A tentacle whips out and takes the Count right out of your hands.
!dark
~ For one long, awful minute, it's gone. Ticking somewhere under the black water.
mate: It's sinking!
? The Count is going under.
- Dive in {s1.dove}
  you: Together. Now!
- Grab {mate} and jump
  ~ You grab {mate}'s hand. {mate} grabs the next hand. You all go in at once.
@deep
~ The water is cold enough to stop your heart. And it's full of light.
~ Down here are thousands of faces, lit blue, drifting. Eyes open. Thumbs moving. Not drowning. Scrolling.
~ This is the bottom of the feed. This is where the Kraken lives.
boss:kraken: Stay. Everyone stays eventually.
~ But the Kraken has never had a whole squad come in after it before. It doesn't know what to do with you.
~ Out of pure surprise, it lets go.
@loch-dark
~ You come up gasping on the shingle, all of you, and the Count comes up with you, glowing brighter than it ever has.
Local (Man from the visitor centre): I'll put the kettle on, will I?
~ In the dark water behind you, the blue faces sink slowly out of sight.
~ One of them, you'd swear, was wearing an anorak from 1951.`,

// 13 The End of the Road — John o' Groats
`@signpost-dawn
~ John o' Groats is a signpost, a car park and the wind. It is the best place in the world.
~ A woman is waiting under the sign in a waxed jacket and a tartan scarf. She has Morwenna's eyes.
Ishbel: You'll be the squad. I'm Ishbel. Her sister. I keep this end.
Ishbel: Give it here, then. Let's hear it.
~ She opens the back of the Count with a tiny key. It chimes. Once for every week you walked.
~ Thirteen times, loud enough to hear in Cornwall.
@town-glow
~ All over the country, people put their phones down and go outside. Not for ever. Just for a walk.
~ The blue in the windows goes out, street by street, like someone walking through a house switching off lamps.
@signpost-dawn
if s1.betrayed
  you: Did you know? About her bargain?
  Ishbel: Know? I was there. I kept walking. She didn't. We've not spoken since.
else
  you: Morwenna wrote in the bothy book. In 1724.
  Ishbel: Aye. I was there. I kept walking. She didn't. We've not spoken since.
Ishbel: Every winter she sends a squad. Some get here. Some end up on the Wall, or the moor, or the services at Stoke.
mate: The 1951 lot?
Ishbel: Still at the services. Table by the window. The telly's still on.
Ishbel: Her light stays on either way. You worked that out. Good.
Ishbel: Here's what you haven't. It isn't only her light. Something looks out through it.
~ A van pulls into the car park. The Taxman hands Ishbel an invoice for the chimes, and an envelope for Morwenna.
Taxman: Account renewed. One more winter. Do pass on my regards.
Ishbel: Pass them on yourself, Edwin.
~ He flinches, very slightly, at the name.
~ Ishbel closes the Count and holds it out. The needle has swung round. North and east. Out to sea.
? Ishbel offers you the Count.
- Take it {s1.took}
  ~ You take it. It's warm. It's always warm.
  if s1.warned
    ~ You think of the Summit Committee's note. You take it anyway. Of course you do.
- "What if we say no?"
  Ishbel: Then it sits on my mantelpiece. And next winter she sends someone else.
  ~ You take it.
Ishbel: Next time, further. There's a lot more coat than Britain, and he never finished the stitching.
Ishbel: Grimm's gone quiet. That's not good news. That's him thinking.
~ Far away in Cornwall, the lighthouse beam goes round once, and for a moment it isn't white at all.`,
];

// ---------- SEASON 2: The Northern Line (Lindesnes to Nordkapp) ----------
const S2 = [
// 1 Over the Water — Lindesnes
`@sea-storm
~ Ishbel finds you a boat called the Grace II. It smells of diesel and herring.
Donnie: North Sea in February? Fine, mostly.
~ It is not fine. It is not fine for two days.
mate: I've been sick in three different directions.
@lighthouse-night
~ On the third morning a lighthouse comes out of the dark. Lindesnes: the bottom corner of Norway.
~ The keeper is on the rocks with a lantern. She looks at the Count like an old friend who owes her a tenner.
Solveig: The last one came through in 1731. Englishman. Wouldn't get on a horse. I have it in the book.
~ She does have it in the book. Brown ink: "A walker with a brass thing. Going north. Seemed cheerful."
Solveig: And this. 1911. "Five walkers with the brass thing. One of them carried the purse."
Solveig: He had a little moustache and asked if the lighthouse was VAT registered.
mate: Is that...?
Solveig: I don't know. They never came back down.
~ It's minus eight. Everything you own is stiff with frost: boots, laces, fingers, plans.
Solveig: In the cold, everything takes twice as long. Decide where you stand before you set off. Not after.
? Solveig asks about Morwenna.
- "She's... complicated." {s2.complicated}
  Solveig: Keepers usually are. We all made a deal of some kind. Mine was cheaper.
  mate: What was yours?
  Solveig: I sleep through the longest day, every year. Ask me about it in June.
- "She lied to us."
  Solveig: She told you to walk. Was that a lie?
- "What's in her light?"
  Solveig: The same as in all of ours. A little blue. Just a little. Enough to see by.
~ Down on the quay, someone is unfolding a customs form. It's very long. It's very cold. He doesn't seem to feel it.`,

// 2 The Pulpit — Preikestolen
`@fjord-ice
~ Preikestolen: a flat slab of rock sticking out over Lysefjord, six hundred metres up, like the mountain stopped mid-sentence.
~ In summer there are queues for the photo. In February there's ice. And you.
~ Halfway up, behind you: a soft, frozen crunch. Then another.
boss:notification: bzzZT. bzzzZZT. You have... four hundred unread...
mate: Brett stowed away on the boat!
~ The cold has turned him into something like a slush puppy. He is furious about it.
~ He comes at you on the ledge, skidding, and nobody can get out of anybody's way.
? It's chaos on the ice!
- Everyone hold your places {s2.held}
  you: Stop shuffling! Hold where you are!
  ~ You stop dodging and plant your feet. Brett skids straight past and lands in a snowdrift with a noise like a dropped trifle.
- Swap places with {mate}
  ~ You try. In the frost it takes for ever. Brett slimes you both mid-swap with a frozen BZZT.
  mate: Lesson learned. Plan first.
~ The frost doesn't care how fast you are. It cares whether you planned.
~ At the top, the cloud rolls off the fjord. Black water, white walls, all of it.
~ Someone takes a photo. It's terrible: a row of red faces and a blur that might be Brett. It goes on the fridge anyway.
~ Later you zoom in on the blur. Behind Brett, far down the path, someone is standing very still in the snow.
~ A man in an old-fashioned overcoat. Holding a ledger.
~ When you look down the path for real, there's nobody there.`,

// 3 Two Hundred Days of Rain — Bergen
`@harbour
~ Bergen gets rain more than two hundred days a year. Today it's sleet. The locals call this a nice change.
~ The old wharf at Bryggen: leaning wooden warehouses, propping each other up like the end of a good night.
Clerk (Shipping clerk): This office has been open since the Hanseatic merchants. Here. 1731.
~ Under Holloway's name, in the payment column, someone has written: Steps. Many.
@office
~ Next door, the Taxman has rented an office by the month. The sign says: Office for the Registration of Foreign Walking.
Taxman: You are importing a pedometer. And, I'd argue, a quantity of steps. Form B12. In triplicate. In Norwegian.
mate: We met you in Bristol.
Taxman: I've no recollection of Bristol. Bristol has no recollection of me. It's a very good arrangement.
~ On the shelf behind him are ledgers going back decades. One spine is older than the rest. 1911.
? While he's busy stamping...
- Read the 1911 ledger {s2.ledger}
  ~ You slide it out. One page. Five names in a column, in a careful clerk's hand.
  ~ Four have a line through them. The fifth is the signature at the bottom: E. TALLY, TREASURER.
  ~ The Taxman looks up. You put it back. He goes back to stamping, a little slower.
- "Ishbel called you Edwin."
  Taxman: Ishbel calls a lot of people a lot of things. Form B12. Sign there.
- Leave quietly
  ~ You leave quietly. He doesn't look up. He doesn't need to. He's already written down that you left.
@harbour
~ You take the stairs up Mount Fløyen instead of the funicular, partly for the view and partly because he's standing next to the funicular.
~ From the top, Bergen is all lights and rain. The Count ticks on, steady, like it's never been rained on in its life.
mate: Five names. Four crossed out.
you: What happens when you get crossed out?
~ Below you, a lot of windows are glowing blue. Some of them have been for a very long time.`,

// 4 The Navvy Road — Flåm
`@forest-mist
~ The Flåm Railway climbs nearly nine hundred metres in twenty kilometres. You aren't on it.
~ You're on the old navvy road beside it, which the railway builders walked up and down for years.
~ There's no phone signal. For the first hour this feels like an emergency.
~ By the second hour nobody mentions it. By the third, {mate} is telling a story they've been saving for fifteen years.
mate: ...and that's why I'm not allowed back in Weston-super-Mare.
~ It's the best thing you've heard all week.
!dark
~ Wisp finds you by the tunnels. The cold comes with it.
boss:leftonread: ...seen.
~ It tries what it tried at Ironbridge. The guilt. The unanswered messages.
~ But there's no signal. Nothing buzzes. You're all just here, together, in the snow.
? Wisp hovers in the tunnel mouth, confused.
- Say hello to it {s2.hello}
  you: Hello, Wisp.
  ~ It flinches like nobody has spoken to it in a very long time.
- Wave it off
  ~ You wave. It doesn't go. It just watches, like someone at a window.
boss:leftonread: ...wait...
mate: Did it just talk?
boss:leftonread: ...wait for me...
!light
~ Then it fades into the tunnel and the cold goes with it.
~ At the top, at Myrdal, a man in a railway jacket gets you all a coffee without asking.
Local (Railway man): Lots of walkers come through. Not in February. Not usually with one of those.
Local (Railway man): The ghost in the tunnel? Been there years. Always says the same thing. We just say sorry and keep walking.`,

// 5 Pull Up the Ladder — Geirangerfjord
`@fjord-ice
~ Geirangerfjord in winter. The cruise ships have gone. The Seven Sisters waterfalls have frozen into seven long white beards.
~ High above the water, on a shelf of rock, is an old farm called Skageflå. A ranger tells you the story.
Ranger: The path up was so steep the last bit needed a ladder.
Ranger: When the tax collector came round, the family pulled the ladder up.
~ You look at each other. You look down at the jetty.
~ A small figure with a clipboard is shouting up at the cliff.
Taxman: This is a formal notice of assessment! I can see you!
? There's a rope on the steep bit of the path.
- Pull up the rope {s2.rope}
  ~ You pull it up. It's the best afternoon of the season.
  Taxman: I'll be adding this to your file!
  mate: We'd be disappointed if you didn't.
- Leave it down. Let him climb.
  ~ You leave it. He looks at the rope. He looks at his shoes. He doesn't climb.
  ~ For a second he looks like a man who used to be good at this.
!shake
~ On the way down, Rory finds you. Bright orange against all that white.
boss:autoplay: Are you still watching? Are you STILL watching?
~ It coughs a spore cloud that freezes in the air and comes down like glitter. It still stings.
~ Where the glitter lands, you feel the pull to sit down in the snow. Just for one more.
mate: Don't sit down. Don't any of you sit down.
~ You fight it on the shore, carefully, one step at a time, frozen falls behind you, until Rory backs off into the trees.
Ranger: The farm family? Long gone. Moved down to the town in the end.
Ranger: Funny thing. They pulled that ladder up for two hundred years and nobody ever called them lazy.`,

// 6 The Troll Road — Trollstigen
`@glen-snow
~ Trollstigen is a mountain road with eleven hairpin bends. It's shut all winter. You walk up it anyway, on snowshoes.
~ The road signs warn about trolls. You hope that's a joke.
!shake
~ Halfway up, boulders start coming down. Not falling. Thrown.
~ On the ridge above is a big blue shape with a club.
boss:algorithm: STOP.
mate: For once the old stories and the real thing are the same. A troll on the mountain.
~ Grimm doesn't come down. He doesn't need to. The cold does his work for him.
~ Every time someone tries to dodge, their boots skate, and swapping places takes an age.
? Boulders incoming!
- Go up in a line, no swapping {s2.line}
  ~ You go up in the order you started, and you don't change it, and every boulder misses.
- Scatter!
  ~ You scatter. Everyone skids. It takes ten minutes to get back in order, and Grimm gets three good throws in.
  ~ Lesson learned, painfully: decide where you stand before you set off.
~ At the top there's a viewing platform hanging out over nothing.
~ On the rail, scratched in the frost, is the word from Hadrian's Wall, in the same neat capitals: STOP.
~ Underneath, in a different hand: NO.
~ Next to the NO, tiny initials. E.T. And a date. 1911.
you: E.T....
mate: Edwin Tally. The Taxman wrote NO at Grimm. In 1911.
you: So whose side was he on?
~ The wind takes the frost off the rail while you watch, and both words go with it.`,

// 7 Pilgrims — Trondheim
`@city-night
~ For a thousand years pilgrims walked to Trondheim, to the tomb of St Olav. The paths are still marked.
Trond: Pilgrim passports! Stamp, stamp. And the backs of your hands. Stamp.
Trond: For the ones who walk without a reason. They're my favourite. They tend to find one.
~ The Taxman has come too. He has a plan to charge pilgrim dues, backdated to 1031.
Taxman: With interest, that comes to roughly the economy of Belgium.
~ Trond listens to all of it, nods, and hands him a pilgrim passport.
Trond: Walk to the next church and I'll stamp it.
~ The Taxman looks at the passport for a long time.
? Say something to him?
- "You used to walk, didn't you?" {s2.kind}
  you: You used to walk. Didn't you? In 1911.
  Taxman: In 1911 I was a treasurer. Treasurers carry the purse, not the pedometer.
  Taxman: We walked from Lindesnes. Thirteen weeks. It was very cold. Mabel sang the whole way. Badly.
  ~ He stops, like he's said far too much.
- "Go on. One church."
  Taxman: One church is how it starts. Then it's two. Then you're at Nordkapp in a blizzard with four people who trusted you.
  ~ He stops, like he's said far too much.
- Say nothing
  ~ You say nothing. Trond says nothing. Pilgrims are good at silences.
~ Then he puts the passport in his inside pocket and leaves.
~ That night the frost lifts for a few hours and everything turns to slush. Slush, it turns out, is worse.
~ The Count doesn't mind. It's halfway up Norway and ticking like it knows something.
mate: Four people who trusted him.
you: Four names crossed out.`,

// 8 The Hole in the Mountain — Torghatten
`@rock-arch
~ Torghatten is a mountain with a hole straight through it. A troll fired an arrow at a girl, a king threw his hat in the way, and the hat turned to stone.
~ The geologists have a different explanation. It's less fun.
~ You walk into the hole. Wind comes with you. Then a lot more wind. Then Gale.
boss:scroll: Just one more. Just one more. Just one more. Just one m—
mate: It's using the hole like a straw!
~ Inside a mountain there's nowhere to be blown to. Gale howls and shoves and gets nowhere.
~ The frost has your boots stuck fast. You've stopped trying to move. You just hold your rows and hit back.
? Gale is spinning itself dizzy.
- Count the hits out loud {s2.counted}
  ~ You count every hit together, out loud. Gale hates being counted. It loses its rhythm completely.
- Wait it out
  ~ You wait. Gale doesn't. Gale never does. Eventually it scrolls itself out the far side and into the sea.
~ Out the other side, the sun's out. Low and orange, over a sea full of islands.
~ It's the first warm light in weeks.
mate: Spring?
you: Don't jinx it.
~ On a rock at the mouth of the hole, someone has left five stones. Four in a row. One set a little apart.
~ They're old. Moss on the four. None at all on the one.`,

// 9 The Circle — Arctic Circle
`@snowfield
~ The Arctic Circle crosses Norway on a bare plateau called Saltfjellet.
~ There's a visitor centre, a globe on a pole, and hundreds of little stone cairns left by travellers.
~ You build one too. It isn't very good. {mate} puts a boiled sweet on top, which seems right.
@aurora
~ That night the sky goes green. The northern lights pour across it in great slow curtains.
~ The Count's glass glows the same colour. Nobody says anything for a long time.
~ Wisp is out there in the green light, keeping its distance. It doesn't attack. It watches the sky with you.
~ Like someone who didn't get invited, but came anyway.
? Wisp is close enough to talk to.
- Ask who it's waiting for {s2.askedwisp}
  you: Who are you waiting for?
  boss:leftonread: ...he said he'd come back...
  boss:leftonread: ...he said don't stop... so I didn't stop... and then I couldn't keep up...
- Offer it a boiled sweet
  ~ You hold one out. Wisp drifts closer, then stops, like it's forgotten how hands work.
- Leave it be
  ~ You leave it be. Some things just want company, not conversation.
~ When you look again, it's gone. The green fades. You're north of the Circle.
~ In the morning there's frost writing on the inside of the tent.
~ It says: TELL HIM I WAITED.
mate: Tell who?
~ The Count, in your hand, ticks once out of rhythm. Like a flinch.`,

// 10 The Maelstrom — Lofoten
`@harbour
~ Lofoten: a row of mountains standing in the sea. Red huts on stilts. Every rack hung with drying cod, like very bad bunting.
~ Between the islands runs the Moskstraumen. The original maelstrom.
mate: Kraken's a Norwegian word, isn't it?
~ It is. You hadn't thought about what that meant.
@sea-storm
!shake
~ The Kraken is home. It comes up through the whirlpool bigger than it ever looked in Loch Ness, and takes the ferry by the bow.
boss:kraken: You. Scotland. You owe me an apology.
mate: You nicked our pedometer!
boss:kraken: I BORROWED it. Down here everybody borrows. Nobody ever gives back.
? The Kraken wants an apology.
- Apologise {s2.sorry}
  you: Sorry. We shouldn't have jumped on your head.
  boss:kraken: ...
  boss:kraken: Nobody has ever said sorry to me. They just scroll past.
  ~ It's so surprised it nearly lets go. Nearly.
- Refuse
  you: Not a chance.
  boss:kraken: Then we do this the deep way.
~ You fight it on the heaving deck, everyone braced where they stand. Nobody can cross that deck quickly in the frost.
~ In the end it lets go, sulks and sinks.
Skipper: Seen worse.
~ He has not seen worse.
~ As the whirlpool closes, you see down it for a second. Blue light. Faces.
~ And four of them, together, in old wool coats, looking up.`,

// 11 Unknown Walkers — Tromsø
`@city-night
~ Tromsø: the gateway to the Arctic. Amundsen left from here, and Nansen, and a lot of men in beards.
~ There's a polar museum full of their sledges, and their mistakes.
~ In a case about expeditions that never came back, there's a photograph from 1911.
~ Five people in wool, on skis, in a line. The one in the middle holds something brass and round.
~ The caption: Unknown walkers. Destination not recorded.
mate: {you}. Look at the one on the end.
~ Little moustache. Ledger under one arm. Not a day younger than he is now.
!glitch
~ The thaw has started. Water runs under the snow in every street.
~ Outside the Arctic Cathedral, the Taxman and Grimm are arguing. Neither of them notices you.
Taxman: Stop it somewhere I can tax it. That was the arrangement.
boss:algorithm: STOP IT.
Taxman: Stopping isn't the same as keeping, you great blue—
boss:algorithm: YOU STOPPED.
~ The Taxman goes very quiet.
? Do you step in?
- Step in {s2.stepin}
  you: Leave him alone.
  ~ Both of them turn and look at you. It is not a nice feeling.
  Taxman: Kind. Misguided. But kind.
  ~ Grimm walks off down the hill. Each footprint he leaves is frosted in the shape of a STOP sign.
- Slip past
  ~ You slip past. Neither of them notices. Which, you realise later, is the scariest bit.
mate: They're falling out. That's good, right?
you: That's what people always say. Right before they make up.`,

// 12 The Carvings — Alta
`@snowfield
~ At Alta there are rock carvings six thousand years old: reindeer, boats, bears. And people. Lots of little people, walking in lines.
Maret: Everyone asks about this one.
~ A line of figures walking close together. One of them holds up something round.
Maret: We say it's the sun.
~ She looks at the Count.
Maret: People have always walked in lines. And somebody always carries the thing that keeps time.
Maret: And look. There's always one just here, standing apart. Holding something square.
mate: A ledger.
Maret: We've always called him the Counter. He never walks. He just counts the ones who do.
@midnight-sun
~ Up on the plateau the snow is going soft, and the light lasts until nearly midnight.
!flash
~ Vex comes out of it low and fast, breathing fire across the snowfield.
boss:dragon: I have six thousand years of your hours. I'd like six thousand more.
~ The snow becomes steam. The steam becomes fog. For a while it's like being back in Cornwall.
? Vex circles round for another pass!
- Stand together {s2.stood}
  ~ You stand together. The Count goes so hot it hurts. Vex veers off at the last moment, like it touched a stove.
- Dive into the snow
  ~ You dive. The fire passes over. When you come up, you're all steaming like puddings.
~ It's a long fight. When it's over, half the plateau has melted.
Local (Reindeer herder): Well. That's spring sorted, then.
~ Vex flies north, ahead of you. Towards the top of the map, where a folding table is waiting.`,

// 13 The Top of the Map — Nordkapp
`@road-night
~ Nordkapp: a cliff at the top of Europe with a steel globe on it. To reach it, you walk through a tunnel under the sea.
~ There used to be a toll on the tunnel. They scrapped it in 2012. The Taxman has brought it back, unofficially, with a folding table.
Taxman: Steps, please. Exact change.
~ You're too tired to argue. It's only steps, and he looks so pleased.
~ He counts them twice and writes you a receipt. Sticking out of his top pocket: the pilgrim passport. One stamp.
? This is your chance.
- "Tell us about 1911, Edwin." {s2.truth}
  ~ He puts his pen down. It's the first time you've ever seen him not holding it.
  Taxman: Nordkapp. Thirteenth week. A blizzard. Mabel said we should wait it out in the shelter. Just for the night.
  Taxman: Four of them sat down. I was standing up, counting the money, when it came out of the snow-glare.
  Taxman: It offered terms. I've always been good at terms.
  mate: What terms?
  Taxman: They stay, kept nice and warm. I go free, as long as I collect. A fifth of every walker's day, every evening, for as long as there are walkers.
  Taxman: They were good walkers. I was a better accountant.
  you: That's monstrous.
  Taxman: It's paperwork. Paperwork is how monstrous things get done politely.
- "Why do you still carry that passport?"
  Taxman: Sentimental value. I'm told I have some. It's in a drawer somewhere.
  Taxman: Four people sat down in a blizzard at the top of this cliff in 1911. I was standing up, counting the money.
  Taxman: I'm still counting.
@signpost-dawn
~ At the globe, at the very edge of the cliff, the Count chimes. Thirteen times, one for every week, out over the Barents Sea.
~ The Taxman flinches at every one. On the ninth, you'd swear he mouths a name.
~ The sun goes down late and pink and barely bothers. In a fortnight it won't set at all.
~ When the chimes stop, the needle has swung. Not north. There's no north left.
~ It points south and east. Inland, over the mountains, towards Sweden and the Gulf of Bothnia.
~ Ishbel sends a text. Nobody knew she had a phone.
Ishbel (Ishbel, by text): Further.
Ishbel (Ishbel, by text): Wear sun cream. And keep counting heads. Up there in summer, the numbers go funny.`,
];

// ---------- SEASON 3: Sun Over the Gulf (round the Gulf of Bothnia to Tallinn) ----------
const S3 = [
// 1 The Ore Line — Abisko
`@midnight-sun
~ From Nordkapp you take the bus to Narvik. That's cheating. But the Count only counts walking, so it doesn't count. It knows.
~ From Narvik you walk: up the old navvy road beside the iron-ore railway, over the mountains into Sweden.
~ Every hour a train goes by. Two kilometres of rust-red wagons.
~ Abisko: a research station, a hostel, and a lake that's still frozen in May.
Ingrid: I've measured the snow here every day for forty-one years. Hold still.
~ She measures you too, out of habit.
Ingrid: Fast. Noted.
~ It's eleven at night and broad daylight. Nobody's tired. Nobody can sleep, either.
~ The Count is ticking faster than it ever did in Britain. So is everything: the birds, the meltwater, your heart.
Ingrid: The sun does that up here. Everything has ten weeks to do a year's work. So everything hurries.
Ingrid: Whatever's following you will be quicker this summer. So will what you win for beating it.
~ She counts you, pencil tapping the air.
? Ingrid: How many of you are there?
- Count everyone properly {s3.counted}
  ~ You count. You get the right number. Ingrid frowns.
  Ingrid: I got one more.
- "All of us."
  Ingrid: That's not a number. I'll put down one more than I can see. Up here, it's usually right.
~ She writes it down, and underlines it.
mate: Why would there be one more?
Ingrid: White nights. Sometimes the light gets in the gaps between people.
~ That night nobody sleeps. Somebody swears they hear footsteps outside the hostel, keeping pace with nobody.`,

// 2 The Town That Moved — Kiruna
`@town-day
~ Kiruna is moving. The iron mine underneath has grown so big the ground is giving way.
~ So the whole town is being picked up and put down three kilometres east. In 2025 they moved the church in one piece, on a lorry, at walking pace.
~ You walk beside a yellow wooden house on its way to its new street. The owner's still in it, making coffee. She waves.
~ At the edge of the new town: the Taxman, with a sign. STAMP DUTY: MOVING HOUSE.
Taxman: You're changing address. That's a transaction.
~ A crowd of retired miners explains to him, at length, that the houses didn't ask to move.
~ He looks shaken. It's the first time you've seen anyone out-argue him.
? The miners look at you.
- Join in {s3.joined}
  you: And the house is walking. Walking's exempt. Section one.
  Taxman: There is no section one.
  mate: There is now.
- Watch
  ~ You watch. It's better than television. That's rather the point.
~ In the old town, the streets are fenced off and empty. Something wet and round is living in an abandoned shop.
boss:notification: BZT-BZT-BZT-BZT-BZT—
mate: He's faster! He's buzzing in double time!
~ Brett got here first. Everything's quicker up here. You see him off between the fences, in full sunshine, at ten past midnight.
~ Afterwards, in the dark shop window, you catch the squad's reflection.
~ You count it twice. There's one more of you in the glass than there is on the pavement.
~ A thin figure at the back. Old-fashioned coat. Too short in the sleeves.
~ You turn round. Nobody. Just the town, moving.`,

// 3 Midges — Jokkmokk
`@lake-mist
~ Jokkmokk is the heart of Sámi Sweden. Its winter market has run every February for over four hundred years.
~ Just south of town you cross the Arctic Circle again, southbound. It feels like going downhill.
~ It's nearly June. The midges have arrived. They come in clouds. They get in your ears.
!shake
boss:autoplay: Skip intro? Skip intro? SKIP INTRO?
~ Rory has caught up. It coughs a spore cloud, and the midges fly straight into it.
~ For one beautiful minute, the two problems cancel each other out.
~ Then they don't, and you have both.
? Midges AND spores!
- Slap and fight {s3.slap}
  ~ You fight Rory by a lake in the light that never ends, slapping your own necks between hits.
- Run for the lake
  ~ You run in up to your knees. The midges hate it. Rory hates it more. Orange things don't like cold water.
~ It's fast. Everything is fast. And you're getting better at fast.
@town-day
~ In the town museum there's a brass button in a case. English. Eighteenth century. Found on the old trading path.
~ The label says: Trader? Traveller?
~ The Count ticks louder near it. That's either very meaningful or the radiator.
mate: It's a kid's button. Look how small it is.
~ Then the glass case fogs up from the inside, as if someone in there just breathed on it.
~ In the fog, a fingertip writes: MINE.`,

// 4 The Church Town — Gammelstad
`@town-day
~ Gammelstad, outside Luleå: four hundred little red cottages round a stone church.
~ Nobody lived in them. Families who lived too far away to get home after Sunday service built them to sleep in.
Guide (Caretaker): Some walked thirty miles to church. Thirty there, thirty back.
Guide (Caretaker): I suppose you lot can imagine it.
~ The Taxman has written to the council claiming all four hundred cottages are second homes.
~ The council has written back. The letter is long and very polite and says no in nine different ways.
@bothy
~ You sleep in one of the cottages, all of you in one room, curtains pinned shut against the sun at two in the morning.
~ Someone snores. Someone laughs at the snoring until everyone's laughing.
!dark
~ Later, you wake. Something's wrong with the number of sleeping bags.
~ There's one more lump than there should be, by the door. Very still. Very cold. The air above it is frosting.
? You...
- Whisper "Hello?" {s3.hello}
  you: ...Hello?
  Kit (???): ...you didn't wait...
  ~ Then the lump is just a coat on the floor, and the coat is nobody's.
- Wake {mate}
  ~ You shake {mate} awake. By the time they sit up, the lump is just a coat on the floor. Nobody's coat.
- Pull the covers over your head
  ~ You pull the covers over your head, which is a perfectly reasonable thing to do.
  ~ In the morning there's a coat on the floor by the door. Nobody's coat.
!light
~ The window has condensation on the inside. Someone has written in it, with one finger.
~ WAIT FOR ME.
mate: OK. I'm officially scared.
~ On the windowsill, the Count ticks along. One beat slow, as if it's waiting too.`,

// 5 Two Clocks — Haparanda-Tornio
`@town-day
~ Haparanda is in Sweden. Tornio is in Finland. Really they're one town, with a river and a border down the middle.
~ Finland is an hour ahead. You can walk out of one shop and into the next and lose an hour on the way.
~ There's a golf course on the border. Tee off in one country and land in the other, an hour later.
Taxman: Walkers crossing here lose an hour. I would like to tax it.
mate: You can't tax an hour that doesn't exist.
Taxman: Watch me.
~ He raises his stamp.
!glitch
!dark
~ And then you're in it. The lost hour. Between the clocks.
~ Everything has stopped. Birds hang in the air. The river doesn't move. The Taxman's stamp hangs an inch above the paper.
~ Only the Count is still ticking. And only you lot are still moving.
~ No. Not only you.
~ A boy, maybe fifteen, in a brown coat too short in the sleeves. One brass button missing. Frosted all over, though it's June.
Kit (The boy): You can see me. In here, in between, you can see me.
Kit (The boy): I'm Kit. Kit Penhallow. I was Mr Holloway's apprentice. I carried the bag.
? Kit is staring at the Count.
- "What happened to you?" {s3.kitasked}
  Kit: We crossed the ice at night. Mr Holloway said never stop, whatever happens. The Count won't abide it.
  Kit: I went through. Only up to my knees. I shouted. Nobody turned round.
- "Come with us." {s3.kitinvited}
  Kit: I've been trying. You're very fast. Everyone's always very fast.
- Hold out the Count
  ~ Kit reaches for it. His fingers go straight through. He looks at his hand like it belongs to someone else.
Kit: Is he still out there? Mr Holloway? Did he finish?
!light
!flash
~ The hour ends. The birds move. The stamp comes down.
~ The Count ticks double time to catch up, and by evening it's as if the Taxman never stamped anything.
~ Kit is gone. On the riverbank where he stood, the grass is white with frost.
~ You've walked round the top of the Gulf of Bothnia. From here the coast runs south all the way to Helsinki. Light the whole way.`,

// 6 Nowhere Dark — Oulu
`@town-day
~ Oulu is a city of bicycles. People cycle here in minus thirty on studded tyres. In June they're unstoppable.
~ In the park, a man is practising for the Air Guitar World Championships. Alone. With total commitment.
~ You watch the whole solo. He nods at you. You nod back. A deal has been made.
!dark
~ Wisp hates it here. A ghost needs somewhere dark to fade into, and at the end of June there isn't anywhere.
boss:leftonread: ...seen... seen... seen...
~ You catch it at one in the morning in the park. It keeps vanishing, but there's no shadow to vanish into. You can still sort of see it.
~ And in the full light, you can see what it's made of.
~ Messages. Thousands of them, faint, layered like frost. "where are you." "are you coming." "please wait." "did you finish."
mate: {you}... they're all to the same person.
~ Every unanswered message is addressed to Mr Holloway.
? Wisp is cornered in the light.
- Call it Kit {s3.named}
  you: Kit?
  ~ Wisp stops. For a second the cold shape has a face. Fifteen. Freckled. Frightened.
  boss:leftonread (Kit): ...nobody says my name...
- Fight it
  ~ You fight it in the sunshine. It isn't much of a fight. It keeps looking past you, down the road, as if it's expecting someone.
!light
~ Afterwards it hangs about at the edge of the park, looking sorry for itself.
~ {mate} offers it a bit of sandwich. It doesn't take it. It doesn't leave, either.
mate: So Wisp is Kit. Or Kit is Wisp. Or Wisp is what happens to Kit if you leave him on read for three hundred years.
you: The Stillness keeps what stops.
mate: He didn't stop. He got left.
~ Nobody has anything to say to that.`,

// 7 Sand — Kalajoki
`@beach
~ Kalajoki has dunes and a long beach and the shallowest sea you've ever walked into.
~ You go in up to your knees and keep going for half a mile. Still only up to your knees.
!shake
~ Gale comes in off the sea in the afternoon and picks the dunes up. Sand in your eyes, sand in your teeth.
boss:scroll: Next! Next! Next! Next!
~ Sand in the Count, which grinds for an hour afterwards and makes everyone very nervous.
~ Gale is quicker in summer, like everything. Harder to keep up with. But so are you.
? Someone needs to keep the rhythm.
- You call it {s3.rhythm}
  you: In! Two! Three! Hit!
  ~ You call it like the cox in a rowing boat. You all hit on the count. It works.
- Let {mate} call it
  mate: In! Two! Three! Hit!
  ~ {mate} calls it like the cox in a rowing boat. You all hit on the count. It works.
~ Then something odd. A thin, cold shape is standing between Gale and the back of the squad.
~ Wisp. Just standing there in the sandstorm, taking the sand that was meant for you.
~ When Gale blows itself out, Wisp is gone again.
~ Afterwards you lie in the sand until midnight, which looks exactly like six o'clock.
~ {mate} gets sunburnt at eleven at night. A new achievement.
if s3.named
  ~ Written in the wet sand, already being smoothed away by the sea: THANK YOU FOR SAYING IT.
else
  ~ Written in the wet sand, already being smoothed away by the sea: MY NAME IS KIT.`,

// 8 Midsummer — Kvarken
`@midnight-sun
~ Kvarken: thousands of low rocky islands. The land here is rising out of the sea, nearly a centimetre a year.
~ The ice age pressed it down and it's still springing back. It's the only place you've been that's growing.
~ It's Midsummer. Juhannus. All of Finland goes to its summer cottages: bonfire, sauna, jump in the sea, repeat.
Local (Island grandmother): You, with the brass thing. Stay. There's sausage.
~ You stay.
~ Old custom: put seven flowers under your pillow on Midsummer night and you'll dream of who you'll marry.
~ {mate} puts seven flowers under the Count instead, as a joke.
!fade
@snowfield
!dark
~ That night you all dream the same dream.
~ Winter. Night. 1732. The Kvarken frozen solid. A line of walkers with lanterns, crossing the ice.
Holloway: Keep up! Don't stop! Whatever happens, the Count will not abide a stop!
~ At the back, a boy with a bag. The ice cracks. He goes in to the knees.
Kit (Kit, 1732): Mr Holloway! Wait! Wait for me!
~ Holloway's lantern pauses. Just for a moment. The Count in his hand goes cold.
~ He doesn't turn round. He walks on. The lantern gets smaller.
? In the dream, you're standing on the ice next to Kit.
- Turn back for him {s3.turned}
  ~ You turn back. You reach for his hand.
  ~ Your fingers close on frost. It's 1732. You can't change it. But you tried, and somehow the dream knows.
- Shout after Holloway
  you: HOLLOWAY! TURN ROUND!
  ~ The lantern doesn't stop. But for a second, a long way off, it shakes.
!fade
@midnight-sun
!light
~ You all wake at the same moment. The bonfire's out. Someone is crying and pretending not to be.
~ The Kraken was meant to be here. You see the tip of a tentacle out in the strait.
~ But the water's too shallow, and getting shallower every year, and in the end it gives up and goes back to Norway.
Local (Island grandmother): Something like that happens every Midsummer. More sausage?`,

// 9 The Lace Town — Old Rauma
`@town-day
~ Old Rauma: six hundred wooden houses, painted in colours with names like butter and sky.
~ People here speak a dialect so thick that other Finns can't follow it.
~ The Taxman has come to Finland to do some paperwork. This is a mistake. Finland is very good at paperwork.
Clerk (Town hall clerk): Complaint received. Processed. You are fined. Twice. Here is your receipt.
Taxman: This receipt is in... what is this?
Clerk (Town hall clerk): Rauma dialect.
Taxman: What does it say?
~ Nobody, including the clerk, will tell him.
? The Taxman looks genuinely lost.
- Help him read it {s3.helped}
  ~ You try. You can't. But he looks at you like nobody has tried to help him with anything since 1911.
  Taxman: ...Thank you. Don't tell anyone.
- Enjoy the moment
  ~ You enjoy the moment. You enjoy it a lot. {mate} takes a photo for the group chat.
~ In a shop window, a lacemaker is working a pattern with dozens of bobbins at once. All moving. None of them tangling.
~ You watch for ten minutes.
mate: That's us. Except we tangle.
Lacemaker: This pattern is three hundred years old. It has a gap in it. My grandmother said a thread was lost.
Lacemaker: Every lacemaker since has left the gap. You don't fill in somebody else's missing thread. You wait for it.
~ The Count ticks, once, very softly.`,

// 10 He Didn't Finish — Turku
`@river-dusk
~ Turku is Finland's oldest city. It was the capital until 1812, when the job went to Helsinki. Turku has never quite got over this.
~ In the cathedral archive there's a letter in English, dated 1732.
~ A visitor asks to sleep in the porch rather than take a room, because he must be off early.
~ It's signed A. Holloway. There's a second page.
Holloway (A. Holloway, 1732): Lost the boy Kit on the ice at Kvarken. I did not turn back.
Holloway (A. Holloway, 1732): The Count went cold in my hand when I paused. I told myself it would not let me.
Holloway (A. Holloway, 1732): That was a lie. It was my own legs that would not let me. They were afraid.
Holloway (A. Holloway, 1732): If anyone carries this after me: count your people, not your steps.
mate: Count your people.
you: That's why it counts how many of us walk together. He made it that way afterwards. Because of Kit.
!dark
~ Grimm is waiting by the river at the castle end, very still in the white night.
~ He doesn't attack. He looks at the Count. Then at you.
boss:algorithm: He didn't finish.
~ The first words you've ever heard from him that aren't STOP.
? Grimm is right there.
- "Who didn't?" {s3.who}
  you: Who didn't finish?
  boss:algorithm: ...
  ~ He looks at his own hand, round the club. Like it belongs to someone else.
- "Kit didn't. Because of Holloway."
  boss:algorithm: YES.
  ~ It comes out like a door slamming. Then, quieter: yes.
- Stay quiet
  ~ You stay quiet. The river moves. Grimm doesn't.
~ Then he walks off along the river, in no hurry at all.
~ His footprints in the dew are very neat. Evenly spaced. Like someone who learned to walk properly a long time ago, and then stopped.`,

// 11 The Southern Tip — Hanko
`@beach
~ Hanko: the southern tip of mainland Finland. Sandy beaches, wooden villas, smooth pink granite warm enough to lie on.
~ You lie on it.
mate: "He didn't finish." I can't stop thinking about it.
you: Holloway made the Count and walked it the length of Britain. What else was there to finish?
mate: Or he meant Kit. Or he meant himself.
? What do you think Grimm meant?
- He meant Holloway {s3.theory}
  you: He meant Holloway. It sounded... personal.
- He meant Kit
  you: He meant Kit. Somebody left behind.
- He meant us
  you: He meant us. That we won't finish either.
  mate: Thanks. Lovely. Very motivating.
!flash
~ Vex comes in over the sea at dusk. Except there's no dusk, so it comes in over the sea in broad daylight, looking slightly embarrassed.
boss:dragon: I don't usually do daytime.
~ The fire is real enough. The rocks get hot enough to fry an egg. {mate} tries it afterwards. It works.
~ In the fight you learn the thing about haste: it works both ways.
~ Vex is quicker. So is everything you win off it.
~ As it flies off, it drops something from its hoard. It clatters on the granite and lies there, smoking.
~ A little horn lantern, the old sort, scorched black. Burnt into the base: A.H.
mate: Holloway's lantern. The one from the dream. Vex has had it all this time.
~ In your pocket, the Count gets warm and stays warm all night.`,

// 12 Everyman's Right — Helsinki
`@harbour
~ Finland has a law called everyman's right. Anyone can walk almost anywhere, camp in the forest, pick berries, as long as they do no damage.
mate: The Kinder Scout lot would have loved Finland.
~ Helsinki has a sea fortress on six islands, a public sauna on the harbour, and a lot of quiet people who are delighted to see you.
~ You'd have to know them quite well to tell.
~ In Finland, everyone's taxable income is published once a year. Anyone can look anyone up.
~ {mate} looks up the Taxman.
mate: He has declared nothing. Not a penny. Ever.
mate: He's never earned anything. It's all been collected.
~ Nobody says anything. But in the sauna he goes very pink and leaves in a hurry.
~ That evening you sit on the harbour rocks watching the ferries head out to Tallinn.
~ The air goes cold. Wisp settles on the rock beside you, like someone who's walked a very long way.
if s3.named
  boss:leftonread (Kit): You said my name. In Oulu. Nobody's said it since 1732.
else
  boss:leftonread: ...wait... wait for me...
? Wisp is right beside you.
- "We're not leaving you behind." {s3.promise}
  you: We're going over the water tomorrow. We won't leave you behind. Not this time.
  boss:leftonread (Kit): Everybody leaves. It's what walking is.
  you: Then we'll come back. Every time. That's what walking is, too.
- Answer every message you've ever left
  ~ You get your phone out. You answer every unanswered message you've ever left. Your mum. Your dentist. That one from 2019.
  ~ Wisp gets visibly less cold.
- Just sit with it
  ~ You just sit with it. It's what nobody did for Kit. Sometimes that's all it takes.
~ Somebody asks what happens after Tallinn. Nobody knows.
~ The Count is pointing across the water, steady as anything.`,

// 13 Across the Water — Tallinn
`@harbour
~ The ferry to Tallinn takes two hours. You spend all of it on deck.
~ The Gulf of Finland is flat and blue. Helsinki gets smaller behind you.
~ At the rail, a little apart, is a thin boy in a brown coat. You can see the sea through him.
~ Nobody else on the ferry notices. The squad does. The squad counts heads now. Always.
Kit: Is this what it's like? Going somewhere with people who wait?
? Kit is watching the spires come up out of the sea.
- "Yes. This is what it's like." {s3.yes}
  you: Yes. This is what it's like.
  ~ Kit smiles. It's the first time. It makes him look about nine.
- "It's usually more arguing about snacks."
  mate: It's usually more arguing about snacks.
  ~ Kit laughs. It sounds like ice cracking, the good kind, in spring.
@city-night
~ Tallinn: church spires and a medieval wall with towers like chess pieces.
~ On top of the town hall is a weathervane shaped like an old soldier: Old Thomas, keeping watch since 1530.
~ You climb to the lookout on Toompea Hill, above the red roofs, and the Count chimes.
~ Thirteen chimes. People in the square look up.
~ On the thirteenth, Kit puts his hand on the Count. This time it doesn't go through.
Kit: He's not lost, you know. Mr Holloway. He's just stopped. I can feel him. South.
Kit: He's sitting somewhere warm. He's been sitting there a very long time. And he's so cold.
~ Then the shape thins, and goes, and the boy goes with it. Back into Wisp. Back into the Stillness. Still kept.
~ But not forgotten. That's different. That counts for something.
~ When the chimes stop, the needle swings round. South this time, and a little west. The glass goes the colour of honey.
Kadri (Woman from the amber shop): Ah. It wants to go the old way.
Kadri (Woman from the amber shop): The Amber Road. South to the Danube. People have walked it for two thousand years.
~ The nights are getting dark again. It's time to go.`,
];

// ---------- SEASON 4: The Amber Road (Tallinn to Vienna) ----------
const S4 = [
// 1 Honey Glass — Tallinn
`@amber-shop
~ The woman from the amber shop is called Kadri. Her family has sold amber in Tallinn for six generations.
~ She takes the Count into the back room, puts it under a lamp, and opens the case with a tool like a dentist's.
Kadri: Under the dial. A tiny empty socket. Something was in here.
Kadri: A bead. Amber, from the stain on the brass.
~ Next to the socket, scratched very small, as if with a pin: FOR K.
mate: K. Kit.
Kadri: Whoever made this walked the Amber Road. You don't put amber in a clock unless you went and got it.
Kadri: And you don't scratch a name next to it unless you're sorry.
~ She draws the road on a napkin: down the coast through Latvia and Lithuania, round to Gdańsk, across Poland, through a gap in the mountains, to the Danube.
Kadri: The Romans came north along it for amber. Everybody after them did too.
Kadri: Everything along the Baltic has a thick skin. The walls. The winters. The people.
Kadri: Your monsters will too. Don't wait for the lucky hit. Just hit them a lot.
? Kadri offers you something for the road.
- Accept graciously {s4.liquorice}
  ~ It's salty liquorice. It is the worst thing any of you has ever eaten.
  ~ You thank her with a straight face. That's a thick skin, right there.
- Ask what she charges
  Kadri: For the road? Nothing. For the liquorice? Also nothing. Nobody would pay for it.
  ~ She's right. It's the worst thing any of you has ever eaten.
~ As you leave, Kadri calls after you.
Kadri: The bead! If you find one, find it yourselves. Amber you buy doesn't count. Same as steps.
~ Behind the shop, very faintly, something heavy is walking along the old town wall. Slowly. Keeping pace.`,

// 2 Mud — Pärnu
`@beach
~ Pärnu, Estonia's summer capital: a long white beach, wooden villas, and a spa that has been covering people in hot mud since 1838.
~ Mostly for medical reasons.
~ You go in. The mud is warm and black and smells of the sea.
mate: It's like being hugged by Brett.
~ Everyone goes quiet. Because the mud in the next bath is moving.
boss:notification: bzzt. Ahh. bzzzt. Lovely.
~ Brett has had a spa day. He's thicker than ever. Glossy. Tough.
~ The hits that used to splatter him just bounce off.
? Brett is basically armour-plated now.
- One big hit, all at once
  ~ You all wind up for one enormous hit. It bounces off. {mate} bounces off too, into a mud bath.
  ~ Fine. Not like that, then.
- Lots of little hits {s4.steady}
  ~ You hit him again and again, steadily. No big moments. Just work.
~ It takes ages. It's the most boring fight of your lives. It works.
~ Brett slides off into the Baltic, sulking, buzzing quietly to himself.
~ The spa gives you a voucher for a free return visit. It gives Brett a bill.
~ It's the first time you've ever seen him look worried.
~ In the empty mud bath where he was, his outline is left in the mud. It isn't a blob.
~ It's people. Lots of people, sitting down, squashed together, each one looking at something in their hand.
mate: ...Was Brett somebody, once? Was he lots of somebodies?
~ The mud settles. The outline goes. Nobody wants to answer that.`,

// 3 The Sixth Hangar — Riga
`@city-night
~ Riga has more art nouveau buildings than anywhere: whole streets of stone faces, peacocks, and women with very serious hair.
~ The central market is in five old Zeppelin hangars and sells everything from smoked eel to wellies.
@office
~ In the sixth hangar, which doesn't exist, the Taxman has opened an office. It's very convincing. The queue is very long.
~ He's taxing anyone with a step counter. Hikers. Dog walkers. A woman pushing a pram.
Taxman: Ah. You. Skip the queue. I have a proposal.
Taxman: Sit down. One season. Just one. I'll hold your steps in trust, at a very reasonable rate.
Taxman: No Sunday fights. No evening fights. No blisters. You'd be amazed how restful it is.
mate: Like 1911 was restful?
Taxman: 1911 was a cash-flow problem. This is a savings plan.
? The Taxman slides a form across the desk. There's already a pen on it.
- Tear it up {s4.tore}
  ~ You tear it up. He sighs, takes out an identical form, and puts it in a drawer for later.
  Taxman: They always tear up the first one.
- Read the small print
  ~ The small print says the undersigned agrees to remain seated in perpetuity, or until further notice, whichever is longer.
  you: In perpetuity?
  Taxman: It's a figure of speech.
  you: It's in bold.
- Give him a present instead {s4.balsam}
  ~ You give him a bottle of Riga Black Balsam, a herbal liqueur that tastes like a hedge on fire.
  ~ He tries it while you watch. It's a long time before he says anything at all.
  Taxman: ...That's disgusting. Thank you.
@city-night
~ Outside, Riga's church spires have golden cockerels on top instead of crosses.
~ They're all pointing south in the wind. So is the Count.
~ Behind you, in the sixth hangar, the queue gets a little shorter and the waiting room gets a little fuller. Nobody in it is standing up.`,

// 4 The Hill of Crosses
`@hill-crosses
~ North of Šiauliai there's a small hill covered in crosses. More than a hundred thousand, wooden and iron, rosaries hung on rosaries.
~ There are so many that the wind makes them clink.
~ In Soviet times the authorities bulldozed it, more than once. Every time, people came back in the night and put the crosses up again.
~ Nobody organised it. People just kept coming back.
~ Wisp is here, quiet among the crosses. For once, it isn't trying anything.
~ It's a place full of people who were remembered. Even Wisp seems to know it's no place to make anyone feel forgotten.
if s3.promise
  boss:leftonread (Kit): You came back. You said you would. People don't, usually.
else
  boss:leftonread: ...they keep coming back here... why do people come back...
? What do you leave on the hill?
- A bootlace, tied in a bow {s4.lace}
  ~ You tie a bootlace round a little wooden cross at the edge. It isn't much. The point of the hill is that it doesn't have to be.
- Kit's name, scratched on a stone {s4.kitname}
  ~ You scratch KIT PENHALLOW, 1732 on a flat stone and wedge it among the crosses.
  ~ Wisp drifts over and stays beside it a long time.
- Nothing. Just stand there.
  ~ You stand there. Sometimes that's what you leave.
~ Wisp drifts off over the fields without a fight.
~ As it goes it says something, so quietly that only the Count hears it. The Count ticks twice.
mate: What did it say?
you: I think it said: he's close.`,

// 5 The Sun Stone — Palanga
`@amber-shop
~ Palanga's amber museum is in a palace by the sea, built by a count. No relation.
~ Thousands of pieces of amber. Some have insects in them: a spider caught mid-step forty million years ago, still halfway across.
mate: That's it. That's what the Stillness wants. Everyone caught mid-step, for ever.
~ The biggest piece is the Sun Stone. The curator won't let you near it, which is fair.
Curator: A bead for that socket? You won't find it in a shop. A bead like that, you find yourself.
Curator: Go to the beach after a storm.
@sea-storm
~ There's a storm that night.
@beach
~ At first light you're all on the beach with the old women and the fishermen, raking through the seaweed.
? It's been three hours. Fingers are numb.
- Keep looking {s4.kept}
  ~ You keep looking. Everyone keeps looking. That's the whole trick, it turns out.
- Take a break
  ~ You sit down on a rock for a minute. The Count goes cold in your pocket.
  ~ You stand up again quickly. Message received.
~ Then {mate} finds it. A bead of amber the size of a pea, with a tiny bubble trapped inside.
~ It fits. The Count ticks once, very loudly, then settles into a deeper sound, like a clock in a hallway.
~ The glass over the dial goes from honey to gold.
~ Hold the bead to the light and the bubble isn't a bubble. It's a tiny frost-flower. Six points. Perfect.
mate: Frost. In amber. In September.
you: For K.
~ Far away, in a field you can't see, something cold sits down in the grass and, for the first time in three hundred years, feels warm.`,

// 6 Witches' Hill — Curonian Spit
`@beach
~ The Curonian Spit: a strip of sand nearly a hundred kilometres long. The Baltic on one side, a lagoon on the other.
~ Its dunes have buried whole villages. They move a few metres a year and they don't stop for anything.
Local (Fisherman): The old villages are still under there. Church bells and all. On a windy night you can hear them.
Local (Fisherman): People who wouldn't move. So the sand moved instead.
@forest-mist
~ In the woods at Juodkrantė is Witches' Hill, full of wooden carvings: devils, witches, a dragon, a giant.
~ Gale is hiding among them. It's hard to spot a whirlwind in a wood full of carved monsters.
~ Right up until it starts throwing pine cones.
boss:scroll: Refresh! Refresh! Refresh!
~ Gale is tougher this season. Big hits that used to knock it sideways just make it wobble.
? How do you take it down?
- Keep at it, one after another {s4.steady}
  ~ You stop going for the big hit. One after another, all of you, until it's spun itself out on top of a dune.
- Hide behind the carved giant
  ~ The carved giant takes a pine cone to the face. You take the chance and all pile in together.
@beach
~ That evening in Nida you climb the great dune and look south.
~ The road can't go straight on from here, so it turns inland, the long way round. The Count doesn't mind a detour.
~ Halfway down the dune, the wind uncovers something. A wooden signpost, buried for two hundred years.
~ One arm points the way you're going. Carved into it, in neat capitals: STOP.
~ Exactly like the capitals on Hadrian's Wall.
mate: Grimm's been this way before. Centuries ago.
you: Grimm. Or whoever Grimm used to be.`,

// 7 The Lakes — Masurian Lakes
`@lake-mist
~ Masuria has two thousand lakes, joined by rivers and canals. In September it's quiet: mist on the water, swans, not much else.
~ You borrow kayaks for a day. That isn't walking. The Count refuses to tick the whole time. It is very clear about this.
mate: It's sulking.
you: It's principled.
~ Rory is living in the reeds. In the mist it looks like a very large orange heron. Until it stands up.
boss:autoplay: Because you watched "Sitting Down", you might like "Sitting Down 2".
~ Its hide is as thick as a boot now. The spore cloud rolls out across the lake.
? You're in kayaks and Rory's on the bank.
- Paddle for shore and fight on foot {s4.shore}
  ~ You fight it from the bank with your feet in the water. The Count starts ticking again, pleased.
- Splash it
  ~ You splash it. Orange things hate cold water. Rory backs into the reeds, dripping and furious.
~ That night, at a guesthouse by the lake, there's a letter waiting. The postmark is Penzance.
@lighthouse-night
Morwenna (Morwenna, by letter): I hear you found the boy. Kit. I remember him. He carried the bag and whistled.
Morwenna (Morwenna, by letter): I hear you know what I did. I won't defend it. I was cold, and the fire was warm, and I was nineteen.
Morwenna (Morwenna, by letter): Abiah is ahead of you, near the end of the amber. Please don't hate him more than you hate me.
Morwenna (Morwenna, by letter): And when you see him, ask him why he never came back for either of us.
@lake-mist
if s1.betrayed
  ~ You read it twice. You still don't know if you believe her. That's allowed.
else
  ~ You read it twice. Then you fold it up very small and keep it next to the Count.
~ Every village round here has a tree that's the oldest in Poland, and a man who'll tell you the others are lying.
~ You meet three of these men. All three trees are very old.`,

// 8 The Shipyard Gate — Gdańsk
`@harbour
~ Gdańsk: the amber capital of the world. Mariacka Street is lined with amber shops, under gargoyles that spit rainwater on the customers.
~ In 1980 the workers at the shipyard here put down their tools. All together. It changed the country, then a lot more than the country.
Guide (Museum guide): One person stopping doesn't do much. A lot of people doing the same thing at the same time can do almost anything.
mate: Same with walking.
Guide (Museum guide): Same with anything.
!shake
~ Grimm is waiting at the gate. Something about him is harder now. Rougher. Like old bark.
boss:algorithm: STOP.
~ He swings. You hit back. Nothing seems to go in.
? Grimm's hide is like iron.
- Stop looking for the perfect hit {s4.together}
  ~ You stop looking for the perfect hit. You just keep going, all of you, together, until he steps back.
- Ask him a question mid-fight
  you: Why do you always write in capitals?!
  ~ Grimm stops mid-swing. For one second he looks embarrassed.
  boss:algorithm: ...Penmanship.
  ~ Then he swings again, harder. But you all keep going until he steps back.
~ As he goes, a scrap of paper falls out of a crack in his bark. Old paper. Very neat handwriting.
~ It's a list. Kit Penhallow. Morwenna Pascoe. Ishbel Pascoe. A few others. Each name with a tick.
~ At the bottom: "All accounted for. All left."
mate: That's a register. Like a teacher's.
you: Holloway's register. Why would Grimm have Holloway's register?
~ Down by the river, the Taxman had been planning an Amber Duty.
~ A woman from the amber guild holds up a Latin document with a wax seal. He reads it twice. Then he goes away.`,

// 9 Three Hundred and Sixty — Toruń
`@town-day
~ Toruń: a red-brick medieval town with a leaning tower and a gingerbread museum where you're allowed to make your own.
~ {mate} makes a gingerbread Count. Someone else eats it. There's a short trial.
~ Copernicus was born here: the man who worked out that the Earth goes round the sun.
@desert-night
~ The guide at the planetarium, a young man called Paweł, looks at the Count for a long time. Then he asks to borrow it.
Pawel: Round the rim of the dial. Too fine to see unless you know. A ring of tiny marks.
Pawel: Three hundred and sixty of them. That's not a clock face. That's the world. Degrees of longitude.
Pawel: You've lit up about twenty of them since Cornwall.
~ Nobody says the obvious thing out loud. Three hundred and sixty is a lot of degrees.
? {mate} gets out a napkin to do the maths.
- Let them {s4.maths}
  ~ {mate} does the maths. Then folds the napkin up very small and puts it away.
  you: How long?
  mate: You don't want to know.
  you: How long?
  mate: Roughly the rest of our lives. If we're lucky and nobody sits down.
- Take the napkin away
  you: No. No maths. Maths is how the Taxman gets you.
  ~ Everyone agrees this is wise. Everyone is now doing the maths in their heads anyway.
Pawel: The world is round. If you walk east long enough...
you: You come home.
Pawel: You come home from the other side. Which isn't the same as coming back.
~ He hands the Count back. Then, more quietly:
Pawel: There's something at the very last mark. Number three hundred and sixty. It isn't a line. It's a tiny lighthouse.`,

// 10 Calisia — Kalisz
`@fields-dusk
~ Kalisz says it's the oldest town in Poland. A Greek geographer called Ptolemy put "Calisia" on his map in the second century, right on the Amber Road.
~ People were walking amber past here when Rome was the centre of the world.
~ It's harvest time. In the villages they're weaving wreaths from the last of the wheat, and there's a brass band and a great deal of cake.
Local (Old man with a moustache): Poppy seed cake. Eat. No, eat. You're walking to Vienna? Eat two.
!flash
~ Vex comes over the stubble fields at dusk. The brass band, to its enormous credit, keeps playing.
boss:dragon: I've been hoarding this town's hours since Ptolemy. A lovely vintage.
~ Vex is tougher than ever. Scales like roof tiles. You hit it for an hour and it just keeps coming.
? The band strikes up something faster.
- Fight to the beat {s4.band}
  ~ You fight to the beat. The tuba player is a genius. Vex can't follow a polka.
- Get the band to safety
  ~ You hustle the band behind a hay wagon. They keep playing from behind it, a bit muffled.
~ And then it doesn't keep coming. Vex lifts off, slowly, heavily, and turns south.
~ Before it goes, it says one more thing. Not to you. To the Count.
boss:dragon: Tell him his table's ready.
mate: Whose table?
~ Afterwards the old man tells you the Romans used to drop a coin in the river here for luck.
~ You haven't a coin between you. You drop in a plaster, the only thing anybody has in their pocket.
Local (Old man with a moustache): That will probably do.`,

// 11 The Gate in the Mountains — Moravian Gate
`@forest-mist
~ Between the Sudeten mountains and the Carpathians there's a gap: the Moravian Gate.
~ Everyone going between the Baltic and the Danube has come through it. Romans, merchants, armies, birds, trains. Now you.
!dark
~ Halfway through, the fog comes in. In the fog are two shapes you know.
~ The Taxman has a clipboard. Grimm has his club.
~ And behind them, further back, a third shape. Tall. Horned. With the sound of chains.
boss:krampus (???): ...
~ It doesn't come forward. It just watches while Grimm swings and the Taxman takes notes.
Taxman: Don't mind him. He's from Head Office. Seasonal. He does December.
? The horned shape is watching you in particular.
- Stare back {s4.stared}
  ~ You stare back. It tilts its horned head, slowly, like it's reading a list. Then it makes a small tick in the air.
- Keep fighting Grimm
  ~ You ignore it and keep fighting Grimm. Thick skin. Steady hits. Hold together.
!shake
~ The fight is long and heavy and nothing goes in easily, and you hold together.
!light
~ When the fog lifts, all three are gone. There are hoofprints in the mud.
Farmer: The devil. He comes with St Nicholas in December. Over the border in Austria they call him Krampus.
Farmer: He's for the ones who've been idle.
~ He looks at your boots.
Farmer: You'll be fine.
mate: The Taxman said Head Office.
you: So the Taxman has a boss. And Krampus works for it. So does Grimm.
mate: And wherever it is, I bet it's got a lot of windows.`,

// 12 The Emperor's Diary — Carnuntum
`@wall-dusk
~ Carnuntum was a Roman city on the Danube, where the Amber Road met the Empire.
~ Amber came south from the Baltic to here, then on to Italy, to be carved into charms and rings and tiny pots for perfume.
~ The emperor Marcus Aurelius lived here for a few years and wrote some of his private notes here.
Guide (Site guide): A lot of what he wrote is him telling himself to get out of bed in the morning and get on with it.
mate: Relatable.
Guide (Site guide): He'd remind himself he was getting up to do a person's proper work. Then, presumably, he lay there a bit longer.
~ In a rebuilt Roman house, on a kitchen shelf, there's an amber bead in a little glass case. Found in a dig.
~ Same colour as the one in the Count. Same size. In your hand, the Count goes quiet, as if it's listening.
? The Count is listening to something.
- Listen too {s4.listened}
  ~ You hold it to your ear. Under the ticking, very faint: a second tick. Slower. Older.
  ~ Like another heart, somewhere close, that stopped a very long time ago and is trying to start.
- Try to wind it
  ~ You try to wind it. It won't wind. It hasn't run down. It's waiting.
~ From the riverbank you can see the glow of Vienna. Forty kilometres. One more week.
~ The Count starts ticking again, slow and steady.
~ But the needle doesn't point at Vienna. It points the other way. Down the Danube. East.
mate: It doesn't want to go to Vienna?
you: It does. It just already knows it isn't stopping there.
~ That night the Taxman leaves a note under the tent flap. It isn't an invoice. That's what makes it frightening.
Taxman (The Taxman, by note): Vienna. The coffee house on the Ring. Table by the window. He's been waiting. Do be gentle. He bruises like a pear.`,

// 13 Holloway's Letter — Vienna
`@cafe
~ Vienna: palaces and trams, and coffee houses where the waiters wear bow ties and nobody rushes you.
~ It's the end of October. The leaves on the Ring are gold. You've walked from Cornwall to the Danube in a year.
~ Ishbel told you which coffee house. The head waiter has a letter for you.
Waiter: This has been in the safe since 1734. To be given to "whoever brings in the brass counter".
Waiter: I had stopped expecting to give it to anyone. So had my father. So had his.
~ It's from Abiah Holloway.
Holloway (Abiah Holloway, 1734): I meant to take it all the way round. East and east, until east brings it home to Cornwall.
Holloway (Abiah Holloway, 1734): Every step a stitch, and the world is a bigger coat than England.
Holloway (Abiah Holloway, 1734): My knees have filed a complaint and I must stop here. Just for a coffee. Just to rest.
Holloway (Abiah Holloway, 1734): Whoever reads this: it isn't finished. It will want six feast days a year. Let it have them.
~ Underneath is a map of the whole world, very wrong, with a dotted line going all the way round.
~ The handwriting is neat. The capitals are very neat.
~ You've seen those capitals before. On Hadrian's Wall. On the Troll Road. On a signpost buried in a dune.
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
!light
~ The Count chimes. Thirteen times. Twenty-two of the three hundred and sixty marks are glowing.
~ Grimm flinches at every chime, exactly like the Taxman did at Nordkapp.
~ The Taxman is at the next table, drawing up an itinerary. He raises his cup.
Taxman: A world tour. Think of the paperwork.
boss:algorithm (Grimm): Finish it, then. Show me.
@the-glow
~ And far away to the east, so far that east starts to become west, something with a hundred small lights for eyes opens them.
~ One by one.
~ Each one the exact cold blue of a phone at 3am. Or of a lighthouse beam, seen from very far out to sea.`,
];

const WRITTEN = { s1: S1, s2: S2, s3: S3, s4: S4 };

// ---------- seasons 5+: the long way round ----------
const BOSSES = [["notification", "Brett"], ["autoplay", "Rory"], ["leftonread", "Wisp"], ["scroll", "Gale"], ["kraken", "the Kraken"], ["algorithm", "Grimm"], ["dragon", "Vex"]];
const AFFIX_NAMES = { fog: "Fog", frost: "Frost", haste: "Haste", thickhide: "Thick Hide", volatile: "Volatile", leech: "Leech", bloodmoon: "Blood Moon", silence: "Silence", brittle: "Brittle", echo: "Echo" };
const AFFIX_LORE = {
  fog: ["This season the Stillness breathes out fog.", "You'll see its attacks coming late. Keep your eyes up."],
  frost: ["Everything's stiff with cold this season.", "Swapping places takes twice as long. Decide where you stand before you set off."],
  haste: ["Everything's in a hurry this season, monsters included.", "They swing faster. What you win off them comes faster too."],
  thickhide: ["The creatures have grown thick skins this season.", "Lucky big hits won't do much. Hit them a lot instead."],
  volatile: ["The creatures are jumpy this season.", "They'll use their own nasty trick far more often. Learn it and watch for it."],
  leech: ["This season, every hit that lands, the creature drinks a little back.", "Like a feed that refreshes itself. Don't let up."],
  bloodmoon: ["There's a red moon this season.", "Under it the creatures hit forty per cent harder. The loot's better too. Of course it is."],
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
  notification: ["BZZT. Did you see this? Did you SEE this?", "You have 99+ unread. You have 100+ unread. You have—", "Just checking in! Just checking in! Just checking in!", "BZZT. Someone you've never met liked something you never posted."],
  autoplay: ["Next episode in five... four...", "Are you still watching? You are. You're still watching.", "Skip intro? Skip intro? Skip intro?", "Because you watched \"Sitting Down\", you might like \"Sitting Down Again\"."],
  leftonread: ["...seen.", "...typing...", "...seen at 11:42...", "...you never wrote back..."],
  scroll: ["Just one more. Just one more. Just one more.", "Refresh. Refresh. Refresh.", "Next! Next! Next! Next!", "There's always more further down. There's always more."],
  kraken: ["Down here it's always three in the morning.", "Come down. Just for a look. Just for an hour.", "The bottom of the feed is very comfortable. Nobody ever leaves."],
  algorithm: ["STOP.", "You might also like: sitting down.", "Recommended for you: STOP.", "I know where you're going. I've decided it's the sofa."],
  dragon: ["Every hour you gave me, I kept.", "My hoard is made of evenings. Yours are in here somewhere.", "One more hour. You won't miss it. You never do."],
};
// Per leg: the keeper who meets you (who = portrait key), and backgrounds that suit the route.
const LEGX = [
  { keeper: "Zsófia", bgs: ["river-dusk", "fields-dusk", "city-night"] },
  { keeper: "Mirsad", bgs: ["river-dusk", "forest-mist", "harbour"] },
  { keeper: "Drita", bgs: ["peak-cloud", "road-night", "forest-mist"] },
  { keeper: "Eleni", bgs: ["beach", "peak-cloud", "domes-dusk"] },
  { keeper: "Aylin", bgs: ["domes-dusk", "desert-night", "rock-arch"] },
  { keeper: "Anahit", bgs: ["snowfield", "peak-cloud", "desert-night"] },
  { keeper: "Nino", bgs: ["forest-mist", "tor-sunset", "city-night"] },
  { keeper: "Farrukh", bgs: ["desert-night", "domes-dusk", "road-night"] },
  { keeper: "Gulnara", bgs: ["peak-cloud", "snowfield", "glen-snow"] },
  { keeper: "Karim", bgs: ["peak-cloud", "glen-snow", "road-night"] },
  { keeper: "Harpreet", bgs: ["road-night", "domes-dusk", "river-dusk"] },
  { keeper: "Sunita", bgs: ["temples-dusk", "forest-mist", "peak-cloud"] },
  { keeper: "Pemba", bgs: ["peak-cloud", "forest-mist", "temples-dusk"] },
  { keeper: "Thida", bgs: ["temples-dusk", "river-dusk", "jungle"] },
  { keeper: "Sophea", bgs: ["jungle", "temples-dusk", "river-dusk"] },
  { keeper: "Linh", bgs: ["beach", "temples-dusk", "city-night"] },
  { keeper: "Mei", bgs: ["lake-mist", "temples-dusk", "forest-mist"] },
  { keeper: "Mr Zhao", bgs: ["wall-dusk", "temples-dusk", "peak-cloud"] },
  { keeper: "Ji-woo", bgs: ["harbour", "temples-dusk", "city-night"] },
  { keeper: "Haruki", bgs: ["temples-dusk", "city-night", "peak-cloud"] },
  { keeper: "Rosa", bgs: ["islands", "forest-mist", "temples-dusk"] },
  { keeper: "Ayu", bgs: ["islands", "jungle", "beach"] },
  { keeper: "Jen", bgs: ["red-desert", "desert-night", "road-night"] },
  { keeper: "Pete", bgs: ["red-desert", "desert-night", "city-night"] },
  { keeper: "Aroha", bgs: ["fjord-ice", "peak-cloud", "lake-mist"] },
  { keeper: "Sione", bgs: ["islands", "beach", "sea-storm"] },
  { keeper: "Marama", bgs: ["islands", "sea-storm", "harbour"] },
  { keeper: "Camila", bgs: ["desert-night", "snowfield", "lake-mist"] },
  { keeper: "Mateo", bgs: ["peak-cloud", "forest-mist", "glen-snow"] },
  { keeper: "Valentina", bgs: ["jungle", "forest-mist", "islands"] },
  { keeper: "Itzel", bgs: ["jungle", "beach", "town-day"] },
  { keeper: "Lupe", bgs: ["desert-night", "town-day", "red-desert"] },
  { keeper: "Earl", bgs: ["road-night", "city-night", "forest-mist"] },
  { keeper: "Maggie", bgs: ["lighthouse-night", "harbour", "city-night"] },
  { keeper: "Sigrún", bgs: ["fjord-ice", "aurora", "snowfield"] },
  { keeper: "Margaret", who: "Margaret", bgs: ["aurora", "glen-snow", "islands"] },
];
// The long arc, one entry per leg: `mid` plays in chapter 7, `end` in chapter 13 before the chimes.
const SAGA = [
  // 0 The Blue Danube
  { mid: `~ On the riverbank behind you, half a mile back, something big and blue is walking. Slowly. Limping.
mate: Grimm. He's following us.
~ He stops when you stop. He starts when you start. He doesn't come any closer.
Keeper ({keeper}): The big one? He sat on a café chair for three hundred years. His legs have forgotten how. Give them time.`,
    end: `~ {end}, where two rivers meet and go on as one.
~ Grimm is on the far bank. He takes something out of a crack in his bark: an old three-cornered hat.
~ He holds it for a long time. Then he puts it on.
Taxman: He's going to follow you round the world, you know. Badly. At a distance. Writing STOP on things.
you: Why?
Taxman: Because the only way he gets to finish is if you do. And he'll never admit it. Neither would I.` },
  // 1 The Dinaric Way
  { mid: `~ At Mostar, young men dive off the Old Bridge into the river for tips. Twenty metres down.
~ The bridge was destroyed in the war and rebuilt, stone by stone, with stones lifted out of the riverbed.
Keeper ({keeper}): Things that fall can be put back. Slowly. By hand. That's all mending is.
~ That's what a Sunday is, really. You're not winning anything. You're putting stones back.`,
    end: `~ {end}: a walled town at the end of a long inlet, and a fortress path of over a thousand steps.
~ You climb them at dawn. Halfway up there's a bench, and Grimm is sitting on it, breathing hard.
? Grimm is blocking the path, out of breath.
- Sit with him a minute {g.sat}
  ~ You sit with him. Just a minute. The Count doesn't go cold. Sitting with someone, it turns out, is allowed.
- Step round him
  ~ You step round him. Behind you, after a while, you hear him get up. And keep climbing.
boss:algorithm (Grimm): ...Thank you.
~ Then he writes STOP on the fortress wall, out of habit, and looks embarrassed about it.` },
  // 2 Gods and Goat Paths
  { mid: `~ At Meteora, monasteries sit on top of stone pillars. For centuries the only way up was a net on a rope.
Monk: People think we came up here to stop. We came up here to be still. It's not the same thing.
Monk: Stillness you choose has a door in it. The other kind doesn't.
mate: What's the other kind?
Monk: You've seen it. It glows.`,
    end: `~ At Delphi, where the oracle used to sit, a guide does the voice for the tourists. Very badly.
Guide (Guide at Delphi): "The eye you seek has watched you leave. It will watch you come home."
Guide (Guide at Delphi): That's not one of the real ones. I don't know why I said it. Sorry. It just came out.
~ Then {end}, and the Acropolis glowing gold above a city of a million blue windows.
~ The Count chimes from the hill, and for a second every phone screen in the city flickers.` },
  // 3 Where Europe Stops
  { mid: `~ The Taxman has caught a cold. He sneezes on his forms and apologises to them.
~ {mate} lends him a scarf. He looks at it as if it might be a trick.
Taxman: Mabel knitted. She knitted the whole way from Lindesnes. Scarves for everyone. Mine was green.
Taxman: I left it in the shelter. With them.
~ After an hour he gives the scarf back, very carefully, folded.`,
    end: `~ {end} sits on two continents. You walk across the bridge over the Bosphorus from Europe into Asia, and the Count chimes two notes instead of one.
~ On the far side, at the end of the bridge, a thin boy in a brown coat is waiting. Waving you across.
Kit: You came! You said you would!
~ Then a ferry horn goes, and he's gone, and the frost on the railing where he stood is shaped like a hand.` },
  // 4 Fairy Chimneys
  { mid: `~ Derinkuyu is a city dug eight floors underground. Thousands of people once hid down here, with their animals, for months.
~ On the lowest level, in a room the guide doesn't show the tourists, there's a blue light. No bulb. No source.
~ Chairs. Rows of them, all facing one blank wall. All empty. All warm.
Keeper ({keeper}): People hid down here from armies. Afterwards, some didn't want to come back up. It was safe and quiet, and something kept them company.
? The chairs are still warm.
- Leave. Now. {g.leftchairs}
  ~ You leave. Up eight floors, fast, nobody saying a word.
- Turn one chair to face the door
  ~ You turn one chair round, to face the way out. It feels important. The blue light flickers, annoyed.`,
    end: `~ At dawn a hundred hot-air balloons rise over the valley of stone chimneys.
Taxman: Head Office? It isn't a monster, if that's what you're picturing. It's a habit with a postcode.
Taxman: Everyone who ever sat down and didn't get up. All in one place. Very comfortable. Very warm. Very blue.
you: Where?
Taxman: East. Keep going east. It's always east. Until it isn't.` },
  // 5 In Ararat's Shadow
  { mid: `~ Mount Ararat, where the Ark is said to have come to rest after the flood.
Keeper ({keeper}): Noah sat in a boat for forty days and it saved everyone. Stopping isn't always the enemy.
Keeper ({keeper}): Rest is a stop with a morning after it. That's the difference. The Count knows it.
~ That night you sleep properly for the first time in weeks. In the morning the Count is still ticking, softly, as if it kept watch.`,
    end: `~ {end}: sulphur baths, wooden balconies and a fortress on the hill.
~ Grimm is waiting at the edge of the old town. He doesn't swing. He falls into step, ten paces behind the last of you.
~ And for ten steps, the Count ticks for him too. Ten small ticks, separate from yours.
mate: Did you hear that?
~ Grimm stops dead. He looks down at his feet as if they belong to someone else.
boss:algorithm (Grimm): Ten.
~ On Sundays, something wearing his shape still comes through the seam. He says it isn't him. It's what's left of him in there.` },
  // 6 The Land of Fire
  { mid: `~ At Yanar Dag a hillside has been on fire for longer than anyone remembers. Gas seeps out of the rock and burns.
~ Vex lands on the hill and doesn't attack. It just sits in the flames like a cat in a sunbeam.
boss:dragon: I was the first one. Did you know? Before phones. Before tellies. I was the fire in the cave.
boss:dragon: They sat round me and told stories, and it was good. Then one day they stopped telling stories and just watched me.
boss:dragon: That's when I got hungry.`,
    end: `~ {end}: glass towers shaped like flames, and an old walled city underneath them.
? Far behind you, Vex is still sitting in the fire, watching you go.
- Shout it a story {g.story}
  ~ You shout a story back up the hill. A terrible one, about {mate} and a goose.
  ~ For a minute the fire flickers like it's laughing. It's the first story anyone has told it in ten thousand years.
- Keep walking
  ~ You keep walking. Behind you, the hill burns on, the way it always has.
~ The needle points across the water: the Caspian, then the desert, then the Silk Road.` },
  // 7 The Silk Road
  { mid: `~ In the desert you sleep in an old caravanserai, a walled inn where traders stopped for the night with their camels.
~ The walls are covered in six centuries of graffiti. Traders. Pilgrims. And here and there, the same small mark: a clipboard.
Taxman: My predecessors. There's always been a Taxman, you see. On every road. Somebody has to hold the clipboard.
mate: What happened to them?
Taxman: They were released when the next one signed. That's how it works. Someone always has to hold it.`,
    end: `~ {end}: blue domes, blue tiles, blue everywhere. But the good blue. Sky blue, not screen blue.
~ The Taxman stands in the Registan for a long time, looking up.
Taxman: I'd forgotten blue came in other colours.
? He looks smaller than usual.
- "Who takes the clipboard after you?" {g.whonext}
  Taxman: Nobody, if you finish. If the Count goes all the way round, the terms end. For everyone. For me. For them.
  Taxman: Don't tell anyone I told you. I'd be in terrible trouble with myself.
- Leave him to it
  ~ You leave him to it. When you look back, he's taken his hat off.` },
  // 8 The Roof of the World
  { mid: `~ The Pamir Highway is one of the highest roads on Earth. The air is thin. Every step costs double.
~ Grimm is behind you, further behind every day. Then one morning he isn't moving at all. He's sitting on a rock at the side of the road.
? Grimm has sat down.
- Go back for him {g.wentback}
  ~ You go back. All of you. It costs a whole afternoon.
  ~ You can't carry him; he's enormous. You just stand there until he's embarrassed enough to get up.
- Wait where you are
  ~ You wait. It takes hours. At last a big blue shape gets up, very slowly, and starts walking.
~ The Count ticks for him again. Eleven this time. Twelve.`,
    end: `~ {end}: the Sunday market, which has run every week for two thousand years without missing one.
~ Livestock, carpets, knives, melons, and absolutely everybody.
boss:algorithm (Grimm): Kit.
you: What about him?
boss:algorithm (Grimm): Nobody went back for Kit. You went back for me. I am trying to work out why.
mate: Because that's what you do.
boss:algorithm (Grimm): ...It was not what I did.` },
  // 9 The Karakoram
  { mid: `~ The Karakoram Highway runs under the biggest mountains in the world, and the mountains are always trying to fall on it.
!shake
~ A rockfall blocks the road above Passu. Boulders the size of vans.
~ In the morning, the road is clear. Every boulder has been rolled to the side. Very neatly. In rows.
~ On the last one, in neat capitals, someone has written: NO.
mate: Grimm. He's started writing NO.`,
    end: `~ At the Golden Temple in {end}, a free kitchen feeds a hundred thousand people a day. Everyone sits on the floor together in long rows and eats.
~ You sit. You eat. The Count doesn't go cold. Not even slightly.
Keeper ({keeper}): Sitting together isn't stopping. Sitting alone, staring at a glow, waiting for the next thing: that's stopping.
~ Grimm sits at the end of your row. Someone hands him a plate of dal. He eats very slowly, as if he'd forgotten food had a taste.` },
  // 10 The Grand Trunk Road
  { mid: `~ The Taj Mahal: the most beautiful building in the world, built by a man who couldn't stop grieving.
~ A letter catches up with you in Agra. Penzance postmark.
Morwenna (Morwenna, by letter): You'll have guessed there's something wrong with my light.
Morwenna (Morwenna, by letter): It burns blue. It has since 1724. I tell myself it keeps the dark off the sea.
Morwenna (Morwenna, by letter): I'm not sure, any more, which way it shines.`,
    end: `~ {end} at dusk: the ghats, the river, and a thousand little lamps set floating on the water.
~ They drift away downstream, a hundred small lights on dark water.
~ The Count goes very still in your hand, the way it did at Carnuntum. Listening.
mate: It doesn't like them.
you: No. It recognises them.` },
  // 11 Where the Buddha Walked
  { mid: `~ At Bodh Gaya, under a descendant of the tree where the Buddha sat until he understood, monks sit in silence.
mate: So they're sitting. Isn't that what we're fighting?
Monk: We sit with our eyes open. The thing you fight sits with its eyes in a screen.
Monk: One kind of sitting wakes you up. The other puts you to sleep and calls it rest.
? The monk offers you a place to sit.
- Sit for ten minutes {g.meditated}
  ~ You sit. Ten minutes. Eyes open. Nothing glows.
  ~ When you stand, the Count is ticking quietly, as if it approves.
- Politely keep moving
  Monk: Also good. Walking is just sitting with your feet.`,
    end: `~ {end}: prayer flags, temple bells and traffic that sounds like an argument that's been going for centuries.
~ Kit walks with you the whole last day. You can see him in daylight now, faintly, like a reflection in a shop window.
Kit: When you finish, I get to stop properly. The good kind. With a door in it.
Kit: I'd like that. I'm very tired. Three hundred years is a lot of walking for someone with short legs.` },
  // 12 Tea and Thunder
  { mid: `~ A monsoon storm hits on the way to Cherrapunji, one of the wettest places on Earth. Which is fair enough.
~ When it clears, somebody is missing. Not one of you. The Taxman.
? The Taxman is lost somewhere in the storm.
- Go back for him {g.savedtax}
  ~ You go back. You find him under a tea bush, soaked through, clutching his clipboard to his chest like a baby.
  Taxman: Nobody has ever come back for me. I'm a tax collector. It isn't in the job description.
- Shout for him
  ~ You shout until you're hoarse. At last a very damp bowler hat rises out of the tea bushes.`,
    end: `~ In {end} they play polo, and claim they invented it, and they're probably right.
~ The Taxman hands you an envelope. Inside is a single form.
Taxman: A write-off. One day's tax. A gesture of goodwill. Don't get used to it.
~ It's the first form he has ever filled in that gives something back.
~ At six that evening he still turns up for the fight. The terms are the terms. But he fights fair now. Almost politely.` },
  // 13 The Golden Land
  { mid: `~ Bagan: a plain with more than two thousand temples on it, all the way to the horizon.
~ At dusk, people light lamps in the temple doorways. Thousands of small flames. Warm ones. Yellow.
Keeper ({keeper}): Not every light is the bad kind. A lamp you light for someone isn't the same as a light that lights you.`,
    end: `~ {end}: a river city of temples, tuk-tuks, and more glowing screens than anywhere you've been.
~ The Taxman takes you up a tower and points west. Back the way you came. A very long way.
Taxman: Head Office has an eye, you know. Just the one, really. Made of hundreds of little ones.
Taxman: It's been looking out over the sea for three hundred years.
you: Which sea?
Taxman: I'm not allowed to say. I'm also not allowed to stop you working it out.` },
  // 14 The Temple Road
  { mid: `~ At Ta Prohm, near Angkor Wat, the jungle has grown straight through the temple. Tree roots pour over the doorways like melted candles.
Keeper ({keeper}): This is what happens to anything that stops for long enough. Something grows over it.
mate: That's a bit bleak.
Keeper ({keeper}): It's also beautiful. Both. Like most things.`,
    end: `~ {end} has millions of motorbikes, and all of them are moving at once.
~ Nobody stops. Nobody. The whole city flows round you like a river.
~ The Count goes wild. It ticks so fast it nearly purrs.
mate: It's like it's never been anywhere this awake.
~ That week, Brett can't find a single place to sit. He turns up on Sunday anyway, very cross about it.` },
  // 15 The Long Coast
  { mid: `~ Hội An: a lantern town. Silk lanterns in every colour, strung across every street.
~ Your phone rings. It's Ishbel. Nobody has ever heard Ishbel's phone voice.
Ishbel: You're past a hundred marks. I've been counting.
Ishbel: I wanted to say. Morwenna asked after you. First time she's said my name in three hundred years.
Ishbel: Don't make anything of it. Keep walking.`,
    end: `~ {end}: lakes, scooters, and old men playing chess on the pavement.
~ Outside the station, somebody has painted STOP on a wall in big blue capitals.
~ Underneath it, newer, in the same neat hand: NO. NOT YET.
mate: He's arguing with himself now.
you: Good. That's how it starts.` },
  // 16 The Karst Country
  { mid: `~ Hạ Long Bay: thousands of limestone islands standing in green water. The name means "where the dragon comes down".
!shake
~ Something rises between the islands. Not a dragon. Tentacles.
boss:kraken: You've come a long way to see me again.
? The Kraken surfaces right beside the boat.
- Ask it where the bottom of the feed is {g.krakenasked}
  boss:kraken: Everywhere. Wherever someone lies awake at three in the morning with a screen on their face, the water is very deep.
- Fend it off with an oar
  ~ You fend it off with an oar. It's surprisingly effective. The Kraken looks offended and sinks.`,
    end: `~ {end}: the Terracotta Army. Eight thousand clay soldiers in rows, all facing the same way, for two thousand years.
~ Nobody speaks. You walk along the rows.
Keeper ({keeper}): The emperor wanted an army that would never leave him. So he made one that couldn't.
mate: That's it, isn't it? That's what the Stillness wants. Everyone in rows, facing the same way. For ever.
~ At the far end of the pit, for one second, every clay face is lit blue. Then it's gone.` },
  // 17 The Long Wall
  { mid: `~ The Great Wall climbs mountains no sensible wall should climb. You walk on top of it for days.
Keeper ({keeper}): People think walls keep things out. Walls don't keep anything out. People do. Walls are just where they stand.
? {mate} asks what you'd keep out, if you could.
- The glow
  you: The glow. All of it.
  mate: Even the telly on a Sunday night?
  you: ...Most of it.
- Nothing. Just keep walking. {g.nowall}
  you: Nothing. Walls are for stopping. We're not stopping.`,
    end: `~ {end}: where the Great Wall runs down into the sea and just stops.
~ The needle swings out over the water. East, across the Yellow Sea.
Taxman: Halfway to the halfway point. I've done the sums. You don't want the sums.
mate: We never want the sums.` },
  // 18 The Yellow Sea
  { mid: `~ At Hahoe, a village of thatched houses, there's a mask dance that has been performed for eight hundred years.
~ One of the masks is a greedy official. Everyone laughs at him. The Taxman watches very seriously, then laughs too, a bit late.
Taxman: I'd like to ask you something. It isn't a form. It's a favour.
Taxman: When we get to {end}, would you say their names? Out loud? Someone should, now and then.`,
    end: `~ {end}: fish markets, mountains, and a temple on the rocks by the sea.
~ The Taxman takes his hat off.
Taxman: Mabel Ashworth. Arthur Penrose. Ruth Okafor. Sidney Clegg.
? Say their names?
- Say them together {g.namedfour}
  you: Mabel. Arthur. Ruth. Sidney.
  ~ The Count ticks four times. Four separate ticks, like four people answering a register.
  ~ The Taxman puts his hat back on very quickly and walks off to look at a fish.
- Let him say them
  ~ He says them again, quietly, to the sea. The Count ticks four times.` },
  // 19 The Tōkaidō
  { mid: `~ In Kyoto there's a potter who mends broken bowls with gold. Kintsugi. The cracks become the most beautiful part.
Keeper ({keeper}): You do this, don't you? On Sundays. You mend.
you: We hit monsters until they go away.
Keeper ({keeper}): That's also a kind of mending. Less gold. More shouting.`,
    end: `~ {end}: the busiest city on Earth, and the most glowing. Millions of people, every one of them going somewhere.
~ At the Shibuya crossing, thousands cross at once from every direction and nobody bumps into anybody.
~ Grimm stands at the edge and watches. He isn't holding his club.
mate: Where's his club?
~ He left it at Mount Fuji, leaning on a signpost. Somebody has hung a label on it: LOST PROPERTY.
~ On Sundays the thing that comes through the seam still carries one. It isn't his any more.` },
  // 20 The Island Chain
  { mid: `~ The Kumano Kodo: pilgrim paths through cedar forests, walked for a thousand years. Moss on every step.
~ At a teahouse, an old woman stamps your pilgrim book and looks at the Count.
Keeper ({keeper}): My grandmother saw one of those. 1924. A man with a brass thing and a very sad face.
Keeper ({keeper}): He didn't get far. People who carry it alone never do.`,
    end: `~ {end}: jeepneys painted like fairground rides, and the sea glowing at night.
~ Out past the bay, the sea floor drops away into some of the deepest trenches on Earth.
boss:kraken: This is home. The bottom of the sea is the bottom of the feed. They go down and down and never touch anything.
boss:kraken: You keep coming up. Nobody keeps coming up.
~ It sounds almost jealous.` },
  // 21 Ten Thousand Islands
  { mid: `~ On Komodo the dragons are real: three metres long, very slow, then very fast.
~ Vex lands on the island one evening, takes one look at the Komodo dragons, and leaves again. Outclassed.
mate: I've never seen Vex embarrassed before.
you: Twice now. The first time was Finland.`,
    end: `~ {end}: the top of Australia. Hot, wet, and full of crocodile warnings.
~ The Count has lit up more than a hundred and thirty of its marks.
Ishbel (Ishbel, by text): Halfway soon. Auckland. When you get there, ring me. Not text. Ring.
Ishbel (Ishbel, by text): There's something I should have told you at John o' Groats.` },
  // 22 The Red Centre
  { mid: `~ Out here there's no signal for days. No glow. Just the biggest sky you've ever seen.
~ For three nights running, nothing comes through the seams at all. It can't. There's nowhere for it to look out from.
Keeper ({keeper}): The Stillness needs windows. Out here there aren't any. Just stars. Stars don't count. They look back.`,
    end: `~ {end}. The rock is red, and sacred to the people whose country this is. They ask visitors not to climb it.
~ So you walk round the base instead. Ten kilometres. All of you, together, slowly.
~ It's the best walk of the season. The Count seems to think so too.
Keeper ({keeper}): People have walked round here for tens of thousands of years. You're not the first. You won't be the last.` },
  // 23 Back of Beyond
  { mid: `~ At Lake Mungo there are human footprints in the clay, twenty thousand years old. A family walking. A child running ahead.
mate: People have always walked.
you: And somebody always went back for the kid.
~ The Count ticks, warm, like it agrees.`,
    end: `~ {end}: the bridge, the opera house, ferries criss-crossing the harbour.
~ A letter is waiting at the post office. Penzance.
Morwenna (Morwenna, by letter): You're nearly halfway. I'm frightened, if you want the truth.
Morwenna (Morwenna, by letter): When the Count goes all the way round, the bargains end. All of them. Mine too.
Morwenna (Morwenna, by letter): I don't know what I'll be when my light goes out. I've not been anything else for three hundred years.` },
  // 24 The Long White Cloud
  { mid: `~ The Tongariro Crossing: volcanoes, emerald lakes and a red crater that smells of eggs.
~ Grimm walks in the middle of the squad now. Nobody remembers when that started.
~ Halfway up, he speaks without being asked. That's new too.
boss:algorithm (Grimm): Morwenna was nineteen. Ishbel was seventeen. I was fifty and should have known better.
boss:algorithm (Grimm): I told them the Count would not abide a stop. That was my fear talking. I built it to keep us walking, then I made everyone afraid of it.`,
    end: `~ {end}. The Count's needle passes the hundred and eightieth mark. Halfway round the world.
~ You ring Ishbel, like she asked.
Ishbel: Right. Listen. That thing with a hundred lights for eyes. Head Office.
Ishbel: I've seen it. Every night for three hundred years. From John o' Groats, on a clear night, you can see a long way down the coast.
Ishbel: I never told you because I wasn't sure. I'm still not sure. Keep walking.
~ She hangs up. The needle points east. Which, from here, is starting to mean home.` },
  // 25 The Date Line
  { mid: `~ Out here, between the islands, the date changes. You can lose a whole day by crossing a line on a map.
~ You lose one. Somewhere between Vanuatu and Fiji, a Tuesday doesn't happen.
~ In the missing day everything stops, like the lost hour at Tornio. And Kit is there, sitting on the deck, waiting.
Kit: I like it in here. Nothing goes on without you. Nobody gets left.`,
    end: `~ {end} sits right on the 180th meridian. You can stand with one foot in today and one in yesterday.
!glitch
~ Standing there, you can hear it. Head Office. A voice like a room with the telly on.
Morwenna (???): Stay in yesterday. It's so much quieter. Nobody has to walk anywhere in yesterday.
? Something is offering you yesterday.
- Step into tomorrow {g.tomorrow}
  ~ You step into tomorrow. All of you, together. The voice sighs like a sofa.
- "What are you?"
  you: What are you?
  Morwenna (???): Tired. Just very, very tired. Aren't you?
  ~ You step into tomorrow anyway.` },
  // 26 The Long Ferry
  { mid: `~ On Rapa Nui, the great stone heads stand with their backs to the sea, watching over the island.
Keeper ({keeper}): They face inland, to look after the people. Not out at the water.
Keeper ({keeper}): A watcher that faces the wrong way stops being a guardian. It becomes the other thing.
mate: Like a lighthouse that shines inland.
~ Nobody says anything for a long while after that.`,
    end: `~ {end}: a city of steep hills, painted houses and ancient funiculars clanking up and down.
~ The Taxman takes the stairs. All of them. Without being asked.
Taxman: I keep a separate ledger, you know. In my head. What I'd owe them, if I could pay.
Taxman: I've started walking to work. It's very far. I'm very late. It's wonderful.` },
  // 27 Salt and Stars
  { mid: `~ The Salar de Uyuni: a salt flat so big and so flat that after rain it turns into a mirror. Sky above, sky below.
~ At night there are stars everywhere. Up. Down. All round.
~ And in the mirror, far off at the western edge of the world, a hundred small blue lights, reflected in the salt.
~ When you look up at the real sky where they should be, there's nothing.
mate: It's not out there. It's somewhere the mirror can see and we can't.`,
    end: `~ {end}, on Lake Titicaca: the highest navigable lake in the world. Floating islands made of reeds, rebuilt by hand every few months.
Keeper ({keeper}): The reeds rot from underneath, so you add new ones on top. Always. If you stop, you sink.
you: That's the most Long Count thing anyone's ever said to us.` },
  // 28 The Inca Road
  { mid: `~ The Inca had relay runners called chasquis. Messages went thousands of miles along this road, runner to runner, and never stopped.
Keeper ({keeper}): One runner can't go far. A line of them can cross an empire.
~ At Machu Picchu, in the cloud, you pass the Count down the line, hand to hand. Everybody carries it for a bit.`,
    end: `~ {end}: the Middle of the World. There's a line on the ground for the equator. You stand on it with one foot in each half of the planet.
~ The Count is nearly three hundred marks round.
boss:algorithm (Grimm): I never got this far. Not even in my plans.
~ His bark is softer now. Patches of it look almost like a coat. Almost like skin.` },
  // 29 Coffee and Canals
  { mid: `~ There's no road through the Darién Gap. Just jungle and swamp. You go round by boat through the San Blas islands.
~ The Count sulks the whole way. Then you land, and it ticks like it's never been happier.
mate: It's like a dog after a car journey.`,
    end: `~ {end}: a perfect cone of a volcano, smoking quietly over the rainforest.
!flash
~ Vex is coiled round the summit, on its hoard. Bigger than ever. It has been eating well.
boss:dragon: You're nearly round. When you're round, I lose all of it. Every hour goes back to whoever it belonged to.
boss:dragon: I don't want to go back to being a fire in a cave.
? Vex sounds afraid.
- "The cave was the good bit." {g.vexcave}
  you: Being a fire in a cave was the good bit. People told stories round you.
  boss:dragon: ...They did. They did, didn't they.
- "Then we'll take them back the hard way."
  boss:dragon: Then come up the hill on Sunday, walker.` },
  // 30 Pyramids in the Trees
  { mid: `~ At Tikal, temples rise out of the jungle like the tops of drowned ships.
Keeper ({keeper}): The Maya had a calendar for very long spans of time. Thousands of years. They called it the Long Count.
mate: ...Seriously?
Keeper ({keeper}): Seriously. Your Mr Holloway read a lot of books, I expect.
boss:algorithm (Grimm): I did. I borrowed the name. A long walk needed a long name. I was very pleased with myself.`,
    end: `~ {end}: a walled port painted every colour of ice cream.
~ The Count has more than three hundred marks lit. You can see the end of the dial now. The very last mark.
~ Under a magnifying glass it isn't a line. It's a tiny lighthouse. Paweł in Toruń was right.` },
  // 31 The Silver Road
  { mid: `~ You reach the mountain towns at the start of November. Día de Muertos: marigolds, candles, sugar skulls, families picnicking on graves.
Keeper ({keeper}): For one night the dead come home. You set a place for them. You say their names.
? The keeper sets out extra plates.
- Set places for the ones you've met {g.dead}
  ~ You set places. The navvy. Margaret's Gerald. Mabel, Arthur, Ruth and Sidney. Kit.
  ~ In the morning the plates are empty and the candles have burned down. Somebody has left a pipe. Somebody has left a green scarf.
- Watch the candles
  ~ You watch the candles until they gutter. Every flame is yellow. Not one of them is blue.`,
    end: `~ {end}: the border, the desert, and the long road east across America.
~ The Taxman is waiting at the bridge with his folding table. He doesn't tax anyone. He's just sitting in the sun.
Taxman: I'm practising. For when there's nothing left to collect. I'm told this is called a holiday.` },
  // 32 The Long Road East
  { mid: `~ Memphis, then Nashville. Music out of every door.
~ {mate} learns three chords on a borrowed guitar and plays them for six hundred miles.
~ It drives everyone mad. The Count ticks along in time. It's the only one who likes it.`,
    end: `~ {end}: monuments, marble, and very long queues.
~ The Taxman spends the whole day writing a letter. Very carefully. Several drafts.
Taxman: My resignation. To Head Office. Effective the moment the Count completes.
Taxman: They won't accept it, of course. But when you finish, it won't be up to them.
? He asks you to witness it.
- Sign as witness {g.witness}
  ~ You sign. {mate} signs. Everyone signs. It's the first form you've ever been glad to fill in.
- "Are you sure?"
  Taxman: I've been sure since a blizzard in 1911. I've just been very slow about it.` },
  // 33 Lighthouse to Lighthouse
  { mid: `~ Peggy's Cove: a lighthouse on bare granite, above the most photographed rocks in Canada.
~ The keeper lets you up into the lamp room. The lens is huge: rings of glass and prisms, hundreds of them, round a single lamp.
Keeper ({keeper}): A Fresnel lens. Lighthouses have them. Hundreds of little prisms, all bending the light the same way.
Keeper ({keeper}): From far out at sea, at night, it doesn't look like one light. It looks like a hundred small ones. Like eyes.
!glitch
~ Nobody says anything. Then everybody says it at once.
mate: The hundred lights. Head Office. It's a lighthouse.
you: It's her lighthouse.`,
    end: `~ {end}, Newfoundland: the most easterly point in North America. Ahead, nothing but the Atlantic. And then Cornwall.
~ That night, very far out on the dark water, right at the edge of the world, you see it.
~ A beam, going round. Pale blue.
? You're looking at Morwenna's light from the other side of the ocean.
- Wave {g.waved}
  ~ You wave. It's daft. It's two thousand miles. The beam stutters, just once, like someone catching their breath.
- Turn away
  ~ You turn away. Behind you the beam keeps going round. It always has.
Ishbel: Aye. That's what I see from my end. Every night. I'm sorry I never said.
Ishbel: She's not evil. She's just been sat down for three hundred years with the light on. Come home.` },
  // 34 The Norse Way Back
  { mid: `~ Greenland: icebergs the size of cathedrals, breaking off into the fjord at Ilulissat with a noise like the world clearing its throat.
~ Kit walks beside you in plain daylight now. Anyone can see him. A little girl in Nuuk waves at him, and he waves back, astonished.
Kit: She saw me. Someone who isn't you saw me.`,
    end: `~ Þingvellir: where Iceland's parliament met in the open air for a thousand years, between two continents slowly pulling apart.
~ The squad holds its own vote. In the open air, like the Vikings did.
Taxman: Point of order. What happens to her light when you finish?
boss:algorithm (Grimm): It goes out. The bargain ends. The light goes out, and whatever it's been holding goes free.
mate: And Morwenna?
boss:algorithm (Grimm): I don't know. Nobody has ever finished.
? The squad votes. What do you want for Morwenna?
- She walks the last miles with us {g.votewalk}
  you: She walks the last bit. With us. She hasn't taken a step since 1724. It's time she did.
- Let the light go out, whatever happens {g.votedark}
  you: The light goes out. Whatever that means for her. She chose it, three hundred years ago.
- Ask Ishbel
  Ishbel: Don't ask me. I've been angry at her for three centuries. I'm the wrong person to ask.
  Ishbel: ...Bring her with you. Please.
  set g.votewalk
~ At {end} the river thunders into its canyon. The needle points south-east. Home.` },
  // 35 The Long Way Home (chapter 13 is written in full below)
  { mid: `~ St Kilda: islands so remote that in 1930 everyone living there asked to be taken away. The village is still there. Empty.
~ A row of stone houses with no roofs, facing the sea. Waiting for people who aren't coming back.
Kit: That's what I was. An empty house, waiting.
Kit: I'm not, any more. I'm a boy going home with his friends.`,
    end: "" },
];
// Season 40 (the last leg): chapter 12 and the grand finale, written in full.
const FINAL_12 = `@islands
~ Lundy: an island in the Bristol Channel, a few hours from Cornwall. One last ferry.
~ From the top of the island you can see it. Land's End. And the lighthouse, going round.
~ It isn't pale blue tonight. It's the colour of a phone at 3am. It has never been so bright.
Taxman: Head Office knows you're coming. It's turned everything up.
boss:algorithm (Grimm): Sunday will be bad. Every one of them will come through at once.
~ Brett. Rory. Wisp. Gale. The Kraken. Something with a club. Vex. Everything the Stillness ever kept, piling up behind the seam.
~ Holloway sits on a rock, turning his old hat round and round in his hands.
Holloway: She'll be in the lamp room. She always sat as close to the light as she could. Even at nineteen.
you: Will she be glad to see you?
Holloway: No. But she'll be glad to see you. Start there.
mate: So we mend it. Like always.
Kit: Like always.
? One night left before the last walk.
- Get some sleep {g.slept}
  ~ You sleep. Properly. All of you in a row in the island hostel. Rest is a stop with a morning after it.
- Sit up and talk
  ~ You sit up and talk until three. About Dartmoor. About Glastonbury. About the druid. Everyone laughs about the druid.
- Write home {g.wrotehome}
  ~ You write back to everyone you've ever left on read. Every single one. "Nearly home. Long story."
~ In the morning: the ferry. And then the last miles.`;
const FINAL_13 = `@lighthouse-night
~ Land's End. The last bit of England, and the wind wants it back.
~ You've walked round the world. You're back where Morwenna put a brass thing in your hand and said, "There you are."
~ The lighthouse is blazing blue. Every window in the town behind it glows the same.
!glitch
@the-glow
~ Then you're inside it. The lens. A hundred lights for eyes, all looking at you at once.
~ And at the centre, by the lamp, in a shawl, with a lantern in her lap: Morwenna. Exactly as she was. Sitting down.
Morwenna: There you are. I've had the kettle on since 1994. And before that, since 1724.
Morwenna: Do you know what it is now? The thing in my light?
you: Everyone who ever sat down and didn't get up.
Morwenna: It's tired. That's all it ever was. Tired and frightened and ever so comfortable.
Morwenna: I was the first door it found. I've been holding it open ever since.
~ Behind you: the squad. Kit. Grimm, in an old coat, with a three-cornered hat in his hands. The Taxman, his clipboard under one arm, unopened.
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
    Morwenna: But I'd like to walk out of here on my own feet, if you'll have me. Just as far as the cliff.
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
~ The Count chimes. Not thirteen times. Three hundred and sixty times: one for every mark, one for every stitch round the coat of the world.
@lighthouse-night
~ The beam goes out.
!dark
~ For one long breath there's no light at Land's End at all.
~ Then, in the town behind you, the windows change one by one. Blue to yellow. Screen to lamp. Someone opens a door. Someone goes for a walk.
!light
~ And on the cliff path, people. Lots of people, coming up out of the glow like swimmers surfacing.
~ A navvy in a flat cap. A man called Gerald, perfectly solid. Someone in an anorak from 1951. Four walkers in wool, one of them knitting.
~ Mabel hugs the Taxman so hard his bowler hat falls off. He doesn't pick it up.
~ Kit runs. Not ahead, not behind. Just runs, because he can. Then he turns round and waits for everyone, because he wants to.
Ishbel: Took your time.
~ Ishbel is at the gate. She hasn't left John o' Groats in three hundred years. She walked here.
~ Morwenna looks at her sister. Her sister looks at her. Nobody says anything. Nobody needs to.
Holloway: It's finished.
Morwenna: No. Nothing's finished. It just doesn't need holding any more.
~ She gives the Count back to you. It's still ticking. Of course it is.
Morwenna: It'll want walking, every winter. Not because the world will stop. Because walking is good, and you're good at it.
Morwenna: Six days walking, the seventh mending. The Stillness will still try its luck. It's very tired, and it loves a sofa.
Morwenna: But it hasn't got a door any more. Only windows. And you know what to do about windows.
~ The needle swings round. East. Of course it does.`;
// After the first lap round the world (season 41 on): a gentler loop.
const LAP2 = {
  open: `~ Second time round. The marks on the dial are all lit, and this time each one turns gold as you pass it.
Keeper ({keeper}): The Stillness hasn't got a door any more. But it still tries the windows. Something always comes through on a Sunday.
Taxman: And someone has to hold the clipboard. I volunteered. I missed it, if you can believe that.
~ Holloway walks with you some weeks now, hat on, knees complaining. Kit sends postcards. They all say: still walking.`,
  mid: `~ Halfway along the leg, a postcard from Morwenna. She's walked to Penzance and back. Twice. She's very pleased with herself.
Morwenna (Morwenna, by postcard): The light at Land's End is just a light now. White. Boring. I love it.
Morwenna (Morwenna, by postcard): Mind the windows. Keep walking.`,
  end: `~ At {end} the Count chimes, and another stretch of the dial turns gold.
Holloway: Every step a stitch. The coat keeps needing them. That's not a failure. That's what coats are for.`,
};

// The generator's pools. {place} {next} {prev} {route} {leg} {keeper} {kwho} {twist} {boss} {bossid} {bossline} {end} {start}
// are filled per chapter; {you} {mate} {mate2} {squad} {steps} are left for the player.
const ARRIVE = [
  "~ {place}. The Count ticks once as you arrive, like a nod.",
  "~ You reach {place} footsore and pleased with yourselves.",
  "~ {place} at last. Somebody cheers. Somebody else sits down on their rucksack and the Count goes cold until they stand up.",
  "~ The road into {place} is longer than the map says. They always are.",
  "~ You come into {place} in single file, counting heads, the way you always do now.",
];
const LOCALS = [
  `Local (A stallholder): Walkers? From where?
you: Cornwall.
Local (A stallholder): Is that near {next}?
mate: Sort of. If you go the long way round.`,
  `Local (A grandmother): You've got one of those brass things. My grandad said if anyone ever came through with one, give them soup.
~ You get soup. It's excellent soup.`,
  `Local (A shopkeeper): Every window round here has been glowing blue at night. My nan says it's the telly.
Local (A shopkeeper): My nan hasn't got a telly.`,
  `Local (A café owner): There was a man in here last week asking after you. Bowler hat. Clipboard.
Local (A café owner): He asked if you'd declared your breakfast.`,
  `Child: Why are you walking?
you: Because when enough people stop, things come through the gaps.
Child: ...Can I come?
mate: Ask your mum. Then walk to school. That counts too.`,
  `Local (A ferryman): People here say if you sit down in {place}, you'll never get up again. It's a joke.
Local (A ferryman): Mostly.`,
  `Local (A baker): Lovely evening for it. Mind the Taxman, though. He's been sitting at the bus stop since six.`,
  `Keeper ({keeper}): Holloway's map has a note here, you know. In the margin. "Good bread. Bad bed."
Keeper ({keeper}): Still true. On both counts.`,
  `Local (A night watchman): I've watched this road forty years. Nobody walks it at night any more. They all just glow at home.
Local (A night watchman): Nice to see some feet.`,
  `Local (A shepherd): The sheep don't like it when the windows go blue. They all face the other way.
mate: Sensible sheep.`,
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
  ~ Gasps all round. {mate} concedes. It's the first win in the game since Cornwall.
- Warm grapes
  mate: That's not a snack, that's a threat.
- Salty liquorice
  ~ Everyone who was on the Amber Road goes quiet and stares into the middle distance.`,
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
  "~ Behind you, on the road you've just walked, something with a club is walking too.",
  "~ That night every window in {place} glows blue at once, for a single second. Then they're normal again.",
  "~ The Count ticks twice, out of rhythm. It does that when something's following.",
  "~ In the morning there's a word in the frost on the tent: STOP. Somebody has crossed it out.",
  "~ Far off, beyond the edge of the map, a hundred small lights blink. All together. Like eyes.",
  "~ The road on to {next} disappears into the dark. You'll walk it tomorrow. Together.",
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
  "~ The Count only counts real steps, taken together. Out here, every one of them is real.",
  "~ Every window you pass is lit. Some of them are blue. You walk a bit quicker past those.",
  "~ Somewhere behind you, a seam is fraying where people have sat too long. Your steps are the thread.",
  "~ Six days walking, the seventh mending. Today is a walking day. Most days are.",
  "~ The Count ticks steadily in someone's pocket. While it ticks, nothing gets through for free.",
];
const ENDCHOICE = [
  `? Before you leave {place}...
- Send Ishbel a postcard
  ~ It says: still walking. She'll know what it means.
- Buy snacks for the road
  ~ You buy far too many snacks. They're gone by lunchtime.
- Take one last look
  ~ You take one last look. {place} looks back, the way places do when you've walked to them.`,
  `? The squad pauses at the edge of {place}.
- Count heads
  ~ You count heads. Everybody's here. The Count ticks, satisfied.
- Retie your laces
  ~ You retie your laces. Small things, done properly, are how you get round the world.
- Keep going
  ~ You keep going. You always do.`,
];
const FAREWELL = `? The season's done. What now?
- Sleep for a week
  ~ You sleep for one night. It feels like a week. The Count doesn't mind; rest is a stop with a morning after it.
- Get chips
  ~ You get chips. Wherever in the world you are, there's always somewhere doing chips.
- Look at the map
  ~ You look at the map. The dotted line goes on, round the curve of the world, towards home.`;
function bossSeg(id, name, st) {
  const extra = id === "leftonread" && st >= 5 && st < 41 ? "\n~ It isn't Kit, quite. It's the part of him the Stillness still keeps. The left-behind part." :
    id === "algorithm" && st >= 10 && st < 41 ? "\n~ It isn't Grimm. Not the one who walks with you now. It's what's left of him in there, wearing his shape." : "";
  const shown = id === "algorithm" && st >= 10 ? " (The shape of Grimm)" : "";
  return `!shake
~ Somebody at {place} sat down too long. The seam has slipped, and {boss} has come through.
boss:{bossid}${shown}: {bossline}${extra}
~ {bossbeat}
? {boss} is between you and {next}.
- Stand together
  ~ You stand together, shoulder to shoulder. {boss} hits the wall of you and bounces off, for now.
- Keep walking past it
  ~ You keep walking, all of you, eyes front. It follows, sulking. It'll still be there on Sunday.
- Shout its name
  you: We know you, {boss}!
  ~ It hates that. Things from the Stillness hate being named. It slinks back to the edge of the seam.
~ It isn't Sunday yet. You'll settle it then. Six days walking, the seventh mending.`;
}
function taxSeg(st) {
  const why = st >= 41 ? "Taxman: Because somebody has to, and I'm good at it, and I find I quite like you lot." :
    st >= 31 ? "Taxman: Because the terms say so until the Count comes round. Nearly there. I can almost smell the sea." :
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
  ~ He eats it anyway. Slowly. Like he's forgotten biscuits.`;
}
function squadSeg() {
  return `~ {squadbeat}
{squadchoice}`;
}
function clueSeg(kind, st) {
  if (kind === "grimm") {
    const line = st >= 41 ? "~ Holloway walks beside you today, hat on, knees complaining. He points out every view, as if he built them." :
      st >= 21 ? "~ Grimm walks ahead now, most days, rolling rocks off the road and straightening signposts. He writes NO on things." :
        st >= 10 ? "~ Grimm walks with you some days, at the back, saying nothing. When he falls behind, someone always waits." :
          "~ Every day you see him, a long way back: Grimm, following. Stopping when you stop. Starting when you start.";
    return `${line}
? Grimm is watching.
- Wave
  ~ You wave. After a long moment, a huge blue hand lifts. Then drops again, quickly, as if it's embarrassed.
- Call him over
  you: Grimm! Walk with us!
  boss:algorithm (Grimm): ...Not yet.
- Leave him be
  ~ You leave him be. Some people have to arrive at things on their own.`;
  }
  if (kind === "lights") {
    const line = st >= 33 ? "~ That night, at the edge of the sea, the hundred blue lights are very close now. They go round. Once a minute. Like a beam." :
      st >= 20 ? "~ That night, from a high place, you see them again: a hundred small blue lights at the very edge of the world. Closer than before." :
        "~ That night, from a high place, you see something no map shows: far off at the edge of everything, a cluster of small blue lights. Like eyes.";
    return `${line}
? The lights are watching.
- Watch them back
  ~ You watch them. They blink, all at once, and look away first.
- Turn away
  ~ You turn away. The back of your neck stays cold for an hour.`;
  }
  if (kind === "kit") {
    const line = st >= 41 ? "~ A postcard from Kit. On the front, a picture of the sea. On the back: STILL WALKING. NOT WAITING. K." :
      st >= 30 ? "~ Kit walks with you all afternoon, nearly solid, telling {mate} about 1732 like it was last week." :
        "~ There's frost on the inside of the tent this morning, though it isn't cold. Small handwriting: KEEP GOING. I'M BEHIND YOU.";
    return `${line}
? You think about Kit.
- Leave a gap in the line for him
  ~ You leave a gap in the line, one person wide. Nobody fills it. Nobody needs to explain why.
- Say his name
  you: Kit.
  ~ Somewhere behind you, something cold gets a little warmer.`;
  }
  // map note
  const notes = st >= 20 ? ["I miss the boy.", "Morwenna would have liked this view.", "Turn round, Abiah. Turn round.", "Good bread. Bad bed. Worse conscience."] : ["Mind the dogs.", "Good bread. Bad bed.", "Walked this in the rain. Would not recommend.", "Probably something good here."];
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
// Degrees of longitude east of Land's End at the end of a leg (the lit marks on the dial).
function marksAt(legs, li) {
  let lon = 16.37, prev = 16.37;
  for (let i = 0; i <= li; i++) for (const l of legs[i].landmarks) { let x = l.at[0]; while (x - prev < -180) x += 360; while (x - prev > 180) x -= 360; lon += x - prev; prev = x; }
  return Math.min(360, Math.max(0, Math.round(lon + 5.71)));
}
function bgFor(name, X, r) {
  const n = name.toLowerCase();
  if (/lake|loch|inle|tonl|titicaca/.test(n)) return "lake-mist";
  if (/volcano|yanar|sakurajima|taal|arenal/.test(n)) return "tor-sunset";
  if (/salar|uyuni/.test(n)) return "snowfield";
  if (/canyon|desert|uluru|kings canyon|coober|lake eyre/.test(n)) return "red-desert";
  if (/mount|pass|peak|shan|aoraki|chimborazo|cotopaxi|huascar|muztagh|kinabalu|rinjani|nemrut|erciyes|ararat|olympus|fuji|gora|cones/.test(n)) return "peak-cloud";
  if (/wall|fort|castle|badaling|mutianyu|jinshanling|dragon's head|hwaseong/.test(n)) return "wall-dusk";
  if (/bridge/.test(n)) return "river-dusk";
  if (/falls|gorge|valley|gullfoss|geysir/.test(n)) return "forest-mist";
  if (/temple|wat|pagoda|monastery|abbey|sanctuary|tongdosa|yonggungsa|bagan|vihear|kuk|rock$/.test(n)) return "temples-dusk";
  if (/island|isle|bay|sound|strait|cove|reef|batanes|yasawa|islands/.test(n)) return "islands";
  if (/lighthouse|cape|spear|reinga/.test(n)) return "lighthouse-night";
  return X.bgs[Math.floor(r() * X.bgs.length)];
}
function sentences(p) { return String(p).split(/(?<=[.!?])\s+(?=[A-Z“"])/).map((s) => s.trim()).filter(Boolean); }

function generated(n, k) {
  const A = legAt(n);
  if (!A) return parse(`@road-night\n~ The road goes on. The Count ticks. You walk.`);
  const { W, legs, li, lap, leg, next } = A, B = W.beats || {};
  const X = LEGX[li] || { keeper: "the keeper", bgs: ["road-night"] }, L = leg.landmarks;
  const st = lap > 0 ? 41 + li : n; // story stage: how far round the world the story is
  const sr = rng(hash("season:" + n)), cr = rng(hash(`s${n}:ch${k}`));
  const pick = (arr) => (arr && arr.length ? arr[Math.floor(cr() * arr.length)] : "");
  const deal = (arr, key) => { if (!arr || !arr.length) return ""; const sh = shuffle(arr.map((_, i) => i), rng(hash(`s${n}:${key}`))); return arr[sh[(k - 1) % sh.length]]; };
  void sr;
  const affix = affixFor(n), twist = affix.split("+").map((a) => AFFIX_NAMES[a]).join(" and ");
  const boss = BOSSES[(n + (k - 1)) % BOSSES.length];
  const place = L[k - 1].name, nextName = k < 13 ? L[k].name : (next.landmarks[1] || next.landmarks[0]).name;
  const marks = lap > 0 ? 360 : marksAt(legs, li);
  const kwho = X.who || "Keeper", keeperSpeaker = X.who ? `${X.who}` : `Keeper (${X.keeper})`;
  const V = {
    place, next: nextName, prev: L[Math.max(0, k - 2)].name, route: leg.route, leg: leg.name, keeper: X.keeper, twist, n: String(n),
    boss: boss[1][0].toUpperCase() + boss[1].slice(1), bossid: boss[0], bossline: pick(BOSS_QUOTES[boss[0]]), end: L[L.length - 1].name, start: L[0].name,
    marks: String(marks), nextleg: next.name, nextroute: next.route,
  };
  const wfill = (t) => String(t || "").replace(/\{place\}/g, place).replace(/\{next\}/g, nextName).replace(/\{route\}/g, leg.route)
    .replace(/\{boss\}/g, V.boss).replace(/\{twist\}/g, twist).replace(/\{count\}/g, "the Long Count");
  const beat = (kind, key) => sentences(wfill(deal(B[kind], key)));
  const narr = (lines, max) => lines.slice(0, max).map((s) => `~ ${s}`).join("\n");
  V.bossbeat = beat("boss", "boss").slice(0, 2).join(" ") || "It's a long, messy fight, and you finish it standing.";
  V.taxbeat = beat("taxman", "tax").slice(0, 2).join(" ") || "He has a new form. It's longer than the last one.";
  V.squadbeat = beat("squad", "squad").slice(0, 3).join(" ") || "The squad keeps going, the way it does.";
  V.squadchoice = deal(SQUAD_CHOICES, "sqc");
  const keeperLine = (t) => (X.who ? `${X.who}: ${t}` : `Keeper (${X.keeper}): ${t}`);
  void kwho; void keeperSpeaker;
  const parts = [];
  const bg = k === 1 ? X.bgs[0] : bgFor(place, X, cr);
  parts.push(`@${bg}`);

  if (k === 1) {
    parts.push(`~ {start}. Season {n}: {leg}. The route runs {route}.`);
    parts.push(narr(beat("opening", "open"), 3));
    if (lap > 0) parts.push(LAP2.open);
    else {
      parts.push(X.who ? `${X.who}: Hello again, dears. I walked here. Took the long way. Ishbel asked me to see you home.` :
        pick([keeperLine("You'll be Morwenna's lot. Ishbel wrote. She said you'd be late. You're late."),
          keeperLine("Every road has a keeper. I'm this one's. I've had the kettle on since your needle moved."),
          keeperLine("Holloway's dotted line comes right past my door. Nobody's walked it in three hundred years. Until you.")]));
      parts.push(keeperLine("There's a little blue in my lamp, same as all of ours. Don't look at it too long."));
    }
    parts.push(keeperLine("The locals call this season {twist}."));
    for (const a of affix.split("+")) for (const t of AFFIX_LORE[a] || []) parts.push(keeperLine(t));
    parts.push(keeperLine("Six days walking, the seventh mending. And mind the Taxman between six and nine. But you know all that."));
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
    parts.push(narr(beat("landmark", "land"), 2));
    if (lap > 0) parts.push(LAP2.end);
    else if (SAGA[li] && SAGA[li].end) parts.push(SAGA[li].end);
    parts.push(`@signpost-dawn`);
    parts.push(narr(beat("finale", "fin"), 3));
    parts.push(lap > 0 ? `~ All three hundred and sixty marks are lit, and more of them glow gold now than last time.` :
      `~ When the chimes stop, {marks} of the three hundred and sixty marks on the dial are glowing.`);
    parts.push(`Ishbel (Ishbel, by text): Further. Next: {nextleg}. {nextroute}.`);
    parts.push(pick([`Ishbel (Ishbel, by text): Eat something green.`, `Ishbel (Ishbel, by text): Count heads. Always count heads.`, `Ishbel (Ishbel, by text): Proud of you. Don't tell anyone I said that.`]));
    parts.push(FAREWELL);
  } else {
    parts.push(pick(ARRIVE));
    parts.push(narr(beat("landmark", "land"), 3));
    parts.push(deal(REMIND, "rem"));
    parts.push(deal(LOCALS, "local"));
    if (k === 7) {
      const mid = lap > 0 ? LAP2.mid : SAGA[li].mid;
      parts.push(mid);
      if (!/(^|\n)\? /.test(mid)) parts.push(deal(ENDCHOICE, "endc"));
    } else if (k === 12) {
      parts.push(`~ One more week. The end of {route} is close enough to smell.`);
      parts.push(st >= 10 && st < 41 ? `boss:algorithm (Grimm): Last stretch. This is where people sit down. I would know.` : `Taxman: Final week. Do try not to make my paperwork any more difficult than usual.`);
      parts.push(`? The light's going. {end} is close.
- Push on tonight
  ~ You push on in the dark. Head torches. Silly songs. The Count ticks louder with every mile.
- Rest and go at dawn {g.rested}
  ~ You rest. Properly. Rest is a stop with a morning after it, and the morning comes, and you go.`);
    } else {
      const kind = { 2: "clue", 3: "boss", 4: "squad", 5: "taxman", 6: "boss", 8: "squad", 9: "boss", 10: "clue", 11: "taxman" }[k];
      if (kind === "boss") parts.push(bossSeg(boss[0], V.boss, st));
      else if (kind === "taxman") parts.push(taxSeg(st));
      else if (kind === "squad") parts.push(squadSeg());
      else parts.push(clueSeg(["map", "grimm", "lights", "kit"][(n + k) % 4], st));
    }
    if (k !== 7) parts.push(deal(BANTER, "ban"));
    parts.push(pick(CLIFF));
  }
  let src = parts.filter(Boolean).join("\n");
  // Season 40: the last two chapters are written in full.
  if (lap === 0 && li === legs.length - 1 && k === 12) src = FINAL_12;
  if (lap === 0 && li === legs.length - 1 && k === 13) src = FINAL_13;
  src = src.replace(/\{(place|next|prev|route|leg|keeper|twist|n|boss|bossid|bossline|end|start|marks|nextleg|nextroute|bossbeat|taxbeat|squadbeat|squadchoice)\}/g, (m, key) => V[key] ?? m);
  // second pass for placeholders that came in through the beats
  src = src.replace(/\{(place|next|boss|end)\}/g, (m, key) => V[key] ?? m);
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
    body = [{ bg: "road-night" }, { narrate: "The road goes on. The Count ticks. You walk." }];
    if (typeof console !== "undefined") console.warn("EffortStories:", e && e.message);
  }
  // the opening scene goes behind the title card
  const lead = body[0] && body[0].bg && Object.keys(body[0]).length === 1 ? [body.shift()] : [];
  const out = [...lead, { card: `Season ${n} · Chapter ${k}`, sub: title(n, k) }, ...body];
  if (k === 13) {
    const A = n > 4 ? legAt(n) : null, finalLap = A && A.lap === 0 && A.li === A.legs.length - 1;
    out.push(finalLap ? { card: "The end of the long way round", sub: "Every step a stitch" } : { card: `End of Season ${n}`, sub: seasonName(n) });
  }
  return JSON.parse(JSON.stringify(out));
}

root.EffortStories = { chapter, title, seasonName, BOSS_LORE, EVENT_LORE, parse };
})(typeof window !== "undefined" ? window : globalThis);
