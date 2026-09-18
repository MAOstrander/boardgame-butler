import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Manage } from './manage';
import { SAMPLE_GAMES, cellText, findByText, query, queryAll, selectFile, settle, text } from '../../testing/helpers';

describe('Manage', () => {
  let fixture: ComponentFixture<Manage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Manage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Manage);
    await settle(fixture);
  });

  afterEach(() => http.verify());

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
    it('offers a download button', () => {
      expect(findByText(fixture, 'button', 'Download games.json')).toBeTruthy();
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
      await chooseFile(JSON.stringify(SAMPLE_GAMES));

      expect(text(fixture)).toContain('Ready to import');
      expect(text(fixture)).toContain('4 games');
      const rows = queryAll(fixture, 'li').map(cellText);
      expect(rows).toEqual([
        'Catan 3-4 players · Medium',
        'Azul 2-4 players · Easy',
        'Gloomhaven 1-4 players · Hard',
        'Terraforming Mars 1-5 players · Hard',
      ]);
      // The drop-zone is hidden while a preview is showing.
      expect(fixture.nativeElement.querySelector('input[type="file"]')).toBeNull();
    });

    it('uses singular wording for a single game', async () => {
      await chooseFile(JSON.stringify([SAMPLE_GAMES[0]]));
      expect(text(fixture)).toContain('1 game:');
    });

    it('cancelling the preview restores the drop-zone without calling the API', async () => {
      await chooseFile(JSON.stringify(SAMPLE_GAMES));
      findByText<HTMLButtonElement>(fixture, 'button', 'Cancel').click();
      await settle(fixture);

      expect(text(fixture)).not.toContain('Ready to import');
      expect(fileInput()).toBeTruthy();
      http.expectNone('/api/games');
    });

    it('confirming replaces the collection via PUT /api/games', async () => {
      await chooseFile(JSON.stringify(SAMPLE_GAMES));
      const confirm = findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import');
      confirm.click();
      await settle(fixture);

      expect(confirm.textContent).toContain('Importing...');
      expect(confirm.disabled).toBe(true);

      const req = http.expectOne('/api/games');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(SAMPLE_GAMES);
      req.flush({ success: true, count: 4 });
      await settle(fixture);

      expect(text(fixture)).toContain('Collection imported successfully!');
      expect(text(fixture)).not.toContain('Ready to import');
      expect(fileInput()).toBeTruthy();
    });

    it('shows an error and keeps the preview when the import fails', async () => {
      await chooseFile(JSON.stringify(SAMPLE_GAMES));
      findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').click();
      await settle(fixture);

      http.expectOne('/api/games').flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
      await settle(fixture);

      expect(text(fixture)).toContain('Import failed. Please try again.');
      expect(text(fixture)).toContain('Ready to import');
      expect(findByText<HTMLButtonElement>(fixture, 'button', 'Confirm Import').disabled).toBe(false);
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
