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

      http.expectOne('games.json').flush(SAMPLE_GAMES);

      expect(store.ready()).toBe(true);
      expect(store.games()).toEqual(SAMPLE_GAMES);
      expect(savedGames()).toEqual(SAMPLE_GAMES);
    });

    it('reports an error but still becomes ready when the seed cannot be loaded', () => {
      const store = TestBed.inject(GameStore);
      http.expectOne('games.json').flush('nope', { status: 500, statusText: 'Server Error' });

      expect(store.ready()).toBe(true);
      expect(store.games()).toEqual([]);
      expect(store.error()).toBe('Could not load the starter collection.');
    });

    it('splits the text ranges an older seed file carries', () => {
      const store = TestBed.inject(GameStore);
      http.expectOne('games.json').flush([{ id: 'g-old', title: 'Old', players: '2-4', duration: '30', complexity: 'Easy' }]);
      expect(store.games()).toEqual([
        { id: 'g-old', title: 'Old', minPlayers: 2, maxPlayers: 4, minPlaytime: 30, maxPlaytime: 30, complexity: 'Easy' },
      ]);
    });

    it('re-seeds when the saved value is corrupt', () => {
      localStorage.setItem(STORAGE_KEY, '{ not json');
      const store = TestBed.inject(GameStore);
      http.expectOne('games.json').flush(SAMPLE_GAMES);
      expect(store.games()).toEqual(SAMPLE_GAMES);
    });

    it('re-seeds when the saved value is not an array', () => {
      localStorage.setItem(STORAGE_KEY, '{"title":"Catan"}');
      const store = TestBed.inject(GameStore);
      http.expectOne('games.json').flush(SAMPLE_GAMES);
      expect(store.games()).toEqual(SAMPLE_GAMES);
    });
  });

  describe('upgrading saved data', () => {
    // Collections saved before the split hold "players" and "duration" as text.
    it('converts text ranges to numbers on load and saves the converted collection back', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          { id: 'g-catan', title: 'Catan', players: '3-4', duration: '60-120', complexity: 'Medium', rating: 7 },
          { id: 'g-party', title: 'Party', players: '4+', duration: 'varies', complexity: 'Easy' },
        ]),
      );
      const store = TestBed.inject(GameStore);

      const expected = [
        { id: 'g-catan', title: 'Catan', minPlayers: 3, maxPlayers: 4, minPlaytime: 60, maxPlaytime: 120, complexity: 'Medium', rating: 7 },
        { id: 'g-party', title: 'Party', minPlayers: 4, complexity: 'Easy' },
      ];
      expect(store.games()).toEqual(expected);
      expect(savedGames()).toEqual(expected);
    });

    it('converts an imported older file the same way', () => {
      seedStorage(SAMPLE_GAMES);
      const store = TestBed.inject(GameStore);
      store.replaceAll([{ title: 'Azul', players: '2-4', duration: '30-45', complexity: 'Easy' }]);
      expect(store.games()[0]).toEqual({
        id: expect.any(String),
        title: 'Azul',
        minPlayers: 2,
        maxPlayers: 4,
        minPlaytime: 30,
        maxPlaytime: 45,
        complexity: 'Easy',
      });
    });
  });

  describe('ids', () => {
    const { id: _drop, ...noId } = SAMPLE_GAMES[0];

    it('assigns ids to seed data that has none', () => {
      const store = TestBed.inject(GameStore);
      http.expectOne('games.json').flush([noId, { ...noId, title: 'Other' }]);

      const ids = store.games().map(g => g.id);
      expect(ids.every(id => typeof id === 'string' && id.length > 0)).toBe(true);
      expect(new Set(ids).size).toBe(2);
      expect(savedGames()![0].id).toBe(ids[0]);
    });

    it('assigns ids to a saved collection from before ids existed, and re-saves it', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([noId]));
      const store = TestBed.inject(GameStore);
      http.expectNone('games.json');

      expect(store.games()[0].id).toEqual(expect.any(String));
      expect(savedGames()![0].id).toBe(store.games()[0].id);
    });

    it('keeps ids across reloads', () => {
      seedStorage(SAMPLE_GAMES);
      const store = TestBed.inject(GameStore);
      expect(store.games().map(g => g.id)).toEqual(['g-catan', 'g-azul', 'g-gloom', 'g-tm']);
    });

    it('fills in missing ids on import and regenerates duplicates', () => {
      seedStorage([]);
      const store = TestBed.inject(GameStore);
      store.replaceAll([SAMPLE_GAMES[0], { ...SAMPLE_GAMES[1], id: 'g-catan' }, noId]);

      const ids = store.games().map(g => g.id);
      expect(ids[0]).toBe('g-catan');
      expect(ids[1]).not.toBe('g-catan');
      expect(ids[2]).toEqual(expect.any(String));
      expect(new Set(ids).size).toBe(3);
    });
  });

  describe('with a saved collection', () => {
    beforeEach(() => seedStorage(SAMPLE_GAMES));

    it('loads from localStorage without touching the network', () => {
      const store = TestBed.inject(GameStore);
      http.expectNone('games.json');
      expect(store.ready()).toBe(true);
      expect(store.games()).toEqual(SAMPLE_GAMES);
    });

    it('add() appends with a fresh id and persists', () => {
      const store = TestBed.inject(GameStore);
      const wingspan = { title: 'Wingspan', minPlayers: 1, maxPlayers: 5, minPlaytime: 40, maxPlaytime: 70, complexity: 'Medium', rating: 8 };
      const added = store.add(wingspan);

      expect(added).toEqual({ id: expect.any(String), ...wingspan });
      expect(SAMPLE_GAMES.map(g => g.id)).not.toContain(added.id);
      expect(store.games()).toEqual([...SAMPLE_GAMES, added]);
      expect(savedGames()).toEqual([...SAMPLE_GAMES, added]);
    });

    it('update() replaces the details of one game in place and persists', () => {
      const store = TestBed.inject(GameStore);
      store.update('g-gloom', { title: 'Gloomhaven', minPlayers: 1, maxPlayers: 4, minPlaytime: 90, maxPlaytime: 150, complexity: 'Hard', rating: 6 });

      const titles = store.games().map(g => g.title);
      expect(titles).toEqual(['Catan', 'Azul', 'Gloomhaven', 'Terraforming Mars']);
      expect(store.find('g-gloom')).toEqual({
        id: 'g-gloom', title: 'Gloomhaven', minPlayers: 1, maxPlayers: 4, minPlaytime: 90, maxPlaytime: 150, complexity: 'Hard', rating: 6,
      });
      expect(savedGames()![2].rating).toBe(6);
    });

    it('update() with an unknown id changes nothing', () => {
      const store = TestBed.inject(GameStore);
      store.update('nope', { title: 'X', minPlayers: 1, maxPlayers: 1, minPlaytime: 1, maxPlaytime: 1, complexity: 'Easy' });
      expect(store.games()).toEqual(SAMPLE_GAMES);
    });

    it('remove() drops one game by id and persists', () => {
      const store = TestBed.inject(GameStore);
      store.remove('g-azul');

      expect(store.games().map(g => g.id)).toEqual(['g-catan', 'g-gloom', 'g-tm']);
      expect(savedGames()!.map(g => g.id)).toEqual(['g-catan', 'g-gloom', 'g-tm']);
      expect(store.find('g-azul')).toBeUndefined();
    });

    it('remove() with an unknown id changes nothing', () => {
      const store = TestBed.inject(GameStore);
      store.remove('nope');
      expect(store.games()).toEqual(SAMPLE_GAMES);
    });

    it('indexOf() and restore() put a removed game back where it was', () => {
      const store = TestBed.inject(GameStore);
      const index = store.indexOf('g-azul');
      const game = store.find('g-azul')!;
      expect(index).toBe(1);

      store.remove('g-azul');
      store.restore(game, index);

      expect(store.games().map(g => g.id)).toEqual(['g-catan', 'g-azul', 'g-gloom', 'g-tm']);
      expect(savedGames()!.map(g => g.id)).toEqual(['g-catan', 'g-azul', 'g-gloom', 'g-tm']);
    });

    it('find() looks a game up by id', () => {
      const store = TestBed.inject(GameStore);
      expect(store.find('g-azul')?.title).toBe('Azul');
      expect(store.find('missing')).toBeUndefined();
    });

    it('hasTitle() ignores case and surrounding whitespace, and can exclude one game', () => {
      const store = TestBed.inject(GameStore);
      expect(store.hasTitle('Catan')).toBe(true);
      expect(store.hasTitle('  catan ')).toBe(true);
      expect(store.hasTitle('CATAN', 'g-catan')).toBe(false);
      expect(store.hasTitle('CATAN', 'g-azul')).toBe(true);
      expect(store.hasTitle('Cascadia')).toBe(false);
    });

    it('replaceAll() overwrites and persists, keeping ids the file provides', () => {
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
