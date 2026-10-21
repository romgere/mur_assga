import { describe, expect, it, vi } from 'vitest';
import { $$, mount } from '../test/helpers';
import { ModeTabs } from './mode-tabs';

describe('lardy-mode-tabs', () => {
  it('affiche les trois modes et marque le mode courant', async () => {
    const el = new ModeTabs();
    el.mode = 'grade';
    await mount(el);
    const tabs = $$(el, '[role="tab"]');
    expect(tabs.map((t) => t.textContent!.trim())).toEqual(['Par mur', 'Par difficulté', 'Toutes']);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
  });

  it('émet mode-change au changement, pas sur le mode courant', async () => {
    const el = await mount(new ModeTabs());
    const spy = vi.fn();
    el.addEventListener('mode-change', (e) => spy((e as CustomEvent).detail.mode));
    const tabs = $$(el, '[role="tab"]');
    tabs[0].click();
    tabs[2].click();
    expect(spy.mock.calls).toEqual([['all']]);
    expect(el.mode).toBe('all');
  });
});
