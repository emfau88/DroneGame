import * as THREE from 'three';

import { bus }               from '../core/EventBus.js';
import { MissileProjectile } from '../entities/MissileProjectile.js';

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
    this._bus     = null;
    this._scene   = null;
    this._units   = null;
    this._onDroneFire     = null;
    this._pendingCluster  = [];
    this._pendingChainEMP = [];
    this._missiles        = []; // active MissileProjectile instances
  }

  init(bus_, scene) {
    this._bus   = bus_;
    this._scene = scene;

    this._onDroneFire = (data) => this._handleDroneFire(data);
    bus_.on('weapon:dronefire', this._onDroneFire);
  }

  /** Called by Game each frame to provide current unit list for targeting. */
  setUnits(units) {
    this._units = units;
  }

  /** Clear pending cluster/EMP entries and in-flight projectiles between maps. */
  clearPending() {
    this._pendingCluster  = [];
    this._pendingChainEMP = [];
    for (const m of this._missiles) {
      if (m.type === 'bullet' || m.type === 'falling_bomb') {
        if (this._scene) this._scene.remove(m.mesh);
        m.geo.dispose(); m.mat.dispose();
      } else if (m.type === 'missile') {
        m.projectile.destroy();
      }
    }
    this._missiles = [];
  }

  _handleDroneFire({ type, dronePosition, target, weapon, damageMultiplier, upgrades }) {
    const def = WEAPON_DEFS[type];
    if (!def) return;

    const dm  = damageMultiplier ?? 1;
    const upg = upgrades || {};
    const units = this._units || [];

    switch (type) {
      case 'cannon':
        this._fireCannon(def, dronePosition, target, dm, units, upg);
        break;
      case 'bomb':
        this._fireBomb(def, dronePosition, dm, units, upg);
        break;
      case 'emp':
        this._fireEMP(def, dronePosition, units, upg);
        break;
      case 'missile':
        this._fireMissile(def, dronePosition, target, dm, upg);
        break;
      case 'cluster':
        this._fireCluster(def, dronePosition, dm, units, upg);
        break;
    }
  }

  _fireCannon(def, dronePos, target, dm, units, upg) {
    if (!target) return;
    const armorBonus = (upg.armorPiercer && target.type === 'tank') ? 1.3 : 1;
    const dmg = def.damage * dm * armorBonus;

    // Spawn a visible bullet from drone toward target
    if (this._scene) {
      const from = dronePos.clone(); from.y -= 0.5;
      const to   = target.position.clone(); to.y += 0.5;
      const dir  = new THREE.Vector3().subVectors(to, from).normalize();
      const dist = from.distanceTo(to);
      const speed = 28;

      // Bright yellow-white tracer round — clearly player-owned, readable at speed
      const geo  = new THREE.SphereGeometry(0.14, 5, 4);
      const mat  = new THREE.MeshBasicMaterial({ color: 0xFFFF99 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(from);
      this._scene.add(mesh);

      this._missiles.push({
        type: 'bullet',
        mesh,
        geo,
        mat,
        dir,
        dist,
        traveled: 0,
        speed,
        onArrive: () => {
          if (target.alive && target.state !== 'dead') {
            target.takeDamage(dmg);
            bus.emit('weapon:impact', {
              type: 'cannon',
              position: target.position.clone(),
              affectedUnits: [{ unit: target, damage: dmg }],
            });
          }
          this._scene.remove(mesh);
          geo.dispose(); mat.dispose();
        },
      });
    } else {
      target.takeDamage(dmg);
      bus.emit('weapon:impact', { type: 'cannon', position: target.position.clone(), affectedUnits: [{ unit: target, damage: dmg }] });
    }
  }

  _fireBomb(def, dronePos, dm, units, upg) {
    // devastator: +2 radius, +15 damage
    const radius = def.radius + (upg.devastator ? 2 : 0);
    const baseDmg = def.damage + (upg.devastator ? 15 : 0);
    const pos = new THREE.Vector3(dronePos.x, 0, dronePos.z);
    const affected = [];

    for (const unit of units) {
      if (!unit.alive || unit.state === 'dead') continue;
      if (unit.position.y > 5) continue;
      const dist = Math.hypot(unit.position.x - pos.x, unit.position.z - pos.z);
      if (dist > radius) continue;
      const t = 1 - dist / radius;
      const armorBonus = (upg.armorPiercer && unit.type === 'tank') ? 1.3 : 1;
      const dmg = baseDmg * t * dm * armorBonus;
      affected.push({ unit, damage: dmg });
    }

    // Falling bomb visual: small dark sphere drops from drone to ground over 0.28s
    if (this._scene) {
      const bombGeo = new THREE.SphereGeometry(0.18, 6, 4);
      const bombMat = new THREE.MeshBasicMaterial({ color: 0x222211 });
      const bombMesh = new THREE.Mesh(bombGeo, bombMat);
      bombMesh.position.set(dronePos.x, dronePos.y - 0.5, dronePos.z);
      this._scene.add(bombMesh);
      this._missiles.push({
        type: 'falling_bomb',
        mesh: bombMesh, geo: bombGeo, mat: bombMat,
        startY: dronePos.y - 0.5,
        traveled: 0, totalDist: dronePos.y - 0.5,
        speed: (dronePos.y - 0.5) / 0.28,
        pos: pos.clone(), affected, radius,
        exploded: false,
      });
    } else {
      bus.emit('weapon:impact', { type: 'bomb', position: pos.clone(), affectedUnits: affected, radius });
      for (const { unit, damage } of affected) unit.takeDamage(damage);
    }
  }

  _fireEMP(def, dronePos, units, upg) {
    const pos = dronePos.clone();
    const affected = [];

    for (const unit of units) {
      if (!unit.alive || unit.state === 'dead') continue;
      if (unit.position.y > 5) continue;
      const dist = Math.hypot(unit.position.x - pos.x, unit.position.z - pos.z);
      if (dist > def.radius) continue;
      affected.push({ unit, damage: 0 });
    }

    bus.emit('weapon:impact', { type: 'emp', position: pos.clone(), affectedUnits: affected, radius: def.radius });

    for (const { unit } of affected) {
      unit.stun(def.stunDuration);
    }

    // chainEMP: queue a second pulse 1s later
    if (upg.chainEMP) {
      this._pendingChainEMP.push({ timer: 1.0, pos: pos.clone(), def, units: [...units] });
    }
  }

  _fireMissile(def, dronePos, target, dm, upg) {
    if (!target || !this._scene) return;
    // homingMissiles: +20% vs tanks
    const homingBonus = (upg.homingMissiles && target.type === 'tank') ? 1.2 : 1;
    // armorPiercer: +30% vs tanks
    const armorBonus  = (upg.armorPiercer  && target.type === 'tank') ? 1.3 : 1;
    const dmg = def.damage * dm * homingBonus * armorBonus;

    const from = dronePos.clone(); from.y -= 0.5;
    const missile = new MissileProjectile(
      this._scene,
      from,
      target,
      16,
      0xFF8822,
      () => {
        if (target.alive && target.state !== 'dead') {
          target.takeDamage(dmg);
          bus.emit('weapon:impact', {
            type: 'missile',
            position: target.position.clone(),
            affectedUnits: [{ unit: target, damage: dmg }],
          });
        }
      },
    );
    this._missiles.push({ type: 'missile', projectile: missile });
  }

  _fireCluster(def, dronePos, dm, units, upg) {
    const centerPos = new THREE.Vector3(dronePos.x, 0, dronePos.z);

    // clusterPlus: 2 extra submunitions
    const submunitions = def.submunitions + (upg.clusterPlus ? 2 : 0);

    for (let s = 0; s < submunitions; s++) {
      const angle = (s / submunitions) * Math.PI * 2 + Math.random() * 0.8;
      const r = (0.3 + Math.random() * 0.7) * def.radius * 0.6;
      const subPos = new THREE.Vector3(
        centerPos.x + Math.cos(angle) * r,
        0,
        centerPos.z + Math.sin(angle) * r,
      );
      const subRadius = 4.0;

      const affected = [];
      for (const unit of units) {
        if (!unit.alive || unit.state === 'dead') continue;
        if (unit.position.y > 5) continue;
        const dist = Math.hypot(unit.position.x - subPos.x, unit.position.z - subPos.z);
        if (dist > subRadius) continue;
        const t = 1 - dist / subRadius;
        const armorBonus = (upg.armorPiercer && unit.type === 'tank') ? 1.3 : 1;
        affected.push({ unit, damage: def.damage * t * dm * armorBonus });
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
    // Flying projectiles (cannon bullets + missiles)
    if (this._missiles.length > 0) {
      const remaining = [];
      for (const m of this._missiles) {
        if (m.type === 'bullet') {
          const step = m.speed * dt;
          m.traveled += step;
          m.mesh.position.addScaledVector(m.dir, step);
          if (m.traveled >= m.dist) {
            m.onArrive();
          } else {
            remaining.push(m);
          }
        } else if (m.type === 'falling_bomb') {
          m.mesh.position.y -= m.speed * dt;
          if (m.mesh.position.y <= 0.3 && !m.exploded) {
            m.exploded = true;
            this._scene.remove(m.mesh);
            m.geo.dispose(); m.mat.dispose();
            bus.emit('weapon:impact', { type: 'bomb', position: m.pos, affectedUnits: m.affected, radius: m.radius });
            for (const { unit, damage } of m.affected) {
              if (unit.alive && unit.state !== 'dead') unit.takeDamage(damage);
            }
          } else if (!m.exploded) {
            remaining.push(m);
          }
        } else if (m.type === 'missile') {
          m.projectile.update(dt, this._scene);
          if (m.projectile.alive) remaining.push(m);
        }
      }
      this._missiles = remaining;
    }

    // Cluster submunition stagger
    if (this._pendingCluster.length > 0) {
      const remaining = [];
      for (const sub of this._pendingCluster) {
        sub.timer -= dt;
        if (sub.timer <= 0) {
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

    // Chain EMP second pulse
    if (this._pendingChainEMP.length > 0) {
      const remaining = [];
      for (const entry of this._pendingChainEMP) {
        entry.timer -= dt;
        if (entry.timer <= 0) {
          const affected = [];
          for (const unit of entry.units) {
            if (!unit.alive || unit.state === 'dead') continue;
            if (unit.position.y > 5) continue;
            const dist = Math.hypot(unit.position.x - entry.pos.x, unit.position.z - entry.pos.z);
            if (dist > entry.def.radius) continue;
            affected.push({ unit, damage: 0 });
          }
          bus.emit('weapon:impact', { type: 'emp', position: entry.pos.clone(), affectedUnits: affected });
          for (const { unit } of affected) {
            if (unit.alive && unit.state !== 'dead') unit.stun(entry.def.stunDuration);
          }
        } else {
          remaining.push(entry);
        }
      }
      this._pendingChainEMP = remaining;
    }
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
