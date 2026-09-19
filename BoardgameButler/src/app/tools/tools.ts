import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DIE_SIDES, DiceRoll, MAX_DICE, rollDice } from '../dice';
import { formatDuration } from '../timer';
import { TimerService } from '../timer-service';

const ROLL_HISTORY = 5;

@Component({
  selector: 'app-tools',
  imports: [RouterLink],
  templateUrl: './tools.html',
})
export class Tools implements OnInit {
  private timers = inject(TimerService);

  // --- Dice
  protected readonly dieOptions = DIE_SIDES;
  protected readonly maxDice = MAX_DICE;
  protected sides = signal<number>(6);
  protected count = signal(1);
  protected roll = signal<DiceRoll | null>(null);
  protected history = signal<DiceRoll[]>([]);

  // --- Countdown
  protected readonly presetMinutes = [1, 2, 5, 10, 15, 30];
  protected countdown = this.timers.countdown;
  protected countdownDisplay = computed(() => formatDuration(this.countdown.remainingMs()));
  protected customMinutes = signal('');

  // --- Stopwatch
  protected stopwatch = this.timers.stopwatch;
  protected stopwatchDisplay = computed(() => formatDuration(this.stopwatch.elapsedMs()));

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
    const result = rollDice(this.sides(), this.count());
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

  protected formatRoll(roll: DiceRoll): string {
    return `${roll.count}d${roll.sides}`;
  }
}
