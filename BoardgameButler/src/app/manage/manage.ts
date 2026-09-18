import { Component, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

interface Game {
  title: string;
  players: string;
  duration: string;
  complexity: string;
  rating?: number;
}

@Component({
  selector: 'app-manage',
  imports: [RouterLink],
  templateUrl: './manage.html',
})
export class Manage {
  private http = inject(HttpClient);

  protected preview = signal<Game[] | null>(null);
  protected importError = signal<string | null>(null);
  protected importing = signal(false);
  protected importSuccess = signal(false);

  protected onFileSelected(event: Event) {
    this.importError.set(null);
    this.importSuccess.set(false);
    this.preview.set(null);

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!Array.isArray(parsed)) {
          this.importError.set('File must contain a JSON array of games.');
          return;
        }
        this.preview.set(parsed);
      } catch {
        this.importError.set('Could not parse file — make sure it is valid JSON.');
      }
    };
    reader.readAsText(file);
  }

  protected confirmImport() {
    const games = this.preview();
    if (!games || this.importing()) return;

    this.importing.set(true);
    this.importError.set(null);

    this.http.put('/api/games', games).subscribe({
      next: () => {
        this.importing.set(false);
        this.importSuccess.set(true);
        this.preview.set(null);
      },
      error: () => {
        this.importing.set(false);
        this.importError.set('Import failed. Please try again.');
      },
    });
  }

  protected cancelImport() {
    this.preview.set(null);
    this.importError.set(null);
  }

  protected exportCollection() {
    window.location.href = '/api/games/export';
  }
}
