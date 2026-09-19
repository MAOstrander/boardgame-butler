import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Stats } from './stats';
import { Game } from '../game';
import { Play } from '../play';
import { Player } from '../player';
import {
  SAMPLE_GAMES,
  SAMPLE_PLAYERS,
  SAMPLE_PLAYS,
  cellText,
  findByText,
  query,
  queryAll,
  seedPlayers,
  seedPlays,
  seedStorage,
  settle,
  text,
} from '../../testing/helpers';

describe('Stats', () => {
  let fixture: ComponentFixture<Stats>;
  let http: HttpTestingController;

  async function setup(opts: { games?: Game[]; players?: Player[]; plays?: Play[] } = {}) {
    localStorage.clear();
    seedStorage(opts.games ?? SAMPLE_GAMES);
    seedPlayers(opts.players ?? SAMPLE_PLAYERS);
    seedPlays(opts.plays ?? SAMPLE_PLAYS);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12, 0)); // 18 Sep 2026 local

    await TestBed.configureTestingModule({
      imports: [Stats],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Stats);
    await settle(fixture);
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.useRealTimers();
  });

  const tile = (name: string) => query(fixture, `[data-testid="tile-${name}"]`).textContent?.replace(/\s+/g, ' ').trim();
  const gameRows = () => queryAll(fixture, '[data-testid="games-table"] tr').map(cellText);
  const playerRows = () => queryAll(fixture, '[data-testid="players-table"] tr').map(cellText);

  it('shows an empty state with a log link when nothing is logged', async () => {
    await setup({ plays: [] });
    expect(text(fixture)).toContain('No plays logged yet');
    expect(findByText<HTMLAnchorElement>(fixture, 'a', 'Log your first play').getAttribute('href')).toBe('/log-play');
    expect(fixture.nativeElement.querySelector('[data-testid="tile-plays"]')).toBeNull();
  });

  it('shows the overview tiles', async () => {
    await setup();
    expect(tile('plays')).toBe('3');
    expect(text(fixture)).toContain('3 in the last 30 days');
    expect(tile('games')).toBe('2 / 4');
    expect(text(fixture)).toContain('2 never played');
    expect(tile('hours')).toBe('2.1'); // 125 min
    expect(tile('most')).toBe('Catan');
    expect(text(fixture)).toContain('2 plays');
  });

  it('rounds hours once past ten', async () => {
    const plays = Array.from({ length: 12 }, (_, i) => ({ ...SAMPLE_PLAYS[0], id: `p${i}`, durationMinutes: 60 }));
    await setup({ plays });
    expect(tile('hours')).toBe('12');
  });

  it('lists played games most-played first with their stats', async () => {
    await setup();
    const rows = gameRows();
    expect(rows.length).toBe(2);
    expect(rows[0]).toMatch(/^Catan 2 2\.5 2p ×1 · 90 min, 3p ×1 .*2026 90 min in range 7\/10$/);
    expect(rows[1]).toMatch(/^Azul 1 2 .*2026 35 min in range 9\/10$/);
  });

  it('flags average time outside the listed range', async () => {
    const plays = [
      { ...SAMPLE_PLAYS[0], id: 'a', durationMinutes: 150 }, // Catan listed 60-120
      { ...SAMPLE_PLAYS[1], id: 'b', durationMinutes: 20 },  // Azul listed 30-45
    ];
    await setup({ plays });
    const rows = gameRows();
    expect(rows.find(r => r.startsWith('Azul'))).toContain('20 min 10 min under');
    expect(rows.find(r => r.startsWith('Catan'))).toContain('150 min +30 min over');
  });

  it('shows dashes for games with no recorded duration or fun', async () => {
    await setup({ plays: [SAMPLE_PLAYS[2]] });
    expect(gameRows()[0]).toMatch(/^Catan 1 3 .*2026 — —$/);
  });

  it('shows average players with a duration breakdown only when head-counts vary', async () => {
    const plays = [
      { ...SAMPLE_PLAYS[0], id: 'a', playerCount: 3, durationMinutes: 60 },
      { ...SAMPLE_PLAYS[0], id: 'b', playerCount: 4, durationMinutes: 100 },
      { ...SAMPLE_PLAYS[1], id: 'c', playerCount: 2, durationMinutes: 30 },
      { ...SAMPLE_PLAYS[1], id: 'd', playerCount: 2, durationMinutes: 40 },
    ];
    await setup({ plays });
    const cells = queryAll(fixture, '[data-testid="players-cell"]').map(c => c.textContent?.replace(/\s+/g, ' ').trim());
    // Both have 2 plays, so Azul sorts first alphabetically.
    expect(cells[0]).toBe('2');                                     // Azul: always 2 → no breakdown
    expect(cells[1]).toBe('3.5 3p ×1 · 60 min, 4p ×1 · 100 min'); // Catan: varies → breakdown
  });

  it('shows a dash for players when no head-count is known', async () => {
    await setup({ plays: [{ ...SAMPLE_PLAYS[0], players: [], winnerIds: [] }] });
    expect(query(fixture, '[data-testid="players-cell"]').textContent?.trim()).toBe('—');
  });

  it('lists never-played games as links to log them', async () => {
    await setup();
    const links = queryAll<HTMLAnchorElement>(fixture, '[data-testid="never-played"] a');
    expect(links.map(a => a.textContent?.trim())).toEqual(['Gloomhaven', 'Terraforming Mars']);
    expect(links[0].getAttribute('href')).toBe('/log-play?game=g-gloom');
    expect(text(fixture)).toContain('Never played (2)');
  });

  it('hides the never-played list when everything has been played', async () => {
    await setup({ games: [SAMPLE_GAMES[0], SAMPLE_GAMES[1]] });
    expect(fixture.nativeElement.querySelector('[data-testid="never-played"]')).toBeNull();
  });

  it('labels plays of a game no longer in the collection', async () => {
    await setup({ games: SAMPLE_GAMES.filter(g => g.id !== 'g-azul') });
    expect(gameRows().find(r => r.startsWith('Azul'))).toContain('(no longer in collection)');
  });

  it('lists players with plays, wins, win rate, most played and last played', async () => {
    await setup();
    const rows = playerRows();
    expect(rows[0]).toMatch(/^Sam 3 1 50% Catan ×2 .*2026$/);
    expect(rows[1]).toMatch(/^Alex 2 1 100% Catan ×2 .*2026$/);
    expect(rows[2]).toMatch(/^Jo 2 0 0% Azul ×1 .*2026$/);
    expect(text(fixture)).toContain('Win rate counts only plays where a winner was recorded.');
  });

  it('shows a dash win rate and dims players with no plays', async () => {
    await setup({ players: [...SAMPLE_PLAYERS, { id: 'p-new', name: 'Riley' }] });
    const riley = queryAll(fixture, '[data-testid="players-table"] tr').find(tr => tr.textContent?.includes('Riley'))!;
    expect(cellText(riley)).toBe('Riley 0 0 — — —');
    expect(riley.className).toContain('opacity-60');
  });

  it('labels removed players', async () => {
    await setup({ players: SAMPLE_PLAYERS.filter(p => p.id !== 'p-jo') });
    expect(playerRows().find(r => r.startsWith('Jo'))).toContain('(removed)');
  });

  it('points to the Players page when no play has any players', async () => {
    await setup({ players: [], plays: [{ ...SAMPLE_PLAYS[0], players: [], winnerIds: [] }] });
    expect(text(fixture)).toContain('No players recorded on any play yet.');
    expect(fixture.nativeElement.querySelector('[data-testid="players-table"]')).toBeNull();
  });

  it('links back home and to history and the collection', async () => {
    await setup();
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/history', '/collection']));
  });
});
