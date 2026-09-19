# Manual Testing Guide

How to exercise Boardgame Butler by hand on a PC and on a phone, including the install and offline behaviour that the automated tests cannot cover.

All commands run from the `BoardgameButler/` directory.

---

## Contents

- [Before you start](#before-you-start)
- [Part 1 — PC, dev server (functional checks)](#part-1--pc-dev-server-functional-checks)
- [Part 2 — PC, production build (install & offline)](#part-2--pc-production-build-install--offline)
- [Part 3 — Phone over the LAN, plain HTTP (functional only)](#part-3--phone-over-the-lan-plain-http-functional-only)
- [Part 4 — Phone over the LAN, HTTPS (full install & offline)](#part-4--phone-over-the-lan-https-full-install--offline)
- [Part 5 — Verifying an update reaches an installed app](#part-5--verifying-an-update-reaches-an-installed-app)
- [Resetting between test runs](#resetting-between-test-runs)
- [Troubleshooting](#troubleshooting)

---

## Before you start

```bash
git clone https://github.com/MAOstrander/boardgame-butler.git
cd boardgame-butler/BoardgameButler
npm install
npm test          # should report all tests passing
```

Two facts drive everything below:

1. **The collection lives in the browser's `localStorage`, keyed by origin.** `http://localhost:4200`, `http://localhost:8080` and `http://192.168.1.50:8080` are three different origins with three independent collections. Don't be surprised when switching ports "loses" your games — see [Resetting](#resetting-between-test-runs).
2. **The service worker (install + offline) only runs in a production build on a secure origin.** `ng serve` never registers it. `localhost` counts as secure; a LAN IP over plain HTTP does not.
3. **A fresh device starts with sample data** — 11 games, 5 players and 15 plays, seeded from `public/*.json` (see *Sample data* in FEATURES.md). The steps below assume it. **To test the empty states**, don't clear site data (that re-seeds): instead use Manage → import a backup whose sections are `[]`, or delete the entries through the UI — an empty list is remembered and won't re-seed.

| Scenario | Command | Install prompt | Offline |
|---|---|---|---|
| PC, dev server | `npm start` | ✗ | ✗ |
| PC, prod build on `localhost` | Part 2 | ✓ | ✓ |
| Phone, LAN over HTTP | Part 3 | ✗ (iOS "Add to Home Screen" still works as a shortcut) | ✗ |
| Phone, LAN over HTTPS | Part 4 | ✓ | ✓ |
| **Phone, deployed site** | none — open https://mathewostrander.com/boardgame-butler/ | ✓ | ✓ |

> **Shortcut:** since the app is deployed to GitHub Pages over real HTTPS, testing install and offline behaviour on a phone no longer needs the LAN certificate setup in Part 4 — just open the deployed URL. Part 4 is still the way to test a change that hasn't been pushed yet.

---

## Part 1 — PC, dev server (functional checks)

```bash
npm start
```

Open http://localhost:4200. Work through the checklist in order — later steps depend on earlier ones.

### Home

- [ ] Page shows the Dice Butler background, title, tagline and seven feature chips.
- [ ] First ever load: *"Loading game library..."* appears briefly, then disappears. **Serve me a game!** becomes enabled.
- [ ] Click **Serve me a game!** — a *Tonight's pick* card appears with title, `N players`, `N min`, and complexity.
- [ ] Click again several times — the pick changes (it's random; repeats are allowed).
- [ ] Most seed games are rated, so the card usually shows an `/10` badge; Gloomhaven and Scythe are unrated and show none.
- [ ] Three links at the bottom: **View collection**, **+ Add a game**, **Manage collection**.

### Home — filtered pick

- [ ] Click **▾ Narrow it down** → a filter panel appears reading *No filters set — all 11 games match*; the link now says **▴ Hide filters**.
- [ ] Players tonight `5` → *N of 11 games match* drops to only games whose range includes 5 (e.g. Terraforming Mars 1-5, Ticket to Ride 2-5, Wingspan 1-5).
- [ ] Time available *Up to 60 min* → *3 of 11 games match* — only games whose **longest** time is ≤ 60 (Azul, 7 Wonders, Codenames). Catan (60-120) and Ticket to Ride (45-90) must *not* match.
- [ ] Click **Hard** → count changes; click **Easy** too → count grows (either complexity matches); click **Hard** again to deselect.
- [ ] Minimum rating *9+* → only the 9-rated games match (Terraforming Mars, Wingspan, Codenames); the two unrated games are excluded. Set it with Players `7` → *No games match these filters* and **Serve me a match!** is disabled.
- [ ] Click **Clear** → back to *all 11 games match*, inputs reset, **Clear** link disappears.
- [ ] Set Players `2` and Time *Up to 45 min* → *3 of 11 games match* (Azul, 7 Wonders, Codenames). Click **Serve me a match!** repeatedly → only those three are ever served; the card says *Tonight's pick · from your matches*.
- [ ] With those filters still set, click the big **Serve me a game!** → any game from the whole collection can come up (e.g. Catan) and the card just says *Tonight's pick*.
- [ ] **▴ Hide filters** → panel collapses; open it again → filters are still set.
- [ ] After adding Cascadia with rating 8 (next section), come back and set Minimum rating *8+* → *1 of 12 games match*.

### Collection

- [ ] **View collection** → table of the 11 starter games, subtitle *11 games*.
- [ ] Rows are sorted by title A→Z; the **Title** header is amber with ▲.
- [ ] Complexity pills are green (Easy), amber (Medium), red (Hard).
- [ ] Rating column shows a value for most rows and `—` for Gloomhaven and Scythe.
- [ ] Click **Title** → order reverses, indicator becomes ▼.
- [ ] Click **Complexity** → Easy games first; click again → Hard first.
- [ ] Click **Players** → `1-x` games first. Click **Minutes** → shortest first.
- [ ] Type `an` in the search box → only titles containing "an" (Catan, Pandemic, …); subtitle reads *Showing N of 11 games*.
- [ ] Type `zzz` → single row *No games match "zzz".*
- [ ] Clear the box → all 11 rows return.
- [ ] Every row ends with a small **Edit** link.

### Add a Game

- [ ] **+ Add a game** → form with Complexity preselected to *Medium*; **Add to Collection** is disabled.
- [ ] Click into Title, then click away → *Title is required.* appears in red. Same for Players and Duration.
- [ ] Drag the rating slider → label shows e.g. *7 / 10*.
- [ ] **Duplicate guard:** type `catan` (lower-case) as the title → red *You already have a game called "catan".* and the button stays disabled even with every other field filled. Change it to `Catan: Seafarers` → the error clears.
- [ ] Fill in: Title `Cascadia`, Players `1-4`, Duration `30-45`, Complexity `Easy`, Rating `8`. Button enables.
- [ ] Click **Add to Collection** → returns to Home.
- [ ] **View collection** → *12 games*; Cascadia is there with rating `8/10`.
- [ ] Click **Rating** header → highest first, and the two unrated games are last. Click again → lowest first, unrated still last.
- [ ] Home → **Serve me a game!** until Cascadia comes up → card shows the `8/10` badge.
- [ ] **Persistence:** press F5. Collection still has 12 games. Close the tab, reopen — still 12.

### Edit a Game

- [ ] **View collection** → click **Edit** on Catan → *Edit Game* page, subtitle *Update the details for Catan.*, every field pre-filled (3-4, 60-120, Medium, rating 7), button reads **Save Changes**. (Editing **Gloomhaven** instead shows the unrated case: the slider is unset and **Save Changes** stays disabled until a rating is chosen.)
- [ ] Change rating to `6`, Duration to `75-100`, Complexity to `Hard` → **Save Changes** → back on the collection; Catan's row shows `75-100`, a red *Hard* pill and `6/10`. Row count is still 12.
- [ ] Press F5 → the changes survived.
- [ ] **Edit** Catan again → change the title to `azul` → *You already have a game called "azul".*, button disabled. Change it back to `Catan` → error clears. Change it to `Catan (base)` → **Save Changes** → the row is renamed; sort by Title still works.
- [ ] **Edit** any game → click **Cancel** → back on the collection with nothing changed.
- [ ] **Delete:** **Edit** Pandemic → scroll down → red **Delete this game** link → a confirmation box: *Remove Pandemic from your collection? This can't be undone.* Click **Keep it** → box closes, nothing removed. Click **Delete this game** → **Yes, delete it** → back on the collection, *11 games*, Pandemic gone. F5 → still gone.
- [ ] The **Add a Game** page has no delete option.
- [ ] Type a bogus address, e.g. `http://localhost:4200/edit-game/nope` → *That game isn't in your collection any more.* with a link back to the collection.
- [ ] Re-add Pandemic (`2-4`, `45-75`, `Medium`, any rating) so the counts below still line up.
- [ ] Export now, open the file → every game has an `"id"` field. Import that file back → **Edit** links still work and a re-export gives the same ids.

### Players

- [ ] Home → **👥 Players** → the five seeded players, alphabetical: Alex, Jo, Morgan, Riley, Sam — *5 players*.
- [ ] Type `  Casey ` → **Add** → row *Casey* (trimmed), box cleared, *6 players*. Enter also submits.
- [ ] Type `sam` → red *You already have a player called "sam".*, **Add** disabled. Clear it.
- [ ] **Rename** on Jo → inline box pre-filled. Type `alex` → duplicate error, **Save** disabled. Type `Jo` → allowed. Type `Joanna` → **Save** → list shows Joanna. **Rename** again → **Cancel** → unchanged.
- [ ] **Remove** on Casey → *Remove Casey?* → **Keep** → still there. **Remove** → **Yes, remove** → gone, *5 players*.
- [ ] While *Remove Sam?* is showing, click **Rename** on Joanna → the confirmation closes and the editor opens.
- [ ] F5 → players persist.

### Play History

- [ ] Home → **📖 History** → the 15 seeded plays, newest first, the most recent a couple of days ago. Cards show winners with 🏆, other players, durations, fun ratings and notes; the Codenames plays show an *8 players* / *6 players* chip, and the Pandemic loss shows no 🏆.
- [ ] Home → **Serve me a game!** → the pick card has **We played this →**. Click it → *Log a Play* with that game pre-selected and today's date.
- [ ] **Who played:** chips for every player; tap Sam and Alex → a **Who won** row appears with just those two. Tap Alex there → 🏆 Alex. Un-tap Alex in *Who played* → the winners row loses Alex (or disappears if nobody's left).
- [ ] **How many played** shows placeholder `2` and *Will be saved as 2 — the players picked above.* Type `1` → *You picked 2 players above.* and **Log Play** is disabled; type `4` (two friends not in your list) → allowed. Leave it at 4.
- [ ] Enter 75 minutes, drag *How fun* to 8 (label reads *8 / 10*; **clear** resets to *not rated*), type a note → **Log Play** → *Play History* shows one card: date, game, 🏆 winner, others, *4 players*, *75 min*, *fun 8/10*, note. (A play whose head-count equals the named players shows no *N players* chip.)
- [ ] Table Tools → start the **Stopwatch**, wait a minute, pause. Back to **+ Log a play** → a **Use stopwatch (1 min)** button fills the duration.
- [ ] Collection → **Log play** on a row → that game is pre-selected. Log it with no players and no extras → the card shows *no players recorded* and nothing else.
- [ ] Log another play dated yesterday → it appears above the seeded ones; two plays on the same date show the most recently logged first.
- [ ] **Edit** a play → everything pre-filled, **Save Changes** → card updates. **Delete** → *Delete this play of …?* → **Keep** keeps; **Yes, delete** removes and the count drops.
- [ ] **Snapshots:** Players → **Remove** Alex. History still shows Alex's name on the old play. Edit that play → the chip reads *Alex (removed)* and is still selected. Collection → Edit the game you logged twice → **Delete this game** → the confirmation says *Its 2 logged plays will stay in your history.* Confirm → History still lists them; editing one offers *Catan (no longer in collection)*.
- [ ] F5 → history persists.

### Statistics

- [ ] **📊 Stats** on a freshly seeded device → **Plays** `15` with *8 in the last 30 days*, **Games played** *7 / 11* with *4 never played*, **Hours at the table** `19`, **Most played** *Catan* (4 plays).
- [ ] Delete every play through History → Stats shows *No plays logged yet* and a **Log your first play** button.
- [ ] **Games** table: played games only, most plays first (Catan, Azul, then the rest). Catan's **Players** column reads `3.5` with the breakdown *3p ×2 · 75 min, 4p ×2 · 142.5 min* — the four-player games take nearly twice as long. Pandemic, always four-handed, shows just `4`. Terraforming Mars shows *215 min* with a red *+35 min over*; last-played date; average time with *in range* / *+N min over* (red) / *N min under* (blue) against the listed duration; average fun. Games you never recorded a duration or rating for show `—`.
- [ ] **Never played (4)** chips — Arkham Horror, Gloomhaven, Scythe, Wingspan; click one → *Log a Play* with that game pre-selected.
- [ ] **Players** table: Riley's win rate is green (56 %), the others below 50 % are not. Most-played shows a game with ×count. Add a new player and they appear dimmed with dashes.
- [ ] Log a co-op play with two players and **no winner** → both players' *Plays* go up but *Win rate* is unchanged (the footnote explains why).
- [ ] The game you deleted earlier still appears with *(no longer in collection)*; a removed player who has plays still appears with *(removed)*.
- [ ] Log a play dated 40 days ago → **Plays** tile total goes up, *in the last 30 days* does not.

### Table Tools

- [ ] Home → **🎲 Table tools** → three cards: Dice, Countdown, Stopwatch.
- [ ] **Dice:** d6 is highlighted; button reads **Roll 1d6**. Click **Roll** several times → a large number 1–6, no individual dice shown; *Recent rolls* appears after the second roll and never exceeds five entries.
- [ ] Click **d20**, then **+** twice → **Roll 3d20**. Roll → total plus three individual dice, each 1–20, summing to the total. **−** at 1 and **+** at 10 are disabled.
- [ ] **Countdown:** display `0:00`, **Start** and **Reset** disabled. Click **1 min** → `1:00`, preset highlighted. **Start** → counts down; presets and the Custom box are disabled; button reads **Pause**. **Pause** → stops; **Resume** → continues.
- [ ] Let it reach `0:00` → display turns red and pulses, *Time's up!* appears, and on a device that supports it you get a short beep / vibration. **Reset** → back to `1:00`, message gone.
- [ ] Type `0.5` in **Custom** → `0:30`, preset highlight cleared.
- [ ] Start a **2 min** countdown, navigate to **View collection**, wait ~10 s, come back → the countdown has kept going and shows the correct remaining time.
- [ ] **Stopwatch:** **Start** → counts up; **Pause** holds; **Resume** continues; **Reset** (only enabled when stopped with time on it) → `0:00`.

### Manage — export

- [ ] **Manage collection** → Export section says *(12 games)*, *(6 players)* and your play count.
- [ ] Click **Download boardgame-butler.json** → browser downloads `boardgame-butler.json`. Open it: an object with `"version": 3`, `"exportedAt"`, a `"games"` array of 12 (each with an `"id"`, Cascadia last with `"rating": 8`), a `"players"` array and a `"plays"` array whose entries have real `"playedAt"` dates (the `daysAgo` form is seed-only).

### Manage — import

- [ ] Edit the downloaded file: delete a few games, change a title, add another player, save.
- [ ] Click the drop-zone, choose the edited file → three ticked sections: *Replace games with N games* with a preview list, *Replace players with N players* with name chips, and *Merge N plays into your history — 0 new, N already here*; the drop-zone disappears.
- [ ] Click **Cancel** → preview gone, drop-zone back, collection unchanged (check View collection).
- [ ] Choose the file again → **Confirm Import** → green *Imported N games, N players, 0 new plays.*; Export section counts update.
- [ ] **View collection** shows exactly what was in the file; **Players** shows the ones from the file.
- [ ] **Plays merge, never shrink:** log one more play, then import the same file again → *Merge N plays — 0 new, N already here* → Confirm → History still has the extra play. Now edit the file to delete all but one play and import → *0 new, 1 already here* → Confirm → nothing lost.
- [ ] **Per-section apply:** choose the file, untick **Replace games** and **Merge plays**, leaving players → Confirm → *Imported 3 players.*; games and history unchanged. Untick everything → **Confirm Import** is disabled.
- [ ] **Older format:** copy just the `"games"` array from the file into a new file (so it starts with `[`). Import it → only a games checkbox, plus *This is an older games-only file — your N players will be kept.* and *This file has no play history — your N logged plays will be kept.* Confirm → games replaced, players and history untouched.
- [ ] Import a backup whose `"players"` is `[]` → *and 0 players — your current players will be removed*. Confirm → Players page is empty, **and stays empty on reload** (an empty list is remembered, not re-seeded). Re-add a couple for later steps.
- [ ] **Duplicates in a file:** open the exported file and paste a copy of the Catan entry at the end, changing its `"rating"` to `9` and its `"title"` to `"catan"`. Choose it → summary reads *Ready to import 12 games (1 duplicate will be skipped)*, an amber note explains first-wins, and the last row is greyed out and struck through: *skipped — duplicate of Catan · differs: rating 9*. **Confirm Import** → collection has 12 games, one Catan, with its original rating.
- [ ] Create a text file containing `{ not json` → choose it → red *Could not parse file — make sure it is valid JSON.*
- [ ] Create a file containing `{"title":"Catan"}` → *File must contain a JSON array of games, or a backup exported by this app.*
- [ ] Create a file containing `{"games":"nope"}` → *The "games" entry must be a JSON array.*
- [ ] Create a file containing `{"games":[],"plays":{}}` → *The "plays" entry must be a JSON array.*
- [ ] Choose a valid file after an error → the error clears.
- [ ] Import an empty array `[]` → Home shows *Your collection is empty — add a game to get started.* and the button is disabled; Collection shows the empty-state card with **Add your first game**.

### Storage failure (optional, Chrome/Edge)

- [ ] DevTools → Application → Storage → tick *Simulate custom storage quota*, set it to `1`. Add a game → red *Could not save your collection to this device.* and you stay on the form. Untick and retry — it saves.

---

## Part 2 — PC, production build (install & offline)

This is the cheapest way to test the PWA behaviour: `localhost` is a secure origin, so no certificates are needed.

```bash
npm run build
npx serve -s dist/BoardgameButler/browser -l 8080
```

(`-s` is single-page mode so `/collection` falls back to `index.html`. First run of `npx serve` downloads it.)

Open http://localhost:8080 in **Chrome or Edge**.

### Service worker

- [ ] DevTools → Application → **Manifest**: name *Boardgame Butler*, short name *Butler*, theme colour amber, icons show the dice artwork, no errors/warnings listed.
- [ ] Application → **Service workers**: `ngsw-worker.js` is *activated and is running*. (It registers a moment after the page settles; reload once if it's not there yet.)
- [ ] Application → **Cache storage**: an `ngsw:/:db:control` entry plus `ngsw:/:<hash>:assets:app:cache` containing `index.html`, the JS/CSS bundles, `manifest.webmanifest` and `games.json`.

### Install

- [ ] An install icon appears at the right end of the address bar (or ⋮ → *Install Boardgame Butler*). Click it → Install.
- [ ] The app opens in its own window with no address bar, dark background, dice icon in the taskbar.
- [ ] Run a quick pass of the Part 1 checklist inside the installed window — everything behaves the same.

### Offline

- [ ] With the installed app open, DevTools (F12 works inside the app window) → Network → tick **Offline**.
- [ ] Navigate Home → Collection → Add a game → Manage. Every page loads.
- [ ] Add a game while offline. It saves and appears in the collection.
- [ ] Untick Offline. Reload. The game added offline is still there.
- [ ] Stronger test: **stop the `serve` process entirely**, then launch the app from the Start menu. It still opens and works. (Restart `serve` afterwards.)

### Fresh-device simulation

- [ ] Application → Storage → **Clear site data** (all boxes). Reload.
- [ ] Watch Network: requests to `games.json`, `players.json` and `plays.json` fire, the sample data appears, and `localStorage` now has `boardgame-butler.games`, `.players` and `.plays`.
- [ ] Go offline, clear site data again, reload → the samples still appear, because the service worker cached all three seed files.

### Uninstall

- [ ] In the app window: ⋮ → *Uninstall Boardgame Butler*. Or `chrome://apps` → right-click → Remove.

---

## Part 3 — Phone over the LAN, plain HTTP (functional only)

Quickest way to try the UI on a real phone. Everything works except install-as-app and offline.

1. Find your PC's LAN address: `ipconfig` → *IPv4 Address*, e.g. `192.168.1.50`.
2. Start the dev server on all interfaces:
   ```bash
   npx ng serve --host 0.0.0.0
   ```
   If Windows Firewall prompts, allow Node on **private** networks.
3. On the phone (same Wi-Fi), open `http://192.168.1.50:4200`.

### Checks

- [ ] Home renders correctly at phone width: background image fills the screen, chips wrap, the **Serve me a game!** button is full-width and tappable.
- [ ] Run the Part 1 checklist. Pay attention to:
  - [ ] The rating **slider** is usable with a thumb.
  - [ ] The collection **table** — does it need horizontal scrolling? Note the narrowest width at which it's still readable.
  - [ ] The **file picker** on Manage opens the OS file chooser; import a `boardgame-butler.json` backup you've shared to the phone (email it to yourself, AirDrop, etc.).
  - [ ] **Export** downloads `boardgame-butler.json` to the phone's Downloads / Files.
- [ ] Persistence: force-close the browser, reopen the address → collection intact.
- [ ] **Table tools on a phone:** start a 1-minute countdown, lock the screen, unlock after it should have finished → display shows `0:00` and *Time's up!*. Android should have vibrated; iOS won't (no vibration API) but should beep if the phone isn't on silent.
- [ ] Install prompt: Chrome on Android should **not** offer *Install app* here (insecure origin) — this is expected. iOS Safari → Share → *Add to Home Screen* still works and opens without browser chrome, but it's a shortcut, not an offline app.
- [ ] Prove there's no offline support: turn on Airplane mode, open the shortcut → it fails to load. Turn Airplane mode off.

---

## Part 4 — Phone over the LAN, HTTPS (full install & offline)

Only needed for **unreleased** changes; for anything already on `main`, open the deployed URL on the phone instead and skip to the Install/Offline checks below.

The service worker needs a trusted HTTPS origin. [mkcert](https://github.com/FiloSottile/mkcert) makes a locally-trusted certificate authority; you install its root on the phone once.

### One-time setup

1. Install mkcert on the PC (`choco install mkcert`, `scoop install mkcert`, or download the release binary).
2. Create the local CA and a certificate for your PC's LAN IP:
   ```bash
   mkcert -install
   mkcert 192.168.1.50
   ```
   This writes `192.168.1.50.pem` and `192.168.1.50-key.pem` into the current directory. **Don't commit them** — keep them outside the repo or add them to `.gitignore`.
3. Put the root certificate on the phone. `mkcert -CAROOT` prints the folder; the file is `rootCA.pem`.
   - **Android:** copy `rootCA.pem` to the phone → Settings → Security → *Install a certificate* → *CA certificate*. Chrome trusts it immediately.
   - **iOS:** email/AirDrop `rootCA.pem` → open it → Settings → *Profile Downloaded* → Install. Then **also** Settings → General → About → Certificate Trust Settings → enable full trust for the mkcert root. (Without this second step Safari still shows a warning and won't register the service worker.)

> If the PC's IP changes (DHCP), regenerate the certificate with the new address. Consider giving the PC a DHCP reservation in your router.

### Serve

```bash
npm run build
npx serve -s dist/BoardgameButler/browser -l 8443 --ssl-cert 192.168.1.50.pem --ssl-key 192.168.1.50-key.pem
```

Allow Node through the firewall if prompted. On the phone open `https://192.168.1.50:8443` — there should be **no** certificate warning. If there is, the root CA isn't trusted yet; fix that before continuing, because the service worker will not register on a warned origin.

### Install

- [ ] **Android / Chrome:** an *Install app* / *Add Boardgame Butler to Home screen* banner or ⋮ menu item appears. Tap it. The icon (dice on a blue cushion) lands on the home screen.
- [ ] **iOS / Safari:** Share → *Add to Home Screen*. Name defaults to *Butler*.
- [ ] Launch from the home screen: no browser UI, dark status bar area, splash shows the icon.

### Offline

- [ ] Inside the installed app, add a game and view the collection.
- [ ] Close the app. **Turn on Airplane mode.** Launch it from the home screen.
- [ ] It opens. Home, Collection, Add and Manage all work. Add another game.
- [ ] Turn Airplane mode off. The game added offline is still there.
- [ ] Stronger test: **stop `serve` on the PC** (or shut the PC down), launch the app → still works.

### Fresh-install seeding

- [ ] Uninstall the app and clear the site's data in the browser (Android: Chrome → Settings → Site settings → the site → Clear & reset. iOS: Settings → Safari → Advanced → Website Data → remove the site).
- [ ] Reinstall from the HTTPS address, then go into Airplane mode *before* opening it for the first time. Open it → the 11 starter games, 5 players and 15 plays are there, because the seed files were cached during install.

---

## Part 5 — Verifying an update reaches an installed app

With the app installed (Part 2 or 4) and `serve` running:

1. Make a visible change — e.g. edit the tagline in `src/app/home/home.html`.
2. `npm run build` (no need to restart `serve`; it reads the folder live).
3. Open the installed app. It will still show the **old** tagline — this is expected; the worker fetches the update in the background.
4. Close the app fully and reopen it → the **new** tagline shows.
5. The collection is untouched by the update (it's in `localStorage`, not the cache).

On PC you can watch this in DevTools → Application → Service workers: after step 3 a new worker appears as *waiting*; after step 4 it's active.

---

## Resetting between test runs

Because data is per-origin, "start from scratch" means clearing that origin's storage:

| Where | How |
|---|---|
| PC, Chrome/Edge | DevTools → Application → Storage → **Clear site data** (tick everything, including *Unregister service workers*) |
| PC, Firefox | Address bar lock icon → *Clear cookies and site data* |
| Android Chrome | ⋮ → Settings → Site settings → All sites → the address → **Clear & reset** |
| iOS Safari | Settings → Safari → Advanced → Website Data → swipe to delete the address |
| Any | In the app: Manage → import a file containing `[]` (clears the collection but not the service worker) |

The next load re-seeds from `games.json`, `players.json` and `plays.json`.

To just uninstall the app but keep data: Android — long-press icon → Uninstall; iOS — long-press → Remove App; PC — ⋮ → Uninstall inside the app window.

---

## Troubleshooting

**No install prompt on PC.**
Check Application → Manifest for errors, and that the service worker shows as *activated*. Both are required. You must be on `localhost` or HTTPS, and using a production build (`npm run build`, not `npm start`). Chrome also won't re-prompt for a while after you dismiss it; use ⋮ → *Install…* instead.

**Service worker never registers.**
`registerWhenStable:30000` waits for the app to go idle. Give it a few seconds and reload once. If you're on a LAN IP over HTTP it will *never* register — that's Part 3's limitation.

**Certificate warning on the phone (Part 4).**
The mkcert root isn't trusted on the phone. iOS needs the extra *Certificate Trust Settings* step. Android needs the file installed as a *CA certificate*, not a *Wi-Fi certificate*. Also confirm the cert was generated for the exact IP you're browsing to.

**Phone can't reach the PC at all.**
Both on the same Wi-Fi? Guest networks often isolate clients. Windows Firewall — allow Node on private networks, or test with the firewall temporarily off to rule it out. Confirm the port with `netstat -an | findstr 4200`.

**Refreshing `/collection` gives a 404.**
The static server isn't doing SPA fallback. With `serve`, make sure you passed `-s`. `ng serve` handles this automatically.

**"Lost" my games after switching ports.**
Different origin, different storage. Either go back to the old address and export, or accept the fresh seed.

**Old version keeps showing after a rebuild.**
That's the service worker doing its job. Close *all* windows/tabs of the app and reopen, or in DevTools → Application → Service workers click *skipWaiting* / tick *Update on reload*.
