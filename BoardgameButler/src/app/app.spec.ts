import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { routes } from './app.routes';
import { Home } from './home/home';
import { AddGame } from './add-game/add-game';
import { Manage } from './manage/manage';
import { Collection } from './collection/collection';

describe('App routing', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  // Pages fire data requests on init; drain them so verify() doesn't complain.
  afterEach(() => {
    http.match(() => true);
    http.verify();
  });

  it('creates the root component', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it.each<[string, Type<unknown>, string]>([
    ['/', Home, 'Boardgame Butler'],
    ['/collection', Collection, 'Your Collection'],
    ['/add-game', AddGame, 'Add a Game'],
    ['/manage', Manage, 'Manage Collection'],
  ])('renders %s', async (url, component, heading) => {
    const instance = await harness.navigateByUrl(url, component);
    expect(instance).toBeInstanceOf(component);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(heading);
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
