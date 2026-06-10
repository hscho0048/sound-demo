import { createDeviceDetailModelScene } from '../three/deviceDetailModelScene.js';
import { escapeHtml } from '../utils/html.js';

let modelSceneController = null;

const deviceDetails = {
  'robot-living': {
    title: '로봇청소기',
    modelType: 'robot',
    modelLabel: 'vacuum_cleaner',
    serviceLabel: 'robot_vacuum'
  },
  refrigerator: {
    title: '냉장고',
    modelType: 'refrigerator',
    modelLabel: 'refrigerator',
    serviceLabel: 'refrigerator'
  }
};

function getDetailConfig(deviceId) {
  if (deviceId?.includes('robot')) return deviceDetails['robot-living'];
  if (deviceId?.includes('fridge') || deviceId?.includes('refrigerator')) return deviceDetails.refrigerator;
  return {
    title: '세탁기',
    modelType: 'washer',
    modelLabel: 'vacuum_cleaner',
    serviceLabel: 'robot_vacuum'
  };
}

export async function renderDeviceDetailPage({ params }) {
  const deviceId = decodeURIComponent(params.deviceId ?? '');
  const detail = getDetailConfig(deviceId);

  return `
    <section class="page device-detail-page" aria-label="기기 상세 화면">
      <header class="device-detail-topbar">
        <div class="device-detail-title-group">
          <a class="device-detail-back" href="#/devices" aria-label="기기 목록으로 돌아가기">&lsaquo;</a>
          <p>기기 &gt; ${escapeHtml(detail.title)}</p>
          <h1>${escapeHtml(detail.title)}</h1>
        </div>
        <button class="related-events-button" type="button">관련 이벤트 보기</button>
      </header>

      <div class="device-detail-layout">
        <section class="device-detail-card device-detail-model-card">
          <h2>기기 정보</h2>
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
              <p>상대 소음</p>
              <strong>62 dB</strong>
              <span>실시간 감지 기준</span>
            </div>
            <dl>
              <div><dt>모델 라벨</dt><dd>${escapeHtml(detail.modelLabel)}</dd></div>
              <div><dt>서비스 라벨</dt><dd>${escapeHtml(detail.serviceLabel)}</dd></div>
              <div><dt>신뢰도</dt><dd>0.86</dd></div>
            </dl>
          </div>

          <ul class="measurement-event-list" aria-label="최근 측정 이벤트">
            <li><span></span><p>12:30 이벤트 ID 238 · 62 dB</p></li>
            <li><span></span><p>12:18 모델 라벨 vacuum_cleaner</p></li>
            <li><span></span><p>12:05 반응 상태 positive</p></li>
            <li><span></span><p>11:42 업로드 상태 완료</p></li>
          </ul>
        </section>

        <section class="device-detail-card device-recommendation-card">
          <h2>규칙 기반 추천</h2>
          <p>
            추천 루틴:<br>
            오후 10시 이후에 진공청소기 이벤트가 반복되면 스피커 볼륨을 낮추고 청소 루틴 시작을 지연하세요.
          </p>
          <button type="button">규칙 기반만 보기</button>
        </section>
      </div>
    </section>
  `;
}

export function mountDeviceDetailPage() {
  const viewer = document.querySelector('#device-detail-model-viewer');
  if (!viewer) return;

  cleanupDeviceDetailPage();
  modelSceneController = createDeviceDetailModelScene(viewer, {
    modelType: viewer.dataset.modelType || 'washer'
  });
}

export function cleanupDeviceDetailPage() {
  modelSceneController?.dispose?.();
  modelSceneController = null;
}
