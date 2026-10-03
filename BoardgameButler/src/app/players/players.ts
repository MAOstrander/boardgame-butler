import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlayerStore } from '../player-store';

@Component({
  selector: 'app-players',
  imports: [RouterLink],
  templateUrl: './players.html',
})
export class Players {
  private store = inject(PlayerStore);

  protected players = computed(() =>
    [...this.store.players()].sort((a, b) => a.name.localeCompare(b.name)),
  );
  protected error = this.store.error;
  protected ready = this.store.ready;

  // --- Add
  protected newName = signal('');
  protected addError = computed(() => this.validate(this.newName()));

  // --- Rename (one row at a time)
  protected editingId = signal<string | null>(null);
  protected editName = signal('');
  protected editError = computed(() => this.validate(this.editName(), this.editingId() ?? undefined));

  // --- Delete confirmation (one row at a time)
  protected confirmingId = signal<string | null>(null);

  protected onNewName(event: Event) {
    this.newName.set((event.target as HTMLInputElement).value);
  }

  protected add() {
    const name = this.newName().trim();
    if (!name || this.addError()) return;
    this.store.add(name);
    if (!this.store.error()) this.newName.set('');
  }

  protected startEdit(id: string, name: string) {
    this.confirmingId.set(null);
    this.editingId.set(id);
    this.editName.set(name);
  }

  protected onEditName(event: Event) {
    this.editName.set((event.target as HTMLInputElement).value);
  }

  protected saveEdit() {
    const id = this.editingId();
    const name = this.editName().trim();
    if (!id || !name || this.editError()) return;
    this.store.rename(id, name);
    if (!this.store.error()) this.cancelEdit();
  }

  protected cancelEdit() {
    this.editingId.set(null);
    this.editName.set('');
  }

  protected askDelete(id: string) {
    this.cancelEdit();
    this.confirmingId.set(id);
  }

  protected cancelDelete() {
    this.confirmingId.set(null);
  }

  protected confirmDelete() {
    const id = this.confirmingId();
    if (!id) return;
    this.store.remove(id);
    this.confirmingId.set(null);
  }

  /** Duplicate-name message, or null when the name is fine (or empty). */
  private validate(name: string, excludeId?: string): string | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    return this.store.hasName(trimmed, excludeId) ? `You already have a player called "${trimmed}".` : null;
  }
}
