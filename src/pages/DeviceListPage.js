import { escapeHtml } from '../utils/html.js';
import {
  getDeviceFailurePayload,
  isDeviceConnectionFailed,
  mountDeviceConnectionFailurePopup
} from './DeviceConnectionFailurePopup.js';

const deviceRows = [
  { id: 'washer-main', deviceName: '세탁기', room: 'Laundry Area', decibel: 71, time: '12:30' },
  { id: 'robot-living', deviceName: '로봇청소기', room: 'Living Room', decibel: 71, time: '12:30' },
  { id: 'washer-laundry-2', deviceName: '냉장고', room: 'Kitchen', decibel: '--', time: '11:30' },
  { id: 'washer-laundry-3', deviceName: '에어컨', room: 'Bedroom', decibel: 71, time: '12:30' },
  { id: 'robot-kitchen-2', deviceName: '식기세척기', room: 'Kitchen', decibel: 64, time: '12:10' },
  { id: 'hub-study-1', deviceName: 'LG 허브', room: 'Study', decibel: 19, time: '11:52' }
];

const WARNING_DECIBEL_THRESHOLD = 70;
const ROOM_OPTIONS = ['전체 공간', '거실', '침실', '세탁실', '주방'];
const STATUS_OPTIONS = ['전체 상태', '안정', '주의', '연결 필요'];

const roomLabelMap = {
  'Living Room': '거실',
  Bedroom: '침실',
  'Laundry Area': '세탁실',
  Kitchen: '주방',
  Study: '작업실'
};

function getDisplayRoom(room) {
  return roomLabelMap[room] ?? room;
}

function getDeviceStatus(device) {
  if (isDeviceConnectionFailed(device)) return '연결 필요';

  const decibel = Number(device.decibel);
  if (!Number.isFinite(decibel)) return '연결 필요';
  if (decibel >= WARNING_DECIBEL_THRESHOLD) return '주의';

  return '안정';
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
  return `
    <a class="device-list-card ${failed ? 'device-list-card--failed' : ''}" href="#/devices/${encodeURIComponent(device.id)}" aria-label="${escapeHtml(device.deviceName)} (${escapeHtml(room)}, ${escapeHtml(status)}) 기기 상세" ${failed ? `data-device-failure="${escapeHtml(device.id)}"` : ''}>
      <div class="device-list-picture" aria-hidden="true"></div>
      <div class="device-list-meta">
        <p>${escapeHtml(device.deviceName)}</p>
        <p>${escapeHtml(device.decibel)} dB</p>
        <p>${escapeHtml(device.time)}</p>
      </div>
      <span class="device-refresh-icon" aria-hidden="true">&#8635;</span>
    </a>
  `;
}

export async function renderDeviceListPage() {
  const failedCount = deviceRows.filter(isDeviceConnectionFailed).length;
  const onlineCount = deviceRows.length - failedCount;
  const attentionCopy =
    failedCount === 1 ? '연결 확인이 필요한 기기가 1대 있습니다.' : `연결 확인이 필요한 기기가 ${failedCount}대 있습니다.`;

  return `
    <section class="page device-list-page" aria-label="기기 목록 화면">
      <header class="device-list-header">
        <div class="device-list-heading">
          <h1>기기</h1>
          <p>총 ${deviceRows.length}대 - ${onlineCount}대 연결됨 - ${failedCount}대 불안정</p>
        </div>
        <button class="device-add-button" type="button">+</button>
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
        ${deviceRows.map(deviceCard).join('')}
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

  if (failedDevices[0]) {
    popupController.openPopup(failedDevices[0]);
  }
}

export function cleanupDeviceListPage() {
  popupCleanup?.();
  popupCleanup = null;
  filterCleanup?.();
  filterCleanup = null;
}
