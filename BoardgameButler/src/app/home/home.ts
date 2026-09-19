import { Component, signal, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Game } from '../game';
import { GameStore } from '../game-store';
import { EMPTY_FILTERS, GameFilters, filterGames, hasActiveFilters } from '../game-filter';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
})
export class Home {
  private store = inject(GameStore);

  protected games = this.store.games;
  protected ready = this.store.ready;
  protected selectedGame = signal<Game | null>(null);
  /** Whether the current pick came from the filtered list. */
  protected pickedFromMatches = signal(false);

  protected filtersOpen = signal(false);
  protected filters = signal<GameFilters>(EMPTY_FILTERS);
  protected filtersActive = computed(() => hasActiveFilters(this.filters()));
  protected matches = computed(() => filterGames(this.games(), this.filters()));

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
