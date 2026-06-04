import { getCurrentHomeStatus } from '../api/eventApi.js';
import { markNotificationRead } from '../api/notificationApi.js';
import { DecibelBadge } from '../components/DecibelBadge.js';
import { DeviceCard } from '../components/DeviceCard.js';
import { NotificationBanner } from '../components/NotificationBanner.js';
import { ReportCard } from '../components/ReportCard.js';
import { RoutineCard } from '../components/RoutineCard.js';
import { StatusCard } from '../components/StatusCard.js';

function statusMarkup(status) {
  return `
    <section class="dashboard-grid">
      ${StatusCard({ title: '현재 상태', value: status.currentNoiseState, meta: status.roomName, tone: 'accent' })}
      ${StatusCard({ title: '서비스 라벨', value: status.currentServiceLabel, meta: `모델: ${status.currentModelLabel}` })}
      ${StatusCard({ title: '신뢰도', value: `${Math.round(status.confidence * 100)}%`, meta: 'YAMNet TFLite 결과' })}
      ${StatusCard({ title: '온습도', value: `${status.temperature}℃ / ${status.humidity}%`, meta: 'Arduino 환경 센서' })}
    </section>
  `;
}

export async function renderHomeDashboardPage() {
  const status = await getCurrentHomeStatus();
  const latestNotification = status.notifications?.[0] ?? status.latestNotification;
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Home Dashboard</p>
          <h1>현재 홈 상태</h1>
        </div>
        ${DecibelBadge({ decibel: status.decibelAvg })}
      </div>
      ${NotificationBanner(latestNotification)}
      ${statusMarkup(status)}
      <section class="section-block two-column">
        <div>
          <div class="section-title-row">
            <h2>기기 연결 상태</h2>
            <a href="#/devices">전체 보기</a>
          </div>
          <div class="card-list">
            ${status.devices.map((device) => DeviceCard(device)).join('')}
          </div>
        </div>
        <div>
          <div class="section-title-row">
            <h2>루틴 추천 요약</h2>
            <a href="#/routines">관리</a>
          </div>
          <div class="card-list">
            ${status.routineRecommendations.map((routine) => RoutineCard(routine, { compact: true })).join('')}
          </div>
        </div>
      </section>
      <section class="section-block">
        <div class="section-title-row">
          <h2>기본 리포트 바로가기</h2>
          <a href="#/reports">리포트 보기</a>
        </div>
        ${ReportCard(status.basicReport)}
      </section>
    </section>
  `;
}

export function mountHomeDashboardPage() {
  document.querySelector('[data-action="mark-latest-read"]')?.addEventListener('click', async (event) => {
    const banner = event.currentTarget.closest('[data-notification-id]');
    if (!banner) return;
    await markNotificationRead(banner.dataset.notificationId);
    banner.classList.add('is-read');
  });
}
