import './styles/main.css';
import { getRecentNotifications } from './api/notificationApi.js';
import { renderLoginPage, mountLoginPage } from './pages/LoginPage.js';
import { renderHomeDashboardPage, mountHomeDashboardPage } from './pages/HomeDashboardPage.js';
import { renderSensitiveApplianceSettingsPage, mountSensitiveApplianceSettingsPage } from './pages/SensitiveApplianceSettingsPage.js';
import { cleanupThreeDHomePage, mountThreeDHomePage, renderThreeDHomePage } from './pages/ThreeDHomePage.js';
import { cleanupApplianceModuleControlPage, mountApplianceModuleControlPage, renderApplianceModuleControlPage } from './pages/ApplianceModuleControlPage.js';
import { mountDeviceListPage, renderDeviceListPage } from './pages/DeviceListPage.js';
import { mountDeviceDetailPage, renderDeviceDetailPage } from './pages/DeviceDetailPage.js';
import { mountNotificationCenterPage, renderNotificationCenterPage } from './pages/NotificationCenterPage.js';
import { mountRoutineRecommendationPage, renderRoutineRecommendationPage } from './pages/RoutineRecommendationPage.js';
import { mountReportPage, renderReportPage } from './pages/ReportPage.js';
import { mountSettingsPage, renderSettingsPage } from './pages/SettingsPage.js';
import { escapeHtml } from './utils/html.js';

const app = document.querySelector('#root');
const env = import.meta.env ?? {};
const pollIntervalMs = Number(env.VITE_NOTIFICATION_POLL_INTERVAL_MS ?? 15000);
let currentCleanup = null;
let notificationTimer = null;

const routes = [
  { pattern: /^#\/login$/, title: '로그인', render: renderLoginPage, mount: mountLoginPage },
  { pattern: /^#\/home$/, title: '홈', render: renderHomeDashboardPage, mount: mountHomeDashboardPage },
  { pattern: /^#\/sensitive-appliances$/, title: '민감 가전', render: renderSensitiveApplianceSettingsPage, mount: mountSensitiveApplianceSettingsPage },
  { pattern: /^#\/appliance-module$/, title: '가전 모형 제어', render: renderApplianceModuleControlPage, mount: mountApplianceModuleControlPage, cleanup: cleanupApplianceModuleControlPage },
  { pattern: /^#\/three-home$/, title: '3D 홈', render: renderThreeDHomePage, mount: mountThreeDHomePage, cleanup: cleanupThreeDHomePage },
  { pattern: /^#\/devices$/, title: '기기 목록', render: renderDeviceListPage, mount: mountDeviceListPage },
  { pattern: /^#\/devices\/(?<deviceId>[^/]+)$/, title: '기기 상세', render: renderDeviceDetailPage, mount: mountDeviceDetailPage },
  { pattern: /^#\/notifications$/, title: '알림', render: renderNotificationCenterPage, mount: mountNotificationCenterPage },
  { pattern: /^#\/routines$/, title: '루틴', render: renderRoutineRecommendationPage, mount: mountRoutineRecommendationPage },
  { pattern: /^#\/reports$/, title: '리포트', render: renderReportPage, mount: mountReportPage },
  { pattern: /^#\/settings$/, title: '설정', render: renderSettingsPage, mount: mountSettingsPage }
];

const navItems = [
  ['#/home', '홈'],
  ['#/sensitive-appliances', '민감 가전'],
  ['#/appliance-module', '가전 모형 제어'],
  ['#/three-home', '3D 홈'],
  ['#/devices', '기기'],
  ['#/notifications', '알림'],
  ['#/routines', '루틴'],
  ['#/reports', '리포트'],
  ['#/settings', '설정']
];

function navigate(hash) {
  window.location.hash = hash;
}

function shell(content, routeTitle) {
  const currentHash = window.location.hash || '#/login';
  const nav = navItems.map(([href, label]) => {
    const active = currentHash === href || (href === '#/devices' && currentHash.startsWith('#/devices/'));
    return `<a class="${active ? 'is-active' : ''}" href="${href}">${label}</a>`;
  }).join('');
  const hideNav = currentHash === '#/login';
  return `
    <div class="app-shell ${hideNav ? 'app-shell--login' : ''}">
      ${hideNav ? '' : `
        <aside class="sidebar">
          <div class="brand"><span>SC</span><strong>SoundCare</strong></div>
          <nav>${nav}</nav>
          <p class="sidebar-note">Tauri/Web 제어 화면 · ${escapeHtml(routeTitle)}</p>
        </aside>
      `}
      <main class="main-content">${content}</main>
      <div id="toast-root" class="toast-root" aria-live="polite"></div>
    </div>
  `;
}

function matchRoute(hash) {
  for (const route of routes) {
    const match = route.pattern.exec(hash);
    if (match) {
      return { route, params: match.groups ?? {} };
    }
  }
  return { route: routes[0], params: {} };
}

async function renderRoute() {
  const hash = window.location.hash || '#/login';
  const { route, params } = matchRoute(hash);
  currentCleanup?.();
  currentCleanup = route.cleanup ?? null;
  app.innerHTML = shell('<section class="page"><p>화면을 불러오는 중...</p></section>', route.title);
  try {
    const content = await route.render({ params, navigate });
    app.innerHTML = shell(content, route.title);
    route.mount?.({ params, navigate });
  } catch (error) {
    app.innerHTML = shell(`
      <section class="page">
        <div class="warning-box">
          <h1>화면 로딩 실패</h1>
          <p>${escapeHtml(error.message)}</p>
        </div>
      </section>
    `, route.title);
  }
}

async function pollNotifications() {
  if ((window.location.hash || '#/login') === '#/login') return;
  try {
    const notifications = await getRecentNotifications(1);
    const latest = notifications?.[0];
    const toastRoot = document.querySelector('#toast-root');
    if (latest && toastRoot) {
      toastRoot.innerHTML = `<div class="toast"><strong>${escapeHtml(latest.title)}</strong><span>${escapeHtml(latest.message)}</span></div>`;
      window.setTimeout(() => { toastRoot.innerHTML = ''; }, 5000);
    }
  } catch {
    // 알림 폴링 실패는 화면 사용을 막지 않는다.
  }
}

window.addEventListener('hashchange', renderRoute);

if (!window.location.hash) {
  window.location.hash = '#/login';
}

renderRoute();
notificationTimer = window.setInterval(pollNotifications, pollIntervalMs);
window.addEventListener('beforeunload', () => {
  currentCleanup?.();
  if (notificationTimer) window.clearInterval(notificationTimer);
});
