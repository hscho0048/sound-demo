import { escapeHtml } from '../utils/html.js';

export function StatusCard({ title, value, meta = '', tone = 'default' }) {
  return `
    <article class="status-card status-card--${escapeHtml(tone)}">
      <span class="status-card__title">${escapeHtml(title)}</span>
      <strong class="status-card__value">${escapeHtml(value)}</strong>
      ${meta ? `<small class="status-card__meta">${escapeHtml(meta)}</small>` : ''}
    </article>
  `;
}
