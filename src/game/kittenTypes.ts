export type Personality = 'shy' | 'curious' | 'hungry' | 'sleepy' | 'distractible';

export type CoatPattern = 'tabby' | 'tuxedo' | 'solid' | 'calico' | 'points' | 'tortie' | 'bicolor';

export interface Coat {
  base: string;
  accent: string;
  /** Third colour for calico/tortie patches, belly, socks. */
  extra: string;
  pattern: CoatPattern;
  eyes: string;
  fluffy?: boolean;
}

export interface PersonalityTuning {
  /** Ambling speed (px/s). */
  walk: number;
  /** Top flee speed (px/s). Deputy tops out at ~250 so every kitten can be overtaken. */
  run: number;
  /** Distance at which the kitten starts moving away from Deputy. */
  fear: number;
  /** Distance at which a thrown treat gets noticed. */
  treatSense: number;
  /** Whistle dash speed. */
  dash: number;
  label: string;
  blurb: string;
}

export const PERSONALITIES: Record<Personality, PersonalityTuning> = {
  shy: {
    walk: 38,
    run: 158,
    fear: 185,
    treatSense: 210,
    dash: 200,
    label: 'Shy',
    blurb: 'Bolts early. Push from a distance.',
  },
  curious: {
    walk: 46,
    run: 122,
    fear: 105,
    treatSense: 170,
    dash: 185,
    label: 'Curious',
    blurb: 'Investigates everything. Stop and wait: she will come to you.',
  },
  hungry: {
    walk: 42,
    run: 118,
    fear: 118,
    treatSense: 430,
    dash: 180,
    label: 'Hungry',
    blurb: 'Smells treats from far away, then tags along for more.',
  },
  sleepy: {
    walk: 22,
    run: 68,
    fear: 115,
    treatSense: 190,
    dash: 120,
    label: 'Sleepy',
    blurb: 'Naps on a schedule. Slow, but steady.',
  },
  distractible: {
    walk: 50,
    run: 140,
    fear: 140,
    treatSense: 240,
    dash: 195,
    label: 'Distractible',
    blurb: 'Every so often a butterfly appears. Every single time.',
  },
};
