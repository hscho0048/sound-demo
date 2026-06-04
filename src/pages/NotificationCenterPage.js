import { getNotifications, markNotificationRead } from '../api/notificationApi.js';
import { escapeHtml } from '../utils/html.js';

function notificationRow(notification) {
  return `
    <article class="notification-row ${notification.read ? 'is-read' : ''}" data-notification-id="${escapeHtml(notification.id)}">
      <div>
        <span class="badge">${escapeHtml(notification.type)}</span>
        <h3>${escapeHtml(notification.title)}</h3>
        <p>${escapeHtml(notification.message)}</p>
        <small>${escapeHtml(notification.createdAt ?? '')}</small>
      </div>
      <button data-action="mark-read" ${notification.read ? 'disabled' : ''}>읽음 처리</button>
    </article>
  `;
}

export async function renderNotificationCenterPage() {
  const notifications = await getNotifications();
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Notifications</p>
          <h1>알림 센터</h1>
          <p>큰 소음, 민감 가전, 자동 대응, 로봇청소기 경로 변경, 조절 불가 가전 주의, 루틴 생성 알림을 확인합니다.</p>
        </div>
      </div>
      <div class="card-list card-list--wide">
        ${notifications.map(notificationRow).join('')}
      </div>
    </section>
  `;
}

export function mountNotificationCenterPage() {
  document.querySelectorAll('[data-action="mark-read"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-notification-id]');
      await markNotificationRead(row.dataset.notificationId);
      row.classList.add('is-read');
      button.disabled = true;
    });
  });
}
