import { ComponentFixture } from '@angular/core/testing';
import { Game } from '../app/game';
import { STORAGE_KEY } from '../app/game-store';
import { Player } from '../app/player';
import { PLAYERS_STORAGE_KEY } from '../app/player-store';
import { Play } from '../app/play';
import { PLAYS_STORAGE_KEY } from '../app/play-store';

/** Pre-populate the saved collection so GameStore starts ready without seeding. */
export function seedStorage(games: Game[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
}

export function savedGames(): Game[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw == null ? null : JSON.parse(raw);
}

export function seedPlayers(players: Player[]): void {
  localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players));
}

export function savedPlayers(): Player[] | null {
  const raw = localStorage.getItem(PLAYERS_STORAGE_KEY);
  return raw == null ? null : JSON.parse(raw);
}

export function seedPlays(plays: Play[]): void {
  localStorage.setItem(PLAYS_STORAGE_KEY, JSON.stringify(plays));
}

export function savedPlays(): Play[] | null {
  const raw = localStorage.getItem(PLAYS_STORAGE_KEY);
  return raw == null ? null : JSON.parse(raw);
}

/** Run change detection and wait for the zoneless scheduler to settle. */
export async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

export function query<T extends Element = HTMLElement>(
  fixture: ComponentFixture<unknown>,
  selector: string,
): T {
  const el = (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  if (!el) throw new Error(`No element matches "${selector}"`);
  return el;
}

export function queryAll<T extends Element = HTMLElement>(
  fixture: ComponentFixture<unknown>,
  selector: string,
): T[] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<T>(selector));
}

export function text(fixture: ComponentFixture<unknown>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

/** Text of an element's direct children joined by single spaces, e.g. one table row's cells. */
export function cellText(row: Element): string {
  return Array.from(row.children)
    .map(c => c.textContent?.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
}

/** Find the first element matching `selector` whose text includes `label`. */
export function findByText<T extends Element = HTMLElement>(
  fixture: ComponentFixture<unknown>,
  selector: string,
  label: string,
): T {
  const el = queryAll<T>(fixture, selector).find(e => e.textContent?.includes(label));
  if (!el) throw new Error(`No "${selector}" contains text "${label}"`);
  return el;
}

/** Type into an input the way a user would, so Angular forms and (input) handlers fire. */
export function setInputValue(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

/** Attach a file to a file input and fire its change event. */
export function selectFile(input: HTMLInputElement, contents: string, name = 'games.json'): void {
  const file = new File([contents], name, { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export const SAMPLE_GAMES: Game[] = [
  { id: 'g-catan', title: 'Catan', players: '3-4', duration: '60-120', complexity: 'Medium', rating: 7 },
  { id: 'g-azul', title: 'Azul', players: '2-4', duration: '30-45', complexity: 'Easy', rating: 9 },
  { id: 'g-gloom', title: 'Gloomhaven', players: '1-4', duration: '60-120', complexity: 'Hard' },
  { id: 'g-tm', title: 'Terraforming Mars', players: '1-5', duration: '120-180', complexity: 'Hard', rating: 8 },
];

export const SAMPLE_PLAYERS: Player[] = [
  { id: 'p-sam', name: 'Sam' },
  { id: 'p-alex', name: 'Alex' },
  { id: 'p-jo', name: 'Jo' },
];

/** Three plays: two of Catan, one of Azul; pl-2 and pl-3 share a date. */
export const SAMPLE_PLAYS: Play[] = [
  {
    id: 'pl-1',
    gameId: 'g-catan',
    gameTitle: 'Catan',
    playedAt: '2026-09-01',
    players: [{ id: 'p-sam', name: 'Sam' }, { id: 'p-alex', name: 'Alex' }],
    winnerIds: ['p-alex'],
    durationMinutes: 90,
    funRating: 7,
  },
  {
    id: 'pl-2',
    gameId: 'g-azul',
    gameTitle: 'Azul',
    playedAt: '2026-09-10',
    players: [{ id: 'p-sam', name: 'Sam' }, { id: 'p-jo', name: 'Jo' }],
    winnerIds: ['p-sam'],
    durationMinutes: 35,
    funRating: 9,
    notes: 'Close one.',
  },
  {
    id: 'pl-3',
    gameId: 'g-catan',
    gameTitle: 'Catan',
    playedAt: '2026-09-10',
    players: [{ id: 'p-sam', name: 'Sam' }, { id: 'p-alex', name: 'Alex' }, { id: 'p-jo', name: 'Jo' }],
    winnerIds: [],
  },
];
