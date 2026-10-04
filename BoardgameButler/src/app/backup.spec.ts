import { TestBed } from '@angular/core/testing';
import { BackupService, LAST_EXPORT_KEY, STALE_AFTER_DAYS } from './backup';

const NOW = new Date(2026, 9, 4, 12, 0); // 4 Oct 2026, local

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString();
}

describe('BackupService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reports never when nothing has been exported', () => {
    const service = TestBed.inject(BackupService);
    expect(service.lastExport()).toBeNull();
    expect(service.daysSince()).toBeNull();
    expect(service.describe()).toBe('never');
    expect(service.stale()).toBe(true);
  });

  it('records an export and persists it', () => {
    const service = TestBed.inject(BackupService);
    service.recordExport();

    expect(service.lastExport()).toBe(NOW.toISOString());
    expect(localStorage.getItem(LAST_EXPORT_KEY)).toBe(NOW.toISOString());
    expect(service.describe()).toBe('today');
    expect(service.stale()).toBe(false);
  });

  it.each([
    [0, 'today'],
    [1, 'yesterday'],
    [5, '5 days ago'],
    [47, '47 days ago'],
  ])('describes an export %i days old as "%s"', (days, expected) => {
    localStorage.setItem(LAST_EXPORT_KEY, daysAgo(days));
    const service = TestBed.inject(BackupService);

    expect(service.daysSince()).toBe(days);
    expect(service.describe()).toBe(expected);
  });

  it('goes stale on the threshold, not before', () => {
    localStorage.setItem(LAST_EXPORT_KEY, daysAgo(STALE_AFTER_DAYS - 1));
    expect(TestBed.inject(BackupService).stale()).toBe(false);

    TestBed.resetTestingModule();
    localStorage.setItem(LAST_EXPORT_KEY, daysAgo(STALE_AFTER_DAYS));
    expect(TestBed.inject(BackupService).stale()).toBe(true);
  });

  it('treats an unreadable stored value as never', () => {
    localStorage.setItem(LAST_EXPORT_KEY, 'not a date');
    const service = TestBed.inject(BackupService);

    expect(service.daysSince()).toBeNull();
    expect(service.describe()).toBe('never');
  });

  it('never reports a negative age, even if the clock moved backwards', () => {
    localStorage.setItem(LAST_EXPORT_KEY, daysAgo(-3));
    expect(TestBed.inject(BackupService).daysSince()).toBe(0);
  });

  it('still reports the export when it cannot be written down', () => {
    const service = TestBed.inject(BackupService);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(() => service.recordExport()).not.toThrow();
    expect(service.describe()).toBe('today');
  });
});
