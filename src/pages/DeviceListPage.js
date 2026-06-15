import { escapeHtml } from '../utils/html.js';
import { getDeviceIcon } from '../utils/deviceIcons.js';
import { getCurrentHomeStatus } from '../api/eventApi.js';
import { getApplianceMeasurements } from '../api/applianceMeasurementApi.js';
import { getRuntimeSettings } from '../api/deviceApi.js';
import {
  getDeviceFailurePayload,
  isDeviceConnectionFailed,
  mountDeviceConnectionFailurePopup
} from './DeviceConnectionFailurePopup.js';

// 백엔드(DB)에서 채워지는 기기 목록. 하드코딩 더미는 제거되었다.
let deviceRows = [];

const WARNING_DECIBEL_THRESHOLD = 70;
const ROOM_OPTIONS = ['전체 공간', '거실', '침실', '세탁실', '주방'];
const STATUS_OPTIONS = ['전체 상태', '안정', '주의', '연결 필요'];

const SERVICE_LABEL_KO = {
  robot_vacuum: '로봇청소기',
  washing_machine: '세탁기',
  dishwasher: '식기세척기',
  refrigerator: '냉장고',
  background: '배경음'
};

const roomLabelMap = {
  'Living Room': '거실',
  Bedroom: '침실',
  'Laundry Area': '세탁실',
  Kitchen: '주방',
  Study: '작업실'
};

function getDisplayRoom(room) {
  return roomLabelMap[room] ?? room ?? '방 미지정';
}

function formatTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// home-status의 registeredDevices + sensitiveAppliances(라벨 매핑) + 최신 가전 측정값을 합쳐
// 기기 카드 데이터를 만든다.
async function loadDeviceRows() {
  let home;
  try {
    home = await getCurrentHomeStatus();
  } catch (error) {
    console.warn('[SoundCare] 기기 목록 로드 실패', error);
    return [];
  }

  const devices = home?.registeredDevices ?? [];
  // serviceLabel ↔ userRegisteredDeviceId 매핑은 settings/runtime에 있다
  // (home-status의 sensitiveAppliances 쿼리에는 userRegisteredDeviceId가 없음).
  let runtime = null;
  try {
    runtime = await getRuntimeSettings();
  } catch (error) {
    runtime = null;
  }
  const labelByDevice = new Map(
    (runtime?.sensitiveAppliances ?? []).map((s) => [s.userRegisteredDeviceId, s.serviceLabel])
  );

  let measurements = [];
  try {
    measurements = await getApplianceMeasurements({ limit: 100 });
  } catch (error) {
    measurements = [];
  }
  const latestByLabel = new Map();
  for (const m of measurements ?? []) {
    const label = m.serviceLabel ?? m.applianceType;
    if (label && !latestByLabel.has(label)) latestByLabel.set(label, m);
  }

  return devices.map((device) => {
    const id = device.registeredDeviceId ?? device.id;
    const label = labelByDevice.get(id);
    const measurement = label ? latestByLabel.get(label) : null;
    const db = measurement
      ? Math.round(Number(measurement.decibelMax ?? measurement.decibelAvg ?? measurement.relativeDb))
      : null;
    return {
      id,
      deviceName: (label && SERVICE_LABEL_KO[label]) || device.name || '기기',
      room: device.roomName ?? '방 미지정',
      decibel: db != null && Number.isFinite(db) ? db : '--',
      time: measurement ? formatTime(measurement.measuredAt ?? measurement.createdAt) : '--'
    };
  });
}

function getDeviceStatus(device) {
  if (isDeviceConnectionFailed(device)) return '연결 필요';

  const decibel = Number(device.decibel);
  if (!Number.isFinite(decibel)) return '연결 필요';
  if (decibel >= WARNING_DECIBEL_THRESHOLD) return '주의';

  return '안정';
}

function statusClassOf(status) {
  if (status === '주의') return 'is-warning';
  if (status === '연결 필요') return 'is-connection';
  return 'is-stable';
}

function filterMenu(name, options) {
  return `
    <div class="device-filter-dropdown" data-filter="${name}">
      <button type="button" class="device-filter-trigger" data-filter-trigger="${name}">
        ${escapeHtml(options[0])}
      </button>
      <div class="device-filter-menu" data-filter-menu="${name}" hidden>
        ${options
          .map(
            (option) => `
              <button type="button" data-filter-option="${name}" data-filter-value="${escapeHtml(option)}">
                ${escapeHtml(option)}
              </button>
            `
          )
          .join('')}
      </div>
    </div>
  `;
}

function deviceCard(device) {
  const failed = isDeviceConnectionFailed(device);
  const room = getDisplayRoom(device.room);
  const status = getDeviceStatus(device);
  const statusClass = statusClassOf(status);
  return `
    <a class="device-list-card ${failed ? 'device-list-card--failed' : ''}" href="#/devices/${encodeURIComponent(device.id)}" aria-label="${escapeHtml(device.deviceName)} (${escapeHtml(room)}, ${escapeHtml(status)}) 기기 상세" ${failed ? `data-device-failure="${escapeHtml(device.id)}"` : ''}>
      <div class="device-list-picture has-device-icon" aria-hidden="true">
        ${getDeviceIcon(device.deviceName)}
        <span class="device-conn-dot ${statusClass}"></span>
      </div>
      <div class="device-list-meta">
        <p class="device-list-title-row"><span>${escapeHtml(device.deviceName)}</span><span class="device-status-badge ${statusClass}">${escapeHtml(status)}</span></p>
        <p>${escapeHtml(String(device.decibel))} dB</p>
        <p>${escapeHtml(device.time)}</p>
      </div>
      <span class="device-detail-icon" aria-hidden="true">&#8594;</span>
    </a>
  `;
}

export async function renderDeviceListPage() {
  deviceRows = await loadDeviceRows();
  const failedCount = deviceRows.filter(isDeviceConnectionFailed).length;
  const onlineCount = deviceRows.length - failedCount;
  const attentionCopy =
    failedCount === 0
      ? '모든 기기가 정상 연결되어 있습니다.'
      : failedCount === 1
        ? '연결 확인이 필요한 기기가 1대 있습니다.'
        : `연결 확인이 필요한 기기가 ${failedCount}대 있습니다.`;

  const grid = deviceRows.length
    ? deviceRows.map(deviceCard).join('')
    : '<p class="device-list-empty">등록된 기기가 없습니다. Tauri/Web 또는 백엔드에서 기기를 먼저 등록하세요.</p>';

  return `
    <section class="page device-list-page" aria-label="기기 목록 화면">
      <header class="device-list-header">
        <div class="device-list-heading">
          <h1>기기</h1>
          <p>총 ${deviceRows.length}대 - ${onlineCount}대 연결됨 - ${failedCount}대 불안정</p>
        </div>
        <button class="device-add-button" type="button">기기 추가</button>
      </header>

      <section class="device-filter-bar" aria-label="기기 필터">
        ${filterMenu('room', ROOM_OPTIONS)}
        ${filterMenu('status', STATUS_OPTIONS)}
        <label>
          <span class="hidden">기기 검색</span>
          <input type="search" placeholder="기기 검색" />
        </label>
      </section>

      <section class="device-warning-banner" aria-label="기기 연결 경고">
        <span class="device-warning-dot" aria-hidden="true"></span>
        <p>${attentionCopy}</p>
        <button type="button">자세히 보기</button>
      </section>

      <section class="device-list-grid" aria-label="등록된 기기" data-device-list-grid>
        ${grid}
      </section>
    </section>
  `;
}

let popupCleanup = null;
let filterCleanup = null;

export function mountDeviceListPage({ navigate } = {}) {
  cleanupDeviceListPage();
  const failedDevices = deviceRows.filter(isDeviceConnectionFailed).map(getDeviceFailurePayload);
  const popupController = mountDeviceConnectionFailurePopup({ navigate });
  popupCleanup = popupController.cleanup;
  const failedDeviceMap = new Map(failedDevices.map((device) => [device.id, device]));
  const filterState = {
    room: '전체 공간',
    status: '전체 상태',
    search: ''
  };

  document.querySelector('.device-warning-banner button')?.addEventListener('click', () => {
    if (failedDevices[0]) popupController.openPopup(failedDevices[0]);
  });

  const bindDeviceFailureLinks = () => {
    document.querySelectorAll('[data-device-failure]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const failedDevice = failedDeviceMap.get(link.dataset.deviceFailure);
        if (failedDevice) popupController.openPopup(failedDevice);
      });
    });
  };

  const renderFilteredDevices = () => {
    const grid = document.querySelector('[data-device-list-grid]');
    if (!grid) return;

    const filteredDevices = deviceRows.filter((device) => {
      const roomMatched =
        filterState.room === '전체 공간' || getDisplayRoom(device.room) === filterState.room;
      const statusMatched =
        filterState.status === '전체 상태' || getDeviceStatus(device) === filterState.status;
      const searchMatched =
        !filterState.search ||
        device.deviceName.toLowerCase().includes(filterState.search) ||
        getDisplayRoom(device.room).toLowerCase().includes(filterState.search);

      return roomMatched && statusMatched && searchMatched;
    });

    grid.innerHTML = filteredDevices.length
      ? filteredDevices.map(deviceCard).join('')
      : '<p class="device-list-empty">조건에 맞는 기기가 없습니다.</p>';
    bindDeviceFailureLinks();
  };

  document.querySelectorAll('[data-filter-trigger]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.filterTrigger;
      document.querySelectorAll('[data-filter-menu]').forEach((menu) => {
        if (menu.dataset.filterMenu === name) {
          menu.hidden = !menu.hidden;
        } else {
          menu.hidden = true;
        }
      });
    });
  });

  document.querySelectorAll('[data-filter-option]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.filterOption;
      const value = button.dataset.filterValue;
      filterState[name] = value;

      const trigger = document.querySelector(`[data-filter-trigger="${name}"]`);
      if (trigger) trigger.textContent = value;

      document.querySelectorAll('[data-filter-menu]').forEach((menu) => {
        menu.hidden = true;
      });
      renderFilteredDevices();
    });
  });

  document.querySelector('.device-filter-bar input')?.addEventListener('input', (event) => {
    filterState.search = event.target.value.trim().toLowerCase();
    renderFilteredDevices();
  });

  const closeFilterMenus = (event) => {
    if (!event.target.closest('.device-filter-dropdown')) {
      document.querySelectorAll('[data-filter-menu]').forEach((menu) => {
        menu.hidden = true;
      });
    }
  };
  document.addEventListener('click', closeFilterMenus);
  filterCleanup = () => document.removeEventListener('click', closeFilterMenus);

  bindDeviceFailureLinks();
}

export function cleanupDeviceListPage() {
  popupCleanup?.();
  popupCleanup = null;
  filterCleanup?.();
  filterCleanup = null;
}
