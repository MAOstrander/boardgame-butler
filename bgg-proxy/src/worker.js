/**
 * A caching, token-holding proxy in front of the BoardGameGeek XML API.
 *
 * BGG issue a bearer token per application and ask that "all requests should be
 * made by your servers, with the results cached". A browser can do neither: a
 * token shipped in the Angular bundle is public, and the browser has nowhere to
 * cache on BGG's behalf. So this Worker sits in between.
 *
 * It deliberately does not reshape the response. BGG's terms say "You may not
 * modify the data, including User Submissions, retrieved through the BGG XML API
 * in any way", so their XML is passed through byte for byte and parsed in the
 * browser. This file only adds authentication, a cache and CORS.
 */

// No "www": BGG redirect www to the bare host, and a redirect can drop the
// Authorization header.
const BGG_BASE = 'https://boardgamegeek.com/xmlapi2';

const USER_AGENT = 'boardgame-butler-proxy (+https://mathewostrander.com/boardgame-butler/)';

const DEFAULT_ORIGINS = ['https://mathewostrander.com', 'http://localhost:4200'];

/** Game metadata barely changes; search results move a little more often. */
const CACHE_SECONDS = { thing: 60 * 60 * 24 * 7, search: 60 * 60 * 24 };

const MAX_QUERY_LENGTH = 100;
const MAX_IDS = 20;

/** Matches the period of the RATE_LIMITER binding in wrangler.toml. */
const RATE_LIMIT_PERIOD_SECONDS = 60;

/**
 * @typedef {{ limit(options: { key: string }): Promise<{ success: boolean }> }} RateLimit
 * @typedef {{ BGG_TOKEN?: string, ALLOWED_ORIGINS?: string, RATE_LIMITER?: RateLimit }} Env
 */

/**
 * Whether this caller may spend another BGG request. Keyed on the caller's IP,
 * so one heavy user cannot use up the quota for everyone else.
 *
 * Fails open: with no binding (tests, local dev) or a limiter error, the
 * request goes ahead. Losing a lookup to a limiter outage would be worse than
 * one unmetered request reaching BGG.
 */
async function withinRateLimit(request, env) {
  if (!env?.RATE_LIMITER) return true;
  const key = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  try {
    return (await env.RATE_LIMITER.limit({ key })).success;
  } catch (error) {
    console.error(`Rate limiter unavailable: ${error}`);
    return true;
  }
}

export function allowedOrigins(env) {
  const listed = String(env?.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return listed.length ? listed : DEFAULT_ORIGINS;
}

/**
 * CORS is not a security boundary; anything that is not a browser can ignore it.
 * It is here so the app can call the proxy, not to keep anyone out. Abuse is
 * handled by rate limiting in front of the Worker, which the README covers.
 */
export function corsHeaders(request, env) {
  const headers = { Vary: 'Origin' };
  const origin = request.headers.get('Origin');
  if (origin && allowedOrigins(env).includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

/**
 * Maps our two public routes onto BGG URLs. Returning null for anything else
 * keeps this from being an open proxy for someone else's traffic, which would
 * be spent against our token and our quota.
 *
 * @returns {{ kind: 'search'|'thing', url: string } | { error: string } | null}
 */
export function resolveUpstream(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/search') {
    const query = (url.searchParams.get('q') ?? '').trim();
    if (!query) return { error: 'Pass the title to search for as ?q=' };
    if (query.length > MAX_QUERY_LENGTH) {
      return { error: `Search text is limited to ${MAX_QUERY_LENGTH} characters.` };
    }
    const upstream = new URL(`${BGG_BASE}/search`);
    upstream.searchParams.set('query', query);
    upstream.searchParams.set('type', 'boardgame,boardgameexpansion');
    if (url.searchParams.get('exact') === '1') upstream.searchParams.set('exact', '1');
    return { kind: 'search', url: upstream.toString() };
  }

  if (path === '/thing') {
    const ids = (url.searchParams.get('id') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!ids.length) return { error: 'Pass one or more BGG ids as ?id=' };
    if (ids.length > MAX_IDS) return { error: `Ask for at most ${MAX_IDS} ids at once.` };
    if (!ids.every((id) => /^\d{1,8}$/.test(id))) return { error: 'Ids must be numbers.' };

    const upstream = new URL(`${BGG_BASE}/thing`);
    upstream.searchParams.set('id', ids.join(','));
    upstream.searchParams.set('stats', '1');
    return { kind: 'thing', url: upstream.toString() };
  }

  return null;
}

function problem(status, detail, cors, extra) {
  return new Response(JSON.stringify({ error: detail }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cors,
      ...extra,
    },
  });
}

/** Copies a cached or upstream response, adding our own headers to it. */
function present(body, upstream, cors, cacheStatus) {
  const headers = new Headers(cors);
  headers.set('Content-Type', upstream.headers.get('Content-Type') ?? 'text/xml; charset=utf-8');
  const cacheControl = upstream.headers.get('Cache-Control');
  if (cacheControl) headers.set('Cache-Control', cacheControl);
  headers.set('X-Proxy-Cache', cacheStatus);
  return new Response(body, { status: upstream.status, headers });
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {{ cache?: Cache, waitUntil?: (p: Promise<unknown>) => void, fetch?: typeof fetch }} [deps]
 */
export async function handle(request, env, deps = {}) {
  const { cache, waitUntil, fetch: fetchImpl = globalThis.fetch } = deps;
  const url = new URL(request.url);
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...cors, 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return problem(405, 'Only GET is supported.', cors, { Allow: 'GET, OPTIONS' });
  }

  // Cheap enough to poke after a deploy without spending any BGG quota.
  if (url.pathname.replace(/\/+$/, '') === '/health') {
    return new Response(JSON.stringify({ ok: true, tokenConfigured: Boolean(env?.BGG_TOKEN) }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...cors,
      },
    });
  }

  const route = resolveUpstream(url);
  if (!route) {
    return problem(404, 'Unknown route. This proxy serves /search, /thing and /health.', cors);
  }
  if ('error' in route) return problem(400, route.error, cors);
  if (!env?.BGG_TOKEN) {
    return problem(503, 'This proxy has no BoardGameGeek token configured.', cors);
  }

  // Keyed on the upstream URL, so one cache entry serves every caller whatever
  // order they put the query string in.
  const cacheKey = new Request(route.url, { method: 'GET' });
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return present(hit.body, hit, cors, 'HIT');
  }

  // Only requests that would reach BGG are metered. A cache hit costs BGG
  // nothing, so there is no reason to refuse one.
  if (!(await withinRateLimit(request, env))) {
    return problem(429, 'Too many lookups from this address. Try again in a minute.', cors, {
      'Retry-After': String(RATE_LIMIT_PERIOD_SECONDS),
    });
  }

  let upstream;
  try {
    upstream = await fetchImpl(route.url, {
      // Only these headers go out. Nothing from the caller is forwarded, so a
      // client cannot smuggle its own Authorization or cookies through to BGG.
      headers: {
        Authorization: `Bearer ${env.BGG_TOKEN}`,
        Accept: 'text/xml, application/xml',
        'User-Agent': USER_AGENT,
      },
    });
  } catch {
    return problem(502, 'Could not reach BoardGameGeek.', cors);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    // Vague to the caller on purpose; the detail belongs in the Worker log.
    console.error(`BGG rejected the application token (HTTP ${upstream.status}).`);
    return problem(502, 'BoardGameGeek rejected this proxy. The token may need renewing.', cors);
  }
  if (upstream.status === 429) {
    const retryAfter = upstream.headers.get('Retry-After');
    return problem(
      429,
      'BoardGameGeek is rate limiting this proxy. Try again shortly.',
      cors,
      retryAfter ? { 'Retry-After': retryAfter } : undefined,
    );
  }
  // BGG answer 202 while they build a response and ask you to retry. Caching
  // that would pin "not ready yet" in place for a week.
  if (upstream.status === 202) {
    return problem(202, 'BoardGameGeek are still preparing this response. Try again shortly.', cors);
  }
  if (!upstream.ok) {
    console.error(`BGG returned HTTP ${upstream.status} for ${url.pathname}.`);
    return problem(502, `BoardGameGeek returned an error (HTTP ${upstream.status}).`, cors);
  }

  const body = await upstream.arrayBuffer();
  const cacheable = new Response(body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'text/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS[route.kind]}`,
    },
  });

  if (cache) {
    const stored = cache.put(cacheKey, cacheable.clone());
    if (waitUntil) waitUntil(stored);
    else await stored;
  }

  return present(body, cacheable, cors, 'MISS');
}

export default {
  /** @param {Request} request @param {Env} env @param {ExecutionContext} ctx */
  fetch(request, env, ctx) {
    return handle(request, env, {
      cache: caches.default,
      waitUntil: ctx.waitUntil.bind(ctx),
    });
  },
};
