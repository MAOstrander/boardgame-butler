import { Play } from './play';
import { gameRows, headCount, leastPlayed, overview, playerRows, shiftDate } from './stats';
import { SAMPLE_GAMES, SAMPLE_PLAYERS, SAMPLE_PLAYS } from '../testing/helpers';

// SAMPLE_PLAYS recap:
//   pl-1  Catan  2026-09-01  Sam, Alex        winner Alex   90 min  fun 7
//   pl-2  Azul   2026-09-10  Sam, Jo          winner Sam    35 min  fun 9
//   pl-3  Catan  2026-09-10  Sam, Alex, Jo    no winner     —       —

const TODAY = '2026-09-18';

describe('shiftDate', () => {
  it('moves whole days without timezone drift', () => {
    expect(shiftDate('2026-09-18', -29)).toBe('2026-08-20');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('overview', () => {
  it('summarises the log', () => {
    expect(overview(SAMPLE_GAMES, SAMPLE_PLAYS, TODAY)).toEqual({
      totalPlays: 3,
      gamesPlayed: 2,
      neverPlayed: 2, // Gloomhaven, Terraforming Mars
      totalMinutes: 125,
      playsLast30Days: 3,
      mostPlayed: { title: 'Catan', plays: 2 },
    });
  });

  it('counts only the last 30 days inclusive of today', () => {
    const plays: Play[] = [
      { ...SAMPLE_PLAYS[0], id: 'a', playedAt: '2026-08-20' }, // exactly 29 days ago → in
      { ...SAMPLE_PLAYS[0], id: 'b', playedAt: '2026-08-19' }, // 30 days ago → out
      { ...SAMPLE_PLAYS[0], id: 'c', playedAt: TODAY },
      { ...SAMPLE_PLAYS[0], id: 'd', playedAt: '2026-09-19' }, // future → out
    ];
    expect(overview(SAMPLE_GAMES, plays, TODAY).playsLast30Days).toBe(2);
  });

  it('breaks most-played ties alphabetically', () => {
    const plays = [SAMPLE_PLAYS[0], SAMPLE_PLAYS[1]]; // one Catan, one Azul
    expect(overview(SAMPLE_GAMES, plays, TODAY).mostPlayed).toEqual({ title: 'Azul', plays: 1 });
  });

  it('is all zeros with no plays', () => {
    expect(overview(SAMPLE_GAMES, [], TODAY)).toEqual({
      totalPlays: 0,
      gamesPlayed: 0,
      neverPlayed: 4,
      totalMinutes: 0,
      playsLast30Days: 0,
      mostPlayed: null,
    });
  });
});

describe('gameRows', () => {
  it('has a row per collection game, most played first, never-played last alphabetically', () => {
    const rows = gameRows(SAMPLE_GAMES, SAMPLE_PLAYS);
    expect(rows.map(r => [r.title, r.plays])).toEqual([
      ['Catan', 2],
      ['Azul', 1],
      ['Gloomhaven', 0],
      ['Terraforming Mars', 0],
    ]);
  });

  it('computes last played, averages and the listed range', () => {
    const catan = gameRows(SAMPLE_GAMES, SAMPLE_PLAYS)[0];
    expect(catan).toEqual({
      gameId: 'g-catan',
      title: 'Catan',
      inCollection: true,
      plays: 2,
      lastPlayed: '2026-09-10',
      avgPlayers: 2.5, // 2 named on pl-1, 3 on pl-3
      byPlayers: [
        { players: 2, plays: 1, avgMinutes: 90 },
        { players: 3, plays: 1, avgMinutes: null },
      ],
      avgMinutes: 90, // only pl-1 recorded a duration
      listedMinutes: { min: 60, max: 120 },
      avgFun: 7,
    });
  });

  describe('head-count', () => {
    it('prefers the explicit count over the named players, and treats zero as unknown', () => {
      expect(headCount(SAMPLE_PLAYS[0])).toBe(2);
      expect(headCount({ ...SAMPLE_PLAYS[0], playerCount: 5 })).toBe(5);
      expect(headCount({ ...SAMPLE_PLAYS[0], players: [], winnerIds: [] })).toBeNull();
      expect(headCount({ ...SAMPLE_PLAYS[0], players: [], winnerIds: [], playerCount: 3 })).toBe(3);
    });

    it('breaks duration down by how many played', () => {
      const plays: Play[] = [
        { ...SAMPLE_PLAYS[0], id: 'a', playerCount: 3, durationMinutes: 60 },
        { ...SAMPLE_PLAYS[0], id: 'b', playerCount: 3, durationMinutes: 80 },
        { ...SAMPLE_PLAYS[0], id: 'c', playerCount: 4, durationMinutes: 110 },
        { ...SAMPLE_PLAYS[0], id: 'd', playerCount: 4, durationMinutes: undefined },
        { ...SAMPLE_PLAYS[0], id: 'e', players: [], winnerIds: [], durationMinutes: 45 }, // unknown head-count
      ];
      const catan = gameRows(SAMPLE_GAMES, plays)[0];

      expect(catan.avgPlayers).toBe(3.5);
      expect(catan.byPlayers).toEqual([
        { players: 3, plays: 2, avgMinutes: 70 },
        { players: 4, plays: 2, avgMinutes: 110 },
      ]);
      expect(catan.avgMinutes).toBe(73.8); // the unknown-head-count play still counts toward the overall average
    });

    it('is null / empty when no play has a known head-count', () => {
      const plays = [{ ...SAMPLE_PLAYS[0], players: [], winnerIds: [] }];
      expect(gameRows(SAMPLE_GAMES, plays)[0]).toMatchObject({ avgPlayers: null, byPlayers: [] });
    });
  });

  it('rounds averages to one decimal', () => {
    const plays = [
      { ...SAMPLE_PLAYS[1], id: 'a', durationMinutes: 30, funRating: 8 },
      { ...SAMPLE_PLAYS[1], id: 'b', durationMinutes: 35, funRating: 9 },
      { ...SAMPLE_PLAYS[1], id: 'c', durationMinutes: 40, funRating: 9 },
    ];
    const azul = gameRows(SAMPLE_GAMES, plays)[0];
    expect(azul.avgMinutes).toBe(35);
    expect(azul.avgFun).toBe(8.7);
  });

  it('leaves averages null when nothing was recorded', () => {
    const gloom = gameRows(SAMPLE_GAMES, SAMPLE_PLAYS).find(r => r.title === 'Gloomhaven')!;
    expect(gloom).toMatchObject({ plays: 0, lastPlayed: null, avgPlayers: null, byPlayers: [], avgMinutes: null, avgFun: null });
  });

  it('includes deleted games that still have plays, using the latest title snapshot', () => {
    const games = SAMPLE_GAMES.filter(g => g.id !== 'g-catan');
    const plays = [SAMPLE_PLAYS[0], { ...SAMPLE_PLAYS[2], gameTitle: 'Catan (3rd ed.)' }, SAMPLE_PLAYS[1]];
    const row = gameRows(games, plays)[0];
    expect(row).toMatchObject({ gameId: 'g-catan', title: 'Catan (3rd ed.)', inCollection: false, plays: 2, listedMinutes: null });
  });

  it('ignores an open-ended listed range', () => {
    const games = [{ ...SAMPLE_GAMES[0], duration: '60+' }];
    expect(gameRows(games, SAMPLE_PLAYS)[0].listedMinutes).toBeNull();
  });
});

describe('leastPlayed', () => {
  it('picks the never-played games while any exist', () => {
    const { minPlays, ids } = leastPlayed(SAMPLE_GAMES, SAMPLE_PLAYS);
    expect(minPlays).toBe(0);
    expect([...ids]).toEqual(['g-gloom', 'g-tm']);
  });

  it('falls back to the lowest count once everything has been played', () => {
    // Catan 2, Azul 1, Gloomhaven 1, Terraforming Mars 1
    const plays = [
      ...SAMPLE_PLAYS,
      { ...SAMPLE_PLAYS[0], id: 'x', gameId: 'g-gloom' },
      { ...SAMPLE_PLAYS[0], id: 'y', gameId: 'g-tm' },
    ];
    const { minPlays, ids } = leastPlayed(SAMPLE_GAMES, plays);
    expect(minPlays).toBe(1);
    expect([...ids].sort()).toEqual(['g-azul', 'g-gloom', 'g-tm']);
  });

  it('returns every game when nothing has been played', () => {
    const { minPlays, ids } = leastPlayed(SAMPLE_GAMES, []);
    expect(minPlays).toBe(0);
    expect(ids.size).toBe(SAMPLE_GAMES.length);
  });

  it('ignores plays of games that are no longer in the collection', () => {
    const games = SAMPLE_GAMES.filter(g => g.id !== 'g-catan');
    const { minPlays, ids } = leastPlayed(games, SAMPLE_PLAYS);
    expect(minPlays).toBe(0);
    expect(ids.has('g-catan')).toBe(false);
  });

  it('handles an empty collection', () => {
    expect(leastPlayed([], SAMPLE_PLAYS)).toEqual({ minPlays: 0, ids: new Set() });
  });
});

describe('playerRows', () => {
  it('has a row per player, most plays first', () => {
    const rows = playerRows(SAMPLE_PLAYERS, SAMPLE_PLAYS);
    expect(rows.map(r => [r.name, r.plays, r.wins])).toEqual([
      ['Sam', 3, 1],
      ['Alex', 2, 1],
      ['Jo', 2, 0],
    ]);
  });

  it('computes win rate over decided plays only, most played game and last played', () => {
    const [sam, alex, jo] = playerRows(SAMPLE_PLAYERS, SAMPLE_PLAYS);
    // Sam: 3 plays, 2 with a winner recorded, won 1 → 50%
    expect(sam).toMatchObject({ winRate: 0.5, mostPlayed: { title: 'Catan', plays: 2 }, lastPlayed: '2026-09-10', current: true });
    // Alex: 2 plays, 1 decided, won it → 100%
    expect(alex).toMatchObject({ winRate: 1, mostPlayed: { title: 'Catan', plays: 2 } });
    // Jo: 2 plays, 1 decided (Azul), lost → 0%; tie on most played resolved alphabetically
    expect(jo).toMatchObject({ winRate: 0, mostPlayed: { title: 'Azul', plays: 1 } });
  });

  it('gives a null win rate when none of their plays recorded a winner', () => {
    const rows = playerRows(SAMPLE_PLAYERS, [SAMPLE_PLAYS[2]]);
    expect(rows.find(r => r.name === 'Sam')!.winRate).toBeNull();
  });

  it('includes players with no plays at the bottom', () => {
    const rows = playerRows([...SAMPLE_PLAYERS, { id: 'p-new', name: 'Riley' }], SAMPLE_PLAYS);
    expect(rows[3]).toMatchObject({ name: 'Riley', plays: 0, wins: 0, winRate: null, mostPlayed: null, lastPlayed: null });
  });

  it('includes removed players who appear in plays, using the latest name snapshot', () => {
    const players = SAMPLE_PLAYERS.filter(p => p.id !== 'p-alex');
    const plays = [SAMPLE_PLAYS[0], { ...SAMPLE_PLAYS[2], players: [{ id: 'p-sam', name: 'Sam' }, { id: 'p-alex', name: 'Alexandra' }] }];
    const alex = playerRows(players, plays).find(r => r.playerId === 'p-alex')!;
    expect(alex).toMatchObject({ name: 'Alexandra', current: false, plays: 2, wins: 1 });
  });

  it('is empty when there are no players and no plays', () => {
    expect(playerRows([], [])).toEqual([]);
  });
});
