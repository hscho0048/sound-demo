import { escapeHtml } from '../utils/html.js';

const reactionRows = [
  {
    time: '12:34',
    reactionType: 'positive',
    eventId: 'EVT-238',
    noiseClass: 'vacuum_cleaner',
    db: '71',
    room: 'Laundry',
    status: 'linked',
    detail: {
      event_id: 'EVT-238',
      model_label: 'vacuum_cleaner',
      service_label: 'robot_vacuum',
      relative_db: '71',
      room_id: 'laundry',
      reaction: 'positive'
    }
  },
  {
    time: '12:20',
    reactionType: 'negative',
    eventId: 'EVT-236',
    noiseClass: 'speech',
    db: '58',
    room: 'Living',
    status: 'linked',
    detail: {
      event_id: 'EVT-236',
      model_label: 'speech',
      service_label: 'living_room',
      relative_db: '58',
      room_id: 'living',
      reaction: 'negative'
    }
  },
  {
    time: '12:08',
    reactionType: 'manual',
    eventId: 'manual-event',
    noiseClass: 'unknown',
    db: '-',
    room: 'Bedroom',
    status: 'manual',
    detail: {
      event_id: 'manual-event',
      model_label: 'unknown',
      service_label: 'manual',
      relative_db: '-',
      room_id: 'bedroom',
      reaction: 'manual'
    }
  },
  {
    time: '11:58',
    reactionType: 'pending',
    eventId: 'pending match',
    noiseClass: 'appliance',
    db: '63',
    room: 'Kitchen',
    status: 'pending',
    detail: {
      event_id: 'pending match',
      model_label: 'appliance',
      service_label: 'pending',
      relative_db: '63',
      room_id: 'kitchen',
      reaction: 'pending'
    }
  }
];

const tableColumns = ['time', 'reaction type', 'linked event ID', 'noise class', 'dB', 'room', 'status'];

function rowMarkup(row, index) {
  return `
    <button
      class="reaction-history-row ${index === 0 ? 'is-selected' : ''}"
      type="button"
      data-reaction-row="${index}"
      aria-label="Show ${escapeHtml(row.eventId)} detail"
    >
      <span>${escapeHtml(row.time)}</span>
      <strong>${escapeHtml(row.reactionType)}</strong>
      <span>${escapeHtml(row.eventId)}</span>
      <span>${escapeHtml(row.noiseClass)}</span>
      <span>${escapeHtml(row.db)}</span>
      <span>${escapeHtml(row.room)}</span>
      <span>${escapeHtml(row.status)}</span>
    </button>
  `;
}

function detailMarkup(row) {
  return `
    <h2>Linked event detail</h2>
    <dl>
      ${Object.entries(row.detail)
        .map(([key, value]) => `<div><dt>${escapeHtml(key)}:</dt> <dd>${escapeHtml(value)}</dd></div>`)
        .join('')}
    </dl>
  `;
}

export async function renderReactionHistoryPage() {
  return `
    <section class="page reaction-history-page" aria-label="Reaction History Screen">
      <header class="reaction-history-header">
        <h1>Reaction History</h1>
        <p>Linked and manual reactions from detected noise events</p>
      </header>

      <section class="reaction-filter-panel" aria-label="Reaction filters">
        <label class="reaction-search">
          <span class="hidden">Search room, device, label</span>
          <input type="search" placeholder="Search room,device, label" />
        </label>
        <div class="reaction-filter-chips">
          <button type="button">Date: last 7 days</button>
          <button type="button">Noise: all</button>
          <button type="button">Room: all</button>
          <button type="button">Device: all</button>
          <button type="button">Reaction: all</button>
          <button type="button">Confidence: 0.70+</button>
        </div>
      </section>

      <div class="reaction-history-layout">
        <section class="reaction-table-panel" aria-label="Reaction history table">
          <div class="reaction-table-head" aria-hidden="true">
            ${tableColumns.map((label) => `<span>${escapeHtml(label)}</span>`).join('')}
          </div>
          <div class="reaction-table-body">
            ${reactionRows.map(rowMarkup).join('')}
          </div>
        </section>

        <aside id="reaction-detail-panel" class="reaction-detail-panel" aria-live="polite">
          ${detailMarkup(reactionRows[0])}
        </aside>

        <section class="reaction-empty-state">
          Empty state: no positive, negative, pending, or manual reaction exists for the selected filters.
        </section>

        <aside class="reaction-pending-note">
          <span aria-hidden="true"></span>
          <p>Pending reactions wait for event matching. If no match appears, create manual reaction event.</p>
        </aside>
      </div>
    </section>
  `;
}

export function mountReactionHistoryPage() {
  const detailPanel = document.querySelector('#reaction-detail-panel');

  document.querySelectorAll('[data-reaction-row]').forEach((rowButton) => {
    rowButton.addEventListener('click', () => {
      const index = Number(rowButton.dataset.reactionRow);
      const row = reactionRows[index] ?? reactionRows[0];

      document.querySelectorAll('[data-reaction-row]').forEach((button) => {
        button.classList.toggle('is-selected', button === rowButton);
      });

      if (detailPanel) detailPanel.innerHTML = detailMarkup(row);
    });
  });
}
