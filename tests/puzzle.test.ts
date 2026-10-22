import { describe, expect, it } from 'vitest';
import {
  buildPipes,
  E,
  hayWon,
  LOFT,
  N,
  parseHay,
  PUZZLE_ROUNDS,
  PuzzleGame,
  S,
  SOLVED_PAUSE,
  scorePuzzles,
  slideRange,
  solveHay,
  tapsTo,
  turn,
  W,
  type Bale,
  type HayBoard,
  type PipeBoard,
} from '../src/games/puzzle/puzzle';

const hayBoards = PUZZLE_ROUNDS.flatMap((r) => r.boards).filter((b): b is HayBoard => b.kind === 'hay');
const pipeBoards = PUZZLE_ROUNDS.flatMap((r) => r.boards).filter((b): b is PipeBoard => b.kind === 'pipes');

/** The moves of a shortest solution, as [piece id, distance]. */
function hayMoves(rows: string[]): [string, number][] {
  const start = parseHay(rows);
  const key = (ps: Bale[]) => ps.map((p) => (p.dir === 'h' ? p.x : p.y)).join(',');
  const parent = new Map<string, { from: string; move: [string, number] } | null>([[key(start), null]]);
  const states = new Map([[key(start), start]]);
  let frontier = [start];
  while (frontier.length) {
    const next: Bale[][] = [];
    for (const ps of frontier) {
      if (hayWon(ps)) {
        const out: [string, number][] = [];
        let k = key(ps);
        while (parent.get(k)) {
          const p = parent.get(k)!;
          out.unshift(p.move);
          k = p.from;
        }
        return out;
      }
      ps.forEach((p, i) => {
        const [back, fwd] = slideRange(ps, p);
        for (let d = -back; d <= fwd; d++) {
          if (!d) continue;
          const moved = ps.map((q, j) => (j === i ? { ...q, x: q.dir === 'h' ? q.x + d : q.x, y: q.dir === 'v' ? q.y + d : q.y } : q));
          const k = key(moved);
          if (parent.has(k)) continue;
          parent.set(k, { from: key(ps), move: [p.id, d] });
          states.set(k, moved);
          next.push(moved);
        }
      });
    }
    frontier = next;
  }
  return [];
}

describe('Hay Loft boards', () => {
  it('are six by six with one wagon, sideways, in the door row', () => {
    for (const b of hayBoards) {
      expect(b.rows.length).toBe(LOFT);
      for (const r of b.rows) expect(r.length).toBe(LOFT);
      const wagons = parseHay(b.rows).filter((p) => p.kind === 'wagon');
      expect(wagons.length).toBe(1);
      expect(wagons[0].dir).toBe('h');
      expect(wagons[0].y).toBe(2);
      expect(hayWon(parseHay(b.rows))).toBe(false);
    }
  });

  it('have the par the solver finds, getting harder through each round', () => {
    for (const b of hayBoards) expect(solveHay(b.rows), b.rows.join('|')).toBe(b.par);
    for (const r of PUZZLE_ROUNDS) {
      const pars = r.boards.filter((b): b is HayBoard => b.kind === 'hay').map((b) => b.par);
      for (let i = 1; i < pars.length; i++) expect(pars[i]).toBeGreaterThan(pars[i - 1]);
    }
  });

  it('bales stop at whatever is in the way', () => {
    const g = new PuzzleGame({ id: 't', name: 't', boards: [{ kind: 'hay', par: 2, rows: ['......', '......', 'WW.A..', '...A..', '..BB..', '......'] }] });
    // The wagon only gets one square before the bale.
    expect(g.slide('W', 5)).toBe(1);
    // Vertical bales don't go sideways, and posts never move.
    expect(g.slide('A', -3)).toBe(-2);
    expect(g.moves).toBe(2);
    expect(g.slide('B', 0)).toBe(0);
    expect(g.moves).toBe(2);
  });
});

describe('Water Line boards', () => {
  it('route the water cell by cell from the pump on the edge to troughs on the edge', () => {
    for (const b of pipeBoards) {
      const edge = (p: { x: number; y: number; side: number }) =>
        (p.side === W && p.x === 0) || (p.side === E && p.x === b.w - 1) || (p.side === N && p.y === 0) || (p.side === S && p.y === b.h - 1);
      expect(edge(b.pump)).toBe(true);
      for (const t of b.troughs) expect(edge(t)).toBe(true);
      for (const path of b.paths) {
        for (let i = 0; i + 1 < path.length; i++) expect(Math.abs(path[i][0] - path[i + 1][0]) + Math.abs(path[i][1] - path[i + 1][1])).toBe(1);
      }
      expect(b.paths[0][0]).toEqual([b.pump.x, b.pump.y]);
    }
  });

  it('start scrambled, and come out right when every route piece is turned into place', () => {
    for (const b of pipeBoards) {
      const g = new PuzzleGame({ id: 't', name: 't', boards: [b] });
      expect(g.phase).toBe('play');
      g.tiles.forEach((t, i) => {
        if (!t.route) return;
        for (let k = tapsTo(t.mask, t.solved); k > 0; k--) g.tap(i % b.w, Math.floor(i / b.w));
      });
      expect(g.phase).toBe('solved');
      expect(g.moves).toBeLessThanOrEqual(g.par);
      expect(g.par).toBeGreaterThan(2);
    }
  });

  it('a quarter turn moves each opening one side clockwise', () => {
    expect(turn(N)).toBe(E);
    expect(turn(W)).toBe(N);
    expect(turn(N | S)).toBe(E | W);
    expect(tapsTo(E | W, N | S)).toBe(1);
  });

  it('is the same board every time (seeded)', () => {
    const a = buildPipes(pipeBoards[0]).map((t) => t.mask);
    const b = buildPipes(pipeBoards[0]).map((t) => t.mask);
    expect(a).toEqual(b);
  });
});

describe('a round of Barn Puzzles', () => {
  for (const round of PUZZLE_ROUNDS) {
    it(`${round.name}: solving every board at par gets three stars`, () => {
      const g = new PuzzleGame(round);
      for (let i = 0; i < round.boards.length; i++) {
        const b = g.board;
        if (b.kind === 'hay') for (const [id, d] of hayMoves(b.rows)) expect(g.slide(id, d)).toBe(d);
        else
          g.tiles.forEach((t, j) => {
            if (!t.route) return;
            for (let k = tapsTo(t.mask, t.solved); k > 0; k--) g.tap(j % b.w, Math.floor(j / b.w));
          });
        expect(g.phase).toBe('solved');
        for (let k = 0; k < (SOLVED_PAUSE + 0.1) * 60; k++) g.step(1 / 60);
      }
      expect(g.phase).toBe('complete');
      expect(g.result?.stars).toBe(3);
    });
  }

  it('stars: par for three, half again for two', () => {
    expect(scorePuzzles([{ moves: 10, par: 10 }], ['a']).stars).toBe(3);
    expect(scorePuzzles([{ moves: 15, par: 10 }], ['a']).stars).toBe(2);
    expect(scorePuzzles([{ moves: 16, par: 10 }], ['a']).stars).toBe(1);
  });

  it('starting a board over puts the pieces back but keeps the count', () => {
    const g = new PuzzleGame(PUZZLE_ROUNDS[0]);
    const before = JSON.stringify(g.pieces);
    const p = g.pieces.find((q) => q.kind === 'bale' && slideRange(g.pieces, q).some((n) => n > 0))!;
    const [back] = slideRange(g.pieces, p);
    g.slide(p.id, back > 0 ? -1 : 1);
    g.retry();
    expect(JSON.stringify(g.pieces)).toBe(before);
    expect(g.moves).toBe(1);
  });
});
