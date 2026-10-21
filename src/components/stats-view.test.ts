import { describe, expect, it, vi } from 'vitest';
import { $, $$, mount, testStore } from '../test/helpers';
import type { ProgressCounters } from './progress-counters';
import { StatsView } from './stats-view';

describe('lardy-stats-view', () => {
  it('affiche les compteurs globaux du store', async () => {
    const el = new StatsView();
    el.store = testStore();
    el.store.toggle('1-VERTE', 't');
    await mount(el);
    const counters = $<ProgressCounters>(el, 'lardy-progress-counters');
    expect(counters.store).toBe(el.store);
    expect(counters.routes).toBeUndefined();
    await counters.updateComplete;
    expect($$(counters, '.value').map((v) => v.textContent)).toEqual(['1', '0', '1']);
  });

  it('affiche une carte « faites / total » par cotation, sans la traversée', async () => {
    const el = new StatsView();
    el.store = testStore();
    el.store.toggle('1-VERTE', 'm');
    await mount(el);
    const cards = $$<ProgressCounters>(el, '.grades lardy-progress-counters');
    expect(cards.map((c) => c.label)).toEqual(['4+', '5a', '6a', '7a']);
    const sixA = cards[2];
    await sixA.updateComplete;
    expect($(sixA, '.counter').getAttribute('aria-label')).toBe('6a : 1 sur 1');
    expect(sixA.style.getPropertyValue('--bar')).toBe('var(--g6)');
  });

  it('filtre les cartes par niveau et émet count-change', async () => {
    const el = new StatsView();
    el.store = testStore();
    el.store.toggle('1-VERTE', 't');
    await mount(el);
    const spy = vi.fn();
    el.addEventListener('count-change', (e) => spy((e as CustomEvent).detail.count));
    const radios = $$(el, '[role="radio"]');
    expect(radios.map((r) => r.textContent!.trim())).toEqual(['Toutes', 'Moulinette', 'En tête']);
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    radios[1].click();
    await el.updateComplete;
    expect(spy).toHaveBeenCalledWith('toprope');
    const cards = $$<ProgressCounters>(el, '.grades lardy-progress-counters');
    expect(cards.every((c) => c.count === 'toprope')).toBe(true);
    await cards[2].updateComplete;
    expect($(cards[2], '.value').textContent).toBe('0');
    expect($$(el, 'h2').map((h) => h.textContent)).toEqual(['Globale', 'Par niveau']);
  });
});
