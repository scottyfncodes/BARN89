import type { Shape } from './shapes';

export type Pt = readonly [number, number];

export interface RoadDef {
  points: Pt[];
  width: number;
  kind: 'gravel' | 'dirt' | 'footpath';
  /** Closed loop (driveway turnaround). */
  loop?: boolean;
}

export type AreaKind = 'sand' | 'dirt' | 'garden' | 'lawn' | 'meadow' | 'water' | 'woods' | 'clay' | 'asphalt';

export interface AreaDef {
  kind: AreaKind;
  shape:
    | { type: 'rect'; x: number; y: number; w: number; h: number; r?: number }
    | { type: 'ellipse'; x: number; y: number; rx: number; ry: number }
    | { type: 'poly'; points: Pt[] };
}

export type BuildingStyle = 'farmhouse' | 'cottage' | 'barn' | 'shed' | 'garage' | 'shop' | 'coop';

export interface BuildingDef {
  id: string;
  style: BuildingStyle;
  /** Ground footprint (solid). The roof is drawn above this. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Visual wall height in world px. */
  wall: number;
  roof: string;
  walls: string;
  label?: string;
  /** Colour of a star emblem hung on the front wall (Grandpa's shop). */
  star?: string;
}

export interface TreeDef {
  x: number;
  y: number;
  r: number;
  variant: 'oak' | 'pine' | 'willow' | 'bush';
  seed: number;
}

export type FenceStyle = 'rail' | 'picket' | 'round';

export interface FenceDef {
  style: FenceStyle;
  points: Pt[];
}

export interface PenDef {
  id: string;
  x: number;
  y: number;
  r: number;
  /** Gate direction in radians (world space, 0 = east, PI/2 = south). Omit for a closed ring. */
  gateAngle?: number;
  gateWidth?: number;
  role: 'target' | 'paddock' | 'chickens';
  label: string;
}

export type PropKind =
  | 'roundBale'
  | 'squareBale'
  | 'barrel'
  | 'trough'
  | 'mailbox'
  | 'sign'
  | 'scarecrow'
  | 'box'
  | 'jump'
  | 'clothesline'
  | 'flowers'
  | 'rock'
  | 'cart'
  | 'yarn'
  | 'napHay'
  | 'mouseHole'
  | 'well'
  | 'bench'
  | 'trampoline'
  | 'treehouse'
  | 'puttingGreen'
  | 'doggieDoor'
  | 'doghouse'
  | 'woodpile'
  | 'chopBlock'
  | 'festoon'
  | 'venueSign'
  | 'longTable'
  | 'wallCross'
  | 'nameSign';

export interface PropDef {
  kind: PropKind;
  x: number;
  y: number;
  /** Generic size parameter; meaning depends on kind. */
  w?: number;
  h?: number;
  angle?: number;
  text?: string;
  solid?: boolean;
}

export type DistractionKind = 'yarn' | 'box' | 'ducks' | 'chickens' | 'flowers';

export interface DistractionDef {
  id: string;
  kind: DistractionKind;
  x: number;
  y: number;
  /** How far away a curious kitten notices it. */
  radius: number;
}

export interface DiscoveryDef {
  id: string;
  x: number;
  y: number;
  r: number;
  title: string;
  text: string;
}

export interface CollectibleDef {
  id: string;
  kind: 'horseshoe' | 'treatBag';
  x: number;
  y: number;
}

export interface RanchMap {
  width: number;
  height: number;
  /** Inset of the playable bounds from the world edge (tree line). */
  margin: number;
  roads: RoadDef[];
  areas: AreaDef[];
  buildings: BuildingDef[];
  trees: TreeDef[];
  fences: FenceDef[];
  pens: PenDef[];
  props: PropDef[];
  distractions: DistractionDef[];
  discoveries: DiscoveryDef[];
  collectibles: CollectibleDef[];
  /** Areas where kittens get the zoomies (the arena sand). */
  zoomieZones: { x: number; y: number; w: number; h: number }[];
  /** Extra solids not derived from the above (water edges etc). */
  extraSolids: Shape[];
}
