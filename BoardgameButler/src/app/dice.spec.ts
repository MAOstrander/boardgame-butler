import { MAX_DICE, rollDice } from './dice';

describe('rollDice', () => {
  it('maps the random source onto 1..sides', () => {
    expect(rollDice(6, 1, () => 0).results).toEqual([1]);
    expect(rollDice(6, 1, () => 0.999).results).toEqual([6]);
    expect(rollDice(20, 1, () => 0.5).results).toEqual([11]);
    expect(rollDice(100, 1, () => 0.999).results).toEqual([100]);
  });

  it('rolls the requested number of dice and totals them', () => {
    const values = [0, 0.5, 0.999];
    let i = 0;
    const roll = rollDice(6, 3, () => values[i++]);

    expect(roll).toEqual({ sides: 6, count: 3, results: [1, 4, 6], total: 11 });
  });

  it('clamps the count to 1..MAX_DICE', () => {
    expect(rollDice(6, 0, () => 0).count).toBe(1);
    expect(rollDice(6, -5, () => 0).count).toBe(1);
    expect(rollDice(6, 99, () => 0).count).toBe(MAX_DICE);
    expect(rollDice(6, 2.7, () => 0).count).toBe(2);
  });

  it('stays within range across many real rolls', () => {
    for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
      const { results } = rollDice(sides, MAX_DICE);
      for (const r of results) {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(sides);
        expect(Number.isInteger(r)).toBe(true);
      }
    }
  });
});
