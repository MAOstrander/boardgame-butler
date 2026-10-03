import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Players } from './players';
import { SAMPLE_PLAYERS, findByText, query, queryAll, savedPlayers, seedPlayers, setInputValue, settle, text } from '../../testing/helpers';

describe('Players', () => {
  let fixture: ComponentFixture<Players>;

  async function setup(seed = SAMPLE_PLAYERS) {
    localStorage.clear();
    seedPlayers(seed);
    await TestBed.configureTestingModule({
      imports: [Players],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Players);
    await settle(fixture);
  }

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const names = () => queryAll(fixture, '[data-testid="player-name"]').map(el => el.textContent?.trim());
  const addInput = () => query<HTMLInputElement>(fixture, '#new-player');
  const addButton = () => findByText<HTMLButtonElement>(fixture, 'button[type="submit"]', 'Add');
  const rowButton = (name: string, action: 'Rename' | 'Remove') =>
    query<HTMLButtonElement>(fixture, `button[aria-label="${action} ${name}"]`);

  it('lists players alphabetically with a count', async () => {
    await setup();
    expect(text(fixture)).toContain('3 players');
    expect(names()).toEqual(['Alex', 'Jo', 'Sam']);
  });

  it('shows an empty state', async () => {
    await setup([]);
    expect(text(fixture)).toContain('No players yet.');
    expect(fixture.nativeElement.querySelector('ul')).toBeNull();
  });

  it('shows a loading line instead of the empty state while seeding', async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Players],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Players);
    await settle(fixture);

    expect(text(fixture)).toContain('Loading players...');
    expect(text(fixture)).not.toContain('No players yet.');

    http.expectOne('players.json').flush(SAMPLE_PLAYERS);
    await settle(fixture);
    expect(names()).toEqual(['Alex', 'Jo', 'Sam']);
    http.verify();
  });

  describe('adding', () => {
    it('Add is disabled until a name is typed', async () => {
      await setup();
      expect(addButton().disabled).toBe(true);
      setInputValue(addInput(), '   ');
      await settle(fixture);
      expect(addButton().disabled).toBe(true);
    });

    it('adds a trimmed name, persists it and clears the box', async () => {
      await setup();
      setInputValue(addInput(), '  Riley ');
      await settle(fixture);
      addButton().click();
      await settle(fixture);

      expect(names()).toEqual(['Alex', 'Jo', 'Riley', 'Sam']);
      expect(savedPlayers()!.map(p => p.name)).toEqual(['Sam', 'Alex', 'Jo', 'Riley']);
      expect(addInput().value).toBe('');
    });

    it('submits with Enter', async () => {
      await setup();
      setInputValue(addInput(), 'Riley');
      await settle(fixture);
      query<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
      await settle(fixture);
      expect(names()).toContain('Riley');
    });

    it('rejects a duplicate name, ignoring case and whitespace', async () => {
      await setup();
      setInputValue(addInput(), ' sAm ');
      await settle(fixture);

      expect(text(fixture)).toContain('You already have a player called "sAm".');
      expect(addButton().disabled).toBe(true);

      query<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit', { cancelable: true }));
      await settle(fixture);
      expect(savedPlayers()).toEqual(SAMPLE_PLAYERS);
    });

    it('shows a storage error and keeps the typed name', async () => {
      await setup();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
      setInputValue(addInput(), 'Riley');
      await settle(fixture);
      addButton().click();
      await settle(fixture);

      expect(text(fixture)).toContain('Could not save your players to this device.');
      expect(addInput().value).toBe('Riley');
    });
  });

  describe('renaming', () => {
    it('opens an inline editor pre-filled with the name', async () => {
      await setup();
      rowButton('Jo', 'Rename').click();
      await settle(fixture);

      const input = query<HTMLInputElement>(fixture, 'input[aria-label="New name for Jo"]');
      expect(input.value).toBe('Jo');
      expect(findByText(fixture, 'button', 'Save')).toBeTruthy();
    });

    it('saves the new name and persists it', async () => {
      await setup();
      rowButton('Jo', 'Rename').click();
      await settle(fixture);
      setInputValue(query<HTMLInputElement>(fixture, 'input[aria-label="New name for Jo"]'), 'Joanna');
      await settle(fixture);
      findByText<HTMLButtonElement>(fixture, 'button', 'Save').click();
      await settle(fixture);

      expect(names()).toEqual(['Alex', 'Joanna', 'Sam']);
      expect(savedPlayers()!.find(p => p.id === 'p-jo')?.name).toBe('Joanna');
      expect(fixture.nativeElement.querySelector('input[aria-label^="New name"]')).toBeNull();
    });

    it("allows keeping the player's own name but rejects another player's", async () => {
      await setup();
      rowButton('Jo', 'Rename').click();
      await settle(fixture);
      const input = query<HTMLInputElement>(fixture, 'input[aria-label="New name for Jo"]');
      const save = () => findByText<HTMLButtonElement>(fixture, 'button', 'Save');

      expect(save().disabled).toBe(false);

      setInputValue(input, 'ALEX');
      await settle(fixture);
      expect(text(fixture)).toContain('You already have a player called "ALEX".');
      expect(save().disabled).toBe(true);

      setInputValue(input, 'jo');
      await settle(fixture);
      expect(save().disabled).toBe(false);
    });

    it('cancel discards the edit', async () => {
      await setup();
      rowButton('Jo', 'Rename').click();
      await settle(fixture);
      setInputValue(query<HTMLInputElement>(fixture, 'input[aria-label="New name for Jo"]'), 'Nope');
      await settle(fixture);
      findByText<HTMLButtonElement>(fixture, 'button', 'Cancel').click();
      await settle(fixture);

      expect(names()).toEqual(['Alex', 'Jo', 'Sam']);
      expect(savedPlayers()).toEqual(SAMPLE_PLAYERS);
    });
  });

  describe('removing', () => {
    it('asks for confirmation, and Keep backs out', async () => {
      await setup();
      rowButton('Alex', 'Remove').click();
      await settle(fixture);

      expect(text(fixture)).toContain('Remove Alex?');
      findByText<HTMLButtonElement>(fixture, 'button', 'Keep').click();
      await settle(fixture);

      expect(text(fixture)).not.toContain('Remove Alex?');
      expect(savedPlayers()).toEqual(SAMPLE_PLAYERS);
    });

    it('confirming removes the player and persists', async () => {
      await setup();
      rowButton('Alex', 'Remove').click();
      await settle(fixture);
      findByText<HTMLButtonElement>(fixture, 'button', 'Yes, remove').click();
      await settle(fixture);

      expect(names()).toEqual(['Jo', 'Sam']);
      expect(savedPlayers()!.map(p => p.id)).toEqual(['p-sam', 'p-jo']);
      expect(text(fixture)).toContain('2 players');
    });

    it('starting a rename closes a pending delete confirmation', async () => {
      await setup();
      rowButton('Alex', 'Remove').click();
      await settle(fixture);
      rowButton('Jo', 'Rename').click();
      await settle(fixture);

      expect(text(fixture)).not.toContain('Remove Alex?');
      expect(fixture.nativeElement.querySelector('input[aria-label="New name for Jo"]')).toBeTruthy();
    });
  });

  it('links back home and to the collection and manage pages', async () => {
    await setup();
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/collection', '/manage']));
  });
});
