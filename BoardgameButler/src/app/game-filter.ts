import { Game } from './game';

export interface Range {
  min: number;
  max: number;
}

export interface GameFilters {
  /** How many people are playing; the game's player range must include it. */
  players: number | null;
  /** Minutes available; the game's longest listed duration must fit. */
  maxMinutes: number | null;
  /** Allowed complexities; empty means any. */
  complexities: string[];
  /** Games must be rated at least this; unrated games are excluded when set. */
  minRating: number | null;
}

export const EMPTY_FILTERS: GameFilters = {
  players: null,
  maxMinutes: null,
  complexities: [],
  minRating: null,
};

/**
 * Parse the free-text ranges stored on a game ("2-4", "60-120", "2", "2+").
 * Returns null when there is no leading number to work with.
 */
export function parseRange(value: string): Range | null {
  const match = value.trim().match(/^(\d+)\s*(?:(-|–|to)\s*(\d+)|(\+))?/i);
  if (!match) return null;

  const min = parseInt(match[1], 10);
  if (match[3] !== undefined) return { min, max: parseInt(match[3], 10) };
  if (match[4] !== undefined) return { min, max: Infinity };
  return { min, max: min };
}

export function hasActiveFilters(filters: GameFilters): boolean {
  return (
    filters.players != null ||
    filters.maxMinutes != null ||
    filters.complexities.length > 0 ||
    filters.minRating != null
  );
}

/**
 * A game matches when it satisfies every filter that is set. A game whose
 * players/duration text can't be parsed is excluded by the corresponding
 * filter, since we can't tell whether it fits.
 */
export function matchesFilters(game: Game, filters: GameFilters): boolean {
  if (filters.players != null) {
    const range = parseRange(game.players);
    if (!range || filters.players < range.min || filters.players > range.max) return false;
  }

  if (filters.maxMinutes != null) {
    const range = parseRange(game.duration);
    if (!range || range.max > filters.maxMinutes) return false;
  }

  if (filters.complexities.length > 0 && !filters.complexities.includes(game.complexity)) {
    return false;
  }

  if (filters.minRating != null) {
    if (game.rating == null || game.rating < filters.minRating) return false;
  }

  return true;
}

export function filterGames(games: Game[], filters: GameFilters): Game[] {
  return hasActiveFilters(filters) ? games.filter(g => matchesFilters(g, filters)) : games;
}
