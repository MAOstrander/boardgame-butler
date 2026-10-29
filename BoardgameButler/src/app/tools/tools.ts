import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DIE_SIDES, MAX_DICE, Notation, NotationRoll, parseNotation, rollNotation } from '../dice';
import { formatDuration } from '../timer';
import { TimerService } from '../timer-service';
import { WakeLockService } from '../wake-lock';
import { PlayerPicks } from './player-picks/player-picks';

const ROLL_HISTORY = 5;

@Component({
  selector: 'app-tools',
  imports: [RouterLink, PlayerPicks],
  templateUrl: './tools.html',
})
export class Tools implements OnInit {
  private timers = inject(TimerService);

  // --- Dice
  protected readonly dieOptions = DIE_SIDES;
  protected readonly maxDice = MAX_DICE;
  protected sides = signal<number>(6);
  protected count = signal(1);
  protected roll = signal<NotationRoll | null>(null);
  protected history = signal<NotationRoll[]>([]);
  protected notationInput = signal('');
  protected notationError = signal<string | null>(null);

  // --- Countdown
  protected readonly presetMinutes = [1, 2, 5, 10, 15, 30];
  protected countdown = this.timers.countdown;
  protected countdownDisplay = computed(() => formatDuration(this.countdown.remainingMs()));
  protected customMinutes = signal('');

  // --- Stopwatch
  protected stopwatch = this.timers.stopwatch;
  protected stopwatchDisplay = computed(() => formatDuration(this.stopwatch.elapsedMs()));

  // --- Screen
  protected wakeLock = inject(WakeLockService);
  protected keepAwake = this.timers.keepAwake;

  ngOnInit() {
    // Timers keep running while other pages are open; catch the display up.
    this.countdown.refresh();
    this.stopwatch.refresh();
  }

  protected selectDie(sides: number) {
    this.sides.set(sides);
  }

  protected changeCount(delta: number) {
    this.count.update(c => Math.min(MAX_DICE, Math.max(1, c + delta)));
  }

  protected rollDice() {
    const sides = this.sides();
    const count = this.count();
    this.rollAndRecord({ text: `${count}d${sides}`, dice: [{ sign: 1, count, sides }], modifier: 0 });
  }

  protected onNotation(event: Event) {
    this.notationInput.set((event.target as HTMLInputElement).value);
    this.notationError.set(null);
  }

  /** Roll whatever was typed, e.g. 3d6+3. */
  protected rollTyped() {
    const parsed = parseNotation(this.notationInput());
    if ('error' in parsed) {
      this.notationError.set(parsed.error);
      return;
    }
    this.notationError.set(null);
    this.rollAndRecord(parsed);
  }

  /** Roll a recent expression again. */
  protected reroll(notation: string) {
    const parsed = parseNotation(notation);
    if (!('error' in parsed)) this.rollAndRecord(parsed);
  }

  /** Show the individual dice unless it was a single die and nothing added. */
  protected showBreakdown(roll: NotationRoll): boolean {
    const dice = roll.groups.reduce((n, g) => n + g.results.length, 0);
    return dice > 1 || roll.modifier !== 0;
  }

  private rollAndRecord(notation: Notation) {
    const result = rollNotation(notation);
    this.roll.set(result);
    this.history.update(h => [result, ...h].slice(0, ROLL_HISTORY));
  }

  protected setPreset(minutes: number) {
    this.countdown.setDuration(minutes * 60_000);
    this.customMinutes.set('');
  }

  protected onCustomMinutes(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.customMinutes.set(value);
    const minutes = parseFloat(value);
    if (!Number.isNaN(minutes) && minutes > 0) {
      this.countdown.setDuration(Math.round(minutes * 60_000));
    }
  }

  protected isPreset(minutes: number): boolean {
    return this.countdown.durationMs() === minutes * 60_000 && this.customMinutes() === '';
  }

  protected onKeepAwake(event: Event) {
    this.timers.setKeepAwake((event.target as HTMLInputElement).checked);
  }
}
