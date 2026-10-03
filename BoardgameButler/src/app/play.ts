/** A person who took part in a play, snapshotted so the record survives renames and removals. */
export interface PlayParticipant {
  id: string;
  name: string;
}

/**
 * One logged session of a game. Game and player names are snapshotted at
 * logging time so history still reads correctly if a game or player is later
 * deleted or renamed; the ids let statistics group across snapshots.
 */
export interface Play {
  id: string;
  gameId: string;
  gameTitle: string;
  /** Calendar date, YYYY-MM-DD. */
  playedAt: string;
  players: PlayParticipant[];
  /**
   * How many people were at the table, including anyone not in the players
   * list. Defaults to `players.length` when logging; never less than it.
   */
  playerCount?: number;
  /** Ids of the winners; empty for a loss (co-op) or when not recorded. */
  winnerIds: string[];
  durationMinutes?: number;
  /** 1–10, how much fun this particular session was. */
  funRating?: number;
  notes?: string;
}

/** A play as it may arrive from a backup file — `id` is optional there. */
export type RawPlay = Omit<Play, 'id'> & { id?: string };

/**
 * A play in the bundled seed file. Dates are relative (`daysAgo`) rather than
 * fixed so the sample history stays plausible however long after release the
 * app is first opened.
 */
export type SeedPlay = Omit<RawPlay, 'playedAt'> & { daysAgo: number };

/** The editable fields of a play. */
export type PlayDetails = Omit<Play, 'id'>;
