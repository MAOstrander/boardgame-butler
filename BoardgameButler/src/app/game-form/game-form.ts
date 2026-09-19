import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Game, GameDetails } from '../game';
import { GameStore } from '../game-store';
import { PlayStore } from '../play-store';

/**
 * One form for both adding and editing. With no `id` route parameter it
 * adds a new game; with one it edits that game in place.
 */
@Component({
  selector: 'app-game-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './game-form.html',
})
export class GameForm implements OnInit {
  private fb = inject(FormBuilder);
  private store = inject(GameStore);
  private plays = inject(PlayStore);
  private router = inject(Router);

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

  protected askDelete() {
    this.confirmingDelete.set(true);
  }

  protected cancelDelete() {
    this.confirmingDelete.set(false);
  }

  protected confirmDelete() {
    const game = this.game();
    if (!game) return;

    this.store.remove(game.id);
    if (!this.store.error()) {
      this.router.navigate(['/collection']);
    } else {
      this.confirmingDelete.set(false);
    }
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
