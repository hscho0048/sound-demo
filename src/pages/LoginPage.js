import { loginWithLocalDev } from '../api/authApi.js';

export function renderLoginPage() {
  return `
    <section class="login-page">
      <div class="login-window">
        <div class="login-stage">
          <div class="login-card">
            <p class="eyebrow">SoundCare</p>
            <h1>Smart noise dashboard</h1>
            <p>Sign in to monitor home noise, devices, and daily reports.</p>
            <button id="local-login-button" class="primary-button">
              <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/google/google-original.svg" alt="" aria-hidden="true" />
              <span>로그인</span>
            </button>
            <p id="login-status" aria-live="polite"></p>
            <p class="login-create-account">Need an account? <a href="#/create-account">Create account</a></p>
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
  document.querySelector('#local-login-button')?.addEventListener('click', async () => {
    const button = document.querySelector('#local-login-button');
    const buttonLabel = button?.querySelector('span');
    const status = document.querySelector('#login-status');
    button.disabled = true;
    if (buttonLabel) buttonLabel.textContent = 'Logging in...';
    if (status) status.textContent = 'Requesting backend token...';

    try {
      await loginWithLocalDev();
      if (status) status.textContent = 'Login complete.';
      navigate('#/home');
    } catch (error) {
      if (status) status.textContent = `Login failed: ${error.message}`;
      button.disabled = false;
      if (buttonLabel) buttonLabel.textContent = '로그인';
    }
  });
}
