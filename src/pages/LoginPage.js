import { loginWithGoogle } from '../api/authApi.js';
import { getMyProfile } from '../api/users.js';
import { GOOGLE_CLIENT_ID } from '../api/client.js';
import { brandMark } from '../components/brandMark.js';

let gisInitialized = false;

function loadGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-gsi]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GIS script load failed')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.gsi = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GIS script load failed'));
    document.head.appendChild(script);
  });
}

// 로그인 직후: 온보딩(가구명/닉네임) 미완료면 계정 생성 화면으로, 완료면 홈으로.
async function routeAfterAuth(navigate) {
  let profile = null;
  try {
    profile = await getMyProfile();
  } catch (error) {
    profile = null;
  }
  const onboarded = Boolean(profile && profile.householdLabel && String(profile.householdLabel).trim());
  navigate(onboarded ? '#/home' : '#/create-account');
}

export function renderLoginPage() {
  const hasGoogle = Boolean(GOOGLE_CLIENT_ID);
  return `
    <section class="login-page">
      <div class="login-window">
        <div class="login-stage">
          <div class="login-card">
            <div class="login-brand">${brandMark('login')}<span>SoundCare</span></div>
            <h1>Smart noise dashboard</h1>
            <p>Sign in to monitor home noise, devices, and daily reports.</p>

            ${hasGoogle
              ? `<div id="google-signin-btn" class="google-signin-btn"></div>
                 <button id="local-login-button" type="button" class="dev-login-link" style="display:block;margin:14px auto 0;background:transparent;border:none;color:#9aa5b1;font-size:12px;text-decoration:underline;cursor:pointer;padding:4px 8px;">개발용 로그인 (dev)</button>`
              : `<button id="local-login-button" class="primary-button">
                  <svg class="login-google-icon" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  <span>로그인</span>
                </button>`}
            <p id="login-status" aria-live="polite"></p>
          </div>
        </div>
        <div class="login-footer">
          <span>App version 0.1</span>
        </div>
      </div>
    </section>
  `;
}

export function mountLoginPage({ navigate }) {
  const status = () => document.querySelector('#login-status');

  // 실제 Google 로그인 (VITE_GOOGLE_CLIENT_ID 설정 시)
  if (GOOGLE_CLIENT_ID) {
    loadGoogleIdentityScript()
      .then(() => {
        if (!gisInitialized) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: async (response) => {
              const s = status();
              try {
                if (s) s.textContent = 'Google 인증 확인 중...';
                await loginWithGoogle(response.credential);
                if (s) s.textContent = '로그인 완료.';
                await routeAfterAuth(navigate);
              } catch (error) {
                if (s) s.textContent = `Google 로그인 실패: ${error.message}`;
              }
            }
          });
          gisInitialized = true;
        }
        const target = document.querySelector('#google-signin-btn');
        if (target) {
          window.google.accounts.id.renderButton(target, {
            theme: 'outline',
            size: 'large',
            width: Math.min(300, Math.max(220, window.innerWidth - 96)),
            text: 'signin_with'
          });
        }
      })
      .catch(() => {
        const s = status();
        if (s) s.textContent = 'Google 로그인 스크립트를 불러오지 못했습니다. 개발용 로그인을 사용하세요.';
      });
  }

  // 개발용(placeholder) 로그인 — 마지막에 제거 예정
  document.querySelector('#local-login-button')?.addEventListener('click', async () => {
    const button = document.querySelector('#local-login-button');
    const s = status();
    button.disabled = true;
    if (s) s.textContent = 'Requesting backend token...';

    try {
      await loginWithGoogle();
      if (s) s.textContent = 'Login complete.';
      await routeAfterAuth(navigate);
    } catch (error) {
      if (s) s.textContent = `Login failed: ${error.message}`;
      button.disabled = false;
    }
  });
}
