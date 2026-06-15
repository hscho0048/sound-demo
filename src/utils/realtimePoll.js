// 실시간 dB 갱신용 공용 폴러. ESP→Agent가 백엔드로 계속 올리는 최신 측정값을
// 표시 화면(웹/Tauri)이 주기적으로 다시 읽어 DOM을 갱신할 때 사용한다.
//
// - 중복 호출 방지(inFlight): 이전 tick이 끝나기 전엔 다음 tick을 건너뛴다.
// - 탭이 백그라운드일 때는 멈췄다가 복귀 시 즉시 1회 갱신한다(불필요한 요청 절감).
// - 반환된 stop()으로 페이지 cleanup에서 정리한다.

const DEFAULT_INTERVAL_MS = 2000;

// 측정값이 이 시간보다 오래되면 "ESP 비활성"으로 보고 dB를 -- 로 표시한다.
// 에이전트는 재생 중 0.5초마다 업로드하므로, 재생/ESP가 멈추면 이 시간 내에 --로 바뀐다.
export const MEASUREMENT_FRESH_MS = 10000;

// 측정 시각(ISO 문자열)이 최근(threshold 이내)인지. 없거나 오래되면 false → -- 표시.
// 미래로 찍힌 값(시드/데모 데이터 등)은 실시간 측정이 아니므로 신선으로 보지 않는다.
// 단, 기기/서버 시계 오차를 감안해 소폭(FUTURE_SKEW_MS)까지는 허용한다.
const FUTURE_SKEW_MS = 5000;
export function isFreshTimestamp(timestamp, freshMs = MEASUREMENT_FRESH_MS) {
  if (!timestamp) return false;
  const t = Date.parse(timestamp);
  if (Number.isNaN(t)) return false;
  const age = Date.now() - t;
  return age >= -FUTURE_SKEW_MS && age <= freshMs;
}

export function getMeasurementPollIntervalMs() {
  const raw = import.meta.env?.VITE_APPLIANCE_MEASUREMENT_POLL_INTERVAL_MS;
  const value = Number(raw);
  // env가 1000ms로 매우 공격적이라, 클라우드 백엔드 부담을 줄이려 최소 1500ms로 둔다.
  return Number.isFinite(value) && value > 0 ? Math.max(1500, value) : DEFAULT_INTERVAL_MS;
}

export function startRealtimePoll(fn, intervalMs = getMeasurementPollIntervalMs()) {
  let stopped = false;
  let inFlight = false;
  let timer = null;

  const tick = async () => {
    if (stopped || inFlight) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    inFlight = true;
    try {
      await fn();
    } catch (error) {
      // 폴링 실패는 조용히 무시(다음 tick에서 재시도). 화면은 마지막 값 유지.
    } finally {
      inFlight = false;
    }
  };

  const onVisible = () => {
    if (!stopped && !document.hidden) tick();
  };
  document.addEventListener('visibilitychange', onVisible);

  timer = window.setInterval(tick, intervalMs);

  return function stop() {
    stopped = true;
    if (timer) window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
