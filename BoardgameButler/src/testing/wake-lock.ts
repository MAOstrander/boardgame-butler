/** Stands in for the browser's WakeLockSentinel. */
export class FakeSentinel extends EventTarget {
  released = false;
  readonly type = 'screen';
  readonly release = vi.fn(async () => {
    this.released = true;
  });

  /** What the browser does when the page is hidden. */
  drop() {
    this.released = true;
    this.dispatchEvent(new Event('release'));
  }
}

/** Installs a fake navigator.wakeLock (jsdom has none) and returns its request mock. */
export function stubWakeLock(request = vi.fn(async () => new FakeSentinel())) {
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  return request;
}

export function removeWakeLock() {
  delete (navigator as { wakeLock?: unknown }).wakeLock;
}
