import { escapeHtml } from '../utils/html.js';

export function getDecibelTone(decibel) {
  if (decibel >= 70) return 'danger';
  if (decibel >= 60) return 'warning';
  return 'safe';
}

export function DecibelBadge({ decibel, label = '현재 dB' }) {
  const numeric = Number(decibel);
  const tone = getDecibelTone(numeric);
  const displayValue = Number.isFinite(numeric) ? numeric.toFixed(1) : '-';
  return `
    <div class="decibel-badge decibel-badge--${tone}" aria-label="${escapeHtml(label)}">
      <span>${escapeHtml(label)}</span>
      <strong>${displayValue} dB</strong>
    </div>
  `;
}
