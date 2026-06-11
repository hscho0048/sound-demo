import mockHomeStatus from '../data/mockHomeStatus.json';
import { getCurrentHomeStatus } from '../api/eventApi.js';
import { mountServerConnectionFailurePopup } from './ServerConnectionFailurePopup.js';
import { createDashboardHomeScene } from '../three/dashboardHomeScene.js';
import { householdHeader } from '../components/householdHeader.js';
import { escapeHtml } from '../utils/html.js';

let dashboardSceneController = null;
let dashboardSceneMediaCleanup = null;
let serverFailurePopupCleanup = null;

function formatMetric(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function getSyncTime(status) {
  const source = status.lastSyncedAt ?? status.lastSyncAt;
  if (!source) return '12:30';

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return '12:30';

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

export async function renderHomeDashboardPage() {
  let serverUnavailable = false;
  const status = await getCurrentHomeStatus().catch(() => {
    serverUnavailable = true;
    return mockHomeStatus;
  });

  const roomClimate = status.roomClimate ?? {};
  const temperature = formatMetric(status.dashboardTemperature ?? roomClimate.temperature, 23);
  const humidity = formatMetric(status.dashboardHumidity ?? roomClimate.humidity, 48);
  const syncTime = getSyncTime(status);

  return `
    <section class="page thinq-dashboard-page" aria-label="메인 대시보드">
      ${householdHeader({
        status: `마지막 동기화: ${syncTime}`,
        extraHtml: `
          <div
            id="dashboard-server-state"
            class="hidden"
            data-server-unavailable="${serverUnavailable ? 'true' : 'false'}"
            data-last-sync="${escapeHtml(syncTime)}"
          ></div>
        `
      })}

      <div class="dashboard-main-grid">
        <button class="dashboard-home-card" data-dashboard-home-link type="button" aria-label="3D 홈 보기 열기">
          <h2>Home</h2>
          <div id="dashboard-home-scene" class="dashboard-home-scene" aria-label="집 내부 고정 상단 보기"></div>
          <p class="dashboard-sync">마지막 동기화: ${escapeHtml(syncTime)}</p>
        </button>

        <aside class="dashboard-summary-column" aria-label="홈 요약">
          <section class="dashboard-info-card dashboard-climate-card">
            <h2>실내 환경</h2>
            <strong>${temperature} &deg;C</strong>
            <strong>${humidity}%</strong>
          </section>

          <section class="dashboard-info-card dashboard-noise-card">
            <h2>소음 상태</h2>
            <strong>안정</strong>
            <p>중요 이벤트 없음</p>
            <div class="dashboard-progress" aria-hidden="true">
              <span style="width: 76%"></span>
            </div>
          </section>

          <section class="dashboard-info-card dashboard-report-shortcut">
            <h2>일일 리포트</h2>
            <p>소음 요약과 반응을 확인하세요.</p>
            <a class="dashboard-report-button" href="#/reports">열기</a>
          </section>

          <button class="dashboard-info-card dashboard-reaction-card dashboard-reaction-card--positive" type="button">
            <strong aria-hidden="true">+</strong>
            <h2>좋아요</h2>
            <p>피드백 저장</p>
          </button>

          <button class="dashboard-info-card dashboard-reaction-card dashboard-reaction-card--negative" type="button">
            <strong aria-hidden="true">-</strong>
            <h2>불편해요</h2>
            <p>피드백 저장</p>
          </button>

          <section class="dashboard-info-card dashboard-detection-card">
            <h2>감지된 소리</h2>
            <p>소음원</p>
            <strong>로봇청소기</strong>
            <p>상대 소음 <b>62 dB</b></p>
          </section>
        </aside>
      </div>
    </section>
  `;
}

export function mountHomeDashboardPage({ navigate } = {}) {
  cleanupHomeDashboardPage();

  const serverState = document.querySelector('#dashboard-server-state');
  if (serverState?.dataset.serverUnavailable === 'true') {
    const popupController = mountServerConnectionFailurePopup({ navigate });
    serverFailurePopupCleanup = popupController.cleanup;
    popupController.openPopup({
      lastSuccessfulSync: serverState.dataset.lastSync,
      retryQueueCount: 5
    });
  }

  const container = document.querySelector('#dashboard-home-scene');
  if (!container) return;

  const syncDashboardScene = (isMobile) => {
    if (isMobile) {
      dashboardSceneController?.dispose?.();
      dashboardSceneController = null;
      container.classList.remove('is-loading');
      return;
    }

    if (!dashboardSceneController) {
      dashboardSceneController = createDashboardHomeScene(container);
    }
  };

  const mediaQuery = window.matchMedia?.('(max-width: 640px)');
  if (mediaQuery) {
    const handleMediaChange = (event) => syncDashboardScene(event.matches);
    syncDashboardScene(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
      dashboardSceneMediaCleanup = () => mediaQuery.removeEventListener('change', handleMediaChange);
    } else {
      mediaQuery.addListener(handleMediaChange);
      dashboardSceneMediaCleanup = () => mediaQuery.removeListener(handleMediaChange);
    }
  } else {
    syncDashboardScene(false);
  }

  const homeLink = document.querySelector('[data-dashboard-home-link]');
  homeLink?.addEventListener('click', () => {
    navigate('#/three-home');
  });
}

export function cleanupHomeDashboardPage() {
  serverFailurePopupCleanup?.();
  serverFailurePopupCleanup = null;
  dashboardSceneMediaCleanup?.();
  dashboardSceneMediaCleanup = null;
  dashboardSceneController?.dispose?.();
  dashboardSceneController = null;
}
