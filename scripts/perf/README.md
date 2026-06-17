# 성능 테스트 (perf)

`npm run perf` 한 번으로 빌드 → 측정 → 통합 리포트까지 수행합니다.

## 실행

```bash
npm run perf            # 전체: 빌드 + 번들 + 웹/FPS + API + 리포트
npm run perf:bundle     # 번들 용량만 (dist 필요)
```

플래그는 npm 을 거치면 무시될 수 있으니 직접 node 로 넘깁니다:

```bash
node scripts/perf/run-all.mjs --skip-build   # dist 재사용(빌드 생략)
node scripts/perf/run-all.mjs --skip-api     # API 부하 생략
node scripts/perf/run-all.mjs --skip-web     # 헤드리스 웹 측정 생략
node scripts/perf/run-all.mjs --ci           # 기준 미달 시 종료코드 1 (CI 용)
```

## 측정 항목

| 영역 | 내용 |
| --- | --- |
| 번들 용량 | dist 의 코드(JS+CSS) gzip 합계, 최대 JS 청크, 정적 자산(이미지/3D 모델) raw 합계 |
| 웹 로딩 | 라우트별 FCP / LCP / DOMContentLoaded / load / JS heap / DOM 노드 수 |
| 3D FPS | `#/home`, `#/three-home` 의 평균·최악 프레임(FPS) |
| API 부하 | 지정 엔드포인트에 동시요청, 지연 p50/p95/p99·처리량·성공률 |

## 결과물 (`perf-report/`, git 무시됨)

- `report.html` — 브라우저로 여는 시각화 리포트
- `report.md` — Markdown 요약 (PR 첨부용)
- `report.json` — 원시 측정값 (회귀 비교용)

## 기준값(budget) 조정

`scripts/perf/config.mjs` 에서 직접 수정하거나 환경변수로 덮어씁니다:

```bash
PERF_BUDGET_FPS=45 PERF_BUDGET_FCP_MS=1500 npm run perf
VITE_SOUNDCARE_API_BASE_URL=http://localhost:18080 npm run perf   # API 대상 변경
```

## 참고

- **3D FPS** 는 헤드리스 Chromium(소프트웨어 렌더링) 기준이라 실기기보다 낮게 나옵니다. 절대값보다 회귀 감지용으로 보세요.
- **API 부하** 는 백엔드(별도 레포)가 떠 있지 않으면 자동으로 건너뜁니다.
- 헤드리스 측정은 `puppeteer`(설치 시 Chromium 자동 다운로드)를 사용합니다.
