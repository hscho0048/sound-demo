import { escapeHtml } from '../utils/html.js';
import { fetchReactions } from '../api/reactions.js';
import { fetchReport } from '../api/reports.js';

// 화면(요약)과 PDF(상세)에서 공통으로 쓰는 마지막 GPT 리포트 본문.
let currentReportText = '';

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

const TIME_BUCKETS = [
  { label: '새벽 (0–6시)', start: 0, end: 6 },
  { label: '오전 (6–12시)', start: 6, end: 12 },
  { label: '오후 (12–18시)', start: 12, end: 18 },
  { label: '저녁/밤 (18–24시)', start: 18, end: 24 }
];

// 백엔드(DB) 반응 + 상세 리포트(GPT)에서 데이터를 조립한다. 하드코딩 더미는 제거되었다.
// 반응 스냅샷 덕분에 각 반응에 가전별 serviceLabel + decibelAvg가 담겨 있어, 가전별 평균
// 소음/반응, 시간대 분포 등 더 구체적인 정보를 만들 수 있다.
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
  // 가전별 집계: 긍정/부정 건수 + 반응 시점 소음(dB) 누적
  const perAppliance = new Map();
  let negDbSum = 0;
  let negDbCount = 0;
  let posDbSum = 0;
  let posDbCount = 0;
  const negByHour = [0, 0, 0, 0];

  for (const r of items) {
    const label = r.serviceLabel || 'manual';
    const bucket = perAppliance.get(label) ?? { pos: 0, neg: 0, dbSum: 0, dbCount: 0 };
    const db = Number(r.decibelAvg);
    const hasDb = Number.isFinite(db);
    if (hasDb) {
      bucket.dbSum += db;
      bucket.dbCount += 1;
    }
    if (r.reactionType === 'POSITIVE') {
      positive += 1;
      bucket.pos += 1;
      if (hasDb) { posDbSum += db; posDbCount += 1; }
    } else if (r.reactionType === 'NEGATIVE') {
      negative += 1;
      bucket.neg += 1;
      negByLabel.set(label, (negByLabel.get(label) ?? 0) + 1);
      if (hasDb) { negDbSum += db; negDbCount += 1; }
      const hour = new Date(r.createdAt).getHours();
      if (!Number.isNaN(hour)) {
        const idx = TIME_BUCKETS.findIndex((b) => hour >= b.start && hour < b.end);
        if (idx >= 0) negByHour[idx] += 1;
      }
    }
    perAppliance.set(label, bucket);
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

  // 가전별 상세 (부정 많은 순)
  const applianceDetail = [...perAppliance.entries()]
    .map(([label, b]) => ({
      name: SERVICE_LABEL_KO[label] || label,
      positive: b.pos,
      negative: b.neg,
      avgDb: b.dbCount ? Math.round(b.dbSum / b.dbCount) : null,
      negRatio: b.pos + b.neg ? Math.round((b.neg / (b.pos + b.neg)) * 100) : 0
    }))
    .sort((a, b) => b.negative - a.negative);

  const avgNegativeDb = negDbCount ? Math.round(negDbSum / negDbCount) : null;
  const avgPositiveDb = posDbCount ? Math.round(posDbSum / posDbCount) : null;
  const maxHour = Math.max(...negByHour, 0);
  const peakBucketIdx = maxHour > 0 ? negByHour.indexOf(maxHour) : -1;
  const timeRows = TIME_BUCKETS.map((b, i) => ({
    label: b.label,
    count: negByHour[i],
    ratio: maxHour ? Math.round((negByHour[i] / maxHour) * 100) : 0,
    peak: i === peakBucketIdx
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

  return {
    positive, negative, total, positiveRatio, negativeRatio, causeRows, reportText,
    applianceDetail, avgNegativeDb, avgPositiveDb, timeRows
  };
}

function applianceDetailRow(row) {
  const avg = row.avgDb != null ? `${row.avgDb} dB` : '--';
  return `
    <tr>
      <td>${escapeHtml(row.name)}</td>
      <td class="num">${row.positive}</td>
      <td class="num">${row.negative}</td>
      <td class="num">${escapeHtml(avg)}</td>
      <td class="num">${row.negRatio}%</td>
    </tr>
  `;
}

function timeRow(row) {
  return `
    <li class="gpt-time-row${row.peak ? ' is-peak' : ''}">
      <span class="gpt-time-label">${escapeHtml(row.label)}</span>
      <span class="gpt-time-track" aria-hidden="true"><i style="width:${row.ratio}%"></i></span>
      <b>${row.count}건</b>
    </li>
  `;
}

// GPT 리포트(마크다운)를 안전하게 HTML로 변환한다. 먼저 전부 escape한 뒤, 우리가
// 허용하는 마크다운 패턴(##/###/####, **굵게**, - 목록, --- 구분선)만 태그로 바꾼다.
// → GPT가 HTML을 내보내도 그대로 escape되어 주입 위험이 없다.
function renderReportMarkdown(markdown) {
  const escapeText = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (t) => escapeText(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const lines = String(markdown).split(/\r?\n/);
  let html = '';
  let inList = false;
  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (/^---+$/.test(line)) {
      closeList();
      html += '<hr />';
      continue;
    }
    let m;
    if ((m = line.match(/^####\s+(.*)/))) {
      closeList();
      html += `<h5>${inline(m[1])}</h5>`;
    } else if ((m = line.match(/^###\s+(.*)/))) {
      closeList();
      html += `<h4>${inline(m[1])}</h4>`;
    } else if ((m = line.match(/^##\s+(.*)/))) {
      closeList();
      html += `<h3>${inline(m[1])}</h3>`;
    } else if ((m = line.match(/^#\s+(.*)/))) {
      closeList();
      html += `<h3 class="gpt-report-title">${inline(m[1])}</h3>`;
    } else if ((m = line.match(/^[-*]\s+(.*)/))) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inline(m[1])}</li>`;
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html;
}

// "## 1. 한눈에 보기" 등 첫 번째 섹션 본문만 뽑아 화면 요약으로 쓴다. 전체 6개 섹션은
// PDF(상세 리포트)로만 내려받게 한다.
function extractSummaryMarkdown(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const headingIdx = [];
  lines.forEach((line, i) => {
    if (/^##\s+/.test(line.trim())) headingIdx.push(i);
  });
  if (headingIdx.length === 0) return String(markdown || '').trim();
  const start = headingIdx[0] + 1;
  const end = headingIdx.length > 1 ? headingIdx[1] : lines.length;
  return lines.slice(start, end).join('\n').trim();
}

export async function renderGPTDetailedReportPage() {
  const data = await loadDetailedReportData();
  currentReportText = data.reportText || '';

  const causeHtml = data.causeRows.length
    ? data.causeRows.map(causeRow).join('')
    : '<li class="gpt-cause-row">부정 반응 데이터가 아직 없습니다.</li>';

  // 화면에는 진짜 요약(첫 섹션)만 보여주고, 전체 분석은 PDF로 내려받게 한다.
  const summaryMd = data.reportText ? extractSummaryMarkdown(data.reportText) : '';
  const analysisHtml = data.reportText
    ? `<div class="gpt-report-md gpt-report-summary">${renderReportMarkdown(summaryMd || data.reportText)}</div>
       <p class="gpt-summary-hint">전체 분석은 상단의 <strong>상세 리포트 보기</strong>에서 확인하세요.</p>`
    : '<p class="gpt-analysis-text">아직 생성된 GPT 상세 리포트가 없습니다. 리포트 화면에서 "GPT 리포트 생성하기"를 눌러 주세요.</p>';

  const applianceRowsHtml = data.applianceDetail.length
    ? data.applianceDetail.map(applianceDetailRow).join('')
    : '<tr><td colspan="5">아직 수집된 가전별 반응이 없습니다.</td></tr>';

  const timeRowsHtml = data.timeRows.some((r) => r.count > 0)
    ? data.timeRows.map(timeRow).join('')
    : '<li class="gpt-time-row"><span class="gpt-time-label">부정 반응 데이터 없음</span></li>';

  // 긍정/부정 반응 시점의 평균 소음 비교 인사이트
  const dbInsight =
    data.avgNegativeDb != null && data.avgPositiveDb != null
      ? `불편 반응 시 평균 ${data.avgNegativeDb} dB · 만족 반응 시 평균 ${data.avgPositiveDb} dB`
      : data.avgNegativeDb != null
        ? `불편 반응 시 평균 소음 ${data.avgNegativeDb} dB`
        : '아직 소음과 반응을 연결할 데이터가 부족합니다.';

  return `
    <section class="page gpt-detailed-page" aria-label="GPT Detailed Report Screen">
      <header class="gpt-detail-header">
        <a class="gpt-detail-back" href="#/reports" aria-label="리포트로 돌아가기"><svg class="back-arrow-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></a>
        <h1>GPT 상세 리포트</h1>
        <button type="button" class="gpt-detail-pdf" data-view-report ${data.reportText ? '' : 'disabled'}>상세 리포트 보기</button>
      </header>

      <div class="gpt-detail-grid">
        <section class="gpt-detail-card gpt-sentiment-card">
          <h2>1. 소음 감정 분석</h2>
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
          <h2>2. 주요 원인 기기 분석</h2>
          <ol class="gpt-cause-list">
            ${causeHtml}
          </ol>
        </section>

        <section class="gpt-detail-card gpt-appliance-detail-card">
          <h2>3. 가전별 소음·반응 상세</h2>
          <table class="gpt-appliance-table">
            <thead>
              <tr><th>가전</th><th class="num">만족</th><th class="num">불편</th><th class="num">평균 소음</th><th class="num">불편 비율</th></tr>
            </thead>
            <tbody>${applianceRowsHtml}</tbody>
          </table>
          <p class="gpt-db-insight">${escapeHtml(dbInsight)}</p>
        </section>

        <section class="gpt-detail-card gpt-time-card">
          <h2>4. 불편 반응 시간대 분포</h2>
          <ul class="gpt-time-list">
            ${timeRowsHtml}
          </ul>
        </section>

        <section class="gpt-detail-card gpt-recommendation-card">
          <h2>5. AI 분석 요약</h2>
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

// 전체 GPT 리포트(6개 섹션)를 앱 내부 모달로 띄워 보여준다.
let detailModalCleanup = null;

function closeDetailReportModal() {
  detailModalCleanup?.();
  detailModalCleanup = null;
}

function openDetailReportModal() {
  if (!currentReportText) return;
  closeDetailReportModal();

  const overlay = document.createElement('div');
  overlay.className = 'gpt-report-modal';
  overlay.innerHTML = `
    <div class="gpt-report-modal__backdrop" data-modal-close></div>
    <div class="gpt-report-modal__panel" role="dialog" aria-modal="true" aria-label="GPT 상세 리포트 전체 보기">
      <header class="gpt-report-modal__head">
        <h2>GPT 상세 리포트</h2>
        <button type="button" class="gpt-report-modal__close" data-modal-close aria-label="닫기">&times;</button>
      </header>
      <div class="gpt-report-modal__body">
        <div class="gpt-report-md">${renderReportMarkdown(currentReportText)}</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const onKey = (event) => { if (event.key === 'Escape') closeDetailReportModal(); };
  overlay.querySelectorAll('[data-modal-close]').forEach((el) =>
    el.addEventListener('click', closeDetailReportModal)
  );
  document.addEventListener('keydown', onKey);

  detailModalCleanup = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  };
}

export function mountGPTDetailedReportPage() {
  const viewButton = document.querySelector('[data-view-report]');
  if (viewButton && !viewButton.disabled) {
    viewButton.addEventListener('click', openDetailReportModal);
  }
}

export function cleanupGPTDetailedReportPage() {
  closeDetailReportModal();
}
