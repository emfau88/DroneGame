import * as THREE from 'three';

import { Entity } from './Entity.js';
import { bus } from '../core/EventBus.js';
import { clamp, lerp } from '../utils/math.js';

const DRONE_SPEED   = 14;
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
const _groundMarkerGeo = new THREE.RingGeometry(0.55, 0.75, 24);
const _groundMarkerMat = new THREE.MeshBasicMaterial({ color: 0x00CCFF, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
const _bodyGeo      = new THREE.CylinderGeometry(0.38, 0.44, 0.18, 10);  // flat hex body
const _bodyTopGeo   = new THREE.CylinderGeometry(0.22, 0.38, 0.10, 10);  // tapered top dome
const _cameraGeo    = new THREE.SphereGeometry(0.10, 8, 6);               // camera ball underneath
const _armGeo       = new THREE.BoxGeometry(1.0, 0.07, 0.09);             // slim arm
const _motorGeo     = new THREE.CylinderGeometry(0.11, 0.11, 0.14, 8);   // motor housing at arm tip
const _rotorGeo     = new THREE.CylinderGeometry(0.32, 0.32, 0.025, 16); // rotor disk — 16 sides = smooth circle
const _ledGeo       = new THREE.SphereGeometry(0.045, 5, 4);              // status LED

const _bodyMat    = new THREE.MeshStandardMaterial({ color: 0x2E3050, roughness: 0.55, metalness: 0.6, emissive: new THREE.Color(0x080812) });
const _accentMat  = new THREE.MeshStandardMaterial({ color: 0x3A3A58, roughness: 0.45, metalness: 0.7 });
const _motorMat   = new THREE.MeshStandardMaterial({ color: 0x222230, roughness: 0.4,  metalness: 0.8 });
const _rotorMat   = new THREE.MeshStandardMaterial({ color: 0x444460, roughness: 0.5,  metalness: 0.3, transparent: true, opacity: 0.82 });
const _cameraMatD = new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 0.1,  metalness: 0.9 });
const _ledBlueMat = new THREE.MeshBasicMaterial({ color: 0x44AAFF });
const _ledRedMat  = new THREE.MeshBasicMaterial({ color: 0xFF3322 });

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
    this.primaryWeapon   = WEAPON_CONFIGS.cannon;
    this.secondaryWeapon  = null;  // slot 1
    this.secondaryWeapon2 = null;  // slot 2
    this.primaryCooldown   = 0;
    this.secondaryCooldown  = 0;
    this.secondaryCooldown2 = 0;

    // Upgrade modifiers (applied by RogueliteManager)
    this.damageMultiplier = 1.0;
    this.speedMultiplier  = 1.0;
    this.cooldownMultiplier = 1.0;

    // Drone model (set by RogueliteManager)
    this.dualCannon   = false;  // Reaper: fires 2 cannon shots simultaneously
    this.droneModelId = 'wasp';

    // Enemy disruption effects
    this._jammerActive = false;        // set by BattleSystem jammer units
    this._empWeaponFreezeTimer = 0;    // counts down; > 0 = weapons locked

    // Upgrade state (reset by RogueliteManager.applyAllUpgradesToDrone)
    this._upgrades = {};
    this._killstreakCount = 0;
    this._killstreakReady = false;
    this._overchargeTimer = undefined;
    this._overchargeReady = false;
    this._evasiveBurstTimer = 0;       // speed boost duration remaining
    this._shieldDroneCooldown = 0;     // time until shield drone is ready again
    this._blitzTimer = 0;              // countdown from 10s at map start
    this._supplyDropUsed = false;
    this._supplyDropHoldTimer = 0;     // how long both buttons held

    // Death animation
    this._dying = false;
    this._deathTimer = 0;

    this._rotors = [];
    this._allMeshes = [];
    this._buildMesh();

    this.position.set(0, DRONE_HEIGHT, 0);
  }

  /** Called by Game at map start to activate blitz mode timer. */
  startMap() {
    if (this._upgrades?.blitzMode) this._blitzTimer = 10;
    if (this._upgrades?.supplyDrop) this._supplyDropUsed = false;
    this._jammerActive = false;
    this._empWeaponFreezeTimer = 0;
  }

  /** Called by Game when a red unit dies, to handle killstreak. */
  onEnemyKill(unitType) {
    if (!this._upgrades?.killstreak) return;
    this._killstreakCount++;
    if (this._killstreakCount >= 5 && !this._killstreakReady) {
      this._killstreakReady = true;
      this._killstreakCount = 0;
      bus.emit('drone:killstreakReady', {});
    }
    if (this._upgrades?.scavenger && unitType === 'commander') {
      this.primaryCooldown    = Math.max(0, this.primaryCooldown    - 1.0);
      this.secondaryCooldown  = Math.max(0, this.secondaryCooldown  - 1.0);
      this.secondaryCooldown2 = Math.max(0, this.secondaryCooldown2 - 1.0);
      bus.emit('drone:scavenger', {});
    }
  }

  _buildMesh() {
    // ── Central body ────────────────────────────────────────────────────────
    const body = new THREE.Mesh(_bodyGeo, _bodyMat.clone());
    body.castShadow = true;
    body.position.y = 0;
    this.group.add(body);
    this._allMeshes.push(body);

    const bodyTop = new THREE.Mesh(_bodyTopGeo, _accentMat.clone());
    bodyTop.position.y = 0.14;
    bodyTop.castShadow = true;
    this.group.add(bodyTop);
    this._allMeshes.push(bodyTop);

    // Camera ball underneath
    const camera = new THREE.Mesh(_cameraGeo, _cameraMatD.clone());
    camera.position.y = -0.16;
    this.group.add(camera);
    this._allMeshes.push(camera);

    // Front blue LED (facing -Z = forward)
    const ledFront = new THREE.Mesh(_ledGeo, _ledBlueMat);
    ledFront.position.set(0, 0.05, -0.38);
    this.group.add(ledFront);

    // Rear red LED
    const ledBack = new THREE.Mesh(_ledGeo, _ledRedMat);
    ledBack.position.set(0, 0.05, 0.38);
    this.group.add(ledBack);

    // ── Arms + motors + rotors ───────────────────────────────────────────────
    const armAngles = [45, -45, 135, -135];
    for (const angle of armAngles) {
      const rad = THREE.MathUtils.degToRad(angle);
      const tipX = Math.cos(rad) * 0.72;
      const tipZ = Math.sin(rad) * 0.72;

      // Arm
      const arm = new THREE.Mesh(_armGeo, _accentMat.clone());
      arm.rotation.y = rad;
      arm.position.set(tipX * 0.5, 0, tipZ * 0.5);
      arm.castShadow = true;
      this.group.add(arm);
      this._allMeshes.push(arm);

      // Motor housing at tip
      const motor = new THREE.Mesh(_motorGeo, _motorMat.clone());
      motor.position.set(tipX, 0.0, tipZ);
      motor.castShadow = true;
      this.group.add(motor);
      this._allMeshes.push(motor);

      // Rotor disk above motor
      const rotor = new THREE.Mesh(_rotorGeo, _rotorMat.clone());
      rotor.position.set(tipX, 0.10, tipZ);
      this.group.add(rotor);
      this._rotors.push(rotor);
    }

    // Ground position marker — flat ring projected at world Y≈0.06
    this._groundMarker = new THREE.Mesh(_groundMarkerGeo, _groundMarkerMat);
    this._groundMarker.rotation.x = -Math.PI / 2;
    this.scene.add(this._groundMarker);
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
    this._updateUpgradeTimers(dt, input);
    this._updateWeapons(dt, input, units);

    // Spin rotors
    for (const rotor of this._rotors) {
      rotor.rotation.y += dt * 18;
    }

    // Keep ground marker below drone
    if (this._groundMarker) {
      this._groundMarker.position.set(this.position.x, 0.06, this.position.z);
    }
  }

  _updateUpgradeTimers(dt, input) {
    // Overcharge: countdown to ready
    if (this._upgrades?.overcharge && !this._overchargeReady) {
      if (this._overchargeTimer === undefined) this._overchargeTimer = 20;
      this._overchargeTimer -= dt;
      if (this._overchargeTimer <= 0) {
        this._overchargeReady = true;
        this._overchargeTimer = undefined;
        bus.emit('drone:overchargeReady', {});
      }
    }

    // Shield drone: recharge timer
    if (this._upgrades?.shieldDrone) {
      if (this._shieldDroneCooldown > 0) {
        this._shieldDroneCooldown -= dt;
      }
    }

    // Evasive maneuver: burn down speed burst
    if (this._evasiveBurstTimer > 0) {
      this._evasiveBurstTimer -= dt;
      if (this._evasiveBurstTimer <= 0) {
        this._evasiveBurstTimer = 0;
        this._evasiveActive = false;
      }
    }

    // Blitz mode: reduce cooldown multiplier for first 10s of map
    if (this._blitzTimer > 0) {
      this._blitzTimer -= dt;
      if (this._blitzTimer <= 0) {
        this._blitzTimer = 0;
        // Restore normal cooldown (blitz already factored into multiplier in _effectiveCooldownMultiplier)
      }
    }

    // Supply drop: hold both buttons for 1.5s to restore 1 HP
    if (this._upgrades?.supplyDrop && !this._supplyDropUsed) {
      if (input.firePrimary && input.fireSecondary) {
        this._supplyDropHoldTimer += dt;
        if (this._supplyDropHoldTimer >= 1.5) {
          this._supplyDropUsed = true;
          this._supplyDropHoldTimer = 0;
          this.hp = Math.min(this.hp + 1, this.maxHp);
          bus.emit('drone:supplyDrop', { hp: this.hp });
        }
      } else {
        this._supplyDropHoldTimer = 0;
      }
    }
  }

  _effectiveCooldownMultiplier() {
    let m = this.cooldownMultiplier;
    if (this._blitzTimer > 0) m *= 0.5;
    return m;
  }

  _effectiveSpeedMultiplier() {
    let m = this.speedMultiplier;
    if (this._evasiveActive) m *= 1.8;
    return m;
  }

  _updateMovement(dt, input) {
    const speed = DRONE_SPEED * this._effectiveSpeedMultiplier();
    const alpha = clamp(dt / INERTIA, 0, 1);

    // Jammer: invert controls within radius
    const jamSign = this._jammerActive ? -1 : 1;

    // Soft boundary — push back near edges
    let targetVx = input.x * speed * jamSign;
    let targetVz = input.y * speed * jamSign;

    const bx = Math.abs(this.position.x) / BOUNDS_X;
    const bz = Math.abs(this.position.z) / BOUNDS_Z;
    if (bx > 0.85) targetVx -= Math.sign(this.position.x) * BOUNDS_PUSH * ((bx - 0.85) / 0.15);
    if (bz > 0.85) targetVz -= Math.sign(this.position.z) * BOUNDS_PUSH * ((bz - 0.85) / 0.15);

    this.velocity.x += (targetVx - this.velocity.x) * alpha;
    this.velocity.z += (targetVz - this.velocity.z) * alpha;

    this.position.x = clamp(this.position.x + this.velocity.x * dt, -BOUNDS_X, BOUNDS_X);
    this.position.z = clamp(this.position.z + this.velocity.z * dt, -BOUNDS_Z, BOUNDS_Z);
    this.position.y = DRONE_HEIGHT;

    // Visual tilt — normalize against base speed so evasive burst doesn't break tilt angle
    const baseSpeed = DRONE_SPEED * this.speedMultiplier;
    this.group.rotation.x = lerp(this.group.rotation.x, -this.velocity.z / baseSpeed * TILT_X_MAX, dt * 12);
    this.group.rotation.z = lerp(this.group.rotation.z, -this.velocity.x / baseSpeed * TILT_Z_MAX, dt * 12);
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
    if (this.primaryCooldown   > 0) this.primaryCooldown   = Math.max(0, this.primaryCooldown   - dt);
    if (this.secondaryCooldown  > 0) this.secondaryCooldown  = Math.max(0, this.secondaryCooldown  - dt);
    if (this.secondaryCooldown2 > 0) this.secondaryCooldown2 = Math.max(0, this.secondaryCooldown2 - dt);

    // EMP freeze: weapons locked down
    if (this._empWeaponFreezeTimer > 0) {
      this._empWeaponFreezeTimer = Math.max(0, this._empWeaponFreezeTimer - dt);
      return;
    }

    if (input.firePrimary && this.primaryCooldown <= 0 && this.primaryWeapon) {
      this._fireWeapon(this.primaryWeapon, units, 'primary');
      // Reaper dual cannon: fire a second shot offset slightly
      if (this.dualCannon) {
        this._fireWeapon(this.primaryWeapon, units, 'primary_dual');
      }
    }

    if (input.fireSecondary && this.secondaryCooldown <= 0 && this.secondaryWeapon) {
      this._fireWeapon(this.secondaryWeapon, units, 'secondary');
    }

    if (input.fireSecondary2 && this.secondaryCooldown2 <= 0 && this.secondaryWeapon2) {
      this._fireWeapon(this.secondaryWeapon2, units, 'secondary2');
    }
  }

  _fireWeapon(weapon, units, slot) {
    const target = this._findTarget(weapon, units);

    // Bomb and cluster drop below drone regardless of target
    const isBelowDrop = weapon.type === 'bomb' || weapon.type === 'cluster';
    if (!isBelowDrop && !target && weapon.type !== 'emp') return;

    const cooldown = weapon.cooldownDuration * this._effectiveCooldownMultiplier();
    if (slot === 'primary') {
      this.primaryCooldown = cooldown;
    } else if (slot === 'primary_dual') {
      // second cannon shot — cooldown already set by 'primary', skip
    } else if (slot === 'secondary2') {
      this.secondaryCooldown2 = cooldown;
    } else {
      this.secondaryCooldown = cooldown;
    }

    // One-shot damage bonuses: killstreak (2×) and overcharge (3×), whichever is active
    let shotMultiplier = this.damageMultiplier;
    if (this._killstreakReady) {
      shotMultiplier *= 2;
      this._killstreakReady = false;
      this._killstreakCount = 0;
      bus.emit('drone:killstreakUsed', {});
    } else if (this._overchargeReady) {
      shotMultiplier *= 3;
      this._overchargeReady = false;
      this._overchargeTimer = 20; // restart countdown
      bus.emit('drone:overchargeUsed', {});
    }

    const firePos = this.position.clone();
    if (slot === 'primary_dual') firePos.x += 0.6; // offset second barrel slightly

    bus.emit('weapon:dronefire', {
      type: weapon.type,
      dronePosition: firePos,
      target: target || null,
      weapon,
      damageMultiplier: shotMultiplier,
      upgrades: this._upgrades,
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

    // Priority order for missile targeting (lower = higher priority)
    const MISSILE_PRIORITY = {
      tank: 0, flakGun: 0, samMedium: 0, samHeavy: 0, empMortar: 1,
      commander: 1, jammer: 2, rocketInfantry: 2, rocket: 2, soldier: 3,
    };

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
        const missileRange = weapon.range + (this._upgrades?.targetLock ? 8 : 0);
        if (dist2d > missileRange) continue;
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

    // Shield drone: block hit and go on cooldown
    if (this._upgrades?.shieldDrone && this._shieldDroneCooldown <= 0) {
      this._shieldDroneCooldown = 15;
      bus.emit('drone:shieldDroneBlocked', {});
      // Still give brief flash so player knows the block happened
      this.shieldTimer = 0.3;
      this._flashTimer = 0;
      return;
    }

    this.hp -= 1;
    this.shieldTimer = SHIELD_DURATION;
    this._flashTimer = 0;

    // Evasive maneuver: speed burst on hit
    if (this._upgrades?.evasiveManeuver) {
      this._evasiveActive   = true;
      this._evasiveBurstTimer = 0.5;
    }

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

  destroy() {
    if (this._groundMarker) {
      this.scene.remove(this._groundMarker);
      this._groundMarker = null;
    }
    super.destroy();
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

  /** Set secondary weapon in slot 1 or 2. */
  setSecondaryWeapon(type, slot = 1) {
    if (slot === 2) {
      this.secondaryWeapon2  = type ? (WEAPON_CONFIGS[type] || null) : null;
      this.secondaryCooldown2 = 0;
    } else {
      this.secondaryWeapon  = type ? (WEAPON_CONFIGS[type] || null) : null;
      this.secondaryCooldown = 0;
    }
  }

  /** Clear both secondary weapon slots. */
  clearSecondaryWeapons() {
    this.secondaryWeapon   = null;
    this.secondaryWeapon2  = null;
    this.secondaryCooldown  = 0;
    this.secondaryCooldown2 = 0;
  }

  /** Expose weapon configs for external use (e.g. HUD, upgrades). */
  static getWeaponConfig(type) {
    return WEAPON_CONFIGS[type] || null;
  }
}
