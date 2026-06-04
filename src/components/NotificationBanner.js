import { escapeHtml } from '../utils/html.js';

const notificationTypeText = {
  LOUD_NOISE_DETECTED: '큰 소음 감지',
  SENSITIVE_APPLIANCE_DETECTED: '민감 가전 소음 감지',
  AUTO_CONTROL_APPLIED: '자동 대응 적용',
  ROBOT_ROUTE_CHANGED: '로봇청소기 경로 변경',
  NON_CONTROLLABLE_WARNING: '조절 불가 가전 주의',
  ROUTINE_CREATED: '새 루틴 생성'
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
