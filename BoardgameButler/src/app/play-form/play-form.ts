import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GameStore } from '../game-store';
import { PlayerStore } from '../player-store';
import { PlayStore } from '../play-store';
import { TimerService } from '../timer-service';
import { Play, PlayDetails } from '../play';

/** Today's date as YYYY-MM-DD in local time. */
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Log a play, or edit one. Without an `id` route parameter it adds; the
 * optional `game` query parameter pre-selects the game (used by the pick
 * card and Collection rows). With an `id` it edits that play.
 */
@Component({
  selector: 'app-play-form',
  imports: [RouterLink],
  templateUrl: './play-form.html',
})
export class PlayForm implements OnInit {
  private games = inject(GameStore);
  private playerStore = inject(PlayerStore);
  private plays = inject(PlayStore);
  private timers = inject(TimerService);
  private router = inject(Router);

  /** Route param when editing. */
  readonly id = input<string>();
  /** Query param: game id to pre-select when adding. */
  readonly game = input<string>();

  protected editing = computed(() => this.id() != null);
  protected existing = signal<Play | null>(null);
  protected notFound = signal(false);
  protected error = this.plays.error;

  protected gameOptions = computed(() =>
    [...this.games.games()].sort((a, b) => a.title.localeCompare(b.title)),
  );
  /** When editing a play whose game was since deleted, its snapshot title. */
  protected missingGame = computed(() => {
    const play = this.existing();
    return play && !this.games.find(play.gameId) ? { id: play.gameId, title: play.gameTitle } : null;
  });

  /** Current players, plus (when editing) any snapshotted player who has since been removed. */
  protected playerChoices = computed(() => {
    const current = this.playerStore.players().map(p => ({ id: p.id, name: p.name, removed: false }));
    const known = new Set(current.map(p => p.id));
    const gone = (this.existing()?.players ?? [])
      .filter(p => !known.has(p.id))
      .map(p => ({ id: p.id, name: p.name, removed: true }));
    return [...current, ...gone].sort((a, b) => a.name.localeCompare(b.name));
  });

  // --- Form state
  protected gameId = signal('');
  protected playedAt = signal(today());
  protected participantIds = signal<string[]>([]);
  protected winnerIds = signal<string[]>([]);
  protected durationMinutes = signal('');
  protected funRating = signal<number | null>(null);
  protected notes = signal('');

  protected selectedPlayers = computed(() => {
    const byId = new Map(this.playerChoices().map(p => [p.id, p]));
    return this.participantIds()
      .map(id => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => p != null);
  });

  /** Minutes on the stopwatch, if it has been used — offered as a shortcut. */
  protected stopwatchMinutes = computed(() => Math.round(this.timers.stopwatch.elapsedMs() / 60_000));

  protected valid = computed(() => this.gameId() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(this.playedAt()));

  ngOnInit() {
    this.timers.stopwatch.refresh();

    const id = this.id();
    if (id == null) {
      const preselect = this.game();
      if (preselect && this.games.find(preselect)) this.gameId.set(preselect);
      return;
    }

    const play = this.plays.find(id);
    if (!play) {
      this.notFound.set(true);
      return;
    }
    this.existing.set(play);
    this.gameId.set(play.gameId);
    this.playedAt.set(play.playedAt);
    this.participantIds.set(play.players.map(p => p.id));
    this.winnerIds.set(play.winnerIds);
    this.durationMinutes.set(play.durationMinutes != null ? String(play.durationMinutes) : '');
    this.funRating.set(play.funRating ?? null);
    this.notes.set(play.notes ?? '');
  }

  protected onGame(event: Event) {
    this.gameId.set((event.target as HTMLSelectElement).value);
  }

  protected onDate(event: Event) {
    this.playedAt.set((event.target as HTMLInputElement).value);
  }

  protected togglePlayer(id: string) {
    const selected = this.participantIds();
    if (selected.includes(id)) {
      this.participantIds.set(selected.filter(p => p !== id));
      this.winnerIds.update(w => w.filter(p => p !== id));
    } else {
      this.participantIds.set([...selected, id]);
    }
  }

  protected isPlayer(id: string): boolean {
    return this.participantIds().includes(id);
  }

  protected toggleWinner(id: string) {
    this.winnerIds.update(w => (w.includes(id) ? w.filter(p => p !== id) : [...w, id]));
  }

  protected isWinner(id: string): boolean {
    return this.winnerIds().includes(id);
  }

  protected onDuration(event: Event) {
    this.durationMinutes.set((event.target as HTMLInputElement).value);
  }

  protected useStopwatch() {
    this.durationMinutes.set(String(this.stopwatchMinutes()));
  }

  protected onFunRating(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.funRating.set(Number.isNaN(value) ? null : value);
  }

  protected clearFunRating() {
    this.funRating.set(null);
  }

  protected onNotes(event: Event) {
    this.notes.set((event.target as HTMLTextAreaElement).value);
  }

  protected submit() {
    if (!this.valid()) return;

    const game = this.games.find(this.gameId());
    const existing = this.existing();
    // Keep the original title snapshot if the game has since been deleted.
    const gameTitle = game?.title ?? existing?.gameTitle ?? '';

    const duration = parseInt(this.durationMinutes(), 10);
    const details: PlayDetails = {
      gameId: this.gameId(),
      gameTitle,
      playedAt: this.playedAt(),
      players: this.selectedPlayers().map(p => ({ id: p.id, name: p.name })),
      winnerIds: this.winnerIds().filter(id => this.participantIds().includes(id)),
      durationMinutes: Number.isNaN(duration) || duration <= 0 ? undefined : duration,
      funRating: this.funRating() ?? undefined,
      notes: this.notes().trim() || undefined,
    };

    if (existing) {
      this.plays.update(existing.id, details);
    } else {
      this.plays.add(details);
    }

    if (!this.plays.error()) {
      this.router.navigate(['/history']);
    }
  }
}
