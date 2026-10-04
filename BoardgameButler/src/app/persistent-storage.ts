import { Injectable, signal } from '@angular/core';

/**
 * Asks the browser not to evict our data.
 *
 * Browsers may clear "best-effort" origin storage under disk pressure, and
 * Safari discards script-writable storage for sites unused for a week. Since
 * the play history here is the one thing a user cannot recreate, we ask for
 * the "persistent" bucket on startup. Chrome grants it silently for installed
 * apps; Safari exempts home-screen apps already. It is a request, not a
 * guarantee, and it does not stop anyone clearing site data by hand.
 */
@Injectable({ providedIn: 'root' })
export class PersistentStorageService {
  /** true = granted, false = refused, null = not supported or not asked yet. */
  private readonly _persisted = signal<boolean | null>(null);
  readonly persisted = this._persisted.asReadonly();

  /** Request persistence once. Safe to call repeatedly. */
  async ensure(): Promise<boolean | null> {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (!storage?.persist) {
      this._persisted.set(null);
      return null;
    }

    try {
      const already = await storage.persisted?.();
      const granted = already ? true : await storage.persist();
      this._persisted.set(granted);
      return granted;
    } catch {
      // Some browsers throw rather than resolving false; treat as unknown.
      this._persisted.set(null);
      return null;
    }
  }
}
