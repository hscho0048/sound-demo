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
  { name: '로봇청소기', room: '주방', decibel: 50 },
  { name: '세탁기', room: '세탁실', decibel: 73 },
  { name: '냉장고', room: '주방', decibel: 42 },
  { name: 'AI 홈 허브', room: '거실', decibel: 7 },
  { name: '로봇청소기 2', room: '거실', decibel: 38 },
  { name: '세탁기 2', room: '세탁실', decibel: 68 }
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
          <h2>
            <span class="three-title-desktop">3D View</span>
            <span class="three-title-mobile">공간 지도</span>
          </h2>
          <p class="three-view-mobile-source">소음원: 세탁실</p>
          <div id="three-home-container" class="three-view-container" aria-label="인터랙티브 3D 홈"></div>
        </section>

        <aside class="appliance-noise-panel" aria-label="기기별 소음 상태">
          ${applianceCards
            .map(
              (item) => `
                <section class="appliance-noise-card">
                  <h2>${item.name}</h2>
                  <p>${item.room}</p>
                  <div class="appliance-noise-card__body">
                    <div class="appliance-picture-slot has-device-icon" aria-label="${item.name} 이미지 자리">${getDeviceIcon(item.name)}</div>
                    <strong>${item.decibel} dB</strong>
                  </div>
                </section>
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
}

export function cleanupThreeDHomePage() {
  lowConfidencePopupCleanup?.();
  lowConfidencePopupCleanup = null;
  sceneController?.dispose?.();
  sceneController = null;
}
