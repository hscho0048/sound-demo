// 백엔드 API 부하 테스트. 먼저 연결 가능 여부를 확인하고, 가능하면 지정한 동시성으로
// N개의 요청을 보내 지연시간 분포(p50/p95/p99)와 처리량을 측정한다.
// 백엔드(별도 레포)가 떠 있지 않으면 깔끔히 건너뛴다.
import config from './config.mjs';

function pct(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function fetchOnce(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = performance.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    // 본문까지 읽어야 실제 응답 완료 시간이 된다.
    await res.arrayBuffer().catch(() => {});
    return { ok: res.ok, status: res.status, ms: performance.now() - start };
  } catch (err) {
    return { ok: false, status: 0, ms: performance.now() - start, error: err.name || 'error' };
  } finally {
    clearTimeout(t);
  }
}

export async function measureApi() {
  const { baseUrl, endpoint, requests, concurrency, timeoutMs } = config.api;
  const url = `${baseUrl}${endpoint}`;

  // 연결성 확인 (단발).
  const probe = await fetchOnce(url, Math.min(timeoutMs, 3000));
  if (probe.status === 0) {
    return { ok: false, skipped: true, reason: `백엔드 미응답 (${baseUrl}) — 부하 테스트 건너뜀`, url };
  }

  // 동시성 풀로 전체 요청 실행.
  const results = [];
  let issued = 0;
  const startAll = performance.now();
  async function worker() {
    while (issued < requests) {
      issued += 1;
      // eslint-disable-next-line no-await-in-loop
      results.push(await fetchOnce(url, timeoutMs));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));
  const totalSec = (performance.now() - startAll) / 1000;

  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const success = results.filter((r) => r.ok).length;
  const sum = latencies.reduce((a, b) => a + b, 0);

  const p95 = pct(latencies, 95);
  const checks = [
    { name: 'API p95 응답', value: p95, budget: config.budgets.apiP95Ms, unit: 'ms', pass: p95 <= config.budgets.apiP95Ms }
  ];

  return {
    ok: true,
    url,
    requests,
    concurrency,
    durationSec: totalSec,
    throughput: results.length / totalSec,
    successRate: (success / results.length) * 100,
    statusCounts: results.reduce((acc, r) => {
      const k = r.error ? r.error : String(r.status);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
    latency: {
      min: latencies[0],
      max: latencies[latencies.length - 1],
      avg: sum / latencies.length,
      p50: pct(latencies, 50),
      p95,
      p99: pct(latencies, 99)
    },
    checks
  };
}

// 단독 실행
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  measureApi().then((r) => console.log(JSON.stringify(r, null, 2)));
}
