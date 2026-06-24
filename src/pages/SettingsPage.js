import { withdrawGptConsent } from '../api/aiConsents.js';
import { createDataDeletionRequest } from '../api/dataDeletion.js';
import { bindSettingsTabs, renderSettingsTabs } from '../components/settingsTabs.js';
import { mountDataDeleteConfirmationPopup } from './DataDeletConfirmationPoppup.js';
import { mountGPTConsentWithdrawalPopup } from './GPTConsentWithdrawalPopup.js';

const defaultSettings = {
  noiseThreshold: 62,
  sensitivity: 72,
  confidence: 75,
  avoidanceEnabled: true
};

let dataDeletePopupCleanup = null;
let gptConsentPopupCleanup = null;

export function renderSettingsPage() {
  return `
    <section class="page settings-page" aria-label="설정 화면">
      <header class="settings-page-header">
        <h1>설정</h1>
        <p>동작, 개인정보, 데이터 보관, 계정 환경을 설정합니다.</p>
      </header>

      <div class="settings-layout">
        <aside class="settings-category-panel" aria-label="설정 카테고리">
          ${renderSettingsTabs('general')}
        </aside>

        <section class="settings-card settings-noise-card">
          <h2>소음 임계값</h2>
          <p>상대 dB 감지의 기본 트리거 기준을 설정합니다. 너무 낮으면 추론 또는 오탐이 자주 발생할 수 있습니다.</p>
          <div class="settings-range-row">
            <input id="noise-threshold-range" type="range" min="60" max="150" value="${defaultSettings.noiseThreshold}" />
            <output id="noise-threshold-value" for="noise-threshold-range">${defaultSettings.noiseThreshold} dB</output>
          </div>
        </section>

        <section class="settings-card settings-sensitivity-card">
          <h2>민감도 및 신뢰도</h2>
          <p>이벤트 생성 전에 민감도와 최소 모델 신뢰도 기준을 조정합니다.</p>
          <div class="settings-dual-ranges">
            <div class="settings-range-row">
              <input id="sensitivity-range" type="range" min="0" max="100" value="${defaultSettings.sensitivity}" />
              <output id="sensitivity-value" for="sensitivity-range">높음</output>
            </div>
            <div class="settings-range-row">
              <input id="confidence-range" type="range" min="50" max="95" value="${defaultSettings.confidence}" />
              <output id="confidence-value" for="confidence-range">0.75</output>
            </div>
          </div>
        </section>

        <section class="settings-card settings-avoidance-card">
          <h2>로봇청소기 회피</h2>
          <p>매핑된 service_label 및 room_id 조건이 충족될 때 시뮬레이션 기반 로봇청소기 회피를 설정합니다.</p>
          <label class="settings-switch-row">
            <input id="avoidance-toggle" type="checkbox" ${defaultSettings.avoidanceEnabled ? 'checked' : ''} />
            <span class="settings-switch" aria-hidden="true"></span>
            <strong>시뮬레이션 오버레이 사용</strong>
          </label>
        </section>

        <section class="settings-card settings-consent-card">
          <h2>GPT 상세 리포트 동의</h2>
          <p>동의 및 철회를 관리합니다. 철회하더라도 이미 생성된 리포트는 별도 삭제 전까지 유지됩니다.</p>
          <div class="settings-consent-row">
            <label class="settings-switch-row settings-switch-row--compact">
              <input id="gpt-consent-toggle" type="checkbox" checked />
              <span class="settings-switch" aria-hidden="true"></span>
              <small>요약 데이터 사용에만 동의됨</small>
            </label>
            <button id="withdraw-gpt-consent-button" type="button" class="settings-outline-button">관리</button>
          </div>
          <span id="gpt-consent-status" aria-live="polite"></span>
        </section>

        <section class="settings-card settings-data-card">
          <h2>데이터 보관 및 삭제</h2>
          <p>이벤트/리포트 보관 기간을 설정하고 삭제를 요청할 수 있습니다. 파괴적 작업은 확인이 필요합니다.</p>
          <div class="settings-data-controls">
            <span class="settings-static-note">보관 기간: 90일</span>
            <button id="delete-data-button" type="button" class="settings-outline-button">데이터 삭제</button>
          </div>
          <span id="data-deletion-status" aria-live="polite"></span>
        </section>

        <section class="settings-card settings-save-card">
          <h2>설정 저장</h2>
          <button id="settings-save-button" type="button" class="settings-save-button">변경사항 저장</button>
          <button id="settings-reset-button" type="button" class="settings-reset-button">기본값 복원</button>
          <span id="settings-save-status" aria-live="polite"></span>
        </section>
      </div>
    </section>
  `;
}

export function mountSettingsPage({ navigate } = {}) {
  dataDeletePopupCleanup?.();
  gptConsentPopupCleanup?.();
  dataDeletePopupCleanup = null;
  gptConsentPopupCleanup = null;

  const noiseRange = document.querySelector('#noise-threshold-range');
  const noiseValue = document.querySelector('#noise-threshold-value');
  const sensitivityRange = document.querySelector('#sensitivity-range');
  const sensitivityValue = document.querySelector('#sensitivity-value');
  const confidenceRange = document.querySelector('#confidence-range');
  const confidenceValue = document.querySelector('#confidence-value');
  const avoidanceToggle = document.querySelector('#avoidance-toggle');
  const saveStatus = document.querySelector('#settings-save-status');
  const deleteStatus = document.querySelector('#data-deletion-status');
  const consentStatus = document.querySelector('#gpt-consent-status');
  const consentToggle = document.querySelector('#gpt-consent-toggle');

  const dataDeletePopup = mountDataDeleteConfirmationPopup({
    onConfirm: async (confirmText) => {
      if (deleteStatus) deleteStatus.textContent = '삭제 요청 제출 중...';
      try {
        const response = await createDataDeletionRequest({
          scope: 'ALL',
          confirmText,
          metadata: { requestedFrom: 'tauri-settings' }
        });
        if (deleteStatus) deleteStatus.textContent = `삭제 요청 ${response.status}.`;
      } catch (error) {
        if (deleteStatus) deleteStatus.textContent = `삭제 요청 실패: ${error.message}`;
        throw error;
      }
    }
  });
  dataDeletePopupCleanup = dataDeletePopup.cleanup;

  const gptConsentPopup = mountGPTConsentWithdrawalPopup({
    navigate,
    onConfirm: async () => {
      if (consentStatus) consentStatus.textContent = '동의 철회 중...';
      try {
        const response = await withdrawGptConsent({ reason: 'USER_WITHDRAWAL' });
        if (consentToggle) consentToggle.checked = Boolean(response.granted);
        if (consentStatus) consentStatus.textContent = 'GPT 상세 리포트 동의를 철회했습니다.';
      } catch (error) {
        if (consentStatus) consentStatus.textContent = `동의 업데이트 실패: ${error.message}`;
        throw error;
      }
    }
  });
  gptConsentPopupCleanup = gptConsentPopup.cleanup;

  function renderValues() {
    if (noiseValue) noiseValue.textContent = `${noiseRange?.value ?? defaultSettings.noiseThreshold} dB`;

    const sensitivity = Number(sensitivityRange?.value ?? defaultSettings.sensitivity);
    if (sensitivityValue) {
      sensitivityValue.textContent = sensitivity >= 67 ? '높음' : sensitivity >= 34 ? '보통' : '낮음';
    }

    if (confidenceValue) {
      const confidence = Number(confidenceRange?.value ?? defaultSettings.confidence) / 100;
      confidenceValue.textContent = confidence.toFixed(2);
    }

    [noiseRange, sensitivityRange, confidenceRange].forEach((range) => {
      if (!range) return;
      const min = Number(range.min || 0);
      const max = Number(range.max || 100);
      const value = Number(range.value || min);
      const percent = ((value - min) / (max - min)) * 100;
      range.style.setProperty('--range-fill', `${percent}%`);
    });
  }

  [noiseRange, sensitivityRange, confidenceRange].forEach((range) => {
    range?.addEventListener('input', () => {
      renderValues();
      if (saveStatus) saveStatus.textContent = '';
    });
  });

  avoidanceToggle?.addEventListener('change', () => {
    if (saveStatus) saveStatus.textContent = '';
  });

  bindSettingsTabs(navigate);

  document.querySelector('#settings-save-button')?.addEventListener('click', () => {
    if (saveStatus) saveStatus.textContent = '변경사항이 로컬에 저장되었습니다.';
  });

  document.querySelector('#settings-reset-button')?.addEventListener('click', () => {
    if (noiseRange) noiseRange.value = String(defaultSettings.noiseThreshold);
    if (sensitivityRange) sensitivityRange.value = String(defaultSettings.sensitivity);
    if (confidenceRange) confidenceRange.value = String(defaultSettings.confidence);
    if (avoidanceToggle) avoidanceToggle.checked = defaultSettings.avoidanceEnabled;
    renderValues();
    if (saveStatus) saveStatus.textContent = '기본값으로 복원되었습니다.';
  });

  document.querySelector('#withdraw-gpt-consent-button')?.addEventListener('click', () => {
    if (consentStatus) consentStatus.textContent = '';
    gptConsentPopup.openPopup();
  });

  document.querySelector('#delete-data-button')?.addEventListener('click', () => {
    if (deleteStatus) deleteStatus.textContent = '';
    dataDeletePopup.openPopup();
  });

  renderValues();
}

export function cleanupSettingsPage() {
  dataDeletePopupCleanup?.();
  gptConsentPopupCleanup?.();
  dataDeletePopupCleanup = null;
  gptConsentPopupCleanup = null;
}
