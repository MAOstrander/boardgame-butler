import { Injectable, computed, signal } from '@angular/core';

/**
 * Chrome's non-standard install event. Not in TypeScript's DOM lib, so it is
 * described here.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

/**
 * Wraps the browser's install flow. Chrome no longer shows an install banner
 * of its own — it fires `beforeinstallprompt` and expects the page to offer
 * the choice — so the event is captured here and replayed when the user asks.
 *
 * Browsers that never fire the event (notably iOS Safari, where installing is
 * Share → Add to Home Screen) simply leave `canInstall` false.
 */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private deferred: BeforeInstallPromptEvent | null = null;

  private readonly _available = signal(false);
  private readonly _installed = signal(false);

  readonly installed = this._installed.asReadonly();
  /** True only when the browser has offered an install and we haven't used it. */
  readonly canInstall = computed(() => this._available() && !this._installed());

  constructor() {
    if (typeof window === 'undefined') return;

    this._installed.set(isStandalone());

    window.addEventListener('beforeinstallprompt', event => {
      // Keep the event for our own button rather than whatever the browser
      // would have done with it.
      event.preventDefault();
      this.deferred = event as BeforeInstallPromptEvent;
      this._available.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferred = null;
      this._available.set(false);
      this._installed.set(true);
    });
  }

  /** Show the browser's install dialog. The captured event is single-use. */
  async prompt(): Promise<InstallOutcome> {
    const event = this.deferred;
    if (!event) return 'unavailable';

    this.deferred = null;
    this._available.set(false);

    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === 'accepted') this._installed.set(true);
      return outcome;
    } catch {
      // A prompt that can't be shown is no different, to us, from a dismissal.
      return 'dismissed';
    }
  }
}

/** Already running as an installed app? */
function isStandalone(): boolean {
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  } catch {
    /* matchMedia unavailable */
  }
  // iOS Safari's own flag for home-screen apps.
  return (window.navigator as { standalone?: boolean }).standalone === true;
}
