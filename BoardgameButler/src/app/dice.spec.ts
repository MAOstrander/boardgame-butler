import { MAX_DICE, Notation, parseNotation, rollDice, rollNotation } from './dice';

function parsed(input: string): Notation {
  const result = parseNotation(input);
  if ('error' in result) throw new Error(result.error);
  return result;
}

describe('parseNotation', () => {
  it('reads dice plus a number', () => {
    expect(parseNotation('3d6+3')).toEqual({
      text: '3d6+3',
      dice: [{ sign: 1, count: 3, sides: 6 }],
      modifier: 3,
    });
  });

  it('ignores spaces and case, writes the count, and reads d% as d100', () => {
    expect(parsed(' D20 + 5 ').text).toBe('1d20+5');
    expect(parsed('d%').dice).toEqual([{ sign: 1, count: 1, sides: 100 }]);
    expect(parsed('+2d8').text).toBe('2d8');
  });

  it('reads several groups, subtraction and more than one number', () => {
    const n = parsed('2d6 + 1d4 - 1 + 3 - 1d8');
    expect(n.dice).toEqual([
      { sign: 1, count: 2, sides: 6 },
      { sign: 1, count: 1, sides: 4 },
      { sign: -1, count: 1, sides: 8 },
    ]);
    expect(n.modifier).toBe(2);
    expect(n.text).toBe('2d6+1d4-1d8+2');
  });

  it('allows a negative total modifier and a leading minus', () => {
    expect(parsed('1d20-2').text).toBe('1d20-2');
    expect(parsed('-1d4+10').text).toBe('-1d4+10');
    expect(parsed('2d6+3-3').text).toBe('2d6');
  });

  it.each([
    ['', 'Type a roll. Try something like 3d6+3.'],
    ['   ', 'Type a roll. Try something like 3d6+3.'],
    ['3x6', 'Couldn\'t read "3x6". Try something like 3d6+3.'],
    ['3d6+', 'Couldn\'t read "3d6+". Try something like 3d6+3.'],
    ['3d', 'Couldn\'t read "3d". Try something like 3d6+3.'],
    ['2d6*2', 'Couldn\'t read "2d6*2". Try something like 3d6+3.'],
    ['1.5d6', 'Couldn\'t read "1.5d6". Try something like 3d6+3.'],
    ['5', 'Include at least one die. Try something like 3d6+3.'],
    ['0d6', 'Roll at least one die in "0d6".'],
    ['1d1', 'Dice need between 2 and 1000 sides.'],
    ['1d1001', 'Dice need between 2 and 1000 sides.'],
    ['60d6+41d6', "That's more than 100 dice."],
    ['1d6+1001', 'Keep the added number within ±1000.'],
  ])('rejects %j', (input, error) => {
    expect(parseNotation(input)).toEqual({ error });
  });

  it('accepts exactly the limits', () => {
    expect('error' in parseNotation('100d1000+1000')).toBe(false);
    expect('error' in parseNotation('1d2-1000')).toBe(false);
  });
});

describe('rollNotation', () => {
  it('rolls each group, adds the number and totals it', () => {
    const values = [0, 0.5, 0.999];
    let i = 0;
    const roll = rollNotation(parsed('3d6+3'), () => values[i++]);
    expect(roll).toEqual({
      notation: '3d6+3',
      groups: [{ sign: 1, count: 3, sides: 6, results: [1, 4, 6] }],
      modifier: 3,
      total: 14,
    });
  });

  it('subtracts negative groups', () => {
    const roll = rollNotation(parsed('2d6-1d4-1'), () => 0.999);
    expect(roll.groups.map(g => g.results)).toEqual([[6, 6], [4]]);
    expect(roll.total).toBe(12 - 4 - 1);
  });

  it('can total below zero', () => {
    expect(rollNotation(parsed('1d4-10'), () => 0).total).toBe(-9);
  });

  it('allows more dice than the stepper does', () => {
    expect(rollNotation(parsed('30d6')).groups[0].results.length).toBe(30);
  });
});

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
