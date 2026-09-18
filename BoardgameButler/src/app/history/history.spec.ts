import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { History } from './history';
import { SAMPLE_PLAYS, findByText, query, queryAll, savedPlays, seedPlays, settle, text } from '../../testing/helpers';

describe('History', () => {
  let fixture: ComponentFixture<History>;

  async function setup(plays = SAMPLE_PLAYS) {
    localStorage.clear();
    seedPlays(plays);
    await TestBed.configureTestingModule({
      imports: [History],
      providers: [provideRouter([])],
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

  it('links back home and to the collection and players pages', async () => {
    await setup();
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/collection', '/players']));
  });
});
