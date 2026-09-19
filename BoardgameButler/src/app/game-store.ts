import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Game, GameDetails, RawGame } from './game';
import { assignIds, newId } from './ids';
import { normalizeKey } from './normalize';

export const STORAGE_KEY = 'boardgame-butler.games';

/**
 * The collection lives in localStorage so the installed app works fully
 * offline. On the very first run (no saved collection) it is seeded from the
 * bundled games.json, which the service worker also caches.
 *
 * Every game gets a stable `id`. Files and older saved collections may lack
 * one, so everything entering the store passes through `assignIds()`.
 */
@Injectable({ providedIn: 'root' })
export class GameStore {
  private http = inject(HttpClient);

  private readonly _games = signal<Game[]>([]);
  private readonly _ready = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly games = this._games.asReadonly();
  /** False until the collection has been loaded from storage or seeded. */
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

  find(id: string): Game | undefined {
    return this._games().find(g => g.id === id);
  }

  /** Case-insensitive, whitespace-trimmed title check. `excludeId` ignores that game (for edits). */
  hasTitle(title: string, excludeId?: string): boolean {
    const wanted = normalizeKey(title);
    return this._games().some(g => g.id !== excludeId && normalizeKey(g.title) === wanted);
  }

  add(details: GameDetails): Game {
    const game: Game = { id: newId(), ...details };
    this.commit([...this._games(), game]);
    return game;
  }

  update(id: string, details: GameDetails) {
    this.commit(this._games().map(g => (g.id === id ? { id, ...details } : g)));
  }

  remove(id: string) {
    this.commit(this._games().filter(g => g.id !== id));
  }

  replaceAll(games: RawGame[]) {
    this.commit(assignIds(games));
  }

  /** Serialised collection, formatted the same way games.json ships. */
  toJson(): string {
    return JSON.stringify(this._games(), null, 2);
  }

  private commit(games: Game[]) {
    this._games.set(games);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
      this._error.set(null);
    } catch {
      this._error.set('Could not save your collection to this device.');
    }
  }

  private read(): RawGame[] | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw == null) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private seed() {
    this.http.get<RawGame[]>('/games.json').subscribe({
      next: games => {
        this.commit(assignIds(games));
        this._ready.set(true);
      },
      error: () => {
        this._error.set('Could not load the starter collection.');
        this._ready.set(true);
      },
    });
  }
}
