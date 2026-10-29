/**
 * Random choices for the people at the table. Pure, with an injectable random
 * source like `rollDice`, so tests can be deterministic.
 */

/** One item chosen uniformly at random. */
export function pickOne<T>(items: readonly T[], random: () => number = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(random() * items.length)];
}

/** A shuffled copy (Fisher-Yates); the input is left alone. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Shuffle, then deal round-robin into `teams` teams, so sizes differ by at
 * most one. The team count is clamped to between 1 and the number of items,
 * so no team comes back empty.
 */
export function splitTeams<T>(items: readonly T[], teams: number, random: () => number = Math.random): T[][] {
  if (items.length === 0) return [];
  const n = Math.min(Math.max(1, Math.floor(teams)), items.length);
  const out: T[][] = Array.from({ length: n }, () => []);
  shuffle(items, random).forEach((item, i) => out[i % n].push(item));
  return out;
}
