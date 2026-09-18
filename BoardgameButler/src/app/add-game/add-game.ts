import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Game } from '../game';
import { GameStore } from '../game-store';

@Component({
  selector: 'app-add-game',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './add-game.html',
})
export class AddGame {
  private fb = inject(FormBuilder);
  private store = inject(GameStore);
  private router = inject(Router);

  protected error = this.store.error;

  protected form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    players: ['', Validators.required],
    duration: ['', Validators.required],
    complexity: ['Medium', Validators.required],
    rating: [
      null as number | null,
      [Validators.required, Validators.min(1), Validators.max(10)],
    ],
  });

  protected submit() {
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const game: Game = {
      title: value.title,
      players: value.players,
      duration: value.duration,
      complexity: value.complexity,
      rating: value.rating ?? undefined,
    };

    this.store.add(game);
    if (!this.store.error()) {
      this.router.navigate(['/']);
    }
  }
}
