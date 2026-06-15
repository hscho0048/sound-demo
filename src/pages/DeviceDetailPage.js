import { createDeviceDetailModelScene } from '../three/deviceDetailModelScene.js';
import { escapeHtml } from '../utils/html.js';
import {
  getSensitiveApplianceEnabled,
  setSensitiveApplianceEnabled
} from '../utils/sensitiveApplianceState.js';
import { getCurrentHomeStatus, getNoiseEvents } from '../api/eventApi.js';
import { getApplianceMeasurements } from '../api/applianceMeasurementApi.js';
import { getRuntimeSettings, deleteUserDevice } from '../api/deviceApi.js';
import { removeCustomDevice, isCustomDevice } from '../utils/customDevicesState.js';

let modelSceneController = null;

const WARNING_DECIBEL_THRESHOLD = 70;

const SERVICE_LABEL_KO = {
  robot_vacuum: '로봇청소기',
  washing_machine: '세탁기',
  dishwasher: '식기세척기',
  refrigerator: '냉장고',
  background: '배경음'
};

const SERVICE_LABEL_MODEL = {
  robot_vacuum: 'robot',
  washing_machine: 'washer',
  dishwasher: 'dishwasher',
  refrigerator: 'refrigerator'
};

const RECOMMENDATION = {
  robot_vacuum: '22시 이후에는 청소 예약을 피하고, 반복 소음이 감지되면 청소 시작 시간을 늦춰 보세요.',
  washing_machine: '야간에는 탈수 시간을 피하고, 반복 소음이 감지되면 세탁 예약 시간을 조정해 보세요.',
  dishwasher: '식사 직후 사용은 유지하되, 야간에는 예약 시작 시간을 앞당기면 소음 부담을 줄일 수 있습니다.',
  refrigerator: '냉장고는 경고·공지 대상입니다. 측정값이 계속 비어 있으면 연결 상태를 확인해 주세요.'
};

function formatTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getDeviceStatus(noiseLabel) {
  const decibel = Number.parseFloat(noiseLabel);
  if (!Number.isFinite(decibel)) return '연결 필요';
  if (decibel >= WARNING_DECIBEL_THRESHOLD) return '주의';
  return '안정';
}

function getDeviceStatusClass(status) {
  if (status === '주의') return 'measurement-status--warning';
  if (status === '연결 필요') return 'measurement-status--connection';
  return 'measurement-status--stable';
}

// 백엔드(DB)에서 기기 상세 데이터를 조립한다. 하드코딩 더미는 제거되었다.
async function loadDeviceDetail(deviceId) {
  const home = await getCurrentHomeStatus();
  const devices = home?.registeredDevices ?? [];
  const device = devices.find((d) => (d.registeredDeviceId ?? d.id) === deviceId) ?? null;
  // serviceLabel 매핑은 settings/runtime에서 (home-status에는 userRegisteredDeviceId가 없음)
  let runtime = null;
  try {
    runtime = await getRuntimeSettings();
  } catch (error) {
    runtime = null;
  }
  const label = (runtime?.sensitiveAppliances ?? []).find(
    (s) => s.userRegisteredDeviceId === deviceId
  )?.serviceLabel;

  const title = (label && SERVICE_LABEL_KO[label]) || device?.name || '기기';
  const modelType = (label && SERVICE_LABEL_MODEL[label]) || 'washer';

  let measurements = [];
  let noiseItems = [];
  if (label) {
    try {
      measurements = (await getApplianceMeasurements({ serviceLabel: label, limit: 10 })) ?? [];
    } catch (error) {
      measurements = [];
    }
    try {
      const ne = await getNoiseEvents({ serviceLabel: label, size: 5 });
      noiseItems = Array.isArray(ne) ? ne : ne?.items ?? [];
    } catch (error) {
      noiseItems = [];
    }
  }

  const latest = measurements[0] ?? null;
  const latestDb = latest ? Number(latest.decibelMax ?? latest.decibelAvg ?? latest.relativeDb) : null;
  const noiseLabel = latestDb != null && Number.isFinite(latestDb) ? `${Math.round(latestDb)} dB` : '측정 대기';

  const events = [];
  for (const n of noiseItems.slice(0, 4)) {
    const db = n.decibelMax ?? n.decibelAvg;
    events.push(`${formatTime(n.createdAt)} 소음 감지${db != null ? ` - ${Math.round(Number(db))} dB` : ''}`);
  }
  if (latest) {
    events.push(`${formatTime(latest.measuredAt ?? latest.createdAt)} 측정값 업로드 (${latest.measurementSource ?? 'ESP32_INMP441'})`);
  }
  if (!events.length) {
    events.push('아직 수집된 측정/소음 이벤트가 없습니다.');
  }

  return {
    title,
    modelType,
    modelLabel: title,
    serviceLabel: label ?? '미지정',
    noiseLabel,
    roomName: device?.roomName ?? '방 미지정',
    events,
    recommendation: (label && RECOMMENDATION[label]) || '현재 소음 데이터를 기준으로 권장 사항을 제공합니다.'
  };
}

export async function renderDeviceDetailPage({ params }) {
  const deviceId = decodeURIComponent(params.deviceId ?? '');

  let detail;
  try {
    detail = await loadDeviceDetail(deviceId);
  } catch (error) {
    console.warn('[SoundCare] 기기 상세 로드 실패', error);
    return `
      <section class="page device-detail-page" aria-label="기기 상세 화면">
        <header class="device-detail-topbar">
          <div class="device-detail-title-group">
            <a class="device-detail-back" href="#/devices" aria-label="기기 목록으로 돌아가기"><svg class="back-arrow-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></a>
            <h1>기기 상세를 불러올 수 없습니다</h1>
          </div>
        </header>
        <p class="device-list-empty">잠시 후 다시 시도해 주세요.</p>
      </section>
    `;
  }

  const status = getDeviceStatus(detail.noiseLabel);
  const statusClass = getDeviceStatusClass(status);
  const sensitiveManaged = getSensitiveApplianceEnabled(deviceId);

  return `
    <section class="page device-detail-page" aria-label="기기 상세 화면">
      <header class="device-detail-topbar">
        <div class="device-detail-title-group">
          <a class="device-detail-back" href="#/devices" aria-label="기기 목록으로 돌아가기"><svg class="back-arrow-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></a>
          <p>기기 &gt; ${escapeHtml(detail.title)} (${escapeHtml(detail.roomName)})</p>
          <h1>${escapeHtml(detail.title)}</h1>
        </div>
        <button type="button" class="device-delete-icon" data-device-delete data-device-id="${escapeHtml(deviceId)}" aria-label="기기 삭제" title="기기 삭제">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </header>

      <div class="device-detail-layout">
        <section class="device-detail-card device-detail-model-card">
          <h2>기기</h2>
          <div
            id="device-detail-model-viewer"
            class="device-detail-model-viewer"
            data-model-type="${escapeHtml(detail.modelType)}"
            aria-label="${escapeHtml(detail.title)} 3D 모델"
          ></div>
        </section>

        <section class="device-detail-card device-measurement-card">
          <h2>현재 측정값</h2>
          <div class="measurement-summary">
            <div>
              <p>소음</p>
              <strong>${escapeHtml(detail.noiseLabel)}</strong>
              <span>실시간 감지</span>
            </div>
            <dl>
              <div><dt>모델</dt><dd>${escapeHtml(detail.modelLabel)}</dd></div>
              <div><dt>서비스</dt><dd>${escapeHtml(detail.serviceLabel)}</dd></div>
              <div class="measurement-status ${escapeHtml(statusClass)}"><dt>상태</dt><dd>${escapeHtml(status)}</dd></div>
            </dl>
          </div>

          <ul class="measurement-event-list" aria-label="최근 측정 이벤트">
            ${detail.events.map((event) => `<li><span></span><p>${escapeHtml(event)}</p></li>`).join('')}
          </ul>
        </section>

        <section class="device-detail-card device-recommendation-card">
          <h2>추천</h2>
          <p>${escapeHtml(detail.recommendation)}</p>
          <button type="button">규칙 적용</button>
        </section>

        <section class="device-detail-card device-sensitive-card">
          <div class="device-sensitive-card__copy">
            <h2>민감 가전 관리</h2>
            <p>이 기기를 민감 관리 대상으로 지정하면<br>목록 카드에 관리 상태가 표시되며, 저소음 기반 작동이 시작됩니다.</p>
          </div>
          <button
            class="device-sensitive-toggle ${sensitiveManaged ? 'is-on' : ''}"
            type="button"
            role="switch"
            aria-checked="${sensitiveManaged ? 'true' : 'false'}"
            data-sensitive-toggle
            data-device-id="${escapeHtml(deviceId)}"
          >
            <span class="device-sensitive-toggle__track" aria-hidden="true">
              <span></span>
            </span>
            <span class="device-sensitive-toggle__label">${sensitiveManaged ? 'ON' : 'OFF'}</span>
          </button>
        </section>
      </div>
    </section>
  `;
}

export function mountDeviceDetailPage({ navigate } = {}) {
  cleanupDeviceDetailPage();
  const viewer = document.querySelector('#device-detail-model-viewer');
  if (viewer) {
    modelSceneController = createDeviceDetailModelScene(viewer, {
      modelType: viewer.dataset.modelType || 'washer'
    });
  }

  const toggle = document.querySelector('[data-sensitive-toggle]');
  toggle?.addEventListener('click', () => {
    const enabled = !toggle.classList.contains('is-on');
    setSensitiveApplianceEnabled(toggle.dataset.deviceId, enabled);
    toggle.classList.toggle('is-on', enabled);
    toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');

    const label = toggle.querySelector('.device-sensitive-toggle__label');
    if (label) label.textContent = enabled ? 'ON' : 'OFF';
  });

  const deleteBtn = document.querySelector('[data-device-delete]');
  deleteBtn?.addEventListener('click', async () => {
    const id = deleteBtn.dataset.deviceId;
    if (!window.confirm('이 기기를 삭제할까요? 되돌릴 수 없습니다.')) return;
    deleteBtn.disabled = true;
    try {
      if (isCustomDevice(id)) {
        removeCustomDevice(id);
      } else {
        await deleteUserDevice(id);
      }
      navigate?.('#/devices');
    } catch (error) {
      deleteBtn.disabled = false;
      window.alert(`기기 삭제 실패: ${error.message}`);
    }
  });
}

export function cleanupDeviceDetailPage() {
  modelSceneController?.dispose?.();
  modelSceneController = null;
}
