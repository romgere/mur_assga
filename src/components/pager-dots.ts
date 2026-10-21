import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { progressStore, type ProgressStore } from '../lib/progress-store';
import { StoreController } from '../lib/store-controller';
import { pageStatus, type Page } from '../lib/views';
import { sharedStyles } from './shared-styles';

export interface PageSelectDetail {
  index: number;
}

const STATUS_LABEL = { none: '', partial: ', en partie faites', complete: ', toutes faites' };

/**
 * Barre de pastilles sous le pager : suit la page courante et montre un point
 * plein (toutes les voies faites) ou évidé (en partie faites).
 */
@customElement('lardy-pager-dots')
export class PagerDots extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      nav {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        scrollbar-width: none;
        padding: 6px var(--gutter-right) 6px var(--gutter-left);
      }

      nav::-webkit-scrollbar {
        display: none;
      }

      button {
        position: relative;
        flex: 1 0 auto;
        min-width: 32px;
        height: 36px;
        padding: 0 6px;
        border-radius: 18px;
        background: var(--surface-2);
        color: var(--text-muted);
        font-size: 13px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }

      button[aria-current='page'] {
        background: var(--accent);
        color: var(--accent-ink);
      }

      .dot {
        position: absolute;
        top: 3px;
        right: 3px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .dot.complete {
        background: var(--dot-complete);
        box-shadow: 0 0 0 1.5px var(--surface);
      }

      .dot.partial {
        border: 2px solid var(--dot-partial);
        background: var(--surface);
      }
    `,
  ];

  @property({ attribute: false }) pages: Page[] = [];
  @property({ type: Number }) index = 0;
  @property({ attribute: false }) store: ProgressStore = progressStore;
  @property() label = 'Pages';

  @query('nav') private nav!: HTMLElement;

  constructor() {
    super();
    new StoreController(this, () => this.store);
  }

  private select(index: number) {
    this.dispatchEvent(new CustomEvent<PageSelectDetail>('page-select', { detail: { index } }));
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('index') || changed.has('pages')) this.revealCurrent();
  }

  /** Garde la pastille courante visible quand la barre déborde. */
  private revealCurrent(): void {
    const btn = this.nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!btn || this.nav.scrollWidth <= this.nav.clientWidth) return;
    const left = btn.offsetLeft - (this.nav.clientWidth - btn.offsetWidth) / 2;
    if (typeof this.nav.scrollTo === 'function') this.nav.scrollTo({ left, behavior: 'smooth' });
  }

  render() {
    return html`<nav aria-label=${this.label}>
      ${this.pages.map((p, i) => {
        const status = pageStatus(p.routes, this.store);
        return html`<button
          aria-current=${i === this.index ? 'page' : 'false'}
          aria-label="${p.title}${STATUS_LABEL[status]}"
          data-status=${status}
          @click=${() => this.select(i)}
        >
          ${p.label}${status === 'none' ? '' : html`<span class="dot ${status}"></span>`}
        </button>`;
      })}
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-pager-dots': PagerDots;
  }
}
