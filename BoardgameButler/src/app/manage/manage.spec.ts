import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Manage } from './manage';
import {
  SAMPLE_GAMES,
  SAMPLE_PLAYERS,
  cellText,
  findByText,
  query,
  queryAll,
  savedGames,
  savedPlayers,
  seedPlayers,
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
      expect(text(fixture)).toMatch(/Ready to import|Could not parse|must contain a JSON array|entry must be a JSON array/);
    });
  }

  describe('export', () => {
    it('shows how many games and players will be exported', () => {
      expect(text(fixture)).toContain('(4 games)');
      expect(text(fixture)).toContain('(3 players)');
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

    it('exports games and players in the version-2 format, pretty-printed', async () => {
      const createObjectURL = vi.fn((_blob: Blob) => 'blob:games');
      Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      findByText<HTMLButtonElement>(fixture, 'button', 'Download boardgame-butler.json').click();

      const blob = createObjectURL.mock.calls[0][0];
      const file = JSON.parse(await blob.text());
      expect(file).toEqual({
        version: 2,
        exportedAt: expect.any(String),
        games: SAMPLE_GAMES,
        players: SAMPLE_PLAYERS,
      });
      expect(await blob.text()).toContain('\n  "version": 2');
    });
  });

  describe('import', () => {
    it('rejects a file that is not valid JSON', async () => {
      await chooseFile('{ not json');
      expect(text(fixture)).toContain('Could not parse file — make sure it is valid JSON.');
      expect(text(fixture)).not.toContain('Ready to import');
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

      expect(text(fixture)).toContain('Ready to import');
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
      expect(text(fixture)).toContain('1 game:');
    });

    it('cancelling the preview restores the drop-zone without changing the collection', async () => {
      await chooseFile(JSON.stringify([SAMPLE_GAMES[0]]));
      findByText<HTMLButtonElement>(fixture, 'button', 'Cancel').click();
      await settle(fixture);

      expect(text(fixture)).not.toContain('Ready to import');
      expect(fileInput()).toBeTruthy();
      expect(savedGames()).toEqual(SAMPLE_GAMES);
    });

    it('a games-only (v1) file replaces the games and keeps the players', async () => {
      const incoming = [SAMPLE_GAMES[1], SAMPLE_GAMES[2]];
      await chooseFile(JSON.stringify(incoming));
      expect(text(fixture)).toContain('This is an older games-only file — your 3 players will be kept.');

      findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
      await settle(fixture);

      expect(savedGames()).toEqual(incoming);
      expect(savedPlayers()).toEqual(SAMPLE_PLAYERS);
      expect(text(fixture)).toContain('Backup imported successfully!');
      expect(text(fixture)).toContain('(2 games)');
      expect(text(fixture)).toContain('(3 players)');
      expect(text(fixture)).not.toContain('Ready to import');
      expect(fileInput()).toBeTruthy();
    });

    describe('a backup (v2) file', () => {
      it('previews and imports both games and players', async () => {
        const file = buildExport([SAMPLE_GAMES[0]], [{ id: 'p-new', name: 'Riley' }, { id: 'p-sam', name: 'Sam' }]);
        await chooseFile(JSON.stringify(file));

        expect(text(fixture)).toContain('Ready to import 1 game');
        expect(text(fixture)).toContain('and 2 players');
        const chips = queryAll(fixture, '[data-testid="players-preview"] li').map(li => li.textContent?.trim());
        expect(chips).toEqual(['Riley', 'Sam']);

        findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
        await settle(fixture);

        expect(savedGames()).toEqual([SAMPLE_GAMES[0]]);
        expect(savedPlayers()).toEqual([{ id: 'p-new', name: 'Riley' }, { id: 'p-sam', name: 'Sam' }]);
        expect(text(fixture)).toContain('(1 game)');
        expect(text(fixture)).toContain('(2 players)');
      });

      it('skips duplicate player names, first wins', async () => {
        const file = buildExport(SAMPLE_GAMES, [{ id: 'a', name: 'Sam' }, { id: 'b', name: ' SAM ' }, { id: 'c', name: 'Jo' }]);
        await chooseFile(JSON.stringify(file));

        expect(text(fixture).replace(/\s+/g, ' ')).toContain('and 2 players (1 duplicate will be skipped)');
        const skipped = query(fixture, '[data-testid="players-preview"] li[aria-label="Skipped duplicate of Sam"]');
        expect(skipped.className).toContain('line-through');

        findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
        await settle(fixture);
        expect(savedPlayers()!.map(p => p.name)).toEqual(['Sam', 'Jo']);
      });

      it('warns when the file has no players and confirming removes the current ones', async () => {
        const file = buildExport(SAMPLE_GAMES, []);
        await chooseFile(JSON.stringify(file));
        expect(text(fixture)).toContain('and 0 players');
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
      expect(text(fixture)).toContain('Ready to import');
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

        expect(text(fixture)).toContain('Ready to import 3 games');
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

    it('clears a previous error when a new file is chosen', async () => {
      await chooseFile('{ not json');
      expect(text(fixture)).toContain('Could not parse file');

      await chooseFile(JSON.stringify(SAMPLE_GAMES));
      expect(text(fixture)).not.toContain('Could not parse file');
      expect(text(fixture)).toContain('Ready to import');
    });
  });

  it('links back home and to the collection and players pages', () => {
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/collection', '/players']));
  });
});
