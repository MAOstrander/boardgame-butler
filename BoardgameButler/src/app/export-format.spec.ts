import { buildExport, parseImport } from './export-format';
import { SAMPLE_GAMES, SAMPLE_PLAYERS } from '../testing/helpers';

describe('buildExport', () => {
  it('produces a version-2 file with games, players and a timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T12:00:00Z'));
    const file = buildExport(SAMPLE_GAMES, SAMPLE_PLAYERS);
    vi.useRealTimers();

    expect(file).toEqual({
      version: 2,
      exportedAt: '2026-09-18T12:00:00.000Z',
      games: SAMPLE_GAMES,
      players: SAMPLE_PLAYERS,
    });
  });
});

describe('parseImport', () => {
  it('reads a bare array as version 1 with no players', () => {
    expect(parseImport(SAMPLE_GAMES)).toEqual({ version: 1, games: SAMPLE_GAMES, players: null });
  });

  it('reads a version-2 object', () => {
    const file = buildExport(SAMPLE_GAMES, SAMPLE_PLAYERS);
    expect(parseImport(file)).toEqual({ version: 2, games: SAMPLE_GAMES, players: SAMPLE_PLAYERS });
  });

  it('treats a missing players entry as an empty list', () => {
    expect(parseImport({ version: 2, games: SAMPLE_GAMES })).toEqual({ version: 2, games: SAMPLE_GAMES, players: [] });
  });

  it('rejects an object whose games entry is not an array', () => {
    expect(parseImport({ games: 'nope' })).toEqual({ error: 'The "games" entry must be a JSON array.' });
  });

  it('rejects an object whose players entry is not an array', () => {
    expect(parseImport({ games: [], players: {} })).toEqual({ error: 'The "players" entry must be a JSON array.' });
  });

  it.each([null, 42, 'text', { title: 'Catan' }, {}])('rejects %j', data => {
    expect(parseImport(data)).toEqual({
      error: 'File must contain a JSON array of games, or a backup exported by this app.',
    });
  });
});
