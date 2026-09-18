import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Home } from './home';
import { SAMPLE_GAMES, findByText, query, queryAll, settle, text } from '../../testing/helpers';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let http: HttpTestingController;

  async function setup(platform: 'browser' | 'server' = 'browser') {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: platform },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Home);
    await settle(fixture);
  }

  afterEach(() => http.verify());

  const serveButton = () => findByText<HTMLButtonElement>(fixture, 'button', 'Serve me a game!');

  it('loads the library from /games.json on init', async () => {
    await setup();
    const req = http.expectOne('/games.json');
    expect(req.request.method).toBe('GET');
  });

  it('does not fetch on the server (prerender)', async () => {
    await setup('server');
    http.expectNone('/games.json');
  });

  it('shows a loading state and disables the button until games arrive', async () => {
    await setup();
    expect(text(fixture)).toContain('Loading game library...');
    expect(serveButton().disabled).toBe(true);

    http.expectOne('/games.json').flush(SAMPLE_GAMES);
    await settle(fixture);

    expect(text(fixture)).not.toContain('Loading game library...');
    expect(serveButton().disabled).toBe(false);
  });

  it('serves a random game from the library', async () => {
    await setup();
    http.expectOne('/games.json').flush(SAMPLE_GAMES);
    await settle(fixture);

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
    http.expectOne('/games.json').flush(SAMPLE_GAMES);
    await settle(fixture);

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
    http.expectOne('/games.json').flush(SAMPLE_GAMES);
    await settle(fixture);

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
    http.expectOne('/games.json').flush([]);
    const chips = queryAll(fixture, 'span').map(s => s.textContent?.trim());
    for (const feature of ['Track your collection', 'Quick-pick assistant', 'Play statistics']) {
      expect(chips).toContain(feature);
    }
  });

  it('links to the collection, add-game and manage pages', async () => {
    await setup();
    http.expectOne('/games.json').flush([]);
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/collection', '/add-game', '/manage']));
  });
});
