import { describe, expect, it } from 'vitest';
import { memoryStorage, miniTopo, testStore, testVotes } from '../test/helpers';
import { GradeVotes, votesKey } from './grade-votes';
import { ProgressSync } from './sync';

const route = miniTopo().routes[0]; // 1-VERTE 6a

describe('GradeVotes', () => {
  it('lit la répartition en ligne et la garde pour le hors ligne', async () => {
    const store = testStore();
    const votes = testVotes(store, { server: { votes: { '1-VERTE': { '6a+': 3 } } } });
    let changes = 0;
    votes.addEventListener('change', () => changes++);
    await votes.refresh();
    expect(changes).toBe(1);
    expect(votes.counts(route.id)).toEqual({ '6a+': 3 });
    expect(votes.summary(route)).toEqual({ total: 3, trend: 'harder' });
  });

  it('relit la dernière répartition connue au démarrage', () => {
    const storage = memoryStorage();
    storage.set(votesKey('2026-2027'), JSON.stringify({ votes: { '1-VERTE': { '6a': 1 } }, mine: {} }));
    const store = testStore();
    const offline = async () => {
      throw new TypeError('Failed to fetch');
    };
    const votes = new GradeVotes(store, new ProgressSync(store, storage, offline), storage, offline);
    expect(votes.counts(route.id)).toEqual({ '6a': 1 });
  });

  it('remplace son vote envoyé par son vote local, même pas encore envoyé', async () => {
    const store = testStore();
    const votes = testVotes(store, {
      synced: true,
      server: { votes: { '1-VERTE': { '6a': 2, '6a+': 1 } }, mine: { '1-VERTE': '6a+' } },
    });
    await votes.refresh();
    store.edit(route.id, { t: true, g: '6b' });
    expect(votes.counts(route.id)).toEqual({ '6a': 2, '6b': 1 });
    // Vote retiré, ou voie décochée : il ne compte plus.
    store.edit(route.id, { g: undefined });
    expect(votes.counts(route.id)).toEqual({ '6a': 2 });
  });

  it('ne compte pas de vote local sans sauvegarde en ligne', async () => {
    const store = testStore();
    store.edit(route.id, { t: true, g: '6b' });
    const votes = testVotes(store, { server: { votes: { '1-VERTE': { '6a': 1 } } } });
    await votes.refresh();
    expect(votes.canVote).toBe(false);
    expect(votes.counts(route.id)).toEqual({ '6a': 1 });
  });
});
