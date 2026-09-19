import { computed, signal } from '@angular/core';

const TICK_MS = 250;

/**
 * A count-up timer. Elapsed time is derived from wall-clock timestamps, not
 * from counting ticks, so it stays accurate when a phone throttles background
 * intervals; the interval only exists to refresh the display.
 */
export class Stopwatch {
  private accumulatedMs = 0;
  private startedAt: number | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  private readonly _elapsedMs = signal(0);
  private readonly _running = signal(false);

  readonly elapsedMs = this._elapsedMs.asReadonly();
  readonly running = this._running.asReadonly();

  /** Called after every display refresh while running. */
  onTick?: () => void;

  start() {
    if (this._running()) return;
    this.startedAt = Date.now();
    this._running.set(true);
    this.interval = setInterval(() => this.refresh(), TICK_MS);
  }

  pause() {
    if (!this._running()) return;
    this.refresh();
    this.accumulatedMs = this._elapsedMs();
    this.startedAt = null;
    this._running.set(false);
    this.stopInterval();
  }

  reset() {
    this.pause();
    this.accumulatedMs = 0;
    this._elapsedMs.set(0);
  }

  /** Bring the display up to date immediately (e.g. when a page re-opens). */
  refresh() {
    const live = this.startedAt == null ? 0 : Date.now() - this.startedAt;
    this._elapsedMs.set(this.accumulatedMs + live);
    this.onTick?.();
  }

  destroy() {
    this.stopInterval();
  }

  private stopInterval() {
    if (this.interval != null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

/** A countdown built on Stopwatch: remaining = duration − elapsed, stopping at zero. */
export class Countdown {
  private readonly clock = new Stopwatch();
  private readonly _durationMs = signal(0);
  private notified = false;

  readonly durationMs = this._durationMs.asReadonly();
  readonly running = this.clock.running;
  readonly remainingMs = computed(() => Math.max(0, this._durationMs() - this.clock.elapsedMs()));
  readonly finished = computed(() => this._durationMs() > 0 && this.remainingMs() === 0);

  /** Called once when the countdown reaches zero. */
  onFinish?: () => void;

  constructor() {
    this.clock.onTick = () => {
      // pause() refreshes (and so ticks) once more; the flag keeps this to one firing.
      if (this.finished() && !this.notified) {
        this.notified = true;
        this.clock.pause();
        this.onFinish?.();
      }
    };
  }

  /** Set a new duration and rewind to it. */
  setDuration(ms: number) {
    this.clock.reset();
    this.notified = false;
    this._durationMs.set(Math.max(0, ms));
  }

  start() {
    if (this._durationMs() === 0 || this.finished()) return;
    this.clock.start();
  }

  pause() {
    this.clock.pause();
  }

  reset() {
    this.clock.reset();
    this.notified = false;
  }

  refresh() {
    this.clock.refresh();
  }

  destroy() {
    this.clock.destroy();
  }
}

/** "m:ss", or "h:mm:ss" once an hour has passed. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}
