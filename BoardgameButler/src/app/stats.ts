import { Game } from './game';
import { parseRange } from './game-filter';
import { Play } from './play';
import { Player } from './player';

/**
 * Pure aggregations over the play log. Everything here is snapshot-aware:
 * plays of a deleted game or a removed player still count, flagged with
 * `inCollection` / `current` so the UI can label them.
 */

export interface Overview {
  totalPlays: number;
  /** Distinct games with at least one play. */
  gamesPlayed: number;
  /** Games in the collection with no plays. */
  neverPlayed: number;
  /** Sum of recorded durations, in minutes (plays without a duration contribute nothing). */
  totalMinutes: number;
  /** Plays dated within the last 30 days, inclusive of today. */
  playsLast30Days: number;
  mostPlayed: { title: string; plays: number } | null;
}

/** Plays grouped by how many people were at the table. */
export interface HeadCountBreakdown {
  players: number;
  plays: number;
  /** Mean recorded duration at this head-count, or null if none recorded. */
  avgMinutes: number | null;
}

export interface GameRow {
  gameId: string;
  title: string;
  inCollection: boolean;
  plays: number;
  lastPlayed: string | null;
  /** Mean head-count over plays that recorded one (explicitly or via named players), or null. */
  avgPlayers: number | null;
  /** Duration by head-count, ascending; only head-counts that occur. */
  byPlayers: HeadCountBreakdown[];
  /** Mean of recorded durations, or null if none recorded. */
  avgMinutes: number | null;
  /** The game's listed duration range from the collection, for comparison. */
  listedMinutes: { min: number; max: number } | null;
  /** Mean of recorded fun ratings, or null if none recorded. */
  avgFun: number | null;
}

export interface PlayerRow {
  playerId: string;
  name: string;
  /** False when the player has since been removed (name comes from snapshots). */
  current: boolean;
  plays: number;
  wins: number;
  /** wins / plays that had at least one winner recorded; null when none did. */
  winRate: number | null;
  mostPlayed: { title: string; plays: number } | null;
  lastPlayed: string | null;
}

/** The collection games tied for the fewest plays. */
export interface LeastPlayed {
  /** The lowest play count in the collection; 0 when something has never been played. */
  minPlays: number;
  /** Ids of every game on that count. */
  ids: Set<string>;
}

/**
 * "Show me what we never play." Once everything has been played at least
 * once, "never" has no answer, so this generalises to the lowest count there
 * is — the games most overdue a turn either way.
 */
export function leastPlayed(games: Game[], plays: Play[]): LeastPlayed {
  if (games.length === 0) return { minPlays: 0, ids: new Set() };

  const counts = new Map<string, number>(games.map(g => [g.id, 0]));
  for (const play of plays) {
    const current = counts.get(play.gameId);
    if (current !== undefined) counts.set(play.gameId, current + 1);
  }

  const minPlays = Math.min(...counts.values());
  const ids = new Set([...counts].filter(([, n]) => n === minPlays).map(([id]) => id));
  return { minPlays, ids };
}

export function overview(games: Game[], plays: Play[], today: string): Overview {
  const cutoff = shiftDate(today, -29);
  const playedIds = new Set(plays.map(p => p.gameId));
  const counts = countBy(plays, p => p.gameTitle);

  return {
    totalPlays: plays.length,
    gamesPlayed: playedIds.size,
    neverPlayed: games.filter(g => !playedIds.has(g.id)).length,
    totalMinutes: plays.reduce((sum, p) => sum + (p.durationMinutes ?? 0), 0),
    playsLast30Days: plays.filter(p => p.playedAt >= cutoff && p.playedAt <= today).length,
    mostPlayed: top(counts, (title, n) => ({ title, plays: n })),
  };
}

/** One row per game in the collection (never-played included) plus one per deleted game that still has plays. Sorted by plays desc, then title. */
export function gameRows(games: Game[], plays: Play[]): GameRow[] {
  const byGame = groupBy(plays, p => p.gameId);
  const rows: GameRow[] = games.map(g => row(g.id, g.title, true, byGame.get(g.id) ?? [], parseRange(g.duration)));

  const known = new Set(games.map(g => g.id));
  for (const [gameId, list] of byGame) {
    if (!known.has(gameId)) rows.push(row(gameId, latest(list).gameTitle, false, list, null));
  }

  return rows.sort((a, b) => b.plays - a.plays || a.title.localeCompare(b.title));
}

/** One row per current player plus one per removed player who still appears in plays. Sorted by plays desc, then name. */
export function playerRows(players: Player[], plays: Play[]): PlayerRow[] {
  const byPlayer = new Map<string, { name: string; plays: Play[] }>();
  for (const play of plays) {
    for (const participant of play.players) {
      const entry = byPlayer.get(participant.id) ?? { name: participant.name, plays: [] };
      entry.plays.push(play);
      byPlayer.set(participant.id, entry);
    }
  }

  const rows: PlayerRow[] = players.map(p => playerRow(p.id, p.name, true, byPlayer.get(p.id)?.plays ?? []));

  const known = new Set(players.map(p => p.id));
  for (const [id, entry] of byPlayer) {
    if (!known.has(id)) {
      // Use the most recent snapshot of the name.
      rows.push(playerRow(id, latest(entry.plays).players.find(p => p.id === id)?.name ?? entry.name, false, entry.plays));
    }
  }

  return rows.sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name));
}

// --- helpers

/** People at the table for a play: the explicit head-count, else the named players; null when unknown. */
export function headCount(play: Play): number | null {
  const n = play.playerCount ?? play.players.length;
  return n > 0 ? n : null;
}

function row(gameId: string, title: string, inCollection: boolean, list: Play[], listed: { min: number; max: number } | null): GameRow {
  const durations = list.map(p => p.durationMinutes).filter((d): d is number => d != null);
  const funs = list.map(p => p.funRating).filter((f): f is number => f != null);
  const counted = list.map(p => ({ play: p, n: headCount(p) })).filter((x): x is { play: Play; n: number } => x.n != null);

  const byPlayers: HeadCountBreakdown[] = [...groupBy(counted, x => x.n)]
    .map(([players, group]) => ({
      players,
      plays: group.length,
      avgMinutes: mean(group.map(x => x.play.durationMinutes).filter((d): d is number => d != null)),
    }))
    .sort((a, b) => a.players - b.players);

  return {
    gameId,
    title,
    inCollection,
    plays: list.length,
    lastPlayed: list.length ? latest(list).playedAt : null,
    avgPlayers: mean(counted.map(x => x.n)),
    byPlayers,
    avgMinutes: mean(durations),
    listedMinutes: listed && Number.isFinite(listed.max) ? listed : null,
    avgFun: mean(funs),
  };
}

function playerRow(playerId: string, name: string, current: boolean, list: Play[]): PlayerRow {
  const decided = list.filter(p => p.winnerIds.length > 0);
  const wins = list.filter(p => p.winnerIds.includes(playerId)).length;
  return {
    playerId,
    name,
    current,
    plays: list.length,
    wins,
    winRate: decided.length ? wins / decided.length : null,
    mostPlayed: top(countBy(list, p => p.gameTitle), (title, n) => ({ title, plays: n })),
    lastPlayed: list.length ? latest(list).playedAt : null,
  };
}

function latest(list: Play[]): Play {
  return list.reduce((best, p) => (p.playedAt > best.playedAt ? p : best), list[0]);
}

function mean(values: number[]): number | null {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
  return map;
}

/** Highest count wins; ties go to the alphabetically first key so results are stable. */
function top<R>(counts: Map<string, number>, make: (key: string, n: number) => R): R | null {
  let best: [string, number] | null = null;
  for (const [key, n] of counts) {
    if (!best || n > best[1] || (n === best[1] && key.localeCompare(best[0]) < 0)) best = [key, n];
  }
  return best ? make(best[0], best[1]) : null;
}

/** Shift a YYYY-MM-DD string by whole days without timezone drift. */
export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD in local time. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
