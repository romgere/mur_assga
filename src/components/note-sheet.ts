import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  DETAILS,
  MAX_NOTE_LENGTH,
  ascentSummary,
  detailsKey,
  detailsOf,
  hasFlaw,
  progressStore,
  withDetail,
  type ClimbMode,
  type Detail,
  type ProgressStore,
  type RouteProgress,
} from '../lib/progress-store';
import { gradeVotes, type GradeVotes } from '../lib/grade-votes';
import { trendIcon } from './icons';
import { GRADE_SCALE, MIN_VOTES, countedVote, summarizeVotes, voteChoices } from '../lib/grades';
import { ChangeController } from '../lib/store-controller';
import type { Route } from '../lib/topo';
import { helpButton } from './help-sheet';
import { sharedStyles } from './shared-styles';
import './bottom-sheet';

/** Tendance des votes, en court pour tenir sur une ligne. */
const SHORT = { harder: 'Ressentie plus dure', easier: 'Ressentie plus facile', same: 'Ressentie juste' } as const;

const MODES: { mode: ClimbMode; label: string; cls: string }[] = [
  { mode: 't', label: 'Tête', cls: 'lead' },
  { mode: 'm', label: 'Moulinette', cls: 'toprope' },
];

/**
 * Feuille de détails d'une voie : comment elle a été grimpée (à vue, flash,
 * chute, repos, partiel) en tête et en moulinette, la cotation ressentie
 * (vote, avec la répartition des votes de tous) et sa note (méthode…).
 */
@customElement('lardy-note-sheet')
export class NoteSheet extends LitElement {
  static styles = [
    sharedStyles,
    css`
      p {
        margin: 0 0 8px;
        font-size: var(--font-md);
        color: var(--text-muted);
      }

      .card {
        margin: 0 0 8px;
        padding: 6px 8px 4px 10px;
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
        gap: 10px;
      }

      /* Même bouton que Tête / Moul. dans la liste des voies. */
      .mode {
        flex: none;
        min-width: 96px;
        height: 34px;
        padding: 0 12px;
        border-radius: 10px;
        border: 1.5px solid var(--border);
        background: var(--surface);
        font-size: var(--font-md);
        font-weight: 700;
        color: var(--text-muted);
      }

      .mode[aria-pressed='true'] {
        background: var(--mode);
        border-color: var(--mode);
        color: var(--mode-ink);
      }

      /* Ascension avec chute, repos ou partielle : contour en pointillés. */
      .mode.detailed[aria-pressed='true'] {
        background: var(--surface);
        color: var(--mode);
        border-style: dashed;
      }

      .summary {
        flex: 1;
        min-width: 0;
        font-size: var(--font-md);
        font-style: italic;
        color: var(--text-muted);
      }

      /* Les détails dépendent du mode : en retrait sous son bouton. */
      .how {
        margin: 2px 0 0 6px;
        padding-left: 12px;
        border-left: 2px solid var(--border);
      }

      /* Mêmes cases que le menu de l'appui long sur Tête / Moul. */
      .checks {
        display: flex;
        flex-wrap: wrap;
        gap: 0 18px;
      }

      .checks label {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        font-size: var(--font-lg);
      }

      .checks input {
        accent-color: var(--mode);
      }

      .feel h3 {
        margin: 4px 0 6px;
        font-size: var(--font-lg);
      }

      /* Tendance des votes sur une ligne ; la répartition s'ouvre au besoin. */
      .trend {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        min-height: 36px;
        margin: 0 0 6px;
        padding: 0;
        border: 0;
        background: none;
        text-align: left;
        font-size: var(--font-md);
        color: var(--text-muted);
      }

      .trend .feel-icon {
        display: inline-flex;
        color: var(--text-muted);
      }

      .trend .feel-icon.harder {
        color: var(--danger);
      }

      .trend .feel-icon.easier {
        color: var(--accent);
      }

      .trend .toggle-text {
        margin-left: auto;
        white-space: nowrap;
        font-weight: 700;
        color: var(--accent);
      }

      /* Les 9 cotations sur une seule ligne, même sur un petit téléphone. */
      .choices {
        display: flex;
        gap: 3px;
        margin-bottom: 8px;
      }

      .choices button {
        flex: 1 1 0;
        min-width: 0;
        height: 38px;
        padding: 0;
        border-radius: 8px;
        border: 1.5px solid var(--border);
        background: var(--surface);
        font-size: var(--font-sm);
        letter-spacing: -0.02em;
        font-weight: 700;
        color: var(--text);
      }

      .choices button.official {
        border-style: dashed;
      }

      .choices button[aria-pressed='true'] {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--accent-ink);
      }

      .bars {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 3px 8px;
        margin: 0 0 10px;
        font-size: var(--font-sm);
      }

      .bars .grade {
        font-weight: 700;
      }

      .bars .grade.official::after {
        content: ' (officielle)';
        font-weight: 400;
        color: var(--text-muted);
      }

      .bars .bar {
        height: 10px;
        border-radius: 5px;
        background: var(--surface-2);
        overflow: hidden;
      }

      .bars .bar span {
        display: block;
        height: 100%;
        background: var(--accent);
      }

      .bars .count {
        min-width: 1.5em;
        text-align: right;
        color: var(--text-muted);
      }

      textarea {
        min-height: 120px;
        font-size: var(--font-lg);
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
  @property({ attribute: false }) votes: GradeVotes = gradeVotes;

  @state() private draft = '';
  /** Cotation ressentie votée, enregistrée avec la note. */
  @state() private vote: string | undefined;
  /** Répartition des votes dépliée (repliée à chaque ouverture de la feuille). */
  @state() private votesOpen = false;
  /** Tête, moulinette et leurs détails, enregistrés avec la note. */
  @state() private ascents: RouteProgress = {};

  constructor() {
    super();
    new ChangeController(this, () => this.votes);
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('route') && this.route) {
      const { t, m, tx, mx, n, g } = this.store.get(this.route.id);
      this.draft = n ?? '';
      this.vote = g;
      this.votesOpen = false;
      this.ascents = { t, m, tx, mx };
    }
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
    if (this.route) this.store.edit(this.route.id, { ...this.ascents, n: this.draft, g: this.vote });
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
        return html`<section class="card ${cls}" aria-label=${label}>
          <div class="card-head">
            <button
              class="mode ${hasFlaw(a, mode) ? 'detailed' : ''}"
              aria-pressed=${a[mode] ? 'true' : 'false'}
              aria-label="Faite en ${label.toLowerCase()}"
              @click=${() => this.setMode(mode, !a[mode])}
            >
              ${label}
            </button>
            <span class="summary">→ ${ascentSummary(a, mode)}</span>
            ${helpButton(this)}
          </div>
          <div class="how" role="group" aria-label="Comment, en ${label.toLowerCase()}">
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
          </div>
        </section>`;
      })}
      ${r ? this.renderFeel(r) : ''}
      <p>Note personnelle : méthode, passage clé…</p>
      <label class="visually-hidden" for="note">Note</label>
      <textarea
        id="note"
        maxlength=${MAX_NOTE_LENGTH}
        placeholder="Ex. : départ dur, repos à mi-hauteur"
        .value=${this.draft}
        @input=${(e: Event) => (this.draft = (e.target as HTMLTextAreaElement).value)}
      ></textarea>
      <div class="actions">
        ${hasNote ? html`<button class="btn remove" @click=${this.deleteNote}>Supprimer la note</button>` : ''}
        <button class="btn primary save" @click=${this.save}>Enregistrer</button>
      </div>
    </lardy-sheet>`;
  }

  /**
   * Cotation ressentie : son vote (sauvegarde en ligne et voie faite) et la
   * répartition des votes, avec le sien tel qu'il est dans la feuille.
   */
  private renderFeel(r: Route) {
    const choices = voteChoices(r.grade);
    if (!choices.length) return '';
    const entry = { ...this.ascents, g: this.vote };
    const counts = this.votes.counts(r.id, entry);
    const { total, trend } = summarizeVotes(counts, r.grade);
    const max = Math.max(1, ...Object.values(counts));
    const shown = GRADE_SCALE.filter((g) => choices.includes(g) || counts[g]);
    let ask;
    if (!this.votes.canVote) {
      ask = html`<p class="hint">Pour voter, activez la sauvegarde en ligne (Réglages) : un vote par code de sauvegarde.</p>`;
    } else if (!countedVote({ ...entry, g: r.grade })) {
      ask = html`<p class="hint">Cochez la voie (en tête ou en moulinette, terminée) pour donner votre cotation.</p>`;
    } else {
      ask = html`<div class="choices" role="group" aria-label="Votre cotation">
        ${choices.map(
          (g) => html`<button
            class=${g === r.grade ? 'official' : ''}
            aria-pressed=${this.vote === g ? 'true' : 'false'}
            @click=${() => (this.vote = this.vote === g ? undefined : g)}
          >
            ${g}
          </button>`,
        )}
      </div>`;
    }
    let trendText: string;
    if (!total) trendText = 'Aucun avis pour l’instant';
    else if (trend) trendText = `${SHORT[trend]} · ${total} avis`;
    else trendText = `${total} avis · tendance à partir de ${MIN_VOTES}`;
    return html`<section class="feel" aria-label="Cotation ressentie">
      <h3>Cotation ressentie</h3>
      ${ask}
      ${total
        ? html`<button
              class="trend"
              aria-expanded=${this.votesOpen ? 'true' : 'false'}
              aria-controls="votes"
              @click=${() => (this.votesOpen = !this.votesOpen)}
            >
              ${trend ? html`<span class="feel-icon ${trend}">${trendIcon(trend)}</span>` : ''}
              <span class="trend-text">${trendText}</span>
              <span class="toggle-text">${this.votesOpen ? 'Masquer ▴' : 'Détail ▾'}</span>
            </button>
            ${this.votesOpen
              ? html`<div class="bars" id="votes" role="list" aria-label="Répartition des votes">
                  ${shown.map(
                    (g) => html`<span class="grade ${g === r.grade ? 'official' : ''}" role="listitem">${g}</span>
                      <span class="bar"><span style="width: ${((counts[g] ?? 0) / max) * 100}%"></span></span>
                      <span class="count">${counts[g] ?? 0}</span>`,
                  )}
                </div>`
              : ''}`
        : html`<p class="trend">${trendText}</p>`}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-note-sheet': NoteSheet;
  }
}
