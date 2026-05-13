import * as THREE from 'three';

import { Entity } from './Entity.js';
import { bus } from '../core/EventBus.js';
import { clamp, lerp } from '../utils/math.js';

const DRONE_SPEED   = 18;
// 0.05s acceleration ramp — barely perceptible per DRONE_STRIKE_REBUILD.md
const INERTIA       = 0.05;
const TILT_X_MAX    = THREE.MathUtils.degToRad(15);
const TILT_Z_MAX    = THREE.MathUtils.degToRad(15);
const DRONE_HEIGHT  = 12;
const BOUNDS_X      = 32;
const BOUNDS_Z      = 20;
const BOUNDS_PUSH   = 6; // deceleration force near boundary

// Invincibility window after taking a hit
const SHIELD_DURATION = 1.5;
// Flash period while shielded
const FLASH_INTERVAL  = 0.08;

// Shared drone geometry — built once
const _bodyGeo    = new THREE.BoxGeometry(0.9, 0.22, 0.9);
const _armGeo     = new THREE.BoxGeometry(1.2, 0.12, 0.12);
const _rotorGeo   = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 8);
const _droneMat   = new THREE.MeshStandardMaterial({ color: 0x222233 });
const _rotorMat   = new THREE.MeshStandardMaterial({ color: 0x444455, transparent: true, opacity: 0.7 });

// Weapon configuration objects — stats from DRONE_STRIKE_REBUILD.md
const WEAPON_CONFIGS = {
  cannon: {
    type: 'cannon',
    damage: 8,
    cooldownDuration: 0.22,
    range: 14,
    targetPriority: 'nearest',
  },
  bomb: {
    type: 'bomb',
    damage: 55,
    cooldownDuration: 3.5,
    range: Infinity,
    targetPriority: 'ground_below',
    radius: 5.2,
  },
  emp: {
    type: 'emp',
    damage: 0,
    cooldownDuration: 8.0,
    range: 7.5,
    targetPriority: 'aoe',
    stunDuration: 3.0,
  },
  missile: {
    type: 'missile',
    damage: 38,
    cooldownDuration: 1.8,
    range: 22,
    targetPriority: 'priority', // tank > commander > rocket > soldier
  },
  cluster: {
    type: 'cluster',
    damage: 22,
    cooldownDuration: 12.0,
    range: Infinity,
    targetPriority: 'ground_below',
    radius: 10,
    submunitions: 6,
  },
};

/**
 * Drone — the player-controlled unit flying over the battlefield.
 * Has HP, weapons with cooldowns, auto-fires at nearest enemy when fire held.
 * Takes damage from flak projectiles. On death emits drone:dead.
 */
export class Drone extends Entity {
  constructor(scene) {
    super(scene);

    // HP system
    this.maxHp = 3;
    this.hp = 3;
    this.shieldTimer = 0;  // invincibility after hit
    this._flashTimer = 0;  // controls visibility flicker while shielded
    this._visible = true;

    // Movement
    this.velocity = new THREE.Vector3();

    // Weapons
    this.primaryWeapon = WEAPON_CONFIGS.cannon;
    this.secondaryWeapon = null;
    this.primaryCooldown = 0;
    this.secondaryCooldown = 0;

    // Upgrade modifiers (applied by RogueliteManager)
    this.damageMultiplier = 1.0;
    this.speedMultiplier  = 1.0;
    this.cooldownMultiplier = 1.0;

    // Death animation
    this._dying = false;
    this._deathTimer = 0;

    this._rotors = [];
    this._allMeshes = [];
    this._buildMesh();

    this.position.set(0, DRONE_HEIGHT, 0);
  }

  _buildMesh() {
    const body = new THREE.Mesh(_bodyGeo, _droneMat.clone());
    body.castShadow = true;
    this.group.add(body);
    this._allMeshes.push(body);

    const armAngles = [45, -45, 135, -135];
    for (const angle of armAngles) {
      const arm = new THREE.Mesh(_armGeo, _droneMat.clone());
      arm.rotation.y = THREE.MathUtils.degToRad(angle);
      arm.position.set(
        Math.cos(THREE.MathUtils.degToRad(angle)) * 0.55,
        0,
        Math.sin(THREE.MathUtils.degToRad(angle)) * 0.55,
      );
      arm.castShadow = true;
      this.group.add(arm);
      this._allMeshes.push(arm);

      const rotor = new THREE.Mesh(_rotorGeo, _rotorMat.clone());
      rotor.position.copy(arm.position);
      rotor.position.y = 0.06;
      this.group.add(rotor);
      this._rotors.push(rotor);
    }
  }

  /**
   * Main update. Called every frame.
   * @param {number} dt
   * @param {{ x: number, y: number, firePrimary: boolean, fireSecondary: boolean }} input
   * @param {import('./Unit.js').Unit[]} units - for auto-targeting
   */
  update(dt, input, units) {
    if (this._dying) {
      this._updateDeathAnimation(dt);
      return;
    }

    this._updateMovement(dt, input);
    this._updateShield(dt);
    this._updateWeapons(dt, input, units);

    // Spin rotors
    for (const rotor of this._rotors) {
      rotor.rotation.y += dt * 18;
    }
  }

  _updateMovement(dt, input) {
    const speed = DRONE_SPEED * this.speedMultiplier;
    const alpha = clamp(dt / INERTIA, 0, 1);

    // Soft boundary — push back near edges
    let targetVx = input.x * speed;
    let targetVz = input.y * speed;

    const bx = Math.abs(this.position.x) / BOUNDS_X;
    const bz = Math.abs(this.position.z) / BOUNDS_Z;
    if (bx > 0.85) targetVx -= Math.sign(this.position.x) * BOUNDS_PUSH * ((bx - 0.85) / 0.15);
    if (bz > 0.85) targetVz -= Math.sign(this.position.z) * BOUNDS_PUSH * ((bz - 0.85) / 0.15);

    this.velocity.x += (targetVx - this.velocity.x) * alpha;
    this.velocity.z += (targetVz - this.velocity.z) * alpha;

    this.position.x = clamp(this.position.x + this.velocity.x * dt, -BOUNDS_X, BOUNDS_X);
    this.position.z = clamp(this.position.z + this.velocity.z * dt, -BOUNDS_Z, BOUNDS_Z);
    this.position.y = DRONE_HEIGHT;

    // Visual tilt
    this.group.rotation.x = lerp(this.group.rotation.x, -this.velocity.z / speed * TILT_X_MAX, dt * 12);
    this.group.rotation.z = lerp(this.group.rotation.z, -this.velocity.x / speed * TILT_Z_MAX, dt * 12);
  }

  _updateShield(dt) {
    if (this.shieldTimer <= 0) return;
    this.shieldTimer -= dt;

    // Rapid flash while shielded
    this._flashTimer -= dt;
    if (this._flashTimer <= 0) {
      this._flashTimer = FLASH_INTERVAL;
      this._visible = !this._visible;
      this.group.visible = this._visible;
    }

    if (this.shieldTimer <= 0) {
      this.shieldTimer = 0;
      this.group.visible = true;
      this._visible = true;
    }
  }

  _updateWeapons(dt, input, units) {
    if (this.primaryCooldown > 0) this.primaryCooldown = Math.max(0, this.primaryCooldown - dt);
    if (this.secondaryCooldown > 0) this.secondaryCooldown = Math.max(0, this.secondaryCooldown - dt);

    if (input.firePrimary && this.primaryCooldown <= 0 && this.primaryWeapon) {
      this._fireWeapon(this.primaryWeapon, units, 'primary');
    }

    if (input.fireSecondary && this.secondaryCooldown <= 0 && this.secondaryWeapon) {
      this._fireWeapon(this.secondaryWeapon, units, 'secondary');
    }
  }

  _fireWeapon(weapon, units, slot) {
    const target = this._findTarget(weapon, units);

    // Bomb and cluster drop below drone regardless of target
    const isBelowDrop = weapon.type === 'bomb' || weapon.type === 'cluster';
    if (!isBelowDrop && !target && weapon.type !== 'emp') return;

    const cooldown = weapon.cooldownDuration * this.cooldownMultiplier;
    if (slot === 'primary') {
      this.primaryCooldown = cooldown;
    } else {
      this.secondaryCooldown = cooldown;
    }

    bus.emit('weapon:dronefire', {
      type: weapon.type,
      dronePosition: this.position.clone(),
      target: target || null,
      weapon,
      damageMultiplier: this.damageMultiplier,
    });
  }

  /**
   * Find best target for the given weapon config.
   * @param {object} weapon
   * @param {import('./Unit.js').Unit[]} units
   * @returns {import('./Unit.js').Unit|null}
   */
  _findTarget(weapon, units) {
    if (!units || units.length === 0) return null;

    const pos = this.position;
    let best = null;
    let bestScore = Infinity;

    // Priority order for missile targeting
    const MISSILE_PRIORITY = { tank: 0, commander: 1, rocket: 2, soldier: 3, flakGun: 0 };

    for (const unit of units) {
      if (!unit.alive || unit.state === 'dead' || unit.team !== 'red') continue;

      // Enemy drones are valid targets for cannon
      const isAirUnit = unit.type === 'enemyDrone';
      const isGroundUnit = !isAirUnit;

      const dx = unit.position.x - pos.x;
      const dy = unit.position.y - pos.y;
      const dz = unit.position.z - pos.z;
      const dist3d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const dist2d = Math.hypot(dx, dz);

      if (weapon.type === 'missile') {
        if (dist2d > weapon.range) continue;
        const priority = MISSILE_PRIORITY[unit.type] ?? 3;
        if (priority < bestScore) { bestScore = priority; best = unit; }
      } else {
        // Nearest in range (use 3D distance for air units, 2D for ground)
        const d = isAirUnit ? dist3d : dist2d;
        if (d > weapon.range) continue;
        if (d < bestScore) { bestScore = d; best = unit; }
      }
    }
    return best;
  }

  /**
   * Take 1 HP of damage. Triggers shield (invincibility frames).
   * Emits drone:hit or drone:dead.
   */
  takeDamage() {
    if (this.shieldTimer > 0 || this._dying) return;

    this.hp -= 1;
    this.shieldTimer = SHIELD_DURATION;
    this._flashTimer = 0;

    bus.emit('drone:hit', { hpRemaining: this.hp });

    if (this.hp <= 0) {
      this._triggerDeath();
    }
  }

  isDead() {
    return this.hp <= 0;
  }

  _triggerDeath() {
    this._dying = true;
    this._deathTimer = 0;
    bus.emit('drone:dead', {});
  }

  _updateDeathAnimation(dt) {
    this._deathTimer += dt;
    const t = this._deathTimer / 0.8;

    // Spin and descend
    this.group.rotation.z += dt * 5;
    this.position.y = Math.max(0, DRONE_HEIGHT - this._deathTimer * 15);

    // Fade out at the end
    if (t > 0.6) {
      const fade = 1 - ((t - 0.6) / 0.4);
      for (const mesh of this._allMeshes) {
        mesh.material.transparent = true;
        mesh.material.opacity = Math.max(0, fade);
      }
    }

    if (this._deathTimer >= 0.8) {
      this.destroy();
    }
  }

  /** World position directly below the drone — used for bombs. */
  getBombPosition() {
    return new THREE.Vector3(this.position.x, 0, this.position.z);
  }

  /** Set the primary weapon (always cannon or user-configured). */
  setPrimaryWeapon(type) {
    this.primaryWeapon = WEAPON_CONFIGS[type] || WEAPON_CONFIGS.cannon;
    this.primaryCooldown = 0;
  }

  /** Unlock secondary weapon slot. */
  setSecondaryWeapon(type) {
    this.secondaryWeapon = type ? (WEAPON_CONFIGS[type] || null) : null;
    this.secondaryCooldown = 0;
  }

  /** Expose weapon configs for external use (e.g. HUD, upgrades). */
  static getWeaponConfig(type) {
    return WEAPON_CONFIGS[type] || null;
  }
}
