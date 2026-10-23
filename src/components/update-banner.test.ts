import { describe, expect, it, vi } from 'vitest';
import { $, mount, testPwa } from '../test/helpers';
import { UpdateBanner } from './update-banner';

async function banner() {
  const el = new UpdateBanner();
  el.pwa = testPwa();
  return mount(el);
}

describe('lardy-update-banner', () => {
  it('ne montre rien sans mise à jour', async () => {
    const el = await banner();
    expect(el.shadowRoot!.querySelector('.banner')).toBeNull();
  });

  it('apparaît quand une mise à jour attend et l’applique', async () => {
    const el = await banner();
    const apply = vi.fn().mockResolvedValue(undefined);
    el.pwa.setUpdateAvailable(apply);
    await el.updateComplete;
    expect($(el, '.banner').textContent).toContain('Nouvelle version disponible');
    $(el, 'button.update').click();
    expect(apply).toHaveBeenCalledOnce();
  });

  it('disparaît avec « Plus tard »', async () => {
    const el = await banner();
    el.pwa.setUpdateAvailable(vi.fn());
    await el.updateComplete;
    $(el, 'button.later').click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.banner')).toBeNull();
  });

  it('montre un bouton (i) avec les nouveautés de la mise à jour', async () => {
    const el = await banner();
    el.pwa.setUpdateAvailable(vi.fn());
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('button.info')).toBeNull();
    const notes = [{ version: '9.0.0', date: '2026-12-01', notes: ['Nouveau'] }];
    el.pwa.setUpdateNotes(notes);
    await el.updateComplete;
    const shown = vi.fn();
    el.addEventListener('show-release-notes', (e) => shown((e as CustomEvent).detail));
    $(el, 'button.info').click();
    expect(shown).toHaveBeenCalledWith({ heading: 'Nouveautés de la mise à jour', notes });
  });
});
