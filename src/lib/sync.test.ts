import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage, testStore } from '../test/helpers';
import type { ProgressMap } from './progress-store';
import type { KeyValueStorage } from './storage';
import {
  ProgressSync,
  SYNC_CODE_KEY,
  formatCode,
  generateCode,
  mergeProgress,
  normalizeCode,
  syncStateKey,
} from './sync';

/** Faux serveur : même contrat que worker/index.ts (révisions, 409, 404). */
class FakeServer {
  rows = new Map<string, { rev: number; data: ProgressMap }>();
  down = false;
  requests: string[] = [];

  fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (this.down) throw new TypeError('Failed to fetch');
    const url = String(input);
    const method = init.method ?? 'GET';
    this.requests.push(`${method} ${url}`);
    const code = new Headers(init.headers).get('Authorization')!.replace('Bearer ', '');
    if (method === 'DELETE') {
      for (const key of [...this.rows.keys()]) if (key.startsWith(`${code}|`)) this.rows.delete(key);
      return Response.json({ ok: true });
    }
    const key = `${code}|${url.split('/').pop()}`;
    const row = this.rows.get(key);
    if (method === 'GET') return row ? Response.json(row) : Response.json({ error: 'absent' }, { status: 404 });
    const body = JSON.parse(init.body as string) as { rev: number; data: ProgressMap };
    if ((row?.rev ?? 0) !== body.rev) return Response.json(row ?? { rev: 0, data: {} }, { status: 409 });
    this.rows.set(key, { rev: body.rev + 1, data: body.data });
    return Response.json({ rev: body.rev + 1 });
  });

  data(code: string): ProgressMap | undefined {
    return this.rows.get(`${normalizeCode(code)}|2026-2027`)?.data;
  }
}

const syncs: ProgressSync[] = [];

/** Un appareil : son stockage, son store et sa synchro démarrée. */
function device(server: FakeServer, delayMs = 5, storage: KeyValueStorage = memoryStorage()) {
  const store = testStore(storage);
  const sync = new ProgressSync(store, storage, server.fetch as typeof fetch, delayMs);
  syncs.push(sync);
  sync.start();
  return { store, sync, storage };
}

afterEach(() => {
  while (syncs.length) syncs.pop()!.stop();
});

describe('codes de synchronisation', () => {
  it('génère des codes base32 de 24 caractères, tous différents', () => {
    const codes = new Set(Array.from({ length: 50 }, generateCode));
    expect(codes.size).toBe(50);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-7]{24}$/);
  });

  it('accepte un code saisi avec tirets, espaces, minuscules et chiffres confondus', () => {
    const code = 'ABCDEFGHIJKLMNOPQRSTUVWX';
    expect(normalizeCode(formatCode(code))).toBe(code);
    expect(normalizeCode(' abcd efgh-ijkl mnop qrst uvwx ')).toBe(code);
    expect(normalizeCode('0BCDEFGH1JKLMNOPQRSTUVWX')).toBe('OBCDEFGHIJKLMNOPQRSTUVWX');
    expect(normalizeCode('ABCD')).toBeNull();
    expect(normalizeCode('ABCDEFGHIJKLMNOPQRSTUVW!')).toBeNull();
  });

  it('affiche le code par groupes de 4', () => {
    expect(formatCode('ABCDEFGHIJKLMNOPQRSTUVWX')).toBe('ABCD-EFGH-IJKL-MNOP-QRST-UVWX');
  });
});

describe('mergeProgress', () => {
  it('garde les voies modifiées ici et prend le reste de la version en ligne', () => {
    const base = { a: { t: true }, b: { s: true }, c: { m: true } };
    const local = { a: { t: true, n: 'ici' }, c: { m: true } };
    const remote = { a: { t: true }, b: { s: true }, c: { t: true }, d: { s: true } };
    expect(mergeProgress(base, local, remote)).toEqual({
      a: { t: true, n: 'ici' },
      c: { t: true },
      d: { s: true },
    });
  });
});

describe('ProgressSync', () => {
  it('reste désactivée et silencieuse par défaut', async () => {
    const server = new FakeServer();
    const { sync, store } = device(server);
    store.toggle('1-VERTE', 't');
    await new Promise((r) => setTimeout(r, 20));
    expect(sync.status).toBe('off');
    expect(server.fetch).not.toHaveBeenCalled();
  });

  it('à l’activation, crée un code et envoie la progression', async () => {
    const server = new FakeServer();
    const { sync, store, storage } = device(server);
    store.toggle('1-VERTE', 't');
    await sync.enable();
    expect(sync.status).toBe('synced');
    expect(sync.displayCode).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4}){5}$/);
    expect(storage.get(SYNC_CODE_KEY)).toBe(normalizeCode(sync.displayCode!));
    expect(server.data(sync.displayCode!)).toEqual({ '1-VERTE': { t: true } });
  });

  it('envoie chaque modification après un court délai, groupées', async () => {
    const server = new FakeServer();
    const { sync, store } = device(server);
    await sync.enable();
    server.fetch.mockClear();

    store.toggle('1-VERTE', 't');
    store.setNote('1-VERTE', 'Dalle');
    expect(sync.status).toBe('pending');
    await vi.waitFor(() => expect(sync.status).toBe('synced'));
    expect(server.data(sync.displayCode!)).toEqual({ '1-VERTE': { t: true, n: 'Dalle' } });
    expect(server.fetch.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
  });

  it('un second appareil récupère la progression et y ajoute la sienne', async () => {
    const server = new FakeServer();
    const a = device(server);
    a.store.toggle('1-VERTE', 't');
    await a.sync.enable();

    const b = device(server);
    b.store.toggle('2-ROUGE', 's');
    expect(await b.sync.link(a.sync.displayCode!.toLowerCase())).toBe(true);
    expect(b.store.snapshot()).toEqual({ '1-VERTE': { t: true }, '2-ROUGE': { s: true } });

    await a.sync.sync();
    expect(a.store.snapshot()).toEqual({ '1-VERTE': { t: true }, '2-ROUGE': { s: true } });
  });

  it('refuse un code mal saisi', async () => {
    const { sync } = device(new FakeServer());
    expect(await sync.link('ABCD-1234')).toBe(false);
    expect(sync.enabled).toBe(false);
  });

  it('fusionne les modifications faites hors ligne sur deux appareils', async () => {
    const server = new FakeServer();
    // Envois automatiques repoussés : les deux appareils modifient « hors ligne ».
    const a = device(server, 60_000);
    a.store.toggle('1-VERTE', 't');
    await a.sync.enable();
    const b = device(server, 60_000);
    await b.sync.link(a.sync.displayCode!);

    a.store.toggle('1-JAUNE', 'm');
    a.store.setNote('1-VERTE', 'vue de A');
    b.store.toggle('2-ROUGE', 's');
    b.store.toggle('1-VERTE', 't');

    await a.sync.sync();
    await b.sync.sync();
    await a.sync.sync();

    // 1-VERTE, modifiée des deux côtés : la dernière synchro (B, qui l'a décochée) l'emporte.
    expect(b.store.snapshot()).toEqual({ '1-JAUNE': { m: true }, '2-ROUGE': { s: true } });
    expect(a.store.snapshot()).toEqual(b.store.snapshot());
  });

  it('hors ligne : garde les modifications et les envoie au retour', async () => {
    const server = new FakeServer();
    const { sync, store, storage } = device(server);
    await sync.enable();

    server.down = true;
    store.toggle('1-VERTE', 's');
    await sync.sync();
    expect(sync.status).toBe('offline');
    expect(JSON.parse(storage.get(syncStateKey('2026-2027'))!).dirty).toBe(true);

    // Redémarrage de l'application, réseau revenu.
    server.down = false;
    const restarted = new ProgressSync(testStore(storage), storage, server.fetch as typeof fetch, 5);
    syncs.push(restarted);
    expect(restarted.status).toBe('pending');
    await restarted.sync();
    expect(restarted.status).toBe('synced');
    expect(server.data(sync.displayCode!)).toEqual({ '1-VERTE': { s: true } });
  });

  it('affiche le refus du serveur', async () => {
    const server = new FakeServer();
    const { sync } = device(server);
    await sync.enable();
    server.fetch.mockResolvedValueOnce(Response.json({ error: 'Données trop volumineuses.' }, { status: 413 }));
    await sync.sync();
    expect(sync.status).toBe('error');
    expect(sync.message).toBe('Données trop volumineuses.');
  });

  it('se désactive sans toucher à la progression', async () => {
    const server = new FakeServer();
    const { sync, store, storage } = device(server);
    store.toggle('1-VERTE', 't');
    await sync.enable();
    sync.disable();
    expect(sync.status).toBe('off');
    expect(storage.get(SYNC_CODE_KEY)).toBeNull();
    expect(store.get('1-VERTE')).toEqual({ t: true });
    expect(server.rows.size).toBe(1);
  });

  it('efface la progression en ligne', async () => {
    const server = new FakeServer();
    const { sync, store } = device(server);
    store.toggle('1-VERTE', 't');
    await sync.enable();
    expect(await sync.deleteRemote()).toBe(true);
    expect(server.rows.size).toBe(0);
    expect(sync.enabled).toBe(false);
    expect(store.get('1-VERTE')).toEqual({ t: true });
  });
});
