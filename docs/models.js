// 3D boss models for the arena. All CC0 (public domain) by Quaternius (quaternius.com), via poly.pizza.
// Each entry: url, height in arena units, hover (flyers float), tint (blended into the model's colours),
// and clips: for each role, animation names to try in order (the "CharacterArmature|" prefix is ignored).
(function () {
  const BLOB = { idle: ["Idle"], attack: ["Bite_Front"], hit: ["HitRecieve"], death: ["Death"], roar: ["No", "Dance"], stomp: ["Jump"], eat: ["Bite_Front"], win: ["Yes", "Dance"] };
  const FLY = { idle: ["Flying_Idle"], attack: ["Headbutt", "Punch"], hit: ["HitReact"], death: ["Death"], roar: ["No"], stomp: ["Fast_Flying", "Headbutt"], eat: ["Headbutt"], win: ["Yes"] };
  const BIG = { idle: ["Idle"], attack: ["Punch", "Weapon"], hit: ["HitReact"], death: ["Death"], roar: ["No", "Wave"], stomp: ["Jump", "Jump_Land"], eat: ["Weapon", "Punch"], win: ["Yes", "Wave"] };
  window.EffortModels = {
    notification: { url: "models/notification.glb", height: 4.0, clips: BLOB, credit: "Pink Slime" },
    autoplay: { url: "models/autoplay.glb", height: 4.6, clips: BLOB, credit: "Mushnub Evolved" },
    leftonread: { url: "models/leftonread.glb", height: 5.0, hover: 0.9, clips: FLY, credit: "Ghost" },
    scroll: { url: "models/scroll.glb", height: 5.4, hover: 0.8, clips: FLY, credit: "Hywirl" },
    kraken: { url: "models/kraken.glb", height: 5.8, hover: 0.7, clips: FLY, credit: "Squidle" },
    algorithm: { url: "models/algorithm.glb", height: 6.6, clips: BIG, credit: "Blue Demon" },
    dragon: { url: "models/dragon.glb", height: 7.0, hover: 0.9, clips: FLY, credit: "Dragon Evolved" },
    taxman: {
      url: "models/taxman.glb", height: 5.2, credit: "Business Man", taxman: true,
      clips: { idle: ["Idle"], attack: ["Punch_Right", "Punch_Left"], hit: ["HitRecieve", "HitRecieve_2"], death: ["Death"], roar: ["Wave"], stomp: ["Kick_Right"], eat: ["Interact"], win: ["Wave"] },
    },
  };
})();
