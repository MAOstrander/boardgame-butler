import { RawGame } from './game';
import { normalizeTitle } from './game-store';

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

  for (const game of games) {
    const key = normalizeTitle(String(game.title ?? ''));
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

const COMPARED_FIELDS: (keyof RawGame)[] = ['players', 'duration', 'complexity', 'rating'];

function differences(kept: RawGame, skipped: RawGame): string[] {
  return COMPARED_FIELDS.filter(f => (kept[f] ?? null) !== (skipped[f] ?? null)).map(f =>
    skipped[f] == null ? `no ${f}` : `${f} ${skipped[f]}`,
  );
}
