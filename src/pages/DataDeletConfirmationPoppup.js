import { bindBackdropDismiss, ensurePopupRoot, setPopupVisible } from '../utils/popup.js';

export function renderDataDeleteConfirmationPopup() {
  return `
    <div id="data-delete-confirmation-popup" class="data-delete-backdrop hidden" aria-hidden="true">
      <section class="data-delete-modal" role="dialog" aria-modal="true" aria-labelledby="data-delete-title">
        <h2 id="data-delete-title">선택한 데이터를 삭제할까요?</h2>
        <p class="data-delete-subtitle">이 작업은 저장된 기록을 삭제할 수 있습니다.</p>

        <div class="data-delete-card">
          <p>대상: 이벤트 28건, 반응 7건, 리포트 1건, 로컬 로그</p>
        </div>

        <label class="data-delete-input-wrap">
          <span class="hidden">위험한 삭제를 확인하려면 DELETE를 입력하세요</span>
          <input id="data-delete-confirm-input" type="text" placeholder="DELETE를 입력해 삭제를 확인하세요" />
        </label>

        <p class="data-delete-warning"> * 백업 정책이 없는 경우 삭제된 데이터는 복구되지 않을 수 있습니다.</p>
        <p id="data-delete-feedback" class="data-delete-feedback" aria-live="polite"></p>

        <div class="data-delete-actions">
          <a href="#/settings" class="data-delete-policy-link">데이터 보관 정책</a>
          <div class="data-delete-button-row">
            <button type="button" id="data-delete-cancel" class="data-delete-secondary">취소</button>
            <button type="button" id="data-delete-confirm" class="data-delete-primary">삭제</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

export function mountDataDeleteConfirmationPopup({ onConfirm } = {}) {
  const root = ensurePopupRoot('data-delete-confirmation-popup-root');
  root.innerHTML = renderDataDeleteConfirmationPopup();

  const popup = root.querySelector('#data-delete-confirmation-popup');
  const input = root.querySelector('#data-delete-confirm-input');
  const feedback = root.querySelector('#data-delete-feedback');
  const confirmButton = root.querySelector('#data-delete-confirm');
  const cancelButton = root.querySelector('#data-delete-cancel');

  const closePopup = () => {
    setPopupVisible(popup, false);
    if (input) input.value = '';
    if (feedback) feedback.textContent = '';
    if (confirmButton) confirmButton.disabled = false;
    if (confirmButton) confirmButton.textContent = '삭제';
  };

  const openPopup = () => {
    setPopupVisible(popup, true);
    if (feedback) feedback.textContent = '';
    input?.focus();
  };

  bindBackdropDismiss(popup, closePopup);

  cancelButton?.addEventListener('click', closePopup);

  confirmButton?.addEventListener('click', async () => {
    const confirmText = input?.value.trim();
    if (confirmText !== 'DELETE') {
      if (feedback) feedback.textContent = '계속하려면 DELETE를 입력해 주세요.';
      input?.focus();
      return;
    }

    if (feedback) feedback.textContent = '';
    confirmButton.disabled = true;
    confirmButton.textContent = '삭제 중...';

    try {
      await onConfirm?.(confirmText);
      closePopup();
    } catch (error) {
      confirmButton.disabled = false;
      confirmButton.textContent = '삭제';
      if (feedback) feedback.textContent = error.message;
    }
  });

  const cleanup = () => {
    root?.remove();
  };

  return { openPopup, closePopup, cleanup };
}
