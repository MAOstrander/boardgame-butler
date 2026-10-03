import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLAYERS_STORAGE_KEY, PlayerStore } from './player-store';
import { SAMPLE_PLAYERS, savedPlayers, seedPlayers } from '../testing/helpers';

describe('PlayerStore', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('first run', () => {
    it('seeds from players.json when nothing is saved and persists the result', () => {
      const store = TestBed.inject(PlayerStore);
      expect(store.ready()).toBe(false);

      http.expectOne('players.json').flush(SAMPLE_PLAYERS);

      expect(store.ready()).toBe(true);
      expect(store.players()).toEqual(SAMPLE_PLAYERS);
      expect(savedPlayers()).toEqual(SAMPLE_PLAYERS);
    });

    it('assigns ids to seed players that lack them', () => {
      const store = TestBed.inject(PlayerStore);
      http.expectOne('players.json').flush([{ name: 'Sam' }, { name: 'Alex' }]);

      const ids = store.players().map(p => p.id);
      expect(ids.every(id => typeof id === 'string' && id.length > 0)).toBe(true);
      expect(new Set(ids).size).toBe(2);
    });

    it('reports an error but still becomes ready when the seed cannot be loaded', () => {
      const store = TestBed.inject(PlayerStore);
      http.expectOne('players.json').flush('nope', { status: 500, statusText: 'Server Error' });

      expect(store.ready()).toBe(true);
      expect(store.players()).toEqual([]);
      expect(store.error()).toBe('Could not load the starter players.');
    });

    it('treats an empty saved list as a decision, not a missing one', () => {
      seedPlayers([]);
      const store = TestBed.inject(PlayerStore);
      http.expectNone('players.json');
      expect(store.players()).toEqual([]);
      expect(store.ready()).toBe(true);
    });
  });

  it('loads saved players without touching the network', () => {
    seedPlayers(SAMPLE_PLAYERS);
    const store = TestBed.inject(PlayerStore);
    http.expectNone('players.json');
    expect(store.players()).toEqual(SAMPLE_PLAYERS);
    expect(store.ready()).toBe(true);
  });

  it('assigns ids to saved players that lack them', () => {
    localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify([{ name: 'Sam' }]));
    const store = TestBed.inject(PlayerStore);
    expect(store.players()[0]).toEqual({ id: expect.any(String), name: 'Sam' });
  });

  it('re-seeds when the saved value is corrupt or not an array', () => {
    localStorage.setItem(PLAYERS_STORAGE_KEY, '{ nope');
    const store = TestBed.inject(PlayerStore);
    http.expectOne('players.json').flush(SAMPLE_PLAYERS);
    expect(store.players()).toEqual(SAMPLE_PLAYERS);
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
