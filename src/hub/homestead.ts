import { ACTIVITIES, type Activity } from '../content/activities';
import { raceRivalFor, RIDES, type RideId } from '../content/rides';
import { CHIHUAHUAS, DOGS, DONKEYS, FAMILY, FAMILY_ORDER, type DogDef, type DonkeyDef, type FamilyId } from '../content/cast';
import { dist, fromAngle, Rng, type Vec } from '../core/math';
import { COATS } from '../games/kitten/levels';
import { PERSONALITIES, type Coat, type Personality } from '../games/kitten/kittenTypes';
import { createPlayer, updatePlayer } from '../games/kitten/player';
import type { Emote, InputState, Player } from '../games/kitten/types';
import type { PenDef } from '../world/mapTypes';
import type { SharedWorld } from '../world/shared';
import { FamilyLife, MOTO_PARKED, MOTO_RIDERS, NPC_ROUTINES, type MotoSeat, type Npc } from './family';
import { createCritters, updateCritters, type Critter } from './critters';
import { HUNT_ITEMS, ORNAMENTS, PUDDLES, RACE_COURSE, RACE_GATE_R, RACE_START, RAMPS, ROUNDS_STAR_TIMES, ROUNDS_TASKS } from './missions';

/* ---------------------------------------------------------------------------------------- */
/* Actors                                                                                     */
/* ---------------------------------------------------------------------------------------- */

export { NPC_ATTEND, NPC_ROUTINES, type Npc } from './family';

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
  state: 'follow' | 'fetch' | 'return' | 'rest' | 'sniff' | 'chase' | 'skunk' | 'cat' | 'treed';
  /** The cat it's after (state 'cat'), and seconds left barking up the tree ('treed'). */
  chaseCat: string | null;
  treedT: number;
  /** Seconds left smelling of skunk. */
  stinkT: number;
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

/** Somewhere a cat likes to be: a spot on the ground, or up high (`lift`) above it. */
export interface CatSpot {
  x: number;
  y: number;
  lift?: number;
}

/** The trampoline's mat (an ellipse on the ground) and how high the mat sits. */
export const TRAMPOLINE = { x: 810, y: 1000, rx: 38, ry: 18, mat: 14 };

/** Seconds a big trampoline jump lasts. */
const BIG_JUMP = 0.95;
/** Seconds in the air off a ramp. */
export const AIR_TIME = 0.62;
/** How much quicker you go on a road or path. */
export const PATH_BOOST = 1.15;

/** Up on the treehouse platform: the ground point under it, and how high up. */
export const TREEHOUSE_PERCHES: CatSpot[] = [
  { x: 1124, y: 966, lift: 82 },
  { x: 1202, y: 966, lift: 76 },
];
/** The main house roof, above the front porch. */
export const ROOF_PERCH: CatSpot = { x: 880, y: 912, lift: 206 };
/** How fast cats go up and down (units per second). */
const CLIMB = 120;

export interface HubCat {
  id: string;
  /** Matches the cat's id in Kitten Cowgirl (and in saved names). */
  nameId: string;
  name: string;
  personality: Personality;
  coat: Coat;
  x: number;
  y: number;
  px: number;
  py: number;
  spots: CatSpot[];
  spot: number;
  faceX: number;
  phase: number;
  state: 'rest' | 'walk' | 'follow' | 'chase' | 'flee';
  target: CatSpot | null;
  /** How high up it is right now (treehouse platform, the roof). */
  lift: number;
  /** Resting up the treehouse after a dog chased it there. */
  refuge: boolean;
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

/** A harmless little garter snake, out in Grandpa's grass. Grandpa disagrees about "harmless". */
export interface Snake {
  x: number;
  y: number;
  px: number;
  py: number;
  /** Unit heading. */
  dx: number;
  dy: number;
  speed: number;
  t: number;
  phase: number;
  /** Axle's after it: off it goes, quick. */
  fleeing: boolean;
  scared: boolean;
}

/** A skunk out for a stroll. Annie never learns. */
export interface Skunk {
  x: number;
  y: number;
  px: number;
  py: number;
  faceX: number;
  phase: number;
  state: 'waddle' | 'spray' | 'leave';
  /** Seconds in the current state. */
  t: number;
  dx: number;
  dy: number;
  /** Seconds since it sprayed (for the cloud), or -1. */
  cloudT: number;
}

/** One of Grandpa's chihuahuas. */
export interface HubPup {
  def: DogDef;
  name: string;
  x: number;
  y: number;
  px: number;
  py: number;
  faceX: number;
  phase: number;
  state: 'trot' | 'sit' | 'inside' | 'guard';
  target: Vec | null;
  t: number;
  /** Seconds left on a "yip!" bubble. */
  yipT: number;
  /** Seconds until the next yip while guarding. */
  yapT: number;
  heartT: number;
}

/** Inside Grandpa's picket fence, behind his house: as far as the chihuahuas ever go. */
export const BACK_YARD = { x0: 1384, x1: 2004, y0: 694, y1: 778 };
/** Just outside the doggie door in his back wall. */
export const DOGGIE_DOOR = { x: 1540, y: 688 };

export type HubAction =
  | { kind: 'ball'; label: string }
  | { kind: 'pet'; label: string; cat: HubCat }
  | { kind: 'pup'; label: string; pup: HubPup }
  | { kind: 'carrot'; label: string }
  | { kind: 'task'; label: string; task: string }
  | { kind: 'pickup'; label: string; item: string }
  | { kind: 'sunday'; label: string }
  | { kind: 'workshop'; label: string }
  | { kind: 'moto'; label: string }
  | { kind: 'jump'; label: string };

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
  | { type: 'sunday' }
  | { type: 'workshop' }
  | { type: 'moto'; partner: string; ride: boolean }
  | { type: 'raceGo' }
  | { type: 'snake'; x: number; y: number; chased: boolean }
  | { type: 'skunk'; x: number; y: number }
  | { type: 'catChase'; dog: string; cat: string; x: number; y: number }
  | { type: 'boing'; big: boolean }
  | { type: 'hop'; x: number; y: number; ride: RideId }
  | { type: 'splash'; x: number; y: number; big: boolean }
  | { type: 'flutter'; x: number; y: number }
  | { type: 'raceGate'; gate: number; x: number; y: number }
  | { type: 'raceRival'; name: string }
  | { type: 'raceDone'; ride: RideId; seconds: number; won: boolean; rival: string; rivalSeconds: number | null }
  | { type: 'yip'; x: number; y: number }
  | { type: 'pupPet'; name: string; text: string; x: number; y: number };

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

export interface RaceState {
  kind: 'race';
  /** Seconds since the start. */
  t: number;
  /** Seconds left on the "ready, set" before you can go. */
  countdown: number;
  /** Next gate in RACE_COURSE. */
  gate: number;
  /** What everyone's riding. */
  ride: RideId;
  rival: FamilyId;
  rivalGate: number;
  /** Seconds left of the rival's hop off a ramp. */
  rivalAir: number;
  /** When the rival crossed the line, if they have. */
  rivalDone: number | null;
}

export type Mission = RoundsState | HuntState | RaceState | null;

/** The long table under the Barn 89 string lights (see ranch.ts). */
export const LONG_TABLE = { x: 1670, y: 2890 };
/** The half-painted cabinet outside Grandpa's workshop, where the Blue Star workshop starts. */
export const WORKSHOP = { x: 1792, y: 696 };
/** Where people sit for Sunday breakfast: three behind the table, the rest in front. */
const TABLE_SEATS = [
  { x: 1612, y: 2850 },
  { x: 1662, y: 2850 },
  { x: 1712, y: 2850 },
  { x: 1618, y: 2942 },
];
const EXPLORER_SEAT = { x: 1708, y: 2942 };

// Most of the cats live in and around the treehouse; Ziggy likes the house roof.
const CAT_HOMES: { id: keyof typeof COATS; name: string; personality: Personality; spots: CatSpot[] }[] = [
  { id: 'marshmallow', name: 'Marshmallow', personality: 'sleepy', spots: [{ x: 1440, y: 2165 }, { x: 1380, y: 2190 }] },
  { id: 'tortie', name: 'Tater', personality: 'sleepy', spots: [TREEHOUSE_PERCHES[0], { x: 1100, y: 1012 }] },
  { id: 'calico', name: 'Pickles', personality: 'curious', spots: [{ x: 1452, y: 755 }, { x: 1560, y: 730 }] },
  { id: 'greyTabby', name: 'Ziggy', personality: 'distractible', spots: [{ x: 1060, y: 1052 }, ROOF_PERCH] },
  { id: 'orangeTabby', name: 'Biscuit', personality: 'hungry', spots: [{ x: 1640, y: 2785 }, { x: 1440, y: 2380 }] },
  { id: 'siamese', name: 'Mochi', personality: 'shy', spots: [TREEHOUSE_PERCHES[1], { x: 1218, y: 1012 }] },
  { id: 'tuxedo', name: 'Pepper', personality: 'shy', spots: [{ x: 500, y: 2165 }, { x: 640, y: 2230 }] },
  { id: 'waffles', name: 'Waffles', personality: 'hungry', spots: [{ x: 1235, y: 1185 }, { x: 1150, y: 1040 }] },
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
const SNIFF_AFTER: Record<string, number> = { axle: 8, annie: 18 };

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
  pups: HubPup[];
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
  /** At least one race on the Loop is open (someone's ride is unlocked). */
  raceOpen = false;
  /** What the explorer is riding right now, if anything (set by the app from the save and the race). */
  ride: RideId | null = null;
  /** Seconds left airborne off a ramp. */
  airT = 0;
  /** Top speed off the paths (walking, or the ride's); paths are a little quicker. */
  speedBase = 260;
  /** On a road or path right now. */
  onPath = false;
  /** Birds, rabbits and butterflies. */
  critters: Critter[] = createCritters();
  private splashT = 0;
  /** Road and path segments, for the "paths are quicker" check. */
  private pathSegs: { ax: number; ay: number; bx: number; by: number; r: number }[] = [];
  snake: Snake | null = null;
  /** Seconds until a snake might next turn up near Grandpa. */
  snakeT = 35;
  skunk: Skunk | null = null;
  /** Seconds until a skunk might next wander by. */
  skunkT = 70;
  /** Seconds until a dog might next go after a cat. */
  catChaseT = 30;
  /** Seconds bouncing on the trampoline, and what's left of a big jump. */
  trampT = 0;
  bigJumpT = 0;
  private events: HubEvent[] = [];
  private rng = new Rng(89);
  /** Separate stream for ambient behaviour so it never shifts the games' dice. */
  private life = new Rng(1989);
  /** What the family gets up to around the place. */
  readonly family: FamilyLife;
  private barkT = 3;
  /** A donkey already came over to the fence this visit. */
  private greeted = false;

  constructor(
    readonly shared: SharedWorld,
    opts: { explorer: FamilyId; ornaments: string[]; discoveries: string[]; huntFound: string[] },
  ) {
    this.map = shared.map;
    this.family = new FamilyLife(shared.world, (a, t, s, dt) => this.moveAgent(a, t, s, dt, 10), this.life);
    this.explorer = opts.explorer;
    this.ornaments = new Set(opts.ornaments);
    this.discovered = new Set(opts.discoveries);
    this.huntFound = new Set(opts.huntFound);
    this.pen = this.map.pens.find((p) => p.id === 'roundPen')!;
    for (const r of this.map.roads)
      for (let i = 0; i + 1 < r.points.length; i++) {
        const [ax, ay] = r.points[i];
        const [bx, by] = r.points[i + 1];
        this.pathSegs.push({ ax, ay, bx, by, r: r.width / 2 });
      }
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
      stinkT: 0,
      chaseCat: null,
      treedT: 0,
      path: null,
      pathT: 0,
    }));
    this.donkeys = DONKEYS.map((def, i) => {
      const p = this.penPoint(i * 3 + 1);
      return { def, x: p.x, y: p.y, px: p.x, py: p.y, faceX: i ? -1 : 1, phase: 0, target: p, state: 'graze', t: 2 + i * 2, brayT: 0 };
    });
    this.pups = CHIHUAHUAS.map((def, i) => ({
      def,
      name: def.name,
      x: 1700 + i * 60,
      y: 740,
      px: 1700 + i * 60,
      py: 740,
      faceX: i ? -1 : 1,
      phase: i,
      state: 'sit',
      target: null,
      t: 1 + i * 2,
      yipT: 0,
      yapT: 0,
      heartT: 0,
    }));
    this.cats = CAT_HOMES.map((c) => {
      const s = c.spots[0];
      return {
        id: c.id,
        nameId: c.name.toLowerCase(),
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
        lift: s.lift ?? 0,
        refuge: false,
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
    this.family.reset([], false);
    this.npcs = FAMILY_ORDER.filter((id) => id !== this.explorer).map((who) => this.family.create(who));
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
    this.snake = null;
    this.skunk = null;
    this.family.reset(this.npcs, !on);
    if (!on) {
      for (const d of this.dogs) d.state = 'follow';
      return;
    }
    this.npcs.forEach((n, i) => {
      const seat = TABLE_SEATS[i % TABLE_SEATS.length];
      n.x = n.px = seat.x;
      n.y = n.py = seat.y;
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
    // A rival heads home after the race.
    for (const n of this.npcs) {
      if (n.outing !== 'race') continue;
      n.outing = null;
      n.target = { ...n.stop.at };
      n.path = null;
    }
  }

  /** Line up at the start: you and your rival (whoever owns the ride, or a stand-in) on matching rides. */
  startRace(ride: RideId = 'scooter'): void {
    this.family.reset(this.npcs, false);
    const rival = raceRivalFor(RIDES[ride], this.explorer);
    this.mission = { kind: 'race', t: 0, countdown: 3, gate: 0, ride, rival, rivalGate: 0, rivalAir: 0, rivalDone: null };
    this.airT = 0;
    // Side by side on the line, staggered so the rides don't overlap.
    this.teleport(RACE_START.x - 34, RACE_START.y + 14);
    this.player.faceX = 1;
    const n = this.npcs.find((x) => x.who === rival);
    if (n) {
      n.outing = 'race';
      n.x = n.px = RACE_START.x + 34;
      n.y = n.py = RACE_START.y - 4;
      n.target = null;
      n.path = null;
      n.faceX = 1;
      n.busyT = 0;
    }
  }

  /** Who you're racing, as a family member on the homestead. */
  raceRival(): Npc | null {
    const m = this.mission;
    return m?.kind === 'race' ? (this.npcs.find((n) => n.who === m.rival) ?? null) : null;
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
    const wasRiding = !!this.family.moto?.player;
    // Held at the start line until "go".
    const held = this.mission?.kind === 'race' && this.mission.countdown > 0;
    // Paths and roads are a little quicker going (races keep everyone on even terms).
    this.onPath = this.isOnPath(p.x, p.y);
    if (this.mission?.kind !== 'race') p.maxSpeed = this.speedBase * (this.onPath ? PATH_BOOST : 1);
    if (!wasRiding && !held) updatePlayer(p, input, this.shared.world, dt);
    this.family.update(this.npcs, this.player, dt, this.gathered);
    const ride = this.family.moto;
    if (ride?.player) {
      // Along for the ride: sit tight on the seat.
      p.vx = (ride.x - p.x) / dt;
      p.vy = (ride.y - p.y) / dt;
      p.x = ride.x;
      p.y = ride.y;
      if (Math.abs(p.vx) > 1) p.faceX = p.vx > 0 ? 1 : -1;
      p.idleT = 0;
    } else if (wasRiding && !ride) {
      // Back home and parked: hop off beside the bike.
      const at = this.family.motoDropOff();
      this.teleport(at.x, at.y);
      this.emit({ type: 'moto', partner: '', ride: false });
    }
    this.updateBall(dt);
    for (const d of this.dogs) this.updateDog(d, dt);
    this.donkeysNotice();
    for (const d of this.donkeys) this.updateDonkey(d, dt);
    for (const c of this.cats) this.updateCat(c, dt);
    this.pups.forEach((d, i) => this.updatePup(d, i, dt));
    this.updateTrampoline(dt);
    this.updateRamps(dt);
    this.updatePuddles(dt);
    const scared = updateCritters(this.critters, [p, ...this.dogs], dt, this.life);
    if (scared && this.critters.some((c) => c.kind === 'bird' && c.state === 'flee' && dist(c, p) < 200)) this.emit({ type: 'flutter', x: p.x, y: p.y });
    this.updateSnake(dt);
    this.updateSkunk(dt);
    this.maybeChaseCat(dt);
    this.updateMission(dt);
    this.checkFinds(dt);
    this.nearStation = this.mission || this.family.moto?.player ? null : this.findStation();
    this.action = this.findAction();
    if (actionPressed && this.action) this.doAction(this.action);
  }

  /** Which seat on Jason's motorcycle the explorer takes, if they're one of the two who ride it. */
  private motoSeat(): MotoSeat | null {
    if (this.explorer === MOTO_RIDERS.driver) return 'driver';
    if (this.explorer === MOTO_RIDERS.passenger) return 'passenger';
    return null;
  }

  /** Where an activity is right now: with the person who runs it, wherever they've got to. */
  stationPos(a: Activity): Vec {
    const n = this.npcs.find((x) => x.who === a.who);
    return n && !a.fixed ? { x: n.x, y: n.y } : a.station;
  }

  private findStation(): Activity | null {
    const p = this.player;
    let best: Activity | null = null;
    let bd = 105;
    for (const a of ACTIVITIES) {
      if (a.id === 'race' && !this.raceOpen) continue;
      const d = dist(p, this.stationPos(a));
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
    // Racing: eyes on the track.
    if (m?.kind === 'race') return null;
    if (m?.kind === 'hunt' && !m.ready) {
      const item = HUNT_ITEMS[m.step];
      if (item && dist(p, item) < 46) return { kind: 'pickup', label: 'Pick up', item: item.id };
    }
    if (!m && dist(p, LONG_TABLE) < 95) return { kind: 'sunday', label: 'Sunday breakfast' };
    if (!m && dist(p, WORKSHOP) < 58) return { kind: 'workshop', label: this.explorer === 'grandpa' ? 'Into the workshop' : 'Paint with Grandpa' };
    if (this.onTrampoline) return { kind: 'jump', label: 'Jump!' };
    // Jason's motorcycle: Natalie and Jason ride it together.
    const moto = this.family.moto;
    if (moto?.player) return { kind: 'moto', label: 'Hop off' };
    const seat = this.motoSeat();
    if (!m && seat && !moto && dist(p, MOTO_PARKED) < 60) {
      const partner = this.npcs.find((n) => n.who === MOTO_RIDERS[seat === 'driver' ? 'passenger' : 'driver']);
      if (partner && !partner.outing) return { kind: 'moto', label: `Ride with ${FAMILY[partner.who].name}` };
    }
    let cat: HubCat | null = null;
    let cd = 70;
    for (const c of this.cats) {
      const d = dist(c, p);
      if (d < cd && c.state !== 'walk' && c.state !== 'flee' && c.lift === 0) {
        cd = d;
        cat = c;
      }
    }
    if (cat) return { kind: 'pet', label: `Pet ${cat.name}`, cat };
    const pup = this.pups.find((d) => d.state !== 'inside' && dist(d, p) < 44);
    if (pup) return { kind: 'pup', label: `Pet ${pup.name}`, pup };
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
      case 'pup': {
        const d = a.pup;
        const lines = ['{n} allows exactly one pet, then yaps about it.', '{n} trembles with joy. Or outrage. Hard to say.', '{n} sniffs your hand and approves. For now.'];
        const text = lines[Math.floor(this.life.next() * lines.length)].replace('{n}', d.name);
        d.state = 'sit';
        d.t = 2.5;
        d.heartT = 1.2;
        d.faceX = this.player.x >= d.x ? 1 : -1;
        this.emit({ type: 'pupPet', name: d.name, text, x: d.x, y: d.y });
        break;
      }
      case 'pickup':
        this.pickUpHuntItem();
        break;
      case 'moto': {
        if (this.family.moto?.player) {
          const at = this.family.hopOff(this.npcs);
          if (at) this.teleport(at.x, at.y);
          this.emit({ type: 'moto', partner: '', ride: false });
          break;
        }
        const seat = this.motoSeat();
        if (seat && this.family.startMoto(this.npcs, seat)) {
          const other = MOTO_RIDERS[seat === 'driver' ? 'passenger' : 'driver'];
          this.emit({ type: 'moto', partner: FAMILY[other].name, ride: true });
        }
        break;
      }
      case 'jump':
        if (this.bigJumpT <= 0) {
          this.bigJumpT = BIG_JUMP;
          this.emit({ type: 'boing', big: true });
        }
        break;
      case 'sunday':
        this.emit({ type: 'sunday' });
        break;
      case 'workshop':
        this.emit({ type: 'workshop' });
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
    d.stinkT = Math.max(0, d.stinkT - dt);
    if (d.state === 'cat') {
      // After a cat. The cat is faster, and knows where it's going.
      const c = this.cats.find((x) => x.id === d.chaseCat);
      d.treedT += dt;
      if (!c || c.state !== 'flee' || d.treedT > 12) {
        d.state = 'follow';
        d.chaseCat = null;
      } else if (c.lift > 0) {
        // Up the treehouse. Bark at it for a bit.
        d.state = 'treed';
        d.treedT = 3.2;
        this.emit({ type: 'bark', x: d.x, y: d.y });
      } else sp = this.moveAgent(d, c, 235, dt, 11);
      d.wag = 1;
    } else if (d.state === 'treed') {
      const c = this.cats.find((x) => x.id === d.chaseCat);
      d.treedT -= dt;
      if (c && dist(d, c) > 46) sp = this.moveAgent(d, c, 160, dt, 11);
      if (c) d.faceX = c.x >= d.x ? 1 : -1;
      if (d.treedT > 0 && Math.floor(d.treedT / 0.9) !== Math.floor((d.treedT + dt) / 0.9)) this.emit({ type: 'bark', x: d.x, y: d.y });
      if (d.treedT <= 0) {
        d.state = 'follow';
        d.chaseCat = null;
      }
      d.wag = 0.8;
    } else if (d.state === 'skunk') {
      // Annie has spotted a skunk. This will go the way it always goes.
      const k = this.skunk;
      if (!k || k.state !== 'waddle') d.state = 'follow';
      else {
        sp = this.moveAgent(d, k, 250, dt, 11);
        d.wag = 1;
        if (dist(d, k) < 30) {
          k.state = 'spray';
          k.t = 0;
          k.cloudT = 0;
          // Tail up, aimed squarely at Annie.
          k.faceX = d.x >= k.x ? -1 : 1;
          d.state = 'follow';
          d.stinkT = 30;
          d.wag = 0.3;
          this.emit({ type: 'skunk', x: k.x, y: k.y });
        }
      }
    } else if (d.state === 'chase') {
      // Axle has found another snake.
      const s = this.snake;
      if (!s) d.state = 'follow';
      else {
        sp = this.moveAgent(d, s, 300, dt, 11);
        d.wag = 1;
        if (dist(d, s) < 26 && !s.fleeing) {
          s.fleeing = true;
          s.speed = 150;
          const a = Math.atan2(s.y - d.y, s.x - d.x);
          s.dx = Math.cos(a);
          s.dy = Math.sin(a);
          this.emit({ type: 'bark', x: d.x, y: d.y });
        }
      }
    } else if (d.state === 'fetch') {
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

  /* --- Grandpa and snakes ------------------------------------------------------------------- */

  private updateSnake(dt: number): void {
    const g = this.npcs.find((n) => n.who === 'grandpa');
    let s = this.snake;
    if (!s) {
      this.snakeT -= dt;
      // Only while he's out working the yard, and only where you'd see it.
      const outside = g && !g.outing && !g.target && g.stop.id !== 'porch';
      if (this.snakeT > 0 || !g || !outside || this.gathered || this.mission || dist(this.player, g) > 450) return;
      this.snakeT = this.life.range(70, 130);
      const side = this.life.next() < 0.5 ? -1 : 1;
      const from = { x: g.x + side * 95, y: g.y + 26 };
      if (!this.shared.world.isFree(from.x, from.y, 6)) return;
      const to = { x: g.x - side * 30, y: g.y + 8 };
      const a = Math.atan2(to.y - from.y, to.x - from.x);
      s = this.snake = { x: from.x, y: from.y, px: from.x, py: from.y, dx: Math.cos(a), dy: Math.sin(a), speed: 32, t: 0, phase: 0, fleeing: false, scared: false };
    }
    s.px = s.x;
    s.py = s.y;
    s.t += dt;
    s.phase += dt * (s.fleeing ? 22 : 9);
    s.x += s.dx * s.speed * dt;
    s.y += s.dy * s.speed * dt;
    if (g && !s.scared && dist(s, g) < 58) {
      // Grandpa does not do snakes. Back to the porch, fast.
      s.scared = true;
      g.spookT = 3.2;
      g.busyT = 0;
      g.stop = NPC_ROUTINES.grandpa[0];
      g.hold = g.stop.hold;
      g.stayT = this.life.range(...g.stop.stay);
      g.target = { ...g.stop.at };
      g.path = null;
      const axle = this.dogs.find((d) => d.def.id === 'axle');
      const chased = !!axle && dist(axle, s) < 600 && (axle.state === 'follow' || axle.state === 'rest' || axle.state === 'sniff');
      if (axle && chased) {
        axle.state = 'chase';
        axle.path = null;
      }
      this.emit({ type: 'snake', x: s.x, y: s.y, chased });
    }
    if (s.t > (s.fleeing ? 2.2 : 14) || !this.shared.world.isFree(s.x, s.y, 2)) {
      this.snake = null;
      for (const d of this.dogs) if (d.state === 'chase') d.state = 'follow';
    }
  }

  /* --- The trampoline ----------------------------------------------------------------------- */

  get onTrampoline(): boolean {
    if (this.ride) return false;
    const p = this.player;
    return ((p.x - TRAMPOLINE.x) / TRAMPOLINE.rx) ** 2 + ((p.y - TRAMPOLINE.y) / TRAMPOLINE.ry) ** 2 < 1;
  }

  private updateTrampoline(dt: number): void {
    if (!this.onTrampoline) {
      this.trampT = 0;
      this.bigJumpT = 0;
      return;
    }
    this.trampT += dt;
    if (this.bigJumpT > 0) this.bigJumpT = Math.max(0, this.bigJumpT - dt);
  }

  /** On a ride, hitting a ramp with some speed puts you in the air for a moment. */
  private updateRamps(dt: number): void {
    if (this.airT > 0) {
      this.airT = Math.max(0, this.airT - dt);
      return;
    }
    const p = this.player;
    if (!this.ride || Math.hypot(p.vx, p.vy) < 170) return;
    const r = RAMPS.find((q) => dist(q, p) < 30);
    if (!r) return;
    this.airT = AIR_TIME;
    this.emit({ type: 'hop', x: r.x, y: r.y, ride: this.ride });
  }

  /** Is a point on a road or path? */
  isOnPath(x: number, y: number): boolean {
    for (const s of this.pathSegs) {
      const dx = s.bx - s.ax;
      const dy = s.by - s.ay;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(s.ax + dx * t - x, s.ay + dy * t - y) < s.r) return true;
    }
    return false;
  }

  /** Splashing through a puddle. */
  private updatePuddles(dt: number): void {
    this.splashT = Math.max(0, this.splashT - dt);
    const p = this.player;
    if (this.splashT > 0 || this.airT > 0 || Math.hypot(p.vx, p.vy) < 90) return;
    const pd = PUDDLES.find((q) => ((p.x - q.x) / q.rx) ** 2 + ((p.y - q.y) / q.ry) ** 2 < 1);
    if (!pd) return;
    this.splashT = this.ride ? 0.18 : 0.32;
    this.emit({ type: 'splash', x: p.x, y: p.y, big: !!this.ride });
  }

  /** How high off the ground a ramp has thrown the explorer. */
  airLift(): number {
    return this.airT > 0 ? Math.sin(Math.PI * (1 - this.airT / AIR_TIME)) * 34 : 0;
  }

  /** How high the explorer is right now: the mat, plus a little bounce, or a big jump. */
  trampolineLift(): number {
    if (!this.onTrampoline) return 0;
    if (this.bigJumpT > 0) return TRAMPOLINE.mat + Math.sin(Math.PI * (1 - this.bigJumpT / BIG_JUMP)) * 58;
    return TRAMPOLINE.mat + Math.abs(Math.sin(this.trampT * Math.PI * 1.8)) * 9;
  }

  /* --- Dogs and cats ------------------------------------------------------------------------- */

  /** Every so often a dog spots a cat and gives chase; the cat bolts up the treehouse. */
  private maybeChaseCat(dt: number): void {
    this.catChaseT -= dt;
    if (this.catChaseT > 0 || this.gathered || this.mission || this.family.moto?.player) return;
    this.catChaseT = 4;
    const p = this.player;
    const tree = TREEHOUSE_PERCHES[0];
    for (const d of this.dogs) {
      if ((d.state !== 'follow' && d.state !== 'rest') || d.stinkT > 0) continue;
      const cat = this.cats
        .filter((c) => c.lift === 0 && (c.state === 'rest' || c.state === 'walk') && dist(c, d) < 280 && dist(c, p) < 420 && dist(c, tree) < 800)
        .sort((a, b) => dist(a, d) - dist(b, d))[0];
      if (!cat) continue;
      this.catChaseT = this.life.range(45, 90);
      d.state = 'cat';
      d.chaseCat = cat.id;
      d.treedT = 0;
      d.path = null;
      // Up the treehouse, to whichever bit of platform is free.
      const taken = new Set(this.cats.filter((c) => c !== cat && c.lift > 0).map((c) => `${c.x},${c.y}`));
      cat.target = TREEHOUSE_PERCHES.find((s) => !taken.has(`${s.x},${s.y}`)) ?? TREEHOUSE_PERCHES[0];
      cat.state = 'flee';
      cat.emote = 'alarm';
      cat.emoteT = 0;
      this.emit({ type: 'catChase', dog: d.def.name, cat: cat.name, x: cat.x, y: cat.y });
      return;
    }
  }

  /* --- Annie and the skunk ------------------------------------------------------------------- */

  private updateSkunk(dt: number): void {
    const annie = this.dogs.find((d) => d.def.id === 'annie');
    let k = this.skunk;
    if (!k) {
      this.skunkT -= dt;
      const p = this.player;
      const free = annie && (annie.state === 'follow' || annie.state === 'rest' || annie.state === 'sniff') && annie.stinkT <= 0 && dist(annie, p) < 220;
      if (this.skunkT > 0 || !free || this.gathered || this.mission || this.family.moto?.player) return;
      this.skunkT = this.life.range(120, 200);
      // Somewhere in view, just off to one side, ambling across.
      const a = this.life.range(0, Math.PI * 2);
      const spot = this.shared.nav.nearestWalkable(p.x + Math.cos(a) * 190, p.y + Math.sin(a) * 140, 3);
      if (!spot || !this.shared.nav.reachable(annie!, spot)) return;
      const side = this.life.next() < 0.5 ? -1 : 1;
      k = this.skunk = { x: spot.x, y: spot.y, px: spot.x, py: spot.y, faceX: side, phase: 0, state: 'waddle', t: 0, dx: side, dy: 0, cloudT: -1 };
      annie!.state = 'skunk';
      annie!.path = null;
    }
    k.px = k.x;
    k.py = k.y;
    k.t += dt;
    if (k.cloudT >= 0) k.cloudT += dt;
    const speed = k.state === 'waddle' ? 22 : k.state === 'leave' ? 40 : 0;
    if (speed) {
      const pos = { x: k.x + k.dx * speed * dt, y: k.y + k.dy * speed * dt };
      this.shared.world.resolve(pos, 8);
      k.x = pos.x;
      k.y = pos.y;
      k.phase += dt * 10;
    }
    if (k.state === 'spray' && k.t > 1.3) {
      // Job done. Off it goes, unhurried.
      k.state = 'leave';
      k.t = 0;
      k.dx = annie && annie.x < k.x ? 1 : -1;
      k.dy = 0;
      k.faceX = k.dx;
    }
    if ((k.state === 'leave' && k.t > 4) || (k.state === 'waddle' && k.t > 14)) {
      this.skunk = null;
      if (annie?.state === 'skunk') annie.state = 'follow';
    }
  }

  /* --- Grandpa's chihuahuas ---------------------------------------------------------------- */

  private yardSpot(): Vec {
    const b = BACK_YARD;
    return { x: this.life.range(b.x0, b.x1), y: this.life.range(b.y0, b.y1) };
  }

  private updatePup(d: HubPup, i: number, dt: number): void {
    d.px = d.x;
    d.py = d.y;
    d.t -= dt;
    d.yipT = Math.max(0, d.yipT - dt);
    d.heartT = Math.max(0, d.heartT - dt);
    const b = BACK_YARD;
    const p = this.player;
    if (d.state === 'inside') {
      if (d.t <= 0) {
        // Out through the flap.
        d.x = d.px = DOGGIE_DOOR.x;
        d.y = d.py = DOGGIE_DOOR.y;
        d.state = 'trot';
        d.target = this.yardSpot();
      }
      return;
    }
    // Anyone near the fence gets guarded; anyone in the yard gets escorted.
    const cx = Math.max(b.x0, Math.min(b.x1, p.x));
    const cy = Math.max(b.y0, Math.min(b.y1, p.y));
    const outside = Math.hypot(p.x - cx, p.y - cy);
    let speed = 70;
    if (outside < 150 && !this.gathered && d.heartT <= 0 && !(d.state === 'sit' && d.t > 0 && dist(d, p) < 44)) {
      d.state = 'guard';
      speed = 150;
      if (outside < 1) {
        const a = this.clock * 1.6 + i * Math.PI;
        d.target = { x: Math.max(b.x0, Math.min(b.x1, p.x + Math.cos(a) * 38)), y: Math.max(b.y0, Math.min(b.y1, p.y + Math.sin(a) * 18 + 8)) };
      } else d.target = { x: Math.max(b.x0, Math.min(b.x1, cx + (i ? 16 : -16))), y: cy };
      d.yapT -= dt;
      if (d.yapT <= 0) {
        d.yapT = this.life.range(0.5, 1.4);
        d.yipT = 0.5;
        this.emit({ type: 'yip', x: d.x, y: d.y });
      }
    } else if (d.state === 'guard') {
      d.state = 'sit';
      d.t = this.life.range(1, 3);
      d.target = null;
    }
    if (d.target) {
      const dx = d.target.x - d.x;
      const dy = d.target.y - d.y;
      const dd = Math.hypot(dx, dy);
      if (dd > 2) {
        const s = Math.min(dd, speed * dt);
        d.x += (dx / dd) * s;
        d.y += (dy / dd) * s;
        if (Math.abs(dx) > 0.5) d.faceX = dx > 0 ? 1 : -1;
        d.phase += dt * (speed > 100 ? 22 : 14);
      } else if (d.state === 'trot') {
        const toDoor = dist(d.target, DOGGIE_DOOR) < 1;
        d.target = null;
        if (toDoor) {
          d.state = 'inside';
          d.t = this.life.range(10, 24);
        } else {
          d.state = 'sit';
          d.t = this.life.range(2, 5);
        }
      }
      if (d.state === 'guard' && dd <= 2) d.faceX = p.x >= d.x ? 1 : -1;
    } else if (d.state === 'sit' && d.t <= 0) {
      d.state = 'trot';
      // Now and then, in through the doggie door for a while.
      const goIn = this.life.next() < 0.25;
      d.target = goIn ? { ...DOGGIE_DOOR } : this.yardSpot();
    }
  }

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
    } else if ((c.state === 'walk' || c.state === 'flee') && c.target) {
      const tgt = c.target;
      const up = tgt.lift ?? 0;
      const atBase = dist(c, tgt) < 6;
      if (c.lift > 0 && !(atBase && up > 0)) {
        // Down from wherever it was first.
        c.lift = Math.max(0, c.lift - CLIMB * dt);
      } else if (atBase && c.lift < up) {
        // Up the ladder, or up the porch post onto the roof.
        c.lift = Math.min(up, c.lift + CLIMB * dt);
        c.phase += dt * 12;
      } else if (atBase) {
        c.refuge = c.state === 'flee';
        c.state = 'rest';
        c.target = null;
        c.t = c.refuge ? this.life.range(25, 45) : this.life.range(...CAT_REST[c.personality]);
        if (c.personality === 'sleepy') c.emote = 'zzz';
      } else this.stepCat(c, tgt, c.state === 'flee' ? 250 : c.personality === 'shy' ? 190 : c.speed, dt);
    } else if (c.state === 'rest') {
      // Wake up and look around when someone walks by; skittish ones relocate.
      const d = dist(c, p);
      if (c.personality === 'shy' && c.lift === 0 && d < 50 && Math.hypot(p.vx, p.vy) > 200) {
        c.spot = (c.spot + 1) % c.spots.length;
        c.target = c.spots[c.spot];
        c.state = 'walk';
        c.emote = 'alarm';
        c.emoteT = 0;
      } else if (d < 120) c.faceX = p.x >= c.x ? 1 : -1;
      else {
        // Now and then, off to the other favourite spot (never while someone's about to pet them).
        c.t -= dt;
        if (c.t <= 0 && c.refuge) {
          // The coast is clear: back home.
          c.refuge = false;
          c.target = c.spots[c.spot];
          c.state = 'walk';
        } else if (c.t <= 0) {
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
    if (m.kind === 'race') {
      this.updateRace(m, dt);
      return;
    }
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

  private updateRace(m: RaceState, dt: number): void {
    if (m.countdown > 0) {
      m.countdown -= dt;
      if (m.countdown <= 0) this.emit({ type: 'raceGo' });
      return;
    }
    m.t += dt;
    const p = this.player;
    const g = RACE_COURSE[m.gate];
    // Cut a corner a little too fine and the next gate still counts (but never two in a row).
    const skip = !!g && dist(p, g) >= RACE_GATE_R && m.gate + 1 < RACE_COURSE.length && dist(p, RACE_COURSE[m.gate + 1]) < RACE_GATE_R;
    if (skip) m.gate++;
    if (g && (skip || dist(p, g) < RACE_GATE_R)) {
      m.gate++;
      this.emit({ type: 'raceGate', gate: m.gate, x: g.x, y: g.y });
      if (m.gate >= RACE_COURSE.length) {
        const won = m.rivalDone === null;
        this.emit({ type: 'raceDone', ride: m.ride, seconds: m.t, won, rival: FAMILY[m.rival].name, rivalSeconds: m.rivalDone });
        return;
      }
    }
    const r = this.raceRival();
    if (!r || m.rivalDone !== null) return;
    const rg = RACE_COURSE[m.rivalGate];
    // A little give and take, so it stays a race.
    const lead = m.rivalGate - m.gate;
    const speed = RIDES[m.ride].rivalSpeed * (lead >= 2 ? 0.9 : lead <= -2 ? 1.1 : 1);
    const fromX = r.x;
    this.moveAgent(r, rg, speed, dt, 10);
    // Rivals take the ramps too.
    if (m.rivalAir > 0) m.rivalAir = Math.max(0, m.rivalAir - dt);
    else if (RAMPS.some((q) => dist(q, r) < 24)) m.rivalAir = AIR_TIME;
    if (Math.abs(r.x - fromX) > 0.2) r.faceX = r.x > fromX ? 1 : -1;
    if (dist(r, rg) < 30) {
      m.rivalGate++;
      if (m.rivalGate >= RACE_COURSE.length) {
        m.rivalDone = m.t;
        this.emit({ type: 'raceRival', name: FAMILY[m.rival].name });
      }
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
