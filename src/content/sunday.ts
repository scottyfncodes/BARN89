import type { FamilyId } from './cast';

/**
 * Sunday at the Barn: an optional breakfast at the long table under the old string lights.
 *
 * Everything here is fiction written for the game. Edit freely to match how the family really
 * does things; set INCLUDE_GRACE to false to leave the blessing out. There are no rewards,
 * stars or streaks tied to this, on purpose.
 */
export const INCLUDE_GRACE = true;

export type Speaker = FamilyId | 'narrator';

export interface Line {
  who: Speaker;
  text: string;
}

export interface ChoiceOption {
  label: string;
  reply: Line[];
  /** For the barn question: remembered and shown on the old venue sign. */
  plan?: BarnPlan;
}

export interface Choice {
  who: Speaker;
  prompt: string;
  options: ChoiceOption[];
}

export type Beat = { line: Line } | { choice: Choice };

export type BarnPlan = 'supper' | 'neighbors' | 'dance';

/** The little board that hangs under the Barn 89 sign once the family picks a next chapter. */
export const BARN_PLAN_SIGN: Record<BarnPlan, string> = {
  supper: 'SUNDAY SUPPER',
  neighbors: 'NEIGHBORS WELCOME',
  dance: 'DANCE FLOOR OPEN',
};

export const BARN_PLAN_LABEL: Record<BarnPlan, string> = {
  supper: 'Family supper on Sundays',
  neighbors: 'A place for the neighbors',
  dance: 'Keep the dance floor',
};

const say = (who: Speaker, text: string): Beat => ({ line: { who, text } });

export function sundayScript(): Beat[] {
  return [
    say('narrator', "Sunday morning. Mom's set breakfast out on the long table under the old string lights. The animals ate first. They always do."),
    say('jay', 'Okay, who took the last cinnamon roll?'),
    say('narrator', 'Annie, under the table, will not make eye contact.'),
    say('natalie', 'Also, somebody left the arena gate open and Pickles got out.'),
    say('jay', 'Pickles let herself out. She has thumbs, probably.'),
    say('jason', "Gate's latched now. Cat's fine. Nobody's in trouble."),
    say('jay', "...Sorry, Nat. I'll check it next time."),
    say('natalie', 'Forgiven. Mostly. You owe me a cinnamon roll.'),
    ...(INCLUDE_GRACE
      ? [
          say('megan', 'Grandpa, would you say grace?'),
          say('narrator', "Heads bow while Grandpa gives thanks for the food, the week, and everybody at this table. He keeps it short. Annie's tail thumps the table leg the whole time."),
        ]
      : []),
    {
      choice: {
        who: 'megan',
        prompt: 'Go around the table. One good thing from this week?',
        options: [
          { label: 'Chewy finally let me brush him.', reply: [{ who: 'grandpa', text: 'That donkey has never once let me brush him. I want a recount.' }] },
          { label: 'Nobody mowed over the flower beds.', reply: [{ who: 'megan', text: "It's only Sunday. We'll see how long that lasts." }, { who: 'jay', text: 'Hey.' }] },
          { label: "We're all here.", reply: [{ who: 'narrator', text: 'Nobody has a joke for that one. Dad passes the eggs.' }] },
        ],
      },
    },
    say('megan', 'Last wedding season is about wrapped up. So... what does the barn become now?'),
    say('jason', "Well, it's got about two hundred folding chairs in it. I counted them twice."),
    say('jay', 'Indoor mower track.'),
    say('natalie', 'Cat hotel.'),
    say('grandpa', "Whatever it is, those doors ought to stay open."),
    {
      choice: {
        who: 'narrator',
        prompt: 'What should Barn 89 be next?',
        options: [
          { label: BARN_PLAN_LABEL.supper, plan: 'supper', reply: [{ who: 'megan', text: 'Then the long table stays right where it is.' }] },
          {
            label: BARN_PLAN_LABEL.neighbors,
            plan: 'neighbors',
            reply: [{ who: 'jason', text: 'Hay storage when somebody runs short, chairs for whoever needs them, a dry place when the storms roll through. Works for me.' }],
          },
          { label: BARN_PLAN_LABEL.dance, plan: 'dance', reply: [{ who: 'grandpa', text: 'Good. I still have moves.' }, { who: 'natalie', text: 'Grandpa, please.' }] },
        ],
      },
    },
    say('narrator', 'Breakfast lasts as long as the coffee does. Then everybody heads back out: cats to herd, grass to mow, wood to split.'),
  ];
}
