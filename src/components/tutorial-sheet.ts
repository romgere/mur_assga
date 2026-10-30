import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { progressSync, type ProgressSync } from '../lib/sync';
import { requestHelp } from './help-sheet';
import { gearIcon, noteIcon, starIcon, syncIcon } from './icons';
import { sharedStyles } from './shared-styles';
import './bottom-sheet';

/** Événement qui demande l'ouverture du tutoriel, écouté par l'application. */
export const OPEN_TUTORIAL = 'open-tutorial';

/** Étapes à montrer ; sans étapes, c'est le tutoriel de prise en main. */
export interface OpenTutorialDetail {
  steps?: string[];
}

export function requestTutorial(from: Element, steps?: string[]): void {
  from.dispatchEvent(
    new CustomEvent<OpenTutorialDetail>(OPEN_TUTORIAL, { detail: { steps }, bubbles: true, composed: true }),
  );
}

/** Distance horizontale (px) d'un glissement qui change d'étape. */
const SWIPE_PX = 50;

interface Step {
  title: string;
  /** Petite maquette décorative de l'interface. */
  art: TemplateResult;
  body: (sheet: TutorialSheet) => TemplateResult;
}

/**
 * Toutes les étapes, par identifiant. Une note de version peut renvoyer vers
 * n'importe laquelle (voir release-notes.json), qu'elle fasse partie de la
 * prise en main ou non.
 */
export const TUTORIAL_STEPS: Record<string, Step> = {
  bienvenue: {
    title: 'Bienvenue !',
    art: html`<img class="logo light" src="/logo-header-light.png" alt="" width="38" height="44" />
      <img class="logo dark" src="/logo-header-dark.png" alt="" width="37" height="44" />`,
    body: () => html`<p>Ce topo liste toutes les voies du mur de Lardy pour la saison.</p>
      <p>Cochez celles que vous avez faites et suivez votre progression. Tout reste sur votre téléphone, même hors connexion.</p>`,
  },
  navigation: {
    title: 'Parcourir les voies',
    art: html`<span class="tabs"
      ><span class="on">Mur</span><span>Difficulté</span><span>Toutes</span><span>Favoris</span><span>Stats</span></span
    >`,
    body: () => html`<p>Choisissez l’affichage en haut : par mur, par difficulté, toutes les voies (avec filtres et tri), vos favoris ou vos statistiques.</p>
      <p>Par mur ou par difficulté, glissez à gauche ou à droite pour changer de page. Les pastilles du bas montrent où vous en êtes.</p>`,
  },
  cocher: {
    title: 'Cocher une voie',
    art: html`<span class="demo"><span class="toggle lead">Tête</span><small>Appui court</small></span>
      <span class="demo"><span class="toggle toprope detailed">Moul.</span><small>Appui long</small></span>`,
    body: (sheet) => html`<p>Un appui court sur <strong>Tête</strong> ou <strong>Moul.</strong> coche la voie comme faite.</p>
      <p>Un appui long (ou clic droit) précise comment : à vue, flash, chute, repos ou partielle.</p>
      <button class="link help" @click=${() => requestHelp(sheet)}>Ce que veut dire chaque état</button>`,
  },
  favoris: {
    title: 'Favoris et notes',
    art: html`<span class="icon star">${starIcon(true)}</span><span class="icon">${noteIcon}</span>`,
    body: () => html`<p>L’étoile ajoute la voie à vos favoris, pour garder vos projets sous la main.</p>
      <p>Le crayon ouvre tous les détails de la voie et une note personnelle (cotation ressentie, méthode, passage clé…).</p>`,
  },
  synchro: {
    title: 'Ne perdez pas vos voies',
    art: html`<span class="icon">${syncIcon}</span>`,
    body: (sheet) => html`<p>Téléphone perdu, cassé ou remplacé ? Avec la sauvegarde en ligne, vous retrouvez toutes vos voies.</p>
      <p>Pas de compte ni d’e-mail : un code de sauvegarde suffit. Vous pourrez aussi l’activer plus tard dans les réglages.</p>
      ${sheet.renderSync()}`,
  },
  reglages: {
    title: 'Réglages',
    art: html`<span class="icon gear">${gearIcon}</span>`,
    body: () => html`<p>La roue dentée, en haut à droite : thème clair ou sombre, installation de l’application, sauvegarde en ligne ou manuelle de votre progression.</p>
      <p>Vous pourrez aussi y revoir ce tutoriel.</p>`,
  },
};

/** Tutoriel de prise en main, montré au premier lancement. */
export const ONBOARDING: string[] = ['bienvenue', 'navigation', 'cocher', 'favoris', 'synchro', 'reglages'];

/** Identifiants connus de cette version, dans l'ordre donné. */
export function knownSteps(ids: string[]): string[] {
  return ids.filter((id) => Object.hasOwn(TUTORIAL_STEPS, id));
}

/**
 * Tutoriel : quelques étapes qu'on parcourt avec Suivant, les pastilles ou un
 * glissement. « Passer », la croix, le fond ou Échap le ferment à tout
 * moment. Une étape seule n'a ni pastilles ni « Passer ». Émet « close ».
 */
@customElement('lardy-tutorial-sheet')
export class TutorialSheet extends LitElement {
  static styles = [
    sharedStyles,
    css`
      .step {
        touch-action: pan-y;
      }

      .art {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        min-height: 84px;
        margin: 4px 0 12px;
        padding: 12px;
        border-radius: 14px;
        background: var(--surface-2);
      }

      .logo {
        height: 56px;
        width: auto;
      }

      .logo.light {
        display: var(--logo-light-display);
      }

      .logo.dark {
        display: var(--logo-dark-display);
      }

      .tabs {
        display: flex;
        padding: 3px;
        border-radius: 10px;
        background: var(--bg);
        font-size: 12px;
        font-weight: 600;
        color: var(--text-muted);
      }

      .tabs span {
        padding: 6px 7px;
        border-radius: 8px;
      }

      .tabs .on {
        background: var(--surface);
        color: var(--text);
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
      }

      .demo {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }

      .demo small {
        font-size: 12px;
        color: var(--text-muted);
      }

      .toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 52px;
        height: 40px;
        padding: 0 8px;
        border-radius: 10px;
        border: 1.5px solid var(--border);
        font-size: 13px;
        font-weight: 700;
      }

      .toggle.lead {
        background: var(--lead);
        border-color: var(--lead);
        color: var(--lead-ink);
      }

      .toggle.toprope.detailed {
        background: var(--surface);
        border-color: var(--toprope);
        border-style: dashed;
        color: var(--toprope);
      }

      .icon {
        display: inline-flex;
        color: var(--text-muted);
      }

      .icon.star {
        color: var(--star);
      }

      .icon svg {
        width: 32px;
        height: 32px;
      }

      p {
        margin: 0 0 8px;
        font-size: 15px;
      }

      .link {
        color: var(--accent);
        font-size: 14px;
        font-weight: 600;
        text-decoration: underline;
      }

      nav {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
      }

      nav .skip {
        min-height: 40px;
        padding: 0 4px;
        font-weight: 600;
        color: var(--text-muted);
      }

      .dots {
        flex: 1;
        display: flex;
        justify-content: center;
        gap: 2px;
      }

      /* Zone d'appui de 24 px autour d'une pastille de 8 px. */
      .dots button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
      }

      .dots button::after {
        content: '';
        width: 8px;
        height: 8px;
        border-radius: 4px;
        background: var(--border);
      }

      .dots button[aria-current='step']::after {
        background: var(--accent);
      }

      nav .next {
        min-width: 110px;
      }

      .sync-action {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        margin-top: 12px;
        text-align: center;
      }

      .sync-action p {
        margin: 0;
        font-size: 14px;
      }

      .sync-code {
        font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: 13px;
        font-weight: 600;
        overflow-wrap: anywhere;
      }
    `,
  ];

  @property({ type: Boolean }) open = false;
  /** Identifiants des étapes à parcourir (inconnus ignorés). */
  @property({ attribute: false }) steps: string[] = ONBOARDING;
  /** Libellé du bouton de la dernière étape. */
  @property() finishLabel = 'C’est parti !';
  @property({ attribute: false }) sync: ProgressSync = progressSync;
  @state() index = 0;
  @state() private activating = false;

  private subscribedSync?: ProgressSync;
  private onSyncChange = () => this.requestUpdate();

  connectedCallback(): void {
    super.connectedCallback();
    this.subscribeSync();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.subscribedSync?.removeEventListener('change', this.onSyncChange);
    this.subscribedSync = undefined;
  }

  private subscribeSync() {
    this.subscribedSync?.removeEventListener('change', this.onSyncChange);
    this.subscribedSync = this.sync;
    this.sync.addEventListener('change', this.onSyncChange);
  }

  private async activateSync() {
    this.activating = true;
    try {
      await this.sync.enable();
    } finally {
      this.activating = false;
    }
  }

  /** Étape « synchro » : activation de la sauvegarde en ligne, puis le code à noter. */
  renderSync() {
    if (!this.sync.enabled) {
      return html`<div class="sync-action">
        <button class="btn primary enable-sync" ?disabled=${this.activating} @click=${this.activateSync}>
          Activer maintenant
        </button>
      </div>`;
    }
    const pending = this.sync.status === 'offline' || this.sync.status === 'error';
    return html`<div class="sync-action" role="status">
      <p><strong>Sauvegarde en ligne activée.</strong>${pending ? ' Elle se fera dès que le réseau le permettra.' : ''}</p>
      <p>Votre code de sauvegarde :</p>
      <p class="sync-code">${this.sync.displayCode}</p>
      <p><strong>Notez-le en lieu sûr (note, e-mail, papier)</strong> : il vous servira à récupérer vos voies. Vous le retrouverez aussi dans les réglages.</p>
    </div>`;
  }

  private get shown(): Step[] {
    return knownSteps(this.steps).map((id) => TUTORIAL_STEPS[id]);
  }

  private startX: number | null = null;

  protected willUpdate(changed: Map<string, unknown>): void {
    if (this.isConnected && this.subscribedSync !== this.sync) this.subscribeSync();
    // Chaque ouverture repart de la première étape.
    if ((changed.has('open') || changed.has('steps')) && this.open) this.index = 0;
  }

  private close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close'));
  }

  private go(index: number) {
    this.index = Math.max(0, Math.min(this.shown.length - 1, index));
  }

  private next() {
    if (this.index >= this.shown.length - 1) this.close();
    else this.go(this.index + 1);
  }

  private onPointerDown(e: PointerEvent) {
    this.startX = e.clientX;
  }

  private onPointerUp(e: PointerEvent) {
    if (this.startX === null) return;
    const dx = e.clientX - this.startX;
    this.startX = null;
    if (Math.abs(dx) >= SWIPE_PX) this.go(this.index + (dx < 0 ? 1 : -1));
  }

  render() {
    const steps = this.shown;
    const step = steps[this.index];
    if (!step) return nothing;
    const last = this.index === steps.length - 1;
    const single = steps.length === 1;
    return html`<lardy-sheet .open=${this.open} heading=${step.title} @close=${this.close}>
      <div
        class="step"
        @pointerdown=${this.onPointerDown}
        @pointerup=${this.onPointerUp}
        @pointercancel=${() => (this.startX = null)}
      >
        <div class="art" aria-hidden="true">${step.art}</div>
        ${step.body(this)}
      </div>
      <nav aria-label="Étapes du tutoriel">
        ${last ? nothing : html`<button class="skip" @click=${this.close}>Passer</button>`}
        <span class="dots">
          ${single
            ? nothing
            : steps.map(
                (s, i) =>
                  html`<button
                    aria-label="Étape ${i + 1} sur ${steps.length} : ${s.title}"
                    aria-current=${i === this.index ? 'step' : 'false'}
                    @click=${() => this.go(i)}
                  ></button>`,
              )}
        </span>
        <button class="btn primary next" @click=${this.next}>${last ? this.finishLabel : 'Suivant'}</button>
      </nav>
    </lardy-sheet>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-tutorial-sheet': TutorialSheet;
  }
}
