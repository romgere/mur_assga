import { afterEach, describe, expect, it, vi } from 'vitest';
import { PwaState } from '../lib/pwa';
import { ProgressSync } from '../lib/sync';
import { $, fakeWindow, installPrompt, memoryStorage, mount, settle, testPwa, testStore } from '../test/helpers';
import type { BottomSheet } from './bottom-sheet';
import { APP_VERSION, RELEASE_NOTES } from '../lib/release-notes';
import { AUTHOR_URL, CLEAR_CONFIRM_MS, REPO_URL, SettingsSheet } from './settings-sheet';

async function settings(pwa = testPwa()) {
  const el = new SettingsSheet();
  el.pwa = pwa;
  const storage = memoryStorage();
  el.store = testStore(storage);
  el.store.toggle('1-VERTE', 't');
  el.sync = new ProgressSync(el.store, storage, syncFetch as typeof fetch, 5);
  el.open = true;
  await mount(el);
  await settle(el, $<BottomSheet>(el, 'lardy-sheet'));
  return el;
}

/** Serveur de synchro minimal : rien en ligne, toute écriture acceptée. */
async function syncFetch(_url: RequestInfo | URL, init: RequestInit = {}) {
  if ((init.method ?? 'GET') === 'GET') return Response.json({ error: 'absent' }, { status: 404 });
  return Response.json({ rev: 1 });
}

function field(el: SettingsSheet, cls: string) {
  return el.shadowRoot!.querySelector<HTMLTextAreaElement>(`textarea.${cls}`)!;
}

afterEach(() => vi.useRealTimers());

describe('lardy-settings-sheet', () => {
  it('sélectionne le thème et émet theme-change', async () => {
    const el = await settings();
    const spy = vi.fn();
    el.addEventListener('theme-change', (e) => spy((e as CustomEvent).detail.theme));
    $(el, '[data-theme="dark"]').click();
    await el.updateComplete;
    expect(spy).toHaveBeenCalledWith('dark');
    expect($(el, '[data-theme="dark"]').getAttribute('aria-checked')).toBe('true');
  });

  it('affiche la sauvegarde JSON et la copie', async () => {
    const el = await settings();
    const text = field(el, 'export').value;
    expect(JSON.parse(text).progress).toEqual({ '1-VERTE': { t: true } });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    $(el, 'button.copy').click();
    await settle(el);
    expect(writeText).toHaveBeenCalledWith(text);
    expect(el.shadowRoot!.textContent).toContain('Copié !');
  });

  it('restaure une sauvegarde valide', async () => {
    const el = await settings();
    const input = field(el, 'import');
    input.value = JSON.stringify({ app: 'lardy2026', version: 1, progress: { '2-ROUGE': { m: true } } });
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;
    $(el, 'button.restore').click();
    await el.updateComplete;
    expect(el.store.get('2-ROUGE')).toEqual({ m: true });
    expect(el.store.get('1-VERTE')).toEqual({});
    expect(el.shadowRoot!.textContent).toContain('1 voie restaurée');
  });

  it('refuse une sauvegarde invalide et garde les données', async () => {
    const el = await settings();
    const input = field(el, 'import');
    input.value = '{oops';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;
    $(el, 'button.restore').click();
    await el.updateComplete;
    expect($(el, '.feedback.error').textContent).toContain('JSON valide');
    expect(el.store.get('1-VERTE')).toEqual({ t: true });
  });

  it('remet les voies à zéro en deux temps', async () => {
    const el = await settings();
    $(el, 'button.clear').click();
    await el.updateComplete;
    expect(el.store.get('1-VERTE')).toEqual({ t: true });
    expect($(el, 'button.clear').textContent!.trim()).toBe('Confirmer la remise à zéro');
    $(el, 'button.clear').click();
    await el.updateComplete;
    expect(el.store.get('1-VERTE')).toEqual({});
    expect(el.shadowRoot!.textContent).toContain('Voies remises à zéro.');
  });

  it('annule la confirmation après un délai', async () => {
    const el = await settings();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    $(el, 'button.clear').click();
    vi.advanceTimersByTime(CLEAR_CONFIRM_MS + 10);
    await el.updateComplete;
    expect($(el, 'button.clear').textContent!.trim()).toBe('Remettre à zéro');
    $(el, 'button.clear').click();
    expect(el.store.get('1-VERTE')).toEqual({ t: true });
  });

  it('prévient si le stockage n’est pas persistant', async () => {
    const el = new SettingsSheet();
    el.store = testStore({ get: () => null, set() {}, remove() {}, persistent: false });
    el.open = true;
    await mount(el);
    expect($(el, '.warning').textContent).toContain('navigation privée');
  });

  it('affiche le bouton d’installation quand le navigateur le permet', async () => {
    const win = fakeWindow();
    const pwa = new PwaState(win);
    pwa.listen();
    const el = await settings(pwa);
    expect(el.shadowRoot!.querySelector('button.install')).toBeNull();
    expect($(el, '.install-manual').textContent).toContain('Installer l’application');
    const event = installPrompt('accepted');
    win.dispatchEvent(event);
    await el.updateComplete;
    $(el, 'button.install').click();
    await settle(el);
    expect(event.prompt).toHaveBeenCalledOnce();
    expect($(el, '.install-status').textContent).toContain('installée');
    expect(el.shadowRoot!.querySelector('.install-intro')).toBeNull();
  });

  it('donne la marche à suivre sur iPhone', async () => {
    const el = await settings(testPwa({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }));
    expect($(el, '.install-intro').textContent).toBe('Installez l’application pour l’utiliser hors ligne (optionnel).');
    const steps = el.shadowRoot!.querySelectorAll('.ios-steps li');
    expect(steps).toHaveLength(3);
    expect(steps[2].textContent).toContain('Sur l’écran d’accueil');
  });

  it('crédite l’auteur avec un lien vers son site et le dépôt', async () => {
    const el = await settings();
    expect($(el, '.about').textContent).not.toContain('topo du');
    const credits = $(el, '.credits');
    expect(credits.textContent!.replace(/\s+/g, ' ')).toContain('Vibe codé avec ❤️ par Jérôme - Contribuer');
    const [author, repo] = [...credits.querySelectorAll('a')];
    expect(author.textContent).toBe('Jérôme');
    expect(author.getAttribute('href')).toBe(AUTHOR_URL);
    expect(author.getAttribute('target')).toBe('_blank');
    expect(repo.getAttribute('href')).toBe(REPO_URL);
    expect(repo.getAttribute('target')).toBe('_blank');
  });

  it('affiche les nouveautés de la version installée', async () => {
    const el = await settings();
    expect(el.shadowRoot!.textContent).toContain(`Version ${APP_VERSION} installée.`);
    const shown = vi.fn();
    el.addEventListener('show-release-notes', (e) => shown((e as CustomEvent).detail));
    $(el, 'button.release-notes').click();
    expect(shown).toHaveBeenCalledWith({ heading: 'Nouveautés', notes: [RELEASE_NOTES[0]] });
  });

  it('masque la sauvegarde manuelle tant que la synchronisation est active', async () => {
    const el = await settings();
    const shadow = el.shadowRoot!;
    expect(shadow.querySelector('lardy-sync-panel')).not.toBeNull();
    expect(shadow.querySelector('textarea.export')).not.toBeNull();
    expect(shadow.querySelector('textarea.import')).not.toBeNull();

    await el.sync.enable();
    await settle(el);
    expect(shadow.querySelector('textarea.export')).toBeNull();
    expect(shadow.querySelector('textarea.import')).toBeNull();
    expect(shadow.textContent).toContain('sur vos appareils synchronisés');

    el.sync.disable();
    await settle(el);
    expect(shadow.querySelector('textarea.export')).not.toBeNull();
  });
});
