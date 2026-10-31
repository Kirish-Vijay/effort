# Effort: design reference board for the journey map, Winny's Gamba Bucket and skin tiers

Researched 31 Oct 2026. These three features sit inside Effort's existing game UI (`docs/game.css`): dark navy
panels, Lilita One display type, Rubik UI type, chunky outlined buttons with an ink lip, gold = reward, and the
existing rarity ladder `--r-common #9aa6c4 / --r-rare #3d9bff / --r-epic #a86bff / --r-legendary #ffb21e /
--r-mythic #ff4d6a`. So this board is about layout, motion, illustration and components, not a new identity.

## Outcomes

**1. Fantasy realm journey map.** Each week the squad's combined steps walk them toward that week's boss. Opening
the map must answer three things in one glance on a phone held upright: where we are, how far to the next named
place, and how far to the boss. It has to feel like a place (a swamp, a spore hollow, a glacier, storm islands,
an abyss, a glitched dimension, a starfield), make every friend's face visible so no one walks alone, and turn
each checkpoint into a small moment worth posting in squad chat. The people who have to believe it are a handful
of friends who already play Clash Royale, Brawl Stars and Duolingo and know what a good map screen feels like.

**2. Winny's Gamba Bucket.** A loot bucket bought with coins earned by walking. The opening has to be the most fun
ten seconds in the app, with rarity building up so a Legendary feels earned, while the odds are shown in plain
numbers before anyone spends a coin. Friends should trust it the way they trust a dice roll at a table, and it
must never feel like it is working them.

**3. Paid cosmetic skins in tiers.** Real-money skins where each step up the price ladder is visibly more
different and adds more motion (idle effects, trails, auras). A friend should be able to tell a top-tier skin from
across the squad screen, and the buyer should see exactly what each tier adds before paying.

## References (what each does exceptionally)

Verified via the linked pages unless marked *(play knowledge)*, meaning a well-known in-game behaviour not
re-checked on the web for this board.

### Journey map
1. **The Conqueror Virtual Challenges** — [Route 66 page](https://www.theconqueror.events/challenge/original/single/route66), [Cities of US (group)](https://www.theconqueror.events/challenge/original/group/cities-usa).
   Real distance mapped onto a famous route: "every time you add a workout, you also advance on the map", and
   you see your own avatar *and other people's* on the route. Progress is chunked into unlockable **virtual
   postcards** (Route 66 has 24 over 2,280 mi) plus Street View at stops and a physical medal at the end. The
   postcard is the exceptional bit: a checkpoint becomes a collectable you can share. Screenshot:
   `conqueror-route66-mobile.png` (spec line "2280 mi | 24 Postcards | Has StreetView").
2. **Duolingo learning path** — [blog: Introducing the new learning path](https://blog.duolingo.com/new-duolingo-home-screen-design/).
   Replaced a grid of skills with one vertical path "you'll follow step by step": circular nodes on a gentle
   zig-zag, grouped into units with a header band per unit. Exceptional at "where am I": the current node is
   bigger, raised and labelled, finished nodes are filled, future ones are flat grey, and the screen opens
   scrolled to you. Screenshot: `duolingo-path-blog-mobile.png`.
3. **Candy Crush Saga / Royal Match saga maps** *(play knowledge)*. Long vertical scroll through themed episodes,
   each with its own landscape and palette; friends' profile faces sit as pins on the level they have reached,
   and your own token hops along the path when you come back after progress. Exceptional at social presence on a
   map and at making each themed zone feel like a new place without changing the UI chrome.
4. **Slay the Spire act map** *(play knowledge)*, design discussion in [Hexagarden: Let's Make a Map](https://thehexagarden.com/blog/lets-make-a-map-1).
   Inked parchment map, small icons per node with a legend, and the **boss portrait shown at the top from the very
   start of the act**. You always know who you are walking toward. Exceptional at dread and anticipation.
5. **Super Mario Bros. Wonder world map** *(play knowledge)*. Each world is a single themed island where nodes are
   landmarks (a tower, a pipe, a castle) rather than numbered dots, with ambient idle motion everywhere (water,
   bobbing scenery). Exceptional at making checkpoints into named places with silhouettes.
6. **Pikmin Bloom** *(play knowledge)*. Steps plant a trail of flowers behind you on the map, so your walk leaves a
   visible mark. Exceptional at turning steps into a trail you can see behind you, not just a number going up.

### Loot reveal and honest odds
7. **Brawl Stars Starr Drops** — [Supercell: Starr Drops](https://support.supercell.com/brawl-stars/en/articles/starr-drops-5.html), [Starr Drop Chances](https://support.supercell.com/brawl-stars/en/articles/starr-drops-chances-2.html), [wiki](https://brawlstars.fandom.com/wiki/Starr_Drops).
   Every drop starts Rare and can upgrade on taps to Super Rare, Epic, Mythic, Legendary, changing colour each
   time. Published rarity odds 50 / 28 / 15 / 5 / 2 %, then a second table per rarity listing every reward with a
   two-decimal percentage and a **fallback reward** column for duplicates. Exceptional at both the escalation and
   the disclosure format. Screenshot: `brawlstars-starr-drop-odds-mobile.png`.
8. **Clash Royale Lucky Chests** — [Supercell: Lucky Chests & Boxes](https://support.supercell.com/clash-royale/en/articles/lucky-chests-6.html), [All about drop rates](https://supercell.com/en/games/clashroyale/blog/news/clash-royale-chest-info-2).
   A chest is "tapped three times for chances to upgrade" its star rarity (four taps for some types), and the
   odds table gives the final-rarity chance by starting rarity (e.g. 1-Star Magic: 31.64 / 43.04 / 20.25 / 4.06 /
   1.01 %). Exceptional at a fixed, countable number of taps, so the suspense has a known length. Screenshot:
   `clashroyale-lucky-chest-odds-mobile.png`.
9. **Genshin Impact wish** — [wiki: Wish](https://genshin-impact.fandom.com/wiki/Wish) *(meteor colours from play knowledge)*.
   The falling meteor's colour (blue, purple, gold) tells you the best rarity *before* the item is shown, so the
   payoff starts during the build-up. Results of a 10-pull are shown best first, and pity rules are public (a 4★
   is effectively guaranteed by the 10th wish). Exceptional at foreshadowing and at a visible "bad luck" floor.

### Skin tiers
10. **Valorant skin editions** — [Valorant wiki: Weapon Skins](https://valorant.fandom.com/wiki/Weapon_Skins), [Kill Banners](https://wiki.playvalorant.com/en-us/Kill_Banners).
    Five editions, Select 875 / Deluxe 1,275 / Premium 1,775 / Exclusive 2,175 / Ultra 2,475 VP: a steady price
    ladder. Each edition has its own **icon shape and colour** (Premium a pink inverted triangle, Ultra a yellow
    square), so tier reads without colour alone. Higher editions add upgrade levels that unlock VFX, animation,
    finisher, and Premium and Ultra can carry custom kill banners and audio. Exceptional at "more money = more
    moving parts", shown in the store preview.
11. **League of Legends skin tiers** — [LoL wiki: Champion skin](https://leagueoflegends.fandom.com/wiki/Champion_skin).
    Standard 975 RP (new model, texture, splash) → Epic 1,350 (+ new animations, VFX, sounds) → Legendary 1,820
    (+ new voice, "complete re-imagining") → Ultimate 3,250 (+ a model that evolves into different forms).
    Exceptional at a written, cumulative "what this tier adds" contract that players can hold Riot to.
12. **Fortnite rarity colours** *(play knowledge)*. Grey, green, blue, purple, orange/gold, used everywhere (shop
    card background, item border, drop beam). Exceptional at one colour ladder meaning the same thing on every
    surface. Effort already has its own ladder (grey, blue, purple, gold, red), so we take the consistency, not the
    colours.

## Steal list

| # | Decision | Reference | Exactly what's taken | Why it suits a friend-squad walking game |
|---|---|---|---|---|
| **Journey map** |||||
| M1 | Single vertical serpentine path, start at the bottom, boss lair at the top; opens scrolled to the squad | Duolingo path; Candy Crush | One-column zig-zag of nodes, auto-scroll to "you are here" | Thumb-scrolls naturally on a phone held upright; no pinch-zoom map to learn |
| M2 | Path is a dashed ink trail that fills solid gold behind the squad, with a soft footprint stamp every ~1k steps | Pikmin Bloom trail; Conqueror progress | Visible trail left behind the walker | Steps become something you can see; gold already means reward in Effort |
| M3 | Squad marker = a huddle of each friend's character face (overlapping 28px circles), at the combined position; whoever walked today bobs, anyone at zero sits greyed at the back | Candy Crush friend pins; Conqueror shows others on the route | Friends' faces on the map as pins | Combined goal, but you can still see who is carrying the team today, which drives gentle peer nudges |
| M4 | On return, the huddle walks the new distance (1.2–2s ease-out, path filling under it) before the screen settles | Candy Crush / Duolingo token hop | Animate the delta since last visit, then rest | Rewards opening the app; makes overnight steps by friends feel like a team move |
| M5 | 5–6 checkpoints are named landmarks with a silhouette and a Lilita One name plate (e.g. "Murkwater Ford", "Spore Gate"), not numbered dots | Mario Wonder world map | Nodes as places with silhouettes | Names give the squad something to say in chat ("we're nearly at the Spore Gate") |
| M6 | Reaching a checkpoint unlocks a **postcard** card: landmark art, one line of lore, the date and who walked most that leg; one tap posts it to squad chat | The Conqueror virtual postcards | Checkpoint = collectable, shareable card | Gives every 1–2 days a moment, and a chat post that pulls lapsed friends back |
| M7 | Boss portrait sits at the top from Monday in silhouette, revealing colour and detail at each checkpoint passed; full reveal at the last checkpoint | Slay the Spire boss icon visible from act start | Always-visible destination boss | Builds the week's anticipation toward the existing boss fight |
| M8 | Each realm = one ground palette over the navy base + 3 parallax prop layers + one ambient particle (fog wisps, drifting spores, snow, lightning flicker, rising bubbles, scanline glitch, twinkling stars) | Mario Wonder ambient motion; Candy Crush themed episodes | Theme carried by scenery and ambient motion, chrome unchanged | Seven realms reuse one component; only the art layer and one particle preset change |
| M9 | Sticky header: "18,400 / 70,000 steps to the Lair", a thin bar with checkpoint ticks, and "next: Spore Gate in 3,100" | Duolingo unit header band | One summary band above the scroll | Answers the three questions without scrolling |
| **Winny's Gamba Bucket** |||||
| L1 | Bucket starts Common and gets exactly 3 taps; each tap may upgrade it one rarity up the existing ladder (grey → blue → purple → gold → red), with a tap counter shown | Brawl Stars Starr Drops; Clash Royale Lucky Chests (3 taps) | Tap-to-upgrade rarity with a fixed, visible tap count | Short, countable suspense; the player does something, and friends can watch over a shoulder |
| L2 | Each upgrade adds one feedback layer: Common pop → Rare + coin spray → Epic + screen shake → Legendary + gold light rays and 300ms slow-mo → Mythic + full-screen red takeover and a haptic triple-pulse | Starr Drop colour/size escalation | Escalation budget, one layer per rarity | Higher rarities are felt, not just labelled; keeps Common cheap and quick |
| L3 | Before the item flips, the bucket's final colour floods the background for ~600ms (the "tell") | Genshin meteor colour | Rarity foreshadowed before the reveal | The payoff begins during the build-up; works at a glance in a group |
| L4 | "Odds" chip on the buy button opens a sheet: a stacked bar of the 5 rarities with exact % (one decimal), then a per-rarity list of every prize and its %, plus duplicate fallback (coins) | Supercell Starr Drop Chances table | Two-level odds table incl. fallback column | Meets every store rule; friends can check the maths, which is the trust |
| L5 | Visible pity line: "Epic or better guaranteed within 10 buckets (7 left)" | Genshin public pity | Published bad-luck floor | Stops a cold streak souring the squad on the feature |
| L6 | Epic and above auto-post a small card to squad chat ("Winny's bucket coughed up a Legendary for Sam") | Clash Royale / Brawl Stars social share *(play knowledge)* | Brag moment in the group | The friend squad is the audience; celebrating together beats solitary pulls |
| L7 | Results and the odds sheet read from one config file; the outcome is rolled first, then the animation plays it; no fake "almost Legendary" teases outside the real tap upgrades | Ukie Principle 6, 5Rights findings | Honest-by-construction pipeline | The displayed odds can't drift from the real ones |
| **Paid skin tiers** |||||
| S1 | Five tiers with a written cumulative contract: **Tint** (palette swap) → **Outfit** (new outfit art + tier frame) → **Animated** (+ idle loop: breathing, prop sway) → **Aura** (+ idle particle aura and a map trail) → **Legend** (+ new silhouette, entrance and victory animation in the boss fight, custom chat banner and sound) | LoL tier table; Valorant editions | Each tier strictly adds to the one below, published per tier | Buyers know what they pay for; no tier feels like a reskin of the one below |
| S2 | Each tier has its own badge shape + colour: circle, rounded square, shield, hexagon, star | Valorant edition icons (distinct shape and colour) | Shape-coded tier icons | Reads for colour-blind friends and at 20px on the squad screen |
| S3 | Tier 4+ skins leave their own trail on the journey map (embers, frost, sparks) instead of the default gold footprints, for that friend's share of the huddle | Pikmin Bloom trail; links to M2 | Cosmetic shows up on the shared map | The skin is seen by the whole squad every day, which is what makes it worth buying |
| S4 | Silhouette only changes from tier 5 (Legend); below that the body shape stays, so the jump is obvious | LoL Legendary "complete re-imagining", Ultimate evolving forms | Silhouette change reserved for the top | Makes the top tier recognisable across the screen |
| S5 | Shop preview plays the exact idle, aura and trail on *your* character on a mini map strip before purchase, with the tier contract listed as ticks | Valorant store preview of VFX and levels | Try-before-buy with the real animations | No surprises after paying; good-faith selling to friends |
| S6 | Price steps of roughly 1.4x per tier, with the biggest jump into Legend | Valorant 875→2,475; LoL 975→3,250 | Proportional price ladder | Price tracks visible effort, so the ladder feels fair |

## Honest-odds and loot box rules to follow

- **Apple App Store 3.1.1:** apps offering loot boxes "must disclose the odds of receiving each type of item to
  customers prior to purchase." [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).
- **Google Play:** must "clearly disclose the odds of receiving those items in advance of purchase."
  [Game Developer report](https://www.gamedeveloper.com/business/games-on-the-google-play-store-now-required-to-disclose-loot-box-odds).
- **UK industry principles (Ukie with DCMS, 18 July 2023, in force from 18 July 2024):** cover loot boxes bought
  with real money *or* in-game virtual currency, but "not … a loot box that is purely earned through gameplay".
  Principle 5: clear, simple probability disclosure before acquiring or opening; Principle 6: design that is
  easily understood and promotes fair play; Principle 1: under-18s need parental controls for paid loot boxes.
  [Ukie press release](https://ukie.org.uk/news/new-loot-box-principles-agreed-by-industry).
- **UK Gambling Commission (2017):** where items from a loot box can't be cashed out or traded for money, it is
  "unlikely to be caught as a licensable gambling activity." [Gambling Commission](https://www.gamblingcommission.gov.uk/news/article/loot-boxes-within-video-games).
- **What counts as a good disclosure:** a 2025 study found only 8.6% of top UK iPhone games with loot boxes
  disclosed odds for all of them; it judged "<1%" as too vague and relative labels like "Low Chance" as not a
  disclosure at all. [Royal Society Open Science / PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12115820/).

**Rules for Effort:** coins for the bucket are earned only by walking and are never sold for real money (keeps it
"purely earned through gameplay"); bucket prizes can't be traded or cashed out; paid-tier skins are never inside
the bucket, so paid and random never mix; odds shown as exact numbers on the buy screen, not a separate website;
pity line always visible; no gem-to-coin conversion. The name "Gamba" is a joke among friends, and the plain
numbers keep it a joke.

## Fonts

Unchanged: **Lilita One** (display) and **Rubik** (UI), both SIL Open Font License, already used in `docs/game.css`.
This extends an existing app, so the usual "new type per project" rule doesn't apply here: consistency inside one
game beats novelty.

## Banned defaults avoided

- No purple or blue gradients as decoration. Colour on these screens is the realm palette over Effort's navy, plus
  the rarity ladder where rarity is the meaning.
- No glassmorphism or frosted panels: panels stay Effort's solid framed panels with an ink lip.
- No emoji as icons and no generic line-icon set: checkpoint landmarks, tier badges and the bucket are drawn
  illustrations in the outlined game style.
- No soft glow as decoration: light rays and colour floods appear only at Legendary/Mythic reveal moments, where
  they carry meaning (L2, L3).
- No numbered "01/02/03" eyebrows; checkpoints have names, not numbers.

## Screenshots in this folder

| File | Shows |
|---|---|
| `conqueror-route66-mobile.png` | The Conqueror challenge page on mobile: distance, postcard count, Street View flag |
| `duolingo-path-blog-mobile.png` | Duolingo's path announcement with the stepped node path illustration |
| `brawlstars-starr-drop-odds-mobile.png` | Supercell's Starr Drop odds disclosure page on mobile |
| `clashroyale-lucky-chest-odds-mobile.png` | Supercell's Lucky Chest tap-upgrade odds page on mobile |

In-game captures of Candy Crush, Mario Wonder, Slay the Spire, Pikmin Bloom and Genshin were not taken (they need
the games running). Techniques only were taken from all references: no art, text or logos are copied.
