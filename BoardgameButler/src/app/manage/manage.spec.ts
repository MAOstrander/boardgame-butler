import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Manage } from './manage';
import {
  SAMPLE_GAMES,
  SAMPLE_PLAYERS,
  SAMPLE_PLAYS,
  cellText,
  findByText,
  query,
  queryAll,
  savedGames,
  savedPlayers,
  savedPlays,
  seedPlayers,
  seedPlays,
  seedStorage,
  selectFile,
  settle,
  text,
} from '../../testing/helpers';
import { buildExport } from '../export-format';

describe('Manage', () => {
  let fixture: ComponentFixture<Manage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    seedStorage(SAMPLE_GAMES);
    seedPlayers(SAMPLE_PLAYERS);
    seedPlays(SAMPLE_PLAYS);

    await TestBed.configureTestingModule({
      imports: [Manage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Manage);
    await settle(fixture);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const fileInput = () => query<HTMLInputElement>(fixture, 'input[type="file"]');

  /** FileReader is async and outside Angular's scheduler, so poll until the UI reacts. */
  async function chooseFile(contents: string) {
    selectFile(fileInput(), contents);
    await vi.waitFor(async () => {
      await settle(fixture);
      expect(text(fixture)).toMatch(/Replace games with|Could not parse|must contain a JSON array|entry must be a JSON array/);
    });
  }

  describe('export', () => {
    it('shows how many games, players and plays will be exported', () => {
      expect(text(fixture)).toContain('(4 games)');
      expect(text(fixture)).toContain('(3 players)');
      expect(text(fixture)).toContain('(3 plays)');
    });

    it('downloads the backup as boardgame-butler.json', () => {
      const createObjectURL = vi.fn((_blob: Blob) => 'blob:games');
      const revokeObjectURL = vi.fn();
      Object.assign(URL, { createObjectURL, revokeObjectURL });
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      findByText<HTMLButtonElement>(fixture, 'button', 'Download boardgame-butler.json').click();

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0][0];
      expect(blob.type).toBe('application/json');

      expect(click).toHaveBeenCalledTimes(1);
      const anchor = click.mock.instances[0] as HTMLAnchorElement;
      expect(anchor.download).toBe('boardgame-butler.json');
      expect(anchor.href).toBe('blob:games');
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:games');
    });

    it('exports games, players and plays in the version-3 format, pretty-printed', async () => {
      const createObjectURL = vi.fn((_blob: Blob) => 'blob:games');
      Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      findByText<HTMLButtonElement>(fixture, 'button', 'Download boardgame-butler.json').click();

      const blob = createObjectURL.mock.calls[0][0];
      const file = JSON.parse(await blob.text());
      expect(file).toEqual({
        version: 3,
        exportedAt: expect.any(String),
        games: SAMPLE_GAMES,
        players: SAMPLE_PLAYERS,
        plays: SAMPLE_PLAYS,
      });
      expect(await blob.text()).toContain('\n  "version": 3');
    });
  });

  describe('import', () => {
    it('rejects a file that is not valid JSON', async () => {
      await chooseFile('{ not json');
      expect(text(fixture)).toContain('Could not parse file — make sure it is valid JSON.');
      expect(text(fixture)).not.toContain('Replace games with');
    });

    it('rejects JSON that is neither a games array nor a backup', async () => {
      await chooseFile('{"title":"Catan"}');
      expect(text(fixture)).toContain('File must contain a JSON array of games, or a backup exported by this app.');
    });

    it('rejects a backup whose games entry is not an array', async () => {
      await chooseFile('{"version":2,"games":"nope"}');
      expect(text(fixture)).toContain('The "games" entry must be a JSON array.');
    });

    it('previews the games in a valid file before importing', async () => {
      const incoming = [SAMPLE_GAMES[1], SAMPLE_GAMES[2]];
      await chooseFile(JSON.stringify(incoming));

      expect(text(fixture)).toContain('Replace games with');
      expect(text(fixture)).toContain('2 games');
      expect(queryAll(fixture, 'li').map(cellText)).toEqual([
        'Azul 2-4 players · Easy',
        'Gloomhaven 1-4 players · Hard',
      ]);
      // The drop-zone is hidden while a preview is showing, and nothing is saved yet.
      expect(fixture.nativeElement.querySelector('input[type="file"]')).toBeNull();
      expect(savedGames()).toEqual(SAMPLE_GAMES);
    });

    it('uses singular wording for a single game', async () => {
      await chooseFile(JSON.stringify([SAMPLE_GAMES[0]]));
      expect(text(fixture)).toContain('1 game');
    });

    it('cancelling the preview restores the drop-zone without changing the collection', async () => {
      await chooseFile(JSON.stringify([SAMPLE_GAMES[0]]));
      findByText<HTMLButtonElement>(fixture, 'button', 'Cancel').click();
      await settle(fixture);

      expect(text(fixture)).not.toContain('Replace games with');
      expect(fileInput()).toBeTruthy();
      expect(savedGames()).toEqual(SAMPLE_GAMES);
    });

    it('a games-only (v1) file replaces the games and keeps the players', async () => {
      const incoming = [SAMPLE_GAMES[1], SAMPLE_GAMES[2]];
      await chooseFile(JSON.stringify(incoming));
      expect(text(fixture)).toContain('This is an older games-only file — your 3 players will be kept.');
      expect(text(fixture)).toContain('This file has no play history — your 3 logged plays will be kept.');

      findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
      await settle(fixture);

      expect(savedGames()).toEqual(incoming);
      expect(savedPlayers()).toEqual(SAMPLE_PLAYERS);
      expect(savedPlays()).toEqual(SAMPLE_PLAYS);
      expect(text(fixture)).toContain('Imported 2 games.');
      expect(text(fixture)).toContain('(2 games)');
      expect(text(fixture)).toContain('(3 players)');
      expect(text(fixture)).not.toContain('Replace games with');
      expect(fileInput()).toBeTruthy();
    });

    describe('a backup (v2) file', () => {
      /** A version-2 backup: games and players, no plays section. */
      const v2File = (games: unknown[], players: unknown[]) => ({ version: 2, games, players });

      it('previews and imports both games and players', async () => {
        const file = v2File([SAMPLE_GAMES[0]], [{ id: 'p-new', name: 'Riley' }, { id: 'p-sam', name: 'Sam' }]);
        await chooseFile(JSON.stringify(file));

        expect(text(fixture)).toContain('Replace games with 1 game');
        expect(text(fixture)).toContain('Replace players with 2 players');
        const chips = queryAll(fixture, '[data-testid="players-preview"] li').map(li => li.textContent?.trim());
        expect(chips).toEqual(['Riley', 'Sam']);

        findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
        await settle(fixture);

        expect(savedGames()).toEqual([SAMPLE_GAMES[0]]);
        expect(savedPlayers()).toEqual([{ id: 'p-new', name: 'Riley' }, { id: 'p-sam', name: 'Sam' }]);
        expect(savedPlays()).toEqual(SAMPLE_PLAYS); // v2 file: history untouched
        expect(text(fixture)).toContain('Imported 1 game, 2 players.');
        expect(text(fixture)).toContain('(1 game)');
        expect(text(fixture)).toContain('(2 players)');
      });

      it('skips duplicate player names, first wins', async () => {
        const file = v2File(SAMPLE_GAMES, [{ id: 'a', name: 'Sam' }, { id: 'b', name: ' SAM ' }, { id: 'c', name: 'Jo' }]);
        await chooseFile(JSON.stringify(file));

        expect(text(fixture).replace(/\s+/g, ' ')).toContain('Replace players with 2 players (1 duplicate will be skipped)');
        const skipped = query(fixture, '[data-testid="players-preview"] li[aria-label="Skipped duplicate of Sam"]');
        expect(skipped.className).toContain('line-through');

        findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
        await settle(fixture);
        expect(savedPlayers()!.map(p => p.name)).toEqual(['Sam', 'Jo']);
      });

      it('warns when the file has no players and confirming removes the current ones', async () => {
        const file = v2File(SAMPLE_GAMES, []);
        await chooseFile(JSON.stringify(file));
        expect(text(fixture)).toContain('Replace players with 0 players');
        expect(text(fixture)).toContain('your current players will be removed');

        findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
        await settle(fixture);
        expect(savedPlayers()).toEqual([]);
      });
    });

    it('shows an error and keeps the preview when the device refuses to save', async () => {
      await chooseFile(JSON.stringify([SAMPLE_GAMES[0]]));
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });

      findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
      await settle(fixture);

      expect(text(fixture)).toContain('Import failed. Please try again.');
      expect(text(fixture)).toContain('Replace games with');
    });

    describe('duplicate titles in the file', () => {
      const file = [
        SAMPLE_GAMES[0],                                   // Catan
        SAMPLE_GAMES[1],                                   // Azul
        { ...SAMPLE_GAMES[0], id: undefined, rating: 9 },  // duplicate Catan, different rating
        { ...SAMPLE_GAMES[1], title: ' azul ' },           // duplicate Azul, identical otherwise
        SAMPLE_GAMES[2],                                   // Gloomhaven
      ];

      it('shows how many will be skipped and why', async () => {
        await chooseFile(JSON.stringify(file));

        expect(text(fixture)).toContain('Replace games with 3 games');
        expect(text(fixture)).toContain('(2 duplicates will be skipped)');
        expect(text(fixture)).toContain('The file lists some titles more than once.');

        const rows = queryAll(fixture, 'li');
        expect(rows.length).toBe(5);
        expect(rows[2].className).toContain('opacity-50');
        expect(cellText(rows[2])).toBe('Catan skipped — duplicate of Catan · differs: rating 9');
        expect(cellText(rows[3])).toBe('azul skipped — duplicate of Azul');
        expect(rows[0].className).not.toContain('opacity-50');
      });

      it('imports only the kept games', async () => {
        await chooseFile(JSON.stringify(file));
        findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
        await settle(fixture);

        expect(savedGames()!.map(g => g.title)).toEqual(['Catan', 'Azul', 'Gloomhaven']);
        expect(savedGames()![0].rating).toBe(7); // first occurrence wins
        expect(text(fixture)).toContain('(3 games)');
      });

      it('says nothing about duplicates when there are none', async () => {
        await chooseFile(JSON.stringify([SAMPLE_GAMES[0]]));
        expect(text(fixture)).not.toContain('will be skipped');
        expect(text(fixture)).not.toContain('more than once');
      });
    });

    describe('plays in a v3 backup', () => {
      const newPlay = { ...SAMPLE_PLAYS[0], id: 'pl-new', playedAt: '2026-09-15' };

      it('previews a merge with new / already-here counts', async () => {
        const file = buildExport(SAMPLE_GAMES, SAMPLE_PLAYERS, [SAMPLE_PLAYS[0], newPlay, { ...SAMPLE_PLAYS[1], funRating: 1 }]);
        await chooseFile(JSON.stringify(file));

        expect(text(fixture).replace(/\s+/g, ' ')).toContain('Merge 3 plays into your history — 1 new, 2 already here');
      });

      it('confirming adds only the new plays and leaves existing ones untouched', async () => {
        const file = buildExport(SAMPLE_GAMES, SAMPLE_PLAYERS, [SAMPLE_PLAYS[0], newPlay, { ...SAMPLE_PLAYS[1], funRating: 1 }]);
        await chooseFile(JSON.stringify(file));
        findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
        await settle(fixture);

        const plays = savedPlays()!;
        expect(plays.map(p => p.id)).toEqual(['pl-1', 'pl-2', 'pl-3', 'pl-new']);
        expect(plays[1].funRating).toBe(SAMPLE_PLAYS[1].funRating);
        expect(text(fixture)).toContain('Imported 4 games, 3 players, 1 new play.');
        expect(text(fixture)).toContain('(4 plays)');
      });

      it('an old backup cannot delete newer plays', async () => {
        const file = buildExport(SAMPLE_GAMES, SAMPLE_PLAYERS, [SAMPLE_PLAYS[0]]);
        await chooseFile(JSON.stringify(file));
        expect(text(fixture).replace(/\s+/g, ' ')).toContain('Merge 1 play into your history — 0 new, 1 already here');

        findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
        await settle(fixture);
        expect(savedPlays()).toEqual(SAMPLE_PLAYS);
        expect(text(fixture)).toContain('0 new plays');
      });
    });

    describe('choosing which sections to apply', () => {
      const file = () => buildExport([SAMPLE_GAMES[0]], [{ id: 'p-new', name: 'Riley' }], [{ ...SAMPLE_PLAYS[0], id: 'pl-new' }]);
      const box = (id: string) => query<HTMLInputElement>(fixture, `#${id}`);

      it('starts with every present section ticked', async () => {
        await chooseFile(JSON.stringify(file()));
        expect(box('apply-games').checked).toBe(true);
        expect(box('apply-players').checked).toBe(true);
        expect(box('apply-plays').checked).toBe(true);
      });

      it('unticked sections are left alone', async () => {
        await chooseFile(JSON.stringify(file()));
        box('apply-games').click();
        box('apply-plays').click();
        await settle(fixture);

        findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
        await settle(fixture);

        expect(savedGames()).toEqual(SAMPLE_GAMES);
        expect(savedPlays()).toEqual(SAMPLE_PLAYS);
        expect(savedPlayers()).toEqual([{ id: 'p-new', name: 'Riley' }]);
        expect(text(fixture)).toContain('Imported 1 player.');
      });

      it('disables Confirm when nothing is ticked', async () => {
        await chooseFile(JSON.stringify(file()));
        box('apply-games').click();
        box('apply-players').click();
        box('apply-plays').click();
        await settle(fixture);
        expect(findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').disabled).toBe(true);
      });

      it('only offers checkboxes for sections the file has', async () => {
        await chooseFile(JSON.stringify([SAMPLE_GAMES[0]]));
        expect(fixture.nativeElement.querySelector('#apply-games')).toBeTruthy();
        expect(fixture.nativeElement.querySelector('#apply-players')).toBeNull();
        expect(fixture.nativeElement.querySelector('#apply-plays')).toBeNull();
      });
    });

    it('clears a previous error when a new file is chosen', async () => {
      await chooseFile('{ not json');
      expect(text(fixture)).toContain('Could not parse file');

      await chooseFile(JSON.stringify(SAMPLE_GAMES));
      expect(text(fixture)).not.toContain('Could not parse file');
      expect(text(fixture)).toContain('Replace games with');
    });
  });

  it('links back home and to the collection, players and history pages', () => {
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/collection', '/players', '/history']));
  });
});
