import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TableLineupService } from '../../table-lineup';
import { pickOne, shuffle, splitTeams } from '../../table-picks';

type PickResult =
  | { kind: 'first'; name: string; from: string[] }
  | { kind: 'order'; names: string[]; from: string[] }
  | { kind: 'teams'; teams: string[][]; from: string[] };

/** First player, turn order and teams for whoever is at the table. */
@Component({
  selector: 'app-player-picks',
  imports: [RouterLink],
  templateUrl: './player-picks.html',
})
export class PlayerPicks {
  protected lineup = inject(TableLineupService);

  protected guestName = signal('');
  protected guestError = signal<string | null>(null);

  protected count = computed(() => this.lineup.names().length);
  protected teamCount = signal(2);
  /** At least two teams, and never more teams than people. */
  protected maxTeams = computed(() => Math.max(2, this.count()));
  protected teams = computed(() => Math.min(this.teamCount(), this.maxTeams()));

  private readonly result = signal<PickResult | null>(null);
  /** The last result, hidden once the line-up it was made from has changed. */
  protected shown = computed(() => {
    const r = this.result();
    return r && sameList(r.from, this.lineup.names()) ? r : null;
  });

  protected onGuestName(event: Event) {
    this.guestName.set((event.target as HTMLInputElement).value);
    this.guestError.set(null);
  }

  protected addGuest() {
    const error = this.lineup.addGuest(this.guestName());
    this.guestError.set(error);
    if (!error) this.guestName.set('');
  }

  protected changeTeams(delta: number) {
    this.teamCount.set(Math.min(this.maxTeams(), Math.max(2, this.teams() + delta)));
  }

  protected pickFirst() {
    const from = this.lineup.names();
    const name = pickOne(from);
    if (name) this.result.set({ kind: 'first', name, from });
  }

  protected shuffleOrder() {
    const from = this.lineup.names();
    this.result.set({ kind: 'order', names: shuffle(from), from });
  }

  protected split() {
    const from = this.lineup.names();
    this.result.set({ kind: 'teams', teams: splitTeams(from, this.teams()), from });
  }
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
