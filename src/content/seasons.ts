/**
 * The real calendar and clock, as they show up on the homestead. Nothing here is a reward:
 * it's just what the place looks like today. Times are the phone's local time.
 */

/** A small seasonal decoration set out around the place. */
export type SeasonTouch = 'pumpkins' | 'flag' | null;

export interface Season {
  /** After sundown (and before first light): the string lights come on. */
  dusk: boolean;
  /** December through Epiphany: lights on every roof, a little snow. */
  christmas: boolean;
  touch: SeasonTouch;
  /** Shown once per season, the first time the homestead is opened in it. */
  note: { key: string; title: string; text: string } | null;
}

/**
 * Rough local sunset by month for Buffalo Gap, Texas, in hours (daylight saving included),
 * January first. Close enough that the lights come on around when they would out there.
 */
const SUNSET = [18.1, 18.5, 19.8, 20.2, 20.5, 20.85, 20.85, 20.4, 19.85, 19.25, 17.75, 17.65];
/** The lights come on a little before the sun is all the way down. */
const LIGHTS_EARLY = 0.4;
const FIRST_LIGHT = 6.5;

export function seasonAt(d: Date): Season {
  const m = d.getMonth();
  const day = d.getDate();
  const h = d.getHours() + d.getMinutes() / 60;
  const dusk = h >= SUNSET[m] - LIGHTS_EARLY || h < FIRST_LIGHT;
  const christmas = m === 11 || (m === 0 && day <= 6);
  const touch: SeasonTouch = m === 9 ? 'pumpkins' : m === 6 ? 'flag' : null;
  let note: Season['note'] = null;
  if (christmas) {
    const y = m === 11 ? d.getFullYear() : d.getFullYear() - 1;
    note = { key: `season-christmas-${y}`, title: 'Christmas at Barn 89', text: "Lights on every roof and snow in the air. Grandpa's porch tree is waiting for its ornaments." };
  } else if (touch === 'pumpkins') {
    note = { key: `season-october-${d.getFullYear()}`, title: 'October at Barn 89', text: "Pumpkins on the farm stand, and a couple on Grandpa's porch steps." };
  } else if (touch === 'flag') {
    note = { key: `season-july-${d.getFullYear()}`, title: 'July at Barn 89', text: "Grandpa's flag is out on the porch for the Fourth." };
  }
  return { dusk, christmas, touch, note };
}

/**
 * Now, or the moment given as `?date=2026-12-24T19:30` (for trying the seasons out without
 * waiting for them).
 */
export function clockNow(search = typeof location === 'undefined' ? '' : location.search): Date {
  const q = new URLSearchParams(search).get('date');
  if (q) {
    const t = new Date(q);
    if (!isNaN(t.getTime())) return t;
  }
  return new Date();
}
