import * as THREE from 'three';

import { bus } from '../core/EventBus.js';

const SMOKE_COUNT  = 10;
const DEBRIS_COUNT = 6;
const EMP_COLOR    = 0x65D8FF;

/**
 * EffectSystem — VFX: explosions, EMP pulse, smoke, scorch, hit flash, muzzle flash.
 * All geometry pre-built in init(). Effects animate via update().
 */
export class EffectSystem {
  constructor() {
    this._scene   = null;
    this._effects = [];

    // Pre-built geometries
    this._explosionGeo = null;
    this._smokeGeo     = null;
    this._scorchGeo    = null;
    this._debrisGeo    = null;
    this._empRingGeo   = null;
    this._muzzleGeo    = null;

    this._onImpact = null;
    this._onFire   = null;
  }

  init(scene) {
    this._scene = scene;

    this._explosionGeo = new THREE.SphereGeometry(1, 16, 12);
    this._smokeGeo     = new THREE.SphereGeometry(0.4, 8, 6);
    this._scorchGeo    = new THREE.CircleGeometry(3, 24);
    this._debrisGeo    = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    this._empRingGeo   = new THREE.RingGeometry(0.2, 0.5, 40);
    this._muzzleGeo    = new THREE.SphereGeometry(0.2, 6, 4);

    this._onImpact = (data) => {
      const t = (data.type || '').toLowerCase();
      if (t === 'bomb' || t === 'cluster') this.playExplosion(data.position);
      if (t === 'emp')  this.playEMP(data.position, data.affectedUnits || []);
      if (t === 'cannon' || t === 'missile') {
        if (data.position) this._playMuzzleFlash(data.position);
      }
    };
    this._onFire = (data) => {
      if (data.team === 'red' && data.type === 'flak' && data.position && data.toPosition) {
        this._playFlakTracer(data.position, data.toPosition, data.unitType);
        this._playMuzzleFlash(data.position, data.unitType);
      } else {
        this._playMuzzleFlash(data.position);
      }
    };

    bus.on('weapon:impact', this._onImpact);
    bus.on('unit:fire',     this._onFire);
  }

  update(dt) {
    const dead = [];
    for (const fx of this._effects) {
      fx.timer -= dt;
      if (fx.timer <= 0) {
        this._scene.remove(fx.mesh);
        fx.mesh.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        dead.push(fx);
        continue;
      }

      const t = fx.timer / fx.maxTimer; // 1→0

      switch (fx.type) {
        case 'explosion': {
          const scale = 0.2 + (1 - t) * 6.3;
          fx.mesh.scale.setScalar(scale);
          fx.mesh.material.opacity = 0.72 * t;
          break;
        }
        case 'smoke': {
          fx.mesh.position.y += dt * 1.2;
          fx.mesh.scale.setScalar(0.4 + (1 - t) * 0.8);
          fx.mesh.material.opacity = 0.5 * t;
          break;
        }
        case 'scorch': {
          fx.mesh.material.opacity = 0.6 * t;
          break;
        }
        case 'debris': {
          fx.mesh.position.addScaledVector(fx.velocity, dt);
          fx.velocity.y -= 9.8 * dt;
          fx.mesh.rotation.x += dt * fx.spinX;
          fx.mesh.rotation.z += dt * fx.spinZ;
          fx.mesh.material.opacity = t;
          break;
        }
        case 'empRing': {
          // Expand outward
          const s = 1 + (1 - t) * fx.maxRadius;
          fx.mesh.scale.setScalar(s);
          fx.mesh.material.opacity = 0.85 * t;
          break;
        }
        case 'empArc': {
          // Flicker 3× then fade
          const flickers = Math.floor((1 - t) * 6);
          fx.mesh.visible = (flickers % 2 === 0);
          fx.mesh.material.opacity = t;
          break;
        }
        case 'empGlow': {
          // Unit emissive glow — just track timer, Unit handles its own emissive
          break;
        }
        case 'muzzle': {
          fx.mesh.material.opacity = t;
          break;
        }
        case 'tracer': {
          // Line tracer — fade out
          fx.mesh.material.opacity = 0.85 * t;
          break;
        }
      }
    }

    for (const fx of dead) this._effects.splice(this._effects.indexOf(fx), 1);
  }

  // ── Muzzle flash ─────────────────────────────────────────────────────────
  _playMuzzleFlash(position, unitType) {
    // Per-unit-type muzzle color
    const colors = { soldier: 0xFFFF44, rocket: 0xFF8822, flakGun: 0xFF3300, tank: 0xFF5500, commander: 0xFF6622 };
    const color = (unitType && colors[unitType]) ? colors[unitType] : 0xFFEE88;
    const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(this._muzzleGeo, mat);
    mesh.position.copy(position);
    this._scene.add(mesh);
    this._effects.push({ mesh, timer: 0.06, maxTimer: 0.06, type: 'muzzle' });
  }

  // ── Flak tracer line ──────────────────────────────────────────────────────
  _playFlakTracer(from, to, unitType) {
    // Per-type visual config
    let color, duration;
    switch (unitType) {
      case 'soldier':  color = 0xFFFF00; duration = 0.30; break;
      case 'rocket':   color = 0xFF8822; duration = 0.40; break;
      case 'flakGun':  color = 0xFF2200; duration = 0.45; break;
      default:         color = 0xFF5500; duration = 0.35; break; // tank, commander
    }
    const points = [from.clone(), to.clone()];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    this._scene.add(line);
    this._effects.push({ mesh: line, timer: duration, maxTimer: duration, type: 'tracer' });
  }

  // ── Explosion ─────────────────────────────────────────────────────────────
  playExplosion(position) {
    // Main sphere
    const mat = new THREE.MeshBasicMaterial({ color: 0xFF8800, transparent: true, opacity: 0.72 });
    const mesh = new THREE.Mesh(this._explosionGeo, mat);
    mesh.position.copy(position);
    mesh.position.y = 0.5;
    this._scene.add(mesh);
    this._effects.push({ mesh, timer: 0.55, maxTimer: 0.55, type: 'explosion' });

    // Smoke particles
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const sm = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 });
      const s  = new THREE.Mesh(this._smokeGeo, sm);
      s.position.set(
        position.x + (Math.random() - 0.5) * 4,
        position.y + Math.random() * 1.5,
        position.z + (Math.random() - 0.5) * 4,
      );
      this._scene.add(s);
      this._effects.push({ mesh: s, timer: 2.5, maxTimer: 2.5, type: 'smoke' });
    }

    // Ground scorch
    const scorchMat = new THREE.MeshBasicMaterial({ color: 0x222211, transparent: true, opacity: 0.6, depthWrite: false });
    const scorch = new THREE.Mesh(this._scorchGeo, scorchMat);
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(position.x, 0.02, position.z);
    this._scene.add(scorch);
    this._effects.push({ mesh: scorch, timer: 8, maxTimer: 8, type: 'scorch' });

    // Debris
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const dm  = new THREE.MeshBasicMaterial({ color: 0x664422, transparent: true, opacity: 1 });
      const d   = new THREE.Mesh(this._debrisGeo, dm);
      d.position.copy(position); d.position.y = 0.2;
      const angle = (i / DEBRIS_COUNT) * Math.PI * 2;
      const spd   = 4 + Math.random() * 4;
      const vel   = new THREE.Vector3(Math.cos(angle) * spd, 3 + Math.random() * 3, Math.sin(angle) * spd);
      this._scene.add(d);
      this._effects.push({ mesh: d, timer: 0.8, maxTimer: 0.8, type: 'debris', velocity: vel, spinX: (Math.random() - 0.5) * 8, spinZ: (Math.random() - 0.5) * 8 });
    }
  }

  // ── EMP ───────────────────────────────────────────────────────────────────
  playEMP(position, affectedUnits) {
    // Expanding cyan ring lying flat
    const ringMat = new THREE.MeshBasicMaterial({ color: EMP_COLOR, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(this._empRingGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.x, 0.05, position.z);
    this._scene.add(ring);
    // maxRadius drives scale: ring expands to weapon radius (7.2)
    this._effects.push({ mesh: ring, timer: 0.6, maxTimer: 0.6, type: 'empRing', maxRadius: 14 });

    // Electrical arcs on each stunned unit (3 Line segments per unit, flicker 3× then fade)
    for (const { unit } of affectedUnits) {
      if (!unit || !unit.alive) continue;

      // Cyan glow flash on the unit itself
      unit.empGlow(0.4);

      // 3 arc lines sprouting from unit position
      for (let a = 0; a < 3; a++) {
        const arcPts = [
          new THREE.Vector3(0, 0.5, 0),
          new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.9 + Math.random() * 0.4, (Math.random() - 0.5) * 0.8),
          new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 1.2),
        ];
        const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
        const arcMat = new THREE.LineBasicMaterial({ color: EMP_COLOR, transparent: true, opacity: 1 });
        const arc    = new THREE.Line(arcGeo, arcMat);
        arc.position.copy(unit.position);
        this._scene.add(arc);
        this._effects.push({ mesh: arc, timer: 0.5, maxTimer: 0.5, type: 'empArc' });
      }
    }
  }

  clearAll() {
    for (const fx of this._effects) {
      this._scene.remove(fx.mesh);
      fx.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    this._effects = [];
  }

  destroy() {
    bus.off('weapon:impact', this._onImpact);
    bus.off('unit:fire',     this._onFire);
    this.clearAll();
    if (this._explosionGeo) this._explosionGeo.dispose();
    if (this._smokeGeo)     this._smokeGeo.dispose();
    if (this._scorchGeo)    this._scorchGeo.dispose();
    if (this._debrisGeo)    this._debrisGeo.dispose();
    if (this._empRingGeo)   this._empRingGeo.dispose();
    if (this._muzzleGeo)    this._muzzleGeo.dispose();
  }
}
