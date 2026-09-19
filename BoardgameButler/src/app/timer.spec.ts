import { Countdown, Stopwatch, formatDuration } from './timer';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [999, '0:00'],
    [1_000, '0:01'],
    [65_000, '1:05'],
    [600_000, '10:00'],
    [3_599_000, '59:59'],
    [3_600_000, '1:00:00'],
    [3_661_000, '1:01:01'],
    [36_000_000, '10:00:00'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe('Stopwatch', () => {
  let sw: Stopwatch;

  beforeEach(() => {
    vi.useFakeTimers();
    sw = new Stopwatch();
  });

  afterEach(() => {
    sw.destroy();
    vi.useRealTimers();
  });

  it('starts at zero and not running', () => {
    expect(sw.elapsedMs()).toBe(0);
    expect(sw.running()).toBe(false);
  });

  it('counts wall-clock time while running and refreshes on a tick', () => {
    sw.start();
    expect(sw.running()).toBe(true);

    vi.advanceTimersByTime(1_250);
    expect(sw.elapsedMs()).toBe(1_250);
  });

  it('derives elapsed time from timestamps, not tick count', () => {
    sw.start();
    // Jump the clock far more than one interval, as a throttled background tab would.
    vi.advanceTimersByTime(10_000);
    sw.refresh();
    expect(sw.elapsedMs()).toBe(10_000);
  });

  it('pauses, holds its value, and resumes from there', () => {
    sw.start();
    vi.advanceTimersByTime(2_000);
    sw.pause();
    expect(sw.running()).toBe(false);
    expect(sw.elapsedMs()).toBe(2_000);

    vi.advanceTimersByTime(5_000);
    expect(sw.elapsedMs()).toBe(2_000);

    sw.start();
    vi.advanceTimersByTime(1_000);
    expect(sw.elapsedMs()).toBe(3_000);
  });

  it('resets to zero', () => {
    sw.start();
    vi.advanceTimersByTime(2_000);
    sw.reset();
    expect(sw.elapsedMs()).toBe(0);
    expect(sw.running()).toBe(false);
  });

  it('ignores a second start while running', () => {
    sw.start();
    vi.advanceTimersByTime(1_000);
    sw.start();
    vi.advanceTimersByTime(1_000);
    expect(sw.elapsedMs()).toBe(2_000);
  });

  it('calls onTick on each refresh while running', () => {
    const tick = vi.fn();
    sw.onTick = tick;
    sw.start();
    vi.advanceTimersByTime(1_000); // 4 intervals of 250ms
    expect(tick).toHaveBeenCalledTimes(4);
  });

  it('destroy() stops the interval', () => {
    sw.start();
    sw.destroy();
    vi.advanceTimersByTime(1_000);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Countdown', () => {
  let cd: Countdown;

  beforeEach(() => {
    vi.useFakeTimers();
    cd = new Countdown();
  });

  afterEach(() => {
    cd.destroy();
    vi.useRealTimers();
  });

  it('starts with no duration and cannot start', () => {
    expect(cd.durationMs()).toBe(0);
    expect(cd.remainingMs()).toBe(0);
    expect(cd.finished()).toBe(false);
    cd.start();
    expect(cd.running()).toBe(false);
  });

  it('counts down from the duration', () => {
    cd.setDuration(5_000);
    expect(cd.remainingMs()).toBe(5_000);

    cd.start();
    vi.advanceTimersByTime(2_000);
    expect(cd.remainingMs()).toBe(3_000);
    expect(cd.finished()).toBe(false);
  });

  it('stops at zero, marks finished, and fires onFinish exactly once', () => {
    const finish = vi.fn();
    cd.onFinish = finish;
    cd.setDuration(1_000);
    cd.start();

    vi.advanceTimersByTime(3_000);

    expect(cd.remainingMs()).toBe(0);
    expect(cd.finished()).toBe(true);
    expect(cd.running()).toBe(false);
    expect(finish).toHaveBeenCalledTimes(1);

    // Nothing further happens once finished.
    cd.start();
    vi.advanceTimersByTime(1_000);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(cd.running()).toBe(false);
  });

  it('pauses and resumes', () => {
    cd.setDuration(10_000);
    cd.start();
    vi.advanceTimersByTime(3_000);
    cd.pause();
    vi.advanceTimersByTime(3_000);
    expect(cd.remainingMs()).toBe(7_000);

    cd.start();
    vi.advanceTimersByTime(1_000);
    expect(cd.remainingMs()).toBe(6_000);
  });

  it('reset() rewinds to the full duration and can run again', () => {
    const finish = vi.fn();
    cd.onFinish = finish;
    cd.setDuration(1_000);
    cd.start();
    vi.advanceTimersByTime(2_000);
    expect(cd.finished()).toBe(true);

    cd.reset();
    expect(cd.remainingMs()).toBe(1_000);
    expect(cd.finished()).toBe(false);

    cd.start();
    vi.advanceTimersByTime(2_000);
    expect(finish).toHaveBeenCalledTimes(2);
  });

  it('setDuration() replaces the duration and rewinds', () => {
    cd.setDuration(5_000);
    cd.start();
    vi.advanceTimersByTime(1_000);
    cd.setDuration(2_000);

    expect(cd.running()).toBe(false);
    expect(cd.remainingMs()).toBe(2_000);
  });
});
