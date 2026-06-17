// HEAR:O 성능 테스트 설정.
// 모든 임계값(budget)은 "이 값을 넘으면 FAIL"로 해석한다(FPS만 "이 값 미만이면 FAIL").
// 환경변수로 일부 값을 덮어쓸 수 있다.
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

export default {
  // vite preview 가 빌드 결과(dist)를 서빙할 포트.
  previewPort: num(process.env.PERF_PREVIEW_PORT, 4178),

  // 측정할 라우트. is3d=true 이면 FPS 도 함께 측정한다.
  routes: [
    { name: 'Login', hash: '#/login', is3d: false, waitFor: '.login-brand' },
    { name: 'Home', hash: '#/home', is3d: true, waitFor: '.app-shell' },
    { name: '3D View', hash: '#/three-home', is3d: true, waitFor: '.app-shell' },
    { name: 'Devices', hash: '#/devices', is3d: false, waitFor: '.app-shell' },
    { name: 'Report', hash: '#/reports', is3d: false, waitFor: '.app-shell' }
  ],

  // FPS 측정 시간(ms). 라우트 진입 후 이 시간만큼 프레임 수를 센다.
  fpsDurationMs: num(process.env.PERF_FPS_MS, 4000),
  // 페이지 로드 대기 상한(ms).
  navTimeoutMs: num(process.env.PERF_NAV_TIMEOUT_MS, 30000),

  // 합격/불합격 기준.
  budgets: {
    bundleTotalGzipKb: num(process.env.PERF_BUDGET_BUNDLE_KB, 1600), // dist 전체 gzip 합계
    largestChunkGzipKb: num(process.env.PERF_BUDGET_CHUNK_KB, 750), // 가장 큰 JS 청크 gzip
    fcpMs: num(process.env.PERF_BUDGET_FCP_MS, 2000), // First Contentful Paint
    lcpMs: num(process.env.PERF_BUDGET_LCP_MS, 2800), // Largest Contentful Paint
    minFps: num(process.env.PERF_BUDGET_FPS, 30), // 3D 라우트 평균 FPS 하한
    apiP95Ms: num(process.env.PERF_BUDGET_API_P95_MS, 800) // API p95 응답시간
  },

  // API 부하 테스트.
  api: {
    baseUrl: process.env.VITE_SOUNDCARE_API_BASE_URL || 'http://localhost:18080',
    endpoint: process.env.PERF_API_ENDPOINT || '/api/home/current-status',
    requests: num(process.env.PERF_API_REQUESTS, 100),
    concurrency: num(process.env.PERF_API_CONCURRENCY, 10),
    timeoutMs: num(process.env.PERF_API_TIMEOUT_MS, 5000)
  },

  outDir: 'perf-report'
};
