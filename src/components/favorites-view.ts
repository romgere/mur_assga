import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { progressStore, type ProgressStore } from '../lib/progress-store';
import { StoreController } from '../lib/store-controller';
import { sharedStyles } from './shared-styles';
import './route-list';

/**
 * Mode « Favoris » : les voies étoilées, dans l'ordre des murs. Comme pour
 * « Toutes », la liste est calculée à l'ouverture de l'onglet (ou après
 * import/effacement) : retirer l'étoile ne fait pas disparaître la ligne
 * sous le doigt, ce qui permet de la remettre.
 */
@customElement('lardy-favorites-view')
export class FavoritesView extends LitElement {
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

      header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin: 4px 0 8px;
      }

      h2 {
        margin: 0;
        font-size: 20px;
      }

      .count {
        font-size: 13px;
        color: var(--text-muted);
      }
    `,
  ];

  @property({ attribute: false }) store: ProgressStore = progressStore;

  constructor() {
    super();
    new StoreController(
      this,
      () => this.store,
      (id) => id === undefined,
    );
  }

  render() {
    const routes = this.store.topo.routes.filter((r) => this.store.get(r.id).s);
    return html`<header>
        <h2>Favoris</h2>
        <span class="count" role="status">${routes.length} voie${routes.length > 1 ? 's' : ''}</span>
      </header>
      <lardy-route-list
        show-wall
        .routes=${routes}
        .store=${this.store}
        empty="Aucun favori pour l’instant. Touchez l’étoile d’une voie pour la retrouver ici."
      ></lardy-route-list>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-favorites-view': FavoritesView;
  }
}
