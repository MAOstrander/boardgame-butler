import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UndoToast } from './undo-toast/undo-toast';
import { PersistentStorageService } from './persistent-storage';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UndoToast],
  template: '<router-outlet /><app-undo-toast />',
})
export class App {
  constructor() {
    // Ask once, at startup, for storage the browser won't evict.
    void inject(PersistentStorageService).ensure();
  }
}
