import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLAYS_STORAGE_KEY, PlayStore } from './play-store';
import { PlayDetails, SeedPlay } from './play';
import { shiftDate, todayIso } from './stats';
import { SAMPLE_PLAYS, savedPlays, seedPlays } from '../testing/helpers';

const details: PlayDetails = {
  gameId: 'g-azul',
  gameTitle: 'Azul',
  playedAt: '2026-09-18',
  players: [{ id: 'p-sam', name: 'Sam' }],
  winnerIds: ['p-sam'],
  durationMinutes: 40,
  funRating: 8,
};

describe('PlayStore', () => {
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
    const seedPlay: SeedPlay = {
      id: 'seed-1',
      gameId: 'g-azul',
      gameTitle: 'Azul',
      daysAgo: 3,
      players: [{ id: 'p-sam', name: 'Sam' }],
      winnerIds: ['p-sam'],
      durationMinutes: 35,
    };

    it('seeds from plays.json, turning daysAgo into a date', () => {
      const store = TestBed.inject(PlayStore);
      expect(store.ready()).toBe(false);

      http.expectOne('plays.json').flush([seedPlay]);

      expect(store.ready()).toBe(true);
      const { daysAgo: _drop, ...rest } = seedPlay;
      expect(store.plays()).toEqual([{ ...rest, playedAt: shiftDate(todayIso(), -3) }]);
      expect(savedPlays()![0].playedAt).toBe(shiftDate(todayIso(), -3));
    });

    it('treats daysAgo 0 as today and ignores a negative value', () => {
      const store = TestBed.inject(PlayStore);
      http.expectOne('plays.json').flush([
        { ...seedPlay, id: 'a', daysAgo: 0 },
        { ...seedPlay, id: 'b', daysAgo: -5 },
      ]);

      expect(store.find('a')!.playedAt).toBe(todayIso());
      expect(store.find('b')!.playedAt).toBe(shiftDate(todayIso(), -5));
    });

    it('assigns ids to seed plays that lack them', () => {
      const { id: _drop, ...noId } = seedPlay;
      const store = TestBed.inject(PlayStore);
      http.expectOne('plays.json').flush([noId]);
      expect(store.plays()[0].id).toEqual(expect.any(String));
    });

    it('reports an error but still becomes ready when the seed cannot be loaded', () => {
      const store = TestBed.inject(PlayStore);
      http.expectOne('plays.json').flush('nope', { status: 500, statusText: 'Server Error' });

      expect(store.ready()).toBe(true);
      expect(store.plays()).toEqual([]);
      expect(store.error()).toBe('Could not load the starter play history.');
    });

    it('treats an empty saved log as a decision, not a missing one', () => {
      seedPlays([]);
      const store = TestBed.inject(PlayStore);
      http.expectNone('plays.json');
      expect(store.plays()).toEqual([]);
      expect(store.ready()).toBe(true);
    });
  });

  it('loads saved plays and assigns missing ids', () => {
    const { id: _drop, ...noId } = SAMPLE_PLAYS[0];
    localStorage.setItem(PLAYS_STORAGE_KEY, JSON.stringify([noId, SAMPLE_PLAYS[1]]));
    const store = TestBed.inject(PlayStore);
    http.expectNone('plays.json');

    expect(store.plays()[0]).toEqual({ ...noId, id: expect.any(String) });
    expect(store.plays()[1]).toEqual(SAMPLE_PLAYS[1]);
  });

  it('re-seeds when the saved data is corrupt', () => {
    localStorage.setItem(PLAYS_STORAGE_KEY, '{ nope');
    const store = TestBed.inject(PlayStore);
    http.expectOne('plays.json').flush([]);
    expect(store.plays()).toEqual([]);
  });

  describe('with plays', () => {
    beforeEach(() => seedPlays(SAMPLE_PLAYS));

    it('recent() orders newest date first, then latest logged first within a date', () => {
      const store = TestBed.inject(PlayStore);
      expect(store.recent().map(p => p.id)).toEqual(['pl-3', 'pl-2', 'pl-1']);
    });

    it('add() appends with a fresh id and persists', () => {
      const store = TestBed.inject(PlayStore);
      const added = store.add(details);

      expect(added).toEqual({ id: expect.any(String), ...details });
      expect(store.plays().length).toBe(4);
      expect(savedPlays()![3]).toEqual(added);
    });

    it('update() replaces one play in place', () => {
      const store = TestBed.inject(PlayStore);
      store.update('pl-1', { ...details, funRating: 3 });

      expect(store.find('pl-1')).toEqual({ id: 'pl-1', ...details, funRating: 3 });
      expect(savedPlays()![0].funRating).toBe(3);
      expect(store.plays().length).toBe(3);
    });

    it('remove() drops one play', () => {
      const store = TestBed.inject(PlayStore);
      store.remove('pl-2');
      expect(store.plays().map(p => p.id)).toEqual(['pl-1', 'pl-3']);
      expect(savedPlays()!.map(p => p.id)).toEqual(['pl-1', 'pl-3']);
    });

    it('forGame() filters by game id', () => {
      const store = TestBed.inject(PlayStore);
      expect(store.forGame('g-catan').map(p => p.id)).toEqual(['pl-1', 'pl-3']);
      expect(store.forGame('g-none')).toEqual([]);
    });

    describe('merge()', () => {
      it('adds only plays whose id is not already here, and reports the count', () => {
        const store = TestBed.inject(PlayStore);
        const incoming = [SAMPLE_PLAYS[0], { ...SAMPLE_PLAYS[1], funRating: 1 }, { ...details, id: 'pl-new' }];

        expect(store.countNew(incoming)).toBe(1);
        expect(store.merge(incoming)).toBe(1);

        expect(store.plays().map(p => p.id)).toEqual(['pl-1', 'pl-2', 'pl-3', 'pl-new']);
        expect(store.find('pl-2')?.funRating).toBe(SAMPLE_PLAYS[1].funRating); // existing untouched
        expect(savedPlays()!.length).toBe(4);
      });

      it('treats plays without an id as new', () => {
        const store = TestBed.inject(PlayStore);
        expect(store.countNew([details])).toBe(1);
        expect(store.merge([details])).toBe(1);
        expect(store.plays()[3]).toEqual({ id: expect.any(String), ...details });
      });

      it('does nothing when everything is already here', () => {
        const store = TestBed.inject(PlayStore);
        const setItem = vi.spyOn(Storage.prototype, 'setItem');
        expect(store.merge(SAMPLE_PLAYS)).toBe(0);
        expect(setItem).not.toHaveBeenCalled();
      });
    });

    it('surfaces an error when storage rejects the write', () => {
      const store = TestBed.inject(PlayStore);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
      store.add(details);
      expect(store.error()).toBe('Could not save your play history to this device.');
    });
  });
});
