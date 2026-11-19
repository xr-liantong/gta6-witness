// Solvara as data: a road grid, lots, buildings, palms, lamps, parking bays, walking
// loops and the landmarks the story needs. No three.js in here — the renderer turns
// this into geometry, the HUD draws its minimap from the very same numbers.

import { WORLD, PALETTE } from './config.js';

// Small deterministic generator: the city (and every screenshot) is always the same.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length];
const centre = (i) => WORLD.start + WORLD.road + WORLD.block / 2 + i * WORLD.pitch;

export function roadAxis() {
  const out = [];
  for (let i = 0; i <= WORLD.blocks; i += 1) {
    const from = WORLD.start + i * WORLD.pitch;
    out.push({ from, to: from + WORLD.road, mid: from + WORLD.road / 2, index: i });
  }
  return out;
}

function makeBuilding(rand, x, z, w, d, base, downtown) {
  const h = Math.max(6, base * (0.55 + downtown * 1.05));
  const tall = h > 24;
  return {
    x, z, w, d, h,
    tint: pick(rand, PALETTE.walls),
    roof: pick(rand, PALETTE.roofs),
    crown: tall && rand() < 0.6 ? { w: w * (0.5 + rand() * 0.2), d: d * (0.5 + rand() * 0.2), h: 2.5 + rand() * 4 } : null,
    awning: rand() < 0.55 ? { color: pick(rand, [0xd8543f, 0x2f8f8a, 0xd9a62e, 0x3f6f9f]), h: 2.6 } : null,
    // A couple of boxes on the roof break the silhouette when seen from above.
    vents: tall || rand() < 0.4 ? 1 + Math.floor(rand() * 2) : 0,
  };
}

function fillBlock(rand, block, buildings, palms, lamps) {
  const inner = WORLD.block - WORLD.walk * 2;
  const downtown = Math.max(0, 1 - Math.hypot(block.x, block.z) / 300);
  const cols = rand() < 0.5 ? 3 : 2;
  const rows = rand() < 0.5 ? 3 : 2;
  const lotW = inner / cols;
  const lotD = inner / rows;
  for (let cx = 0; cx < cols; cx += 1) {
    for (let cz = 0; cz < rows; cz += 1) {
      if (rand() < 0.1) continue; // a gap becomes a yard or a car park
      const lx = block.x - inner / 2 + lotW * (cx + 0.5);
      const lz = block.z - inner / 2 + lotD * (cz + 0.5);
      const w = lotW * (0.62 + rand() * 0.3);
      const d = lotD * (0.62 + rand() * 0.3);
      const base = 9 + rand() * 30;
      buildings.push(makeBuilding(rand, lx, lz, w, d, base, downtown));
    }
  }

  // Palms and lamps down the pavement ring, so every street has shade and light.
  const half = WORLD.block / 2;
  const step = WORLD.block / 5;
  for (let i = -2; i <= 2; i += 1) {
    const along = i * step;
    palms.push({ x: block.x + along, z: block.z - half + 3.1, h: 6.5 + rand() * 3.5, lean: (rand() - 0.5) * 0.18 });
    palms.push({ x: block.x + along, z: block.z + half - 3.1, h: 6.5 + rand() * 3.5, lean: (rand() - 0.5) * 0.18 });
    palms.push({ x: block.x - half + 3.1, z: block.z + along, h: 6.5 + rand() * 3.5, lean: (rand() - 0.5) * 0.18 });
    if (i % 2 === 0) {
      lamps.push({ x: block.x + along, z: block.z + half - 1.4 });
      lamps.push({ x: block.x - half + 1.4, z: block.z + along });
    }
  }
}

// Four avenues, each with two directions; traffic and the police both use these.
function trafficLanes(axis, bounds) {
  const lanes = [];
  const pad = 26;
  for (const a of axis) {
    lanes.push({
      a: { x: bounds.min - pad, z: a.mid - 7.2 },
      b: { x: bounds.max + pad, z: a.mid - 7.2 },
    });
    lanes.push({
      a: { x: bounds.max + pad, z: a.mid + 7.2 },
      b: { x: bounds.min - pad, z: a.mid + 7.2 },
    });
    lanes.push({
      a: { x: a.mid + 7.2, z: bounds.min - pad },
      b: { x: a.mid + 7.2, z: bounds.max + pad },
    });
    lanes.push({
      a: { x: a.mid - 7.2, z: bounds.max + pad },
      b: { x: a.mid - 7.2, z: bounds.min - pad },
    });
  }
  return lanes;
}

export function buildWorld(seed = 1) {
  const rand = mulberry(seed * 2654435761 + 7);
  const axis = roadAxis();
  const bounds = {
    min: WORLD.start,
    max: WORLD.start + WORLD.blocks * WORLD.pitch + WORLD.road,
  };
  const blocks = [];
  const buildings = [];
  const palms = [];
  const lamps = [];
  const parked = [];
  const half = WORLD.block / 2;

  for (let bx = 0; bx < WORLD.blocks; bx += 1) {
    for (let bz = 0; bz < WORLD.blocks; bz += 1) {
      const block = {
        x: centre(bx), z: centre(bz), w: WORLD.block, d: WORLD.block,
        index: blocks.length, mainStreet: bz === 1,
      };
      blocks.push(block);
      fillBlock(rand, block, buildings, palms, lamps);

      const kinds = ['sedan', 'coupe', 'van'];
      const slots = [
        { x: block.x - half - 3.4, z: block.z + 26, yaw: Math.PI },
        { x: block.x + half + 3.4, z: block.z - 30, yaw: 0 },
        { x: block.x + 28, z: block.z + half + 3.4, yaw: Math.PI / 2 },
        { x: block.x - 26, z: block.z - half - 3.4, yaw: -Math.PI / 2 },
      ];
      for (let i = 0; i < slots.length; i += 1) {
        parked.push({ ...slots[i], kind: kinds[(blocks.length + i) % 3] });
      }
    }
  }

  // Signature buildings: the hotel forecourt in the centre block, kept clear of lots.
  const hotel = { x: 34, z: 40 };
  buildings.push({
    x: 8, z: -12, w: 54, d: 44, h: 38,
    tint: 0xf7f3ea, roof: 0xc8c0b0, crown: { w: 30, d: 26, h: 5 },
    awning: { color: 0x2f8f8a, h: 3.2 }, vents: 2,
  });
  const marina = { x: -78, z: 294 };
  const docks = { x: 206, z: 292 };

  const pedPaths = blocks.map((b) => ({
    x: b.x,
    z: b.z,
    points: [
      { x: b.x - half + 3.5, z: b.z - half + 3.5 },
      { x: b.x + half - 3.5, z: b.z - half + 3.5 },
      { x: b.x + half - 3.5, z: b.z + half - 3.5 },
      { x: b.x - half + 3.5, z: b.z + half - 3.5 },
    ],
  }));

  // The beach: umbrellas, towels and a few rocks so the sand is not an empty strip.
  const umbrellas = [];
  const towels = [];
  for (let i = 0; i < 14; i += 1) {
    const x = -252 + i * 36 + rand() * 10;
    umbrellas.push({
      x,
      z: WORLD.shore + 8 + rand() * 22,
      color: pick(rand, [0xe4573f, 0x2f8f8a, 0xf0c04a, 0x3f6f9f, 0xf4f0e6]),
      lean: (rand() - 0.5) * 0.25,
    });
    towels.push({ x: x + 4 + rand() * 3, z: WORLD.shore + 12 + rand() * 18, color: pick(rand, PALETTE.walls) });
  }

  // Walking height: the pavement sits a kerb above the asphalt. Cars and the player
  // both read this so nothing sinks into a block or floats over a road.
  function groundAt(x, z) {
    for (const b of blocks) {
      if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2) return 0.22;
    }
    return 0.03;
  }

  return {
    seed,
    groundAt,
    bounds,
    axis,
    blocks,
    buildings,
    palms,
    lamps,
    umbrellas,
    towels,
    coast: { sand: WORLD.shore, water: WORLD.sea, level: WORLD.seaLevel },
    sidewalks: blocks.map((b) => ({ x: b.x, z: b.z, w: b.w, d: b.d })),
    parked,
    pedPaths,
    lanes: trafficLanes(axis, bounds),
    // Start on the avenue, looking down the canyon: the marina is behind you, the hotel
    // forecourt one block east, and the whole city is walkable from the first step.
    spawn: { x: -85, z: 56, yaw: Math.PI },
    hotel,
    marina,
    docks,
    pier: { x: -78, z: 296, w: 14, d: 86 },
    // The mission's car is parked on the hotel forecourt, facing the sea.
    jobCar: { x: hotel.x + 14, z: hotel.z + 16, yaw: Math.PI / 2, kind: 'coupe' },
    markers: {
      fixer: { x: marina.x, z: marina.z, label: 'Reina Sosa' },
      car: { x: hotel.x + 14, z: hotel.z + 16, label: 'the emerald coupé' },
      drop: { x: docks.x, z: docks.z, label: 'the docks' },
    },
  };
}
