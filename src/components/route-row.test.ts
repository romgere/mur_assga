import { describe, expect, it, vi } from 'vitest';
import { $, miniTopo, mount, testStore } from '../test/helpers';
import { RouteRow } from './route-row';

const topo = miniTopo();
const route = (id: string) => topo.routes.find((r) => r.id === id)!;

async function row(id = '1-VERTE', showWall = false) {
  const el = new RouteRow();
  el.route = route(id);
  el.store = testStore();
  el.showWall = showWall;
  return mount(el);
}

describe('lardy-route-row', () => {
  it('affiche couleur, cotation et initiales', async () => {
    const el = await row();
    expect($(el, '.swatch').textContent).toBe('VERTE');
    expect($(el, '.grade').textContent).toBe('6a');
    expect($(el, '.grade').classList.contains('g6')).toBe(true);
    expect($(el, '.setter').textContent).toBe('BC');
    expect(el.shadowRoot!.querySelector('.wall')).toBeNull();
    expect(el.getAttribute('role')).toBe('listitem');
  });

  it('affiche le badge compétition, la traversée et le mur', async () => {
    expect($(await row('1-VIOLETTE'), '.comp').textContent).toBe('Compét.');
    const trav = await row('2-BEIGE', true);
    expect($(trav, '.grade').textContent).toBe('—');
    expect(trav.shadowRoot!.textContent).toContain('Traversée');
    expect($(trav, '.wall').textContent).toBe('Mur 2');
  });

  it('bascule tête et moulinette indépendamment', async () => {
    const el = await row();
    $(el, 'button.lead').click();
    await el.updateComplete;
    expect(el.store.get('1-VERTE')).toEqual({ t: true });
    expect($(el, 'button.lead').getAttribute('aria-pressed')).toBe('true');
    expect($(el, 'button.toprope').getAttribute('aria-pressed')).toBe('false');
    expect($(el, '.row').classList.contains('done')).toBe(true);
    $(el, 'button.toprope').click();
    await el.updateComplete;
    expect(el.store.get('1-VERTE')).toEqual({ t: true, m: true });
  });

  it('bascule le favori', async () => {
    const el = await row();
    $(el, 'button.star').click();
    await el.updateComplete;
    expect($(el, 'button.star').getAttribute('aria-pressed')).toBe('true');
  });

  it('demande l’ouverture de la note', async () => {
    const el = await row();
    const spy = vi.fn();
    document.body.addEventListener('open-note', spy, { once: true });
    $(el, 'button.note-btn').click();
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0].detail.route.id).toBe('1-VERTE');
  });

  it('affiche la note et se repeint seulement pour sa voie', async () => {
    const el = await row();
    const spy = vi.spyOn(el, 'requestUpdate');
    el.store.toggle('2-ROUGE', 't');
    expect(spy).not.toHaveBeenCalled();
    el.store.setNote('1-VERTE', 'ressentie 6a+');
    expect(spy).toHaveBeenCalled();
    await el.updateComplete;
    expect($(el, '.note').textContent).toBe('ressentie 6a+');
    expect($(el, '.note-btn').classList.contains('has-note')).toBe(true);
  });
});
