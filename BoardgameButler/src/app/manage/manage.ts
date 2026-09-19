import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameStore } from '../game-store';
import { PlayerStore } from '../player-store';
import { PlayStore } from '../play-store';
import { RawPlay } from '../play';
import { buildExport, parseImport } from '../export-format';
import { ImportPlan, PlayerImportPlan, planImport, planPlayerImport } from '../import-plan';

interface Preview {
  version: 1 | 2 | 3;
  games: ImportPlan;
  /** null when the file has no players section (v1) — the device's players are kept. */
  players: PlayerImportPlan | null;
  /** null when the file has no plays section (v1/v2) — the device's history is kept. */
  plays: { incoming: RawPlay[]; fresh: number } | null;
}

/** Which sections of the previewed file the user wants applied. */
interface Apply {
  games: boolean;
  players: boolean;
  plays: boolean;
}

@Component({
  selector: 'app-manage',
  imports: [RouterLink],
  templateUrl: './manage.html',
})
export class Manage {
  private games = inject(GameStore);
  private players = inject(PlayerStore);
  private plays = inject(PlayStore);

  protected gameCount = () => this.games.games().length;
  protected playerCount = () => this.players.players().length;
  protected playCount = () => this.plays.plays().length;

  protected preview = signal<Preview | null>(null);
  protected apply = signal<Apply>({ games: true, players: true, plays: true });
  protected importError = signal<string | null>(null);
  protected importSuccess = signal<string | null>(null);

  protected onFileSelected(event: Event) {
    this.importError.set(null);
    this.importSuccess.set(null);
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

      this.apply.set({ games: true, players: true, plays: true });
      this.preview.set({
        version: parsed.version,
        games: planImport(parsed.games),
        players: parsed.players ? planPlayerImport(parsed.players) : null,
        plays: parsed.plays ? { incoming: parsed.plays, fresh: this.plays.countNew(parsed.plays) } : null,
      });
    };
    reader.readAsText(file);
  }

  protected toggle(section: keyof Apply, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.apply.update(a => ({ ...a, [section]: checked }));
  }

  /** True when at least one present section is selected. */
  protected canImport(): boolean {
    const p = this.preview();
    const a = this.apply();
    if (!p) return false;
    return a.games || (p.players != null && a.players) || (p.plays != null && a.plays);
  }

  protected confirmImport() {
    const preview = this.preview();
    if (!preview || !this.canImport()) return;
    const apply = this.apply();
    const done: string[] = [];

    if (apply.games) {
      this.games.replaceAll(preview.games.kept);
      done.push(`${preview.games.kept.length} game${preview.games.kept.length === 1 ? '' : 's'}`);
    }
    if (preview.players && apply.players) {
      this.players.replaceAll(preview.players.kept);
      done.push(`${preview.players.kept.length} player${preview.players.kept.length === 1 ? '' : 's'}`);
    }
    if (preview.plays && apply.plays) {
      const added = this.plays.merge(preview.plays.incoming);
      done.push(`${added} new play${added === 1 ? '' : 's'}`);
    }

    if (this.games.error() || this.players.error() || this.plays.error()) {
      this.importError.set('Import failed. Please try again.');
      return;
    }
    this.importSuccess.set(`Imported ${done.join(', ')}.`);
    this.preview.set(null);
  }

  protected cancelImport() {
    this.preview.set(null);
    this.importError.set(null);
  }

  protected exportCollection() {
    const file = buildExport(this.games.games(), this.players.players(), this.plays.plays());
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'boardgame-butler.json';
    link.click();
    URL.revokeObjectURL(url);
  }
}
