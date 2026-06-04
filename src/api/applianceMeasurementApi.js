import mockTelemetry from '../data/mockApplianceModuleTelemetry.json';
import { request, isMockApiEnabled, buildQuery } from './client.js';

// Appliance Controller Agent PC가 ESP32-S3에서 받은 INMP441 상대 dB 측정값과
// 재생 상태를 Spring Boot에 업로드한다. Tauri/Web은 그 최신값을 조회한다.

const STALE_THRESHOLD_MS = 10000;

export async function getLatestApplianceMeasurement(params = {}) {
  if (isMockApiEnabled()) {
    const latest = mockTelemetry.latestTelemetry;
    if (params.serviceLabel && latest.serviceLabel !== params.serviceLabel) {
      return null;
    }
    if (params.sourceModuleId && latest.moduleId !== params.sourceModuleId) {
      return null;
    }
    if (params.agentId && latest.agentId !== params.agentId) {
      return null;
    }
    return latest;
  }
  return request(`/api/events/appliance-measurements/latest${buildQuery(params)}`);
}

export async function getApplianceMeasurements(params = {}) {
  if (isMockApiEnabled()) {
    return [mockTelemetry.latestTelemetry];
  }
  return request(`/api/events/appliance-measurements${buildQuery(params)}`);
}

/**
 * 텔레메트리가 stale 한지 판단한다. receivedAt/uploadedAt 기준으로
 * 기준 시간(기본 10초)을 넘으면 stale 로 본다.
 */
export function isTelemetryStale(telemetry, { now = Date.now(), thresholdMs = STALE_THRESHOLD_MS } = {}) {
  if (!telemetry) return true;
  const reference = telemetry.receivedAt ?? telemetry.uploadedAt;
  if (!reference) return true;
  const referenceMs = new Date(reference).getTime();
  if (Number.isNaN(referenceMs)) return true;
  return now - referenceMs > thresholdMs;
}
