import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { History } from './history';
import { SAMPLE_PLAYS, findByText, query, queryAll, savedPlays, seedPlays, settle, text } from '../../testing/helpers';

describe('History', () => {
  let fixture: ComponentFixture<History>;

  async function setup(plays = SAMPLE_PLAYS) {
    localStorage.clear();
    seedPlays(plays);
    await TestBed.configureTestingModule({
      imports: [History],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(History);
    await settle(fixture);
  }

  afterEach(() => localStorage.clear());

  const cards = () => queryAll(fixture, 'ul > li');
  const titles = () => cards().map(li => li.querySelector('h2')?.textContent?.trim());

  it('shows an empty state with a log link', async () => {
    await setup([]);
    expect(text(fixture)).toContain('Nothing logged yet.');
    expect(text(fixture)).toContain('Log a play after your next game night');
    expect(findByText<HTMLAnchorElement>(fixture, 'a', 'Log a play').getAttribute('href')).toBe('/log-play');
  });

  it('shows a loading line instead of the empty state while seeding', async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [History],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(History);
    await settle(fixture);

    expect(text(fixture)).toContain('Loading history...');
    expect(text(fixture)).not.toContain('Nothing logged yet.');

    http.expectOne('plays.json').flush([]);
    await settle(fixture);
    expect(text(fixture)).toContain('Nothing logged yet.');
    http.verify();
  });

  it('lists plays newest first with a count', async () => {
    await setup();
    expect(text(fixture)).toContain('3 plays logged, newest first.');
    expect(titles()).toEqual(['Catan', 'Azul', 'Catan']);
  });

  it('shows date, winners, other players, duration, fun rating and notes', async () => {
    await setup();
    const azul = cards()[1];
    const t = azul.textContent?.replace(/\s+/g, ' ') ?? '';

    expect(t).toMatch(/Sep\S* 10, 2026|10 Sep\S* 2026/); // locale-dependent order
    expect(t).toContain('🏆 Sam');
    expect(t).toContain('Jo');
    expect(t).toContain('35 min');
    expect(t).toContain('fun 9/10');
    expect(t).toContain('Close one.');
  });

  it('handles a play with no winner and no optional fields', async () => {
    await setup();
    const t = cards()[0].textContent?.replace(/\s+/g, ' ') ?? '';
    expect(t).not.toContain('🏆');
    expect(t).toContain('Sam, Alex, Jo');
    expect(t).not.toContain('min');
    expect(t).not.toContain('fun');
  });

  it('notes when no players were recorded', async () => {
    await setup([{ ...SAMPLE_PLAYS[2], players: [], winnerIds: [] }]);
    expect(text(fixture)).toContain('no players recorded');
  });

  it('shows the head-count when it exceeds the named players', async () => {
    await setup([
      { ...SAMPLE_PLAYS[1], id: 'a', playedAt: '2026-09-12', playerCount: 4 }, // 2 named, 4 played
      { ...SAMPLE_PLAYS[1], id: 'b', playedAt: '2026-09-11', playerCount: 2 }, // matches the names → no chip
      { ...SAMPLE_PLAYS[2], id: 'c', playedAt: '2026-09-10', players: [], winnerIds: [], playerCount: 3 },
    ]);
    const texts = cards().map(c => c.textContent?.replace(/\s+/g, ' ') ?? '');
    expect(texts[0]).toContain('4 players');
    expect(texts[1]).not.toContain('players');
    expect(texts[2]).toContain('3 players');
    expect(texts[2]).not.toContain('no players recorded');
  });

  it('links each play to its edit form', async () => {
    await setup();
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a[aria-label^="Edit play"]').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['/log-play/pl-3', '/log-play/pl-2', '/log-play/pl-1']);
  });

  describe('deleting', () => {
    it('asks for confirmation and Keep backs out', async () => {
      await setup();
      query<HTMLButtonElement>(fixture, 'button[aria-label="Delete play of Azul"]').click();
      await settle(fixture);
      expect(text(fixture)).toContain('Delete this play of Azul?');

      findByText<HTMLButtonElement>(fixture, 'button', 'Keep').click();
      await settle(fixture);
      expect(text(fixture)).not.toContain('Delete this play of Azul?');
      expect(savedPlays()).toEqual(SAMPLE_PLAYS);
    });

    it('confirming removes the play', async () => {
      await setup();
      query<HTMLButtonElement>(fixture, 'button[aria-label="Delete play of Azul"]').click();
      await settle(fixture);
      findByText<HTMLButtonElement>(fixture, 'button', 'Yes, delete').click();
      await settle(fixture);

      expect(titles()).toEqual(['Catan', 'Catan']);
      expect(savedPlays()!.map(p => p.id)).toEqual(['pl-1', 'pl-3']);
      expect(text(fixture)).toContain('2 plays logged');
    });
  });

  it('links back home and to the collection, players and stats pages', async () => {
    await setup();
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/collection', '/players', '/stats']));
  });
});
