import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigins, corsHeaders, handle, resolveUpstream } from './worker.js';

const TOKEN = 'test-token-0000-1111-2222';
const ENV = { BGG_TOKEN: TOKEN };
const XML = '<?xml version="1.0"?><items><item id="13"><name value="Catan"/></item></items>';

const route = (path) => new URL(`https://proxy.example${path}`);

function get(path, { origin, method = 'GET', headers = {} } = {}) {
  return new Request(`https://proxy.example${path}`, {
    method,
    headers: { ...(origin ? { Origin: origin } : {}), ...headers },
  });
}

/** A stand-in for caches.default: a Map that clones on the way out. */
function fakeCache() {
  const store = new Map();
  return {
    store,
    async match(request) {
      const saved = store.get(request.url);
      return saved ? saved.clone() : undefined;
    },
    async put(request, response) {
      store.set(request.url, response);
    },
  };
}

function fakeFetch(responder) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return typeof responder === 'function' ? responder(url, init) : responder;
  };
  impl.calls = calls;
  return impl;
}

const xmlResponse = (body = XML, status = 200, headers = {}) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/xml; charset=utf-8', ...headers } });

describe('resolveUpstream', () => {
  it('builds a board game search, asking for expansions too', () => {
    const result = resolveUpstream(route('/search?q=Catan'));
    const upstream = new URL(result.url);
    assert.equal(upstream.origin + upstream.pathname, 'https://boardgamegeek.com/xmlapi2/search');
    assert.equal(upstream.searchParams.get('query'), 'Catan');
    assert.equal(upstream.searchParams.get('type'), 'boardgame,boardgameexpansion');
    assert.equal(result.kind, 'search');
  });

  it('uses the bare host, since a www redirect would drop the token', () => {
    assert.ok(resolveUpstream(route('/search?q=Catan')).url.startsWith('https://boardgamegeek.com/'));
  });

  it('trims the query and rejects an empty one', () => {
    assert.equal(resolveUpstream(route('/search?q=%20%20')).error, 'Pass the title to search for as ?q=');
    assert.ok(resolveUpstream(route('/search')).error);
  });

  it('caps the query length', () => {
    const long = 'a'.repeat(101);
    assert.match(resolveUpstream(route(`/search?q=${long}`)).error, /100 characters/);
  });

  it('passes an exact search through, but only when asked', () => {
    assert.ok(new URL(resolveUpstream(route('/search?q=Catan&exact=1')).url).searchParams.has('exact'));
    assert.ok(!new URL(resolveUpstream(route('/search?q=Catan')).url).searchParams.has('exact'));
  });

  it('asks for stats on a thing lookup, so ratings and weight come back', () => {
    const upstream = new URL(resolveUpstream(route('/thing?id=13')).url);
    assert.equal(upstream.pathname, '/xmlapi2/thing');
    assert.equal(upstream.searchParams.get('id'), '13');
    assert.equal(upstream.searchParams.get('stats'), '1');
  });

  it('accepts several ids at once', () => {
    const upstream = new URL(resolveUpstream(route('/thing?id=13,822,%20161936')).url);
    assert.equal(upstream.searchParams.get('id'), '13,822,161936');
  });

  it('rejects ids that are not numbers', () => {
    assert.equal(resolveUpstream(route('/thing?id=13,../collection')).error, 'Ids must be numbers.');
    assert.equal(resolveUpstream(route('/thing?id=abc')).error, 'Ids must be numbers.');
  });

  it('refuses an unbounded batch of ids', () => {
    const ids = Array.from({ length: 21 }, (_, index) => index + 1).join(',');
    assert.match(resolveUpstream(route(`/thing?id=${ids}`)).error, /at most 20/);
  });

  it('tolerates a trailing slash', () => {
    assert.equal(resolveUpstream(route('/thing/?id=13')).kind, 'thing');
  });

  // The important one: this must not become an open proxy, because every
  // request through it spends our token and our quota.
  it('refuses any route it does not own', () => {
    assert.equal(resolveUpstream(route('/collection?username=someone')), null);
    assert.equal(resolveUpstream(route('/')), null);
    assert.equal(resolveUpstream(route('/xmlapi2/thing?id=13')), null);
  });
});

describe('CORS', () => {
  it('falls back to the deployed site and the dev server', () => {
    assert.deepEqual(allowedOrigins({}), ['https://mathewostrander.com', 'http://localhost:4200']);
  });

  it('lets the environment replace that list', () => {
    assert.deepEqual(allowedOrigins({ ALLOWED_ORIGINS: 'https://a.test, https://b.test' }), [
      'https://a.test',
      'https://b.test',
    ]);
  });

  it('echoes an allowed origin back', () => {
    const headers = corsHeaders(get('/health', { origin: 'http://localhost:4200' }), {});
    assert.equal(headers['Access-Control-Allow-Origin'], 'http://localhost:4200');
  });

  it('stays silent for an origin it does not know', () => {
    const headers = corsHeaders(get('/health', { origin: 'https://somewhere.else' }), {});
    assert.equal(headers['Access-Control-Allow-Origin'], undefined);
  });

  it('varies on Origin, so a cache cannot serve one site the other headers', () => {
    assert.equal(corsHeaders(get('/health'), {}).Vary, 'Origin');
  });
});

describe('handle', () => {
  it('answers a preflight without touching BGG', async () => {
    const fetchImpl = fakeFetch(xmlResponse());
    const request = get('/search?q=Catan', { origin: 'http://localhost:4200', method: 'OPTIONS' });
    const response = await handle(request, ENV, { fetch: fetchImpl });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
    assert.equal(fetchImpl.calls.length, 0);
  });

  it('turns away anything that is not a GET', async () => {
    const response = await handle(get('/search?q=Catan', { method: 'POST' }), ENV, {});
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET, OPTIONS');
  });

  it('reports health, including whether a token is configured', async () => {
    const fetchImpl = fakeFetch(xmlResponse());
    const ok = await handle(get('/health'), ENV, { fetch: fetchImpl });
    assert.deepEqual(await ok.json(), { ok: true, tokenConfigured: true });

    const bare = await handle(get('/health'), {}, { fetch: fetchImpl });
    assert.deepEqual(await bare.json(), { ok: true, tokenConfigured: false });
    assert.equal(fetchImpl.calls.length, 0, 'health must not spend BGG quota');
  });

  it('404s an unknown route', async () => {
    const response = await handle(get('/collection?username=someone'), ENV, {});
    assert.equal(response.status, 404);
  });

  it('400s a malformed request, explaining what was wrong', async () => {
    const response = await handle(get('/thing?id=nope'), ENV, {});
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Ids must be numbers.');
  });

  it('503s when no token is configured, rather than calling BGG unauthenticated', async () => {
    const fetchImpl = fakeFetch(xmlResponse());
    const response = await handle(get('/search?q=Catan'), {}, { fetch: fetchImpl });
    assert.equal(response.status, 503);
    assert.equal(fetchImpl.calls.length, 0);
  });

  it('sends the token upstream as a bearer header', async () => {
    const fetchImpl = fakeFetch(xmlResponse());
    await handle(get('/thing?id=13'), ENV, { fetch: fetchImpl });
    assert.equal(fetchImpl.calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
    assert.match(fetchImpl.calls[0].init.headers['User-Agent'], /boardgame-butler/);
  });

  it('never lets the token reach the client', async () => {
    const fetchImpl = fakeFetch(xmlResponse());
    const response = await handle(get('/thing?id=13'), ENV, { fetch: fetchImpl });
    const serialised = [...response.headers].flat().join('|') + (await response.clone().text());
    assert.ok(!serialised.includes(TOKEN));
  });

  it('ignores an Authorization header from the caller instead of forwarding it', async () => {
    const fetchImpl = fakeFetch(xmlResponse());
    await handle(get('/thing?id=13', { headers: { Authorization: 'Bearer smuggled' } }), ENV, {
      fetch: fetchImpl,
    });
    assert.equal(fetchImpl.calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  });

  // The terms forbid modifying their data, so this is a compliance test as much
  // as a correctness one.
  it('passes BGG xml through byte for byte', async () => {
    const fetchImpl = fakeFetch(xmlResponse());
    const response = await handle(get('/thing?id=13'), ENV, { fetch: fetchImpl });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), XML);
    assert.match(response.headers.get('Content-Type'), /xml/);
  });

  it('caches a hit for a week and a search for a day', async () => {
    const thing = await handle(get('/thing?id=13'), ENV, { fetch: fakeFetch(xmlResponse()) });
    assert.equal(thing.headers.get('Cache-Control'), 'public, max-age=604800');

    const search = await handle(get('/search?q=Catan'), ENV, { fetch: fakeFetch(xmlResponse()) });
    assert.equal(search.headers.get('Cache-Control'), 'public, max-age=86400');
  });

  it('serves a repeat request from cache without calling BGG again', async () => {
    const cache = fakeCache();
    const fetchImpl = fakeFetch(() => xmlResponse());

    const first = await handle(get('/thing?id=13'), ENV, { cache, fetch: fetchImpl });
    assert.equal(first.headers.get('X-Proxy-Cache'), 'MISS');
    assert.equal(await first.text(), XML);

    const second = await handle(get('/thing?id=13'), ENV, { cache, fetch: fetchImpl });
    assert.equal(second.headers.get('X-Proxy-Cache'), 'HIT');
    assert.equal(await second.text(), XML);
    assert.equal(fetchImpl.calls.length, 1, 'the second request must be served from cache');
  });

  it('shares one cache entry across callers, whatever the origin', async () => {
    const cache = fakeCache();
    const fetchImpl = fakeFetch(() => xmlResponse());
    await handle(get('/thing?id=13', { origin: 'http://localhost:4200' }), ENV, { cache, fetch: fetchImpl });
    await handle(get('/thing?id=13', { origin: 'https://mathewostrander.com' }), ENV, { cache, fetch: fetchImpl });
    assert.equal(fetchImpl.calls.length, 1);
    assert.equal(cache.store.size, 1);
  });

  it('hands the cache write to waitUntil when the runtime offers one', async () => {
    const cache = fakeCache();
    const pending = [];
    await handle(get('/thing?id=13'), ENV, {
      cache,
      fetch: fakeFetch(xmlResponse()),
      waitUntil: (promise) => pending.push(promise),
    });
    assert.equal(pending.length, 1);
    await Promise.all(pending);
    assert.equal(cache.store.size, 1);
  });

  it('does not cache a 202, since BGG are still building the answer', async () => {
    const cache = fakeCache();
    const response = await handle(get('/thing?id=13'), ENV, {
      cache,
      fetch: fakeFetch(xmlResponse('', 202)),
    });
    assert.equal(response.status, 202);
    assert.equal(cache.store.size, 0);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  });

  it('passes a rate limit back with its Retry-After intact', async () => {
    const response = await handle(get('/search?q=Catan'), ENV, {
      fetch: fakeFetch(xmlResponse('', 429, { 'Retry-After': '30' })),
    });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '30');
  });

  it('reports a rejected token as a proxy fault, not a client one', async () => {
    mock.method(console, 'error', () => {});
    const response = await handle(get('/thing?id=13'), ENV, {
      fetch: fakeFetch(xmlResponse('', 401)),
    });
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /token may need renewing/);
    mock.restoreAll();
  });

  it('turns any other upstream failure into a 502', async () => {
    mock.method(console, 'error', () => {});
    const response = await handle(get('/thing?id=13'), ENV, {
      fetch: fakeFetch(xmlResponse('', 500)),
    });
    assert.equal(response.status, 502);
    mock.restoreAll();
  });

  it('survives BGG being unreachable', async () => {
    const response = await handle(get('/thing?id=13'), ENV, {
      fetch: async () => {
        throw new Error('ECONNRESET');
      },
    });
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /Could not reach/);
  });

  it('keeps CORS headers on an error, so the browser can read the message', async () => {
    const response = await handle(get('/thing?id=nope', { origin: 'http://localhost:4200' }), ENV, {});
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:4200');
  });
});

describe('rate limiting', () => {
  /** A stand-in for the RATE_LIMITER binding that allows `allowance` calls per key. */
  function fakeLimiter(allowance) {
    const counts = new Map();
    return {
      keys: [],
      async limit({ key }) {
        this.keys.push(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
        return { success: counts.get(key) <= allowance };
      },
    };
  }

  const fromIp = (path, ip, origin) =>
    get(path, { origin, headers: { 'CF-Connecting-IP': ip } });

  it('meters each caller by IP address', async () => {
    const limiter = fakeLimiter(1);
    const env = { ...ENV, RATE_LIMITER: limiter };
    const fetch = fakeFetch(() => xmlResponse());

    assert.equal((await handle(fromIp('/thing?id=1', '203.0.113.1'), env, { fetch })).status, 200);
    assert.equal((await handle(fromIp('/thing?id=2', '203.0.113.2'), env, { fetch })).status, 200);
    assert.equal((await handle(fromIp('/thing?id=3', '203.0.113.1'), env, { fetch })).status, 429);
    assert.deepEqual(limiter.keys, ['203.0.113.1', '203.0.113.2', '203.0.113.1']);
  });

  it('refuses an over-limit caller without calling BGG, saying when to retry', async () => {
    const env = { ...ENV, RATE_LIMITER: fakeLimiter(0) };
    const fetch = fakeFetch(xmlResponse());
    const response = await handle(fromIp('/search?q=Catan', '203.0.113.1', 'http://localhost:4200'), env, { fetch });

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:4200');
    assert.match((await response.json()).error, /Too many lookups/);
    assert.equal(fetch.calls.length, 0);
  });

  it('still serves cache hits to an over-limit caller, since they cost BGG nothing', async () => {
    const cache = fakeCache();
    await handle(get('/thing?id=13'), ENV, { cache, fetch: fakeFetch(xmlResponse()) });

    const env = { ...ENV, RATE_LIMITER: fakeLimiter(0) };
    const response = await handle(fromIp('/thing?id=13', '203.0.113.1'), env, { cache, fetch: fakeFetch(xmlResponse()) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Proxy-Cache'), 'HIT');
  });

  it('does not meter health checks or bad requests', async () => {
    const limiter = fakeLimiter(0);
    const env = { ...ENV, RATE_LIMITER: limiter };
    assert.equal((await handle(get('/health'), env, {})).status, 200);
    assert.equal((await handle(get('/thing?id=nope'), env, {})).status, 400);
    assert.equal(limiter.keys.length, 0);
  });

  it('lets the request through if the limiter itself fails', async () => {
    mock.method(console, 'error', () => {});
    const env = {
      ...ENV,
      RATE_LIMITER: {
        async limit() {
          throw new Error('binding unavailable');
        },
      },
    };
    const response = await handle(get('/thing?id=13'), env, { fetch: fakeFetch(xmlResponse()) });
    assert.equal(response.status, 200);
    mock.restoreAll();
  });
});
