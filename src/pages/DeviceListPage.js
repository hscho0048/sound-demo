import { getDevices } from '../api/deviceApi.js';
import { DeviceCard } from '../components/DeviceCard.js';

export async function renderDeviceListPage() {
  const devices = await getDevices();
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Devices</p>
          <h1>기기 목록</h1>
          <p>스마트폰, 가전 소리 모듈, 소음 미터, 환경 센서 상태를 확인합니다.</p>
        </div>
      </div>
      <div class="card-list card-list--wide">
        ${devices.map((device) => `<a class="card-link" href="#/devices/${encodeURIComponent(device.id ?? '')}">${DeviceCard(device)}</a>`).join('')}
      </div>
    </section>
  `;
}

export function mountDeviceListPage() {}
