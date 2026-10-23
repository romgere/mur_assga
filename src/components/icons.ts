import { html } from 'lit';

/** Icônes partagées entre l'interface et les illustrations du tutoriel. */

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
