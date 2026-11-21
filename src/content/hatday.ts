import type { SaveData } from '../core/save';
import { ACTIVITIES, type GameId } from './activities';
import { FAMILY, type FamilyId, type HatKind } from './cast';
import type { Beat, Speaker } from './sunday';

/**
 * Hat Day. Beat every member of the family at their own game (their main one, below) and the
 * whole family gathers under the big tree on the front lawn, where Grandpa opens a box of the
 * silliest hats in Taylor County. Everybody gets one, the dogs included, and there's a family
 * photo. After that, the hats can be worn round the homestead (switch them off in Rewards).
 *
 * Like Sunday at the Barn this is written fiction: edit the lines to suit the family.
 */
export const PRIMARY_GAME: Record<FamilyId, GameId> = {
  natalie: 'kitten',
  jay: 'mower',
  jason: 'woodpile',
  megan: 'rounds',
  grandpa: 'hunt',
};

/** Who gets which silly hat. */
export const SILLY_HATS: Record<FamilyId, HatKind> = {
  grandpa: 'propeller',
  megan: 'chicken',
  jason: 'antlers',
  jay: 'cone',
  natalie: 'kitty',
};

export const SILLY_HAT_NAME: Record<FamilyId, string> = {
  grandpa: 'a propeller beanie',
  megan: 'a chicken',
  jason: 'moose antlers',
  jay: 'a traffic cone',
  natalie: 'an actual barn cat',
};

/** Beaten someone at their own game: every one of its challenges cleared with at least a star. */
export function beaten(s: SaveData, who: FamilyId): boolean {
  const a = ACTIVITIES.find((x) => x.id === PRIMARY_GAME[who])!;
  return a.challenges.every((c) => (s.stars[c.id] ?? 0) >= 1);
}

export function beatenCount(s: SaveData): number {
  return (Object.keys(PRIMARY_GAME) as FamilyId[]).filter((w) => beaten(s, w)).length;
}

export function hatDayReady(s: SaveData): boolean {
  return beatenCount(s) === Object.keys(PRIMARY_GAME).length;
}

/** The order the hats come out of the box (Grandpa goes last: he's been looking forward to it). */
export const HAT_ORDER: FamilyId[] = ['natalie', 'jay', 'megan', 'jason', 'grandpa'];

/** A beat in the Hat Day scene; `hat` puts that person's hat on as the line is shown. */
export type HatBeat = Beat & { hat?: FamilyId | 'dogs'; photo?: boolean };

const say = (who: Speaker, text: string, extra: Partial<HatBeat> = {}): HatBeat => ({ line: { who, text }, ...extra });

/** The scene, written around whoever is exploring (they're the one who beat everybody). */
export function hatDayScript(explorer: FamilyId): HatBeat[] {
  const you = FAMILY[explorer].name;
  const host: FamilyId = explorer === 'grandpa' ? 'megan' : 'grandpa';
  const lines: HatBeat[] = [
    say('narrator', 'Everyone has come out to the big tree on the front lawn. Grandpa is sitting on a cardboard box marked DO NOT OPEN.'),
    say(host, `Family meeting. It has come to my attention that ${you} has beaten every one of us at our own game.`),
    say('natalie', 'Even the barn cats?'),
    say('jason', 'Even the woodpile. Stacked tight, bark side up.'),
    say('jay', 'The mowing was luck. I want that on the record.'),
    say('megan', 'Every chore, every egg, and not one broken. I was very impressed.'),
    say(host, "A day like this calls for the box. I've been saving it for a special occasion."),
    say('narrator', 'The box is opened. It is full of hats. Not good hats.'),
  ];
  const gets: Record<FamilyId, string> = {
    natalie: 'A barn cat climbs onto Natalie\'s head, turns round twice, and settles in. That\'s her hat now.',
    jay: 'Jay gets a traffic cone. He puts it on without a word, as if he always has.',
    megan: 'Mom gets a chicken. A plush one. The real chickens look over, deeply unimpressed.',
    jason: 'Dad gets moose antlers. They flop a little when he nods.',
    grandpa: 'Grandpa saves the best for himself: a propeller beanie. He blows on it. It spins. He is delighted.',
  };
  for (const who of HAT_ORDER) lines.push(say('narrator', gets[who], { hat: who }));
  lines.push(
    say('narrator', 'Annie gets a party hat. Axel gets a tiny top hat and wears it better than anyone.', { hat: 'dogs' }),
    say('megan', 'Everybody squeeze in. Annie, sit. Axel, look at me. One, two, three...'),
    say('narrator', '"BARN 89!"', { photo: true }),
    say(host, `That's going on the fridge. ${explorer === host ? 'Well done, me.' : `Well done, ${you}.`}`),
  );
  return lines;
}
