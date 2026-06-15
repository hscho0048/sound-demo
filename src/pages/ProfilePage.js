import { bindSettingsTabs, renderSettingsTabs } from '../components/settingsTabs.js';
import { getMyProfile } from '../api/users.js';
import { escapeHtml } from '../utils/html.js';

function initialsOf(name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

export async function renderProfilePage() {
  let profile = null;
  try {
    profile = await getMyProfile();
  } catch (error) {
    profile = null;
  }
  const displayName = profile?.nickname || profile?.displayName || '사용자';
  const email = profile?.email || '';
  const handle = email ? `@${email.split('@')[0]}` : `@${displayName}`;
  const initials = initialsOf(displayName);
  if (profile?.nickname && typeof window !== 'undefined') {
    window.localStorage.setItem('soundcare.nickname', profile.nickname);
  }

  return `
    <section class="page profile-page" aria-label="프로필 화면">
      <header class="profile-page-header">
        <h1>프로필</h1>
        <p>개인 정보와 계정 제어 항목을 관리합니다.</p>
      </header>

      <div class="profile-layout">
        <aside class="settings-category-panel profile-category-panel" aria-label="프로필 카테고리">
          ${renderSettingsTabs('profile')}
        </aside>

        <section class="profile-card profile-identity-card" aria-label="프로필 정보">
          <div class="profile-photo-placeholder" aria-label="${escapeHtml(displayName)} 프로필 사진">
            <span class="profile-avatar-initials" aria-hidden="true">${escapeHtml(initials)}</span>
          </div>
          <div>
            <h2>${escapeHtml(displayName)}</h2>
            <p>${escapeHtml(handle)}</p>
          </div>
        </section>

        <section class="profile-card profile-summary-card">
          <div class="profile-summary-section profile-account-card">
            <h2>계정</h2>
            <p>Google 계정 연동됨</p>
            <p>${email ? escapeHtml(email) : '이메일 미등록'}</p>
          </div>

          <div class="profile-summary-divider" aria-hidden="true"></div>

          <div class="profile-summary-section profile-security-card">
            <h2>로그인 및 보안</h2>
            <p>비밀번호 재설정 가능</p>
            <p>2단계 인증 꺼짐</p>
          </div>

          <div class="profile-summary-divider" aria-hidden="true"></div>

          <div class="profile-summary-section profile-actions-card">
            <h2>계정 작업</h2>
            <div class="profile-action-buttons">
              <button type="button">수정</button>
              <button type="button">비밀번호</button>
              <button id="profile-logout-button" type="button">Log out</button>
            </div>
            <p class="profile-actions-note">개인 계정 정보는 기본적으로 마스킹되며, 계정 삭제는 별도 확인이 필요합니다.</p>
          </div>
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
