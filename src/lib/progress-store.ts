import { storage as defaultStorage, readJson, writeJson, type KeyValueStorage } from './storage';
import { topo as defaultTopo, type Route, type Topo } from './topo';

export const PROGRESS_KEY = 'lardy2026.v1';
export const BACKUP_APP = 'lardy2026';
export const BACKUP_VERSION = 1;
export const MAX_NOTE_LENGTH = 2000;

/** État d'une voie : t = tête, m = moulinette, s = favori (star), n = note. */
export interface RouteProgress {
  t?: boolean;
  m?: boolean;
  s?: boolean;
  n?: string;
}

export type ProgressMap = Record<string, RouteProgress>;
export type ProgressFlag = 't' | 'm' | 's';

export interface Counts {
  total: number;
  lead: number;
  toprope: number;
  done: number;
}

export interface ImportResult {
  ok: boolean;
  message: string;
  imported?: number;
  ignored?: number;
}

/** Événement émis à chaque modification ; id absent = tout a changé. */
export class ProgressChangeEvent extends Event {
  static readonly type = 'change';
  constructor(readonly id?: string) {
    super(ProgressChangeEvent.type);
  }
}

export function isDone(p: RouteProgress | undefined): boolean {
  return !!(p && (p.t || p.m));
}

function isEmpty(p: RouteProgress): boolean {
  return !p.t && !p.m && !p.s && !p.n;
}

/** Nettoie une entrée : ne garde que les champs utiles, supprime les valeurs vides. */
function compact(p: RouteProgress): RouteProgress {
  const out: RouteProgress = {};
  if (p.t) out.t = true;
  if (p.m) out.m = true;
  if (p.s) out.s = true;
  if (p.n) out.n = p.n;
  return out;
}

export class ProgressStore extends EventTarget {
  private data: ProgressMap;

  constructor(
    private readonly storage: KeyValueStorage = defaultStorage,
    readonly topo: Topo = defaultTopo,
  ) {
    super();
    const saved = readJson<unknown>(storage, PROGRESS_KEY);
    const parsed = saved === null ? null : this.validate(saved);
    this.data = parsed && parsed.ok ? parsed.data : {};
  }

  get persistent(): boolean {
    return this.storage.persistent;
  }

  get(id: string): RouteProgress {
    return this.data[id] ?? {};
  }

  toggle(id: string, flag: ProgressFlag): boolean {
    const value = !this.get(id)[flag];
    this.update(id, { [flag]: value });
    return value;
  }

  setNote(id: string, note: string): void {
    this.update(id, { n: note.trim().slice(0, MAX_NOTE_LENGTH) });
  }

  counts(routes: Route[] = this.topo.routes): Counts {
    const counts: Counts = { total: routes.length, lead: 0, toprope: 0, done: 0 };
    for (const r of routes) {
      const p = this.data[r.id];
      if (!p) continue;
      if (p.t) counts.lead++;
      if (p.m) counts.toprope++;
      if (p.t || p.m) counts.done++;
    }
    return counts;
  }

  clear(): void {
    this.data = {};
    this.storage.remove(PROGRESS_KEY);
    this.dispatchEvent(new ProgressChangeEvent());
  }

  exportText(): string {
    return JSON.stringify(
      {
        app: BACKUP_APP,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        progress: this.data,
      },
      null,
      1,
    );
  }

  /** Remplace toute la progression par celle du texte fourni, après validation. */
  importText(text: string): ImportResult {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, message: 'Le texte collé n’est pas du JSON valide.' };
    }
    const result = this.validate(json);
    if (!result.ok) return { ok: false, message: result.message };
    this.data = result.data;
    this.persist();
    this.dispatchEvent(new ProgressChangeEvent());
    const imported = Object.keys(result.data).length;
    let message = `${imported} voie${imported > 1 ? 's' : ''} restaurée${imported > 1 ? 's' : ''}.`;
    if (result.ignored) message += ` ${result.ignored} entrée(s) inconnue(s) ignorée(s).`;
    return { ok: true, message, imported, ignored: result.ignored };
  }

  private update(id: string, patch: RouteProgress): void {
    const next = compact({ ...this.get(id), ...patch });
    if (isEmpty(next)) delete this.data[id];
    else this.data[id] = next;
    this.persist();
    this.dispatchEvent(new ProgressChangeEvent(id));
  }

  private persist(): void {
    writeJson(this.storage, PROGRESS_KEY, this.data);
  }

  /**
   * Accepte soit une sauvegarde complète ({app, version, progress}), soit
   * directement la table {"mur-COULEUR": {t, m, s, n}}. Les voies qui
   * n'existent plus dans le topo sont ignorées ; un type invalide rejette tout.
   */
  private validate(
    json: unknown,
  ): { ok: true; data: ProgressMap; ignored: number } | { ok: false; message: string } {
    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      return { ok: false, message: 'La sauvegarde doit être un objet JSON.' };
    }
    let map = json as Record<string, unknown>;
    if ('progress' in map) {
      if (map.app !== undefined && map.app !== BACKUP_APP) {
        return { ok: false, message: 'Cette sauvegarde ne provient pas de cette application.' };
      }
      if (typeof map.version === 'number' && map.version > BACKUP_VERSION) {
        return { ok: false, message: 'Sauvegarde créée par une version plus récente de l’application.' };
      }
      const progress = map.progress;
      if (typeof progress !== 'object' || progress === null || Array.isArray(progress)) {
        return { ok: false, message: 'Le champ « progress » est invalide.' };
      }
      map = progress as Record<string, unknown>;
    }
    const known = new Set(this.topo.routes.map((r) => r.id));
    const data: ProgressMap = {};
    let ignored = 0;
    for (const [id, value] of Object.entries(map)) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { ok: false, message: `Entrée invalide pour la voie « ${id} ».` };
      }
      const v = value as Record<string, unknown>;
      for (const flag of ['t', 'm', 's'] as const) {
        if (v[flag] !== undefined && typeof v[flag] !== 'boolean') {
          return { ok: false, message: `Valeur « ${flag} » invalide pour la voie « ${id} ».` };
        }
      }
      if (v.n !== undefined && typeof v.n !== 'string') {
        return { ok: false, message: `Note invalide pour la voie « ${id} ».` };
      }
      if (!known.has(id)) {
        ignored++;
        continue;
      }
      const entry = compact({
        t: v.t as boolean | undefined,
        m: v.m as boolean | undefined,
        s: v.s as boolean | undefined,
        n: typeof v.n === 'string' ? v.n.slice(0, MAX_NOTE_LENGTH) : undefined,
      });
      if (!isEmpty(entry)) data[id] = entry;
    }
    return { ok: true, data, ignored };
  }
}

export const progressStore = new ProgressStore();
