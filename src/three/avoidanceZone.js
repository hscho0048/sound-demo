import * as THREE from 'three';

export function createAvoidanceZone({ width = 1.5, depth = 1.1 } = {}) {
  const geometry = new THREE.PlaneGeometry(width, depth);
  const material = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(0.1, 0.025, 0.15);
  mesh.visible = false;
  return mesh;
}

export function setZoneVisibility(zone, visible, event = {}) {
  zone.visible = visible;
  if (event.roomId === 'room-living') {
    zone.position.set(0.1, 0.03, 0.15);
  }
}
