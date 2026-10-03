import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { assignIds, newId } from './ids';
import { normalizeKey } from './normalize';
import { Player, RawPlayer } from './player';

export const PLAYERS_STORAGE_KEY = 'boardgame-butler.players';

/**
 * The people you play with. Kept as entities (not free text) so play
 * statistics can group by player without "Matt" and "matt" splitting.
 * Stored in localStorage alongside the games, under its own key, and seeded
 * from the bundled players.json on a device that has never saved any.
 */
@Injectable({ providedIn: 'root' })
export class PlayerStore {
  private http = inject(HttpClient);

  private readonly _players = signal<Player[]>([]);
  private readonly _ready = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly players = this._players.asReadonly();
  /** False until the players have been loaded from storage or seeded. */
  readonly ready = this._ready.asReadonly();
  readonly error = this._error.asReadonly();

  constructor() {
    const saved = this.read();
    if (saved) {
      this.commit(assignIds(saved));
      this._ready.set(true);
    } else {
      this.seed();
    }
  }

  find(id: string): Player | undefined {
    return this._players().find(p => p.id === id);
  }

  /** Case-insensitive, whitespace-trimmed name check. `excludeId` ignores that player (for renames). */
  hasName(name: string, excludeId?: string): boolean {
    const wanted = normalizeKey(name);
    return this._players().some(p => p.id !== excludeId && normalizeKey(p.name) === wanted);
  }

  add(name: string): Player {
    const player: Player = { id: newId(), name: name.trim() };
    this.commit([...this._players(), player]);
    return player;
  }

  rename(id: string, name: string) {
    this.commit(this._players().map(p => (p.id === id ? { ...p, name: name.trim() } : p)));
  }

  remove(id: string) {
    this.commit(this._players().filter(p => p.id !== id));
  }

  replaceAll(players: RawPlayer[]) {
    this.commit(assignIds(players));
  }

  private seed() {
    // Relative so it resolves against <base href> when hosted under a sub-path.
    this.http.get<RawPlayer[]>('players.json').subscribe({
      next: players => {
        this.commit(assignIds(players));
        this._ready.set(true);
      },
      error: () => {
        this._error.set('Could not load the starter players.');
        this._ready.set(true);
      },
    });
  }

  private commit(players: Player[]) {
    this._players.set(players);
    try {
      localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players));
      this._error.set(null);
    } catch {
      this._error.set('Could not save your players to this device.');
    }
  }

  private read(): RawPlayer[] | null {
    try {
      const raw = localStorage.getItem(PLAYERS_STORAGE_KEY);
      if (raw == null) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}
