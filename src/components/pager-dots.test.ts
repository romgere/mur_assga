import { describe, expect, it, vi } from 'vitest';
import { wallPages } from '../lib/views';
import { $$, miniTopo, mount, testStore } from '../test/helpers';
import { PagerDots } from './pager-dots';

async function dots() {
  const el = new PagerDots();
  el.pages = wallPages(miniTopo());
  el.store = testStore();
  return mount(el);
}

describe('lardy-pager-dots', () => {
  it('affiche une pastille par page et suit la page courante', async () => {
    const el = await dots();
    let buttons = $$(el, 'button');
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['1', '2']);
    expect(buttons[0].getAttribute('aria-current')).toBe('page');
    el.index = 1;
    await el.updateComplete;
    buttons = $$(el, 'button');
    expect(buttons[1].getAttribute('aria-current')).toBe('page');
    expect(buttons[0].getAttribute('aria-current')).toBe('false');
  });

  it('montre un point en partie fait puis complet', async () => {
    const el = await dots();
    expect(el.shadowRoot!.querySelector('.dot')).toBeNull();
    el.store.toggle('2-ROUGE', 't');
    await el.updateComplete;
    expect($$(el, 'button')[1].dataset.status).toBe('partial');
    expect($$(el, '.dot.partial')).toHaveLength(1);
    el.store.toggle('2-BEIGE', 'm');
    await el.updateComplete;
    expect($$(el, 'button')[1].dataset.status).toBe('complete');
    expect($$(el, 'button')[1].getAttribute('aria-label')).toBe('Mur 2, toutes faites');
  });

  it('émet page-select au clic', async () => {
    const el = await dots();
    const spy = vi.fn();
    el.addEventListener('page-select', (e) => spy((e as CustomEvent).detail.index));
    $$(el, 'button')[1].click();
    expect(spy).toHaveBeenCalledWith(1);
  });
});
