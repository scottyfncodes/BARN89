export interface ScoreInput {
  penned: number;
  required: number;
  seconds: number;
  horseshoes: number;
  discoveries: number;
  treatsLeft: number;
  starTimes: [number, number];
}

export interface ScoreResult {
  total: number;
  stars: 1 | 2 | 3;
  lines: { label: string; value: number }[];
}

export const POINTS = {
  kitten: 100,
  horseshoe: 150,
  discovery: 25,
  treat: 20,
  /** Time bonus: points per second under the 2-star time. */
  perSecond: 3,
} as const;

/** Running score shown in the HUD while playing (no time bonus yet). */
export function liveScore(penned: number, horseshoes: number, discoveries: number): number {
  return penned * POINTS.kitten + horseshoes * POINTS.horseshoe + discoveries * POINTS.discovery;
}

export function finalScore(s: ScoreInput): ScoreResult {
  const seconds = Math.max(0, s.seconds);
  const timeBonus = Math.max(0, Math.round((s.starTimes[1] - seconds) * POINTS.perSecond));
  const lines = [
    { label: `Kittens penned ×${s.penned}`, value: s.penned * POINTS.kitten },
    { label: `Golden horseshoes ×${s.horseshoes}`, value: s.horseshoes * POINTS.horseshoe },
    { label: `Discoveries ×${s.discoveries}`, value: s.discoveries * POINTS.discovery },
    { label: `Treats saved ×${s.treatsLeft}`, value: s.treatsLeft * POINTS.treat },
    { label: 'Speedy wrangling', value: timeBonus },
  ];
  const total = lines.reduce((a, l) => a + l.value, 0);
  const stars: 1 | 2 | 3 = seconds <= s.starTimes[0] ? 3 : seconds <= s.starTimes[1] ? 2 : 1;
  return { total, stars, lines };
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
