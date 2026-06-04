import * as THREE from 'three';

const DEFAULT_POINTS = [
  new THREE.Vector3(-2.2, 0.05, -1.2),
  new THREE.Vector3(-0.8, 0.05, -0.2),
  new THREE.Vector3(0.3, 0.05, 0.3),
  new THREE.Vector3(1.6, 0.05, 1.1)
];

const AVOID_LIVING_POINTS = [
  new THREE.Vector3(-2.2, 0.05, -1.2),
  new THREE.Vector3(-1.4, 0.05, -1.6),
  new THREE.Vector3(0.4, 0.05, -1.7),
  new THREE.Vector3(1.7, 0.05, 0.9)
];

export function createRobotRoute(points = DEFAULT_POINTS) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 3 });
  return new THREE.Line(geometry, material);
}

export function computeAvoidancePath(event) {
  if (event?.roomId === 'room-living') {
    return AVOID_LIVING_POINTS;
  }
  return DEFAULT_POINTS.map((point) => point.clone().add(new THREE.Vector3(0, 0, 0.45)));
}

export function updateRobotRoute(routeObject, points) {
  routeObject.geometry.dispose();
  routeObject.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

export function getFirstRoutePoint(points = DEFAULT_POINTS) {
  return points[0].clone();
}
