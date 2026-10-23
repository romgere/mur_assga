import { LitElement, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { progressStore, type ProgressStore } from '../lib/progress-store';
import { pwaState, type PwaState } from '../lib/pwa';
import { takeUnseenNotes } from '../lib/release-notes';
import { storage as defaultStorage, type KeyValueStorage } from '../lib/storage';
import { applyTheme, loadTheme, saveTheme, type Theme } from '../lib/theme';
import type { Route } from '../lib/topo';
import { loadUiState, saveUiState, type UiState } from '../lib/ui-state';
import { gradePages, wallPages, type Page } from '../lib/views';
import type { FiltersChangeDetail } from './all-routes-view';
import type { ModeChangeDetail } from './mode-tabs';
import type { PageSelectDetail } from './pager-dots';
import type { OpenNoteDetail } from './route-row';
import type { ShowReleaseNotesDetail } from './release-notes-sheet';
import type { PageChangeDetail, RoutePager } from './route-pager';
import type { ThemeChangeDetail } from './settings-sheet';
import type { StatsCountChangeDetail } from './stats-view';
import { sharedStyles } from './shared-styles';
import './all-routes-view';
import './favorites-view';
import './mode-tabs';
import './note-sheet';
import './pager-dots';
import './release-notes-sheet';
import './route-pager';
import './settings-sheet';
import './stats-view';
import './update-banner';

const gearIcon = html`<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
  <path
    d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7.4-2.5.1-1-.1-1 2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11l-.1 1 .1 1-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4z"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linejoin="round"
  />
</svg>`;

/**
 * Racine de l'application : en-tête (compteurs, modes, réglages), vue
 * courante, barre de pastilles et feuilles modales. Un clic sur une voie ne
 * repeint que sa ligne et les compteurs (voir StoreController) : le pager
 * n'est reconstruit qu'au changement de mode.
 */
@customElement('lardy-app')
export class LardyApp extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--bg);
        color: var(--text);
      }

      header {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: max(10px, env(safe-area-inset-top)) var(--gutter-right) 8px var(--gutter-left);
      }

      .title {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* Logo du club : version verte en clair, blanche en sombre (tokens). */
      .logo {
        flex: none;
        height: 44px;
        width: auto;
      }

      .logo.light {
        display: var(--logo-light-display);
      }

      .logo.dark {
        display: var(--logo-dark-display);
      }

      h1 {
        flex: 1;
        min-width: 0;
        margin: 0;
        font-size: 18px;
        line-height: 1.2;
        text-align: center;
      }

      h1,
      h1 small {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      h1 small {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-muted);
      }

      /* Très petits écrans (320 px) : titre et sous-titre sur une ligne. */
      @media (max-width: 359px) {
        h1 {
          font-size: 16px;
        }

        h1 small {
          font-size: 11px;
        }
      }

      .settings {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 22px;
        color: var(--text-muted);
      }

      main {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      main > * {
        flex: 1;
        min-height: 0;
      }

      footer {
        border-top: 1px solid var(--border);
        background: var(--surface);
        padding-bottom: env(safe-area-inset-bottom);
      }
    `,
  ];

  @property({ attribute: false }) store: ProgressStore = progressStore;
  @property({ attribute: false }) storage: KeyValueStorage = defaultStorage;
  @property({ attribute: false }) pwa: PwaState = pwaState;

  @state() private ui!: UiState;
  @state() private theme: Theme = 'auto';
  @state() private noteRoute: Route | null = null;
  @state() private settingsOpen = false;
  @state() private releaseNotes: ShowReleaseNotesDetail | null = null;

  @query('lardy-route-pager') private pager?: RoutePager;

  private wallPages: Page[] = [];
  private gradePages: Page[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    const topo = this.store.topo;
    this.wallPages = wallPages(topo);
    this.gradePages = gradePages(topo);
    this.ui = loadUiState(topo.grades.length, this.storage);
    this.ui.wallPage = Math.min(this.ui.wallPage, this.wallPages.length - 1);
    this.ui.gradePage = Math.min(this.ui.gradePage, this.gradePages.length - 1);
    this.theme = loadTheme(this.storage);
    // Avant tout enregistrement : takeUnseenNotes reconnaît un nouvel utilisateur à son stockage vide.
    const unseen = takeUnseenNotes(this.storage);
    if (unseen.length) this.releaseNotes = { heading: 'Application mise à jour', notes: unseen };
  }

  private get pages(): Page[] {
    return this.ui.mode === 'grade' ? this.gradePages : this.wallPages;
  }

  private get pageIndex(): number {
    return this.ui.mode === 'grade' ? this.ui.gradePage : this.ui.wallPage;
  }

  private persistUi(next: UiState) {
    this.ui = next;
    saveUiState(next, this.storage);
  }

  private onModeChange(e: CustomEvent<ModeChangeDetail>) {
    this.persistUi({ ...this.ui, mode: e.detail.mode });
  }

  /** Le pager suit le doigt ; on ne fait que mémoriser la page pour les pastilles. */
  private onPageChange(e: CustomEvent<PageChangeDetail>) {
    const key = this.ui.mode === 'grade' ? 'gradePage' : 'wallPage';
    this.persistUi({ ...this.ui, [key]: e.detail.index });
  }

  private onPageSelect(e: CustomEvent<PageSelectDetail>) {
    this.pager?.goTo(e.detail.index);
  }

  private onStatsCountChange(e: CustomEvent<StatsCountChangeDetail>) {
    this.persistUi({ ...this.ui, statsCount: e.detail.count });
  }

  private onFiltersChange(e: CustomEvent<FiltersChangeDetail>) {
    this.persistUi({ ...this.ui, filters: e.detail.filters });
  }

  private onOpenNote(e: CustomEvent<OpenNoteDetail>) {
    this.noteRoute = e.detail.route;
  }

  private onThemeChange(e: CustomEvent<ThemeChangeDetail>) {
    this.theme = e.detail.theme;
    applyTheme(this.theme);
    saveTheme(this.theme, this.storage);
  }

  private onShowReleaseNotes(e: CustomEvent<ShowReleaseNotesDetail>) {
    this.settingsOpen = false;
    this.releaseNotes = e.detail;
  }

  private renderView() {
    if (this.ui.mode === 'favorites') {
      return html`<lardy-favorites-view .store=${this.store}></lardy-favorites-view>`;
    }
    if (this.ui.mode === 'stats') {
      return html`<lardy-stats-view
        .store=${this.store}
        count=${this.ui.statsCount}
        @count-change=${this.onStatsCountChange}
      ></lardy-stats-view>`;
    }
    if (this.ui.mode === 'all') {
      return html`<lardy-all-routes-view
        .routes=${this.store.topo.routes}
        .grades=${this.store.topo.grades}
        .filters=${this.ui.filters}
        .store=${this.store}
        @filters-change=${this.onFiltersChange}
      ></lardy-all-routes-view>`;
    }
    // Clé = mode : un nouveau pager est créé à chaque changement de mode.
    return keyed(
      this.ui.mode,
      html`<lardy-route-pager
        data-mode=${this.ui.mode}
        .pages=${this.pages}
        .initialIndex=${this.pageIndex}
        .store=${this.store}
        @page-change=${this.onPageChange}
      ></lardy-route-pager>`,
    );
  }

  render() {
    const topo = this.store.topo;
    const paged = this.ui.mode === 'wall' || this.ui.mode === 'grade';
    return html`<header>
        <div class="title">
          <img class="logo light" src="/logo-header-light.png" alt="" width="38" height="44" />
          <img class="logo dark" src="/logo-header-dark.png" alt="" width="37" height="44" />
          <h1>Mur d'escalade de Lardy<small>${topo.club} · ${topo.title}</small></h1>
          <button class="settings" aria-label="Réglages" @click=${() => (this.settingsOpen = true)}>${gearIcon}</button>
        </div>
        <lardy-mode-tabs .mode=${this.ui.mode} @mode-change=${this.onModeChange}></lardy-mode-tabs>
        <lardy-update-banner .pwa=${this.pwa} @show-release-notes=${this.onShowReleaseNotes}></lardy-update-banner>
      </header>
      <main @open-note=${this.onOpenNote}>${this.renderView()}</main>
      ${paged
        ? html`<footer>
            <lardy-pager-dots
              .pages=${this.pages}
              .index=${this.pageIndex}
              .store=${this.store}
              label=${this.ui.mode === 'grade' ? 'Cotations' : 'Murs'}
              @page-select=${this.onPageSelect}
            ></lardy-pager-dots>
          </footer>`
        : ''}
      <lardy-note-sheet
        .route=${this.noteRoute}
        .store=${this.store}
        @close=${() => (this.noteRoute = null)}
      ></lardy-note-sheet>
      <lardy-settings-sheet
        .pwa=${this.pwa}
        .open=${this.settingsOpen}
        .theme=${this.theme}
        .store=${this.store}
        @theme-change=${this.onThemeChange}
        @show-release-notes=${this.onShowReleaseNotes}
        @close=${() => (this.settingsOpen = false)}
      ></lardy-settings-sheet>
      <lardy-release-notes-sheet
        .open=${!!this.releaseNotes}
        heading=${this.releaseNotes?.heading ?? ''}
        .notes=${this.releaseNotes?.notes ?? []}
        @close=${() => (this.releaseNotes = null)}
      ></lardy-release-notes-sheet>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lardy-app': LardyApp;
  }
}
