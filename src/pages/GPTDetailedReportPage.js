import { escapeHtml } from '../utils/html.js';

const causeRows = [
  { rank: 1, name: '건조기', value: 52, tone: 'red' },
  { rank: 2, name: '냉장고', value: 21, tone: 'orange' },
  { rank: 3, name: '청소기', value: 16, tone: 'yellow' },
  { rank: 4, name: '세탁기', value: 11, tone: 'green' }
];

const recommendations = [
  { title: '건조기 시간 조정', meta: '부정 집중', tone: 'red', badge: '우선' },
  { title: '저소음 모드 적용', meta: '28% 감소', tone: 'yellow', badge: '권장' },
  { title: '야간 사용 제한', meta: '1.8배 높음', tone: 'green', badge: '권장' }
];

const insightRows = [
  { title: '건조기·야간 급증', meta: '부정 61%' },
  { title: '냉장고 저주파 불만', meta: '22시 이후 민감' },
  { title: '청소기 10분 이내 선호', meta: '초과 시 +22%' }
];

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

function recommendationRow(row) {
  return `
    <li class="gpt-recommendation-row gpt-recommendation-row--${escapeHtml(row.tone)}">
      <span aria-hidden="true"></span>
      <div>
        <strong>${escapeHtml(row.title)}</strong>
        <small>${escapeHtml(row.meta)}</small>
      </div>
      <b>${escapeHtml(row.badge)}</b>
    </li>
  `;
}

function insightRow(row) {
  return `
    <li>
      <span aria-hidden="true"></span>
      <div>
        <strong>${escapeHtml(row.title)}</strong>
        <small>${escapeHtml(row.meta)}</small>
      </div>
    </li>
  `;
}

export async function renderGPTDetailedReportPage() {
  return `
    <section class="page gpt-detailed-page" aria-label="GPT Detailed Report Screen">
      <header class="gpt-detail-header">
        <a class="gpt-detail-back" href="#/reports" aria-label="Back to report">←</a>
        <h1>GPT Detailed Report</h1>
      </header>

      <div class="gpt-detail-grid">
        <section class="gpt-detail-card gpt-sentiment-card">
          <h2>2. 소음 감정 분석</h2>
          <div class="gpt-sentiment-content">
            <div class="gpt-sentiment-donut" aria-label="Negative sentiment 38 percent">
              <strong>38%</strong>
            </div>
            <dl class="gpt-sentiment-list">
              <div><dt><span class="dot dot--red"></span>부정</dt><dd>19건 38%</dd></div>
              <div><dt><span class="dot dot--green"></span>긍정</dt><dd>21건 42%</dd></div>
              <div><dt><span class="dot dot--gray"></span>중립</dt><dd>10건 20%</dd></div>
            </dl>
          </div>
          <p class="gpt-alert-strip">건조기 부정 감정 높음</p>
        </section>

        <section class="gpt-detail-card gpt-cause-card">
          <h2>3. 주요 원인 기기 분석</h2>
          <ol class="gpt-cause-list">
            ${causeRows.map(causeRow).join('')}
          </ol>
        </section>

        <section class="gpt-detail-card gpt-recommendation-card">
          <h2>4. 행동 제안 및 권장 조치</h2>
          <ul class="gpt-recommendation-list">
            ${recommendations.map(recommendationRow).join('')}
          </ul>
        </section>

        <section class="gpt-detail-card gpt-insight-card">
          <h2>5. 유사 사례 및 참고 인사이트</h2>
          <ul class="gpt-insight-list">
            ${insightRows.map(insightRow).join('')}
          </ul>
        </section>

        <section class="gpt-analysis-note">
          <div>
            <span aria-hidden="true">i</span>
            <p><strong>분석 안내</strong>요약 데이터만 사용 · 원음 미포함</p>
          </div>
          <strong class="gpt-confidence-pill"><span aria-hidden="true"></span>소음 인식 신뢰도 92%</strong>
        </section>
      </div>
    </section>
  `;
}
