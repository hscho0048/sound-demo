import { bindBackdropDismiss, ensurePopupRoot, setPopupVisible } from '../utils/popup.js';

export function renderGPTConsentWithdrawalPopup() {
  return `
    <div id="gpt-withdraw-popup" class="gpt-withdraw-backdrop hidden" aria-hidden="true">
      <section class="gpt-withdraw-modal" role="dialog" aria-modal="true" aria-labelledby="gpt-withdraw-title">
        <h2 id="gpt-withdraw-title">GPT 동의를 철회할까요?</h2>
        <p class="gpt-withdraw-subtitle">앞으로 GPT 상세 리포트 생성을 중단할지 확인해 주세요.</p>

        <div class="gpt-withdraw-card">
          <strong>현재 동의 상태</strong>
          <p>GPT 상세 리포트 생성을 허용한 상태입니다.</p>
          <p>동의 철회 후, GPT 리포트를 다시 생성하려면 요약 데이터 전송 전에 동의를 다시 받아야 합니다.</p>
        </div>

        <div class="gpt-withdraw-card">
          <p>이미 생성된 리포트는 자동으로 삭제되지 않으며, 리포트 목록에서 직접 관리할 수 있습니다.</p>
        </div>

        <p id="gpt-withdraw-feedback" class="gpt-withdraw-feedback" aria-live="polite"></p>

        <div class="gpt-withdraw-actions">
          <a href="#/reports" id="gpt-withdraw-report-link" class="gpt-withdraw-link">생성된 리포트 목록 열기</a>
          <div class="gpt-withdraw-button-row">
            <button type="button" id="gpt-withdraw-cancel" class="gpt-withdraw-secondary">취소</button>
            <button type="button" id="gpt-withdraw-confirm" class="gpt-withdraw-primary">동의 철회</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

export function mountGPTConsentWithdrawalPopup({ navigate, onConfirm } = {}) {
  const root = ensurePopupRoot('gpt-withdraw-popup-root');
  root.innerHTML = renderGPTConsentWithdrawalPopup();

  const popup = root.querySelector('#gpt-withdraw-popup');
  const feedback = root.querySelector('#gpt-withdraw-feedback');
  const reportLink = root.querySelector('#gpt-withdraw-report-link');
  const cancelButton = root.querySelector('#gpt-withdraw-cancel');
  const confirmButton = root.querySelector('#gpt-withdraw-confirm');

  const closePopup = () => {
    setPopupVisible(popup, false);
    if (feedback) feedback.textContent = '';
    if (confirmButton) confirmButton.disabled = false;
    if (confirmButton) confirmButton.textContent = '동의 철회';
  };

  const openPopup = () => {
    setPopupVisible(popup, true);
    if (feedback) feedback.textContent = '';
  };

  bindBackdropDismiss(popup, closePopup);

  reportLink?.addEventListener('click', (event) => {
    event.preventDefault();
    closePopup();
    navigate?.('#/reports');
  });

  cancelButton?.addEventListener('click', closePopup);

  confirmButton?.addEventListener('click', async () => {
    if (feedback) feedback.textContent = '';
    confirmButton.disabled = true;
    confirmButton.textContent = '철회 중...';

    try {
      await onConfirm?.();
      closePopup();
    } catch (error) {
      confirmButton.disabled = false;
      confirmButton.textContent = '동의 철회';
      if (feedback) feedback.textContent = error.message;
    }
  });

  const cleanup = () => {
    root?.remove();
  };

  return { openPopup, closePopup, cleanup };
}
