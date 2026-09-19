import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Tools } from './tools';
import { TimerService } from '../timer-service';
import { findByText, query, queryAll, setInputValue, settle, text } from '../../testing/helpers';

describe('Tools', () => {
  let fixture: ComponentFixture<Tools>;
  let timers: TimerService;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [Tools],
      providers: [provideRouter([])],
    }).compileComponents();

    timers = TestBed.inject(TimerService);
    vi.spyOn(timers, 'alert').mockImplementation(() => {});
    fixture = TestBed.createComponent(Tools);
    await settle(fixture);
  });

  afterEach(() => {
    timers.countdown.destroy();
    timers.stopwatch.destroy();
    timers.countdown.setDuration(0);
    timers.stopwatch.reset();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Advance fake time and re-render. */
  async function tick(ms: number) {
    vi.advanceTimersByTime(ms);
    await settle(fixture);
  }

  const button = (label: string) => findByText<HTMLButtonElement>(fixture, 'button', label);
  const buttonIn = (section: string, label: string) =>
    findByText<HTMLButtonElement>(fixture, `section[aria-labelledby="${section}-heading"] button`, label);

  describe('dice', () => {
    it('defaults to one d6', () => {
      expect(button('d6').getAttribute('aria-pressed')).toBe('true');
      expect(button('d20').getAttribute('aria-pressed')).toBe('false');
      expect(text(fixture)).toContain('Roll 1d6');
    });

    it('offers every die type', () => {
      const labels = queryAll(fixture, '[aria-label="Die type"] button').map(b => b.textContent?.trim());
      expect(labels).toEqual(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']);
    });

    it('changes die type and count', async () => {
      button('d20').click();
      button('+').click();
      button('+').click();
      await settle(fixture);

      expect(button('d20').getAttribute('aria-pressed')).toBe('true');
      expect(text(fixture)).toContain('Roll 3d20');
    });

    it('clamps the count between 1 and 10', async () => {
      const minus = query<HTMLButtonElement>(fixture, '[aria-label="Fewer dice"]');
      const plus = query<HTMLButtonElement>(fixture, '[aria-label="More dice"]');
      expect(minus.disabled).toBe(true);

      for (let i = 0; i < 12; i++) plus.click();
      await settle(fixture);
      expect(text(fixture)).toContain('Roll 10d6');
      expect(plus.disabled).toBe(true);
      expect(minus.disabled).toBe(false);
    });

    it('shows the total and each die after a roll', async () => {
      button('d6').click();
      button('+').click();
      await settle(fixture);

      const values = [0, 0.999];
      let i = 0;
      vi.spyOn(Math, 'random').mockImplementation(() => values[i++ % values.length]);
      button('Roll 2d6').click();
      await settle(fixture);

      expect(text(fixture)).toContain('2d6');
      const dice = queryAll(fixture, '[aria-label="Individual dice"] span').map(s => s.textContent?.trim());
      expect(dice).toEqual(['1', '6']);
      expect(query(fixture, '.text-6xl').textContent?.trim()).toBe('7');
    });

    it('hides the individual dice for a single die', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      button('Roll 1d6').click();
      await settle(fixture);

      expect(query(fixture, '.text-6xl').textContent?.trim()).toBe('4');
      expect(fixture.nativeElement.querySelector('[aria-label="Individual dice"]')).toBeNull();
    });

    it('keeps the last five rolls, newest first', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      for (let n = 0; n < 7; n++) {
        button('Roll 1d6').click();
      }
      await settle(fixture);

      const history = queryAll(fixture, 'ul li');
      expect(history.length).toBe(5);
      expect(history[0].textContent).toContain('1d6 → 1');
    });
  });

  describe('countdown', () => {
    const display = () => query(fixture, '[data-testid="countdown-display"]').textContent?.trim();

    it('starts empty with Start and Reset disabled', () => {
      expect(display()).toBe('0:00');
      expect(buttonIn('countdown', 'Start').disabled).toBe(true);
      expect(buttonIn('countdown', 'Reset').disabled).toBe(true);
    });

    it('a preset sets the duration and enables Start', async () => {
      button('5 min').click();
      await settle(fixture);

      expect(display()).toBe('5:00');
      expect(button('5 min').getAttribute('aria-pressed')).toBe('true');
      expect(buttonIn('countdown', 'Start').disabled).toBe(false);
    });

    it('a custom duration sets the timer and clears the preset highlight', async () => {
      button('5 min').click();
      await settle(fixture);
      setInputValue(query<HTMLInputElement>(fixture, '#custom-minutes'), '2.5');
      await settle(fixture);

      expect(display()).toBe('2:30');
      expect(button('5 min').getAttribute('aria-pressed')).toBe('false');
    });

    it('counts down while running and offers Pause', async () => {
      button('1 min').click();
      await settle(fixture);
      buttonIn('countdown', 'Start').click();
      await tick(15_000);

      expect(display()).toBe('0:45');
      expect(buttonIn('countdown', 'Pause')).toBeTruthy();
      expect(button('1 min').disabled).toBe(true);
      expect(query<HTMLInputElement>(fixture, '#custom-minutes').disabled).toBe(true);
    });

    it('pauses and resumes', async () => {
      button('1 min').click();
      await settle(fixture);
      buttonIn('countdown', 'Start').click();
      await tick(10_000);
      buttonIn('countdown', 'Pause').click();
      await tick(10_000);

      expect(display()).toBe('0:50');
      expect(buttonIn('countdown', 'Resume')).toBeTruthy();

      buttonIn('countdown', 'Resume').click();
      await tick(5_000);
      expect(display()).toBe('0:45');
    });

    it("announces time's up, alerts once, and can be reset", async () => {
      button('1 min').click();
      await settle(fixture);
      buttonIn('countdown', 'Start').click();
      await tick(61_000);

      expect(display()).toBe('0:00');
      expect(text(fixture)).toContain("Time's up!");
      expect(timers.alert).toHaveBeenCalledTimes(1);
      expect(buttonIn('countdown', 'Start').disabled).toBe(true);

      buttonIn('countdown', 'Reset').click();
      await settle(fixture);
      expect(display()).toBe('1:00');
      expect(text(fixture)).not.toContain("Time's up!");
      expect(buttonIn('countdown', 'Start').disabled).toBe(false);
    });

    it('keeps running while the page is away and catches up on return', async () => {
      button('2 min').click();
      await settle(fixture);
      buttonIn('countdown', 'Start').click();
      await tick(1_000);

      fixture.destroy();
      vi.advanceTimersByTime(30_000);

      fixture = TestBed.createComponent(Tools);
      await settle(fixture);
      expect(display()).toBe('1:29');
      expect(buttonIn('countdown', 'Pause')).toBeTruthy();
    });
  });

  describe('stopwatch', () => {
    const display = () => query(fixture, '[data-testid="stopwatch-display"]').textContent?.trim();

    it('starts at zero with Reset disabled', () => {
      expect(display()).toBe('0:00');
      expect(buttonIn('stopwatch', 'Reset').disabled).toBe(true);
    });

    it('counts up, pauses, resumes and resets', async () => {
      buttonIn('stopwatch', 'Start').click();
      await tick(65_000);
      expect(display()).toBe('1:05');

      buttonIn('stopwatch', 'Pause').click();
      await tick(10_000);
      expect(display()).toBe('1:05');
      expect(buttonIn('stopwatch', 'Resume')).toBeTruthy();

      buttonIn('stopwatch', 'Resume').click();
      await tick(3_600_000);
      expect(display()).toBe('1:01:05');

      buttonIn('stopwatch', 'Pause').click();
      await settle(fixture);
      buttonIn('stopwatch', 'Reset').click();
      await settle(fixture);
      expect(display()).toBe('0:00');
      expect(buttonIn('stopwatch', 'Start')).toBeTruthy();
    });
  });

  it('links back home and to the collection', () => {
    const hrefs = queryAll<HTMLAnchorElement>(fixture, 'a').map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/collection']));
  });
});
