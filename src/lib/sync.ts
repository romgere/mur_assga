import { ProgressChangeEvent, progressStore, type ProgressMap, type ProgressStore } from './progress-store';
import { storage as defaultStorage, readJson, writeJson, type KeyValueStorage } from './storage';

/**
 * Synchronisation de la progression entre appareils (Worker + D1, voir
 * worker/index.ts). Facultative : rien ne part tant qu'on ne l'a pas activée.
 *
 * Le stockage local reste la référence (l'application marche hors ligne au
 * pied du mur) ; chaque modification est envoyée quelques secondes plus tard,
 * et la version en ligne est relue à l'ouverture et au retour sur l'appli.
 * Si deux appareils ont modifié la progression depuis la dernière synchro,
 * on fusionne voie par voie : ce qui a changé ici l'emporte, le reste vient
 * de la version en ligne.
 */

export const SYNC_CODE_KEY = 'lardy.sync.code';
export function syncStateKey(season: string): string {
  return `lardy.sync.${season}`;
}
/** Délai avant l'envoi : regroupe les coches et la saisie d'une note. */
export const SYNC_DELAY_MS = 2000;
export const API_BASE = '/api/progress';

/**
 * off : désactivée ; pending : modifications en attente d'envoi ; syncing :
 * échange en cours ; synced : à jour ; offline : serveur injoignable ; error :
 * le serveur a refusé.
 */
export type SyncStatus = 'off' | 'pending' | 'syncing' | 'synced' | 'offline' | 'error';

/** Ce que l'appareil sait de la dernière synchro réussie, par saison. */
interface SyncState {
  /** Révision en ligne sur laquelle s'appuie la progression locale. */
  rev: number;
  /** Progression à cette révision : sert à savoir ce qui a changé ici. */
  base: ProgressMap;
  /** Des modifications locales n'ont pas encore été envoyées. */
  dirty: boolean;
  syncedAt?: string;
}

const EMPTY_STATE: SyncState = { rev: 0, base: {}, dirty: false };

/** Base32 (RFC 4648) : ni 0, ni 1, ni 8, faciles à confondre. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const CODE_LENGTH = 24;

/** Code aléatoire de 24 caractères (120 bits) : impossible à deviner. */
export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array((CODE_LENGTH * 5) / 8));
  let code = '';
  let value = 0;
  let bits = 0;
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      code += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return code;
}

/** Code saisi → forme canonique (majuscules, sans tirets ni espaces) ; null si invalide. */
export function normalizeCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/8/g, 'B');
  return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}

/** ABCD-EFGH-… : plus facile à recopier. */
export function formatCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function sameProgress(a: ProgressMap, b: ProgressMap): boolean {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...ids].every((id) => same(a[id], b[id]));
}

/** Fusion voie par voie : les voies modifiées ici depuis `base` l'emportent sur `remote`. */
export function mergeProgress(base: ProgressMap, local: ProgressMap, remote: ProgressMap): ProgressMap {
  const merged = { ...remote };
  for (const id of new Set([...Object.keys(base), ...Object.keys(local)])) {
    if (same(local[id], base[id])) continue;
    if (local[id]) merged[id] = local[id];
    else delete merged[id];
  }
  return merged;
}

class HttpError extends Error {}

export class ProgressSync extends EventTarget {
  private code: string | null;
  private state: SyncState;
  private _status: SyncStatus;
  private _message = '';
  private timer = 0;
  private running: Promise<void> | null = null;
  private again = false;
  /** Incrémenté à chaque modification locale : détecte celles faites pendant un envoi. */
  private changes = 0;
  private started = false;

  constructor(
    readonly store: ProgressStore = progressStore,
    private readonly storage: KeyValueStorage = defaultStorage,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly delayMs = SYNC_DELAY_MS,
  ) {
    super();
    this.code = normalizeCode(storage.get(SYNC_CODE_KEY) ?? '');
    this.state = this.code ? this.loadState() : { ...EMPTY_STATE };
    this._status = !this.code ? 'off' : this.state.dirty ? 'pending' : 'synced';
  }

  get enabled(): boolean {
    return this.code !== null;
  }

  /** Code formaté pour l'affichage, null si la synchro est désactivée. */
  get displayCode(): string | null {
    return this.code && formatCode(this.code);
  }

  get status(): SyncStatus {
    return this._status;
  }

  /** Détail de l'erreur pour le statut « error ». */
  get message(): string {
    return this._message;
  }

  get syncedAt(): Date | null {
    return this.state.syncedAt ? new Date(this.state.syncedAt) : null;
  }

  /** Suit les modifications et resynchronise au retour sur l'application. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.store.addEventListener(ProgressChangeEvent.type, this.onChange);
    window.addEventListener('online', this.onWake);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (this.code) void this.sync();
  }

  stop(): void {
    this.started = false;
    clearTimeout(this.timer);
    this.store.removeEventListener(ProgressChangeEvent.type, this.onChange);
    window.removeEventListener('online', this.onWake);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  /** Crée un code et envoie la progression de cet appareil. */
  enable(): Promise<void> {
    return this.useCode(generateCode());
  }

  /**
   * Rejoint un code créé sur un autre appareil. La progression de cet appareil
   * est fusionnée avec celle en ligne (les voies notées ici l'emportent).
   */
  async link(input: string): Promise<boolean> {
    const code = normalizeCode(input);
    if (!code) return false;
    await this.useCode(code);
    return true;
  }

  /** Oublie le code sur cet appareil ; la progression locale et en ligne est conservée. */
  disable(): void {
    clearTimeout(this.timer);
    this.code = null;
    this.state = { ...EMPTY_STATE };
    this.storage.remove(SYNC_CODE_KEY);
    this.storage.remove(this.stateKey);
    this.setStatus('off');
  }

  /** Efface la progression en ligne (toutes saisons) puis désactive la synchro. */
  async deleteRemote(): Promise<boolean> {
    if (!this.code) return false;
    try {
      const response = await this.request('DELETE', API_BASE);
      if (!response.ok) throw new HttpError(await errorMessage(response));
    } catch (e) {
      this.fail(e);
      return false;
    }
    this.disable();
    return true;
  }

  /** Synchronise maintenant ; un appel pendant un échange en relance un après. */
  sync(): Promise<void> {
    if (!this.code) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.run();
      } while (this.again && this.code);
    })().finally(() => (this.running = null));
    return this.running;
  }

  private get stateKey(): string {
    return syncStateKey(this.store.topo.season);
  }

  private async useCode(code: string): Promise<void> {
    this.code = code;
    this.storage.set(SYNC_CODE_KEY, code);
    // Aucune base commune : tout ce qui est noté ici compte comme modifié.
    this.state = { rev: 0, base: {}, dirty: true };
    this.saveState();
    await this.sync();
  }

  private onChange = (event: Event) => {
    if (!this.code || (event as ProgressChangeEvent).remote) return;
    this.changes++;
    this.state.dirty = true;
    this.saveState();
    this.setStatus('pending');
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.sync(), this.delayMs);
  };

  private onWake = () => {
    if (this.code) void this.sync();
  };

  /** Au retour : relit la version en ligne ; au départ : envoie ce qui attend. */
  private onVisibility = () => {
    if (document.visibilityState === 'visible' || this.state.dirty) this.onWake();
  };

  private async run(): Promise<void> {
    clearTimeout(this.timer);
    this.setStatus('syncing');
    try {
      // Plusieurs tours seulement si un autre appareil écrit en même temps.
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await this.pull();
        const changes = this.changes;
        const local = this.store.snapshot();
        let next = local;
        if (remote.rev !== this.state.rev) {
          next = this.state.dirty ? mergeProgress(this.state.base, local, remote.data) : remote.data;
          if (!sameProgress(next, local)) this.store.applyRemote(next);
        }
        if (sameProgress(next, remote.data)) return this.done(remote.rev, next, changes);

        const response = await this.request('PUT', this.seasonUrl, { rev: remote.rev, data: next });
        if (response.status === 409) continue;
        if (!response.ok) throw new HttpError(await errorMessage(response));
        const { rev } = (await response.json()) as { rev: number };
        return this.done(rev, next, changes);
      }
      throw new HttpError('Trop d’écritures simultanées, nouvel essai plus tard.');
    } catch (e) {
      this.fail(e);
    }
  }

  private async pull(): Promise<{ rev: number; data: ProgressMap }> {
    const response = await this.request('GET', this.seasonUrl);
    if (response.status === 404) return { rev: 0, data: {} };
    if (!response.ok) throw new HttpError(await errorMessage(response));
    const body = (await response.json()) as { rev: number; data: unknown };
    const data = this.store.normalize(body.data);
    if (!data) throw new HttpError('Données en ligne illisibles.');
    return { rev: body.rev, data };
  }

  private done(rev: number, base: ProgressMap, changes: number): void {
    if (!this.code) return;
    const dirty = changes !== this.changes;
    this.state = { rev, base, dirty, syncedAt: new Date().toISOString() };
    this.saveState();
    this.setStatus(dirty ? 'pending' : 'synced');
    if (dirty) this.again = true;
  }

  private fail(e: unknown): void {
    if (!this.code) return;
    // fetch rejette (TypeError) quand le serveur est injoignable.
    if (e instanceof HttpError) this.setStatus('error', e.message);
    else this.setStatus('offline');
  }

  private get seasonUrl(): string {
    return `${API_BASE}/${encodeURIComponent(this.store.topo.season)}`;
  }

  private request(method: string, url: string, body?: unknown): Promise<Response> {
    return this.fetchFn(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.code}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  }

  private loadState(): SyncState {
    const saved = readJson<SyncState>(this.storage, this.stateKey);
    return saved && typeof saved.rev === 'number' && saved.base ? saved : { ...EMPTY_STATE };
  }

  private saveState(): void {
    writeJson(this.storage, this.stateKey, this.state);
  }

  private setStatus(status: SyncStatus, message = ''): void {
    this._status = status;
    this._message = message;
    this.dispatchEvent(new Event('change'));
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // Réponse sans JSON : message générique.
  }
  return `Erreur du serveur (${response.status}).`;
}

export const progressSync = new ProgressSync();
