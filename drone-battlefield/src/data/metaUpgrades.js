/**
 * Meta-upgrade pool — 12 permanent upgrades that persist between runs.
 * Unlocked one per run (win or lose). From DRONE_STRIKE_REBUILD.md §Meta-Progression.
 */
export const META_UPGRADES = [
  { id: 'veteran_drone',    name: 'Veteran Drone',    description: 'All runs start with +1 HP',
    apply: (drone) => { drone.maxHp += 1; drone.hp = Math.min(drone.hp + 1, drone.maxHp); } },
  { id: 'combat_training',  name: 'Combat Training',  description: 'Cannon damage permanently +10%',
    apply: (drone) => { drone.damageMultiplier *= 1.10; } },
  { id: 'reinforced_hull',  name: 'Reinforced Hull',  description: 'First hit of every run: no damage (once per run)',
    apply: (drone) => { drone._upgrades = drone._upgrades || {}; drone._upgrades.reinforcedHull = true; drone._reinforcedHullActive = true; } },
  { id: 'supply_lines',     name: 'Supply Lines',     description: 'Start each run with 1 extra upgrade pick (from 2)',
    apply: () => { /* handled in RogueliteManager */ } },
  { id: 'emp_mastery',      name: 'EMP Mastery',      description: 'EMP always available from map 1',
    apply: () => { /* handled in RogueliteManager */ } },
  { id: 'bomb_training',    name: 'Bomb Training',    description: 'Bomb always available from map 1',
    apply: () => { /* handled in RogueliteManager */ } },
  { id: 'tactician',        name: 'Tactician',        description: 'See enemy count on map select screen',
    apply: () => { /* display only */ } },
  { id: 'survivor',         name: 'Survivor',         description: 'On death: 20% chance to survive with 1 HP (once per run)',
    apply: (drone) => { drone._upgrades = drone._upgrades || {}; drone._upgrades.survivor = true; } },
  { id: 'speed_demon',      name: 'Speed Demon',      description: 'Base speed +15% permanently',
    apply: (drone) => { drone.speedMultiplier *= 1.15; } },
  { id: 'quick_learner',    name: 'Quick Learner',    description: 'After first death: upgrades offer 4 choices instead of 3',
    apply: () => { /* handled in RogueliteManager */ } },
  { id: 'iron_will',        name: 'Iron Will',        description: 'Maps 1-3 difficulty slightly reduced',
    apply: () => { /* handled in MapGenerator */ } },
  { id: 'elite_pilot',      name: 'Elite Pilot',      description: 'Invincibility after hit extended to 2.0s',
    apply: (drone) => { /* drone reads this from upgrades */ drone._upgrades = drone._upgrades || {}; drone._upgrades.elitePilot = true; } },
];

export const META_UPGRADE_MAP = Object.fromEntries(META_UPGRADES.map(u => [u.id, u]));
