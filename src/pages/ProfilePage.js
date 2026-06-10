import { bindSettingsTabs, renderSettingsTabs } from '../components/settingsTabs.js';

export async function renderProfilePage() {
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
          <div class="profile-photo-placeholder" aria-label="프로필 사진 자리"></div>
          <div>
            <h2>Hosung Cho</h2>
            <p>@hosung</p>
          </div>
        </section>

        <section class="profile-card profile-summary-card">
          <div class="profile-summary-section profile-account-card">
            <h2>계정</h2>
            <p>Google 계정 연동됨</p>
            <p>이메일 인증 완료</p>
            <p>마지막 로그인: 오늘</p>
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
