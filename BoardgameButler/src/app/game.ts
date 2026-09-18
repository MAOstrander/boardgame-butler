export interface Game {
  /** Stable identifier, assigned by GameStore. */
  id: string;
  title: string;
  players: string;
  duration: string;
  complexity: string;
  rating?: number;
}

/** A game as it may arrive from an imported or bundled JSON file — `id` is optional there. */
export type RawGame = Omit<Game, 'id'> & { id?: string };

/** The editable fields of a game. */
export type GameDetails = Omit<Game, 'id'>;
