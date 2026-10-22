import { LEVEL_ONE } from '../games/kitten/levels';
import { CHIHUAHUAS, DOGS, DONKEYS } from './cast';

/**
 * Animals the family can rename in the game (Animal names, in the menu). The dogs and donkeys
 * already have their real names and stay as they are.
 */
export interface NameableAnimal {
  id: string;
  kind: 'cat' | 'chihuahua';
  /** The name it has until someone picks a new one. */
  name: string;
}

export const NAMEABLE: NameableAnimal[] = [
  ...LEVEL_ONE.kittens.map((k) => ({ id: k.id, kind: 'cat' as const, name: k.name })),
  ...CHIHUAHUAS.map((d) => ({ id: d.id, kind: 'chihuahua' as const, name: d.name })),
];

/** Named by the family: shown on the names screen, not editable. */
export const NAMED_BY_FAMILY: { id: string; name: string; what: string }[] = [
  ...DOGS.map((d) => ({ id: d.id, name: d.name, what: d.kind === 'lab' ? 'Black Lab' : 'Terrier' })),
  ...DONKEYS.map((d) => ({ id: d.id, name: d.name, what: 'Donkey' })),
];

export const NAME_MAX = 14;

/** Tidy up a typed name: letters, numbers, spaces and simple punctuation, short enough to fit. */
export function cleanName(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N} '.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

/** Only known animals, only clean names, and nothing for the locked ones. */
export function cleanNames(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const a of NAMEABLE) {
    const v = (raw as Record<string, unknown>)[a.id];
    if (typeof v !== 'string') continue;
    const n = cleanName(v);
    if (n && n !== a.name) out[a.id] = n;
  }
  return out;
}

export function nameFor(names: Record<string, string>, id: string): string {
  return names[id] ?? NAMEABLE.find((a) => a.id === id)?.name ?? id;
}
