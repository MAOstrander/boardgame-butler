import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Home } from './home';
import { Game } from '../game';
import { SAMPLE_GAMES, findByText, query, queryAll, seedStorage, settle, text } from '../../testing/helpers';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let http: HttpTestingController;

  /** Pass `null` to start with nothing saved so the store has to seed over HTTP. */
  async function setup(saved: Game[] | null = SAMPLE_GAMES) {
    localStorage.clear();
    if (saved) seedStorage(saved);

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Home);
    await settle(fixture);
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const serveButton = () => findByText<HTMLButtonElement>(fixture, 'button', 'Serve me a game!');

  it('shows a loading state and disables the button while the collection seeds', async () => {
    await setup(null);
    expect(text(fixture)).toContain('Loading game library...');
    expect(serveButton().disabled).toBe(true);

    http.expectOne('/games.json').flush(SAMPLE_GAMES);
    await settle(fixture);

    expect(text(fixture)).not.toContain('Loading game library...');
    expect(serveButton().disabled).toBe(false);
  });

  it('is ready immediately from the saved collection', async () => {
    await setup();
    http.expectNone('/games.json');
    expect(text(fixture)).not.toContain('Loading game library...');
    expect(serveButton().disabled).toBe(false);
  });

  it('shows an empty-collection hint when there is nothing to pick', async () => {
    await setup([]);

    expect(text(fixture)).toContain('Your collection is empty');
    expect(serveButton().disabled).toBe(true);
  });

  it('serves a random game from the library', async () => {
    await setup();

    // Math.random() = 0.5 → index floor(0.5 * 4) = 2 → Gloomhaven
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    serveButton().click();
    await settle(fixture);

    expect(text(fixture)).toContain("Tonight's pick");
    expect(query(fixture, 'h2').textContent).toContain('Gloomhaven');
    expect(text(fixture)).toContain('1-4 players');
    expect(text(fixture)).toContain('60-120 min');
    expect(text(fixture)).toContain('Hard');
  });

  it('re-rolls on each click', async () => {
    await setup();

    const random = vi.spyOn(Math, 'random');
    random.mockReturnValue(0);
    serveButton().click();
    await settle(fixture);
    expect(query(fixture, 'h2').textContent).toContain('Catan');

    random.mockReturnValue(0.99);
    serveButton().click();
    await settle(fixture);
    expect(query(fixture, 'h2').textContent).toContain('Terraforming Mars');
  });

  it('shows the rating badge only when the game has a rating', async () => {
    await setup();

    const random = vi.spyOn(Math, 'random');
    random.mockReturnValue(0); // Catan, rated 7
    serveButton().click();
    await settle(fixture);
    expect(text(fixture)).toContain('7/10');

    random.mockReturnValue(0.5); // Gloomhaven, unrated
    serveButton().click();
    await settle(fixture);
    expect(text(fixture)).not.toContain('/10');
  });

  it('shows the feature chips', async () => {
    await setup();
    const chips = queryAll(fixture, 'span').map(s => s.textContent?.trim());
    for (const feature of ['Track your collection', 'Quick-pick assistant', 'Play statistics']) {
      expect(chips).toContain(feature);
    }
  });

  it('links to the collection, add-game and manage pages', async () => {
    await setup();
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/collection', '/add-game', '/manage']));
  });
});
