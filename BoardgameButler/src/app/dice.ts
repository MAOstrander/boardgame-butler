export const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export const MAX_DICE = 10;

/** Limits for typed notation, generous for real games but stopping silly inputs. */
export const NOTATION_MAX_DICE = 100;
export const NOTATION_MAX_SIDES = 1000;
export const NOTATION_MAX_MODIFIER = 1000;

export interface DiceRoll {
  sides: number;
  count: number;
  results: number[];
  total: number;
}

/** Roll `count` dice with `sides` faces. `random` is injectable for tests. */
export function rollDice(sides: number, count: number, random: () => number = Math.random): DiceRoll {
  const n = Math.min(Math.max(1, Math.floor(count)), MAX_DICE);
  const results = rollGroup(sides, n, random);
  return { sides, count: n, results, total: sum(results) };
}

/** One group of identical dice in an expression, e.g. the `-1d4` in `2d6-1d4`. */
export interface DiceTerm {
  sign: 1 | -1;
  count: number;
  sides: number;
}

export interface Notation {
  /** Normalised text: lower case, no spaces, `d%` as `d100`, counts always written. */
  text: string;
  dice: DiceTerm[];
  /** The flat numbers added together, e.g. `+3`. */
  modifier: number;
}

export interface NotationRoll {
  notation: string;
  groups: (DiceTerm & { results: number[] })[];
  modifier: number;
  total: number;
}

const EXAMPLE = 'Try something like 3d6+3.';

/**
 * Read dice notation: dice groups (`3d6`, `d20`, `d%`) and whole numbers,
 * joined by + and -. Spaces and case are ignored. Returns an error message
 * for anything else.
 */
export function parseNotation(input: string): Notation | { error: string } {
  const compact = input.replace(/\s+/g, '').toLowerCase();
  if (!compact) return { error: `Type a roll. ${EXAMPLE}` };
  if (!/^[+-]?(\d*d(\d+|%)|\d+)([+-](\d*d(\d+|%)|\d+))*$/.test(compact)) {
    return { error: `Couldn't read "${input.trim()}". ${EXAMPLE}` };
  }

  const dice: DiceTerm[] = [];
  let modifier = 0;
  for (const [, signText, body] of compact.matchAll(/([+-]?)([^+-]+)/g)) {
    const sign = signText === '-' ? -1 : 1;
    const die = /^(\d*)d(\d+|%)$/.exec(body);
    if (!die) {
      modifier += sign * Number(body);
      continue;
    }
    const count = die[1] === '' ? 1 : Number(die[1]);
    const sides = die[2] === '%' ? 100 : Number(die[2]);
    if (count < 1) return { error: `Roll at least one die in "${body}".` };
    if (sides < 2 || sides > NOTATION_MAX_SIDES) {
      return { error: `Dice need between 2 and ${NOTATION_MAX_SIDES} sides.` };
    }
    dice.push({ sign, count, sides });
  }

  if (dice.length === 0) return { error: `Include at least one die. ${EXAMPLE}` };
  if (sum(dice.map(d => d.count)) > NOTATION_MAX_DICE) {
    return { error: `That's more than ${NOTATION_MAX_DICE} dice.` };
  }
  if (Math.abs(modifier) > NOTATION_MAX_MODIFIER) {
    return { error: `Keep the added number within ±${NOTATION_MAX_MODIFIER}.` };
  }
  return { text: formatNotation(dice, modifier), dice, modifier };
}

/** Roll a parsed expression. `random` is injectable for tests. */
export function rollNotation(notation: Notation, random: () => number = Math.random): NotationRoll {
  const groups = notation.dice.map(d => ({ ...d, results: rollGroup(d.sides, d.count, random) }));
  const total = sum(groups.map(g => g.sign * sum(g.results))) + notation.modifier;
  return { notation: notation.text, groups, modifier: notation.modifier, total };
}

function formatNotation(dice: DiceTerm[], modifier: number): string {
  const parts = dice.map((d, i) => `${d.sign < 0 ? '-' : i > 0 ? '+' : ''}${d.count}d${d.sides}`);
  if (modifier !== 0) parts.push(modifier < 0 ? `${modifier}` : `+${modifier}`);
  return parts.join('');
}

function rollGroup(sides: number, count: number, random: () => number): number[] {
  return Array.from({ length: count }, () => 1 + Math.floor(random() * sides));
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
