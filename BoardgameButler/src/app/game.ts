export interface Game {
  /** Stable identifier, assigned by GameStore. */
  id: string;
  title: string;
  /**
   * Player count and play time are stored as separate numbers, the same shape
   * BGG publish them in, so a looked-up game keeps BGG's figures exactly.
   *
   * They are optional only because older saved text ("2+", "varies") cannot
   * always be read as two numbers. The game form requires all four.
   */
  minPlayers?: number;
  /** Absent for an open-ended count such as "2+". */
  maxPlayers?: number;
  minPlaytime?: number;
  maxPlaytime?: number;
  /** Our own judgement; never derived from BGG. */
  complexity: string;
  rating?: number;
  /** The BGG id this game was looked up from, for linking back. */
  bggId?: string;
  /** BGG's community weight (1 to 5) as of the lookup, stored exactly as BGG sent it. */
  bggWeight?: number;
}

/**
 * A game as it may arrive from an imported file, the bundled seed or older
 * saved data. `id` is optional there, and files from before the split carry
 * `players` and `duration` as text instead of the four numbers.
 */
export type RawGame = Omit<Game, 'id'> & { id?: string; players?: string; duration?: string };

/** The editable fields of a game. */
export type GameDetails = Omit<Game, 'id'>;

export interface Range {
  min: number;
  max: number;
}

/**
 * Read the free text older versions stored ("2-4", "60-120", "2", "2+").
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

/**
 * Bring a game into the current shape. Games already split pass through
 * unchanged; older text fields are converted and then dropped.
 */
export function upgradeGame<T extends RawGame>(raw: T): Omit<T, 'players' | 'duration'> {
  const { players, duration, ...game } = raw;
  const upgraded: RawGame = { ...game };

  if (upgraded.minPlayers == null && typeof players === 'string') {
    const range = parseRange(players);
    if (range) {
      upgraded.minPlayers = range.min;
      if (range.max !== Infinity) upgraded.maxPlayers = range.max;
    }
  }
  if (upgraded.minPlaytime == null && typeof duration === 'string') {
    const range = parseRange(duration);
    if (range) {
      upgraded.minPlaytime = range.min;
      if (range.max !== Infinity) upgraded.maxPlaytime = range.max;
    }
  }
  return upgraded as Omit<T, 'players' | 'duration'>;
}

/** "2-4", "2" when both ends match, "2+" when open-ended, "" when unknown. */
export function formatRange(min?: number, max?: number): string {
  if (min == null) return max == null ? '' : `up to ${max}`;
  if (max == null) return `${min}+`;
  return min === max ? String(min) : `${min}-${max}`;
}

export function playersText(game: Pick<Game, 'minPlayers' | 'maxPlayers'>): string {
  return formatRange(game.minPlayers, game.maxPlayers);
}

export function playtimeText(game: Pick<Game, 'minPlaytime' | 'maxPlaytime'>): string {
  return formatRange(game.minPlaytime, game.maxPlaytime);
}
