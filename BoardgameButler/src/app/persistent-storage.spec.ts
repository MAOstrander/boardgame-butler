import { TestBed } from '@angular/core/testing';
import { PersistentStorageService } from './persistent-storage';

describe('PersistentStorageService', () => {
  /** jsdom has no navigator.storage, so each case supplies its own. */
  function stub(value: unknown) {
    Object.defineProperty(navigator, 'storage', { configurable: true, value });
  }

  afterEach(() => {
    delete (navigator as { storage?: unknown }).storage;
    vi.restoreAllMocks();
  });

  it('reports unknown when the browser has no storage manager', async () => {
    stub(undefined);
    const service = TestBed.inject(PersistentStorageService);

    await expect(service.ensure()).resolves.toBeNull();
    expect(service.persisted()).toBeNull();
  });

  it('reports unknown when persist() is unavailable', async () => {
    stub({ persisted: vi.fn() });
    const service = TestBed.inject(PersistentStorageService);

    await expect(service.ensure()).resolves.toBeNull();
    expect(service.persisted()).toBeNull();
  });

  it('asks for persistence and reports a grant', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stub({ persist, persisted: vi.fn().mockResolvedValue(false) });
    const service = TestBed.inject(PersistentStorageService);

    await expect(service.ensure()).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(service.persisted()).toBe(true);
  });

  it('reports a refusal', async () => {
    stub({ persist: vi.fn().mockResolvedValue(false), persisted: vi.fn().mockResolvedValue(false) });
    const service = TestBed.inject(PersistentStorageService);

    await expect(service.ensure()).resolves.toBe(false);
    expect(service.persisted()).toBe(false);
  });

  it('does not ask again when storage is already persistent', async () => {
    const persist = vi.fn();
    stub({ persist, persisted: vi.fn().mockResolvedValue(true) });
    const service = TestBed.inject(PersistentStorageService);

    await expect(service.ensure()).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('copes with a browser that throws instead of resolving', async () => {
    stub({ persist: vi.fn().mockRejectedValue(new Error('nope')), persisted: vi.fn().mockResolvedValue(false) });
    const service = TestBed.inject(PersistentStorageService);

    await expect(service.ensure()).resolves.toBeNull();
    expect(service.persisted()).toBeNull();
  });

  it('works when persisted() is missing but persist() is not', async () => {
    stub({ persist: vi.fn().mockResolvedValue(true) });
    const service = TestBed.inject(PersistentStorageService);

    await expect(service.ensure()).resolves.toBe(true);
  });
});
