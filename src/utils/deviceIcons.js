// 기기 유형별 라인 아이콘. stroke=currentColor 이므로 민트 악센트 색을 그대로 따른다.
// IoT 앱처럼 가전을 한눈에 구분할 수 있도록 기기명 키워드로 매핑한다.

const SVG_OPEN =
  '<svg class="device-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const SVG_CLOSE = '</svg>';

const GLYPHS = {
  // 세탁기 — 본체 + 드럼
  washer:
    '<rect x="4" y="3" width="16" height="18" rx="2.5"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="1.8"/><circle cx="7" cy="6" r="0.55" fill="currentColor" stroke="none"/><circle cx="9.4" cy="6" r="0.55" fill="currentColor" stroke="none"/>',
  // 건조기 — 드럼 + 회전 표시
  dryer:
    '<rect x="4" y="3" width="16" height="18" rx="2.5"/><circle cx="12" cy="13" r="5"/><path d="M9.6 13a2.4 2.4 0 1 1 2.4 2.4"/><circle cx="7" cy="6" r="0.55" fill="currentColor" stroke="none"/><circle cx="9.4" cy="6" r="0.55" fill="currentColor" stroke="none"/>',
  // 냉장고 — 냉동/냉장 칸 + 손잡이
  fridge:
    '<rect x="6" y="2.5" width="12" height="19" rx="2"/><line x1="6" y1="9" x2="18" y2="9"/><line x1="9" y1="5" x2="9" y2="7"/><line x1="9" y1="12" x2="9" y2="15.5"/>',
  // 로봇청소기 — 상단뷰 원반 + 센서
  robot:
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="3.5" x2="12" y2="6"/>',
  // 에어컨 — 실내기 + 바람
  ac:
    '<rect x="3" y="6" width="18" height="8" rx="2.5"/><line x1="6" y1="10.5" x2="18" y2="10.5"/><path d="M7.5 17c0 1.4 1 1.4 1 2.8"/><path d="M12 17c0 1.4 1 1.4 1 2.8"/><path d="M16.5 17c0 1.4 1 1.4 1 2.8"/>',
  // 식기세척기 — 도어 + 접시
  dishwasher:
    '<rect x="4" y="3" width="16" height="18" rx="2.5"/><line x1="4" y1="8" x2="20" y2="8"/><circle cx="12" cy="14.5" r="3.3"/><line x1="6.8" y1="5.5" x2="9" y2="5.5"/>',
  // 허브 — 신호 아크 + 점
  hub:
    '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="14" r="1.1" fill="currentColor" stroke="none"/><path d="M9.6 11.8a3.4 3.4 0 0 1 4.8 0"/><path d="M7.8 10a6 6 0 0 1 8.4 0"/>',
  // 청소기(일반)
  vacuum:
    '<circle cx="9" cy="15" r="5"/><circle cx="9" cy="15" r="1.6"/><path d="M13 12.5 18 5l2 1"/>',
  // 기본 가전
  device:
    '<rect x="4" y="3" width="16" height="18" rx="2.5"/><circle cx="12" cy="12" r="4"/><line x1="7" y1="6" x2="10" y2="6"/>'
};

function resolveGlyphKey(name = '') {
  const n = String(name);
  if (n.includes('건조')) return 'dryer';
  if (n.includes('세탁')) return 'washer';
  if (n.includes('냉장')) return 'fridge';
  if (n.includes('로봇')) return 'robot';
  if (n.includes('에어컨') || n.includes('에어')) return 'ac';
  if (n.includes('식기')) return 'dishwasher';
  if (n.includes('허브') || n.toLowerCase().includes('hub')) return 'hub';
  if (n.includes('청소')) return 'vacuum';
  return 'device';
}

// 기기명 → 인라인 SVG 문자열
export function getDeviceIcon(name) {
  return `${SVG_OPEN}${GLYPHS[resolveGlyphKey(name)]}${SVG_CLOSE}`;
}
