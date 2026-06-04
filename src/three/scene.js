import * as THREE from 'three';
import { createAvoidanceZone, setZoneVisibility } from './avoidanceZone.js';
import { createApplianceFallback, createRobotFallback, loadGlbWithFallback } from './loaders.js';
import { animateNoiseWave, createNoiseWaveEffect, setNoiseIntensity } from './noiseEffect.js';
import { computeAvoidancePath, createRobotRoute, getFirstRoutePoint, updateRobotRoute } from './robotPath.js';

export function createSoundCareScene(container, { homeStatus }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8fafc);

  const camera = new THREE.PerspectiveCamera(52, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(3.2, 3.1, 4.4);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  const directional = new THREE.DirectionalLight(0xffffff, 0.9);
  directional.position.set(3, 4, 3);
  scene.add(ambient, directional);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.05, 3.4),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 })
  );
  floor.position.y = -0.03;
  scene.add(floor);

  const roomLine = new THREE.GridHelper(4.8, 8, 0x94a3b8, 0xcbd5e1);
  roomLine.position.y = 0.01;
  scene.add(roomLine);

  const route = createRobotRoute();
  scene.add(route);

  const avoidanceZone = createAvoidanceZone();
  scene.add(avoidanceZone);

  const noiseWave = createNoiseWaveEffect();
  setNoiseIntensity(noiseWave, homeStatus.decibelMax ?? 60);
  scene.add(noiseWave);

  const phoneMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.38, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x0f766e })
  );
  phoneMarker.position.set(-1.7, 0.22, 1.1);
  scene.add(phoneMarker);

  const dbLabel = document.createElement('div');
  dbLabel.className = 'three-db-label';
  dbLabel.textContent = `${homeStatus.decibelAvg ?? '-'} dB`;
  container.appendChild(dbLabel);

  let disposed = false;
  let robotObject = null;
  let animationId = null;
  const clock = new THREE.Clock();

  loadGlbWithFallback(scene, '/assets/glb/robot_vacuum.glb', createRobotFallback, {
    position: [-2.2, 0.12, -1.2],
    scale: [1, 1, 1]
  }).then(({ object }) => {
    robotObject = object;
  });

  loadGlbWithFallback(scene, '/assets/glb/washing_machine.glb', () => createApplianceFallback(), {
    position: [1.8, 0.43, -1.0],
    scale: [1, 1, 1]
  });

  loadGlbWithFallback(scene, '/assets/glb/dishwasher.glb', () => createApplianceFallback(0.65, 0.6, 0.45), {
    position: [1.8, 0.3, 0.8],
    scale: [1, 1, 1]
  });

  function applyRobotAvoidanceEvent(event) {
    if (!event?.roomId || Number(event.confidence) < 0.6) {
      showExceptionState({ reason: 'room_id가 없거나 신뢰도가 낮습니다.' });
      return;
    }
    const nextPoints = computeAvoidancePath(event);
    updateRobotRoute(route, nextPoints);
    setZoneVisibility(avoidanceZone, true, event);
    const firstPoint = getFirstRoutePoint(nextPoints);
    if (robotObject) {
      robotObject.position.set(firstPoint.x, 0.12, firstPoint.z);
    }
    dbLabel.textContent = `${event.decibelMax ?? homeStatus.decibelMax ?? '-'} dB`;
  }

  function showExceptionState({ reason }) {
    setZoneVisibility(avoidanceZone, false);
    dbLabel.textContent = `보류: ${reason}`;
  }

  /**
   * Appliance Controller Agent가 업로드한 ESP32-S3 텔레메트리를 3D 장면에 반영한다.
   * - 로봇청소기 텔레메트리의 relativeDb / decibelAvg 로 소음 파동 강도를 조절한다.
   * - relativeDb 를 dB 라벨로 표시한다.
   * - Agent offline 이면 하드웨어 컨트롤러 사용 불가 상태를 표시한다.
   * - 텔레메트리가 stale 이면 stale/unknown 상태를 표시한다.
   * 실제 로봇청소기를 제어하지 않으며, GLB 경로 변경은 프론트엔드 시뮬레이션이다.
   */
  function applyTelemetry(telemetry, { agentOnline = true, stale = false } = {}) {
    if (!agentOnline) {
      noiseWave.visible = false;
      dbLabel.textContent = '하드웨어 컨트롤러 사용 불가';
      return;
    }
    if (!telemetry || stale) {
      noiseWave.visible = true;
      dbLabel.textContent = 'dB 신호 지연(stale)';
      return;
    }
    const decibel = telemetry.relativeDb ?? telemetry.decibelAvg ?? homeStatus.decibelAvg;
    noiseWave.visible = true;
    setNoiseIntensity(noiseWave, decibel ?? 60);
    dbLabel.textContent = `${decibel ?? '-'} dB`;
  }

  function onResize() {
    if (disposed) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', onResize);

  function animate() {
    if (disposed) return;
    const elapsed = clock.getElapsedTime();
    animateNoiseWave(noiseWave, elapsed);
    renderer.render(scene, camera);
    animationId = window.requestAnimationFrame(animate);
  }
  animate();

  return {
    scene,
    camera,
    renderer,
    applyRobotAvoidanceEvent,
    showExceptionState,
    applyTelemetry,
    dispose() {
      disposed = true;
      window.removeEventListener('resize', onResize);
      if (animationId) window.cancelAnimationFrame(animationId);
      renderer.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose?.();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose?.());
          } else {
            object.material.dispose?.();
          }
        }
      });
      container.innerHTML = '';
    }
  };
}
