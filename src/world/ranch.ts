import { Rng } from '../core/math';
import type { BuildingDef, FenceDef, PenDef, PropDef, RanchMap, TreeDef } from './mapTypes';
import { pruneTrees } from './solids';

/**
 * The Barn 89 homestead on Buffalo Gap Rd, traced from the aerial photo in docs/reference/aerial.jpg.
 * Scale: one aerial pixel = two world units, so features keep their real relative positions.
 * Every scene (the homestead, Kitten Cowgirl, Yard Boss) uses this one map.
 *
 *  - the drive along the north edge and the teardrop driveway loop around the big front lawn
 *  - the main house west of the loop, with the trampoline, the red-mulch garden and the dogs' house
 *  - Grandpa's house and its fenced yard in the north-east corner
 *  - the access road winding down the west side, past the woodshed and woodpile, to the barns
 *  - the big sandy riding arena against the east fence line
 *  - the stable and Barn 89 (the red barn and old wedding venue) in the south-east, with the
 *    string-lit lawn south of it; the walled round pen (the donkeys' paddock) and the round corral
 *  - fenced paddocks in the north-west, red-dirt creek woods to the south-west
 *  - the chicken run in the clearing south-east of the treehouse
 *  - Buffalo Gap Rd running along the east boundary
 */
export const WORLD_W = 2400;
export const WORLD_H = 3080;

/** The property fence along Buffalo Gap Rd; everything east of it is off-limits. */
export const EAST_FENCE = 2020;
export const ARENA = { x: 1420, y: 1440, w: EAST_FENCE - 1420, h: 600 };
export const YARD = { x: 1360, y: 560, w: EAST_FENCE - 1360, h: 230 };
export const CORRAL = { x: 1320, y: 2510, r: 130 };
export const ROUND_PEN = { x: 1180, y: 1790, r: 110 };
/** The chicken run, in the middle of the clearing south-east of the treehouse. */
export const CHICKEN_RUN = { x: 1320, y: 1090, r: 82 };

function buildings(): BuildingDef[] {
  return [
    // The main house is an L in the aerial: a long wing on the west end runs further south than
    // the rest, gable end facing the yard, and the main block runs east to the treehouse.
    {
      id: 'mainHouse',
      style: 'farmhouse',
      x: 770,
      y: 690,
      w: 330,
      h: 210,
      wall: 100,
      roof: '#6b7480',
      walls: '#efe2c8',
      label: 'HOME',
      trim: { windows: [26, 96, 288], door: 196, porch: [150, 324], chimney: 252, label: 60 },
    },
    {
      id: 'mainHouseWing',
      style: 'farmhouse',
      gable: 'front',
      x: 600,
      y: 680,
      w: 170,
      h: 310,
      wall: 100,
      roof: '#6b7480',
      walls: '#efe2c8',
      trim: { windows: [26, 116] },
    },
    // Grandpa's house: a main block, two gabled bays stepping out toward the back yard (the west
    // one with the doggie door, the east one with his door), the garage set back under its lighter
    // roof (his workshop, with the blue star), and the east wing by his driveway.
    {
      id: 'grandpaHouse',
      style: 'farmhouse',
      x: 1458,
      y: 440,
      w: 200,
      h: 200,
      wall: 96,
      roof: '#5f6670',
      walls: '#f3e9d6',
      trim: { windows: [158], chimney: 60 },
    },
    { id: 'grandpaBayW', style: 'farmhouse', gable: 'front', x: 1494, y: 530, w: 112, h: 142, wall: 92, roof: '#5f6670', walls: '#f3e9d6', label: "GRANDPA'S", trim: { windows: [16, 70], label: 82 } },
    { id: 'grandpaBayE', style: 'farmhouse', gable: 'front', x: 1655, y: 520, w: 90, h: 152, wall: 96, roof: '#5f6670', walls: '#f3e9d6', trim: { door: 34 } },
    // The shop/garage between the porch bay and the east wing, under its own lighter roof in the aerial.
    { id: 'grandpaShop', style: 'shop', x: 1745, y: 476, w: 140, h: 164, wall: 96, roof: '#7b828c', walls: '#ece6da', star: '#2f63c0' },
    { id: 'grandpaEast', style: 'farmhouse', gable: 'front', x: 1885, y: 470, w: 95, h: 202, wall: 96, roof: '#5f6670', walls: '#f3e9d6', trim: { windows: [34] } },
    { id: 'whiteShed', style: 'shed', x: 410, y: 1150, w: 190, h: 130, wall: 70, roof: '#e9ecef', walls: '#f6f3ea' },
    { id: 'eastShed', style: 'shed', x: 1550, y: 1290, w: 110, h: 80, wall: 56, roof: '#c9ced4', walls: '#a94336' },
    { id: 'creekShed', style: 'shed', x: 430, y: 2050, w: 110, h: 90, wall: 56, roof: '#c9ced4', walls: '#9a7b56' },
    { id: 'stable', style: 'barn', x: 1480, y: 2075, w: 400, h: 155, wall: 84, roof: '#8f9bb0', walls: '#b8382c' },
    { id: 'barn89', style: 'barn', x: 1510, y: 2320, w: 320, h: 420, wall: 130, roof: '#8f9bb0', walls: '#b8382c', label: 'BARN 89' },
    { id: 'coop', style: 'coop', x: CHICKEN_RUN.x - 31, y: CHICKEN_RUN.y - 20, w: 62, h: 44, wall: 38, roof: '#7a3a2e', walls: '#e8d6ad' },
  ];
}

function fences(): FenceDef[] {
  const a = ARENA;
  const y = YARD;
  return [
    // Property fence along Buffalo Gap Rd (no gaps: the kittens stay off the highway).
    { style: 'rail', points: [[EAST_FENCE, 0], [EAST_FENCE, WORLD_H]] },
    // Arena: north gate toward the east shed, west gate at the end of the footpath. The east side is the property fence.
    { style: 'rail', points: [[a.x, 1640], [a.x, a.y], [1640, a.y]] },
    { style: 'rail', points: [[1735, a.y], [EAST_FENCE, a.y]] },
    { style: 'rail', points: [[EAST_FENCE, a.y + a.h], [a.x, a.y + a.h], [a.x, 1735]] },
    // Second residence yard: open toward the north drive, gate on the south side.
    { style: 'picket', points: [[y.x, y.y], [y.x, y.y + y.h], [1585, y.y + y.h]] },
    { style: 'picket', points: [[1665, y.y + y.h], [EAST_FENCE, y.y + y.h]] },
    // North-west paddock fence lines, with a gate in the corner.
    { style: 'rail', points: [[280, 110], [280, 980]] },
    { style: 'rail', points: [[60, 980], [180, 980]] },
  ];
}

function pens(): PenDef[] {
  return [
    { id: 'corral', x: CORRAL.x, y: CORRAL.y, r: CORRAL.r, gateAngle: -Math.PI / 2 - 0.35, gateWidth: 104, role: 'target', label: 'Kitten Corral' },
    { id: 'roundPen', x: ROUND_PEN.x, y: ROUND_PEN.y, r: ROUND_PEN.r, gateAngle: -0.5, gateWidth: 88, role: 'paddock', label: 'Round Pen' },
    { id: 'chickens', x: CHICKEN_RUN.x, y: CHICKEN_RUN.y, r: CHICKEN_RUN.r, role: 'chickens', label: 'Chicken Run' },
  ];
}

function props(): PropDef[] {
  return [
    // North drive & mailbox at the highway.
    { kind: 'mailbox', x: 1975, y: 175, solid: true },
    { kind: 'sign', x: 2085, y: 330, text: 'BUFFALO GAP RD' },
    { kind: 'sign', x: 2085, y: 2420, text: 'BUFFALO GAP RD' },
    // Main house surroundings.
    // You can jump on it (see Homestead.onTrampoline), so it isn't solid.
    { kind: 'trampoline', x: 810, y: 1012, w: 40 },
    { kind: 'bench', x: 1060, y: 935, w: 40 },
    // The Loop's start and finish, by the treehouse.
    { kind: 'sign', x: 935, y: 1150, text: 'THE LOOP' },
    // Signposts where the paths meet.
    { kind: 'fingerpost', x: 862, y: 548, text: "<BARNS|GRANDPA'S>" },
    { kind: 'fingerpost', x: 1292, y: 1716, text: 'ARENA>|<ROUND PEN' },
    { kind: 'fingerpost', x: 1432, y: 2212, text: 'BARN 89>|<CORRAL' },
    // Jason's big white truck, beside the main house.
    { kind: 'pickup', x: 548, y: 790, w: 108, angle: Math.PI / 2, color: 'white', solid: true },
    // Grandpa's (Jimmy's) dark charcoal truck, on his drive by the shop.
    { kind: 'pickup', x: 1832, y: 352, w: 98, angle: Math.PI / 2, color: 'charcoal', solid: true },
    // The treehouse at the south-east corner of the main house.
    { kind: 'treehouse', x: 1150, y: 960, solid: true },
    { kind: 'doghouse', x: 560, y: 1010, solid: true },
    // Jason's woodpile beside the woodshed.
    { kind: 'woodpile', x: 470, y: 1330, w: 120, solid: true },
    { kind: 'chopBlock', x: 590, y: 1325, solid: true },
    { kind: 'scarecrow', x: 860, y: 1205, solid: true },
    { kind: 'flowers', x: 760, y: 1190, w: 30 },
    { kind: 'flowers', x: 1030, y: 380, w: 46, solid: true },
    // Second residence yard.
    { kind: 'clothesline', x: 1800, y: 750, w: 130 },
    { kind: 'yarn', x: 1450, y: 735 },
    { kind: 'flowers', x: 1400, y: 610, w: 24 },
    // Grandpa's flower beds and plants, all the way round his house, kept just so.
    { kind: 'flowers', x: 1515, y: 408, w: 24 },
    { kind: 'flowers', x: 1700, y: 406, w: 26 },
    { kind: 'flowers', x: 1880, y: 448, w: 22 },
    { kind: 'flowers', x: 1490, y: 692, w: 18 },
    { kind: 'flowers', x: 2000, y: 612, w: 14 },
    { kind: 'pot', x: 1605, y: 700 },
    { kind: 'pot', x: 1712, y: 700 },
    { kind: 'pot', x: 1444, y: 456 },
    { kind: 'pot', x: 1996, y: 470 },
    // Through the trees.
    { kind: 'rock', x: 1330, y: 1240, w: 22, solid: true },
    { kind: 'roundBale', x: 1030, y: 1460, w: 24, solid: true },
    { kind: 'rock', x: 760, y: 1880, w: 18, solid: true },
    // Arena jumps and barrels.
    { kind: 'jump', x: 1560, y: 1560, w: 100, solid: true },
    { kind: 'jump', x: 1850, y: 1640, w: 100, solid: true },
    { kind: 'jump', x: 1600, y: 1900, w: 100, solid: true },
    { kind: 'barrel', x: 1760, y: 1540, w: 15, solid: true },
    { kind: 'barrel', x: 1730, y: 1800, w: 15, solid: true },
    { kind: 'barrel', x: 1900, y: 1940, w: 15, solid: true },
    { kind: 'sign', x: 1385, y: 1620, text: 'ARENA', solid: true },
    // Barns.
    { kind: 'roundBale', x: 1950, y: 2390, w: 24, solid: true },
    { kind: 'roundBale', x: 1920, y: 2450, w: 22, solid: true },
    { kind: 'squareBale', x: 1940, y: 2600, w: 56, h: 30, solid: true },
    { kind: 'trough', x: 1430, y: 2345, w: 60, h: 24, solid: true },
    { kind: 'box', x: 980, y: 2300 },
    { kind: 'napHay', x: 1440, y: 2160, w: 60 },
    // Barn 89: the old venue lawn with its string lights, and the sign out by the road.
    { kind: 'festoon', x: 1545, y: 2830, w: 250, solid: true },
    { kind: 'festoon', x: 1545, y: 2935, w: 250, solid: true },
    { kind: 'venueSign', x: 1985, y: 2215, solid: true },
    // The long table under the lights, where the family gathers now the weddings are done.
    { kind: 'longTable', x: 1670, y: 2890, w: 150, solid: true },
    // A stray half-painted cabinet outside the workshop (the garage under the blue star).
    { kind: 'cabinet', x: 1792, y: 696, solid: true },
    // Grandpa's back yard: the putting green, and the chihuahuas' doggie door in the back wall.
    { kind: 'puttingGreen', x: 1952, y: 738, w: 64 },
    { kind: 'doggieDoor', x: 1540, y: 673 },
    // A small wooden cross by Grandpa's door.
    { kind: 'wallCross', x: 1684, y: 672 },
    // The donkeys' name board, hung on the front of their pen.
    { kind: 'nameSign', x: 1180, y: 1902, w: 84, text: 'CHEWY   YODA' },
    { kind: 'mouseHole', x: 1525, y: 2230 },
    { kind: 'sign', x: 1150, y: 2350, text: 'CATS', solid: true },
    { kind: 'cart', x: 640, y: 2190, solid: true },
    { kind: 'barrel', x: 570, y: 2110, w: 13, solid: true },
  ];
}

/** Trees placed where the aerial shows them, plus a ragged procedural tree line on the outer edges. */
function trees(): TreeDef[] {
  const out: TreeDef[] = [];
  const rng = new Rng(20241022);
  const add = (x: number, y: number, r: number, variant: TreeDef['variant'] = 'oak') =>
    out.push({ x, y, r, variant, seed: Math.floor(rng.next() * 1e6) });

  // Inside the driveway loop: one giant tree in the middle of the north lawn.
  add(1210, 300, 96);
  // North-west paddocks.
  add(180, 200, 44);
  add(170, 380, 40, 'bush');
  add(150, 640, 48);
  // West woods along the access road.
  add(90, 800, 54, 'pine');
  add(110, 1060, 56);
  add(200, 1220, 50, 'pine');
  add(90, 1420, 58);
  add(220, 1560, 46, 'pine');
  add(80, 1700, 54);
  // Big trees between Barn 89 and the arena.
  add(470, 900, 58);
  add(520, 1420, 50);
  add(620, 1500, 56);
  add(740, 1430, 46, 'bush');
  add(830, 1560, 54);
  add(700, 1640, 48);
  add(960, 1580, 50);
  add(1000, 1720, 46, 'bush');
  add(1110, 1580, 44);
  add(1250, 1520, 48, 'bush');
  add(1080, 1300, 40, 'bush');
  // Tree line along the east fence by the second residence.
  add(1720, 900, 52);
  add(1860, 960, 56);
  add(1960, 880, 44, 'bush');
  add(1760, 1120, 50);
  add(1920, 1180, 54);
  add(1640, 1200, 40, 'bush');
  add(1960, 1360, 46);
  // Red-dirt creek woods to the south-west.
  add(120, 1920, 56);
  add(260, 1830, 48, 'pine');
  add(80, 2200, 58);
  add(300, 2330, 52);
  add(510, 2470, 56);
  add(200, 2580, 54, 'pine');
  add(680, 2620, 52);
  add(820, 2720, 56);
  add(980, 2820, 50);
  add(1140, 2860, 54);
  add(420, 2760, 50, 'pine');
  add(640, 2900, 56);
  add(880, 2960, 48);
  add(760, 2000, 44, 'bush');
  // Odd trees south of the barns.
  add(1880, 2900, 46, 'pine');
  add(1420, 2950, 50);

  // Woods fill, following the aerial: the creek band running south-west and the west woods.
  const near = (x: number, y: number, d: number) => out.some((t) => Math.hypot(t.x - x, t.y - y) < d);
  const scatter = (count: number, accept: (x: number, y: number) => boolean, x0: number, x1: number, y0: number, y1: number) => {
    for (let i = 0, placed = 0; i < count * 6 && placed < count; i++) {
      const x = rng.range(x0, x1);
      const y = rng.range(y0, y1);
      if (!accept(x, y) || near(x, y, 78)) continue;
      add(x, y, rng.range(36, 56), rng.next() < 0.3 ? 'pine' : rng.next() < 0.25 ? 'bush' : 'oak');
      placed++;
    }
  };
  // Creek woods: everything south-west of a line from (0, 1700) to (1400, 3000).
  scatter(70, (x, y) => y > 1700 + x * 0.93 - 120, 60, 1400, 1750, 3030);
  // West woods strip beside the access road.
  scatter(14, () => true, 60, 250, 1040, 1800);
  // Scattered big trees through the middle grounds.
  scatter(12, () => true, 420, 1050, 1300, 1720);

  // Ragged tree line beyond the north, west and south edges (east is the highway).
  const edge = (x: number, y: number) => {
    const v: TreeDef['variant'] = rng.next() < 0.45 ? 'pine' : 'oak';
    add(x + rng.range(-14, 14), y + rng.range(-14, 14), rng.range(40, 62), v);
  };
  for (let y = 60; y < WORLD_H - 40; y += 80) edge(18, y);
  for (let x = 40; x < 1980; x += 82) edge(x, WORLD_H - 16);
  for (let x = 900; x < 1980; x += 150) edge(x, 10);
  return out;
}

export function createRanchMap(): RanchMap {
  const map: RanchMap = {
    width: WORLD_W,
    height: WORLD_H,
    margin: 60,
    roads: [
      // The drive along the north edge, from the corner gate to Buffalo Gap Rd.
      { kind: 'gravel', width: 60, points: [[360, 0], [430, 60], [800, 82], [1400, 92], [1800, 104], [2000, 118], [2200, 132]] },
      // Teardrop driveway loop.
      { kind: 'gravel', width: 56, points: [[820, 92], [845, 330], [900, 480], [1020, 590], [1160, 625], [1300, 570], [1440, 400], [1540, 220], [1590, 100]] },
      // Second residence drive and footpath.
      { kind: 'gravel', width: 50, points: [[1810, 104], [1825, 300], [1840, 430]] },
      { kind: 'footpath', width: 30, points: [[1590, 390], [1660, 300], [1790, 262]] },
      // Access road: from the loop, past Barn 89, down the west side through the trees, east to the barns and out to the highway.
      {
        kind: 'gravel',
        width: 56,
        points: [
          [900, 500], [760, 560], [600, 600], [450, 700], [350, 840], [300, 1000], [290, 1200], [330, 1380],
          [460, 1530], [640, 1690], [840, 1870], [1020, 2030], [1200, 2180], [1380, 2265], [1600, 2272], [1900, 2280], [2200, 2290],
        ],
      },
      // Footpath from Barn 89's garden down to the round pen and the arena gate.
      { kind: 'footpath', width: 32, points: [[1000, 1100], [1060, 1330], [1200, 1500], [1330, 1650], [1420, 1690]] },
      // Track along the north edge of the arena to the east shed.
      { kind: 'footpath', width: 28, points: [[1330, 1650], [1450, 1400], [1600, 1380], [1690, 1420]] },
      // The Loop (the race track): dirt tracks joining the footpath and the access road into one
      // circuit, down the arena fence to the barns and across behind the main house.
      { kind: 'dirt', width: 40, points: [[1330, 1650], [1360, 1900], [1380, 2150], [1380, 2262]] },
      { kind: 'dirt', width: 40, points: [[312, 1062], [470, 1060], [640, 1065], [820, 1075], [1000, 1106]] },
      // Path round the corral and behind the barns.
      { kind: 'footpath', width: 28, points: [[1190, 2300], [1150, 2520], [1250, 2700], [1500, 2800], [1700, 2860]] },
    ],
    areas: [
      { kind: 'asphalt', shape: { type: 'rect', x: 2190, y: -20, w: 170, h: WORLD_H + 40 } },
      { kind: 'woods', shape: { type: 'rect', x: -20, y: 700, w: 300, h: 1250, r: 120 } },
      { kind: 'woods', shape: { type: 'rect', x: -20, y: 1850, w: 700, h: 1260, r: 160 } },
      { kind: 'woods', shape: { type: 'ellipse', x: 820, y: 2800, rx: 460, ry: 300 } },
      { kind: 'lawn', shape: { type: 'poly', points: [[870, 120], [1560, 120], [1450, 380], [1300, 540], [1160, 590], [1020, 555], [920, 460]] } },
      { kind: 'meadow', shape: { type: 'ellipse', x: 1330, y: 2700, rx: 380, ry: 320 } },
      { kind: 'lawn', shape: { type: 'rect', x: YARD.x + 8, y: 680, w: YARD.w - 16, h: 102, r: 12 } },
      { kind: 'sand', shape: { type: 'rect', x: ARENA.x + 4, y: ARENA.y + 4, w: ARENA.w - 8, h: ARENA.h - 8, r: 6 } },
      { kind: 'sand', shape: { type: 'rect', x: 740, y: 950, w: 140, h: 115, r: 12 } },
      { kind: 'clay', shape: { type: 'poly', points: [[670, 1160], [800, 1080], [940, 1150], [900, 1270], [710, 1260]] } },
      { kind: 'clay', shape: { type: 'ellipse', x: 620, y: 1990, rx: 300, ry: 190 } },
      { kind: 'clay', shape: { type: 'ellipse', x: 330, y: 2250, rx: 170, ry: 90 } },
      { kind: 'clay', shape: { type: 'ellipse', x: 880, y: 2420, rx: 120, ry: 70 } },
      { kind: 'dirt', shape: { type: 'rect', x: 1430, y: 2240, w: 520, h: 80, r: 30 } },
      { kind: 'dirt', shape: { type: 'ellipse', x: ROUND_PEN.x, y: ROUND_PEN.y, rx: ROUND_PEN.r - 4, ry: ROUND_PEN.r - 4 } },
      { kind: 'dirt', shape: { type: 'ellipse', x: CHICKEN_RUN.x, y: CHICKEN_RUN.y, rx: CHICKEN_RUN.r - 3, ry: CHICKEN_RUN.r - 3 } },
      { kind: 'lawn', shape: { type: 'ellipse', x: CORRAL.x, y: CORRAL.y, rx: CORRAL.r - 6, ry: CORRAL.r - 6 } },
    ],
    buildings: buildings(),
    trees: [],
    fences: fences(),
    pens: pens(),
    props: props(),
    distractions: [
      { id: 'yarn', kind: 'yarn', x: 1450, y: 735, radius: 260 },
      { id: 'box', kind: 'box', x: 980, y: 2300, radius: 230 },
      { id: 'chickens', kind: 'chickens', x: CHICKEN_RUN.x, y: CHICKEN_RUN.y, radius: 260 },
      { id: 'flowers', kind: 'flowers', x: 800, y: 1175, radius: 230 },
    ],
    discoveries: [
      { id: 'mailbox', x: 1975, y: 200, r: 90, title: 'The Mailbox', text: 'Seed catalogs, a feed store bill, and a postcard addressed to "The Cats".' },
      { id: 'trampoline', x: 810, y: 1060, r: 90, title: 'Trampoline', text: 'Cats have been banned since The Incident. Nobody talks about The Incident.' },
      { id: 'scarecrow', x: 860, y: 1240, r: 80, title: 'Scarecrow', text: 'Fired. Too scary for kittens, not scary enough for crows.' },
      { id: 'arena', x: 1380, y: 1660, r: 90, title: 'Riding Arena', text: 'Wide open sand. The donkeys consider it beneath them.' },
      { id: 'highway', x: 1975, y: 1260, r: 90, title: 'Buffalo Gap Rd', text: 'Wave at the trucks. Do not chase the trucks.' },
      { id: 'venue', x: 1580, y: 2870, r: 100, title: 'Barn 89', text: 'A few old bulbs still glow on the string lights. People danced here every weekend for years.' },
      { id: 'guestbook', x: 1880, y: 2620, r: 70, title: 'Tucked Behind the Barn', text: 'A weathered guestbook page: "Best day ever. The donkeys were very welcoming."' },
      { id: 'mouse', x: 1525, y: 2265, r: 70, title: 'Mouse Hole', text: 'WANTED: The Mouse. Reward: one (1) nap.' },
      { id: 'chickens', x: CHICKEN_RUN.x, y: CHICKEN_RUN.y + 110, r: 90, title: 'Chicken Run', text: 'The chickens are deeply unimpressed by everyone.' },
      { id: 'redDirt', x: 620, y: 1990, r: 110, title: 'Red Dirt', text: 'It gets on everything. Especially white cats.' },
      { id: 'laundry', x: 1800, y: 770, r: 80, title: "Grandpa's Clothesline", text: 'Three socks are missing. The cats know something.' },
      { id: 'woodpile', x: 470, y: 1390, r: 80, title: 'The Woodpile', text: 'Stacked tight, bark side up. Dad has opinions about this.' },
      { id: 'kitchen', x: 725, y: 1010, r: 70, title: 'Kitchen Window', text: 'Through the glass: a well-worn Bible on the counter, a grocery list tucked in for a bookmark, and a coffee ring on the cover.' },
      { id: 'treehouse', x: 1150, y: 1010, r: 80, title: 'The Treehouse', text: 'Up the ladder: a lookout window with the best view of the front lawn on the whole place.' },
      { id: 'blueStar', x: 1805, y: 700, r: 70, title: 'Blue Star', text: "This was Apple's workshop. She and Grandpa fixed up and painted antique furniture here for her business, Blue Star." },
      { id: 'loop', x: 950, y: 1160, r: 70, title: 'The Loop', text: 'Two laps round the middle of the place, on anything with wheels. Everybody remembers their own best time differently.' },
      { id: 'tireSwing', x: 1250, y: 360, r: 70, title: 'Tire Swing', text: 'The rope has been replaced twice. The tire is the original.' },
      { id: 'puddles', x: 930, y: 1950, r: 60, title: 'Puddle', text: 'Faster through the middle. Muddier, too.' },
      { id: 'porch', x: 1670, y: 705, r: 70, title: "Grandpa's Porch", text: 'A small wooden cross by the door, a lawn chair that faces the sunset, and a coffee can of dog treats he swears are for emergencies.' },
    ],
    collectibles: [
      { id: 'shoe-paddock', kind: 'horseshoe', x: 140, y: 170 },
      { id: 'shoe-creek', kind: 'horseshoe', x: 300, y: 2960 },
      { id: 'shoe-roundpen', kind: 'horseshoe', x: 1130, y: 1760 },
      { id: 'shoe-barn', kind: 'horseshoe', x: 1930, y: 2720 },
      { id: 'treats-barn89', kind: 'treatBag', x: 690, y: 1030 },
      { id: 'treats-shed', kind: 'treatBag', x: 520, y: 1430 },
      { id: 'treats-arena', kind: 'treatBag', x: 1975, y: 1490 },
    ],
    zoomieZones: [{ x: ARENA.x, y: ARENA.y, w: ARENA.w, h: ARENA.h }],
    extraSolids: [
      // Buffalo Gap Rd and everything beyond the property fence.
      { kind: 'rect', x: EAST_FENCE + 4, y: -50, w: WORLD_W, h: WORLD_H + 100 },
    ],
  };
  map.trees = pruneTrees(map, trees());
  return map;
}
