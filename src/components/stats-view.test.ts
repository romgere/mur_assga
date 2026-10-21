import { describe, expect, it } from 'vitest';
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
});
