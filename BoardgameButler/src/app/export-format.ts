import { Game, RawGame } from './game';
import { Player, RawPlayer } from './player';
import { Play, RawPlay } from './play';

/**
 * The backup file format.
 *   v1 — a bare array of games
 *   v2 — { version, games, players }
 *   v3 — adds a plays section
 * Import accepts all of them; a section a file doesn't have is left alone on
 * the device.
 */
export const EXPORT_VERSION = 3;

export interface ExportFile {
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  games: Game[];
  players: Player[];
  plays: Play[];
}

export interface ParsedImport {
  version: 1 | 2 | 3;
  games: RawGame[];
  /** null when the file predates players (v1) — the device's players are left untouched. */
  players: RawPlayer[] | null;
  /** null when the file predates plays (v1/v2) — the device's history is left untouched. */
  plays: RawPlay[] | null;
}

export function buildExport(games: Game[], players: Player[], plays: Play[]): ExportFile {
  return { version: EXPORT_VERSION, exportedAt: new Date().toISOString(), games, players, plays };
}

/** Interpret parsed JSON as a backup file, or return an error message. */
export function parseImport(data: unknown): ParsedImport | { error: string } {
  if (Array.isArray(data)) {
    return { version: 1, games: data, players: null, plays: null };
  }

  if (data && typeof data === 'object' && 'games' in data) {
    const file = data as { games?: unknown; players?: unknown; plays?: unknown };
    if (!Array.isArray(file.games)) {
      return { error: 'The "games" entry must be a JSON array.' };
    }
    if (file.players !== undefined && !Array.isArray(file.players)) {
      return { error: 'The "players" entry must be a JSON array.' };
    }
    if (file.plays !== undefined && !Array.isArray(file.plays)) {
      return { error: 'The "plays" entry must be a JSON array.' };
    }

    const hasPlays = file.plays !== undefined;
    return {
      version: hasPlays ? 3 : 2,
      games: file.games,
      players: (file.players as RawPlayer[] | undefined) ?? [],
      plays: hasPlays ? (file.plays as RawPlay[]) : null,
    };
  }

  return { error: 'File must contain a JSON array of games, or a backup exported by this app.' };
}
