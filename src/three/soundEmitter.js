import * as THREE from 'three';

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
  return lerp(0.28, 0.95, smoothstep(0, 1, normalizeDecibel(decibel)));
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
    this.mixer = null;
  }

  attachTemplate(templateScene, animations = []) {
    // The model is morph/transform-animated (no skinned meshes), so a plain deep
    // clone is enough and keeps each emitter's hierarchy independent.
    const inner = templateScene.clone(true);
    inner.name = 'GLBSoundParticleInner';

    // The futuristic_sound_wave model ships with a preview camera and ~380 tiny
    // outer dispersion particles. Strip the camera and the dispersion cloud so the
    // three concurrent emitters stay light and read as clean propagation shells.
    const remove = [];
    inner.traverse((obj) => {
      if (/Preview_Camera/i.test(obj.name) || obj.isCamera) {
        remove.push(obj);
      } else if (/Outer_Spherical_Dispersion_Particle/i.test(obj.name)) {
        remove.push(obj);
      }
    });
    remove.forEach((obj) => obj.parent?.remove(obj));

    // Normalise: recentre on the origin and scale so the cloud has unit radius,
    // making the decibel-driven radius in update() behave in world units.
    inner.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(inner);
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxHalf = Math.max(size.x, size.y, size.z) * 0.5 || 1;
      inner.position.sub(center);
      inner.scale.multiplyScalar(1 / maxHalf);
    }

    let materialIndex = 0;
    inner.traverse((obj) => {
      if (!obj.isMesh) return;
      const material = new THREE.MeshBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: 0.085,
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

    this.templateRoot = new THREE.Group();
    this.templateRoot.name = 'GLBSoundParticleTemplate';
    this.templateRoot.add(inner);
    this.root.add(this.templateRoot);

    // Play the model's own baked propagation animation instead of procedurally
    // pulsing the whole cloud. Skip the opacity/glow loop (it would fight our
    // transparency) and the removed outer-dispersion tracks.
    const clips = animations.filter(
      (clip) => !/^Baked|Outer_Spherical_Dispersion/i.test(clip.name)
    );
    if (clips.length > 0) {
      this.mixer = new THREE.AnimationMixer(inner);
      clips.forEach((clip) => this.mixer.clipAction(clip).play());
    }
  }

  setDecibel(decibel) {
    this.decibel = decibel;
    if (this.templateRoot) {
      this.templateRoot.scale.setScalar(radiusFromDecibel(decibel));
    }
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

  update(dt) {
    if (!this.running || !this.mixer) return;
    // Louder sounds propagate faster; otherwise just let the baked clip loop.
    const speed = lerp(0.55, 1.8, normalizeDecibel(this.decibel));
    this.mixer.update(dt * speed);
  }
}
