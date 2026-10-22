import type { FamilyId } from './cast';

/** Things the family can ride around the homestead and race on the Loop. */
export type RideId = 'scooter' | 'truck' | 'rider' | 'dirtbike' | 'golfcart';

export interface RideDef {
  id: RideId;
  /** Whose it is: they ride it whenever they're the one exploring. */
  owner: FamilyId;
  /** The reward's name. */
  name: string;
  /** The race it opens, and that race's title. */
  race: string;
  raceTitle: string;
  /** Top speed (walking is 260) and how quickly it gets there (higher is snappier). */
  speed: number;
  accel: number;
  /** Who you race when the owner is the one exploring. */
  stand: FamilyId;
  rivalSpeed: number;
  /** Seconds for 3 and 2 stars (two laps). */
  starTimes: [number, number];
  /** Stars in the owner's own game that unlock it. */
  unlock: { game: 'kitten' | 'mower' | 'rounds' | 'woodpile' | 'putt'; stars: number; label: string };
}

export const RIDES: Record<RideId, RideDef> = {
  scooter: {
    id: 'scooter',
    owner: 'natalie',
    name: "Natalie's e-scooter",
    race: 'race-1',
    raceTitle: 'Scooter Race',
    speed: 390,
    accel: 9,
    stand: 'jay',
    rivalSpeed: 300,
    starTimes: [21, 28],
    unlock: { game: 'kitten', stars: 3, label: 'Kitten Cowgirl' },
  },
  truck: {
    id: 'truck',
    owner: 'jay',
    name: "Jay's mini monster truck",
    race: 'race-2',
    raceTitle: 'Monster Truck Race',
    speed: 410,
    accel: 4.5,
    stand: 'jason',
    rivalSpeed: 305,
    starTimes: [21.5, 28.5],
    unlock: { game: 'mower', stars: 3, label: 'Yard Boss' },
  },
  rider: {
    id: 'rider',
    owner: 'megan',
    name: "Megan's riding mower",
    race: 'race-3',
    raceTitle: 'Lawn Mower Race',
    speed: 300,
    accel: 5,
    stand: 'grandpa',
    rivalSpeed: 228,
    starTimes: [28, 37],
    unlock: { game: 'rounds', stars: 2, label: "Megan's Morning Rounds" },
  },
  dirtbike: {
    id: 'dirtbike',
    owner: 'jason',
    name: "Jason's dirt bike",
    race: 'race-4',
    raceTitle: 'Dirt Bike Race',
    speed: 480,
    accel: 7,
    stand: 'jay',
    rivalSpeed: 365,
    starTimes: [18, 24],
    unlock: { game: 'woodpile', stars: 3, label: 'Woodpile' },
  },
  golfcart: {
    id: 'golfcart',
    owner: 'grandpa',
    name: "Grandpa's golf cart",
    race: 'race-5',
    raceTitle: 'Golf Cart Race',
    speed: 340,
    accel: 6,
    stand: 'natalie',
    rivalSpeed: 258,
    starTimes: [25, 33],
    unlock: { game: 'putt', stars: 3, label: 'Putt-Putt' },
  },
};

export const RIDE_IDS = Object.keys(RIDES) as RideId[];

/** The ride a race challenge uses. */
export function rideForRace(challenge: string): RideDef {
  return RIDE_IDS.map((id) => RIDES[id]).find((r) => r.race === challenge) ?? RIDES.scooter;
}

/** The ride that belongs to someone, if they have one. */
export function rideOf(who: FamilyId): RideDef | null {
  return RIDE_IDS.map((id) => RIDES[id]).find((r) => r.owner === who) ?? null;
}

/** Who you race: the ride's owner, or their stand-in when the owner is you. */
export function raceRivalFor(ride: RideDef, explorer: FamilyId): FamilyId {
  return explorer === ride.owner ? ride.stand : ride.owner;
}
