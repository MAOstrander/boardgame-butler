import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BggCredit } from './bgg-credit';
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
