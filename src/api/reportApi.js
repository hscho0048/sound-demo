import mockHomeStatus from '../data/mockHomeStatus.json';
import { request, requestLive, isMockApiEnabled, isDemoMode } from './client.js';
import { defaultBasicReport, withApiFallback } from './fallbacks.js';

// 데모 모드에서 실제 GPT 호출이 불가할 때 보여줄 리포트 본문(시연용 하드코딩).
// 스토리보드 내용(세탁기 불편 비율 상승, 로봇청소기 개선, 민감가전 권장)에 맞춘다.
const DEMO_REPORT_MARKDOWN = [
  '## 핵심 요약',
  '최근 3일간 **세탁기**에 대한 불편 반응이 빠르게 늘어 불편 비율이 **약 70%**까지 상승했습니다. 반면 저소음 모드를 적용한 **로봇청소기**는 불편 비율이 **약 40%**로 낮아지며 개선 흐름을 보였습니다.',
  '',
  '## 시간대 분석',
  '불편 반응의 대부분은 **저녁(18~24시)** 시간대에 집중되었습니다. 자녀의 귀가 시간과 세탁기 가동 시간이 겹치는 구간입니다.',
  '',
  '## 권장 조치',
  '- 세탁기를 **민감 가전**으로 설정해 자녀가 집에 있는 동안 저소음 모드로 운영하세요.',
  '- 세탁 예약은 자녀가 학교에 있는 낮 시간대로 옮기는 것을 추천합니다.',
  '- 로봇청소기의 저소음 모드는 효과가 확인되어 그대로 유지하는 것이 좋습니다.',
  '',
  '## 종합 의견',
  '소리 환경이 점차 개선되고 있습니다. 세탁기 운영 시간만 조정하면 저녁 시간대의 불편을 크게 줄일 수 있습니다.'
].join('\n');

function reportWindow() {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}

function normalizeBasicReport(report) {
  if (report.eventCount !== undefined || !report.summary) {
    return report;
  }
  const byService = report.summary.byService ?? [];
  const top = byService[0] ?? {};
  const reactionRows = report.summary.reactions ?? [];
  const negative = reactionRows.find((row) => row.reaction_type === 'NEGATIVE' || row.reactionType === 'NEGATIVE');
  return {
    reportId: report.reportId,
    period: '최근 7일',
    summary: report.reportText,
    eventCount: byService.reduce((sum, row) => sum + Number(row.event_count ?? row.eventCount ?? 0), 0),
    negativeReactionCount: Number(negative?.count ?? 0),
    topServiceLabel: top.service_label ?? top.serviceLabel ?? '-'
  };
}

export async function getBasicReport() {
  if (isMockApiEnabled()) {
    return mockHomeStatus.basicReport;
  }
  // MVP 계약: POST /api/reports/basic 이 새 리포트를 생성해 반환한다.
  const query = new URLSearchParams(reportWindow()).toString();
  const report = await request(`/api/reports/basic?${query}`, { method: 'POST' })
    .catch((error) => withApiFallback(error, defaultBasicReport, 'basic report'));
  return normalizeBasicReport(report);
}

// MVP 기준: GPT 동의는 users.ai_data_use_consent로 관리한다 (ai_consents API 삭제).
export async function grantGptReportConsent(consentPayload = {}) {
  // 데모 모드: GPT 리포트는 "유지" 대상이므로 동의도 실제 백엔드에 반영한다.
  if (isDemoMode()) {
    return requestLive('/api/users/me', {
      method: 'PATCH',
      body: { aiDataUseConsent: consentPayload.granted ?? true }
    }).then((profile) => ({ granted: profile?.aiDataUseConsent ?? true }))
      .catch(() => ({ granted: true, ...consentPayload }));
  }
  if (isMockApiEnabled()) {
    return { granted: true, ...consentPayload };
  }
  return request('/api/users/me', {
    method: 'PATCH',
    body: { aiDataUseConsent: consentPayload.granted ?? true }
  }).then((profile) => ({ granted: profile?.aiDataUseConsent ?? true }))
    .catch((error) => withApiFallback(error, () => ({ granted: true, ...consentPayload }), 'GPT report consent'));
}

export async function requestDetailedReport(reportPayload) {
  const body = reportPayload?.periodStart && reportPayload?.periodEnd ? reportPayload : reportWindow();
  // 데모 모드: GPT 상세 리포트는 유일하게 실제 백엔드(OpenAI)를 호출하는 기능이다.
  // 목 차단을 우회해 진짜 리포트를 받아오고, 오프라인/실패 시에만 로컬 폴백 텍스트를 보여준다.
  if (isDemoMode()) {
    const detailed = await requestLive('/api/reports/detailed', {
      method: 'POST',
      body
    }).catch(() => ({
      reportId: 'report-detailed-local-001',
      reportText: DEMO_REPORT_MARKDOWN,
      metadata: { source: 'demo-local-fallback', originalAudioSent: false }
    }));
    return {
      ...detailed,
      // 실호출이 reportId만 주고 본문이 비어 오는 경우에도 상세 화면이 비지 않도록 데모 본문으로 보강.
      text: detailed.text ?? detailed.reportText ?? DEMO_REPORT_MARKDOWN,
      metadata: detailed.metadata ?? detailed.raw?.metadata
    };
  }
  if (isMockApiEnabled()) {
    return {
      reportId: 'report-detailed-demo-001',
      text: '요약 데이터 기준으로 보면 로봇청소기 소음은 거실 민감 시간대에 집중되어 있습니다. 저녁 시간에는 회피 구역을 유지하고, 세탁기는 20시 이전 사용을 권장합니다.',
      metadata: {
        source: 'mock-summary-only',
        originalAudioSent: false
      }
    };
  }
  const detailed = await request('/api/reports/detailed', {
    method: 'POST',
    body
  }).catch((error) => withApiFallback(error, () => ({
    reportId: 'report-detailed-local-001',
    reportText: 'API is unavailable, so this local fallback report summarizes the demo noise data only.',
    metadata: {
      source: 'local-fallback-summary-only',
      originalAudioSent: false
    }
  }), 'detailed report'));
  return {
    ...detailed,
    text: detailed.text ?? detailed.reportText,
    metadata: detailed.metadata ?? detailed.raw?.metadata
  };
}
