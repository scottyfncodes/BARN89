/**
 * The Barn 89 cast. Everything family-specific lives here so names, looks and lines can be
 * corrected in one place as better details come in. These are fictionalized game roles.
 */

export type FamilyId = 'megan' | 'jason' | 'jay' | 'natalie' | 'grandpa';

export type HairStyle = 'braids' | 'ponytail' | 'wavy' | 'long' | 'short' | 'shaggy' | 'grey';
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
  /** Wears a dress instead of shirt and pants (shirt is the dress colour). */
  dress?: { pattern: 'plain' | 'floral'; colors?: string[] };
  sleeveless?: boolean;
  /** Tall western boots in this colour (shaft up the shin). */
  cowboyBoots?: string;
  /** Shorts instead of long pants (lower legs show skin). */
  shorts?: boolean;
  /** Open jacket worn over a tee of this colour. */
  tee?: string;
  /** Stripe down the jacket sleeves. */
  sleeveStripe?: string;
  /** Draw the beard as light stubble. */
  stubble?: boolean;
  /** Sparkly boots. */
  glitter?: boolean;
  /** A little cross on a chain. */
  necklace?: boolean;
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
    name: 'Mom',
    role: 'Runs the homestead',
    look: {
      skin: '#f3c9a6',
      hair: '#e3c27a',
      hairStyle: 'wavy',
      shirt: '#7fa3cc',
      dress: { pattern: 'plain' },
      sleeveless: true,
      pants: '#f3c9a6',
      shoes: '#b23a32',
      cowboyBoots: '#b23a32',
      hat: 'none',
      scale: 0.98,
    },
  },
  jason: {
    id: 'jason',
    name: 'Dad',
    role: 'Keeps the woodpile stacked',
    look: {
      skin: '#eebd96',
      hair: '#3a2a20',
      hairStyle: 'short',
      shirt: '#2b2a30',
      pants: '#3e5a8a',
      shoes: '#c49360',
      cowboyBoots: '#c49360',
      hat: 'none',
      scale: 1.04,
    },
  },
  jay: {
    id: 'jay',
    name: 'Jay',
    role: 'Fastest mower in the county',
    look: {
      skin: '#f4c7a4',
      hair: '#c9975c',
      hairStyle: 'short',
      shirt: '#2b2a30',
      pants: '#41598a',
      shoes: '#8a5a35',
      cowboyBoots: '#8a5a35',
      necklace: true,
      hat: 'none',
      scale: 0.92,
    },
  },
  natalie: {
    id: 'natalie',
    name: 'Natalie',
    role: 'Kitten Cowgirl',
    look: {
      skin: '#f5caa6',
      hair: '#b9935e',
      hairStyle: 'long',
      shirt: '#fbf3e6',
      dress: { pattern: 'floral', colors: ['#e2486a', '#f2b33a', '#f28aa0', '#5f9e6e'] },
      sleeveless: true,
      pants: '#f5caa6',
      shoes: '#e9a7b8',
      cowboyBoots: '#e9a7b8',
      glitter: true,
      hat: 'cowgirl',
      scale: 0.84,
    },
  },
  grandpa: {
    id: 'grandpa',
    name: 'Grandpa',
    role: 'Lives in the northeast house',
    look: {
      skin: '#c6936b',
      hair: '#d4d1cb',
      hairStyle: 'short',
      shirt: '#24242a',
      tee: '#d9302f',
      sleeveStripe: '#a9adb3',
      pants: '#3d4048',
      shorts: true,
      shoes: '#e9e9ea',
      hat: 'none',
      beard: '#d8d4cc',
      stubble: true,
      scale: 0.98,
    },
  },
};

export const FAMILY_ORDER: FamilyId[] = ['megan', 'jason', 'jay', 'natalie', 'grandpa'];

export interface DogDef {
  id: string;
  name: string;
  kind: 'collie' | 'doodleRottie' | 'schnauzerFrenchie' | 'chihuahua';
  /** What the names screen calls the breed. */
  breed: string;
  base: string;
  patch: string;
  /** Rottweiler tan points: brows, muzzle, chest and socks. */
  points?: string;
  blurb: string;
  /** Drawing scale (1 = medium dog). */
  size?: number;
  collar?: string;
}

export const DOGS: DogDef[] = [
  { id: 'axel', name: 'Axel', kind: 'schnauzerFrenchie', breed: 'Mini Schnauzer and French Bulldog', base: '#2b2622', patch: '#f2efe8', size: 0.82, collar: '#2f5fb8', blurb: 'Schnauzer beard, Frenchie bat ears, about twenty-five pounds of nose. Has found every snake on the property.' },
  { id: 'annie', name: 'Annie', kind: 'doodleRottie', breed: 'Labradoodle and Rottweiler', base: '#26252a', patch: '#3b393f', points: '#a9652f', size: 1.36, collar: '#8a8f96', blurb: 'Ninety pounds of curly black-and-tan doodle with Rottweiler markings. Will lean on you. Will find the chew toy.' },
];

/**
 * Grandpa's two little black chihuahuas. They stay in his fenced back yard and come and go
 * through the doggie door. Their names are placeholders: rename them in the game (Animal names).
 */
export const CHIHUAHUAS: DogDef[] = [
  { id: 'pip', name: 'Pip', kind: 'chihuahua', breed: 'Chihuahua', base: '#1d1b1f', patch: '#4a4248', size: 0.5, collar: '#d9434f', blurb: 'Six pounds. Guards the back yard from everything, loudly.' },
  { id: 'peanut', name: 'Peanut', kind: 'chihuahua', breed: 'Chihuahua', base: '#232026', patch: '#544a50', size: 0.46, collar: '#3d7fd6', blurb: 'Slightly smaller, slightly louder. First through the doggie door.' },
];

export interface DonkeyDef {
  id: string;
  name: string;
  coat: string;
  dark: string;
  blurb: string;
}

export const DONKEYS: DonkeyDef[] = [
  { id: 'yoda', name: 'Yoda', coat: '#a58f74', dark: '#5c4c3d', blurb: 'Big ears, old soul. Decides for himself when it is carrot time.' },
  { id: 'chewy', name: 'Chewy', coat: '#867664', dark: '#4e4237', blurb: 'Loud, shaggy, and always first to the gate.' },
];
