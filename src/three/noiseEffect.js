import * as THREE from 'three';

export function createNoiseWaveEffect() {
  const group = new THREE.Group();
  [0.45, 0.75, 1.05].forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 0.02, 48),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.18 - index * 0.04, side: THREE.DoubleSide })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  });
  group.position.set(0.1, 0.07, 0.1);
  return group;
}

/**
 * dB 값을 소음 파동 강도(scale)로 변환하는 순수 함수.
 * 로봇청소기 텔레메트리의 relativeDb / decibelAvg 를 그대로 넣을 수 있다.
 * 값이 없으면 기본 60dB로 처리한다.
 */
export function computeNoiseWaveIntensity(decibel) {
  const numeric = Number(decibel);
  const safe = Number.isFinite(numeric) ? numeric : 60;
  return Math.max(0.8, Math.min(1.8, safe / 45));
}

export function setNoiseIntensity(group, decibel) {
  const scale = computeNoiseWaveIntensity(decibel);
  group.scale.set(scale, scale, scale);
}

export function animateNoiseWave(group, elapsedSeconds) {
  group.children.forEach((ring, index) => {
    const pulse = 1 + Math.sin(elapsedSeconds * 2 + index) * 0.05;
    ring.scale.set(pulse, pulse, pulse);
  });
}
