import mockHomeStatus from '../data/mockHomeStatus.json';
import { request, isMockApiEnabled, buildQuery } from './client.js';
import { defaultDevices, defaultSensitiveAppliances, withApiFallback } from './fallbacks.js';

function normalizeDevice(device) {
  if (!device) return null;
  return {
    ...device,
    id: device.id ?? device.deviceId,
    type: device.type ?? device.deviceType,
    connected: device.connected ?? device.active ?? false,
    roomName: device.roomName ?? (device.roomId ? '등록된 방' : '방 미지정')
  };
}

export async function getDevices(params = {}) {
  if (isMockApiEnabled()) {
    return mockHomeStatus.devices.map(normalizeDevice);
  }
  const devices = await request(`/api/devices${buildQuery(params)}`)
    .catch((error) => withApiFallback(error, defaultDevices, 'devices'));
  return devices.map(normalizeDevice);
}

export async function getDevice(deviceId) {
  if (isMockApiEnabled()) {
    return mockHomeStatus.devices.map(normalizeDevice).find((device) => device.id === deviceId) ?? null;
  }
  const device = await request(`/api/devices/${encodeURIComponent(deviceId)}`)
    .catch((error) => withApiFallback(error, () => (
      defaultDevices().find((item) => item.id === deviceId || item.deviceId === deviceId) ?? null
    ), 'device detail'));
  return normalizeDevice(device);
}

export async function registerDevice(payload) {
  if (isMockApiEnabled()) {
    return { id: `dev-${Date.now()}`, ...payload, connected: false };
  }
  return request('/api/devices', { method: 'POST', body: payload })
    .catch((error) => withApiFallback(error, () => ({ id: `dev-local-${Date.now()}`, ...payload, connected: false }), 'device registration'));
}

// 사용자 등록 기기 삭제 (DELETE /api/user-devices/{id}). 실패 시 예외를 던져 호출부에서 처리.
export async function deleteUserDevice(registeredDeviceId) {
  if (isMockApiEnabled()) {
    return { deleted: true };
  }
  return request(`/api/user-devices/${encodeURIComponent(registeredDeviceId)}`, { method: 'DELETE' });
}

export async function getRuntimeSettings(deviceId) {
  if (isMockApiEnabled()) {
    return {
      deviceId,
      settingsVersion: 'demo-settings-v1',
      sensitiveAppliances: mockHomeStatus.sensitiveAppliances
    };
  }
  return request(`/api/settings/runtime${buildQuery({ deviceId })}`)
    .catch((error) => withApiFallback(error, () => ({
      deviceId,
      settingsVersion: 'local-fallback-settings-v1',
      sensitiveAppliances: defaultSensitiveAppliances()
    }), 'runtime settings'));
}
