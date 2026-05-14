/** Fill the first empty secondary slot (1 then 2) with the given weapon type. */
function _fillFreeSlot(drone, type) {
  if (!drone.secondaryWeapon)  { drone.setSecondaryWeapon(type, 1); return; }
  if (!drone.secondaryWeapon2) { drone.setSecondaryWeapon(type, 2); }
}

/**
 * Run upgrade pool — 24 upgrades chosen between maps.
 * From DRONE_STRIKE_REBUILD.md §Roguelite System.
 *
 * Flag-based upgrades (drone._upgrades.X = true) are read by:
 *   Drone.update()       — killstreak, overcharge, evasiveManeuver, shieldDrone, blitzMode, supplyDrop
 *   WeaponSystem         — devastator, chainEMP, clusterPlus, armorPiercer
 *   Drone._findTarget()  — targetLock
 *   Game._onUnitDied()   — scavenger
 */
export const UPGRADES = [
  // OFFENSIVE
  { id: 'iron_rain',        name: 'Iron Rain',        category: 'OFFENSIVE', description: 'Cannon damage +25%',
    apply: (drone) => { drone.damageMultiplier *= 1.25; } },
  { id: 'rapid_fire',       name: 'Rapid Fire',       category: 'OFFENSIVE', description: 'Cannon cooldown -20%',
    apply: (drone) => { drone.cooldownMultiplier *= 0.80; } },
  { id: 'devastator',       name: 'Devastator',       category: 'OFFENSIVE', description: 'Unlock BOMB secondary. Bomb radius +2, damage +15',
    apply: (drone) => {
      drone._upgrades = drone._upgrades || {};
      drone._upgrades.devastator = true;
      _fillFreeSlot(drone, 'bomb');
    }
  },
  { id: 'chain_emp',        name: 'Chain EMP',        category: 'OFFENSIVE', description: 'Unlock EMP secondary. Pulses twice (second pulse 1s after first)',
    apply: (drone) => {
      drone._upgrades = drone._upgrades || {};
      drone._upgrades.chainEMP = true;
      _fillFreeSlot(drone, 'emp');
    }
  },
  { id: 'homing_missiles',  name: 'Homing Missiles',  category: 'OFFENSIVE', description: 'Unlock MISSILE secondary. Splash +2, +20% damage vs tanks',
    apply: (drone) => {
      drone._upgrades = drone._upgrades || {};
      drone._upgrades.homingMissiles = true;
      _fillFreeSlot(drone, 'missile');
    }
  },
  { id: 'cluster_plus',     name: 'Cluster Plus',     category: 'OFFENSIVE', description: 'Unlock CLUSTER secondary. Adds 2 extra submunitions (8 total)',
    apply: (drone) => {
      drone._upgrades = drone._upgrades || {};
      drone._upgrades.clusterPlus = true;
      _fillFreeSlot(drone, 'cluster');
    }
  },
  { id: 'armor_piercer',    name: 'Armor Piercer',    category: 'OFFENSIVE', description: 'Weapons deal +30% damage to tanks',
    apply: (drone) => { drone._upgrades = drone._upgrades || {}; drone._upgrades.armorPiercer = true; } },
  { id: 'killstreak',       name: 'Killstreak',       category: 'OFFENSIVE', description: 'After 5 kills: next weapon use does 2× damage',
    apply: (drone) => {
      drone._upgrades = drone._upgrades || {};
      drone._upgrades.killstreak = true;
      // Only reset counter if not already tracking (avoid double-apply resetting progress)
      if (drone._killstreakCount === undefined) drone._killstreakCount = 0;
      drone._killstreakReady = false;
    }
  },
  { id: 'overcharge',       name: 'Overcharge',       category: 'OFFENSIVE', description: 'Every 20s: next shot does 3× damage',
    apply: (drone) => {
      drone._upgrades = drone._upgrades || {};
      drone._upgrades.overcharge = true;
      // Reset timer only on first apply; subsequent applyAll calls preserve progress
      if (drone._overchargeTimer === undefined) drone._overchargeTimer = 20;
      drone._overchargeReady = false;
    }
  },

  // DEFENSIVE
  { id: 'composite_hull',   name: 'Composite Hull',   category: 'DEFENSIVE', description: '+1 max HP (max 6)',
    apply: (drone) => { drone.maxHp = Math.min(6, drone.maxHp + 1); } },
  { id: 'quick_repair',     name: 'Quick Repair',     category: 'DEFENSIVE', description: 'On map start: restore 1 HP if below max',
    apply: (drone) => { drone._upgrades = drone._upgrades || {}; drone._upgrades.quickRepair = true; } },
  { id: 'afterburner',      name: 'Afterburner',      category: 'DEFENSIVE', description: 'Speed +25%',
    apply: (drone) => { drone.speedMultiplier *= 1.25; } },
  { id: 'evasive_maneuver', name: 'Evasive Maneuver', category: 'DEFENSIVE', description: 'On hit: speed burst +80% for 0.5s',
    apply: (drone) => { drone._upgrades = drone._upgrades || {}; drone._upgrades.evasiveManeuver = true; } },
  { id: 'shield_drone',     name: 'Shield Drone',     category: 'DEFENSIVE', description: 'Blocks 1 hit every 15s automatically',
    apply: (drone) => {
      drone._upgrades = drone._upgrades || {};
      drone._upgrades.shieldDrone = true;
      if (drone._shieldDroneCooldown === undefined) drone._shieldDroneCooldown = 0;
    }
  },
  { id: 'ghost_protocol',   name: 'Ghost Protocol',   category: 'DEFENSIVE', description: 'Flak guns take 1.5s longer to lock on',
    apply: (drone) => { drone._upgrades = drone._upgrades || {}; drone._upgrades.ghostProtocol = true; } },

  // UTILITY
  { id: 'dual_weapons',     name: 'Dual Weapons',     category: 'UTILITY',   description: 'Unlock secondary weapon slot',
    apply: (drone) => { _fillFreeSlot(drone, 'bomb'); } },
  { id: 'weapon_cache',     name: 'Weapon Cache',     category: 'UTILITY',   description: 'Start each map with all cooldowns reset',
    apply: (drone) => { drone._upgrades = drone._upgrades || {}; drone._upgrades.weaponCache = true; } },
  { id: 'intel',            name: 'Intel',            category: 'UTILITY',   description: 'Flak gun lock-on time reduced by 30%',
    apply: (drone) => { drone._upgrades = drone._upgrades || {}; drone._upgrades.intel = true; } },
  { id: 'scavenger',        name: 'Scavenger',        category: 'UTILITY',   description: 'Killing a commander resets 1s off all cooldowns',
    apply: (drone) => { drone._upgrades = drone._upgrades || {}; drone._upgrades.scavenger = true; } },
  { id: 'overclock',        name: 'Overclock',        category: 'UTILITY',   description: 'All cooldowns -15%',
    apply: (drone) => { drone.cooldownMultiplier *= 0.85; } },
  { id: 'blitz_mode',       name: 'Blitz Mode',       category: 'UTILITY',   description: 'First 10s of each map: all cooldowns -50%',
    apply: (drone) => { drone._upgrades = drone._upgrades || {}; drone._upgrades.blitzMode = true; } },
  { id: 'supply_drop',      name: 'Supply Drop',      category: 'UTILITY',   description: 'Once per map: hold both fire buttons → restore 1 HP',
    apply: (drone) => {
      drone._upgrades = drone._upgrades || {};
      drone._upgrades.supplyDrop = true;
      drone._supplyDropUsed = false;
    }
  },
  { id: 'target_lock',      name: 'Target Lock',      category: 'UTILITY',   description: 'Missile range +8 units',
    apply: (drone) => { drone._upgrades = drone._upgrades || {}; drone._upgrades.targetLock = true; } },
];

export const UPGRADE_MAP = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
