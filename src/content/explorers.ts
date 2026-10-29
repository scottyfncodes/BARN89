import type { FamilyId } from './cast';

/**
 * Who you explore as changes the place a little: each family member has something only they
 * get to do, and everybody says hello a bit differently depending on who walks up.
 *
 * The greetings are written for the game. Edit freely so they sound like the family.
 */

/** Shown under each name on the explorer picker. */
export const PERKS: Record<FamilyId, string> = {
  megan: 'Gathers eggs from the hens, and the donkeys never turn down her carrots.',
  jason: 'Loads Annie and Axle in the back of his truck.',
  jay: 'Throws a long spiral for the dogs, and flips on the trampoline.',
  natalie: 'The barn cats follow her around in a little parade.',
  grandpa: 'Hums wherever he goes. His chihuahuas think he hung the moon.',
};

/** What someone says first when you walk up, by who they are and who you are. */
export const GREETINGS: Record<FamilyId, Partial<Record<FamilyId, string>>> = {
  megan: {
    jason: 'There you are.',
    jay: 'Hey, bud. Did you eat breakfast?',
    natalie: 'Hey, sweetie. Boots on the right feet today?',
    grandpa: "Morning! Coffee's on.",
  },
  jason: {
    megan: 'Hey, you.',
    jay: 'Hey, bud.',
    natalie: 'Hey, cowgirl.',
    grandpa: 'Morning. Need a hand with anything?',
  },
  jay: {
    megan: 'Hey, Mom.',
    jason: 'Hey, Dad.',
    natalie: 'What do you want, Nat?',
    grandpa: 'Hey, Grandpa!',
  },
  natalie: {
    megan: 'Mom! Come see the cats!',
    jason: 'Daddy! Can we ride the motorcycle?',
    jay: "Jay! You're it.",
    grandpa: 'Grandpa! Hum the song!',
  },
  grandpa: {
    megan: 'Well, good morning.',
    jason: 'Morning. Truck running all right?',
    jay: "There's the Yard Boss.",
    natalie: "There's my cowgirl.",
  },
};

export function greeting(who: FamilyId, explorer: FamilyId): string {
  return GREETINGS[who][explorer] ?? '';
}

/**
 * Grandpa's tune, hummed: [MIDI note, beats], 0 for a breath. Not any particular song; swap in
 * the one he really hums if somebody can pick it out.
 */
export const HUM_TUNE: [number, number][] = [
  [62, 1], [67, 1], [67, 1], [71, 2], [69, 1], [67, 2], [64, 1], [62, 3],
  [62, 1], [67, 1], [69, 1], [71, 2], [72, 1], [71, 1], [69, 1], [67, 1], [69, 3],
  [62, 1], [67, 1], [67, 1], [71, 2], [69, 1], [67, 2], [64, 1], [62, 2], [66, 1],
  [69, 1], [67, 1], [66, 1], [67, 4], [0, 6],
];
/** Seconds per beat: an easy amble, two steps of the background tune so they sit together. */
export const HUM_BEAT = 0.4;
