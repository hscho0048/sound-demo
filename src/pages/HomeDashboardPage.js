import mockHomeStatus from '../data/mockHomeStatus.json';
import { getCurrentHomeStatus } from '../api/eventApi.js';
import { createDashboardHomeScene } from '../three/dashboardHomeScene.js';
import { escapeHtml } from '../utils/html.js';

let dashboardSceneController = null;
let dashboardSceneMediaCleanup = null;

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
  const status = await getCurrentHomeStatus().catch(() => mockHomeStatus);

  const roomClimate = status.roomClimate ?? {};
  const temperature = formatMetric(status.dashboardTemperature ?? roomClimate.temperature, 23);
  const humidity = formatMetric(status.dashboardHumidity ?? roomClimate.humidity, 48);
  const syncTime = getSyncTime(status);

  return `
    <section class="page thinq-dashboard-page" aria-label="Main dashboard">
      <header class="dashboard-household-header">
        <h1 class="dashboard-desktop-title">Household: Cho Home</h1>
        <div class="dashboard-mobile-title">
          <h1>ThinQ Clone</h1>
          <p>Seocho Home · Live dashboard</p>
        </div>
        <p class="dashboard-mobile-sync">Last sync: ${escapeHtml(syncTime)}</p>
      </header>

      <div class="dashboard-main-grid">
        <button class="dashboard-home-card" data-dashboard-home-link type="button" aria-label="Open 3D Home View">
          <h2>3D Home</h2>
          <div id="dashboard-home-scene" class="dashboard-home-scene" aria-label="Fixed top view of the home"></div>
          <p class="dashboard-sync">Last sync: ${escapeHtml(syncTime)}</p>
        </button>

        <aside class="dashboard-summary-column" aria-label="Home summary">
          <section class="dashboard-info-card dashboard-climate-card">
            <h2>Room climate</h2>
            <strong>${temperature} &deg;C</strong>
            <strong>${humidity}%</strong>
          </section>

          <section class="dashboard-info-card dashboard-noise-card">
            <h2>Today's noise status</h2>
            <strong>Stable</strong>
            <p>No critical event detected</p>
            <div class="dashboard-progress" aria-hidden="true">
              <span style="width: 76%"></span>
            </div>
          </section>

          <section class="dashboard-info-card dashboard-report-shortcut">
            <h2>Basic report shortcut</h2>
            <p>Open daily noise summary and reaction overview.</p>
            <a class="dashboard-report-button" href="#/reports">View report</a>
          </section>

          <button class="dashboard-info-card dashboard-reaction-card dashboard-reaction-card--positive" type="button">
            <strong aria-hidden="true">+</strong>
            <h2>Positive</h2>
            <p>Record good</p>
          </button>

          <button class="dashboard-info-card dashboard-reaction-card dashboard-reaction-card--negative" type="button">
            <strong aria-hidden="true">-</strong>
            <h2>Negative</h2>
            <p>Record bad</p>
          </button>

          <section class="dashboard-info-card dashboard-detection-card">
            <h2>Current detection</h2>
            <p>model_label</p>
            <strong>robot_vacuum</strong>
            <p>relative dB <b>62 dB</b></p>
          </section>
        </aside>
      </div>
    </section>
  `;
}

export function mountHomeDashboardPage({ navigate } = {}) {
  const container = document.querySelector('#dashboard-home-scene');
  if (!container) return;

  cleanupHomeDashboardPage();

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
  dashboardSceneMediaCleanup?.();
  dashboardSceneMediaCleanup = null;
  dashboardSceneController?.dispose?.();
  dashboardSceneController = null;
}
