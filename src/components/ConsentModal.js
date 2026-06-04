export function ConsentModal({ visible = false } = {}) {
  if (!visible) return '';
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="consent-modal" role="dialog" aria-modal="true" aria-labelledby="gpt-consent-title">
        <h2 id="gpt-consent-title">GPT 상세 리포트 생성 동의</h2>
        <p>상세 리포트는 Spring Boot가 집계한 요약 데이터만 사용합니다. 원본 오디오는 전송하지 않습니다.</p>
        <p>외부 GPT API 사용으로 비용이 발생할 수 있으며, 요약 데이터가 외부 API로 전송될 수 있습니다.</p>
        <label class="checkbox-row">
          <input type="checkbox" id="gpt-consent-check" />
          위 내용을 확인했고 상세 리포트 생성을 요청합니다.
        </label>
        <div class="modal-actions">
          <button data-action="confirm-gpt-consent">동의하고 생성</button>
          <button class="secondary" data-action="close-gpt-consent">닫기</button>
        </div>
      </section>
    </div>
  `;
}
