import { requestDetailedReport } from '../api/reportApi.js';
import { mountGptDetailReportPopUp, renderGptDetailReportPopUp } from './gptDetailReportPopUp.js';
import { createReportFaceScene } from '../three/reportFaceScene.js';
import { escapeHtml } from '../utils/html.js';

const applianceReports = [
  { name: '세탁기', positive: '+1', negative: '-2' },
  { name: '냉장고', positive: '+5', negative: '-4' },
  { name: '건조기', positive: '+3', negative: '-10' },
  { name: '청소기', positive: '+12', negative: '-3' }
];

const REPORT_PERIOD_OPTIONS = ['조회 기간', '최근 3일', '최근 1주', '최근 1달'];

let faceControllers = [];
let reportPeriodCleanup = null;

function reportPeriodMenu() {
  return `
    <div class="report-period-dropdown">
      <button type="button" class="report-period-button" data-report-period-trigger>
        ${escapeHtml(REPORT_PERIOD_OPTIONS[0])}
      </button>
      <div class="report-period-menu" data-report-period-menu hidden>
        ${REPORT_PERIOD_OPTIONS.map(
          (option) => `
            <button type="button" data-report-period-option="${escapeHtml(option)}">
              ${escapeHtml(option)}
            </button>
          `
        ).join('')}
      </div>
    </div>
  `;
}

function parseReactionCount(value) {
  const number = Number.parseInt(String(value ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(number) ? Math.abs(number) : 0;
}

function getReactionMood(device) {
  const positive = parseReactionCount(device.positive);
  const negative = parseReactionCount(device.negative);
  const difference = positive - negative;

  if (Math.abs(difference) <= 1) return 'neutral';
  return difference > 0 ? 'positive' : 'negative';
}

function applianceCard(device, index) {
  return `
    <article class="report-appliance-card">
      <h2>${escapeHtml(device.name)}</h2>
      <button
        type="button"
        class="report-appliance-metrics"
        data-reaction-history-link
        aria-label="${escapeHtml(device.name)} 반응 기록 열기"
      >
        <span class="report-metric-box report-metric-box--soft">
          <strong>${escapeHtml(device.positive)}</strong>
          <span>긍정</span>
        </span>
        <span class="report-metric-box">
          <strong>${escapeHtml(device.negative)}</strong>
          <span>부정</span>
        </span>
      </button>
      <div
        class="report-face-viewer"
        data-face-mood="${escapeHtml(getReactionMood(device))}"
        aria-label="${escapeHtml(device.name)} 반응 얼굴"
        role="img"
      ></div>
      <button
        class="report-face-trigger"
        type="button"
        data-face-trigger="${index}"
        aria-label="${escapeHtml(device.name)} 반응 애니메이션"
      ></button>
    </article>
  `;
}

export async function renderReportPage() {
  return `
    <section class="page basic-report-page" aria-label="기본 리포트 화면">
      <header class="basic-report-header">
        <div class="basic-report-heading">
          <h1>리포트</h1>
          <p>저장된 이벤트를 기반으로 한 규칙 기반 요약 · 서버 AI 추론 없음</p>
        </div>
        ${reportPeriodMenu()}
      </header>

      <section class="report-appliance-grid" aria-label="기기별 반응 카드">
        ${applianceReports.map(applianceCard).join('')}
      </section>

      <button
        type="button"
        class="report-overview-panel"
        data-reaction-history-link
        aria-label="반응 기록 열기"
      >
        <span class="report-summary-block">
          <span class="report-panel-heading">반응 요약</span>
          <span class="reaction-pill-row">
            <span class="reaction-pill reaction-pill--positive">긍정 21</span>
            <span class="reaction-pill reaction-pill--negative">부정 19</span>
          </span>
          <span class="reaction-split-bar" aria-hidden="true">
            <span class="reaction-split-bar__positive"></span>
            <span class="reaction-split-bar__negative"></span>
          </span>
        </span>

        <span class="report-ranking-block">
          <span class="report-panel-heading">소음 민감 순위</span>
          <span class="sensitivity-ranking" role="list">
            <span role="listitem">
              <span>1 건조기 10</span>
              <span class="ranking-bar ranking-bar--danger"><span style="width: 100%"></span></span>
            </span>
            <span role="listitem">
              <span>2 냉장고 4</span>
              <span class="ranking-bar ranking-bar--orange"><span style="width: 38%"></span></span>
            </span>
            <span role="listitem">
              <span>3 청소기 3</span>
              <span class="ranking-bar ranking-bar--yellow"><span style="width: 30%"></span></span>
            </span>
          </span>
        </span>

        <span class="report-caution-box" aria-label="주의">
          <span class="report-panel-heading">주의</span>
          <span>건조기 부정 반응 최다</span>
          <strong>저소음 모드 권장</strong>
        </span>
      </button>

      <section class="report-lower-grid" aria-label="리포트 상세">
        <article class="report-detail-card low-noise-detail-card">
          <h2><span class="detail-card-icon" aria-hidden="true"></span>저소음 모드 전환 비율 상세</h2>
          <div class="low-noise-content">
            <div class="donut-chart" aria-label="저소음 모드 전환 비율 58퍼센트">
              <strong>58%</strong>
              <span>전환 비율</span>
            </div>
            <div class="donut-legend">
              <p><span class="legend-dot legend-dot--red"></span><strong>전환됨</strong><b>58% (29건)</b></p>
              <p><span class="legend-dot legend-dot--gray"></span><strong>전환되지 않음</strong><b>42% (21건)</b></p>
              <small>최근 7일 총 이벤트 50건 기준</small>
            </div>
          </div>
        </article>

        <article class="report-detail-card gpt-report-card">
          <h2><span class="detail-card-icon" aria-hidden="true"></span>GPT 리포트 생성</h2>
          <p>최근 7일 데이터를 기반으로<br />AI 분석 리포트를 생성합니다.</p>
          <div class="gpt-report-note">
            <span aria-hidden="true"></span>
            요약 데이터만 전송되며 원음은 포함되지 않습니다.
          </div>
          <button type="button" id="generate-gpt-report">GPT 리포트 생성하기</button>
          <small id="gpt-report-status" aria-live="polite"></small>
        </article>
      </section>

      ${renderGptDetailReportPopUp()}
    </section>
  `;
}

export function mountReportPage({ navigate } = {}) {
  cleanupReportPage();
  faceControllers = Array.from(document.querySelectorAll('.report-face-viewer')).map((viewer) =>
    createReportFaceScene(viewer, {
      mood: viewer.dataset.faceMood
    })
  );

  const openReactionHistory = () => {
    navigate('#/reports/reaction-history');
  };

  document.querySelectorAll('[data-reaction-history-link]').forEach((link) => {
    link.addEventListener('click', openReactionHistory);
  });

  document.querySelectorAll('.report-face-trigger').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.faceTrigger);
      const canvas = document.querySelectorAll('.report-face-viewer canvas')[index];
      canvas?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
  });

  const periodTrigger = document.querySelector('[data-report-period-trigger]');
  const periodMenu = document.querySelector('[data-report-period-menu]');

  periodTrigger?.addEventListener('click', () => {
    if (periodMenu) periodMenu.hidden = !periodMenu.hidden;
  });

  document.querySelectorAll('[data-report-period-option]').forEach((button) => {
    button.addEventListener('click', () => {
      if (periodTrigger) periodTrigger.textContent = button.dataset.reportPeriodOption;
      if (periodMenu) periodMenu.hidden = true;
    });
  });

  const closePeriodMenu = (event) => {
    if (!event.target.closest('.report-period-dropdown') && periodMenu) {
      periodMenu.hidden = true;
    }
  };
  document.addEventListener('click', closePeriodMenu);
  reportPeriodCleanup = () => document.removeEventListener('click', closePeriodMenu);

  const popupController = mountGptDetailReportPopUp({
    onAgree: async () => {
      const status = document.querySelector('#gpt-report-status');
      if (status) status.textContent = '상세 리포트를 생성하는 중입니다...';
      const report = await requestDetailedReport();
      if (report?.reportId) {
        window.localStorage.setItem('soundcare.lastDetailedReportId', report.reportId);
      }
      if (status) status.textContent = '상세 리포트가 생성되었습니다.';
      navigate('#/reports/gpt-detailed');
    }
  });

  document.querySelector('#generate-gpt-report')?.addEventListener('click', async () => {
    const status = document.querySelector('#gpt-report-status');
    if (status) status.textContent = '';
    popupController.openPopup();
  });

}

export function cleanupReportPage() {
  faceControllers.forEach((controller) => controller.dispose?.());
  faceControllers = [];
  reportPeriodCleanup?.();
  reportPeriodCleanup = null;
}
