import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { progressStore, type ProgressStore } from '../lib/progress-store';
import type { ClimbMode } from '../lib/progress-store';
import { StoreController } from '../lib/store-controller';
import { gradeLevel } from '../lib/topo';
import type { StatsCount, StatusFilter } from '../lib/ui-state';
import { ASCENT_STYLES, ascentBreakdown, gradePages, matchesStatus, maxGrade, type AscentStyle } from '../lib/views';
import { sharedStyles } from './shared-styles';
import './progress-counters';

export interface StatsCountChangeDetail {
  count: StatsCount;
}

/** Demande d'afficher, dans « Toutes », les voies d'un statut. */
export interface ShowRoutesDetail {
  status: StatusFilter;
}

const MAX_TILES: { status: StatusFilter; label: string }[] = [
  { status: 'avue', label: 'À vue' },
  { status: 'flash', label: 'Flash' },
  { status: 'cleanlead', label: 'Tête propre' },
  { status: 'cleantoprope', label: 'Moul. propre' },
];

const STYLE_LABELS: Record<AscentStyle, string> = {
  avue: 'À vue',
  flash: 'Flash',
  clean: 'Propre',
  flaw: 'Chute / repos',
  partial: 'Partiel',
};

const BREAKDOWN_MODES: { mode: ClimbMode; label: string; cls: string }[] = [
  { mode: 't', label: 'Tête', cls: 'lead' },
  { mode: 'm', label: 'Moulinette', cls: 'toprope' },
];

const REWORK: { status: StatusFilter; label: string }[] = [
  { status: 'partial', label: 'Partielles, à finir' },
  { status: 'leadflaw', label: 'En tête avec chute ou repos, à enchaîner' },
  { status: 'topropenotlead', label: 'Faites en moulinette, pas encore en tête' },
];

const chevron = html`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const COUNT_OPTIONS: { value: StatsCount; label: string }[] = [
  { value: 'done', label: 'Toutes' },
  { value: 'toprope', label: 'Moulinette' },
  { value: 'lead', label: 'En tête' },
];

/**
 * Mode « Stats » : les compteurs globaux, le niveau max par style, la
 * répartition des ascensions, les voies à retravailler, puis une carte par
 * cotation présente sur le topo, avec un filtre (toutes / moulinette / en
 * tête). Les tuiles et raccourcis ouvrent « Toutes » sur le filtre voulu.
 */
@customElement('lardy-stats-view')
export class StatsView extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior-y: contain;
        padding: 4px var(--gutter-right) 16px var(--gutter-left);
      }

      .segmented {
        display: flex;
        margin-bottom: 8px;
        padding: 3px;
        border-radius: 12px;
        background: var(--surface-2);
      }

      .segmented button {
        flex: 1;
        height: 34px;
        border-radius: 9px;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-muted);
      }

      .segmented button[aria-checked='true'] {
        background: var(--surface);
        color: var(--text);
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
      }

      h2 {
        margin: 16px 0 8px;
        font-size: 17px;
      }

      h2:first-child {
        margin-top: 4px;
      }

      .grades {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .tiles {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }

      .tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 8px 4px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: var(--surface);
      }

      .tile:disabled {
        cursor: default;
      }

      .tile .label {
        font-size: 12px;
        font-weight: 600;
        line-height: 1.2;
        text-align: center;
        color: var(--text-muted);
      }

      .tile .grade {
        font-size: 22px;
        font-weight: 800;
        line-height: 1.1;
        color: var(--text);
      }

      .tile .grade.g4 {
        color: var(--g4);
      }
      .tile .grade.g5 {
        color: var(--g5);
      }
      .tile .grade.g6 {
        color: var(--g6);
      }
      .tile .grade.g7 {
        color: var(--g7);
      }

      .tile .sub {
        font-size: 11px;
        color: var(--text-muted);
      }

      .breakdown {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: var(--surface);
      }

      /* Rampe ordonnée dans la couleur du mode : du plus propre (foncé) au partiel (hachuré). */
      .mode-row.lead {
        --mode: var(--lead);
      }
      .mode-row.toprope {
        --mode: var(--toprope);
      }

      .mode-head {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        font-weight: 700;
      }

      .mode-head .count {
        font-weight: 600;
        color: var(--text-muted);
      }

      .bar {
        display: flex;
        gap: 2px;
        height: 12px;
        margin: 4px 0 6px;
        border-radius: 4px;
        overflow: hidden;
        background: var(--surface-2);
      }

      .seg {
        min-width: 3px;
      }

      .avue {
        --sw: var(--mode);
      }
      .flash {
        --sw: color-mix(in srgb, var(--mode) 78%, var(--surface-2));
      }
      .clean {
        --sw: color-mix(in srgb, var(--mode) 56%, var(--surface-2));
      }
      .flaw {
        --sw: color-mix(in srgb, var(--mode) 34%, var(--surface-2));
      }
      .partial {
        --sw: repeating-linear-gradient(
          135deg,
          color-mix(in srgb, var(--mode) 34%, var(--surface-2)) 0 3px,
          var(--surface-2) 3px 6px
        );
      }

      .seg,
      .swatch {
        background: var(--sw);
      }

      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 12px;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 12px;
        color: var(--text-muted);
      }

      .legend li {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .legend strong {
        color: var(--text);
      }

      .swatch {
        width: 10px;
        height: 10px;
        border-radius: 3px;
      }

      .rework {
        display: flex;
        flex-direction: column;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: var(--surface);
        overflow: hidden;
      }

      .rework button {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 44px;
        padding: 0 10px 0 12px;
        font-size: 14px;
        text-align: left;
        color: var(--text);
      }

      .rework button + button {
        border-top: 1px solid var(--border);
      }

      .rework .label {
        flex: 1;
      }

      .rework .count {
        font-weight: 800;
      }

      .rework svg {
        color: var(--text-muted);
      }

      .rework button:disabled {
        cursor: default;
        color: var(--text-muted);
      }
    `,
  ];

  @property({ attribute: false }) store: ProgressStore = progressStore;
  @property() count: StatsCount = 'done';

  constructor() {
    super();
    // Niveau max, répartition et raccourcis suivent le store (import, effacement…).
    new StoreController(this, () => this.store);
  }

  private select(count: StatsCount) {
    if (count === this.count) return;
    this.count = count;
    this.dispatchEvent(new CustomEvent<StatsCountChangeDetail>('count-change', { detail: { count } }));
  }

  private showRoutes(status: StatusFilter) {
    this.dispatchEvent(
      new CustomEvent<ShowRoutesDetail>('show-routes', { detail: { status }, bubbles: true, composed: true }),
    );
  }

  private renderMaxTiles() {
    const routes = this.store.topo.routes;
    return html`<div class="tiles">
      ${MAX_TILES.map(({ status, label }) => {
        const max = maxGrade(routes, this.store, status);
        return html`<button
          class="tile"
          data-status=${status}
          ?disabled=${!max}
          aria-label=${max
            ? `${label} : ${max.grade}, ${max.count} voie${max.count > 1 ? 's' : ''}`
            : `${label} : aucune voie`}
          @click=${() => this.showRoutes(status)}
        >
          <span class="label">${label}</span>
          <span class="grade ${max ? `g${gradeLevel(max.grade)}` : ''}">${max ? max.grade : '—'}</span>
          <span class="sub">${max ? `${max.count} voie${max.count > 1 ? 's' : ''}` : 'aucune'}</span>
        </button>`;
      })}
    </div>`;
  }

  private renderBreakdown() {
    const routes = this.store.topo.routes;
    return html`<div class="breakdown">
      ${BREAKDOWN_MODES.map(({ mode, label, cls }) => {
        const counts = ascentBreakdown(routes, this.store, mode);
        const total = routes.length;
        const climbed = total - counts.none;
        const description = ASCENT_STYLES.map((st) => `${STYLE_LABELS[st]} ${counts[st]}`).join(', ');
        return html`<div class="mode-row ${cls}">
          <div class="mode-head">
            <span>${label}</span>
            <span class="count">${climbed} voie${climbed > 1 ? 's' : ''}</span>
          </div>
          <div class="bar" role="img" aria-label="${label} : ${description}, sur ${total} voies">
            ${ASCENT_STYLES.filter((st) => counts[st] > 0).map(
              (st) =>
                html`<span
                  class="seg ${st}"
                  title="${STYLE_LABELS[st]} : ${counts[st]}"
                  style=${styleMap({ width: `${(counts[st] / total) * 100}%` })}
                ></span>`,
            )}
          </div>
          <ul class="legend" aria-hidden="true">
            ${ASCENT_STYLES.map(
              (st) =>
                html`<li class=${st}><span class="swatch"></span>${STYLE_LABELS[st]} <strong>${counts[st]}</strong></li>`,
            )}
          </ul>
        </div>`;
      })}
    </div>`;
  }

  private renderRework() {
    const routes = this.store.topo.routes;
    return html`<div class="rework">
      ${REWORK.map(({ status, label }) => {
        const count = routes.filter((r) => matchesStatus(this.store.get(r.id), status)).length;
        return html`<button data-status=${status} ?disabled=${!count} @click=${() => this.showRoutes(status)}>
          <span class="label">${label}</span>
          <span class="count">${count}</span>
          ${chevron}
        </button>`;
      })}
    </div>`;
  }

  render() {
    // La traversée n'a pas de cotation : elle ne compte que dans les totaux.
    const grades = gradePages(this.store.topo).filter((p) => p.routes[0].gradeIndex >= 0);
    return html`<h2>Globale</h2>
      <lardy-progress-counters .store=${this.store}></lardy-progress-counters>
      <h2>Niveau max</h2>
      ${this.renderMaxTiles()}
      <h2>Répartition</h2>
      ${this.renderBreakdown()}
      <h2>À retravailler</h2>
      ${this.renderRework()}
      <h2>Par niveau</h2>
      <div class="segmented" role="radiogroup" aria-label="Voies comptées par niveau">
        ${COUNT_OPTIONS.map(
          (o) =>
            html`<button
              role="radio"
              data-count=${o.value}
              aria-checked=${o.value === this.count ? 'true' : 'false'}
              @click=${() => this.select(o.value)}
            >
              ${o.label}
            </button>`,
        )}
      </div>
      <div class="grades">
        ${grades.map(
          (p) =>
            html`<lardy-progress-counters
              label=${p.label}
              count=${this.count}
              style=${styleMap({ '--bar': `var(--g${gradeLevel(p.label)})` })}
              .routes=${p.routes}
              .store=${this.store}
            ></lardy-progress-counters>`,
        )}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-stats-view': StatsView;
  }
}
