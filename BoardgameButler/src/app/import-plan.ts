import { RawGame, playersText, playtimeText, upgradeGame } from './game';
import { RawPlayer } from './player';
import { normalizeKey } from './normalize';

export interface ImportRow {
  game: RawGame;
  /** Title of the earlier row this one duplicates; undefined for rows that will be imported. */
  duplicateOf?: string;
  /** Human-readable fields where this skipped row differs from the kept one, e.g. "rating 9". */
  differences: string[];
}

export interface ImportPlan {
  rows: ImportRow[];
  /** The games that will actually be imported, in file order. */
  kept: RawGame[];
  skipped: number;
}

/**
 * Work out what an import will do with a file: the first game with a given
 * title (case-insensitive, trimmed) is kept, later ones are skipped. Skipped
 * rows note how they differ from the kept row so the user can decide whether
 * "first wins" is what they want.
 */
export function planImport(games: RawGame[]): ImportPlan {
  const firstByTitle = new Map<string, RawGame>();
  const rows: ImportRow[] = [];
  const kept: RawGame[] = [];

  // Older files carry players and duration as text; compare like with like.
  for (const game of games.map(upgradeGame)) {
    const key = normalizeKey(String(game.title ?? ''));
    const first = firstByTitle.get(key);

    if (first) {
      rows.push({ game, duplicateOf: first.title, differences: differences(first, game) });
    } else {
      firstByTitle.set(key, game);
      rows.push({ game, differences: [] });
      kept.push(game);
    }
  }

  return { rows, kept, skipped: rows.length - kept.length };
}

/** Each compared field as the user would read it, or '' when absent. */
const COMPARED_FIELDS: [label: string, read: (game: RawGame) => string][] = [
  ['players', playersText],
  ['minutes', playtimeText],
  ['complexity', g => g.complexity ?? ''],
  ['rating', g => (g.rating == null ? '' : String(g.rating))],
];

function differences(kept: RawGame, skipped: RawGame): string[] {
  return COMPARED_FIELDS.filter(([, read]) => read(kept) !== read(skipped)).map(([label, read]) =>
    read(skipped) === '' ? `no ${label}` : `${label} ${read(skipped)}`,
  );
}

export interface PlayerImportRow {
  player: RawPlayer;
  duplicateOf?: string;
}

export interface PlayerImportPlan {
  rows: PlayerImportRow[];
  kept: RawPlayer[];
  skipped: number;
}

/** Same first-wins rule for players, keyed on name. */
export function planPlayerImport(players: RawPlayer[]): PlayerImportPlan {
  const firstByName = new Map<string, RawPlayer>();
  const rows: PlayerImportRow[] = [];
  const kept: RawPlayer[] = [];

  for (const player of players) {
    const key = normalizeKey(String(player.name ?? ''));
    const first = firstByName.get(key);

    if (first) {
      rows.push({ player, duplicateOf: first.name });
    } else {
      firstByName.set(key, player);
      rows.push({ player });
      kept.push(player);
    }
  }

  return { rows, kept, skipped: rows.length - kept.length };
}
