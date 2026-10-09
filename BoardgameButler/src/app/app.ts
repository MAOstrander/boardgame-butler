import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UndoToast } from './undo-toast/undo-toast';
import { PersistentStorageService } from './persistent-storage';
import { BggCredit } from './bgg-credit/bgg-credit';
import { BggPlacementService } from './bgg-credit/bgg-placement';
// TEMPORARY: remove with the switcher once a credit placement is chosen.
import { BggPlacementSwitcher } from './bgg-credit/bgg-placement-switcher';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UndoToast, BggCredit, BggPlacementSwitcher],
  template: `
    <router-outlet />

    @if (bgg.shows('footer')) {
      <footer class="bg-gray-950 border-t border-gray-800 py-6 flex justify-center" data-testid="bgg-footer">
        <app-bgg-credit size="md" />
      </footer>
    }

    <app-undo-toast />
    <app-bgg-placement-switcher />
  `,
})
export class App {
  protected bgg = inject(BggPlacementService);

  constructor() {
    // Ask once, at startup, for storage the browser won't evict.
    void inject(PersistentStorageService).ensure();
  }
}
