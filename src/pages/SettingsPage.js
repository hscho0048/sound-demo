import { API_BASE_URL, TOKEN_STORAGE_KEY, isMockApiEnabled } from '../api/client.js';
import { logout } from '../api/authApi.js';
import { escapeHtml } from '../utils/html.js';

export function renderSettingsPage() {
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Settings</p>
          <h1>앱 설정</h1>
        </div>
        <button id="logout-button" class="secondary">로그아웃</button>
      </div>
      <section class="section-block">
        <h2>연동 상태</h2>
        <dl class="definition-list">
          <div><dt>API Base URL</dt><dd>${escapeHtml(API_BASE_URL)}</dd></div>
          <div><dt>Mock API</dt><dd>${isMockApiEnabled() ? '사용 중' : '사용 안 함'}</dd></div>
          <div><dt>토큰 저장 키</dt><dd>${escapeHtml(TOKEN_STORAGE_KEY)}</dd></div>
        </dl>
      </section>
      <section class="section-block warning-box">
        <h2>운영 전 확인 사항</h2>
        <p>토큰 저장소를 안전한 방식으로 교체하고, WebSocket 인증 정책과 배포 URL을 확정해야 합니다.</p>
      </section>
    </section>
  `;
}

export function mountSettingsPage({ navigate }) {
  document.querySelector('#logout-button')?.addEventListener('click', () => {
    logout();
    navigate('#/login');
  });
}
