import type { Coat, Personality } from './kittenTypes';
import { createRanchMap } from '../world/ranch';
import type { RanchMap } from '../world/mapTypes';

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
  id: 'ranch-roundup',
  name: 'Ranch Roundup',
  subtitle: 'Get six kittens into the Kitten Corral.',
  createMap: createRanchMap,
  targetPen: 'corral',
  required: 6,
  startTreats: 4,
  player: { x: 1160, y: 1760 },
  starTimes: [300, 480],
  kittens: [
    { id: 'biscuit', name: 'Biscuit', personality: 'hungry', coat: COATS.orangeTabby, x: 1255, y: 1965, seed: 11 },
    { id: 'pepper', name: 'Pepper', personality: 'shy', coat: COATS.tuxedo, x: 1390, y: 1220, seed: 23 },
    { id: 'marshmallow', name: 'Marshmallow', personality: 'sleepy', coat: COATS.marshmallow, x: 585, y: 2080, seed: 37 },
    { id: 'pickles', name: 'Pickles', personality: 'curious', coat: COATS.calico, x: 300, y: 1385, seed: 41 },
    { id: 'ziggy', name: 'Ziggy', personality: 'distractible', coat: COATS.greyTabby, x: 1960, y: 1140, seed: 53 },
    { id: 'mochi', name: 'Mochi', personality: 'shy', coat: COATS.siamese, x: 2150, y: 1820, seed: 67 },
    { id: 'tater', name: 'Tater', personality: 'sleepy', coat: COATS.tortie, x: 1290, y: 760, seed: 79 },
    { id: 'waffles', name: 'Waffles', personality: 'hungry', coat: COATS.waffles, x: 560, y: 640, seed: 83 },
  ],
};

export const LEVELS: LevelDef[] = [LEVEL_ONE];
