/**
 * The Blue Star workshop: Grandpa's garage under the blue star, where he and Apple fixed up and
 * painted antique furniture for her business, Blue Star.
 *
 * Restoring a piece is quiet and unhurried on purpose: no clock, no score, no stars. You sand
 * it back, paint it, and put a blue star on it, and it goes out front of the shop for good.
 *
 * Grandpa's lines are written for the game. Edit them freely so they sound like him. They stay
 * away from putting words in Apple's mouth or inventing memories of her; the family's own
 * stories belong here better than anything made up.
 */

/** One painted shape on a piece, in piece units (the piece's front, seen straight on). */
export interface PiecePart {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Drawn inset and a shade darker: door and drawer fronts, panels. */
  inset?: boolean;
  /** Shadowed opening (an open shelf): drawn dark, never painted. */
  open?: boolean;
}

export interface PieceDef {
  id: string;
  name: string;
  w: number;
  h: number;
  /** Back to front: later parts sit on top of earlier ones. */
  parts: PiecePart[];
  /** Brass knobs and pulls, centre points. */
  knobs: { x: number; y: number }[];
  /** The tired old finish that has to come off first. */
  oldPaint: string;
  /** Already sanded, with the left half painted this colour (the cabinet out front). */
  halfDone?: string;
  /** Where it stands outside the shop once it's done (world units, its feet). */
  spot: { x: number; y: number };
  /** What Grandpa says when you start on it. */
  intro: string;
}

export interface Paint {
  id: string;
  name: string;
  hex: string;
}

/** The paint shelf. Shop blue is the blue of the star on the garage. */
export const PAINTS: Paint[] = [
  { id: 'sky', name: 'Sky blue', hex: '#8fb1d6' },
  { id: 'shop', name: 'Shop blue', hex: '#2f63c0' },
  { id: 'sage', name: 'Sage', hex: '#9db58c' },
  { id: 'buttermilk', name: 'Buttermilk', hex: '#efe4c8' },
  { id: 'red', name: 'Barn red', hex: '#b8382c' },
  { id: 'charcoal', name: 'Charcoal', hex: '#3d4048' },
];

/** The blue of the star on the garage, and the stencil. */
export const STAR_BLUE = '#2f63c0';
/** On a piece painted shop blue, the star goes on in cream so it still shows. */
export const STAR_CREAM = '#fbf3e6';

/** The pieces waiting in the shop, in the order you work on them. */
export const PIECES: PieceDef[] = [
  {
    id: 'cabinet',
    name: 'The blue cabinet',
    w: 104,
    h: 132,
    parts: [
      { x: 2, y: 8, w: 100, h: 114 },
      { x: 9, y: 16, w: 41, h: 98, inset: true },
      { x: 54, y: 16, w: 41, h: 98, inset: true },
      { x: 0, y: 0, w: 104, h: 9 },
      { x: 6, y: 122, w: 10, h: 10 },
      { x: 88, y: 122, w: 10, h: 10 },
    ],
    knobs: [
      { x: 45, y: 66 },
      { x: 59, y: 66 },
    ],
    oldPaint: '#d9cfb8',
    halfDone: '#8fb1d6',
    // The half-painted cabinet that has always stood outside the workshop.
    spot: { x: 1792, y: 696 },
    intro: "This one's been sitting out here half painted a good while. Reckon it's time we finished it.",
  },
  {
    id: 'nightstand',
    name: 'The nightstand',
    w: 86,
    h: 104,
    parts: [
      { x: 3, y: 7, w: 80, h: 50 },
      { x: 9, y: 13, w: 68, h: 18, inset: true },
      { x: 9, y: 36, w: 68, h: 16, open: true },
      { x: 5, y: 57, w: 9, h: 47 },
      { x: 72, y: 57, w: 9, h: 47 },
      { x: 14, y: 84, w: 58, h: 5 },
      { x: 0, y: 0, w: 86, h: 8 },
    ],
    knobs: [{ x: 43, y: 22 }],
    oldPaint: '#a9cbb0',
    spot: { x: 1828, y: 702 },
    intro: 'Somebody painted this one mint green back in the day. Let\'s get it back to the wood first.',
  },
  {
    id: 'chair',
    name: 'The ladder-back chair',
    w: 78,
    h: 140,
    parts: [
      { x: 4, y: 0, w: 9, h: 140 },
      { x: 65, y: 0, w: 9, h: 140 },
      { x: 13, y: 12, w: 52, h: 9 },
      { x: 13, y: 31, w: 52, h: 9 },
      { x: 13, y: 50, w: 52, h: 9 },
      { x: 0, y: 72, w: 78, h: 11 },
      { x: 13, y: 112, w: 52, h: 6 },
    ],
    knobs: [],
    oldPaint: '#6a4a33',
    spot: { x: 1858, y: 698 },
    intro: 'Good old chair. Sturdy as anything. Mind the rungs when you sand.',
  },
  {
    id: 'chest',
    name: 'The hope chest',
    w: 132,
    h: 76,
    parts: [
      { x: 2, y: 12, w: 128, h: 54 },
      { x: 10, y: 21, w: 52, h: 36, inset: true },
      { x: 70, y: 21, w: 52, h: 36, inset: true },
      { x: 0, y: 0, w: 132, h: 13 },
      { x: 6, y: 66, w: 14, h: 10 },
      { x: 112, y: 66, w: 14, h: 10 },
    ],
    knobs: [{ x: 66, y: 8 }],
    oldPaint: '#7a4a2a',
    spot: { x: 1758, y: 706 },
    intro: 'A hope chest. Heavy old varnish on this one, so sand it good.',
  },
];

export function pieceDef(id: string): PieceDef {
  return PIECES.find((p) => p.id === id)!;
}

/** Grandpa, coaching from beside the bench. */
export const GRANDPA_LINES = {
  sand: 'Sand it back first. Go with the grain, and take your time. Nobody\'s in a hurry in here.',
  paint: 'Pick a color off the shelf. Long, even strokes. You can mix them up if you like.',
  star: 'Now the star. Put it wherever it looks right to you.',
  done: 'Now that is a good piece of work. We\'ll set it out front where folks can see it.',
  /** When every piece in the shop has been done. */
  allDone: 'That\'s every piece in the shop. Apple would have liked seeing this place busy again.',
};

/** How a finished piece looks: a colour for each part, and where the star went (0..1 across and down). */
export interface Restored {
  parts: string[];
  star: [number, number] | null;
}
