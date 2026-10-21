import { describe, expect, it, vi } from 'vitest';
import { fakeWindow, installPrompt, testPwa } from '../test/helpers';
import { PwaState, isIos } from './pwa';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';

describe('PwaState : installation', () => {
  it('reconnaît une application déjà installée', () => {
    expect(testPwa({ standalone: true }).installMode).toBe('installed');
  });

  it('propose la marche à suivre sur iOS, l’installation manuelle ailleurs', () => {
    expect(testPwa({ userAgent: IPHONE }).installMode).toBe('ios');
    expect(testPwa().installMode).toBe('manual');
  });

  it('reconnaît un iPad qui se présente comme un Mac', () => {
    expect(isIos({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 } as Navigator)).toBe(true);
    expect(isIos({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 } as Navigator)).toBe(false);
  });

  it('garde l’invite du navigateur et l’ouvre à la demande', async () => {
    const win = fakeWindow();
    const pwa = new PwaState(win);
    pwa.listen();
    const changes = vi.fn();
    pwa.addEventListener('change', changes);
    const event = installPrompt('accepted');
    win.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(pwa.installMode).toBe('prompt');
    expect(await pwa.install()).toBe(true);
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(pwa.installMode).toBe('installed');
    expect(changes).toHaveBeenCalledTimes(2);
  });

  it('n’utilise une invite refusée qu’une fois', async () => {
    const win = fakeWindow();
    const pwa = new PwaState(win);
    pwa.listen();
    win.dispatchEvent(installPrompt('dismissed'));
    expect(await pwa.install()).toBe(false);
    expect(pwa.installMode).toBe('manual');
    expect(await pwa.install()).toBe(false);
  });

  it('passe en installée sur appinstalled', () => {
    const win = fakeWindow();
    const pwa = new PwaState(win);
    pwa.listen();
    win.dispatchEvent(new Event('appinstalled'));
    expect(pwa.installMode).toBe('installed');
  });
});

describe('PwaState : mise à jour', () => {
  it('signale une mise à jour et l’applique', async () => {
    const pwa = testPwa();
    const apply = vi.fn().mockResolvedValue(undefined);
    expect(pwa.needRefresh).toBe(false);
    pwa.setUpdateAvailable(apply);
    expect(pwa.needRefresh).toBe(true);
    await pwa.update();
    expect(apply).toHaveBeenCalledOnce();
  });

  it('« Plus tard » masque la mise à jour', () => {
    const pwa = testPwa();
    pwa.setUpdateAvailable(vi.fn());
    pwa.dismissUpdate();
    expect(pwa.needRefresh).toBe(false);
  });
});
