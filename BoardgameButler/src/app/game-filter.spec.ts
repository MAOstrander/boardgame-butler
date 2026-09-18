import { Game } from './game';
import { EMPTY_FILTERS, GameFilters, filterGames, hasActiveFilters, matchesFilters, parseRange } from './game-filter';

const game = (overrides: Partial<Game>): Game => ({
  title: 'Test',
  players: '2-4',
  duration: '60-90',
  complexity: 'Medium',
  ...overrides,
});

const filters = (overrides: Partial<GameFilters>): GameFilters => ({ ...EMPTY_FILTERS, ...overrides });

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
  ])('parses %j', (input, expected) => {
    expect(parseRange(input)).toEqual(expected);
  });

  it.each(['', 'any', 'lots', '-3'])('returns null for %j', input => {
    expect(parseRange(input)).toBeNull();
  });
});

describe('hasActiveFilters', () => {
  it('is false for the empty filters', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it.each<Partial<GameFilters>>([
    { players: 3 },
    { maxMinutes: 60 },
    { complexities: ['Easy'] },
    { minRating: 7 },
  ])('is true when %j is set', patch => {
    expect(hasActiveFilters(filters(patch))).toBe(true);
  });
});

describe('matchesFilters', () => {
  it('matches everything when no filters are set', () => {
    expect(matchesFilters(game({ players: 'any', duration: '?' }), EMPTY_FILTERS)).toBe(true);
  });

  describe('players', () => {
    it('matches when the count is inside the range, inclusive', () => {
      expect(matchesFilters(game({ players: '2-4' }), filters({ players: 2 }))).toBe(true);
      expect(matchesFilters(game({ players: '2-4' }), filters({ players: 4 }))).toBe(true);
      expect(matchesFilters(game({ players: '2-4' }), filters({ players: 3 }))).toBe(true);
    });

    it('rejects counts outside the range', () => {
      expect(matchesFilters(game({ players: '2-4' }), filters({ players: 1 }))).toBe(false);
      expect(matchesFilters(game({ players: '2-4' }), filters({ players: 5 }))).toBe(false);
    });

    it('handles open-ended and single-value ranges', () => {
      expect(matchesFilters(game({ players: '3+' }), filters({ players: 12 }))).toBe(true);
      expect(matchesFilters(game({ players: '2' }), filters({ players: 2 }))).toBe(true);
      expect(matchesFilters(game({ players: '2' }), filters({ players: 3 }))).toBe(false);
    });

    it('excludes games whose player text cannot be parsed', () => {
      expect(matchesFilters(game({ players: 'any' }), filters({ players: 3 }))).toBe(false);
    });
  });

  describe('maxMinutes', () => {
    it('matches when the longest listed duration fits', () => {
      expect(matchesFilters(game({ duration: '30-45' }), filters({ maxMinutes: 45 }))).toBe(true);
      expect(matchesFilters(game({ duration: '30-45' }), filters({ maxMinutes: 60 }))).toBe(true);
    });

    it('rejects games that might run longer than the time available', () => {
      expect(matchesFilters(game({ duration: '45-90' }), filters({ maxMinutes: 60 }))).toBe(false);
    });

    it('excludes games whose duration cannot be parsed', () => {
      expect(matchesFilters(game({ duration: 'varies' }), filters({ maxMinutes: 60 }))).toBe(false);
    });
  });

  describe('complexities', () => {
    it('matches any of the selected complexities', () => {
      const f = filters({ complexities: ['Easy', 'Hard'] });
      expect(matchesFilters(game({ complexity: 'Easy' }), f)).toBe(true);
      expect(matchesFilters(game({ complexity: 'Hard' }), f)).toBe(true);
      expect(matchesFilters(game({ complexity: 'Medium' }), f)).toBe(false);
    });
  });

  describe('minRating', () => {
    it('matches ratings at or above the minimum', () => {
      expect(matchesFilters(game({ rating: 7 }), filters({ minRating: 7 }))).toBe(true);
      expect(matchesFilters(game({ rating: 9 }), filters({ minRating: 7 }))).toBe(true);
      expect(matchesFilters(game({ rating: 6 }), filters({ minRating: 7 }))).toBe(false);
    });

    it('excludes unrated games', () => {
      expect(matchesFilters(game({ rating: undefined }), filters({ minRating: 5 }))).toBe(false);
    });
  });

  it('requires every set filter to pass', () => {
    const f = filters({ players: 3, maxMinutes: 60, complexities: ['Easy'], minRating: 8 });
    expect(matchesFilters(game({ players: '2-4', duration: '30-45', complexity: 'Easy', rating: 9 }), f)).toBe(true);
    expect(matchesFilters(game({ players: '2-4', duration: '30-45', complexity: 'Easy', rating: 7 }), f)).toBe(false);
    expect(matchesFilters(game({ players: '4-6', duration: '30-45', complexity: 'Easy', rating: 9 }), f)).toBe(false);
  });
});

describe('filterGames', () => {
  const games = [
    game({ title: 'Azul', players: '2-4', duration: '30-45', complexity: 'Easy', rating: 9 }),
    game({ title: 'Catan', players: '3-4', duration: '60-120', complexity: 'Medium', rating: 7 }),
    game({ title: 'Gloomhaven', players: '1-4', duration: '60-120', complexity: 'Hard' }),
  ];

  it('returns the same array when no filters are set', () => {
    expect(filterGames(games, EMPTY_FILTERS)).toBe(games);
  });

  it('returns only the matching games, in the original order', () => {
    expect(filterGames(games, filters({ players: 2 })).map(g => g.title)).toEqual(['Azul', 'Gloomhaven']);
    expect(filterGames(games, filters({ maxMinutes: 60 })).map(g => g.title)).toEqual(['Azul']);
    expect(filterGames(games, filters({ minRating: 7 })).map(g => g.title)).toEqual(['Azul', 'Catan']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterGames(games, filters({ players: 6 }))).toEqual([]);
  });
});
