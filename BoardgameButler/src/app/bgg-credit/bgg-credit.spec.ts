import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BggCredit } from './bgg-credit';
import { BGG_PLACEMENT_KEY, BggPlacementService } from './bgg-placement';
import { query, settle } from '../../testing/helpers';

describe('BggCredit', () => {
  let fixture: ComponentFixture<BggCredit>;

  async function setup(size?: 'sm' | 'md' | 'lg') {
    await TestBed.configureTestingModule({ imports: [BggCredit] }).compileComponents();
    fixture = TestBed.createComponent(BggCredit);
    if (size) fixture.componentRef.setInput('size', size);
    await settle(fixture);
  }

  const link = () => query<HTMLAnchorElement>(fixture, '[data-testid="bgg-credit"]');
  const image = () => query<HTMLImageElement>(fixture, 'img');

  it('links back to BoardGameGeek, as their terms require', async () => {
    await setup();
    expect(link().getAttribute('href')).toBe('https://boardgamegeek.com');
  });

  it('opens in a new tab without handing over the opener', async () => {
    await setup();
    expect(link().getAttribute('target')).toBe('_blank');
    expect(link().getAttribute('rel')).toContain('noopener');
  });

  it('describes itself for screen readers', async () => {
    await setup();
    expect(image().getAttribute('alt')).toBe('Powered by BoardGameGeek');
    expect(link().getAttribute('aria-label')).toContain('BoardGameGeek');
  });

  it('uses the reversed artwork, which is the light-on-dark one', async () => {
    await setup();
    // Relative so it resolves against <base href> under the deployed sub-path.
    expect(image().getAttribute('src')).toBe('bgg/powered-by-bgg.svg');
  });

  it('defaults to a width where the wordmark still reads', async () => {
    await setup();
    expect(image().className).toContain('w-[170px]');
  });

  it.each([
    ['sm', 'w-[130px]'],
    ['md', 'w-[170px]'],
    ['lg', 'w-[220px]'],
  ] as const)('renders %s at %s', async (size, expected) => {
    await setup(size);
    expect(image().className).toContain(expected);
  });
});

describe('BggPlacementService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('starts in the app footer', () => {
    expect(TestBed.inject(BggPlacementService).placement()).toBe('footer');
  });

  it('remembers a choice', () => {
    const service = TestBed.inject(BggPlacementService);
    service.set('manage');

    expect(service.placement()).toBe('manage');
    expect(localStorage.getItem(BGG_PLACEMENT_KEY)).toBe('manage');
  });

  it('reads a saved choice back', () => {
    localStorage.setItem(BGG_PLACEMENT_KEY, 'form');
    expect(TestBed.inject(BggPlacementService).placement()).toBe('form');
  });

  it('ignores a saved value that is not a placement', () => {
    localStorage.setItem(BGG_PLACEMENT_KEY, 'somewhere-else');
    expect(TestBed.inject(BggPlacementService).placement()).toBe('footer');
  });

  it('shows the credit only where the placement says', () => {
    const service = TestBed.inject(BggPlacementService);
    service.set('home');

    expect(service.shows('home')).toBe(true);
    expect(service.shows('footer')).toBe(false);
    expect(service.shows('form')).toBe(false);
  });

  it('shows it everywhere when comparing all four', () => {
    const service = TestBed.inject(BggPlacementService);
    service.set('all');

    for (const where of ['footer', 'home', 'form', 'manage'] as const) {
      expect(service.shows(where)).toBe(true);
    }
  });
});
