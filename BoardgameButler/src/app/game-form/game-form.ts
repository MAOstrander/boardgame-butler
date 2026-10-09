import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Game, GameDetails } from '../game';
import { GameStore } from '../game-store';
import { BggCredit } from '../bgg-credit/bgg-credit';
import { BggDetails, BggSearchResult, BggService, complexityFromWeight, formatRange, lookupErrorMessage } from '../bgg';
import { PlayStore } from '../play-store';
import { UndoService } from '../undo';

/** Enough to spot the right edition without a wall of reprints. */
const MAX_RESULTS = 8;

/**
 * One form for both adding and editing. With no `id` route parameter it
 * adds a new game; with one it edits that game in place.
 */
@Component({
  selector: 'app-game-form',
  imports: [ReactiveFormsModule, RouterLink, BggCredit],
  templateUrl: './game-form.html',
})
export class GameForm implements OnInit {
  private fb = inject(FormBuilder);
  private store = inject(GameStore);
  private plays = inject(PlayStore);
  private undo = inject(UndoService);
  private router = inject(Router);
  private bgg = inject(BggService);
  private destroyRef = inject(DestroyRef);

  /** Bound from the `:id` route parameter; absent when adding. */
  readonly id = input<string>();

  protected editing = computed(() => this.id() != null);
  protected game = signal<Game | null>(null);
  protected notFound = signal(false);
  protected confirmingDelete = signal(false);
  protected error = this.store.error;
  /** Logged plays of this game; they are kept when the game is deleted. */
  protected playCount = computed(() => {
    const game = this.game();
    return game ? this.plays.forGame(game.id).length : 0;
  });

  /** BGG lookup is only offered once the proxy is deployed. */
  protected lookupEnabled = this.bgg.enabled;
  protected lookupBusy = signal(false);
  protected lookupResults = signal<BggSearchResult[] | null>(null);
  protected lookupError = signal<string | null>(null);
  protected filledFrom = signal<BggDetails | null>(null);

  protected form = this.fb.nonNullable.group({
    title: ['', [Validators.required, this.uniqueTitle()]],
    players: ['', Validators.required],
    duration: ['', Validators.required],
    complexity: ['Medium', Validators.required],
    rating: [
      null as number | null,
      [Validators.required, Validators.min(1), Validators.max(10)],
    ],
  });

  ngOnInit() {
    const id = this.id();
    if (id == null) return;

    const game = this.store.find(id);
    if (!game) {
      this.notFound.set(true);
      return;
    }
    this.game.set(game);
    this.form.setValue({
      title: game.title,
      players: game.players,
      duration: game.duration,
      complexity: game.complexity,
      rating: game.rating ?? null,
    });
  }

  protected submit() {
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const details: GameDetails = {
      title: value.title.trim(),
      players: value.players.trim(),
      duration: value.duration.trim(),
      complexity: value.complexity,
      rating: value.rating ?? undefined,
    };

    const game = this.game();
    if (game) {
      this.store.update(game.id, details);
    } else {
      this.store.add(details);
    }

    if (!this.store.error()) {
      this.router.navigate([game ? '/collection' : '/']);
    }
  }

  /** Search BGG for whatever is in the title box. */
  protected lookUp() {
    const title = this.form.controls.title.value.trim();
    if (!title || this.lookupBusy()) return;

    this.startLookup();
    this.bgg
      .search(title)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: results => {
          this.lookupBusy.set(false);
          if (results.length) {
            this.lookupResults.set(results.slice(0, MAX_RESULTS));
          } else {
            this.lookupError.set(`No games on BoardGameGeek match "${title}".`);
          }
        },
        error: error => this.failLookup(error),
      });
  }

  /** Fetch one search hit's details and copy them into the form. */
  protected choose(result: BggSearchResult) {
    if (this.lookupBusy()) return;

    this.startLookup();
    this.bgg
      .details(result.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: details => {
          this.lookupBusy.set(false);
          if (details) {
            this.fillFrom(details);
          } else {
            this.lookupError.set(`BoardGameGeek has no details for ${result.name}.`);
          }
        },
        error: error => this.failLookup(error),
      });
  }

  protected dismissLookup() {
    this.lookupResults.set(null);
    this.lookupError.set(null);
  }

  /**
   * Copies what BGG know into the form. Anything BGG have no figure for is left
   * as it was, and the rating is never touched: it is the user's own opinion.
   */
  private fillFrom(details: BggDetails) {
    const controls = this.form.controls;
    if (details.name) controls.title.setValue(details.name);

    const players = formatRange(details.minPlayers, details.maxPlayers);
    if (players) controls.players.setValue(players);

    const duration = formatRange(details.minPlaytime, details.maxPlaytime);
    if (duration) controls.duration.setValue(duration);

    if (details.weight) controls.complexity.setValue(complexityFromWeight(details.weight));

    for (const control of [controls.title, controls.players, controls.duration]) control.markAsTouched();
    this.filledFrom.set(details);
  }

  private startLookup() {
    this.lookupBusy.set(true);
    this.lookupResults.set(null);
    this.lookupError.set(null);
    this.filledFrom.set(null);
  }

  private failLookup(error: unknown) {
    this.lookupBusy.set(false);
    this.lookupError.set(lookupErrorMessage(error));
  }

  protected askDelete() {
    this.confirmingDelete.set(true);
  }

  protected cancelDelete() {
    this.confirmingDelete.set(false);
  }

  protected confirmDelete() {
    const game = this.game();
    if (!game) return;

    const index = this.store.indexOf(game.id);
    this.store.remove(game.id);

    if (this.store.error()) {
      this.confirmingDelete.set(false);
      return;
    }

    this.undo.propose(`Deleted ${game.title}.`, () => this.store.restore(game, index));
    this.router.navigate(['/collection']);
  }

  /** Rejects a title already used by another game (case-insensitive). */
  private uniqueTitle(): ValidatorFn {
    return (control: AbstractControl<string>): ValidationErrors | null => {
      const title = control.value?.trim();
      if (!title) return null;
      return this.store.hasTitle(title, this.game()?.id) ? { duplicate: true } : null;
    };
  }
}
