// Effort item catalogue: class gear, generic gear, rarity tiers. Data only.
(function (root) {
"use strict";
const CLASSES = [
  { id: "bouncer", name: "Bouncer", stats: ["power", "guard"], e: "🚪", blurb: "Your name's not down. Neither is anyone's." },
  { id: "menace", name: "Menace", stats: ["power", "speed"], e: "🛴", blurb: "Brakes are a suggestion. Pavements are a lane." },
  { id: "mad", name: "Mad Scientist", stats: ["power", "brains"], e: "🧪", blurb: "If it fizzes, it's science. If it explodes, better science." },
  { id: "gremlin", name: "Chaos Gremlin", stats: ["power", "luck"], e: "👹", blurb: "Awake at 3am, breaking things on principle." },
  { id: "lollipop", name: "Lollipop Warden", stats: ["guard", "speed"], e: "🛑", blurb: "Stops traffic. Stops bosses. Stops for nobody." },
  { id: "librarian", name: "Battle Librarian", stats: ["guard", "brains"], e: "📚", blurb: "SHHH is a war cry if you say it right." },
  { id: "pigeon", name: "Pigeon King", stats: ["guard", "luck"], e: "🐦", blurb: "Eats chips off the floor. Commands an army that does the same." },
  { id: "courier", name: "Rogue Courier", stats: ["speed", "brains"], e: "🚲", blurb: "Knows every shortcut. Took all of them. Your food's cold." },
  { id: "pickpocket", name: "Pickpocket", stats: ["speed", "luck"], e: "🧤", blurb: "Light fingers, lighter morals, heavier pockets." },
  { id: "hedge", name: "Hedge Wizard", stats: ["brains", "luck"], e: "🔮", blurb: "Tarot from the pound shop. Accuracy also costs a pound." },
];
const TIERS = [
  { id: "common", label: "Common", color: "#9aa6c4", lvl: 1, price: 200 },
  { id: "rare", label: "Rare", color: "#3d9bff", lvl: 3, price: 500 },
  { id: "epic", label: "Epic", color: "#a86bff", lvl: 6, price: 1200 },
  { id: "legendary", label: "Legendary", color: "#ffb21e", lvl: 11, price: 3000 },
  { id: "mythic", label: "Mythic", color: "#ff4d6a", lvl: 18, price: 7500 },
];
// id: short kebab-case, unique. stats: object of bonuses. perk: [type, value] or null.
const ITEMS = [
  // ---------- GENERIC: weapons ----------
  { id: "plastic-spork", cls: null, slot: "weapon", tier: "common", name: "Plastic Spork of Mild Concern", e: "🍴", stats: { power: 2 }, perk: null, text: "Half spoon, half fork, fully committed to violence." },
  { id: "takeaway-menu", cls: null, slot: "weapon", tier: "common", name: "Rolled-Up Takeaway Menu", e: "📜", stats: { power: 2 }, perk: null, text: "Sixteen kinds of chips. One kind of violence." },
  { id: "damp-umbrella", cls: null, slot: "weapon", tier: "common", name: "Slightly Damp Umbrella", e: "☂️", stats: { power: 2 }, perk: null, text: "Britain's national weapon. Never fully dry." },
  { id: "tin-bag", cls: null, slot: "weapon", tier: "rare", name: "Tin-Filled Bag For Life", e: "🛍️", stats: { power: 4 }, perk: null, text: "For life. Possibly someone else's." },
  { id: "polite-cricket-bat", cls: null, slot: "weapon", tier: "rare", name: "Cricket Bat of Polite Violence", e: "🏏", stats: { power: 4 }, perk: null, text: "Sorry. Sorry. Terribly sorry. Thwack." },
  { id: "long-fence-post", cls: null, slot: "weapon", tier: "rare", name: "Fence Post, Uncomfortably Long", e: "🪵", stats: { power: 4 }, perk: null, text: "Liberated from a garden that didn't need it." },

  // ---------- GENERIC: armour ----------
  { id: "used-hi-vis", cls: null, slot: "armour", tier: "common", name: "Hi-Vis Tabard (Used)", e: "🦺", stats: { guard: 2 }, perk: null, text: "Walk anywhere. Nobody questions hi-vis." },
  { id: "damp-anorak", cls: null, slot: "armour", tier: "common", name: "Anorak of Mild Dampness", e: "🧥", stats: { guard: 2 }, perk: null, text: "Waterproof is a strong word." },
  { id: "nans-scarf", cls: null, slot: "armour", tier: "common", name: "Nan's Hand-Knitted Scarf", e: "🧣", stats: { guard: 2 }, perk: null, text: "Itchy. Protective. Quietly judging you." },
  { id: "bin-lid-buckler", cls: null, slot: "armour", tier: "rare", name: "Bin Lid Buckler", e: "🛡️", stats: { guard: 4 }, perk: null, text: "Collected Tuesdays. Defends Wednesdays." },
  { id: "duvet-coat", cls: null, slot: "armour", tier: "rare", name: "Duvet Coat of Absolute Refusal", e: "🛌", stats: { guard: 4 }, perk: null, text: "Technically outdoors. Spiritually still in bed." },
  { id: "trolley-exo", cls: null, slot: "armour", tier: "rare", name: "Shopping Trolley Exoskeleton", e: "🛒", stats: { guard: 4 }, perk: null, text: "Pulls left. Always left. Armoured though." },

  // ---------- GENERIC: trinkets ----------
  { id: "lucky-bus-ticket", cls: null, slot: "trinket", tier: "common", name: "Lucky Bus Ticket", e: "🎫", stats: { luck: 2 }, perk: null, text: "Expired in 2019. Still gets you places." },
  { id: "lukewarm-energy", cls: null, slot: "trinket", tier: "common", name: "Lukewarm Energy Drink", e: "🥤", stats: { speed: 2 }, perk: null, text: "Tastes like a battery licked a sweet." },
  { id: "half-sudoku", cls: null, slot: "trinket", tier: "common", name: "Half a Sudoku", e: "🧩", stats: { brains: 2 }, perk: null, text: "You did the easy half. That counts." },
  { id: "flapjack-brick", cls: null, slot: "trinket", tier: "rare", name: "Protein Flapjack Brick", e: "🍫", stats: { power: 3 }, perk: null, text: "Thirty grams of protein. Forty grams of regret." },
  { id: "forty-keys", cls: null, slot: "trinket", tier: "rare", name: "Keyring of Forty Keys", e: "🗝️", stats: { guard: 3 }, perk: null, text: "Opens nothing. Jangles menacingly." },
  { id: "laminated-clover", cls: null, slot: "trinket", tier: "rare", name: "Laminated Four-Leaf Clover", e: "🍀", stats: { luck: 3 }, perk: null, text: "Lamination is a form of respect." },

  // ---------- BOUNCER ----------
  { id: "eternal-clipboard", cls: "bouncer", slot: "weapon", tier: "epic", name: "Clipboard of Eternal Refusal", e: "📋", stats: { power: 7, guard: 2 }, perk: ["thorns", 0.5], text: "Your name's not down. Nobody's name is down." },
  { id: "velvet-rope-whip", cls: "bouncer", slot: "weapon", tier: "legendary", name: "Velvet Rope Whip of Exclusivity", e: "🪢", stats: { power: 10, guard: 3 }, perk: ["critDmg", 0.6], text: "The VIP section is very small. You're not in it." },
  { id: "last-orders-bell", cls: "bouncer", slot: "weapon", tier: "mythic", name: "The Last Orders Bell", e: "🔔", stats: { power: 14, guard: 5 }, perk: ["taxStart", 35], text: "Rings once. Everyone leaves. Including the Taxman's dignity." },
  { id: "judgement-bomber", cls: "bouncer", slot: "armour", tier: "epic", name: "Black Bomber of Silent Judgement", e: "🧥", stats: { guard: 7, power: 2 }, perk: ["shield", 2], text: "Stares at your trainers. Finds them wanting." },
  { id: "door-puffer", cls: "bouncer", slot: "armour", tier: "legendary", name: "Door-Sized Puffer Jacket", e: "🧱", stats: { guard: 10, power: 3 }, perk: ["thorns", 1], text: "Hit it and the jacket hits back. Nobody knows how." },
  { id: "no-entry-lanyard", cls: "bouncer", slot: "armour", tier: "mythic", name: "Chainmail Lanyard of No Entry", e: "⛓️", stats: { guard: 14, power: 5 }, perk: ["thorns", 2], text: "Says STAFF. Means GOD." },
  { id: "permanent-stamp", cls: "bouncer", slot: "trinket", tier: "epic", name: "Hand Stamp That Won't Wash", e: "🖐️", stats: { guard: 5 }, perk: ["heal", 0.1], text: "Smells of lager and authority." },
  { id: "eyes-torch", cls: "bouncer", slot: "trinket", tier: "legendary", name: "Torch Pointed Directly at Eyes", e: "🔦", stats: { power: 7 }, perk: ["shield", 4], text: "Can't hit what you can't see. Can't see anything." },
  { id: "unbreakable-radio", cls: "bouncer", slot: "trinket", tier: "mythic", name: "Unbreakable Two-Way Radio", e: "📻", stats: { guard: 10 }, perk: ["secondWind", 1], text: "Backup is coming. Backup is always coming." },

  // ---------- MENACE ----------
  { id: "brakeless-scooter", cls: "menace", slot: "weapon", tier: "epic", name: "E-Scooter With No Brakes", e: "🛴", stats: { power: 7, speed: 2 }, perk: ["combo", 0.25], text: "Brakes removed for aerodynamic reasons." },
  { id: "wheelie-bin-ram", cls: "menace", slot: "weapon", tier: "legendary", name: "Wheelie Bin Battering Ram", e: "🗑️", stats: { power: 10, speed: 3 }, perk: ["swing", 6], text: "Rolled downhill at speeds bins were never built for." },
  { id: "cone-lance", cls: "menace", slot: "weapon", tier: "mythic", name: "Ring Road Traffic Cone Lance", e: "🚧", stats: { power: 14, speed: 5 }, perk: ["combo", 1.0], text: "Taken from a roundabout. Pointy end first." },
  { id: "static-shell-suit", cls: "menace", slot: "armour", tier: "epic", name: "Shell Suit of Static Discharge", e: "⚡", stats: { guard: 7, speed: 2 }, perk: ["swing", 3], text: "Keep away from open flames and other shell suits." },
  { id: "backwards-helmet", cls: "menace", slot: "armour", tier: "legendary", name: "Helmet Worn Backwards", e: "⛑️", stats: { guard: 10, power: 3 }, perk: ["cdr", 0.2], text: "Technically safety gear. Technically." },
  { id: "zero-brake-pads", cls: "menace", slot: "armour", tier: "mythic", name: "Knee Pads of Zero Brakes", e: "🦵", stats: { guard: 14, speed: 5 }, perk: ["dodge", 0.12], text: "Every fall is a roll if you commit." },
  { id: "stuck-horn", cls: "menace", slot: "trinket", tier: "epic", name: "Horn Stuck On Full Blast", e: "📯", stats: { speed: 5 }, perk: ["combo", 0.25], text: "Beep beep. Constantly. Forever." },
  { id: "nitro-squash", cls: "menace", slot: "trinket", tier: "legendary", name: "Nitro Squash Bottle", e: "🧃", stats: { power: 7 }, perk: ["swing", 6], text: "Undiluted. Absolutely feral." },
  { id: "speeding-tickets", cls: "menace", slot: "trinket", tier: "mythic", name: "Speeding Ticket Collection", e: "🎟️", stats: { speed: 10 }, perk: ["critChance", 0.12], text: "Forty-two fines. Zero regrets. One bus lane." },

  // ---------- MAD SCIENTIST ----------
  { id: "probably-fine-beaker", cls: "mad", slot: "weapon", tier: "epic", name: "Fizzing Beaker of Probably Fine", e: "🧪", stats: { power: 7, brains: 2 }, perk: ["critDmg", 0.3], text: "Safety goggles sold separately. Also lost." },
  { id: "jump-lead-nunchucks", cls: "mad", slot: "weapon", tier: "legendary", name: "Jump Lead Nunchucks", e: "🔋", stats: { power: 10, brains: 3 }, perk: ["feast", 1.6], text: "Red to boss. Black to boss. Stand well back." },
  { id: "microwave-ray-gun", cls: "mad", slot: "weapon", tier: "mythic", name: "Microwave Ray Gun (Fork Inside)", e: "📡", stats: { power: 14, brains: 5 }, perk: ["critDmg", 1.0], text: "Ping. Ping. PING. Everything is warm now." },
  { id: "scorched-lab-coat", cls: "mad", slot: "armour", tier: "epic", name: "Lab Coat With Scorch Marks", e: "🥼", stats: { guard: 7, brains: 2 }, perk: ["heal", 0.1], text: "The scorch marks are the qualifications." },
  { id: "tinfoil-onesie", cls: "mad", slot: "armour", tier: "legendary", name: "Tinfoil Hazmat Onesie", e: "⚗️", stats: { guard: 10, power: 3 }, perk: ["cdr", 0.2], text: "Blocks radiation, phone masts and most conversations." },
  { id: "vacuum-exo", cls: "mad", slot: "armour", tier: "mythic", name: "Exoskeleton Made of Vacuums", e: "🤖", stats: { guard: 14, power: 5 }, perk: ["feast", 2.0], text: "It sucks. In the good way. Mostly." },
  { id: "pocket-bunsen", cls: "mad", slot: "trinket", tier: "epic", name: "Pocket Bunsen Burner", e: "🔥", stats: { brains: 5 }, perk: ["trivia", 3], text: "Lights ideas and the occasional eyebrow." },
  { id: "shed-rock", cls: "mad", slot: "trinket", tier: "legendary", name: "Glowing Rock From the Shed", e: "💎", stats: { power: 7 }, perk: ["critDmg", 0.6], text: "Found it in the shed. The shed is gone now." },
  { id: "pickled-brain", cls: "mad", slot: "trinket", tier: "mythic", name: "Brain in a Pickle Jar", e: "🧠", stats: { brains: 10 }, perk: ["feast", 2.0], text: "Still thinks. Mostly about vinegar." },

  // ---------- CHAOS GREMLIN ----------
  { id: "mystery-fireworks", cls: "gremlin", slot: "weapon", tier: "epic", name: "Bag of Mystery Fireworks", e: "🎆", stats: { power: 7, luck: 2 }, perk: ["critDmg", 0.3], text: "No labels. No instructions. No eyebrows by Sunday." },
  { id: "3am-kebab-skewer", cls: "gremlin", slot: "weapon", tier: "legendary", name: "3am Kebab Skewer", e: "🍢", stats: { power: 10, luck: 3 }, perk: ["lifesteal", 0.02], text: "Sustains you. Sustains violence. Sustains regret." },
  { id: "bad-decision-hammer", cls: "gremlin", slot: "weapon", tier: "mythic", name: "Sledgehammer of Bad Decisions", e: "🔨", stats: { power: 14, luck: 5 }, perk: ["critDmg", 1.0], text: "Every problem is a nail if you're tired enough." },
  { id: "stained-onesie", cls: "gremlin", slot: "armour", tier: "epic", name: "Onesie Covered in Mysterious Stains", e: "🦖", stats: { guard: 7, luck: 2 }, perk: ["lifesteal", 0.01], text: "Dinosaur onesie. Do not ask about the stains." },
  { id: "bubble-wrap-plate", cls: "gremlin", slot: "armour", tier: "legendary", name: "Bubble Wrap Plate Armour", e: "📦", stats: { guard: 10, power: 3 }, perk: ["thorns", 1], text: "Popping it is a war crime. Also self-care." },
  { id: "sleepless-aura", cls: "gremlin", slot: "armour", tier: "mythic", name: "Aura of Not Having Slept", e: "🌀", stats: { guard: 14, luck: 5 }, perk: ["lifesteal", 0.04], text: "Three days awake. Damage dealt is nutrition." },
  { id: "car-alarm-remote", cls: "gremlin", slot: "trinket", tier: "epic", name: "Car Alarm Remote (Not Yours)", e: "🚨", stats: { luck: 5 }, perk: ["critChance", 0.04], text: "Press it. Somewhere, chaos." },
  { id: "destiny-gobstopper", cls: "gremlin", slot: "trinket", tier: "legendary", name: "Gobstopper of Destiny", e: "🍬", stats: { power: 7 }, perk: ["critDmg", 0.6], text: "Do not swallow. Do not stop. Do not ask." },
  { id: "cursed-duck", cls: "gremlin", slot: "trinket", tier: "mythic", name: "Cursed Lucky Rubber Duck", e: "🦆", stats: { luck: 10 }, perk: ["lifesteal", 0.04], text: "Squeaks at 3am every night. Something answers." },

  // ---------- LOLLIPOP WARDEN ----------
  { id: "lollipop-stop-sign", cls: "lollipop", slot: "weapon", tier: "epic", name: "Lollipop Stop Sign", e: "🛑", stats: { power: 7, guard: 2 }, perk: ["shield", 2], text: "STOP. Not a request. Never a request." },
  { id: "zebra-bo-staff", cls: "lollipop", slot: "weapon", tier: "legendary", name: "Zebra Crossing Bo Staff", e: "🦓", stats: { power: 10, speed: 3 }, perk: ["dodge", 0.08], text: "Black, white, and red all over by the end." },
  { id: "kerb-justice-stick", cls: "lollipop", slot: "weapon", tier: "mythic", name: "Big Stick of Kerb Justice", e: "🍭", stats: { power: 14, guard: 5 }, perk: ["shield", 6], text: "Cars stop. Time stops. The boss stops." },
  { id: "visibility-coat", cls: "lollipop", slot: "armour", tier: "epic", name: "Fluorescent Coat of Visibility", e: "🦺", stats: { guard: 7, speed: 2 }, perk: ["dodge", 0.05], text: "Visible from space. Untouchable on earth." },
  { id: "crossing-cap", cls: "lollipop", slot: "armour", tier: "legendary", name: "Peaked Cap of Righteous Crossing", e: "🧢", stats: { guard: 10, speed: 3 }, perk: ["heal", 0.2], text: "Seen four generations across the road. Fears nothing." },
  { id: "belisha-helmet", cls: "lollipop", slot: "armour", tier: "mythic", name: "Belisha Beacon Helmet", e: "🟠", stats: { guard: 14, speed: 5 }, perk: ["shield", 6], text: "Flashes orange. Bosses yield. Always." },
  { id: "kerbside-megaphone", cls: "lollipop", slot: "trinket", tier: "epic", name: "Megaphone of Kerbside Fury", e: "📣", stats: { speed: 5 }, perk: ["cdr", 0.1], text: "WAIT. FOR. THE. GREEN. MAN." },
  { id: "green-man-badge", cls: "lollipop", slot: "trinket", tier: "legendary", name: "Green Man Badge", e: "🚦", stats: { guard: 7 }, perk: ["dodge", 0.08], text: "Crossing guaranteed. Getting hit, not so much." },
  { id: "confiscated-sweets", cls: "lollipop", slot: "trinket", tier: "mythic", name: "Confiscated Sweet Hoard", e: "🍡", stats: { speed: 10 }, perk: ["heal", 0.35], text: "Taken from children for safety. Eaten for strength." },

  // ---------- BATTLE LIBRARIAN ----------
  { id: "dictionary-mace", cls: "librarian", slot: "weapon", tier: "epic", name: "Hardback Dictionary Mace", e: "📕", stats: { power: 7, brains: 2 }, perk: ["trivia", 3], text: "Look up 'concussion'. Now experience it." },
  { id: "overdue-stamp", cls: "librarian", slot: "weapon", tier: "legendary", name: "Overdue Fine Date Stamp", e: "🗓️", stats: { power: 10, guard: 3 }, perk: ["steal", 0.06], text: "Returned late. Fined forever. Fine: everything." },
  { id: "thrown-encyclopaedia", cls: "librarian", slot: "weapon", tier: "mythic", name: "The Complete Encyclopaedia (Thrown)", e: "📚", stats: { power: 14, brains: 5 }, perk: ["trivia", 8], text: "Twenty-six volumes, aimed at the boss's head." },
  { id: "pocket-cardigan", cls: "librarian", slot: "armour", tier: "epic", name: "Cardigan of Infinite Pockets", e: "🧶", stats: { guard: 7, brains: 2 }, perk: ["shield", 2], text: "Contains tissues, mints and a disturbing calm." },
  { id: "silence-field", cls: "librarian", slot: "armour", tier: "legendary", name: "Silence Field Generator", e: "🤫", stats: { guard: 10, brains: 3 }, perk: ["shield", 4], text: "SHHH. Even the boss's attacks whisper now." },
  { id: "dust-jacket-armour", cls: "librarian", slot: "armour", tier: "mythic", name: "Laminated Dust Jacket Armour", e: "📘", stats: { guard: 14, brains: 5 }, perk: ["cdr", 0.3], text: "Sticky-back plastic. Military grade. Wipe clean." },
  { id: "chain-glasses", cls: "librarian", slot: "trinket", tier: "epic", name: "Reading Glasses on a Chain", e: "👓", stats: { brains: 5 }, perk: ["trivia", 3], text: "Peers over them. Damage taken: disapproved of." },
  { id: "infinite-library-card", cls: "librarian", slot: "trinket", tier: "legendary", name: "Library Card of Infinite Renewals", e: "💳", stats: { guard: 7 }, perk: ["heal", 0.2], text: "Never expires. Never forgets. Never forgives." },
  { id: "late-returns-ledger", cls: "librarian", slot: "trinket", tier: "mythic", name: "Forbidden Late Returns Ledger", e: "📒", stats: { brains: 10 }, perk: ["trivia", 8], text: "Every overdue book since 1974. Including yours." },

  // ---------- PIGEON KING ----------
  { id: "chip-of-command", cls: "pigeon", slot: "weapon", tier: "epic", name: "Soggy Chip of Command", e: "🍟", stats: { power: 7, luck: 2 }, perk: ["loot", 0.1], text: "Raise it high. The flock will answer." },
  { id: "breadstick-sceptre", cls: "pigeon", slot: "weapon", tier: "legendary", name: "Breadstick Sceptre", e: "🥖", stats: { power: 10, guard: 3 }, perk: ["dodge", 0.08], text: "Stale enough to stab. Tasty enough to rule." },
  { id: "angry-pigeons", cls: "pigeon", slot: "weapon", tier: "mythic", name: "Four Hundred Angry Pigeons", e: "🕊️", stats: { power: 14, luck: 5 }, perk: ["critChance", 0.12], text: "Not a weapon. A movement." },
  { id: "feathered-duffel", cls: "pigeon", slot: "armour", tier: "epic", name: "Feathered Duffel Coat", e: "🪶", stats: { guard: 7, luck: 2 }, perk: ["dodge", 0.05], text: "Moulting slightly. Mostly on purpose." },
  { id: "statue-crown", cls: "pigeon", slot: "armour", tier: "legendary", name: "Statue Head Crown", e: "🗿", stats: { guard: 10, luck: 3 }, perk: ["secondWind", 1], text: "Sat on every statue in town. Earned the crown." },
  { id: "crumb-cloak", cls: "pigeon", slot: "armour", tier: "mythic", name: "Cloak of a Thousand Crumbs", e: "👑", stats: { guard: 14, luck: 5 }, perk: ["secondWind", 1], text: "Every crumb a loyal subject. Every subject a shield." },
  { id: "pigeon-union-card", cls: "pigeon", slot: "trinket", tier: "epic", name: "Pigeon Union Membership Card", e: "🪪", stats: { luck: 5 }, perk: ["loot", 0.1], text: "Collective bargaining. Collective pooping." },
  { id: "gravel-crust", cls: "pigeon", slot: "trinket", tier: "legendary", name: "Gravel-Flavoured Lucky Crust", e: "🍞", stats: { guard: 7 }, perk: ["dodge", 0.08], text: "Five second rule, extended indefinitely." },
  { id: "one-eyed-advisor", cls: "pigeon", slot: "trinket", tier: "mythic", name: "One-Eyed Pigeon Advisor", e: "🐦", stats: { luck: 10 }, perk: ["loot", 0.35], text: "Lost an eye in the Great Chip War. Gained foresight." },

  // ---------- ROGUE COURIER ----------
  { id: "delivery-bag-flail", cls: "courier", slot: "weapon", tier: "epic", name: "Insulated Delivery Bag Flail", e: "🎒", stats: { power: 7, speed: 2 }, perk: ["cdr", 0.1], text: "Keeps food warm. Keeps bosses cold." },
  { id: "haste-lock-chain", cls: "courier", slot: "weapon", tier: "legendary", name: "Bike Lock Chain of Haste", e: "🔗", stats: { power: 10, speed: 3 }, perk: ["combo", 0.5], text: "Three locks. Two minutes. Zero mercy." },
  { id: "order-ticket-doom", cls: "courier", slot: "weapon", tier: "mythic", name: "Order Ticket of Doom", e: "🧾", stats: { power: 14, brains: 5 }, perk: ["taxStart", 35], text: "Order delivered: 7pm. Pain delivered: 7:01." },
  { id: "shortcut-poncho", cls: "courier", slot: "armour", tier: "epic", name: "Rain-Proof Shortcut Poncho", e: "🌧️", stats: { guard: 7, speed: 2 }, perk: ["combo", 0.25], text: "Through the park, over the wall, past the bins." },
  { id: "smug-cycling-shorts", cls: "courier", slot: "armour", tier: "legendary", name: "Cycling Shorts of Supersonic Smugness", e: "🚴", stats: { guard: 10, speed: 3 }, perk: ["cdr", 0.2], text: "Aerodynamic. Unflattering. Undeniable." },
  { id: "five-star-aura", cls: "courier", slot: "armour", tier: "mythic", name: "Five-Star Rating Aura", e: "⭐", stats: { guard: 14, brains: 5 }, perk: ["cdr", 0.3], text: "Left at door. Left at boss. Left in pieces." },
  { id: "secret-shortcut-map", cls: "courier", slot: "trinket", tier: "epic", name: "Secret Shortcut Map", e: "🗺️", stats: { brains: 5 }, perk: ["combo", 0.25], text: "Includes three gardens and one that's technically a house." },
  { id: "two-percent-phone", cls: "courier", slot: "trinket", tier: "legendary", name: "Cracked Phone With 2% Battery", e: "📱", stats: { speed: 7 }, perk: ["taxStart", 20], text: "Delivers anywhere before it dies. Usually." },
  { id: "golden-notification", cls: "courier", slot: "trinket", tier: "mythic", name: "Golden Delivery Notification", e: "📲", stats: { speed: 10 }, perk: ["combo", 1.0], text: "Your order is nearby. Your order is your doom." },

  // ---------- PICKPOCKET ----------
  { id: "purse-string-scissors", cls: "pickpocket", slot: "weapon", tier: "epic", name: "Purse-String Scissors", e: "✂️", stats: { power: 7, speed: 2 }, perk: ["steal", 0.03], text: "Snip. Whistle. Look at the sky." },
  { id: "magnet-on-stick", cls: "pickpocket", slot: "weapon", tier: "legendary", name: "Magnet on a Stick", e: "🧲", stats: { power: 10, luck: 3 }, perk: ["critChance", 0.07], text: "Coins, keys, wallets. Occasionally a fridge." },
  { id: "deniable-fingers", cls: "pickpocket", slot: "weapon", tier: "mythic", name: "Fingers of Plausible Deniability", e: "🤏", stats: { power: 14, speed: 5 }, perk: ["steal", 0.10], text: "Wasn't me. Wasn't anyone. Look over there." },
  { id: "seventeen-pocket-coat", cls: "pickpocket", slot: "armour", tier: "epic", name: "Coat With Seventeen Inside Pockets", e: "🧥", stats: { guard: 7, luck: 2 }, perk: ["loot", 0.1], text: "Sixteen are empty. One holds the Taxman's lunch." },
  { id: "nowhere-hoodie", cls: "pickpocket", slot: "armour", tier: "legendary", name: "Hoodie of Being Nowhere", e: "🥷", stats: { guard: 10, speed: 3 }, perk: ["dodge", 0.08], text: "You were there. Then you weren't. Classic." },
  { id: "anonymous-moustache", cls: "pickpocket", slot: "armour", tier: "mythic", name: "Fake Moustache of Total Anonymity", e: "🥸", stats: { guard: 14, speed: 5 }, perk: ["loot", 0.35], text: "Nobody recognises you. Not even your mum." },
  { id: "someone-elses-wallet", cls: "pickpocket", slot: "trinket", tier: "epic", name: "Someone Else's Wallet", e: "👛", stats: { luck: 5 }, perk: ["steal", 0.03], text: "Found it. Kept it. Moral journey complete." },
  { id: "loaded-dice", cls: "pickpocket", slot: "trinket", tier: "legendary", name: "Loaded Dice of Questionable Origin", e: "🎲", stats: { luck: 7 }, perk: ["critChance", 0.07], text: "Always rolls a six. Especially when it shouldn't." },
  { id: "taxman-calculator", cls: "pickpocket", slot: "trinket", tier: "mythic", name: "The Taxman's Own Calculator", e: "🧮", stats: { speed: 10 }, perk: ["steal", 0.10], text: "Every sum now rounds in your favour." },

  // ---------- HEDGE WIZARD ----------
  { id: "pound-shop-wand", cls: "hedge", slot: "weapon", tier: "epic", name: "Wand From the Pound Shop", e: "🪄", stats: { power: 7, brains: 2 }, perk: ["trivia", 3], text: "Made in a factory. Blessed in a car park." },
  { id: "scratchcard-shuriken", cls: "hedge", slot: "weapon", tier: "legendary", name: "Scratchcard Shuriken", e: "🃏", stats: { power: 10, luck: 3 }, perk: ["critChance", 0.07], text: "Scratch to reveal: damage." },
  { id: "corner-shop-staff", cls: "hedge", slot: "weapon", tier: "mythic", name: "Staff of Corner-Shop Sorcery", e: "🌿", stats: { power: 14, brains: 5 }, perk: ["critChance", 0.12], text: "Open till eleven. Casts till midnight." },
  { id: "shower-curtain-robe", cls: "hedge", slot: "armour", tier: "epic", name: "Robe Made From Shower Curtain", e: "🚿", stats: { guard: 7, luck: 2 }, perk: ["heal", 0.1], text: "Mildew-resistant. Curse-resistant. Unwashed." },
  { id: "muttering-hood", cls: "hedge", slot: "armour", tier: "legendary", name: "Hood of Ominous Muttering", e: "🧙", stats: { guard: 10, brains: 3 }, perk: ["trivia", 5], text: "Mutters answers at the boss. Mostly correct." },
  { id: "crystal-bin-bag", cls: "hedge", slot: "armour", tier: "mythic", name: "Crystal-Studded Bin Bag Cloak", e: "🔮", stats: { guard: 14, luck: 5 }, perk: ["heal", 0.35], text: "Charged under a full moon. Collected Thursdays." },
  { id: "incomplete-tarot", cls: "hedge", slot: "trinket", tier: "epic", name: "Tarot Deck With Missing Cards", e: "🎴", stats: { luck: 5 }, perk: ["critChance", 0.04], text: "Every reading is the Tower. Every single time." },
  { id: "free-paper-horoscope", cls: "hedge", slot: "trinket", tier: "legendary", name: "Free Newspaper Horoscope", e: "📰", stats: { brains: 7 }, perk: ["trivia", 5], text: "Mercury is in retrograde. So are you." },
  { id: "all-knowing-8-ball", cls: "hedge", slot: "trinket", tier: "mythic", name: "The All-Knowing Magic 8-Ball", e: "🎱", stats: { luck: 10 }, perk: ["loot", 0.35], text: "Signs point to yes. Signs always point to yes." },
];
root.EffortItems = { CLASSES, TIERS, ITEMS };
})(typeof window !== "undefined" ? window : globalThis);
