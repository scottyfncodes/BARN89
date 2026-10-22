import type { Coat, Personality } from './kittenTypes';
import { createRanchMap } from '../../world/ranch';
import type { RanchMap } from '../../world/mapTypes';

export interface KittenSpawn {
  id: string;
  name: string;
  personality: Personality;
  coat: Coat;
  x: number;
  y: number;
  seed: number;
}

export interface LevelDef {
  id: string;
  name: string;
  subtitle: string;
  createMap: () => RanchMap;
  /** Id of the pen that counts for the objective. */
  targetPen: string;
  required: number;
  startTreats: number;
  player: { x: number; y: number };
  kittens: KittenSpawn[];
  /** Seconds for 3 and 2 stars. */
  starTimes: [number, number];
}

export const COATS = {
  orangeTabby: { base: '#e98a3a', accent: '#b4561f', extra: '#fbe3c4', pattern: 'tabby', eyes: '#5aa83c' },
  tuxedo: { base: '#2b2a33', accent: '#16151b', extra: '#f7f3ec', pattern: 'tuxedo', eyes: '#e6c43a' },
  marshmallow: { base: '#fbf7f0', accent: '#e8dccb', extra: '#ffd9df', pattern: 'solid', eyes: '#4aa3d8', fluffy: true },
  calico: { base: '#f8f1e6', accent: '#e07d33', extra: '#3a3236', pattern: 'calico', eyes: '#68b04a' },
  greyTabby: { base: '#9aa1a8', accent: '#5d646c', extra: '#e3e5e7', pattern: 'tabby', eyes: '#e3b13a' },
  siamese: { base: '#f1e3c8', accent: '#5a4033', extra: '#fbf3e2', pattern: 'points', eyes: '#3f8fe0' },
  tortie: { base: '#4a3226', accent: '#d07a35', extra: '#2a1d17', pattern: 'tortie', eyes: '#e2a83a' },
  waffles: { base: '#f4dcb0', accent: '#d9a25e', extra: '#fffaf0', pattern: 'bicolor', eyes: '#6b8f3a' },
} satisfies Record<string, Coat>;

export const LEVEL_ONE: LevelDef = {
  id: 'kitten-1',
  name: 'Ranch Roundup',
  subtitle: 'Get six barn cats into the corral.',
  createMap: createRanchMap,
  targetPen: 'corral',
  required: 6,
  startTreats: 4,
  player: { x: 1080, y: 2160 },
  starTimes: [360, 600],
  kittens: [
    { id: 'biscuit', name: 'Biscuit', personality: 'hungry', coat: COATS.orangeTabby, x: 1110, y: 2460, seed: 11 },
    { id: 'pepper', name: 'Pepper', personality: 'shy', coat: COATS.tuxedo, x: 1280, y: 1370, seed: 23 },
    { id: 'marshmallow', name: 'Marshmallow', personality: 'sleepy', coat: COATS.marshmallow, x: 1200, y: 1810, seed: 37 },
    { id: 'pickles', name: 'Pickles', personality: 'curious', coat: COATS.calico, x: 1500, y: 745, seed: 41 },
    { id: 'ziggy', name: 'Ziggy', personality: 'distractible', coat: COATS.greyTabby, x: 1700, y: 1720, seed: 53 },
    { id: 'mochi', name: 'Mochi', personality: 'shy', coat: COATS.siamese, x: 1800, y: 1985, seed: 67 },
    { id: 'tater', name: 'Tater', personality: 'sleepy', coat: COATS.tortie, x: 1180, y: 380, seed: 79 },
    { id: 'waffles', name: 'Waffles', personality: 'hungry', coat: COATS.waffles, x: 520, y: 1360, seed: 83 },
  ],
};

export const LEVEL_TWO: LevelDef = {
  ...LEVEL_ONE,
  id: 'kitten-2',
  name: 'Every Last Cat',
  subtitle: 'All eight barn cats, and only two treats.',
  required: 8,
  startTreats: 2,
  starTimes: [480, 780],
};

export const LEVELS: LevelDef[] = [LEVEL_ONE, LEVEL_TWO];
