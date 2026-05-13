import * as THREE from 'three';

/**
 * Entity — base class for all game objects that live in the scene.
 * Subclasses override update() and _buildMesh().
 */
export class Entity {
  constructor(scene) {
    this.id = crypto.randomUUID();
    this.scene = scene;
    this.group = new THREE.Group();
    this.position = this.group.position; // alias
    this.alive = true;
    scene.add(this.group);
  }

  /** Override in subclasses. */
  update(_dt) {}

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.scene.remove(this.group);
    // Traverse and dispose geometry + material
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
