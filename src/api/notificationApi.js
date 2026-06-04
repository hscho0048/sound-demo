import mockHomeStatus from '../data/mockHomeStatus.json';
import { request, isMockApiEnabled, buildQuery, API_BASE_URL } from './client.js';

export async function getRecentNotifications(limit = 5) {
  if (isMockApiEnabled()) {
    return mockHomeStatus.notifications.slice(0, limit);
  }
  return request(`/api/notifications/recent${buildQuery({ limit })}`);
}

export async function getNotifications(params = {}) {
  if (isMockApiEnabled()) {
    return mockHomeStatus.notifications;
  }
  return request(`/api/notifications${buildQuery(params)}`);
}

export async function markNotificationRead(notificationId) {
  if (isMockApiEnabled()) {
    return { id: notificationId, read: true };
  }
  return request(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH'
  });
}

export function openNotificationWebSocket(onMessage) {
  // TODO: 백엔드 WebSocket 엔드포인트가 확정되면 인증 헤더 또는 query token 방식을 맞춘다.
  const url = API_BASE_URL.replace(/^http/, 'ws') + '/ws/notifications';
  const socket = new WebSocket(url);
  socket.addEventListener('message', (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      onMessage({ type: 'UNKNOWN', raw: event.data });
    }
  });
  return socket;
}
