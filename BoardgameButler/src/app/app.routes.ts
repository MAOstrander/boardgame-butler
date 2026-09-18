import { Routes } from '@angular/router';
import { Home } from './home/home';
import { GameForm } from './game-form/game-form';
import { Manage } from './manage/manage';
import { Collection } from './collection/collection';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'add-game', component: GameForm },
  { path: 'edit-game/:id', component: GameForm },
  { path: 'manage', component: Manage },
  { path: 'collection', component: Collection },
];
