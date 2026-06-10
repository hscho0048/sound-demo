import { escapeHtml } from '../utils/html.js';

const SETTINGS_TABS = [
  { id: 'general', label: '환경설정', route: '#/settings' },
  { id: 'profile', label: '프로필', route: '#/profile' },
  { id: 'system', label: '시스템 상태', route: '#/reports/system-status' }
];

export function renderSettingsTabs(activeId) {
  return SETTINGS_TABS
    .map((tab) => {
      const isActive = tab.id === activeId;
      return `
        <button
          class="settings-tab ${isActive ? 'is-active' : ''}"
          type="button"
          ${isActive ? '' : `data-settings-route="${escapeHtml(tab.route)}"`}
        >
          ${escapeHtml(tab.label)}
        </button>
      `;
    })
    .join('');
}

export function bindSettingsTabs(navigate) {
  document.querySelectorAll('[data-settings-route]').forEach((tab) => {
    tab.addEventListener('click', () => {
      navigate(tab.dataset.settingsRoute);
    });
  });
}
