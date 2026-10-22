import { Rng } from '../core/math';
import type { BuildingDef, FenceDef, PenDef, PropDef, RanchMap, TreeDef } from './mapTypes';
import { pruneTrees } from './solids';

/**
 * Natalie's ranch, laid out top-to-bottom like the property:
 *  - main residence + driveway turnaround in the upper area
 *  - second residence with its picket yard on the left, middle
 *  - a winding gravel access road connecting everything
 *  - the big sandy riding arena along the right-hand side
 *  - barns and outbuildings across the bottom
 *  - round fenced enclosures (the kitten corral, a lunging paddock, the chicken run)
 *  - open meadow in the middle, mature trees and wooded edges all round.
 */
export const WORLD_W = 2400;
export const WORLD_H = 3000;

export const ARENA = { x: 1700, y: 760, w: 580, h: 1240 };
export const YARD = { x: 200, y: 1090, w: 420, h: 350 };
export const CORRAL = { x: 1520, y: 2230, r: 150 };

function buildings(): BuildingDef[] {
  return [
    { id: 'house', style: 'farmhouse', x: 740, y: 300, w: 320, h: 170, wall: 96, roof: '#5b6b7d', walls: '#f3e6cc', label: 'Main House' },
    { id: 'garage', style: 'garage', x: 1110, y: 345, w: 130, h: 120, wall: 70, roof: '#6d5446', walls: '#d9c7a4' },
    { id: 'cottage', style: 'cottage', x: 290, y: 1170, w: 210, h: 120, wall: 72, roof: '#8a4b3b', walls: '#e9dcc0', label: 'Guest House' },
    { id: 'barn', style: 'barn', x: 820, y: 2525, w: 400, h: 235, wall: 120, roof: '#7a3a2e', walls: '#b8382c', label: 'Big Red Barn' },
    { id: 'feedShed', style: 'shed', x: 1360, y: 2625, w: 160, h: 115, wall: 70, roof: '#5f4a3a', walls: '#a94336' },
    { id: 'tackShed', style: 'shed', x: 470, y: 2600, w: 150, h: 115, wall: 66, roof: '#5f4a3a', walls: '#9a7b56' },
    { id: 'coop', style: 'coop', x: 1950, y: 2400, w: 62, h: 44, wall: 38, roof: '#7a3a2e', walls: '#e8d6ad' },
  ];
}

function fences(): FenceDef[] {
  const a = ARENA;
  const y = YARD;
  return [
    // Arena: west gate (from the road) and south gate (toward the chicken run).
    { style: 'rail', points: [[a.x, 1440], [a.x, a.y], [a.x + a.w, a.y], [a.x + a.w, a.y + a.h], [2050, a.y + a.h]] },
    { style: 'rail', points: [[1950, a.y + a.h], [a.x, a.y + a.h], [a.x, 1560]] },
    // Guest house picket yard: east gate to the road, south gate to the pond.
    { style: 'picket', points: [[y.x + y.w, 1235], [y.x + y.w, y.y], [y.x, y.y], [y.x, y.y + y.h], [370, y.y + y.h]] },
    { style: 'picket', points: [[455, y.y + y.h], [y.x + y.w, y.y + y.h], [y.x + y.w, 1325]] },
    // Vegetable garden by the main house (low fence, open on the east).
    { style: 'picket', points: [[680, 380], [500, 380], [500, 540], [680, 540]] },
  ];
}

function pens(): PenDef[] {
  return [
    { id: 'corral', x: CORRAL.x, y: CORRAL.y, r: CORRAL.r, gateAngle: Math.PI + 0.42, gateWidth: 104, role: 'target', label: 'Kitten Corral' },
    { id: 'paddock', x: 560, y: 2050, r: 130, gateAngle: 0, gateWidth: 92, role: 'paddock', label: 'Lunging Paddock' },
    { id: 'chickens', x: 1980, y: 2440, r: 100, role: 'chickens', label: 'Chicken Run' },
  ];
}

function props(): PropDef[] {
  return [
    // Driveway & house
    { kind: 'mailbox', x: 1395, y: 115, solid: true },
    { kind: 'flowers', x: 930, y: 642, w: 44, solid: true },
    { kind: 'bench', x: 1010, y: 505, w: 40 },
    { kind: 'scarecrow', x: 590, y: 450, solid: true },
    { kind: 'well', x: 640, y: 760, solid: true },
    // Guest house yard
    { kind: 'clothesline', x: 410, y: 1125, w: 150 },
    { kind: 'yarn', x: 430, y: 1340 },
    { kind: 'flowers', x: 250, y: 1400, w: 30 },
    { kind: 'flowers', x: 560, y: 1140, w: 26 },
    // Meadow
    { kind: 'roundBale', x: 1460, y: 1080, w: 26, solid: true },
    { kind: 'rock', x: 1240, y: 1340, w: 22, solid: true },
    { kind: 'rock', x: 900, y: 2000, w: 18, solid: true },
    { kind: 'cart', x: 1610, y: 1640, solid: true },
    // Arena jumps and barrels
    { kind: 'jump', x: 1850, y: 990, w: 110, solid: true },
    { kind: 'jump', x: 2120, y: 1200, w: 110, solid: true },
    { kind: 'jump', x: 1880, y: 1450, w: 110, solid: true },
    { kind: 'jump', x: 2110, y: 1700, w: 110, solid: true },
    { kind: 'barrel', x: 1990, y: 1000, w: 15, solid: true },
    { kind: 'barrel', x: 1990, y: 1350, w: 15, solid: true },
    { kind: 'barrel', x: 1840, y: 1820, w: 15, solid: true },
    { kind: 'sign', x: 1655, y: 1410, text: 'ARENA', solid: true },
    // Barnyard
    { kind: 'roundBale', x: 770, y: 2470, w: 24, solid: true },
    { kind: 'roundBale', x: 1268, y: 2492, w: 24, solid: true },
    { kind: 'roundBale', x: 1300, y: 2545, w: 22, solid: true },
    { kind: 'squareBale', x: 1250, y: 2700, w: 56, h: 30, solid: true },
    { kind: 'trough', x: 1110, y: 2430, w: 76, h: 26, solid: true },
    { kind: 'box', x: 1235, y: 2335 },
    { kind: 'barrel', x: 660, y: 2620, w: 14, solid: true },
    { kind: 'napHay', x: 700, y: 2830, w: 70 },
    { kind: 'mouseHole', x: 852, y: 2760 },
    { kind: 'sign', x: 1395, y: 2120, text: 'KITTENS', solid: true },
    { kind: 'cart', x: 1700, y: 2760, solid: true },
  ];
}

/** Hand-placed specimen trees plus procedurally scattered wooded edges. */
function trees(): TreeDef[] {
  const out: TreeDef[] = [];
  const rng = new Rng(20241022);
  const add = (x: number, y: number, r: number, variant: TreeDef['variant'] = 'oak') =>
    out.push({ x, y, r, variant, seed: Math.floor(rng.next() * 1e6) });

  // Mature trees around the main house and turnaround.
  add(1290, 640, 62);
  add(620, 250, 54);
  add(1450, 360, 50, 'pine');
  add(1510, 520, 44, 'pine');
  add(420, 700, 58);
  add(820, 880, 48);
  // Guest house surroundings.
  add(160, 1000, 50, 'pine');
  add(700, 1300, 56, 'willow');
  add(860, 1640, 46);
  add(560, 1600, 40, 'bush');
  // Meadow specimens (shade spots).
  add(1350, 920, 66);
  add(1460, 1650, 58);
  add(1180, 1180, 36, 'bush');
  add(940, 1260, 40, 'bush');
  // Near barns and paddock.
  add(360, 2250, 56);
  add(820, 2240, 44, 'bush');
  add(1750, 2280, 52);
  add(2200, 2640, 58, 'pine');
  add(1600, 2600, 40, 'bush');
  add(300, 2780, 52, 'pine');

  const keepClear = (x: number, y: number): boolean => {
    // Driveway entry, top-left road corridor and the treasure clearings stay open.
    if (x > 1240 && x < 1420 && y < 260) return true;
    if (Math.hypot(x - 2230, y - 300) < 110) return true;
    if (Math.hypot(x - 170, y - 2900) < 90) return true;
    return false;
  };

  // Wooded edges: a dense outer band beyond the playable margin and a ragged inner band.
  const edge = (x: number, y: number, inner: boolean) => {
    if (keepClear(x, y)) return;
    const r = inner ? rng.range(34, 52) : rng.range(44, 66);
    const v: TreeDef['variant'] = rng.next() < 0.45 ? 'pine' : 'oak';
    add(x + rng.range(-14, 14), y + rng.range(-14, 14), r, v);
  };
  for (let x = 30; x < WORLD_W; x += 78) {
    edge(x, 28, false);
    edge(x, WORLD_H - 20, false);
    if (rng.next() < 0.5) edge(x + 30, 110, true);
    if (rng.next() < 0.35 && (x < 760 || x > 1500)) edge(x + 20, WORLD_H - 110, true);
  }
  for (let y = 100; y < WORLD_H - 60; y += 80) {
    edge(26, y, false);
    edge(WORLD_W - 22, y, false);
    if (rng.next() < 0.45) edge(115, y + 30, true);
    if (rng.next() < 0.45 && (y < ARENA.y - 60 || y > ARENA.y + ARENA.h + 60)) edge(WORLD_W - 110, y + 30, true);
  }
  // Thicker woods in the top corners, with a clearing (and a secret) in the top-right.
  for (let i = 0; i < 26; i++) {
    edge(rng.range(1760, 2350), rng.range(120, 560), true);
  }
  for (let i = 0; i < 14; i++) {
    edge(rng.range(120, 460), rng.range(130, 330), true);
  }
  return out;
}

export function createRanchMap(): RanchMap {
  const map: RanchMap = {
    width: WORLD_W,
    height: WORLD_H,
    margin: 72,
    roads: [
      // Driveway from the county road to the house.
      { kind: 'gravel', width: 64, points: [[1325, 0], [1330, 170], [1270, 380], [1150, 560], [1010, 615]] },
      // Turnaround loop in front of the main house.
      { kind: 'gravel', width: 58, loop: true, points: [[930, 555], [1015, 600], [1015, 690], [930, 730], [845, 690], [845, 600]] },
      // The winding access road down through the property.
      { kind: 'gravel', width: 60, points: [[905, 730], [840, 900], [720, 1060], [760, 1300], [960, 1520], [1080, 1800], [1060, 2100], [1020, 2380]] },
      // Branch to the guest house yard gate.
      { kind: 'gravel', width: 50, points: [[725, 1060], [640, 1160], [600, 1280], [560, 1282]] },
      // Branch to the arena's west gate.
      { kind: 'dirt', width: 52, points: [[960, 1520], [1250, 1490], [1500, 1480], [1730, 1500]] },
      // Footpaths.
      { kind: 'footpath', width: 34, points: [[1080, 1900], [1250, 2050], [1390, 2170]] },
      { kind: 'footpath', width: 30, points: [[1060, 2080], [880, 2070], [700, 2050]] },
      { kind: 'footpath', width: 30, points: [[2000, 2000], [2010, 2180], [1990, 2330]] },
      { kind: 'footpath', width: 28, points: [[415, 1440], [470, 1540], [600, 1600]] },
      { kind: 'footpath', width: 28, points: [[1220, 2780], [1100, 2860], [900, 2860], [720, 2820]] },
    ],
    areas: [
      { kind: 'woods', shape: { type: 'rect', x: 1740, y: 90, w: 640, h: 520, r: 120 } },
      { kind: 'woods', shape: { type: 'rect', x: 80, y: 90, w: 420, h: 280, r: 100 } },
      { kind: 'meadow', shape: { type: 'ellipse', x: 1330, y: 1350, rx: 330, ry: 520 } },
      { kind: 'lawn', shape: { type: 'rect', x: 690, y: 230, w: 620, h: 560, r: 120 } },
      { kind: 'garden', shape: { type: 'rect', x: 510, y: 392, w: 160, h: 136, r: 10 } },
      { kind: 'lawn', shape: { type: 'rect', x: YARD.x + 8, y: YARD.y + 8, w: YARD.w - 16, h: YARD.h - 16, r: 20 } },
      { kind: 'sand', shape: { type: 'rect', x: ARENA.x + 4, y: ARENA.y + 4, w: ARENA.w - 8, h: ARENA.h - 8, r: 6 } },
      { kind: 'dirt', shape: { type: 'ellipse', x: 1040, y: 2440, rx: 380, ry: 150 } },
      { kind: 'dirt', shape: { type: 'ellipse', x: 560, y: 2050, rx: 124, ry: 124 } },
      { kind: 'dirt', shape: { type: 'ellipse', x: 1980, y: 2440, rx: 96, ry: 96 } },
      { kind: 'lawn', shape: { type: 'ellipse', x: CORRAL.x, y: CORRAL.y, rx: CORRAL.r - 6, ry: CORRAL.r - 6 } },
      { kind: 'water', shape: { type: 'ellipse', x: 720, y: 1610, rx: 118, ry: 72 } },
    ],
    buildings: buildings(),
    trees: [],
    fences: fences(),
    pens: pens(),
    props: props(),
    distractions: [
      { id: 'yarn', kind: 'yarn', x: 430, y: 1340, radius: 260 },
      { id: 'box', kind: 'box', x: 1235, y: 2335, radius: 230 },
      { id: 'ducks', kind: 'ducks', x: 720, y: 1610, radius: 270 },
      { id: 'chickens', kind: 'chickens', x: 1980, y: 2440, radius: 260 },
      { id: 'flowers', kind: 'flowers', x: 600, y: 460, radius: 230 },
    ],
    discoveries: [
      { id: 'mailbox', x: 1395, y: 140, r: 90, title: 'The Mailbox', text: 'NATALIE & DEPUTY. No solicitors. No dogs. Absolutely no baths.' },
      { id: 'scarecrow', x: 590, y: 470, r: 90, title: 'Scarecrow', text: 'Fired. Too scary for kittens, not scary enough for crows.' },
      { id: 'arena', x: 1650, y: 1440, r: 90, title: 'Riding Arena', text: 'Tigers welcome. Horses concerned.' },
      { id: 'pond', x: 720, y: 1700, r: 120, title: 'Duck Pond', text: 'Ducks have the right of way. The ducks wrote this sign.' },
      { id: 'nap', x: 700, y: 2830, r: 80, title: "Deputy's Nap Spot", text: 'Tiger-shaped dent in the hay: certified authentic.' },
      { id: 'mouse', x: 852, y: 2795, r: 70, title: 'Mouse Hole', text: 'WANTED: The Mouse. Reward: one (1) nap.' },
      { id: 'chickens', x: 1985, y: 2310, r: 90, title: 'Chicken Run', text: 'The chickens are deeply unimpressed by your tiger.' },
      { id: 'laundry', x: 410, y: 1150, r: 80, title: 'Clothesline', text: 'Three socks are missing. The kittens know something.' },
    ],
    collectibles: [
      { id: 'shoe-woods', kind: 'horseshoe', x: 2230, y: 300 },
      { id: 'shoe-barn', kind: 'horseshoe', x: 1020, y: 2865 },
      { id: 'shoe-paddock', kind: 'horseshoe', x: 505, y: 2010 },
      { id: 'shoe-corner', kind: 'horseshoe', x: 170, y: 2900 },
      { id: 'treats-porch', kind: 'treatBag', x: 900, y: 525 },
      { id: 'treats-tack', kind: 'treatBag', x: 545, y: 2765 },
      { id: 'treats-arena', kind: 'treatBag', x: 2230, y: 1960 },
    ],
    zoomieZones: [{ x: ARENA.x, y: ARENA.y, w: ARENA.w, h: ARENA.h }],
    extraSolids: [
      // Pond edge approximated by overlapping circles.
      { kind: 'circle', x: 650, y: 1610, r: 62 },
      { kind: 'circle', x: 720, y: 1605, r: 68 },
      { kind: 'circle', x: 792, y: 1612, r: 60 },
    ],
  };
  map.trees = pruneTrees(map, trees());
  return map;
}
