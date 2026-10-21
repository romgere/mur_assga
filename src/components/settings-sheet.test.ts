import { afterEach, describe, expect, it, vi } from 'vitest';
import { $, mount, settle, testStore } from '../test/helpers';
import type { BottomSheet } from './bottom-sheet';
import { CLEAR_CONFIRM_MS, SettingsSheet } from './settings-sheet';

async function settings() {
  const el = new SettingsSheet();
  el.store = testStore();
  el.store.toggle('1-VERTE', 't');
  el.open = true;
  await mount(el);
  await settle(el, $<BottomSheet>(el, 'lardy-sheet'));
  return el;
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

  it('efface tout en deux temps', async () => {
    const el = await settings();
    $(el, 'button.clear').click();
    await el.updateComplete;
    expect(el.store.get('1-VERTE')).toEqual({ t: true });
    expect($(el, 'button.clear').textContent!.trim()).toBe('Confirmer l’effacement');
    $(el, 'button.clear').click();
    await el.updateComplete;
    expect(el.store.get('1-VERTE')).toEqual({});
    expect(el.shadowRoot!.textContent).toContain('Données effacées.');
  });

  it('annule la confirmation après un délai', async () => {
    const el = await settings();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    $(el, 'button.clear').click();
    vi.advanceTimersByTime(CLEAR_CONFIRM_MS + 10);
    await el.updateComplete;
    expect($(el, 'button.clear').textContent!.trim()).toBe('Tout effacer');
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
});
