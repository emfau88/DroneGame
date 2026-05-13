import * as THREE from 'three';

import { bus } from '../core/EventBus.js';

// Weapon base damage and config from DRONE_STRIKE_REBUILD.md
const WEAPON_DEFS = {
  cannon: {
    type: 'cannon',
    damage: 8,
    cooldownDuration: 0.22,
    range: 14,
  },
  bomb: {
    type: 'bomb',
    damage: 55,
    radius: 5.2,
    cooldownDuration: 3.5,
    falloff: 'linear',
  },
  emp: {
    type: 'emp',
    damage: 0,
    radius: 7.5,
    stunDuration: 3.0,
    cooldownDuration: 8.0,
  },
  missile: {
    type: 'missile',
    damage: 38,
    cooldownDuration: 1.8,
    range: 22,
  },
  cluster: {
    type: 'cluster',
    damage: 22,
    submunitions: 6,
    radius: 10,
    cooldownDuration: 12.0,
  },
};

/**
 * WeaponSystem — weapon execution: damage calculation and delivery.
 * Listens for weapon:dronefire events from Drone, applies damage to units,
 * emits weapon:impact for EffectSystem and AudioSystem.
 */
export class WeaponSystem {
  constructor() {
    this._bus   = null;
    this._units = null; // reference updated each frame by Game
    this._onDroneFire = null;
  }

  init(bus_) {
    this._bus = bus_;

    this._onDroneFire = (data) => this._handleDroneFire(data);
    bus_.on('weapon:dronefire', this._onDroneFire);
  }

  /** Called by Game each frame to provide current unit list for targeting. */
  setUnits(units) {
    this._units = units;
  }

  _handleDroneFire({ type, dronePosition, target, weapon, damageMultiplier }) {
    const def = WEAPON_DEFS[type];
    if (!def) return;

    const dm = damageMultiplier ?? 1;
    const units = this._units || [];

    switch (type) {
      case 'cannon':
        this._fireCannon(def, dronePosition, target, dm, units);
        break;
      case 'bomb':
        this._fireBomb(def, dronePosition, dm, units);
        break;
      case 'emp':
        this._fireEMP(def, dronePosition, units);
        break;
      case 'missile':
        this._fireMissile(def, dronePosition, target, dm);
        break;
      case 'cluster':
        this._fireCluster(def, dronePosition, dm, units);
        break;
    }
  }

  _fireCannon(def, dronePos, target, dm, units) {
    if (!target) return;
    const dmg = def.damage * dm;
    const firePos = dronePos.clone();
    firePos.y = dronePos.y - 0.5;

    bus.emit('unit:fire', { position: firePos, team: 'blue' });

    // Deliver via projectile-like instant hit (cannon is fast tracer)
    bus.emit('weapon:impact', {
      type: 'cannon',
      position: target.position.clone(),
      affectedUnits: [{ unit: target, damage: dmg }],
    });

    target.takeDamage(dmg);
  }

  _fireBomb(def, dronePos, dm, units) {
    const pos = new THREE.Vector3(dronePos.x, 0, dronePos.z);
    const affected = [];

    for (const unit of units) {
      if (!unit.alive || unit.state === 'dead') continue;
      // Bombs only hit ground units (y ~ 0)
      if (unit.position.y > 5) continue;
      const dist = Math.hypot(unit.position.x - pos.x, unit.position.z - pos.z);
      if (dist > def.radius) continue;
      const t = 1 - dist / def.radius;
      const dmg = def.damage * t * dm;
      affected.push({ unit, damage: dmg });
    }

    bus.emit('weapon:impact', { type: 'bomb', position: pos.clone(), affectedUnits: affected });

    for (const { unit, damage } of affected) {
      unit.takeDamage(damage);
    }
  }

  _fireEMP(def, dronePos, units) {
    const pos = dronePos.clone();
    const affected = [];

    for (const unit of units) {
      if (!unit.alive || unit.state === 'dead') continue;
      if (unit.position.y > 5) continue;
      const dist = Math.hypot(unit.position.x - pos.x, unit.position.z - pos.z);
      if (dist > def.radius) continue;
      affected.push({ unit, damage: 0 });
    }

    bus.emit('weapon:impact', { type: 'emp', position: pos.clone(), affectedUnits: affected });

    for (const { unit } of affected) {
      unit.stun(def.stunDuration);
    }
  }

  _fireMissile(def, dronePos, target, dm) {
    if (!target) return;
    const dmg = def.damage * dm;

    bus.emit('weapon:impact', {
      type: 'missile',
      position: target.position.clone(),
      affectedUnits: [{ unit: target, damage: dmg }],
    });

    target.takeDamage(dmg);
  }

  _fireCluster(def, dronePos, dm, units) {
    const centerPos = new THREE.Vector3(dronePos.x, 0, dronePos.z);

    // Queue staggered submunition explosions — stored for update() to tick
    if (!this._pendingCluster) this._pendingCluster = [];

    const submunitions = def.submunitions;
    for (let s = 0; s < submunitions; s++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * def.radius;
      const subPos = new THREE.Vector3(
        centerPos.x + Math.cos(angle) * r,
        0,
        centerPos.z + Math.sin(angle) * r,
      );
      const subRadius = 2.5;

      // Collect affected units for this submunition
      const affected = [];
      for (const unit of units) {
        if (!unit.alive || unit.state === 'dead') continue;
        if (unit.position.y > 5) continue;
        const dist = Math.hypot(unit.position.x - subPos.x, unit.position.z - subPos.z);
        if (dist > subRadius) continue;
        const t = 1 - dist / subRadius;
        affected.push({ unit, damage: def.damage * t * dm });
      }

      // Stagger explosion visuals using dt-accumulation in update()
      this._pendingCluster.push({
        timer: s * 0.13,
        pos: subPos.clone(),
        affected,
      });
    }
  }

  update(dt) {
    if (!this._pendingCluster || this._pendingCluster.length === 0) return;

    const remaining = [];
    for (const sub of this._pendingCluster) {
      sub.timer -= dt;
      if (sub.timer <= 0) {
        // Fire this submunition
        for (const { unit, damage } of sub.affected) {
          if (unit.alive && unit.state !== 'dead') unit.takeDamage(damage);
        }
        bus.emit('weapon:impact', { type: 'bomb', position: sub.pos, affectedUnits: sub.affected });
      } else {
        remaining.push(sub);
      }
    }
    this._pendingCluster = remaining;
  }

  getWeaponDef(type) {
    return WEAPON_DEFS[type] || null;
  }

  destroy() {
    if (this._bus) {
      this._bus.off('weapon:dronefire', this._onDroneFire);
    }
  }
}
