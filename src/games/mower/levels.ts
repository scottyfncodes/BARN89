import type { Pt } from '../../world/mapTypes';

export interface FlowerBed {
  x: number;
  y: number;
  r: number;
  colors: [string, string];
}

export interface Toy {
  x: number;
  y: number;
  kind: 'ball' | 'frisbee' | 'boot';
}

export interface MowLevel {
  id: string;
  name: string;
  /** Lawn outline in world units (part of the real homestead map). */
  lawn: Pt[];
  start: { x: number; y: number; heading: number };
  /** Stripe direction (radians): passes along this axis look light, against it dark. */
  axis: number;
  target: number;
  timeLimit: number;
  /** Seconds (including penalties) for 3 and 2 stars. */
  starTimes: [number, number];
  beds: FlowerBed[];
  toys: Toy[];
  dogs: number;
}

export const MOW_LEVELS: MowLevel[] = [
  {
    id: 'mower-1',
    name: 'The Front Lawn',
    lawn: [
      [880, 128],
      [1548, 128],
      [1446, 372],
      [1300, 530],
      [1160, 580],
      [1024, 546],
      [928, 452],
      [892, 300],
    ],
    start: { x: 1150, y: 520, heading: -Math.PI / 2 },
    axis: 0,
    target: 0.9,
    timeLimit: 210,
    starTimes: [95, 140],
    beds: [{ x: 1360, y: 200, r: 26, colors: ['#f26b8a', '#ffd34d'] }],
    toys: [
      { x: 980, y: 210, kind: 'ball' },
      { x: 1240, y: 420, kind: 'frisbee' },
    ],
    dogs: 0,
  },
  {
    id: 'mower-2',
    name: 'The Side Yard',
    lawn: [
      [1120, 985],
      [1620, 985],
      [1620, 1180],
      [1500, 1290],
      [1300, 1335],
      [1160, 1335],
      [1040, 1250],
      [1000, 1110],
    ],
    start: { x: 1200, y: 1010, heading: Math.PI / 2 },
    axis: Math.PI / 2,
    target: 0.88,
    timeLimit: 170,
    starTimes: [65, 100],
    beds: [
      { x: 1240, y: 1150, r: 24, colors: ['#9b6bd6', '#fffaf0'] },
      { x: 1450, y: 1060, r: 22, colors: ['#ffd34d', '#f08a24'] },
    ],
    toys: [
      { x: 1110, y: 1200, kind: 'boot' },
      { x: 1420, y: 1220, kind: 'ball' },
    ],
    dogs: 2,
  },
  {
    id: 'mower-3',
    name: 'Barn 89 Lawn',
    lawn: [
      [1110, 2670],
      [1460, 2660],
      [1500, 2790],
      [1840, 2790],
      [1840, 2990],
      [1240, 3000],
      [1110, 2900],
    ],
    start: { x: 1480, y: 2780, heading: 0 },
    axis: 0,
    target: 0.88,
    timeLimit: 200,
    starTimes: [75, 115],
    beds: [
      { x: 1330, y: 2760, r: 24, colors: ['#f26b8a', '#fffaf0'] },
      { x: 1680, y: 2885, r: 22, colors: ['#ffd34d', '#f26b8a'] },
    ],
    toys: [
      { x: 1200, y: 2800, kind: 'frisbee' },
      { x: 1760, y: 2960, kind: 'boot' },
    ],
    dogs: 1,
  },
];
