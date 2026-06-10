import { escapeHtml } from '../utils/html.js';
import { bindBackdropDismiss, ensurePopupRoot, setPopupVisible } from '../utils/popup.js';

function renderServerFailureLine(label, value) {
  return `<span class="server-failure-label">${escapeHtml(label)}</span><span class="server-failure-value">${escapeHtml(value)}</span>`;
}

export function renderServerConnectionFailurePopup() {
  return `
    <div id="server-connection-failure-popup" class="server-failure-backdrop hidden" aria-hidden="true">
      <section class="server-failure-modal" role="dialog" aria-modal="true" aria-labelledby="server-failure-title">
        <h2 id="server-failure-title">서버 연결 실패</h2>
        <p class="server-failure-subtitle">Spring Boot 백엔드에 연결할 수 없습니다.</p>

        <div class="server-failure-card">
          <p id="server-failure-last-sync">${renderServerFailureLine('마지막 정상 동기화: ', '-')}</p>
        </div>

        <div class="server-failure-card">
          <p id="server-failure-queue">${renderServerFailureLine('로컬 재시도 대기열: ', '서명된 payload 5건 대기 중')}</p>
        </div>

        <div class="server-failure-actions">
          <button type="button" id="server-failure-retry" class="server-failure-primary">다시 시도</button>
          <button type="button" id="server-failure-offline" class="server-failure-secondary">오프라인으로 계속</button>
          <button type="button" id="server-failure-status" class="server-failure-secondary">상태 보기</button>
        </div>
      </section>
    </div>
  `;
}

export function mountServerConnectionFailurePopup({ navigate } = {}) {
  const root = ensurePopupRoot('server-connection-failure-popup-root');
  root.innerHTML = renderServerConnectionFailurePopup();

  const popup = root.querySelector('#server-connection-failure-popup');
  const lastSync = root.querySelector('#server-failure-last-sync');
  const queue = root.querySelector('#server-failure-queue');
  const retryButton = root.querySelector('#server-failure-retry');
  const offlineButton = root.querySelector('#server-failure-offline');
  const statusButton = root.querySelector('#server-failure-status');

  const closePopup = () => {
    setPopupVisible(popup, false);
    if (retryButton) retryButton.disabled = false;
    if (retryButton) retryButton.textContent = '지금 다시 시도';
  };

  const openPopup = ({ lastSuccessfulSync, retryQueueCount = 5 } = {}) => {
    if (lastSync) {
      lastSync.innerHTML = renderServerFailureLine('마지막 정상 동기화: ', lastSuccessfulSync ?? '-');
    }

    if (queue) {
      queue.innerHTML = renderServerFailureLine('로컬 재시도 대기열: ', `서명된 payload ${retryQueueCount}건 대기 중`);
    }

    setPopupVisible(popup, true);
  };

  bindBackdropDismiss(popup, closePopup);

  retryButton?.addEventListener('click', async () => {
    retryButton.disabled = true;
    retryButton.textContent = '다시 시도하는 중...';
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    retryButton.disabled = false;
    retryButton.textContent = '지금 다시 시도';
  });

  offlineButton?.addEventListener('click', closePopup);

  statusButton?.addEventListener('click', () => {
    closePopup();
    navigate?.('#/reports/system-status');
  });

  const cleanup = () => {
    root?.remove();
  };

  return { openPopup, closePopup, cleanup };
}
