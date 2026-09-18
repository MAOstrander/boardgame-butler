import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Manage } from './manage';
import {
  SAMPLE_GAMES,
  cellText,
  findByText,
  query,
  queryAll,
  savedGames,
  seedStorage,
  selectFile,
  settle,
  text,
} from '../../testing/helpers';

describe('Manage', () => {
  let fixture: ComponentFixture<Manage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    seedStorage(SAMPLE_GAMES);

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
      expect(text(fixture)).toMatch(/Ready to import|Could not parse|must contain a JSON array/);
    });
  }

  describe('export', () => {
    it('shows how many games will be exported', () => {
      expect(text(fixture)).toContain('(4 games)');
    });

    it('downloads the collection as games.json', () => {
      const createObjectURL = vi.fn((_blob: Blob) => 'blob:games');
      const revokeObjectURL = vi.fn();
      Object.assign(URL, { createObjectURL, revokeObjectURL });
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      findByText<HTMLButtonElement>(fixture, 'button', 'Download games.json').click();

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0][0];
      expect(blob.type).toBe('application/json');

      expect(click).toHaveBeenCalledTimes(1);
      const anchor = click.mock.instances[0] as HTMLAnchorElement;
      expect(anchor.download).toBe('games.json');
      expect(anchor.href).toBe('blob:games');
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:games');
    });

    it('exports the current collection, pretty-printed', async () => {
      const createObjectURL = vi.fn((_blob: Blob) => 'blob:games');
      Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      findByText<HTMLButtonElement>(fixture, 'button', 'Download games.json').click();

      const blob = createObjectURL.mock.calls[0][0];
      expect(await blob.text()).toBe(JSON.stringify(SAMPLE_GAMES, null, 2));
    });
  });

  describe('import', () => {
    it('rejects a file that is not valid JSON', async () => {
      await chooseFile('{ not json');
      expect(text(fixture)).toContain('Could not parse file — make sure it is valid JSON.');
      expect(text(fixture)).not.toContain('Ready to import');
    });

    it('rejects JSON that is not an array', async () => {
      await chooseFile('{"title":"Catan"}');
      expect(text(fixture)).toContain('File must contain a JSON array of games.');
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

    it('confirming replaces the saved collection', async () => {
      const incoming = [SAMPLE_GAMES[1], SAMPLE_GAMES[2]];
      await chooseFile(JSON.stringify(incoming));
      findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
      await settle(fixture);

      expect(savedGames()).toEqual(incoming);
      expect(text(fixture)).toContain('Collection imported successfully!');
      expect(text(fixture)).toContain('(2 games)');
      expect(text(fixture)).not.toContain('Ready to import');
      expect(fileInput()).toBeTruthy();
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

  it('links back home and to the collection page', () => {
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/collection']));
  });
});
