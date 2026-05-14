import * as THREE from 'three';

import { Entity } from './Entity.js';

const PROJECTILE_SPEED = 22;

// Shared geometry
const _bulletGeo   = new THREE.SphereGeometry(0.09, 5, 4);
const _linePts     = [new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1.2)];
const _lineGeo     = new THREE.BufferGeometry().setFromPoints(_linePts);

/**
 * Projectile — ground-to-ground bullet. Sphere for blue cannon, line tracer for red.
 * Cannon bullets are visible spheres; red ground tracers are short bright lines.
 */
export class Projectile extends Entity {
  constructor(scene, from, to, team, onHit) {
    super(scene);
    this._target  = to.clone();
    this._onHit   = onHit;
    this._team    = team;
    this._dist    = from.distanceTo(to);
    this._traveled = 0;
    this._dir     = new THREE.Vector3().subVectors(to, from).normalize();

    this.position.copy(from);
    this._buildMesh();
  }

  _buildMesh() {
    if (this._team === 'blue') {
      // Small bright blue sphere — clearly visible
      const mat  = new THREE.MeshBasicMaterial({ color: 0x88CCFF });
      const mesh = new THREE.Mesh(_bulletGeo, mat);
      this.group.add(mesh);
    } else {
      // Bright red short line tracer
      const mat  = new THREE.LineBasicMaterial({ color: 0xFF5555, linewidth: 2 });
      const line = new THREE.Line(_lineGeo, mat);
      this.group.add(line);
      this.group.lookAt(this._target);
    }
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
