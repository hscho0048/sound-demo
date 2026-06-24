import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetUrl, disposeObject } from './loaders.js';
import { attachModelLoadingOrb } from '../components/modelLoadingOrb.js';

const FACE_MODELS = {
  positive: {
    tint: '#61ef34',
    path: 'assets/faces/green_positive_sphere.glb'
  },
  negative: {
    tint: '#ef321e',
    path: 'assets/faces/red_negative_sphere.glb'
  },
  neutral: {
    tint: '#fff46a',
    path: 'assets/faces/yellow_neutral_sphere.glb'
  }
};

const SURPRISE_IN_SPEED = 2.2;
const SURPRISE_HOLD_TIME = 0.08;
const SURPRISE_OUT_SPEED = 2.8;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function createReportFaceScene(container, { mood = 'positive' } = {}) {
  const faceConfig = FACE_MODELS[mood] ?? FACE_MODELS.positive;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  const loader = new GLTFLoader();
  const pivot = new THREE.Group();
  const mouse = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -3.1);
  const lookPoint = new THREE.Vector3(0, 1.05, 3.1);
  const clock = new THREE.Clock();

  let disposed = false;
  let animationFrame = null;
  let model = null;
  let mixer = null;
  let actions = [];
  let surprise = null;
  let fallbackBounce = 0;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  camera.position.set(0, 0.95, 4.05);
  scene.add(pivot);
  addLights(scene);

  container.innerHTML = '';
  container.classList.add('is-loading');
  container.appendChild(renderer.domElement);
  attachModelLoadingOrb(container);

  resizeRenderer();
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resizeRenderer);
  resizeObserver?.observe(container);
  window.addEventListener('resize', resizeRenderer);
  window.addEventListener('pointermove', updatePointer, { passive: true });
  window.addEventListener('touchmove', updatePointer, { passive: true });
  renderer.domElement.addEventListener('pointerdown', handlePointerDown);

  loadFace();
  animate();

  async function loadFace() {
    try {
      const gltf = await loader.loadAsync(assetUrl(faceConfig.path));
      if (disposed) return;

      model = gltf.scene;
      normalizeModel(model, faceConfig.tint);
      pivot.add(model);

      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(model);
        actions = gltf.animations.map((clip) => {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          return action;
        });
      }

      container.classList.remove('is-loading');
    } catch (error) {
      console.error('Report face GLB failed to load.', error);
      container.classList.remove('is-loading');
    }
  }

  function updatePointer(event) {
    const x = event.clientX ?? event.touches?.[0]?.clientX ?? window.innerWidth / 2;
    const y = event.clientY ?? event.touches?.[0]?.clientY ?? window.innerHeight / 2;

    mouse.x = (x / Math.max(window.innerWidth, 1)) * 2 - 1;
    mouse.y = -(y / Math.max(window.innerHeight, 1)) * 2 + 1;
  }

  function updateLookPoint() {
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(pointerPlane, lookPoint);
    lookPoint.x = clamp(lookPoint.x, -3.1, 3.1);
    lookPoint.y = clamp(lookPoint.y, -0.35, 2.35);
    lookPoint.z = 3.1;
  }

  function updateFaceLook() {
    updateLookPoint();
    const origin = pivot.getWorldPosition(new THREE.Vector3());
    const direction = lookPoint.clone().sub(origin);
    const yaw = clamp(Math.atan2(direction.x, direction.z) + mouse.x * 0.22, -0.86, 0.86);
    const distance = Math.hypot(direction.x, direction.z);
    const pitch = clamp(-Math.atan2(direction.y - 0.82, distance) - mouse.y * 0.26, -0.42, 0.82);

    pivot.rotation.y += (yaw - pivot.rotation.y) * 0.2;
    pivot.rotation.x += (pitch - pivot.rotation.x) * 0.24;
  }

  function playSurprise() {
    if (!actions.length) {
      fallbackBounce = 1;
      return;
    }

    actions.forEach((action) => {
      action.stop();
      action.reset();
      action.timeScale = SURPRISE_IN_SPEED;
      action.paused = false;
      action.enabled = true;
      action.play();
    });

    const animationDuration = Math.max(0, ...actions.map((action) => action.getClip().duration));
    surprise = {
      phase: 'in',
      timeRemaining: animationDuration / SURPRISE_IN_SPEED + SURPRISE_HOLD_TIME
    };
  }

  function rewindSurprise() {
    actions.forEach((action) => {
      const clipDuration = action.getClip().duration;
      action.time = Math.min(action.time || clipDuration, clipDuration);
      action.timeScale = -SURPRISE_OUT_SPEED;
      action.paused = false;
      action.enabled = true;
      action.play();
    });

    const animationDuration = Math.max(0, ...actions.map((action) => action.getClip().duration));
    surprise = {
      phase: 'out',
      timeRemaining: animationDuration / SURPRISE_OUT_SPEED + 0.02
    };
  }

  function updateSurprise(delta) {
    if (!surprise) return;

    surprise.timeRemaining -= delta;
    if (surprise.timeRemaining > 0) return;

    if (surprise.phase === 'in') {
      rewindSurprise();
      return;
    }

    actions.forEach((action) => {
      action.stop();
      action.reset();
    });
    surprise = null;
  }

  function handlePointerDown(event) {
    updatePointer(event);
    if (!model) {
      playSurprise();
      return;
    }

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(model, true);
    if (hits.length || event.currentTarget === renderer.domElement) {
      playSurprise();
    }
  }

  function resizeRenderer() {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || container.clientWidth || 88));
    const height = Math.max(1, Math.floor(rect.height || container.clientHeight || 88));

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate() {
    if (disposed) return;

    const delta = Math.min(clock.getDelta(), 0.05);
    updateFaceLook();
    mixer?.update(delta);
    updateSurprise(delta);

    if (model) {
      if (fallbackBounce > 0) {
        fallbackBounce = Math.max(0, fallbackBounce - delta * 4);
        const bump = Math.sin((1 - fallbackBounce) * Math.PI) * 0.12;
        model.scale.setScalar(model.userData.baseScale * (1 + bump));
      } else {
        model.scale.setScalar(model.userData.baseScale);
      }
    }

    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(animate);
  }

  return {
    dispose() {
      disposed = true;
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeRenderer);
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('touchmove', updatePointer);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      disposeObject(scene);
      // renderer.dispose()만으로는 WebGL 컨텍스트가 즉시 해제되지 않아, 페이지를 오갈수록
      // 컨텍스트가 쌓여 브라우저 한도(특히 모바일)를 넘으면 일부 얼굴이 깨진다.
      // forceContextLoss()로 컨텍스트를 명시적으로 반납한다.
      try {
        renderer.forceContextLoss();
      } catch (error) {
        /* 일부 환경에서 미지원 — 무시 */
      }
      renderer.dispose();
      container.classList.remove('is-loading');
      container.innerHTML = '';
    }
  };
}

function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xfffbf2, 0x7d8b99, 2.1));

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.6);
  keyLight.position.set(3.8, 5.2, 4.2);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x9fc8ff, 1.05);
  fillLight.position.set(-4.5, 2.2, 2.6);
  scene.add(fillLight);
}

function tintBodyMaterial(material, tint) {
  if (!material?.name?.includes('Body') || !material.color) return material;

  const tintedMaterial = material.clone();
  tintedMaterial.color.set(tint);
  tintedMaterial.needsUpdate = true;
  return tintedMaterial;
}

function prepareMaterial(material) {
  material.side = THREE.FrontSide;
  if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
  material.needsUpdate = true;
  return material;
}

function normalizeModel(root, tint) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const height = Math.max(size.y, 0.001);
  const scale = 1.72 / height;

  root.position.sub(center);
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(root);
  root.position.y -= scaledBox.min.y;
  root.position.y -= 0.05;
  root.userData.baseScale = scale;

  root.traverse((object) => {
    if (!object.isMesh) return;

    object.frustumCulled = false;
    object.castShadow = false;
    object.receiveShadow = false;

    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material = object.material.map((material) => prepareMaterial(tintBodyMaterial(material, tint)));
      } else {
        object.material = prepareMaterial(tintBodyMaterial(object.material, tint));
      }
    }
  });
}
