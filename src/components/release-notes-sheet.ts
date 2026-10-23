import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { lineText, lineTutorial, type ReleaseNote } from '../lib/release-notes';
import { sharedStyles } from './shared-styles';
import { knownSteps, requestTutorial } from './tutorial-sheet';
import './bottom-sheet';

/** Icône (i) des boutons qui ouvrent les notes de version. */
export const infoIcon = html`<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
  <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.6" />
  <path d="M12 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  <circle cx="12" cy="7.6" r="1.2" fill="currentColor" />
</svg>`;

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

      .link {
        display: block;
        margin-top: 2px;
        color: var(--accent);
        font-size: 14px;
        font-weight: 600;
        text-decoration: underline;
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
            ${n.notes.map((line) => {
              // Étapes inconnues (notes d'une version pas encore installée) : pas de lien.
              const steps = knownSteps(lineTutorial(line));
              const link = steps.length
                ? html`<button class="link tutorial" @click=${() => requestTutorial(this, steps)}>Voir comment ça marche</button>`
                : nothing;
              return html`<li>${lineText(line)}${link}</li>`;
            })}
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
