import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { progressStore, type ProgressStore } from '../lib/progress-store';
import { StoreController } from '../lib/store-controller';
import type { Route } from '../lib/topo';
import { defaultFilters, type Filters, type SortOrder, type StatusFilter } from '../lib/ui-state';
import { filterRoutes } from '../lib/views';
import { sharedStyles } from './shared-styles';
import './route-list';

export interface FiltersChangeDetail {
  filters: Filters;
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'any', label: 'Toutes' },
  { value: 'todo', label: 'Non faites' },
  { value: 'done', label: 'Faites' },
  { value: 'lead', label: 'Faites en tête' },
  { value: 'toprope', label: 'Faites en moulinette' },
  { value: 'notlead', label: 'Pas encore en tête' },
  { value: 'notcleanlead', label: 'Pas encore enchaînées en tête' },
  { value: 'partial', label: 'Partielles (à finir)' },
  { value: 'avue', label: 'Faites à vue' },
  { value: 'flash', label: 'Faites en flash' },
  { value: 'cleanlead', label: 'Enchaînées en tête' },
  { value: 'cleantoprope', label: 'Enchaînées en moulinette' },
  { value: 'leadflaw', label: 'En tête avec chute ou repos' },
  { value: 'topropenotlead', label: 'En moulinette, pas encore en tête' },
];

const sortIcon = html`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <path
    d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>`;

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'wall', label: 'Par mur' },
  { value: 'asc', label: 'Facile → dur' },
  { value: 'desc', label: 'Dur → facile' },
];

/**
 * Mode « Toutes » : filtres, tri et liste. La liste n'est recalculée que
 * quand les filtres changent (ou après import/effacement) : cocher une voie
 * ne la fait pas disparaître sous le doigt.
 */
@customElement('lardy-all-routes-view')
export class AllRoutesView extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .filters {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 4px var(--gutter-right) 8px var(--gutter-left);
      }

      label {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-muted);
      }

      .range {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .range select {
        flex: 1;
        min-width: 0;
      }

      select {
        width: 100%;
        color: var(--text);
        font-size: 15px;
      }

      .chips {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }

      .chip {
        height: 34px;
        padding: 0 12px;
        border-radius: 17px;
        border: 1px solid var(--border);
        background: var(--surface);
        font-size: 14px;
        font-weight: 600;
        color: var(--text-muted);
      }

      .chip[aria-pressed='true'] {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--accent-ink);
      }

      label.sort {
        flex-direction: row;
        align-items: center;
        gap: 4px;
        font-size: 14px;
      }

      label.sort svg {
        flex: none;
      }

      label.sort select {
        width: auto;
        margin-left: 2px;
      }

      .reset {
        margin-left: auto;
        font-size: 14px;
        font-weight: 600;
        color: var(--accent);
        min-height: 34px;
      }

      .count {
        margin: 0;
        padding: 0 var(--gutter-right) 6px var(--gutter-left);
        font-size: 13px;
        color: var(--text-muted);
      }

      .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior-y: contain;
        padding: 0 var(--gutter-right) 16px var(--gutter-left);
      }
    `,
  ];

  @property({ attribute: false }) routes: Route[] = [];
  @property({ attribute: false }) grades: string[] = [];
  @property({ attribute: false }) filters!: Filters;
  @property({ attribute: false }) store: ProgressStore = progressStore;

  constructor() {
    super();
    new StoreController(
      this,
      () => this.store,
      (id) => id === undefined,
    );
  }

  private get current(): Filters {
    return this.filters ?? defaultFilters(this.grades.length);
  }

  private change(patch: Partial<Filters>) {
    const next = { ...this.current, ...patch };
    if (next.min > next.max) {
      if ('min' in patch) next.max = next.min;
      else next.min = next.max;
    }
    this.filters = next;
    this.dispatchEvent(new CustomEvent<FiltersChangeDetail>('filters-change', { detail: { filters: next } }));
  }

  private isDefault(f: Filters): boolean {
    const d = defaultFilters(this.grades.length);
    return (Object.keys(d) as (keyof Filters)[]).every((k) => d[k] === f[k]);
  }

  /**
   * Après une interaction, l'attribut « selected » ne pilote plus le choix
   * affiché : on recale explicitement chaque liste sur les filtres.
   */
  protected updated(): void {
    const f = this.current;
    const values: Record<string, string> = { min: String(f.min), max: String(f.max), status: f.status, sort: f.sort };
    for (const select of this.renderRoot.querySelectorAll('select')) {
      const value = values[select.name];
      if (value !== undefined && select.value !== value) select.value = value;
    }
  }

  private gradeOptions(selected: number) {
    return this.grades.map((g, i) => html`<option value=${i} ?selected=${i === selected}>${g}</option>`);
  }

  render() {
    const f = this.current;
    const list = filterRoutes(this.routes, f, this.store, this.grades.length);
    const showReset = !this.isDefault(f);
    return html`<div class="filters">
        <label
          >Niveau
          <span class="range">
            <select
              name="min"
              aria-label="Niveau minimum"
              @change=${(e: Event) => this.change({ min: Number((e.target as HTMLSelectElement).value) })}
            >
              ${this.gradeOptions(f.min)}
            </select>
            à
            <select
              name="max"
              aria-label="Niveau maximum"
              @change=${(e: Event) => this.change({ max: Number((e.target as HTMLSelectElement).value) })}
            >
              ${this.gradeOptions(f.max)}
            </select>
          </span>
        </label>
        <label
          >Statut
          <select
            name="status"
            @change=${(e: Event) => this.change({ status: (e.target as HTMLSelectElement).value as StatusFilter })}
          >
            ${STATUS_OPTIONS.map((o) => html`<option value=${o.value} ?selected=${o.value === f.status}>${o.label}</option>`)}
          </select>
        </label>
        <div class="chips">
          <button
            class="chip"
            name="favorites"
            aria-pressed=${f.favorites ? 'true' : 'false'}
            @click=${() => this.change({ favorites: !f.favorites })}
          >
            ★ Favoris
          </button>
          <button
            class="chip"
            name="competition"
            aria-pressed=${f.competition ? 'true' : 'false'}
            @click=${() => this.change({ competition: !f.competition })}
          >
            Compétition
          </button>
          <label class="sort"
            >${sortIcon} Tri
            <select
              name="sort"
              @change=${(e: Event) => this.change({ sort: (e.target as HTMLSelectElement).value as SortOrder })}
            >
              ${SORT_OPTIONS.map((o) => html`<option value=${o.value} ?selected=${o.value === f.sort}>${o.label}</option>`)}
            </select>
          </label>
          ${showReset
            ? html`<button class="reset" @click=${() => this.change(defaultFilters(this.grades.length))}>
                Réinitialiser
              </button>`
            : ''}
        </div>
      </div>
      <p class="count" role="status">${list.length} voie${list.length > 1 ? 's' : ''}</p>
      <div class="scroll">
        <lardy-route-list
          show-wall
          .routes=${list}
          .store=${this.store}
          empty="Aucune voie ne correspond à ces filtres."
        ></lardy-route-list>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-all-routes-view': AllRoutesView;
  }
}
