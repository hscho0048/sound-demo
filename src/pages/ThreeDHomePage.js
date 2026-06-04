import mockHomeStatus from '../data/mockHomeStatus.json';
import { getCurrentHomeStatus } from '../api/eventApi.js';
import { getDeviceAgents } from '../api/deviceAgentApi.js';
import { getLatestApplianceMeasurement, isTelemetryStale } from '../api/applianceMeasurementApi.js';
import { createSoundCareScene } from '../three/scene.js';
import { escapeHtml } from '../utils/html.js';

let sceneController = null;

export async function renderThreeDHomePage() {
  const status = await getCurrentHomeStatus().catch(() => mockHomeStatus);
  const exceptionState = status.currentServiceLabel === 'robot_vacuum' && (!status.roomId || status.confidence < 0.6);
  return `
    <section class="page three-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">3D Home View</p>
          <h1>3D 홈 시뮬레이션</h1>
          <p>로봇청소기 GLB 경로 변경은 MVP 프론트엔드 시뮬레이션입니다. 실제 로봇청소기를 제어하지 않습니다.</p>
        </div>
        <div class="button-row">
          <button id="simulate-robot-event">로봇청소기 회피 이벤트</button>
          <button id="simulate-low-confidence" class="secondary">예외 상태 보기</button>
        </div>
      </div>
      ${exceptionState ? '<div class="warning-box">신뢰도가 낮거나 room_id가 없어 경로 변경을 보류했습니다.</div>' : ''}
      <div class="three-layout">
        <div id="three-home-container" class="three-container" aria-label="3D 홈 시뮬레이션 캔버스"></div>
        <aside class="three-side-panel">
          <h2>현재 이벤트</h2>
          <dl>
            <div><dt>서비스 라벨</dt><dd>${escapeHtml(status.currentServiceLabel)}</dd></div>
            <div><dt>방</dt><dd>${escapeHtml(status.roomName ?? '미지정')}</dd></div>
            <div><dt>dB Max</dt><dd>${escapeHtml(status.decibelMax)} dB</dd></div>
            <div><dt>신뢰도</dt><dd>${escapeHtml(Math.round(status.confidence * 100))}%</dd></div>
          </dl>
          <p id="three-status-message">3D 장면 준비 중...</p>
        </aside>
      </div>
    </section>
  `;
}

export async function mountThreeDHomePage() {
  const container = document.querySelector('#three-home-container');
  const statusMessage = document.querySelector('#three-status-message');
  const status = await getCurrentHomeStatus().catch(() => mockHomeStatus);
  if (!container) return;

  sceneController?.dispose?.();
  sceneController = createSoundCareScene(container, { homeStatus: status });
  statusMessage.textContent = '3D 홈 화면이 준비되었습니다.';

  // 로봇청소기 텔레메트리를 소음 파동 강도와 dB 라벨에 반영한다.
  const [agents, telemetry] = await Promise.all([
    getDeviceAgents().catch(() => []),
    getLatestApplianceMeasurement({ serviceLabel: 'robot_vacuum' }).catch(() => null)
  ]);
  const agentOnline = (agents?.[0]?.online ?? false) === true;
  const stale = isTelemetryStale(telemetry);
  sceneController.applyTelemetry(telemetry, { agentOnline, stale });
  if (!agentOnline) {
    statusMessage.textContent = 'Appliance Controller Agent 오프라인: 하드웨어 컨트롤러 사용 불가 상태입니다.';
  } else if (stale || !telemetry) {
    statusMessage.textContent = '최신 텔레메트리가 없거나 오래되어 stale 상태로 표시합니다.';
  }

  document.querySelector('#simulate-robot-event')?.addEventListener('click', () => {
    const event = { ...mockHomeStatus.robotAvoidanceEvent, confidence: 0.91, roomId: 'room-living' };
    sceneController.applyRobotAvoidanceEvent(event);
    statusMessage.textContent = '거실 회피 구역과 우회 경로를 적용했습니다.';
  });

  document.querySelector('#simulate-low-confidence')?.addEventListener('click', () => {
    sceneController.showExceptionState({ reason: '신뢰도 0.42, room_id 누락' });
    statusMessage.textContent = '신뢰도가 낮거나 방 정보가 없어 자동 경로 변경을 보류했습니다.';
  });
}

export function cleanupThreeDHomePage() {
  sceneController?.dispose?.();
  sceneController = null;
}
