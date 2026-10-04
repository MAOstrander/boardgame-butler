import { Injectable, computed, signal } from '@angular/core';

export const LAST_EXPORT_KEY = 'boardgame-butler.lastExport';

/** Days after which a backup counts as stale enough to mention unprompted. */
export const STALE_AFTER_DAYS = 30;

/**
 * Remembers when the collection was last exported.
 *
 * Nothing here protects any data by itself — it exists so the app can say
 * "last backed up 47 days ago" rather than leaving backup as a decision the
 * user has to remember to make.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly _lastExport = signal<string | null>(this.read());

  /** ISO timestamp of the last export, or null if there has never been one. */
  readonly lastExport = this._lastExport.asReadonly();

  /** Whole days since the last export; null when there has never been one. */
  readonly daysSince = computed(() => {
    const at = this._lastExport();
    if (at == null) return null;
    const then = new Date(at).getTime();
    if (Number.isNaN(then)) return null;
    return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
  });

  /** True when there has never been a backup, or the last one is old. */
  readonly stale = computed(() => {
    const days = this.daysSince();
    return days == null || days >= STALE_AFTER_DAYS;
  });

  recordExport(): void {
    const now = new Date().toISOString();
    this._lastExport.set(now);
    try {
      localStorage.setItem(LAST_EXPORT_KEY, now);
    } catch {
      // Not worth surfacing: the export itself succeeded, we just can't
      // remember that it did.
    }
  }

  /** "today", "3 days ago", "never". */
  readonly describe = computed(() => {
    const days = this.daysSince();
    if (days == null) return 'never';
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
  });

  private read(): string | null {
    try {
      return localStorage.getItem(LAST_EXPORT_KEY);
    } catch {
      return null;
    }
  }
}
