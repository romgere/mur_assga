import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Mode } from '../lib/ui-state';
import { sharedStyles } from './shared-styles';

export interface ModeChangeDetail {
  mode: Mode;
}

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'wall', label: 'Par mur' },
  { mode: 'grade', label: 'Par difficulté' },
  { mode: 'all', label: 'Toutes' },
];

/** Sélecteur segmenté des trois modes d'affichage. */
@customElement('lardy-mode-tabs')
export class ModeTabs extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      div {
        display: flex;
        padding: 3px;
        border-radius: 12px;
        background: var(--surface-2);
      }

      button {
        flex: 1;
        height: 36px;
        border-radius: 9px;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-muted);
      }

      button[aria-selected='true'] {
        background: var(--surface);
        color: var(--text);
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
      }
    `,
  ];

  @property() mode: Mode = 'wall';

  private select(mode: Mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.dispatchEvent(new CustomEvent<ModeChangeDetail>('mode-change', { detail: { mode } }));
  }

  render() {
    return html`<div role="tablist" aria-label="Mode d'affichage">
      ${MODES.map(
        ({ mode, label }) =>
          html`<button role="tab" aria-selected=${mode === this.mode ? 'true' : 'false'} @click=${() => this.select(mode)}>
            ${label}
          </button>`,
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-mode-tabs': ModeTabs;
  }
}
