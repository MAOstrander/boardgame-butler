import games from '../../public/games.json';
import players from '../../public/players.json';
import plays from '../../public/plays.json';
import { parseRange } from './game-filter';
import { normalizeKey } from './normalize';

/**
 * The bundled sample data is hand-written, so these checks guard the things a
 * typo would break: unique ids, plays pointing at games and players that
 * exist, and snapshots matching the entities they name.
 */
describe('bundled seed data', () => {
  const gameIds = new Set(games.map(g => g.id));
  const playerIds = new Set(players.map(p => p.id));
  const gameById = new Map(games.map(g => [g.id, g]));
  const playerById = new Map(players.map(p => [p.id, p]));

  describe('games.json', () => {
    it('gives every game a unique id and a title', () => {
      expect(gameIds.size).toBe(games.length);
      for (const game of games) {
        expect(game.id).toMatch(/\S/);
        expect(game.title).toMatch(/\S/);
      }
    });

    it('uses titles that are unique the way the app compares them', () => {
      const keys = games.map(g => normalizeKey(g.title));
      expect(new Set(keys).size).toBe(games.length);
    });

    it('uses player and duration ranges the filters can parse', () => {
      for (const game of games) {
        expect(parseRange(game.players), `players of ${game.title}`).not.toBeNull();
        expect(parseRange(game.duration), `duration of ${game.title}`).not.toBeNull();
      }
    });

    it('uses a known complexity and an in-range rating', () => {
      for (const game of games) {
        expect(['Easy', 'Medium', 'Hard']).toContain(game.complexity);
        const rating = (game as { rating?: number }).rating;
        if (rating !== undefined) {
          expect(rating).toBeGreaterThanOrEqual(1);
          expect(rating).toBeLessThanOrEqual(10);
        }
      }
    });

    it('leaves some games unrated and some unplayed, so the empty cases are visible', () => {
      expect(games.some(g => (g as { rating?: number }).rating === undefined)).toBe(true);
      const played = new Set(plays.map(p => p.gameId));
      expect(games.some(g => !played.has(g.id))).toBe(true);
    });
  });

  describe('players.json', () => {
    it('gives every player a unique id and a name', () => {
      expect(playerIds.size).toBe(players.length);
      for (const player of players) {
        expect(player.id).toMatch(/\S/);
        expect(player.name).toMatch(/\S/);
      }
    });

    it('uses names that are unique the way the app compares them', () => {
      const keys = players.map(p => normalizeKey(p.name));
      expect(new Set(keys).size).toBe(players.length);
    });
  });

  describe('plays.json', () => {
    it('gives every play a unique id', () => {
      const ids = plays.map(p => p.id);
      expect(new Set(ids).size).toBe(plays.length);
    });

    it('references games that exist, with a matching title snapshot', () => {
      for (const play of plays) {
        expect(gameIds, `gameId of ${play.id}`).toContain(play.gameId);
        expect(play.gameTitle).toBe(gameById.get(play.gameId)!.title);
      }
    });

    it('references players that exist, with matching name snapshots', () => {
      for (const play of plays) {
        for (const participant of play.players) {
          expect(playerIds, `player of ${play.id}`).toContain(participant.id);
          expect(participant.name).toBe(playerById.get(participant.id)!.name);
        }
      }
    });

    it('only names winners who took part', () => {
      for (const play of plays) {
        const took = play.players.map(p => p.id);
        for (const winner of play.winnerIds) {
          expect(took, `winner of ${play.id}`).toContain(winner);
        }
      }
    });

    it('uses sane dates, head-counts, durations and ratings', () => {
      for (const play of plays) {
        expect(play.daysAgo).toBeGreaterThanOrEqual(0);

        const count = (play as { playerCount?: number }).playerCount;
        if (count !== undefined) {
          // A head-count below the named players would be contradictory.
          expect(count, `playerCount of ${play.id}`).toBeGreaterThanOrEqual(play.players.length);
        }

        const duration = (play as { durationMinutes?: number }).durationMinutes;
        if (duration !== undefined) expect(duration).toBeGreaterThan(0);

        const fun = (play as { funRating?: number }).funRating;
        if (fun !== undefined) {
          expect(fun).toBeGreaterThanOrEqual(1);
          expect(fun).toBeLessThanOrEqual(10);
        }
      }
    });

    it('covers the cases the stats page is meant to show off', () => {
      // A co-op loss (no winner), so win rate over "decided" plays is visible.
      expect(plays.some(p => p.winnerIds.length === 0)).toBe(true);
      // A shared win, for co-op victories and team games.
      expect(plays.some(p => p.winnerIds.length > 1)).toBe(true);
      // A head-count above the named players, for the "N players" chip.
      expect(plays.some(p => ((p as { playerCount?: number }).playerCount ?? 0) > p.players.length)).toBe(true);
      // A play with no fun rating, so the dash renders somewhere.
      expect(plays.some(p => (p as { funRating?: number }).funRating === undefined)).toBe(true);
      // Plays inside and outside the 30-day window, so that tile is non-trivial.
      expect(plays.some(p => p.daysAgo <= 29)).toBe(true);
      expect(plays.some(p => p.daysAgo > 29)).toBe(true);
      // The same game at more than one head-count, for the duration breakdown.
      const counts = new Map<string, Set<number>>();
      for (const p of plays) {
        const n = (p as { playerCount?: number }).playerCount ?? p.players.length;
        counts.set(p.gameId, (counts.get(p.gameId) ?? new Set()).add(n));
      }
      expect([...counts.values()].some(set => set.size > 1)).toBe(true);
    });
  });
});
