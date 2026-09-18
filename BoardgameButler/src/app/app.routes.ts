import { Routes } from '@angular/router';
import { Home } from './home/home';
import { AddGame } from './add-game/add-game';
import { Manage } from './manage/manage';
import { Collection } from './collection/collection';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'add-game', component: AddGame },
  { path: 'manage', component: Manage },
  { path: 'collection', component: Collection },
];
