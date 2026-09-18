import { Routes } from '@angular/router';
import { Home } from './home/home';
import { AddGame } from './add-game/add-game';
import { Manage } from './manage/manage';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'add-game', component: AddGame },
  { path: 'manage', component: Manage },
];
