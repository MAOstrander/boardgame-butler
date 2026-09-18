import { TestBed } from '@angular/core/testing';
import { PLAYERS_STORAGE_KEY, PlayerStore } from './player-store';
import { SAMPLE_PLAYERS, savedPlayers, seedPlayers } from '../testing/helpers';

describe('PlayerStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts empty when nothing is saved', () => {
    const store = TestBed.inject(PlayerStore);
    expect(store.players()).toEqual([]);
    expect(store.error()).toBeNull();
  });

  it('loads saved players', () => {
    seedPlayers(SAMPLE_PLAYERS);
    expect(TestBed.inject(PlayerStore).players()).toEqual(SAMPLE_PLAYERS);
  });

  it('assigns ids to saved players that lack them', () => {
    localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify([{ name: 'Sam' }]));
    const store = TestBed.inject(PlayerStore);
    expect(store.players()[0]).toEqual({ id: expect.any(String), name: 'Sam' });
  });

  it('ignores corrupt or non-array saved data', () => {
    localStorage.setItem(PLAYERS_STORAGE_KEY, '{ nope');
    expect(TestBed.inject(PlayerStore).players()).toEqual([]);
  });

  describe('with players', () => {
    beforeEach(() => seedPlayers(SAMPLE_PLAYERS));

    it('add() trims the name, assigns an id and persists', () => {
      const store = TestBed.inject(PlayerStore);
      const added = store.add('  Riley ');

      expect(added).toEqual({ id: expect.any(String), name: 'Riley' });
      expect(store.players()).toEqual([...SAMPLE_PLAYERS, added]);
      expect(savedPlayers()).toEqual([...SAMPLE_PLAYERS, added]);
    });

    it('rename() changes one player in place and persists', () => {
      const store = TestBed.inject(PlayerStore);
      store.rename('p-jo', ' Joanna ');

      expect(store.find('p-jo')).toEqual({ id: 'p-jo', name: 'Joanna' });
      expect(savedPlayers()![2].name).toBe('Joanna');
      expect(store.players().length).toBe(3);
    });

    it('remove() drops one player and persists', () => {
      const store = TestBed.inject(PlayerStore);
      store.remove('p-alex');
      expect(store.players().map(p => p.id)).toEqual(['p-sam', 'p-jo']);
      expect(savedPlayers()!.map(p => p.id)).toEqual(['p-sam', 'p-jo']);
    });

    it('replaceAll() overwrites, filling in missing ids', () => {
      const store = TestBed.inject(PlayerStore);
      store.replaceAll([{ name: 'New' }, SAMPLE_PLAYERS[0]]);
      expect(store.players()).toEqual([{ id: expect.any(String), name: 'New' }, SAMPLE_PLAYERS[0]]);
    });

    it('hasName() ignores case and whitespace, and can exclude one player', () => {
      const store = TestBed.inject(PlayerStore);
      expect(store.hasName('sam')).toBe(true);
      expect(store.hasName('  SAM ')).toBe(true);
      expect(store.hasName('sam', 'p-sam')).toBe(false);
      expect(store.hasName('sam', 'p-jo')).toBe(true);
      expect(store.hasName('Riley')).toBe(false);
    });

    it('surfaces an error when storage rejects the write', () => {
      const store = TestBed.inject(PlayerStore);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
      store.add('Riley');
      expect(store.error()).toBe('Could not save your players to this device.');
      expect(store.players().length).toBe(4);
    });
  });
});
