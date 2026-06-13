// SoundCare 브랜드 마크: 민트 스퀘어클 + 흰색 사운드웨이브 바.
// gradient id 충돌을 막기 위해 호출 위치별로 uid 를 받는다.
export function brandMark(uid = 'default', extraClass = '') {
  const gid = `bm-${uid}`;
  return `
    <svg class="brand-mark ${extraClass}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#46e3cd" />
          <stop offset="1" stop-color="#0f9a88" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="11.5" fill="url(#${gid})" />
      <g stroke="#ffffff" stroke-width="2.6" stroke-linecap="round">
        <line x1="13" y1="16.5" x2="13" y2="23.5" />
        <line x1="18.5" y1="12" x2="18.5" y2="28" />
        <line x1="24" y1="15" x2="24" y2="25" />
        <line x1="29" y1="17.5" x2="29" y2="22.5" />
      </g>
    </svg>
  `;
}
