import mockTelemetry from '../data/mockApplianceModuleTelemetry.json';
import { request, isMockApiEnabled, buildQuery } from './client.js';

// Appliance Controller Agent PC 상태를 조회한다. Agent는 ESP32-S3와 USB Serial로
// 통신하는 주체이며, Tauri/Web은 Agent 상태만 표시한다.

export async function getDeviceAgents(params = {}) {
  if (isMockApiEnabled()) {
    return mockTelemetry.deviceAgents;
  }
  return request(`/api/device-agents${buildQuery(params)}`);
}

export async function getDeviceAgent(agentId) {
  if (isMockApiEnabled()) {
    return mockTelemetry.deviceAgents.find((agent) => agent.agentId === agentId) ?? null;
  }
  return request(`/api/device-agents/${encodeURIComponent(agentId)}`);
}
