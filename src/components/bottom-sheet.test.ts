import { describe, expect, it, vi } from 'vitest';
import { $, mount } from '../test/helpers';
import { BottomSheet } from './bottom-sheet';

async function sheet() {
  const el = new BottomSheet();
  el.heading = 'Titre';
  el.innerHTML = '<p>Contenu</p>';
  return mount(el);
}

describe('lardy-sheet', () => {
  it('ne rend rien tant qu’elle est fermée', async () => {
    const el = await sheet();
    expect(el.shadowRoot!.querySelector('[role="dialog"]')).toBeNull();
  });

  it('s’ouvre avec un titre et une modale accessible', async () => {
    const el = await sheet();
    el.open = true;
    await el.updateComplete;
    expect($(el, '[role="dialog"]').getAttribute('aria-modal')).toBe('true');
    expect($(el, 'h2').textContent).toBe('Titre');
    expect(el.hasAttribute('open')).toBe(true);
  });

  it.each([
    ['la croix', (el: BottomSheet) => $(el, '.close').click()],
    ['le fond', (el: BottomSheet) => $(el, '.overlay').click()],
    ['Échap', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))],
  ])('se ferme par %s et émet close', async (_, action) => {
    const el = await sheet();
    el.open = true;
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener('close', spy);
    action(el);
    await el.updateComplete;
    expect(el.open).toBe(false);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('rend le focus à l’élément qui l’a ouverte', async () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    const el = await sheet();
    el.open = true;
    await el.updateComplete;
    el.close();
    await el.updateComplete;
    expect(document.activeElement).toBe(button);
    button.remove();
  });

  it('avec deux feuilles empilées, Échap ne ferme que la dernière', async () => {
    const below = await sheet();
    below.open = true;
    await below.updateComplete;
    const above = await sheet();
    above.open = true;
    await above.updateComplete;
    expect(BottomSheet.anyOpen()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    await Promise.all([below.updateComplete, above.updateComplete]);
    expect(above.open).toBe(false);
    expect(below.open).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    await below.updateComplete;
    expect(below.open).toBe(false);
    expect(BottomSheet.anyOpen()).toBe(false);
  });
});
