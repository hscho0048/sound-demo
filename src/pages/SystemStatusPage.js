import { bindSettingsTabs, renderSettingsTabs } from '../components/settingsTabs.js';
import { escapeHtml } from '../utils/html.js';

const statusCards = [
  {
    title: 'Spring Boot server',
    state: 'Connected',
    tone: 'ok',
    meta: 'API latency 124 ms',
    progress: 85
  },
  {
    title: 'Flutter IoT Hub',
    state: 'Intermittent',
    tone: 'warn',
    meta: 'Last heartbeat 03:12 ago',
    progress: 53
  },
  {
    title: 'Local classification model',
    state: 'Model loaded',
    tone: 'ok',
    meta: 'YAMNet mapping active',
    progress: 86
  },
  {
    title: 'Compact hardware + sensor',
    state: 'Sensor warning',
    tone: 'warn',
    meta: 'Arduino temp/humidity stale',
    progress: 53
  }
];

const errorRows = [
  { time: '14:32', source: 'IoT Hub', error: 'Upload timeout', state: 'Retrying', action: 'View' },
  { time: '14:28', source: 'Sensor', error: 'Humidity stale', state: 'Warning', action: 'Open' }
];

function statusPill(label, tone) {
  return `
    <span class="system-status-pill system-status-pill--${escapeHtml(tone)}">
      <i aria-hidden="true"></i>
      ${escapeHtml(label)}
    </span>
  `;
}

function statusCard(card) {
  return `
    <article class="system-card system-card--${escapeHtml(card.tone)}">
      <h2>${escapeHtml(card.title)}</h2>
      <div class="system-card-body">
        ${statusPill(card.state, card.tone)}
        <p>${escapeHtml(card.meta)}</p>
      </div>
      <div class="system-progress" aria-hidden="true">
        <span style="width: ${Number(card.progress) || 0}%"></span>
      </div>
    </article>
  `;
}

function errorRow(row) {
  return `
    <tr>
      <td>${escapeHtml(row.time)}</td>
      <td>${escapeHtml(row.source)}</td>
      <td>${escapeHtml(row.error)}</td>
      <td>${escapeHtml(row.state)}</td>
      <td>${escapeHtml(row.action)}</td>
    </tr>
  `;
}

export async function renderSystemStatusPage() {
  return `
    <section class="page system-status-page" aria-label="Error and Connection Status Screen">
      <header class="system-page-header">
        <h1>System Status</h1>
        <p>Troubleshoot server, device, model, upload, and data loading failures.</p>
      </header>

      <div class="system-status-shell">
        <aside class="settings-category-panel system-category-panel" aria-label="System settings categories">
          ${renderSettingsTabs('system')}
        </aside>

        <div class="system-status-layout">
          <section class="system-overall-banner" aria-label="Overall system status">
            <div>
              <h2>Overall system status: Degraded</h2>
              <p>Server reachable, but IoT upload queue has retries and one sensor node is unstable.</p>
            </div>
            <div class="system-banner-actions">
              ${statusPill('Backend OK', 'ok')}
              ${statusPill('Retry queue', 'warn')}
            </div>
          </section>

          ${statusCards.map(statusCard).join('')}

          <aside class="system-guide-card">
            <h2>Troubleshooting guide</h2>
            <ol>
              <li>Check backend health endpoint.</li>
              <li>Confirm IoT hub token validity.</li>
              <li>Keep sensitive tokens hidden.</li>
              <li>Retry queue can store local data.</li>
            </ol>
            <button id="system-retry-button" class="system-retry-button" type="button">Retry connection</button>
            <p id="system-retry-status" class="system-retry-status" aria-live="polite"></p>
          </aside>

          <section class="system-error-log">
            <h2>Recent error log</h2>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Error</th>
                  <th>State</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${errorRows.map(errorRow).join('')}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </section>
  `;
}

export function mountSystemStatusPage({ navigate } = {}) {
  bindSettingsTabs(navigate);

  document.querySelector('#system-retry-button')?.addEventListener('click', () => {
    const status = document.querySelector('#system-retry-status');
    if (status) status.textContent = 'Retry requested. Queue will be checked again shortly.';
  });
}
