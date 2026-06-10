import { fetchReactions } from '../api/reactions.js';
import { escapeHtml } from '../utils/html.js';
import { setPopupVisible } from '../utils/popup.js';

let reactionRows = [
  {
    time: '18:49',
    createdAt: new Date().toISOString(),
    reactionType: 'positive',
    eventId: 'event-demo-001',
    noiseClass: '로봇청소기',
    db: '71',
    room: '거실',
    status: 'linked',
    detail: {
      reaction_id: 'reaction-demo-001',
      event_id: 'event-demo-001',
      model_label: '로봇청소기',
      service_label: 'robot_vacuum',
      relative_db: '71',
      room_id: '-',
      reaction: 'positive',
      status: 'linked',
      source: 'USER_TAP',
      memo: 'Linked demo reaction'
    }
  },
  {
    time: '18:37',
    createdAt: new Date().toISOString(),
    reactionType: 'negative',
    eventId: 'manual-event',
    noiseClass: '상태없음',
    db: '-',
    room: '방1',
    status: 'manual',
    detail: {
      reaction_id: 'reaction-demo-002',
      event_id: 'manual-event',
      model_label: '상태없음',
      service_label: 'manual',
      relative_db: '-',
      room_id: 'bedroom1',
      reaction: 'negative',
      status: 'manual',
      source: 'MANUAL',
      memo: 'Manual reaction'
    }
  }
];

const tableColumns = ['시간', '반응', '연결 이벤트 ID', '기기', 'dB', '공간'];

const filterFields = [
  { id: 'reaction-filter-range', label: '기간', options: ['7일', '2주', '한달'] },
  { id: 'reaction-filter-noise', label: '소음', options: ['모두', '60dB 이상', '60dB 이하'] },
  { id: 'reaction-filter-room', label: '공간', options: ['모두', '거실', '세탁실', '부엌', '화장실', '방1', '방2', '방3'] },
  { id: 'reaction-filter-device', label: '기기', options: ['모두', '세탁기', '로봇청소기', '냉장고', '식기세척기', '상태없음'] },
  { id: 'reaction-filter-reaction', label: '반응', options: ['모두', 'Positive', 'Negative', 'Pending', 'Manual'] }
];

function filterFieldMarkup({ id, label, options }) {
  return `
    <label class="reaction-filter-field">
      <span>${escapeHtml(label)}</span>
      <select id="${escapeHtml(id)}">
        ${options.map((option) => `<option>${escapeHtml(option)}</option>`).join('')}
      </select>
    </label>
  `;
}

function formatTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '-';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function normalizeRoom(value) {
  const map = {
    living: '거실',
    laundry: '세탁실',
    kitchen: '부엌',
    bathroom: '화장실',
    bedroom: '방1',
    bedroom1: '방1',
    bedroom2: '방2',
    bedroom3: '방3'
  };
  const normalized = String(value ?? '').toLowerCase();
  return map[normalized] ?? value ?? '-';
}

function normalizeDevice(value) {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'vacuum_cleaner' || normalized === 'robot_vacuum') return '로봇청소기';
  if (normalized === 'washer' || normalized === 'washing_machine') return '세탁기';
  if (normalized === 'refrigerator' || normalized === 'fridge') return '냉장고';
  if (normalized === 'dishwasher') return '식기세척기';
  if (normalized === 'unknown') return '상태없음';
  return value ?? 'unknown';
}

function toDisplayRow(item) {
  const reactionType = String(item.reactionType ?? item.reaction ?? 'manual').toLowerCase();
  const status = String(item.status ?? item.linkState ?? 'manual').toLowerCase();
  const eventId = item.noiseEventId ?? item.eventId ?? 'manual-event';
  const createdAt = item.createdAt ?? item.created_at ?? new Date().toISOString();
  const noiseClass = normalizeDevice(item.modelLabel ?? item.model_label ?? item.serviceLabel ?? item.service_label ?? 'unknown');
  const room = normalizeRoom(item.roomName ?? item.room_name ?? item.roomId ?? item.room_id ?? '-');

  return {
    time: formatTime(createdAt),
    createdAt,
    reactionType,
    eventId,
    noiseClass,
    db: item.decibelAvg ?? item.decibel_avg ?? '-',
    room,
    status,
    detail: {
      reaction_id: item.reactionId ?? item.reaction_id ?? eventId,
      event_id: item.eventId ?? item.noiseEventId ?? '-',
      model_label: noiseClass,
      service_label: item.serviceLabel ?? item.service_label ?? '-',
      relative_db: item.decibelAvg ?? item.decibel_avg ?? '-',
      room_id: item.roomId ?? item.room_id ?? '-',
      reaction: reactionType,
      status,
      source: item.source ?? '-',
      memo: item.memo ?? '-'
    }
  };
}

function rowMarkup(row, index) {
  return `
    <button
      class="reaction-history-row"
      type="button"
      data-reaction-row="${index}"
      aria-label="${escapeHtml(row.eventId)} 상세 보기"
    >
      <span>${escapeHtml(row.time)}</span>
      <strong>${escapeHtml(row.reactionType)}</strong>
      <span>${escapeHtml(row.eventId)}</span>
      <span>${escapeHtml(row.noiseClass)}</span>
      <span>${escapeHtml(row.db)}</span>
      <span>${escapeHtml(row.room)}</span>
    </button>
  `;
}

function detailMarkup(row) {
  if (!row) {
    return `
      <h2>연결 이벤트 상세</h2>
      <dl class="reaction-detail-grid">
        <div><dt>상태</dt><dd>표시할 데이터가 없습니다.</dd></div>
      </dl>
    `;
  }

  return `
    <h2>연결 이벤트 상세</h2>
    <dl class="reaction-detail-grid">
      ${Object.entries(row.detail)
        .map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`)
        .join('')}
    </dl>
  `;
}

function daysForRange(value) {
  if (value === '7일') return 7;
  if (value === '2주') return 14;
  if (value === '한달') return 30;
  return null;
}

function matchesDate(row, selectedRange) {
  const days = daysForRange(selectedRange);
  if (!days) return true;

  const createdAt = new Date(row.createdAt);
  if (Number.isNaN(createdAt.getTime())) return true;

  const diffMs = Date.now() - createdAt.getTime();
  return diffMs <= days * 24 * 60 * 60 * 1000;
}

function matchesNoise(row, selectedNoise) {
  if (selectedNoise === '모두') return true;

  const db = Number(row.db);
  if (Number.isNaN(db)) return false;
  if (selectedNoise === '60dB 이상') return db >= 60;
  if (selectedNoise === '60dB 이하') return db <= 60;
  return true;
}

function matchesDevice(row, selectedDevice) {
  if (selectedDevice === '모두') return true;
  return row.noiseClass === selectedDevice;
}

function matchesReaction(row, selectedReaction) {
  if (selectedReaction === '모두') return true;
  return row.reactionType === selectedReaction.toLowerCase();
}

function matchesSearch(row, keyword) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;

  return [row.room, row.noiseClass, row.eventId, row.reactionType, row.status]
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
}

function filterRows(rows, filters) {
  return rows.filter((row) => {
    if (!matchesDate(row, filters.range)) return false;
    if (!matchesNoise(row, filters.noise)) return false;
    if (filters.room !== '모두' && row.room !== filters.room) return false;
    if (!matchesDevice(row, filters.device)) return false;
    if (!matchesReaction(row, filters.reaction)) return false;
    if (!matchesSearch(row, filters.search)) return false;
    return true;
  });
}

export async function renderReactionHistoryPage() {
  const response = await fetchReactions({ page: 0, size: 50 });
  const items = (response.items ?? []).map(toDisplayRow);
  if (items.length) reactionRows = items;

  return `
    <section class="page reaction-history-page" aria-label="반응 기록 화면">
      <header class="reaction-history-header">
        <h1>반응 기록</h1>
        <p>감지된 소음 이벤트에서 연결되거나 수동으로 생성된 반응을 확인합니다.</p>
      </header>

      <section class="reaction-filter-panel" aria-label="반응 필터">
        <label class="reaction-search">
          <span class="hidden">공간, 기기, 라벨 검색</span>
          <input id="reaction-search-input" type="search" placeholder="공간, 기기, 라벨 검색" />
        </label>
        <div class="reaction-filter-chips">
          ${filterFields.map(filterFieldMarkup).join('')}
        </div>
        <p id="reaction-filter-status" class="reaction-filter-status" aria-live="polite"></p>
      </section>

      <div class="reaction-history-layout">
        <section class="reaction-table-block">
          <div class="reaction-table-head" aria-hidden="true">
            ${tableColumns.map((label) => `<span>${escapeHtml(label)}</span>`).join('')}
          </div>
          <div id="reaction-table-body" class="reaction-table-body">
            ${reactionRows.map(rowMarkup).join('')}
          </div>
        </section>
        <div class="reaction-pending-note-row">
          <p class="reaction-table-note">
            Pending 반응은 이벤트 매칭을 기다립니다. 매칭이 없으면 수동 반응 이벤트를 생성하세요.
          </p>
        </div>
      </div>

      <div id="reaction-detail-modal" class="reaction-detail-modal hidden" aria-hidden="true">
        <div class="reaction-detail-backdrop" data-reaction-close="backdrop"></div>
        <section class="reaction-detail-card" role="dialog" aria-modal="true" aria-label="연결 이벤트 상세">
          <button type="button" class="reaction-detail-close" data-reaction-close="button" aria-label="닫기">X</button>
          <div id="reaction-detail-content">
            ${detailMarkup(reactionRows[0] ?? null)}
          </div>
        </section>
      </div>
    </section>
  `;
}

export function mountReactionHistoryPage() {
  const tableBody = document.querySelector('#reaction-table-body');
  const statusMessage = document.querySelector('#reaction-filter-status');
  const searchInput = document.querySelector('#reaction-search-input');
  const rangeSelect = document.querySelector('#reaction-filter-range');
  const noiseSelect = document.querySelector('#reaction-filter-noise');
  const roomSelect = document.querySelector('#reaction-filter-room');
  const deviceSelect = document.querySelector('#reaction-filter-device');
  const reactionSelect = document.querySelector('#reaction-filter-reaction');
  const detailModal = document.querySelector('#reaction-detail-modal');
  const detailContent = document.querySelector('#reaction-detail-content');

  function openModal(row) {
    if (!detailModal || !detailContent) return;
    detailContent.innerHTML = detailMarkup(row);
    setPopupVisible(detailModal, true);
  }

  function closeModal() {
    setPopupVisible(detailModal, false);
  }

  function bindRowSelection(rows) {
    document.querySelectorAll('[data-reaction-row]').forEach((rowButton) => {
      rowButton.addEventListener('click', () => {
        const index = Number(rowButton.dataset.reactionRow);
        const row = rows[index] ?? rows[0] ?? null;

        document.querySelectorAll('[data-reaction-row]').forEach((button) => {
          button.classList.toggle('is-selected', button === rowButton);
        });

        openModal(row);
      });
    });
  }

  function renderFilteredRows() {
    const filters = {
      search: searchInput?.value ?? '',
      range: rangeSelect?.value ?? '7일',
      noise: noiseSelect?.value ?? '모두',
      room: roomSelect?.value ?? '모두',
      device: deviceSelect?.value ?? '모두',
      reaction: reactionSelect?.value ?? '모두'
    };

    const filteredRows = filterRows(reactionRows, filters);

    if (tableBody) {
      tableBody.innerHTML = filteredRows.map(rowMarkup).join('');
    }

    if (statusMessage) {
      statusMessage.textContent = filteredRows.length ? '' : '선택한 필터에 해당하는 기록된 반응이 없습니다.';
    }

    closeModal();
    bindRowSelection(filteredRows);
  }

  [searchInput, rangeSelect, noiseSelect, roomSelect, deviceSelect, reactionSelect].forEach((element) => {
    element?.addEventListener('input', renderFilteredRows);
    element?.addEventListener('change', renderFilteredRows);
  });

  document.querySelectorAll('[data-reaction-close]').forEach((element) => {
    element.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  renderFilteredRows();
}
