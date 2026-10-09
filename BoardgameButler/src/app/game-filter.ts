import { Game } from './game';

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

export function hasActiveFilters(filters: GameFilters): boolean {
  return (
    filters.players != null ||
    filters.maxMinutes != null ||
    filters.complexities.length > 0 ||
    filters.minRating != null
  );
}

/**
 * A game matches when it satisfies every filter that is set. A game with no
 * known player count or play time is excluded by the corresponding filter,
 * since we can't tell whether it fits. An open-ended player count ("2+") has
 * no upper limit; an open-ended play time is judged by its minimum.
 */
export function matchesFilters(game: Game, filters: GameFilters): boolean {
  if (filters.players != null) {
    const { minPlayers: min, maxPlayers: max } = game;
    if (min == null || filters.players < min || (max != null && filters.players > max)) return false;
  }

  if (filters.maxMinutes != null) {
    const longest = game.maxPlaytime ?? game.minPlaytime;
    if (longest == null || longest > filters.maxMinutes) return false;
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
