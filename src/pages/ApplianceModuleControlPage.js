import { getDeviceAgents } from '../api/deviceAgentApi.js';
import {
  COMMAND_TYPES,
  buildPlayCommand,
  buildStopCommand,
  buildVolumeCommand,
  createControlCommand,
  getLatestControlCommand
} from '../api/applianceCommandApi.js';
import {
  getLatestApplianceMeasurement,
  isTelemetryStale
} from '../api/applianceMeasurementApi.js';
import { isMockApiEnabled } from '../api/client.js';
import { escapeHtml } from '../utils/html.js';

const env = import.meta.env ?? {};
const MEASUREMENT_POLL_MS = Number(env.VITE_APPLIANCE_MEASUREMENT_POLL_INTERVAL_MS ?? 1000);
const AGENT_POLL_MS = Number(env.VITE_DEVICE_AGENT_POLL_INTERVAL_MS ?? 3000);

let measurementTimer = null;
let agentTimer = null;
let pollingEnabled = false;

export function agentStatusCard(agent) {
  if (!agent) {
    return `
      <article class="status-card status-card--accent" id="agent-status-card">
        <span class="status-card__title">Appliance Controller Agent</span>
        <strong class="status-card__value">에이전트 없음</strong>
        <small class="status-card__meta">연결된 Agent PC가 없습니다. 하드웨어 제어가 불가능합니다.</small>
      </article>
    `;
  }
  const online = agent.online === true;
  return `
    <article class="status-card ${online ? 'status-card--accent' : ''}" id="agent-status-card">
      <span class="status-card__title">Appliance Controller Agent</span>
      <strong class="status-card__value">${online ? '온라인' : '오프라인'}</strong>
      <div class="definition-list" style="margin-top:0.5rem">
        <div><dt>agentId</dt><dd>${escapeHtml(agent.agentId ?? '-')}</dd></div>
        <div><dt>hostName</dt><dd>${escapeHtml(agent.hostName ?? '-')}</dd></div>
        <div><dt>lastSeenAt</dt><dd>${escapeHtml(agent.lastSeenAt ?? '-')}</dd></div>
        <div><dt>connectedModuleIds</dt><dd>${escapeHtml((agent.connectedModuleIds ?? []).join(', ') || '-')}</dd></div>
        <div><dt>lastSerialPort</dt><dd>${escapeHtml(agent.lastSerialPort ?? '-')}</dd></div>
      </div>
      ${online ? '' : '<small class="status-card__meta">오프라인 상태에서는 명령이 전달되지 않을 수 있습니다.</small>'}
    </article>
  `;
}

export function commandStatusPanel(command) {
  if (!command) {
    return '<p class="notification-banner notification-banner--empty">아직 생성된 명령이 없습니다.</p>';
  }
  return `
    <div class="definition-list">
      <div><dt>command ID</dt><dd>${escapeHtml(command.commandId ?? '-')}</dd></div>
      <div><dt>command type</dt><dd>${escapeHtml(command.commandType ?? '-')}</dd></div>
      <div><dt>status</dt><dd><span class="badge">${escapeHtml(command.status ?? '-')}</span></dd></div>
      <div><dt>result message</dt><dd>${escapeHtml(command.resultMessage ?? '-')}</dd></div>
    </div>
  `;
}

export function telemetryPanel(telemetry, stale) {
  if (!telemetry) {
    return '<p class="notification-banner notification-banner--empty">최신 텔레메트리가 없습니다.</p>';
  }
  return `
    ${stale ? '<div class="warning-box">텔레메트리가 오래되었습니다(stale). 표시 값은 최신이 아닐 수 있습니다.</div>' : ''}
    <div class="definition-list">
      <div><dt>moduleId</dt><dd>${escapeHtml(telemetry.moduleId ?? '-')}</dd></div>
      <div><dt>applianceType</dt><dd>${escapeHtml(telemetry.applianceType ?? '-')}</dd></div>
      <div><dt>playbackState</dt><dd>${escapeHtml(telemetry.playbackState ?? '-')}</dd></div>
      <div><dt>sampleName</dt><dd>${escapeHtml(telemetry.sampleName ?? '-')}</dd></div>
      <div><dt>volumePercent</dt><dd>${escapeHtml(telemetry.volumePercent ?? '-')}%</dd></div>
      <div><dt>relativeDb</dt><dd>${escapeHtml(telemetry.relativeDb ?? '-')} dB</dd></div>
      <div><dt>decibelAvg</dt><dd>${escapeHtml(telemetry.decibelAvg ?? '-')} dB</dd></div>
      <div><dt>decibelMax</dt><dd>${escapeHtml(telemetry.decibelMax ?? '-')} dB</dd></div>
      <div><dt>rms</dt><dd>${escapeHtml(telemetry.rms ?? '-')}</dd></div>
      <div><dt>measuredBy</dt><dd>${escapeHtml(telemetry.measuredBy ?? '-')}</dd></div>
      <div><dt>moduleTimestampMs</dt><dd>${escapeHtml(telemetry.moduleTimestampMs ?? '-')}</dd></div>
      <div><dt>received / uploaded</dt><dd>${escapeHtml(telemetry.receivedAt ?? telemetry.uploadedAt ?? '-')}</dd></div>
    </div>
  `;
}

export async function renderApplianceModuleControlPage() {
  const agents = await getDeviceAgents().catch(() => []);
  const agent = agents?.[0] ?? null;
  const latestCommand = await getLatestControlCommand().catch(() => null);
  const telemetry = await getLatestApplianceMeasurement({ serviceLabel: 'robot_vacuum' })
    .catch(() => null);
  const stale = isTelemetryStale(telemetry);

  return `
    <section class="page" data-page="appliance-module">
      <div class="page-header">
        <div>
          <p class="eyebrow">Appliance Prototype Control</p>
          <h1>가전 모형 제어</h1>
          <p>Tauri/Web은 ESP32-S3 Serial을 직접 열지 않습니다. Spring Boot로 제어 명령을 만들면
          Appliance Controller Agent PC가 USB Serial로 ESP32-S3 통합 가전 모형 모듈에 전달합니다.</p>
        </div>
        <div class="button-row">
          <button id="manual-refresh" class="secondary">새로고침</button>
          <label class="toggle"><input type="checkbox" id="polling-toggle" /> 자동 폴링</label>
        </div>
      </div>

      ${isMockApiEnabled() ? '<div class="notification-banner">Mock 모드입니다. 백엔드 또는 Agent가 실행되지 않아도 샘플 데이터로 화면을 확인할 수 있습니다.</div>' : ''}

      <section class="section-block" id="agent-status-block">
        <div class="section-title-row"><h2>Agent 상태</h2></div>
        ${agentStatusCard(agent)}
      </section>

      <section class="section-block">
        <div class="section-title-row"><h2>가전 모형 제어 패널</h2></div>
        <div class="button-row">
          <button data-play="washing_machine">세탁기 재생</button>
          <button data-play="dishwasher">식기세척기 재생</button>
          <button data-play="robot_vacuum">로봇청소기 재생</button>
          <button data-stop="true" class="secondary">정지</button>
        </div>
        <div class="form-grid" style="margin-top:1rem">
          <label>볼륨 (<span id="volume-value">70</span>%)
            <input type="range" id="volume-slider" min="0" max="100" value="70" />
          </label>
          <label>모드
            <select id="mode-selector">
              <option value="single">single</option>
              <option value="loop">loop</option>
            </select>
          </label>
          <label style="align-self:end">
            <button id="apply-volume" class="secondary">볼륨 적용</button>
          </label>
        </div>
        <p id="command-feedback" class="save-result"></p>
      </section>

      <section class="section-block two-column">
        <div>
          <div class="section-title-row"><h2>명령 상태</h2></div>
          <div id="command-status-panel">${commandStatusPanel(latestCommand)}</div>
        </div>
        <div>
          <div class="section-title-row"><h2>최신 텔레메트리</h2></div>
          <div id="telemetry-panel">${telemetryPanel(telemetry, stale)}</div>
        </div>
      </section>
    </section>
  `;
}

export function mountApplianceModuleControlPage() {
  const volumeSlider = document.querySelector('#volume-slider');
  const volumeValue = document.querySelector('#volume-value');
  const modeSelector = document.querySelector('#mode-selector');
  const feedback = document.querySelector('#command-feedback');

  function currentVolume() {
    return Number(volumeSlider?.value ?? 70);
  }
  function currentMode() {
    return modeSelector?.value === 'loop' ? 'loop' : 'single';
  }

  volumeSlider?.addEventListener('input', () => {
    if (volumeValue) volumeValue.textContent = volumeSlider.value;
  });

  async function sendCommand(command, label) {
    if (feedback) feedback.textContent = `${label} 명령 전송 중...`;
    try {
      const result = await createControlCommand(command);
      const panel = document.querySelector('#command-status-panel');
      if (panel) panel.innerHTML = commandStatusPanel(result);
      if (feedback) feedback.textContent = `${label} 명령이 생성되었습니다. (${result.status})`;
    } catch (error) {
      if (feedback) feedback.textContent = `${label} 명령 실패: ${error.message}`;
    }
  }

  document.querySelectorAll('[data-play]').forEach((button) => {
    button.addEventListener('click', () => {
      const applianceType = button.dataset.play;
      const command = buildPlayCommand(applianceType, {
        volumePercent: currentVolume(),
        mode: currentMode()
      });
      sendCommand(command, `${applianceType} 재생`);
    });
  });

  document.querySelector('[data-stop="true"]')?.addEventListener('click', () => {
    const command = buildStopCommand('robot_vacuum');
    sendCommand(command, '정지');
  });

  document.querySelector('#apply-volume')?.addEventListener('click', () => {
    const command = buildVolumeCommand(currentVolume());
    sendCommand(command, `볼륨 ${currentVolume()}%`);
  });

  async function refreshState() {
    try {
      const [agents, telemetry] = await Promise.all([
        getDeviceAgents().catch(() => []),
        getLatestApplianceMeasurement({ serviceLabel: 'robot_vacuum' }).catch(() => null)
      ]);
      const agentBlock = document.querySelector('#agent-status-block');
      if (agentBlock) {
        agentBlock.querySelector('#agent-status-card')?.replaceWith(
          htmlToNode(agentStatusCard(agents?.[0] ?? null))
        );
      }
      const telemetryPanelEl = document.querySelector('#telemetry-panel');
      if (telemetryPanelEl) {
        telemetryPanelEl.innerHTML = telemetryPanel(telemetry, isTelemetryStale(telemetry));
      }
    } catch {
      // 폴링 실패는 화면 사용을 막지 않는다.
    }
  }

  document.querySelector('#manual-refresh')?.addEventListener('click', refreshState);

  const pollingToggle = document.querySelector('#polling-toggle');
  pollingToggle?.addEventListener('change', () => {
    pollingEnabled = pollingToggle.checked;
    stopPolling();
    if (pollingEnabled) {
      measurementTimer = window.setInterval(refreshState, MEASUREMENT_POLL_MS);
      agentTimer = window.setInterval(refreshState, AGENT_POLL_MS);
    }
  });
}

function stopPolling() {
  if (measurementTimer) window.clearInterval(measurementTimer);
  if (agentTimer) window.clearInterval(agentTimer);
  measurementTimer = null;
  agentTimer = null;
}

function htmlToNode(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function cleanupApplianceModuleControlPage() {
  stopPolling();
  pollingEnabled = false;
}
