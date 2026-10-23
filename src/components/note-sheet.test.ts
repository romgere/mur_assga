import { describe, expect, it, vi } from 'vitest';
import { $, miniTopo, mount, settle, testStore } from '../test/helpers';
import type { BottomSheet } from './bottom-sheet';
import { NoteSheet } from './note-sheet';

const route = miniTopo().routes[0];

async function noteSheet(note?: string) {
  const el = new NoteSheet();
  el.store = testStore();
  if (note) el.store.setNote(route.id, note);
  await mount(el);
  el.route = route;
  await settle(el, $<BottomSheet>(el, 'lardy-sheet'));
  return el;
}

const textarea = (el: NoteSheet) => el.shadowRoot!.querySelector('textarea')!;

/** Coche ou décoche une case de détail, comme un appui. */
function check(el: NoteSheet, selector: string) {
  const input = $<HTMLInputElement>(el, selector);
  input.checked = !input.checked;
  input.dispatchEvent(new Event('change'));
}

describe('lardy-note-sheet', () => {
  it('est fermée sans voie', async () => {
    const el = await mount(new NoteSheet());
    expect($<BottomSheet>(el, 'lardy-sheet').open).toBe(false);
  });

  it('s’ouvre sur la voie avec sa note existante', async () => {
    const el = await noteSheet('déjà là');
    const sheet = $<BottomSheet>(el, 'lardy-sheet');
    expect(sheet.open).toBe(true);
    expect(sheet.heading).toBe('Mur 1 · verte 6a');
    expect(textarea(el).value).toBe('déjà là');
  });

  it('enregistre la note et se ferme', async () => {
    const el = await noteSheet();
    const spy = vi.fn();
    el.addEventListener('close', spy);
    textarea(el).value = 'ressentie 6a+';
    textarea(el).dispatchEvent(new Event('input'));
    $(el, 'button.save').click();
    expect(el.store.get(route.id).n).toBe('ressentie 6a+');
    expect(el.route).toBeNull();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('supprime une note existante', async () => {
    const el = await noteSheet('à effacer');
    $(el, 'button.remove').click();
    expect(el.store.get(route.id)).toEqual({});
  });

  it('ne met pas le focus dans la note à l’ouverture', async () => {
    const el = await noteSheet();
    expect(el.shadowRoot!.activeElement).not.toBe(textarea(el));
  });

  it('affiche un bouton Tête / Moulinette suivi du résumé', async () => {
    const el = await noteSheet();
    expect($(el, '.card.lead button.mode').textContent!.trim()).toBe('Tête');
    expect($(el, '.card.toprope button.mode').textContent!.trim()).toBe('Moulinette');
    expect($(el, '.card.lead .card-head .summary').textContent).toBe('→ Pas faite');
    $(el, '.card.lead button.mode').click();
    await el.updateComplete;
    expect($(el, '.card.lead .summary').textContent).toBe('→ Enchaînée proprement');
    check(el, '.card.lead .detail-chute');
    await el.updateComplete;
    expect($(el, '.card.lead button.mode').classList.contains('detailed')).toBe(true);
  });

  it('enregistre la façon de grimper et ses détails', async () => {
    const el = await noteSheet();
    const lead = () => $(el, '.card.lead');
    expect(lead().querySelector('.summary')!.textContent).toBe('→ Pas faite');
    check(el, '.card.lead .detail-chute');
    await el.updateComplete;
    // Une puce coche aussi le mode parent.
    expect($(el, '.card.lead button.mode').getAttribute('aria-pressed')).toBe('true');
    expect(lead().classList.contains('on')).toBe(true);
    check(el, '.card.lead .detail-partiel');
    $(el, '.card.toprope button.mode').click();
    await el.updateComplete;
    expect(lead().querySelector('.summary')!.textContent).toBe('→ Avec chute · non terminée');
    expect($(el, '.card.toprope .summary').textContent).toBe('→ Enchaînée proprement');
    expect($<HTMLInputElement>(el, '.card.lead .detail-chute').checked).toBe(true);
    $(el, 'button.save').click();
    expect(el.store.get(route.id)).toEqual({ t: true, tx: ['chute', 'partiel'], m: true });
  });

  it('à vue remplace chute et repos, et inversement', async () => {
    const el = await noteSheet();
    check(el, '.card.lead .detail-chute');
    await el.updateComplete;
    check(el, '.card.lead .detail-avue');
    await el.updateComplete;
    expect($<HTMLInputElement>(el, '.card.lead .detail-chute').checked).toBe(false);
    expect($(el, '.card.lead .summary').textContent).toBe('→ Enchaînée à vue');
    check(el, '.card.lead .detail-repos');
    await el.updateComplete;
    expect($<HTMLInputElement>(el, '.card.lead .detail-avue').checked).toBe(false);
    $(el, 'button.save').click();
    expect(el.store.get(route.id)).toEqual({ t: true, tx: ['repos'] });
  });

  it('le bouton (i) demande l’aide', async () => {
    const el = await noteSheet();
    const spy = vi.fn();
    document.body.addEventListener('open-help', spy, { once: true });
    $(el, '.card.lead .help-btn').click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('décocher le mode efface ses détails', async () => {
    const el = await noteSheet();
    el.store.edit(route.id, { t: true, tx: ['repos'] });
    el.route = null;
    await el.updateComplete;
    el.route = route;
    await el.updateComplete;
    expect($<HTMLInputElement>(el, '.card.lead .detail-repos').checked).toBe(true);
    $(el, '.card.lead button.mode').click();
    await el.updateComplete;
    expect($<HTMLInputElement>(el, '.card.lead .detail-repos').checked).toBe(false);
    $(el, 'button.save').click();
    expect(el.store.get(route.id)).toEqual({});
  });

  it('n’enregistre rien si on ferme sans valider', async () => {
    const el = await noteSheet('initiale');
    textarea(el).value = 'modifiée';
    textarea(el).dispatchEvent(new Event('input'));
    $<BottomSheet>(el, 'lardy-sheet').close();
    expect(el.store.get(route.id).n).toBe('initiale');
    expect(el.route).toBeNull();
  });
});
