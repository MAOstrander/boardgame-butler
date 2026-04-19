import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const browserDistFolder = join(import.meta.dirname, '../browser');

// In production the file lands in the browser dist folder after ng build.
// During ng serve Vite serves assets from memory so the dist copy doesn't
// exist on disk — fall back to the source public/ directory instead.
const gamesFilePath = existsSync(join(browserDistFolder, 'games.json'))
  ? join(browserDistFolder, 'games.json')
  : join(process.cwd(), 'public', 'games.json');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.post('/api/games', express.json(), (req, res) => {
  try {
    const games = JSON.parse(readFileSync(gamesFilePath, 'utf-8'));
    games.push(req.body);
    writeFileSync(gamesFilePath, JSON.stringify(games, null, 2), 'utf-8');
    res.status(201).json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save game.' });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
