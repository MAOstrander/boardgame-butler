export interface Player {
  /** Stable identifier, assigned by PlayerStore. */
  id: string;
  name: string;
}

/** A player as it may arrive from an imported file — `id` is optional there. */
export type RawPlayer = Omit<Player, 'id'> & { id?: string };
