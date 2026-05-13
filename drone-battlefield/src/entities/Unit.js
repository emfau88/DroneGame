import * as THREE from 'three';

import { Entity } from './Entity.js';
import { bus } from '../core/EventBus.js';

// Shared geometries — created once
const GEO = {
  soldier:    new THREE.CapsuleGeometry(0.28, 0.55, 4, 8),
  tank:       new THREE.BoxGeometry(1.4, 0.6, 0.9),
  tankTurret: new THREE.BoxGeometry(0.6, 0.35, 0.55),
  tankBarrel: new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8),
  rocket:     new THREE.CapsuleGeometry(0.28, 0.55, 4, 8),
  rocketPod:  new THREE.BoxGeometry(0.3, 0.18, 0.45),
  commander:  new THREE.CapsuleGeometry(0.28, 0.75, 4, 8),
  cmdAntenna: new THREE.BoxGeometry(0.06, 0.35, 0.06),
  flakBase:   new THREE.BoxGeometry(1.0, 0.5, 1.0),
  flakBarrel: new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8),
  // Enemy drone geometry
  eDroneBody: new THREE.BoxGeometry(0.6, 0.15, 0.6),
  eDroneArm:  new THREE.BoxGeometry(0.8, 0.08, 0.08),
};

// Ground unit stats from DRONE_STRIKE_REBUILD.md §Enemies
// aaRange: 0 = cannot shoot drone. aaCooldown in seconds.
const UNIT_STATS = {
  soldier: {
    hp: 15, damage: 2.1, speed: 2.05, range: 5.2, cooldown: 0.75,
    aaRange: 0, aaDamage: 0, aaCooldown: 0, aaLockTime: 0,
  },
  tank: {
    hp: 60, damage: 5.2, speed: 1.2, range: 5.2, cooldown: 1.8,
    aaRange: 8, aaDamage: 1, aaCooldown: 4.0, aaLockTime: 0.3,
  },
  rocket: {
    hp: 22, damage: 4.8, speed: 1.6, range: 7.5, cooldown: 1.25,
    aaRange: 10, aaDamage: 1, aaCooldown: 3.5, aaLockTime: 0.5,
  },
  commander: {
    hp: 35, damage: 3.0, speed: 1.8, range: 6.0, cooldown: 1.8,
    aaRange: 6, aaDamage: 1, aaCooldown: 5.0, aaLockTime: 0.8,
  },
  flakGun: {
    hp: 28, damage: 0, speed: 0, range: 0, cooldown: 0,
    aaRange: 20, aaDamage: 1, aaCooldown: 1.8, aaLockTime: 0.5,
  },
  enemyDrone: {
    hp: 20, damage: 0, speed: 14, range: 0, cooldown: 0,
    aaRange: 16, aaDamage: 1, aaCooldown: 0, aaLockTime: 0,
  },
  // Blue-only types
  medic: {
    hp: 12, damage: 0, speed: 2.2, range: 0, cooldown: 0,
    aaRange: 0, aaDamage: 0, aaCooldown: 0, aaLockTime: 0,
  },
};

const BLUE_COLOR  = 0x297BFF;
const RED_COLOR   = 0xF24848;
const HIT_COLOR   = 0xFFFFFF;
const EMP_COLOR   = 0x65D8FF;
const HIT_DURATION = 0.08;

// Red laser targeting indicator color for flak guns
const LASER_COLOR = 0xFF2222;

/**
 * Unit — soldier, tank, rocket, commander, flakGun, or enemyDrone.
 * Has AA properties for anti-air behavior handled by BattleSystem.
 */
export class Unit extends Entity {
  constructor(scene, config) {
    super(scene);
    this.team = config.team;
    this.type = config.type;
    this.lane = config.lane ?? 0;

    const base = UNIT_STATS[config.type] || UNIT_STATS.soldier;

    this.maxHp      = base.hp;
    this.hp         = base.hp;
    this.damage     = base.damage;
    this.speed      = base.speed;
    this.range      = base.range;
    this.cooldown   = base.cooldown;

    // Anti-air stats
    this.aaRange    = base.aaRange;
    this.aaDamage   = base.aaDamage;
    this.aaCooldown = base.aaCooldown;
    this.aaLockTime = base.aaLockTime;

    this.state      = 'advancing';
    this.stunTimer  = 0;
    this._cooldownTimer  = 0;
    this._aaCooldownTimer = 0;
    this._aaLockTimer    = 0;
    this._hitTimer  = 0;
    this._deathTimer = null;
    this._retreatTarget = null;
    this._empTimer  = 0;

    this._meshes   = [];
    this._barrel   = null; // flak gun barrel (rotates to track drone)
    this._laserLine = null; // targeting laser (flak gun)

    this._buildMesh();

    this.group.rotation.y = this.team === 'blue' ? 0 : Math.PI;
  }

  _buildMesh() {
    const color = this.team === 'blue' ? BLUE_COLOR : RED_COLOR;
    const makeMat = () => new THREE.MeshStandardMaterial({ color });

    switch (this.type) {
      case 'soldier':
      case 'medic': {
        const mesh = new THREE.Mesh(GEO.soldier, makeMat());
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.position.y = 0.7;
        this.group.add(mesh); this._meshes.push(mesh);
        break;
      }
      case 'tank': {
        const body = new THREE.Mesh(GEO.tank, makeMat());
        body.castShadow = true; body.receiveShadow = true;
        body.position.y = 0.4;
        this.group.add(body); this._meshes.push(body);

        const turret = new THREE.Mesh(GEO.tankTurret, makeMat());
        turret.castShadow = true; turret.position.set(0, 0.9, 0);
        this.group.add(turret); this._meshes.push(turret);

        const barrel = new THREE.Mesh(GEO.tankBarrel, makeMat());
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.9, -0.6);
        this.group.add(barrel); this._meshes.push(barrel);
        break;
      }
      case 'rocket': {
        const body = new THREE.Mesh(GEO.rocket, makeMat());
        body.castShadow = true; body.receiveShadow = true;
        body.position.y = 0.7;
        this.group.add(body); this._meshes.push(body);

        const pod = new THREE.Mesh(GEO.rocketPod, makeMat());
        pod.rotation.z = THREE.MathUtils.degToRad(30);
        pod.position.set(0.35, 1.1, 0);
        this.group.add(pod); this._meshes.push(pod);
        break;
      }
      case 'commander': {
        const body = new THREE.Mesh(GEO.commander, makeMat());
        body.castShadow = true; body.receiveShadow = true;
        body.position.y = 0.8;
        this.group.add(body); this._meshes.push(body);

        const antenna = new THREE.Mesh(GEO.cmdAntenna, makeMat());
        antenna.position.set(0, 1.7, 0);
        this.group.add(antenna); this._meshes.push(antenna);
        break;
      }
      case 'flakGun': {
        // Static dark base + rotatable barrel
        const base = new THREE.Mesh(GEO.flakBase, new THREE.MeshStandardMaterial({ color: 0x333340 }));
        base.castShadow = true; base.receiveShadow = true;
        base.position.y = 0.25;
        this.group.add(base); this._meshes.push(base);

        // Pivot for barrel rotation
        const pivot = new THREE.Object3D();
        pivot.position.y = 0.6;
        this.group.add(pivot);

        const barrel = new THREE.Mesh(GEO.flakBarrel, new THREE.MeshStandardMaterial({ color: 0x222230 }));
        barrel.rotation.x = -Math.PI / 4; // angled upward by default
        barrel.position.y = 0.5;
        pivot.add(barrel);
        this._barrel = pivot;
        this._meshes.push(barrel);
        break;
      }
      case 'enemyDrone': {
        // Smaller red drone
        const body = new THREE.Mesh(GEO.eDroneBody, new THREE.MeshStandardMaterial({ color: 0xC22020 }));
        body.castShadow = true;
        this.group.add(body); this._meshes.push(body);

        const armAngles = [45, -45, 135, -135];
        for (const angle of armAngles) {
          const arm = new THREE.Mesh(GEO.eDroneArm, new THREE.MeshStandardMaterial({ color: 0xA01818 }));
          arm.rotation.y = THREE.MathUtils.degToRad(angle);
          arm.position.set(
            Math.cos(THREE.MathUtils.degToRad(angle)) * 0.38,
            0,
            Math.sin(THREE.MathUtils.degToRad(angle)) * 0.38,
          );
          this.group.add(arm); this._meshes.push(arm);
        }
        break;
      }
    }
  }

  /**
   * Rotate flak gun barrel to track a target position.
   * @param {THREE.Vector3} targetPos
   */
  trackTarget(targetPos) {
    if (!this._barrel) return;
    // Rotate pivot to face target in XZ plane
    const dx = targetPos.x - this.position.x;
    const dz = targetPos.z - this.position.z;
    this._barrel.rotation.y = Math.atan2(dx, dz);
    // Tilt barrel up based on altitude
    const dy = targetPos.y - this.position.y;
    const dist2d = Math.hypot(dx, dz);
    this._barrel.rotation.x = -Math.atan2(dy, dist2d);
  }

  /**
   * Apply damage. Emits unit:damaged and unit:died.
   * @param {number} amount
   */
  takeDamage(amount) {
    if (this.state === 'dead') return;
    this.hp = Math.max(0, this.hp - amount);
    bus.emit('unit:damaged', { unit: this, amount });
    this._flashWhite();
    if (this.hp <= 0) this.kill();
  }

  stun(duration) {
    if (this.state === 'dead') return;
    this.state = 'stunned';
    this.stunTimer = duration;
  }

  kill() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this._deathTimer = 0;
    bus.emit('unit:died', { unit: this, team: this.team });
  }

  _flashWhite() {
    this._hitTimer = HIT_DURATION;
    for (const mesh of this._meshes) {
      if (mesh.material?.emissive) mesh.material.emissive.setHex(HIT_COLOR);
    }
  }

  empGlow(duration) {
    this._empTimer = duration;
    for (const mesh of this._meshes) {
      if (mesh.material?.emissive) mesh.material.emissive.setHex(EMP_COLOR);
    }
  }

  _playDeathAnimation(dt) {
    this._deathTimer += dt;
    const t = Math.min(1, this._deathTimer / 0.4);
    this.group.rotation.z = (Math.PI / 2) * t;
    for (const mesh of this._meshes) {
      if (!mesh.material) continue;
      mesh.material.transparent = true;
      mesh.material.opacity = 1 - t;
    }
    if (t >= 1) this.destroy();
  }

  update(dt) {
    if (this._hitTimer > 0) {
      this._hitTimer -= dt;
      if (this._hitTimer <= 0) {
        for (const mesh of this._meshes) {
          if (mesh.material?.emissive) mesh.material.emissive.setHex(0x000000);
        }
      }
    }

    if (this._empTimer > 0) {
      this._empTimer -= dt;
      if (this._empTimer <= 0) {
        for (const mesh of this._meshes) {
          if (mesh.material?.emissive) mesh.material.emissive.setHex(0x000000);
        }
      }
    }

    if (this.state === 'dead') {
      if (this._deathTimer !== null) this._playDeathAnimation(dt);
      return;
    }

    if (this.state === 'stunned') {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) this.state = 'advancing';
      return;
    }

    if (this._cooldownTimer > 0) this._cooldownTimer -= dt;
    if (this._aaCooldownTimer > 0) this._aaCooldownTimer -= dt;
  }

  canFire() {
    return this._cooldownTimer <= 0 && this.state !== 'dead' && this.state !== 'stunned';
  }

  resetCooldown() {
    this._cooldownTimer = this.cooldown;
  }
}
