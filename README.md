# SoundCare Tauri Control App

`soundcare-tauri-control-app`은 SoundCare MVP의 Tauri ThinQ-style 제어 앱이자 웹 화면입니다. 사용자는 이 앱에서 민감 가전 설정을 관리하고, 현재 소음 상태와 dB, 기기 연결 상태, 알림, 자동 루틴 추천, 리포트, 3D 홈 시뮬레이션을 확인합니다.

이 앱은 소리를 직접 측정하지 않습니다. 소음 측정과 YAMNet TFLite 분류는 Flutter 스마트폰 앱의 IoT Hub Mode 또는 User Device Mode에서 수행하며, 이 앱은 Spring Boot API가 저장한 결과를 조회하고 설정을 저장합니다.

가전 모형 제어 역시 Tauri/Web이 하드웨어를 직접 다루지 않습니다. Tauri/Web은 Spring Boot 제어 명령 API로 명령을 만들고, Appliance Controller Agent PC가 USB Serial로 ESP32-S3 통합 가전 모형 제어 모듈과 통신합니다. Tauri/Web은 ESP32-S3 Serial을 직접 열지 않습니다.

## 제어 아키텍처

```text
Tauri Web/App
→ Spring Boot API
→ Appliance Controller Agent PC
→ USB Serial
→ ESP32-S3 통합 가전 모형 제어 모듈
→ WAV 재생 + INMP441 상대 dB 측정
→ Appliance Controller Agent PC
→ Spring Boot API
→ PostgreSQL
→ Tauri Web/App 표시
```

Tauri/Web의 역할:

1. ThinQ 스타일 제어 인터페이스 제공
2. 민감 가전 설정 구성
3. Spring Boot를 통한 가전 모형 제어 명령 생성
4. Spring Boot가 반환한 명령 상태 표시
5. Appliance Controller Agent 온라인/오프라인 상태 표시
6. Agent가 업로드한 최신 ESP32-S3 재생 텔레메트리 표시
7. 최신 상대 dB, decibelAvg, decibelMax, 샘플 이름, 재생 상태 표시
8. 알림, 리포트, 루틴 추천, 3D 홈 뷰 제공
9. 로봇청소기 GLB 경로 변경은 프론트엔드 시뮬레이션으로 유지

## 주요 기능

- Google 로그인 진입 화면과 Spring Boot Auth 연동 스캐폴드
- 현재 홈 상태 대시보드
- 민감 가전 설정 화면
- 가전 모형 제어 화면 (Agent 상태, 제어 명령, 명령 상태, 최신 텔레메트리)
- IoT Hub 스마트폰, 사용자 스마트폰, 가전 모듈 상태 확인
- Three.js 기반 3D 홈 화면
- 로봇청소기 GLB 경로 변경 시뮬레이션
- 소음 파동, dB 라벨, 회피 구역 표시
- 실시간에 가까운 알림 폴링과 WebSocket 확장 지점
- 자동 루틴 추천 적용, 해제 흐름
- 기본 리포트와 GPT 상세 리포트 동의 모달

## MVP 범위 제한

- 공식 LG ThinQ API와 직접 연동하지 않습니다.
- 실제 LG 가전(로봇청소기, 세탁기 등)을 제어하지 않습니다. 제어 대상은 ESP32-S3 통합 가전 모형 제어 모듈입니다.
- Tauri/Web은 ESP32-S3 Serial을 직접 열지 않습니다. Serial 통신은 Appliance Controller Agent PC가 담당합니다.
- 로봇청소기 경로 변경은 프론트엔드 GLB 시뮬레이션 이벤트입니다.
- 원본 오디오는 서버로 전송하지 않습니다.
- GPT 상세 리포트는 사용자가 동의한 뒤 Spring Boot가 요약 데이터만 전송하는 구조를 전제로 합니다.

## 기술 스택

- Tauri v2
- JavaScript
- CSS
- Three.js
- Vite
- Spring Boot REST API
- 선택적 Tauri Rust command

## 폴더 구조

```text
soundcare-tauri-control-app/
├── README.md
├── package.json
├── index.html
├── src/
│   ├── main.js
│   ├── styles/main.css
│   ├── api/
│   ├── pages/
│   ├── components/
│   ├── three/
│   └── data/
├── public/assets/glb/README.md
├── src-tauri/
└── docs/
```

## 설치

```bash
npm install
```

Tauri 데스크톱 앱으로 실행하려면 Rust와 Tauri v2 요구 사항이 필요합니다. 웹 화면만 먼저 확인하려면 Vite 개발 서버로 실행하면 됩니다.

## 환경 변수

`.env.example`을 복사해 `.env`를 만듭니다.

```bash
cp .env.example .env
```

주요 변수:

```env
VITE_SOUNDCARE_API_BASE_URL=http://localhost:8080
VITE_USE_MOCK_API=true
VITE_NOTIFICATION_POLL_INTERVAL_MS=15000
VITE_APPLIANCE_MEASUREMENT_POLL_INTERVAL_MS=1000
VITE_DEVICE_AGENT_POLL_INTERVAL_MS=3000
```

Serial 포트 변수는 Tauri에 두지 않습니다. ESP32-S3 USB Serial 통신은 Appliance Controller Agent가 담당합니다.

`VITE_USE_MOCK_API=true`일 때는 Spring Boot API가 아직 실행되지 않아도 샘플 데이터로 화면을 확인할 수 있습니다. 실제 백엔드 연동 검증 시에는 `false`로 변경합니다.

## 실행

웹 개발 서버:

```bash
npm run dev
```

Tauri 개발 실행:

```bash
npm run tauri:dev
```

빌드:

```bash
npm run build
npm run tauri:build
```

테스트:

```bash
npm test
```

## GLB 에셋 배치

실제 GLB 파일은 이 저장소에 포함하지 않습니다. 다음 경로에 모델을 배치하면 3D 홈 화면에서 로딩을 시도합니다.

```text
public/assets/glb/robot_vacuum.glb
public/assets/glb/home_structure.glb
public/assets/glb/washing_machine.glb
public/assets/glb/dishwasher.glb
public/assets/glb/smartphone_device.glb
```

파일이 없으면 Three.js 화면은 기본 도형으로 대체 표시합니다.

## API 연동 가정

모든 클라이언트 호출은 Spring Boot API를 향합니다. FastAPI 상세 리포트 서비스는 프론트엔드가 직접 호출하지 않습니다.

주요 API 그룹:

- `/api/auth/google`
- `/api/me`
- `/api/home/current-status`
- `/api/devices`
- `/api/devices/runtime-settings`
- `/api/sensitive-appliances`
- `/api/device-agents`
- `/api/control-commands`
- `/api/events/appliance-measurements/latest`
- `/api/events/appliance-measurements`
- `/api/notifications/recent`
- `/api/notifications`
- `/api/routines/recommendations`
- `/api/reports/basic`
- `/api/reports/detailed`
- `/api/ai-consents/gpt-report`

## 보안 메모

현재 토큰 저장은 개발 편의를 위한 placeholder입니다. 운영 환경에서는 Tauri secure storage plugin 또는 OS keychain 연동을 적용해야 합니다. Rust HMAC benchmark command는 성능 비교용이며, 운영용 키 관리 설계가 아닙니다.
