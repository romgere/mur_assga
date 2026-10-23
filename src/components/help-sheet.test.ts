import { describe, expect, it, vi } from 'vitest';
import { DETAILS } from '../lib/progress-store';
import { $, $$, mount, settle } from '../test/helpers';
import type { BottomSheet } from './bottom-sheet';
import { HelpSheet, OPEN_HELP, requestHelp } from './help-sheet';

async function help() {
  const el = new HelpSheet();
  el.open = true;
  await mount(el);
  await settle(el, $<BottomSheet>(el, 'lardy-sheet'));
  return el;
}

describe('lardy-help-sheet', () => {
  it('décrit chaque détail et indique s’il compte comme fait', async () => {
    const el = await help();
    const items = $$(el, 'li').filter((li) => li.querySelector('.done'));
    // Tête, moulinette, sans détail, puis chaque détail.
    expect(items).toHaveLength(3 + DETAILS.length);
    const partiel = items.find((li) => li.querySelector('strong')!.textContent === 'Partiel')!;
    expect(partiel.querySelector('.done')!.textContent).toBe('✗ Pas faite');
    const avue = items.find((li) => li.querySelector('strong')!.textContent === 'À vue')!;
    expect(avue.querySelector('.done')!.textContent).toBe('✓ Faite');
    expect(avue.textContent).toContain('premier essai');
  });

  it('se ferme et émet close', async () => {
    const el = await help();
    const spy = vi.fn();
    el.addEventListener('close', spy);
    $<BottomSheet>(el, 'lardy-sheet').close();
    await el.updateComplete;
    expect(el.open).toBe(false);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('requestHelp émet un événement qui traverse le shadow DOM', () => {
    const spy = vi.fn();
    document.body.addEventListener(OPEN_HELP, spy, { once: true });
    const host = document.createElement('div');
    document.body.append(host);
    const inner = host.attachShadow({ mode: 'open' }).appendChild(document.createElement('span'));
    requestHelp(inner);
    expect(spy).toHaveBeenCalledOnce();
    host.remove();
  });
});
