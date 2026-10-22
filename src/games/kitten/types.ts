import type { Rng, Vec } from '../../core/math';
import type { Coat, Personality } from './kittenTypes';

export interface InputState {
  /** Analog movement, each axis -1..1, magnitude <= 1. */
  moveX: number;
  moveY: number;
  /** Edge-triggered actions (true for one step). */
  whistle: boolean;
  treat: boolean;
}

export const emptyInput = (): InputState => ({ moveX: 0, moveY: 0, whistle: false, treat: false });

export interface Player {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  radius: number;
  maxSpeed: number;
  /** Direction of travel in radians; whistles and treats use it. */
  heading: number;
  /** Sprite facing: 1 = right, -1 = left. */
  faceX: number;
  walkPhase: number;
  whistleT: number;
  throwT: number;
  cheerT: number;
  idleT: number;
  whistleCooldown: number;
  /** Deputy's reaction bubble. */
  mood: { kind: 'none' | 'chuff' | 'proud' | 'yawn'; t: number };
}

export type KittenState =
  | 'wander'
  | 'idle'
  | 'flee'
  | 'dash'
  | 'seek'
  | 'eat'
  | 'follow'
  | 'play'
  | 'nap'
  | 'chase'
  | 'inspect'
  | 'penned';

export type Emote = 'none' | 'alarm' | 'question' | 'heart' | 'zzz' | 'note' | 'sparkle';

export interface Kitten {
  id: string;
  name: string;
  personality: Personality;
  coat: Coat;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  radius: number;
  faceX: number;
  state: KittenState;
  stateT: number;
  home: Vec;
  rng: Rng;
  target: Vec | null;
  targetId: string | null;
  path: Vec[] | null;
  pathAge: number;
  /** Chosen steering direction (unit) and the time until it is reconsidered. */
  steer: Vec;
  steerT: number;
  desiredSpeed: number;
  /** 0..1 how spooked the kitten currently is. */
  alarm: number;
  emote: Emote;
  emoteT: number;
  animPhase: number;
  /** Seconds remaining of a timer the personality uses (nap cycle, butterfly cycle). */
  cycleT: number;
  cooldowns: Record<string, number>;
  stuckCheckT: number;
  stuckFrom: Vec;
  stuckCount: number;
  penned: boolean;
  pennedAt: number;
  /** Ignore distractions for this long (after a whistle). */
  focusT: number;
}

export interface Treat {
  id: number;
  x: number;
  y: number;
  /** Throw animation: from -> to over flight seconds. */
  fromX: number;
  fromY: number;
  flight: number;
  flightT: number;
  life: number;
  eatenBy: string | null;
  eaten: boolean;
}

export interface Butterfly {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  hue: number;
  /** Kitten chasing it, if any. */
  bait: string | null;
}

export type GameEvent =
  | { type: 'penned'; kittenId: string; x: number; y: number }
  | { type: 'whistle'; x: number; y: number; affected: number }
  | { type: 'treatThrown'; x: number; y: number }
  | { type: 'treatEaten'; kittenId: string; x: number; y: number }
  | { type: 'noTreats' }
  | { type: 'collect'; id: string; kind: 'horseshoe' | 'treatBag'; x: number; y: number }
  | { type: 'discover'; id: string; title: string; text: string }
  | { type: 'startle'; kittenId: string; x: number; y: number }
  | { type: 'butterfly'; kittenId: string; x: number; y: number }
  | { type: 'meow'; kittenId: string; x: number; y: number }
  | { type: 'victory' };

export type Phase = 'playing' | 'celebrating' | 'complete';
