import { countedVote, summarizeVotes, type GradeCounts, type VoteSummary } from './grades';
import { ProgressChangeEvent, progressStore, type ProgressStore, type RouteProgress } from './progress-store';
import { storage as defaultStorage, readJson, writeJson, type KeyValueStorage } from './storage';
import { SYNC_CODE_KEY, progressSync, type ProgressSync } from './sync';
import type { Route } from './topo';

/**
 * Répartition des cotations ressenties (votes des grimpeurs), lue sur
 * /api/votes/<saison> (voir worker/api.ts) et gardée en local pour le hors
 * ligne. Le vote de l'appareil, lui, fait partie de la progression (champ g)
 * et part avec la sauvegarde en ligne : on n'affiche donc pas le sien tel que
 * le serveur le connaît, mais tel qu'il est ici, même pas encore envoyé.
 */

export const VOTES_API = '/api/votes';
export function votesKey(season: string): string {
  return `lardy.votes.${season}`;
}

interface VotesState {
  /** Votes comptés par voie, ceux de cet appareil compris. */
  votes: Record<string, GradeCounts>;
  /** Votes de ce code de sauvegarde tels que le serveur les compte. */
  mine: Record<string, string>;
}

const EMPTY: VotesState = { votes: {}, mine: {} };

export class GradeVotes extends EventTarget {
  private state: VotesState;
  private started = false;
  private loading: Promise<void> | null = null;

  constructor(
    readonly store: ProgressStore = progressStore,
    readonly sync: ProgressSync = progressSync,
    private readonly storage: KeyValueStorage = defaultStorage,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {
    super();
    const saved = readJson<VotesState>(storage, this.key);
    this.state = saved && typeof saved.votes === 'object' && typeof saved.mine === 'object' ? saved : { ...EMPTY };
  }

  private get key(): string {
    return votesKey(this.store.topo.season);
  }

  /** Relit les votes au démarrage, au retour sur l'appli et après chaque envoi de la progression. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.sync.addEventListener('change', this.onSync);
    this.store.addEventListener(ProgressChangeEvent.type, this.onProgress);
    document.addEventListener('visibilitychange', this.onVisibility);
    void this.refresh();
  }

  stop(): void {
    this.started = false;
    this.sync.removeEventListener('change', this.onSync);
    this.store.removeEventListener(ProgressChangeEvent.type, this.onProgress);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  /** Lit la répartition en ligne ; hors ligne, on garde la dernière connue. */
  refresh(): Promise<void> {
    this.loading ??= this.load().finally(() => (this.loading = null));
    return this.loading;
  }

  private async load(): Promise<void> {
    const code = this.storage.get(SYNC_CODE_KEY);
    try {
      const response = await this.fetchFn(`${VOTES_API}/${encodeURIComponent(this.store.topo.season)}`, {
        headers: code ? { Authorization: `Bearer ${code}` } : {},
        cache: 'no-store',
      });
      if (!response.ok) return;
      const body = (await response.json()) as Partial<VotesState>;
      if (typeof body.votes !== 'object' || body.votes === null) return;
      this.state = { votes: body.votes, mine: code && body.mine ? body.mine : {} };
    } catch {
      return;
    }
    writeJson(this.storage, this.key, this.state);
    this.dispatchEvent(new Event('change'));
  }

  /** Les votes de cet appareil ne comptent qu'avec la sauvegarde en ligne. */
  get canVote(): boolean {
    return this.sync.enabled;
  }

  /**
   * Votes d'une voie, avec celui de cet appareil dans son état actuel
   * (`local` : état en cours de modification, pour un aperçu).
   */
  counts(routeId: string, local: RouteProgress = this.store.get(routeId)): GradeCounts {
    const counts = { ...(this.state.votes[routeId] ?? {}) };
    const sent = this.sync.enabled ? this.state.mine[routeId] : undefined;
    if (sent && counts[sent]) counts[sent]--;
    const mine = this.sync.enabled ? countedVote(local) : null;
    if (mine) counts[mine] = (counts[mine] ?? 0) + 1;
    for (const grade of Object.keys(counts)) if (!counts[grade]) delete counts[grade];
    return counts;
  }

  summary(route: Route): VoteSummary {
    return summarizeVotes(this.counts(route.id), route.grade);
  }

  private onSync = () => {
    // Le vote vient de partir : la répartition en ligne l'inclut maintenant.
    if (this.sync.status === 'synced' || this.sync.status === 'off') void this.refresh();
  };

  /** Un vote local change l'affichage tout de suite, avant même l'envoi. */
  private onProgress = () => {
    this.dispatchEvent(new Event('change'));
  };

  private onVisibility = () => {
    if (document.visibilityState === 'visible') void this.refresh();
  };
}

export const gradeVotes = new GradeVotes();
