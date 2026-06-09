import { escapeHtml } from '../utils/html.js';

const notificationTypeText = {
  BIG_NOISE: '큰 소음 감지',
  SENSITIVE_APPLIANCE: '민감 가전 소음 감지',
  COMMAND_STATUS: '제어 명령 상태',
  ROBOT_AVOIDANCE: '로봇청소기 회피 경로',
  ROUTINE_CREATED: '루틴 생성',
  NON_CONTROLLABLE_WARNING: '제어 불가 가전 주의'
};

export function NotificationBanner(notification) {
  if (!notification) {
    return '<div class="notification-banner notification-banner--empty">최근 알림이 없습니다.</div>';
  }
  const type = notificationTypeText[notification.type] ?? notification.type;
  return `
    <section class="notification-banner" data-notification-id="${escapeHtml(notification.id)}">
      <div>
        <span class="notification-banner__type">${escapeHtml(type)}</span>
        <strong>${escapeHtml(notification.title)}</strong>
        <p>${escapeHtml(notification.message)}</p>
      </div>
      <button class="text-button" data-action="mark-latest-read">읽음</button>
    </section>
  `;
}