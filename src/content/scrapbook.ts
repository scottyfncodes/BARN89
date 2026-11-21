import type { SaveData } from '../core/save';
import { ACTIVITIES, CAT_COUNT, ORNAMENT_COUNT, type GameId } from './activities';
import { nameFor } from './names';
import { BARN_PLAN_LABEL } from './sunday';

/**
 * The family scrapbook: a page for each moment worth keeping. Pages are earned from what the
 * save already records, so a page can never be missed and older saves fill theirs in the first
 * time the scrapbook looks. Nothing here gives stars or rewards; the pages are the reward.
 */
export type PageId =
  | 'home'
  | 'kitten'
  | 'mower'
  | 'woodpile'
  | 'rounds'
  | 'hunt'
  | 'putt'
  | 'puzzle'
  | 'race'
  | 'workshop'
  | 'ornaments'
  | 'cats'
  | 'skunk'
  | 'sunday'
  | 'christmas'
  | 'october'
  | 'july';

export interface PageDef {
  id: PageId;
  title: string;
  /** Written on the page under the photo. */
  caption: (s: SaveData) => string;
  /** Shown on an empty page: how to fill it. */
  hint: string;
  earned: (s: SaveData) => boolean;
}

const best = (s: SaveData, game: GameId) => Math.max(0, ...ACTIVITIES.find((a) => a.id === game)!.challenges.map((c) => s.stars[c.id] ?? 0));
const seenSeason = (s: SaveData, season: string) => s.seen.some((k) => k.startsWith(`season-${season}-`));

export const PAGES: PageDef[] = [
  {
    id: 'home',
    title: 'Our place',
    caption: () => 'The whole crew out front of the barn. Somebody blinked.',
    hint: 'Walk out onto the homestead.',
    earned: () => true,
  },
  {
    id: 'kitten',
    title: 'Every last cat',
    caption: () => 'All of them in the corral at once. Natalie says they came because they love her. The treats helped.',
    hint: 'Three stars in Kitten Cowgirl.',
    earned: (s) => best(s, 'kitten') >= 3,
  },
  {
    id: 'mower',
    title: 'Straight stripes',
    caption: () => 'Jay mowed it so straight you could set a level on it. He would like that written down.',
    hint: 'Three stars in Yard Boss.',
    earned: (s) => best(s, 'mower') >= 3,
  },
  {
    id: 'woodpile',
    title: 'Bark side up',
    caption: () => 'Split clean and stacked tight. Dad stood back and looked at it for a good while.',
    hint: 'Three stars at the Woodpile.',
    earned: (s) => best(s, 'woodpile') >= 3,
  },
  {
    id: 'rounds',
    title: 'Morning rounds',
    caption: () => "Eggs gathered, everybody fed, and Mom's coffee still warm. Mostly.",
    hint: "Finish Mom's Morning Rounds.",
    earned: (s) => best(s, 'rounds') >= 1,
  },
  {
    id: 'hunt',
    title: 'Lost and found',
    caption: () => 'Every last thing found and the lockbox open. Grandpa will lose something new by Tuesday.',
    hint: "Finish Grandpa's Treasure Hunt.",
    earned: (s) => s.hunt.done,
  },
  {
    id: 'putt',
    title: 'Under par',
    caption: () => 'Beat par on the putting green. Grandpa has asked for a rematch, best of seven.',
    hint: 'Three stars at Putt-Putt.',
    earned: (s) => best(s, 'putt') >= 3,
  },
  {
    id: 'puzzle',
    title: 'Out the loft door',
    caption: () => 'Every bale shifted, the wagon rolled out, and the water ran to every trough.',
    hint: 'Three stars at Barn Puzzles.',
    earned: (s) => best(s, 'puzzle') >= 3,
  },
  {
    id: 'race',
    title: 'Round the Loop',
    caption: () => 'Two laps, three ramps, one handshake at the line. Nobody remembers who won the same way.',
    hint: 'Earn a star in any race on the Loop.',
    earned: (s) => best(s, 'race') >= 1,
  },
  {
    id: 'workshop',
    title: 'Blue Star',
    caption: () => "Painted up in Apple's workshop, the way she and Grandpa used to.",
    hint: 'Restore a piece of furniture at Blue Star.',
    earned: (s) => Object.keys(s.restored).length > 0,
  },
  {
    id: 'ornaments',
    title: 'The porch tree',
    caption: () => `All ${ORNAMENT_COUNT} ornaments home on Grandpa's little tree, and the star on top.`,
    hint: 'Find every Christmas ornament.',
    earned: (s) => s.ornaments.length >= ORNAMENT_COUNT,
  },
  {
    id: 'cats',
    title: 'The barn cats',
    caption: (s) => `All ${CAT_COUNT} met and petted. ${nameFor(s.names, 'tater')} pretended not to enjoy it.`,
    hint: 'Pet every barn cat.',
    earned: (s) => s.pets.length >= CAT_COUNT,
  },
  {
    id: 'skunk',
    title: 'Annie vs. the skunk',
    caption: () => 'The skunk won. Annie will tell you otherwise. Do not let her in the house.',
    hint: 'Keep an eye out for a black-and-white visitor.',
    earned: (s) => s.seen.includes('skunk'),
  },
  {
    id: 'sunday',
    title: 'Sunday at the Barn',
    caption: (s) => `Breakfast at the long table under the string lights. Decided: ${s.barnPlan ? BARN_PLAN_LABEL[s.barnPlan].toLowerCase() : 'nothing yet'}.`,
    hint: 'Sit down for Sunday breakfast at the long table.',
    earned: (s) => s.barnPlan !== null,
  },
  {
    id: 'christmas',
    title: 'Christmas at Barn 89',
    caption: () => 'Lights on every roof and snow on the barn. Somebody ate the cookies meant for the donkeys.',
    hint: 'Come by in December.',
    earned: (s) => seenSeason(s, 'christmas'),
  },
  {
    id: 'october',
    title: 'Pumpkin season',
    caption: () => "Pumpkins out at the farm stand and on Grandpa's steps. The chickens are suspicious of them.",
    hint: 'Come by in October.',
    earned: (s) => seenSeason(s, 'october'),
  },
  {
    id: 'july',
    title: 'The Fourth',
    caption: () => "Grandpa's flag out on the porch, and every truck on Buffalo Gap Rd got a wave.",
    hint: 'Come by in July.',
    earned: (s) => seenSeason(s, 'july'),
  },
];

/** Local calendar date, e.g. "2026-11-09". */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "November 9, 2026" from "2026-11-09". */
export function prettyDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[m - 1] ? `${months[m - 1]} ${d}, ${y}` : key;
}

/**
 * Pastes in every page the save has now earned and hasn't got yet, dated today. Returns the new
 * pages in book order (empty when nothing changed).
 */
export function fillPages(s: SaveData, today: Date): PageDef[] {
  const fresh: PageDef[] = [];
  for (const p of PAGES) {
    if (s.scrapbook[p.id] || !p.earned(s)) continue;
    s.scrapbook[p.id] = dayKey(today);
    fresh.push(p);
  }
  return fresh;
}
