import { Injectable } from '@angular/core';
import { Countdown, Stopwatch } from './timer';

/**
 * Root-scoped so a running timer keeps going while the user visits other
 * pages. Also owns the "time's up" alert.
 */
@Injectable({ providedIn: 'root' })
export class TimerService {
  readonly countdown = new Countdown();
  readonly stopwatch = new Stopwatch();

  constructor() {
    this.countdown.onFinish = () => this.alert();
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
