import { Component, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface Game {
  title: string;
  players: string;
  duration: string;
  complexity: string;
  rating?: number;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
})
export class Home implements OnInit {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  protected games = signal<Game[]>([]);
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

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.http.get<Game[]>('/games.json').subscribe(games => {
        this.games.set(games);
      });
    }
  }

  protected serveGame() {
    const list = this.games();
    if (list.length === 0) return;
    this.selectedGame.set(list[Math.floor(Math.random() * list.length)]);
  }
}
