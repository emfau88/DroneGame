import * as THREE from 'three';

const FOV_NORMAL = 55;
const FOV_EXPLOSION = 62;
const PIXEL_RATIO_CAP = 1.75;

const INTRO_DURATION  = 1.5;
const INTRO_START_Y   = 80;

/**
 * Renderer — owns the Three.js scene, camera, and WebGL renderer.
 * No other module touches scene or camera directly.
 */
export class Renderer {
  constructor() {
    this.scene = null;
    this.camera = null;
    this._renderer = null;
    this._container = null;
    this._shakeTimer = 0;
    this._shakeMagnitude = 0;
    this._fovTimer = 0;
    this._cameraTarget   = new THREE.Vector3();
    this._cameraVelocity = new THREE.Vector3();
    this._cameraOffset   = new THREE.Vector3(0, 28, 18);
    this._introTimer = 0;
  }

  init(container) {
    this._container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8EC7FF);
    this.scene.fog = new THREE.Fog(0x8EC7FF, 60, 130);

    this.camera = new THREE.PerspectiveCamera(
      FOV_NORMAL,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    this.camera.position.set(0, 28, 18);
    this.camera.lookAt(0, 0, 0);

    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._renderer.setPixelRatio(Math.min(devicePixelRatio, PIXEL_RATIO_CAP));
    this._renderer.setSize(container.clientWidth, container.clientHeight);
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFShadowMap;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.1;
    container.appendChild(this._renderer.domElement);

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this._container.clientWidth;
    const h = this._container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._renderer.setSize(w, h);
  }

  /**
   * @param {THREE.Vector3} position
   * @param {THREE.Vector3} [velocity] - drone velocity for soft lead (optional)
   */
  setCameraTarget(position, velocity) {
    this._cameraTarget.copy(position);
    if (velocity) this._cameraVelocity.copy(velocity);
    else          this._cameraVelocity.set(0, 0, 0);
  }

  /** Immediately snap camera to current target — call on level start to avoid lerp pop. */
  snapCamera() {
    this.camera.position.set(
      this._cameraTarget.x + this._cameraOffset.x,
      this._cameraTarget.y + this._cameraOffset.y,
      this._cameraTarget.z + this._cameraOffset.z,
    );
    this.camera.lookAt(this._cameraTarget.x, 0, this._cameraTarget.z);
  }

  /**
   * Start the cinematic level-intro: camera snaps to high altitude then smoothly
   * descends to play position over INTRO_DURATION seconds.
   */
  startCinematicIntro() {
    this._introTimer = INTRO_DURATION;
    this.camera.position.set(
      this._cameraTarget.x + this._cameraOffset.x,
      INTRO_START_Y,
      this._cameraTarget.z + this._cameraOffset.z,
    );
    this.camera.lookAt(this._cameraTarget.x, 0, this._cameraTarget.z);
  }

  /** True while the cinematic intro descent is still playing. */
  get isIntroPlaying() { return this._introTimer > 0; }

  /**
   * Trigger camera shake. Called on weapon impact.
   * @param {number} magnitude
   * @param {number} duration - seconds
   */
  shake(magnitude, duration) {
    this._shakeMagnitude = magnitude;
    this._shakeTimer = duration;
  }

  /**
   * Briefly widen FOV on explosion, lerp back. Call on weapon impact.
   */
  pulseFOV() {
    this._fovTimer = 0.4;
    this.camera.fov = FOV_EXPLOSION;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    // Smooth camera follow — target leads drone by velocity * 0.3
    const leadX = this._cameraTarget.x + this._cameraVelocity.x * 0.3;
    const leadZ = this._cameraTarget.z + this._cameraVelocity.z * 0.3;
    const targetX = leadX + this._cameraOffset.x;
    const targetY = this._cameraTarget.y + this._cameraOffset.y;
    const targetZ = leadZ + this._cameraOffset.z;
    this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1, dt * 4.2);
    this.camera.position.z += (targetZ - this.camera.position.z) * Math.min(1, dt * 4.2);

    // Cinematic intro: descend from high altitude, ease-out curve
    if (this._introTimer > 0) {
      this._introTimer = Math.max(0, this._introTimer - dt);
      const progress = 1 - this._introTimer / INTRO_DURATION; // 0→1
      const eased = 1 - Math.pow(1 - progress, 3);            // ease-out cubic
      this.camera.position.y = INTRO_START_Y + (targetY - INTRO_START_Y) * eased;
    } else {
      this.camera.position.y += (targetY - this.camera.position.y) * Math.min(1, dt * 4.2);
    }

    this.camera.lookAt(leadX, 0, leadZ);

    // Camera shake
    if (this._shakeTimer > 0) {
      this._shakeTimer -= dt;
      const s = (this._shakeTimer > 0 ? this._shakeMagnitude : 0) * (this._shakeTimer / 0.3);
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }

    // FOV lerp back
    if (this._fovTimer > 0) {
      this._fovTimer -= dt;
      const t = Math.max(0, this._fovTimer / 0.4);
      this.camera.fov = FOV_NORMAL + (FOV_EXPLOSION - FOV_NORMAL) * t;
      this.camera.updateProjectionMatrix();
    }
  }

  render() {
    this._renderer.render(this.scene, this.camera);
  }
}
