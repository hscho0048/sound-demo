import { createInteractiveHomeScene } from '../three/interactiveHomeScene.js';
import { householdHeader } from '../components/householdHeader.js';
import { mountLowConfidenceNoticePopup } from './LowConfidenceNoticePopup.js';
import { getDeviceIcon } from '../utils/deviceIcons.js';

let sceneController = null;
let lowConfidencePopupCleanup = null;

const LOW_CONFIDENCE_POPUP_THRESHOLD = 0.6;
const activePrediction = {
  modelLabel: 'vacuum_cleaner',
  confidence: 0.42,
  thresholdValue: 0.7
};

const applianceCards = [
  { name: '로봇청소기', room: '주방', decibel: 50, deviceId: 'robot-living' },
  { name: '세탁기', room: '세탁실', decibel: 73, deviceId: 'washer-main' },
  { name: '냉장고', room: '주방', decibel: 42, deviceId: 'washer-laundry-2' },
  { name: 'AI 홈 허브', room: '거실', decibel: 7, deviceId: 'hub-study-1' },
  { name: '로봇청소기 2', room: '거실', decibel: 38, deviceId: 'robot-living' },
  { name: '세탁기 2', room: '세탁실', decibel: 68, deviceId: 'washer-main' }
];

export async function renderThreeDHomePage() {
  return `
    <section class="page three-view-page" aria-label="3D 홈 보기">
      ${householdHeader({
        headerClass: 'three-view-household-header',
        status: '활성 · 42 dB'
      })}
      <p class="three-view-active-pill"><span></span>활성 42 dB</p>

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
          <p class="three-view-mobile-source">소음원: 세탁실</p>
          <div id="three-home-container" class="three-view-container" aria-label="인터랙티브 3D 홈"></div>
        </section>

        <aside class="appliance-noise-panel" aria-label="기기별 소음 상태">
          ${applianceCards
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
            .join('')}
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
