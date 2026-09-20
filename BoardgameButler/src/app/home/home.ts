import { Component, signal, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Game } from '../game';
import { GameStore } from '../game-store';
import { PlayStore } from '../play-store';
import { InstallService } from '../install';
import { leastPlayed } from '../stats';
import { EMPTY_FILTERS, GameFilters, filterGames, hasActiveFilters } from '../game-filter';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
})
export class Home {
  private store = inject(GameStore);
  private plays = inject(PlayStore);
  private install = inject(InstallService);

  protected games = this.store.games;
  protected ready = this.store.ready;
  protected selectedGame = signal<Game | null>(null);
  /** Whether the current pick came from the filtered list. */
  protected pickedFromMatches = signal(false);

  protected filtersOpen = signal(false);
  protected filters = signal<GameFilters>(EMPTY_FILTERS);
  /** Restrict to the games tied for fewest plays. Kept apart from `filters`
   *  because it depends on the play log, not on a game's own fields. */
  protected leastPlayedOnly = signal(false);

  protected leastPlayed = computed(() => leastPlayed(this.games(), this.plays.plays()));
  protected filtersActive = computed(() => hasActiveFilters(this.filters()) || this.leastPlayedOnly());
  protected matches = computed(() => {
    const matching = filterGames(this.games(), this.filters());
    if (!this.leastPlayedOnly()) return matching;
    const { ids } = this.leastPlayed();
    return matching.filter(g => ids.has(g.id));
  });

  /** Says what "least played" currently means, so the toggle isn't a mystery. */
  protected leastPlayedLabel = computed(() => {
    const { minPlays, ids } = this.leastPlayed();
    const games = `${ids.size} game${ids.size === 1 ? '' : 's'}`;
    return minPlays === 0
      ? `Never played (${games})`
      : `Least played · ${minPlays} play${minPlays === 1 ? '' : 's'} (${games})`;
  });

  protected canInstall = this.install.canInstall;

  protected readonly complexityOptions = ['Easy', 'Medium', 'Hard'];
  protected readonly timeOptions = [30, 45, 60, 90, 120, 180];
  protected readonly ratingOptions = [5, 6, 7, 8, 9];

  protected readonly features = [
    'Track your collection',
    'Players & duration',
    'Complexity ratings',
    'User ratings',
    'Quick-pick assistant',
    'Play statistics',
    'In-game utilities',
  ];

  protected serveGame() {
    this.pick(this.games(), false);
  }

  protected serveMatch() {
    this.pick(this.matches(), true);
  }

  protected toggleFilters() {
    this.filtersOpen.update(open => !open);
  }

  protected clearFilters() {
    this.filters.set(EMPTY_FILTERS);
    this.leastPlayedOnly.set(false);
  }

  protected toggleLeastPlayed() {
    this.leastPlayedOnly.update(on => !on);
  }

  protected installApp() {
    void this.install.prompt();
  }

  protected setPlayers(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.update({ players: Number.isNaN(value) || value < 1 ? null : value });
  }

  protected setMaxMinutes(event: Event) {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    this.update({ maxMinutes: Number.isNaN(value) ? null : value });
  }

  protected setMinRating(event: Event) {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    this.update({ minRating: Number.isNaN(value) ? null : value });
  }

  protected toggleComplexity(complexity: string) {
    const current = this.filters().complexities;
    const next = current.includes(complexity)
      ? current.filter(c => c !== complexity)
      : [...current, complexity];
    this.update({ complexities: next });
  }

  protected isComplexitySelected(complexity: string): boolean {
    return this.filters().complexities.includes(complexity);
  }

  private update(patch: Partial<GameFilters>) {
    this.filters.update(f => ({ ...f, ...patch }));
  }

  private pick(list: Game[], fromMatches: boolean) {
    if (list.length === 0) return;
    this.selectedGame.set(list[Math.floor(Math.random() * list.length)]);
    this.pickedFromMatches.set(fromMatches);
  }
}
