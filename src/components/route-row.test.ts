import { describe, expect, it, vi } from 'vitest';
import { $, miniTopo, mount, testStore } from '../test/helpers';
import { LONG_PRESS_MS, RouteRow } from './route-row';

const topo = miniTopo();
const route = (id: string) => topo.routes.find((r) => r.id === id)!;

async function row(id = '1-VERTE', showWall = false, wallFirst = false) {
  const el = new RouteRow();
  el.route = route(id);
  el.store = testStore();
  el.showWall = showWall;
  el.wallFirst = wallFirst;
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

  it('en mode wall-first, affiche le mur en gros et pas la cotation', async () => {
    const el = await row('2-ROUGE', true, true);
    expect($(el, '.grade').textContent).toBe('Mur 2');
    expect(el.shadowRoot!.querySelector('.wall')).toBeNull();
    expect(el.shadowRoot!.querySelector('.info')!.textContent).not.toContain('7a');
    expect(el.shadowRoot!.querySelector('.color')!.textContent).not.toContain('7a');
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

  it('distingue une ascension avec détails et les affiche', async () => {
    const el = await row();
    expect(el.shadowRoot!.querySelector('.details')).toBeNull();
    el.store.edit('1-VERTE', { t: true, tx: 'cp', m: true, mx: 'r' });
    await el.updateComplete;
    expect($(el, 'button.lead').getAttribute('aria-pressed')).toBe('true');
    expect($(el, 'button.lead').classList.contains('detailed')).toBe(true);
    expect($(el, 'button.toprope').classList.contains('detailed')).toBe(true);
    expect($(el, '.details').textContent).toBe('Tête : chute, partiel · Moul. : repos');
    expect($(el, '.row').classList.contains('done')).toBe(true);
  });

  it('une ascension partielle seule ne marque pas la voie faite', async () => {
    const el = await row();
    el.store.edit('1-VERTE', { t: true, tx: 'p' });
    await el.updateComplete;
    expect($(el, '.row').classList.contains('done')).toBe(false);
  });

  describe('menu des détails', () => {
    async function longPress(el: RouteRow, selector: string) {
      vi.useFakeTimers();
      try {
        $(el, selector).dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        vi.advanceTimersByTime(LONG_PRESS_MS);
      } finally {
        vi.useRealTimers();
      }
      $(el, selector).dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      $(el, selector).click();
      await el.updateComplete;
    }

    const check = (el: RouteRow, selector: string) => {
      const input = $<HTMLInputElement>(el, selector);
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change'));
    };

    it('s’ouvre sur appui long sans basculer la tête', async () => {
      const el = await row();
      await longPress(el, 'button.lead');
      expect(el.store.get('1-VERTE')).toEqual({});
      expect($(el, '.menu .title').textContent).toBe('En tête');
      expect(el.shadowRoot!.querySelectorAll('.menu input')).toHaveLength(3);
      $(el, 'button.lead').click();
      expect(el.store.get('1-VERTE')).toEqual({ t: true });
    });

    it('un appui court bascule toujours sans ouvrir le menu', async () => {
      const el = await row();
      $(el, 'button.toprope').dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
      $(el, 'button.toprope').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      $(el, 'button.toprope').click();
      await el.updateComplete;
      expect(el.store.get('1-VERTE')).toEqual({ m: true });
      expect(el.shadowRoot!.querySelector('.menu')).toBeNull();
    });

    it('applique les détails tout de suite et coche la façon de grimper', async () => {
      const el = await row();
      await longPress(el, 'button.toprope');
      check(el, '.menu .detail-r');
      expect(el.store.get('1-VERTE')).toEqual({ m: true, mx: 'r' });
      await el.updateComplete;
      check(el, '.menu .detail-p');
      check(el, '.menu .detail-r');
      expect(el.store.get('1-VERTE')).toEqual({ m: true, mx: 'p' });
      await el.updateComplete;
      expect($<HTMLInputElement>(el, '.menu .detail-p').checked).toBe(true);
      expect($(el, 'button.toprope').classList.contains('detailed')).toBe(true);
    });

    it('s’ouvre au clic droit et se ferme avec Échap ou un appui ailleurs', async () => {
      const el = await row();
      $(el, 'button.lead').dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true }));
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.menu')).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.menu')).toBeNull();
      $(el, 'button.lead').dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true }));
      await el.updateComplete;
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.menu')).toBeNull();
    });
  });
});
