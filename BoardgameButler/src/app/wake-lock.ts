import { Injectable, signal } from '@angular/core';

/**
 * Keeps the screen on while something on it needs watching, such as a running
 * countdown.
 *
 * The browser drops a screen wake lock whenever the page is hidden (switching
 * apps, locking the phone), so while one is still wanted it is taken again
 * when the page comes back. Requests can also be refused outright, for
 * example on low battery; that is treated as "not held" rather than an error.
 *
 * Unsupported browsers simply leave `supported` false and ignore requests.
 */
@Injectable({ providedIn: 'root' })
export class WakeLockService {
  readonly supported = typeof navigator !== 'undefined' && !!navigator.wakeLock;

  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;
  private requesting = false;

  private readonly _held = signal(false);
  /** True while the browser is actually holding the screen on for us. */
  readonly held = this._held.asReadonly();

  constructor() {
    if (!this.supported) return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.acquire();
    });
  }

  /** Ask for the screen to stay on until `release()`. Safe to call repeatedly. */
  async request(): Promise<void> {
    this.wanted = true;
    await this.acquire();
  }

  release(): void {
    this.wanted = false;
    const sentinel = this.sentinel;
    this.sentinel = null;
    this._held.set(false);
    sentinel?.release().catch(() => {
      /* already released by the browser */
    });
  }

  private async acquire(): Promise<void> {
    if (!this.supported || !this.wanted || this.sentinel || this.requesting) return;
    this.requesting = true;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      if (!this.wanted) {
        // Released while the request was in flight.
        await sentinel.release();
        return;
      }
      this.sentinel = sentinel;
      this._held.set(true);
      sentinel.addEventListener('release', () => {
        // The browser let go (page hidden); visibilitychange will take it back.
        if (this.sentinel !== sentinel) return;
        this.sentinel = null;
        this._held.set(false);
      });
    } catch {
      // Refused: hidden page, low battery, or a permissions policy.
    } finally {
      this.requesting = false;
    }
  }
}
