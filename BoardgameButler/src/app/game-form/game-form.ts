import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Game, GameDetails } from '../game';
import { GameStore } from '../game-store';
import { BggCredit } from '../bgg-credit/bgg-credit';
import { BggDetails, BggSearchResult, BggService, lookupErrorMessage } from '../bgg';
import { PlayStore } from '../play-store';
import { UndoService } from '../undo';

/** Enough to spot the right edition without a wall of reprints. */
const MAX_RESULTS = 8;

/** Flags the form with `errorKey` when both ends are set and the minimum exceeds the maximum. */
function minNotAboveMax(minKey: string, maxKey: string, errorKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const min = group.get(minKey)?.value;
    const max = group.get(maxKey)?.value;
    return min != null && max != null && min > max ? { [errorKey]: true } : null;
  };
}

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
  /** The BGG game this one is linked to, and its weight as of the lookup. */
  protected bggLink = signal<{ id: string; weight?: number } | null>(null);

  protected form = this.fb.nonNullable.group(
    {
      title: ['', [Validators.required, this.uniqueTitle()]],
      minPlayers: [null as number | null, [Validators.required, Validators.min(1)]],
      maxPlayers: [null as number | null, [Validators.required, Validators.min(1)]],
      minPlaytime: [null as number | null, [Validators.required, Validators.min(1)]],
      maxPlaytime: [null as number | null, [Validators.required, Validators.min(1)]],
      complexity: ['Medium', Validators.required],
      rating: [
        null as number | null,
        [Validators.required, Validators.min(1), Validators.max(10)],
      ],
    },
    { validators: [minNotAboveMax('minPlayers', 'maxPlayers', 'playersOrder'), minNotAboveMax('minPlaytime', 'maxPlaytime', 'playtimeOrder')] },
  );

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
      minPlayers: game.minPlayers ?? null,
      maxPlayers: game.maxPlayers ?? null,
      minPlaytime: game.minPlaytime ?? null,
      maxPlaytime: game.maxPlaytime ?? null,
      complexity: game.complexity,
      rating: game.rating ?? null,
    });
    if (game.bggId) this.bggLink.set({ id: game.bggId, weight: game.bggWeight });
  }

  protected submit() {
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const link = this.bggLink();
    const details: GameDetails = {
      title: value.title.trim(),
      minPlayers: value.minPlayers!,
      maxPlayers: value.maxPlayers!,
      minPlaytime: value.minPlaytime!,
      maxPlaytime: value.maxPlaytime!,
      complexity: value.complexity,
      rating: value.rating ?? undefined,
      ...(link ? { bggId: link.id, ...(link.weight != null ? { bggWeight: link.weight } : {}) } : {}),
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

  /** Forget the BGG link, so the saved game no longer carries BGG's id or weight. */
  protected unlinkBgg() {
    this.bggLink.set(null);
    this.filledFrom.set(null);
  }

  /**
   * Copies BGG's figures into the form exactly as BGG give them, each into its
   * own field. Anything BGG have no figure for is left as it was.
   *
   * Complexity and rating are never touched. They are the user's own judgement,
   * and deriving complexity from BGG's weight would be modifying BGG's data,
   * which their terms forbid. The weight is shown alongside instead.
   */
  private fillFrom(details: BggDetails) {
    const controls = this.form.controls;
    const copies: [AbstractControl, string | number | undefined][] = [
      [controls.title, details.name || undefined],
      [controls.minPlayers, details.minPlayers],
      [controls.maxPlayers, details.maxPlayers],
      [controls.minPlaytime, details.minPlaytime],
      [controls.maxPlaytime, details.maxPlaytime],
    ];
    for (const [control, value] of copies) {
      if (value == null) continue;
      control.setValue(value);
      control.markAsTouched();
    }

    this.bggLink.set({ id: details.id, weight: details.weight });
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
