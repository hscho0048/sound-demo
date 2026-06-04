import mockHomeStatus from '../data/mockHomeStatus.json';
import { request, isMockApiEnabled } from './client.js';

export async function getBasicReport() {
  if (isMockApiEnabled()) {
    return mockHomeStatus.basicReport;
  }
  return request('/api/reports/basic');
}

export async function grantGptReportConsent(consentPayload) {
  if (isMockApiEnabled()) {
    return { consentId: 'consent-demo-001', granted: true, ...consentPayload };
  }
  return request('/api/ai-consents/gpt-report', {
    method: 'POST',
    body: consentPayload
  });
}

export async function requestDetailedReport(reportPayload) {
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
  return request('/api/reports/detailed', {
    method: 'POST',
    body: reportPayload
  });
}
