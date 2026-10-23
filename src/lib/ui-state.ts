import { storage as defaultStorage, readJson, writeJson, type KeyValueStorage } from './storage';

export const UI_KEY = 'lardy2026.ui';

export type Mode = 'wall' | 'grade' | 'all' | 'favorites' | 'stats';
export type StatusFilter =
  | 'any'
  | 'done'
  | 'todo'
  | 'lead'
  | 'toprope'
  | 'notlead'
  | 'notcleanlead'
  | 'partial'
  | 'avue'
  | 'flash'
  | 'cleanlead'
  | 'cleantoprope'
  | 'leadflaw'
  | 'topropenotlead';
export type SortOrder = 'wall' | 'asc' | 'desc';
/** Ce que comptent les cartes « Par niveau » de l'onglet Stats. */
export type StatsCount = 'done' | 'toprope' | 'lead';

export interface Filters {
  /** Bornes de cotation (index dans l'échelle), incluses. */
  min: number;
  max: number;
  status: StatusFilter;
  favorites: boolean;
  competition: boolean;
  sort: SortOrder;
}

export interface UiState {
  mode: Mode;
  wallPage: number;
  gradePage: number;
  filters: Filters;
  statsCount: StatsCount;
}

export function defaultFilters(gradeCount: number): Filters {
  return { min: 0, max: gradeCount - 1, status: 'any', favorites: false, competition: false, sort: 'wall' };
}

const MODES: Mode[] = ['wall', 'grade', 'all', 'favorites', 'stats'];
const STATUSES: StatusFilter[] = [
  'any',
  'done',
  'todo',
  'lead',
  'toprope',
  'notlead',
  'notcleanlead',
  'partial',
  'avue',
  'flash',
  'cleanlead',
  'cleantoprope',
  'leadflaw',
  'topropenotlead',
];
const SORTS: SortOrder[] = ['wall', 'asc', 'desc'];
const STATS_COUNTS: StatsCount[] = ['done', 'toprope', 'lead'];

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

/** Relit l'état sauvegardé en corrigeant toute valeur absente ou incohérente. */
export function loadUiState(gradeCount: number, store: KeyValueStorage = defaultStorage): UiState {
  const saved = readJson<Partial<UiState>>(store, UI_KEY) ?? {};
  const f = (saved.filters ?? {}) as Partial<Filters>;
  const defaults = defaultFilters(gradeCount);
  const min = clampInt(f.min, 0, gradeCount - 1, defaults.min);
  const max = clampInt(f.max, min, gradeCount - 1, defaults.max);
  return {
    mode: MODES.includes(saved.mode as Mode) ? (saved.mode as Mode) : 'wall',
    wallPage: clampInt(saved.wallPage, 0, Number.MAX_SAFE_INTEGER, 0),
    gradePage: clampInt(saved.gradePage, 0, Number.MAX_SAFE_INTEGER, 0),
    filters: {
      min,
      max,
      status: STATUSES.includes(f.status as StatusFilter) ? (f.status as StatusFilter) : defaults.status,
      favorites: f.favorites === true,
      competition: f.competition === true,
      sort: SORTS.includes(f.sort as SortOrder) ? (f.sort as SortOrder) : defaults.sort,
    },
    statsCount: STATS_COUNTS.includes(saved.statsCount as StatsCount) ? (saved.statsCount as StatsCount) : 'done',
  };
}

export function saveUiState(state: UiState, store: KeyValueStorage = defaultStorage): void {
  writeJson(store, UI_KEY, state);
}
