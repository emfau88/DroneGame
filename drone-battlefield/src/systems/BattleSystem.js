import * as THREE from 'three';
import { Unit }           from '../entities/Unit.js';
import { Projectile }     from '../entities/Projectile.js';
import { FlakProjectile } from '../entities/FlakProjectile.js';
import { bus }            from '../core/EventBus.js';

const SEPARATION_RADIUS  = 1.4;
const SEPARATION_FORCE   = 3.5;
const RETREAT_THRESHOLD  = 0.3;
const RETREAT_DISTANCE   = 2;
const SCORE_UPDATE_INTERVAL = 0.25;

const MAP_X_LIMIT  = 50;
const LANE_Z_CLAMP = 2.2;

const COMMANDER_BUFF_RADIUS  = 4;
const COMMANDER_DAMAGE_BONUS = 0.15;
const COMMANDER_SPEED_BONUS  = 0.10;

const TANK_PROTECT_REDUCTION = 0.30;

// Near-miss threshold: if flak passes within this distance of drone, emit event
const NEAR_MISS_DIST = 2.0;

/**
 * BattleSystem — unit AI, movement, combat, flak projectiles, anti-air behavior.
 * Emits: score:updated, battle:resolved, flak:nearMiss.
 */
// Shared geometries
const _droneTrailGeo = new THREE.SphereGeometry(0.12, 4, 3);

export class BattleSystem {
  constructor() {
    this._scene       = null;
    this._units       = [];
    this._projectiles = [];
    this._flakProjectiles = []; // separate pool for flak (targets drone)
    this._scoreTimer  = 0;
    this._resolvedEmitted = false;
    this._convoyX     = null;
    this._droneTrailPool = []; // { mesh, timer, maxTimer }
  }

  init(scene) {
    this._scene = scene;
  }

  get units() { return this._units; }

  /** Set convoy X position so red ground units pathfind toward it when idle. */
  setConvoyX(x) { this._convoyX = x; }

  spawnUnit(config) {
    const unit = new Unit(this._scene, config);
    const y = config.y ?? 0;
    unit.position.set(config.x, y, config.lane ?? 0);
    this._units.push(unit);

    // Titan tank: scale up 2.2× for boss presence
    if (unit.type === 'titanTank') {
      unit.group.scale.setScalar(2.2);
    }

    // Enemy drone: scale up 1.5×, attach direction cone
    if (unit.type === 'enemyDrone') {
      unit.group.scale.setScalar(1.5);
      this._attachDroneCone(unit);
    }

    return unit;
  }

  _attachDroneCone(unit) {
    const coneGeo = new THREE.ConeGeometry(0.25, 1.2, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xFF2222, transparent: true, opacity: 0.75 });
    const cone = new THREE.Mesh(coneGeo, mat);
    // Cone tip points forward (-Z in local space when rotated)
    cone.rotation.x = Math.PI / 2;
    cone.position.z = -0.9; // place in front of drone body
    unit.group.add(cone);
    unit._dirCone = cone;
  }

  clearAll() {
    for (const u of this._units) {
      if (u.alive) u.destroy();
    }
    for (const p of this._projectiles)     { if (p.alive) p.destroy(); }
    for (const p of this._flakProjectiles) { if (p.alive) p.destroy(); }
    for (const t of this._droneTrailPool)  { this._scene.remove(t.mesh); t.mesh.material.dispose(); }
    this._units            = [];
    this._projectiles      = [];
    this._flakProjectiles  = [];
    this._droneTrailPool   = [];
    this._resolvedEmitted  = false;
  }

  /**
   * @param {number} dt
   * @param {import('../entities/Drone.js').Drone|null} drone - player drone (may be null)
   */
  update(dt, drone) {
    const buffed = this._buildCommanderBuffs();

    for (const unit of this._units) {
      if (!unit.alive) continue;
      unit.update(dt);
      if (unit.state === 'dead') continue;
      if (Math.abs(unit.position.x) > MAP_X_LIMIT) { unit.kill(); continue; }

      // Air units skip ground AI
      if (unit.type === 'enemyDrone') {
        if (drone && drone.alive) this._updateEnemyDrone(unit, drone, dt);
        continue;
      }

      // SAM family — static, only targets drone
      if (unit.type === 'flakGun' || unit.type === 'samMedium' || unit.type === 'samHeavy') {
        if (drone && drone.alive) this._updateAntiAir(unit, drone, dt);
        continue;
      }

      // Titan Tank — moves + shoots ground + shoots drone
      if (unit.type === 'titanTank') {
        this._updateUnit(unit, dt, buffed);
        if (drone && drone.alive) {
          unit.trackTarget?.(drone.position);
          this._updateAntiAir(unit, drone, dt);
        }
        continue;
      }

      // Jammer — static, continuously checks radius, no AA fire
      if (unit.type === 'jammer') {
        if (drone && drone.alive) this._updateJammer(unit, drone);
        continue;
      }

      // EMP Mortar — static, lobs grenade at drone
      if (unit.type === 'empMortar') {
        if (drone && drone.alive) this._updateAntiAir(unit, drone, dt);
        continue;
      }

      // Ground unit AI (skip purely static non-AA units)
      if (unit.speed > 0 || unit.range > 0) {
        this._updateUnit(unit, dt, buffed);
      }

      // Anti-air behavior (if unit has AA stats)
      if (drone && drone.alive && unit.aaRange > 0) {
        this._updateAntiAir(unit, drone, dt);
      }
    }

    this._updatePendingFlak(dt);
    this._updateProjectiles(dt);
    this._updateFlakProjectiles(dt, drone);
    this._updateDroneTrails(dt, drone);

    // Prune
    this._units           = this._units.filter(u => u.alive || u.state === 'dead');
    this._projectiles     = this._projectiles.filter(p => p.alive);
    this._flakProjectiles = this._flakProjectiles.filter(p => p.alive);

    this._scoreTimer -= dt;
    if (this._scoreTimer <= 0) {
      this._scoreTimer = SCORE_UPDATE_INTERVAL;
      bus.emit('score:updated', { blue: this.getScore('blue'), red: this.getScore('red') });
    }

    this._checkWinCondition();
  }

  // ── Anti-air ──────────────────────────────────────────────────────────────

  _updateAntiAir(unit, drone, dt) {
    if (unit.state === 'stunned' || unit.state === 'dead') return;

    const dx = drone.position.x - unit.position.x;
    const dy = drone.position.y - unit.position.y;
    const dz = drone.position.z - unit.position.z;
    const dist3d = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist3d > unit.aaRange) {
      unit._aaLockTimer = 0;
      unit.setLaserActive?.(false);
      unit.setAAGlow?.(false);
      return;
    }

    // SAM family + titanTank: rotate barrel toward drone
    if (unit.type === 'flakGun' || unit.type === 'samMedium' || unit.type === 'samHeavy' || unit.type === 'empMortar' || unit.type === 'titanTank') {
      unit.trackTarget(drone.position);
    }

    if (unit._aaCooldownTimer > 0) {
      unit._aaCooldownTimer = Math.max(0, unit._aaCooldownTimer - dt);
      unit.setLaserActive?.(false);
      return;
    }

    // In range and ready to lock — show AA targeting glow
    unit.setAAGlow?.(true);

    // Lock-on phase: accumulate timer and show targeting laser in final 0.5s
    const ghostDelay = (unit._upgrades?.ghostProtocol ?? false) ? 1.5 : 0;
    const intelReduction = (drone?._upgrades?.intel) ? 0.30 : 0;
    const lockDelay = (unit.aaLockTime + ghostDelay) * (1 - intelReduction);
    unit._aaLockTimer += dt;

    const LASER_WARN_TIME = 0.5;
    const showLaser = unit._aaLockTimer >= lockDelay - LASER_WARN_TIME;
    unit.setLaserActive?.(showLaser, drone.position);

    if (unit._aaLockTimer >= lockDelay) {
      this._fireFlak(unit, drone);
      unit._aaCooldownTimer = unit.aaCooldown;
      unit._aaLockTimer = 0;
      unit.setLaserActive?.(false);
    }
  }

  _fireFlak(unit, drone) {
    const SAM_Y = { flakGun: 1.2, samMedium: 1.3, samHeavy: 1.4, empMortar: 1.0 };
    const from = unit.position.clone();
    from.y = SAM_Y[unit.type] ?? 1.0;

    const to = drone.position.clone();
    const toVisible = new THREE.Vector3(to.x, 1.5, to.z);

    // Titan Tank: slow heavy shell — wide arc, deals double damage
    if (unit.type === 'titanTank') {
      const options = { speed: 9, homingStrength: 0.22, color: 0xFF6600, isTitanShell: true };
      const flak = new FlakProjectile(this._scene, from, to, options);
      this._flakProjectiles.push(flak);
      bus.emit('unit:fire', { position: from.clone(), toPosition: toVisible, team: 'red', type: 'flak', unitType: unit.type });
      return;
    }

    // EMP Mortar: lob a slow grenade that marks the drone for a weapon-freeze on hit
    if (unit.type === 'empMortar') {
      const options = { speed: 7, homingStrength: 0.08, color: 0x44DDFF, isEmp: true, arcHeight: 6 };
      const flak = new FlakProjectile(this._scene, from, to, options);
      this._flakProjectiles.push(flak);
      bus.emit('unit:fire', { position: from.clone(), toPosition: toVisible, team: 'red', type: 'emp', unitType: unit.type });
      return;
    }

    // SAM Heavy: 3-shot quick burst with slight spread
    if (unit.type === 'samHeavy') {
      for (let i = 0; i < 3; i++) {
        const jitter = new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 1.5,
        );
        const aim = to.clone().add(jitter);
        const options = { speed: 12, homingStrength: 0.30, color: 0xFF2200, isSamHeavy: true };
        const delay = i * 0.18; // stagger launches
        if (delay === 0) {
          this._flakProjectiles.push(new FlakProjectile(this._scene, from.clone(), aim, options));
        } else {
          // Schedule delayed shots via stored pending list
          this._pendingFlak = this._pendingFlak || [];
          this._pendingFlak.push({ timer: delay, from: from.clone(), to: aim, options });
        }
      }
      bus.emit('unit:fire', { position: from.clone(), toPosition: toVisible, team: 'red', type: 'flak', unitType: unit.type });
      return;
    }

    // SAM Medium: 2 missiles, second fires 0.3s later
    if (unit.type === 'samMedium') {
      const options = { speed: 10, homingStrength: 0.28, color: 0xEEEECC, isSamMed: true };
      this._flakProjectiles.push(new FlakProjectile(this._scene, from.clone(), to.clone(), options));
      this._pendingFlak = this._pendingFlak || [];
      this._pendingFlak.push({ timer: 0.3, from: from.clone(), to: to.clone(), options: { ...options } });
      bus.emit('unit:fire', { position: from.clone(), toPosition: toVisible, team: 'red', type: 'flak', unitType: unit.type });
      return;
    }

    // Per-type projectile options — soldier: slow ballistic yellow; others: homing orange/red
    let options;
    switch (unit.type) {
      case 'soldier':
        options = { speed: 6, homingStrength: 0, color: 0xFFDD00, small: true };
        break;
      case 'rocketInfantry':
        options = { speed: 11, homingStrength: 0.20, color: 0xFF6020 };
        break;
      case 'rocket':
        options = { speed: 10, homingStrength: 0.15, color: 0xFF6020 };
        break;
      case 'flakGun':
        options = { speed: 8, homingStrength: 0.25, color: 0xFF3000 };
        break;
      default: // tank, commander, others
        options = { speed: 8, homingStrength: 0.20, color: 0xFF6020 };
        break;
    }

    const flak = new FlakProjectile(this._scene, from, to, options);
    this._flakProjectiles.push(flak);

    bus.emit('unit:fire', {
      position: from.clone(),
      toPosition: toVisible,
      team: 'red',
      type: 'flak',
      unitType: unit.type,
    });
  }

  _updateJammer(unit, drone) {
    const dx = drone.position.x - unit.position.x;
    const dz = drone.position.z - unit.position.z;
    const dist = Math.hypot(dx, dz);
    const inRange = dist <= unit.jamRadius;
    if (drone._jammerActive !== inRange) {
      drone._jammerActive = inRange;
      bus.emit('drone:jammed', { active: inRange });
    }
  }

  _updatePendingFlak(dt) {
    if (!this._pendingFlak?.length) return;
    const stillPending = [];
    for (const p of this._pendingFlak) {
      p.timer -= dt;
      if (p.timer <= 0) {
        this._flakProjectiles.push(new FlakProjectile(this._scene, p.from, p.to, p.options));
      } else {
        stillPending.push(p);
      }
    }
    this._pendingFlak = stillPending;
  }

  _updateFlakProjectiles(dt, drone) {
    for (const flak of this._flakProjectiles) {
      if (!flak.alive) continue;
      flak.update(dt, drone?.position ?? null);

      if (drone && drone.alive && flak.alive) {
        const d = flak.position.distanceTo(drone.position);
        if (d < 0.8) {
          if (flak._opts?.isEmp) {
            // EMP hit: freeze drone weapons for 2s instead of dealing damage
            drone._empWeaponFreezeTimer = (drone._empWeaponFreezeTimer || 0) > 0
              ? drone._empWeaponFreezeTimer + 1  // extend if already frozen
              : 2.0;
            bus.emit('drone:empFreeze', { duration: 2.0 });
            bus.emit('drone:weaponsFrozen', { duration: drone._empWeaponFreezeTimer });
          } else if (flak._opts?.isTitanShell) {
            // Titan shell: 2 damage hits
            bus.emit('battle:droneHit', { sourcePosition: flak.position.clone() });
            drone.takeDamage();
            drone.takeDamage();
            bus.emit('battle:titanHit', { position: flak.position.clone() });
          } else {
            bus.emit('battle:droneHit', { sourcePosition: flak.position.clone() });
            drone.takeDamage();
          }
          flak.destroy();
          continue;
        }
        // Near miss
        if (!flak._nearMissEmitted && d < NEAR_MISS_DIST && flak._traveled > 2) {
          flak._nearMissEmitted = true;
          bus.emit('flak:nearMiss', { distance: d });
        }
      }
    }
  }

  getFlakProjectiles() { return this._flakProjectiles; }

  // ── Enemy drone AI ────────────────────────────────────────────────────────

  _updateEnemyDrone(unit, drone, dt) {
    if (unit.state === 'dead') return;

    const dx = drone.position.x - unit.position.x;
    const dy = drone.position.y - unit.position.y;
    const dz = drone.position.z - unit.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < 2.0) {
      bus.emit('battle:droneHit', { sourcePosition: unit.position.clone() });
      drone.takeDamage();
      unit.takeDamage(unit.hp);
      return;
    }

    // Rotate group to face drone — cone will follow
    if (dist > 0.1) {
      unit.group.rotation.y = Math.atan2(dx, dz);
    }

    // Approach warning events
    if (dist <= 18) {
      bus.emit('enemyDrone:approach', { sourcePosition: unit.position.clone(), dist });
    }

    // Intercept: move directly toward player drone
    if (dist > 0.1) {
      const spd = unit.speed * dt;
      unit.position.x += (dx / dist) * spd;
      unit.position.y += (dy / dist) * spd;
      unit.position.z += (dz / dist) * spd;
    }

    // Trail: spawn a trail sphere every 0.08s (timer stored per-unit)
    unit._trailTimer = (unit._trailTimer ?? 0) - dt;
    if (unit._trailTimer <= 0) {
      unit._trailTimer = 0.08;
      const mat = new THREE.MeshBasicMaterial({ color: 0xFF2222, transparent: true, opacity: 0.7 });
      const mesh = new THREE.Mesh(_droneTrailGeo, mat);
      mesh.position.copy(unit.position);
      this._scene.add(mesh);
      this._droneTrailPool.push({ mesh, timer: 0.5, maxTimer: 0.5 });
    }
  }

  _updateDroneTrails(dt) {
    const dead = [];
    for (const t of this._droneTrailPool) {
      t.timer -= dt;
      t.mesh.material.opacity = 0.7 * (t.timer / t.maxTimer);
      if (t.timer <= 0) {
        this._scene.remove(t.mesh);
        t.mesh.material.dispose();
        dead.push(t);
      }
    }
    for (const t of dead) this._droneTrailPool.splice(this._droneTrailPool.indexOf(t), 1);
  }

  // ── Commander buff ────────────────────────────────────────────────────────

  _buildCommanderBuffs() {
    const buffed = { blue: new Set(), red: new Set() };
    for (const cmd of this._units) {
      if (cmd.type !== 'commander' || !cmd.alive || cmd.state === 'dead') continue;
      for (const other of this._units) {
        if (other === cmd || other.team !== cmd.team || !other.alive || other.state === 'dead') continue;
        const d = Math.hypot(cmd.position.x - other.position.x, cmd.position.z - other.position.z);
        if (d <= COMMANDER_BUFF_RADIUS) buffed[cmd.team].add(other);
      }
    }
    return buffed;
  }

  _hasTankShield(unit) {
    const dir = unit.team === 'blue' ? 1 : -1;
    for (const other of this._units) {
      if (other === unit || other.team !== unit.team || other.type !== 'tank') continue;
      if (!other.alive || other.state === 'dead') continue;
      const tankAhead = dir > 0
        ? other.position.x > unit.position.x
        : other.position.x < unit.position.x;
      if (!tankAhead) continue;
      if (Math.abs(other.position.z - unit.position.z) < 2) return true;
    }
    return false;
  }

  // ── Per-unit ground AI ────────────────────────────────────────────────────

  _updateUnit(unit, dt, buffed) {
    if (unit.state === 'stunned') return;

    const isBuffed = buffed[unit.team]?.has(unit);
    const effectiveSpeed = isBuffed ? unit.speed * (1 + COMMANDER_SPEED_BONUS) : unit.speed;

    const enemy = this._findNearestEnemy(unit);

    if (!enemy) {
      unit.state = 'advancing';
      this._advance(unit, dt, effectiveSpeed, null);
      this._applySeparation(unit, dt);
      return;
    }

    const distX = Math.abs(unit.position.x - enemy.position.x);

    if (distX <= unit.range) {
      unit.state = 'fighting';
      if (unit.canFire()) {
        const dmgMult = isBuffed ? 1 + COMMANDER_DAMAGE_BONUS : 1;
        this._fire(unit, enemy, dmgMult);
      }
    } else {
      if (unit.state !== 'retreating') unit.state = 'advancing';
      this._advance(unit, dt, effectiveSpeed, enemy);
    }

    if (unit.hp < unit.maxHp * RETREAT_THRESHOLD && unit.state !== 'retreating') {
      unit.state = 'retreating';
      const dir = unit.team === 'blue' ? -1 : 1;
      unit._retreatTarget = unit.position.x + dir * RETREAT_DISTANCE;
    }

    if (unit.state === 'retreating') this._retreat(unit, dt, effectiveSpeed);

    this._applySeparation(unit, dt);

    const zMin = unit.lane - LANE_Z_CLAMP;
    const zMax = unit.lane + LANE_Z_CLAMP;
    if (unit.position.z < zMin) unit.position.z = zMin;
    if (unit.position.z > zMax) unit.position.z = zMax;
  }

  _advance(unit, dt, speed, enemy) {
    let dir;
    if (enemy) {
      dir = Math.sign(enemy.position.x - unit.position.x) || (unit.team === 'blue' ? 1 : -1);
    } else if (unit.team === 'red' && this._convoyX !== null) {
      // Red units chase convoy when no enemy in range
      dir = Math.sign(this._convoyX - unit.position.x) || -1;
    } else {
      dir = unit.team === 'blue' ? 1 : -1;
    }
    unit.position.x += dir * speed * dt;
  }

  _retreat(unit, dt, speed) {
    const dir = unit.team === 'blue' ? -1 : 1;
    unit.position.x += dir * speed * 0.8 * dt;
    if (unit._retreatTarget !== null) {
      const reached = unit.team === 'blue'
        ? unit.position.x <= unit._retreatTarget
        : unit.position.x >= unit._retreatTarget;
      if (reached) { unit.state = 'advancing'; unit._retreatTarget = null; }
    }
  }

  _applySeparation(unit, dt) {
    for (const other of this._units) {
      if (other === unit || !other.alive || other.team !== unit.team) continue;
      const dx = unit.position.x - other.position.x;
      const dz = unit.position.z - other.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < SEPARATION_RADIUS && dist > 0.001) {
        const push = (SEPARATION_RADIUS - dist) / SEPARATION_RADIUS * SEPARATION_FORCE;
        unit.position.x += (dx / dist) * push * dt;
        unit.position.z += (dz / dist) * push * dt;
      }
    }
  }

  _findNearestEnemy(unit) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const other of this._units) {
      if (!other.alive || other.team === unit.team || other.state === 'dead') continue;
      // Ground units ignore air units
      if (other.type === 'enemyDrone') continue;
      const d = Math.abs(unit.position.x - other.position.x);
      if (d < nearestDist) { nearestDist = d; nearest = other; }
    }
    return nearest;
  }

  _fire(unit, target, dmgMult = 1) {
    unit.resetCooldown();

    const from = unit.position.clone(); from.y = 0.8;
    const to   = target.position.clone(); to.y = 0.8;

    bus.emit('unit:fire', { position: from.clone(), team: unit.team });

    const baseDamage = unit.damage * dmgMult;
    const reduction = this._hasTankShield(target) ? (1 - TANK_PROTECT_REDUCTION) : 1;
    const finalDamage = baseDamage * reduction;

    const proj = new Projectile(this._scene, from, to, unit.team, () => {
      if (target.alive && target.state !== 'dead') {
        target.takeDamage(finalDamage);
      }
    });
    this._projectiles.push(proj);
  }

  _updateProjectiles(dt) {
    for (const proj of this._projectiles) {
      if (proj.alive) proj.update(dt);
    }
  }

  _checkWinCondition() {
    if (this._resolvedEmitted) return;
    const blueAlive = this._units.some(u => u.team === 'blue' && u.alive && u.state !== 'dead');
    const redAlive  = this._units.some(u => u.team === 'red'  && u.alive && u.state !== 'dead' && u.type !== 'enemyDrone');
    if (!blueAlive || !redAlive) {
      this._resolvedEmitted = true;
      bus.emit('battle:resolved', { blueScore: this.getScore('blue'), redScore: this.getScore('red') });
    }
  }

  getScore(team) {
    return this._units
      .filter(u => u.team === team && u.alive && u.state !== 'dead')
      .reduce((sum, u) => sum + u.hp, 0);
  }
}

