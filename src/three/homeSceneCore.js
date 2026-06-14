import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SoundEmitter, normalizeDecibel } from './soundEmitter.js';
import { assetUrl, createDracoGltfLoader, disposeObject } from './loaders.js';
import { attachModelLoadingOrb } from '../components/modelLoadingOrb.js';

const MODEL_PATHS = {
  apartment: 'assets/models/apartment_furnished/smart_home_apartment_furnished.glb',
  refrigerator: 'assets/models/refrigerator/refrigerator_lg_optimized.glb',
  washer: 'assets/models/wash/washing_machine_lg_drumspin_optimized.glb',
  robot: 'assets/models/robot_vaccum/robot_vacuum_lg_optimized.glb',
  dishwasher: 'assets/models/dishwasher/dishwasher.glb',
  particle: 'assets/models/sound_wave/futuristic_sound_wave_propagation.glb'
};

// The furnished apartment GLB is authored in its own (large) units. Scale the
// whole shell so its widest horizontal span maps to this many world units (≈ metres),
// which keeps the separately-loaded LG appliances proportional inside it.
const APARTMENT_TARGET_SPAN = 9.2;

// LG appliance models are authored at real-world metre scale; the dollhouse
// apartment uses low cut-away walls, so the appliances are scaled down to read
// in proportion with the furnished rooms.
const APPLIANCE_SCALE = 0.62;

// The robot vacuum is a tiny flat disc; bump it a touch above the other
// appliances so it stays readable as it patrols the floor.
const ROBOT_SCALE = 0.85;

// The refrigerator needs to tuck into the kitchen wall bay (much narrower than
// the appliance's natural width), so it gets its own smaller scale and a small
// nudge forward out of the recess.
const FRIDGE_SCALE = 0.52;
const FRIDGE_FORWARD = 0.06;

const applianceState = {
  refrigerator: { decibel: 38, running: true, color: 0x009dff },
  washer: { decibel: 72, running: true, color: 0xff2b7a },
  robot: { decibel: 58, running: true, color: 0x7b3cff },
  dishwasher: { decibel: 64, running: true, color: 0x12c08a }
};

const robotRadius = 0.24;
const robotClearance = 0.08;
const robotMoveRadius = robotRadius + robotClearance * 0.55;
const robotProbeRadius = robotRadius + robotClearance;

export function createHomeScene(container, { mode = 'interactive' } = {}) {
  const isDashboard = mode === 'dashboard';
  const sceneColor = isDashboard ? 0xffffff : 0xf4f7fb;
  const scene = new THREE.Scene();
  scene.background = isDashboard ? null : new THREE.Color(sceneColor);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: isDashboard,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isDashboard ? 1.5 : 2));
  renderer.setClearColor(sceneColor, isDashboard ? 0 : 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  if (isDashboard) {
    renderer.domElement.setAttribute('aria-hidden', 'true');
  }

  const camera = isDashboard
    ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120)
    : new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  const cameraTarget = new THREE.Vector3(0, 0.1, 0);

  // Isometric dollhouse direction matching the reference render: looking down
  // from the front-right at roughly a 32° elevation / 45° azimuth.
  const ISO_DIR = new THREE.Vector3(1, 0.82, 1).normalize();

  let controls = null;
  if (isDashboard) {
    camera.up.set(0, 1, 0);
  } else {
    camera.position.copy(ISO_DIR).multiplyScalar(8.2).add(cameraTarget);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.copy(cameraTarget);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 5;
    controls.maxDistance = 22;
    controls.screenSpacePanning = false;
  }

  const { loader, dracoLoader } = createDracoGltfLoader();

  const homeRoot = new THREE.Group();
  homeRoot.name = isDashboard ? 'DashboardSmartHomeRoot' : 'InteractiveSmartHomeRoot';
  homeRoot.position.y = isDashboard ? 0.08 : 0.18;
  scene.add(homeRoot);

  const clock = new THREE.Clock();
  const emitters = {};
  const applianceGroups = {};
  const robotSpinNodes = [];
  const washerFallbackSpinNodes = [];
  const wallObstacles = [];
  const applianceObstacles = [];
  const robotHeading = new THREE.Vector3(0.62, 0, 0.78).normalize();
  const robotPath = [];
  let robotPathIndex = 0;
  let robotPathDir = 1;

  let floorBounds = { minX: -3.72, maxX: 3.72, minZ: -2.98, maxZ: 2.98 };
  let floorTopY = 0;
  let washerMixer = null;
  let robotMixer = null;
  let robotTurnTimer = 0;
  let robotWanderTimer = 0;
  let robotTurnDirection = 1;
  let disposed = false;
  let animationId = null;
  let currentResponsiveView = '';
  let particlesEnabled = true;

  // TV: starts off (blank screen); clicking it shows the tvpic texture.
  let tvScreen = null;
  let tvOnMaterial = null;
  let tvOffMaterial = null;
  let tvOn = false;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownX = 0;
  let pointerDownY = 0;

  container.innerHTML = '';
  container.classList.add('is-loading');
  container.appendChild(renderer.domElement);
  attachModelLoadingOrb(container);

  buildLighting();
  resizeRenderer();
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resizeRenderer);
  resizeObserver?.observe(container);
  window.addEventListener('resize', resizeRenderer);
  if (!isDashboard) {
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handleTvTap);
  }

  loadScene();
  animate();

  async function loadScene() {
    try {
      const [apartment, refrigerator, washer, robot, dishwasher, particle] = await Promise.all([
        loadGltf(MODEL_PATHS.apartment),
        loadGltf(MODEL_PATHS.refrigerator),
        loadGltf(MODEL_PATHS.washer),
        loadGltf(MODEL_PATHS.robot),
        loadGltf(MODEL_PATHS.dishwasher),
        loadGltf(MODEL_PATHS.particle)
      ]);
      if (disposed) return;

      const anchors = setupApartment(apartment.scene);
      setupRefrigerator(refrigerator.scene, particle, anchors);
      setupWasher(washer, particle, anchors);
      setupRobot(robot, particle, anchors);
      setupDishwasher(dishwasher.scene, particle, anchors);
      syncEmitters();
      container.classList.remove('is-loading');
    } catch (error) {
      console.error(`${isDashboard ? 'Dashboard' : 'Interactive'} GLB scene failed to load.`, error);
      container.classList.remove('is-loading');
    }
  }

  function loadGltf(path) {
    return loader.loadAsync(assetUrl(path));
  }

  function buildLighting() {
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8190a3, 1.7));

    const key = new THREE.DirectionalLight(0xffffff, 2.15);
    key.position.set(4, -5, 8);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xbdd8ff, 0.9);
    fill.position.set(-4, 3, 4);
    scene.add(fill);
  }

  function setupApartment(root) {
    root.name = isDashboard ? 'DashboardApartmentWalls' : 'InteractiveApartmentWalls';
    const anchors = new Map();

    // Hide the authoring helpers that ship inside the furnished model: the
    // anchor empties and the explicit "*_slot/_opening" placeholders we fill
    // with real LG appliances. The robot path curve is kept and re-styled below.
    const helperPattern = /^(anchor_|appliance_slots_and_anchors$|dishwasher_slot$|dryer_slot$|refrigerator_slot$|washing_machine_slot$)/;

    const embeddedLights = [];
    root.traverse((obj) => {
      if (obj.name.startsWith('anchor_')) {
        anchors.set(obj.name, obj);
      }
      if (helperPattern.test(obj.name)) {
        obj.visible = false;
      }
      // The model ships KHR_lights_punctual lights; drop them so they don't fight
      // the scene's own controlled lighting.
      if (obj.isLight) {
        embeddedLights.push(obj);
        return;
      }

      if (!obj.isMesh) return;
      obj.castShadow = false;
      obj.receiveShadow = false;

      // The model's own path ribbon sits at floor level (gets occluded by the
      // tiles). Hide it here; we redraw its centerline lifted onto the floor.
      if (/robot_vacuum_path_curve/i.test(obj.name)) {
        obj.visible = false;
        return;
      }

      // TV screen ships with tvpic baked on; keep that as the "on" material but
      // start with a blank dark screen so the picture only appears on click.
      if (obj.name === 'living_room_tv_screen') {
        prepareModelMaterial(obj);
        tvScreen = obj;
        tvOnMaterial = obj.material;
        tvOffMaterial = new THREE.MeshBasicMaterial({ color: 0x0a0c12, toneMapped: false });
        obj.material = tvOffMaterial;
        return;
      }

      prepareModelMaterial(obj);
    });
    embeddedLights.forEach((light) => light.parent?.remove(light));

    normalizeApartment(root);
    homeRoot.add(root);
    root.updateWorldMatrix(true, true);
    registerApartmentBounds(root);
    return anchors;
  }

  // Re-scale and re-centre the furnished shell so its footprint is centred on
  // the origin with the floor resting on y = 0, regardless of the GLB's native
  // units/offset. Anchors are children, so their world positions follow.
  function normalizeApartment(root) {
    root.updateWorldMatrix(true, true);
    let box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z) || 1;
    const scale = APARTMENT_TARGET_SPAN / span;
    root.scale.multiplyScalar(scale);

    root.updateWorldMatrix(true, true);
    box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y;
    root.updateWorldMatrix(true, true);
  }

  function setupRefrigerator(model, particleGltf, anchors) {
    const group = createApplianceGroup('RefrigeratorGroup');
    model.name = 'RefrigeratorModel';
    prepareModel(model);
    model.scale.setScalar(FRIDGE_SCALE);
    alignToFloor(model);
    group.add(model);
    placeAtAnchor(group, anchors, 'anchor_kitchen_refrigerator_slot', new THREE.Vector3(2.9, 0, -1.2), Math.PI * 1.5, { useAnchorRotation: false });
    group.position.y = floorTopY;
    group.position.x -= FRIDGE_FORWARD;
    rememberBaseTransform(group);
    homeRoot.add(group);
    registerApplianceObstacle(group);

    const emitter = createEmitter('refrigerator', particleGltf, new THREE.Vector3(0, 0, 0));
    group.add(emitter.root);
    centerEmitterOnModel(emitter, group, model);
  }

  function setupDishwasher(model, particleGltf, anchors) {
    const group = createApplianceGroup('DishwasherGroup');
    model.name = 'DishwasherModel';
    prepareModel(model);
    model.scale.setScalar(APPLIANCE_SCALE);
    alignToFloor(model);
    group.add(model);
    placeAtAnchor(group, anchors, 'anchor_kitchen_dishwasher_slot', new THREE.Vector3(1.4, 0, -1.2), Math.PI, { useAnchorRotation: false });
    group.position.y = floorTopY;
    rememberBaseTransform(group);
    homeRoot.add(group);
    registerApplianceObstacle(group);

    const emitter = createEmitter('dishwasher', particleGltf, new THREE.Vector3(0, 0, 0));
    group.add(emitter.root);
    centerEmitterOnModel(emitter, group, model);
  }

  // Position an emitter at the bounding-box centre of its appliance model,
  // expressed in the group's local frame (handles the group's rotation/offset).
  function centerEmitterOnModel(emitter, group, model) {
    group.updateWorldMatrix(true, true);
    const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    group.worldToLocal(center);
    emitter.root.position.copy(center);
  }

  function setupWasher(gltf, particleGltf, anchors) {
    const group = createApplianceGroup('WasherGroup');
    const model = gltf.scene;
    model.name = 'WasherModel';
    prepareModel(model);
    hideWasherLooseParts(model);
    model.scale.setScalar(APPLIANCE_SCALE);
    alignToFloor(model);
    group.add(model);
    placeAtAnchor(
      group,
      anchors,
      'anchor_laundry_washing_machine_slot',
      new THREE.Vector3(4.3, 0, -1.2),
      0,
      { useAnchorRotation: false }
    );
    group.position.y = floorTopY;
    rememberBaseTransform(group);

    if (gltf.animations.length > 0) {
      washerMixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => washerMixer.clipAction(clip).play());
    }

    model.traverse((obj) => {
      if (/WM_Drum_Interior|WM_Drum_Perforation/.test(obj.name)) {
        washerFallbackSpinNodes.push(obj);
      }
    });
    homeRoot.add(group);
    registerApplianceObstacle(group);

    const emitter = createEmitter('washer', particleGltf, new THREE.Vector3(0, 0.56, -0.04));
    group.add(emitter.root);
  }

  function setupRobot(gltf, particleGltf, anchors) {
    const group = createApplianceGroup('RobotVacuumGroup');
    const model = gltf.scene;
    model.name = 'RobotVacuumModel';
    prepareModel(model);
    model.scale.setScalar(ROBOT_SCALE);
    alignToFloor(model);
    centerModelOnGroundPivot(model);
    group.add(model);
    placeAtAnchor(
      group,
      anchors,
      'anchor_robot_vacuum_start_position',
      new THREE.Vector3(0, 0, 0),
      0,
      { useAnchorRotation: false }
    );
    group.position.y = floorTopY + 0.01;
    buildRobotPath(anchors);

    const robotClips = gltf.animations.filter((clip) => !/Robot_Root_Rig/i.test(clip.name));
    if (robotClips.length > 0) {
      robotMixer = new THREE.AnimationMixer(model);
      robotClips.forEach((clip) => robotMixer.clipAction(clip).play());
    }

    model.traverse((obj) => {
      if (obj.name === 'RV_MainBrush_Roller') {
        robotSpinNodes.push(obj);
      }
    });

    const emitter = createEmitter('robot', particleGltf, new THREE.Vector3(0, 0.28, 0));
    homeRoot.add(group);
    homeRoot.add(emitter.root);
    syncRobotEmitter();
  }

  function createApplianceGroup(name) {
    const group = new THREE.Group();
    group.name = name;
    applianceGroups[name] = group;
    return group;
  }

  function createEmitter(key, particleGltf, offset) {
    const config = applianceState[key];
    const emitter = new SoundEmitter({ color: config.color });
    emitter.attachTemplate(particleGltf.scene, particleGltf.animations);
    emitter.root.position.copy(offset);
    emitters[key] = emitter;
    return emitter;
  }

  function syncEmitters() {
    Object.entries(applianceState).forEach(([key, state]) => {
      const emitter = emitters[key];
      if (!emitter) return;
      emitter.setDecibel(state.decibel);
      emitter.setRunning(state.running);
      emitter.setVisible(particlesEnabled);
    });
  }

  function toggleTV() {
    if (!tvScreen) return;
    tvOn = !tvOn;
    tvScreen.material = tvOn ? tvOnMaterial : tvOffMaterial;
  }

  function handlePointerDown(event) {
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
  }

  // Tap (not drag) on the living-room TV toggles its screen picture on/off.
  function handleTvTap(event) {
    if (disposed || !tvScreen) return;
    if (Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY) > 6) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObject(homeRoot, true);
    for (const hit of hits) {
      let node = hit.object;
      let isEmitter = false;
      let isTv = false;
      while (node) {
        if (node.name === 'RuntimeSoundEmitter') isEmitter = true;
        if (/living_room_tv/i.test(node.name)) isTv = true;
        node = node.parent;
      }
      if (isEmitter) continue; // ignore the translucent sound-wave particles
      if (isTv) {
        toggleTV();
        return;
      }
      // First solid (non-particle) hit isn't the TV → it's occluding; ignore.
      return;
    }
  }

  // Build the robot's route from the model's own path ribbon
  // (robot_vacuum_path_curve) centerline; fall back to the waypoint anchors.
  function buildRobotPath(anchors) {
    robotPath.length = 0;
    robotPathIndex = 0;
    robotPathDir = 1;

    const centerline = extractPathCurveCenterline();
    if (centerline.length >= 2) {
      robotPath.push(...centerline);
      return;
    }

    const names = [
      'anchor_robot_vacuum_path_waypoint_01',
      'anchor_robot_vacuum_path_waypoint_02',
      'anchor_robot_vacuum_path_waypoint_03',
      'anchor_robot_vacuum_path_waypoint_04',
      'anchor_robot_vacuum_path_waypoint_05'
    ];
    const point = new THREE.Vector3();
    names.forEach((name) => {
      const anchor = anchors.get(name);
      if (!anchor) return;
      anchor.getWorldPosition(point);
      robotPath.push({ x: point.x, z: point.z });
    });
  }

  // The ribbon mesh stores its two edges sequentially, so averaging vert i with
  // vert i+half gives the ordered centerline of the path in world XZ.
  function extractPathCurveCenterline() {
    let curve = null;
    homeRoot.traverse((obj) => {
      if (obj.isMesh && /robot_vacuum_path_curve/i.test(obj.name)) curve = obj;
    });
    if (!curve) return [];

    curve.updateWorldMatrix(true, false);
    const pos = curve.geometry.attributes.position;
    const half = Math.floor(pos.count / 2);
    if (half < 2) return [];

    const v = new THREE.Vector3();
    const points = [];
    const stride = Math.max(1, Math.floor(half / 60));
    for (let i = 0; i < half; i += stride) {
      v.set(
        (pos.getX(i) + pos.getX(i + half)) / 2,
        0,
        (pos.getZ(i) + pos.getZ(i + half)) / 2
      ).applyMatrix4(curve.matrixWorld);
      points.push({ x: v.x, z: v.z });
    }
    return points;
  }

  function updateRobot(dt) {
    const group = applianceGroups.RobotVacuumGroup;
    if (!group) return;

    const state = applianceState.robot;
    const position = group.position;
    if (!state.running || robotPath.length < 2) {
      position.y = floorTopY + 0.01;
      return;
    }

    const target = robotPath[robotPathIndex];
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.1) {
      // Ping-pong along the (open) path instead of teleporting back to the start.
      robotPathIndex += robotPathDir;
      if (robotPathIndex >= robotPath.length) {
        robotPathIndex = robotPath.length - 2;
        robotPathDir = -1;
      } else if (robotPathIndex < 0) {
        robotPathIndex = 1;
        robotPathDir = 1;
      }
    } else {
      const speed = 0.5 + normalizeDecibel(state.decibel) * 0.55;
      const stepLen = Math.min(speed * dt, dist);
      position.x += (dx / dist) * stepLen;
      position.z += (dz / dist) * stepLen;
      robotHeading.lerp(new THREE.Vector3(dx / dist, 0, dz / dist), Math.min(1, dt * 6)).normalize();
    }

    position.y = floorTopY + 0.01 + Math.sin(clock.elapsedTime * 6) * 0.004;
    group.rotation.set(0, Math.atan2(robotHeading.x, robotHeading.z), 0);
    syncRobotEmitter();
  }

  function updateApplianceMotion(dt, elapsed) {
    const washerState = applianceState.washer;
    const washerGroup = applianceGroups.WasherGroup;
    if (washerMixer) {
      washerMixer.update(washerState.running ? dt * (0.8 + normalizeDecibel(washerState.decibel) * 2.2) : 0);
    }
    if (washerGroup) {
      const shake = washerState.running ? normalizeDecibel(washerState.decibel) * 0.012 : 0;
      const basePosition = washerGroup.userData.basePosition ?? washerGroup.position;
      const baseRotation = washerGroup.userData.baseRotation ?? washerGroup.rotation;
      washerGroup.position.x = basePosition.x + Math.sin(elapsed * 32) * shake;
      washerGroup.position.y = basePosition.y;
      washerGroup.position.z = basePosition.z + Math.cos(elapsed * 27) * shake * 0.45;
      washerGroup.rotation.set(baseRotation.x, baseRotation.y, baseRotation.z + Math.sin(elapsed * 24) * shake * 0.22);
    }
    if (!washerMixer && washerState.running) {
      const spin = dt * (7 + normalizeDecibel(washerState.decibel) * 20);
      washerFallbackSpinNodes.forEach((node) => {
        node.rotation.x += spin;
      });
    }

    const robotState = applianceState.robot;
    if (robotMixer) {
      robotMixer.update(robotState.running ? dt * (0.8 + normalizeDecibel(robotState.decibel) * 1.6) : 0);
    }
    if (robotState.running) {
      const spin = dt * (9 + normalizeDecibel(robotState.decibel) * 14);
      robotSpinNodes.forEach((node) => {
        node.rotation.z += spin;
      });
    }

    const refrigeratorGroup = applianceGroups.RefrigeratorGroup;
    if (refrigeratorGroup) {
      const hum = applianceState.refrigerator.running ? normalizeDecibel(applianceState.refrigerator.decibel) * 0.004 : 0;
      const baseRotation = refrigeratorGroup.userData.baseRotation ?? refrigeratorGroup.rotation;
      refrigeratorGroup.rotation.set(baseRotation.x, baseRotation.y + Math.sin(elapsed * 10) * hum, baseRotation.z);
    }
  }

  function resizeRenderer() {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || container.clientWidth || (isDashboard ? 800 : 1)));
    const height = Math.max(1, Math.floor(rect.height || container.clientHeight || (isDashboard ? 500 : 1)));
    if (!isDashboard && (width === 0 || height === 0)) return;

    if (isDashboard) {
      const aspect = width / height;
      const viewHeight = width < 600 ? 9.8 : 8.6;
      const viewWidth = viewHeight * aspect;

      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.position.copy(ISO_DIR).multiplyScalar(40).add(cameraTarget);
      camera.up.set(0, 1, 0);
      camera.lookAt(cameraTarget);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      return;
    }

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    applyResponsiveCamera(width, height);
    camera.updateProjectionMatrix();
  }

  function applyResponsiveCamera(width, height) {
    if (isDashboard || !controls) return;
    const viewportWidth = window.innerWidth || width;
    const viewportHeight = window.innerHeight || height;
    const mode =
      viewportHeight <= 560 && viewportWidth > viewportHeight
        ? 'landscape'
        : viewportWidth <= 900
          ? 'compact'
          : 'desktop';
    if (mode === currentResponsiveView) return;

    currentResponsiveView = mode;
    const placeIso = (fov, distance, targetY) => {
      camera.fov = fov;
      controls.target.set(0, targetY, 0);
      camera.position.copy(ISO_DIR).multiplyScalar(distance).add(controls.target);
    };
    if (mode === 'compact') {
      placeIso(46, 10, 0.1);
      controls.minDistance = 4.5;
      controls.maxDistance = 24;
      controls.maxPolarAngle = Math.PI * 0.49;
    } else if (mode === 'landscape') {
      placeIso(40, 8.9, 0.1);
      controls.minDistance = 4;
      controls.maxDistance = 22;
      controls.maxPolarAngle = Math.PI * 0.49;
    } else {
      placeIso(38, 8.2, 0.1);
      controls.minDistance = 4;
      controls.maxDistance = 22;
      controls.maxPolarAngle = Math.PI * 0.49;
    }
    controls.update();
  }

  function animate() {
    if (disposed) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;

    controls?.update();
    updateRobot(dt);
    updateApplianceMotion(dt, elapsed);
    Object.values(emitters).forEach((emitter) => emitter.update(dt));
    renderer.render(scene, camera);
    animationId = window.requestAnimationFrame(animate);
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    setSoundVisualization(enabled) {
      particlesEnabled = !!enabled;
      Object.values(emitters).forEach((emitter) => emitter.setVisible(particlesEnabled));
    },
    dispose() {
      disposed = true;
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeRenderer);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handleTvTap);
      if (animationId) window.cancelAnimationFrame(animationId);
      controls?.dispose();
      dracoLoader.dispose?.();
      disposeObject(scene);
      renderer.dispose();
      container.classList.remove('is-loading');
      container.innerHTML = '';
    }
  };

  function rememberBaseTransform(group) {
    group.userData.basePosition = group.position.clone();
    group.userData.baseRotation = group.rotation.clone();
  }

  function registerApartmentBounds(root) {
    const floorBox = new THREE.Box3();
    let hasFloor = false;
    wallObstacles.length = 0;

    root.traverse((obj) => {
      if (!obj.isMesh) return;
      if (obj.name.startsWith('floor')) {
        floorBox.union(new THREE.Box3().setFromObject(obj));
        hasFloor = true;
      }
      if (obj.name.startsWith('wall')) {
        wallObstacles.push(boxToObstacle(new THREE.Box3().setFromObject(obj), 0.04));
      }
    });

    if (hasFloor) {
      floorBounds = {
        minX: floorBox.min.x + robotRadius,
        maxX: floorBox.max.x - robotRadius,
        minZ: floorBox.min.z + robotRadius,
        maxZ: floorBox.max.z - robotRadius
      };
      // floorBox is in world space; convert the walkable surface height back into
      // homeRoot-local space so appliances (children of homeRoot) sit on the floor.
      floorTopY = floorBox.max.y - homeRoot.position.y;
    }
  }

  function registerApplianceObstacle(group, padding = 0.08) {
    group.updateWorldMatrix(true, true);
    applianceObstacles.push(boxToObstacle(new THREE.Box3().setFromObject(group), padding));
  }

  function boxToObstacle(box, padding = 0) {
    return {
      minX: box.min.x - padding,
      maxX: box.max.x + padding,
      minZ: box.min.z - padding,
      maxZ: box.max.z + padding
    };
  }

  function syncRobotEmitter() {
    const group = applianceGroups.RobotVacuumGroup;
    const emitter = emitters.robot;
    if (!group || !emitter) return;
    emitter.root.position.set(group.position.x, group.position.y + 0.28, group.position.z);
    emitter.root.rotation.set(0, 0, 0);
  }

  function rotateRobotHeading(angle) {
    robotHeading.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
  }

  function chooseTurnDirection(position) {
    const left = robotHeading.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 0.5);
    const right = robotHeading.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI * 0.5);
    const leftClearance = measureOpenDistance(position, left, robotProbeRadius);
    const rightClearance = measureOpenDistance(position, right, robotProbeRadius);
    if (Math.abs(leftClearance - rightClearance) > 0.08) {
      return leftClearance > rightClearance ? 1 : -1;
    }
    return Math.sin(clock.elapsedTime * 1.7) >= 0 ? 1 : -1;
  }

  function steerRobotTowardOpenSpace(position, amount) {
    const openDirection = findOpenDirection(position);
    if (!openDirection) return;
    robotHeading.lerp(openDirection, amount).normalize();
  }

  function findOpenDirection(position) {
    const baseAngle = Math.atan2(robotHeading.x, robotHeading.z);
    const offsets = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, Math.PI];
    let bestDirection = null;
    let bestScore = -Infinity;

    offsets.forEach((offset) => {
      const angle = baseAngle + offset;
      const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      const distance = measureOpenDistance(position, direction, robotProbeRadius);
      const forwardBias = Math.cos(offset) * 0.08;
      const score = distance + forwardBias;
      if (score > bestScore) {
        bestScore = score;
        bestDirection = direction;
      }
    });

    return bestDirection;
  }

  function measureOpenDistance(position, direction, radius) {
    const maxDistance = 1.48;
    const step = 0.12;
    for (let distance = step; distance <= maxDistance; distance += step) {
      const probe = position.clone().addScaledVector(direction, distance);
      if (isRobotBlocked(probe, radius)) {
        return Math.max(0, distance - step);
      }
    }
    return maxDistance;
  }

  function isRobotBlocked(point, radius) {
    const floorInset = Math.max(0, radius - robotRadius);
    if (
      point.x < floorBounds.minX + floorInset ||
      point.x > floorBounds.maxX - floorInset ||
      point.z < floorBounds.minZ + floorInset ||
      point.z > floorBounds.maxZ - floorInset
    ) {
      return true;
    }
    return [...wallObstacles, ...applianceObstacles].some((obstacle) =>
      circleIntersectsObstacle(point.x, point.z, radius, obstacle)
    );
  }

  function circleIntersectsObstacle(x, z, radius, obstacle) {
    const closestX = Math.min(obstacle.maxX, Math.max(obstacle.minX, x));
    const closestZ = Math.min(obstacle.maxZ, Math.max(obstacle.minZ, z));
    const dx = x - closestX;
    const dz = z - closestZ;
    return dx * dx + dz * dz <= radius * radius;
  }

  function getRobotClearanceCorrection(position, radius) {
    const correction = new THREE.Vector3();
    const floorInset = Math.max(0, radius - robotRadius);
    const minX = floorBounds.minX + floorInset;
    const maxX = floorBounds.maxX - floorInset;
    const minZ = floorBounds.minZ + floorInset;
    const maxZ = floorBounds.maxZ - floorInset;

    if (position.x < minX) correction.x += minX - position.x;
    if (position.x > maxX) correction.x -= position.x - maxX;
    if (position.z < minZ) correction.z += minZ - position.z;
    if (position.z > maxZ) correction.z -= position.z - maxZ;

    [...wallObstacles, ...applianceObstacles].forEach((obstacle) => {
      const push = getObstacleSeparation(position.x, position.z, radius, obstacle);
      if (push) correction.add(push);
    });

    if (correction.length() > 0.14) correction.setLength(0.14);
    return correction;
  }

  function getObstacleSeparation(x, z, radius, obstacle) {
    const closestX = Math.min(obstacle.maxX, Math.max(obstacle.minX, x));
    const closestZ = Math.min(obstacle.maxZ, Math.max(obstacle.minZ, z));
    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;
    const safeGap = 0.012;
    if (distSq > radius * radius) return null;

    if (distSq > 0.000001) {
      const distance = Math.sqrt(distSq);
      const depth = radius - distance + safeGap;
      return new THREE.Vector3((dx / distance) * depth, 0, (dz / distance) * depth);
    }

    const distances = [
      { axis: 'x', sign: -1, value: Math.abs(x - obstacle.minX) },
      { axis: 'x', sign: 1, value: Math.abs(obstacle.maxX - x) },
      { axis: 'z', sign: -1, value: Math.abs(z - obstacle.minZ) },
      { axis: 'z', sign: 1, value: Math.abs(obstacle.maxZ - z) }
    ].sort((a, b) => a.value - b.value);
    const nearest = distances[0];
    const push = radius + nearest.value + safeGap;
    return nearest.axis === 'x'
      ? new THREE.Vector3(nearest.sign * push, 0, 0)
      : new THREE.Vector3(0, 0, nearest.sign * push);
  }

  function keepRobotInsideFloor(position, radius) {
    const floorInset = Math.max(0, radius - robotRadius);
    position.x = Math.min(floorBounds.maxX - floorInset, Math.max(floorBounds.minX + floorInset, position.x));
    position.z = Math.min(floorBounds.maxZ - floorInset, Math.max(floorBounds.minZ + floorInset, position.z));
  }
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
    prepareModelMaterial(obj);
  });
}

function prepareModelMaterial(obj) {
  const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
  materials.forEach((material) => {
    if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
    material.needsUpdate = true;
  });
}

function alignToFloor(root) {
  const box = new THREE.Box3().setFromObject(root);
  if (Number.isFinite(box.min.y)) root.position.y -= box.min.y;
}

function centerModelOnGroundPivot(root) {
  const box = new THREE.Box3().setFromObject(root);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.min.z)) return;
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
}

function placeAtAnchor(group, anchors, anchorName, fallbackPosition, fallbackRotationY = 0, options = {}) {
  const anchor = anchors.get(anchorName);
  if (anchor) {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    anchor.getWorldPosition(position);
    anchor.getWorldQuaternion(quaternion);
    group.position.copy(position);
    if (options.useAnchorRotation === false) {
      group.rotation.set(0, fallbackRotationY, 0);
    } else {
      group.quaternion.copy(quaternion);
    }
    group.position.y = 0;
    return;
  }
  group.position.copy(fallbackPosition);
  group.rotation.set(0, fallbackRotationY, 0);
}
