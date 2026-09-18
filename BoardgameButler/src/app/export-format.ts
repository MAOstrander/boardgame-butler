import { Game, RawGame } from './game';
import { Player, RawPlayer } from './player';

/**
 * The backup file format. Version 1 was a bare array of games; version 2 is
 * an object that also carries players. Import accepts both.
 */
export const EXPORT_VERSION = 2;

export interface ExportFile {
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  games: Game[];
  players: Player[];
}

export interface ParsedImport {
  /** 1 for a bare array, 2 for the current object format. */
  version: 1 | 2;
  games: RawGame[];
  /** null when the file predates players (v1) — the device's players are left untouched. */
  players: RawPlayer[] | null;
}

export function buildExport(games: Game[], players: Player[]): ExportFile {
  return { version: EXPORT_VERSION, exportedAt: new Date().toISOString(), games, players };
}

/** Interpret parsed JSON as a backup file, or return an error message. */
export function parseImport(data: unknown): ParsedImport | { error: string } {
  if (Array.isArray(data)) {
    return { version: 1, games: data, players: null };
  }

  if (data && typeof data === 'object' && 'games' in data) {
    const file = data as { version?: unknown; games?: unknown; players?: unknown };
    if (!Array.isArray(file.games)) {
      return { error: 'The "games" entry must be a JSON array.' };
    }
    if (file.players !== undefined && !Array.isArray(file.players)) {
      return { error: 'The "players" entry must be a JSON array.' };
    }
    return { version: 2, games: file.games, players: (file.players as RawPlayer[] | undefined) ?? [] };
  }

  return { error: 'File must contain a JSON array of games, or a backup exported by this app.' };
}
