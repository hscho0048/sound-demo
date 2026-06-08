import { bindSettingsTabs, renderSettingsTabs } from '../components/settingsTabs.js';

const defaultSettings = {
  noiseThreshold: 62,
  sensitivity: 72,
  confidence: 75,
  avoidanceEnabled: true
};

export function renderSettingsPage() {
  return `
    <section class="page settings-page" aria-label="Settings Screen">
      <header class="settings-page-header">
        <h1>Settings</h1>
        <p>Configure behavior, privacy, data retention, and account preferences.</p>
      </header>

      <div class="settings-layout">
        <aside class="settings-category-panel" aria-label="Settings categories">
          ${renderSettingsTabs('general')}
        </aside>

        <section class="settings-card settings-noise-card">
          <h2>Noise threshold</h2>
          <p>Set general trigger threshold for relative dB detection. Too low may create frequent inference or false events.</p>
          <div class="settings-range-row">
            <input id="noise-threshold-range" type="range" min="45" max="80" value="${defaultSettings.noiseThreshold}" />
            <output id="noise-threshold-value" for="noise-threshold-range">${defaultSettings.noiseThreshold} dB</output>
          </div>
        </section>

        <section class="settings-card settings-sensitivity-card">
          <h2>Sensitivity and confidence</h2>
          <p>Tune sensitivity and minimum model confidence before event creation.</p>
          <div class="settings-dual-ranges">
            <div class="settings-range-row">
              <input id="sensitivity-range" type="range" min="0" max="100" value="${defaultSettings.sensitivity}" />
              <output id="sensitivity-value" for="sensitivity-range">High</output>
            </div>
            <div class="settings-range-row">
              <input id="confidence-range" type="range" min="50" max="95" value="${defaultSettings.confidence}" />
              <output id="confidence-value" for="confidence-range">0.75</output>
            </div>
          </div>
        </section>

        <section class="settings-card settings-avoidance-card">
          <h2>Robot vacuum avoidance</h2>
          <p>Configure simulated robot vacuum avoidance when mapped service_label and room_id conditions are met.</p>
          <label class="settings-switch-row">
            <input id="avoidance-toggle" type="checkbox" ${defaultSettings.avoidanceEnabled ? 'checked' : ''} />
            <span class="settings-switch" aria-hidden="true"></span>
            <strong>Enable simulation overlay</strong>
          </label>
        </section>

        <section class="settings-card settings-consent-card">
          <h2>GPT detailed report consent</h2>
          <p>Manage consent and withdrawal. Withdrawal does not delete already generated reports unless separately deleted.</p>
          <div class="settings-consent-row">
            <label class="settings-switch-row settings-switch-row--compact">
              <input type="checkbox" />
              <span class="settings-switch" aria-hidden="true"></span>
              <small>Consent granted for summarized data only</small>
            </label>
            <button type="button" class="settings-outline-button">Manage</button>
          </div>
        </section>

        <section class="settings-card settings-data-card">
          <h2>Data retention and deletion</h2>
          <p>Set event/report retention policy and request deletion. Destructive actions require confirmation.</p>
          <div class="settings-button-row">
            <button type="button" class="settings-outline-button">Retention: 90 days</button>
            <button type="button" class="settings-outline-button">Delete data...</button>
          </div>
        </section>

        <section class="settings-card settings-save-card">
          <h2>설정 저장하기</h2>
          <button id="settings-save-button" type="button" class="settings-save-button">Save changes</button>
          <button id="settings-reset-button" type="button" class="settings-reset-button">Reset defaults</button>
          <span id="settings-save-status" aria-live="polite"></span>
        </section>
      </div>
    </section>
  `;
}

export function mountSettingsPage({ navigate } = {}) {
  const noiseRange = document.querySelector('#noise-threshold-range');
  const noiseValue = document.querySelector('#noise-threshold-value');
  const sensitivityRange = document.querySelector('#sensitivity-range');
  const sensitivityValue = document.querySelector('#sensitivity-value');
  const confidenceRange = document.querySelector('#confidence-range');
  const confidenceValue = document.querySelector('#confidence-value');
  const avoidanceToggle = document.querySelector('#avoidance-toggle');
  const saveStatus = document.querySelector('#settings-save-status');

  function renderValues() {
    if (noiseValue) noiseValue.textContent = `${noiseRange?.value ?? defaultSettings.noiseThreshold} dB`;

    const sensitivity = Number(sensitivityRange?.value ?? defaultSettings.sensitivity);
    if (sensitivityValue) {
      sensitivityValue.textContent = sensitivity >= 67 ? 'High' : sensitivity >= 34 ? 'Medium' : 'Low';
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
    if (saveStatus) saveStatus.textContent = 'Changes saved locally.';
  });

  document.querySelector('#settings-reset-button')?.addEventListener('click', () => {
    if (noiseRange) noiseRange.value = String(defaultSettings.noiseThreshold);
    if (sensitivityRange) sensitivityRange.value = String(defaultSettings.sensitivity);
    if (confidenceRange) confidenceRange.value = String(defaultSettings.confidence);
    if (avoidanceToggle) avoidanceToggle.checked = defaultSettings.avoidanceEnabled;
    renderValues();
    if (saveStatus) saveStatus.textContent = 'Defaults restored.';
  });

  renderValues();
}
