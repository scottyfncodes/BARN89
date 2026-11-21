/**
 * The Big Country Field Guide: wild animals you can spot around the homestead, all of them
 * natives of Taylor County, out between Wylie and Abilene. Walk close enough to get a proper
 * look and they go in the guide. Facts are kept short and true.
 */
export type SpeciesId =
  | 'roadrunner'
  | 'armadillo'
  | 'jackrabbit'
  | 'hornedLizard'
  | 'deer'
  | 'turkey'
  | 'scissortail'
  | 'mockingbird'
  | 'vulture'
  | 'monarch';

export interface Species {
  id: SpeciesId;
  name: string;
  /** One true thing about it. */
  fact: string;
  /** Where to look, shown in the guide before you've spotted it. */
  where: string;
}

export const SPECIES: Species[] = [
  {
    id: 'roadrunner',
    name: 'Greater Roadrunner',
    fact: 'Would rather run than fly, at up to about fifteen miles an hour. Eats lizards, bugs and even small snakes, which makes it Grandpa\'s favourite bird.',
    where: 'Dashing along the access road on the west side.',
  },
  {
    id: 'armadillo',
    name: 'Nine-banded Armadillo',
    fact: 'Snuffles for grubs with its nose to the ground. Startle one and it jumps straight up in the air.',
    where: 'Nosing about in the creek woods to the south-west.',
  },
  {
    id: 'jackrabbit',
    name: 'Black-tailed Jackrabbit',
    fact: 'Not a rabbit at all: a hare. Those huge ears let off heat on hot afternoons.',
    where: 'Out in the north-west paddocks.',
  },
  {
    id: 'hornedLizard',
    name: 'Texas Horned Lizard',
    fact: 'The Texas state reptile, and mostly eats red harvester ants. It freezes instead of running, so look, but don\'t pick it up.',
    where: 'Sitting very still on the red dirt. Get close.',
  },
  {
    id: 'deer',
    name: 'White-tailed Deer',
    fact: 'When a white-tail runs, it throws its tail straight up like a white flag.',
    where: 'At the edge of the woods south of the corral. They spook easily.',
  },
  {
    id: 'turkey',
    name: 'Rio Grande Wild Turkey',
    fact: 'The wild turkey of West Texas. They roost high in the trees at night and would rather run than fly.',
    where: 'Pecking through the meadow behind the barns.',
  },
  {
    id: 'scissortail',
    name: 'Scissor-tailed Flycatcher',
    fact: 'Its forked tail is longer than the rest of the bird. It sits on fence posts and darts out to snap up bugs.',
    where: 'On a fence post along Buffalo Gap Rd.',
  },
  {
    id: 'mockingbird',
    name: 'Northern Mockingbird',
    fact: 'The Texas state bird. It copies other birds\' songs, and the odd cat or dog.',
    where: 'Singing from the top of the farm stand by the drive.',
  },
  {
    id: 'vulture',
    name: 'Turkey Vulture',
    fact: 'Circles for hours on wings held in a shallow V, hardly ever flapping, and finds its food by smell.',
    where: 'Look up over the riding arena.',
  },
  {
    id: 'monarch',
    name: 'Monarch Butterfly',
    fact: 'Every fall, monarchs funnel through the Big Country on their way to the mountains of Mexico.',
    where: 'Resting on the flowers by the scarecrow on their way south.',
  },
];

export const SPECIES_COUNT = SPECIES.length;

export function species(id: string): Species | undefined {
  return SPECIES.find((s) => s.id === id);
}
