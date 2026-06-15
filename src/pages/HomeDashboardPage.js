import { getCurrentHomeStatus } from '../api/eventApi.js';
import { mountServerConnectionFailurePopup } from './ServerConnectionFailurePopup.js';
import { createDashboardHomeScene } from '../three/dashboardHomeScene.js';
import { householdHeader } from '../components/householdHeader.js';
import { escapeHtml } from '../utils/html.js';
import { startRealtimePoll, isFreshTimestamp } from '../utils/realtimePoll.js';
import { createReactionSnapshot } from '../api/reactions.js';

let dashboardSceneController = null;
let dashboardSceneMediaCleanup = null;
let serverFailurePopupCleanup = null;
let realtimeStop = null;

const SERVICE_LABEL_KO = {
  robot_vacuum: '로봇청소기',
  washing_machine: '세탁기',
  dishwasher: '식기세척기',
  refrigerator: '냉장고',
  background: '배경음'
};

// currentNoiseState(백엔드) → 화면 표기. 알 수 없으면 '--'.
const NOISE_STATE_KO = {
  QUIET: { title: '안정', sub: '중요 이벤트 없음' },
  STABLE: { title: '안정', sub: '중요 이벤트 없음' },
  RECENT_NOISE_EVENT: { title: '최근 소음', sub: '최근 소음 이벤트 감지' },
  ONGOING_NOISE_EVENT: { title: '주의', sub: '소음 진행 중' }
};

// 숫자 지표: API 값이 없으면 하드코딩 대신 '--'.
function formatMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : '--';
}

function getSyncTime(status) {
  const source = status.lastSyncedAt ?? status.lastSyncAt ?? status.createdAt;
  if (!source) return '--:--';

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return '--:--';

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

// home-status에서 화면에 쓰는 파생 값들을 한 곳에서 계산한다(렌더/실시간 갱신 공용).
function deriveDashboard(status) {
  const roomClimate = status.roomClimate ?? {};
  const dbValue = Number(status.decibelMax ?? status.decibelAvg);
  // ESP가 비활성(최신 소음/측정값이 오래됨)이면 감지/소음 값을 --로.
  const noiseFresh = isFreshTimestamp(status.createdAt);
  return {
    temperature: formatMetric(status.temperature ?? status.dashboardTemperature ?? roomClimate.temperature),
    humidity: formatMetric(status.humidity ?? status.dashboardHumidity ?? roomClimate.humidity),
    syncTime: getSyncTime(status),
    soundSource: noiseFresh ? (SERVICE_LABEL_KO[status.currentServiceLabel] ?? '--') : '--',
    relativeDb: noiseFresh ? formatMetric(status.decibelMax ?? status.decibelAvg) : '--',
    noiseState: noiseFresh
      ? (NOISE_STATE_KO[status.currentNoiseState] ?? { title: '--', sub: '상태 정보 없음' })
      : { title: '안정', sub: '최근 소음 없음' },
    noiseProgress: noiseFresh && Number.isFinite(dbValue) ? Math.max(0, Math.min(100, Math.round(dbValue))) : 0
  };
}

// 실시간 폴링 시 씬을 재생성하지 않고 해당 DOM 노드의 숫자/텍스트만 갱신한다.
function updateDashboardDom(status) {
  if (!document.querySelector('.thinq-dashboard-page')) return;
  const d = deriveDashboard(status);
  const set = (sel, text) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  };
  set('[data-climate-temp]', `${d.temperature} °C`);
  set('[data-climate-humidity]', `${d.humidity}%`);
  set('[data-noise-title]', d.noiseState.title);
  set('[data-noise-sub]', d.noiseState.sub);
  const bar = document.querySelector('[data-noise-progress]');
  if (bar) bar.style.width = `${d.noiseProgress}%`;
}

export async function renderHomeDashboardPage() {
  let serverUnavailable = false;
  // 서버 연동 실패 시 더미(mock)를 보여주지 않고 빈 상태(→ 전부 '--')로 둔다.
  const status = await getCurrentHomeStatus().catch(() => {
    serverUnavailable = true;
    return {};
  });

  const { temperature, humidity, syncTime, noiseState, noiseProgress } = deriveDashboard(status);

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
          <div id="dashboard-home-scene" class="dashboard-home-scene" aria-label="집 내부 고정 상단 보기"></div>
          <p class="dashboard-sync">마지막 동기화: ${escapeHtml(syncTime)}</p>
        </button>

        <aside class="dashboard-summary-column" aria-label="홈 요약">
          <section class="dashboard-info-card dashboard-climate-card">
            <h2>실내 환경</h2>
            <strong data-climate-temp>${temperature} &deg;C</strong>
            <strong data-climate-humidity>${humidity}%</strong>
          </section>

          <section class="dashboard-info-card dashboard-noise-card">
            <h2>소음 상태</h2>
            <strong data-noise-title>${escapeHtml(noiseState.title)}</strong>
            <p data-noise-sub>${escapeHtml(noiseState.sub)}</p>
            <div class="dashboard-progress" aria-hidden="true">
              <span data-noise-progress style="width: ${noiseProgress}%"></span>
            </div>
          </section>

          <section class="dashboard-info-card dashboard-report-shortcut">
            <h2>일일 리포트</h2>
            <p>소음 요약과 반응을 확인하세요.</p>
            <a class="dashboard-report-button" href="#/reports">열기</a>
          </section>

          <button class="dashboard-info-card dashboard-reaction-card dashboard-reaction-card--positive" type="button" data-reaction="POSITIVE">
            <strong aria-hidden="true">
              <svg class="reaction-thumb" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21V9.8l4.4-6.6c1.2 0 2.1.9 1.9 2.1L12.5 9H18a2 2 0 0 1 2 2.3l-1.1 6.4A2.2 2.2 0 0 1 16.7 21z"/><path d="M7 9.8H4V21h3z"/></svg>
            </strong>
            <h2>좋아요</h2>
            <p data-reaction-status>피드백 저장</p>
          </button>

          <button class="dashboard-info-card dashboard-reaction-card dashboard-reaction-card--negative" type="button" data-reaction="NEGATIVE">
            <strong aria-hidden="true">
              <svg class="reaction-thumb" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3v11.2l-4.4 6.6c-1.2 0-2.1-.9-1.9-2.1l.8-3.7H6a2 2 0 0 1-2-2.3l1.1-6.4A2.2 2.2 0 0 1 7.3 3z"/><path d="M17 14.2h3V3h-3z"/></svg>
            </strong>
            <h2>불편해요</h2>
            <p data-reaction-status>피드백 저장</p>
          </button>

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
      lastSuccessfulSync: serverState.dataset.lastSync
    });
  }

  // ESP→Agent가 올리는 최신 home-status를 주기적으로 폴링해 소음/감지/환경 값을 실시간 갱신.
  realtimeStop = startRealtimePoll(async () => {
    const status = await getCurrentHomeStatus().catch(() => null);
    if (status) updateDashboardDom(status);
  });

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

  // 좋아요/불편해요: 누른 순간 측정 중인 모든 가전별 소음을 한 번에 기록(스냅샷).
  document.querySelectorAll('[data-reaction]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const reactionType = btn.dataset.reaction;
      const statusEl = btn.querySelector('[data-reaction-status]');
      const prev = statusEl?.textContent;
      btn.disabled = true;
      if (statusEl) statusEl.textContent = '기록 중...';
      try {
        const res = await createReactionSnapshot({ reactionType });
        const count = res?.count ?? 0;
        if (statusEl) statusEl.textContent = count > 0 ? `기록됨 (${count}건)` : '측정값 없음';
      } catch (error) {
        if (statusEl) statusEl.textContent = '기록 실패';
      } finally {
        window.setTimeout(() => {
          if (statusEl) statusEl.textContent = prev ?? '피드백 저장';
          btn.disabled = false;
        }, 2000);
      }
    });
  });
}

export function cleanupHomeDashboardPage() {
  realtimeStop?.();
  realtimeStop = null;
  serverFailurePopupCleanup?.();
  serverFailurePopupCleanup = null;
  dashboardSceneMediaCleanup?.();
  dashboardSceneMediaCleanup = null;
  dashboardSceneController?.dispose?.();
  dashboardSceneController = null;
}
