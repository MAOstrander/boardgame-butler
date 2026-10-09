import { Component, inject } from '@angular/core';
import { UndoService } from '../undo';

@Component({
  selector: 'app-undo-toast',
  template: `
    @if (offer(); as pending) {
      <div
        role="status"
        aria-live="polite"
        data-testid="undo-toast"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-3
               rounded-xl bg-gray-900 border border-gray-700 shadow-2xl text-sm max-w-[calc(100vw-2rem)]"
      >
        <span class="text-gray-200">{{ pending.message }}</span>
        <button
          type="button"
          (click)="undo()"
          class="shrink-0 text-amber-400 hover:text-amber-300 font-semibold transition-colors cursor-pointer"
        >
          Undo
        </button>
        <button
          type="button"
          (click)="dismiss()"
          aria-label="Dismiss"
          class="shrink-0 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
        >
          &#x2715;
        </button>
      </div>
    }
  `,
})
export class UndoToast {
  private undoService = inject(UndoService);

  protected offer = this.undoService.offer;

  protected undo() {
    this.undoService.accept();
  }

  protected dismiss() {
    this.undoService.dismiss();
  }
}
