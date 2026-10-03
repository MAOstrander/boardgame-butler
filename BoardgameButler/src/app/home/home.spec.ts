import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Home } from './home';
import { Game } from '../game';
import {
  SAMPLE_GAMES,
  SAMPLE_PLAYS,
  findByText,
  query,
  queryAll,
  seedPlayers,
  seedPlays,
  seedStorage,
  setInputValue,
  settle,
  text,
} from '../../testing/helpers';
import { Play } from '../play';
import { InstallService } from '../install';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let http: HttpTestingController;

  /** Pass `null` to start with nothing saved so the store has to seed over HTTP. */
  async function setup(saved: Game[] | null = SAMPLE_GAMES, plays: Play[] = SAMPLE_PLAYS) {
    localStorage.clear();
    if (saved) seedStorage(saved);
    seedPlayers([]);
    seedPlays(plays);

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

    http.expectOne('games.json').flush(SAMPLE_GAMES);
    await settle(fixture);

    expect(text(fixture)).not.toContain('Loading game library...');
    expect(serveButton().disabled).toBe(false);
  });

  it('is ready immediately from the saved collection', async () => {
    await setup();
    http.expectNone('games.json');
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

  describe('filtered pick', () => {
    const toggle = () => findByText<HTMLButtonElement>(fixture, 'button', 'Narrow it down');
    const panel = () => fixture.nativeElement.querySelector('section[aria-label="Filters"]') as HTMLElement | null;
    const matchButton = () => findByText<HTMLButtonElement>(fixture, 'button', 'Serve me a match!');
    const complexity = (label: string) => findByText<HTMLButtonElement>(fixture, 'section button', label);

    async function openFilters() {
      toggle().click();
      await settle(fixture);
    }

    async function setPlayers(value: string) {
      setInputValue(query<HTMLInputElement>(fixture, '#filter-players'), value);
      await settle(fixture);
    }

    async function setTime(value: string) {
      setInputValue(query<HTMLSelectElement>(fixture, '#filter-time'), value);
      await settle(fixture);
    }

    async function setRating(value: string) {
      setInputValue(query<HTMLSelectElement>(fixture, '#filter-rating'), value);
      await settle(fixture);
    }

    it('starts hidden and toggles open and closed', async () => {
      await setup();
      expect(panel()).toBeNull();

      await openFilters();
      expect(panel()).not.toBeNull();
      expect(text(fixture)).toContain('No filters set — all 4 games match');
      expect(matchButton().disabled).toBe(false);

      findByText<HTMLButtonElement>(fixture, 'button', 'Hide filters').click();
      await settle(fixture);
      expect(panel()).toBeNull();
    });

    it('is disabled while the collection is empty', async () => {
      await setup([]);
      expect(toggle().disabled).toBe(true);
    });

    it('filters by player count', async () => {
      await setup();
      await openFilters();
      await setPlayers('5');
      expect(text(fixture)).toContain('1 of 4 games match'); // Terraforming Mars (1-5)

      await setPlayers('2');
      expect(text(fixture)).toContain('3 of 4 games match'); // everything but Catan (3-4)
    });

    it('filters by time available', async () => {
      await setup();
      await openFilters();
      await setTime('60');
      expect(text(fixture)).toContain('1 of 4 games match'); // Azul (30-45)

      await setTime('120');
      expect(text(fixture)).toContain('3 of 4 games match'); // all but Terraforming Mars (120-180)
    });

    it('filters by any of the selected complexities', async () => {
      await setup();
      await openFilters();

      complexity('Hard').click();
      await settle(fixture);
      expect(complexity('Hard').getAttribute('aria-pressed')).toBe('true');
      expect(text(fixture)).toContain('2 of 4 games match');

      complexity('Easy').click();
      await settle(fixture);
      expect(text(fixture)).toContain('3 of 4 games match');

      complexity('Hard').click();
      await settle(fixture);
      expect(complexity('Hard').getAttribute('aria-pressed')).toBe('false');
      expect(text(fixture)).toContain('1 of 4 games match');
    });

    it('filters by minimum rating, excluding unrated games', async () => {
      await setup();
      await openFilters();
      await setRating('8');
      expect(text(fixture)).toContain('2 of 4 games match'); // Azul 9, Terraforming Mars 8
    });

    it('combines filters', async () => {
      await setup();
      await openFilters();
      await setPlayers('2');
      await setTime('45');
      expect(text(fixture)).toContain('1 of 4 games match'); // Azul
    });

    it('disables the match button and says so when nothing matches', async () => {
      await setup();
      await openFilters();
      await setPlayers('9');
      expect(text(fixture)).toContain('No games match these filters');
      expect(matchButton().disabled).toBe(true);
    });

    it('clears all filters at once', async () => {
      await setup();
      await openFilters();
      await setPlayers('9');
      findByText<HTMLButtonElement>(fixture, 'button', 'Clear').click();
      await settle(fixture);

      expect(text(fixture)).toContain('No filters set — all 4 games match');
      expect(query<HTMLInputElement>(fixture, '#filter-players').value).toBe('');
      expect(fixture.nativeElement.textContent).not.toContain('Clear');
    });

    it('serves only from the matching games and labels the pick', async () => {
      await setup();
      await openFilters();
      await setPlayers('5');

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      matchButton().click();
      await settle(fixture);

      expect(query(fixture, 'h2').textContent).toContain('Terraforming Mars');
      expect(text(fixture)).toContain("Tonight's pick · from your matches");
    });

    it('the whole-collection button ignores the filters', async () => {
      await setup();
      await openFilters();
      await setPlayers('5');

      vi.spyOn(Math, 'random').mockReturnValue(0);
      serveButton().click();
      await settle(fixture);

      expect(query(fixture, 'h2').textContent).toContain('Catan'); // not a match for 5 players
      expect(text(fixture)).toContain("Tonight's pick");
      expect(text(fixture)).not.toContain('from your matches');
    });
  });

  describe('least played', () => {
    const toggle = () => findByText<HTMLButtonElement>(fixture, 'section button', 'played');

    async function openFilters() {
      findByText<HTMLButtonElement>(fixture, 'button', 'Narrow it down').click();
      await settle(fixture);
    }

    it('offers the never-played games while any exist', async () => {
      await setup();
      await openFilters();
      // SAMPLE_PLAYS covers Catan and Azul; Gloomhaven and Terraforming Mars are untouched.
      expect(toggle().textContent).toContain('Never played (2 games)');
    });

    it('becomes "least played" once everything has been played', async () => {
      await setup(SAMPLE_GAMES, [
        ...SAMPLE_PLAYS,
        { ...SAMPLE_PLAYS[0], id: 'x', gameId: 'g-gloom' },
        { ...SAMPLE_PLAYS[0], id: 'y', gameId: 'g-tm' },
      ]);
      await openFilters();
      expect(toggle().textContent).toContain('Least played · 1 play (3 games)');
    });

    it('restricts the matches and counts as an active filter', async () => {
      await setup();
      await openFilters();
      expect(text(fixture)).toContain('No filters set');

      toggle().click();
      await settle(fixture);

      expect(toggle().getAttribute('aria-pressed')).toBe('true');
      expect(text(fixture)).toContain('2 of 4 games match');
    });

    it('combines with the other filters', async () => {
      await setup();
      await openFilters();
      toggle().click();
      await settle(fixture);
      // Of the two never-played games, only Terraforming Mars seats 5.
      setInputValue(query<HTMLInputElement>(fixture, '#filter-players'), '5');
      await settle(fixture);
      expect(text(fixture)).toContain('1 of 4 games match');
    });

    it('serves only from the least-played games', async () => {
      await setup();
      await openFilters();
      toggle().click();
      await settle(fixture);

      vi.spyOn(Math, 'random').mockReturnValue(0);
      findByText<HTMLButtonElement>(fixture, 'button', 'Serve me a match!').click();
      await settle(fixture);

      expect(query(fixture, 'h2').textContent).toContain('Gloomhaven');
      expect(text(fixture)).toContain('from your matches');
    });

    it('is cleared along with the other filters', async () => {
      await setup();
      await openFilters();
      toggle().click();
      await settle(fixture);

      findByText<HTMLButtonElement>(fixture, 'button', 'Clear').click();
      await settle(fixture);

      expect(toggle().getAttribute('aria-pressed')).toBe('false');
      expect(text(fixture)).toContain('No filters set');
    });
  });

  describe('install button', () => {
    const installButton = () =>
      queryAll<HTMLButtonElement>(fixture, 'button').find(b => b.textContent?.includes('Install app'));

    it('is hidden until the browser offers an install', async () => {
      await setup();
      expect(installButton()).toBeUndefined();
    });

    it('appears when an install is available and asks the service to prompt', async () => {
      await setup();
      const install = TestBed.inject(InstallService);
      vi.spyOn(install, 'canInstall').mockReturnValue(true);
      const prompt = vi.spyOn(install, 'prompt').mockResolvedValue('accepted');

      fixture = TestBed.createComponent(Home);
      await settle(fixture);

      installButton()!.click();
      await settle(fixture);
      expect(prompt).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the feature chips', async () => {
    await setup();
    const chips = queryAll(fixture, 'span').map(s => s.textContent?.trim());
    for (const feature of ['Track your collection', 'Quick-pick assistant', 'Play statistics']) {
      expect(chips).toContain(feature);
    }
  });

  it('links to every other page', async () => {
    await setup();
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/collection', '/add-game', '/manage', '/tools', '/players', '/history', '/stats']));
  });

  it('the pick card offers to log a play of that game', async () => {
    await setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // Gloomhaven
    serveButton().click();
    await settle(fixture);

    const link = findByText<HTMLAnchorElement>(fixture, 'a', 'We played this');
    expect(link.getAttribute('href')).toBe('/log-play?game=g-gloom');
  });
});
