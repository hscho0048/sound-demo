import { escapeHtml } from '../utils/html.js';

export function RoutineCard(routine, { compact = false } = {}) {
  const routineId = escapeHtml(routine.id);
  return `
    <article class="routine-card" data-routine-id="${routineId}">
      <div>
        <span class="badge">${escapeHtml(routine.status)}</span>
        <strong>${escapeHtml(routine.title)}</strong>
        <p>${escapeHtml(routine.reason)}</p>
        <small>대상: ${escapeHtml(routine.targetServiceLabel)}</small>
      </div>
      ${compact ? '' : `
        <div class="routine-card__actions">
          <button data-action="apply-routine" data-routine-id="${routineId}">적용</button>
          <button class="secondary" data-action="dismiss-routine" data-routine-id="${routineId}">숨기기</button>
        </div>
      `}
    </article>
  `;
}
