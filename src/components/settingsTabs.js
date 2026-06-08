import { escapeHtml } from '../utils/html.js';

const SETTINGS_TABS = [
  { id: 'general', label: 'General', route: '#/settings' },
  { id: 'profile', label: 'Profile', route: '#/profile' },
  { id: 'system', label: 'System Status', route: '#/reports/system-status' }
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
