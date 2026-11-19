// Solvara: names, numbers and colours. The city's identity and every tunable value
// live here, so the other modules read as behaviour instead of as magic constants.

export const CITY = {
  name: 'SOLVARA',
  tagline: 'Sun, sea and somebody else\'s car',
  districts: ['La Marina', 'Centro', 'Altos Verdes'],
  radio: 'SOL 92.7',
  hero: 'Dani Cruz',
  fixer: 'Reina Sosa',
  hotel: 'Hotel Miramar',
};

// A square grid of four avenues and three rows of blocks, with a beach and open sea
// along the south edge. Distances are metres.
export const WORLD = {
  blocks: 3,
  block: 140,
  road: 30,
  walk: 6,
  pitch: 170,
  start: -270,
  shore: 300,      // where the sand starts
  sea: 340,        // where the water starts
  seaLevel: -0.35,
};

export const TUNING = {
  walk: 4.6,
  run: 8.4,
  accel: 26,
  turn: 11,
  jump: 7.2,
  gravity: -24,
  eye: 1.62,
  camBack: 6.2,
  camLift: 1.9,
  camLag: 9,
  mouse: 0.0026,
  pitchMin: -0.5,
  pitchMax: 0.95,
  healthMax: 100,
};

export const PALETTE = {
  sky: 0x8ec9e8,
  haze: 0xdfe9ec,
  sun: 0xfff0d2,
  ambient: 0xbcd4de,
  asphalt: 0x50555d,
  lane: 0xf0ead6,
  sidewalk: 0xe0d8c6,
  kerb: 0xbdb5a4,
  sand: 0xe8d7b2,
  sea: 0x2e7f96,
  seaShallow: 0x67c6c4,
  trunk: 0x7a5a3c,
  palm: 0x4f8f45,
  glass: 0x86c7d9,
  walls: [0xf2e3c6, 0xe3a893, 0xa9d6c6, 0xf7f3ea, 0xd9c49a, 0x9fc0d6],
  roofs: [0xb7b0a2, 0x9a948a, 0xc8c0b0],
  police: 0x243a6e,
  policeLight: 0xd93b3b,
  policeBlue: 0x3b6fd9,
  heroShirt: 0xf4f0e6,
  heroPants: 0x35424f,
  marker: 0xffd34d,
};

// Screenshot poses. The page reads ?shot=<name>&seed=<n> and builds exactly this
// frame, so the four contact-sheet pictures are reproducible.
export const SHOTS = {
  street: { mode: 'foot' },
  chase: { mode: 'chase' },
  mission: { mode: 'mission' },
  beach: { mode: 'beach' },
};

// How loudly the city objects to crime. Used by police.js and combat.js.
export const LAW = {
  stars: 5,
  spawnDistance: 130,   // a cruiser appears this far away, on the nearest avenue
  loseDistance: 90,     // out of every cruiser's sight for...
  loseSeconds: 8,       // ...this long, and the city calms down
  decaySeconds: 22,     // without any new crime, one star goes away
  cruiserSpeed: 22,
};

export const SAVE_KEY = 'solvara.save.v2';
