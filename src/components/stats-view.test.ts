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
    expect($$(el, 'h2').map((h) => h.textContent)).toEqual([
      'Globale',
      'Niveau max',
      'Répartition',
      'À retravailler',
      'Par niveau',
    ]);
  });

  async function statsWithAscents() {
    const el = new StatsView();
    el.store = testStore();
    el.store.edit('1-VERTE', { t: true, tx: ['avue'] }); // 6a
    el.store.edit('1-JAUNE', { t: true, tx: ['flash'], m: true }); // 4+
    el.store.edit('2-ROUGE', { t: true, tx: ['chute', 'partiel'], m: true, mx: ['repos'] }); // 7a
    el.store.edit('1-VIOLETTE', { t: true, tx: ['repos'] }); // 5a
    return mount(el);
  }

  it('affiche le niveau max par style', async () => {
    const el = await statsWithAscents();
    const tiles = $$(el, '.tile');
    expect(tiles.map((t) => t.dataset.status)).toEqual(['avue', 'flash', 'cleanlead', 'cleantoprope']);
    expect(tiles.map((t) => t.querySelector('.grade')!.textContent)).toEqual(['6a', '4+', '6a', '4+']);
    expect(tiles[0].querySelector('.grade')!.classList.contains('g6')).toBe(true);
    expect(tiles[2].getAttribute('aria-label')).toBe('Tête propre : 6a, 1 voie');
  });

  it('désactive une tuile sans voie', async () => {
    const el = new StatsView();
    el.store = testStore();
    await mount(el);
    const tile = $<HTMLButtonElement>(el, '.tile[data-status="avue"]');
    expect(tile.disabled).toBe(true);
    expect(tile.querySelector('.grade')!.textContent).toBe('—');
  });

  it('affiche la répartition par style pour la tête et la moulinette', async () => {
    const el = await statsWithAscents();
    const [lead, toprope] = $$(el, '.mode-row');
    expect(lead.querySelector('.count')!.textContent).toBe('4 voies');
    expect([...lead.querySelectorAll('.seg')].map((s) => s.className.split(' ')[1])).toEqual([
      'avue',
      'flash',
      'flaw',
      'partial',
    ]);
    expect(lead.querySelector('.bar')!.getAttribute('aria-label')).toBe(
      'Tête : À vue 1, Flash 1, Propre 0, Chute / repos 1, Partiel 1, sur 5 voies',
    );
    expect(toprope.querySelector('.count')!.textContent).toBe('2 voies');
    expect(toprope.querySelectorAll('.legend li')).toHaveLength(5);
  });

  it('compte les voies à retravailler et ouvre le filtre', async () => {
    const el = await statsWithAscents();
    const rows = $$<HTMLButtonElement>(el, '.rework button');
    expect(rows.map((r) => [r.dataset.status, r.querySelector('.count')!.textContent])).toEqual([
      ['partial', '1'],
      ['leadflaw', '1'],
      ['topropenotlead', '1'],
    ]);
    const spy = vi.fn();
    document.body.addEventListener('show-routes', (e) => spy((e as CustomEvent).detail.status), { once: true });
    rows[1].click();
    $(el, '.tile[data-status="avue"]').click();
    expect(spy).toHaveBeenCalledWith('leadflaw');
  });

  it('se met à jour quand le store change', async () => {
    const el = await statsWithAscents();
    el.store.clear();
    await el.updateComplete;
    expect($(el, '.tile[data-status="avue"] .grade').textContent).toBe('—');
  });
});
