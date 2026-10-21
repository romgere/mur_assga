import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { progressStore, type ProgressStore } from '../lib/progress-store';
import type { Route } from '../lib/topo';
import './route-row';

/** Liste de voies ; ne dépend pas du store, seules les lignes s'y abonnent. */
@customElement('lardy-route-list')
export class RouteList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .empty {
      margin: 24px 0;
      text-align: center;
      color: var(--text-muted);
    }
  `;

  @property({ attribute: false }) routes: Route[] = [];
  @property({ type: Boolean, attribute: 'show-wall' }) showWall = false;
  @property({ attribute: false }) store: ProgressStore = progressStore;
  @property() empty = 'Aucune voie.';

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'list');
  }

  render() {
    if (this.routes.length === 0) return html`<p class="empty" role="status">${this.empty}</p>`;
    return repeat(
      this.routes,
      (r) => r.id,
      (r) => html`<lardy-route-row .route=${r} .store=${this.store} ?show-wall=${this.showWall}></lardy-route-row>`,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-route-list': RouteList;
  }
}
