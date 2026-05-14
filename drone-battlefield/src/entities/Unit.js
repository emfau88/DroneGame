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
    hp: 12, damage: 2.1, speed: 2.05, range: 5.2, cooldown: 0.75,
    aaRange: 8, aaDamage: 1, aaCooldown: 4.0, aaLockTime: 0,
  },
  tank: {
    hp: 45, damage: 5.2, speed: 1.2, range: 5.2, cooldown: 1.8,
    aaRange: 8, aaDamage: 1, aaCooldown: 2.8, aaLockTime: 0.3,
  },
  rocket: {
    hp: 18, damage: 4.8, speed: 1.6, range: 7.5, cooldown: 1.25,
    aaRange: 10, aaDamage: 1, aaCooldown: 2.5, aaLockTime: 0.5,
  },
  commander: {
    hp: 28, damage: 3.0, speed: 1.8, range: 6.0, cooldown: 1.8,
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

const LASER_COLOR = 0xFF2222;
const _laserMat = new THREE.LineBasicMaterial({ color: LASER_COLOR, transparent: true, opacity: 0.8 });

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

    // Anti-air stats (config can override for tutorial/difficulty purposes)
    this.aaRange    = config.aaRangeOverride ?? base.aaRange;
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
    this._turretMesh = null; // tank turret — detaches on death
    this._turretVel  = null; // turret arc velocity

    this._buildMesh();

    this.group.rotation.y = this.team === 'blue' ? 0 : Math.PI;
  }

  _buildMesh() {
    const color = this.team === 'blue' ? BLUE_COLOR : RED_COLOR;
    // Infantry: matte cloth-like. Vehicles: slightly metallic.
    const makeMat = (rough = 0.82, metal = 0.05) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

    switch (this.type) {
      case 'soldier':
      case 'medic': {
        const mesh = new THREE.Mesh(GEO.soldier, makeMat(0.85, 0.0));
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.position.y = 0.7;
        this.group.add(mesh); this._meshes.push(mesh);
        break;
      }
      case 'tank': {
        const body = new THREE.Mesh(GEO.tank, makeMat(0.6, 0.35));
        body.castShadow = true; body.receiveShadow = true;
        body.position.y = 0.4;
        this.group.add(body); this._meshes.push(body);

        const turret = new THREE.Mesh(GEO.tankTurret, makeMat(0.55, 0.4));
        turret.castShadow = true; turret.receiveShadow = true;
        turret.position.set(0, 0.9, 0);
        this.group.add(turret); this._meshes.push(turret);
        this._turretMesh = turret;

        const barrel = new THREE.Mesh(GEO.tankBarrel, makeMat(0.45, 0.6));
        barrel.castShadow = true;
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.9, -0.6);
        this.group.add(barrel); this._meshes.push(barrel);
        break;
      }
      case 'rocket': {
        const body = new THREE.Mesh(GEO.rocket, makeMat(0.8, 0.05));
        body.castShadow = true; body.receiveShadow = true;
        body.position.y = 0.7;
        this.group.add(body); this._meshes.push(body);

        const pod = new THREE.Mesh(GEO.rocketPod, makeMat(0.5, 0.5));
        pod.castShadow = true;
        pod.rotation.z = THREE.MathUtils.degToRad(30);
        pod.position.set(0.35, 1.1, 0);
        this.group.add(pod); this._meshes.push(pod);
        break;
      }
      case 'commander': {
        const body = new THREE.Mesh(GEO.commander, makeMat(0.8, 0.05));
        body.castShadow = true; body.receiveShadow = true;
        body.position.y = 0.8;
        this.group.add(body); this._meshes.push(body);

        const antenna = new THREE.Mesh(GEO.cmdAntenna, makeMat(0.4, 0.7));
        antenna.castShadow = true;
        antenna.position.set(0, 1.7, 0);
        this.group.add(antenna); this._meshes.push(antenna);
        break;
      }
      case 'flakGun': {
        const base = new THREE.Mesh(GEO.flakBase, new THREE.MeshStandardMaterial({ color: 0x333340, roughness: 0.6, metalness: 0.55 }));
        base.castShadow = true; base.receiveShadow = true;
        base.position.y = 0.25;
        this.group.add(base); this._meshes.push(base);

        const pivot = new THREE.Object3D();
        pivot.position.y = 0.6;
        this.group.add(pivot);

        const barrel = new THREE.Mesh(GEO.flakBarrel, new THREE.MeshStandardMaterial({ color: 0x222230, roughness: 0.4, metalness: 0.75 }));
        barrel.castShadow = true;
        barrel.rotation.x = -Math.PI / 4;
        barrel.position.y = 0.5;
        pivot.add(barrel);
        this._barrel = pivot;
        this._meshes.push(barrel);
        break;
      }
      case 'enemyDrone': {
        const body = new THREE.Mesh(GEO.eDroneBody, new THREE.MeshStandardMaterial({ color: 0xC22020, roughness: 0.45, metalness: 0.6 }));
        body.castShadow = true; body.receiveShadow = true;
        this.group.add(body); this._meshes.push(body);

        const armAngles = [45, -45, 135, -135];
        for (const angle of armAngles) {
          const arm = new THREE.Mesh(GEO.eDroneArm, new THREE.MeshStandardMaterial({ color: 0xA01818, roughness: 0.5, metalness: 0.55 }));
          arm.castShadow = true;
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
   * Show/hide the red targeting laser from flak gun barrel toward drone.
   * @param {boolean} active
   * @param {THREE.Vector3} [targetPos]
   */
  setLaserActive(active, targetPos) {
    if (!active) {
      if (this._laserLine) {
        this.group.remove(this._laserLine);
        this._laserLine.geometry.dispose();
        this._laserLine = null;
      }
      return;
    }
    if (!targetPos) return;

    // Rebuild line from barrel tip to drone
    const from = new THREE.Vector3(0, 0.6, 0); // local barrel position
    const toLocal = this.group.worldToLocal(targetPos.clone());
    const points = [from, toLocal];
    const geo = new THREE.BufferGeometry().setFromPoints(points);

    if (this._laserLine) {
      this._laserLine.geometry.dispose();
      this._laserLine.geometry = geo;
    } else {
      this._laserLine = new THREE.Line(geo, _laserMat.clone());
      this.group.add(this._laserLine);
    }
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

    // Tank: detach turret and give it an arc velocity
    if (this._turretMesh) {
      this._turretVel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        5 + Math.random() * 3,
        (Math.random() - 0.5) * 4,
      );
    }

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

  setAAGlow(active) {
    if (this._hitTimer > 0 || this._empTimer > 0) return; // don't override hit/emp flash
    const hex = active ? 0x330000 : 0x000000;
    for (const mesh of this._meshes) {
      if (mesh.material?.emissive) mesh.material.emissive.setHex(hex);
    }
  }

  _playDeathAnimation(dt) {
    this._deathTimer += dt;
    const t = Math.min(1, this._deathTimer / 0.4);
    this.group.rotation.z = (Math.PI / 2) * t;

    // Tank turret detach arc
    if (this._turretMesh && this._turretVel) {
      this._turretMesh.position.x += this._turretVel.x * dt;
      this._turretMesh.position.y += this._turretVel.y * dt;
      this._turretMesh.position.z += this._turretVel.z * dt;
      this._turretVel.y -= 18 * dt; // gravity
      this._turretMesh.rotation.x += dt * 6;
      this._turretMesh.rotation.z += dt * 4;
    }

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
  }

  canFire() {
    return this._cooldownTimer <= 0 && this.state !== 'dead' && this.state !== 'stunned';
  }

  resetCooldown() {
    this._cooldownTimer = this.cooldown;
  }
}
