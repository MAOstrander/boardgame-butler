import { TestBed } from '@angular/core/testing';
import { WakeLockService } from './wake-lock';
import { FakeSentinel, removeWakeLock, stubWakeLock } from '../testing/wake-lock';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('WakeLockService', () => {
  afterEach(() => {
    removeWakeLock();
    delete (document as { visibilityState?: unknown }).visibilityState;
    vi.restoreAllMocks();
  });

  it('is unsupported, and ignores requests, without navigator.wakeLock', async () => {
    const service = TestBed.inject(WakeLockService);
    expect(service.supported).toBe(false);
    await service.request();
    expect(service.held()).toBe(false);
    service.release();
  });

  it('takes a screen lock and lets it go', async () => {
    const request = stubWakeLock();
    const service = TestBed.inject(WakeLockService);

    await service.request();
    expect(request).toHaveBeenCalledWith('screen');
    expect(service.held()).toBe(true);

    const sentinel = await request.mock.results[0].value;
    service.release();
    expect(service.held()).toBe(false);
    expect(sentinel.release).toHaveBeenCalled();
  });

  it('asks only once while a lock is held', async () => {
    const request = stubWakeLock();
    const service = TestBed.inject(WakeLockService);

    await service.request();
    await service.request();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('takes the lock back when the page returns after the browser dropped it', async () => {
    const request = stubWakeLock();
    const service = TestBed.inject(WakeLockService);
    await service.request();
    const first: FakeSentinel = await request.mock.results[0].value;

    first.drop();
    expect(service.held()).toBe(false);

    setVisibility('visible');
    await vi.waitFor(() => expect(service.held()).toBe(true));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not take it back on return once released', async () => {
    const request = stubWakeLock();
    const service = TestBed.inject(WakeLockService);
    await service.request();
    service.release();

    setVisibility('visible');
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    expect(service.held()).toBe(false);
  });

  it('gives back a lock granted after release() was already called', async () => {
    let grant!: (s: FakeSentinel) => void;
    const request = stubWakeLock(vi.fn(() => new Promise<FakeSentinel>(resolve => (grant = resolve))));
    const service = TestBed.inject(WakeLockService);

    const pending = service.request();
    service.release();
    const late = new FakeSentinel();
    grant(late);
    await pending;

    expect(request).toHaveBeenCalledTimes(1);
    expect(late.release).toHaveBeenCalled();
    expect(service.held()).toBe(false);
  });

  it('treats a refusal as not held', async () => {
    stubWakeLock(vi.fn().mockRejectedValue(new DOMException('low battery', 'NotAllowedError')));
    const service = TestBed.inject(WakeLockService);

    await expect(service.request()).resolves.toBeUndefined();
    expect(service.held()).toBe(false);
  });
});
