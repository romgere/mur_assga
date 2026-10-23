import { describe, expect, it, vi } from 'vitest';
import { $, $$, mount, settle } from '../test/helpers';
import type { BottomSheet } from './bottom-sheet';
import { ReleaseNotesSheet, formatDate } from './release-notes-sheet';

async function sheet() {
  const el = new ReleaseNotesSheet();
  el.heading = 'Nouveautés';
  el.notes = [
    { version: '1.1.0', date: '2026-10-23', notes: ['Deux', 'Deux bis'] },
    { version: '1.0.0', date: '2026-10-21', notes: ['Un'] },
  ];
  el.open = true;
  await mount(el);
  await settle(el, $<BottomSheet>(el, 'lardy-sheet'));
  return el;
}

describe('lardy-release-notes-sheet', () => {
  it('liste les nouveautés de chaque version', async () => {
    const el = await sheet();
    const sections = $$(el, 'section.release');
    expect(sections.map((s) => s.querySelector('h3')!.textContent)).toEqual([
      'Version 1.1.023/10/2026',
      'Version 1.0.021/10/2026',
    ]);
    expect([...sections[0].querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Deux', 'Deux bis']);
    expect($<BottomSheet>(el, 'lardy-sheet').heading).toBe('Nouveautés');
  });

  it('se ferme avec OK', async () => {
    const el = await sheet();
    const close = vi.fn();
    el.addEventListener('close', close);
    $(el, 'button.ok').click();
    expect(close).toHaveBeenCalledOnce();
    expect(el.open).toBe(false);
  });

  it('formate les dates à la française', () => {
    expect(formatDate('2026-10-23')).toBe('23/10/2026');
    expect(formatDate('bientôt')).toBe('bientôt');
  });
});
