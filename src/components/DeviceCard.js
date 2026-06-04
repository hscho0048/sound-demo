import { escapeHtml } from '../utils/html.js';

const deviceTypeText = {
  IOT_HUB_PHONE: 'IoT Hub 스마트폰',
  USER_DEVICE_PHONE: '사용자 스마트폰',
  APPLIANCE_SOUND_MODULE: '가전 소리 모듈',
  APPLIANCE_NOISE_METER: '가전 소음 미터',
  ENV_SENSOR: '환경 센서'
};

export function DeviceCard(device) {
  const state = device.connected ? '연결됨' : '연결 끊김';
  const tone = device.connected ? 'online' : 'offline';
  return `
    <article class="device-card device-card--${tone}" data-device-id="${escapeHtml(device.id)}">
      <div>
        <strong>${escapeHtml(device.name)}</strong>
        <p>${escapeHtml(deviceTypeText[device.type] ?? device.type)} · ${escapeHtml(device.roomName ?? '방 미지정')}</p>
      </div>
      <span>${state}</span>
      <small>마지막 확인: ${escapeHtml(device.lastSeenAt ?? '-')}</small>
    </article>
  `;
}
