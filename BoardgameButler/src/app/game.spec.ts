import { RawGame, formatRange, parseRange, playersText, playtimeText, upgradeGame } from './game';

describe('parseRange', () => {
  it.each([
    ['2-4', { min: 2, max: 4 }],
    ['60-120', { min: 60, max: 120 }],
    ['2', { min: 2, max: 2 }],
    ['2+', { min: 2, max: Infinity }],
    ['1 - 5', { min: 1, max: 5 }],
    ['2 to 6', { min: 2, max: 6 }],
    ['3–5', { min: 3, max: 5 }], // en dash
    ['  4-8 players', { min: 4, max: 8 }],
    ['120–240 Min', { min: 120, max: 240 }],
  ])('parses %j', (input, expected) => {
    expect(parseRange(input)).toEqual(expected);
  });

  it.each(['', 'any', 'lots', '-3'])('returns null for %j', input => {
    expect(parseRange(input)).toBeNull();
  });
});

describe('upgradeGame', () => {
  const legacy = (players: string, duration: string): RawGame => ({
    id: 'g-old',
    title: 'Old',
    players,
    duration,
    complexity: 'Medium',
    rating: 7,
  });

  it('splits older text ranges into numbers and drops the text', () => {
    expect(upgradeGame(legacy('3-4', '60-120'))).toEqual({
      id: 'g-old',
      title: 'Old',
      minPlayers: 3,
      maxPlayers: 4,
      minPlaytime: 60,
      maxPlaytime: 120,
      complexity: 'Medium',
      rating: 7,
    });
  });

  it('reads a single number as both ends', () => {
    expect(upgradeGame(legacy('2', '45'))).toMatchObject({ minPlayers: 2, maxPlayers: 2, minPlaytime: 45, maxPlaytime: 45 });
  });

  it('keeps an open-ended count open-ended rather than inventing a maximum', () => {
    const game = upgradeGame(legacy('2+', '30+'));
    expect(game).toMatchObject({ minPlayers: 2, minPlaytime: 30 });
    expect(game.maxPlayers).toBeUndefined();
    expect(game.maxPlaytime).toBeUndefined();
  });

  it('leaves the numbers unset when the text cannot be read', () => {
    const game = upgradeGame(legacy('any', 'varies'));
    expect(game).not.toHaveProperty('players');
    expect(game).not.toHaveProperty('duration');
    expect(game.minPlayers).toBeUndefined();
    expect(game.minPlaytime).toBeUndefined();
  });

  it('passes an already split game through unchanged', () => {
    const game: RawGame = { title: 'New', minPlayers: 1, maxPlayers: 5, minPlaytime: 40, maxPlaytime: 70, complexity: 'Easy', bggId: '266192', bggWeight: 2.4361 };
    expect(upgradeGame(game)).toEqual(game);
  });

  it('prefers the split numbers when a game somehow has both', () => {
    expect(upgradeGame({ ...legacy('9-9', '999'), minPlayers: 1, maxPlayers: 4, minPlaytime: 30, maxPlaytime: 60 })).toMatchObject({
      minPlayers: 1,
      maxPlayers: 4,
      minPlaytime: 30,
      maxPlaytime: 60,
    });
  });
});

describe('formatRange', () => {
  it.each([
    [2, 4, '2-4'],
    [2, 2, '2'],
    [2, undefined, '2+'],
    [undefined, 5, 'up to 5'],
    [undefined, undefined, ''],
  ])('shows %j to %j as %j', (min, max, expected) => {
    expect(formatRange(min, max)).toBe(expected);
  });

  it('reads a game', () => {
    const game = { minPlayers: 1, maxPlayers: 4, minPlaytime: 60, maxPlaytime: 120 };
    expect(playersText(game)).toBe('1-4');
    expect(playtimeText(game)).toBe('60-120');
  });
});
