import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { PwaController, pwaState, type PwaState } from '../lib/pwa';
import { sharedStyles } from './shared-styles';

/**
 * Bandeau « Nouvelle version disponible » : affiché quand le service worker
 * a téléchargé une mise à jour (nouveau topo ou nouvelle version de l'appli).
 */
@customElement('lardy-update-banner')
export class UpdateBanner extends LitElement {
  static styles = [
    sharedStyles,
    css`
      /* Sans boîte propre : pas d'espace réservé quand le bandeau est caché. */
      :host {
        display: contents;
      }

      .banner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 8px 10px 8px 12px;
        border-radius: 12px;
        background: var(--accent-soft);
        color: var(--text);
      }

      p {
        flex: 1 1 160px;
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .actions {
        display: flex;
        gap: 6px;
        margin-left: auto;
      }

      .btn {
        min-height: 36px;
        font-size: 14px;
      }

      .later {
        background: transparent;
        border-color: transparent;
        color: var(--accent);
      }
    `,
  ];

  @property({ attribute: false }) pwa: PwaState = pwaState;

  constructor() {
    super();
    new PwaController(this, () => this.pwa);
  }

  render() {
    if (!this.pwa.needRefresh) return nothing;
    return html`<div class="banner" role="status">
      <p>Nouvelle version disponible (topo ou application mis à jour).</p>
      <div class="actions">
        <button class="btn later" @click=${() => this.pwa.dismissUpdate()}>Plus tard</button>
        <button class="btn primary update" @click=${() => this.pwa.update()}>Mettre à jour</button>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-update-banner': UpdateBanner;
  }
}
