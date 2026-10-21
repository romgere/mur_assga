import { describe, expect, it, vi } from 'vitest';
import { $, $$, miniTopo, mount, testStore } from '../test/helpers';
import { ProgressCounters } from './progress-counters';

describe('lardy-progress-counters', () => {
  it('affiche tête, moulinette et faites sur tout le topo', async () => {
    const el = new ProgressCounters();
    el.store = testStore();
    el.store.toggle('1-VERTE', 't');
    el.store.toggle('1-VERTE', 'm');
    el.store.toggle('2-ROUGE', 'm');
    await mount(el);
    const values = $$(el, '.value').map((v) => v.textContent);
    expect(values).toEqual(['1', '2', '2']);
    expect($(el, '.counter').getAttribute('aria-label')).toBe('Tête : 1 sur 5');
  });

  it('se met à jour au clic', async () => {
    const el = new ProgressCounters();
    el.store = testStore();
    await mount(el);
    el.store.toggle('1-JAUNE', 't');
    await el.updateComplete;
    expect($(el, '.value').textContent).toBe('1');
  });

  it('en version compacte, ne compte que les voies de la page', async () => {
    const el = new ProgressCounters();
    el.store = testStore();
    el.compact = true;
    el.routes = miniTopo().routes.filter((r) => r.wall === 2);
    await mount(el);
    const spy = vi.spyOn(el, 'requestUpdate');
    el.store.toggle('1-VERTE', 't');
    expect(spy).not.toHaveBeenCalled();
    el.store.toggle('2-ROUGE', 'm');
    await el.updateComplete;
    expect($(el, '.compact').textContent!.replace(/\s+/g, ' ')).toBe('1/2 faite · T 0 · M 1');
  });

  it('avec un libellé, affiche une seule carte « faites » pour ses voies', async () => {
    const el = new ProgressCounters();
    el.store = testStore();
    el.label = '6a';
    el.routes = miniTopo().routes.filter((r) => r.wall === 1);
    await mount(el);
    el.store.toggle('1-VERTE', 't');
    el.store.toggle('2-ROUGE', 't');
    await el.updateComplete;
    const cards = $$(el, '.counter');
    expect(cards).toHaveLength(1);
    expect($(el, '.label').textContent).toBe('6a');
    expect(cards[0].getAttribute('aria-label')).toBe('6a : 1 sur 3');
  });

  it('avec un libellé, compte selon « count » : faites, moulinette ou tête', async () => {
    const el = new ProgressCounters();
    el.store = testStore();
    el.label = '6a';
    el.routes = miniTopo().routes.filter((r) => r.wall === 1);
    el.store.toggle('1-VERTE', 't');
    el.store.toggle('1-JAUNE', 'm');
    el.store.toggle('1-VIOLETTE', 'm');
    await mount(el);
    const value = () => $(el, '.value').textContent;
    expect(value()).toBe('3');
    el.count = 'toprope';
    await el.updateComplete;
    expect(value()).toBe('2');
    el.count = 'lead';
    await el.updateComplete;
    expect(value()).toBe('1');
  });
});
