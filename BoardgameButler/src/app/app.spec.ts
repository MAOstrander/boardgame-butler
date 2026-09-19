import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { appConfig } from './app.config';
import { Home } from './home/home';
import { GameForm } from './game-form/game-form';
import { Manage } from './manage/manage';
import { Collection } from './collection/collection';
import { Tools } from './tools/tools';
import { Players } from './players/players';
import { History } from './history/history';
import { Stats } from './stats/stats';
import { PlayForm } from './play-form/play-form';
import { SAMPLE_GAMES, SAMPLE_PLAYERS, SAMPLE_PLAYS, seedPlayers, seedPlays, seedStorage } from '../testing/helpers';

describe('App routing', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    seedStorage(SAMPLE_GAMES);
    seedPlayers(SAMPLE_PLAYERS);
    seedPlays(SAMPLE_PLAYS);

    // Use the real app providers (router config, input binding, …) so routing
    // is tested as configured, with only the HTTP backend swapped for a stub.
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [...appConfig.providers, provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('creates the root component', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it.each<[string, Type<unknown>, string]>([
    ['/', Home, 'Boardgame Butler'],
    ['/collection', Collection, 'Your Collection'],
    ['/add-game', GameForm, 'Add a Game'],
    ['/edit-game/g-catan', GameForm, 'Edit Game'],
    ['/manage', Manage, 'Manage Collection'],
    ['/tools', Tools, 'Table Tools'],
    ['/players', Players, 'Players'],
    ['/history', History, 'Play History'],
    ['/stats', Stats, 'Statistics'],
    ['/log-play', PlayForm, 'Log a Play'],
    ['/log-play/pl-1', PlayForm, 'Edit Play'],
  ])('renders %s', async (url, component, heading) => {
    const instance = await harness.navigateByUrl(url, component);
    expect(instance).toBeInstanceOf(component);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(heading);
  });

  it('passes the id route parameter to the edit form', async () => {
    await harness.navigateByUrl('/edit-game/g-azul', GameForm);
    expect(harness.routeNativeElement?.querySelector<HTMLInputElement>('#title')?.value).toBe('Azul');
  });

  it('passes the game query parameter to the log-play form', async () => {
    await harness.navigateByUrl('/log-play?game=g-azul', PlayForm);
    expect(harness.routeNativeElement?.querySelector<HTMLSelectElement>('#game')?.value).toBe('g-azul');
  });

  it('navigates between pages via their links', async () => {
    await harness.navigateByUrl('/', Home);
    const link = harness.routeNativeElement?.querySelector<HTMLAnchorElement>('a[href="/collection"]');
    expect(link).toBeTruthy();
    link!.click();
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Your Collection');
  });
});
