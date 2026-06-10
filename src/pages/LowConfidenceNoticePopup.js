import { bindBackdropDismiss, ensurePopupRoot, setPopupVisible } from '../utils/popup.js';

function formatModelLabel(modelLabel) {
  if (modelLabel === 'vacuum_cleaner') {
    return '청소기';
  }
  return modelLabel ?? '-';
}

export function renderLowConfidenceNoticePopup() {
  return `
    <div id="low-confidence-popup" class="low-confidence-backdrop hidden" aria-hidden="true">
      <section class="low-confidence-modal" role="dialog" aria-modal="true" aria-labelledby="low-confidence-title">
        <h2 id="low-confidence-title">낮은 신뢰도 안내</h2>
        <p class="low-confidence-subtitle">이벤트나 후속 동작은 생성되지 않았습니다.</p>

        <div class="low-confidence-metrics">
          <div class="low-confidence-card low-confidence-card--model">
            <p id="low-confidence-model">-</p>
          </div>
          <div class="low-confidence-card low-confidence-card--metric">
            <div class="low-confidence-metric-values">
              <span id="low-confidence-value" class="low-confidence-metric-value">-</span>
              <span class="low-confidence-metric-divider">/</span>
              <span id="low-confidence-threshold" class="low-confidence-metric-threshold">-</span>
            </div>
            <div class="low-confidence-metric-labels">
              <span>신뢰도</span>
              <span>기준값</span>
            </div>
          </div>
        </div>

        <p id="low-confidence-message" class="low-confidence-message">
          예측 신뢰도가 필요한 기준값보다 낮아 확정 이벤트로 처리되지 않았습니다.
        </p>

        <div class="low-confidence-actions">
          <button type="button" id="low-confidence-settings" class="low-confidence-secondary">설정</button>
          <button type="button" id="low-confidence-close" class="low-confidence-primary">닫기</button>
        </div>
      </section>
    </div>
  `;
}

export function mountLowConfidenceNoticePopup({ navigate } = {}) {
  const root = ensurePopupRoot('low-confidence-popup-root');
  root.innerHTML = renderLowConfidenceNoticePopup();

  const popup = root.querySelector('#low-confidence-popup');
  const model = root.querySelector('#low-confidence-model');
  const value = root.querySelector('#low-confidence-value');
  const threshold = root.querySelector('#low-confidence-threshold');
  const metricCard = root.querySelector('.low-confidence-card--metric');
  const settingsButton = root.querySelector('#low-confidence-settings');
  const closeButton = root.querySelector('#low-confidence-close');

  const closePopup = () => {
    setPopupVisible(popup, false);
  };

  const openPopup = ({ modelLabel, confidence, thresholdValue } = {}) => {
    const confidenceNumber = Number(confidence ?? 0);
    const thresholdNumber = Number(thresholdValue ?? 0);

    if (model) model.textContent = formatModelLabel(modelLabel);
    if (value) value.textContent = confidenceNumber.toFixed(2);
    if (threshold) threshold.textContent = thresholdNumber.toFixed(2);

    metricCard?.classList.toggle('is-below-threshold', confidenceNumber < thresholdNumber);

    setPopupVisible(popup, true);
  };

  bindBackdropDismiss(popup, closePopup);

  closeButton?.addEventListener('click', closePopup);

  settingsButton?.addEventListener('click', () => {
    closePopup();
    navigate?.('#/settings');
  });

  const cleanup = () => {
    root?.remove();
  };

  return { openPopup, closePopup, cleanup };
}
