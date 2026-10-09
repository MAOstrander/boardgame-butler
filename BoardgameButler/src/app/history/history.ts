import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlayStore } from '../play-store';
import { UndoService } from '../undo';
import { Play } from '../play';

@Component({
  selector: 'app-history',
  imports: [RouterLink],
  templateUrl: './history.html',
})
export class History {
  private store = inject(PlayStore);
  private undo = inject(UndoService);

  protected plays = this.store.recent;
  protected error = this.store.error;
  protected ready = this.store.ready;
  protected confirmingId = signal<string | null>(null);

  protected count = computed(() => this.plays().length);

  protected winners(play: Play): string {
    const names = play.players.filter(p => play.winnerIds.includes(p.id)).map(p => p.name);
    return names.join(', ');
  }

  protected others(play: Play): string {
    return play.players.filter(p => !play.winnerIds.includes(p.id)).map(p => p.name).join(', ');
  }

  /** "Thu 18 Sep 2026" from a YYYY-MM-DD string, without timezone drift. */
  protected formatDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  protected askDelete(id: string) {
    this.confirmingId.set(id);
  }

  protected cancelDelete() {
    this.confirmingId.set(null);
  }

  protected confirmDelete() {
    const id = this.confirmingId();
    if (!id) return;

    const play = this.store.find(id);
    const index = this.store.indexOf(id);
    this.store.remove(id);
    this.confirmingId.set(null);

    if (play) {
      this.undo.propose(`Deleted your play of ${play.gameTitle}.`, () => this.store.restore(play, index));
    }
  }
}
