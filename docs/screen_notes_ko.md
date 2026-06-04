# SoundCare Tauri/Web 화면 기획 노트

## 목적

이 문서는 `soundcare-tauri-control-app`의 초기 화면 구성을 정의한다. 화면은 사용자가 민감 가전 설정, 현재 홈 상태, 알림, 3D 홈 시뮬레이션, 루틴 추천, 리포트를 이해하고 조작할 수 있도록 구성한다.

## 메뉴 구조

1. 홈
2. 민감 가전
3. 가전 모형 제어
4. 3D 홈
5. 기기
6. 알림
7. 루틴
8. 리포트
9. 설정

## 화면 목록

| 화면 | 목적 | 주요 데이터 |
|---|---|---|
| 로그인 | Google 로그인 진입 | Spring Boot Auth |
| 홈 대시보드 | 현재 상태 요약 | 홈 상태, dB, 라벨, 온습도, 알림 |
| 민감 가전 설정 | 사용자별 민감 가전 정책 저장 | 임계값, 신뢰도, 대응 정책 |
| 가전 모형 제어 | ESP32-S3 가전 모형 재생 명령 생성과 상태 표시 | device agent, control command, telemetry |
| 3D 홈 | 로봇청소기 경로와 회피 구역 시각화 | robot avoidance event, dB, telemetry |
| 기기 목록 | 스마트폰과 모듈 연결 상태 | devices |
| 기기 상세 | 런타임 설정 동기화 확인 | runtime settings |
| 알림 센터 | 알림 목록과 읽음 처리 | notification events |
| 루틴 추천 | 규칙 기반 추천 적용/숨김 | routine recommendations |
| 리포트 | 기본 리포트와 GPT 상세 리포트 동의 | reports, ai consent |
| 설정 | API URL, Mock API, 토큰 저장 정책 확인 | app config |

## 핵심 흐름

### 1. 로그인 후 상태 확인

1. 사용자가 Google 로그인 버튼을 누른다.
2. 앱은 Spring Boot Auth API로 id token을 전달한다.
3. 개발 모드에서는 placeholder 토큰을 저장한다.
4. 홈 대시보드로 이동한다.

### 2. 민감 가전 설정 저장

1. 사용자가 로봇청소기, 세탁기, 식기세척기, 냉장고의 민감 여부를 설정한다.
2. dB 기준, 신뢰도 기준, 자동 대응 방식, 알림 방식, 리포트 포함 여부를 수정한다.
3. 저장 버튼을 누르면 Spring Boot의 민감 가전 설정 API로 전송한다.
4. 백엔드는 런타임 설정 버전을 갱신하고 Flutter IoT Hub Mode와 User Device Mode가 이 값을 동기화한다.

### 3. 가전 모형 제어 (`#/appliance-module`)

1. 사용자가 가전 모형 제어 화면에 들어간다.
2. 화면 상단에서 Appliance Controller Agent의 온라인/오프라인 상태를 확인한다.
3. 세탁기, 식기세척기, 로봇청소기 재생 버튼 또는 정지 버튼을 누른다.
4. 볼륨 슬라이더와 모드(single / loop)를 설정한다.
5. Tauri/Web은 Spring Boot 제어 명령 API(`POST /api/control-commands`)로 명령을 생성한다.
6. Appliance Controller Agent PC가 명령을 수신해 USB Serial로 ESP32-S3 통합 가전 모형 모듈에 전달한다.
7. ESP32-S3가 WAV를 재생하고 INMP441로 상대 dB를 측정한다.
8. Agent가 텔레메트리를 Spring Boot로 업로드하고, 화면은 명령 상태와 최신 텔레메트리를 표시한다.
9. Tauri/Web은 ESP32-S3 Serial을 직접 열지 않는다.

### 4. 3D 홈 로봇청소기 회피 시뮬레이션

1. IoT Hub 또는 User Device에서 `vacuum_cleaner` 모델 라벨이 감지된다.
2. 서비스 레이어에서 `robot_vacuum`으로 매핑된다.
3. Spring Boot가 로봇청소기 회피 이벤트를 생성한다.
4. Tauri/Web은 해당 이벤트를 수신하거나 조회한다.
5. 3D 홈 화면은 회피 구역과 우회 경로를 표시한다.
6. 실제 로봇청소기를 제어하지 않는다.

### 5. GPT 상세 리포트

1. 사용자가 기본 리포트를 확인한다.
2. 상세 리포트 생성 버튼을 누르면 동의 모달이 열린다.
3. 모달은 원본 오디오가 전송되지 않는다는 점과 외부 API 비용 가능성을 안내한다.
4. 사용자가 동의하면 Spring Boot 상세 리포트 API를 호출한다.
5. Spring Boot가 요약 데이터만 FastAPI 상세 리포트 서비스로 전달한다.

## 예외 상태

| 상황 | 화면 처리 |
|---|---|
| 신뢰도가 낮음 | 자동 경로 변경 보류 메시지 표시 |
| room_id 없음 | 경로 변경 보류와 데이터 보완 안내 |
| API 연결 실패 | Mock API 사용 또는 에러 박스 표시 |
| GLB 파일 없음 | 기본 도형으로 대체 표시 |
| GPT 동의 없음 | 상세 리포트 요청 불가 |
| Agent 오프라인 | 하드웨어 컨트롤러 사용 불가 상태 표시 |
| 텔레메트리 stale | 오래된 값 안내(stale/unknown) 표시 |

## 접근성 메모

- 모든 주요 버튼은 텍스트 레이블을 가진다.
- 실시간 알림 영역은 `aria-live`를 사용한다.
- dB 수치와 소음 상태는 색상만으로 의미를 전달하지 않고 텍스트를 함께 표시한다.
