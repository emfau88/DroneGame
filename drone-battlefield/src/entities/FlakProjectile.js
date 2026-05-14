import * as THREE from 'three';

import { Entity } from './Entity.js';

const _flakGeo    = new THREE.SphereGeometry(0.18, 8, 6);       // flakGun
const _bulletGeo  = new THREE.SphereGeometry(0.10, 6, 4);       // soldier AA
const _empGeo     = new THREE.SphereGeometry(0.22, 10, 7);      // EMP mortar
const _samMedGeo  = new THREE.CapsuleGeometry(0.09, 0.38, 3, 8); // SAM Medium — missile shape
const _samHeavyGeo = new THREE.SphereGeometry(0.28, 8, 6);      // SAM Heavy — larger ball
const _titanGeo   = new THREE.SphereGeometry(0.36, 10, 7);      // Titan — boss shell
const _trailGeo   = new THREE.SphereGeometry(0.07, 4, 3);       // trail puff (shared)

/**
 * FlakProjectile — AA projectile fired by ground units at the drone.
 * Options:
 *   speed          — travel speed (units/s). Default 8.
 *   homingStrength — 0 = ballistic, 0.20 = moderate homing. Default 0.20.
 *   color          — hex color. Default 0xFF6020 (orange).
 *   small          — use smaller sphere geometry (soldier AA). Default false.
 *   isEmp          — EMP mortar projectile (larger sphere, arc flight).
 *   isSamMed       — SAM Medium capsule with white smoke trail.
 *   isSamHeavy     — SAM Heavy larger sphere with red trail.
 *   isTitanShell   — Titan boss shell, largest, orange glow trail.
 */
export class FlakProjectile extends Entity {
  constructor(scene, from, to, options = {}) {
    super(scene);
    this._opts           = options;
    this._speed          = options.speed          ?? 8;
    this._homingStrength = options.homingStrength  ?? 0.20;
    this._arcHeight      = options.arcHeight       ?? 0;
    this._traveled       = 0;
    this._totalDist      = from.distanceTo(to);
    this._nearMissEmitted = false;
    this._trail          = [];
    this._trailTimer     = 0;

    // Trail config per type
    this._trailInterval = options.isSamMed    ? 0.045
                        : options.isSamHeavy  ? 0.035
                        : options.isTitanShell ? 0.03
                        : 0; // no trail for basic flak

    this._trailColor = options.isSamMed    ? 0xDDDDCC
                     : options.isSamHeavy  ? 0xFF4400
                     : options.isTitanShell ? 0xFF8800
                     : 0xFF6020;

    this.position.copy(from);
    this._startY = from.y;
    this._endY   = to.y;
    this._dir = new THREE.Vector3().subVectors(to, from).normalize();

    let geo;
    if      (options.isTitanShell) geo = _titanGeo;
    else if (options.isSamHeavy)   geo = _samHeavyGeo;
    else if (options.isSamMed)     geo = _samMedGeo;
    else if (options.isEmp)        geo = _empGeo;
    else if (options.small)        geo = _bulletGeo;
    else                           geo = _flakGeo;

    const mat = new THREE.MeshBasicMaterial({ color: options.color ?? 0xFF6020 });
    const mesh = new THREE.Mesh(geo, mat);

    // SAM Medium capsule: orient along travel direction
    if (options.isSamMed) {
      mesh.rotation.x = Math.PI / 2;
    }

    this.group.add(mesh);
    this._mesh = mesh;
  }

  update(dt, dronePosition) {
    const step = this._speed * dt;
    this._traveled += step;

    if (this._arcHeight > 0) {
      this.position.addScaledVector(this._dir, step);
      const frac = Math.min(1, this._traveled / Math.max(1, this._totalDist));
      this.position.y = this._startY + (this._endY - this._startY) * frac
        + this._arcHeight * Math.sin(Math.PI * frac);
    } else {
      if (dronePosition && this._homingStrength > 0) {
        const desired = new THREE.Vector3().subVectors(dronePosition, this.position).normalize();
        this._dir.lerp(desired, this._homingStrength * dt * 10);
        this._dir.normalize();
      }
      this.position.addScaledVector(this._dir, step);

      // Keep SAM Medium capsule oriented along flight direction
      if (this._opts.isSamMed) {
        const lookTarget = new THREE.Vector3().addVectors(this.position, this._dir);
        this.group.lookAt(lookTarget);
      }
    }

    // Trail for SAM Med / SAM Heavy / Titan
    if (this._trailInterval > 0) {
      this._trailTimer -= dt;
      if (this._trailTimer <= 0) {
        this._trailTimer = this._trailInterval;
        const mat  = new THREE.MeshBasicMaterial({ color: this._trailColor, transparent: true, opacity: 0.65 });
        const mesh = new THREE.Mesh(_trailGeo, mat);
        mesh.position.copy(this.position);
        this.scene.add(mesh);
        this._trail.push({ mesh, timer: 0.25, maxTimer: 0.25 });
      }

      const dead = [];
      for (const t of this._trail) {
        t.timer -= dt;
        t.mesh.material.opacity = 0.65 * (t.timer / t.maxTimer);
        if (t.timer <= 0) {
          this.scene.remove(t.mesh);
          t.mesh.material.dispose();
          dead.push(t);
        }
      }
      for (const t of dead) this._trail.splice(this._trail.indexOf(t), 1);
    }

    if (this._traveled > this._speed * 6) {
      this.destroy();
    }
  }

  destroy() {
    // Clean up any lingering trail meshes
    for (const t of this._trail) {
      this.scene.remove(t.mesh);
      t.mesh.material.dispose();
    }
    this._trail = [];
    super.destroy();
  }
}
