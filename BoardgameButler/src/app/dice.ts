export const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export const MAX_DICE = 10;

export interface DiceRoll {
  sides: number;
  count: number;
  results: number[];
  total: number;
}

/** Roll `count` dice with `sides` faces. `random` is injectable for tests. */
export function rollDice(sides: number, count: number, random: () => number = Math.random): DiceRoll {
  const n = Math.min(Math.max(1, Math.floor(count)), MAX_DICE);
  const results = Array.from({ length: n }, () => 1 + Math.floor(random() * sides));
  return { sides, count: n, results, total: results.reduce((a, b) => a + b, 0) };
}
