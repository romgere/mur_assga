import { describe, expect, it, vi } from 'vitest';
import { ProgressSync } from '../lib/sync';
import { $, memoryStorage, mount, settle, testStore } from '../test/helpers';
import { SyncPanel } from './sync-panel';

/** Serveur minimal : accepte tout, ne garde rien. */
function okFetch() {
  return vi.fn(async (url: RequestInfo | URL, init: RequestInit = {}) => {
    if ((init.method ?? 'GET') === 'GET') {
      // Le code ABCD… a une sauvegarde ; les autres non.
      const known = new Headers(init.headers).get('Authorization')!.includes('ABCDEFGH');
      if (String(url) === '/api/progress') return Response.json({ seasons: known ? ['2026-2027'] : [] });
      return Response.json({ error: 'absent' }, { status: 404 });
    }
    return Response.json({ rev: 1, ok: true });
  });
}

async function panel(fetchFn = okFetch()) {
  const storage = memoryStorage();
  const el = new SyncPanel();
  el.sync = new ProgressSync(testStore(storage), storage, fetchFn as typeof fetch, 5);
  await mount(el);
  return { el, fetchFn };
}

function text(el: SyncPanel) {
  return el.shadowRoot!.textContent!.replace(/\s+/g, ' ');
}

describe('lardy-sync-panel', () => {
  it('propose d’activer la synchronisation ou de saisir un code', async () => {
    const { el, fetchFn } = await panel();
    expect(text(el)).toContain('Activer la sauvegarde en ligne');
    expect($<HTMLButtonElement>(el, 'button.link-code').disabled).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('active la synchronisation et affiche le code et l’état', async () => {
    const { el } = await panel();
    $(el, 'button.enable').click();
    await vi.waitFor(() => expect(el.sync.status).toBe('synced'));
    await settle(el);
    expect($(el, '.code').textContent).toBe(el.sync.displayCode);
    expect(text(el)).toContain('Sauvegardé');
    expect(text(el)).toContain('Gardez ce code en lieu sûr (note, e-mail, papier)');
  });

  it('signale un code mal saisi', async () => {
    const { el, fetchFn } = await panel();
    const input = $<HTMLInputElement>(el, 'input.code-input');
    input.value = 'ABCD-EFGH';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;
    $(el, 'button.link-code').click();
    await settle(el);
    expect(text(el)).toContain('Code invalide');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('signale un code sans sauvegarde en ligne', async () => {
    const { el } = await panel();
    const input = $<HTMLInputElement>(el, 'input.code-input');
    input.value = 'ZZZZ-EFGH-IJKL-MNOP-QRST-UVWX';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;
    $(el, 'button.link-code').click();
    await vi.waitFor(() => expect(text(el)).toContain('Aucune sauvegarde trouvée pour ce code'));
    expect(el.sync.enabled).toBe(false);
  });

  it('explique une désactivation venue d’un autre appareil', async () => {
    const { el } = await panel();
    await el.sync.enable();
    el.sync.disable('Sauvegarde en ligne effacée depuis un autre appareil.');
    await settle(el);
    expect(text(el)).toContain('Sauvegarde en ligne effacée depuis un autre appareil.');
    expect(text(el)).toContain('Activer la sauvegarde en ligne');
  });

  it('rejoint un code existant', async () => {
    const { el } = await panel();
    const input = $<HTMLInputElement>(el, 'input.code-input');
    input.value = 'abcd-efgh-ijkl-mnop-qrst-uvwx';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;
    $(el, 'button.link-code').click();
    await vi.waitFor(() => expect(el.sync.enabled).toBe(true));
    await settle(el);
    expect($(el, '.code').textContent).toBe('ABCD-EFGH-IJKL-MNOP-QRST-UVWX');
  });

  it('affiche l’état hors ligne', async () => {
    const fetchFn = okFetch();
    const { el } = await panel(fetchFn);
    await el.sync.enable();
    fetchFn.mockRejectedValue(new TypeError('Failed to fetch'));
    $(el, 'button.sync-now').click();
    await vi.waitFor(() => expect(el.sync.status).toBe('offline'));
    await settle(el);
    expect(text(el)).toContain('Hors ligne');
  });

  it('efface les données en ligne après confirmation', async () => {
    const { el, fetchFn } = await panel();
    await el.sync.enable();
    await settle(el);
    $(el, 'button.delete-remote').click();
    await el.updateComplete;
    expect(text(el)).toContain('Appuyez à nouveau pour confirmer.');
    expect(fetchFn).not.toHaveBeenCalledWith('/api/progress', expect.anything());
    $(el, 'button.delete-remote').click();
    await vi.waitFor(() => expect(el.sync.enabled).toBe(false));
    expect(fetchFn).toHaveBeenCalledWith('/api/progress', expect.objectContaining({ method: 'DELETE' }));
    await settle(el);
    expect(text(el)).toContain('Sauvegarde en ligne effacée');
  });

  it('se désactive sur cet appareil', async () => {
    const { el } = await panel();
    await el.sync.enable();
    await settle(el);
    $(el, 'button.disable').click();
    await settle(el);
    expect(el.sync.enabled).toBe(false);
    expect(text(el)).toContain('Activer la sauvegarde en ligne');
  });
});
