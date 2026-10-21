import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { progressStore, type ProgressStore } from '../lib/progress-store';
import { StoreController } from '../lib/store-controller';
import type { Route } from '../lib/topo';
import type { StatsCount } from '../lib/ui-state';

/**
 * Compteurs de progression : tête, moulinette et voies faites (l'un ou
 * l'autre). Sans « routes », porte sur tout le topo. La variante compacte
 * sert dans l'en-tête de chaque page du pager.
 */
@customElement('lardy-progress-counters')
export class ProgressCounters extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .counters {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .counter {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: baseline;
      padding: 8px 12px;
      border-radius: 10px;
      background: var(--surface);
      border: 1px solid var(--border);
    }

    .label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .label.grade {
      font-size: 15px;
      font-weight: 800;
      text-transform: none;
      letter-spacing: 0;
      color: var(--bar, var(--text));
    }

    .value {
      font-size: 17px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }

    .total {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .bar {
      grid-column: 1 / -1;
      display: block;
      height: 4px;
      margin-top: 4px;
      border-radius: 2px;
      background: var(--surface-2);
      overflow: hidden;
    }

    .bar > span {
      display: block;
      height: 100%;
      background: var(--bar, var(--accent));
      transition: width 0.2s;
    }

    .lead {
      --bar: var(--lead);
    }
    .toprope {
      --bar: var(--toprope);
    }

    .compact {
      font-size: 13px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    .compact strong {
      color: var(--text);
    }
  `;

  @property({ attribute: false }) routes?: Route[];
  @property({ type: Boolean }) compact = false;
  /**
   * Si défini, une seule carte « faites » portant ce libellé (une cotation,
   * par exemple). La couleur de la barre vient de --bar sur l'élément.
   */
  @property() label = '';
  /** Avec « label » : compter les voies faites, en moulinette ou en tête. */
  @property() count: StatsCount = 'done';
  @property({ attribute: false }) store: ProgressStore = progressStore;

  constructor() {
    super();
    // Un compteur de page ne se repeint que si l'une de ses voies change.
    new StoreController(
      this,
      () => this.store,
      (id) => id === undefined || !this.routes || this.routes.some((r) => r.id === id),
    );
  }

  private counter(cls: string, label: string, value: number, total: number, labelClass = '') {
    const pct = total ? Math.round((value / total) * 100) : 0;
    return html`<div class="counter ${cls}" role="group" aria-label="${label} : ${value} sur ${total}">
      <span class="label ${labelClass}">${label}</span>
      <span><span class="value">${value}</span><span class="total">/${total}</span></span>
      <span class="bar"><span style="width:${pct}%"></span></span>
    </div>`;
  }

  render() {
    const c = this.store.counts(this.routes);
    if (this.compact) {
      return html`<span class="compact"
        ><strong>${c.done}/${c.total}</strong> faite${c.done > 1 ? 's' : ''} · T ${c.lead} · M ${c.toprope}</span
      >`;
    }
    if (this.label) {
      const value = this.count === 'lead' ? c.lead : this.count === 'toprope' ? c.toprope : c.done;
      return html`<div class="counters">${this.counter('single', this.label, value, c.total, 'grade')}</div>`;
    }
    return html`<div class="counters">
      ${this.counter('lead', 'Tête', c.lead, c.total)} ${this.counter('toprope', 'Moulinette', c.toprope, c.total)}
      ${this.counter('done', 'Faites', c.done, c.total)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-progress-counters': ProgressCounters;
  }
}
