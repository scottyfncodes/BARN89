import { Rng } from '../../core/math';

/**
 * Barn Puzzles, with Jason down at the barns. Two kinds:
 *  - Hay Loft: slide the bales out of the way and roll the hay wagon out the loft door
 *    (a sliding-block puzzle on a 6x6 floor; bales only move along their length).
 *  - Water Line: tap pipe pieces to turn them until the water runs from the pump to every trough.
 * Each round is three boards; stars come from total moves against par.
 */

/* --- Hay Loft --------------------------------------------------------------------------------- */

export const LOFT = 6;

export interface Bale {
  id: string;
  x: number;
  y: number;
  len: number;
  /** Horizontal pieces slide left and right, vertical ones up and down. */
  dir: 'h' | 'v';
  /** The wagon (it leaves through the door on the right), a bale, or a post that never moves. */
  kind: 'wagon' | 'bale' | 'post';
}

export interface HayBoard {
  kind: 'hay';
  /** Six rows of six: '.' floor, 'W' the wagon, 'x' a post, any other letter a bale. */
  rows: string[];
  /** Fewest moves (one move slides one piece any distance). Tests check this against the solver. */
  par: number;
}

/** Turns a board picture into pieces. */
export function parseHay(rows: string[]): Bale[] {
  const out: Bale[] = [];
  const seen = new Set<string>();
  for (let y = 0; y < LOFT; y++)
    for (let x = 0; x < LOFT; x++) {
      const c = rows[y][x];
      if (c === '.' || seen.has(`${x},${y}`)) continue;
      if (c === 'x') {
        out.push({ id: `x${x}${y}`, x, y, len: 1, dir: 'h', kind: 'post' });
        continue;
      }
      let len = 1;
      let dir: 'h' | 'v' = 'h';
      if (x + 1 < LOFT && rows[y][x + 1] === c) {
        while (x + len < LOFT && rows[y][x + len] === c) len++;
      } else {
        dir = 'v';
        while (y + len < LOFT && rows[y + len][x] === c) len++;
      }
      for (let i = 0; i < len; i++) seen.add(dir === 'h' ? `${x + i},${y}` : `${x},${y + i}`);
      out.push({ id: c, x, y, len, dir, kind: c === 'W' ? 'wagon' : 'bale' });
    }
  return out;
}

function occupancy(pieces: Bale[], skip?: Bale): boolean[] {
  const g = new Array<boolean>(LOFT * LOFT).fill(false);
  for (const p of pieces) {
    if (p === skip) continue;
    for (let i = 0; i < p.len; i++) {
      const x = p.dir === 'h' ? p.x + i : p.x;
      const y = p.dir === 'v' ? p.y + i : p.y;
      g[y * LOFT + x] = true;
    }
  }
  return g;
}

/** How far a piece could slide each way: [toward lower x/y, toward higher x/y]. */
export function slideRange(pieces: Bale[], p: Bale): [number, number] {
  if (p.kind === 'post') return [0, 0];
  const g = occupancy(pieces, p);
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < LOFT && y < LOFT && !g[y * LOFT + x];
  let back = 0;
  let fwd = 0;
  if (p.dir === 'h') {
    while (free(p.x - back - 1, p.y)) back++;
    while (free(p.x + p.len + fwd, p.y)) fwd++;
  } else {
    while (free(p.x, p.y - back - 1)) back++;
    while (free(p.x, p.y + p.len + fwd)) fwd++;
  }
  return [back, fwd];
}

export function hayWon(pieces: Bale[]): boolean {
  const w = pieces.find((p) => p.kind === 'wagon')!;
  return w.x + w.len === LOFT;
}

/** Fewest moves to get the wagon to the door (breadth-first; -1 if it can't be done). */
export function solveHay(rows: string[], limit = 200000): number {
  const start = parseHay(rows);
  const key = (ps: Bale[]) => ps.map((p) => (p.dir === 'h' ? p.x : p.y)).join('');
  const seen = new Set([key(start)]);
  let frontier = [start];
  for (let depth = 0; frontier.length && seen.size < limit; depth++) {
    const next: Bale[][] = [];
    for (const ps of frontier) {
      if (hayWon(ps)) return depth;
      ps.forEach((p, i) => {
        const [back, fwd] = slideRange(ps, p);
        for (let d = -back; d <= fwd; d++) {
          if (!d) continue;
          const moved = ps.map((q, j) => (j === i ? { ...q, x: q.dir === 'h' ? q.x + d : q.x, y: q.dir === 'v' ? q.y + d : q.y } : q));
          const k = key(moved);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(moved);
        }
      });
    }
    frontier = next;
  }
  return -1;
}

/* --- Water Line ------------------------------------------------------------------------------- */

/** Pipe openings as bits: north, east, south, west. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const SIDES = [N, E, S, W];
const STEP: Record<number, [number, number]> = { [N]: [0, -1], [E]: [1, 0], [S]: [0, 1], [W]: [-1, 0] };
const OPP: Record<number, number> = { [N]: S, [E]: W, [S]: N, [W]: E };

/** A quarter turn clockwise. */
export function turn(mask: number): number {
  return ((mask << 1) | (mask >> 3)) & 15;
}

export interface Port {
  x: number;
  y: number;
  /** Which side of that cell the pump (or trough) is on. */
  side: number;
}

export interface PipeBoard {
  kind: 'pipes';
  w: number;
  h: number;
  pump: Port;
  troughs: Port[];
  /** Cells the water runs through, pump to each trough in turn (branches share cells). */
  paths: [number, number][][];
  /** Seed for the spare pipes and the starting scramble. */
  seed: number;
}

export interface PipeTile {
  /** Openings in the solved position. */
  solved: number;
  /** Openings right now. */
  mask: number;
  /** On the water's way (as opposed to a spare piece). */
  route: boolean;
}

/** Lays out the board: the route's pipes, spare pieces everywhere else, everything turned at random. */
export function buildPipes(b: PipeBoard): PipeTile[] {
  const tiles: PipeTile[] = Array.from({ length: b.w * b.h }, () => ({ solved: 0, mask: 0, route: false }));
  const at = (x: number, y: number) => tiles[y * b.w + x];
  at(b.pump.x, b.pump.y).solved |= b.pump.side;
  for (const t of b.troughs) at(t.x, t.y).solved |= t.side;
  for (const path of b.paths)
    for (let i = 0; i + 1 < path.length; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1];
      const side = SIDES.find((s) => STEP[s][0] === bx - ax && STEP[s][1] === by - ay)!;
      at(ax, ay).solved |= side;
      at(bx, by).solved |= OPP[side];
    }
  const rng = new Rng(b.seed);
  for (const t of tiles) {
    if (t.solved) t.route = true;
    // Spare pieces: mostly bends and straights, the odd tee.
    else t.solved = rng.pick([N | E, E | S, N | S, E | W, N | E | S, S | W]);
    t.mask = t.solved;
    const turns = rng.int(0, 4);
    for (let i = 0; i < turns; i++) t.mask = turn(t.mask);
  }
  // Never hand over a board that's already done.
  if (pipesWon(b, tiles)) {
    const t = tiles.find((q) => q.route && turn(q.mask) !== q.mask)!;
    t.mask = turn(t.mask);
  }
  return tiles;
}

/** Cells the water reaches from the pump right now. */
export function wet(b: PipeBoard, tiles: PipeTile[]): Set<number> {
  const out = new Set<number>();
  const start = b.pump.y * b.w + b.pump.x;
  if (!(tiles[start].mask & b.pump.side)) return out;
  const queue = [start];
  out.add(start);
  while (queue.length) {
    const i = queue.shift()!;
    const x = i % b.w;
    const y = Math.floor(i / b.w);
    for (const s of SIDES) {
      if (!(tiles[i].mask & s)) continue;
      const nx = x + STEP[s][0];
      const ny = y + STEP[s][1];
      if (nx < 0 || ny < 0 || nx >= b.w || ny >= b.h) continue;
      const j = ny * b.w + nx;
      if (out.has(j) || !(tiles[j].mask & OPP[s])) continue;
      out.add(j);
      queue.push(j);
    }
  }
  return out;
}

export function pipesWon(b: PipeBoard, tiles: PipeTile[]): boolean {
  const w = wet(b, tiles);
  return b.troughs.every((t) => w.has(t.y * b.w + t.x) && !!(tiles[t.y * b.w + t.x].mask & t.side));
}

/** Taps to turn a piece from `mask` to `solved` (straights and crosses look the same half-way round). */
export function tapsTo(mask: number, solved: number): number {
  let m = mask;
  for (let i = 0; i < 4; i++) {
    if (m === solved) return i;
    m = turn(m);
  }
  return 0;
}

/** Par for a pipe board: the taps to turn every piece on the route into place. */
export function pipePar(tiles: PipeTile[]): number {
  return tiles.reduce((n, t) => n + (t.route ? tapsTo(t.mask, t.solved) : 0), 0);
}

/* --- Rounds ----------------------------------------------------------------------------------- */

export type Board = HayBoard | PipeBoard;

export interface PuzzleRound {
  id: string;
  name: string;
  boards: Board[];
}

export const PUZZLE_ROUNDS: PuzzleRound[] = [
  {
    id: 'puzzle-1',
    name: 'Hay Loft',
    boards: [
      { kind: 'hay', par: 3, rows: ['.CAAA.', '.CD...', 'WWD...', '.EBB..', '.E....', '......'] },
      { kind: 'hay', par: 5, rows: ['.DD...', '..C.AA', 'WWC..G', '.BBB.G', '..F.EE', '..F...'] },
      { kind: 'hay', par: 8, rows: ['......', '...B..', '.WWB..', '..CBFF', '..C.A.', 'EEDDA.'] },
    ],
  },
  {
    id: 'puzzle-2',
    name: 'Water Line',
    boards: [
      { kind: 'pipes', w: 4, h: 4, seed: 11, pump: { x: 0, y: 1, side: W }, troughs: [{ x: 3, y: 2, side: E }], paths: [[[0, 1], [1, 1], [1, 2], [2, 2], [3, 2]]] },
      { kind: 'pipes', w: 5, h: 5, seed: 23, pump: { x: 0, y: 0, side: W }, troughs: [{ x: 4, y: 4, side: E }], paths: [[[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4]]] },
      {
        kind: 'pipes',
        w: 5,
        h: 5,
        seed: 37,
        pump: { x: 0, y: 2, side: W },
        troughs: [
          { x: 4, y: 0, side: E },
          { x: 4, y: 4, side: E },
        ],
        paths: [
          [[0, 2], [1, 2], [2, 2], [2, 1], [3, 1], [3, 0], [4, 0]],
          [[2, 2], [2, 3], [3, 3], [3, 4], [4, 4]],
        ],
      },
    ],
  },
  {
    id: 'puzzle-3',
    name: 'Big Hay Day',
    boards: [
      { kind: 'hay', par: 11, rows: ['B.EFFF', 'B.EA..', 'BWWA..', '...C..', 'DD.C..', '......'] },
      { kind: 'hay', par: 13, rows: ['..A...', '..AGDD', '.WWG..', '.E.GCC', '.EBBF.', 'HH..F.'] },
      { kind: 'hay', par: 15, rows: ['GGGFAE', '...FAE', 'WW.F.E', '.CD...', '.CDBB.', '......'] },
    ],
  },
  {
    id: 'puzzle-4',
    name: 'Dry Spell',
    boards: [
      {
        kind: 'pipes',
        w: 6,
        h: 6,
        seed: 41,
        pump: { x: 0, y: 3, side: W },
        troughs: [{ x: 5, y: 0, side: E }],
        paths: [[[0, 3], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [5, 0]]],
      },
      {
        kind: 'pipes',
        w: 6,
        h: 6,
        seed: 53,
        pump: { x: 0, y: 0, side: N },
        troughs: [
          { x: 5, y: 2, side: E },
          { x: 2, y: 5, side: S },
        ],
        paths: [
          [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [4, 2], [5, 2]],
          [[2, 1], [2, 2], [1, 2], [1, 3], [1, 4], [2, 4], [2, 5]],
        ],
      },
      {
        kind: 'pipes',
        w: 6,
        h: 6,
        seed: 67,
        pump: { x: 0, y: 5, side: W },
        troughs: [
          { x: 5, y: 0, side: N },
          { x: 5, y: 5, side: E },
          { x: 0, y: 0, side: N },
        ],
        paths: [
          [[0, 5], [1, 5], [1, 4], [2, 4], [3, 4], [3, 3], [3, 2], [4, 2], [4, 1], [5, 1], [5, 0]],
          [[3, 4], [4, 4], [4, 5], [5, 5]],
          [[3, 2], [2, 2], [2, 1], [1, 1], [0, 1], [0, 0]],
        ],
      },
    ],
  },
];

/* --- The game --------------------------------------------------------------------------------- */

export type PuzzleEvent =
  | { type: 'slide'; id: string }
  | { type: 'turn'; wet: boolean }
  | { type: 'solved'; board: number; moves: number; par: number }
  | { type: 'done' };

export interface PuzzleResult {
  stars: number;
  score: number;
  moves: number;
  par: number;
  lines: { label: string; value: string }[];
}

/** Seconds to enjoy a solved board (the wagon rolls out, the troughs fill) before the next one. */
export const SOLVED_PAUSE = 1.6;

export class PuzzleGame {
  boardIndex = 0;
  /** Moves on this board, and on the boards already done. */
  moves = 0;
  card: { moves: number; par: number }[] = [];
  phase: 'play' | 'solved' | 'complete' = 'play';
  solvedT = 0;
  pieces: Bale[] = [];
  tiles: PipeTile[] = [];
  /** Par for the current board. */
  par = 0;
  result: PuzzleResult | null = null;
  private events: PuzzleEvent[] = [];

  constructor(readonly round: PuzzleRound) {
    this.reset();
  }

  get board(): Board {
    return this.round.boards[this.boardIndex];
  }

  reset(): void {
    this.boardIndex = 0;
    this.card = [];
    this.result = null;
    this.load();
  }

  /** Start the current board over (moves so far still count). */
  retry(): void {
    if (this.phase !== 'play') return;
    const m = this.moves;
    this.load();
    this.moves = m;
  }

  private load(): void {
    const b = this.board;
    this.moves = 0;
    this.phase = 'play';
    this.solvedT = 0;
    if (b.kind === 'hay') {
      this.pieces = parseHay(b.rows);
      this.tiles = [];
      this.par = b.par;
    } else {
      this.tiles = buildPipes(b);
      this.pieces = [];
      this.par = pipePar(this.tiles);
    }
  }

  /** Slide a hay piece by `d` cells along its length (clamped to what's free). Returns how far it went. */
  slide(id: string, d: number): number {
    if (this.phase !== 'play' || this.board.kind !== 'hay') return 0;
    const p = this.pieces.find((q) => q.id === id);
    if (!p || !d) return 0;
    const [back, fwd] = slideRange(this.pieces, p);
    const step = Math.max(-back, Math.min(fwd, Math.round(d)));
    if (!step) return 0;
    if (p.dir === 'h') p.x += step;
    else p.y += step;
    this.moves++;
    this.events.push({ type: 'slide', id });
    if (hayWon(this.pieces)) this.solve();
    return step;
  }

  /** Turn a pipe piece a quarter turn clockwise. */
  tap(x: number, y: number): void {
    const b = this.board;
    if (this.phase !== 'play' || b.kind !== 'pipes') return;
    if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
    const t = this.tiles[y * b.w + x];
    t.mask = turn(t.mask);
    this.moves++;
    this.events.push({ type: 'turn', wet: wet(b, this.tiles).has(y * b.w + x) });
    if (pipesWon(b, this.tiles)) this.solve();
  }

  private solve(): void {
    this.phase = 'solved';
    this.solvedT = 0;
    this.card.push({ moves: this.moves, par: this.par });
    this.events.push({ type: 'solved', board: this.boardIndex, moves: this.moves, par: this.par });
  }

  step(dt: number): void {
    if (this.phase !== 'solved') return;
    this.solvedT += dt;
    if (this.solvedT < SOLVED_PAUSE) return;
    if (this.boardIndex + 1 < this.round.boards.length) {
      this.boardIndex++;
      this.load();
      return;
    }
    this.phase = 'complete';
    this.result = scorePuzzles(this.card, this.round.boards.map((b) => (b.kind === 'hay' ? 'Hay loft' : 'Water line')));
    this.events.push({ type: 'done' });
  }

  drainEvents(): PuzzleEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}

/** Stars from moves against par: at par for three, within half again for two. */
export function scorePuzzles(card: { moves: number; par: number }[], names: string[]): PuzzleResult {
  const moves = card.reduce((n, c) => n + c.moves, 0);
  const par = card.reduce((n, c) => n + c.par, 0);
  const stars = moves <= par ? 3 : moves <= Math.ceil(par * 1.5) ? 2 : 1;
  return {
    stars,
    score: Math.max(100, 2000 - (moves - par) * 60),
    moves,
    par,
    lines: card.map((c, i) => ({ label: `${names[i]} ${i + 1}`, value: `${c.moves} moves (par ${c.par})` })),
  };
}
