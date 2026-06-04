import { getBasicReport, grantGptReportConsent, requestDetailedReport } from '../api/reportApi.js';
import { ConsentModal } from '../components/ConsentModal.js';
import { ReportCard } from '../components/ReportCard.js';
import { escapeHtml } from '../utils/html.js';

let modalVisible = false;

async function pageMarkup() {
  const report = await getBasicReport();
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Reports</p>
          <h1>소음 리포트</h1>
          <p>기본 리포트는 PostgreSQL 집계와 규칙으로 생성됩니다. GPT 상세 리포트에는 사용자 동의가 필요합니다.</p>
        </div>
        <button id="open-gpt-consent" class="primary-button">GPT 상세 리포트 생성</button>
      </div>
      ${ReportCard(report)}
      <section class="section-block warning-box">
        <h2>개인정보와 비용 안내</h2>
        <p>원본 오디오는 전송하지 않습니다. 상세 리포트 요청 시 요약 데이터만 외부 GPT API로 전송될 수 있으며 비용이 발생할 수 있습니다.</p>
      </section>
      <section id="detailed-report-result" class="section-block hidden"></section>
      <div id="modal-root">${ConsentModal({ visible: modalVisible })}</div>
    </section>
  `;
}

export async function renderReportPage() {
  return pageMarkup();
}

async function rerenderModal() {
  const modalRoot = document.querySelector('#modal-root');
  if (modalRoot) {
    modalRoot.innerHTML = ConsentModal({ visible: modalVisible });
    bindModalEvents();
  }
}

function bindModalEvents() {
  document.querySelector('[data-action="close-gpt-consent"]')?.addEventListener('click', () => {
    modalVisible = false;
    rerenderModal();
  });
  document.querySelector('[data-action="confirm-gpt-consent"]')?.addEventListener('click', async () => {
    const checked = document.querySelector('#gpt-consent-check')?.checked;
    if (!checked) {
      window.alert('상세 리포트 생성 동의 항목을 확인해 주세요.');
      return;
    }
    await grantGptReportConsent({ consentType: 'GPT_DETAILED_REPORT', granted: true });
    const detailed = await requestDetailedReport({ period: 'LAST_7_DAYS', includeOriginalAudio: false });
    const resultEl = document.querySelector('#detailed-report-result');
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `<h2>GPT 상세 리포트</h2><p>${escapeHtml(detailed.text)}</p><pre class="code-block">${escapeHtml(JSON.stringify(detailed.metadata, null, 2))}</pre>`;
    modalVisible = false;
    rerenderModal();
  });
}

export function mountReportPage() {
  document.querySelector('#open-gpt-consent')?.addEventListener('click', () => {
    modalVisible = true;
    rerenderModal();
  });
  bindModalEvents();
}
