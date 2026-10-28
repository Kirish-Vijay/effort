// 3D boss models for the arena. All CC0 (public domain) by Quaternius (quaternius.com), via poly.pizza.
// Each entry: url, height in arena units, hover (flyers float), tint (blended into the model's colours),
// paint (material name -> colour, replacing that part's colour outright),
// and clips: for each role, animation names to try in order (the "CharacterArmature|" prefix is ignored).
(function () {
  const BLOB = { idle: ["Idle"], attack: ["Bite_Front"], hit: ["HitRecieve"], death: ["Death"], roar: ["No", "Dance"], stomp: ["Jump"], eat: ["Bite_Front"], win: ["Yes", "Dance"] };
  const FLY = { idle: ["Flying_Idle"], attack: ["Headbutt", "Punch"], hit: ["HitReact"], death: ["Death"], roar: ["No"], stomp: ["Fast_Flying", "Headbutt"], eat: ["Headbutt"], win: ["Yes"] };
  const BIG = { idle: ["Idle"], attack: ["Punch", "Weapon"], hit: ["HitReact"], death: ["Death"], roar: ["No", "Wave"], stomp: ["Jump", "Jump_Land"], eat: ["Weapon", "Punch"], win: ["Yes", "Wave"] };
  window.EffortModels = {
    notification: { url: "models/notification.glb", height: 4.0, clips: BLOB, credit: "Pink Slime" },
    autoplay: { url: "models/autoplay.glb", height: 4.6, clips: BLOB, credit: "Mushnub Evolved",
      paint: { MushroomKing_Main: "#ff5a00", MushroomKing_Secondary: "#d63c00", Spikes: "#ffd84a" } }, // Rory: bright orange
    leftonread: { url: "models/leftonread.glb", height: 5.0, hover: 0.9, clips: FLY, credit: "Ghost" },
    scroll: { url: "models/scroll.glb", height: 5.4, hover: 0.8, clips: FLY, credit: "Hywirl" },
    kraken: { url: "models/kraken.glb", height: 5.8, hover: 0.7, clips: FLY, credit: "Squidle" },
    algorithm: { url: "models/algorithm.glb", height: 6.6, clips: BIG, credit: "Blue Demon" },
    dragon: { url: "models/dragon.glb", height: 7.0, hover: 0.9, clips: FLY, credit: "Dragon Evolved" },
    // Yearly event bosses: the same models, recoloured (tint blends in; strong tints read as a new creature).
    "ev-newyear": { url: "models/notification.glb", height: 4.4, clips: BLOB, credit: "Pink Slime", tint: "#7cf0ff" },
    "ev-spring": { url: "models/autoplay.glb", height: 4.8, clips: BLOB, credit: "Mushnub Evolved",
      paint: { MushroomKing_Main: "#ffb000", MushroomKing_Secondary: "#7cc84a", Spikes: "#fff36a" } },
    "ev-solstice": { url: "models/dragon.glb", height: 7.2, hover: 0.9, clips: FLY, credit: "Dragon Evolved", tint: "#ffd23d" },
    "ev-harvest": { url: "models/algorithm.glb", height: 6.8, clips: BIG, credit: "Blue Demon", tint: "#8a5a2b" },
    "ev-haunted": { url: "models/leftonread.glb", height: 5.4, hover: 1.1, clips: FLY, credit: "Ghost", tint: "#b8c4e8" },
    "ev-krampus": { url: "models/algorithm.glb", height: 7.0, clips: BIG, credit: "Blue Demon", tint: "#8e0f24" },
    taxman: {
      url: "models/taxman.glb", height: 5.2, credit: "Business Man", taxman: true,
      clips: { idle: ["Idle"], attack: ["Punch_Right", "Punch_Left"], hit: ["HitRecieve", "HitRecieve_2"], death: ["Death"], roar: ["Wave"], stomp: ["Kick_Right"], eat: ["Interact"], win: ["Wave"] },
    },
  };
})();
