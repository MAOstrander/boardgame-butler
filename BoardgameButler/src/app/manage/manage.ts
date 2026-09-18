import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameStore } from '../game-store';
import { PlayerStore } from '../player-store';
import { buildExport, parseImport } from '../export-format';
import { ImportPlan, PlayerImportPlan, planImport, planPlayerImport } from '../import-plan';

interface Preview {
  version: 1 | 2;
  games: ImportPlan;
  /** null when the file has no players section (v1) — the device's players are kept. */
  players: PlayerImportPlan | null;
}

@Component({
  selector: 'app-manage',
  imports: [RouterLink],
  templateUrl: './manage.html',
})
export class Manage {
  private games = inject(GameStore);
  private players = inject(PlayerStore);

  protected gameCount = () => this.games.games().length;
  protected playerCount = () => this.players.players().length;
  protected preview = signal<Preview | null>(null);
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
      let data: unknown;
      try {
        data = JSON.parse(reader.result as string);
      } catch {
        this.importError.set('Could not parse file — make sure it is valid JSON.');
        return;
      }

      const parsed = parseImport(data);
      if ('error' in parsed) {
        this.importError.set(parsed.error);
        return;
      }

      this.preview.set({
        version: parsed.version,
        games: planImport(parsed.games),
        players: parsed.players ? planPlayerImport(parsed.players) : null,
      });
    };
    reader.readAsText(file);
  }

  protected confirmImport() {
    const preview = this.preview();
    if (!preview) return;

    this.games.replaceAll(preview.games.kept);
    if (preview.players) this.players.replaceAll(preview.players.kept);

    if (this.games.error() || this.players.error()) {
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
    const file = buildExport(this.games.games(), this.players.players());
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'boardgame-butler.json';
    link.click();
    URL.revokeObjectURL(url);
  }
}
