import * as THREE from 'three';
import { bus } from '../core/EventBus.js';

// HQ stats from DRONE_STRIKE_REBUILD.md
const HQ_HP       = 200;
const HQ_RADIUS   = 3.0;

// Hold zone
const ZONE_RADIUS     = 6;
const ZONE_WIN_SECS   = 60;

// Convoy
const CONVOY_HP       = 100;
const CONVOY_SPEED    = 3;
const CONVOY_END_X    = 0;

// Geometries — created once
const _hqGeo     = new THREE.BoxGeometry(4, 3, 4);
const _beaconGeo = new THREE.CylinderGeometry(0.15, 0.15, 6, 6);
const _zoneGeo   = new THREE.RingGeometry(ZONE_RADIUS - 0.2, ZONE_RADIUS, 48);
const _convoyGeo = new THREE.BoxGeometry(2.5, 1.2, 1.4);

/**
 * ObjectiveSystem — manages DESTROY_HQ, HOLD_ZONE, and ESCORT_CONVOY objectives.
 * Call init() per map, update() each frame. Emits objective:completed or objective:failed.
 */
export class ObjectiveSystem {
  constructor() {
    this._scene    = null;
    this._type     = null;
    this._complete = false;
    this._failed   = false;

    // HQ
    this._hqMesh   = null;
    this._hqHp     = HQ_HP;
    this._hqBeacon = null;

    // Hold zone
    this._zoneMesh       = null;
    this._zoneTimer      = 0;
    this._redZoneTimer   = 0; // seconds red has controlled zone — lose if > 8

    // Convoy
    this._convoyMesh  = null;
    this._convoyHp    = CONVOY_HP;
    this._convoyX     = -30;
  }

  /**
   * Initialize the objective for a new map.
   * @param {string} type - 'destroy_hq' | 'hold_zone' | 'escort_convoy'
   * @param {THREE.Scene} scene
   */
  init(type, scene) {
    this.destroy(); // clean previous
    this._scene    = scene;
    this._type     = type;
    this._complete = false;
    this._failed   = false;

    switch (type) {
      case 'destroy_hq':    this._initHQ();      break;
      case 'hold_zone':     this._initHoldZone(); break;
      case 'escort_convoy': this._initConvoy();   break;
    }
  }

  _initHQ() {
    this._hqHp = HQ_HP;

    // HQ building — dark red, far end of map
    const mat = new THREE.MeshStandardMaterial({ color: 0x8B1A1A });
    this._hqMesh = new THREE.Mesh(_hqGeo, mat);
    this._hqMesh.position.set(38, 1.5, 0);
    this._hqMesh.castShadow = true;
    this._hqMesh.receiveShadow = true;
    this._scene.add(this._hqMesh);

    // Pulsing beacon above HQ
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xFF2222 });
    this._hqBeacon = new THREE.Mesh(_beaconGeo, beaconMat);
    this._hqBeacon.position.set(38, 5.5, 0);
    this._scene.add(this._hqBeacon);
  }

  _initHoldZone() {
    this._zoneTimer = 0;
    this._redZoneTimer = 0;

    // Ring on ground — far left side, player must actively defend it
    const mat = new THREE.MeshBasicMaterial({ color: 0x297BFF, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    this._zoneMesh = new THREE.Mesh(_zoneGeo, mat);
    this._zoneMesh.rotation.x = -Math.PI / 2;
    this._zoneMesh.position.set(-18, 0.05, 0);
    this._scene.add(this._zoneMesh);
  }

  _initConvoy() {
    this._convoyHp = CONVOY_HP;
    this._convoyX  = -30;

    const mat = new THREE.MeshStandardMaterial({ color: 0x44AA44 });
    this._convoyMesh = new THREE.Mesh(_convoyGeo, mat);
    this._convoyMesh.position.set(this._convoyX, 0.6, 0);
    this._convoyMesh.castShadow = true;
    this._scene.add(this._convoyMesh);
  }

  /**
   * @param {number} dt
   * @param {import('../entities/Unit.js').Unit[]} units
   * @returns {{ statusText: string, complete: boolean, failed: boolean }}
   */
  update(dt, units) {
    if (this._complete || this._failed) {
      return { statusText: this._getStatusText(), complete: this._complete, failed: this._failed };
    }

    switch (this._type) {
      case 'destroy_hq':    this._updateHQ(dt);         break;
      case 'hold_zone':     this._updateHoldZone(dt, units); break;
      case 'escort_convoy': this._updateConvoy(dt, units);   break;
    }

    // Pulse beacon
    if (this._hqBeacon) {
      this._hqBeacon.material.opacity = 0.5 + Math.sin(Date.now() * 0.004) * 0.5;
    }

    return { statusText: this._getStatusText(), complete: this._complete, failed: this._failed };
  }

  _updateHQ(dt) {
    if (!this._hqMesh) return;

    // Check if any player weapon hit HQ — check via bus in future; for now use proximity check
    // HQ takes damage from WeaponSystem weapon:impact events
    // This is wired externally via applyDamageToHQ()

    if (this._hqHp <= 0) {
      this._complete = true;
      this._destroyHQMesh();
      bus.emit('objective:completed', { type: 'destroy_hq' });
    }
  }

  _destroyHQMesh() {
    if (this._hqMesh) { this._scene.remove(this._hqMesh); this._hqMesh = null; }
    if (this._hqBeacon) { this._scene.remove(this._hqBeacon); this._hqBeacon = null; }
  }

  /**
   * Apply damage to HQ from weapon impact.
   * @param {THREE.Vector3} pos
   * @param {number} radius
   * @param {number} damage
   */
  applyWeaponToHQ(pos, radius, damage) {
    if (!this._hqMesh || this._complete) return;
    const dist = Math.hypot(pos.x - 38, pos.z - 0);
    if (dist <= radius + HQ_RADIUS) {
      const falloff = Math.max(0, 1 - dist / (radius + HQ_RADIUS));
      this._hqHp = Math.max(0, this._hqHp - damage * falloff);
      bus.emit('objective:updated', { type: 'destroy_hq', progress: this._hqHp / HQ_HP });
    }
  }

  _updateHoldZone(dt, units) {
    if (!this._zoneMesh) return;

    // Count blue vs red units inside zone
    const zoneCenter = this._zoneMesh.position;
    let blueCount = 0;
    let redCount  = 0;
    for (const u of units) {
      if (!u.alive || u.state === 'dead') continue;
      const d = Math.hypot(u.position.x - zoneCenter.x, u.position.z - zoneCenter.z);
      if (d <= ZONE_RADIUS) {
        if (u.team === 'blue') blueCount++;
        else redCount++;
      }
    }

    const blueControls = blueCount > 0 && blueCount >= redCount;
    const redControls  = redCount > 0 && redCount > blueCount;
    const contested    = redCount > 0 && blueCount > 0;

    if (redControls || contested) {
      // Red presence accumulates threat timer — resets only when zone is clear of red
      this._redZoneTimer += dt;
      this._zoneMesh.material.color.setHex(contested ? 0xFF8800 : 0xFF4444);
      if (this._redZoneTimer >= 6) {
        this._failed = true;
        bus.emit('objective:failed', { type: 'hold_zone' });
      }
    } else if (blueControls) {
      this._zoneTimer += dt;
      this._redZoneTimer = Math.max(0, this._redZoneTimer - dt * 0.5); // bleed off slowly
      this._zoneMesh.material.color.setHex(0x44FF44);
      bus.emit('objective:updated', { type: 'hold_zone', progress: this._zoneTimer / ZONE_WIN_SECS });
    } else {
      // Empty zone — neutral
      this._zoneMesh.material.color.setHex(0x297BFF);
    }

    if (this._zoneTimer >= ZONE_WIN_SECS) {
      this._complete = true;
      bus.emit('objective:completed', { type: 'hold_zone' });
    }
  }

  _updateConvoy(dt, units) {
    if (!this._convoyMesh) return;

    // Advance convoy
    this._convoyX += CONVOY_SPEED * dt;
    this._convoyMesh.position.x = this._convoyX;

    // Enemies near convoy deal damage to it (proximity check)
    for (const u of units) {
      if (!u.alive || u.state === 'dead' || u.team !== 'red') continue;
      const d = Math.hypot(u.position.x - this._convoyX, u.position.z - this._convoyMesh.position.z);
      if (d < 3.5 && u.canFire()) {
        this._convoyHp -= u.damage * dt;
        u.resetCooldown();
      }
    }

    this._convoyHp = Math.max(0, this._convoyHp);

    if (this._convoyHp <= 0) {
      this._failed = true;
      bus.emit('objective:failed', { type: 'escort_convoy' });
    } else if (this._convoyX >= CONVOY_END_X) {
      this._complete = true;
      bus.emit('objective:completed', { type: 'escort_convoy' });
    }

    bus.emit('objective:updated', {
      type: 'escort_convoy',
      progress: (this._convoyX + 30) / 30,
    });
  }

  _getStatusText() {
    switch (this._type) {
      case 'destroy_hq':
        if (this._complete) return 'HQ: DESTROYED';
        return `HQ: ${Math.ceil(this._hqHp)} HP`;
      case 'hold_zone': {
        if (this._complete) return 'ZONE: SECURED';
        const remaining = Math.ceil(ZONE_WIN_SECS - this._zoneTimer);
        return `ZONE: ${this._zoneTimer > 0 ? Math.ceil(this._zoneTimer) : 0}s / ${ZONE_WIN_SECS}s`;
      }
      case 'escort_convoy':
        if (this._complete) return 'CONVOY: REACHED GOAL';
        if (this._failed)   return 'CONVOY: DESTROYED';
        return `CONVOY: ${Math.round(this._convoyHp)} HP`;
      default:
        return '';
    }
  }

  get type() { return this._type; }
  get complete() { return this._complete; }
  get failed() { return this._failed; }

  /** Get convoy position for damage calculations (weapons can hit convoy). */
  getConvoyPosition() {
    if (!this._convoyMesh) return null;
    return this._convoyMesh.position.clone();
  }

  destroy() {
    if (this._hqMesh)     { this._scene?.remove(this._hqMesh);     this._hqMesh     = null; }
    if (this._hqBeacon)   { this._scene?.remove(this._hqBeacon);   this._hqBeacon   = null; }
    if (this._zoneMesh)   { this._scene?.remove(this._zoneMesh);   this._zoneMesh   = null; }
    if (this._convoyMesh) { this._scene?.remove(this._convoyMesh); this._convoyMesh = null; }
  }
}
