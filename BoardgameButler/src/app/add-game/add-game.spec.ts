import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AddGame } from './add-game';
import { query, queryAll, setInputValue, settle, text } from '../../testing/helpers';

describe('AddGame', () => {
  let fixture: ComponentFixture<AddGame>;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
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

  afterEach(() => http.verify());

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

  it('posts the game to /api/games and navigates home on success', async () => {
    await fillValidForm();
    submitButton().click();
    await settle(fixture);

    expect(submitButton().textContent).toContain('Saving...');
    expect(submitButton().disabled).toBe(true);

    const req = http.expectOne('/api/games');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      title: 'Wingspan',
      players: '1-5',
      duration: '40-70',
      complexity: 'Medium',
      rating: 8,
    });

    req.flush({ success: true }, { status: 201, statusText: 'Created' });
    await settle(fixture);

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('shows an error and re-enables the form when saving fails', async () => {
    await fillValidForm();
    submitButton().click();
    await settle(fixture);

    http.expectOne('/api/games').flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
    await settle(fixture);

    expect(text(fixture)).toContain('Failed to save game. Please try again.');
    expect(submitButton().disabled).toBe(false);
    expect(submitButton().textContent).toContain('Add to Collection');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not submit while the form is invalid', async () => {
    submitButton().click();
    query<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
    await settle(fixture);
    http.expectNone('/api/games');
  });

  it('links back home and to the collection and manage pages', () => {
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/collection', '/manage']));
  });
});
