import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ReleaseNote } from '../lib/release-notes';
import { sharedStyles } from './shared-styles';
import './bottom-sheet';

/** Demande d'affichage de notes de version, émise par le bandeau et les réglages. */
export interface ShowReleaseNotesDetail {
  heading: string;
  notes: ReleaseNote[];
}

export function showReleaseNotesEvent(detail: ShowReleaseNotesDetail): CustomEvent<ShowReleaseNotesDetail> {
  return new CustomEvent('show-release-notes', { detail, bubbles: true, composed: true });
}

/** « 2026-10-23 » → « 23/10/2026 ». */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return d && m && y ? `${d}/${m}/${y}` : date;
}

/** Feuille listant les nouveautés d'une ou plusieurs versions. Émet « close ». */
@customElement('lardy-release-notes-sheet')
export class ReleaseNotesSheet extends LitElement {
  static styles = [
    sharedStyles,
    css`
      section + section {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--border);
      }

      h3 {
        margin: 0 0 6px;
        font-size: 15px;
      }

      h3 small {
        margin-left: 6px;
        font-size: 13px;
        font-weight: 400;
        color: var(--text-muted);
      }

      ul {
        margin: 0;
        padding-left: 22px;
        font-size: 14px;
      }

      li + li {
        margin-top: 4px;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 16px;
      }
    `,
  ];

  @property({ type: Boolean }) open = false;
  @property() heading = 'Nouveautés';
  @property({ attribute: false }) notes: ReleaseNote[] = [];

  private close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close'));
  }

  render() {
    return html`<lardy-sheet .open=${this.open} heading=${this.heading} @close=${this.close}>
      ${this.notes.map(
        (n) => html`<section class="release">
          <h3>Version ${n.version}<small>${formatDate(n.date)}</small></h3>
          <ul>
            ${n.notes.map((line) => html`<li>${line}</li>`)}
          </ul>
        </section>`,
      )}
      <div class="actions">
        <button class="btn primary ok" @click=${this.close}>OK</button>
      </div>
    </lardy-sheet>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-release-notes-sheet': ReleaseNotesSheet;
  }
}
