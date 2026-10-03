import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameStore } from '../game-store';
import { PlayerStore } from '../player-store';
import { PlayStore } from '../play-store';
import { GameRow, HeadCountBreakdown, gameRows, overview, playerRows, todayIso } from '../stats';

@Component({
  selector: 'app-stats',
  imports: [RouterLink],
  templateUrl: './stats.html',
})
export class Stats {
  private games = inject(GameStore);
  private players = inject(PlayerStore);
  private plays = inject(PlayStore);

  protected ready = computed(() => this.plays.ready() && this.games.ready());
  protected hasPlays = computed(() => this.plays.plays().length > 0);
  protected overview = computed(() => overview(this.games.games(), this.plays.plays(), todayIso()));
  protected gameRows = computed(() => gameRows(this.games.games(), this.plays.plays()));
  protected played = computed(() => this.gameRows().filter(r => r.plays > 0));
  protected neverPlayed = computed(() => this.gameRows().filter(r => r.plays === 0));
  protected playerRows = computed(() => playerRows(this.players.players(), this.plays.plays()));
  protected collectionSize = computed(() => this.games.games().length);

  protected hours(minutes: number): string {
    const h = minutes / 60;
    return h < 10 ? h.toFixed(1) : Math.round(h).toString();
  }

  protected percent(rate: number | null): string {
    return rate == null ? '—' : `${Math.round(rate * 100)}%`;
  }

  /** "Wed 10 Sep" from YYYY-MM-DD, without timezone drift. */
  protected shortDate(iso: string | null): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** "3p ×2 · 70 min" — one entry per head-count that occurs. */
  protected breakdown(entry: HeadCountBreakdown): string {
    const plays = `${entry.players}p ×${entry.plays}`;
    return entry.avgMinutes != null ? `${plays} · ${entry.avgMinutes} min` : plays;
  }

  /** How the average recorded time compares with the listed range: "in range", "+12 min", "−5 min". */
  protected versusListed(row: GameRow): { label: string; tone: 'ok' | 'over' | 'under' } | null {
    if (row.avgMinutes == null || !row.listedMinutes) return null;
    const { min, max } = row.listedMinutes;
    if (row.avgMinutes > max) return { label: `+${Math.round(row.avgMinutes - max)} min over`, tone: 'over' };
    if (row.avgMinutes < min) return { label: `${Math.round(min - row.avgMinutes)} min under`, tone: 'under' };
    return { label: 'in range', tone: 'ok' };
  }
}
