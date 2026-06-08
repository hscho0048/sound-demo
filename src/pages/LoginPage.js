export function renderLoginPage() {
  return `
    <section class="login-page">
      <div class="login-window">
        <div class="login-stage">
          <div class="login-card">
            <p class="eyebrow">SoundCare MVP</p>
            <h1>SoundCare ThinQ Clone</h1>
            <p>Sign in to review the main dashboard, 3D home, devices, and reports.</p>
            <button id="local-login-button" class="primary-button">Login</button>
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
    button.disabled = true;
    button.textContent = 'Logging in...';
    navigate('#/home');
  });
}
