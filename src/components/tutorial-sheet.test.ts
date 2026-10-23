import { describe, expect, it, vi } from 'vitest';
import { $, $$, mount, settle } from '../test/helpers';
import type { BottomSheet } from './bottom-sheet';
import { OPEN_HELP } from './help-sheet';
import { TutorialSheet } from './tutorial-sheet';

async function sheet() {
  const el = new TutorialSheet();
  el.open = true;
  await mount(el);
  await settle(el, $<BottomSheet>(el, 'lardy-sheet'));
  return el;
}

const heading = (el: TutorialSheet) => $<BottomSheet>(el, 'lardy-sheet').heading;

describe('lardy-tutorial-sheet', () => {
  it('avance avec Suivant et se termine sur « C’est parti ! »', async () => {
    const el = await sheet();
    const close = vi.fn();
    el.addEventListener('close', close);
    const dots = $$(el, '.dots button');
    expect(heading(el)).toBe('Bienvenue !');
    for (let i = 1; i < dots.length; i++) {
      $(el, 'button.next').click();
      await settle(el);
    }
    expect(heading(el)).toBe('Réglages');
    expect(el.shadowRoot!.querySelector('button.skip')).toBeNull();
    expect($(el, 'button.next').textContent!.trim()).toBe('C’est parti !');
    $(el, 'button.next').click();
    expect(close).toHaveBeenCalledOnce();
    expect(el.open).toBe(false);
  });

  it('se passe à tout moment', async () => {
    const el = await sheet();
    const close = vi.fn();
    el.addEventListener('close', close);
    $(el, 'button.skip').click();
    expect(close).toHaveBeenCalledOnce();
    expect(el.open).toBe(false);
  });

  it('va à l’étape d’une pastille et repart du début à la réouverture', async () => {
    const el = await sheet();
    $$(el, '.dots button')[2].click();
    await settle(el);
    expect(heading(el)).toBe('Cocher une voie');
    expect($$(el, '.dots button')[2].getAttribute('aria-current')).toBe('step');
    el.open = false;
    await settle(el);
    el.open = true;
    await settle(el);
    expect(heading(el)).toBe('Bienvenue !');
  });

  it('change d’étape par un glissement horizontal', async () => {
    const el = await sheet();
    const step = $(el, '.step');
    step.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200 }));
    step.dispatchEvent(new PointerEvent('pointerup', { clientX: 100 }));
    await settle(el);
    expect(heading(el)).toBe('Parcourir les voies');
    step.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100 }));
    step.dispatchEvent(new PointerEvent('pointerup', { clientX: 120 }));
    await settle(el);
    expect(heading(el)).toBe('Parcourir les voies');
    step.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100 }));
    step.dispatchEvent(new PointerEvent('pointerup', { clientX: 200 }));
    await settle(el);
    expect(heading(el)).toBe('Bienvenue !');
  });

  it('ouvre l’aide sur les états d’une voie', async () => {
    const el = await sheet();
    const help = vi.fn();
    document.addEventListener(OPEN_HELP, help);
    $$(el, '.dots button')[2].click();
    await settle(el);
    $(el, 'button.help').click();
    document.removeEventListener(OPEN_HELP, help);
    expect(help).toHaveBeenCalledOnce();
  });
});
