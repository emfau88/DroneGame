import * as THREE from 'three';
import { Entity } from './Entity.js';

const _bodyGeo  = new THREE.CapsuleGeometry(0.09, 0.55, 3, 6);
const _trailGeo = new THREE.SphereGeometry(0.07, 4, 3);

/**
 * MissileProjectile — visible flying missile from drone to target unit.
 * Homes toward target position, calls onHit() on arrival, leaves a short trail.
 */
export class MissileProjectile extends Entity {
  constructor(scene, from, target, speed, color, onHit) {
    super(scene);
    this._target  = target; // Unit reference — track its current position
    this._onHit   = onHit;
    this._speed   = speed;
    this._traveled = 0;
    this._trail    = []; // { mesh, timer }
    this._trailTimer = 0;

    this.position.copy(from);

    // Capsule body oriented along travel axis
    const mat  = new THREE.MeshBasicMaterial({ color });
    const body = new THREE.Mesh(_bodyGeo, mat);
    body.rotation.x = Math.PI / 2;
    this.group.add(body);

    // Initial direction
    this._dir = new THREE.Vector3().subVectors(target.position, from).normalize();
    this.group.lookAt(target.position);
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.scene.remove(this.group);
    // Don't dispose shared _bodyGeo/_trailGeo — only dispose the body material
    this.group.traverse((child) => {
      if (child.material && !Array.isArray(child.material)) child.material.dispose();
    });
  }

  update(dt, scene) {
    if (!this.alive) return;

    // Home toward target's current position
    if (this._target.alive) {
      const desired = new THREE.Vector3()
        .subVectors(this._target.position, this.position)
        .normalize();
      this._dir.lerp(desired, Math.min(1, dt * 6));
      this._dir.normalize();
    }

    const step = this._speed * dt;
    this._traveled += step;
    this.position.addScaledVector(this._dir, step);

    // Face travel direction
    const lookTarget = new THREE.Vector3().addVectors(this.position, this._dir);
    this.group.lookAt(lookTarget);

    // Spawn trail sphere every 0.04s
    this._trailTimer -= dt;
    if (this._trailTimer <= 0) {
      this._trailTimer = 0.04;
      const mat  = new THREE.MeshBasicMaterial({ color: 0xFF8822, transparent: true, opacity: 0.7 });
      const mesh = new THREE.Mesh(_trailGeo, mat);
      mesh.position.copy(this.position);
      scene.add(mesh);
      this._trail.push({ mesh, timer: 0.3 });
    }

    // Tick trail
    const deadTrail = [];
    for (const t of this._trail) {
      t.timer -= dt;
      t.mesh.material.opacity = 0.7 * (t.timer / 0.3);
      if (t.timer <= 0) { scene.remove(t.mesh); t.mesh.material.dispose(); deadTrail.push(t); }
    }
    for (const t of deadTrail) this._trail.splice(this._trail.indexOf(t), 1);

    // Hit check: close enough to target OR traveled too far (miss)
    const distToTarget = this.position.distanceTo(this._target.position);
    if (distToTarget < 1.2 || this._traveled > 60) {
      this._onHit();
      // Clean up trail
      for (const t of this._trail) { scene.remove(t.mesh); t.mesh.material.dispose(); }
      this._trail = [];
      this.destroy();
    }
  }
}
