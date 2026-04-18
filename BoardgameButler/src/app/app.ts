import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface Game {
  title: string;
  players: string;
  duration: string;
  complexity: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private http = inject(HttpClient);

  protected games = signal<Game[]>([]);
  protected selectedGame = signal<Game | null>(null);

  protected readonly features = [
    'Track your collection',
    'Players & duration',
    'Complexity ratings',
    'Quick-pick assistant',
    'Play statistics',
    'In-game utilities',
  ];

  ngOnInit() {
    this.http.get<Game[]>('/games.json').subscribe(games => {
      this.games.set(games);
    });
  }

  protected serveGame() {
    const list = this.games();
    if (list.length === 0) return;
    this.selectedGame.set(list[Math.floor(Math.random() * list.length)]);
  }
}
