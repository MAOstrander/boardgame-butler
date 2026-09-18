import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'add-game',
    renderMode: RenderMode.Client,
  },
  {
    path: 'manage',
    renderMode: RenderMode.Client,
  },
  {
    path: 'collection',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
