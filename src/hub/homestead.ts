import { ACTIVITIES, type Activity } from '../content/activities';
import { DOGS, DONKEYS, FAMILY_ORDER, type DogDef, type DonkeyDef, type FamilyId } from '../content/cast';
import { dist, fromAngle, Rng, type Vec } from '../core/math';
import { COATS } from '../games/kitten/levels';
import { PERSONALITIES, type Coat, type Personality } from '../games/kitten/kittenTypes';
import { createPlayer, updatePlayer } from '../games/kitten/player';
import type { Emote, InputState, Player } from '../games/kitten/types';
import type { PenDef } from '../world/mapTypes';
import type { SharedWorld } from '../world/shared';
import { HUNT_ITEMS, ORNAMENTS, ROUNDS_STAR_TIMES, ROUNDS_TASKS } from './missions';

/* ---------------------------------------------------------------------------------------- */
/* Actors                                                                                     */
/* ---------------------------------------------------------------------------------------- */

export interface Npc {
  who: FamilyId;
  x: number;
  y: number;
  px: number;
  py: number;
  home: Vec;
  faceX: number;
  waveT: number;
  near: boolean;
  /** Where they're ambling to between bits of business, if anywhere. */
  target: Vec | null;
  /** Seconds until the next bit of business. */
  idleT: number;
  /** Seconds left on the current gesture (see NPC_ROUTINES). */
  busyT: number;
  /** Seconds left celebrating after you played their game. */
  cheerT: number;
  walkPhase: number;
}

/**
 * What each family member does while waiting at their spot: how far they amble, and the small
 * gesture that fits where they stand. Everyone stops and turns to you when you walk up.
 */
export interface NpcRoutine {
  /** How far from their spot they wander (0 stays put). */
  roam: number;
  /** Seconds between bits of business. */
  gap: [number, number];
  gesture: 'toss' | 'swing' | 'point' | 'look' | 'wave';
  /** Seconds the gesture lasts. */
  gestureT: number;
  /** Which way they face for the gesture (0 keeps whatever way they're facing). */
  gestureFace: number;
}

export const NPC_ROUTINES: Record<FamilyId, NpcRoutine> = {
  // Scattering feed for the chickens beside her.
  megan: { roam: 44, gap: [3, 6], gesture: 'toss', gestureT: 0.6, gestureFace: -1 },
  // A practice swing or two at the woodpile.
  jason: { roam: 0, gap: [4, 7], gesture: 'swing', gestureT: 1.4, gestureFace: 0 },
  // Walking a lap around his mower.
  jay: { roam: 40, gap: [3, 7], gesture: 'look', gestureT: 1.2, gestureFace: 0 },
  // Keeping an eye on the arena for loose cats.
  natalie: { roam: 46, gap: [3, 6], gesture: 'point', gestureT: 1.1, gestureFace: 0 },
  // On his porch, waving at the trucks on Buffalo Gap Rd.
  grandpa: { roam: 0, gap: [6, 11], gesture: 'wave', gestureT: 1.6, gestureFace: 1 },
};

/** Within this distance family members stop what they're doing and turn to you. */
export const NPC_ATTEND = 150;

export interface HubDog {
  def: DogDef;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  faceX: number;
  phase: number;
  state: 'follow' | 'fetch' | 'return' | 'rest' | 'sniff';
  ball: boolean;
  /** While sniffing: the interesting spot, and how long left with nose to the ground. */
  sniffAt: Vec | null;
  sniffT: number;
  wag: number;
  side: number;
  path: Vec[] | null;
  pathT: number;
}

export interface HubDonkey {
  def: DonkeyDef;
  x: number;
  y: number;
  px: number;
  py: number;
  faceX: number;
  phase: number;
  target: Vec;
  state: 'wander' | 'graze' | 'come' | 'eat' | 'sulk' | 'greet' | 'watch';
  t: number;
  brayT: number;
}

export interface HubCat {
  id: string;
  name: string;
  personality: Personality;
  coat: Coat;
  x: number;
  y: number;
  px: number;
  py: number;
  spots: Vec[];
  spot: number;
  faceX: number;
  phase: number;
  state: 'rest' | 'walk' | 'follow' | 'chase';
  target: Vec | null;
  t: number;
  emote: Emote;
  emoteT: number;
  speed: number;
}

export interface Ball {
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  t: number;
  flight: number;
  landed: boolean;
  held: string | null;
}

export type HubAction =
  | { kind: 'ball'; label: string }
  | { kind: 'pet'; label: string; cat: HubCat }
  | { kind: 'carrot'; label: string }
  | { kind: 'task'; label: string; task: string }
  | { kind: 'pickup'; label: string; item: string }
  | { kind: 'sunday'; label: string };

export type HubEvent =
  | { type: 'ornament'; id: string; x: number; y: number; count: number }
  | { type: 'discover'; id: string; title: string; text: string }
  | { type: 'throw' }
  | { type: 'fetched'; dog: string; x: number; y: number }
  | { type: 'bark'; x: number; y: number }
  | { type: 'carrot'; donkey: string; ok: boolean; x: number; y: number }
  | { type: 'bray'; x: number; y: number }
  | { type: 'pet'; cat: string; name: string; text: string; x: number; y: number }
  | { type: 'meow'; x: number; y: number }
  | { type: 'task'; id: string; text: string; x: number; y: number; left: number }
  | { type: 'roundsDone'; seconds: number; stars: number }
  | { type: 'huntItem'; id: string; text: string; x: number; y: number; left: number }
  | { type: 'huntReady' }
  | { type: 'sunday' };

export interface RoundsState {
  kind: 'rounds';
  t: number;
  done: Set<string>;
  holding: { task: string; t: number } | null;
}

export interface HuntState {
  kind: 'hunt';
  step: number;
  hints: number;
  hintT: number;
  ready: boolean;
}

export type Mission = RoundsState | HuntState | null;

/** The long table under the Barn 89 string lights (see ranch.ts). */
export const LONG_TABLE = { x: 1670, y: 2890 };
/** Where people sit for Sunday breakfast: three behind the table, the rest in front. */
const TABLE_SEATS = [
  { x: 1612, y: 2850 },
  { x: 1662, y: 2850 },
  { x: 1712, y: 2850 },
  { x: 1618, y: 2942 },
];
const EXPLORER_SEAT = { x: 1708, y: 2942 };

const CAT_HOMES: { id: keyof typeof COATS; name: string; personality: Personality; spots: Vec[] }[] = [
  { id: 'marshmallow', name: 'Marshmallow', personality: 'sleepy', spots: [{ x: 1440, y: 2165 }, { x: 1380, y: 2190 }] },
  { id: 'tortie', name: 'Tater', personality: 'sleepy', spots: [{ x: 880, y: 1080 }, { x: 760, y: 1090 }] },
  { id: 'calico', name: 'Pickles', personality: 'curious', spots: [{ x: 1452, y: 755 }, { x: 1560, y: 730 }] },
  { id: 'greyTabby', name: 'Ziggy', personality: 'distractible', spots: [{ x: 800, y: 1195 }, { x: 960, y: 1210 }] },
  { id: 'orangeTabby', name: 'Biscuit', personality: 'hungry', spots: [{ x: 1640, y: 2785 }, { x: 1440, y: 2380 }] },
  { id: 'siamese', name: 'Mochi', personality: 'shy', spots: [{ x: 1010, y: 930 }, { x: 1180, y: 1060 }] },
  { id: 'tuxedo', name: 'Pepper', personality: 'shy', spots: [{ x: 500, y: 2165 }, { x: 640, y: 2230 }] },
  { id: 'waffles', name: 'Waffles', personality: 'hungry', spots: [{ x: 540, y: 470 }, { x: 640, y: 380 }] },
];

/** How long each kind of cat stays put before wandering over to its other favourite spot. */
const CAT_REST: Record<Personality, [number, number]> = {
  sleepy: [90, 160],
  shy: [30, 60],
  hungry: [20, 40],
  curious: [14, 30],
  distractible: [10, 22],
};

/** How long the dogs put up with you standing still before going off to sniff something. */
const SNIFF_AFTER: Record<string, number> = { scout: 8, annie: 18 };

const PET_LINES: Record<Personality, string[]> = {
  hungry: ['{n} purrs and follows you, just in case you have snacks.', '{n} head-bonks your boots. Snacks were implied.'],
  shy: ['{n} gives you one slow blink, then bolts.', '{n} tolerates exactly one pet, then relocates.'],
  sleepy: ['{n} purrs without waking up.', '{n} stretches, yawns, and goes right back to sleep.'],
  curious: ['{n} inspects your sleeve, your shoelace, and your soul.', '{n} follows you to see what you are up to.'],
  distractible: ['{n} was enjoying that, until a butterfly.', '{n} rolls over, then spots a bug and is gone.'],
};

/* ---------------------------------------------------------------------------------------- */
/* Simulation                                                                                 */
/* ---------------------------------------------------------------------------------------- */

/** The explorable homestead: walk around, meet everyone, start games, find secrets. */
export class Homestead {
  readonly map: SharedWorld['map'];
  player: Player;
  explorer: FamilyId;
  npcs: Npc[] = [];
  dogs: HubDog[];
  donkeys: HubDonkey[];
  cats: HubCat[];
  ball: Ball | null = null;
  clock = 0;
  /** Station currently in range (prompt card), if any. */
  nearStation: Activity | null = null;
  action: HubAction | null = null;
  mission: Mission = null;
  ornaments: Set<string>;
  discovered: Set<string>;
  huntFound: Set<string>;
  readonly pen: PenDef;
  /** Everyone is at the long table for Sunday breakfast. */
  gathered = false;
  private events: HubEvent[] = [];
  private rng = new Rng(89);
  /** Separate stream for ambient behaviour so it never shifts the games' dice. */
  private life = new Rng(1989);
  private barkT = 3;
  /** A donkey already came over to the fence this visit. */
  private greeted = false;

  constructor(
    readonly shared: SharedWorld,
    opts: { explorer: FamilyId; ornaments: string[]; discoveries: string[]; huntFound: string[] },
  ) {
    this.map = shared.map;
    this.explorer = opts.explorer;
    this.ornaments = new Set(opts.ornaments);
    this.discovered = new Set(opts.discoveries);
    this.huntFound = new Set(opts.huntFound);
    this.pen = this.map.pens.find((p) => p.id === 'roundPen')!;
    const start = this.startPoint();
    this.player = createPlayer(start.x, start.y);
    this.player.maxSpeed = 260;
    this.placeNpcs();
    this.dogs = DOGS.map((def, i) => ({
      def,
      x: start.x - 50 - i * 30,
      y: start.y + 20 + i * 18,
      px: start.x,
      py: start.y,
      vx: 0,
      vy: 0,
      faceX: 1,
      phase: i,
      state: 'follow',
      ball: false,
      wag: 0.5,
      side: i ? 1 : -1,
      sniffAt: null,
      sniffT: 0,
      path: null,
      pathT: 0,
    }));
    this.donkeys = DONKEYS.map((def, i) => {
      const p = this.penPoint(i * 3 + 1);
      return { def, x: p.x, y: p.y, px: p.x, py: p.y, faceX: i ? -1 : 1, phase: 0, target: p, state: 'graze', t: 2 + i * 2, brayT: 0 };
    });
    this.cats = CAT_HOMES.map((c) => {
      const s = c.spots[0];
      return {
        id: c.id,
        name: c.name,
        personality: c.personality,
        coat: COATS[c.id],
        x: s.x,
        y: s.y,
        px: s.x,
        py: s.y,
        spots: c.spots,
        spot: 0,
        faceX: 1,
        phase: 0,
        state: 'rest',
        target: null,
        t: this.life.range(...CAT_REST[c.personality]),
        emote: c.personality === 'sleepy' ? 'zzz' : 'none',
        emoteT: 0,
        speed: PERSONALITIES[c.personality].walk + 40,
      };
    });
  }

  /** Where the explorer starts: just outside the main house's front door. */
  startPoint(): Vec {
    return { x: 960, y: 960 };
  }

  setExplorer(id: FamilyId): void {
    this.explorer = id;
    this.placeNpcs();
  }

  private placeNpcs(): void {
    this.npcs = FAMILY_ORDER.filter((id) => id !== this.explorer).map((who) => {
      const a = ACTIVITIES.find((aa) => aa.who === who)!;
      const { x, y } = a.station;
      return { who, x, y, px: x, py: y, home: { x, y }, faceX: -1, waveT: 0, near: false, target: null, idleT: this.life.range(1, 4), busyT: 0, cheerT: 0, walkPhase: 0 };
    });
  }

  emit(e: HubEvent): void {
    this.events.push(e);
  }

  drainEvents(): HubEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Jump the explorer (and the dogs) somewhere, e.g. from the map. */
  teleport(x: number, y: number): void {
    const spot = this.shared.nav.isWalkable(x, y) ? { x, y } : this.shared.nav.nearestWalkable(x, y, 10) ?? { x, y };
    const p = this.player;
    p.x = p.px = spot.x;
    p.y = p.py = spot.y;
    p.vx = p.vy = 0;
    for (const d of this.dogs) {
      const q = this.shared.nav.nearestWalkable(spot.x - 40 * d.side, spot.y + 30, 6) ?? spot;
      d.x = d.px = q.x;
      d.y = d.py = q.y;
      d.state = 'follow';
      d.ball = false;
      d.path = null;
    }
    this.ball = null;
  }

  /** Bring the family to the long table (or send everyone back to what they were doing). */
  gather(on: boolean): void {
    this.gathered = on;
    if (!on) {
      for (const n of this.npcs) {
        n.x = n.px = n.home.x;
        n.y = n.py = n.home.y;
        n.target = null;
      }
      for (const d of this.dogs) d.state = 'follow';
      return;
    }
    this.npcs.forEach((n, i) => {
      const seat = TABLE_SEATS[i % TABLE_SEATS.length];
      n.x = n.px = seat.x;
      n.y = n.py = seat.y;
      n.target = null;
      n.busyT = 0;
      n.faceX = seat.x < LONG_TABLE.x ? 1 : -1;
      n.waveT = 0;
    });
    const p = this.player;
    p.x = p.px = EXPLORER_SEAT.x;
    p.y = p.py = EXPLORER_SEAT.y;
    p.vx = p.vy = 0;
    p.faceX = -1;
    const spots = [
      { x: 1772, y: 2930 },
      { x: 1575, y: 2945 },
    ];
    this.dogs.forEach((d, i) => {
      d.x = d.px = spots[i].x;
      d.y = d.py = spots[i].y;
      d.state = 'rest';
      d.faceX = i ? 1 : -1;
    });
    this.ball = null;
  }

  /* -------------------------------------------------------------------------------------- */
  /* Missions                                                                                 */
  /* -------------------------------------------------------------------------------------- */

  startRounds(): void {
    this.mission = { kind: 'rounds', t: 0, done: new Set(), holding: null };
    const a = ACTIVITIES.find((x) => x.id === 'rounds')!;
    this.teleport(a.station.x + 55, a.station.y + 100);
  }

  startHunt(): void {
    const step = HUNT_ITEMS.findIndex((h) => !this.huntFound.has(h.id));
    this.mission = { kind: 'hunt', step: step < 0 ? HUNT_ITEMS.length : step, hints: 0, hintT: 0, ready: step < 0 };
  }

  endMission(): void {
    this.mission = null;
  }

  /** Marker for the hunt hint: the current item while a hint is showing. */
  huntTarget(): Vec | null {
    const m = this.mission;
    if (!m || m.kind !== 'hunt' || m.ready) return null;
    return HUNT_ITEMS[m.step] ?? null;
  }

  useHint(): void {
    const m = this.mission;
    if (!m || m.kind !== 'hunt' || m.ready) return;
    m.hints++;
    m.hintT = 8;
  }

  /* -------------------------------------------------------------------------------------- */
  /* Step                                                                                     */
  /* -------------------------------------------------------------------------------------- */

  step(input: InputState, dt: number, actionPressed: boolean): void {
    this.clock += dt;
    const p = this.player;
    p.px = p.x;
    p.py = p.y;
    updatePlayer(p, input, this.shared.world, dt);

    this.updateNpcs(dt);
    this.updateBall(dt);
    for (const d of this.dogs) this.updateDog(d, dt);
    this.donkeysNotice();
    for (const d of this.donkeys) this.updateDonkey(d, dt);
    for (const c of this.cats) this.updateCat(c, dt);
    this.updateMission(dt);
    this.checkFinds(dt);
    this.nearStation = this.mission ? null : this.findStation();
    this.action = this.findAction();
    if (actionPressed && this.action) this.doAction(this.action);
  }

  private findStation(): Activity | null {
    const p = this.player;
    let best: Activity | null = null;
    let bd = 105;
    for (const a of ACTIVITIES) {
      const d = dist(p, a.station);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  /** Someone whose game you just played is pleased about it. */
  celebrate(who: FamilyId): void {
    const n = this.npcs.find((x) => x.who === who);
    if (n) n.cheerT = 2.4;
  }

  private updateNpcs(dt: number): void {
    const p = this.player;
    for (const n of this.npcs) {
      n.px = n.x;
      n.py = n.y;
      const d = dist(n, p);
      const near = d < 170;
      if (near && !n.near) n.waveT = 1.4;
      n.near = near;
      n.waveT = Math.max(0, n.waveT - dt);
      n.cheerT = Math.max(0, n.cheerT - dt);
      n.busyT = Math.max(0, n.busyT - dt);
      if (this.gathered) continue;
      const R = NPC_ROUTINES[n.who];
      if (d < NPC_ATTEND) {
        // Drop everything and come back to their spot to talk.
        n.target = dist(n, n.home) > 2 ? n.home : null;
        n.busyT = 0;
        n.idleT = Math.max(n.idleT, 1.5);
      } else if (!n.target) {
        n.idleT -= dt;
        if (n.idleT <= 0) {
          n.idleT = this.life.range(R.gap[0], R.gap[1]);
          if (R.roam > 0 && this.life.next() < 0.5) n.target = this.strollSpot(n, R.roam);
          else {
            n.busyT = R.gestureT;
            if (R.gesture === 'look') n.faceX = -n.faceX;
            else if (R.gestureFace) n.faceX = R.gestureFace;
          }
        }
      }
      if (n.target) {
        const dx = n.target.x - n.x;
        const dy = n.target.y - n.y;
        const dd = Math.hypot(dx, dy);
        const speed = d < NPC_ATTEND ? 90 : 34;
        if (dd < 1.5) {
          n.x = n.target.x;
          n.y = n.target.y;
          n.target = null;
        } else {
          const s = Math.min(dd, speed * dt);
          n.x += (dx / dd) * s;
          n.y += (dy / dd) * s;
          if (Math.abs(dx) > 0.5) n.faceX = dx > 0 ? 1 : -1;
          n.walkPhase += dt * (2 + (speed / 260) * 9);
        }
      }
      if (near && !n.target) n.faceX = p.x >= n.x ? 1 : -1;
    }
  }

  /** A nearby open spot to amble to (or home, if nothing nearby is clear). */
  private strollSpot(n: Npc, roam: number): Vec {
    const w = this.shared.world;
    for (let i = 0; i < 4; i++) {
      const a = this.life.range(0, Math.PI * 2);
      const r = this.life.range(roam * 0.4, roam);
      const q = { x: n.home.x + Math.cos(a) * r, y: n.home.y + Math.sin(a) * r * 0.7 };
      if (w.isFree(q.x, q.y, 10) && w.clearPath(n.x, n.y, q.x, q.y, 10)) return q;
    }
    return n.home;
  }

  private findAction(): HubAction | null {
    const p = this.player;
    const m = this.mission;
    if (m?.kind === 'rounds') {
      for (const t of ROUNDS_TASKS) {
        if (m.done.has(t.id)) continue;
        if (dist(p, t) < 62) {
          if (t.needs && !m.done.has(t.needs)) return null;
          return { kind: 'task', label: t.verb, task: t.id };
        }
      }
      return null;
    }
    if (m?.kind === 'hunt' && !m.ready) {
      const item = HUNT_ITEMS[m.step];
      if (item && dist(p, item) < 46) return { kind: 'pickup', label: 'Pick up', item: item.id };
    }
    if (!m && dist(p, LONG_TABLE) < 95) return { kind: 'sunday', label: 'Sunday breakfast' };
    let cat: HubCat | null = null;
    let cd = 70;
    for (const c of this.cats) {
      const d = dist(c, p);
      if (d < cd && c.state !== 'walk') {
        cd = d;
        cat = c;
      }
    }
    if (cat) return { kind: 'pet', label: `Pet ${cat.name}`, cat };
    if (dist(p, this.pen) < this.pen.r + 60) return { kind: 'carrot', label: 'Offer carrot' };
    // Next to someone with a game, the prompt card is the thing to tap.
    if (!this.nearStation && !this.ball && this.dogs.some((d) => dist(d, p) < 170)) return { kind: 'ball', label: 'Throw ball' };
    return null;
  }

  private doAction(a: HubAction): void {
    switch (a.kind) {
      case 'ball':
        this.throwBall();
        break;
      case 'pet':
        this.petCat(a.cat);
        break;
      case 'carrot':
        this.offerCarrot();
        break;
      case 'task': {
        const m = this.mission;
        if (m?.kind === 'rounds' && !m.holding) m.holding = { task: a.task, t: 0 };
        break;
      }
      case 'pickup':
        this.pickUpHuntItem();
        break;
      case 'sunday':
        this.emit({ type: 'sunday' });
        break;
    }
  }

  /* --- Dogs ------------------------------------------------------------------------------ */

  private throwBall(): void {
    const p = this.player;
    const dir = fromAngle(p.heading);
    let tx = p.x + dir.x * 230;
    let ty = p.y + dir.y * 230;
    if (!this.shared.nav.isWalkable(tx, ty)) {
      const s = this.shared.nav.nearestWalkable(tx, ty, 10);
      if (s) {
        tx = s.x;
        ty = s.y;
      } else {
        tx = p.x;
        ty = p.y;
      }
    }
    this.ball = { x: tx, y: ty, fromX: p.x, fromY: p.y - 40, t: 0, flight: 0.6, landed: false, held: null };
    p.throwT = 0.5;
    // The closer dog goes for it; the other one gives chase for the fun of it.
    const sorted = [...this.dogs].sort((a, b) => dist(a, p) - dist(b, p));
    sorted[0].state = 'fetch';
    sorted[0].path = null;
    this.emit({ type: 'throw' });
  }

  private updateBall(dt: number): void {
    const b = this.ball;
    if (!b || b.held) return;
    b.t = Math.min(b.flight, b.t + dt);
    if (b.t >= b.flight) b.landed = true;
  }

  private moveAgent(a: { x: number; y: number; path: Vec[] | null; pathT: number }, target: Vec, speed: number, dt: number, r: number): number {
    const w = this.shared.world;
    a.pathT -= dt;
    let goal = target;
    if (!w.clearPath(a.x, a.y, target.x, target.y, r)) {
      if (!a.path || a.pathT <= 0) {
        a.path = this.shared.nav.findPath(a, target, 4000);
        a.pathT = 0.8;
      }
      if (a.path && a.path.length) {
        while (a.path.length > 1 && dist(a, a.path[0]) < 14) a.path.shift();
        goal = a.path[0];
      }
    } else {
      a.path = null;
    }
    const dx = goal.x - a.x;
    const dy = goal.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return 0;
    const step = Math.min(d, speed * dt);
    const pos = { x: a.x + (dx / d) * step, y: a.y + (dy / d) * step };
    w.resolve(pos, r);
    const moved = Math.hypot(pos.x - a.x, pos.y - a.y);
    a.x = pos.x;
    a.y = pos.y;
    return moved / Math.max(dt, 1e-6);
  }

  private updateDog(d: HubDog, dt: number): void {
    d.px = d.x;
    d.py = d.y;
    const p = this.player;
    const b = this.ball;
    let sp = 0;
    const fromX = d.x;
    if (d.state === 'fetch') {
      if (!b) d.state = 'follow';
      else if (b.landed) {
        sp = this.moveAgent(d, b, 330, dt, 11);
        if (dist(d, b) < 16) {
          b.held = d.def.id;
          d.ball = true;
          d.state = 'return';
        }
      } else {
        sp = this.moveAgent(d, b, 300, dt, 11);
      }
    } else if (d.state === 'return') {
      sp = this.moveAgent(d, p, 300, dt, 11);
      if (b) {
        b.x = d.x + d.faceX * 14;
        b.y = d.y;
      }
      if (dist(d, p) < 46) {
        d.ball = false;
        d.state = 'follow';
        this.ball = null;
        d.wag = 1;
        this.emit({ type: 'fetched', dog: d.def.name, x: d.x, y: d.y });
      }
    } else if (d.state === 'sniff' && d.sniffAt) {
      // Nose down in the grass a little way off, then back to heel.
      if (p.idleT < 0.1) d.state = 'follow';
      else if (dist(d, d.sniffAt) > 8) sp = this.moveAgent(d, d.sniffAt, 120, dt, 11);
      else {
        d.sniffT -= dt;
        if (d.sniffT <= 0) d.state = 'follow';
      }
    } else {
      // Follow at heel, one on each side; flop down when the explorer stands still a while.
      const back = fromAngle(p.heading + Math.PI, 56);
      const side = fromAngle(p.heading + Math.PI / 2, 34 * d.side);
      const target = { x: p.x + back.x + side.x, y: p.y + back.y + side.y };
      const far = dist(d, target);
      if (p.idleT > 5 && far < 90) d.state = 'rest';
      if (d.state === 'rest' && (p.idleT < 0.1 || far > 120)) d.state = 'follow';
      if (d.state === 'rest' && !this.gathered && p.idleT > (SNIFF_AFTER[d.def.id] ?? 12) && this.life.next() < dt * 0.25) this.startSniff(d);
      if (d.state === 'follow' && far > 16) sp = this.moveAgent(d, target, far > 260 ? 360 : far > 80 ? 270 : 170, dt, 11);
      if (far > 900) {
        // Lost behind something: trot back into view.
        const q = this.shared.nav.nearestWalkable(target.x, target.y, 6);
        if (q) {
          d.x = d.px = q.x;
          d.y = d.py = q.y;
        }
      }
    }
    d.vx = (d.x - fromX) / Math.max(dt, 1e-6);
    if (Math.abs(d.x - fromX) > 0.2) d.faceX = d.x > fromX ? 1 : -1;
    else if (d.state === 'rest' || sp < 5) d.faceX = p.x >= d.x ? 1 : -1;
    d.phase += dt * (2 + Math.min(1, sp / 300) * 14);
    d.wag = Math.max(0.3, d.wag - dt * 0.3);
    if (d.state === 'fetch' || d.state === 'return') d.wag = 1;
  }

  private startSniff(d: HubDog): void {
    const p = this.player;
    const a = this.life.range(0, Math.PI * 2);
    const r = this.life.range(70, 140);
    const spot = this.shared.nav.nearestWalkable(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 3);
    if (!spot || !this.shared.nav.reachable(d, spot)) return;
    d.state = 'sniff';
    d.sniffAt = spot;
    d.sniffT = this.life.range(1.8, 3.4);
    d.path = null;
  }

  /* --- Donkeys --------------------------------------------------------------------------- */

  private penPoint(seed: number): Vec {
    const r = new Rng(seed * 977 + Math.floor(this.clock * 10));
    const a = r.range(0, Math.PI * 2);
    const rr = r.range(10, this.pen.r - 42);
    return { x: this.pen.x + Math.cos(a) * rr, y: this.pen.y + Math.sin(a) * rr * 0.85 };
  }

  private offerCarrot(): void {
    if (this.donkeys.some((d) => d.state === 'come' || d.state === 'eat')) return;
    const p = this.player;
    const ang = Math.atan2(p.y - this.pen.y, p.x - this.pen.x);
    const spot = { x: this.pen.x + Math.cos(ang) * (this.pen.r - 36), y: this.pen.y + Math.sin(ang) * (this.pen.r - 36) };
    const order = [...this.donkeys].sort((a, b) => dist(a, spot) - dist(b, spot));
    // Donkeys are donkeys: sometimes the closest one simply isn't interested.
    const stubborn = this.rng.next() < (order[0].def.id === 'yoda' ? 0.45 : 0.2);
    const chosen = stubborn ? order[1] : order[0];
    if (stubborn) {
      order[0].state = 'sulk';
      order[0].t = 2.2;
      order[0].faceX = order[0].x < p.x ? -1 : 1;
      this.emit({ type: 'carrot', donkey: order[0].def.name, ok: false, x: order[0].x, y: order[0].y });
    }
    chosen.state = 'come';
    chosen.target = spot;
    chosen.t = 6;
    p.throwT = 0.4;
  }

  /**
   * Stand at the pen fence a moment and somebody wanders over to see what you've got.
   * Chewy is usually first to the gate.
   */
  private donkeysNotice(): void {
    const p = this.player;
    if (dist(p, this.pen) > this.pen.r + 110) {
      this.greeted = false;
      return;
    }
    if (this.greeted || p.idleT < 1.2 || this.donkeys.some((d) => d.state === 'come' || d.state === 'eat' || d.state === 'greet')) return;
    this.greeted = true;
    const keen = this.donkeys.find((d) => d.def.id === 'chewy') ?? this.donkeys[0];
    const other = this.donkeys.find((d) => d !== keen);
    const who = keen.state === 'sulk' && other ? other : keen;
    const ang = Math.atan2(p.y - this.pen.y, p.x - this.pen.x);
    who.state = 'greet';
    who.target = { x: this.pen.x + Math.cos(ang) * (this.pen.r - 40), y: this.pen.y + Math.sin(ang) * (this.pen.r - 40) };
    who.t = 8;
  }

  private updateDonkey(d: HubDonkey, dt: number): void {
    d.px = d.x;
    d.py = d.y;
    d.t -= dt;
    d.brayT = Math.max(0, d.brayT - dt);
    const speed = d.state === 'come' ? 70 : d.state === 'greet' ? 48 : 34;
    if (d.state === 'wander' || d.state === 'come' || d.state === 'greet') {
      const dx = d.target.x - d.x;
      const dy = d.target.y - d.y;
      const dd = Math.hypot(dx, dy);
      if (dd > 3) {
        const s = Math.min(dd, speed * dt);
        d.x += (dx / dd) * s;
        d.y += (dy / dd) * s;
        d.faceX = dx > 0 ? 1 : -1;
        d.phase += dt * 6;
      } else if (d.state === 'greet') {
        d.state = 'watch';
        d.t = 5;
      } else if (d.state === 'come') {
        d.state = 'eat';
        d.t = 1.8;
        d.faceX = this.player.x >= d.x ? 1 : -1;
        this.emit({ type: 'carrot', donkey: d.def.name, ok: true, x: d.x, y: d.y });
      } else {
        d.state = 'graze';
        d.t = 3 + this.rng.range(0, 5);
      }
      if ((d.state === 'come' || d.state === 'greet') && d.t <= 0) d.state = 'graze';
    } else if (d.state === 'watch' && (d.t > 0 || (dist(this.player, this.pen) < this.pen.r + 110 && d.t > -12))) {
      // Hangs about at the fence while you do, then loses interest.
      d.faceX = this.player.x >= d.x ? 1 : -1;
    } else if (d.t <= 0) {
      if (d.state === 'eat') {
        d.brayT = 1.2;
        this.emit({ type: 'bray', x: d.x, y: d.y });
      }
      d.state = 'wander';
      d.target = this.penPoint(d.def.id.length + Math.floor(this.clock));
    }
  }

  /* --- Cats ------------------------------------------------------------------------------ */

  private petCat(c: HubCat): void {
    const lines = PET_LINES[c.personality];
    const text = lines[Math.floor(this.rng.next() * lines.length)].replace('{n}', c.name);
    this.emit({ type: 'pet', cat: c.id, name: c.name, text, x: c.x, y: c.y });
    c.emote = 'heart';
    c.emoteT = 0;
    switch (c.personality) {
      case 'hungry':
      case 'curious':
        c.state = 'follow';
        c.t = 9;
        break;
      case 'shy':
      case 'distractible':
        c.spot = (c.spot + 1) % c.spots.length;
        c.target = c.spots[c.spot];
        c.state = 'walk';
        c.emote = c.personality === 'shy' ? 'alarm' : 'sparkle';
        break;
      case 'sleepy':
        c.emote = 'zzz';
        break;
    }
  }

  private updateCat(c: HubCat, dt: number): void {
    c.px = c.x;
    c.py = c.y;
    c.emoteT += dt;
    if (c.emote !== 'none' && c.emote !== 'zzz' && c.emoteT > 2.2) c.emote = c.personality === 'sleepy' ? 'zzz' : 'none';
    const p = this.player;
    if (c.state === 'follow') {
      c.t -= dt;
      const d = dist(c, p);
      if (d > 40) this.stepCat(c, p, d > 200 ? 200 : 120, dt);
      if (c.t <= 0 || d > 420) {
        c.state = 'walk';
        c.target = c.spots[c.spot];
      }
    } else if (c.state === 'walk' && c.target) {
      const d = dist(c, c.target);
      if (d < 6) {
        c.state = 'rest';
        c.target = null;
        c.t = this.life.range(...CAT_REST[c.personality]);
        if (c.personality === 'sleepy') c.emote = 'zzz';
      } else this.stepCat(c, c.target, c.personality === 'shy' ? 190 : c.speed, dt);
    } else if (c.state === 'rest') {
      // Wake up and look around when someone walks by; skittish ones relocate.
      const d = dist(c, p);
      if (c.personality === 'shy' && d < 50 && Math.hypot(p.vx, p.vy) > 200) {
        c.spot = (c.spot + 1) % c.spots.length;
        c.target = c.spots[c.spot];
        c.state = 'walk';
        c.emote = 'alarm';
        c.emoteT = 0;
      } else if (d < 120) c.faceX = p.x >= c.x ? 1 : -1;
      else {
        // Now and then, off to the other favourite spot (never while someone's about to pet them).
        c.t -= dt;
        if (c.t <= 0) {
          c.t = this.life.range(...CAT_REST[c.personality]);
          if (c.spots.length > 1) {
            c.spot = (c.spot + 1) % c.spots.length;
            c.target = c.spots[c.spot];
            c.state = 'walk';
            if (c.personality === 'sleepy') c.emote = 'none';
          }
        }
      }
      // A dog thundering past gets a look.
      for (const g of this.dogs) {
        if ((g.state === 'fetch' || g.state === 'return') && dist(g, c) < 46 && c.emote !== 'alarm') {
          c.emote = 'alarm';
          c.emoteT = 0;
          c.faceX = g.x >= c.x ? -1 : 1;
        }
      }
    }
  }

  private stepCat(c: HubCat, target: Vec, speed: number, dt: number): void {
    const dx = target.x - c.x;
    const dy = target.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const s = Math.min(d, speed * dt);
    const pos = { x: c.x + (dx / d) * s, y: c.y + (dy / d) * s };
    this.shared.world.resolve(pos, 8);
    if (Math.hypot(pos.x - c.x, pos.y - c.y) < s * 0.2) {
      // Wedged against something: hop straight to the destination (cats do that).
      pos.x = c.x + (dx / d) * s;
      pos.y = c.y + (dy / d) * s;
    }
    c.x = pos.x;
    c.y = pos.y;
    c.faceX = dx > 0 ? 1 : -1;
    c.phase += dt * 12;
  }

  /* --- Missions, secrets ----------------------------------------------------------------- */

  private updateMission(dt: number): void {
    const m = this.mission;
    if (!m) return;
    if (m.kind === 'rounds') {
      m.t += dt;
      if (m.holding) {
        const t = ROUNDS_TASKS.find((x) => x.id === m.holding!.task)!;
        if (dist(this.player, t) > 70) m.holding = null;
        else {
          m.holding.t += dt;
          if (m.holding.t >= 0.9) {
            m.done.add(t.id);
            m.holding = null;
            const left = ROUNDS_TASKS.length - m.done.size;
            this.emit({ type: 'task', id: t.id, text: t.done, x: t.x, y: t.y, left });
            if (left === 0) {
              const [s3, s2] = ROUNDS_STAR_TIMES;
              const stars = m.t <= s3 ? 3 : m.t <= s2 ? 2 : 1;
              this.emit({ type: 'roundsDone', seconds: m.t, stars });
            }
          }
        }
      }
    } else if (m.kind === 'hunt') {
      m.hintT = Math.max(0, m.hintT - dt);
    }
  }

  private pickUpHuntItem(): void {
    const m = this.mission;
    if (!m || m.kind !== 'hunt' || m.ready) return;
    const item = HUNT_ITEMS[m.step];
    this.huntFound.add(item.id);
    m.step++;
    m.hintT = 0;
    const left = HUNT_ITEMS.length - m.step;
    this.emit({ type: 'huntItem', id: item.id, text: item.found, x: item.x, y: item.y, left });
    if (left === 0) {
      m.ready = true;
      this.emit({ type: 'huntReady' });
    }
  }

  private checkFinds(dt: number): void {
    const p = this.player;
    for (const o of ORNAMENTS) {
      if (this.ornaments.has(o.id)) continue;
      if (dist(p, o) < 36) {
        this.ornaments.add(o.id);
        this.emit({ type: 'ornament', id: o.id, x: o.x, y: o.y, count: this.ornaments.size });
      }
    }
    for (const d of this.map.discoveries) {
      if (this.discovered.has(d.id)) continue;
      if (dist(p, d) < d.r) {
        this.discovered.add(d.id);
        this.emit({ type: 'discover', id: d.id, title: d.title, text: d.text });
      }
    }
    this.barkT -= dt;
    if (this.barkT <= 0) {
      this.barkT = 9 + this.rng.range(0, 12);
      const d = this.dogs[Math.floor(this.rng.next() * this.dogs.length)];
      if (dist(d, p) < 400) this.emit({ type: 'bark', x: d.x, y: d.y });
    }
  }
}
