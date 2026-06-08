import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { assetUrl, createDracoGltfLoader, disposeObject } from './loaders.js';

const MODEL_PATHS = {
  washer: 'assets/models/wash/washing_machine_lg_drumspin_optimized.glb',
  robot: 'assets/models/robot_vaccum/robot_vacuum_lg_optimized.glb',
  refrigerator: 'assets/models/refrigerator/refrigerator_lg_optimized.glb'
};

export function createDeviceDetailModelScene(container, { modelType = 'washer' } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9ecef);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xe9ecef, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(1.9, 1.35, 2.65);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.25;
  controls.maxDistance = 5.2;
  controls.target.set(0, 0.55, 0);

  const { loader, dracoLoader } = createDracoGltfLoader();

  const root = new THREE.Group();
  scene.add(root);

  let disposed = false;
  let animationId = null;
  let model = null;
  let mixer = null;
  const clock = new THREE.Clock();

  container.innerHTML = '';
  container.classList.add('is-loading');
  container.appendChild(renderer.domElement);

  addLighting(scene);
  resizeRenderer();
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resizeRenderer);
  resizeObserver?.observe(container);
  window.addEventListener('resize', resizeRenderer);

  loadModel();
  animate();

  async function loadModel() {
    try {
      const path = MODEL_PATHS[modelType] ?? MODEL_PATHS.washer;
      const gltf = await loader.loadAsync(assetUrl(path));
      if (disposed) return;

      model = gltf.scene;
      prepareModel(model);
      alignAndFrameModel(model);
      root.add(model);

      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
      }
      container.classList.remove('is-loading');
    } catch (error) {
      console.error('Device detail GLB failed to load.', error);
      container.classList.remove('is-loading');
    }
  }

  function resizeRenderer() {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || container.clientWidth || 280));
    const height = Math.max(1, Math.floor(rect.height || container.clientHeight || 400));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate() {
    if (disposed) return;
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;

    controls.update();
    mixer?.update(delta);
    if (model) {
      model.rotation.y += delta * 0.28;
      if (modelType === 'washer') {
        model.position.x = Math.sin(elapsed * 8) * 0.006;
      }
    }
    renderer.render(scene, camera);
    animationId = window.requestAnimationFrame(animate);
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    dispose() {
      disposed = true;
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeRenderer);
      if (animationId) window.cancelAnimationFrame(animationId);
      controls.dispose();
      dracoLoader.dispose?.();
      disposeObject(scene);
      renderer.dispose();
      container.classList.remove('is-loading');
      container.innerHTML = '';
    }
  };
}

function addLighting(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa4b3, 1.7));

  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(3, 4, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.75);
  fill.position.set(-3, 2, -2);
  scene.add(fill);
}

function prepareModel(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = false;
    obj.receiveShadow = false;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.forEach((material) => {
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      material.needsUpdate = true;
    });
  });
}

function alignAndFrameModel(root) {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.min.y) || !Number.isFinite(box.min.z)) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z);
  const scale = largest > 0 ? 1.45 / largest : 1;

  root.position.set(-center.x, -box.min.y, -center.z);
  root.scale.setScalar(scale);
}
