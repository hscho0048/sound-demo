import { getSensitiveAppliances, saveSensitiveAppliances } from '../api/settingsApi.js';
import { escapeHtml } from '../utils/html.js';

const policyDescriptions = {
  robot_vacuum: '로봇청소기: 3D 화면에서 회피 경로를 시뮬레이션합니다.',
  washing_machine: '세탁기: 조용 모드 시뮬레이션 또는 루틴 추천을 표시합니다.',
  dishwasher: '식기세척기: 사용 시간 조정 루틴을 추천합니다.',
  refrigerator: '냉장고: 조절 불가 가전으로 주의 알림만 표시합니다.'
};

function applianceRow(item) {
  const automaticResponseMode = item.automaticResponseMode ?? '';
  const notificationMode = item.notificationMode ?? '';
  return `
    <article class="settings-row" data-service-label="${escapeHtml(item.serviceLabel)}">
      <div class="settings-row__header">
        <div>
          <h3>${escapeHtml(item.displayName)}</h3>
          <p>${escapeHtml(policyDescriptions[item.serviceLabel] ?? '민감 가전 정책을 설정합니다.')}</p>
        </div>
        <label class="toggle">
          <input type="checkbox" name="enabled" ${item.enabled ? 'checked' : ''} />
          <span>민감 가전</span>
        </label>
      </div>
      <div class="form-grid">
        <label>기본 dB 기준<input type="number" name="baseDbThreshold" value="${escapeHtml(item.baseDbThreshold)}" min="30" max="100" /></label>
        <label>가전별 대응 dB<input type="number" name="responseDbThreshold" value="${escapeHtml(item.responseDbThreshold)}" min="30" max="100" /></label>
        <label>신뢰도 기준<input type="number" name="confidenceThreshold" value="${escapeHtml(item.confidenceThreshold)}" min="0" max="1" step="0.01" /></label>
        <label>자동 대응
          <select name="automaticResponseMode">
            <option value="NOTIFICATION_ONLY" ${automaticResponseMode === 'NOTIFICATION_ONLY' ? 'selected' : ''}>알림만</option>
            <option value="CONFIRM_BEFORE_APPLY" ${automaticResponseMode === 'CONFIRM_BEFORE_APPLY' ? 'selected' : ''}>확인 후 적용</option>
            <option value="AUTO_APPLY_SIMULATION" ${automaticResponseMode === 'AUTO_APPLY_SIMULATION' ? 'selected' : ''}>자동 시뮬레이션</option>
            <option value="ROUTINE_SUGGESTION" ${automaticResponseMode === 'ROUTINE_SUGGESTION' ? 'selected' : ''}>루틴 추천</option>
            <option value="WARNING_ONLY" ${automaticResponseMode === 'WARNING_ONLY' ? 'selected' : ''}>주의 알림만</option>
            <option value="DISABLED" ${automaticResponseMode === 'DISABLED' ? 'selected' : ''}>비활성</option>
          </select>
        </label>
        <label>알림 방식
          <select name="notificationMode">
            <option value="IMMEDIATE" ${notificationMode === 'IMMEDIATE' ? 'selected' : ''}>즉시</option>
            <option value="SUMMARY" ${notificationMode === 'SUMMARY' ? 'selected' : ''}>요약</option>
            <option value="GUARDIAN_ESCALATION" ${notificationMode === 'GUARDIAN_ESCALATION' ? 'selected' : ''}>보호자 공유 후보</option>
          </select>
        </label>
        <label class="checkbox-row"><input type="checkbox" name="includeInReport" ${item.includeInReport ? 'checked' : ''} /> 리포트 포함</label>
      </div>
    </article>
  `;
}

export async function renderSensitiveApplianceSettingsPage() {
  const settings = await getSensitiveAppliances();
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Sensitive Appliances</p>
          <h1>민감 가전 설정</h1>
          <p>저장한 설정은 Spring Boot를 통해 Flutter IoT Hub Mode와 User Device Mode로 동기화됩니다.</p>
        </div>
        <button id="save-sensitive-settings" class="primary-button">설정 저장</button>
      </div>
      <form id="sensitive-settings-form" class="settings-list">
        ${settings.map(applianceRow).join('')}
      </form>
      <p id="settings-save-result" class="save-result" aria-live="polite"></p>
    </section>
  `;
}

function collectSettings() {
  return [...document.querySelectorAll('.settings-row')].map((row) => {
    const value = (name) => row.querySelector(`[name="${name}"]`);
    return {
      serviceLabel: row.dataset.serviceLabel,
      displayName: row.querySelector('h3').textContent,
      enabled: value('enabled').checked,
      baseDbThreshold: Number(value('baseDbThreshold').value),
      responseDbThreshold: Number(value('responseDbThreshold').value),
      confidenceThreshold: Number(value('confidenceThreshold').value),
      automaticResponseMode: value('automaticResponseMode').value,
      notificationMode: value('notificationMode').value,
      includeInReport: value('includeInReport').checked
    };
  });
}

export function mountSensitiveApplianceSettingsPage() {
  document.querySelector('#save-sensitive-settings')?.addEventListener('click', async () => {
    const resultEl = document.querySelector('#settings-save-result');
    resultEl.textContent = '저장 중...';
    try {
      const result = await saveSensitiveAppliances(collectSettings());
      resultEl.textContent = `저장 완료: ${result.settingsVersion ?? 'local'}`;
    } catch (error) {
      resultEl.textContent = `저장 실패: ${error.message}`;
    }
  });
}
