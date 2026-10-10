import { Injectable, effect, inject, signal } from '@angular/core';
import { Countdown, Stopwatch } from './timer';
import { WakeLockService } from './wake-lock';

export const KEEP_AWAKE_KEY = 'boardgame-butler.keepAwake';

/**
 * Root-scoped so a running timer keeps going while the user visits other
 * pages. Also owns the "time's up" alert, and keeps the screen on while a
 * timer runs.
 */
@Injectable({ providedIn: 'root' })
export class TimerService {
  private wakeLock = inject(WakeLockService);

  readonly countdown = new Countdown();
  readonly stopwatch = new Stopwatch();

  private readonly _keepAwake = signal(readKeepAwake());
  /** Whether to hold the screen on while either timer runs. On unless turned off. */
  readonly keepAwake = this._keepAwake.asReadonly();

  constructor() {
    this.countdown.onFinish = () => this.alert();

    effect(() => {
      const running = this.countdown.running() || this.stopwatch.running();
      if (running && this._keepAwake()) {
        void this.wakeLock.request();
      } else {
        this.wakeLock.release();
      }
    });
  }

  setKeepAwake(on: boolean) {
    this._keepAwake.set(on);
    try {
      localStorage.setItem(KEEP_AWAKE_KEY, on ? 'on' : 'off');
    } catch {
      // The setting still applies for this session.
    }
  }

  /** Vibrate and beep where the platform allows; silently do nothing otherwise. */
  alert() {
    try {
      navigator.vibrate?.([200, 100, 200, 100, 400]);
    } catch {
      /* not supported */
    }
    try {
      const AudioCtx = window.AudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
      osc.onended = () => ctx.close();
    } catch {
      /* autoplay blocked or unsupported */
    }
  }
}

function readKeepAwake(): boolean {
  try {
    return localStorage.getItem(KEEP_AWAKE_KEY) !== 'off';
  } catch {
    return true;
  }
}
