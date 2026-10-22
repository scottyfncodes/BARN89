/**
 * The Barn 89 cast. Everything family-specific lives here so names, looks and lines can be
 * corrected in one place as better details come in. These are fictionalized game roles.
 */

export type FamilyId = 'megan' | 'jason' | 'jay' | 'natalie' | 'grandpa';

export type HairStyle = 'braids' | 'ponytail' | 'wavy' | 'short' | 'shaggy' | 'grey';
export type HatKind = 'cowgirl' | 'cap' | 'capBack' | 'flatcap' | 'straw' | 'santa' | 'beanie' | 'none';

export interface PersonLook {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  /** Second colour for flannel checks. */
  check?: string;
  pants: string;
  shoes: string;
  hat: HatKind;
  hatColor?: string;
  vest?: string;
  bandana?: string;
  beard?: string;
  mustache?: string;
  glasses?: boolean;
  suspenders?: string;
  /** Overall size: adults 1. */
  scale: number;
}

export interface FamilyMember {
  id: FamilyId;
  name: string;
  /** Short role shown on cards. */
  role: string;
  look: PersonLook;
}

export const FAMILY: Record<FamilyId, FamilyMember> = {
  megan: {
    id: 'megan',
    name: 'Megan',
    role: 'Runs the homestead',
    look: {
      skin: '#f3c7a3',
      hair: '#7a4a2a',
      hairStyle: 'wavy',
      shirt: '#5f9e6e',
      pants: '#4c6fa8',
      shoes: '#3f6b3a',
      hat: 'none',
      bandana: '#f3c13a',
      scale: 0.98,
    },
  },
  jason: {
    id: 'jason',
    name: 'Jason',
    role: 'Keeps the woodpile stacked',
    look: {
      skin: '#eebd96',
      hair: '#4a3022',
      hairStyle: 'short',
      shirt: '#c23b33',
      check: '#2a1f22',
      pants: '#3e5687',
      shoes: '#6b4426',
      hat: 'none',
      beard: '#4a3022',
      scale: 1.04,
    },
  },
  jay: {
    id: 'jay',
    name: 'Jay',
    role: 'Fastest mower in the county',
    look: {
      skin: '#f2c49c',
      hair: '#6b4128',
      hairStyle: 'shaggy',
      shirt: '#3d7fd6',
      pants: '#56606e',
      shoes: '#f2f2ee',
      hat: 'capBack',
      hatColor: '#d9434f',
      scale: 0.92,
    },
  },
  natalie: {
    id: 'natalie',
    name: 'Natalie',
    role: 'Kitten Cowgirl',
    look: {
      skin: '#f5c9a2',
      hair: '#b65a2a',
      hairStyle: 'braids',
      shirt: '#d9434f',
      pants: '#4c6fa8',
      shoes: '#7b4a2a',
      hat: 'cowgirl',
      vest: '#8c5a35',
      bandana: '#f3c13a',
      scale: 0.84,
    },
  },
  grandpa: {
    id: 'grandpa',
    name: 'Grandpa',
    role: 'Lives in the northeast house',
    look: {
      skin: '#efc19f',
      hair: '#e6e2da',
      hairStyle: 'grey',
      shirt: '#9cb8d6',
      vest: '#8a6a4a',
      pants: '#b9a582',
      shoes: '#5a3a24',
      hat: 'flatcap',
      hatColor: '#6f6a5e',
      mustache: '#efece6',
      glasses: true,
      suspenders: '#7a2f2a',
      scale: 0.98,
    },
  },
};

export const FAMILY_ORDER: FamilyId[] = ['megan', 'jason', 'jay', 'natalie', 'grandpa'];

export interface DogDef {
  id: string;
  name: string;
  kind: 'collie' | 'lab';
  base: string;
  patch: string;
  blurb: string;
}

export const DOGS: DogDef[] = [
  { id: 'scout', name: 'Scout', kind: 'collie', base: '#2b2a30', patch: '#f7f3ec', blurb: 'Will fetch until the sun goes down. Then a little longer.' },
  { id: 'maggie', name: 'Maggie', kind: 'lab', base: '#d9a85e', patch: '#f0d29a', blurb: 'Supervises from the porch. Accepts belly rubs.' },
];

export interface DonkeyDef {
  id: string;
  name: string;
  coat: string;
  dark: string;
  blurb: string;
}

export const DONKEYS: DonkeyDef[] = [
  { id: 'hank', name: 'Hank', coat: '#8e8478', dark: '#5f574e', blurb: 'Takes carrots seriously. Takes instructions less seriously.' },
  { id: 'dolly', name: 'Dolly', coat: '#6e5546', dark: '#46352b', blurb: 'Loud, opinionated, and the first to the gate.' },
];
