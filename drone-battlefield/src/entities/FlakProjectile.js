import * as THREE from 'three';

import { Entity } from './Entity.js';

const _flakGeo    = new THREE.SphereGeometry(0.18, 6, 4);
const _bulletGeo  = new THREE.SphereGeometry(0.10, 4, 3); // smaller for soldier AA

/**
 * FlakProjectile — AA projectile fired by ground units at the drone.
 * Options:
 *   speed         — travel speed (units/s). Default 8.
 *   homingStrength — 0 = ballistic, 0.20 = moderate homing. Default 0.20.
 *   color         — hex color. Default 0xFF6020 (orange).
 *   small         — use smaller sphere geometry (soldier AA). Default false.
 */
export class FlakProjectile extends Entity {
  constructor(scene, from, to, options = {}) {
    super(scene);
    this._speed          = options.speed          ?? 8;
    this._homingStrength = options.homingStrength  ?? 0.20;
    this._traveled       = 0;
    this._nearMissEmitted = false;

    this.position.copy(from);
    this._dir = new THREE.Vector3().subVectors(to, from).normalize();

    const geo = options.small ? _bulletGeo : _flakGeo;
    const mat = new THREE.MeshBasicMaterial({ color: options.color ?? 0xFF6020 });
    const mesh = new THREE.Mesh(geo, mat);
    this.group.add(mesh);
  }

  update(dt, dronePosition) {
    const step = this._speed * dt;
    this._traveled += step;

    if (dronePosition && this._homingStrength > 0) {
      const desired = new THREE.Vector3().subVectors(dronePosition, this.position).normalize();
      this._dir.lerp(desired, this._homingStrength * dt * 10);
      this._dir.normalize();
    }

    this.position.addScaledVector(this._dir, step);

    if (this._traveled > this._speed * 6) {
      this.destroy();
    }
  }
}
