import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlayForm } from './play-form';
import { TimerService } from '../timer-service';
import { Play } from '../play';
import {
  SAMPLE_GAMES,
  SAMPLE_PLAYERS,
  SAMPLE_PLAYS,
  findByText,
  query,
  queryAll,
  savedPlays,
  seedPlayers,
  seedPlays,
  seedStorage,
  setInputValue,
  settle,
  text,
} from '../../testing/helpers';

describe('PlayForm', () => {
  let fixture: ComponentFixture<PlayForm>;
  let http: HttpTestingController;
  let router: Router;

  async function setup(
    inputs: { id?: string; game?: string } = {},
    opts: { players?: boolean; games?: boolean; plays?: Play[] } = {},
  ) {
    localStorage.clear();
    seedStorage(opts.games === false ? [] : SAMPLE_GAMES);
    seedPlayers(opts.players === false ? [] : SAMPLE_PLAYERS);
    seedPlays(opts.plays ?? SAMPLE_PLAYS);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 20, 0)); // local time, 18 Sep 2026

    await TestBed.configureTestingModule({
      imports: [PlayForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(PlayForm);
    if (inputs.id !== undefined) fixture.componentRef.setInput('id', inputs.id);
    if (inputs.game !== undefined) fixture.componentRef.setInput('game', inputs.game);
    await settle(fixture);
  }

  afterEach(() => {
    http.verify();
    TestBed.inject(TimerService).stopwatch.reset();
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const submitButton = () => query<HTMLButtonElement>(fixture, 'button[type="submit"]');
  const gameSelect = () => query<HTMLSelectElement>(fixture, '#game');
  const chip = (group: string, name: string) =>
    findByText<HTMLButtonElement>(fixture, `[aria-label="${group}"] button`, name);

  describe('logging', () => {
    it('defaults to today, no game, submit disabled', async () => {
      await setup();
      expect(query(fixture, 'h1').textContent).toContain('Log a Play');
      expect(query<HTMLInputElement>(fixture, '#played-at').value).toBe('2026-09-18');
      expect(gameSelect().value).toBe('');
      expect(submitButton().disabled).toBe(true);
      expect(text(fixture)).toContain('not rated');
    });

    it('lists games alphabetically and pre-selects the one from the query parameter', async () => {
      await setup({ game: 'g-gloom' });
      const options = queryAll<HTMLOptionElement>(fixture, '#game option').map(o => o.textContent?.trim());
      expect(options).toEqual(['Choose a game…', 'Azul', 'Catan', 'Gloomhaven', 'Terraforming Mars']);
      expect(gameSelect().value).toBe('g-gloom');
      expect(submitButton().disabled).toBe(false);
    });

    it('ignores an unknown game in the query parameter', async () => {
      await setup({ game: 'nope' });
      expect(gameSelect().value).toBe('');
    });

    it('shows player chips alphabetically and reveals winners only for selected players', async () => {
      await setup();
      const players = queryAll(fixture, '[aria-label="Who played"] button').map(b => b.textContent?.trim());
      expect(players).toEqual(['Alex', 'Jo', 'Sam']);
      expect(fixture.nativeElement.querySelector('[aria-label="Who won"]')).toBeNull();

      chip('Who played', 'Sam').click();
      chip('Who played', 'Jo').click();
      await settle(fixture);

      const winners = queryAll(fixture, '[aria-label="Who won"] button').map(b => b.textContent?.trim());
      expect(winners).toEqual(['Sam', 'Jo']);
    });

    it('deselecting a player also removes them as a winner', async () => {
      await setup();
      chip('Who played', 'Sam').click();
      await settle(fixture);
      chip('Who won', 'Sam').click();
      await settle(fixture);
      expect(chip('Who won', 'Sam').getAttribute('aria-pressed')).toBe('true');

      chip('Who played', 'Sam').click();
      await settle(fixture);
      expect(fixture.nativeElement.querySelector('[aria-label="Who won"]')).toBeNull();

      chip('Who played', 'Sam').click();
      await settle(fixture);
      expect(chip('Who won', 'Sam').getAttribute('aria-pressed')).toBe('false');
    });

    it('offers the stopwatch time as a duration shortcut when it has run', async () => {
      await setup();
      expect(text(fixture)).not.toContain('Use stopwatch');

      const stopwatch = TestBed.inject(TimerService).stopwatch;
      stopwatch.start();
      vi.advanceTimersByTime(47 * 60_000);
      stopwatch.pause();
      await settle(fixture);

      findByText<HTMLButtonElement>(fixture, 'button', 'Use stopwatch (47 min)').click();
      await settle(fixture);
      expect(query<HTMLInputElement>(fixture, '#duration-minutes').value).toBe('47');
    });

    it('saves a full play with snapshots and goes to history', async () => {
      await setup({ game: 'g-azul' });
      setInputValue(query<HTMLInputElement>(fixture, '#played-at'), '2026-09-17');
      chip('Who played', 'Sam').click();
      chip('Who played', 'Alex').click();
      await settle(fixture);
      chip('Who won', 'Alex').click();
      setInputValue(query<HTMLInputElement>(fixture, '#duration-minutes'), '42');
      setInputValue(query<HTMLInputElement>(fixture, '#fun-rating'), '9');
      setInputValue(query<HTMLTextAreaElement>(fixture, '#notes'), '  Great game.  ');
      await settle(fixture);
      expect(text(fixture)).toContain('9 / 10');

      submitButton().click();
      await settle(fixture);

      const saved = savedPlays()!;
      expect(saved.length).toBe(SAMPLE_PLAYS.length + 1);
      expect(saved[3]).toEqual({
        id: expect.any(String),
        gameId: 'g-azul',
        gameTitle: 'Azul',
        playedAt: '2026-09-17',
        players: [{ id: 'p-sam', name: 'Sam' }, { id: 'p-alex', name: 'Alex' }],
        playerCount: 2,
        winnerIds: ['p-alex'],
        durationMinutes: 42,
        funRating: 9,
        notes: 'Great game.',
      });
      expect(router.navigate).toHaveBeenCalledWith(['/history']);
    });

    it('saves a minimal play with only a game and date', async () => {
      await setup();
      setInputValue(gameSelect(), 'g-catan');
      await settle(fixture);
      submitButton().click();
      await settle(fixture);

      expect(savedPlays()![3]).toEqual({
        id: expect.any(String),
        gameId: 'g-catan',
        gameTitle: 'Catan',
        playedAt: '2026-09-18',
        players: [],
        winnerIds: [],
      });
    });

    describe('head-count', () => {
      const countInput = () => query<HTMLInputElement>(fixture, '#player-count');

      it('defaults to the number of selected players and says so', async () => {
        await setup({ game: 'g-azul' });
        expect(countInput().placeholder).toBe('e.g. 4');

        chip('Who played', 'Sam').click();
        chip('Who played', 'Jo').click();
        await settle(fixture);
        expect(countInput().placeholder).toBe('2');
        expect(text(fixture)).toContain('Will be saved as 2 — the players picked above.');
      });

      it('can be raised above the selected players, for people not in the list', async () => {
        await setup({ game: 'g-azul' });
        chip('Who played', 'Sam').click();
        await settle(fixture);
        setInputValue(countInput(), '4');
        await settle(fixture);

        submitButton().click();
        await settle(fixture);
        expect(savedPlays()![3]).toMatchObject({ players: [{ id: 'p-sam', name: 'Sam' }], playerCount: 4 });
      });

      it('can be set with no named players at all', async () => {
        await setup({ game: 'g-azul' });
        setInputValue(countInput(), '3');
        await settle(fixture);
        submitButton().click();
        await settle(fixture);
        expect(savedPlays()![3]).toMatchObject({ players: [], playerCount: 3 });
      });

      it('refuses fewer than the selected players, or zero', async () => {
        await setup({ game: 'g-azul' });
        chip('Who played', 'Sam').click();
        chip('Who played', 'Jo').click();
        await settle(fixture);

        setInputValue(countInput(), '1');
        await settle(fixture);
        expect(text(fixture)).toContain('You picked 2 players above.');
        expect(submitButton().disabled).toBe(true);

        setInputValue(countInput(), '0');
        await settle(fixture);
        expect(text(fixture)).toContain('At least one person must have played.');
        expect(submitButton().disabled).toBe(true);

        setInputValue(countInput(), '');
        await settle(fixture);
        expect(submitButton().disabled).toBe(false);
      });
    });

    it('"clear" removes the fun rating', async () => {
      await setup();
      setInputValue(query<HTMLInputElement>(fixture, '#fun-rating'), '6');
      await settle(fixture);
      expect(text(fixture)).toContain('6 / 10');
      findByText<HTMLButtonElement>(fixture, 'button', 'clear').click();
      await settle(fixture);
      expect(text(fixture)).toContain('not rated');
    });

    it('points to the Players page when there are none', async () => {
      await setup({}, { players: false });
      expect(text(fixture)).toContain('No players yet');
      expect(queryAll<HTMLAnchorElement>(fixture, 'a').some(a => a.getAttribute('href') === '/players')).toBe(true);
    });

    it('points to Add a game when the collection is empty', async () => {
      await setup({}, { games: false });
      expect(text(fixture)).toContain('Your collection is empty');
      expect(submitButton().disabled).toBe(true);
    });

    it('shows a storage error and stays on the page', async () => {
      await setup({ game: 'g-azul' });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
      submitButton().click();
      await settle(fixture);
      expect(text(fixture)).toContain('Could not save your play history to this device.');
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('editing', () => {
    it('pre-fills every field from the play', async () => {
      await setup({ id: 'pl-2' });

      expect(query(fixture, 'h1').textContent).toContain('Edit Play');
      expect(gameSelect().value).toBe('g-azul');
      expect(query<HTMLInputElement>(fixture, '#played-at').value).toBe('2026-09-10');
      expect(chip('Who played', 'Sam').getAttribute('aria-pressed')).toBe('true');
      expect(chip('Who played', 'Jo').getAttribute('aria-pressed')).toBe('true');
      expect(chip('Who played', 'Alex').getAttribute('aria-pressed')).toBe('false');
      expect(chip('Who won', 'Sam').getAttribute('aria-pressed')).toBe('true');
      expect(query<HTMLInputElement>(fixture, '#duration-minutes').value).toBe('35');
      expect(text(fixture)).toContain('9 / 10');
      expect(query<HTMLTextAreaElement>(fixture, '#notes').value).toBe('Close one.');
      expect(submitButton().textContent).toContain('Save Changes');
      expect(queryAll<HTMLAnchorElement>(fixture, 'a').some(a => a.textContent?.trim() === 'Cancel')).toBe(true);
    });

    it('shows the head-count only when it exceeds the named players', async () => {
      await setup({ id: 'pl-2' }); // 2 named, playerCount 2 in fixture → blank
      expect(query<HTMLInputElement>(fixture, '#player-count').value).toBe('');

      fixture.destroy();
      TestBed.resetTestingModule();
      await setup({ id: 'pl-2' }, { plays: [{ ...SAMPLE_PLAYS[1], playerCount: 5 }] });
      expect(query<HTMLInputElement>(fixture, '#player-count').value).toBe('5');
    });

    it('saves changes in place, keeping the id', async () => {
      await setup({ id: 'pl-2' });
      chip('Who won', 'Sam').click();
      chip('Who won', 'Jo').click();
      setInputValue(query<HTMLInputElement>(fixture, '#duration-minutes'), '');
      await settle(fixture);
      submitButton().click();
      await settle(fixture);

      const saved = savedPlays()!;
      expect(saved.length).toBe(3);
      expect(saved[1]).toEqual({ ...SAMPLE_PLAYS[1], winnerIds: ['p-jo'], durationMinutes: undefined, playerCount: 2 });
      expect(router.navigate).toHaveBeenCalledWith(['/history']);
    });

    it('keeps a deleted game selectable with its snapshot title', async () => {
      await setup({ id: 'pl-1' }, { games: false });
      const options = queryAll<HTMLOptionElement>(fixture, '#game option').map(o => o.textContent?.trim());
      expect(options).toEqual(['Choose a game…', 'Catan (no longer in collection)']);
      expect(gameSelect().value).toBe('g-catan');

      submitButton().click();
      await settle(fixture);
      expect(savedPlays()![0].gameTitle).toBe('Catan');
    });

    it('keeps a removed player selectable with their snapshot name', async () => {
      await setup({ id: 'pl-1' }, { players: false });
      const players = queryAll(fixture, '[aria-label="Who played"] button').map(b => b.textContent?.replace(/\s+/g, ' ').trim());
      expect(players).toEqual(['Alex (removed)', 'Sam (removed)']);
      expect(chip('Who played', 'Alex').getAttribute('aria-pressed')).toBe('true');

      submitButton().click();
      await settle(fixture);
      expect(savedPlays()![0].players).toEqual(SAMPLE_PLAYS[0].players);
    });

    it('shows a not-found message for an unknown id', async () => {
      await setup({ id: 'missing' });
      expect(text(fixture)).toContain("That play isn't in your history any more.");
      expect(fixture.nativeElement.querySelector('form')).toBeNull();
    });
  });
});
