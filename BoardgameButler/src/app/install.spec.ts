import { TestBed } from '@angular/core/testing';
import { BeforeInstallPromptEvent, InstallService } from './install';

/** A stand-in for Chrome's non-standard event. */
function installEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent & {
    prompt: ReturnType<typeof vi.fn>;
  };
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  });
  return event;
}

describe('InstallService', () => {
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    vi.restoreAllMocks();
  });

  /** jsdom has no matchMedia, so display-mode has to be stubbed in. */
  function create(standalone = false) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({ matches: standalone } as MediaQueryList),
    });
    return TestBed.inject(InstallService);
  }

  it('copes with a browser that has no matchMedia at all', () => {
    expect((window as { matchMedia?: unknown }).matchMedia).toBeUndefined();
    const service = TestBed.inject(InstallService);
    expect(service.installed()).toBe(false);

    window.dispatchEvent(installEvent());
    expect(service.canInstall()).toBe(true);
  });

  it('offers nothing until the browser says the app can be installed', () => {
    const service = create();
    expect(service.canInstall()).toBe(false);
    expect(service.installed()).toBe(false);
  });

  it('becomes available when the browser fires beforeinstallprompt', () => {
    const service = create();
    window.dispatchEvent(installEvent());
    expect(service.canInstall()).toBe(true);
  });

  it('keeps the event to itself so the browser does not act on it', () => {
    create();
    const event = installEvent();
    const prevented = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(prevented).toHaveBeenCalled();
  });

  it('starts out installed when already running standalone, and offers nothing', () => {
    const service = create(true);
    expect(service.installed()).toBe(true);

    window.dispatchEvent(installEvent());
    expect(service.canInstall()).toBe(false);
  });

  describe('prompt()', () => {
    it('does nothing when no install has been offered', async () => {
      const service = create();
      await expect(service.prompt()).resolves.toBe('unavailable');
    });

    it('shows the browser dialog and reports acceptance', async () => {
      const service = create();
      const event = installEvent('accepted');
      window.dispatchEvent(event);

      await expect(service.prompt()).resolves.toBe('accepted');
      expect(event.prompt).toHaveBeenCalledTimes(1);
      expect(service.installed()).toBe(true);
      expect(service.canInstall()).toBe(false);
    });

    it('reports a dismissal without marking the app installed', async () => {
      const service = create();
      window.dispatchEvent(installEvent('dismissed'));

      await expect(service.prompt()).resolves.toBe('dismissed');
      expect(service.installed()).toBe(false);
      // The event is single-use, so the offer is gone either way.
      expect(service.canInstall()).toBe(false);
      await expect(service.prompt()).resolves.toBe('unavailable');
    });

    it('treats a prompt that throws as a dismissal', async () => {
      const service = create();
      const event = installEvent();
      event.prompt = vi.fn().mockRejectedValue(new Error('already used'));
      window.dispatchEvent(event);

      await expect(service.prompt()).resolves.toBe('dismissed');
      expect(service.installed()).toBe(false);
    });
  });

  it('stops offering once the app reports itself installed', () => {
    const service = create();
    window.dispatchEvent(installEvent());
    expect(service.canInstall()).toBe(true);

    window.dispatchEvent(new Event('appinstalled'));

    expect(service.installed()).toBe(true);
    expect(service.canInstall()).toBe(false);
  });
});
