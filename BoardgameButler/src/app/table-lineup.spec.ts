import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TableLineupService } from './table-lineup';
import { PlayerStore } from './player-store';
import { Play } from './play';
import { seedPlayers, seedPlays } from '../testing/helpers';

const PLAYERS = [
  { id: 'p-sam', name: 'Sam' },
  { id: 'p-alex', name: 'Alex' },
  { id: 'p-jo', name: 'Jo' },
  { id: 'p-riley', name: 'Riley' },
];

function play(id: string, playedAt: string, ids: string[]): Play {
  return {
    id,
    gameId: 'g-catan',
    gameTitle: 'Catan',
    playedAt,
    players: ids.map(pid => ({ id: pid, name: PLAYERS.find(p => p.id === pid)?.name ?? 'Gone' })),
    winnerIds: [],
  };
}

describe('TableLineupService', () => {
  function setup(plays: Play[] = [play('pl-1', '2026-09-01', ['p-sam', 'p-jo'])]) {
    seedPlayers(PLAYERS);
    seedPlays(plays);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return TestBed.inject(TableLineupService);
  }

  afterEach(() => localStorage.clear());

  it('lists every player alphabetically', () => {
    const lineup = setup();
    expect(lineup.choices().map(p => p.name)).toEqual(['Alex', 'Jo', 'Riley', 'Sam']);
  });

  it('starts with the line-up of the most recent play', () => {
    const lineup = setup([
      play('pl-old', '2026-08-01', ['p-alex', 'p-riley']),
      play('pl-new', '2026-09-01', ['p-sam', 'p-jo']),
    ]);
    expect(lineup.names()).toEqual(['Jo', 'Sam']);
    expect(lineup.carriedOver()).toBe(true);
  });

  it('starts empty, and not carried over, with no plays logged', () => {
    const lineup = setup([]);
    expect(lineup.names()).toEqual([]);
    expect(lineup.carriedOver()).toBe(false);
  });

  it('leaves out anyone since removed from the Players list', () => {
    const lineup = setup([play('pl-1', '2026-09-01', ['p-sam', 'p-gone'])]);
    expect(lineup.selectedIds()).toEqual(['p-sam']);
    TestBed.inject(PlayerStore).remove('p-sam');
    expect(lineup.names()).toEqual([]);
  });

  it('toggles players in and out, and stops being carried over', () => {
    const lineup = setup();
    lineup.toggle('p-alex');
    expect(lineup.names()).toEqual(['Alex', 'Jo', 'Sam']);
    expect(lineup.carriedOver()).toBe(false);

    lineup.toggle('p-sam');
    expect(lineup.names()).toEqual(['Alex', 'Jo']);
    expect(lineup.isSelected('p-sam')).toBe(false);
  });

  describe('guests', () => {
    it('adds trimmed guests after the players, in the order added', () => {
      const lineup = setup();
      expect(lineup.addGuest('  Pat ')).toBeNull();
      expect(lineup.addGuest('Kim')).toBeNull();
      expect(lineup.names()).toEqual(['Jo', 'Sam', 'Pat', 'Kim']);
    });

    it('refuses an empty name or a guest already there', () => {
      const lineup = setup();
      lineup.addGuest('Pat');
      expect(lineup.addGuest('   ')).toBe('Enter a name.');
      expect(lineup.addGuest('pat')).toBe('Pat is already at the table.');
      expect(lineup.guests()).toEqual(['Pat']);
    });

    it('selects a saved player instead of adding them as a guest', () => {
      const lineup = setup();
      expect(lineup.addGuest('riley')).toBeNull();
      expect(lineup.isSelected('p-riley')).toBe(true);
      expect(lineup.guests()).toEqual([]);
      expect(lineup.addGuest('SAM')).toBe('Sam is already at the table.');
    });

    it('removes a guest', () => {
      const lineup = setup();
      lineup.addGuest('Pat');
      lineup.addGuest('Kim');
      lineup.removeGuest('Pat');
      expect(lineup.guests()).toEqual(['Kim']);
    });

    it('are never saved', () => {
      const lineup = setup();
      lineup.addGuest('Pat');
      expect(JSON.stringify({ ...localStorage })).not.toContain('Pat');
    });
  });

  it('clear() empties the table, guests included', () => {
    const lineup = setup();
    lineup.addGuest('Pat');
    lineup.clear();
    expect(lineup.names()).toEqual([]);
    expect(lineup.carriedOver()).toBe(false);
  });
});
