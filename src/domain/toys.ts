/**
 * Bomb-squad gift toys: every cleared bomb round opens a gift box with the NEXT toy in this fixed order — a
 * collection the child can see growing on the shelf. No chance draw, nothing expires, nothing is ever taken
 * away (expectation ethics, P2). After the last one the gift is a "you have them all" cheer.
 */
export const TOY_IDS = [
  'top',
  'robot',
  'dino',
  'rocket',
  'car',
  'bear',
  'tumbler',
  'plane',
  'octopus',
  'crown',
] as const;
export type ToyId = (typeof TOY_IDS)[number];

export const isToyId = (x: string): x is ToyId => (TOY_IDS as readonly string[]).includes(x);

/** The toy the next cleared bomb round gives (null = the whole set is collected). */
export function nextToy(owned: readonly string[]): ToyId | null {
  return TOY_IDS.find((t) => !owned.includes(t)) ?? null;
}
