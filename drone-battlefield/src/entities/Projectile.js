import * as THREE from 'three';

import { Entity } from './Entity.js';

const PROJECTILE_SPEED = 18;
const BLUE_TRACER = 0x88AAFF;
const RED_TRACER  = 0xFF8888;

// Shared line geometry for tracers — reused via pool
// We create geometry per-projectile but only 2 points, very cheap
const _lineMat_blue = new THREE.LineBasicMaterial({ color: BLUE_TRACER });
const _lineMat_red  = new THREE.LineBasicMaterial({ color: RED_TRACER });

/**
 * Projectile — a bullet tracer that moves from origin to target.
 * Uses Line geometry (not spheres) per CODING_STANDARDS.
 * Auto-destroys on arrival.
 */
export class Projectile extends Entity {
  constructor(scene, from, to, team, onHit) {
    super(scene);
    this._target = to.clone();
    this._onHit  = onHit;
    this._team   = team;

    this.position.copy(from);

    // Direction
    this._dir = new THREE.Vector3().subVectors(to, from).normalize();
    this._dist = from.distanceTo(to);
    this._traveled = 0;

    this._buildMesh();
  }

  _buildMesh() {
    // Tracer line: two points, start and end
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -0.8), // short trailing line
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = this._team === 'blue' ? _lineMat_blue : _lineMat_red;
    const line = new THREE.Line(geo, mat);
    this.group.add(line);

    // Orient along travel direction
    this.group.lookAt(this._target);
  }

  update(dt) {
    if (!this.alive) return;

    const step = PROJECTILE_SPEED * dt;
    this._traveled += step;

    this.position.addScaledVector(this._dir, step);

    if (this._traveled >= this._dist) {
      this._onHit();
      this.destroy();
    }
  }
}
