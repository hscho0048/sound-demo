# Spring Boot API 연동 노트

## 기본 원칙

Tauri/Web 앱은 Spring Boot API만 직접 호출한다. FastAPI 상세 리포트 서비스는 내부 서비스이며 프론트엔드가 직접 호출하지 않는다.

원본 오디오는 서버로 전송하지 않는다. 소음 분류는 스마트폰의 YAMNet TFLite 모델에서 로컬로 수행되고, 서버에는 라벨, 신뢰도, dB, 센서 요약값, 반응 데이터만 저장된다.

## 가전 모형 제어 아키텍처

수정된 메인 아키텍처에서 Tauri/Web은 ESP32-S3 Serial을 직접 열지 않는다. 제어 흐름은 다음과 같다.

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

핵심 정리:

1. Tauri/Web은 ESP32-S3 Serial을 직접 열지 않는다.
2. Tauri/Web은 Spring Boot 제어 명령 API로 명령을 생성한다.
3. Appliance Controller Agent PC가 USB Serial로 ESP32-S3와 통신한다.
4. Agent가 ESP32-S3 재생 텔레메트리를 Spring Boot로 업로드한다.
5. Tauri/Web은 백엔드에 저장된 최신 상태를 조회해 표시한다.
6. MVP에서는 공식 LG ThinQ API를 연동하지 않는다.

## 환경 변수

| 변수 | 설명 | 기본값 |
|---|---|---|
| `VITE_SOUNDCARE_API_BASE_URL` | Spring Boot API 주소 | `http://localhost:8080` |
| `VITE_USE_MOCK_API` | 샘플 데이터 사용 여부 | `true` |
| `VITE_NOTIFICATION_POLL_INTERVAL_MS` | 알림 폴링 간격 | `15000` |
| `VITE_APPLIANCE_MEASUREMENT_POLL_INTERVAL_MS` | 가전 모형 텔레메트리 폴링 간격 | `1000` |
| `VITE_DEVICE_AGENT_POLL_INTERVAL_MS` | Agent 상태 폴링 간격 | `3000` |

Tauri에는 Serial 포트 필수 변수를 추가하지 않는다. Serial 통신은 Appliance Controller Agent가 담당한다.

## 주요 API

### Auth

- `POST /api/auth/google`
- `GET /api/me`

개발 모드에서는 placeholder 토큰을 사용한다. 운영 환경에서는 Google OAuth 결과를 Spring Boot로 전달하고 JWT를 발급받는다.

### 기기

- `GET /api/devices`
- `GET /api/devices/{deviceId}`
- `POST /api/devices`
- `GET /api/devices/runtime-settings`

지원 기기 유형은 `IOT_HUB_PHONE`, `USER_DEVICE_PHONE`, `APPLIANCE_SOUND_MODULE`, `APPLIANCE_NOISE_METER`, `ENV_SENSOR`이다.

### 민감 가전 설정

- `GET /api/sensitive-appliances`
- `PATCH /api/sensitive-appliances`
- `GET /api/control-policies`
- `PATCH /api/control-policies/{serviceLabel}`

설정 항목은 민감 여부, 기본 dB 기준, 가전별 대응 dB 기준, 신뢰도 기준, 자동 대응 정책, 알림 정책, 리포트 포함 여부를 포함한다.

### 홈 상태와 이벤트

- `GET /api/home/current-status`
- `GET /api/iot/events`
- `GET /api/robot-avoidance-events`

3D 홈 화면은 로봇청소기 회피 이벤트를 기반으로 GLB 경로를 변경한다. 이 동작은 프론트엔드 시뮬레이션이다.

### Appliance Controller Agent

- `GET /api/device-agents`
- `GET /api/device-agents/{agentId}`

Agent 상태에는 `agentId`, `online`, `hostName`, `lastSeenAt`, `connectedModuleIds`, `lastSerialPort`가 포함된다. Tauri/Web은 이 값을 표시만 하며 Serial 포트를 직접 열지 않는다.

### 제어 명령

- `POST /api/control-commands`
- `GET /api/control-commands`

명령 유형은 `PLAY_SAMPLE`, `STOP_SAMPLE`, `SET_VOLUME`이다. 명령 상태는 `PENDING`, `SENT`, `APPLIED`, `FAILED`, `TIMEOUT`, `CANCELLED`이다.

`PLAY_SAMPLE` 요청 예시:

```json
{
  "targetDeviceId": "esp32s3-appliance-controller-device-uuid",
  "targetModuleId": "esp32s3-appliance-01",
  "agentId": "appliance-controller-pc-01",
  "commandType": "PLAY_SAMPLE",
  "payload": {
    "applianceType": "robot_vacuum",
    "sampleName": "robot_vacuum.wav",
    "volumePercent": 70,
    "mode": "single"
  }
}
```

`STOP_SAMPLE`은 `payload.applianceType`만, `SET_VOLUME`은 `payload.volumePercent`만 전달한다.

### 가전 모형 측정값(텔레메트리)

- `GET /api/events/appliance-measurements/latest`
- `GET /api/events/appliance-measurements`

조회 예시:

```text
GET /api/events/appliance-measurements/latest?serviceLabel=robot_vacuum
GET /api/events/appliance-measurements/latest?agentId=appliance-controller-pc-01&sourceModuleId=esp32s3-appliance-01
```

텔레메트리에는 `moduleId`, `applianceType`, `playbackState`, `sampleName`, `volumePercent`, `relativeDb`, `decibelAvg`, `decibelMax`, `rms`, `measuredBy`, `source`, `moduleTimestampMs`, 수신/업로드 시각이 포함된다. INMP441로 측정한 상대 dB 값이며, ESP32-S3는 WAV 재생과 측정만 담당한다.

### 알림

- `GET /api/notifications/recent`
- `GET /api/notifications`
- `PATCH /api/notifications/{notificationId}/read`

알림 유형은 `LOUD_NOISE_DETECTED`, `SENSITIVE_APPLIANCE_DETECTED`, `AUTO_CONTROL_APPLIED`, `ROBOT_ROUTE_CHANGED`, `NON_CONTROLLABLE_WARNING`, `ROUTINE_CREATED`를 사용한다.

### 루틴

- `GET /api/routines/recommendations`
- `POST /api/routines/generate`
- `PATCH /api/routines/{routineId}/apply`
- `PATCH /api/routines/{routineId}/dismiss`

상태 값은 `SUGGESTED`, `APPLIED`, `AUTO_APPLIED`, `DISMISSED`, `DISABLED`이다.

### 리포트와 GPT 동의

- `GET /api/reports/basic`
- `POST /api/ai-consents/gpt-report`
- `POST /api/reports/detailed`

상세 리포트 요청 전에는 사용자의 명시적 동의를 받아야 한다. 상세 리포트에는 집계 요약 데이터만 사용한다.

## WebSocket 확장

초기 구현은 폴링을 기본으로 한다. WebSocket은 `/ws/notifications`를 placeholder로 두었으며, 실제 엔드포인트와 인증 방식은 백엔드 구현 후 맞춘다.

## TODO

- JWT 만료 처리와 refresh token 정책 반영
- Guardian role 화면 권한 분기
- 에러 코드와 JSON Schema 기반 입력 검증 연결
- 실제 배포 URL과 CORS 정책 확인
