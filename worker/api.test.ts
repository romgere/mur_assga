// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES, hashCode, handleApi } from './api';
import worker, { type Env } from './index';

/** Petite D1 en mémoire au-dessus de node:sqlite (seules les méthodes utilisées par le Worker). */
function fakeD1(): { db: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(`${import.meta.dirname}/../migrations/0001_progress.sql`, 'utf8'));
  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          values = args;
          return statement;
        },
        async first() {
          return sqlite.prepare(sql).get(...(values as string[])) ?? null;
        },
        async run() {
          const { changes } = sqlite.prepare(sql).run(...(values as string[]));
          return { success: true, meta: { changes: Number(changes) } };
        },
      };
      return statement;
    },
  };
  return { db: db as unknown as D1Database, sqlite };
}

const CODE = 'ABCDEFGHIJKLMNOPQRSTUVWX';
const OTHER = 'ZZZZZZZZZZZZZZZZZZZZZZZZ';
const BASE = 'https://mur.test/api/progress';

function call(db: D1Database, method: string, path = '/2026-2027', body?: unknown, code: string | null = CODE) {
  const headers: Record<string, string> = {};
  if (code !== null) headers.Authorization = `Bearer ${code}`;
  return handleApi(
    new Request(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    db,
  );
}

describe('API de synchronisation', () => {
  let db: D1Database;
  let sqlite: DatabaseSync;

  beforeEach(() => {
    ({ db, sqlite } = fakeD1());
  });

  it('refuse une requête sans code valide', async () => {
    expect((await call(db, 'GET', '/2026-2027', undefined, null)).status).toBe(401);
    expect((await call(db, 'GET', '/2026-2027', undefined, 'trop-court')).status).toBe(401);
    expect((await call(db, 'GET', '/2026-2027', undefined, CODE.toLowerCase())).status).toBe(401);
  });

  it('renvoie 404 tant que rien n’est enregistré', async () => {
    expect((await call(db, 'GET')).status).toBe(404);
  });

  it('enregistre puis relit la progression', async () => {
    const data = { '1-VERTE': { t: true, tx: ['chute'], n: 'Dure au départ' } };
    const put = await call(db, 'PUT', '/2026-2027', { rev: 0, data });
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ rev: 1 });

    const get = await call(db, 'GET');
    expect(get.status).toBe(200);
    expect(await get.json()).toMatchObject({ rev: 1, data });
  });

  it('ne stocke que l’empreinte du code', async () => {
    await call(db, 'PUT', '/2026-2027', { rev: 0, data: {} });
    const rows = sqlite.prepare('SELECT user_hash FROM progress').all() as { user_hash: string }[];
    expect(rows).toEqual([{ user_hash: await hashCode(CODE) }]);
    expect(JSON.stringify(rows)).not.toContain(CODE);
  });

  it('isole les codes et les saisons', async () => {
    await call(db, 'PUT', '/2026-2027', { rev: 0, data: { a: { s: true } } });
    expect((await call(db, 'GET', '/2026-2027', undefined, OTHER)).status).toBe(404);
    expect((await call(db, 'GET', '/2027-2028')).status).toBe(404);
  });

  it('refuse une écriture basée sur une révision dépassée et renvoie la version en ligne', async () => {
    await call(db, 'PUT', '/2026-2027', { rev: 0, data: { a: { t: true } } });
    await call(db, 'PUT', '/2026-2027', { rev: 1, data: { a: { m: true } } });

    const stale = await call(db, 'PUT', '/2026-2027', { rev: 1, data: { b: { s: true } } });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ rev: 2, data: { a: { m: true } } });

    const first = await call(db, 'PUT', '/2026-2027', { rev: 0, data: {} });
    expect(first.status).toBe(409);
  });

  it('valide la forme des données', async () => {
    const bad = [
      { rev: -1, data: {} },
      { rev: 0, data: [] },
      { rev: 0, data: { a: { t: 'oui' } } },
      { rev: 0, data: { a: { tx: ['inconnu'] } } },
      { rev: 0, data: { a: { x: true } } },
      { rev: 0, data: { a: { n: 'x'.repeat(2001) } } },
    ];
    for (const body of bad) expect((await call(db, 'PUT', '/2026-2027', body)).status).toBe(400);
    expect((await call(db, 'PUT', '/saison', { rev: 0, data: {} })).status).toBe(400);
  });

  it('refuse un envoi trop volumineux', async () => {
    const data = { a: { n: 'x'.repeat(MAX_BODY_BYTES) } };
    expect((await call(db, 'PUT', '/2026-2027', { rev: 0, data })).status).toBe(413);
  });

  it('efface toutes les saisons du code', async () => {
    await call(db, 'PUT', '/2026-2027', { rev: 0, data: {} });
    await call(db, 'PUT', '/2027-2028', { rev: 0, data: {} });
    await call(db, 'PUT', '/2026-2027', { rev: 0, data: {} }, OTHER);
    expect((await call(db, 'DELETE', '')).status).toBe(200);
    expect((await call(db, 'GET', '/2026-2027')).status).toBe(404);
    expect((await call(db, 'GET', '/2027-2028')).status).toBe(404);
    expect((await call(db, 'GET', '/2026-2027', undefined, OTHER)).status).toBe(200);
  });

  it('laisse les autres adresses aux fichiers statiques', async () => {
    const assets = { fetch: async () => new Response('index') } as unknown as Fetcher;
    const env = { DB: db, ASSETS: assets } as Env;
    const response = await worker.fetch(new Request('https://mur.test/'), env);
    expect(await response.text()).toBe('index');
  });
});
