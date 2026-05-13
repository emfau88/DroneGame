/**
 * LevelLoader — loads level JSON, spawns units, configures weapons, builds world.
 * Depends on BattleSystem, WeaponSystem, World — but does NOT import them.
 * They are injected at load time.
 */
export class LevelLoader {
  /**
   * Fetch and parse a level JSON by ID.
   * @param {number} levelId
   * @returns {Promise<Object>}
   */
  async load(levelId) {
    const response = await fetch(`./src/levels/level${levelId}.json`);
    if (!response.ok) {
      throw new Error(`[LevelLoader] Failed to load level ${levelId}: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Spawn all units defined in the level config.
   * @param {Object} config - parsed level JSON
   * @param {import('../systems/BattleSystem.js').BattleSystem} battle
   */
  spawnUnits(config, battle) {
    for (const [team, entries] of Object.entries(config.units)) {
      for (const entry of entries) {
        const count = entry.count ?? 1;
        for (let i = 0; i < count; i++) {
          // Spread units slightly along the Z axis within the lane
          const zOffset = count > 1 ? (i / (count - 1) - 0.5) * 2.5 : 0;
          battle.spawnUnit({
            type: entry.type,
            team,
            lane: entry.lane,
            x:    entry.x,
            // Stagger x position slightly so they don't stack
            _x:   entry.x + (Math.random() - 0.5) * 1.2,
          });
          // Fix: actually set x to spread them, overriding the entry x slightly
          const last = battle.units[battle.units.length - 1];
          last.position.x = entry.x + (Math.random() - 0.5) * 1.5;
          last.position.z = entry.lane + zOffset;
        }
      }
    }
  }

  /**
   * Configure weapons for the level.
   * @param {Object} config
   * @param {import('../systems/WeaponSystem.js').WeaponSystem} weapons
   */
  setupWeapons(config, weapons) {
    weapons.setupFromLevel(config);
  }

  /**
   * Build the terrain/world for this level.
   * @param {Object} config
   * @param {import('../world/World.js').World} world
   */
  buildWorld(config, world) {
    world.build(config);
  }
}
