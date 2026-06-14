import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { assetUrl, createDracoGltfLoader, disposeObject } from './loaders.js';
import { attachModelLoadingOrb } from '../components/modelLoadingOrb.js';

const MODEL_PATHS = {
  washer: 'assets/models/wash/washing_machine_lg_drumspin_optimized.glb',
  robot: 'assets/models/robot_vaccum/robot_vacuum_lg_optimized.glb',
  refrigerator: 'assets/models/refrigerator/refrigerator_lg_optimized.glb',
  dishwasher: 'assets/models/dishwasher/dishwasher.glb'
};

// Refrigerator door pivots → their open-animation clip. Clicking a door part
// toggles the matching clip.
const FRIDGE_DOOR_CLIPS = {
  CTRL_Door_Left: 'Act_Door_Left_Open',
  CTRL_Door_Right: 'Act_Door_Right_Open',
  CTRL_Freezer: 'Act_Freezer_Open'
};

// The dishwasher's single open sequence is split across several clips (door +
// racks + dishes sliding out); they play together as one open/close action.
const DISHWASHER_OPEN_PREFIX = 'DW_Open_Door_And_Slide_Dishes_';

export function createDeviceDetailModelScene(container, { modelType = 'washer' } = {}) {
  const scene = new THREE.Scene();
  scene.background = null;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x4b164c, 0);
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

  const doorActions = new Map();
  const doorOpen = new Map();
  const dishwasherActions = [];
  let dishwasherOpen = false;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownX = 0;
  let pointerDownY = 0;

  container.innerHTML = '';
  container.classList.add('is-loading');
  container.appendChild(renderer.domElement);
  attachModelLoadingOrb(container);

  addLighting(scene);
  resizeRenderer();
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resizeRenderer);
  resizeObserver?.observe(container);
  window.addEventListener('resize', resizeRenderer);
  renderer.domElement.addEventListener('pointerdown', handlePointerDown);
  renderer.domElement.addEventListener('pointerup', handleDoorTap);

  loadModel();
  animate();

  async function loadModel() {
    try {
      const path = MODEL_PATHS[modelType] ?? MODEL_PATHS.washer;
      const gltf = await loader.loadAsync(assetUrl(path));
      if (disposed) return;

      model = gltf.scene;
      prepareModel(model);
      if (modelType === 'washer') hideWasherLooseParts(model);
      alignAndFrameModel(model);
      root.add(model);

      if (modelType === 'refrigerator') {
        // Doors stay closed; clicking a door plays its open clip (see toggleDoor).
        setupFridgeDoors(gltf.animations ?? []);
      } else if (modelType === 'dishwasher') {
        // Door stays closed; clicking anywhere plays the open sequence.
        setupDishwasherDoor(gltf.animations ?? []);
      } else {
        // Skip the robot's root-motion clip so it stays centred (spins in place via
        // the turntable + brush clips) instead of driving itself off-screen.
        const clips = (gltf.animations ?? []).filter((clip) => !/Robot_Root_Rig/i.test(clip.name));
        if (clips.length) {
          mixer = new THREE.AnimationMixer(model);
          clips.forEach((clip) => mixer.clipAction(clip).play());
        }
      }
      container.classList.remove('is-loading');
    } catch (error) {
      console.error('Device detail GLB failed to load.', error);
      container.classList.remove('is-loading');
    }
  }

  function setupFridgeDoors(animations) {
    mixer = new THREE.AnimationMixer(model);
    doorActions.clear();
    doorOpen.clear();
    animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;
      doorActions.set(clip.name, action);
    });
  }

  function setupDishwasherDoor(animations) {
    mixer = new THREE.AnimationMixer(model);
    dishwasherActions.length = 0;
    dishwasherOpen = false;
    animations
      .filter((clip) => clip.name.startsWith(DISHWASHER_OPEN_PREFIX))
      .forEach((clip) => {
        const action = mixer.clipAction(clip);
        action.loop = THREE.LoopOnce;
        action.clampWhenFinished = true;
        // The model's default pose is door-open; hold the clip at frame 0 (closed).
        action.play();
        action.time = 0;
        action.paused = true;
        dishwasherActions.push(action);
      });
    mixer.update(0);
  }

  function toggleDishwasher() {
    if (!dishwasherActions.length) return;
    dishwasherOpen = !dishwasherOpen;
    dishwasherActions.forEach((action) => {
      const duration = action.getClip().duration;
      action.enabled = true;
      action.paused = false;
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      if (dishwasherOpen) {
        action.timeScale = 1;
        if (action.time >= duration) action.time = 0;
      } else {
        action.timeScale = -1;
        if (action.time <= 0) action.time = duration;
      }
      action.play();
    });
  }

  function toggleDoor(clipName) {
    const action = doorActions.get(clipName);
    if (!action) return;
    const duration = action.getClip().duration;
    const open = !(doorOpen.get(clipName) || false);
    doorOpen.set(clipName, open);

    action.enabled = true;
    action.paused = false;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    if (open) {
      action.timeScale = 1;
      if (action.time >= duration) action.time = 0;
    } else {
      action.timeScale = -1;
      if (action.time <= 0) action.time = duration;
    }
    action.play();
  }

  function handleDoorTap(event) {
    if (disposed || !model) return;
    if (modelType !== 'refrigerator' && modelType !== 'dishwasher') return;
    if (Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY) > 6) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObject(model, true);
    if (!hits.length) return;

    if (modelType === 'dishwasher') {
      // Single door — any tap on the unit toggles the open sequence.
      toggleDishwasher();
      return;
    }

    let node = hits[0].object;
    while (node) {
      const clipName = FRIDGE_DOOR_CLIPS[node.name];
      if (clipName) {
        toggleDoor(clipName);
        return;
      }
      node = node.parent;
    }
  }

  function handlePointerDown(event) {
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
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
      // Keep door-interactive appliances still so their doors are easy to click.
      if (modelType !== 'refrigerator' && modelType !== 'dishwasher') {
        model.rotation.y += delta * 0.28;
      }
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
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handleDoorTap);
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

function hideWasherLooseParts(root) {
  const hiddenPattern =
    /^(WM_Back_Hose_|WM_Back_Power_Cable|WM_Back_Label_Sticker|WM_Vent_Grille|WM_Feet_|WM_Side_.*_Inset_Back|WM_ControlPanel_Button_|WM_ControlPanel_Buttons|WM_Button_Label_)/;
  root.traverse((obj) => {
    if (hiddenPattern.test(obj.name)) obj.visible = false;
  });
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
