/** Data for the two homestead missions and the hidden ornaments. Positions are world units. */

export interface RoundsTask {
  id: string;
  label: string;
  /** Compact label for the mission card. */
  short: string;
  /** Verb for the action button. */
  verb: string;
  x: number;
  y: number;
  /** Task that must be done first. */
  needs?: string;
  done: string;
}

export const ROUNDS_TASKS: RoundsTask[] = [
  { id: 'eggs', label: 'Collect the eggs', short: 'Eggs', verb: 'Collect eggs', x: 1342, y: 1186, done: 'Seven eggs. One suspiciously warm.' },
  { id: 'flowers', label: "Water Grandpa's flowers", short: "Grandpa's flowers", verb: 'Water flowers', x: 1420, y: 648, done: "Grandpa's zinnias say thank you." },
  { id: 'dogs', label: 'Fill the dog bowls', short: 'Dog bowls', verb: 'Fill bowls', x: 690, y: 1008, done: 'Axel and Annie approve. Annie would like seconds.' },
  { id: 'donkeys', label: 'Feed the donkeys', short: 'Donkeys', verb: 'Feed donkeys', x: 1305, y: 1722, done: 'Chewy and Yoda hee-haw their thanks.' },
  { id: 'cats', label: 'Feed the barn cats', short: 'Barn cats', verb: 'Feed cats', x: 1670, y: 2790, done: 'Eight bowls. Eight cats. Somehow nine opinions.' },
  { id: 'kitchen', label: 'Eggs to the kitchen', short: 'Eggs to kitchen', verb: 'Drop off eggs', x: 897, y: 932, needs: 'eggs', done: 'Breakfast is saved.' },
];

/** Seconds for 3 and 2 stars. */
export const ROUNDS_STAR_TIMES: [number, number] = [70, 105];

export interface HuntItem {
  id: string;
  name: string;
  clue: string;
  found: string;
  x: number;
  y: number;
}

export const HUNT_ITEMS: HuntItem[] = [
  {
    id: 'glasses',
    name: 'Reading glasses',
    clue: 'Last I had my reading glasses, I was reading the mail out by the road.',
    found: 'His reading glasses, folded on the grass by the mailbox.',
    x: 1932,
    y: 248,
  },
  {
    id: 'watch',
    name: 'Pocket watch',
    clue: 'I sat a spell watching the donkeys. Must have slipped out of my pocket.',
    found: 'The pocket watch, still ticking, right by the round pen.',
    x: 1050,
    y: 1700,
  },
  {
    id: 'harmonica',
    name: 'Harmonica',
    clue: 'Played the chickens a tune this morning. They did not request an encore.',
    found: 'His harmonica, near the chicken run. The chickens look relieved.',
    x: 1206,
    y: 1166,
  },
  {
    id: 'lure',
    name: 'Lucky fishing lure',
    clue: 'Took my lucky lure down where the red dirt runs, by the little shed.',
    found: 'The lucky lure, hooked on a weed by the creek shed.',
    x: 572,
    y: 2128,
  },
  {
    id: 'key',
    name: 'Lockbox key',
    clue: 'Your dad borrowed my good gloves for the woodpile. The key was in the left one.',
    found: 'The left glove at the woodpile, and the little brass key inside it.',
    x: 392,
    y: 1398,
  },
];

export const LOCKBOX_CODE = [8, 9];

export interface OrnamentDef {
  id: string;
  x: number;
  y: number;
  color: string;
}

export const ORNAMENTS: OrnamentDef[] = [
  { id: 'orn-mailbox', x: 1930, y: 320, color: '#d9434f' },
  { id: 'orn-barn', x: 1872, y: 2560, color: '#3d7fd6' },
  { id: 'orn-arena', x: 1975, y: 2000, color: '#f2c53d' },
  { id: 'orn-paddock', x: 130, y: 130, color: '#3fae5a' },
  { id: 'orn-lights', x: 1610, y: 2985, color: '#f28aa0' },
  { id: 'orn-woods', x: 330, y: 1700, color: '#7b54c9' },
  { id: 'orn-trampoline', x: 742, y: 1062, color: '#f08a24' },
  { id: 'orn-creek', x: 760, y: 2300, color: '#e8e8e8' },
];

/* --- Races on the Loop ------------------------------------------------------------------------ */

/** The start and finish line, out front of the main house by the treehouse. */
export const RACE_START = { x: 1000, y: 1110 };
/**
 * The Loop: one lap round the middle of the place on the paths that are already there. Down the
 * footpath past the round pen, along the arena fence to the barns, back up the access road
 * through the trees, past the woodpile and the trampoline, and over the line. Every corner is a
 * checkpoint gate.
 */
export const RACE_TRACK: { x: number; y: number }[] = [
  { x: 1060, y: 1330 },
  { x: 1200, y: 1500 },
  { x: 1330, y: 1650 },
  { x: 1360, y: 1900 },
  { x: 1380, y: 2150 },
  { x: 1200, y: 2180 },
  { x: 1020, y: 2030 },
  { x: 840, y: 1870 },
  { x: 640, y: 1690 },
  { x: 460, y: 1530 },
  { x: 330, y: 1380 },
  { x: 290, y: 1200 },
  { x: 330, y: 1050 },
  { x: 470, y: 1060 },
  { x: 640, y: 1065 },
  { x: 820, y: 1075 },
  RACE_START,
];
/** Kept as the name the rest of the game knows the checkpoints by. */
export const RACE_GATES = RACE_TRACK;
export const RACE_LAPS = 2;
/** Every gate of the race in order (all laps). */
export const RACE_COURSE = Array.from({ length: RACE_LAPS }, () => RACE_TRACK).flat();
/** How close counts as through a gate. */
export const RACE_GATE_R = 60;
/** Dirt kickers on the Loop: ride over one with some speed and you're airborne for a moment. */
export const RAMPS: { x: number; y: number; dir: number }[] = [
  { x: 1346, y: 1780, dir: Math.atan2(250, 30) },
  { x: 740, y: 1780, dir: Math.atan2(-180, -200) },
  { x: 312, y: 1290, dir: Math.atan2(-180, -40) },
];

/** Rain puddles on the Loop and the access road: ride (or walk) through for a splash. */
export const PUDDLES: { x: number; y: number; rx: number; ry: number }[] = [
  { x: 300, y: 1112, rx: 30, ry: 12 },
  { x: 930, y: 1950, rx: 34, ry: 13 },
  { x: 1372, y: 2040, rx: 26, ry: 11 },
  { x: 1120, y: 1420, rx: 22, ry: 9 },
];
