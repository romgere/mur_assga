import type { LitElement } from 'lit';
import { afterEach } from 'vitest';
import { ProgressStore } from '../lib/progress-store';
import { createStorage, type KeyValueStorage } from '../lib/storage';
import { buildTopo, type Topo, type TopoData } from '../lib/topo';

/** Implémentation minimale de Storage pour simuler localStorage. */
export class FakeStorage implements Storage {
  private map = new Map<string, string>();
  failing = false;
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    if (this.failing) throw new Error('bloqué');
    return this.map.get(key) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(key: string) {
    if (this.failing) throw new Error('bloqué');
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failing) throw new Error('QuotaExceededError');
    this.map.set(key, value);
  }
}

/** Petit topo de test : 2 murs, une traversée. */
export const miniTopoData: TopoData = {
  title: 'Topo test',
  club: 'Club test',
  updated: '2026-04-03',
  grades: ['4+', '5a', '6a', '7a'],
  walls: [
    {
      id: 1,
      routes: [
        { color: 'VERTE', grade: '6a', setter: 'BC' },
        { color: 'JAUNE', grade: '4+', setter: 'GF' },
        { color: 'VIOLETTE', grade: '5a', competition: true },
      ],
    },
    {
      id: 2,
      routes: [
        { color: 'ROUGE', grade: '7a', setter: 'L' },
        { color: 'BEIGE', traverse: true },
      ],
    },
  ],
};

export function miniTopo(): Topo {
  return buildTopo(miniTopoData);
}

export function memoryStorage(): KeyValueStorage {
  return createStorage(new FakeStorage());
}

export function testStore(storage: KeyValueStorage = memoryStorage(), topo: Topo = miniTopo()): ProgressStore {
  return new ProgressStore(storage, topo);
}

const mounted: HTMLElement[] = [];

afterEach(() => {
  while (mounted.length) mounted.pop()!.remove();
});

/** Attache l'élément au document et attend son premier rendu. */
export async function mount<T extends LitElement>(el: T): Promise<T> {
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
}

export function $<E extends Element = HTMLElement>(host: Element, selector: string): E {
  const found = host.shadowRoot!.querySelector<E>(selector);
  if (!found) throw new Error(`Introuvable : ${selector}`);
  return found;
}

export function $$<E extends Element = HTMLElement>(host: Element, selector: string): E[] {
  return [...host.shadowRoot!.querySelectorAll<E>(selector)];
}

/** Attend la fin des rendus en cascade (parent puis enfants). */
export async function settle(...els: LitElement[]): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await Promise.all(els.map((e) => e.updateComplete));
    await new Promise((r) => setTimeout(r, 0));
  }
}
