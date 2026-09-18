import { Routes } from '@angular/router';
import { Home } from './home/home';
import { GameForm } from './game-form/game-form';
import { Manage } from './manage/manage';
import { Collection } from './collection/collection';
import { Tools } from './tools/tools';
import { Players } from './players/players';
import { PlayForm } from './play-form/play-form';
import { History } from './history/history';
import { Stats } from './stats/stats';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'add-game', component: GameForm },
  { path: 'edit-game/:id', component: GameForm },
  { path: 'manage', component: Manage },
  { path: 'collection', component: Collection },
  { path: 'tools', component: Tools },
  { path: 'players', component: Players },
  { path: 'history', component: History },
  { path: 'stats', component: Stats },
  { path: 'log-play', component: PlayForm },
  { path: 'log-play/:id', component: PlayForm },
];
