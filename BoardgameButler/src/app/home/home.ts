import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Game } from '../game';
import { GameStore } from '../game-store';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
})
export class Home {
  private store = inject(GameStore);

  protected games = this.store.games;
  protected ready = this.store.ready;
  protected selectedGame = signal<Game | null>(null);

  protected readonly features = [
    'Track your collection',
    'Players & duration',
    'Complexity ratings',
    'User ratings',
    'Quick-pick assistant',
    'Play statistics',
    'In-game utilities',
  ];

  protected serveGame() {
    const list = this.games();
    if (list.length === 0) return;
    this.selectedGame.set(list[Math.floor(Math.random() * list.length)]);
  }
}
