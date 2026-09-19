import { Injectable, computed, signal } from '@angular/core';
import { assignIds, newId } from './ids';
import { Play, PlayDetails, RawPlay } from './play';

export const PLAYS_STORAGE_KEY = 'boardgame-butler.plays';

/**
 * The play log. Plays are append-only events, so a backup is *merged* by id
 * rather than replacing what's here — importing an old file can never lose
 * history. Stored in localStorage under its own key.
 */
@Injectable({ providedIn: 'root' })
export class PlayStore {
  private readonly _plays = signal<Play[]>([]);
  private readonly _error = signal<string | null>(null);

  /** In storage order (oldest first). */
  readonly plays = this._plays.asReadonly();
  /** Newest first, by played date then by insertion. */
  readonly recent = computed(() =>
    [...this._plays()]
      .map((play, index) => ({ play, index }))
      .sort((a, b) => b.play.playedAt.localeCompare(a.play.playedAt) || b.index - a.index)
      .map(({ play }) => play),
  );
  readonly error = this._error.asReadonly();

  constructor() {
    const saved = this.read();
    if (saved) this._plays.set(assignIds(saved));
  }

  find(id: string): Play | undefined {
    return this._plays().find(p => p.id === id);
  }

  forGame(gameId: string): Play[] {
    return this._plays().filter(p => p.gameId === gameId);
  }

  add(details: PlayDetails): Play {
    const play: Play = { id: newId(), ...details };
    this.commit([...this._plays(), play]);
    return play;
  }

  update(id: string, details: PlayDetails) {
    this.commit(this._plays().map(p => (p.id === id ? { id, ...details } : p)));
  }

  remove(id: string) {
    this.commit(this._plays().filter(p => p.id !== id));
  }

  /** Add plays whose id isn't already here. Returns how many were added. */
  merge(incoming: RawPlay[]): number {
    const existing = new Set(this._plays().map(p => p.id));
    const fresh = assignIds(incoming).filter(p => !existing.has(p.id));
    if (fresh.length > 0) this.commit([...this._plays(), ...fresh]);
    return fresh.length;
  }

  /** How many of `incoming` would be new if merged. */
  countNew(incoming: RawPlay[]): number {
    const existing = new Set(this._plays().map(p => p.id));
    return incoming.filter(p => !p.id || !existing.has(p.id)).length;
  }

  private commit(plays: Play[]) {
    this._plays.set(plays);
    try {
      localStorage.setItem(PLAYS_STORAGE_KEY, JSON.stringify(plays));
      this._error.set(null);
    } catch {
      this._error.set('Could not save your play history to this device.');
    }
  }

  private read(): RawPlay[] | null {
    try {
      const raw = localStorage.getItem(PLAYS_STORAGE_KEY);
      if (raw == null) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}
