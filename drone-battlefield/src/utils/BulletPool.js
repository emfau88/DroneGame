import * as THREE from 'three';

const _bulletGeo = new THREE.SphereGeometry(0.14, 5, 4);
const _bulletMat = new THREE.MeshBasicMaterial({ color: 0xFFFF99 });

export class BulletPool {
  constructor(scene, size = 24) {
    this._scene = scene;
    this._pool = [];
    this._active = [];
    for (let i = 0; i < size; i++) {
      const mesh = new THREE.Mesh(_bulletGeo, _bulletMat.clone());
      mesh.visible = false;
      scene.add(mesh);
      this._pool.push(mesh);
    }
  }

  fire(from, dir, dist, speed, onArrive) {
    const mesh = this._pool.pop();
    if (!mesh) return; // pool exhausted — skip bullet
    mesh.position.copy(from);
    mesh.visible = true;
    this._active.push({ mesh, dir: dir.clone(), dist, speed, traveled: 0, onArrive });
  }

  update(dt) {
    const done = [];
    for (const b of this._active) {
      const step = b.speed * dt;
      b.traveled += step;
      b.mesh.position.addScaledVector(b.dir, step);
      if (b.traveled >= b.dist) {
        b.onArrive();
        done.push(b);
      }
    }
    for (const b of done) {
      b.mesh.visible = false;
      this._active.splice(this._active.indexOf(b), 1);
      this._pool.push(b.mesh);
    }
  }

  clearAll() {
    for (const b of this._active) {
      b.mesh.visible = false;
      this._pool.push(b.mesh);
    }
    this._active = [];
  }

  destroy() {
    for (const b of this._active) this._scene.remove(b.mesh);
    for (const m of this._pool) this._scene.remove(m);
    this._active = [];
    this._pool = [];
  }
}
