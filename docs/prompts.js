// Krillion-style science prompts: name one thing, rarer answers score more. Data only.
(function (root) {
"use strict";
// a: [answer, rarity 1-3, ...aliases]
const PROMPTS = [
  // ---------- Chemistry ----------
  { id: "noble-gas", q: "Name a noble gas", a: [
    ["helium", 1], ["neon", 1], ["argon", 2], ["krypton", 2], ["xenon", 2], ["radon", 3], ["oganesson", 3]] },

  { id: "halogen", q: "Name a halogen", a: [
    ["chlorine", 1], ["fluorine", 1], ["iodine", 2], ["bromine", 2], ["astatine", 3], ["tennessine", 3]] },

  { id: "alkali-metal", q: "Name an alkali metal", a: [
    ["sodium", 1], ["potassium", 1], ["lithium", 1], ["caesium", 2, "cesium"], ["rubidium", 3], ["francium", 3]] },

  { id: "alkaline-earth", q: "Name an alkaline earth metal", a: [
    ["calcium", 1], ["magnesium", 1], ["beryllium", 2], ["barium", 2], ["strontium", 3], ["radium", 3]] },

  { id: "gas-element", q: "Name an element that's a gas at room temperature", a: [
    ["oxygen", 1], ["nitrogen", 1], ["hydrogen", 1], ["helium", 2], ["chlorine", 2], ["neon", 2], ["argon", 2],
    ["fluorine", 3], ["krypton", 3], ["xenon", 3], ["radon", 3]] },

  { id: "one-letter-symbol", q: "Name an element with a one-letter symbol", a: [
    ["hydrogen", 1], ["oxygen", 1], ["carbon", 1], ["nitrogen", 2], ["sulfur", 2, "sulphur"], ["phosphorus", 2],
    ["potassium", 2], ["iodine", 2], ["fluorine", 2], ["uranium", 2], ["boron", 2],
    ["tungsten", 3, "wolfram"], ["vanadium", 3], ["yttrium", 3]] },

  { id: "odd-symbol", q: "Name an element whose symbol doesn't start with the first letter of its English name", a: [
    ["gold", 1], ["iron", 1], ["silver", 2], ["lead", 2], ["sodium", 2], ["potassium", 2], ["mercury", 2],
    ["tin", 2], ["tungsten", 3], ["antimony", 3]] },

  { id: "element-person", q: "Name an element named after a real person", a: [
    ["einsteinium", 1], ["curium", 1], ["mendelevium", 2], ["nobelium", 2], ["fermium", 2], ["rutherfordium", 2],
    ["bohrium", 2], ["copernicium", 2], ["seaborgium", 3], ["lawrencium", 3], ["meitnerium", 3],
    ["roentgenium", 3, "rontgenium"], ["flerovium", 3], ["oganesson", 3], ["gadolinium", 3], ["samarium", 3]] },

  { id: "element-place", q: "Name an element named after a place", a: [
    ["americium", 1], ["californium", 1], ["francium", 1], ["germanium", 1], ["polonium", 2], ["europium", 2],
    ["berkelium", 2], ["gallium", 2], ["scandium", 2], ["strontium", 3], ["ytterbium", 3], ["yttrium", 3],
    ["terbium", 3], ["erbium", 3], ["holmium", 3], ["hafnium", 3], ["lutetium", 3, "lutecium"], ["ruthenium", 3],
    ["rhenium", 3], ["thulium", 3], ["magnesium", 3], ["manganese", 3], ["copper", 3], ["darmstadtium", 3],
    ["dubnium", 3], ["hassium", 3], ["nihonium", 3], ["moscovium", 3], ["tennessine", 3], ["livermorium", 3]] },

  { id: "element-celestial", q: "Name an element named after a planet, star, moon or asteroid", a: [
    ["uranium", 1], ["plutonium", 1], ["neptunium", 2], ["helium", 2], ["mercury", 3], ["selenium", 3],
    ["tellurium", 3], ["cerium", 3], ["palladium", 3]] },

  { id: "carbon-allotrope", q: "Name an allotrope of carbon", a: [
    ["diamond", 1], ["graphite", 1], ["graphene", 1],
    ["fullerene", 2, "fullerenes", "buckminsterfullerene", "buckyball", "buckyballs", "c60"],
    ["carbon nanotube", 2, "carbon nanotubes", "nanotube", "nanotubes"],
    ["amorphous carbon", 3, "charcoal", "soot", "carbon black"],
    ["lonsdaleite", 3, "hexagonal diamond"], ["glassy carbon", 3, "vitreous carbon"],
    ["carbon nanofoam", 3, "nanofoam"], ["carbyne", 3, "linear acetylenic carbon"], ["q carbon", 3],
    ["cyclocarbon", 3], ["graphyne", 3]] },

  // ---------- Units ----------
  { id: "si-base-unit", q: "Name an SI base unit", a: [
    ["metre", 1, "meter"], ["kilogram", 1, "kilogramme"], ["second", 1], ["ampere", 2, "amp"], ["kelvin", 2],
    ["mole", 2, "mol"], ["candela", 3]] },

  { id: "si-derived-unit", q: "Name an SI derived unit with its own special name", a: [
    ["newton", 1], ["joule", 1], ["watt", 1], ["volt", 2], ["ohm", 2], ["hertz", 2], ["pascal", 2],
    ["coulomb", 2], ["tesla", 2], ["farad", 2], ["henry", 3], ["weber", 3], ["siemens", 3], ["becquerel", 3],
    ["gray", 3], ["sievert", 3], ["lumen", 3], ["lux", 3], ["radian", 3], ["steradian", 3], ["katal", 3],
    ["degree celsius", 3, "celsius", "degrees celsius"]] },

  { id: "si-prefix", q: "Name an SI prefix", a: [
    ["kilo", 1], ["mega", 1], ["milli", 1], ["giga", 1], ["centi", 2], ["micro", 2], ["nano", 2], ["tera", 2],
    ["deci", 2], ["pico", 2], ["peta", 2], ["hecto", 3], ["deca", 3, "deka"], ["exa", 3], ["femto", 3],
    ["atto", 3], ["zetta", 3], ["yotta", 3], ["zepto", 3], ["yocto", 3], ["ronna", 3], ["quetta", 3],
    ["ronto", 3], ["quecto", 3]] },

  { id: "si-person", q: "Name a person with an SI unit named after them", a: [
    ["newton", 1, "isaac newton"], ["watt", 1, "james watt"], ["tesla", 1, "nikola tesla"],
    ["kelvin", 2, "lord kelvin", "william thomson"], ["joule", 2, "james joule", "james prescott joule"],
    ["volta", 2, "alessandro volta"], ["ampere", 2, "andre marie ampere", "andre ampere"],
    ["ohm", 2, "georg ohm", "georg simon ohm"], ["hertz", 2, "heinrich hertz"], ["faraday", 2, "michael faraday"],
    ["pascal", 2, "blaise pascal"], ["celsius", 2, "anders celsius"],
    ["coulomb", 3, "charles coulomb", "charles augustin de coulomb"],
    ["siemens", 3, "werner von siemens", "werner siemens"], ["weber", 3, "wilhelm weber", "wilhelm eduard weber"],
    ["henry", 3, "joseph henry"], ["becquerel", 3, "henri becquerel"],
    ["gray", 3, "louis harold gray", "harold gray"], ["sievert", 3, "rolf sievert"]] },

  // ---------- Physics ----------
  { id: "quark", q: "Name a flavour of quark", a: [
    ["up", 1], ["down", 1], ["strange", 2], ["charm", 2, "charmed"], ["top", 2, "truth"], ["bottom", 3, "beauty"]] },

  { id: "lepton", q: "Name a lepton", a: [
    ["electron", 1], ["neutrino", 2, "neutrinos"], ["muon", 2], ["tau", 3, "tauon", "tau lepton"],
    ["electron neutrino", 3], ["muon neutrino", 3], ["tau neutrino", 3], ["positron", 3, "antielectron"],
    ["antineutrino", 3], ["antimuon", 3]] },

  { id: "boson", q: "Name an elementary boson in the Standard Model", a: [
    ["photon", 1], ["higgs boson", 1, "higgs"], ["gluon", 2], ["w boson", 2, "w", "w plus", "w minus"],
    ["z boson", 2, "z", "z0", "z zero"]] },

  { id: "fundamental-force", q: "Name one of the four fundamental forces", a: [
    ["gravity", 1, "gravitation", "gravitational force", "gravitational"],
    ["electromagnetism", 1, "electromagnetic force", "electromagnetic", "electromagnetic interaction"],
    ["strong nuclear force", 2, "strong force", "strong", "strong interaction", "strong nuclear"],
    ["weak nuclear force", 2, "weak force", "weak", "weak interaction", "weak nuclear"]] },

  { id: "em-spectrum", q: "Name a region of the electromagnetic spectrum", a: [
    ["visible light", 1, "visible", "light"], ["x rays", 1, "x ray"],
    ["radio waves", 1, "radio", "radio wave"], ["microwaves", 2, "microwave"], ["ultraviolet", 2, "uv"],
    ["infrared", 2, "ir"], ["gamma rays", 2, "gamma ray", "gamma", "gamma radiation"],
    ["terahertz", 3, "terahertz radiation", "t rays"]] },

  { id: "radioactive-decay", q: "Name a type of radioactive decay", a: [
    ["alpha", 1, "alpha decay", "alpha particle", "alpha radiation", "alpha emission"],
    ["beta", 1, "beta decay", "beta minus", "beta minus decay", "beta radiation", "beta particle"],
    ["gamma", 1, "gamma decay", "gamma emission", "gamma radiation"],
    ["positron emission", 2, "beta plus", "beta plus decay"], ["electron capture", 3, "k capture"],
    ["spontaneous fission", 3, "fission"], ["neutron emission", 3], ["proton emission", 3], ["cluster decay", 3],
    ["internal conversion", 3], ["isomeric transition", 3], ["double beta decay", 3, "double beta"]] },

  // ---------- Astronomy ----------
  { id: "ringed-planet", q: "Name a planet with rings", a: [
    ["saturn", 1], ["uranus", 2], ["jupiter", 2], ["neptune", 3]] },

  { id: "dwarf-planet", q: "Name a dwarf planet", a: [
    ["pluto", 1], ["ceres", 2], ["eris", 2], ["haumea", 3], ["makemake", 3], ["gonggong", 3], ["quaoar", 3],
    ["sedna", 3], ["orcus", 3]] },

  { id: "jupiter-moon", q: "Name a moon of Jupiter", a: [
    ["io", 1], ["europa", 1], ["ganymede", 1], ["callisto", 2], ["amalthea", 3], ["himalia", 3], ["thebe", 3],
    ["metis", 3], ["adrastea", 3], ["elara", 3], ["pasiphae", 3], ["sinope", 3], ["lysithea", 3], ["carme", 3],
    ["ananke", 3], ["leda", 3], ["themisto", 3], ["callirrhoe", 3], ["megaclite", 3], ["taygete", 3],
    ["chaldene", 3], ["harpalyke", 3], ["kalyke", 3], ["iocaste", 3], ["erinome", 3], ["isonoe", 3],
    ["praxidike", 3], ["autonoe", 3], ["thyone", 3], ["hermippe", 3], ["aitne", 3], ["eurydome", 3],
    ["euanthe", 3], ["euporie", 3], ["orthosie", 3], ["sponde", 3], ["kale", 3], ["pasithee", 3],
    ["hegemone", 3], ["mneme", 3], ["aoede", 3], ["thelxinoe", 3], ["arche", 3], ["kallichore", 3],
    ["helike", 3], ["carpo", 3], ["eukelade", 3], ["cyllene", 3], ["kore", 3], ["herse", 3], ["dia", 3],
    ["eupheme", 3], ["valetudo", 3], ["pandia", 3], ["ersa", 3], ["philophrosyne", 3], ["eirene", 3]] },

  { id: "saturn-moon", q: "Name a moon of Saturn", a: [
    ["titan", 1], ["enceladus", 2], ["mimas", 2], ["rhea", 2], ["iapetus", 2], ["dione", 2], ["tethys", 2],
    ["hyperion", 2], ["phoebe", 2], ["janus", 3], ["epimetheus", 3], ["pan", 3], ["daphnis", 3], ["atlas", 3],
    ["prometheus", 3], ["pandora", 3], ["aegaeon", 3], ["methone", 3], ["anthe", 3], ["pallene", 3],
    ["telesto", 3], ["calypso", 3], ["helene", 3], ["polydeuces", 3], ["kiviuq", 3], ["ijiraq", 3],
    ["paaliaq", 3], ["skathi", 3, "skadi"], ["albiorix", 3], ["bebhionn", 3], ["erriapus", 3], ["skoll", 3],
    ["siarnaq", 3], ["tarqeq", 3], ["greip", 3], ["hyrrokkin", 3], ["jarnsaxa", 3], ["tarvos", 3],
    ["mundilfari", 3], ["bergelmir", 3], ["narvi", 3], ["suttungr", 3, "suttung"], ["hati", 3], ["farbauti", 3],
    ["fenrir", 3], ["bestla", 3], ["thrymr", 3, "thrym"], ["aegir", 3], ["ymir", 3], ["kari", 3],
    ["fornjot", 3], ["surtur", 3], ["loge", 3], ["gridr", 3], ["angrboda", 3], ["skrymir", 3], ["gerd", 3],
    ["eggther", 3], ["beli", 3], ["gunnlod", 3], ["thiazzi", 3], ["alvaldi", 3], ["geirrod", 3]] },

  { id: "moonwalker", q: "Name a person who has walked on the Moon", a: [
    ["neil armstrong", 1, "armstrong"], ["buzz aldrin", 1, "aldrin", "edwin aldrin"],
    ["alan shepard", 2, "shepard"], ["pete conrad", 3, "conrad", "charles conrad"], ["alan bean", 3, "bean"],
    ["edgar mitchell", 3, "mitchell"], ["david scott", 3, "dave scott", "scott"],
    ["james irwin", 3, "jim irwin", "irwin"], ["john young", 3, "young"],
    ["charles duke", 3, "charlie duke", "duke"], ["eugene cernan", 3, "gene cernan", "cernan"],
    ["harrison schmitt", 3, "jack schmitt", "schmitt"]] },

  { id: "zodiac", q: "Name a constellation of the zodiac", a: [
    ["leo", 1], ["gemini", 1], ["scorpius", 1, "scorpio"], ["virgo", 1], ["aries", 2], ["taurus", 2],
    ["cancer", 2], ["libra", 2], ["sagittarius", 2], ["capricornus", 2, "capricorn"], ["aquarius", 2],
    ["pisces", 2], ["ophiuchus", 3]] },

  { id: "moon-phase", q: "Name a phase of the Moon", a: [
    ["full moon", 1, "full"], ["new moon", 1, "new"], ["crescent", 1, "crescent moon"],
    ["half moon", 2, "half"], ["gibbous", 2, "gibbous moon"], ["first quarter", 2],
    ["last quarter", 2, "third quarter"], ["waxing crescent", 3], ["waning crescent", 3],
    ["waxing gibbous", 3], ["waning gibbous", 3]] },

  // ---------- Earth science ----------
  { id: "atmosphere-layer", q: "Name a layer of Earth's atmosphere", a: [
    ["troposphere", 1], ["stratosphere", 1], ["mesosphere", 2], ["thermosphere", 2], ["exosphere", 2],
    ["ozone layer", 2, "ozonosphere"], ["ionosphere", 3], ["homosphere", 3], ["heterosphere", 3]] },

  { id: "earth-layer", q: "Name a layer of the Earth's interior", a: [
    ["crust", 1], ["mantle", 1], ["core", 1], ["inner core", 2], ["outer core", 2], ["upper mantle", 2],
    ["lower mantle", 2], ["lithosphere", 2], ["continental crust", 2], ["oceanic crust", 2],
    ["asthenosphere", 3], ["mesosphere", 3], ["transition zone", 3, "mantle transition zone"],
    ["d double prime", 3, "d layer"]] },

  { id: "cloud-genus", q: "Name one of the ten main cloud types", a: [
    ["cumulus", 1], ["cirrus", 1], ["stratus", 1], ["cumulonimbus", 2], ["nimbostratus", 2],
    ["stratocumulus", 2], ["altocumulus", 2], ["altostratus", 2], ["cirrostratus", 2], ["cirrocumulus", 3]] },

  { id: "geological-period", q: "Name a geological period", a: [
    ["jurassic", 1], ["cretaceous", 1], ["triassic", 1], ["cambrian", 2], ["permian", 2], ["carboniferous", 2],
    ["devonian", 2], ["silurian", 2], ["ordovician", 2], ["quaternary", 2], ["paleogene", 3, "palaeogene"],
    ["neogene", 3], ["tertiary", 3], ["ediacaran", 3], ["cryogenian", 3], ["tonian", 3], ["stenian", 3],
    ["ectasian", 3], ["calymmian", 3], ["statherian", 3], ["orosirian", 3], ["rhyacian", 3], ["siderian", 3],
    ["mississippian", 3], ["pennsylvanian", 3]] },

  { id: "mohs-mineral", q: "Name a mineral on the Mohs hardness scale", a: [
    ["diamond", 1], ["quartz", 1], ["talc", 1], ["topaz", 2], ["gypsum", 2], ["calcite", 2],
    ["fluorite", 2, "fluorspar"], ["corundum", 2], ["apatite", 3],
    ["orthoclase", 3, "orthoclase feldspar", "feldspar"]] },

  // ---------- Anatomy ----------
  { id: "arm-hand-bone", q: "Name a bone in the human arm or hand", a: [
    ["humerus", 1], ["radius", 1], ["ulna", 1], ["phalanges", 2, "phalanx", "phalange"],
    ["metacarpals", 2, "metacarpal"], ["carpals", 2, "carpal", "carpus"], ["scaphoid", 2], ["lunate", 3],
    ["triquetrum", 3, "triquetral"], ["pisiform", 3], ["trapezium", 3], ["trapezoid", 3], ["capitate", 3],
    ["hamate", 3], ["sesamoid", 3]] },

  { id: "leg-foot-bone", q: "Name a bone in the human leg or foot", a: [
    ["femur", 1, "thighbone"], ["tibia", 1, "shinbone"], ["fibula", 1],
    ["patella", 1, "kneecap"], ["metatarsals", 2, "metatarsal"], ["tarsals", 2, "tarsal", "tarsus"],
    ["phalanges", 2, "phalanx", "phalange"], ["calcaneus", 2, "heel bone", "calcaneum"],
    ["talus", 2, "astragalus", "ankle bone"], ["navicular", 3], ["cuboid", 3],
    ["cuneiform", 3, "medial cuneiform", "intermediate cuneiform", "lateral cuneiform"], ["sesamoid", 3]] },

  { id: "skull-bone", q: "Name a bone of the skull (ear bones count)", a: [
    ["mandible", 1, "jawbone", "lower jaw"], ["frontal", 2, "frontal bone"],
    ["parietal", 2, "parietal bone"], ["temporal", 2, "temporal bone"], ["occipital", 2, "occipital bone"],
    ["maxilla", 2, "upper jaw", "maxillae"], ["zygomatic", 2, "cheekbone", "zygoma", "malar"],
    ["nasal", 2, "nasal bone"], ["sphenoid", 3], ["ethmoid", 3], ["lacrimal", 3], ["palatine", 3],
    ["vomer", 3], ["inferior nasal concha", 3, "nasal concha", "turbinate", "inferior turbinate"],
    ["malleus", 3, "hammer"], ["incus", 3, "anvil"], ["stapes", 3, "stirrup"]] },

  { id: "brain-lobe", q: "Name a lobe of the cerebral cortex", a: [
    ["frontal", 1, "frontal lobe"], ["temporal", 1, "temporal lobe"], ["parietal", 1, "parietal lobe"],
    ["occipital", 2, "occipital lobe"], ["insular", 3, "insula", "insular lobe", "insular cortex"],
    ["limbic", 3, "limbic lobe"]] },

  { id: "heart-part", q: "Name a chamber or valve of the heart", a: [
    ["atrium", 1, "atria"], ["ventricle", 1, "ventricles"], ["left atrium", 2], ["right atrium", 2],
    ["left ventricle", 2], ["right ventricle", 2], ["mitral valve", 2, "mitral", "bicuspid", "bicuspid valve"],
    ["tricuspid valve", 3, "tricuspid"], ["aortic valve", 3, "aortic"],
    ["pulmonary valve", 3, "pulmonary", "pulmonic", "pulmonic valve"]] },

  // ---------- Biology ----------
  { id: "organelle", q: "Name an organelle", a: [
    ["nucleus", 1], ["mitochondrion", 1, "mitochondria"], ["ribosome", 1, "ribosomes"],
    ["chloroplast", 2, "chloroplasts"], ["golgi apparatus", 2, "golgi", "golgi body", "golgi complex"],
    ["endoplasmic reticulum", 2, "er", "rough er", "smooth er", "rough endoplasmic reticulum",
      "smooth endoplasmic reticulum"],
    ["lysosome", 2, "lysosomes"], ["vacuole", 2, "vacuoles"], ["centriole", 3, "centrioles"],
    ["centrosome", 3], ["nucleolus", 3], ["peroxisome", 3, "peroxisomes"], ["vesicle", 3, "vesicles"],
    ["plastid", 3], ["cilium", 3, "cilia"], ["flagellum", 3, "flagella"], ["cytoskeleton", 3],
    ["endosome", 3], ["amyloplast", 3], ["chromoplast", 3], ["leucoplast", 3, "leukoplast"],
    ["glyoxysome", 3], ["proteasome", 3], ["contractile vacuole", 3],
    ["nuclear envelope", 3, "nuclear membrane"], ["acrosome", 3], ["melanosome", 3], ["phagosome", 3],
    ["autophagosome", 3], ["thylakoid", 3], ["pyrenoid", 3], ["eyespot", 3], ["apicoplast", 3],
    ["kinetoplast", 3], ["hydrogenosome", 3], ["mitosome", 3]] },

  { id: "nucleobase", q: "Name a nucleobase found in DNA or RNA", a: [
    ["adenine", 1], ["thymine", 2], ["guanine", 2], ["cytosine", 2], ["uracil", 3]] },

  { id: "amino-acid", q: "Name an amino acid used to build proteins", a: [
    ["glycine", 1], ["tryptophan", 1], ["alanine", 2], ["leucine", 2], ["lysine", 2], ["glutamine", 2],
    ["glutamic acid", 2, "glutamate"], ["cysteine", 2], ["methionine", 2], ["phenylalanine", 2],
    ["valine", 2], ["serine", 2], ["tyrosine", 2], ["arginine", 2], ["histidine", 3], ["isoleucine", 3],
    ["threonine", 3], ["proline", 3], ["asparagine", 3], ["aspartic acid", 3, "aspartate"],
    ["selenocysteine", 3], ["pyrrolysine", 3]] },

  { id: "vitamin", q: "Name a vitamin (letter or chemical name)", a: [
    ["a", 1, "vitamin a", "retinol"], ["c", 1, "vitamin c", "ascorbic acid"],
    ["d", 1, "vitamin d", "calciferol", "cholecalciferol", "ergocalciferol", "d2", "d3", "vitamin d2", "vitamin d3"],
    ["b", 1, "vitamin b", "b complex", "vitamin b complex"],
    ["b12", 2, "vitamin b12", "cobalamin", "cyanocobalamin"], ["e", 2, "vitamin e", "tocopherol"],
    ["k", 2, "vitamin k", "phylloquinone", "menaquinone", "k1", "k2", "vitamin k1", "vitamin k2"],
    ["b9", 2, "vitamin b9", "folate", "folic acid"], ["b1", 3, "vitamin b1", "thiamine", "thiamin"],
    ["b2", 3, "vitamin b2", "riboflavin"],
    ["b3", 3, "vitamin b3", "niacin", "nicotinic acid", "niacinamide", "nicotinamide"],
    ["b5", 3, "vitamin b5", "pantothenic acid"], ["b6", 3, "vitamin b6", "pyridoxine"],
    ["b7", 3, "vitamin b7", "biotin", "vitamin h"]] },

  { id: "taxonomic-rank", q: "Name one of the eight main ranks of biological classification", a: [
    ["kingdom", 1], ["species", 1], ["genus", 1], ["family", 2], ["order", 2], ["class", 2],
    ["phylum", 2, "division"], ["domain", 3]] },

  { id: "cell-cycle", q: "Name a stage of the cell cycle or of mitosis", a: [
    ["prophase", 1], ["metaphase", 1], ["anaphase", 1], ["telophase", 1], ["interphase", 2],
    ["cytokinesis", 2], ["prometaphase", 3], ["g1", 3, "g1 phase", "gap 1", "gap phase 1"],
    ["s phase", 3, "synthesis phase", "synthesis"], ["g2", 3, "g2 phase", "gap 2", "gap phase 2"],
    ["g0", 3, "g0 phase", "quiescence"], ["m phase", 3, "mitosis", "mitotic phase"]] },

  // ---------- Scientists ----------
  { id: "nobel-woman", q: "Name a woman who won a Nobel in Physics, Chemistry or Medicine (up to 2025)", a: [
    ["marie curie", 1, "curie", "madame curie", "marie sklodowska curie", "maria sklodowska"],
    ["jennifer doudna", 2, "doudna"], ["dorothy hodgkin", 2, "hodgkin", "dorothy crowfoot hodgkin"],
    ["katalin kariko", 2, "kariko"], ["emmanuelle charpentier", 2, "charpentier"],
    ["irene joliot curie", 2, "joliot curie", "irene curie"], ["ada yonath", 3, "yonath"],
    ["frances arnold", 3, "arnold", "frances hamilton arnold"], ["carolyn bertozzi", 3, "bertozzi"],
    ["maria goeppert mayer", 3, "goeppert mayer", "maria mayer"], ["donna strickland", 3, "strickland"],
    ["andrea ghez", 3, "ghez"], ["anne lhuillier", 3, "lhuillier"], ["gerty cori", 3, "cori", "gerty theresa cori"],
    ["rosalyn yalow", 3, "yalow"], ["barbara mcclintock", 3, "mcclintock"],
    ["rita levi montalcini", 3, "levi montalcini"], ["gertrude elion", 3, "elion", "trudy elion"],
    ["christiane nusslein volhard", 3, "nusslein volhard", "nuesslein volhard"], ["linda buck", 3, "buck"],
    ["francoise barre sinoussi", 3, "barre sinoussi"], ["elizabeth blackburn", 3, "blackburn"],
    ["carol greider", 3, "greider"], ["may britt moser", 3, "moser"], ["tu youyou", 3, "youyou tu", "tu"],
    ["mary brunkow", 3, "brunkow", "mary e brunkow"]] },
];
root.EffortPrompts = PROMPTS;
})(typeof window !== "undefined" ? window : globalThis);
