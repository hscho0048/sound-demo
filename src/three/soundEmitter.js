import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const DECIBEL_MIN = 20;
const DECIBEL_MAX = 95;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function normalizeDecibel(decibel) {
  return clamp01((decibel - DECIBEL_MIN) / (DECIBEL_MAX - DECIBEL_MIN));
}

export function radiusFromDecibel(decibel) {
  return lerp(0.42, 2.25, smoothstep(0, 1, normalizeDecibel(decibel)));
}

export class SoundEmitter {
  constructor({ color = 0xffffff } = {}) {
    this.decibel = 45;
    this.running = true;
    this.color = new THREE.Color(color);
    this.root = new THREE.Group();
    this.root.name = 'RuntimeSoundEmitter';

    this.templateRoot = null;
    this.materials = [];
    this.particlesVisible = true;
  }

  attachTemplate(templateScene) {
    this.templateRoot = cloneSkeleton(templateScene);
    this.templateRoot.name = 'GLBSoundParticleTemplate';
    let materialIndex = 0;
    this.templateRoot.traverse((obj) => {
      if (!obj.isMesh) return;
      const material = new THREE.MeshBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      });
      material.name = `SoundParticleColor_${materialIndex}`;
      obj.material = material;
      obj.renderOrder = 2;
      this.materials.push(material);
      materialIndex += 1;
    });
    this.root.add(this.templateRoot);
  }

  setDecibel(decibel) {
    this.decibel = decibel;
  }

  setRunning(running) {
    this.running = running;
    this.syncVisibility();
  }

  setVisible(visible) {
    this.particlesVisible = visible;
    this.syncVisibility();
  }

  syncVisibility() {
    this.root.visible = this.running && this.particlesVisible;
  }

  update(time) {
    if (!this.running || !this.templateRoot) return;

    const db = normalizeDecibel(this.decibel);
    const spread = smoothstep(0, 1, db);
    const pulseSpeed = lerp(1.45, 4.9, db);
    const mainWave = Math.sin(time * pulseSpeed);
    const secondaryWave = Math.sin(time * pulseSpeed * 0.53 + 1.4);
    const ripple = mainWave * 0.68 + secondaryWave * 0.32;
    const radiusScale = radiusFromDecibel(this.decibel);
    const globalPulse = 1 + lerp(0.025, 0.09, db) * ripple;
    const breath = 1 + Math.sin(time * pulseSpeed * 0.31 + 1.2) * lerp(0.015, 0.05, db);
    const templateScale = radiusScale * globalPulse * breath;
    this.templateRoot.scale.setScalar(templateScale);
    this.templateRoot.rotation.y = Math.sin(time * 0.28) * lerp(0.02, 0.1, db);
    this.templateRoot.rotation.x = Math.sin(time * pulseSpeed * 0.34) * lerp(0.005, 0.035, db);
    this.templateRoot.rotation.z = Math.cos(time * pulseSpeed * 0.31) * lerp(0.005, 0.03, db);
    this.updateMorphTargets(db, spread, time, globalPulse);
  }

  updateMorphTargets(db, spread, time, globalPulse) {
    const pulseSpeed = lerp(1.6, 5.6, db);
    const pulse =
      Math.sin(time * pulseSpeed) * 0.58 +
      Math.sin(time * pulseSpeed * 0.61 + 0.9) * 0.28 +
      Math.sin(time * pulseSpeed * 0.27 + 2.1) * 0.14;
    const pulseAmount = pulse * 0.5 + 0.5;
    const wavePulse = clamp01((0.32 + spread * 0.5 + pulseAmount * lerp(0.05, 0.18, db)) * globalPulse);
    const highSpread = clamp01(0.08 + spread * 0.92);
    const quietNarrow = clamp01((1 - spread) * 0.58);

    this.templateRoot.traverse((obj) => {
      if (!obj.isMesh || !obj.morphTargetDictionary || !obj.morphTargetInfluences) return;
      const dict = obj.morphTargetDictionary;
      const influences = obj.morphTargetInfluences;

      if (dict.SHAPE_Particle_Wave_Pulse !== undefined) {
        influences[dict.SHAPE_Particle_Wave_Pulse] = wavePulse;
      }
      if (dict.SHAPE_Decibel_High_Spread !== undefined) {
        influences[dict.SHAPE_Decibel_High_Spread] = highSpread;
      }
      if (dict.SHAPE_Quiet_Narrow_Vibration !== undefined) {
        influences[dict.SHAPE_Quiet_Narrow_Vibration] = quietNarrow;
      }
    });
  }
}
