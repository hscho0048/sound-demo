import { requestDetailedReport, grantGptReportConsent } from '../api/reportApi.js';
import { fetchReactions } from '../api/reactions.js';
import { mountGptDetailReportPopUp, renderGptDetailReportPopUp } from './gptDetailReportPopUp.js';
import { createReportFaceScene } from '../three/reportFaceScene.js';
import { escapeHtml } from '../utils/html.js';

const SERVICE_LABEL_KO = {
  robot_vacuum: '로봇청소기',
  washing_machine: '세탁기',
  dishwasher: '식기세척기',
  refrigerator: '냉장고',
  background: '배경음',
  manual: '수동 입력'
};

// 백엔드(DB) 반응 데이터에서 집계되는 값들. 하드코딩 더미는 제거되었다.
let applianceReports = [];
let reactionSummary = { positive: 0, negative: 0 };
let sensitivityRanking = [];

async function loadReportData() {
  let items = [];
  try {
    const resp = await fetchReactions({ size: 200 });
    items = resp?.items ?? [];
  } catch (error) {
    console.warn('[SoundCare] 리포트 반응 데이터 로드 실패', error);
    items = [];
  }

  const byLabel = new Map();
  let positive = 0;
  let negative = 0;
  for (const r of items) {
    const label = r.serviceLabel || 'manual';
    if (!byLabel.has(label)) byLabel.set(label, { positive: 0, negative: 0 });
    const bucket = byLabel.get(label);
    if (r.reactionType === 'POSITIVE') {
      bucket.positive += 1;
      positive += 1;
    } else if (r.reactionType === 'NEGATIVE') {
      bucket.negative += 1;
      negative += 1;
    }
  }

  applianceReports = [...byLabel.entries()].map(([label, count]) => ({
    name: SERVICE_LABEL_KO[label] || label,
    positive: `+${count.positive}`,
    negative: `-${count.negative}`
  }));
  reactionSummary = { positive, negative };
  sensitivityRanking = [...byLabel.entries()]
    .map(([label, count]) => ({ name: SERVICE_LABEL_KO[label] || label, negative: count.negative }))
    .filter((row) => row.negative > 0)
    .sort((a, b) => b.negative - a.negative)
    .slice(0, 3);
}

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
  await loadReportData();

  const totalReactions = reactionSummary.positive + reactionSummary.negative;
  const positiveRatio = totalReactions ? Math.round((reactionSummary.positive / totalReactions) * 100) : 0;
  const negativeRatio = 100 - positiveRatio;
  const maxNegative = sensitivityRanking[0]?.negative || 1;
  const rankingBarClasses = ['ranking-bar--danger', 'ranking-bar--orange', 'ranking-bar--yellow'];
  const rankingHtml = sensitivityRanking.length
    ? sensitivityRanking
        .map(
          (row, index) => `
            <span role="listitem">
              <span>${index + 1} ${escapeHtml(row.name)} ${row.negative}</span>
              <span class="ranking-bar ${rankingBarClasses[index] ?? 'ranking-bar--yellow'}"><span style="width: ${Math.round(
                (row.negative / maxNegative) * 100
              )}%"></span></span>
            </span>
          `
        )
        .join('')
    : '<span role="listitem"><span>부정 반응 데이터 없음</span></span>';
  const topNegative = sensitivityRanking[0];

  const applianceGrid = applianceReports.length
    ? applianceReports.map(applianceCard).join('')
    : '<p class="device-list-empty">아직 수집된 반응 데이터가 없습니다.</p>';

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
        ${applianceGrid}
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
            <span class="reaction-pill reaction-pill--positive">긍정 ${reactionSummary.positive}</span>
            <span class="reaction-pill reaction-pill--negative">부정 ${reactionSummary.negative}</span>
          </span>
          <span class="reaction-split-bar" aria-hidden="true">
            <span class="reaction-split-bar__positive" style="width: ${positiveRatio}%"></span>
            <span class="reaction-split-bar__negative" style="width: ${negativeRatio}%"></span>
          </span>
        </span>

        <span class="report-ranking-block">
          <span class="report-panel-heading">소음 민감 순위</span>
          <span class="sensitivity-ranking" role="list">
            ${rankingHtml}
          </span>
        </span>

        <span class="report-caution-box" aria-label="주의">
          <span class="report-panel-heading">주의</span>
          <span>${topNegative ? `${escapeHtml(topNegative.name)} 부정 반응 최다` : '주의 항목 없음'}</span>
          <strong>${topNegative ? '저소음 모드 권장' : '안정적입니다'}</strong>
        </span>
      </button>

      <section class="report-lower-grid" aria-label="리포트 상세">
        <article class="report-detail-card low-noise-detail-card">
          <h2><span class="detail-card-icon" aria-hidden="true"></span>긍정 반응 비율 상세</h2>
          <div class="low-noise-content">
            <div class="donut-chart" aria-label="긍정 반응 비율 ${positiveRatio}퍼센트">
              <strong>${positiveRatio}%</strong>
              <span>긍정 비율</span>
            </div>
            <div class="donut-legend">
              <p><span class="legend-dot legend-dot--red"></span><strong>긍정</strong><b>${positiveRatio}% (${reactionSummary.positive}건)</b></p>
              <p><span class="legend-dot legend-dot--gray"></span><strong>부정</strong><b>${negativeRatio}% (${reactionSummary.negative}건)</b></p>
              <small>저장된 반응 총 ${totalReactions}건 기준</small>
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
      try {
        // 1) AI 데이터 사용 동의를 서버에 반영 (users.ai_data_use_consent)
        if (status) status.textContent = 'AI 데이터 사용 동의를 저장하는 중입니다...';
        await grantGptReportConsent({ granted: true });
        // 2) 상세 리포트 생성 요청
        if (status) status.textContent = '상세 리포트를 생성하는 중입니다...';
        const report = await requestDetailedReport();
        if (report?.reportId) {
          window.localStorage.setItem('soundcare.lastDetailedReportId', report.reportId);
        }
        if (status) status.textContent = '상세 리포트가 생성되었습니다.';
        navigate('#/reports/gpt-detailed');
      } catch (error) {
        if (status) status.textContent = `상세 리포트 생성에 실패했습니다: ${error.message}`;
      }
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
