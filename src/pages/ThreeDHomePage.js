import { createInteractiveHomeScene } from '../three/interactiveHomeScene.js';
import { mountLowConfidenceNoticePopup } from './LowConfidenceNoticePopup.js';

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
    <section class="page three-view-page" aria-label="3D Home View Screen">
      <header class="dashboard-household-header three-view-household-header">
        <h1 class="three-view-desktop-title">가구: 조 홈</h1>
        <div class="three-view-mobile-title">
          <h1>3D Home</h1>
          <p>서초 홈 · 세탁실 이벤트</p>
        </div>
      </header>
      <p class="three-view-active-pill"><span></span>활성 · 42 dB</p>

      <div class="three-view-content">
        <section class="three-view-stage" aria-label="3D home canvas">
          <h2>
            <span class="three-title-desktop">3D Home</span>
            <span class="three-title-mobile">공간 지도 · 활성 이벤트</span>
          </h2>
          <p class="three-view-mobile-source">소음 발생 위치: 세탁실</p>
          <div id="three-home-container" class="three-view-container" aria-label="Interactive 3D home"></div>
        </section>

        <aside class="appliance-noise-panel" aria-label="가전 소음 상태">
          ${applianceCards
            .map(
              (item) => `
                <section class="appliance-noise-card">
                  <h2>${item.name}</h2>
                  <p>${item.room}</p>
                  <div class="appliance-noise-card__body">
                    <div class="appliance-picture-slot" aria-label="${item.name} 이미지 영역"></div>
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
