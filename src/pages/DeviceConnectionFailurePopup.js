import { bindBackdropDismiss, ensurePopupRoot, setPopupVisible } from '../utils/popup.js';

function getFailureReason(device) {
  if (device?.decibel === '--') {
    return 'dB 스캔 제한 시간 이후에도 응답이 없습니다.';
  }
  return '기기 연결 상태를 확인할 수 없습니다.';
}

function getAffectedDeviceName(device) {
  return `${device.id} / ${device.room}`;
}

export function renderDeviceConnectionFailurePopup() {
  return `
    <div id="device-connection-failure-popup" class="device-failure-backdrop hidden" aria-hidden="true">
      <section class="device-failure-modal" role="dialog" aria-modal="true" aria-labelledby="device-failure-title">
        <h2 id="device-failure-title">연결에 실패했습니다</h2>
        <p class="device-failure-subtitle">하드웨어 또는 센서에 연결할 수 없습니다.</p>

        <div class="device-failure-card">
          <strong>영향받은 기기 이름</strong>
          <p id="device-failure-name">-</p>
        </div>

        <div class="device-failure-card device-failure-card--danger">
          <strong>실패 원인 메시지</strong>
          <p id="device-failure-reason">-</p>
        </div>

        <div class="device-failure-card">
          <strong>권장 확인 항목</strong>
          <ul class="device-failure-list">
            <li>기기의 전원이 켜져 있는지 확인</li>
            <li>앱 권한이 허용되어 있는지 확인</li>
            <li>기기 가까이에서 다시 시도</li>
          </ul>
        </div>

        <div class="device-failure-actions">
          <button type="button" id="device-failure-settings" class="device-failure-secondary">설정</button>
          <button type="button" id="device-failure-retry" class="device-failure-primary">재시도</button>
          <button type="button" id="device-failure-cancel" class="device-failure-secondary">취소</button>
        </div>
      </section>
    </div>
  `;
}

export function mountDeviceConnectionFailurePopup({ navigate } = {}) {
  const root = ensurePopupRoot('device-connection-failure-popup-root');
  root.innerHTML = renderDeviceConnectionFailurePopup();

  const popup = root.querySelector('#device-connection-failure-popup');
  const name = root.querySelector('#device-failure-name');
  const reason = root.querySelector('#device-failure-reason');
  const retryButton = root.querySelector('#device-failure-retry');
  const settingsButton = root.querySelector('#device-failure-settings');
  const cancelButton = root.querySelector('#device-failure-cancel');

  const closePopup = () => {
    setPopupVisible(popup, false);
    if (retryButton) retryButton.disabled = false;
    if (retryButton) retryButton.textContent = '재시도';
  };

  const openPopup = (device) => {
    if (name) name.textContent = getAffectedDeviceName(device);
    if (reason) reason.textContent = getFailureReason(device);
    setPopupVisible(popup, true);
  };

  bindBackdropDismiss(popup, closePopup);

  cancelButton?.addEventListener('click', closePopup);

  settingsButton?.addEventListener('click', () => {
    closePopup();
    navigate?.('#/settings');
  });

  retryButton?.addEventListener('click', async () => {
    retryButton.disabled = true;
    retryButton.textContent = '재시도 중...';
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    retryButton.disabled = false;
    retryButton.textContent = '재시도';
  });

  const cleanup = () => {
    root?.remove();
  };

  return { openPopup, closePopup, cleanup };
}

export function isDeviceConnectionFailed(device) {
  return device?.decibel === '--';
}

export function getDeviceFailurePayload(device) {
  return {
    ...device,
    failureReason: getFailureReason(device),
    affectedName: getAffectedDeviceName(device)
  };
}
