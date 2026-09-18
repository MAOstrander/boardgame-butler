import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GameStore, STORAGE_KEY } from './game-store';
import { SAMPLE_GAMES, savedGames, seedStorage } from '../testing/helpers';

describe('GameStore', () => {
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
    it('seeds from games.json when nothing is saved and persists the result', () => {
      const store = TestBed.inject(GameStore);
      expect(store.ready()).toBe(false);
      expect(store.games()).toEqual([]);

      http.expectOne('/games.json').flush(SAMPLE_GAMES);

      expect(store.ready()).toBe(true);
      expect(store.games()).toEqual(SAMPLE_GAMES);
      expect(savedGames()).toEqual(SAMPLE_GAMES);
    });

    it('reports an error but still becomes ready when the seed cannot be loaded', () => {
      const store = TestBed.inject(GameStore);
      http.expectOne('/games.json').flush('nope', { status: 500, statusText: 'Server Error' });

      expect(store.ready()).toBe(true);
      expect(store.games()).toEqual([]);
      expect(store.error()).toBe('Could not load the starter collection.');
    });

    it('re-seeds when the saved value is corrupt', () => {
      localStorage.setItem(STORAGE_KEY, '{ not json');
      const store = TestBed.inject(GameStore);
      http.expectOne('/games.json').flush(SAMPLE_GAMES);
      expect(store.games()).toEqual(SAMPLE_GAMES);
    });

    it('re-seeds when the saved value is not an array', () => {
      localStorage.setItem(STORAGE_KEY, '{"title":"Catan"}');
      const store = TestBed.inject(GameStore);
      http.expectOne('/games.json').flush(SAMPLE_GAMES);
      expect(store.games()).toEqual(SAMPLE_GAMES);
    });
  });

  describe('with a saved collection', () => {
    beforeEach(() => seedStorage(SAMPLE_GAMES));

    it('loads from localStorage without touching the network', () => {
      const store = TestBed.inject(GameStore);
      http.expectNone('/games.json');
      expect(store.ready()).toBe(true);
      expect(store.games()).toEqual(SAMPLE_GAMES);
    });

    it('add() appends and persists', () => {
      const store = TestBed.inject(GameStore);
      const wingspan = { title: 'Wingspan', players: '1-5', duration: '40-70', complexity: 'Medium', rating: 8 };
      store.add(wingspan);

      expect(store.games()).toEqual([...SAMPLE_GAMES, wingspan]);
      expect(savedGames()).toEqual([...SAMPLE_GAMES, wingspan]);
    });

    it('replaceAll() overwrites and persists', () => {
      const store = TestBed.inject(GameStore);
      store.replaceAll([SAMPLE_GAMES[0]]);

      expect(store.games()).toEqual([SAMPLE_GAMES[0]]);
      expect(savedGames()).toEqual([SAMPLE_GAMES[0]]);
    });

    it('toJson() pretty-prints the collection', () => {
      const store = TestBed.inject(GameStore);
      expect(store.toJson()).toBe(JSON.stringify(SAMPLE_GAMES, null, 2));
    });

    it('surfaces an error when storage rejects the write, but keeps the in-memory change', () => {
      const store = TestBed.inject(GameStore);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });

      store.add(SAMPLE_GAMES[0]);

      expect(store.error()).toBe('Could not save your collection to this device.');
      expect(store.games().length).toBe(SAMPLE_GAMES.length + 1);
    });
  });
});
