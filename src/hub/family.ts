import { ACTIVITIES } from '../content/activities';
import type { FamilyId } from '../content/cast';
import { angleDiff, dist, Rng, type Vec } from '../core/math';
import type { CollisionWorld } from '../world/collision';

/**
 * What the family gets up to around the homestead while you explore: each person has a few
 * places they like to spend time, a small bit of business at each, and a couple of outings
 * (Megan on the mower, Jay and Jason practising Jay's sports). Anyone you walk up to stops
 * and turns to talk, and their prompt goes wherever they are.
 */

export type NpcHold = 'basket' | 'axe' | 'rake' | 'putter' | null;
export type Gesture = 'toss' | 'swing' | 'point' | 'look' | 'wave' | 'rake' | 'putt' | 'throw' | 'catch';

export interface NpcStop {
  id: string;
  /** Where they stand. */
  at: Vec;
  hold: NpcHold;
  gesture: Gesture;
  /** Seconds the gesture lasts. */
  gestureT: number;
  /** Seconds between gestures. */
  gap: [number, number];
  /** Which way they face for the gesture (0 keeps whatever way they're facing). */
  face: number;
  /** How far they wander around the spot (0 stays put). */
  roam: number;
  /** How long they stay before moving on (only matters for people with more than one spot). */
  stay: [number, number];
}

export interface Npc {
  who: FamilyId;
  x: number;
  y: number;
  px: number;
  py: number;
  /** Their activity station: where they wait by default. */
  home: Vec;
  faceX: number;
  waveT: number;
  near: boolean;
  /** Where they're walking to, if anywhere. */
  target: Vec | null;
  path: Vec[] | null;
  pathT: number;
  /** Seconds until the next bit of business. */
  idleT: number;
  /** Seconds left on the current gesture. */
  busyT: number;
  gesture: Gesture | null;
  gestureT: number;
  /** Seconds left celebrating after you played their game. */
  cheerT: number;
  walkPhase: number;
  /** The place they're spending time right now. */
  stop: NpcStop;
  stayT: number;
  hold: NpcHold;
  /** Stopped to talk to you. */
  attending: boolean;
  /** On an outing that moves them about (see FamilyLife). */
  outing: 'mow' | 'sport' | 'moto' | 'race' | null;
}

const station = (who: FamilyId): Vec => ({ ...ACTIVITIES.find((a) => a.who === who)!.station });

/** Grandpa's putting green in his fenced back yard, and where he stands to putt. */
export const PUTTING_GREEN = { x: 1952, y: 738 };
const PUTT_FROM = { x: 1892, y: 744 };

export const NPC_ROUTINES: Record<FamilyId, NpcStop[]> = {
  // Scattering feed for the chickens beside her.
  megan: [{ id: 'coop', at: station('megan'), hold: 'basket', gesture: 'toss', gestureT: 0.6, gap: [3, 6], face: -1, roam: 44, stay: [20, 40] }],
  // A practice swing or two at the woodpile.
  jason: [{ id: 'woodpile', at: station('jason'), hold: 'axe', gesture: 'swing', gestureT: 1.4, gap: [4, 7], face: 0, roam: 0, stay: [20, 40] }],
  // Walking a lap around his mower.
  jay: [{ id: 'mower', at: station('jay'), hold: null, gesture: 'look', gestureT: 1.2, gap: [3, 7], face: 0, roam: 40, stay: [20, 40] }],
  // Keeping an eye on the arena for loose cats.
  natalie: [{ id: 'arena', at: station('natalie'), hold: null, gesture: 'point', gestureT: 1.1, gap: [3, 6], face: 0, roam: 46, stay: [20, 40] }],
  grandpa: [
    // On his back porch, waving at the trucks on Buffalo Gap Rd.
    { id: 'porch', at: station('grandpa'), hold: null, gesture: 'wave', gestureT: 1.6, gap: [6, 11], face: 1, roam: 0, stay: [14, 26] },
    // Raking the front yard, along the walk to his front door.
    { id: 'frontYard', at: { x: 1565, y: 372 }, hold: 'rake', gesture: 'rake', gestureT: 2.4, gap: [1.5, 3.5], face: 0, roam: 50, stay: [18, 30] },
    // Practising his putting on the green out back.
    { id: 'putting', at: PUTT_FROM, hold: 'putter', gesture: 'putt', gestureT: 1.2, gap: [2.5, 4.5], face: 1, roam: 0, stay: [20, 34] },
  ],
};

/** Within this distance family members stop what they're doing and turn to you. */
export const NPC_ATTEND = 150;

/* --- Megan on the mower ------------------------------------------------------------------- */

/** Where Jay's mower sits when nobody's on it (beside his spot, nose toward the lawn). */
export const MOWER_PARKED = { x: station('jay').x + 52, y: station('jay').y + 8, heading: -0.3 };
/** A lap of the north lawn, round the big tree. */
export const MOW_LAP: Vec[] = [
  { x: 1150, y: 528 },
  { x: 990, y: 452 },
  { x: 932, y: 300 },
  { x: 990, y: 172 },
  { x: 1200, y: 150 },
  { x: 1420, y: 168 },
  { x: 1400, y: 330 },
  { x: 1300, y: 470 },
];

export interface MowRide {
  phase: 'walk' | 'ride' | 'park';
  x: number;
  y: number;
  heading: number;
  wp: number;
  laps: number;
}

/* --- Jay and Jason, practising Jay's sports ---------------------------------------------- */

export type Sport = 'football' | 'baseball' | 'soccer';
export const SPORTS: Sport[] = ['football', 'baseball', 'soccer'];
/** Where they line up in the side yard, east of the main house. */
export const SPORT_SPOTS: Record<'jay' | 'jason', Vec> = { jay: { x: 1250, y: 1085 }, jason: { x: 1450, y: 1130 } };

export interface SportSession {
  sport: Sport;
  phase: 'gather' | 'play';
  t: number;
  /** How long they'll keep at it once they're both there. */
  len: number;
  holder: 'jay' | 'jason';
  holdT: number;
  /** Ball in the air (or rolling): progress 0..1 over `flight` seconds. */
  flying: { from: Vec; to: Vec; t: number; flight: number } | null;
}

/* --- Jason and Natalie on Jason's motorcycle ----------------------------------------------- */

/** Where the motorcycle lives, nose east, just south of Jason's truck. */
export const MOTO_PARKED = { x: 548, y: 874 };
/**
 * A ride along the property's roads: down the access road to the barns and back, then a lap
 * of the driveway loop and the north drive, and home.
 */
export const MOTO_ROUTE: Vec[] = [
  { x: 430, y: 770 },
  { x: 350, y: 840 },
  { x: 300, y: 1000 },
  { x: 290, y: 1200 },
  { x: 330, y: 1380 },
  { x: 460, y: 1530 },
  { x: 640, y: 1690 },
  { x: 840, y: 1870 },
  { x: 1020, y: 2030 },
  { x: 1200, y: 2180 },
  { x: 1380, y: 2265 },
  { x: 1600, y: 2272 },
  { x: 1880, y: 2280 },
  { x: 1600, y: 2272 },
  { x: 1380, y: 2265 },
  { x: 1200, y: 2180 },
  { x: 1020, y: 2030 },
  { x: 840, y: 1870 },
  { x: 640, y: 1690 },
  { x: 460, y: 1530 },
  { x: 330, y: 1380 },
  { x: 290, y: 1200 },
  { x: 300, y: 1000 },
  { x: 350, y: 840 },
  { x: 450, y: 700 },
  { x: 600, y: 600 },
  { x: 760, y: 560 },
  { x: 900, y: 500 },
  { x: 1020, y: 590 },
  { x: 1160, y: 625 },
  { x: 1300, y: 570 },
  { x: 1440, y: 400 },
  { x: 1540, y: 220 },
  { x: 1590, y: 100 },
  { x: 1400, y: 92 },
  { x: 1100, y: 87 },
  { x: 830, y: 95 },
  { x: 845, y: 330 },
  { x: 900, y: 480 },
  { x: 760, y: 560 },
  { x: 600, y: 600 },
  { x: 450, y: 700 },
  { x: 430, y: 770 },
];

export type MotoSeat = 'driver' | 'passenger';
export const MOTO_RIDERS: Record<MotoSeat, FamilyId> = { driver: 'jason', passenger: 'natalie' };

export interface MotoRide {
  phase: 'gather' | 'ride' | 'park';
  x: number;
  y: number;
  faceX: number;
  wp: number;
  /** Seat the explorer is in, if they came along. */
  player: MotoSeat | null;
  t: number;
}

/* --- Grandpa's putts ----------------------------------------------------------------------- */

export interface Putt {
  from: Vec;
  to: Vec;
  t: number;
  roll: number;
  sinks: boolean;
}

type Mover = (a: Npc, target: Vec, speed: number, dt: number) => void;

export class FamilyLife {
  mow: MowRide | null = null;
  sport: SportSession | null = null;
  putt: Putt | null = null;
  moto: MotoRide | null = null;
  /** Seconds until Jason and Natalie next head out on the motorcycle (by themselves). */
  motoT: number;
  /** Seconds until Jay and Jason next head out to practise. */
  sportT: number;
  private sportN = 0;

  constructor(
    private readonly world: CollisionWorld,
    private readonly move: Mover,
    private readonly rng: Rng,
  ) {
    this.sportT = rng.range(20, 40);
    this.motoT = rng.range(60, 110);
  }

  create(who: FamilyId): Npc {
    const stop = NPC_ROUTINES[who][0];
    const { x, y } = stop.at;
    return {
      who,
      x,
      y,
      px: x,
      py: y,
      home: station(who),
      faceX: -1,
      waveT: 0,
      near: false,
      target: null,
      path: null,
      pathT: 0,
      idleT: this.rng.range(1, 4),
      busyT: 0,
      gesture: null,
      gestureT: 1,
      cheerT: 0,
      walkPhase: 0,
      stop,
      stayT: this.rng.range(...stop.stay),
      hold: stop.hold,
      attending: false,
      outing: null,
    };
  }

  /** Everyone back to their own spot, outings called off (Sunday breakfast, switching explorer). */
  reset(npcs: Npc[], home: boolean): void {
    this.mow = null;
    this.sport = null;
    this.putt = null;
    this.moto = null;
    for (const n of npcs) {
      n.outing = null;
      n.target = null;
      n.path = null;
      n.busyT = 0;
      n.stop = NPC_ROUTINES[n.who][0];
      n.hold = n.stop.hold;
      n.stayT = this.rng.range(...n.stop.stay);
      if (home) {
        n.x = n.px = n.stop.at.x;
        n.y = n.py = n.stop.at.y;
      }
    }
  }

  update(npcs: Npc[], player: Vec & { vx: number; vy: number }, dt: number, gathered: boolean): void {
    // On the back of the motorcycle, nobody needs to stop and chat.
    const riding = !!this.moto?.player;
    const by = (w: FamilyId) => npcs.find((n) => n.who === w);
    for (const n of npcs) {
      n.px = n.x;
      n.py = n.y;
      const d = dist(n, player);
      const near = d < 170;
      if (near && !n.near && n.outing !== 'race') n.waveT = 1.4;
      n.near = near;
      n.waveT = Math.max(0, n.waveT - dt);
      n.cheerT = Math.max(0, n.cheerT - dt);
      n.busyT = Math.max(0, n.busyT - dt);
      if (gathered) continue;
      n.attending = d < NPC_ATTEND && !riding;
      if (n.attending) {
        // Drop everything to talk (a putt already rolling finishes on its own).
        if (n.gesture !== 'throw' && n.gesture !== 'catch') n.busyT = 0;
        if (!(n.outing === 'mow' && this.mow?.phase !== 'walk')) n.faceX = player.x >= n.x ? 1 : -1;
        continue;
      }
      if (n.outing === 'mow') this.updateMow(n, dt);
      else if (!n.outing) this.updateRoutine(n, dt);
    }
    if (!gathered) this.updateMoto(npcs, dt);
    this.updatePutt(dt, by('grandpa'));
    const jay = by('jay');
    const jason = by('jason');
    if (!gathered && jay && jason) this.updateSport(jay, jason, dt);
  }

  /* --- Everyday routine ------------------------------------------------------------------ */

  private updateRoutine(n: Npc, dt: number): void {
    if (n.target) {
      this.walk(n, n.target, dt);
      return;
    }
    const s = n.stop;
    n.stayT -= dt;
    if (n.stayT <= 0 && n.busyT <= 0) {
      this.nextStop(n);
      return;
    }
    n.idleT -= dt;
    if (n.idleT > 0 || n.busyT > 0) return;
    n.idleT = this.rng.range(s.gap[0], s.gap[1]);
    if (s.roam > 0 && this.rng.next() < 0.45) {
      n.target = this.strollSpot(n, s);
      return;
    }
    this.startGesture(n, s.gesture, s.gestureT);
    if (s.gesture === 'look') n.faceX = -n.faceX;
    else if (s.face) n.faceX = s.face;
    if (s.gesture === 'putt') this.startPutt(n);
  }

  private startGesture(n: Npc, g: Gesture, t: number): void {
    n.gesture = g;
    n.gestureT = t;
    n.busyT = t;
  }

  private walk(n: Npc, target: Vec, dt: number, speed?: number): boolean {
    const far = dist(n, target);
    if (far < 2) {
      n.x = target.x;
      n.y = target.y;
      n.target = null;
      n.path = null;
      return true;
    }
    const fromX = n.x;
    const fromY = n.y;
    this.move(n, target, speed ?? (far > 140 ? 64 : 34), dt);
    const moved = Math.hypot(n.x - fromX, n.y - fromY);
    if (Math.abs(n.x - fromX) > 0.3) n.faceX = n.x > fromX ? 1 : -1;
    n.walkPhase += dt * (2 + (moved / Math.max(dt, 1e-6) / 260) * 9);
    return false;
  }

  private nextStop(n: Npc): void {
    const stops = NPC_ROUTINES[n.who];
    const home = stops[0];
    // Megan takes the mower out now and then.
    if (n.who === 'megan' && n.stop === home && !this.mow && this.rng.next() < 0.4) {
      n.outing = 'mow';
      this.mow = { phase: 'walk', x: MOWER_PARKED.x, y: MOWER_PARKED.y, heading: MOWER_PARKED.heading, wp: 0, laps: 0 };
      n.hold = null;
      return;
    }
    let next = n.stop;
    if (stops.length > 1) {
      const others = stops.filter((s) => s !== n.stop);
      next = others[Math.floor(this.rng.next() * others.length)];
    }
    n.stop = next;
    n.hold = next.hold;
    n.stayT = this.rng.range(...next.stay);
    n.idleT = this.rng.range(1, 2.5);
    if (dist(n, next.at) > 2) n.target = { ...next.at };
  }

  /** A nearby open spot to amble to (or the spot itself, if nothing nearby is clear). */
  private strollSpot(n: Npc, s: NpcStop): Vec {
    for (let i = 0; i < 4; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(s.roam * 0.4, s.roam);
      const q = { x: s.at.x + Math.cos(a) * r, y: s.at.y + Math.sin(a) * r * 0.7 };
      if (this.world.isFree(q.x, q.y, 10) && this.world.clearPath(n.x, n.y, q.x, q.y, 10)) return q;
    }
    return { ...s.at };
  }

  /* --- Megan on the mower ---------------------------------------------------------------- */

  private updateMow(n: Npc, dt: number): void {
    const m = this.mow;
    if (!m) {
      n.outing = null;
      return;
    }
    if (m.phase === 'walk') {
      if (this.walk(n, MOWER_PARKED, dt, 64)) m.phase = 'ride';
      return;
    }
    const goal = m.phase === 'ride' ? MOW_LAP[m.wp] : MOWER_PARKED;
    const dx = goal.x - m.x;
    const dy = goal.y - m.y;
    const d = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    const turn = angleDiff(m.heading, want);
    m.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, turn));
    const speed = 110 * Math.max(0.25, Math.cos(Math.min(Math.PI / 2, Math.abs(turn))));
    const step = Math.min(d, speed * dt);
    m.x += Math.cos(m.heading) * step;
    m.y += Math.sin(m.heading) * step;
    n.x = m.x;
    n.y = m.y;
    n.faceX = Math.cos(m.heading) >= 0 ? 1 : -1;
    if (d < 16) {
      if (m.phase === 'park') {
        // Park it the way Jay likes it, hop off, back to the chickens.
        this.mow = null;
        n.outing = null;
        n.x = n.px = MOWER_PARKED.x - 34;
        n.y = n.py = MOWER_PARKED.y + 14;
        n.stop = NPC_ROUTINES.megan[0];
        n.hold = n.stop.hold;
        n.stayT = this.rng.range(...n.stop.stay);
        n.target = { ...n.stop.at };
        return;
      }
      m.wp = (m.wp + 1) % MOW_LAP.length;
      if (m.wp === 0 && ++m.laps >= 2) m.phase = 'park';
    }
  }

  /* --- Jay and Jason ---------------------------------------------------------------------- */

  private updateSport(jay: Npc, jason: Npc, dt: number): void {
    let s = this.sport;
    if (!s) {
      this.sportT -= dt;
      const free = (n: Npc) => !n.outing && !n.attending && n.busyT <= 0;
      if (this.sportT > 0 || !free(jay) || !free(jason)) return;
      s = this.sport = {
        sport: SPORTS[this.sportN++ % SPORTS.length],
        phase: 'gather',
        t: 0,
        len: this.rng.range(22, 34),
        holder: 'jay',
        holdT: 1,
        flying: null,
      };
      for (const n of [jay, jason]) {
        n.outing = 'sport';
        n.hold = null;
        n.target = null;
        n.path = null;
      }
    }
    // Talking to either one puts the game on hold.
    if (jay.attending || jason.attending) return;
    const pair = { jay, jason };
    if (s.phase === 'gather') {
      const a = this.walk(jay, SPORT_SPOTS.jay, dt, 70) || dist(jay, SPORT_SPOTS.jay) < 2;
      const b = this.walk(jason, SPORT_SPOTS.jason, dt, 70) || dist(jason, SPORT_SPOTS.jason) < 2;
      if (a && b) {
        s.phase = 'play';
        s.holder = 'jay';
        s.holdT = 0.8;
      }
      return;
    }
    s.t += dt;
    jay.faceX = jason.x >= jay.x ? 1 : -1;
    jason.faceX = jay.x >= jason.x ? 1 : -1;
    if (s.flying) {
      s.flying.t += dt / s.flying.flight;
      if (s.flying.t >= 1) {
        s.flying = null;
        s.holder = s.holder === 'jay' ? 'jason' : 'jay';
        s.holdT = this.rng.range(0.7, 1.3);
        const catcher = pair[s.holder];
        if (s.sport !== 'soccer') this.startGesture(catcher, 'catch', 0.45);
      }
      return;
    }
    s.holdT -= dt;
    if (s.holdT > 0) return;
    if (s.t > s.len) {
      this.endSport(jay, jason);
      return;
    }
    const thrower = pair[s.holder];
    const catcher = pair[s.holder === 'jay' ? 'jason' : 'jay'];
    const flight = s.sport === 'football' ? 1.0 : s.sport === 'baseball' ? 0.7 : 1.1;
    s.flying = { from: { x: thrower.x, y: thrower.y }, to: { x: catcher.x, y: catcher.y }, t: 0, flight };
    if (s.sport !== 'soccer') this.startGesture(thrower, 'throw', 0.5);
  }

  private endSport(jay: Npc, jason: Npc): void {
    this.sport = null;
    this.sportT = this.rng.range(45, 80);
    for (const n of [jay, jason]) {
      n.outing = null;
      n.stop = NPC_ROUTINES[n.who][0];
      n.hold = n.stop.hold;
      n.stayT = this.rng.range(...n.stop.stay);
      n.target = { ...n.stop.at };
    }
  }

  /* --- Jason and Natalie on the motorcycle ------------------------------------------------- */

  /**
   * Head out on the motorcycle. `player` is the seat the explorer takes (they're standing at
   * the bike); otherwise both riders are family members and walk over first.
   */
  startMoto(npcs: Npc[], player: MotoSeat | null): boolean {
    if (this.moto) return false;
    const riders = (Object.keys(MOTO_RIDERS) as MotoSeat[]).filter((s) => s !== player).map((s) => npcs.find((n) => n.who === MOTO_RIDERS[s]));
    if (riders.some((n) => !n || n.outing)) return false;
    for (const n of riders as Npc[]) {
      n.outing = 'moto';
      n.hold = null;
      n.target = null;
      n.path = null;
      n.busyT = 0;
    }
    this.moto = { phase: 'gather', x: MOTO_PARKED.x, y: MOTO_PARKED.y, faceX: 1, wp: 0, player, t: 0 };
    return true;
  }

  /** The explorer hops off wherever the bike is; the family member rides it home. */
  hopOff(npcs: Npc[]): Vec | null {
    const m = this.moto;
    if (!m?.player) return null;
    const at = { x: m.x, y: m.y + 26 };
    if (m.player === 'driver') {
      // Nobody left to ride it back: it's parked where Jason keeps it, and Natalie walks home.
      this.endMoto(npcs, true);
    } else {
      m.player = null;
      if (m.phase === 'ride') m.phase = 'park';
    }
    return at;
  }

  private riderSpot(seat: MotoSeat): Vec {
    return { x: MOTO_PARKED.x + (seat === 'driver' ? 4 : -12), y: MOTO_PARKED.y + 2 };
  }

  private updateMoto(npcs: Npc[], dt: number): void {
    const riders = npcs.filter((n) => n.outing === 'moto');
    if (!this.moto) {
      const jason = npcs.find((n) => n.who === MOTO_RIDERS.driver);
      const nat = npcs.find((n) => n.who === MOTO_RIDERS.passenger);
      if (!jason || !nat) return;
      this.motoT -= dt;
      const free = (n: Npc) => !n.outing && !n.attending && n.busyT <= 0;
      if (this.motoT <= 0 && free(jason) && free(nat)) this.startMoto(npcs, null);
      return;
    }
    const m = this.moto;
    m.t += dt;
    if (m.phase === 'gather') {
      let all = true;
      for (const n of riders) {
        const seat: MotoSeat = n.who === MOTO_RIDERS.driver ? 'driver' : 'passenger';
        if (!(this.walk(n, this.riderSpot(seat), dt, 70) || dist(n, this.riderSpot(seat)) < 2)) all = false;
      }
      if (all) m.phase = 'ride';
      return;
    }
    // Walking up to them while they ride by pauses the ride for a chat.
    if (!m.player && riders.some((n) => n.attending)) return;
    const goal = m.phase === 'ride' ? MOTO_ROUTE[m.wp] : MOTO_PARKED;
    const dx = goal.x - m.x;
    const dy = goal.y - m.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d, (m.phase === 'park' ? 90 : 175) * dt);
    if (d > 0.01) {
      m.x += (dx / d) * step;
      m.y += (dy / d) * step;
      if (Math.abs(dx) > 1) m.faceX = dx > 0 ? 1 : -1;
    }
    for (const n of riders) {
      n.x = m.x;
      n.y = m.y;
      n.faceX = m.faceX;
    }
    if (d < 6) {
      if (m.phase === 'park') this.endMoto(npcs, false);
      else if (++m.wp >= MOTO_ROUTE.length) m.phase = 'park';
    }
  }

  private endMoto(npcs: Npc[], instant: boolean): void {
    this.moto = null;
    this.motoT = this.rng.range(90, 150);
    for (const n of npcs) {
      if (n.outing !== 'moto') continue;
      n.outing = null;
      if (instant) {
        n.x = n.px = MOTO_PARKED.x - 20;
        n.y = n.py = MOTO_PARKED.y + 24;
      } else {
        n.x = n.px = MOTO_PARKED.x + (n.who === MOTO_RIDERS.driver ? 10 : -26);
        n.y = n.py = MOTO_PARKED.y + 22;
      }
      n.stop = NPC_ROUTINES[n.who][0];
      n.hold = n.stop.hold;
      n.stayT = this.rng.range(...n.stop.stay);
      n.target = { ...n.stop.at };
    }
  }

  /** Where the explorer gets off at the end of a ride they came along on. */
  motoDropOff(): Vec {
    return { x: MOTO_PARKED.x - 10, y: MOTO_PARKED.y + 34 };
  }

  /** Where the ball is (world point, and height above the ground), for drawing. */
  sportBall(npcs: Npc[]): { x: number; y: number; lift: number; sport: Sport } | null {
    const s = this.sport;
    if (!s || s.phase !== 'play') return null;
    if (s.flying) {
      const f = s.flying;
      const k = s.sport === 'soccer' ? 1 - (1 - f.t) * (1 - f.t) : f.t;
      const x = f.from.x + (f.to.x - f.from.x) * k;
      const y = f.from.y + (f.to.y - f.from.y) * k;
      const lift = s.sport === 'soccer' ? 0 : 32 + Math.sin(f.t * Math.PI) * (s.sport === 'football' ? 46 : 30);
      return { x, y, lift, sport: s.sport };
    }
    const h = npcs.find((n) => n.who === s.holder);
    if (!h) return null;
    if (s.sport === 'soccer') return { x: h.x + h.faceX * 12, y: h.y + 2, lift: 0, sport: s.sport };
    return { x: h.x + h.faceX * 9, y: h.y + 1, lift: 32, sport: s.sport };
  }

  /* --- Grandpa's putting ------------------------------------------------------------------ */

  private startPutt(n: Npc): void {
    const sinks = this.rng.next() < 0.45;
    const miss = sinks ? 0 : this.rng.range(8, 16) * (this.rng.next() < 0.5 ? -1 : 1);
    this.putt = {
      from: { x: n.x + 14, y: n.y + 1 },
      to: { x: PUTTING_GREEN.x + (sinks ? 0 : miss), y: PUTTING_GREEN.y + (sinks ? 0 : miss * 0.3) },
      t: -0.45,
      roll: 1.5,
      sinks,
    };
  }

  private updatePutt(dt: number, grandpa: Npc | undefined): void {
    const p = this.putt;
    if (!p) return;
    p.t += dt;
    if (p.t >= p.roll + 0.8) {
      this.putt = null;
      return;
    }
    // Drops in: a small fist pump.
    if (p.sinks && grandpa && p.t >= p.roll && p.t - dt < p.roll && grandpa.stop.id === 'putting' && !grandpa.attending) grandpa.cheerT = 0.9;
  }

  /** The golf ball, while a putt is rolling or sitting where it stopped. */
  puttBall(): { x: number; y: number; alpha: number } | null {
    const p = this.putt;
    if (!p) return null;
    const k = Math.max(0, Math.min(1, p.t / p.roll));
    const e = 1 - (1 - k) * (1 - k);
    if (p.sinks && k >= 1) return null;
    const alpha = p.t > p.roll ? Math.max(0, 1 - (p.t - p.roll) / 0.8) : 1;
    return { x: p.from.x + (p.to.x - p.from.x) * e, y: p.from.y + (p.to.y - p.from.y) * e, alpha };
  }
}
