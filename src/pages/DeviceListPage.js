import { escapeHtml } from '../utils/html.js';
import {
  getDeviceFailurePayload,
  isDeviceConnectionFailed,
  mountDeviceConnectionFailurePopup
} from './DeviceConnectionFailurePopup.js';

const deviceRows = [
  { id: 'washer-main', room: '세탁실', decibel: 71, time: '12:30' },
  { id: 'robot-living', room: '거실', decibel: 71, time: '12:30' },
  { id: 'washer-laundry-2', room: '세탁실', decibel: '--', time: '11:30' },
  { id: 'washer-laundry-3', room: '세탁실', decibel: 71, time: '12:30' },
  { id: 'robot-kitchen-2', room: '주방', decibel: 64, time: '12:10' },
  { id: 'hub-study-1', room: '작업실', decibel: 19, time: '11:52' }
];

function deviceCard(device) {
  const failed = isDeviceConnectionFailed(device);
  return `
    <a class="device-list-card ${failed ? 'device-list-card--failed' : ''}" href="#/devices/${encodeURIComponent(device.id)}" aria-label="${escapeHtml(device.room)} 기기 상세" ${failed ? `data-device-failure="${escapeHtml(device.id)}"` : ''}>
      <div class="device-list-picture" aria-hidden="true"></div>
      <div class="device-list-meta">
        <p>${escapeHtml(device.room)}</p>
        <p>${escapeHtml(device.decibel)} dB</p>
        <p>${escapeHtml(device.time)}</p>
      </div>
      <span class="device-refresh-icon" aria-hidden="true">+</span>
    </a>
  `;
}

export async function renderDeviceListPage() {
  return `
    <section class="page device-list-page" aria-label="기기 목록 화면">
      <header class="device-list-header">
        <div class="device-list-heading">
          <h1>기기</h1>
          <p>총 8대 등록 · 6대 연결 중 · 2대 상태 불안정</p>
        </div>
        <button class="device-add-button" type="button">기기 추가</button>
      </header>

      <section class="device-filter-bar" aria-label="기기 필터">
        <button type="button">공간: 전체</button>
        <button type="button">연결 상태: 전체</button>
        <label>
          <span class="hidden">기기 이름 검색</span>
          <input type="search" placeholder="기기 이름 검색" />
        </label>
      </section>

      <section class="device-warning-banner" aria-label="기기 연결 경고">
        <span class="device-warning-dot" aria-hidden="true"></span>
        <p>2대의 기기가 연결 해제되었거나 상태가 불안정합니다. 실시간 상태를 확인하기 전에 연결을 점검하세요.</p>
        <button type="button">확인</button>
      </section>

      <section class="device-list-grid" aria-label="등록된 기기">
        ${deviceRows.map(deviceCard).join('')}
      </section>
    </section>
  `;
}

let popupCleanup = null;

export function mountDeviceListPage({ navigate } = {}) {
  cleanupDeviceListPage();
  const failedDevices = deviceRows.filter(isDeviceConnectionFailed).map(getDeviceFailurePayload);
  const popupController = mountDeviceConnectionFailurePopup({ navigate });
  popupCleanup = popupController.cleanup;
  const failedDeviceMap = new Map(failedDevices.map((device) => [device.id, device]));

  document.querySelector('.device-warning-banner button')?.addEventListener('click', () => {
    if (failedDevices[0]) popupController.openPopup(failedDevices[0]);
  });

  document.querySelectorAll('[data-device-failure]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const failedDevice = failedDeviceMap.get(link.dataset.deviceFailure);
      if (failedDevice) popupController.openPopup(failedDevice);
    });
  });

  if (failedDevices[0]) {
    popupController.openPopup(failedDevices[0]);
  }
}

export function cleanupDeviceListPage() {
  popupCleanup?.();
  popupCleanup = null;
}
