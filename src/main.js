import './styles/main.css';
import './styles/settings-suite.css';
import './styles/three-home-fixes.css';
import './styles/accessibility.css';
import './styles/mobile-apk.css';
import './styles/polish.css';
import './styles/neumorphism.css';
import './components/liquidGlassLoader.js';
import { escapeHtml } from './utils/html.js';
import { brandMark } from './components/brandMark.js';

// APK(WebView)는 상태바/제스처바 아래까지 그려지므로 safe-area 패딩 대상으로 표시한다.
if (/Android/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('is-apk');
}

const app = document.querySelector('#root');
let currentCleanup = null;

// 페이지 모듈은 lazy 로딩: 스플래시가 먼저 뜨고, 첫 라우트만 즉시 로드.
// 나머지 라우트는 스플래시가 사라진 뒤 백그라운드에서 미리 받아둔다(prefetch).
const routes = [
  {
    pattern: /^#\/login$/,
    title: 'Login',
    load: () => import('./pages/LoginPage.js'),
    exports: { render: 'renderLoginPage', mount: 'mountLoginPage' }
  },
  {
    pattern: /^#\/create-account$/,
    title: 'Create Account',
    load: () => import('./pages/CreateAccount.js'),
    exports: { render: 'renderCreateAccountPage', mount: 'mountCreateAccountPage' }
  },
  {
    pattern: /^#\/home$/,
    title: 'Home',
    load: () => import('./pages/HomeDashboardPage.js'),
    exports: {
      render: 'renderHomeDashboardPage',
      mount: 'mountHomeDashboardPage',
      cleanup: 'cleanupHomeDashboardPage'
    }
  },
  {
    pattern: /^#\/three-home$/,
    title: '3D View',
    load: () => import('./pages/ThreeDHomePage.js'),
    exports: {
      render: 'renderThreeDHomePage',
      mount: 'mountThreeDHomePage',
      cleanup: 'cleanupThreeDHomePage'
    }
  },
  {
    pattern: /^#\/devices$/,
    title: 'Devices',
    load: () => import('./pages/DeviceListPage.js'),
    exports: {
      render: 'renderDeviceListPage',
      mount: 'mountDeviceListPage',
      cleanup: 'cleanupDeviceListPage'
    }
  },
  {
    pattern: /^#\/devices\/(?<deviceId>[^/]+)$/,
    title: 'Device Detail',
    load: () => import('./pages/DeviceDetailPage.js'),
    exports: {
      render: 'renderDeviceDetailPage',
      mount: 'mountDeviceDetailPage',
      cleanup: 'cleanupDeviceDetailPage'
    }
  },
  {
    pattern: /^#\/sensitive-appliances$/,
    title: 'Sensitive Appliances',
    load: () => import('./pages/SensitiveApplianceSettingsPage.js'),
    exports: {
      render: 'renderSensitiveApplianceSettingsPage',
      mount: 'mountSensitiveApplianceSettingsPage'
    }
  },
  {
    pattern: /^#\/reports$/,
    title: 'Report',
    load: () => import('./pages/ReportPage.js'),
    exports: { render: 'renderReportPage', mount: 'mountReportPage', cleanup: 'cleanupReportPage' }
  },
  {
    pattern: /^#\/reports\/reaction-history$/,
    title: 'Reaction History',
    load: () => import('./pages/ReactionHistoryPage.js'),
    exports: {
      render: 'renderReactionHistoryPage',
      mount: 'mountReactionHistoryPage',
      cleanup: 'cleanupReactionHistoryPage'
    }
  },
  {
    pattern: /^#\/reports\/gpt-detailed$/,
    title: 'GPT Detailed Report',
    load: () => import('./pages/GPTDetailedReportPage.js'),
    exports: { render: 'renderGPTDetailedReportPage' }
  },
  {
    pattern: /^#\/reports\/system-status$/,
    title: 'System Status',
    load: () => import('./pages/SystemStatusPage.js'),
    exports: { render: 'renderSystemStatusPage', mount: 'mountSystemStatusPage' }
  },
  {
    pattern: /^#\/settings$/,
    title: 'Settings',
    load: () => import('./pages/SettingsPage.js'),
    exports: { render: 'renderSettingsPage', mount: 'mountSettingsPage', cleanup: 'cleanupSettingsPage' }
  },
  {
    pattern: /^#\/profile$/,
    title: 'Profile',
    load: () => import('./pages/ProfilePage.js'),
    exports: { render: 'renderProfilePage', mount: 'mountProfilePage' }
  }
];

const primaryNavItems = [
  {
    href: '#/home',
    label: 'Home',
    mobileLabel: 'Home',
    desktopIcon: 'house',
    mobileIcon: '/assets/icons/homel.svg',
    match: /^#\/home$/
  },
  {
    href: '#/three-home',
    label: '3D View',
    mobileLabel: '3D',
    desktopIcon: 'cube',
    mobileIcon: '/assets/icons/3Dhome.svg',
    match: /^#\/three-home$/
  },
  {
    href: '#/devices',
    label: 'Devices',
    mobileLabel: 'Devices',
    desktopIcon: 'grid',
    mobileIcon: '/assets/icons/device.svg',
    match: /^#\/devices(\/.*)?$/
  },
  {
    href: '#/reports',
    label: 'Report',
    mobileLabel: 'Report',
    desktopIcon: 'chart',
    mobileIcon: '/assets/icons/report.svg',
    match: /^#\/reports(\/(reaction-history|gpt-detailed))?$/
  }
];

const settingsNavItem = {
  href: '#/settings',
  label: 'Settings',
  mobileLabel: 'Settings',
  mobileIcon: '/assets/icons/setting.svg',
  match: /^#\/(settings|profile|reports\/system-status)$/
};

function navigate(hash) {
  window.location.hash = hash;
}

function isNavActive(currentHash, item) {
  return item.match.test(currentHash);
}

function navIcon(icon) {
  return `<span class="nav-symbol nav-symbol--${escapeHtml(icon)}" aria-hidden="true"></span>`;
}

function mobileBottomNav(currentHash) {
  const nav = [...primaryNavItems, settingsNavItem]
    .map((item) => {
      const active = isNavActive(currentHash, item);
      return `
        <a class="mobile-tab-item ${active ? 'is-active' : ''}" href="${escapeHtml(item.href)}">
          <img src="${escapeHtml(item.mobileIcon)}" alt="" aria-hidden="true" />
          <span>${escapeHtml(item.mobileLabel)}</span>
        </a>
      `;
    })
    .join('');

  return `<nav class="mobile-bottom-nav" aria-label="Mobile primary navigation">${nav}</nav>`;
}

function shell(content, routeTitle) {
  const currentHash = window.location.hash || '#/login';
  // 해시가 #/ 처럼 미매칭이어도 login 라우트로 떨어지므로, 매칭된 라우트 기준으로 네비를 숨긴다.
  const { route: matchedRoute } = matchRoute(currentHash);
  const hideNav = matchedRoute.title === 'Login' || matchedRoute.title === 'Create Account';
  const settingsActive = isNavActive(currentHash, settingsNavItem);

  if (hideNav) {
    return `
      <div class="app-shell app-shell--login">
        <main class="main-content">${content}</main>
      </div>
    `;
  }

  const nav = primaryNavItems
    .map((item) => {
      const active = isNavActive(currentHash, item);
      return `
        <a class="sidebar-nav-item ${active ? 'is-active' : ''}" href="${item.href}">
          ${navIcon(item.desktopIcon)}
          <span>${escapeHtml(item.label)}</span>
        </a>
      `;
    })
    .join('');

  return `
    <div class="app-shell app-shell--desktop">
      <div class="app-workspace">
        <aside class="sidebar">
          <h1 class="sidebar-brand">${brandMark('side')}<span>SoundCare</span></h1>
          <nav>${nav}</nav>
          <div class="sidebar-footer">
            <a class="sidebar-footer-link ${settingsActive ? 'is-active' : ''}" href="#/settings" aria-label="Settings">
              <span class="settings-symbol settings-symbol--gear" aria-hidden="true"></span>
            </a>
          </div>
        </aside>

        <main class="main-content">${content}</main>
      </div>
      ${mobileBottomNav(currentHash)}
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
  currentCleanup = null;
  app.innerHTML = shell('<section class="page"><p>Loading</p></section>', route.title);

  try {
    const mod = await route.load();
    const render = mod[route.exports.render];
    const mount = route.exports.mount ? mod[route.exports.mount] : null;
    currentCleanup = route.exports.cleanup ? mod[route.exports.cleanup] : null;

    const content = await render({ params, navigate });
    app.innerHTML = shell(content, route.title);
    mount?.({ params, navigate });
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

// 스플래시가 사라진 뒤, 나머지 페이지 모듈을 백그라운드에서 미리 로드 (이동 시 즉시 표시)
function prefetchRemainingRoutes() {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  idle(() => {
    routes.forEach((route) => {
      route.load().catch(() => {});
    });
  });
}

// 시작 스플래시: 첫 라우트 렌더 + orb 로드 + 페이지의 모든 3D 씬 로딩 완료 후 페이드아웃
const SPLASH_MIN_MS = 1200;
const SPLASH_ORB_MAX_WAIT_MS = 5000; // orb glb가 늦어도 이 시간 이후엔 진행
const SPLASH_SCENES_MAX_WAIT_MS = 10000; // 다른 3D 모델 로딩 대기 상한
const SPLASH_GRACE_MS = 600; // 전부 준비된 뒤 잠깐 유지
const splashShownAt = Date.now();

function waitForOrb() {
  const el = document.querySelector('#app-splash liquid-glass-loader');
  if (!el) return Promise.resolve(false);

  return new Promise((resolve) => {
    const tick = () => {
      if (el.root && el.root.children.length > 0) {
        resolve(true);
      } else if (Date.now() - splashShownAt > SPLASH_ORB_MAX_WAIT_MS) {
        resolve(false);
      } else {
        setTimeout(tick, 100);
      }
    };
    tick();
  });
}

// 첫 화면의 3D 씬(.is-loading 컨테이너)이 전부 로딩될 때까지 대기
function waitForScenes() {
  return new Promise((resolve) => {
    const tick = () => {
      if (Date.now() - splashShownAt > SPLASH_SCENES_MAX_WAIT_MS) {
        resolve(false);
        return;
      }
      if (!document.querySelector('#root .is-loading')) {
        resolve(true);
        return;
      }
      setTimeout(tick, 120);
    };
    // 라우트 렌더 직후 씬 마운트가 끝나도록 잠깐 기다린 뒤 확인 시작
    setTimeout(tick, 300);
  });
}

function dismissSplash() {
  const splash = document.querySelector('#app-splash');
  if (!splash) {
    prefetchRemainingRoutes();
    return;
  }

  const minWait = new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, SPLASH_MIN_MS - (Date.now() - splashShownAt)))
  );

  Promise.all([minWait, waitForOrb(), waitForScenes()]).then(() => {
    setTimeout(() => {
      splash.classList.add('is-hidden');
      setTimeout(() => splash.remove(), 500);
      prefetchRemainingRoutes();
    }, SPLASH_GRACE_MS);
  });
}

window.addEventListener('hashchange', renderRoute);

if (!window.location.hash) {
  window.location.hash = '#/login';
}

renderRoute().finally(dismissSplash);
window.addEventListener('beforeunload', () => {
  currentCleanup?.();
});
