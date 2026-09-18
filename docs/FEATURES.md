# Boardgame Butler — Feature Documentation

Boardgame Butler is a personal board game concierge: it keeps a small library of the games you own and helps you pick one to play. The app is a single-user Angular application with a thin Express backend that reads and writes a JSON file on disk.

This document describes the features that exist today. Items shown as "planned" appear in the app's UI but are not yet implemented.

---

## Contents

- [Overview](#overview)
- [Game data model](#game-data-model)
- [Pages](#pages)
  - [Home — "Serve me a game!"](#home--serve-me-a-game)
  - [Add a Game](#add-a-game)
  - [Manage Collection (import / export)](#manage-collection-import--export)
- [HTTP API](#http-api)
- [Data storage](#data-storage)
- [Rendering modes (SSR / prerender)](#rendering-modes-ssr--prerender)
- [Running the app](#running-the-app)
- [Planned features (not yet implemented)](#planned-features-not-yet-implemented)

---

## Overview

| Area | Technology |
|---|---|
| Frontend | Angular 21 (standalone components, signals, new control flow) |
| Styling | Tailwind CSS 4 |
| Backend | Express 5 via `@angular/ssr/node` |
| Persistence | Flat JSON file (`public/games.json`) |
| Tests | Vitest + jsdom (scaffolded, no feature tests yet) |

There are three routes:

| Route | Component | Purpose |
|---|---|---|
| `/` | `Home` | Splash page and random game picker |
| `/add-game` | `AddGame` | Form to add one game to the collection |
| `/manage` | `Manage` | Export the collection or replace it by importing a JSON file |

Every page links to the others (Home → Add / Manage; Add → Home / Manage; Manage → Home).

---

## Game data model

A game is a plain JSON object:

```ts
interface Game {
  title: string;       // e.g. "Catan"
  players: string;     // free text, e.g. "3-4"
  duration: string;    // free text, minutes, e.g. "60-120"
  complexity: string;  // "Easy" | "Medium" | "Hard"
  rating?: number;     // 1–10, optional (older entries may omit it)
}
```

Notes:

- `players` and `duration` are **strings**, not numbers, so ranges like `"2-5"` or `"45-90"` are stored exactly as typed. Nothing parses them yet.
- `complexity` is constrained to Easy / Medium / Hard by the Add Game form, but the API does not validate it.
- `rating` is required when adding a game through the UI, but the seed data and imported files may leave it out. The UI treats a missing rating as "no rating" and hides the badge.
- There is no `id` field. Games are identified only by their position in the array (and by `title` in the import preview list).

The seed collection in `public/games.json` contains 11 games (Catan, Ticket to Ride, Pandemic, Terraforming Mars, Azul, Wingspan, Gloomhaven, …).

---

## Pages

### Home — "Serve me a game!"

**Route:** `/`
**Files:** `src/app/home/home.ts`, `src/app/home/home.html`

The landing page shows a full-bleed background image (`public/DiceButler.jpg`) with a dark overlay, the app title and tagline, and a row of feature "chips".

**What it does**

1. On load (browser only — skipped during server rendering) it fetches `/games.json` and stores the result in a `games` signal.
2. While the list is empty it shows *"Loading game library..."* and the main button is disabled.
3. Clicking **Serve me a game!** picks one game uniformly at random from the collection and displays it in a *"Tonight's pick"* card showing:
   - Title
   - `players` players
   - `duration` min
   - `complexity`
   - `rating/10` (only if the game has a rating)
4. Clicking the button again re-rolls. The same game can be picked twice in a row — there is no history or exclusion.
5. Links at the bottom go to **+ Add a game** and **⚙ Manage collection**.

**Current limitations**

- The pick is purely random. There is no filtering by player count, duration, or complexity yet, even though the tagline describes that.
- The list is loaded from the static `/games.json` asset, so a game added via the API appears on the next full page load.

---

### Add a Game

**Route:** `/add-game`
**Files:** `src/app/add-game/add-game.ts`, `src/app/add-game/add-game.html`

A reactive form for adding a single game.

**Fields**

| Field | Control | Validation | Default |
|---|---|---|---|
| Title | text | required | — |
| Players | text (e.g. `2-4`) | required | — |
| Duration (minutes) | text (e.g. `60-120`) | required | — |
| Complexity | select: Easy / Medium / Hard | required | Medium |
| Your Rating | range slider 1–10 | required, min 1, max 10 | none (slider must be moved) |

- Required-field errors appear beneath a field once it has been touched.
- The rating slider shows the live value (`7 / 10`) next to its label once set.
- The submit button is disabled while the form is invalid or a save is in flight; its label switches to *Saving...* during submission.

**Submit behaviour**

- `POST /api/games` with the form value as the JSON body.
- On success, navigates back to `/`.
- On failure, shows *"Failed to save game. Please try again."* and re-enables the form.

**Current limitations**

- No duplicate-title check.
- No editing or deleting of existing games — only adding.
- Players/duration are not validated as numbers or ranges.

---

### Manage Collection (import / export)

**Route:** `/manage`
**Files:** `src/app/manage/manage.ts`, `src/app/manage/manage.html`

Bulk backup and restore of the whole collection.

#### Export

- **Download games.json** navigates the browser to `GET /api/games/export`.
- The server responds with the current collection as an attachment named `games.json` (pretty-printed, 2-space indent).

#### Import

Importing **replaces the entire collection**; the page warns about this in red.

1. Click the dashed drop-zone to choose a file (`.json` / `application/json` only).
2. The file is read client-side with `FileReader` and parsed:
   - Invalid JSON → *"Could not parse file — make sure it is valid JSON."*
   - Valid JSON that is not an array → *"File must contain a JSON array of games."*
3. A **preview** lists every game in the file (title, players, complexity) with a count, in a scrollable list.
4. **Confirm Import** sends `PUT /api/games` with the parsed array. **Cancel** discards the preview.
5. On success a green *"Collection imported successfully!"* banner appears and the drop-zone is shown again. On failure: *"Import failed. Please try again."*

**Current limitations**

- The preview only checks that the payload is an array; it does not validate that each item has the expected `Game` fields.
- There is no merge option — import is always a full overwrite.
- The preview list uses `title` as its tracking key, so duplicate titles in the file may render oddly.

---

## HTTP API

All endpoints are defined in `src/server.ts` and operate on a single JSON file (see [Data storage](#data-storage)). There is no authentication.

### `POST /api/games`

Append one game to the collection.

- **Body:** a single `Game` JSON object.
- **Response:** `201 { "success": true }`
- **Errors:** `500 { "error": "Failed to save game." }` if the file cannot be read or written.
- The body is **not** validated; whatever is posted is appended verbatim.

### `PUT /api/games`

Replace the entire collection.

- **Body:** a JSON array of `Game` objects.
- **Response:** `200 { "success": true, "count": <number of games> }`
- **Errors:**
  - `400 { "error": "Body must be a JSON array of games." }` if the body is not an array.
  - `500 { "error": "Failed to replace collection." }` on write failure.

### `GET /api/games/export`

Download the collection.

- **Response:** `200`, `Content-Type: application/json`, `Content-Disposition: attachment; filename="games.json"`, body is the raw file contents.
- **Errors:** `500 { "error": "Failed to export collection." }`

### `GET /games.json`

Not an API route — this is the static asset served from the browser dist / `public` folder. The Home page reads the collection from here.

---

## Data storage

The collection lives in one file. The server chooses the path at startup:

```
dist/BoardgameButler/browser/games.json   (if it exists — production build)
public/games.json                          (fallback — used by `ng serve`)
```

Rationale (from the comment in `server.ts`): during `ng serve`, Vite serves `public/` assets from memory and never writes the dist copy to disk, so the server falls back to the source file. In a production build the file is copied into the browser dist folder and edited there.

Implications:

- In development, adding or importing games **edits `public/games.json` in your working tree**, which shows up in `git status`.
- In production, changes are made to the built copy and are lost on the next `ng build` unless you export first.
- Writes are whole-file, synchronous, and unlocked; concurrent requests could race.

---

## Rendering modes (SSR / prerender)

Configured in `src/app/app.routes.server.ts`:

| Route | Render mode |
|---|---|
| `/add-game` | Client-only |
| `/manage` | Client-only |
| everything else (`**`, i.e. `/`) | Prerendered at build time |

The Home page guards its HTTP call with `isPlatformBrowser`, so the prerendered HTML contains the splash page in its *"Loading game library..."* state and the collection is fetched after hydration. Client hydration with event replay is enabled in `app.config.ts`.

---

## Running the app

From the `BoardgameButler/` directory:

```bash
npm install
npm start                          # ng serve — dev server with API routes, edits public/games.json
npm run build                      # production build to dist/BoardgameButler
npm run serve:ssr:BoardgameButler  # run the built Express server (port 4000 or $PORT)
npm test                           # vitest
```

The Express server listens on `PORT` (default `4000`) when run directly or under PM2.

---

## Planned features (not yet implemented)

The Home page advertises the following chips. Only the first four are fully backed by working functionality today:

| Chip | Status |
|---|---|
| Track your collection | ✅ Add / import / export |
| Players & duration | ✅ Stored and displayed (free-text) |
| Complexity ratings | ✅ Easy / Medium / Hard |
| User ratings | ✅ 1–10 slider, shown on the pick card |
| Quick-pick assistant | ⚠️ Random pick only — no filters |
| Play statistics | ❌ Not started |
| In-game utilities | ❌ Not started |

Other gaps worth noting for future work:

- Edit / delete individual games
- Filtering the quick-pick by player count, time available, or complexity
- Schema validation on the API
- Stable game IDs
- Feature tests (only the default `app.spec.ts` scaffold exists)
