import { bindBackdropDismiss, setPopupVisible } from '../utils/popup.js';

export function renderGptDetailReportPopUp() {
  return `
    <div id="gpt-report-consent-popup" class="gpt-consent-backdrop hidden" aria-hidden="true">
      <section class="gpt-consent-modal" role="dialog" aria-modal="true" aria-labelledby="gpt-consent-title">
        <h2 id="gpt-consent-title">GPT 상세 리포트 동의</h2>
        <p class="gpt-consent-subtitle">생성 전에 전송 범위를 확인해 주세요.</p>

        <div class="gpt-consent-card">
          <strong>전송 데이터 요약</strong>
          <p>기간, 이벤트 수, 반응 패턴, 방과 기기 이름, 룸맵 요약 정보가 전송됩니다.</p>
        </div>

        <div class="gpt-consent-card">
          <strong>원본 오디오는 제외됩니다</strong>
          <p>오디오 파일은 업로드, 다운로드, 재생, 미리보기 대상에 포함되지 않습니다.</p>
        </div>

        <p class="gpt-consent-warning">GPT 상세 리포트 생성에는 외부 API가 사용될 수 있으며 비용이 발생할 수 있습니다.</p>

        <p id="gpt-consent-feedback" class="gpt-consent-feedback" aria-live="polite"></p>

        <label class="gpt-consent-check">
          <input id="gpt-consent-checkbox" type="checkbox" />
          <span>GPT 상세 리포트 생성을 위해 요약된 리포트 데이터를 전송하는 것에 동의합니다.</span>
        </label>

        <div class="gpt-consent-actions">
          <button type="button" id="gpt-consent-cancel" class="gpt-consent-button gpt-consent-button--ghost">취소</button>
          <button type="button" id="gpt-consent-agree" class="gpt-consent-button">동의하고 생성하기</button>
        </div>
      </section>
    </div>
  `;
}

export function mountGptDetailReportPopUp({ onAgree }) {
  const popup = document.querySelector('#gpt-report-consent-popup');
  const checkbox = document.querySelector('#gpt-consent-checkbox');
  const feedback = document.querySelector('#gpt-consent-feedback');
  const agreeButton = document.querySelector('#gpt-consent-agree');
  const cancelButton = document.querySelector('#gpt-consent-cancel');

  const closePopup = () => {
    setPopupVisible(popup, false);
    if (feedback) feedback.textContent = '';
    if (checkbox) checkbox.checked = false;
    if (agreeButton) agreeButton.disabled = false;
    if (agreeButton) agreeButton.textContent = '동의하고 생성하기';
  };

  const openPopup = () => {
    setPopupVisible(popup, true);
    if (feedback) feedback.textContent = '';
  };

  bindBackdropDismiss(popup, closePopup);

  cancelButton?.addEventListener('click', closePopup);

  agreeButton?.addEventListener('click', async () => {
    if (!checkbox?.checked) {
      if (feedback) feedback.textContent = '리포트를 생성하려면 동의가 필요합니다.';
      return;
    }

    agreeButton.disabled = true;
    agreeButton.textContent = '상세 리포트를 생성하는 중입니다...';

    try {
      await onAgree?.();
      closePopup();
    } catch (error) {
      if (feedback) feedback.textContent = `상세 리포트 생성에 실패했습니다: ${error.message}`;
      agreeButton.disabled = false;
      agreeButton.textContent = '동의하고 생성하기';
    }
  });

  return { openPopup, closePopup };
}
