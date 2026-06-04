import { getDevice, getRuntimeSettings } from '../api/deviceApi.js';
import { escapeHtml } from '../utils/html.js';

export async function renderDeviceDetailPage({ params }) {
  const deviceId = decodeURIComponent(params.deviceId ?? '');
  const device = await getDevice(deviceId);
  const runtimeSettings = await getRuntimeSettings(deviceId);
  if (!device) {
    return '<section class="page"><h1>기기를 찾을 수 없습니다.</h1><p>목록에서 다시 선택해 주세요.</p></section>';
  }
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Device Detail</p>
          <h1>${escapeHtml(device.name)}</h1>
          <p>${escapeHtml(device.type)} · ${escapeHtml(device.roomName ?? '방 미지정')}</p>
        </div>
        <span class="badge">${device.connected ? '연결됨' : '연결 끊김'}</span>
      </div>
      <section class="section-block">
        <h2>런타임 설정 동기화</h2>
        <p>Flutter IoT Hub Mode와 User Device Mode는 이 설정을 주기적으로 동기화합니다.</p>
        <pre class="code-block">${escapeHtml(JSON.stringify(runtimeSettings, null, 2))}</pre>
      </section>
    </section>
  `;
}

export function mountDeviceDetailPage() {}
