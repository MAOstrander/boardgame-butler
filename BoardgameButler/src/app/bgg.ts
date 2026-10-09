import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, map, retry, throwError, timer } from 'rxjs';

/**
 * Where the BGG proxy (see `bgg-proxy/`) is deployed. An empty value hides the
 * lookup rather than offering it and failing.
 */
export const BGG_PROXY_URL = new InjectionToken<string>('BGG_PROXY_URL', {
  providedIn: 'root',
  factory: () => 'https://boardgame-butler-bgg.mysticalcarp.workers.dev',
});

export interface BggSearchResult {
  id: string;
  name: string;
  year?: number;
  expansion: boolean;
}

/** The fields of a BGG "thing" that map onto our game form. */
export interface BggDetails {
  id: string;
  name: string;
  year?: number;
  minPlayers?: number;
  maxPlayers?: number;
  minPlaytime?: number;
  maxPlaytime?: number;
  /** BGG's community weight, 1 (light) to 5 (heavy). */
  weight?: number;
}

/** BGG answer 202 while they build a response; the proxy passes that through. */
class NotReadyYet extends Error {}

const NOT_READY_RETRIES = 3;
const NOT_READY_DELAY_MS = 2000;

/**
 * Talks to BoardGameGeek through our proxy. The proxy passes BGG's XML through
 * unmodified (their terms forbid reshaping it), so parsing happens here.
 */
@Injectable({ providedIn: 'root' })
export class BggService {
  private http = inject(HttpClient);
  private baseUrl = inject(BGG_PROXY_URL).replace(/\/+$/, '');

  readonly enabled = this.baseUrl !== '';

  search(title: string): Observable<BggSearchResult[]> {
    return this.get('/search', { q: title.trim() }).pipe(map(xml => rankResults(parseSearch(xml), title)));
  }

  details(id: string): Observable<BggDetails | null> {
    return this.get('/thing', { id }).pipe(map(xml => parseThing(xml)));
  }

  private get(path: string, params: Record<string, string>): Observable<string> {
    return this.http
      .get(this.baseUrl + path, { params, responseType: 'text', observe: 'response' })
      .pipe(
        map((response: HttpResponse<string>) => {
          if (response.status === 202) throw new NotReadyYet();
          return response.body ?? '';
        }),
        retry({
          count: NOT_READY_RETRIES,
          delay: error => (error instanceof NotReadyYet ? timer(NOT_READY_DELAY_MS) : throwError(() => error)),
        }),
      );
  }
}

/** A sentence the form can show for a failed lookup. */
export function lookupErrorMessage(error: unknown): string {
  if (error instanceof NotReadyYet) {
    return 'BoardGameGeek is still preparing that game. Try again in a moment.';
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return "Couldn't reach BoardGameGeek. Check your connection.";
    if (error.status === 429) return 'BoardGameGeek is busy right now. Try again in a minute.';
  }
  return "BoardGameGeek lookup isn't working right now.";
}

/**
 * BGG's 1 to 5 weight onto our three levels. Light family games sit under 2,
 * heavy strategy games from 3 up.
 */
export function complexityFromWeight(weight: number): 'Easy' | 'Medium' | 'Hard' {
  if (weight < 2) return 'Easy';
  if (weight < 3) return 'Medium';
  return 'Hard';
}

/** "2-4", or "2" when both ends match; undefined when BGG has no figure. */
export function formatRange(min?: number, max?: number): string | undefined {
  const lo = min || max;
  const hi = max || min;
  if (!lo || !hi) return undefined;
  return lo === hi ? String(lo) : `${Math.min(lo, hi)}-${Math.max(lo, hi)}`;
}

export function parseSearch(xml: string): BggSearchResult[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const seen = new Set<string>();
  const results: BggSearchResult[] = [];

  // Asking for boardgame and boardgameexpansion together can list an item twice.
  for (const item of Array.from(doc.querySelectorAll('items > item'))) {
    const id = item.getAttribute('id');
    const name = valueOf(item, 'name');
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    results.push({
      id,
      name,
      year: numberOf(item, 'yearpublished'),
      expansion: item.getAttribute('type') === 'boardgameexpansion',
    });
  }
  return results;
}

export function parseThing(xml: string): BggDetails | null {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const item = doc.querySelector('items > item');
  const id = item?.getAttribute('id');
  if (!item || !id) return null;

  const primary = item.querySelector(':scope > name[type="primary"]') ?? item.querySelector(':scope > name');
  return {
    id,
    name: primary?.getAttribute('value') ?? '',
    year: numberOf(item, 'yearpublished'),
    minPlayers: numberOf(item, 'minplayers'),
    maxPlayers: numberOf(item, 'maxplayers'),
    minPlaytime: numberOf(item, 'minplaytime'),
    maxPlaytime: numberOf(item, 'maxplaytime'),
    weight: numberOf(item, 'statistics > ratings > averageweight'),
  };
}

/**
 * BGG return search hits in no useful order. Put exact title matches first,
 * then base games ahead of expansions, then the newest edition.
 */
function rankResults(results: BggSearchResult[], title: string): BggSearchResult[] {
  const wanted = title.trim().toLowerCase();
  const score = (r: BggSearchResult) => (r.name.toLowerCase() === wanted ? 0 : 2) + (r.expansion ? 1 : 0);
  return [...results].sort((a, b) => score(a) - score(b) || (b.year ?? 0) - (a.year ?? 0));
}

function valueOf(item: Element, selector: string): string | undefined {
  return item.querySelector(`:scope > ${selector}`)?.getAttribute('value') ?? undefined;
}

/** A positive number, or undefined; BGG use 0 for "unknown". */
function numberOf(item: Element, selector: string): number | undefined {
  const value = Number(item.querySelector(`:scope > ${selector}`)?.getAttribute('value'));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
