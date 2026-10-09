# Boardgame Butler

Your personal board game concierge. Track the games you own, let the Butler pick what to play tonight, log how it went, and see what actually hits the table.

**Live at [mathewostrander.com/boardgame-butler](https://mathewostrander.com/boardgame-butler/)**. Installable as an app on phones and desktops, and fully usable offline.

---

## What it does

**Pick a game.** Press *Serve me a game!* for a random pick from the whole collection, or open the filter panel to narrow by how many people are playing, how long you have, complexity, minimum rating, or which games are overdue a turn. *Serve me a match!* then picks from only those.

**Keep the collection.** Add, edit and delete games, each with a player range, play time, complexity and your own 1–10 rating. The collection page is searchable and sortable on every column. Duplicate titles are refused, case- and whitespace-insensitively.

**Log plays.** Record who played, how many were at the table, who won, how long it took and how fun it was. The history page lists every session; the stats page turns them into per-game and per-player numbers: plays, hours at the table, win rates, which games you never get to, and how long a game *actually* runs at three players versus four.

**Table tools.** A dice roller (d4–d100, up to ten dice), a countdown timer that vibrates and beeps when time is up, and a stopwatch whose elapsed time can be dropped straight into a play log.

**Back it up.** Export everything to a JSON file and import it on another device.

## How your data works

There is **no server and no account**. Everything lives in your browser's `localStorage`, on the device you're using:

- Each device keeps its **own independent collection**. Your phone and your laptop do not share data; export and import to move between them.
- Nothing is ever sent anywhere. Nobody else can see or change your data, and you cannot see theirs.
- A device that has never used the app is **seeded with sample games, players and play history** so every feature has something to show. Those samples are replaced the moment you change anything, and deleting everything is remembered, so only clearing site data brings them back.
- Clearing your browser's site data **deletes your collection**. Since the play history is the part you can't recreate, export occasionally.

## Running it locally

Requires **Node 22+**. All commands run from the `BoardgameButler/` directory.

```bash
git clone https://github.com/MAOstrander/boardgame-butler.git
cd boardgame-butler/BoardgameButler
npm install

npm start     # dev server on http://localhost:4200
npm test      # 375 tests (Vitest + jsdom)
npm run build # production build → dist/BoardgameButler/browser
```

> **Note:** `npm start` does **not** register the service worker, so the install prompt and offline support won't appear in dev. To exercise those, run a production build and serve it over `localhost` or HTTPS. See [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md).

### Building for the deployed sub-path

The live site is served from a sub-path, so the base href has to match:

```bash
ng build --base-href /boardgame-butler/
```

On Windows **Git Bash** prefix this with `MSYS_NO_PATHCONV=1`, or the shell rewrites the argument into a Windows path. PowerShell and CI are unaffected.

## How it's built

| | |
|---|---|
| Framework | Angular 21 with standalone components, signals, zoneless change detection and the new control flow |
| Styling | Tailwind CSS 4 |
| Offline / install | `@angular/service-worker` + a web app manifest |
| Storage | `localStorage`, three keys: games, players, plays |
| Tests | Vitest and jsdom, running functional specs that drive the rendered DOM |
| Hosting | GitHub Pages, static files, no backend |

### Layout

```
BoardgameButler/
  public/              seed data (games/players/plays), icons, manifest
  src/app/
    home/ collection/ game-form/ manage/      collection & quick-pick
    players/ play-form/ history/ stats/       people & play log
    tools/                                    dice and timers
    *-store.ts                                localStorage-backed stores
    stats.ts game-filter.ts import-plan.ts    pure logic, unit-tested
bgg-proxy/             Cloudflare Worker holding the BoardGameGeek API token
docs/
  FEATURES.md          what every page does, data models, roadmap
  MANUAL_TESTING.md    step-by-step checks on PC and mobile
```

Business logic lives in pure functions (`stats.ts`, `game-filter.ts`, `import-plan.ts`, `dice.ts`, `timer.ts`) so it can be tested without a DOM; components stay thin and are tested by driving the rendered page.

## Deployment

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): install → test → build with the correct base href → publish to GitHub Pages. A failing test blocks the deploy.

The workflow also copies `index.html` to `404.html` (GitHub Pages has no rewrite rules, so deep links would otherwise 404) and adds `.nojekyll`.

### The BGG proxy

[`bgg-proxy/`](bgg-proxy/README.md) is a separate Cloudflare Worker, deployed by hand with `npx wrangler deploy`. It holds the BoardGameGeek API token as a Cloudflare secret and caches their responses, because BGG ask that requests come from a server rather than a browser and a token in the app bundle would be public. Its tests run in CI on their own, independent of the Pages deploy.

## Documentation

- **[docs/FEATURES.md](docs/FEATURES.md)**: every page in detail, the data models, the backup file format, PWA setup, test coverage and the roadmap.
- **[docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md)**: manual checks on desktop and mobile, including installing the PWA and verifying offline behaviour.

## Licence

[MIT](LICENSE) © 2026 Mathew Ostrander.

The artwork in `public/` (the hero background and the icons derived from it) was supplied by the project author.

`public/bgg/powered-by-bgg.svg` is BoardGameGeek's "Powered by BGG" logo, used under their [XML API terms of use](https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use) and displayed on the add/edit game page with a link back to the site. Board game data retrieved from their API is theirs, not covered by the licence above.
