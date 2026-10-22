import type { SaveData } from '../core/save';
import type { FamilyId, HatKind } from './cast';

export type GameId = 'kitten' | 'mower' | 'woodpile' | 'rounds' | 'hunt';

export interface Challenge {
  id: string;
  game: GameId;
  name: string;
  blurb: string;
}

export interface Activity {
  id: GameId;
  title: string;
  who: FamilyId;
  /** What the character says when you walk up. */
  line: string;
  /** Where they stand on the homestead. */
  station: { x: number; y: number };
  challenges: Challenge[];
}

export const ACTIVITIES: Activity[] = [
  {
    id: 'kitten',
    title: 'Kitten Cowgirl',
    who: 'natalie',
    line: 'The barn cats got out again. Help me round them up?',
    station: { x: 1240, y: 2335 },
    challenges: [
      { id: 'kitten-1', game: 'kitten', name: 'Ranch Roundup', blurb: 'Get six barn cats into the corral.' },
      { id: 'kitten-2', game: 'kitten', name: 'Every Last Cat', blurb: 'All eight cats, fewer treats, no excuses.' },
    ],
  },
  {
    id: 'mower',
    title: 'Yard Boss',
    who: 'jay',
    line: 'Bet you cannot mow the front lawn faster than me.',
    station: { x: 1250, y: 668 },
    challenges: [
      { id: 'mower-1', game: 'mower', name: 'The Front Lawn', blurb: 'Mow the big lawn inside the loop. Watch the flower beds.' },
      { id: 'mower-2', game: 'mower', name: 'The Side Yard', blurb: 'Trees, toys, flower beds, and the dogs are out.' },
      { id: 'mower-3', game: 'mower', name: 'Barn 89 Lawn', blurb: 'The old wedding lawn. Mow it fast and mow it straight.' },
    ],
  },
  {
    id: 'woodpile',
    title: 'Woodpile',
    who: 'jason',
    line: 'Cold front coming. Help me split and stack?',
    station: { x: 548, y: 1372 },
    challenges: [
      { id: 'woodpile-1', game: 'woodpile', name: 'Morning Pile', blurb: 'Straight-grained logs. Learn the swing.' },
      { id: 'woodpile-2', game: 'woodpile', name: 'Knotty Oak', blurb: 'Knots, big rounds, and a few rotten ones to toss.' },
      { id: 'woodpile-3', game: 'woodpile', name: 'Before the Freeze', blurb: 'Fast, tough and tall. Stack it tight.' },
    ],
  },
  {
    id: 'rounds',
    title: "Megan's Morning Rounds",
    who: 'megan',
    line: 'Morning rounds! Eggs, donkeys, dogs, cats, flowers. Want to help?',
    station: { x: 505, y: 420 },
    challenges: [{ id: 'rounds-1', game: 'rounds', name: 'Morning Rounds', blurb: 'Six chores, any order. Eggs go to the kitchen last.' }],
  },
  {
    id: 'hunt',
    title: "Grandpa's Treasure Hunt",
    who: 'grandpa',
    line: 'Lost my things again. Help an old man look?',
    station: { x: 1625, y: 728 },
    challenges: [{ id: 'hunt-1', game: 'hunt', name: 'Lost and Found', blurb: 'Follow his clues, then crack the lockbox.' }],
  },
];

/** How-to lines shown on each activity's intro card (HTML, <b> for verbs). */
export const HOWTO: Record<GameId, string[]> = {
  kitten: [
    '<b>Drag anywhere</b> to move. A joystick appears under your thumb.',
    'Cats walk away from you, so get <b>behind</b> one and push it into the glowing corral.',
    '<b>Whistle</b> scoots nearby cats the way you are heading and wakes nappers.',
    '<b>Treats</b> lure hungry cats, who then tag along.',
  ],
  mower: [
    '<b>Drag</b> the way you want to drive. The mower turns on the spot.',
    'Mow the lawn until the bar passes the line. Long straight passes make <b>stripes</b> and bonus points.',
    'Bumping trees, mowing <b>flower beds</b>, toys or dogs costs seconds.',
    'Lost a patch? An arrow at the edge points to the nearest tall grass.',
  ],
  woodpile: [
    '<b>Tap</b> when the marker is in the <b>gold</b> to split the log clean. Green is fine. Miss and the axe sticks.',
    'Then <b>tap</b> to drop each piece <b>snug</b> against the last one on the rack.',
    'Gappy stacks wobble, and a wobbly row falls over.',
    'Mossy, mushroomy logs are rotten: <b>Toss it</b> onto the burn pile instead.',
  ],
  rounds: [
    'Six chores around the homestead. Do them <b>in any order</b>, as fast as you can.',
    'Walk into a glowing ring and tap the button to do the chore.',
    'The eggs go to the kitchen, so collect them first.',
    'Numbered arrows at the screen edge point to chores you can do next.',
  ],
  hunt: [
    'Grandpa gives you a clue. Find the spot, and the lost thing will glint when you are close.',
    'Five things to find, one clue at a time.',
    'Stuck? <b>Hint</b> lights the way, but costs a star.',
    'Bring everything back to Grandpa and open his lockbox.',
  ],
};

export const ALL_CHALLENGES: Challenge[] = ACTIVITIES.flatMap((a) => a.challenges);

export function activity(id: GameId): Activity {
  return ACTIVITIES.find((a) => a.id === id)!;
}

export function challenge(id: string): Challenge {
  return ALL_CHALLENGES.find((c) => c.id === id)!;
}

export function totalStars(s: SaveData): number {
  let n = 0;
  for (const c of ALL_CHALLENGES) n += s.stars[c.id] ?? 0;
  return n;
}

export const MAX_STARS = ALL_CHALLENGES.length * 3;

/** A challenge opens once the one before it in the same game has at least one star. */
export function isUnlocked(s: SaveData, id: string): boolean {
  for (const a of ACTIVITIES) {
    const i = a.challenges.findIndex((c) => c.id === id);
    if (i < 0) continue;
    if (i === 0) return true;
    return (s.stars[a.challenges[i - 1].id] ?? 0) >= 1;
  }
  return false;
}

export function activityStars(s: SaveData, id: GameId): { got: number; max: number } {
  const a = activity(id);
  let got = 0;
  for (const c of a.challenges) got += s.stars[c.id] ?? 0;
  return { got, max: a.challenges.length * 3 };
}

/* ---------------------------------------------------------------------------------------- */
/* Rewards                                                                                    */
/* ---------------------------------------------------------------------------------------- */

export interface Reward {
  id: string;
  name: string;
  desc: string;
  /** Stars needed, or a secret condition described in `how`. */
  stars?: number;
  how?: string;
  kind: 'hat' | 'ride' | 'mower' | 'decor';
  hat?: HatKind;
}

export const REWARDS: Reward[] = [
  { id: 'hat-straw', name: 'Straw hat', desc: 'For whoever is exploring. Very summer.', stars: 2, kind: 'hat', hat: 'straw' },
  { id: 'mower-green', name: 'Green mower paint', desc: 'Classic green and yellow for Yard Boss.', stars: 4, kind: 'mower' },
  { id: 'evening', name: 'Evening at Barn 89', desc: 'Switch the homestead to golden evening. The string lights come on.', stars: 6, kind: 'decor' },
  { id: 'ride-deputy', name: 'Deputy the tiger', desc: 'Natalie rides a very large, very friendly tiger in Kitten Cowgirl.', stars: 9, kind: 'ride' },
  { id: 'hat-santa', name: 'Santa hat', desc: 'Festive. Slightly floppy.', stars: 12, kind: 'hat', hat: 'santa' },
  { id: 'holiday', name: 'Christmas lights', desc: 'Lights on every roof, and a little snow.', stars: 15, kind: 'decor' },
  { id: 'mower-gold', name: 'Golden mower', desc: 'For the true Yard Boss.', stars: 20, kind: 'mower' },
  { id: 'hat-beanie', name: 'Barn cat beanie', desc: 'Pet every barn cat on the homestead.', how: 'pets', kind: 'hat', hat: 'beanie' },
  { id: 'bulbs', name: 'Fixed string lights', desc: "Finish Grandpa's Treasure Hunt. Every old bulb at Barn 89 shines again.", how: 'hunt', kind: 'decor' },
];

export const ORNAMENT_COUNT = 8;
export const CAT_COUNT = 8;

export function rewardUnlocked(s: SaveData, r: Reward): boolean {
  if (r.stars !== undefined) return totalStars(s) >= r.stars;
  if (r.how === 'pets') return s.pets.length >= CAT_COUNT;
  if (r.how === 'hunt') return s.hunt.done;
  return false;
}

export function unlockedRewards(s: SaveData): Set<string> {
  return new Set(REWARDS.filter((r) => rewardUnlocked(s, r)).map((r) => r.id));
}
