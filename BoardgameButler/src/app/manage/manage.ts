import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Game } from '../game';
import { GameStore } from '../game-store';

@Component({
  selector: 'app-manage',
  imports: [RouterLink],
  templateUrl: './manage.html',
})
export class Manage {
  private store = inject(GameStore);

  protected count = () => this.store.games().length;
  protected preview = signal<Game[] | null>(null);
  protected importError = signal<string | null>(null);
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
    if (!games) return;

    this.store.replaceAll(games);
    if (this.store.error()) {
      this.importError.set('Import failed. Please try again.');
      return;
    }
    this.importSuccess.set(true);
    this.preview.set(null);
  }

  protected cancelImport() {
    this.preview.set(null);
    this.importError.set(null);
  }

  protected exportCollection() {
    const blob = new Blob([this.store.toJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'games.json';
    link.click();
    URL.revokeObjectURL(url);
  }
}
