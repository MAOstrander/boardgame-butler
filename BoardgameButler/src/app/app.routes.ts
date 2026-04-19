import { Routes } from '@angular/router';
import { Home } from './home/home';
import { AddGame } from './add-game/add-game';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'add-game', component: AddGame },
];
