import { Component, signal, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Game, playersText, playtimeText } from '../game';
import { GameStore } from '../game-store';

type SortKey = 'title' | 'players' | 'duration' | 'complexity' | 'rating';

const COMPLEXITY_ORDER: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 };

@Component({
  selector: 'app-collection',
  imports: [RouterLink],
  templateUrl: './collection.html',
})
export class Collection {
  private store = inject(GameStore);

  protected readonly playersText = playersText;
  protected readonly playtimeText = playtimeText;

  protected games = this.store.games;
  protected loading = computed(() => !this.store.ready());
  protected error = this.store.error;

  protected readonly columns: { key: SortKey; label: string; align: string }[] = [
    { key: 'title', label: 'Title', align: 'text-left' },
    { key: 'players', label: 'Players', align: 'text-center' },
    { key: 'duration', label: 'Minutes', align: 'text-center' },
    { key: 'complexity', label: 'Complexity', align: 'text-center' },
    { key: 'rating', label: 'Rating', align: 'text-center' },
  ];

  protected search = signal('');
  protected sortKey = signal<SortKey>('title');
  protected sortAsc = signal(true);

  protected filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortAsc() ? 1 : -1;

    const list = query
      ? this.games().filter(g => g.title.toLowerCase().includes(query))
      : [...this.games()];

    return list.sort((a, b) => this.compare(a, b, key) * dir);
  });

  protected sortBy(key: SortKey) {
    if (this.sortKey() === key) {
      this.sortAsc.update(asc => !asc);
    } else {
      this.sortKey.set(key);
      this.sortAsc.set(true);
    }
  }

  protected onSearch(event: Event) {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected complexityClass(complexity: string): string {
    switch (complexity) {
      case 'Easy':
        return 'bg-green-950 text-green-400 border-green-800';
      case 'Hard':
        return 'bg-red-950 text-red-400 border-red-800';
      default:
        return 'bg-amber-950 text-amber-400 border-amber-800';
    }
  }

  private compare(a: Game, b: Game, key: SortKey): number {
    switch (key) {
      case 'complexity':
        return (COMPLEXITY_ORDER[a.complexity] ?? 99) - (COMPLEXITY_ORDER[b.complexity] ?? 99);
      case 'rating':
        // Unrated games always sort after rated ones regardless of direction.
        if (a.rating == null && b.rating == null) return 0;
        if (a.rating == null) return this.sortAsc() ? 1 : -1;
        if (b.rating == null) return this.sortAsc() ? -1 : 1;
        return a.rating - b.rating;
      case 'players':
        return this.orUnknown(a.minPlayers) - this.orUnknown(b.minPlayers);
      case 'duration':
        return this.orUnknown(a.minPlaytime) - this.orUnknown(b.minPlaytime);
      default:
        return a.title.localeCompare(b.title);
    }
  }

  /** Games with no figure sort after those with one. */
  private orUnknown(value: number | undefined): number {
    return value ?? Number.MAX_SAFE_INTEGER;
  }
}
