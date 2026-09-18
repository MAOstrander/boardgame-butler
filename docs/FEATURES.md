# Boardgame Butler — Feature Documentation

Boardgame Butler is a personal board game concierge: it keeps a small library of the games you own and helps you pick one to play. It is a single-user, installable **progressive web app** — the collection lives in the browser's storage on each device, so once installed it works fully offline with no server behind it.

This document describes the features that exist today. Items shown as "planned" appear in the app's UI but are not yet implemented.

---

## Contents

- [Overview](#overview)
- [Game data model](#game-data-model)
- [Player data model](#player-data-model)
- [Pages](#pages)
  - [Home — "Serve me a game!"](#home--serve-me-a-game)
  - [Your Collection](#your-collection)
  - [Add / Edit a Game](#add--edit-a-game)
  - [Manage Collection (import / export)](#manage-collection-import--export)
  - [Table Tools (dice & timers)](#table-tools-dice--timers)
  - [Players](#players)
- [Data storage](#data-storage)
- [Backup file format](#backup-file-format)
- [Progressive web app (install & offline)](#progressive-web-app-install--offline)
- [Running and deploying](#running-and-deploying)
- [Planned features (not yet implemented)](#planned-features-not-yet-implemented)
- [Roadmap](#roadmap)

---

## Overview

| Area | Technology |
|---|---|
| Frontend | Angular 21 (standalone components, signals, new control flow, zoneless) |
| Styling | Tailwind CSS 4 |
| Backend | None — static files only |
| Persistence | `localStorage` on each device — games (seeded from a bundled `games.json`) and players under separate keys |
| Offline / install | `@angular/service-worker` + web app manifest |
| Tests | Vitest + jsdom — functional component specs for every page (`npm test`) |

There are seven routes:

| Route | Component | Purpose |
|---|---|---|
| `/` | `Home` | Splash page and random game picker |
| `/collection` | `Collection` | Searchable, sortable table of every game, with an Edit link per row |
| `/add-game` | `GameForm` | Form to add one game to the collection |
| `/edit-game/:id` | `GameForm` | The same form, pre-filled, to change or delete an existing game |
| `/manage` | `Manage` | Export games + players as a backup, or restore from one |
| `/tools` | `Tools` | Dice roller, countdown timer and stopwatch for use at the table |
| `/players` | `Players` | The people you play with — add, rename, remove |

Every page links to the others through a small nav row under the back link.

---

## Game data model

A game is a plain JSON object, defined once in `src/app/game.ts`:

```ts
interface Game {
  id: string;          // stable identifier, assigned by GameStore
  title: string;       // e.g. "Catan"
  players: string;     // free text, e.g. "3-4"
  duration: string;    // free text, minutes, e.g. "60-120"
  complexity: string;  // "Easy" | "Medium" | "Hard"
  rating?: number;     // 1–10, optional (older entries may omit it)
}
```

Two helper types cover the edges: `RawGame` (a game from a JSON file, where `id` is optional) and `GameDetails` (everything except `id` — what the form edits).

Notes:

- `id` is what the edit route and the store's `find`/`update` use. Files don't need to include it: the store assigns one to anything that arrives without it (see [Data storage](#data-storage)). Exported files do include it, so a round trip keeps ids stable.
- **Titles are unique** within a collection, ignoring case and surrounding whitespace. The form refuses a duplicate, and import keeps only the first entry of each title (see [Manage](#manage-collection-import--export)). The store itself does not enforce it.

- `players` and `duration` are **strings**, not numbers, so ranges like `"2-5"` or `"45-90"` are stored exactly as typed. Nothing parses them yet.
- `complexity` is constrained to Easy / Medium / Hard by the Add Game form, but imported files are not validated.
- `rating` is required when adding a game through the UI, but the seed data and imported files may leave it out. The UI treats a missing rating as "no rating" and hides the badge.
- The import preview list is keyed by `title` because imported rows may not have ids yet.

The starter collection in `public/games.json` contains 11 games (Catan, Ticket to Ride, Pandemic, Terraforming Mars, Azul, Wingspan, Gloomhaven, …). It is only used to seed a device that has never saved a collection — see [Data storage](#data-storage).

---

## Player data model

```ts
interface Player {
  id: string;    // stable identifier, assigned by PlayerStore
  name: string;  // trimmed; unique within a device ignoring case
}
```

Players exist so that future play statistics can group by person without "Matt" and "matt" splitting into two people. A `RawPlayer` (optional `id`) is what arrives from a backup file. Names follow the same uniqueness rule as game titles — `normalizeKey()` in `src/app/normalize.ts`, shared by both stores and the import de-duplication.

There are no players in the seed data; the list starts empty on a new device.

---

## Pages

### Home — "Serve me a game!"

**Route:** `/`
**Files:** `src/app/home/home.ts`, `src/app/home/home.html`

The landing page shows a full-bleed background image (`public/DiceButler.jpg`) with a dark overlay, the app title and tagline, and a row of feature "chips".

**What it does**

1. It reads the collection from the shared `GameStore` (see [Data storage](#data-storage)).
2. Until the store is ready it shows *"Loading game library..."* and the main button is disabled. If the store is ready but empty it shows *"Your collection is empty — add a game to get started."* instead.
3. Clicking **Serve me a game!** picks one game uniformly at random from the **whole collection** and displays it in a *"Tonight's pick"* card showing:
   - Title
   - `players` players
   - `duration` min
   - `complexity`
   - `rating/10` (only if the game has a rating)
4. Clicking the button again re-rolls. The same game can be picked twice in a row — there is no history or exclusion.
5. **▾ Narrow it down** opens a filter panel (see below). **Serve me a match!** inside it picks at random from only the games that pass the filters, and the card is labelled *"Tonight's pick · from your matches"*. The main button always ignores the filters, so both options are available at once.
6. Links at the bottom go to **📚 View collection**, **+ Add a game**, **⚙ Manage collection**, **🎲 Table tools** and **👥 Players**.

**Filters**

| Filter | Control | A game matches when… |
|---|---|---|
| Players tonight | number input | the count is inside the game's player range, inclusive (`2-4` matches 2, 3 or 4; `3+` matches anything ≥ 3) |
| Time available | select: Any / up to 30, 45, 60, 90, 120, 180 min | the game's **longest** listed duration fits — `45-90` does *not* match "up to 60", so you're never served a game that might run over |
| Complexity | Easy / Medium / Hard toggle buttons | its complexity is one of the selected ones; none selected means any |
| Minimum rating | select: Any / 5+ … 9+ | its rating is at or above the minimum; **unrated games are excluded** when this is set |

- Filters combine with AND. The panel shows a live count: *"No filters set — all N games match"*, *"K of N games match"*, or *"No games match these filters"* (the match button is disabled in that case).
- **Clear** resets every filter. Hiding the panel keeps the filters; they reset on a full page reload.
- Player and duration ranges are parsed from the free-text fields (`"2-4"`, `"60-120"`, `"2"`, `"3+"`, `"2 to 6"`). A game whose text can't be parsed is excluded by that filter, since the app can't tell whether it fits. The parsing and matching logic is in `src/app/game-filter.ts`.

**Current limitations**

- The pick is uniformly random with no history — the same game can come up repeatedly.
- Filters aren't remembered between launches.

---

### Your Collection

**Route:** `/collection`
**Files:** `src/app/collection/collection.ts`, `src/app/collection/collection.html`

A read-only table of every game in the collection.

**What it does**

1. It reads the collection from the shared `GameStore` and shows *Loading...* only on a first run while the starter data is being seeded.
2. The subtitle shows the total count, or *Showing N of M games* when a search is active.
3. A **search box** filters rows by title (case-insensitive substring match). If nothing matches, the table shows *No games match "…"*.
4. Every column header is a **sort toggle**. Clicking a header sorts ascending; clicking it again flips to descending. The active column is highlighted in amber with a ▲/▼ indicator. Default sort is title A→Z.

| Column | Sort behaviour |
|---|---|
| Title | Locale-aware alphabetical |
| Players | By the leading number of the range (`"2-4"` → 2) |
| Minutes | By the leading number of the range (`"60-120"` → 60) |
| Complexity | Easy → Medium → Hard |
| Rating | Numeric; unrated games always sort last in either direction |

5. Complexity is shown as a colour-coded pill (green / amber / red). Missing ratings render as `—`.
6. Every row ends with an **Edit** link to `/edit-game/<id>`.
7. If the collection is empty, an empty-state card links to **Add your first game**.
8. If the store reports an error (e.g. the starter collection could not be fetched on first run) it is shown in a red banner.

**Current limitations**

- Delete lives on the edit page rather than in the table, so removing several games means several round trips.
- Values that don't start with a number (e.g. `"any"`) sort to the end of Players / Minutes.

---

### Add / Edit a Game

**Routes:** `/add-game`, `/edit-game/:id`
**Files:** `src/app/game-form/game-form.ts`, `src/app/game-form/game-form.html`

One reactive form serves both jobs. Without an `:id` it adds a game; with one it loads that game from the store and edits it in place. The `id` arrives as a component input via the router's `withComponentInputBinding()`.

| | Add | Edit |
|---|---|---|
| Heading | *Add a Game* | *Edit Game* — "Update the details for *Title*." |
| Initial values | empty, complexity Medium | the game's current values |
| Submit button | *Add to Collection* | *Save Changes* (plus a *Cancel* link) |
| On success | `GameStore.add()`, go to `/` | `GameStore.update(id, …)`, go to `/collection` |
| Delete | — | **Delete this game** below the form → inline confirmation *"Remove Title from your collection? This can't be undone."* with **Yes, delete it** / **Keep it**. Confirming calls `GameStore.remove(id)` and returns to `/collection` |
| Unknown id | — | *"That game isn't in your collection any more."* with a link back |

**Fields**

| Field | Control | Validation | Default |
|---|---|---|---|
| Title | text | required; **must not match another game's title** (case-insensitive, trimmed) | — |
| Players | text (e.g. `2-4`) | required | — |
| Duration (minutes) | text (e.g. `60-120`) | required | — |
| Complexity | select: Easy / Medium / Hard | required | Medium |
| Your Rating | range slider 1–10 | required, min 1, max 10 | none (slider must be moved) |

- Required-field errors appear beneath a field once it has been touched. The duplicate-title error — *You already have a game called "…"* — appears as soon as the title matches, and the submit button stays disabled. When editing, the game's own current title is allowed.
- Text fields are trimmed before saving.
- The rating slider shows the live value (`7 / 10`) next to its label once set.
- The submit button is disabled while the form is invalid.

**Submit behaviour**

- Appends the game to the `GameStore`, which writes it to `localStorage` immediately.
- On success, navigates back to `/`.
- If the browser refuses the write (e.g. storage quota exceeded or storage disabled), shows *"Could not save your collection to this device."* and stays on the page.

**Current limitations**

- Players/duration are not validated as numbers or ranges.
- Rating is required even when editing, so saving any change to an unrated game means rating it.

---

### Manage Collection (import / export)

**Route:** `/manage`
**Files:** `src/app/manage/manage.ts`, `src/app/manage/manage.html`

Backup and restore of everything on the device — games **and players**. Because each device keeps its own data, this is also how you move between devices — export on one, import on the other.

#### Export

- The page shows how many games and players will be exported.
- **Download boardgame-butler.json** builds a `Blob` of the [backup file](#backup-file-format) (pretty-printed) and triggers a browser download. Nothing leaves the device.

#### Import

Importing **replaces what's on this device**; the page warns about this in red. Two file shapes are accepted:

- A **backup** (`{ version: 2, games, players }`) replaces both games and players.
- An **older games-only file** (a bare JSON array, as exported before players existed) replaces the games and **leaves the players alone** — the preview says so explicitly.

1. Click the dashed drop-zone to choose a file (`.json` / `application/json` only).
2. The file is read client-side with `FileReader` and parsed (`parseImport()` in `src/app/export-format.ts`):
   - Invalid JSON → *"Could not parse file — make sure it is valid JSON."*
   - Neither an array nor an object with a `games` entry → *"File must contain a JSON array of games, or a backup exported by this app."*
   - A backup whose `games` or `players` entry isn't an array → *"The "games" entry must be a JSON array."* (or `players`)
3. A **preview** lists every game in the file (title, players, complexity) with a count, in a scrollable list.
4. **Duplicate titles in the file** (same title ignoring case and whitespace) are handled *first wins*: the first entry is kept, later ones are greyed out and struck through with *skipped — duplicate of Catan*. If a skipped entry differs from the kept one, the differing fields are shown (*differs: rating 9*) so you can cancel and fix the file if "first wins" isn't what you want. The summary reads *Ready to import 10 games (2 duplicates will be skipped)* and an amber note explains the rule. The logic is the pure `planImport()` in `src/app/import-plan.ts`.
5. Below the games, a **players line** shows what will happen to players: *"and 3 players"* with the names as chips (duplicates by name struck through, first wins, same as games), *"and 0 players — your current players will be removed"* for a backup with none, or *"This is an older games-only file — your N players will be kept."*
6. **Confirm Import** replaces the games (and players, if the file has them) and persists. **Cancel** discards the preview.
7. On success a green *"Backup imported successfully!"* banner appears and the drop-zone is shown again. If the browser refuses the write: *"Import failed. Please try again."* and the preview is kept.

**Current limitations**

- The preview only checks that the payload is an array; it does not validate that each item has the expected `Game` fields.
- There is no merge option — import is always a full overwrite (per section: games, and players when present).
- Duplicates are resolved by position only; there is no per-duplicate choice of which entry to keep.

---

### Table Tools (dice & timers)

**Route:** `/tools`
**Files:** `src/app/tools/tools.ts`, `src/app/tools/tools.html`, with logic in `src/app/dice.ts`, `src/app/timer.ts` and `src/app/timer-service.ts`

Three cards for use during a game. Nothing here touches the collection.

#### Dice

- Pick a die type — **d4, d6, d8, d10, d12, d20, d100** — and a count from 1 to 10 with a −/+ stepper.
- **Roll NdX** shows the total in large type and, for more than one die, each individual result.
- The last five rolls are listed under *Recent rolls* (newest first).
- `rollDice(sides, count, random?)` in `dice.ts` is pure; the random source is injectable so tests are deterministic.

#### Countdown

- Presets **1, 2, 5, 10, 15, 30 min**, or a **Custom** minutes box (decimals allowed, e.g. `2.5`).
- **Start / Pause / Resume / Reset**. Presets and the custom box are disabled while running.
- At zero the display turns red and pulses, *Time's up!* is announced (`role="alert"`), and the device **vibrates** and **beeps** where the platform allows (`navigator.vibrate`, Web Audio). Both are best-effort and silently skipped if unavailable — iOS Safari doesn't support vibration, and audio requires that the user has interacted with the page, which pressing Start satisfies.
- **Reset** rewinds to the chosen duration so the same timer can be run again.

#### Stopwatch

- **Start / Pause / Resume / Reset**; displays `m:ss`, switching to `h:mm:ss` past an hour. Intended for finding out how long a game really took (future play statistics will want this number).

#### How the timers keep time

Both timers derive elapsed time from `Date.now()` timestamps, not by counting ticks — the 250 ms interval only refreshes the display. That keeps them accurate when a phone throttles background JavaScript or the screen locks. They live in the root-scoped `TimerService`, so a running timer keeps going while you visit other pages; the Tools page calls `refresh()` on open to catch the display up. `Countdown` fires `onFinish` exactly once (guarded against the re-entrant tick that `pause()` triggers).

**Current limitations**

- One countdown and one stopwatch — no per-player turn clock yet.
- Timers are in memory only; closing the app entirely loses them.
- No custom dice expressions (e.g. `2d6+3`) or per-die exploding/rerolls.

---

### Players

**Route:** `/players`
**Files:** `src/app/players/players.ts`, `src/app/players/players.html`

Manage the people you play with. Everything is inline on one page.

- **Add a player** — a text box and **Add** button (Enter also submits). The name is trimmed. **Add** stays disabled while the box is empty or the name matches an existing player (*You already have a player called "sam".*).
- The list is **alphabetical** with a count. Each row has **Rename** and **Remove**.
- **Rename** swaps the row for an inline editor pre-filled with the name, with **Save** / **Cancel**. The player's own name is allowed; another player's is rejected with the same message.
- **Remove** swaps the row for *Remove Alex?* with **Yes, remove** / **Keep**. Only one row can be editing or confirming at a time; starting one closes the other.
- Empty state: *No players yet. Add the people you usually play with.*
- Storage failures show *Could not save your players to this device.* and keep what was typed.

**Current limitations**

- No play history yet, so removing a player has no side effects to consider. Once plays exist, removal will need a policy (block, cascade, or keep with a name snapshot).

---

## Data storage

There is no backend. The collection is owned by `GameStore` (`src/app/game-store.ts`), an injectable service that every page shares:

| Member | Purpose |
|---|---|
| `games` | Read-only signal of the current collection |
| `ready` | `false` until the collection has been read from storage or seeded |
| `error` | Last storage/seed error message, or `null` |
| `find(id)` | Look a game up by id |
| `hasTitle(title, excludeId?)` | Case-insensitive, trimmed title check; `excludeId` ignores one game (used when editing) |
| `add(details)` | Append one game with a fresh id and persist; returns the new `Game` |
| `update(id, details)` | Replace one game's details in place and persist |
| `remove(id)` | Drop one game and persist |
| `replaceAll(games)` | Overwrite the collection and persist |
| `toJson()` | Pretty-printed JSON, used by export |

**Ids.** Everything entering either store — saved data, the seed file, an imported file — passes through `assignIds()` (`src/app/ids.ts`), which keeps any `id` an item already has and generates one (`crypto.randomUUID()`) for items without one or with a duplicate. Data saved before ids existed is upgraded and re-saved on the next launch.

`PlayerStore` (`src/app/player-store.ts`) is the same shape for players: `players`, `error`, `find(id)`, `hasName(name, excludeId?)`, `add(name)`, `rename(id, name)`, `remove(id)`, `replaceAll(players)`. It has no `ready` flag because there is nothing to seed.

**Where the data lives**

- Games are stored in `localStorage` under `boardgame-butler.games`, players under `boardgame-butler.players`, each as a JSON array. A games-only import therefore can't disturb players, and vice-versa.
- Every write goes through `commit()`, which updates the in-memory signal first and then `localStorage`. If the write throws (quota exceeded, private mode with storage disabled, etc.) the in-memory change is kept and `error` is set so the page can tell the user.

**First run**

When the store is constructed and finds nothing saved (or something unparseable / not an array), it fetches the bundled `/games.json`, stores the result, and flips `ready`. The service worker caches `games.json` so this works even if the first launch after install happens offline. If the fetch fails, `ready` still becomes `true` with an empty collection and `error` set to *"Could not load the starter collection."*

**Implications**

- Each browser / device has its own independent collection. Use export → import on Manage to move it.
- Clearing site data in the browser deletes the collection; the next launch re-seeds from the starter list.
- Nothing is ever sent to a server.

---

## Backup file format

Defined in `src/app/export-format.ts`.

**Version 2 (current)** — what Export produces:

```json
{
  "version": 2,
  "exportedAt": "2026-09-18T12:00:00.000Z",
  "games": [ { "id": "…", "title": "Catan", "players": "3-4", "duration": "60-120", "complexity": "Medium", "rating": 7 } ],
  "players": [ { "id": "…", "name": "Sam" } ]
}
```

**Version 1** — a bare JSON array of games, as exported before players existed and as the bundled `games.json` is written. Import still accepts it; it carries no players, so importing one leaves the device's players untouched.

`parseImport()` decides the version by shape (array ⇒ v1; object with a `games` array ⇒ v2), so a hand-written v2 file without a `version` field also works. Ids in the file are preserved on import; missing ones are generated. Future formats (a play log) should bump `version` and extend `parseImport()` rather than change the meaning of existing fields.

---

## Progressive web app (install & offline)

The app is installable on phones and desktops and works with no network once installed.

| Piece | Where |
|---|---|
| Web app manifest | `public/manifest.webmanifest` — name *Boardgame Butler*, short name *Butler*, standalone display, amber theme colour, dark background, 72–512 px icons cropped from the Dice Butler artwork |
| Service worker | Angular's `ngsw-worker.js`, registered in `app.config.ts` with `registerWhenStable:30000`; **enabled only in production builds** (`!isDevMode()`) |
| Caching policy | `ngsw-config.json` — `index.html`, all JS/CSS, the manifest and `games.json` are prefetched on install; images and icons are cached lazily on first use |
| Install meta | `src/index.html` — `theme-color`, description, and the Apple `apple-mobile-web-app-*` / `apple-touch-icon` tags for iOS home-screen installs |

**Installing**

- **Android / Chrome / Edge:** open the site, use the browser's *Install app* / *Add to Home screen* prompt.
- **iOS Safari:** Share → *Add to Home Screen*.
- **Desktop Chrome / Edge:** the install icon in the address bar.

**Updates**

The service worker checks `ngsw.json` on each launch. When a new build is deployed it is downloaded in the background and used on the next launch; the saved collection is unaffected because it lives in `localStorage`, not in the cache.

**Requirements**

Service workers need HTTPS (or `localhost`). `ng serve` does not register the worker, so to test install/offline behaviour run a production build and serve `dist/BoardgameButler/browser` over HTTPS or `localhost`. Step-by-step instructions for PC and phone, including a LAN HTTPS setup with mkcert, are in [MANUAL_TESTING.md](MANUAL_TESTING.md).

---

## Running and deploying

From the `BoardgameButler/` directory:

```bash
npm install
npm start          # ng serve on http://localhost:4200 (no service worker in dev)
npm run build      # production build → dist/BoardgameButler/browser
npm test           # vitest
```

The production build is a folder of static files. Host it on anything that serves static content over HTTPS (GitHub Pages, Netlify, Cloudflare Pages, an S3 bucket, nginx…). Two things to configure on the host:

- **SPA fallback:** unknown paths like `/collection` must serve `index.html` so deep links and refreshes work. Most static hosts have a setting for this; on GitHub Pages the usual trick is copying `index.html` to `404.html`.
- **Base path:** if the app is served from a sub-path (e.g. `https://user.github.io/boardgame-butler/`), build with `ng build --base-href /boardgame-butler/`.

### Tests

Each page has a functional spec next to it (`*.spec.ts`) that drives the rendered DOM — typing into inputs, clicking buttons, choosing files — and asserts against what ends up in `localStorage`. The first-run seed request is stubbed via `HttpTestingController`. `src/app/app.spec.ts` covers routing. Shared helpers and sample data live in `src/testing/helpers.ts` (excluded from the production build).

| Spec | Covers |
|---|---|
| `game-store.spec.ts` | First-run seeding (incl. corrupt / non-array saved data), seed failure, load from storage, id assignment (seed, legacy saved data, import, duplicate ids), add / update / remove / replaceAll persistence, `find`, `hasTitle`, `toJson`, storage write failure |
| `game-filter.spec.ts` | Range parsing (`2-4`, `2`, `3+`, `2 to 6`, en dash, garbage), each filter's matching rule, AND-combination, `filterGames` |
| `home.spec.ts` | Loading state while seeding, ready from storage, empty-collection hint, random pick and re-roll, rating badge, filter panel toggle, every filter's live count, no-match state, clear, filtered pick vs. whole-collection pick, nav links |
| `collection.spec.ts` | Seeding/empty/error states, row rendering, complexity pills, search, every sort column and direction |
| `game-form.spec.ts` | Add: defaults, required errors, live rating label, what gets saved (with id), trimming, duplicate-title rejection (case/whitespace, forced submit, clears on change), storage failure. Edit: pre-fill, save in place keeping id, own title allowed / other title rejected, rename, rating required for unrated, unknown id. Delete: hidden when adding, confirm step, keep, confirm removes and navigates, storage failure |
| `import-plan.spec.ts` | First-wins de-duplication for games: case/whitespace matching, kept order, difference reporting (incl. missing rating), untitled rows; and for players by name |
| `player-store.spec.ts` | Empty start, load, id assignment for legacy data, corrupt data, add (trimmed, new id), rename, remove, replaceAll, `hasName`, storage failure |
| `players.spec.ts` | Alphabetical list and count, empty state, add (disabled until typed, trimmed, Enter, duplicate rejected, storage error keeps input), rename (inline editor, save, own name allowed / other rejected, cancel), remove (confirm, keep, confirm removes, opening rename closes confirm), nav links |
| `export-format.spec.ts` | `buildExport` shape and timestamp; `parseImport` for v1 arrays, v2 objects, missing players, bad `games`/`players` entries, and non-backup values |
| `manage.spec.ts` | Export counts and download (v2 Blob contents, filename), invalid/unrecognised/bad-entry file errors, games preview with duplicates greyed and reasons, v1 file keeps players, v2 file previews and imports players (duplicates first-wins, empty list warns), cancel, confirm persists, storage-failure handling |
| `dice.spec.ts` | Random-source mapping onto 1..sides, totals, count clamping, range check across all die types |
| `timer.spec.ts` | `formatDuration`; Stopwatch start/pause/resume/reset, timestamp-based elapsed (throttled-tab case), `onTick`, `destroy`; Countdown remaining/finished, `onFinish` fires once, pause/resume, reset, `setDuration` |
| `tools.spec.ts` | Dice type/count selection and clamping, roll rendering (total + individual dice), history; Countdown presets, custom minutes, running/pause/resume display with fake timers, time's-up alert once + reset, survives leaving and re-opening the page; Stopwatch count-up through the hour boundary; nav links |
| `app.spec.ts` | Every route renders the right component and heading using the real `appConfig` providers; the `:id` parameter reaches the edit form; link navigation between pages |

---

## Planned features (not yet implemented)

The Home page advertises the following chips. Only the first four are fully backed by working functionality today:

| Chip | Status |
|---|---|
| Track your collection | ✅ View / add / edit / delete / import / export |
| Players & duration | ✅ Stored and displayed (free-text) |
| Complexity ratings | ✅ Easy / Medium / Hard |
| User ratings | ✅ 1–10 slider, shown on the pick card |
| Quick-pick assistant | ✅ Random from the whole collection, or from games matching players / time / complexity / rating |
| Play statistics | ❌ Not started |
| In-game utilities | ✅ Dice, countdown, stopwatch on `/tools` |

Technical gaps in what already exists:

- Schema validation of imported files (only "is an array" is checked)
- No sync between devices — export/import is the only way to move a collection

---

## Roadmap

The full candidate scope for the project, grouped by area. Nothing here has been prioritized against anything else yet — see [Open questions](#open-questions).

### Collection management

| Item | Status |
|---|---|
| View collection | ✅ `/collection` — searchable, sortable table |
| Add entries | ✅ `/add-game` |
| Update / delete entries | ✅ `/edit-game/:id` from the Collection page |
| Game file import / export | ✅ `/manage` |

### Play assistance

| Item | Status |
|---|---|
| Quick setup chooser (randomize / select a game) | ✅ Random pick from the whole collection or from a filtered subset |
| Play statistics — players, winner, duration, fun rating | ❌ Not started; the `Game` model has no play-history fields |
| Dice | ✅ `/tools` — d4–d100, up to 10 dice, history |
| Timers | ✅ `/tools` — countdown with alert, stopwatch |

### Nice-to-haves / uncertain fit

| Item | Notes |
|---|---|
| 3D print guides | For game accessories or replacement pieces |
| Other users & auth | Multi-user support |
| Bot integration | A chat-bot front end; hosting unresearched |
| Scheduling games | Coordinating play sessions |
| Swapping / trading / borrowing | A social / lending layer |

### Open questions

- **MVP cut line.** The likely MVP was collection view/add/edit/delete plus dice, timers and a filtered quick-setup chooser — all of which are now done. What remains on the "play assistance" side is play statistics. The social / multiplayer layer (auth, scheduling, swapping, bot integration) would sit on the other side of that line.
- **Single-user vs. backend.** The current architecture — an installable PWA with the collection in browser storage and no server at all — is firmly single-user local software. Auth, cross-device sync and bot hosting all imply a real server and database, which would be a significant change rather than an incremental one.

### Likely next step

The MVP is complete and two pieces of the play-statistics groundwork are in: **players as entities** and a **versioned backup format**. What remains before a stats page: a play-log store (`Play { gameId, playedAt, playerIds, winnerIds, durationMinutes, funRating }`) added to the backup as a version-3 section, a policy for plays whose game or player is deleted (keep them with a title/name snapshot), and a fast "we played this" capture flow from the pick card and Collection rows. The stopwatch already provides the duration.
