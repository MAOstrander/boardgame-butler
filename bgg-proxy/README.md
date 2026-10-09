# BGG proxy

A small Cloudflare Worker that sits between Boardgame Butler and the
[BoardGameGeek XML API](https://boardgamegeek.com/wiki/page/BGG_XML_API2).

## Why this exists

BGG issue a bearer token per application, and their guidance is that "all
requests should be made by your servers, with the results cached". Neither is
possible from the browser:

- A token shipped in the Angular bundle is public. Anything the browser can read,
  so can anyone who opens devtools.
- The browser has no shared cache to spare BGG repeated identical requests.

So the token lives here as a Cloudflare secret, and this Worker caches on BGG's
behalf.

It does **not** reshape the response. Their terms say "You may not modify the
data, including User Submissions, retrieved through the BGG XML API in any way",
so the XML is passed through byte for byte and parsed in the browser. This Worker
adds authentication, a cache and CORS, and nothing else. There is a test asserting
the passthrough is unmodified, because that is a compliance requirement rather
than a preference.

## Routes

| Route | Maps to | Cached for |
| --- | --- | --- |
| `GET /search?q=<title>&exact=0\|1` | `xmlapi2/search?query=…&type=boardgame,boardgameexpansion` | 1 day |
| `GET /thing?id=<id>[,<id>…]` | `xmlapi2/thing?id=…&stats=1` | 7 days |
| `GET /health` | nothing | not cached |

Everything else is a 404. The allowlist is the point: an open proxy would spend
our token and our quota on someone else's traffic. Ids must be numeric, at most
20 per request, and search text is capped at 100 characters.

`/health` returns `{"ok":true,"tokenConfigured":true}` without calling BGG, so it
is safe to poke after a deploy.

## Deploying

You need a free Cloudflare account. Nothing is installed into this folder;
`wrangler` is fetched on demand.

```sh
cd bgg-proxy
npm test                      # 36 tests, no dependencies required
npx wrangler@latest login     # opens a browser
npx wrangler@latest deploy
```

That prints a URL like `https://boardgame-butler-bgg.<your-subdomain>.workers.dev`.

Then set the token. This is the only step that touches the credential, and it
never goes near git:

```sh
npx wrangler@latest secret put BGG_TOKEN
# paste the application token from
# https://boardgamegeek.com/applications when prompted
```

Check it took:

```sh
curl https://boardgame-butler-bgg.<your-subdomain>.workers.dev/health
# {"ok":true,"tokenConfigured":true}

curl "https://boardgame-butler-bgg.<your-subdomain>.workers.dev/search?q=catan"
```

Rotating or revoking the token later is the same `secret put` command; no code
change and no redeploy of the app.

### Allowed origins

`ALLOWED_ORIGINS` in `wrangler.toml` lists the origins the browser may call from.
It is a plain var rather than a secret, since it is not sensitive. Edit and
redeploy to change it.

## Worth knowing before this is public

**CORS is not a security boundary.** It stops other websites using the proxy from
a browser; it does nothing about curl or a script. Once the Worker URL is in the
app bundle, it is effectively public, and someone who finds it can spend our BGG
quota.

The cache absorbs most of that, because repeat lookups of popular games never
reach BGG. For the rest, add a Cloudflare rate limiting rule on the Worker route
(Security, then Rate limiting rules) at something like 30 requests per minute per
IP. The free plan includes this. It is worth doing before the lookup ships, not
after a problem.

A shared secret header would not help: it would have to be in the bundle too, so
it would be just as public as the URL.

## Local development

```sh
npx wrangler@latest dev
```

Put the token in `.dev.vars` (gitignored) so local runs can authenticate:

```
BGG_TOKEN=your-token-here
```

Two differences from production: the Cache API is a no-op locally, so every
request hits BGG, and the dev server runs on `http://localhost:8787`.

## Tests

```sh
npm test
```

Node's own test runner, no dependencies, no build step. The Worker's logic is
written as a plain `handle(request, env, deps)` function so the tests can call it
with ordinary `Request` and `Response` objects and inject a fake cache and fetch.
Coverage includes the route allowlist, parameter validation, cache hits and
misses, the 202/429/401 paths, and that the token never appears in a response.
