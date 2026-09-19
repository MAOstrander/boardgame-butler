import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GameForm } from './game-form';
import { SAMPLE_GAMES, SAMPLE_PLAYS, query, queryAll, savedGames, savedPlays, seedPlays, seedStorage, setInputValue, settle, text } from '../../testing/helpers';

describe('GameForm', () => {
  let fixture: ComponentFixture<GameForm>;
  let http: HttpTestingController;
  let router: Router;

  /** Create the form; pass an id to open it in edit mode. */
  async function setup(id?: string) {
    localStorage.clear();
    seedStorage(SAMPLE_GAMES);
    seedPlays(SAMPLE_PLAYS);

    await TestBed.configureTestingModule({
      imports: [GameForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(GameForm);
    if (id !== undefined) fixture.componentRef.setInput('id', id);
    await settle(fixture);
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const submitButton = () => query<HTMLButtonElement>(fixture, 'button[type="submit"]');
  const titleInput = () => query<HTMLInputElement>(fixture, '#title');

  async function fill(values: { title: string; players: string; duration: string; complexity: string; rating: string }) {
    setInputValue(titleInput(), values.title);
    setInputValue(query<HTMLInputElement>(fixture, '#players'), values.players);
    setInputValue(query<HTMLInputElement>(fixture, '#duration'), values.duration);
    setInputValue(query<HTMLSelectElement>(fixture, '#complexity'), values.complexity);
    setInputValue(query<HTMLInputElement>(fixture, '#rating'), values.rating);
    await settle(fixture);
  }

  const cascadia = { title: 'Cascadia', players: '1-4', duration: '30-45', complexity: 'Easy', rating: '8' };

  describe('adding', () => {
    beforeEach(() => setup());

    it('shows the add heading, defaults complexity to Medium and disables submit', () => {
      expect(query(fixture, 'h1').textContent).toContain('Add a Game');
      expect(query<HTMLSelectElement>(fixture, '#complexity').value).toBe('Medium');
      expect(submitButton().textContent).toContain('Add to Collection');
      expect(submitButton().disabled).toBe(true);
      expect(text(fixture)).not.toContain('Cancel');
    });

    it('shows required errors once fields are touched', async () => {
      expect(text(fixture)).not.toContain('Title is required.');

      setInputValue(titleInput(), '');
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
      await fill(cascadia);
      expect(submitButton().disabled).toBe(false);
    });

    it('saves the game with a new id and navigates home', async () => {
      await fill(cascadia);
      submitButton().click();
      await settle(fixture);

      const saved = savedGames()!;
      expect(saved.length).toBe(SAMPLE_GAMES.length + 1);
      expect(saved[saved.length - 1]).toEqual({
        id: expect.any(String),
        title: 'Cascadia',
        players: '1-4',
        duration: '30-45',
        complexity: 'Easy',
        rating: 8,
      });
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('trims whitespace from text fields before saving', async () => {
      await fill({ ...cascadia, title: '  Cascadia  ', players: ' 1-4 ' });
      submitButton().click();
      await settle(fixture);

      const saved = savedGames()!;
      expect(saved[saved.length - 1]).toMatchObject({ title: 'Cascadia', players: '1-4' });
    });

    describe('duplicate titles', () => {
      it('rejects a title that is already in the collection', async () => {
        await fill({ ...cascadia, title: 'Catan' });

        expect(text(fixture)).toContain('You already have a game called "Catan".');
        expect(submitButton().disabled).toBe(true);
      });

      it('ignores case and surrounding whitespace', async () => {
        await fill({ ...cascadia, title: '  cAtAn ' });
        expect(text(fixture)).toContain('You already have a game called "cAtAn".');
        expect(submitButton().disabled).toBe(true);
      });

      it('does not save a duplicate even if submit is forced', async () => {
        await fill({ ...cascadia, title: 'Azul' });
        query<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
        await settle(fixture);

        expect(savedGames()).toEqual(SAMPLE_GAMES);
        expect(router.navigate).not.toHaveBeenCalled();
      });

      it('clears the error when the title is changed to something new', async () => {
        await fill({ ...cascadia, title: 'Catan' });
        setInputValue(titleInput(), 'Catan: Seafarers');
        await settle(fixture);

        expect(text(fixture)).not.toContain('You already have a game');
        expect(submitButton().disabled).toBe(false);
      });
    });

    it('shows an error and stays on the page when the device refuses to save', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });

      await fill(cascadia);
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

  describe('editing', () => {
    it('pre-fills the form with the game and shows the edit heading', async () => {
      await setup('g-catan');

      expect(query(fixture, 'h1').textContent).toContain('Edit Game');
      expect(text(fixture)).toContain('Update the details for Catan.');
      expect(titleInput().value).toBe('Catan');
      expect(query<HTMLInputElement>(fixture, '#players').value).toBe('3-4');
      expect(query<HTMLInputElement>(fixture, '#duration').value).toBe('60-120');
      expect(query<HTMLSelectElement>(fixture, '#complexity').value).toBe('Medium');
      expect(query<HTMLInputElement>(fixture, '#rating').value).toBe('7');
      expect(text(fixture)).toContain('7 / 10');
      expect(submitButton().textContent).toContain('Save Changes');
      expect(submitButton().disabled).toBe(false);
    });

    it('offers a Cancel link back to the collection', async () => {
      await setup('g-catan');
      const cancel = queryAll<HTMLAnchorElement>(fixture, 'a').find(a => a.textContent?.trim() === 'Cancel');
      expect(cancel?.getAttribute('href')).toBe('/collection');
    });

    it('saves changed details in place, keeps the id, and returns to the collection', async () => {
      await setup('g-catan');
      setInputValue(query<HTMLInputElement>(fixture, '#duration'), '75-100');
      setInputValue(query<HTMLSelectElement>(fixture, '#complexity'), 'Hard');
      setInputValue(query<HTMLInputElement>(fixture, '#rating'), '9');
      await settle(fixture);

      submitButton().click();
      await settle(fixture);

      const saved = savedGames()!;
      expect(saved.length).toBe(SAMPLE_GAMES.length);
      expect(saved[0]).toEqual({
        id: 'g-catan',
        title: 'Catan',
        players: '3-4',
        duration: '75-100',
        complexity: 'Hard',
        rating: 9,
      });
      expect(saved.slice(1)).toEqual(SAMPLE_GAMES.slice(1));
      expect(router.navigate).toHaveBeenCalledWith(['/collection']);
    });

    it('allows keeping the same title but rejects another game’s title', async () => {
      await setup('g-catan');
      expect(text(fixture)).not.toContain('You already have a game');

      setInputValue(titleInput(), 'AZUL');
      await settle(fixture);
      expect(text(fixture)).toContain('You already have a game called "AZUL".');
      expect(submitButton().disabled).toBe(true);

      setInputValue(titleInput(), 'Catan');
      await settle(fixture);
      expect(text(fixture)).not.toContain('You already have a game');
      expect(submitButton().disabled).toBe(false);
    });

    it('allows renaming to an unused title', async () => {
      await setup('g-catan');
      setInputValue(titleInput(), 'Catan (5-6 player)');
      await settle(fixture);
      submitButton().click();
      await settle(fixture);

      expect(savedGames()![0]).toMatchObject({ id: 'g-catan', title: 'Catan (5-6 player)' });
    });

    it('requires a rating before an unrated game can be saved', async () => {
      await setup('g-gloom');
      expect(text(fixture)).not.toContain('/ 10'); // no rating label until one is chosen
      expect(submitButton().disabled).toBe(true);

      setInputValue(query<HTMLInputElement>(fixture, '#rating'), '6');
      await settle(fixture);
      expect(submitButton().disabled).toBe(false);
    });

    describe('deleting', () => {
      const deleteButton = () => queryAll<HTMLButtonElement>(fixture, 'button').find(b => b.textContent?.includes('Delete this game'));
      const confirmButton = () => queryAll<HTMLButtonElement>(fixture, 'button').find(b => b.textContent?.includes('Yes, delete it'));
      const keepButton = () => queryAll<HTMLButtonElement>(fixture, 'button').find(b => b.textContent?.includes('Keep it'));

      it('is not offered when adding', async () => {
        await setup();
        expect(deleteButton()).toBeUndefined();
      });

      it('asks for confirmation before deleting', async () => {
        await setup('g-azul');
        expect(confirmButton()).toBeUndefined();

        deleteButton()!.click();
        await settle(fixture);

        expect(text(fixture)).toContain('Remove Azul from your collection?');
        expect(confirmButton()).toBeDefined();
        expect(savedGames()).toEqual(SAMPLE_GAMES);
      });

      it('"Keep it" backs out without changing anything', async () => {
        await setup('g-azul');
        deleteButton()!.click();
        await settle(fixture);
        keepButton()!.click();
        await settle(fixture);

        expect(confirmButton()).toBeUndefined();
        expect(deleteButton()).toBeDefined();
        expect(savedGames()).toEqual(SAMPLE_GAMES);
        expect(router.navigate).not.toHaveBeenCalled();
      });

      it('confirming removes the game, keeps its plays, and returns to the collection', async () => {
        await setup('g-azul');
        deleteButton()!.click();
        await settle(fixture);
        confirmButton()!.click();
        await settle(fixture);

        expect(savedGames()!.map(g => g.id)).toEqual(['g-catan', 'g-gloom', 'g-tm']);
        expect(savedPlays()).toEqual(SAMPLE_PLAYS);
        expect(router.navigate).toHaveBeenCalledWith(['/collection']);
      });

      it('the confirmation says how many logged plays will be kept', async () => {
        await setup('g-catan');
        deleteButton()!.click();
        await settle(fixture);
        expect(text(fixture)).toContain('Its 2 logged plays will stay in your history.');
      });

      it('the confirmation says nothing about plays when there are none', async () => {
        await setup('g-tm');
        deleteButton()!.click();
        await settle(fixture);
        expect(text(fixture)).not.toContain('logged play');
      });

      it('shows an error and stays on the page when the device refuses to save', async () => {
        await setup('g-azul');
        deleteButton()!.click();
        await settle(fixture);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
          throw new DOMException('quota', 'QuotaExceededError');
        });

        confirmButton()!.click();
        await settle(fixture);

        expect(text(fixture)).toContain('Could not save your collection to this device.');
        expect(router.navigate).not.toHaveBeenCalled();
        expect(deleteButton()).toBeDefined();
      });
    });

    it('shows a not-found message for an unknown id', async () => {
      await setup('missing');
      expect(text(fixture)).toContain("That game isn't in your collection any more.");
      expect(fixture.nativeElement.querySelector('form')).toBeNull();
      const back = queryAll<HTMLAnchorElement>(fixture, 'a').find(a => a.textContent?.includes('Back to your collection'));
      expect(back?.getAttribute('href')).toBe('/collection');
    });
  });
});
