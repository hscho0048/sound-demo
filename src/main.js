import './styles/main.css';
import './styles/settings-suite.css';
import './styles/three-home-fixes.css';
import './styles/accessibility.css';
import { renderLoginPage, mountLoginPage } from './pages/LoginPage.js';
import { renderCreateAccountPage, mountCreateAccountPage } from './pages/CreateAccount.js';
import {
  cleanupHomeDashboardPage,
  renderHomeDashboardPage,
  mountHomeDashboardPage
} from './pages/HomeDashboardPage.js';
import { renderSensitiveApplianceSettingsPage, mountSensitiveApplianceSettingsPage } from './pages/SensitiveApplianceSettingsPage.js';
import { cleanupThreeDHomePage, mountThreeDHomePage, renderThreeDHomePage } from './pages/ThreeDHomePage.js';
import { renderDeviceListPage } from './pages/DeviceListPage.js';
import { cleanupDeviceDetailPage, mountDeviceDetailPage, renderDeviceDetailPage } from './pages/DeviceDetailPage.js';
import { cleanupReportPage, mountReportPage, renderReportPage } from './pages/ReportPage.js';
import { mountReactionHistoryPage, renderReactionHistoryPage } from './pages/ReactionHistoryPage.js';
import { renderGPTDetailedReportPage } from './pages/GPTDetailedReportPage.js';
import { mountSystemStatusPage, renderSystemStatusPage } from './pages/SystemStatusPage.js';
import { mountSettingsPage, renderSettingsPage } from './pages/SettingsPage.js';
import { mountProfilePage, renderProfilePage } from './pages/ProfilePage.js';
import { escapeHtml } from './utils/html.js';

const app = document.querySelector('#root');
let currentCleanup = null;

const routes = [
  { pattern: /^#\/login$/, title: 'Login', render: renderLoginPage, mount: mountLoginPage },
  { pattern: /^#\/create-account$/, title: 'Create Account', render: renderCreateAccountPage, mount: mountCreateAccountPage },
  {
    pattern: /^#\/home$/,
    title: 'Home',
    render: renderHomeDashboardPage,
    mount: mountHomeDashboardPage,
    cleanup: cleanupHomeDashboardPage
  },
  {
    pattern: /^#\/three-home$/,
    title: '3D Home',
    render: renderThreeDHomePage,
    mount: mountThreeDHomePage,
    cleanup: cleanupThreeDHomePage
  },
  { pattern: /^#\/devices$/, title: 'Devices', render: renderDeviceListPage },
  {
    pattern: /^#\/devices\/(?<deviceId>[^/]+)$/,
    title: 'Device Detail',
    render: renderDeviceDetailPage,
    mount: mountDeviceDetailPage,
    cleanup: cleanupDeviceDetailPage
  },
  {
    pattern: /^#\/sensitive-appliances$/,
    title: 'Sensitive Appliances',
    render: renderSensitiveApplianceSettingsPage,
    mount: mountSensitiveApplianceSettingsPage
  },
  {
    pattern: /^#\/reports$/,
    title: 'Report',
    render: renderReportPage,
    mount: mountReportPage,
    cleanup: cleanupReportPage
  },
  {
    pattern: /^#\/reports\/reaction-history$/,
    title: 'Reaction History',
    render: renderReactionHistoryPage,
    mount: mountReactionHistoryPage
  },
  {
    pattern: /^#\/reports\/gpt-detailed$/,
    title: 'GPT Detailed Report',
    render: renderGPTDetailedReportPage
  },
  {
    pattern: /^#\/reports\/system-status$/,
    title: 'System Status',
    render: renderSystemStatusPage,
    mount: mountSystemStatusPage
  },
  { pattern: /^#\/settings$/, title: 'Settings', render: renderSettingsPage, mount: mountSettingsPage },
  { pattern: /^#\/profile$/, title: 'Profile', render: renderProfilePage, mount: mountProfilePage }
];

const navItems = [
  { href: '#/home', label: 'Home', icon: 'home' },
  { href: '#/three-home', label: '3D Home', icon: 'box' },
  { href: '#/devices', label: 'Devices', icon: 'box' },
  { href: '#/reports', label: 'Report', icon: 'box' }
];

function navigate(hash) {
  window.location.hash = hash;
}

function isNavActive(currentHash, href) {
  return currentHash === href || currentHash.startsWith(`${href}/`);
}

function navIcon(icon) {
  return `<span class="nav-symbol nav-symbol--${escapeHtml(icon)}" aria-hidden="true"></span>`;
}

function shell(content, routeTitle) {
  const currentHash = window.location.hash || '#/login';
  const hideNav = currentHash === '#/login' || currentHash === '#/create-account';
  const settingsActive = currentHash === '#/settings' || currentHash === '#/profile' || currentHash === '#/reports/system-status';

  if (hideNav) {
    return `
      <div class="app-shell app-shell--login">
        <main class="main-content">${content}</main>
      </div>
    `;
  }

  const nav = navItems
    .map(({ href, label, icon }) => {
      const active = isNavActive(currentHash, href);
      return `
        <a class="sidebar-nav-item ${active ? 'is-active' : ''}" href="${href}">
          ${navIcon(icon)}
          <span>${escapeHtml(label)}</span>
        </a>
      `;
    })
    .join('');

  return `
    <div class="app-shell app-shell--desktop">
      <div class="app-workspace">
        <aside class="sidebar">
          <h1>ThinQ Clone</h1>
          <nav>${nav}</nav>
          <div class="sidebar-footer">
            <a class="sidebar-footer-link ${settingsActive ? 'is-active' : ''}" href="#/settings" aria-label="Settings">
              <img class="settings-symbol" src="/assets/icons/setting.svg" alt="" aria-hidden="true" />
            </a>
          </div>
        </aside>

        <main class="main-content">${content}</main>
      </div>
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
  app.innerHTML = shell('<section class="page"><p>Loading...</p></section>', route.title);

  try {
    const content = await route.render({ params, navigate });
    app.innerHTML = shell(content, route.title);
    route.mount?.({ params, navigate });
  } catch (error) {
    app.innerHTML = shell(
      `
        <section class="page">
          <div class="warning-box">
            <h1>Unable to load this screen</h1>
            <p>${escapeHtml(error.message)}</p>
          </div>
        </section>
      `,
      route.title
    );
  }
}

window.addEventListener('hashchange', renderRoute);

if (!window.location.hash) {
  window.location.hash = '#/login';
}

renderRoute();
window.addEventListener('beforeunload', () => {
  currentCleanup?.();
});
