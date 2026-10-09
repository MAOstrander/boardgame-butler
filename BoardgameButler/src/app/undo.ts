import { Injectable, signal } from '@angular/core';

export interface UndoOffer {
  message: string;
  undo: () => void;
}

/** How long an offer stays on screen. */
export const UNDO_WINDOW_MS = 8000;

/**
 * A single pending "that's gone - unless you say otherwise".
 *
 * Deleting a game, player or play is immediate and there is no server copy to
 * fall back on, so every delete hands its reversal here and the app shows a
 * toast for a few seconds. Only one offer exists at a time; a second delete
 * replaces the first, which is then no longer reversible.
 */
@Injectable({ providedIn: 'root' })
export class UndoService {
  private readonly _offer = signal<UndoOffer | null>(null);
  readonly offer = this._offer.asReadonly();

  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Show `message` with an undo action for a few seconds. */
  propose(message: string, undo: () => void, ms = UNDO_WINDOW_MS): void {
    this.stopTimer();
    this._offer.set({ message, undo });
    this.timer = setTimeout(() => this.dismiss(), ms);
  }

  /** Run the pending reversal, if the window hasn't closed. */
  accept(): void {
    const offer = this._offer();
    this.dismiss();
    offer?.undo();
  }

  dismiss(): void {
    this.stopTimer();
    this._offer.set(null);
  }

  private stopTimer(): void {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
