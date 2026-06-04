import mockHomeStatus from '../data/mockHomeStatus.json';
import { request, isMockApiEnabled, buildQuery } from './client.js';

export async function getDevices(params = {}) {
  if (isMockApiEnabled()) {
    return mockHomeStatus.devices;
  }
  return request(`/api/devices${buildQuery(params)}`);
}

export async function getDevice(deviceId) {
  if (isMockApiEnabled()) {
    return mockHomeStatus.devices.find((device) => device.id === deviceId) ?? null;
  }
  return request(`/api/devices/${encodeURIComponent(deviceId)}`);
}

export async function registerDevice(payload) {
  if (isMockApiEnabled()) {
    return { id: `dev-${Date.now()}`, ...payload, connected: false };
  }
  return request('/api/devices', { method: 'POST', body: payload });
}

export async function getRuntimeSettings(deviceId) {
  if (isMockApiEnabled()) {
    return {
      deviceId,
      settingsVersion: 'demo-settings-v1',
      sensitiveAppliances: mockHomeStatus.sensitiveAppliances
    };
  }
  return request(`/api/devices/runtime-settings${buildQuery({ deviceId })}`);
}
