import { buildQuery, isMockApiEnabled, request } from '../api/client.js';

const DUPLICATE_NICKNAMES_FOR_MOCK = ['admin', 'test', 'soundcare'];

async function checkNicknameDuplicate(nickname) {
  if (isMockApiEnabled()) {
    return DUPLICATE_NICKNAMES_FOR_MOCK.includes(nickname.toLowerCase());
  }

  const result = await request(`/api/users/nickname/check${buildQuery({ nickname })}`);
  if (typeof result === 'boolean') return result;
  if (typeof result?.duplicate === 'boolean') return result.duplicate;
  if (typeof result?.duplicated === 'boolean') return result.duplicated;
  if (typeof result?.exists === 'boolean') return result.exists;
  if (typeof result?.available === 'boolean') return !result.available;
  if (typeof result?.isAvailable === 'boolean') return !result.isAvailable;
  return false;
}

function setNicknameAvailability(message, status) {
  const availability = document.querySelector('#account-availability');
  if (!availability) return;
  availability.classList.remove('is-available', 'is-duplicate', 'is-checking');
  if (status) availability.classList.add(status);
  availability.lastChild.textContent = message;
}

export function renderCreateAccountPage() {
  return `
    <section class="account-page">
      <div class="account-window">
        <header class="account-header">
          <a class="account-back-button" href="#/login" aria-label="Back to sign in"><span aria-hidden="true">&larr;</span></a>
          <div>
            <h1>Create Account</h1>
            <a href="#/login">Back to login</a>
          </div>
        </header>
        <main class="account-content">
          <form class="account-card" id="create-account-form">
            <h2>Account setup</h2>
            <div class="account-info-box">
              <strong>Required information</strong>
              <span>Household, nickname, consent</span>
            </div>

            <label>
              <span>Household Name *</span>
              <input name="householdName" type="text" value="Moonlight House" required />
            </label>

            <label>
              <span>Nick *</span>
              <div class="account-inline">
                <input name="nick" type="text" placeholder="Enter a nickname" required />
                <button id="check-nickname-button" type="button">Check duplicate</button>
              </div>
            </label>
            <p id="account-availability" class="account-availability"><span></span>Nickname available</p>

            <label>
              <span>House *</span>
              <input name="house" type="text" placeholder="Building / unit details" required />
            </label>

            <label class="account-consent">
              <input name="consent" type="checkbox" required />
              <span>I agree to privacy policy and service terms.</span>
            </label>

            <p class="account-required">* Required</p>
            <button class="account-submit" type="submit">Create account</button>
            <p class="account-signin-note">Already have an account?</p>
          </form>

          <p class="account-validation" aria-live="polite">Validation and missing consent messages appear here.</p>
        </main>
      </div>
    </section>
  `;
}

export function mountCreateAccountPage({ navigate }) {
  document.querySelector('#check-nickname-button')?.addEventListener('click', async () => {
    const button = document.querySelector('#check-nickname-button');
    const nickname = document.querySelector('input[name="nick"]')?.value.trim();
    if (!nickname) {
      setNicknameAvailability('Enter a nickname first.', 'is-duplicate');
      return;
    }

    button.disabled = true;
    setNicknameAvailability('Checking nickname...', 'is-checking');
    try {
      const isDuplicate = await checkNicknameDuplicate(nickname);
      if (isDuplicate) {
        setNicknameAvailability('This nickname is already taken. Choose another one.', 'is-duplicate');
      } else {
        setNicknameAvailability('This nickname is available.', 'is-available');
      }
    } catch (error) {
      setNicknameAvailability(`Nickname check failed: ${error.message}`, 'is-duplicate');
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('#create-account-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const validation = document.querySelector('.account-validation');
    if (validation) validation.textContent = 'Account created locally. Redirecting to Home...';
    window.setTimeout(() => navigate('#/home'), 250);
  });
}
