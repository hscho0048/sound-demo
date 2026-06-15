import { escapeHtml } from '../utils/html.js';
import { fetchReactions } from '../api/reactions.js';
import { fetchReport } from '../api/reports.js';

const SERVICE_LABEL_KO = {
  robot_vacuum: '로봇청소기',
  washing_machine: '세탁기',
  dishwasher: '식기세척기',
  refrigerator: '냉장고',
  background: '배경음',
  manual: '수동 입력'
};

const CAUSE_TONES = ['red', 'orange', 'yellow', 'green'];

function causeRow(row) {
  return `
    <li class="gpt-cause-row gpt-cause-row--${escapeHtml(row.tone)}">
      <span>${escapeHtml(row.rank)}</span>
      <strong>${escapeHtml(row.name)}</strong>
      <div class="gpt-cause-track" aria-hidden="true"><i style="width: ${Number(row.value) || 0}%"></i></div>
      <b>${escapeHtml(row.value)}%</b>
    </li>
  `;
}

// 백엔드(DB) 반응 + 상세 리포트(GPT)에서 데이터를 조립한다. 하드코딩 더미는 제거되었다.
async function loadDetailedReportData() {
  let items = [];
  try {
    const resp = await fetchReactions({ size: 200 });
    items = resp?.items ?? [];
  } catch (error) {
    items = [];
  }

  let positive = 0;
  let negative = 0;
  const negByLabel = new Map();
  for (const r of items) {
    if (r.reactionType === 'POSITIVE') positive += 1;
    else if (r.reactionType === 'NEGATIVE') {
      negative += 1;
      const label = r.serviceLabel || 'manual';
      negByLabel.set(label, (negByLabel.get(label) ?? 0) + 1);
    }
  }
  const total = positive + negative;
  const negativeRatio = total ? Math.round((negative / total) * 100) : 0;
  const positiveRatio = total ? Math.round((positive / total) * 100) : 0;

  const causeRows = [...negByLabel.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count], index) => ({
      rank: index + 1,
      name: SERVICE_LABEL_KO[label] || label,
      value: negative ? Math.round((count / negative) * 100) : 0,
      tone: CAUSE_TONES[index] ?? 'green'
    }));

  // GPT 상세 리포트 텍스트 (리포트 화면에서 생성 시 localStorage에 reportId 저장)
  let reportText = '';
  try {
    const reportId = window.localStorage.getItem('soundcare.lastDetailedReportId');
    if (reportId) {
      const report = await fetchReport(reportId);
      reportText = report?.reportText ?? report?.text ?? '';
    }
  } catch (error) {
    reportText = '';
  }

  return { positive, negative, total, positiveRatio, negativeRatio, causeRows, reportText };
}

export async function renderGPTDetailedReportPage() {
  const data = await loadDetailedReportData();

  const causeHtml = data.causeRows.length
    ? data.causeRows.map(causeRow).join('')
    : '<li class="gpt-cause-row">부정 반응 데이터가 아직 없습니다.</li>';

  const analysisHtml = data.reportText
    ? `<p class="gpt-analysis-text">${escapeHtml(data.reportText)}</p>`
    : '<p class="gpt-analysis-text">아직 생성된 GPT 상세 리포트가 없습니다. 리포트 화면에서 "GPT 리포트 생성하기"를 눌러 주세요.</p>';

  return `
    <section class="page gpt-detailed-page" aria-label="GPT Detailed Report Screen">
      <header class="gpt-detail-header">
        <a class="gpt-detail-back" href="#/reports" aria-label="리포트로 돌아가기"><svg class="back-arrow-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></a>
        <h1>GPT 상세 리포트</h1>
      </header>

      <div class="gpt-detail-grid">
        <section class="gpt-detail-card gpt-sentiment-card">
          <h2>2. 소음 감정 분석</h2>
          <div class="gpt-sentiment-content">
            <div class="gpt-sentiment-donut" aria-label="부정 반응 ${data.negativeRatio} 퍼센트">
              <strong>${data.negativeRatio}%</strong>
            </div>
            <dl class="gpt-sentiment-list">
              <div><dt><span class="dot dot--red"></span>부정</dt><dd>${data.negative}건 ${data.negativeRatio}%</dd></div>
              <div><dt><span class="dot dot--green"></span>긍정</dt><dd>${data.positive}건 ${data.positiveRatio}%</dd></div>
            </dl>
          </div>
          <p class="gpt-alert-strip">${data.causeRows[0] ? `${escapeHtml(data.causeRows[0].name)} 부정 감정 높음` : '주의 항목 없음'}</p>
        </section>

        <section class="gpt-detail-card gpt-cause-card">
          <h2>3. 주요 원인 기기 분석</h2>
          <ol class="gpt-cause-list">
            ${causeHtml}
          </ol>
        </section>

        <section class="gpt-detail-card gpt-recommendation-card">
          <h2>4. AI 분석 요약</h2>
          ${analysisHtml}
        </section>

        <section class="gpt-analysis-note">
          <div>
            <span aria-hidden="true">i</span>
            <p><strong>분석 안내</strong>요약 데이터만 사용 · 원음 미포함</p>
          </div>
          <strong class="gpt-confidence-pill"><span aria-hidden="true"></span>저장된 반응 ${data.total}건 기준</strong>
        </section>
      </div>
    </section>
  `;
}
