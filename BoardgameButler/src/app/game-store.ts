import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Game } from './game';

export const STORAGE_KEY = 'boardgame-butler.games';

/**
 * The collection lives in localStorage so the installed app works fully
 * offline. On the very first run (no saved collection) it is seeded from the
 * bundled games.json, which the service worker also caches.
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
      this._games.set(saved);
      this._ready.set(true);
    } else {
      this.seed();
    }
  }

  add(game: Game) {
    this.commit([...this._games(), game]);
  }

  replaceAll(games: Game[]) {
    this.commit(games);
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

  private read(): Game[] | null {
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
    this.http.get<Game[]>('/games.json').subscribe({
      next: games => {
        this.commit(games);
        this._ready.set(true);
      },
      error: () => {
        this._error.set('Could not load the starter collection.');
        this._ready.set(true);
      },
    });
  }
}
