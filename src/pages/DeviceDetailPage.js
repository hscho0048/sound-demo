import { createDeviceDetailModelScene } from '../three/deviceDetailModelScene.js';
import { escapeHtml } from '../utils/html.js';

let modelSceneController = null;

const WARNING_DECIBEL_THRESHOLD = 70;

const deviceDetails = {
  'washer-main': {
    title: '세탁기',
    modelType: 'washer',
    modelLabel: '세탁기',
    serviceLabel: '탈수',
    noiseLabel: '71 dB',
    events: ['12:30 세탁 소음 감지 - 71 dB', '12:18 탈수 구간 진입', '12:05 주의 반응 기록', '11:42 측정 데이터 업로드 완료'],
    recommendation: '야간에는 탈수 시간을 피하고, 반복 소음이 감지되면 세탁 예약 시간을 조정해 보세요.'
  },
  'robot-living': {
    title: '로봇청소기',
    modelType: 'robot',
    modelLabel: '로봇청소기',
    serviceLabel: '미세먼지 흡입',
    noiseLabel: '71 dB',
    events: ['12:30 청소 소음 감지 - 71 dB', '12:18 거실 이동 감지', '12:05 긍정 반응 기록', '11:42 측정 데이터 업로드 완료'],
    recommendation: '22시 이후에는 청소 예약을 피하고, 반복 소음이 감지되면 청소 시작 시간을 늦춰 보세요.'
  },
  'washer-laundry-2': {
    title: '냉장고',
    modelType: 'refrigerator',
    modelLabel: '냉장고',
    serviceLabel: '저소음 모드',
    noiseLabel: '측정 대기',
    events: ['11:30 연결 상태 확인 필요', '11:18 냉장고 상태 조회 실패', '11:05 측정값 없음', '10:52 마지막 연결 기록 확인'],
    recommendation: '냉장고 연결 상태를 확인하고, 측정값이 계속 비어 있으면 기기를 다시 연결해 주세요.'
  },
  'washer-laundry-3': {
    title: '에어컨',
    modelType: 'washer',
    modelLabel: '에어컨',
    serviceLabel: '파워 냉방',
    noiseLabel: '71 dB',
    events: ['12:30 에어컨 작동 소음 감지 - 71 dB', '12:18 침실 소음 상승', '12:05 주의 반응 기록', '11:42 측정 데이터 업로드 완료'],
    recommendation: '취침 시간에는 풍량을 낮추고, 반복 소음이 감지되면 저소음 모드로 전환해 보세요.'
  },
  'robot-kitchen-2': {
    title: '식기세척기',
    modelType: 'dishwasher',
    modelLabel: '식기세척기',
    serviceLabel: '저소음 모드',
    noiseLabel: '64 dB',
    events: ['12:10 식기세척기 소음 감지 - 64 dB', '12:02 주방 작동 이벤트 기록', '11:55 안정 상태 유지', '11:40 측정 데이터 업로드 완료'],
    recommendation: '식사 직후 사용은 유지하되, 야간에는 예약 시작 시간을 앞당기면 소음 부담을 줄일 수 있습니다.'
  },
  'hub-study-1': {
    title: 'LG 허브',
    modelType: 'robot',
    modelLabel: 'LG 허브',
    serviceLabel: 'LG 허브',
    noiseLabel: '19 dB',
    events: ['11:52 허브 상태 감지 - 19 dB', '11:40 작업실 연결 안정', '11:25 안정 상태 유지', '11:10 측정 데이터 업로드 완료'],
    recommendation: '현재 소음은 안정적입니다. 연결 상태만 주기적으로 확인하면 됩니다.'
  }
};

function getDetailConfig(deviceId) {
  if (deviceDetails[deviceId]) return deviceDetails[deviceId];
  if (deviceId?.includes('robot')) return deviceDetails['robot-living'];
  if (deviceId?.includes('fridge') || deviceId?.includes('refrigerator')) return deviceDetails['washer-laundry-2'];
  if (deviceId?.includes('dish')) return deviceDetails['robot-kitchen-2'];
  return deviceDetails['washer-main'];
}

function getDeviceStatus(detail) {
  const decibel = Number.parseFloat(detail.noiseLabel);
  if (!Number.isFinite(decibel)) return '연결 필요';
  if (decibel >= WARNING_DECIBEL_THRESHOLD) return '주의';
  return '안정';
}

function getDeviceStatusClass(status) {
  if (status === '주의') return 'measurement-status--warning';
  if (status === '연결 필요') return 'measurement-status--connection';
  return 'measurement-status--stable';
}

export async function renderDeviceDetailPage({ params }) {
  const deviceId = decodeURIComponent(params.deviceId ?? '');
  const detail = getDetailConfig(deviceId);
  const status = getDeviceStatus(detail);
  const statusClass = getDeviceStatusClass(status);

  return `
    <section class="page device-detail-page" aria-label="기기 상세 화면">
      <header class="device-detail-topbar">
        <div class="device-detail-title-group">
          <a class="device-detail-back" href="#/devices" aria-label="기기 목록으로 돌아가기"><svg class="back-arrow-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></a>
          <p>기기 &gt; ${escapeHtml(detail.title)}</p>
          <h1>${escapeHtml(detail.title)}</h1>
        </div>
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
