import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PlayerPicks } from './player-picks';
import { Play } from '../../play';
import { findByText, query, queryAll, seedPlayers, seedPlays, setInputValue, settle, text } from '../../../testing/helpers';

const PLAYERS = [
  { id: 'p-sam', name: 'Sam' },
  { id: 'p-alex', name: 'Alex' },
  { id: 'p-jo', name: 'Jo' },
  { id: 'p-riley', name: 'Riley' },
];

const LAST_PLAY: Play = {
  id: 'pl-1',
  gameId: 'g-catan',
  gameTitle: 'Catan',
  playedAt: '2026-09-01',
  players: [{ id: 'p-sam', name: 'Sam' }, { id: 'p-jo', name: 'Jo' }],
  winnerIds: [],
};

describe('PlayerPicks', () => {
  let fixture: ComponentFixture<PlayerPicks>;

  async function setup(players = PLAYERS, plays: Play[] = [LAST_PLAY]) {
    seedPlayers(players);
    seedPlays(plays);
    await TestBed.configureTestingModule({
      imports: [PlayerPicks],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(PlayerPicks);
    await settle(fixture);
  }

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const button = (label: string) => findByText<HTMLButtonElement>(fixture, 'button', label);
  const chip = (name: string) => findByText<HTMLButtonElement>(fixture, '[aria-label="Who\'s playing"] button', name);
  const result = () => query(fixture, '[data-testid="pick-result"]');

  async function click(label: string) {
    button(label).click();
    await settle(fixture);
  }

  async function addGuest(name: string) {
    setInputValue(query<HTMLInputElement>(fixture, '#guest-name'), name);
    await settle(fixture);
    query<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  describe('line-up', () => {
    it('pre-selects the people from the last play, alphabetically, and says so', async () => {
      await setup();
      const chips = queryAll(fixture, '[aria-label="Who\'s playing"] button');
      expect(chips.map(c => c.textContent?.trim())).toEqual(['Alex', 'Jo', 'Riley', 'Sam']);
      expect(chip('Sam').getAttribute('aria-pressed')).toBe('true');
      expect(chip('Jo').getAttribute('aria-pressed')).toBe('true');
      expect(chip('Alex').getAttribute('aria-pressed')).toBe('false');
      expect(text(fixture)).toContain('Carried over from your last play.');
    });

    it('drops the carried-over note once the selection changes', async () => {
      await setup();
      chip('Alex').click();
      await settle(fixture);
      expect(chip('Alex').getAttribute('aria-pressed')).toBe('true');
      expect(text(fixture)).not.toContain('Carried over');
    });

    it('Clear empties the table and disables the actions', async () => {
      await setup();
      await click('Clear');
      expect(chip('Sam').getAttribute('aria-pressed')).toBe('false');
      expect(button('Pick first player').disabled).toBe(true);
      expect(button('Shuffle turn order').disabled).toBe(true);
      expect(button('Split into 2 teams').disabled).toBe(true);
      expect(text(fixture)).toContain('Choose at least two people.');
    });

    it('points at the Players page when there are no players', async () => {
      await setup([], []);
      expect(query<HTMLAnchorElement>(fixture, 'a[href="/players"]')).toBeTruthy();
      expect(button('Pick first player').disabled).toBe(true);
    });
  });

  describe('guests', () => {
    it('adds a guest as a removable chip and clears the box', async () => {
      await setup();
      await addGuest('Pat');
      const guests = queryAll(fixture, '[aria-label="Guests"] li');
      expect(guests.map(g => g.textContent)).toEqual([expect.stringContaining('Pat')]);
      expect(query<HTMLInputElement>(fixture, '#guest-name').value).toBe('');

      query<HTMLButtonElement>(fixture, '[aria-label="Remove Pat"]').click();
      await settle(fixture);
      expect(fixture.nativeElement.querySelector('[aria-label="Guests"]')).toBeNull();
    });

    it('disables Add guest until a name is typed', async () => {
      await setup();
      expect(button('Add guest').disabled).toBe(true);
      setInputValue(query<HTMLInputElement>(fixture, '#guest-name'), 'Pat');
      await settle(fixture);
      expect(button('Add guest').disabled).toBe(false);
    });

    it('shows why a duplicate was refused, and keeps what was typed', async () => {
      await setup();
      await addGuest('sam');
      expect(text(fixture)).toContain('Sam is already at the table.');
      expect(query<HTMLInputElement>(fixture, '#guest-name').value).toBe('sam');
    });

    it('lets two guests make a table with no saved players', async () => {
      await setup([], []);
      await addGuest('Pat');
      await addGuest('Kim');
      expect(button('Pick first player').disabled).toBe(false);
    });
  });

  describe('picks', () => {
    it('picks a first player from everyone at the table, guests included', async () => {
      await setup();
      await addGuest('Pat');
      vi.spyOn(Math, 'random').mockReturnValue(0.999);
      await click('Pick first player');
      expect(result().textContent).toContain('Going first');
      expect(result().textContent).toContain('Pat');
    });

    it('shuffles a numbered turn order with everyone in it once', async () => {
      await setup();
      chip('Alex').click();
      await settle(fixture);
      await click('Shuffle turn order');
      const order = queryAll(fixture, '[data-testid="pick-result"] ol li').map(li => li.textContent?.replace(/\s+/g, ' ').trim());
      expect(order.length).toBe(3);
      expect(order.map(o => o?.replace(/^\d+ /, '')).sort()).toEqual(['Alex', 'Jo', 'Sam']);
      expect(order.map(o => o?.split(' ')[0])).toEqual(['1', '2', '3']);
    });

    it('splits into the chosen number of teams', async () => {
      await setup();
      chip('Alex').click();
      chip('Riley').click();
      await settle(fixture);
      await addGuest('Pat');
      await addGuest('Kim');

      await click('+');
      expect(query(fixture, '[data-testid="team-count"]').textContent?.trim()).toBe('3');
      await click('Split into 3 teams');

      const teams = queryAll(fixture, '[data-testid="team"]');
      expect(teams.map(t => t.querySelector('p')?.textContent?.trim())).toEqual(['Team 1', 'Team 2', 'Team 3']);
      const sizes = teams.map(t => t.querySelectorAll('li').length).sort();
      expect(sizes).toEqual([2, 2, 2]);
    });

    it('never offers more teams than people', async () => {
      await setup();
      // Sam and Jo: two people, two teams at most.
      const more = query<HTMLButtonElement>(fixture, '[aria-label="More teams"]');
      const fewer = query<HTMLButtonElement>(fixture, '[aria-label="Fewer teams"]');
      expect(more.disabled).toBe(true);
      expect(fewer.disabled).toBe(true);

      chip('Alex').click();
      chip('Riley').click();
      await settle(fixture);
      await click('+');
      await click('+');
      expect(query(fixture, '[data-testid="team-count"]').textContent?.trim()).toBe('4');

      chip('Alex').click();
      await settle(fixture);
      expect(query(fixture, '[data-testid="team-count"]').textContent?.trim()).toBe('3');
      expect(button('Split into 3 teams')).toBeTruthy();
    });

    it('hides a result once the line-up changes, since it no longer applies', async () => {
      await setup();
      await click('Pick first player');
      expect(result().textContent).toContain('Going first');

      chip('Alex').click();
      await settle(fixture);
      expect(result().textContent?.trim()).toBe('');
    });

    it('a new pick replaces the last result', async () => {
      await setup();
      await click('Pick first player');
      await click('Shuffle turn order');
      expect(result().textContent).toContain('Turn order');
      expect(result().textContent).not.toContain('Going first');
    });
  });
});
