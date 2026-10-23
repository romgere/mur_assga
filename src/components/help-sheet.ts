import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { DETAILS } from '../lib/progress-store';
import { sharedStyles } from './shared-styles';
import './bottom-sheet';

/** Événement qui demande l'ouverture de l'aide, écouté par l'application. */
export const OPEN_HELP = 'open-help';

export function requestHelp(from: Element): void {
  from.dispatchEvent(new Event(OPEN_HELP, { bubbles: true, composed: true }));
}

const infoIcon = html`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8" />
  <path d="M12 10.5v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <circle cx="12" cy="7.4" r="1.2" fill="currentColor" />
</svg>`;

/** Bouton (i) qui ouvre l'aide sur les états d'une voie ; before s'exécute juste avant. */
export function helpButton(from: Element, before?: () => void) {
  return html`<button
    class="help-btn"
    aria-label="Aide : états d'une voie"
    @click=${() => {
      before?.();
      requestHelp(from);
    }}
  >
    ${infoIcon}
  </button>`;
}

/** Une ligne de l'aide : état, description et s'il compte comme fait. */
const state = (label: string, description: string, done: boolean, cls = '') =>
  html`<li class=${cls}>
    <div class="state-head">
      <strong>${label}</strong>
      <span class="done ${done ? 'yes' : 'no'}">${done ? '✓ Faite' : '✗ Pas faite'}</span>
    </div>
    <p>${description}</p>
  </li>`;

/** Aide : ce que veulent dire tête, moulinette et chaque détail d'ascension. */
@customElement('lardy-help-sheet')
export class HelpSheet extends LitElement {
  static styles = [
    sharedStyles,
    css`
      h3 {
        margin: 14px 0 6px;
        font-size: 15px;
      }

      h3:first-child {
        margin-top: 4px;
      }

      p {
        margin: 0 0 6px;
        font-size: 14px;
        color: var(--text-muted);
      }

      ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        padding: 8px 0;
        border-top: 1px solid var(--border);
      }

      li p {
        margin: 2px 0 0;
      }

      .state-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        font-size: 15px;
      }

      .done {
        flex: none;
        padding: 1px 8px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 700;
      }

      .done.yes {
        background: var(--done-bg);
        color: var(--lead);
      }

      .done.no {
        background: var(--surface-2);
        color: var(--text-muted);
      }

      .group {
        margin: 10px 0 0;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
      }

      .lead strong {
        color: var(--lead);
      }

      .toprope strong {
        color: var(--toprope);
      }

      .rules {
        margin: 0;
        padding-left: 18px;
        list-style: disc;
        font-size: 14px;
        color: var(--text-muted);
      }

      .rules li {
        padding: 2px 0;
        border: 0;
      }
    `,
  ];

  @property({ type: Boolean }) open = false;

  private close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close'));
  }

  render() {
    const kinds = [
      { kind: 'clean', title: 'Du premier coup' },
      { kind: 'flaw', title: 'Pas d’un seul trait' },
    ] as const;
    return html`<lardy-sheet .open=${this.open} heading="États d’une voie" @close=${this.close}>
      <h3>Tête ou moulinette</h3>
      <p>Les deux se cochent indépendamment : une voie peut être faite en tête et en moulinette.</p>
      <ul>
        ${state('Tête', 'On grimpe en passant soi-même la corde dans les dégaines.', true, 'lead')}
        ${state('Moulinette', 'La corde passe déjà au relais, en haut de la voie.', true, 'toprope')}
      </ul>

      <h3>Comment ?</h3>
      <p>Pour préciser la façon dont la voie a été grimpée, en tête comme en moulinette.</p>
      <ul>
        ${state(
          'Sans détail',
          'Enchaînée proprement, sans chute ni repos, après un ou plusieurs essais.',
          true,
        )}
      </ul>
      ${kinds.map(
        ({ kind, title }) => html`<p class="group">${title}</p>
          <ul>
            ${DETAILS.filter((d) => d.kind === kind).map((d) => state(d.label, d.description, d.done))}
          </ul>`,
      )}

      <h3>Règles</h3>
      <ul class="rules">
        <li>À vue et Flash s’excluent entre eux et avec Chute, Repos et Partiel.</li>
        <li>Chute, Repos et Partiel se cumulent (par exemple : chute puis abandon).</li>
        <li>Une voie est faite si elle est terminée en tête ou en moulinette.</li>
        <li>Une voie partielle reste à finir : filtre « Partielles (à finir) » dans Toutes.</li>
      </ul>

      <h3>Saisie</h3>
      <ul class="rules">
        <li>Appui court sur Tête ou Moul. : faite, sans détail.</li>
        <li>Appui long (ou clic droit) sur Tête ou Moul. : menu rapide des détails.</li>
        <li>Crayon : tous les détails et la note de la voie.</li>
        <li>Bouton en pointillés : faite avec chute, repos ou partielle.</li>
      </ul>
    </lardy-sheet>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-help-sheet': HelpSheet;
  }
}
