import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SoundEmitter, normalizeDecibel } from './soundEmitter.js';
import { assetUrl, createDracoGltfLoader, disposeObject } from './loaders.js';

const MODEL_PATHS = {
  apartment: 'assets/models/house_wall/simple_apartment_walls_optimized.glb',
  refrigerator: 'assets/models/refrigerator/refrigerator_lg_optimized.glb',
  washer: 'assets/models/wash/washing_machine_lg_drumspin_optimized.glb',
  robot: 'assets/models/robot_vaccum/robot_vacuum_lg_optimized.glb',
  particle: 'assets/models/particle/particle_only_sound_effect_optimized.glb'
};

const applianceState = {
  refrigerator: { decibel: 38, running: true, color: 0x009dff },
  washer: { decibel: 72, running: true, color: 0xff2b7a },
  robot: { decibel: 58, running: true, color: 0x7b3cff }
};

const robotRadius = 0.24;
const robotClearance = 0.08;
const robotMoveRadius = robotRadius + robotClearance * 0.55;
const robotProbeRadius = robotRadius + robotClearance;
const wallHeightScale = 0.55;

export function createHomeScene(container, { mode = 'interactive' } = {}) {
  const isDashboard = mode === 'dashboard';
  const sceneColor = isDashboard ? 0xffffff : 0xf4f7fb;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(sceneColor);

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
    ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80)
    : new THREE.PerspectiveCamera(43, 1, 0.1, 60);
  const cameraTarget = new THREE.Vector3(0, 0, 0);

  let controls = null;
  if (isDashboard) {
    camera.up.set(0, 0, -1);
  } else {
    camera.position.set(5.9, 5.2, 7.2);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0.1, 0.9, 0);
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 3.1;
    controls.maxDistance = 12;
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

  let floorBounds = { minX: -3.72, maxX: 3.72, minZ: -2.98, maxZ: 2.98 };
  let washerMixer = null;
  let robotMixer = null;
  let robotTurnTimer = 0;
  let robotWanderTimer = 0;
  let robotTurnDirection = 1;
  let disposed = false;
  let animationId = null;
  let currentResponsiveView = '';

  container.innerHTML = '';
  container.classList.add('is-loading');
  container.appendChild(renderer.domElement);

  buildLighting();
  resizeRenderer();
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resizeRenderer);
  resizeObserver?.observe(container);
  window.addEventListener('resize', resizeRenderer);

  loadScene();
  animate();

  async function loadScene() {
    try {
      const [apartment, refrigerator, washer, robot, particle] = await Promise.all([
        loadGltf(MODEL_PATHS.apartment),
        loadGltf(MODEL_PATHS.refrigerator),
        loadGltf(MODEL_PATHS.washer),
        loadGltf(MODEL_PATHS.robot),
        loadGltf(MODEL_PATHS.particle)
      ]);
      if (disposed) return;

      const anchors = setupApartment(apartment.scene);
      setupRefrigerator(refrigerator.scene, particle.scene, anchors);
      setupWasher(washer, particle.scene, anchors);
      setupRobot(robot, particle.scene, anchors);
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

    root.traverse((obj) => {
      if (obj.name.startsWith('EMPTY_')) {
        anchors.set(obj.name, obj);
      }

      if (
        obj.name.startsWith('APT_Marker_') ||
        obj.name.startsWith('APT_RobotNav_') ||
        obj.name.startsWith('EMPTY_RobotNav_')
      ) {
        obj.visible = false;
      }

      if (!obj.isMesh) return;
      obj.castShadow = false;
      obj.receiveShadow = false;

      if (obj.name.startsWith('APT_Wall_')) {
        obj.position.y *= wallHeightScale;
        obj.scale.y *= wallHeightScale;
        setMaterialOpacity(obj, obj.name.includes('DarkTopCap') ? 0.6 : 0.46);
      }

      if (obj.name.startsWith('APT_Window_')) {
        obj.position.y = 0.75;
        obj.scale.y = 1;
        setMaterialOpacity(obj, 0.24);
      }

      prepareModelMaterial(obj);
    });

    homeRoot.add(root);
    root.updateWorldMatrix(true, true);
    registerApartmentBounds(root);
    return anchors;
  }

  function setupRefrigerator(model, particleTemplate, anchors) {
    const group = createApplianceGroup('RefrigeratorGroup');
    model.name = 'RefrigeratorModel';
    prepareModel(model);
    alignToFloor(model);
    group.add(model);
    placeAtAnchor(group, anchors, 'EMPTY_Appliance_Refrigerator_Kitchen_WestWall_Standard', new THREE.Vector3(-2.78, 0, 1.16), Math.PI * 0.5);
    rememberBaseTransform(group);
    homeRoot.add(group);
    registerApplianceObstacle(group);

    const emitter = createEmitter('refrigerator', particleTemplate, new THREE.Vector3(0.08, 0.42, 0.42));
    group.add(emitter.root);
  }

  function setupWasher(gltf, particleTemplate, anchors) {
    const group = createApplianceGroup('WasherGroup');
    const model = gltf.scene;
    model.name = 'WasherModel';
    prepareModel(model);
    hideWasherLooseParts(model);
    alignToFloor(model);
    group.add(model);
    placeAtAnchor(
      group,
      anchors,
      'EMPTY_Appliance_WashingMachine_Balcony_NorthWall_Left',
      new THREE.Vector3(-2.42, 0, 2.36),
      Math.PI * 0.5,
      { useAnchorRotation: false }
    );
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

    const emitter = createEmitter('washer', particleTemplate, new THREE.Vector3(0, 0.56, -0.04));
    group.add(emitter.root);
  }

  function setupRobot(gltf, particleTemplate, anchors) {
    const group = createApplianceGroup('RobotVacuumGroup');
    const model = gltf.scene;
    model.name = 'RobotVacuumModel';
    prepareModel(model);
    alignToFloor(model);
    centerModelOnGroundPivot(model);
    group.add(model);
    placeAtAnchor(
      group,
      anchors,
      'EMPTY_Appliance_RobotVacuum_LivingRoom_Start',
      new THREE.Vector3(0.2, 0, 1.7),
      0,
      { useAnchorRotation: false }
    );
    group.position.y = 0.01;

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

    const emitter = createEmitter('robot', particleTemplate, new THREE.Vector3(0, 0.28, 0));
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

  function createEmitter(key, template, offset) {
    const config = applianceState[key];
    const emitter = new SoundEmitter({ color: config.color });
    emitter.attachTemplate(template);
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
      emitter.setVisible(true);
    });
  }

  function updateRobot(dt) {
    const group = applianceGroups.RobotVacuumGroup;
    if (!group) return;

    const state = applianceState.robot;
    const position = group.position;
    if (!state.running) {
      position.y = 0.01;
      return;
    }

    robotWanderTimer += dt;
    robotTurnTimer = Math.max(0, robotTurnTimer - dt);

    const db = normalizeDecibel(state.decibel);
    const speed = 0.38 + db * 0.26;
    const correction = getRobotClearanceCorrection(position, robotProbeRadius);
    if (correction.lengthSq() > 0) {
      position.add(correction);
      keepRobotInsideFloor(position, robotProbeRadius);
      steerRobotTowardOpenSpace(position, 0.9);
      robotTurnTimer = Math.max(robotTurnTimer, 0.28);
    }

    const lookAhead = robotProbeRadius + 0.28 + speed * 0.18;
    const probe = position.clone().addScaledVector(robotHeading, lookAhead);

    if (robotTurnTimer > 0 || isRobotBlocked(probe, robotProbeRadius)) {
      if (robotTurnTimer <= 0) {
        steerRobotTowardOpenSpace(position, 0.45);
        robotTurnDirection = chooseTurnDirection(position);
        robotTurnTimer = 0.42 + db * 0.18;
      }
      rotateRobotHeading(robotTurnDirection * (2.7 + db * 1.6) * dt);
    } else {
      const sweep = Math.sin(robotWanderTimer * 1.35) * 0.28;
      rotateRobotHeading(sweep * dt);

      const next = position.clone().addScaledVector(robotHeading, speed * dt);
      if (!isRobotBlocked(next, robotMoveRadius)) {
        position.copy(next);
      } else {
        steerRobotTowardOpenSpace(position, 0.75);
        robotTurnDirection = chooseTurnDirection(position);
        robotTurnTimer = 0.5;
      }
    }

    position.y = 0.01 + Math.sin(clock.elapsedTime * 6) * 0.004;
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
      const viewHeight = width < 600 ? 7.8 : 6.7;
      const viewWidth = viewHeight * aspect;

      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.position.set(0, 9.6, 0);
      camera.up.set(0, 0, -1);
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
    if (mode === 'compact') {
      camera.fov = 50;
      camera.position.set(0.6, 6.2, 7.4);
      controls.target.set(0, 0.45, 0);
      controls.minDistance = 3.6;
      controls.maxDistance = 13;
      controls.maxPolarAngle = Math.PI * 0.46;
    } else if (mode === 'landscape') {
      camera.fov = 46;
      camera.position.set(5.3, 4.7, 6.5);
      controls.target.set(0.05, 0.7, 0);
      controls.minDistance = 3.2;
      controls.maxDistance = 12;
      controls.maxPolarAngle = Math.PI * 0.48;
    } else {
      camera.fov = 43;
      camera.position.set(5.9, 5.2, 7.2);
      controls.target.set(0.1, 0.9, 0);
      controls.minDistance = 3.1;
      controls.maxDistance = 12;
      controls.maxPolarAngle = Math.PI * 0.48;
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
    Object.values(emitters).forEach((emitter) => emitter.update(elapsed));
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
      if (obj.name.startsWith('APT_Floor_')) {
        floorBox.union(new THREE.Box3().setFromObject(obj));
        hasFloor = true;
      }
      if (obj.name.startsWith('APT_Wall_') && !obj.name.includes('DarkTopCap')) {
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

function setMaterialOpacity(obj, opacity) {
  const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
  materials.forEach((material) => {
    material.transparent = true;
    material.opacity = opacity;
    material.depthWrite = false;
    material.needsUpdate = true;
  });
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
