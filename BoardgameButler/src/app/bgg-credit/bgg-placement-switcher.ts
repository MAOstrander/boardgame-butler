import { Component, inject, signal } from '@angular/core';
import { BGG_PLACEMENTS, BggPlacement, BggPlacementService } from './bgg-placement';

/**
 * TEMPORARY development control for comparing BGG credit placements. Collapses
 * to a small tab so it stays out of the way while judging each layout. Remove
 * this file, the service and the unused call sites once a placement is picked.
 */
@Component({
  selector: 'app-bgg-placement-switcher',
  template: `
    <div class="fixed bottom-3 left-3 z-50 text-xs" data-testid="bgg-switcher">
      @if (open()) {
        <div class="rounded-xl bg-gray-900 border border-amber-600/60 shadow-2xl p-3 w-44">
          <div class="flex items-center justify-between mb-2">
            <span class="text-amber-400 font-semibold">BGG credit</span>
            <button type="button" (click)="open.set(false)" aria-label="Collapse"
              class="text-gray-500 hover:text-gray-300 cursor-pointer">&#x2715;</button>
          </div>
          <div class="flex flex-col gap-1">
            @for (option of options; track option) {
              <button
                type="button"
                (click)="choose(option)"
                [attr.aria-pressed]="placement() === option"
                class="px-2 py-1 rounded-lg text-left transition-colors cursor-pointer"
                [class]="placement() === option
                  ? 'bg-amber-500 text-white font-medium'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
              >{{ label(option) }}</button>
            }
          </div>
          <p class="mt-2 text-gray-500 leading-snug">Temporary: for comparing placements.</p>
        </div>
      } @else {
        <button type="button" (click)="open.set(true)"
          class="px-2 py-1 rounded-lg bg-gray-900/90 border border-amber-600/50 text-amber-400 cursor-pointer">
          BGG: {{ placement() }}
        </button>
      }
    </div>
  `,
})
export class BggPlacementSwitcher {
  private service = inject(BggPlacementService);

  protected readonly options = BGG_PLACEMENTS;
  protected placement = this.service.placement;
  protected open = signal(false);

  protected choose(placement: BggPlacement) {
    this.service.set(placement);
  }

  protected label(placement: BggPlacement): string {
    return {
      footer: 'App footer',
      home: 'Home page',
      form: 'Game form',
      manage: 'Manage page',
      all: 'Show all four',
    }[placement];
  }
}
