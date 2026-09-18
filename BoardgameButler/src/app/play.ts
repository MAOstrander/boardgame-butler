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
  /** Ids of the winners; empty for a loss (co-op) or when not recorded. */
  winnerIds: string[];
  durationMinutes?: number;
  /** 1–10, how much fun this particular session was. */
  funRating?: number;
  notes?: string;
}

/** A play as it may arrive from a backup file — `id` is optional there. */
export type RawPlay = Omit<Play, 'id'> & { id?: string };

/** The editable fields of a play. */
export type PlayDetails = Omit<Play, 'id'>;
