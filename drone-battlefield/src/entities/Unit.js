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
  // SAM variants
  samMedBase:   new THREE.BoxGeometry(1.2, 0.55, 1.2),
  samMedLauncher: new THREE.BoxGeometry(0.28, 0.28, 0.9),
  samHeavyBase:  new THREE.BoxGeometry(1.5, 0.65, 1.5),
  samHeavyLauncher: new THREE.BoxGeometry(0.32, 0.32, 1.0),
  // Rocket infantry (shoulder launcher)
  rocketInfBody: new THREE.CapsuleGeometry(0.28, 0.55, 4, 8),
  rocketInfTube: new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8),
  // Jammer
  jammerBase:    new THREE.BoxGeometry(0.9, 0.5, 0.9),
  jammerDish:    new THREE.CylinderGeometry(0.05, 0.42, 0.12, 16),
  jammerMast:    new THREE.BoxGeometry(0.07, 0.55, 0.07),
  // EMP Mortar
  empMortBase:   new THREE.BoxGeometry(0.85, 0.45, 0.85),
  empMortTube:   new THREE.CylinderGeometry(0.10, 0.13, 0.7, 8),
  // Titan Tank (boss)
  titanHull:     new THREE.BoxGeometry(3.2, 1.0, 2.0),
  titanTurret:   new THREE.BoxGeometry(1.6, 0.7, 1.4),
  titanBarrel:   new THREE.CylinderGeometry(0.12, 0.12, 1.6, 10),
  titanTrack:    new THREE.BoxGeometry(3.4, 0.38, 0.45),
  titanHatch:    new THREE.BoxGeometry(0.5, 0.18, 0.5),
  // Enemy drone geometry
  eDroneBody: new THREE.BoxGeometry(0.6, 0.15, 0.6),
  eDroneArm:  new THREE.BoxGeometry(0.8, 0.08, 0.08),
};

// Ground unit stats. aaRange: 0 = cannot shoot drone. aaCooldown in seconds.
const UNIT_STATS = {
  soldier: {
    hp: 12, damage: 2.1, speed: 2.05, range: 5.2, cooldown: 0.75,
    aaRange: 8, aaDamage: 1, aaCooldown: 4.0, aaLockTime: 0,
  },
  tank: {
    hp: 45, damage: 5.2, speed: 1.2, range: 5.2, cooldown: 1.8,
    aaRange: 18, aaDamage: 1, aaCooldown: 2.8, aaLockTime: 0.3,
  },
  rocket: {
    hp: 18, damage: 4.8, speed: 1.6, range: 7.5, cooldown: 1.25,
    aaRange: 10, aaDamage: 1, aaCooldown: 2.5, aaLockTime: 0.5,
  },
  commander: {
    hp: 28, damage: 3.0, speed: 1.8, range: 6.0, cooldown: 1.8,
    aaRange: 6, aaDamage: 1, aaCooldown: 5.0, aaLockTime: 0.8,
  },
  flakGun: {  // SAM Light — 1 slow homing missile
    hp: 28, damage: 0, speed: 0, range: 0, cooldown: 0,
    aaRange: 20, aaDamage: 1, aaCooldown: 1.8, aaLockTime: 0.5,
  },
  samMedium: {  // SAM Medium — 2 missiles per salvo
    hp: 38, damage: 0, speed: 0, range: 0, cooldown: 0,
    aaRange: 22, aaDamage: 1, aaCooldown: 2.2, aaLockTime: 0.4,
  },
  samHeavy: {   // SAM Heavy — 3-shot quick salvo
    hp: 55, damage: 0, speed: 0, range: 0, cooldown: 0,
    aaRange: 25, aaDamage: 1, aaCooldown: 3.5, aaLockTime: 0.6,
  },
  rocketInfantry: {  // shoulder-launched rocket, slow to reload
    hp: 14, damage: 3.5, speed: 1.7, range: 6.5, cooldown: 1.4,
    aaRange: 14, aaDamage: 1, aaCooldown: 4.0, aaLockTime: 0.6,
  },
  jammer: {  // static disruption tower — no weapons, no movement
    hp: 20, damage: 0, speed: 0, range: 0, cooldown: 0,
    aaRange: 0, aaDamage: 0, aaCooldown: 0, aaLockTime: 0,
    jamRadius: 12,
  },
  empMortar: {  // lobs EMP grenade at drone area, freezes weapons 2s
    hp: 22, damage: 0, speed: 0, range: 0, cooldown: 0,
    aaRange: 18, aaDamage: 0, aaCooldown: 5.5, aaLockTime: 1.2,
  },
  titanTank: {  // BOSS — slow heavy tank, fires devastating shells
    hp: 400, damage: 12, speed: 0.55, range: 8.0, cooldown: 3.5,
    aaRange: 14, aaDamage: 2, aaCooldown: 4.0, aaLockTime: 1.0,
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

    // Jammer radius (only relevant for jammer type)
    this.jamRadius  = base.jamRadius ?? 0;

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
        // Slightly larger body — commanders stand out from soldiers
        const body = new THREE.Mesh(GEO.commander, makeMat(0.8, 0.05));
        body.castShadow = true; body.receiveShadow = true;
        body.position.y = 0.8;
        body.scale.setScalar(1.18);
        this.group.add(body); this._meshes.push(body);

        // Two asymmetric antennas — immediately distinguishable from lone soldier
        const ant1 = new THREE.Mesh(GEO.cmdAntenna, makeMat(0.4, 0.7));
        ant1.castShadow = true;
        ant1.position.set(-0.12, 1.75, 0);
        this.group.add(ant1); this._meshes.push(ant1);

        const ant2 = new THREE.Mesh(GEO.cmdAntenna, makeMat(0.4, 0.7));
        ant2.castShadow = true;
        ant2.position.set(0.14, 1.65, 0);
        this.group.add(ant2); this._meshes.push(ant2);

        // Rank stripes on shoulders — gold for red, white for blue
        const stripeColor = this.team === 'red' ? 0xFFCC00 : 0xDDEEFF;
        const stripeMat = new THREE.MeshStandardMaterial({ color: stripeColor, roughness: 0.4, metalness: 0.5, emissive: new THREE.Color(stripeColor).multiplyScalar(0.25) });
        const stripeGeo = new THREE.BoxGeometry(0.08, 0.07, 0.36);
        for (const ox of [-0.28, 0.28]) {
          const stripe = new THREE.Mesh(stripeGeo, stripeMat);
          stripe.position.set(ox, 1.08, 0);
          this.group.add(stripe); this._meshes.push(stripe);
        }
        break;
      }
      case 'flakGun': {
        // Olive-green armored base, bright yellow-orange barrel — instantly reads as AA gun
        const base = new THREE.Mesh(GEO.flakBase, new THREE.MeshStandardMaterial({ color: 0x5A6830, roughness: 0.75, metalness: 0.25 }));
        base.castShadow = true; base.receiveShadow = true;
        base.position.y = 0.25;
        this.group.add(base); this._meshes.push(base);

        // Warning stripe ring at base
        const ringGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.08, 16);
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: 0xFFAA00, roughness: 0.5, metalness: 0.4, emissive: new THREE.Color(0x442200) }));
        ring.position.y = 0.48;
        this.group.add(ring); this._meshes.push(ring);

        const pivot = new THREE.Object3D();
        pivot.position.y = 0.6;
        this.group.add(pivot);

        const barrel = new THREE.Mesh(GEO.flakBarrel, new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.35, metalness: 0.85 }));
        barrel.castShadow = true;
        barrel.rotation.x = -Math.PI / 4;
        barrel.position.y = 0.5;
        pivot.add(barrel);
        this._barrel = pivot;
        this._meshes.push(barrel);
        break;
      }
      case 'samMedium': {
        // Tan/sand launcher vehicle — two prominent white missile tubes
        const base = new THREE.Mesh(GEO.samMedBase, new THREE.MeshStandardMaterial({ color: 0x8A7A50, roughness: 0.7, metalness: 0.3 }));
        base.castShadow = true; base.receiveShadow = true;
        base.position.y = 0.28;
        this.group.add(base); this._meshes.push(base);

        const pivot = new THREE.Object3D();
        pivot.position.y = 0.7;
        this.group.add(pivot);
        this._barrel = pivot;

        // Two side-by-side launcher tubes — light grey so missiles stand out
        for (const ox of [-0.22, 0.22]) {
          const tube = new THREE.Mesh(GEO.samMedLauncher, new THREE.MeshStandardMaterial({ color: 0xCCCCBB, roughness: 0.45, metalness: 0.55 }));
          tube.castShadow = true;
          tube.rotation.x = -Math.PI / 3.5;
          tube.position.set(ox, 0.2, -0.15);
          pivot.add(tube); this._meshes.push(tube);
        }
        break;
      }
      case 'samHeavy': {
        // Dark olive heavy launcher — three red-tipped tubes, clearly larger threat
        const base = new THREE.Mesh(GEO.samHeavyBase, new THREE.MeshStandardMaterial({ color: 0x4A5530, roughness: 0.65, metalness: 0.35 }));
        base.castShadow = true; base.receiveShadow = true;
        base.position.y = 0.33;
        this.group.add(base); this._meshes.push(base);

        const pivot = new THREE.Object3D();
        pivot.position.y = 0.82;
        this.group.add(pivot);
        this._barrel = pivot;

        // Three launcher tubes — light body, red nose caps
        for (let i = 0; i < 3; i++) {
          const tube = new THREE.Mesh(GEO.samHeavyLauncher, new THREE.MeshStandardMaterial({ color: 0xBBBBAA, roughness: 0.4, metalness: 0.6 }));
          tube.castShadow = true;
          tube.rotation.x = -Math.PI / 3.2;
          tube.position.set((i - 1) * 0.32, 0.18, -0.18);
          pivot.add(tube); this._meshes.push(tube);

          // Red nose cap on each tube
          const capGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.12, 8);
          const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0xDD2200, roughness: 0.4, metalness: 0.5, emissive: new THREE.Color(0x330000) }));
          cap.rotation.x = -Math.PI / 3.2;
          cap.position.set((i - 1) * 0.32, 0.52, -0.44);
          pivot.add(cap); this._meshes.push(cap);
        }
        break;
      }
      case 'rocketInfantry': {
        const body = new THREE.Mesh(GEO.rocketInfBody, makeMat(0.85, 0.0));
        body.castShadow = true; body.receiveShadow = true;
        body.position.y = 0.7;
        this.group.add(body); this._meshes.push(body);

        // Shoulder-mounted launch tube
        const tube = new THREE.Mesh(GEO.rocketInfTube, new THREE.MeshStandardMaterial({ color: 0x1A1A10, roughness: 0.5, metalness: 0.6 }));
        tube.castShadow = true;
        tube.rotation.z = THREE.MathUtils.degToRad(-55);
        tube.position.set(0.28, 1.15, 0);
        this.group.add(tube); this._meshes.push(tube);
        break;
      }
      case 'jammer': {
        const base = new THREE.Mesh(GEO.jammerBase, new THREE.MeshStandardMaterial({ color: 0x2A2A48, roughness: 0.6, metalness: 0.5 }));
        base.castShadow = true; base.receiveShadow = true;
        base.position.y = 0.25;
        this.group.add(base); this._meshes.push(base);

        const mast = new THREE.Mesh(GEO.jammerMast, new THREE.MeshStandardMaterial({ color: 0x242438, roughness: 0.45, metalness: 0.65 }));
        mast.position.y = 0.78;
        this.group.add(mast); this._meshes.push(mast);

        const dish = new THREE.Mesh(GEO.jammerDish, new THREE.MeshStandardMaterial({ color: 0x5555DD, roughness: 0.3, metalness: 0.8, emissive: new THREE.Color(0x1A1ACC) }));
        dish.position.y = 1.18;
        this.group.add(dish); this._meshes.push(dish);

        // Pulsing ring glow — stored for animation
        const ringGeo = new THREE.RingGeometry(0.35, 0.48, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x4466FF, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.1;
        this.group.add(ring);
        this._jammerRing = ring;
        this._jammerRingMat = ringMat;
        this._jammerPulse = 0;
        break;
      }
      case 'empMortar': {
        // Grey-blue base, cyan-glowing tube — electric/EMP identity is clear
        const base = new THREE.Mesh(GEO.empMortBase, new THREE.MeshStandardMaterial({ color: 0x6A6880, roughness: 0.6, metalness: 0.45 }));
        base.castShadow = true; base.receiveShadow = true;
        base.position.y = 0.23;
        this.group.add(base); this._meshes.push(base);

        const pivot = new THREE.Object3D();
        pivot.position.y = 0.6;
        this.group.add(pivot);
        this._barrel = pivot;

        const tube = new THREE.Mesh(GEO.empMortTube, new THREE.MeshStandardMaterial({ color: 0xAABBCC, roughness: 0.35, metalness: 0.75, emissive: new THREE.Color(0x003344) }));
        tube.castShadow = true;
        tube.rotation.x = -Math.PI / 4;
        tube.position.y = 0.35;
        pivot.add(tube); this._meshes.push(tube);

        // Cyan glow ring at base of tube
        const glowGeo = new THREE.TorusGeometry(0.14, 0.04, 6, 16);
        const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0x00DDFF }));
        glow.position.y = 0.25;
        pivot.add(glow); this._meshes.push(glow);
        break;
      }
      case 'titanTank': {
        const darkSteel = new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.45, metalness: 0.75 });
        const rust      = new THREE.MeshStandardMaterial({ color: 0x3A2010, roughness: 0.8,  metalness: 0.3 });
        const accentMat = new THREE.MeshStandardMaterial({ color: 0x880000, roughness: 0.4,  metalness: 0.7, emissive: new THREE.Color(0x330000) });

        // Hull
        const hull = new THREE.Mesh(GEO.titanHull, darkSteel.clone());
        hull.castShadow = true; hull.receiveShadow = true;
        hull.position.y = 0.6;
        this.group.add(hull); this._meshes.push(hull);

        // Tracks — two side rails
        for (const oz of [-0.82, 0.82]) {
          const track = new THREE.Mesh(GEO.titanTrack, rust.clone());
          track.castShadow = true;
          track.position.set(0, 0.22, oz);
          this.group.add(track); this._meshes.push(track);
        }

        // Turret
        const turret = new THREE.Mesh(GEO.titanTurret, darkSteel.clone());
        turret.castShadow = true;
        turret.position.set(0, 1.3, 0);
        this.group.add(turret); this._meshes.push(turret);
        this._turretMesh = turret;

        // Hatch on top of turret
        const hatch = new THREE.Mesh(GEO.titanHatch, accentMat.clone());
        hatch.position.set(0.2, 1.75, 0);
        this.group.add(hatch); this._meshes.push(hatch);

        // Barrel pivot — two double barrels side by side
        const pivot = new THREE.Object3D();
        pivot.position.set(0, 1.3, 0);
        this.group.add(pivot);
        this._barrel = pivot;
        this._turretMesh = turret;

        for (const ox of [-0.28, 0.28]) {
          const barrel = new THREE.Mesh(GEO.titanBarrel, darkSteel.clone());
          barrel.castShadow = true;
          barrel.rotation.x = Math.PI / 2;
          barrel.position.set(ox, 0, -1.1);
          pivot.add(barrel); this._meshes.push(barrel);
        }

        // Red engine glow strips on rear hull
        const glowMat = new THREE.MeshStandardMaterial({ color: 0xFF2200, roughness: 0.3, metalness: 0.5, emissive: new THREE.Color(0x660000) });
        const glowGeo = new THREE.BoxGeometry(0.12, 0.35, 1.6);
        for (const ox of [-1.45, 1.45]) {
          const glow = new THREE.Mesh(glowGeo, glowMat);
          glow.position.set(ox, 0.55, 0);
          this.group.add(glow); this._meshes.push(glow);
        }
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

    // Tank / TitanTank: detach turret and give it an arc velocity
    if (this._turretMesh) {
      const isTitan = this.type === 'titanTank';
      this._turretVel = new THREE.Vector3(
        (Math.random() - 0.5) * (isTitan ? 7 : 4),
        (isTitan ? 8 : 5) + Math.random() * 3,
        (Math.random() - 0.5) * (isTitan ? 7 : 4),
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

    // Jammer pulsing ring animation
    if (this._jammerRing) {
      this._jammerPulse = (this._jammerPulse + dt * 1.8) % (Math.PI * 2);
      this._jammerRingMat.opacity = 0.3 + 0.4 * Math.abs(Math.sin(this._jammerPulse));
      const s = 1.0 + 0.25 * Math.abs(Math.sin(this._jammerPulse * 0.5));
      this._jammerRing.scale.setScalar(s);
    }
  }

  canFire() {
    return this._cooldownTimer <= 0 && this.state !== 'dead' && this.state !== 'stunned';
  }

  resetCooldown() {
    this._cooldownTimer = this.cooldown;
  }
}
