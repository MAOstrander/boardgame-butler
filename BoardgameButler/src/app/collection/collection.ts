import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Game } from '../game';

type SortKey = 'title' | 'players' | 'duration' | 'complexity' | 'rating';

const COMPLEXITY_ORDER: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 };

@Component({
  selector: 'app-collection',
  imports: [RouterLink],
  templateUrl: './collection.html',
})
export class Collection implements OnInit {
  private http = inject(HttpClient);

  protected games = signal<Game[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);

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

  ngOnInit() {
    this.http.get<Game[]>('/api/games').subscribe({
      next: games => {
        this.games.set(games);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load your collection.');
        this.loading.set(false);
      },
    });
  }

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
      case 'duration':
        // Values are free-text ranges like "2-4" or "60-120"; sort by the leading number.
        return this.leadingNumber(a[key]) - this.leadingNumber(b[key]);
      default:
        return a.title.localeCompare(b.title);
    }
  }

  private leadingNumber(value: string): number {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
  }
}
