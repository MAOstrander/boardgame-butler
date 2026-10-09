import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BGG_PROXY_URL, BggService, complexityFromWeight, formatRange, lookupErrorMessage, parseSearch, parseThing } from './bgg';
import { SEARCH_XML, THING_XML } from '../testing/bgg-fixtures';

describe('BGG parsing', () => {
  it('reads search hits, dropping the duplicate an item gets when listed under both types', () => {
    expect(parseSearch(SEARCH_XML)).toEqual([
      { id: '926', name: 'Catan: Cities & Knights', year: 1998, expansion: false },
      { id: '13', name: 'CATAN', year: 1995, expansion: false },
      { id: '278', name: 'Catan Card Game', year: undefined, expansion: false },
    ]);
  });

  it('reads an empty search as no hits', () => {
    expect(parseSearch('<items total="0" termsofuse="x"></items>')).toEqual([]);
  });

  it('reads the fields the game form needs from a thing, preferring the primary name', () => {
    expect(parseThing(THING_XML)).toEqual({
      id: '13',
      name: 'CATAN',
      year: 1995,
      minPlayers: 3,
      maxPlayers: 4,
      minPlaytime: 60,
      maxPlaytime: 120,
      weight: 2.2885,
    });
  });

  it('treats BGG zeros as unknown', () => {
    const xml = '<items><item id="5"><name type="primary" value="Obscure"/><minplayers value="0"/><statistics><ratings><averageweight value="0"/></ratings></statistics></item></items>';
    expect(parseThing(xml)).toMatchObject({ id: '5', minPlayers: undefined, weight: undefined });
  });

  it('returns null when BGG send no item', () => {
    expect(parseThing('<items termsofuse="x"></items>')).toBeNull();
  });

  it('maps weight onto three complexity levels', () => {
    expect(complexityFromWeight(1.0)).toBe('Easy');
    expect(complexityFromWeight(1.99)).toBe('Easy');
    expect(complexityFromWeight(2.0)).toBe('Medium');
    expect(complexityFromWeight(2.99)).toBe('Medium');
    expect(complexityFromWeight(3.0)).toBe('Hard');
    expect(complexityFromWeight(4.8)).toBe('Hard');
  });

  it('formats ranges the way the form writes them', () => {
    expect(formatRange(2, 4)).toBe('2-4');
    expect(formatRange(2, 2)).toBe('2');
    expect(formatRange(undefined, 5)).toBe('5');
    expect(formatRange(3, undefined)).toBe('3');
    expect(formatRange(undefined, undefined)).toBeUndefined();
  });
});

describe('BggService', () => {
  let http: HttpTestingController;

  function setup(url: string) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: BGG_PROXY_URL, useValue: url }],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(BggService);
  }

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('is disabled until a proxy URL is configured', () => {
    expect(setup('').enabled).toBe(false);
  });

  it('searches through the proxy and ranks exact matches first', () => {
    const bgg = setup('https://proxy.test/');
    let results: unknown;
    bgg.search(' catan ').subscribe(r => (results = r));

    const req = http.expectOne(r => r.url === 'https://proxy.test/search');
    expect(req.request.params.get('q')).toBe('catan');
    req.flush(SEARCH_XML);

    expect((results as { id: string }[]).map(r => r.id)).toEqual(['13', '926', '278']);
  });

  it('fetches a thing by id', () => {
    const bgg = setup('https://proxy.test');
    let details: unknown;
    bgg.details('13').subscribe(d => (details = d));

    http.expectOne('https://proxy.test/thing?id=13').flush(THING_XML);
    expect(details).toMatchObject({ id: '13', maxPlayers: 4 });
  });

  it('retries while BGG are still preparing the response', async () => {
    vi.useFakeTimers();
    const bgg = setup('https://proxy.test');
    let details: unknown;
    bgg.details('13').subscribe(d => (details = d));

    http.expectOne('https://proxy.test/thing?id=13').flush('{"error":"not yet"}', { status: 202, statusText: 'Accepted' });
    expect(details).toBeUndefined();

    await vi.advanceTimersByTimeAsync(2000);
    http.expectOne('https://proxy.test/thing?id=13').flush(THING_XML);
    expect(details).toMatchObject({ id: '13' });
  });

  it('gives up after a few 202s with a message to try again', async () => {
    vi.useFakeTimers();
    const bgg = setup('https://proxy.test');
    let error: unknown;
    bgg.details('13').subscribe({ error: e => (error = e) });

    for (let attempt = 0; attempt < 4; attempt++) {
      http.expectOne('https://proxy.test/thing?id=13').flush('', { status: 202, statusText: 'Accepted' });
      await vi.advanceTimersByTimeAsync(2000);
    }
    expect(lookupErrorMessage(error)).toContain('still preparing');
  });

  it('turns HTTP failures into readable messages', () => {
    const bgg = setup('https://proxy.test');
    const messages: string[] = [];
    const record = { error: (e: unknown) => messages.push(lookupErrorMessage(e)) };

    bgg.search('a').subscribe(record);
    http.expectOne(r => r.url.endsWith('/search')).flush('', { status: 429, statusText: 'Too Many Requests' });
    bgg.search('b').subscribe(record);
    http.expectOne(r => r.url.endsWith('/search')).error(new ProgressEvent('error'));
    bgg.search('c').subscribe(record);
    http.expectOne(r => r.url.endsWith('/search')).flush('', { status: 502, statusText: 'Bad Gateway' });

    expect(messages).toEqual([
      'BoardGameGeek is busy right now. Try again in a minute.',
      "Couldn't reach BoardGameGeek. Check your connection.",
      "BoardGameGeek lookup isn't working right now.",
    ]);
  });
});
