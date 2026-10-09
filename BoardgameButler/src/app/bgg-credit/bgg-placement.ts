import { Injectable, signal } from '@angular/core';

/** Candidate homes for the "Powered by BGG" credit. */
export type BggPlacement = 'footer' | 'home' | 'form' | 'manage' | 'all';

export const BGG_PLACEMENTS: BggPlacement[] = ['footer', 'home', 'form', 'manage', 'all'];
export const BGG_PLACEMENT_KEY = 'boardgame-butler.bggPlacement';

/**
 * TEMPORARY. Lets the placement of the BGG credit be switched at runtime so
 * the options can be compared in the real app rather than in a mock-up. Once a
 * placement is chosen, this service, the switcher component and the unused
 * call sites all come out, leaving one hard-coded credit.
 */
@Injectable({ providedIn: 'root' })
export class BggPlacementService {
  private readonly _placement = signal<BggPlacement>(this.read());
  readonly placement = this._placement.asReadonly();

  set(placement: BggPlacement): void {
    this._placement.set(placement);
    try {
      localStorage.setItem(BGG_PLACEMENT_KEY, placement);
    } catch {
      // Losing the choice on reload is not worth handling.
    }
  }

  /** True when the credit should render at `where`. */
  shows(where: Exclude<BggPlacement, 'all'>): boolean {
    const current = this._placement();
    return current === 'all' || current === where;
  }

  private read(): BggPlacement {
    try {
      const saved = localStorage.getItem(BGG_PLACEMENT_KEY);
      return BGG_PLACEMENTS.includes(saved as BggPlacement) ? (saved as BggPlacement) : 'footer';
    } catch {
      return 'footer';
    }
  }
}
