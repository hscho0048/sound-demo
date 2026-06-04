# Three.js 3D 홈 구현 노트

## 목적

3D 홈 화면은 사용자가 소음 발생 위치와 로봇청소기 회피 경로를 직관적으로 이해하도록 돕는다. MVP에서는 실제 로봇청소기를 제어하지 않고, Spring Boot가 제공하는 로봇 회피 이벤트를 프론트엔드에서 시각적으로 반영한다.

## 구성 요소

1. Scene
2. Camera
3. Light
4. Floor and room grid
5. Robot vacuum GLB placeholder
6. Appliance model placeholder
7. Smartphone marker
8. Avoidance zone overlay
9. Noise wave effect
10. dB label
11. Robot route path

## GLB 로딩 정책

`public/assets/glb` 경로에서 다음 파일을 로딩한다.

```text
robot_vacuum.glb
home_structure.glb
washing_machine.glb
dishwasher.glb
smartphone_device.glb
```

파일이 없으면 기본 도형으로 대체 표시한다. 이 방식은 대용량 모델 파일이나 저작권 있는 모델을 저장소에 포함하지 않기 위한 정책이다.

## 로봇청소기 회피 이벤트 처리

조건:

- `serviceLabel`이 `robot_vacuum`이다.
- `confidence`가 기준 이상이다.
- `roomId`가 존재한다.

처리:

1. 회피 구역을 표시한다.
2. 기존 경로를 우회 경로로 교체한다.
3. dB 라벨을 최신 값으로 갱신한다.
4. 상태 패널에 적용 메시지를 표시한다.

예외:

- 신뢰도가 낮으면 자동 변경을 보류한다.
- 방 정보가 없으면 자동 변경을 보류한다.
- GLB 파일이 없어도 경로와 회피 구역은 기본 도형으로 표시한다.

## 가전 모형 텔레메트리 연동

3D 홈 화면은 Appliance Controller Agent가 Spring Boot에 업로드한 ESP32-S3 텔레메트리를 반영한다.

1. 로봇청소기 재생 텔레메트리의 `relativeDb` 또는 `decibelAvg`로 소음 파동 강도를 조절한다.
2. 최신 `relativeDb` 또는 `decibelAvg`를 dB 라벨로 표시한다.
3. `serviceLabel`이 `robot_vacuum`이고 경로 변경 정책이 활성화된 경우에도 GLB 경로 변경은 프론트엔드 시뮬레이션 이벤트로 유지한다.
4. 텔레메트리가 오래되면(stale) stale/unknown 상태를 표시한다.
5. Appliance Controller Agent가 오프라인이면 하드웨어 컨트롤러 사용 불가 상태를 표시한다.

`scene.js`의 `applyTelemetry(telemetry, { agentOnline, stale })` 메서드가 위 처리를 담당하며, dB → 강도 변환은 `noiseEffect.js`의 순수 함수 `computeNoiseWaveIntensity()`로 구현해 단위 테스트가 가능하다. Tauri/Web은 ESP32-S3 Serial을 직접 열지 않는다.

## 실제 제어와의 경계

이 화면은 ThinQ-style 인터페이스이지만 공식 ThinQ API를 호출하지 않는다. 로봇청소기 경로 변경은 실제 기기 명령이 아니라 사용자에게 대응 정책을 보여주는 시뮬레이션이다. 향후 실제 제어 기능을 추가하려면 Spring Boot의 제어 명령 API, 사용자 확인 UI, 실패 복구 UI, 감사 로그가 먼저 확정되어야 한다.

## 성능 메모

- 초기 MVP는 단일 Scene으로 충분하다.
- 모델이 커질 경우 Draco 압축, 지연 로딩, LOD를 검토한다.
- 실시간 알림 빈도와 Three.js 렌더 루프는 분리한다.
- 페이지 이탈 시 `dispose()`로 geometry, material, renderer를 정리한다.
