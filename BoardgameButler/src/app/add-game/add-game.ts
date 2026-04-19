import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-add-game',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './add-game.html',
})
export class AddGame {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);

  protected submitting = signal(false);
  protected error = signal<string | null>(null);

  protected form = this.fb.group({
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
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    this.http.post('/api/games', this.form.value).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => {
        this.error.set('Failed to save game. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
