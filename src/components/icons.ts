import { html } from 'lit';

/** Icônes SVG de l'application, partagées entre les composants et les illustrations du tutoriel. */

export const gearIcon = html`<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
  <path
    d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7.4-2.5.1-1-.1-1 2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11l-.1 1 .1 1-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4z"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linejoin="round"
  />
</svg>`;

export const starIcon = (filled: boolean) => html`<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
  <path
    d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"
    fill=${filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linejoin="round"
  />
</svg>`;

export const noteIcon = html`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
  <path
    d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linejoin="round"
  />
</svg>`;

/** Nuage et flèches : synchronisation entre appareils. */
export const syncIcon = html`<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
  <path
    d="M7 18.5h10.5a4 4 0 0 0 .6-8 6 6 0 0 0-11.6-1A4.5 4.5 0 0 0 7 18.5z"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linejoin="round"
  />
  <path
    d="M9.5 12.5a2.8 2.8 0 0 1 4.8-1.2l.7.7m0-2v2h-2m1.5 3a2.8 2.8 0 0 1-4.8 1.2l-.7-.7m0 2v-2h2"
    fill="none"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>`;

/** (i) des liens d'aide (18 px) et des boutons de nouveautés (22 px). */
export const infoIcon = (size = 18) => html`<svg viewBox="0 0 24 24" width=${size} height=${size} aria-hidden="true">
  <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8" />
  <path d="M12 10.5v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  <circle cx="12" cy="7.4" r="1.2" fill="currentColor" />
</svg>`;

export const chevronIcon = html`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

export const sortIcon = html`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <path
    d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>`;
