import { escapeHtml } from '../utils/html.js';

// 로그인 시 저장된 사용자 닉네임을 사용한다 (하드코딩 제거).
function currentNickname() {
  if (typeof window === 'undefined') return '사용자';
  return window.localStorage.getItem('soundcare.nickname') || '사용자';
}

export function householdTitle() {
  return `${currentNickname()} 님의 Home`;
}

export function householdHeader({ headerClass = '', status = '', extraHtml = '', title } = {}) {
  const heading = escapeHtml(title || householdTitle());
  const classes = ['dashboard-household-header', headerClass].filter(Boolean).join(' ');
  return `
    <header class="${classes}">
      <h1 class="dashboard-desktop-title">${heading}</h1>
      <div class="dashboard-mobile-title">
        <h1>${heading}</h1>
      </div>
      <p class="dashboard-mobile-sync">${escapeHtml(status)}</p>
      ${extraHtml}
    </header>
  `;
}
