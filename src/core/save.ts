import type { FamilyId, HatKind } from '../content/cast';
import { cleanNames } from '../content/names';
import type { BarnPlan } from '../content/sunday';

/**
 * Local-only progress. Nothing leaves the device and nothing syncs between family members'
 * phones; each browser keeps its own save. If storage is unavailable (private browsing,
 * blocked site data) the game still runs and simply forgets on reload.
 */
export interface Cosmetics {
  /** Explorer's hat; 'default' keeps the character's own. */
  hat: HatKind | 'default';
  mower: 'red' | 'green' | 'gold';
  ride: boolean;
  evening: boolean;
  holiday: boolean;
  /** Natalie on her e-scooter (when she's exploring). */
  scooter: boolean;
  /** Jay in his mini monster truck, Megan on her riding mower, Jason on his dirt bike (when they're exploring). */
  truck: boolean;
  rider: boolean;
  dirtbike: boolean;
}

export interface SaveData {
  v: 1;
  explorer: FamilyId;
  sound: boolean;
  /** Best stars per challenge id. */
  stars: Record<string, number>;
  /** Best score per challenge id. */
  best: Record<string, number>;
  ornaments: string[];
  discoveries: string[];
  pets: string[];
  fetches: number;
  carrots: number;
  hunt: { found: string[]; done: boolean };
  /** What the family decided Barn 89 becomes next (Sunday at the Barn). Null until chosen. */
  barnPlan: BarnPlan | null;
  /** Times the family sat down for Sunday breakfast. Just remembered, never rewarded. */
  sundays: number;
  cosmetics: Cosmetics;
  /** One-time hints already shown. */
  seen: string[];
  /** Names the family picked for the barn cats and Grandpa's chihuahuas, by animal id. */
  names: Record<string, string>;
}

const KEY = 'barn89.save.v1';

export function freshSave(): SaveData {
  return {
    v: 1,
    explorer: 'natalie',
    sound: true,
    stars: {},
    best: {},
    ornaments: [],
    discoveries: [],
    pets: [],
    fetches: 0,
    carrots: 0,
    hunt: { found: [], done: false },
    barnPlan: null,
    sundays: 0,
    cosmetics: { hat: 'default', mower: 'red', ride: false, evening: false, holiday: false, scooter: false, truck: false, rider: false, dirtbike: false },
    seen: [],
    names: {},
  };
}

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__barn89_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** Merge a parsed save over defaults so older or partial saves keep working. */
export function normalize(raw: unknown): SaveData {
  const base = freshSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  const arr = (a: unknown) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []);
  const rec = (o: unknown) => {
    const out: Record<string, number> = {};
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (typeof v === 'number' && isFinite(v)) out[k] = v;
    return out;
  };
  return {
    v: 1,
    explorer: typeof r.explorer === 'string' && ['megan', 'jason', 'jay', 'natalie', 'grandpa'].includes(r.explorer) ? r.explorer : base.explorer,
    sound: typeof r.sound === 'boolean' ? r.sound : true,
    stars: rec(r.stars),
    best: rec(r.best),
    ornaments: arr(r.ornaments),
    discoveries: arr(r.discoveries),
    pets: arr(r.pets),
    fetches: typeof r.fetches === 'number' ? r.fetches : 0,
    carrots: typeof r.carrots === 'number' ? r.carrots : 0,
    hunt: { found: arr(r.hunt?.found), done: !!r.hunt?.done },
    barnPlan: r.barnPlan === 'supper' || r.barnPlan === 'neighbors' || r.barnPlan === 'dance' ? r.barnPlan : null,
    sundays: typeof r.sundays === 'number' ? r.sundays : 0,
    cosmetics: { ...base.cosmetics, ...(r.cosmetics && typeof r.cosmetics === 'object' ? r.cosmetics : {}) },
    seen: arr(r.seen),
    names: cleanNames(r.names),
  };
}

export class SaveStore {
  data: SaveData;
  readonly persistent: boolean;
  private storage: Storage | null;

  constructor(storage: Storage | null = defaultStorage()) {
    this.storage = storage;
    this.persistent = !!storage;
    let parsed: unknown = null;
    try {
      const txt = storage?.getItem(KEY);
      parsed = txt ? JSON.parse(txt) : null;
    } catch {
      parsed = null;
    }
    this.data = normalize(parsed);
  }

  save(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* quota or blocked: keep playing */
    }
  }

  reset(): void {
    this.data = freshSave();
    this.save();
  }

  /** Records a result; returns true if it beat the previous best stars or score. */
  record(challenge: string, stars: number, score: number): { newStars: boolean; newBest: boolean } {
    const prevS = this.data.stars[challenge] ?? 0;
    const prevB = this.data.best[challenge] ?? 0;
    const newStars = stars > prevS;
    const newBest = score > prevB;
    if (newStars) this.data.stars[challenge] = stars;
    if (newBest) this.data.best[challenge] = score;
    this.save();
    return { newStars, newBest };
  }

  addTo(list: 'ornaments' | 'discoveries' | 'pets' | 'seen', id: string): boolean {
    const l = this.data[list];
    if (l.includes(id)) return false;
    l.push(id);
    this.save();
    return true;
  }
}
