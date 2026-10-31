// The deep ladder: seasons 5 to 40. Seasons 1 to 4 live in seasons.js and stories.js.
// Every season walks the boss ladder through the realms behind the seam, one realm a week: the Blotmarsh, Puffcap
// Hollow, the Hushfrost Reach, the Spindrift Isles, the Lowmost Deep, the Misrendered Realm and the Gilded Void, then
// round again deeper (weeks 8 to 13, ending in the Misrendered Realm). Each season is one "cycle" of that walk, one
// rung further down Holloway's ladder. Chapters 1 to 7 are named after the realm's checkpoints on the journey map
// (realms.js); chapters 8 to 13 after places past the lair, deeper in. Everything here is deterministic.
// Exposes window.EffortWorld = { legs, beats, REALMS, realmOfChapter }. `legs` keeps the shape app.js reads:
// { name, route, blurb, landmarks: [{ name }] x 13 }, plus keeper and theme for the story generator.
(function (root) {
"use strict";

// The seven realms in ladder order. cps = the checkpoints on the journey map (same names as realms.js).
// deep = places past the lair, used for the second time round in a season.
const REALMS = [
  { id: "blotmarsh", name: "The Blotmarsh", boss: "notification", bossName: "Brett",
    cps: ["Murkwater Ford", "The Leech Inn", "Hangman's Willow", "The Drowned Chapel", "Bogbody Crossing"],
    deep: ["Sallowmere", "The Sinking Fair", "Mothermud", "The Sunken Choir", "Gulp Hollow", "The Weeping Locks", "Rotfen Weir", "The Mire Bells", "Bladderwrack Row", "The Low Ooze", "Gloaming Staithe"] },
  { id: "puffcap", name: "Puffcap Hollow", boss: "autoplay", bossName: "Rory",
    cps: ["Spore Gate", "The Fairy Ring", "Gillwood", "The Puffball Fields", "Rotroot Stair"],
    deep: ["The Mycelium Road", "The Sleeping Orchard", "Cap and Bells", "The Rot Cathedral", "Snoozewort Dell", "The Gill Market", "Underspore", "The Nodding Woods", "Lamplight Morels", "The Long Sofa", "Velvetshank Lane"] },
  { id: "hushfrost", name: "The Hushfrost Reach", boss: "leftonread", bossName: "Wisp",
    cps: ["Whisper Pass", "The Shivering Stones", "Icetooth Arch", "The Last Lantern", "Glassdeep Crevasse"],
    deep: ["The Hush Below", "Stillwater Ice", "The Mourning Seracs", "Frostbite Steps", "The Unanswered Hall", "Pale Cairn", "The Quiet Fathom", "Ninefold Drift", "The Blue Hour", "Lantern Dark", "Rimehold Bothy"] },
  { id: "spindrift", name: "The Spindrift Isles", boss: "scroll", bossName: "Gale",
    cps: ["Kite Rock", "The Weathervane", "Thunderhead Bridge", "The Broken Mill", "Eye of the Gust"],
    deep: ["The Kite Graveyard", "The Clockwork Isle", "Windward Last", "Gyre Harbour", "The Upturned Isles", "Sparrowfall", "The Ninth Gust", "Tetherpost", "Squall Market", "The Spinning Chapel", "Loose End"] },
  { id: "lowmost", name: "The Lowmost Deep", boss: "kraken", bossName: "the Kraken",
    cps: ["The Last Buoy", "Wreck of the Merry Ann", "Kelpwood", "Glowmouth Reef", "The Inkfall"],
    deep: ["The Maelstrom Stair", "The Sunken Lamp", "The Black Shelf", "Three O'Clock Trench", "The Drowned Library", "Lanternfish Row", "The Pressure Gate", "Scrollweed Beds", "The Last Bubble", "Under the Throat", "The Brine Cellars"] },
  { id: "misrendered", name: "The Misrendered Realm", boss: "algorithm", bossName: "Grimm",
    cps: ["The Flicker Gate", "Duplicate Hill", "The Upside Down Inn", "Missing Texture Woods", "The Loop Road"],
    deep: ["The Copy of Home", "The Last Tollgate", "The Render Shore", "Glitchwater Mill", "The Unfinished Street", "The Recommended Road", "The Buffering Fields", "The Second Town", "Placeholder Hill", "The Table by the Window", "The Undo Stair"] },
  { id: "gildedvoid", name: "The Gilded Void", boss: "dragon", bossName: "Vex",
    cps: ["Moonwharf", "The Comet's Tail", "The Knights' Drift", "The Burnt Constellation", "The Coin Nebula"],
    deep: ["The Hoard's Edge", "The Lost Evenings", "The Gold Road"] },
];
// Chapter k (1-13) is set in the realm the ladder reaches that week: 1-7 once through, 8-13 round again, deeper.
const realmOfChapter = (k) => REALMS[(Math.max(1, Math.min(13, k)) - 1) % REALMS.length];

// One cycle per season, 5 to 40. keeper = who meets the squad at Monday camp; theme = what has changed this time
// (finishes the sentence "This time round, ...").
const CYCLES = [
  ["The First Rung", "From the Blotmarsh down the first rung", "Holloway's letter was right: the realms go deeper. Under the seven doors there's a ladder, forty rungs long, and the Count wants climbing down it.", "Hesketh Moss", "the seam opens a rung lower than before, and every realm is a shade darker for it"],
  ["Rising Damp", "From a flooded Blotmarsh into every realm below", "The Blotmarsh has burst its banks. Brett's swamp water is seeping into all seven realms, and everything smells faintly of pond.", "Wenna Clay", "the Blotmarsh is leaking into everything, so every realm is a bit soggy"],
  ["Spore Season", "From Puffcap Hollow's gate to the bottom of the Void", "The puffcaps are fruiting. Spores drift from realm to realm on the wind, and wherever they settle, somebody wants a sit-down.", "Old Gill", "the spores are out, and they get into every realm, so mind where you sit"],
  ["The Long Hush", "Through seven realms with the sound turned down", "Something has turned the volume down in every realm. You walk in near silence, and Wisp likes it very much.", "Tamsin Rook", "the realms have gone quiet, so you'll hear things coming late, and they'll hear you early"],
  ["Loose Moorings", "From the Blotmarsh to the Void by drifting island", "Gale's islands have slipped their ropes and drifted into the other realms. There's an island in the Blotmarsh now. Nobody is happy.", "Bram Ashby", "the Spindrift Isles have come untied and wandered off into the other realms"],
  ["Low Water", "Down to where the Lowmost Deep has drained", "The Lowmost Deep is draining downwards. The wrecks are standing on dry sea floor for the first time in centuries, and the Kraken is in a mood.", "Nell Quarry", "the water is going out of the Lowmost Deep, and it's going somewhere"],
  ["Copy Errors", "Through realms Grimm has started to redraw", "The Misrendered Realm is spreading. Bits of the other realms have started loading wrong: two moons, square puddles, a tree that's only a picture of a tree.", "Corin Pike", "bits of every realm have started loading wrong, and you can't always trust a bridge"],
  ["The Gold Rush", "From the Blotmarsh to a Gilded Void that's spilling", "Vex's hoard has outgrown the Void. Loose hours are raining down into the other realms, and people back home are picking them up in their sleep.", "Dilys Fenn", "Vex's hoard is overflowing, and loose hours are lying about everywhere"],
  ["Two by Two", "Every realm twice over, with the next one showing through", "Two twists at once now, and the realms come in pairs: through the gaps in this one you can see the next.", "Ezra Thorne", "the realms are thin enough to see through, one into the next"],
  ["The Undertow", "From the Blotmarsh to the bottom of the Deep, and down", "Everything is being pulled downwards. Rivers run downhill into holes. Even the fog sinks.", "Hal Merrow", "everything in the realms is sliding downhill, and so, if you're not careful, are you"],
  ["Lanterns Out", "Through seven realms with the lamps going dark", "Somebody is putting out the lanterns that light the paths between realms, one a night. The Taxman denies everything, which is suspicious, because he usually takes the credit.", "Lowen Brack", "the path lanterns are going out one by one, and somebody is doing it on purpose"],
  ["The Halfway Rung", "Down to the middle of Holloway's ladder", "Halfway down. The Count's ticking has gone deeper, like a clock in a cellar. The creatures are older down here, and they remember you.", "Ada Penrose", "you're halfway down the ladder, and the creatures have long memories"],
  ["The Hundred Lights", "Towards the blue lights at the bottom of everything", "From the halfway rung you can see them: a hundred small blue lights, far below, like eyes. This season you walk towards them.", "Ottilie Marsh", "the hundred blue lights are visible from every realm, if you look down"],
  ["Head Office", "From the Blotmarsh to the Taxman's employers", "The Taxman has been called in to Head Office for a review. He wants you to come too. He won't say why.", "Seth Hollins", "the Taxman is walking with you, and he is not enjoying it"],
  ["Old Debts", "Through the realms the 1911 squad walked", "The 1911 squad left marks in every realm: Mabel's knitting, Arthur's pipe, Ruth's map, and Sidney's terrible jokes carved into trees.", "Jem Haddow", "you're following the 1911 squad's old route, mark by mark"],
  ["Krampus Weather", "Across seven realms with a bailiff behind you", "Something with horns and a sack is following the squad from realm to realm. It's early for December. It doesn't care.", "Jory Fell", "something with horns is keeping a list of who sits down"],
  ["The Boot Fair", "From the Blotmarsh to the Void, collecting boots", "Every squad that ever stopped left its boots behind. This season the realms are giving them back, one pair a week.", "Cass Whitlow", "the realms are coughing up the boots of everyone who ever stopped"],
  ["The Sleepers", "Through realms full of people who sat down", "This deep, the realms are full of sleepers: people from home who sat down in the glow and never got up. They're dreaming. Some of them are dreaming of you.", "Pell Ambrose", "every realm is full of sleepers, and you have to walk quietly past them"],
  ["Wrong Way Up", "From the Misrendered Realm's edge back round to it", "Grimm's realm has flipped the ladder. Every realm looks upside down until you stop looking at it.", "Wren Calloway", "every realm is upside down, and the sky is underfoot"],
  ["The Chorus", "Through seven realms that have started to sing", "Down here every realm hums. The Blotmarsh croaks in a low C. The Hushfrost hums so high that only dogs and Kit can hear it.", "Ivo Stannard", "every realm hums a different note, and together they almost make a tune"],
  ["Weather Swap", "From a frozen Blotmarsh to a melting Void", "The realms are swapping weather. Snow in Puffcap Hollow. Gold dust in the Hushfrost. Bubbles drifting up through the Spindrift Isles.", "Meg Tolliver", "the realms have swapped their weather, and nothing is dressed for it"],
  ["The Missing Hour", "Through realms that have each lost an hour", "Somebody has stolen an hour from every realm. The clocks are all wrong, and Vex looks very pleased with herself.", "Rafe Kettley", "every realm is an hour short, and the creatures are an hour early"],
  ["Deep Water", "Down to the Lowmost Deep, and through the floor of it", "The Kraken has dug a hole in the bottom of the Lowmost Deep. Of course it has. This season you go down it.", "Sennen Hale", "the sea floor of the Lowmost Deep has a hole in it, and everything drains that way"],
  ["The Second Lamp", "Towards a light that goes round at the bottom", "Far below, one of the hundred blue lights has started to go round. Once a minute. Like a beam.", "Agnes Treloar", "one of the lights far below has started going round like a beam"],
  ["Kit's Way", "Down the road Kit walked, rung by rung", "Kit remembers the way now. He walks at the front this season, showing you the short cuts he found in three hundred years of following.", "Kit", "Kit is leading, and he knows every short cut"],
  ["The Register", "Through realms where every name is written down", "Holloway's old register has turned up again, and the names on it are going, one by one, as if somebody is crossing them off.", "Prue Dunmore", "names are being crossed off a list, and you'd like to know whose pen it is"],
  ["Nobody Left", "From the Blotmarsh to the Void, counting heads", "The creatures have changed their tactics. They've stopped trying to beat the squad. They're trying to split it up.", "Hesketh Moss", "the creatures are trying to split the squad, so count heads twice a day"],
  ["The Long Sofa", "Through realms that want you to sit down", "Everywhere you go this season there's somewhere to sit. Comfy, warm, exactly right. The realms are getting desperate.", "Wenna Clay", "every realm has laid out somewhere lovely to sit, and you mustn't"],
  ["Glass Floors", "Over realms with the bottom showing through", "The floor of every realm has gone as thin as glass. Underneath, a long way down, the hundred blue lights look up at you.", "Tamsin Rook", "the floors have gone thin, and the lights below can see you"],
  ["Every Step a Stitch", "Seven realms, mending as you go", "The seams are fraying faster than ever. This season every step stitches something, and you can see the stitches behind you, glowing gold.", "Bram Ashby", "you can see your own stitches behind you, gold in the dark"],
  ["Under the Lamp", "To the foot of a lighthouse standing on its head", "At the bottom of the ladder there's a lighthouse, standing on its head, with its lamp at the very bottom of everything. You know whose it is.", "Nell Quarry", "the bottom of the ladder is close, and so is the lamp"],
  ["All Hands", "Every realm at once, with everyone who ever walked", "Everyone who was ever left behind is walking now: the 1874 lot, the 1911 lot, the 1951 lot, the Summit Committee. The paths are crowded.", "Margaret", "everyone who ever stopped is walking again, and the paths are full"],
  ["The Stillness", "Down to the thing that sits at the bottom", "You've walked down through every realm to the bottom. Something is sitting there. It has been sitting there since before there were sofas.", "Corin Pike", "you're near the bottom, and something down there is breathing very slowly"],
  ["The Last Rungs", "Down the last of Holloway's ladder", "The ladder is nearly done. The rungs are cold and very old, and someone has scratched names into every one.", "Dilys Fenn", "the last rungs are cold, and every one has names on it"],
  ["The Vote", "Through seven realms to a decision", "The squad has a choice to make about Morwenna, and thirteen weeks to make it.", "Ezra Thorne", "the squad has a choice to make, and the realms are listening"],
  ["The Last Lamp", "Up through the seam to Morwenna's light", "The last season of the ladder. Seven realms one more time, and then the lamp.", "Ishbel", "it's the last time down, and the lamp is waiting"],
];

const legs = CYCLES.map(([name, route, blurb, keeper, theme], i) => ({
  name, route, blurb, keeper, theme,
  landmarks: Array.from({ length: 13 }, (_, j) => {
    const R = REALMS[j % REALMS.length];
    const pool = j < REALMS.length ? R.cps : R.deep;
    const name = pool[(i * (j < REALMS.length ? 2 : 3) + j) % pool.length];
    return { name, realm: R.id };
  }),
}));

// Story beats. The six kinds app.js reads (opening, landmark, boss, taxman, squad, finale) work in any realm.
// Placeholders: {place} current place, {next} next place, {route} the season's route, {boss} a boss name,
// {twist} the season's twist name, {count} always "the Long Count" (never at the start of a sentence).
// `arrive` and `folk` are per realm and used by stories.js only: near = the first time through in a season,
// deep = the second time, past the lair.
const beats = {
  opening: [
    "The seam lets you out at {place}, a rung lower than last time. In someone's pocket {count} is ticking, impatient, like a dog by the door.",
    "Every season starts the same way. Somebody says it's too far down. Somebody else points out that they said that last time. Then you all step through to {place} anyway, with {count} wound and ticking.",
    "Holloway's map has almost nothing on it this deep. Just the dotted line going down and, in tiny handwriting, the words: keep going. You start at {place}.",
    "{place} smells exactly the way it did last time, only more so. Somebody says it's further down than they remember. Everybody pretends not to have heard.",
    "A postcard from Ishbel is waiting at {place}, addressed to the squad. It says: {route}. Thirteen weeks. Stay together. Underneath, in smaller writing: and eat something green.",
    "For weeks the needle on {count} has been pointing down, and now that you're through at {place} it seems very pleased with itself. Another rung of the ladder on its back is waiting to light up.",
  ],
  landmark: [
    "{place} turns out to be exactly as far as everyone said, and then a bit further. You get there footsore and pleased with yourselves. The Count gives one short tick, like a nod.",
    "There's a woman selling tea at {place} who has watched a lot of walkers come through. She looks at the Count and gives you all a second cup for free. She doesn't explain, and nobody asks.",
    "At {place} someone finds a rack of postcards, which makes no sense this far behind the seam, and buys one for everybody back home. Most of them just say: still walking. Which is true.",
    "You reach {place} late, in the dark, which is not how anybody pictured it. In the morning you see it properly and decide it was worth it. {next} is the next name on the map.",
    "A child at {place} asks what the brass thing is. Someone explains: it counts steps, but only if you take them together. The child thinks about this and says that's a rubbish pedometer. It's hard to argue.",
    "The ticking gets louder as you come into {place}. {count} does that at the places that matter, and nobody has worked out the rule. Someone suggests it just likes a nice view.",
    "Someone at {place} asks where you've walked from. You tell them: a town with blue windows, through a lighthouse, down a seam. They ask again, more slowly, in case they misheard.",
    "At {place} the squad splits up for an hour: one to find food, one to find plasters, one to find somewhere to dry socks, one to keep watch. Everyone comes back with the wrong thing. It works out.",
    "There's a walking club at {place}, all of them over seventy, all of them a bit see-through. They leave you for dead on the first hill and buy you lunch afterwards out of pity.",
    "At {place} the Count stops ticking for a full minute. Everyone panics. Then it starts again, louder, and you realise you'd all stopped at the same moment to look at something, and it was waiting for you.",
    "The path into {place} is longer than it looks on the map. They always are. Someone starts a game of I spy that lasts four hours and ends in an argument about whether fog counts as a thing.",
    "Pressed into an old path near {place} is a line of footprints, gone hard long ago, walking the same way you are. Nobody knows whose they are. You walk in them for a bit anyway.",
    "At {place} somebody's boot finally gives up. There's a cobbler, because there's always a cobbler, even here, and he fixes it in ten minutes for a price nobody understands.",
    "Holloway's map has a blank space roughly where {place} should be, with a note in the margin: probably something good here. He was right.",
    "There's a market of some kind at {place}, and nobody can tell you what it's for. Someone wins a raffle. The prize is enormous and has to be carried all the way to {next}.",
    "At {place} you find a bench and, very carefully, do not sit on it. You stand round it and eat your sandwiches instead. The bench looks disappointed.",
    "You come into {place} single file, because the path is narrow. Someone at the front counts you in, like a teacher on a school trip, and everyone answers. Nobody wants to be the one who stops doing it.",
    "Nobody remembers who suggested the detour at {place}. It's an hour each way and worth every minute. Then it's on towards {next}, a bit slower and a lot happier.",
  ],
  boss: [
    "{boss} is waiting at {place}, and has been for some time by the look of things. You've met before. Down here, with {twist} in the air, it doesn't feel like it.",
    "First there's a noise somewhere behind you, getting closer. Then {boss} arrives. Nobody runs. You turn round together, find your places and get ready.",
    "{boss} comes out of nowhere just short of {place}. It's a long, messy scrap and at one point someone loses a shoe. You finish it standing, all of you, and {count} ticks loudly enough to hear across the realm.",
    "{boss} didn't come here by accident. There's a note pinned to a post at {place}, in big blue capitals: STOP. Underneath, someone in the squad writes NO, and you get on with it.",
    "{boss} has caught this season's trouble too. The keeper called it {twist}, and it makes everything harder going than you remember. You adjust, the way you've learnt to.",
    "{boss} has learnt a few things since last time. So have you. At {place} you find out whose lessons were better.",
    "{boss} catches up with you between {place} and {next}, in the worst possible spot, with nowhere to go. That turns out to be a good thing. With nowhere to go, nobody goes anywhere, and you see it off together.",
    "{boss} has turned up three times this season. Someone has been keeping a tally on the back of a receipt, and the receipt is getting full.",
    "{boss} arrives at {place} in a hurry and leaves in a worse one. In between there's a lot of shouting, some excellent teamwork and one moment that nobody will ever be allowed to forget.",
  ],
  taxman: [
    "The Taxman has set up a folding table at {place}. The sign says Walking Levy: All Steps Over Ten Thousand. You walk round the table. He follows you with a calculator.",
    "A letter from the Taxman catches up with you at {place}. It's eleven pages long and lists every step you've taken this season, with an invoice for each one. It makes excellent kindling.",
    "The Taxman has been learning the local language at {place}. So far he's got as far as receipt, penalty and I'm afraid that isn't my department.",
    "The Taxman and Grimm are seen having lunch together at {place}. They split the bill to the penny. Grimm pays in coins, one at a time, very slowly, and the Taxman counts every one.",
    "The Taxman claims {place} has a special local tax on anything made of brass. Nobody can find any record of it. He produces one. The ink is still wet.",
    "You catch up with the Taxman at {place}, red in the face and a long way from his office. He has been following you on foot, \"purely for audit purposes\". He's done eleven thousand steps today. He looks horrified, then, for a second, rather proud.",
    "The Taxman has a new form for {twist}. It's longer than the last one. Section four asks you to estimate how much harder everything is this season, in pounds sterling.",
  ],
  squad: [
    "Somebody in the squad is having a bad week. Nobody makes a fuss. Someone walks next to them, someone carries their bag up the hill, someone tells a terrible joke at exactly the right moment. By {place} they're laughing again.",
    "The squad has a game: one person names a snack, the next has to name a worse one. It started at the lighthouse and nobody has won it yet. On the way to {next} it gets very dark indeed.",
    "Someone falls behind on the climb out of {place}. The rest of you stop and wait without anyone saying so. The Count stops too, and starts again when you're all back together, the way it always does.",
    "Group photo at {place}. It takes nine goes. In the one you keep, someone's blinking, someone's mid-sneeze and someone is pointing at something off camera that nobody else saw.",
    "The group chat changes its name every week. This week it's named after something that happened at {place}, and nobody outside the squad would understand it, which is the point.",
    "You've walked together long enough to tell who's tired from the way they breathe. At {place}, without anybody saying anything, you all slow down by exactly the right amount.",
    "Somebody's birthday falls on the way to {next}. There's no cake, so you put a candle in a sausage roll and sing badly. It's the best birthday they've had, they say, and they might mean it.",
    "Halfway to {next}, someone admits they nearly didn't come this season. They're glad they did. Nobody makes a thing of it, but everybody walks a bit closer to them for the rest of the day.",
    "There's a moment at {place}, nothing special, just a bit of path, when you all look back up the ladder at once and realise how far down you've come. Nobody says it. The Count ticks, which is the same thing.",
  ],
  finale: [
    "You reach {place} on the last day of the season, tired and filthy and very pleased with yourselves. Then {count} chimes thirteen times, once for every week, and back home people look up from their screens without knowing why.",
    "At {place} the case of {count} springs open on its own. It chimes thirteen times and snaps shut again, and the needle has swung round to point another rung down. Ishbel sends a text: Well done. Next one's deeper. She says that every time.",
    "The Taxman is at {place} to meet you, with a final invoice for the season. You hand him a pebble from every realm. He doesn't know what to do with them, so he files them. Behind him {count} chimes thirteen times, and he flinches at every one.",
    "Thirteen weeks of {twist}, and it's over. At {place} the air feels lighter, like a fever breaking. As {count} chimes, far above, at the end of the last street in town, a lighthouse keeper called Morwenna looks up from her tea.",
    "You finish at {place} together, the way you started. Nobody was left behind and nobody went on ahead. Thirteen chimes ring out from {count}, and someone says, \"Same time next season?\" Everyone says yes.",
    "Grimm is at {place}, watching from a distance. He doesn't fight. He just watches {count} chime thirteen times, and when it's done he turns and walks away, ahead of you, down the next rung.",
  ],
  // stories.js only: a line or two for arriving in each realm, the first time through (near) and past the lair (deep).
  arrive: {
    blotmarsh: {
      near: ["The Blotmarsh again: black water, dead trees, reeds taller than you, and a bell ringing somewhere under the mud.", "The seam lets you out ankle-deep in the Blotmarsh. The mud makes a noise like someone sucking the last of a milkshake. It doesn't let go of your boots without a fight.", "Fog lies on the Blotmarsh like a wet blanket. Every so often a bubble rises and pops with a small, damp bzzt."],
      deep: ["Past Brett's Wallow the Blotmarsh goes on, warmer and darker. The trees have faces if you squint. Don't squint.", "Deep in the Blotmarsh the water is warm as a bath, and that's the worrying part. Things grow fat in warm water.", "Down here the Blotmarsh has no bottom that anyone has found. The paths float. You walk on them very lightly."],
    },
    puffcap: {
      near: ["Puffcap Hollow: orange air, mushrooms as big as bus shelters, and a smell of oranges and wet socks.", "The seam opens onto Puffcap Hollow and a cloud of spores comes through to meet you. Everyone holds their breath. Someone sneezes anyway.", "In Puffcap Hollow everything is soft. Everything looks like a cushion. That's how it gets you."],
      deep: ["Past Rory's Burrow the mushrooms get bigger and the light gets lower, and the white roots under the path twitch when you step on them.", "Deep in Puffcap Hollow the spores glow. It's very pretty. Everybody walks faster.", "Down here Puffcap Hollow grows furniture. Mushroom armchairs. A toadstool footstool. A whole fungus sofa, still warm."],
    },
    hushfrost: {
      near: ["The Hushfrost Reach: blue ice, white silence, and that feeling that someone is a step behind you.", "The seam lets you out into the Hushfrost and the cold gets into your teeth at once. Nobody talks. Talking starts avalanches.", "In the Hushfrost Reach every footstep squeaks. You count them. There's always one more than there should be."],
      deep: ["Past Wisp's Hollow the ice is so clear you can see things frozen in it: a cart, a dog, a man in a top hat, mid-sneeze.", "Deep in the Hushfrost the silence is so total you can hear the Count ticking in someone else's pocket.", "Down here the Hushfrost has rooms carved in the ice, like a house nobody came home to."],
    },
    spindrift: {
      near: ["The Spindrift Isles: islands floating in a grey sky, roped together by bridges that are mostly rope.", "The seam opens onto the Spindrift Isles and the wind snatches somebody's hat before they've got both feet through.", "On the Spindrift Isles the wind never stops and nothing is nailed down, including your plans."],
      deep: ["Past Gale's Spindle the islands get smaller and further apart, and the bridges stop being rope and start being ideas.", "Deep in the Spindrift Isles the islands turn slowly, all of them, like a mobile over a cot.", "Down here the wind has been blowing for so long it has worn the islands smooth, like pebbles."],
    },
    lowmost: {
      near: ["The Lowmost Deep: you walk down the sea floor like a road. The Count says you can breathe here, so you can. Mostly.", "The seam opens under water. For one awful second nobody breathes. Then the Count ticks, and somehow you can.", "In the Lowmost Deep it's dark, and quiet, and every so often something large goes past slowly, the way buses do."],
      deep: ["Past the Kraken's Throat the sea floor tilts downhill and keeps going. It's always three in the morning down here.", "Deep in the Lowmost the fish have lights on their heads, and every light is the blue of a phone.", "Down here the Lowmost Deep presses on your ears like a secret. Somewhere below, something enormous is turning over in its sleep."],
    },
    misrendered: {
      near: ["The Misrendered Realm: the sky is the wrong green, the ground flickers, and you walk through the gate once and arrive twice.", "The seam opens onto the Misrendered Realm and for a second everyone is a grey checked shape. Then you load.", "In the Misrendered Realm everything is a copy of something from home, done badly. A post box with no slot. A bench with three legs."],
      deep: ["Past the Error Throne the Misrendered Realm stops trying. Walls are just the word WALL. Trees are flat green squares.", "Deep in the Misrendered Realm the copies get better, which is worse. Your own street. Your own door. Nobody in.", "Down here the Misrendered Realm buffers. You stand still for a second and the world catches up with a jolt."],
    },
    gildedvoid: {
      near: ["The Gilded Void: the sky ran out of sky. You walk a road of old gold light with nothing underneath, all the way down.", "The seam opens onto the Gilded Void and there's no floor. Then there is: gold, a step at a time, as fast as you walk.", "In the Gilded Void it's silent and cold and full of stars, and every star, if you look closely, is a coin."],
      deep: ["Deep in the Gilded Void the gold road narrows to a single plank, and the hoard below is close enough to smell.", "Down here the Void is full of floating evenings, each one a little gold bubble with somebody's sofa in it.", "At the edge of the Void the stars stop. After that it's just Vex, asleep on everything anyone ever lost."],
    },
  },
  // stories.js only: the people you meet in each realm. One scene each, in the scene language, {place} filled in.
  folk: {
    blotmarsh: ["Local (A bog-wife): Walkers? Mind the planks. The man under them is older than the planks.\nmate: There's a man under the planks?\nLocal (A bog-wife): There's a man under all the planks, dear. It's a bog.", "Local (A ferryman): Twopence to cross. Or a sock.\nyou: Why a sock?\nLocal (A ferryman): Bog's hungry. It likes socks. Better a sock than a foot."],
    puffcap: ["Local (A mushroom picker): Don't eat the blue ones. Don't eat the orange ones. Don't sit on any of them.\nmate: What can we eat?\nLocal (A mushroom picker): Your sandwiches. Quickly.", "Local (A man in a hammock): I've been here since Tuesday. Which Tuesday? Good question.\n~ He doesn't get up. The hammock is mostly mushroom now."],
    hushfrost: ["Local (An ice-cutter): Three hundred years I've been cutting blocks out here. Never once seen who keeps the lantern lit.\nLocal (An ice-cutter): Seen their footprints. Small. Like a boy's.", "Local (A woman in furs): Talk quietly. And never answer if someone calls you from behind.\nmate: What if it's one of us?\nLocal (A woman in furs): Then they'll be in front of you, won't they."],
    spindrift: ["Local (A rope-maker): Every bridge out here is mine. Every one of them holds. Mostly.\nLocal (A rope-maker): Walk in step and they hold better. Walk out of step and you'll see what mostly means.", "Local (A kite-flyer): I lost a kite here when I was six. I've been looking for it ever since.\nyou: How long ago was that?\nLocal (A kite-flyer): I was six last week. Time's funny on the islands."],
    lowmost: ["Local (A diver in a brass helmet): You lot aren't wearing helmets.\nyou: The Count says we can breathe.\nLocal (A diver in a brass helmet): Lucky. I've been holding mine since 1896.", "Local (A lanternfish): ...\n~ It's a fish. It just looks at you. It has a light on its head the exact blue of a phone at three in the morning, and it doesn't blink."],
    misrendered: ["Local (A copy of a postman): Letter for {you}. Letter for {you}. Letter for {you}.\n~ The envelopes are all blank. He's very proud of them.", "Local (A placeholder): Hello. I am a person. I am doing normal things.\n~ It has no face, just the word FACE. It waves, a bit late."],
    gildedvoid: ["Local (An air-seller): Air! Fresh air! Two coins a jar!\nmate: We can breathe out here without it.\nLocal (An air-seller): Can you? Can you really? Have you checked?", "Local (A knight in floating armour): I came for the hoard. Four hundred years ago. I'm nearly there.\n~ He's drifting very slowly backwards. Nobody has the heart to tell him."],
  },
};

root.EffortWorld = { legs, beats, REALMS, realmOfChapter };
})(typeof window !== "undefined" ? window : globalThis);
