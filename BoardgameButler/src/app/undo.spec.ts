import { TestBed } from '@angular/core/testing';
import { UNDO_WINDOW_MS, UndoService } from './undo';

describe('UndoService', () => {
  let service: UndoService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(UndoService);
  });

  afterEach(() => {
    service.dismiss();
    vi.useRealTimers();
  });

  it('starts with nothing pending', () => {
    expect(service.offer()).toBeNull();
  });

  it('holds a message and its reversal', () => {
    const undo = vi.fn();
    service.propose('Deleted Catan.', undo);

    expect(service.offer()?.message).toBe('Deleted Catan.');
    expect(undo).not.toHaveBeenCalled();
  });

  it('runs the reversal on accept and clears the offer', () => {
    const undo = vi.fn();
    service.propose('Deleted Catan.', undo);

    service.accept();

    expect(undo).toHaveBeenCalledTimes(1);
    expect(service.offer()).toBeNull();
  });

  it('does nothing on accept when nothing is pending', () => {
    expect(() => service.accept()).not.toThrow();
    expect(service.offer()).toBeNull();
  });

  it('dismiss drops the offer without reversing', () => {
    const undo = vi.fn();
    service.propose('Deleted Catan.', undo);

    service.dismiss();

    expect(undo).not.toHaveBeenCalled();
    expect(service.offer()).toBeNull();
  });

  it('expires on its own after the window', () => {
    const undo = vi.fn();
    service.propose('Deleted Catan.', undo);

    vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    expect(service.offer()).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(service.offer()).toBeNull();
    expect(undo).not.toHaveBeenCalled();
  });

  it('accepting after it expires does nothing', () => {
    const undo = vi.fn();
    service.propose('Deleted Catan.', undo);
    vi.advanceTimersByTime(UNDO_WINDOW_MS);

    service.accept();
    expect(undo).not.toHaveBeenCalled();
  });

  it('a second delete replaces the first, which is no longer reversible', () => {
    const first = vi.fn();
    const second = vi.fn();

    service.propose('Deleted Catan.', first);
    vi.advanceTimersByTime(UNDO_WINDOW_MS / 2);
    service.propose('Deleted Azul.', second);

    expect(service.offer()?.message).toBe('Deleted Azul.');

    // The first offer's timer must not cut the second one short.
    vi.advanceTimersByTime(UNDO_WINDOW_MS / 2 + 1);
    expect(service.offer()?.message).toBe('Deleted Azul.');

    service.accept();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('honours a custom window', () => {
    service.propose('Gone.', vi.fn(), 1000);
    vi.advanceTimersByTime(1000);
    expect(service.offer()).toBeNull();
  });
});
