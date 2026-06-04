import { loginWithGoogle } from '../api/authApi.js';

export function renderLoginPage() {
  return `
    <section class="page page--center login-page">
      <div class="login-card">
        <p class="eyebrow">SoundCare MVP</p>
        <h1>소음에 민감한 사용자를 위한 스마트홈 제어 화면</h1>
        <p>Google 계정으로 로그인한 뒤 민감 가전 설정, 현재 소음 상태, 알림, 루틴, 리포트를 확인합니다.</p>
        <button id="google-login-button" class="primary-button">Google로 계속하기</button>
        <small>개발 모드에서는 placeholder 토큰이 저장됩니다. 운영에서는 안전한 저장소 연동이 필요합니다.</small>
      </div>
    </section>
  `;
}

export function mountLoginPage({ navigate }) {
  document.querySelector('#google-login-button')?.addEventListener('click', async () => {
    const button = document.querySelector('#google-login-button');
    button.disabled = true;
    button.textContent = '로그인 중...';
    try {
      await loginWithGoogle('google-id-token-placeholder');
      navigate('#/home');
    } catch (error) {
      window.alert(`로그인 요청 실패: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = 'Google로 계속하기';
    }
  });
}
