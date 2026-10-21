import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { progressStore, type ProgressStore } from '../lib/progress-store';
import { gradeLevel } from '../lib/topo';
import type { StatsCount } from '../lib/ui-state';
import { gradePages } from '../lib/views';
import { sharedStyles } from './shared-styles';
import './progress-counters';

export interface StatsCountChangeDetail {
  count: StatsCount;
}

const COUNT_OPTIONS: { value: StatsCount; label: string }[] = [
  { value: 'done', label: 'Toutes' },
  { value: 'toprope', label: 'Moulinette' },
  { value: 'lead', label: 'En tête' },
];

/**
 * Mode « Stats » : les compteurs globaux, puis une carte par cotation
 * présente sur le topo, avec un filtre (toutes / moulinette / en tête).
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
    `,
  ];

  @property({ attribute: false }) store: ProgressStore = progressStore;
  @property() count: StatsCount = 'done';

  private select(count: StatsCount) {
    if (count === this.count) return;
    this.count = count;
    this.dispatchEvent(new CustomEvent<StatsCountChangeDetail>('count-change', { detail: { count } }));
  }

  render() {
    // La traversée n'a pas de cotation : elle ne compte que dans les totaux.
    const grades = gradePages(this.store.topo).filter((p) => p.routes[0].gradeIndex >= 0);
    return html`<h2>Globale</h2>
      <lardy-progress-counters .store=${this.store}></lardy-progress-counters>
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
