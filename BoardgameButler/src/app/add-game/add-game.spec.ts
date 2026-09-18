import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AddGame } from './add-game';
import { SAMPLE_GAMES, query, queryAll, savedGames, seedStorage, setInputValue, settle, text } from '../../testing/helpers';

describe('AddGame', () => {
  let fixture: ComponentFixture<AddGame>;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    seedStorage(SAMPLE_GAMES);

    await TestBed.configureTestingModule({
      imports: [AddGame],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(AddGame);
    await settle(fixture);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const submitButton = () => query<HTMLButtonElement>(fixture, 'button[type="submit"]');

  async function fillValidForm() {
    setInputValue(query<HTMLInputElement>(fixture, '#title'), 'Wingspan');
    setInputValue(query<HTMLInputElement>(fixture, '#players'), '1-5');
    setInputValue(query<HTMLInputElement>(fixture, '#duration'), '40-70');
    setInputValue(query<HTMLSelectElement>(fixture, '#complexity'), 'Medium');
    setInputValue(query<HTMLInputElement>(fixture, '#rating'), '8');
    await settle(fixture);
  }

  it('starts with complexity defaulting to Medium and submit disabled', () => {
    expect(query<HTMLSelectElement>(fixture, '#complexity').value).toBe('Medium');
    expect(submitButton().disabled).toBe(true);
  });

  it('shows required errors once fields are touched', async () => {
    expect(text(fixture)).not.toContain('Title is required.');

    setInputValue(query<HTMLInputElement>(fixture, '#title'), '');
    setInputValue(query<HTMLInputElement>(fixture, '#players'), '');
    setInputValue(query<HTMLInputElement>(fixture, '#duration'), '');
    await settle(fixture);

    expect(text(fixture)).toContain('Title is required.');
    expect(text(fixture)).toContain('Player count is required.');
    expect(text(fixture)).toContain('Duration is required.');
    expect(submitButton().disabled).toBe(true);
  });

  it('shows the live rating value next to the label once set', async () => {
    expect(text(fixture)).not.toContain('/ 10');
    setInputValue(query<HTMLInputElement>(fixture, '#rating'), '6');
    await settle(fixture);
    expect(text(fixture)).toContain('6 / 10');
  });

  it('enables submit once every field is valid', async () => {
    await fillValidForm();
    expect(submitButton().disabled).toBe(false);
  });

  it('saves the game to the collection and navigates home', async () => {
    await fillValidForm();
    submitButton().click();
    await settle(fixture);

    const saved = savedGames()!;
    expect(saved.length).toBe(SAMPLE_GAMES.length + 1);
    expect(saved[saved.length - 1]).toEqual({
      title: 'Wingspan',
      players: '1-5',
      duration: '40-70',
      complexity: 'Medium',
      rating: 8,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('shows an error and stays on the page when the device refuses to save', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    await fillValidForm();
    submitButton().click();
    await settle(fixture);

    expect(text(fixture)).toContain('Could not save your collection to this device.');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not save while the form is invalid', async () => {
    submitButton().click();
    query<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
    await settle(fixture);

    expect(savedGames()).toEqual(SAMPLE_GAMES);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('links back home and to the collection and manage pages', () => {
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/collection', '/manage']));
  });
});
