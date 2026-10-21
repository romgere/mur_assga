import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { progressStore, type ProgressStore } from '../lib/progress-store';
import { sharedStyles } from './shared-styles';
import './progress-counters';

/** Mode « Stats » : compteurs de progression globaux sur tout le topo. */
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

      h2 {
        margin: 4px 0 8px;
        font-size: 20px;
      }
    `,
  ];

  @property({ attribute: false }) store: ProgressStore = progressStore;

  render() {
    return html`<h2>Progression</h2>
      <lardy-progress-counters .store=${this.store}></lardy-progress-counters>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-stats-view': StatsView;
  }
}
