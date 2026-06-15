import { createInteractiveHomeScene } from '../three/interactiveHomeScene.js';
import { householdHeader } from '../components/householdHeader.js';
import { mountLowConfidenceNoticePopup } from './LowConfidenceNoticePopup.js';
import { getDeviceIcon } from '../utils/deviceIcons.js';
import { getCurrentHomeStatus } from '../api/eventApi.js';
import { getApplianceMeasurements } from '../api/applianceMeasurementApi.js';
import { getRuntimeSettings } from '../api/deviceApi.js';

let sceneController = null;
let lowConfidencePopupCleanup = null;

const LOW_CONFIDENCE_POPUP_THRESHOLD = 0.6;

const SERVICE_LABEL_KO = {
  robot_vacuum: '로봇청소기',
  washing_machine: '세탁기',
  dishwasher: '식기세척기',
  refrigerator: '냉장고',
  background: '배경음'
};

// 백엔드(DB)에서 채워지는 활성 예측/기기 카드. 하드코딩 더미는 제거되었다.
let activePrediction = { modelLabel: 'background', confidence: 1, thresholdValue: 0.7 };
let applianceCards = [];
let activeDb = 0;
let activeRoom = '방 미지정';

async function loadThreeDHomeData() {
  let home = null;
  try {
    home = await getCurrentHomeStatus();
  } catch (error) {
    console.warn('[SoundCare] 3D 홈 데이터 로드 실패', error);
  }

  activePrediction = {
    modelLabel: home?.currentServiceLabel ?? 'background',
    confidence: Number(home?.confidence ?? 1),
    thresholdValue: 0.7
  };
  activeDb = Math.round(Number(home?.decibelMax ?? home?.decibelAvg ?? 0)) || 0;
  activeRoom = home?.roomName ?? '방 미지정';

  const devices = home?.registeredDevices ?? [];
  let runtime = null;
  try {
    runtime = await getRuntimeSettings();
  } catch (error) {
    runtime = null;
  }
  const labelByDevice = new Map(
    (runtime?.sensitiveAppliances ?? []).map((s) => [s.userRegisteredDeviceId, s.serviceLabel])
  );

  let measurements = [];
  try {
    measurements = (await getApplianceMeasurements({ limit: 100 })) ?? [];
  } catch (error) {
    measurements = [];
  }
  const latestByLabel = new Map();
  for (const m of measurements) {
    const label = m.serviceLabel ?? m.applianceType;
    if (label && !latestByLabel.has(label)) latestByLabel.set(label, m);
  }

  applianceCards = devices.map((device) => {
    const id = device.registeredDeviceId ?? device.id;
    const label = labelByDevice.get(id);
    const measurement = label ? latestByLabel.get(label) : null;
    const db = measurement
      ? Math.round(Number(measurement.decibelMax ?? measurement.decibelAvg ?? measurement.relativeDb))
      : null;
    return {
      name: (label && SERVICE_LABEL_KO[label]) || device.name || '기기',
      room: device.roomName ?? '방 미지정',
      decibel: db != null && Number.isFinite(db) ? db : '--',
      deviceId: id
    };
  });
}

export async function renderThreeDHomePage() {
  await loadThreeDHomeData();
  const cardsHtml = applianceCards.length
    ? applianceCards
        .map(
          (item) => `
                <a class="appliance-noise-card" href="#/devices/${encodeURIComponent(item.deviceId)}" aria-label="${item.name} 상세 보기">
                  <h2>${item.name}</h2>
                  <p>${item.room}</p>
                  <div class="appliance-noise-card__body">
                    <div class="appliance-picture-slot has-device-icon" aria-label="${item.name} 이미지 자리">${getDeviceIcon(item.name)}</div>
                    <strong>${item.decibel} dB</strong>
                  </div>
                </a>
              `
        )
        .join('')
    : '<p class="device-list-empty">등록된 기기가 없습니다.</p>';

  return `
    <section class="page three-view-page" aria-label="3D 홈 보기">
      ${householdHeader({
        headerClass: 'three-view-household-header',
        status: `활성 · ${activeDb} dB`
      })}
      <p class="three-view-active-pill"><span></span>활성 ${activeDb} dB</p>

      <div class="three-view-content">
        <section class="three-view-stage" aria-label="3D 홈 캔버스">
          <div class="three-view-stage-header">
            <h2>
              <span class="three-title-desktop">3D View</span>
              <span class="three-title-mobile">공간 지도</span>
            </h2>
            <button
              type="button"
              id="sound-viz-toggle"
              class="sound-viz-toggle is-on"
              aria-pressed="true"
              aria-label="소리 시각화 끄기"
            >
              <span class="sound-viz-toggle__dot" aria-hidden="true"></span>
              <span class="sound-viz-toggle__label">소리 시각화 켜짐</span>
            </button>
          </div>
          <p class="three-view-mobile-source">소음원: ${activeRoom}</p>
          <div id="three-home-container" class="three-view-container" aria-label="인터랙티브 3D 홈"></div>
        </section>

        <aside class="appliance-noise-panel" aria-label="기기별 소음 상태">
          ${cardsHtml}
        </aside>
      </div>
    </section>
  `;
}

export function mountThreeDHomePage() {
  cleanupThreeDHomePage();

  if (activePrediction.confidence < LOW_CONFIDENCE_POPUP_THRESHOLD) {
    const popupController = mountLowConfidenceNoticePopup();
    lowConfidencePopupCleanup = popupController.cleanup;
    popupController.openPopup(activePrediction);
  }

  const container = document.querySelector('#three-home-container');
  if (!container) return;

  sceneController = createInteractiveHomeScene(container);

  const vizToggle = document.querySelector('#sound-viz-toggle');
  if (vizToggle) {
    let soundVizOn = true;
    vizToggle.addEventListener('click', () => {
      soundVizOn = !soundVizOn;
      sceneController?.setSoundVisualization?.(soundVizOn);
      vizToggle.classList.toggle('is-on', soundVizOn);
      vizToggle.setAttribute('aria-pressed', soundVizOn ? 'true' : 'false');
      vizToggle.setAttribute('aria-label', soundVizOn ? '소리 시각화 끄기' : '소리 시각화 켜기');
      vizToggle.querySelector('.sound-viz-toggle__label').textContent = soundVizOn
        ? '소리 시각화 켜짐'
        : '소리 시각화 꺼짐';
    });
  }
}

export function cleanupThreeDHomePage() {
  lowConfidencePopupCleanup?.();
  lowConfidencePopupCleanup = null;
  sceneController?.dispose?.();
  sceneController = null;
}
