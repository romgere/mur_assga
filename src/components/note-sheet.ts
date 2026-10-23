import { LitElement, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import {
  DETAILS,
  MAX_NOTE_LENGTH,
  ascentSummary,
  detailsKey,
  detailsOf,
  progressStore,
  withDetail,
  type ClimbMode,
  type Detail,
  type ProgressStore,
  type RouteProgress,
} from '../lib/progress-store';
import type { Route } from '../lib/topo';
import { helpButton } from './help-sheet';
import { sharedStyles } from './shared-styles';
import './bottom-sheet';

const MODES: { mode: ClimbMode; label: string; cls: string }[] = [
  { mode: 't', label: 'Tête', cls: 'lead' },
  { mode: 'm', label: 'Moulinette', cls: 'toprope' },
];

/**
 * Feuille de détails d'une voie : comment elle a été grimpée (à vue, flash,
 * chute, repos, partiel) en tête et en moulinette, et sa note (cotation ressentie, méthode…).
 */
@customElement('lardy-note-sheet')
export class NoteSheet extends LitElement {
  static styles = [
    sharedStyles,
    css`
      p {
        margin: 0 0 8px;
        font-size: 14px;
        color: var(--text-muted);
      }

      .card {
        margin: 0 0 10px;
        padding: 8px 12px 10px;
        border: 1px solid var(--border);
        border-left: 5px solid var(--mode);
        border-radius: 10px;
      }

      .card.lead {
        --mode: var(--lead);
        --mode-ink: var(--lead-ink);
      }

      .card.toprope {
        --mode: var(--toprope);
        --mode-ink: var(--toprope-ink);
      }

      .card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .card-head h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--mode);
      }

      .mode {
        min-width: 84px;
        height: 36px;
        padding: 0 10px;
        border-radius: 10px;
        border: 1.5px solid var(--border);
        background: var(--surface);
        font-size: 14px;
        font-weight: 700;
        color: var(--text-muted);
      }

      .mode[aria-pressed='true'] {
        background: var(--mode);
        border-color: var(--mode);
        color: var(--mode-ink);
      }

      /* Les puces dépendent du mode : en retrait, et estompées tant qu'il n'est pas coché. */
      .how {
        margin: 6px 0 0 6px;
        padding-left: 12px;
        border-left: 2px solid var(--border);
      }

      .card:not(.on) .how {
        opacity: 0.55;
      }

      .how-label {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-muted);
      }

      /* Mêmes cases que le menu de l'appui long sur Tête / Moul. */
      .checks {
        display: flex;
        flex-wrap: wrap;
        gap: 0 18px;
      }

      .checks.flaw {
        margin-top: 2px;
        padding-top: 2px;
        border-top: 1px solid var(--border);
      }

      .checks label {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        font-size: 15px;
      }

      .checks input {
        accent-color: var(--mode);
      }

      .summary {
        margin: 0;
        font-size: 13px;
        font-style: italic;
      }

      textarea {
        min-height: 120px;
        font-size: 16px;
        background: var(--bg);
      }

      .actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .actions .primary {
        margin-left: auto;
      }
    `,
  ];

  @property({ attribute: false }) route: Route | null = null;
  @property({ attribute: false }) store: ProgressStore = progressStore;

  @state() private draft = '';
  /** Tête, moulinette et leurs détails, enregistrés avec la note. */
  @state() private ascents: RouteProgress = {};
  @query('textarea') private textarea?: HTMLTextAreaElement;
  @query('lardy-sheet') private sheet?: HTMLElement & { updateComplete: Promise<boolean> };

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('route') && this.route) {
      const { t, m, tx, mx, n } = this.store.get(this.route.id);
      this.draft = n ?? '';
      this.ascents = { t, m, tx, mx };
    }
  }

  protected updated(changed: Map<string, unknown>): void {
    // La feuille doit d'abord s'afficher (et noter qui avait le focus).
    if (changed.has('route') && this.route) this.sheet?.updateComplete.then(() => this.textarea?.focus());
  }

  private close() {
    this.route = null;
    this.dispatchEvent(new CustomEvent('close'));
  }

  private setMode(mode: ClimbMode, on: boolean) {
    this.ascents = { ...this.ascents, [mode]: on, ...(on ? {} : { [detailsKey(mode)]: [] }) };
  }

  /** Cocher un détail coche aussi la façon de grimper. */
  private setDetail(mode: ClimbMode, detail: Detail, on: boolean) {
    const key = detailsKey(mode);
    const details = withDetail(this.ascents[key], detail, on);
    this.ascents = { ...this.ascents, [key]: details, ...(on ? { [mode]: true } : {}) };
  }

  private save() {
    if (this.route) this.store.edit(this.route.id, { ...this.ascents, n: this.draft });
    this.close();
  }

  private deleteNote() {
    if (this.route) this.store.setNote(this.route.id, '');
    this.close();
  }

  render() {
    const r = this.route;
    const heading = r ? `Mur ${r.wall} · ${r.color.toLowerCase()} ${r.grade ?? 'traversée'}` : '';
    const hasNote = !!(r && this.store.get(r.id).n);
    const a = this.ascents;
    return html`<lardy-sheet .open=${!!r} heading=${heading} @close=${this.close}>
      ${MODES.map(({ mode, label, cls }) => {
        const details = detailsOf(a, mode);
        return html`<section class="card ${cls} ${a[mode] ? 'on' : ''}" aria-label=${label}>
          <div class="card-head">
            <h3>${label}</h3>
            <button
              class="mode"
              aria-pressed=${a[mode] ? 'true' : 'false'}
              aria-label="Faite en ${label.toLowerCase()}"
              @click=${() => this.setMode(mode, !a[mode])}
            >
              ${a[mode] ? 'Faite' : 'Pas faite'}
            </button>
          </div>
          <div class="how" role="group" aria-label="Comment, en ${label.toLowerCase()}">
            <span class="how-label">Comment ? ${helpButton(this)}</span>
            ${(['clean', 'flaw'] as const).map(
              (kind) => html`<div class="checks ${kind}">
                ${DETAILS.filter((d) => d.kind === kind).map(
                  (d) => html`<label
                    ><input
                      type="checkbox"
                      class="detail-${d.code}"
                      .checked=${details.includes(d.code)}
                      @change=${(e: Event) => this.setDetail(mode, d.code, (e.target as HTMLInputElement).checked)}
                    />${d.label}</label
                  >`,
                )}
              </div>`,
            )}
            <p class="summary">→ ${ascentSummary(a, mode)}</p>
          </div>
        </section>`;
      })}
      <p>Cotation ressentie, méthode, passage clé… Pensez aussi à l'indiquer sur le topo du club.</p>
      <label class="visually-hidden" for="note">Note</label>
      <textarea
        id="note"
        maxlength=${MAX_NOTE_LENGTH}
        placeholder="Ex. : ressentie 6a+, départ dur"
        .value=${this.draft}
        @input=${(e: Event) => (this.draft = (e.target as HTMLTextAreaElement).value)}
      ></textarea>
      <div class="actions">
        ${hasNote ? html`<button class="btn remove" @click=${this.deleteNote}>Supprimer la note</button>` : ''}
        <button class="btn primary save" @click=${this.save}>Enregistrer</button>
      </div>
    </lardy-sheet>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-note-sheet': NoteSheet;
  }
}
