import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export async function loadGlbWithFallback(scene, url, fallbackFactory, { position = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const loader = new GLTFLoader();
  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        model.position.set(...position);
        model.scale.set(...scale);
        scene.add(model);
        resolve({ object: model, loadedFromGlb: true });
      },
      undefined,
      () => {
        const fallback = fallbackFactory();
        fallback.position.set(...position);
        fallback.scale.set(...scale);
        scene.add(fallback);
        resolve({ object: fallback, loadedFromGlb: false });
      }
    );
  });
}

export function createRobotFallback() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.12, 32),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.2, roughness: 0.45 })
  );
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
  );
  top.position.y = 0.09;
  group.add(body, top);
  return group;
}

export function createApplianceFallback(width = 0.55, height = 0.85, depth = 0.45) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55 })
  );
}
