import { Game } from './game';
import { EMPTY_FILTERS, GameFilters, filterGames, hasActiveFilters, matchesFilters } from './game-filter';

const game = (overrides: Partial<Game>): Game => ({
  id: 'g-test',
  title: 'Test',
  minPlayers: 2,
  maxPlayers: 4,
  minPlaytime: 60,
  maxPlaytime: 90,
  complexity: 'Medium',
  ...overrides,
});

const filters = (overrides: Partial<GameFilters>): GameFilters => ({ ...EMPTY_FILTERS, ...overrides });

const unknownPlayers = { minPlayers: undefined, maxPlayers: undefined };
const unknownPlaytime = { minPlaytime: undefined, maxPlaytime: undefined };

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
    expect(matchesFilters(game({ ...unknownPlayers, ...unknownPlaytime }), EMPTY_FILTERS)).toBe(true);
  });

  describe('players', () => {
    it('matches when the count is inside the range, inclusive', () => {
      expect(matchesFilters(game({ minPlayers: 2, maxPlayers: 4 }), filters({ players: 2 }))).toBe(true);
      expect(matchesFilters(game({ minPlayers: 2, maxPlayers: 4 }), filters({ players: 4 }))).toBe(true);
      expect(matchesFilters(game({ minPlayers: 2, maxPlayers: 4 }), filters({ players: 3 }))).toBe(true);
    });

    it('rejects counts outside the range', () => {
      expect(matchesFilters(game({ minPlayers: 2, maxPlayers: 4 }), filters({ players: 1 }))).toBe(false);
      expect(matchesFilters(game({ minPlayers: 2, maxPlayers: 4 }), filters({ players: 5 }))).toBe(false);
    });

    it('handles open-ended and single-value ranges', () => {
      expect(matchesFilters(game({ minPlayers: 3, maxPlayers: undefined }), filters({ players: 12 }))).toBe(true);
      expect(matchesFilters(game({ minPlayers: 3, maxPlayers: undefined }), filters({ players: 2 }))).toBe(false);
      expect(matchesFilters(game({ minPlayers: 2, maxPlayers: 2 }), filters({ players: 2 }))).toBe(true);
      expect(matchesFilters(game({ minPlayers: 2, maxPlayers: 2 }), filters({ players: 3 }))).toBe(false);
    });

    it('excludes games with no known player count', () => {
      expect(matchesFilters(game(unknownPlayers), filters({ players: 3 }))).toBe(false);
    });
  });

  describe('maxMinutes', () => {
    it('matches when the longest listed duration fits', () => {
      expect(matchesFilters(game({ minPlaytime: 30, maxPlaytime: 45 }), filters({ maxMinutes: 45 }))).toBe(true);
      expect(matchesFilters(game({ minPlaytime: 30, maxPlaytime: 45 }), filters({ maxMinutes: 60 }))).toBe(true);
    });

    it('rejects games that might run longer than the time available', () => {
      expect(matchesFilters(game({ minPlaytime: 45, maxPlaytime: 90 }), filters({ maxMinutes: 60 }))).toBe(false);
    });

    it('judges an open-ended play time by its minimum', () => {
      expect(matchesFilters(game({ minPlaytime: 45, maxPlaytime: undefined }), filters({ maxMinutes: 60 }))).toBe(true);
      expect(matchesFilters(game({ minPlaytime: 90, maxPlaytime: undefined }), filters({ maxMinutes: 60 }))).toBe(false);
    });

    it('excludes games with no known play time', () => {
      expect(matchesFilters(game(unknownPlaytime), filters({ maxMinutes: 60 }))).toBe(false);
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
    expect(matchesFilters(game({ minPlayers: 2, maxPlayers: 4, minPlaytime: 30, maxPlaytime: 45, complexity: 'Easy', rating: 9 }), f)).toBe(true);
    expect(matchesFilters(game({ minPlayers: 2, maxPlayers: 4, minPlaytime: 30, maxPlaytime: 45, complexity: 'Easy', rating: 7 }), f)).toBe(false);
    expect(matchesFilters(game({ minPlayers: 4, maxPlayers: 6, minPlaytime: 30, maxPlaytime: 45, complexity: 'Easy', rating: 9 }), f)).toBe(false);
  });
});

describe('filterGames', () => {
  const games = [
    game({ title: 'Azul', minPlayers: 2, maxPlayers: 4, minPlaytime: 30, maxPlaytime: 45, complexity: 'Easy', rating: 9 }),
    game({ title: 'Catan', minPlayers: 3, maxPlayers: 4, minPlaytime: 60, maxPlaytime: 120, complexity: 'Medium', rating: 7 }),
    game({ title: 'Gloomhaven', minPlayers: 1, maxPlayers: 4, minPlaytime: 60, maxPlaytime: 120, complexity: 'Hard' }),
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
