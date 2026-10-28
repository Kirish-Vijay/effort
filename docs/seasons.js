// Season content: the journey map and the story. The rules for seasons (dates, miles, rewards) live in game.js.
(function (root) {
"use strict";
// [lon, lat] round the coast of Great Britain, clockwise from Land's End. Rough on purpose: it's a game map.
const GB = [[-5.71, 50.07], [-5.2, 49.96], [-4.14, 50.37], [-3.64, 50.22], [-3.4, 50.62], [-2.45, 50.52], [-1.3, 50.72], [-0.14, 50.82], [1.32, 51.13], [1.44, 51.38],
  [0.8, 51.52], [1.15, 51.79], [1.35, 51.96], [1.76, 52.48], [1.3, 52.93], [0.3, 52.9], [0.34, 53.14], [0.12, 53.58], [-0.08, 54.12], [-0.61, 54.49], [-1.2, 54.69],
  [-1.42, 55.02], [-2.0, 55.77], [-2.13, 55.9], [-2.52, 56.0], [-3.2, 55.98], [-3.7, 56.03], [-2.58, 56.28], [-2.97, 56.46], [-2.47, 56.71], [-2.09, 57.15],
  [-1.78, 57.5], [-2.0, 57.69], [-2.96, 57.68], [-4.22, 57.48], [-3.77, 57.86], [-3.65, 58.11], [-3.09, 58.44], [-3.03, 58.64], [-3.37, 58.67], [-3.52, 58.6],
  [-5.0, 58.62], [-5.3, 57.9], [-5.8, 57.3], [-5.83, 57.0], [-6.2, 56.72], [-5.47, 56.41], [-5.8, 55.3], [-4.63, 55.46], [-4.86, 54.64], [-3.6, 54.85],
  [-3.59, 54.55], [-2.86, 54.07], [-3.05, 53.82], [-3.0, 53.4], [-3.83, 53.33], [-4.57, 53.3], [-4.75, 52.8], [-4.08, 52.41], [-5.3, 51.88], [-5.05, 51.7],
  [-3.95, 51.6], [-3.17, 51.47], [-2.6, 51.6], [-2.98, 51.35], [-3.48, 51.2], [-4.53, 51.02], [-4.94, 50.54], [-5.48, 50.21]];

const S1 = {
  id: "s1",
  blurb: "An old brass pedometer has to be walked the length of Britain before the winter's out. Your squad has it now.",
  coast: GB,
  landmarks: [
    { name: "Land's End", at: [-5.71, 50.07] },
    { name: "Dartmoor", at: [-3.75, 50.58] },
    { name: "Glastonbury Tor", at: [-2.7, 51.14] },
    { name: "Clifton Suspension Bridge", at: [-2.63, 51.45] },
    { name: "Ironbridge", at: [-2.48, 52.63] },
    { name: "Kinder Scout", at: [-1.87, 53.38] },
    { name: "Ribblehead Viaduct", at: [-2.37, 54.21] },
    { name: "Scafell Pike", at: [-3.21, 54.45] },
    { name: "Hadrian's Wall", at: [-2.37, 55.0] },
    { name: "Arthur's Seat", at: [-3.16, 55.94] },
    { name: "Glencoe", at: [-5.0, 56.68] },
    { name: "Loch Ness", at: [-4.44, 57.32] },
    { name: "John o' Groats", at: [-3.07, 58.64] },
  ],
  chapters: [
    { title: "The Long Count", text: [
      "The lighthouse keeper at Land's End is called Morwenna, and she has been waiting for you. She doesn't say how she knew you were coming. She just presses something heavy into your hands: a brass pedometer the size of a pocket watch, warm, ticking.",
      "\"The Long Count,\" she says. \"Made in 1724. Every winter somebody walks it to John o' Groats. If it gets there, the country keeps moving. If it doesn't…\" She nods at the town behind you, where every window glows blue with the light of a phone.",
      "\"A thousand miles. Thirteen weeks. All of you, together. It only counts steps you take as a squad.\"",
      "Out in the fog something wet and round shuffles closer, then thinks better of it. And somewhere behind you a voice says, \"Excuse me. Has anyone declared that pedometer?\"",
    ] },
    { title: "Fog on the Moor", text: [
      "Dartmoor is fog all the way down. The ponies watch you go past with the expression of creatures who have seen a lot of walkers and been unimpressed by all of them.",
      "Brett has followed you from Cornwall. You can hear him in the mist: a soft, damp slap, then another. He leaves a trail of something you decide not to look at.",
      "In a hollow under a granite tor you find an old letterbox, the kind walkers hide on the moor, with a rubber stamp and a notebook inside. The last entry is from 1951. \"Didn't make it. Got as far as Stoke. DO NOT STOP AT THE SERVICES.\"",
      "The Long Count ticks a little faster as you climb out of the fog. It likes being out here. So, you notice, do you.",
    ] },
    { title: "The Tor", text: [
      "There's a man on top of Glastonbury Tor in a cloak and a festival wristband from 2009. He says he's a druid. He says the Long Count runs on \"intention, ley lines and quads\".",
      "He's wrong about the ley lines. He's right about something else: when you all walk the same day, the Count glows. When one of you sits it out, it goes cold in your hand.",
      "Rory comes over the hill at sunset, bright orange and furious, flattening a field of abandoned tents. You don't stop to fight. The Count says keep moving, so you keep moving.",
      "Behind you the druid shouts, \"Blessed be!\" and then, quieter, \"Can someone give me a lift to Frome?\"",
    ] },
    { title: "The Toll", text: [
      "The Clifton Suspension Bridge has a toll booth, and today the Taxman is sitting in it.",
      "\"One pound for cars,\" he says, tapping the sign. \"For walkers, the toll is twenty per cent of everything you've walked since Cornwall. Plus admin.\"",
      "You argue. He produces a form. You argue more. He produces a longer form. In the end you notice his eyes keep sliding to the Long Count, and you realise he isn't here for the toll at all.",
      "\"Steps that nobody walks,\" he murmurs, \"are steps nobody has to tax. Think how tidy that would be.\" Then he waves you through, which is somehow worse than if he'd stopped you.",
    ] },
    { title: "Every Step a Stitch", text: [
      "Ironbridge is where the modern world was hammered together, and there's a museum guide here who knows exactly what you're carrying.",
      "\"Ironmaster called Abiah Holloway built that,\" she says. \"Walked everywhere. Wouldn't ride a horse. Said the country was a coat, and every step was a stitch, and if people stopped walking it would come apart at the seams.\"",
      "On the back of the Count, so small you need her magnifying glass, are the words EVERY STEP A STITCH.",
      "That night Wisp drifts down the gorge, cold and quiet, and every one of your phones lights up with messages from home you'd forgotten to answer. You answer them. Wisp looks almost disappointed.",
    ] },
    { title: "The Right to Roam", text: [
      "In 1932 four hundred walkers climbed Kinder Scout on purpose, because they'd been told they weren't allowed. Some of them went to prison for it. The moors are open now because they did.",
      "The plateau doesn't care about any of that. The wind on top is enormous, and in the middle of it, spinning, is Gale.",
      "You lean into it together, shoulder to shoulder. Nobody gets blown off the edge because nobody lets go. When it finally passes, the Long Count is ticking so loudly you can hear it over your own breathing.",
      "Halfway through the bog you find a small brass plaque from the trespass, and somebody has pinned a fresh flower to it. There are other walkers out here. You're not the first.",
    ] },
    { title: "Twenty-Four Arches", text: [
      "A steam train crosses Ribblehead Viaduct as you reach it, all twenty-four arches lit up by the firebox. A navvy in a flat cap is sitting under the middle arch. He's been dead since 1874 and he's very relaxed about it.",
      "\"Someone's after your Count,\" he says. \"Big lad. Blue. Carries a club. Calls himself Grimm, but where he comes from they call him the Algorithm.\"",
      "\"He doesn't want it broken. He wants it switched off. A country that never gets up is a country that never looks away from the screen.\"",
      "He taps the Count with a cold finger. It skips a beat. \"Keep it moving,\" he says, and he's gone, and so is the train.",
    ] },
    { title: "Above the Clouds", text: [
      "Scafell Pike is the highest point in England, and you see none of it: you climb into cloud at the first cairn and stay in it to the top.",
      "On the summit is a stone shelter, and in the shelter is the Summit Committee: three walkers in their eighties with flasks of tea. They've climbed it every winter since 1971.",
      "\"Six hundred miles,\" says the one in charge, reading the Count. \"Not bad. The hard part's north of the wall.\" She hands you a hand-drawn map of Scotland with notes in the margins: Bothy here. Midges here. Do not trust the ferry timetable.",
      "On the way down the cloud breaks, just for a minute, and you can see all the way to the sea.",
    ] },
    { title: "The Wall", text: [
      "Hadrian's Wall runs coast to coast, and a man dressed as a Roman centurion insists on checking your papers before you can cross it.",
      "\"Business north of the Wall?\" You show him the Long Count. He goes pale under the helmet. \"Then you'd better hurry. There were marks on the stones this morning. Big ones. Like a club.\"",
      "Grimm has been here. Further along there's a whole section knocked flat, and on the turf a single word scratched in: STOP.",
      "You don't. You go over the rubble single file, holding the Count between you, and on the far side the wind smells of heather.",
    ] },
    { title: "The Ambush", text: [
      "Edinburgh is built on stairs, and you climb every one of them on the way up Arthur's Seat. At the top the fog comes in off the Forth, thick and sudden.",
      "Two shapes are waiting in it. One is huge and blue and carrying a club. The other is holding a clipboard.",
      "\"A partnership,\" the Taxman says. \"He switches it off. I tax what's left. Everyone wins. Mostly me.\"",
      "It's a short, ugly fight in the fog and nobody wins it. But you learn something: when one of you falls behind, the Count slows down, and when you pull them back up, it surges. It's never been counting steps. It's counting how many of you keep going together.",
    ] },
    { title: "The Dark Glen", text: [
      "Glencoe in winter is the most beautiful place you have ever been and you would like to leave it immediately.",
      "Snow on the Buachaille. Wind down the glen. And high above the ridge, for a few seconds, the shape of something with wings, breathing out a long ribbon of orange fire that lights up the whole valley. Vex.",
      "You shelter in a bothy with a stove and a visitors' book. Every entry for three hundred years has the same thing in the corner: a little drawing of the Long Count. Walkers who carried it. Walkers who made it, and walkers who didn't.",
      "You add yours. You draw all of you around it.",
    ] },
    { title: "Something in the Loch", text: [
      "Loch Ness is deep and black and very still, and then it isn't.",
      "It isn't Nessie. Nessie, according to the man in the visitor centre, is \"a lovely girl\" who would never. This is her cousin from somewhere much deeper, and it has a lot more tentacles.",
      "The Kraken comes up under the ruins of Urquhart Castle and takes the Long Count right out of your hands. For a long, awful minute it's gone, ticking somewhere under the water.",
      "Then all of you hit the water together, and the Kraken, which has never had a whole squad come in after it, lets go out of pure surprise. The Count comes up glowing brighter than it ever has.",
    ] },
    { title: "The End of the Road", text: [
      "John o' Groats is a signpost, a car park and the wind, and it is the best place in the world.",
      "Morwenna's sister Ishbel is waiting under the sign. She takes the Count, opens the back with a tiny key, and it chimes: once for every week you walked, thirteen times, loud enough to hear in Cornwall.",
      "All over the country, people put their phones down and go outside. Not forever. Just for a walk. That's all it ever needed.",
      "The Taxman sends an invoice for the chimes. Grimm has gone quiet. And when Ishbel hands the Count back, the needle has swung round and is pointing out to sea, north and east, towards somewhere none of you have been. \"Next time,\" she says, \"further.\"",
    ] },
  ],
};
root.EffortSeasons = { s1: S1 };
})(typeof window !== "undefined" ? window : globalThis);
