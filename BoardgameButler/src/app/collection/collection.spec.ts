import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Collection } from './collection';
import { Game } from '../game';
import { SAMPLE_GAMES, cellText, findByText, query, queryAll, seedStorage, setInputValue, settle, text } from '../../testing/helpers';

describe('Collection', () => {
  let fixture: ComponentFixture<Collection>;
  let http: HttpTestingController;

  beforeEach(() => localStorage.clear());

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  /** Create the page with `games` already saved on the device (or nothing, if `null`). */
  async function load(games: Game[] | null = SAMPLE_GAMES) {
    if (games) seedStorage(games);

    await TestBed.configureTestingModule({
      imports: [Collection],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Collection);
    await settle(fixture);
  }

  const titles = () => queryAll(fixture, 'tbody td:first-child:not([colspan])').map(td => td.textContent?.trim());
  const header = (label: string) => findByText<HTMLButtonElement>(fixture, 'th button', label);

  async function clickHeader(label: string) {
    header(label).click();
    await settle(fixture);
  }

  it('shows a loading state while the collection is being seeded on first run', async () => {
    await load(null);
    expect(text(fixture)).toContain('Loading...');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();

    http.expectOne('/games.json').flush(SAMPLE_GAMES);
    await settle(fixture);
    expect(text(fixture)).not.toContain('Loading...');
    expect(queryAll(fixture, 'tbody tr').length).toBe(4);
  });

  it('renders one row per game with the total count', async () => {
    await load();
    expect(text(fixture)).toContain('4 games');
    expect(queryAll(fixture, 'tbody tr').length).toBe(4);
  });

  it('shows each game’s details, with a dash for missing ratings', async () => {
    await load();
    const rows = queryAll(fixture, 'tbody tr').map(cellText);
    expect(rows).toContain('Azul 2-4 30-45 Easy 9/10');
    expect(rows).toContain('Gloomhaven 1-4 60-120 Hard —');
  });

  it('colour-codes the complexity pill', async () => {
    await load();
    const pillFor = (title: string) =>
      findByText(fixture, 'tbody tr', title).querySelector('td:nth-child(4) span')!.className;
    expect(pillFor('Azul')).toContain('text-green-400');
    expect(pillFor('Catan')).toContain('text-amber-400');
    expect(pillFor('Gloomhaven')).toContain('text-red-400');
  });

  it('shows an empty state with a link to add a game', async () => {
    await load([]);
    expect(text(fixture)).toContain('No games yet.');
    expect(text(fixture)).toContain('Your collection is empty.');
    expect(findByText<HTMLAnchorElement>(fixture, 'a', 'Add your first game').getAttribute('href')).toBe('/add-game');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('shows an error when the starter collection cannot be loaded', async () => {
    await load(null);
    http.expectOne('/games.json').flush('nope', { status: 500, statusText: 'Server Error' });
    await settle(fixture);
    expect(text(fixture)).toContain('Could not load the starter collection.');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  describe('search', () => {
    it('filters by title, case-insensitively, and shows the filtered count', async () => {
      await load();
      setInputValue(query<HTMLInputElement>(fixture, 'input[type="search"]'), 'AR');
      await settle(fixture);

      expect(titles()).toEqual(['Terraforming Mars']);
      expect(text(fixture)).toContain('Showing 1 of 4 games');
    });

    it('shows a no-match message', async () => {
      await load();
      setInputValue(query<HTMLInputElement>(fixture, 'input[type="search"]'), 'zzz');
      await settle(fixture);

      expect(titles()).toEqual([]);
      expect(text(fixture)).toContain('No games match "zzz".');
    });

    it('restores the full list when cleared', async () => {
      await load();
      const input = query<HTMLInputElement>(fixture, 'input[type="search"]');
      setInputValue(input, 'Azul');
      await settle(fixture);
      setInputValue(input, '');
      await settle(fixture);

      expect(titles().length).toBe(4);
      expect(text(fixture)).toContain('4 games');
    });
  });

  describe('sorting', () => {
    it('sorts by title ascending by default', async () => {
      await load();
      expect(titles()).toEqual(['Azul', 'Catan', 'Gloomhaven', 'Terraforming Mars']);
      expect(header('Title').className).toContain('text-amber-400');
      expect(header('Title').textContent).toContain('▲');
    });

    it('clicking the active column reverses the direction', async () => {
      await load();
      await clickHeader('Title');
      expect(titles()).toEqual(['Terraforming Mars', 'Gloomhaven', 'Catan', 'Azul']);
      expect(header('Title').textContent).toContain('▼');
    });

    it('clicking a new column sorts ascending and moves the indicator', async () => {
      await load();
      await clickHeader('Title'); // now descending
      await clickHeader('Complexity');

      expect(titles()).toEqual(['Azul', 'Catan', 'Gloomhaven', 'Terraforming Mars']);
      expect(header('Complexity').textContent).toContain('▲');
      expect(header('Title').textContent).not.toMatch(/[▲▼]/);
    });

    it('sorts complexity Easy → Medium → Hard, then reversed', async () => {
      await load();
      await clickHeader('Complexity');
      expect(titles().slice(0, 2)).toEqual(['Azul', 'Catan']);
      await clickHeader('Complexity');
      expect(titles().slice(-1)).toEqual(['Azul']);
    });

    it('sorts rating numerically with unrated games always last', async () => {
      await load();
      await clickHeader('Rating');
      expect(titles()).toEqual(['Catan', 'Terraforming Mars', 'Azul', 'Gloomhaven']);

      await clickHeader('Rating');
      expect(titles()).toEqual(['Azul', 'Terraforming Mars', 'Catan', 'Gloomhaven']);
    });

    it('sorts players and minutes by the leading number of the range', async () => {
      await load();
      await clickHeader('Players');
      expect(titles().slice(0, 2)).toEqual(expect.arrayContaining(['Gloomhaven', 'Terraforming Mars']));
      expect(titles()[3]).toBe('Catan');

      await clickHeader('Minutes');
      expect(titles()[0]).toBe('Azul');
      expect(titles()[3]).toBe('Terraforming Mars');
    });

    it('pushes non-numeric players/minutes values to the end', async () => {
      await load([
        { title: 'Party', players: 'any', duration: '20', complexity: 'Easy' },
        ...SAMPLE_GAMES,
      ]);
      await clickHeader('Players');
      expect(titles().slice(-1)).toEqual(['Party']);
    });

    it('keeps the sort while searching', async () => {
      await load();
      await clickHeader('Rating');
      setInputValue(query<HTMLInputElement>(fixture, 'input[type="search"]'), 'a');
      await settle(fixture);
      expect(titles()).toEqual(['Catan', 'Terraforming Mars', 'Azul', 'Gloomhaven']);
    });
  });

  it('links to home, add-game and manage', async () => {
    await load();
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/add-game', '/manage']));
  });
});
