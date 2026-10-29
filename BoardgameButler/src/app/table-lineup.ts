import { Injectable, computed, inject, signal } from '@angular/core';
import { normalizeKey } from './normalize';
import { PlayStore } from './play-store';
import { PlayerStore } from './player-store';

/**
 * Who is at the table right now, for the first player picker, turn order and
 * team splitter on the Tools page.
 *
 * Until it is changed, the selection follows the most recent logged play,
 * the same carry-over the Log a play form uses, so it stays correct while the
 * stores are still loading. Guests are people not in the Players list; they
 * are held in memory only and never saved.
 *
 * Root-scoped so the line-up survives a trip to another page mid-game.
 */
@Injectable({ providedIn: 'root' })
export class TableLineupService {
  private playerStore = inject(PlayerStore);
  private plays = inject(PlayStore);

  /** null until the selection is changed; until then it follows the last play. */
  private readonly _chosen = signal<string[] | null>(null);
  private readonly _guests = signal<string[]>([]);

  readonly guests = this._guests.asReadonly();

  /** Every saved player, alphabetical. */
  readonly choices = computed(() =>
    [...this.playerStore.players()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  /** Selected player ids, ignoring anyone since removed from the Players list. */
  readonly selectedIds = computed(() => {
    const chosen = this._chosen() ?? this.plays.lastLineup().map(p => p.id);
    const known = new Set(this.playerStore.players().map(p => p.id));
    return chosen.filter(id => known.has(id));
  });

  /** True while the selection is still the one carried over from the last play. */
  readonly carriedOver = computed(() => this._chosen() === null && this.selectedIds().length > 0);

  /** Everyone at the table: selected players alphabetically, then guests in the order added. */
  readonly names = computed(() => {
    const selected = new Set(this.selectedIds());
    return [...this.choices().filter(p => selected.has(p.id)).map(p => p.name), ...this._guests()];
  });

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  toggle(id: string) {
    const current = this.selectedIds();
    this._chosen.set(current.includes(id) ? current.filter(p => p !== id) : [...current, id]);
  }

  /** Empty the table, guests included. */
  clear() {
    this._chosen.set([]);
    this._guests.set([]);
  }

  /**
   * Add someone by name. A name matching a saved player selects that player
   * instead of adding a duplicate guest. Returns an error message, or null.
   */
  addGuest(name: string): string | null {
    const trimmed = name.trim();
    if (!trimmed) return 'Enter a name.';
    const key = normalizeKey(trimmed);

    const player = this.playerStore.players().find(p => normalizeKey(p.name) === key);
    if (player) {
      if (this.isSelected(player.id)) return `${player.name} is already at the table.`;
      this.toggle(player.id);
      return null;
    }
    const guest = this._guests().find(g => normalizeKey(g) === key);
    if (guest) return `${guest} is already at the table.`;

    this._guests.update(g => [...g, trimmed]);
    return null;
  }

  removeGuest(name: string) {
    this._guests.update(g => g.filter(n => n !== name));
  }
}
