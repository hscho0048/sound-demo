import { bindSettingsTabs, renderSettingsTabs } from '../components/settingsTabs.js';

export async function renderProfilePage() {
  return `
    <section class="page profile-page" aria-label="Profile Screen">
      <header class="profile-page-header">
        <h1>Profile</h1>
        <p>Personal info and account controls only</p>
      </header>

      <div class="profile-layout">
        <aside class="settings-category-panel profile-category-panel" aria-label="Profile categories">
          ${renderSettingsTabs('profile')}
        </aside>

        <section class="profile-card profile-identity-card" aria-label="Profile identity">
          <div class="profile-photo-placeholder" aria-label="Profile picture placeholder"></div>
          <div>
            <h2>Hosung Cho</h2>
            <p>@hosung</p>
          </div>
        </section>

        <section class="profile-card profile-account-card">
          <h2>Account</h2>
          <p>Google linked</p>
          <p>Email verified</p>
          <p>Last sign-in today</p>
        </section>

        <section class="profile-card profile-security-card">
          <h2>Login &amp; Security</h2>
          <p>Password reset available</p>
          <p>2-step verification off</p>
        </section>

        <section class="profile-card profile-actions-card">
          <h2>Account Actions</h2>
          <div class="profile-action-buttons">
            <button type="button">Edit</button>
            <button type="button">Password</button>
            <button id="profile-logout-button" type="button">Log out</button>
          </div>
        </section>

        <section class="profile-card profile-notice-card">
          <p>Private account details are masked by default. Delete account needs confirmation.</p>
        </section>
      </div>
    </section>
  `;
}

export function mountProfilePage({ navigate } = {}) {
  bindSettingsTabs(navigate);

  document.querySelector('#profile-logout-button')?.addEventListener('click', () => {
    navigate('#/login');
  });
}
