import { randInt, randRange } from '../utils/math.js';

// Z-ranges for unit placement (lanes)
const LANES = [-8, -4, 0, 4, 8];
// Enemy units spawn on the right side (positive X)
const ENEMY_X_START = 22;
const ENEMY_X_SPREAD = 12;
// Ally units spawn on left side
const ALLY_X_START = -22;
const ALLY_X_SPREAD = 10;

/**
 * MapGenerator — generates a full MapConfig from a MapTemplate.
 * Randomizes unit counts and positions within template ranges.
 * Produces wave arrays for wave-based maps.
 */
export class MapGenerator {
  /**
   * @param {object} template - from MAP_TEMPLATES
   * @param {number} [seed] - optional seed (not implemented, uses Math.random)
   * @returns {MapConfig}
   */
  generate(template) {
    const units = [];
    const waves = [];

    // Blue ally units — use template blueForce if defined, else default
    const blueUnits = this._generateBlueUnits(template.blueForce);
    units.push(...blueUnits);

    // Red enemy units split across waves
    const totalWaves = template.waves || 1;
    for (let w = 1; w <= totalWaves; w++) {
      const waveUnits = this._generateRedWave(template, w, totalWaves);
      waves.push(waveUnits);
      units.push(...waveUnits);
    }

    return {
      templateId: template.id,
      setting: template.setting,
      objective: template.objective,
      units, // flat list (all units across all waves for reference)
      waves, // indexed wave arrays — wave[0] = wave 1 units
      lightingOverride: template.lightingOverride || null,
    };
  }

  _generateBlueUnits(blueForce) {
    const units = [];
    const bf = blueForce || {};

    const [tankMin, tankMax]     = bf.tank    || [2, 3];
    const [soldierMin, soldierMax] = bf.soldier || [8, 12];
    const [rocketMin, rocketMax]  = bf.rocket  || [1, 2];

    const tankCount    = randInt(tankMin, tankMax);
    const soldierCount = randInt(soldierMin, soldierMax);
    const rocketCount  = randInt(rocketMin, rocketMax);

    const tankLanes = [-8, 0, 8];
    for (let i = 0; i < tankCount; i++) {
      const lane = tankLanes[i % tankLanes.length];
      units.push({ type: 'tank', team: 'blue', lane, x: ALLY_X_START - randRange(0, 4) });
    }
    for (let i = 0; i < soldierCount; i++) {
      const lane = LANES[i % LANES.length];
      units.push({ type: 'soldier', team: 'blue', lane, x: ALLY_X_START - randRange(2, 8) });
    }
    for (let i = 0; i < rocketCount; i++) {
      const lane = LANES[1 + (i % 2) * 2];
      units.push({ type: 'rocket', team: 'blue', lane, x: ALLY_X_START - randRange(0, 4) });
    }
    return units;
  }

  _generateRedWave(template, waveNumber, totalWaves) {
    const units = [];
    const e = template.enemies;

    // Scale enemy count: early waves slightly lighter, final wave is exactly the template value
    const waveScale = 0.7 + (waveNumber / totalWaves) * 0.3;

    const count = (type) => {
      const [min, max] = e[type] || [0, 0];
      const base = randInt(min, max);
      return Math.ceil(base * waveScale);
    };

    const soldierCount    = count('soldier');
    const rocketCount     = count('rocket');
    const tankCount       = count('tank');
    const flakCount       = count('flakGun');
    const commanderCount  = count('commander');
    const enemyDroneCount = count('enemyDrone');

    // Spread soldiers across lanes
    for (let i = 0; i < soldierCount; i++) {
      const lane = LANES[i % LANES.length];
      units.push({ type: 'soldier', team: 'red', lane, x: ENEMY_X_START + randRange(0, ENEMY_X_SPREAD) });
    }

    // Rockets prefer flanks
    for (let i = 0; i < rocketCount; i++) {
      const lane = LANES[(i % 2 === 0) ? 1 : 3]; // lanes -4 and +4
      units.push({ type: 'rocket', team: 'red', lane, x: ENEMY_X_START + randRange(0, ENEMY_X_SPREAD) });
    }

    // Tanks in center lanes
    for (let i = 0; i < tankCount; i++) {
      const lane = LANES[i % 3]; // -8, -4, 0
      units.push({ type: 'tank', team: 'red', lane, x: ENEMY_X_START + randRange(0, ENEMY_X_SPREAD) });
    }

    // Flak guns — static, placed deep in enemy territory
    for (let i = 0; i < flakCount; i++) {
      const lane = LANES[randInt(0, LANES.length - 1)];
      const x = ENEMY_X_START + 8 + randRange(0, 8);
      const flakConfig = { type: 'flakGun', team: 'red', lane, x };
      // Tutorial map: slightly reduced range (still accounts for drone altitude of 12)
      if (template.tutorialMap) flakConfig.aaRangeOverride = 16;
      units.push(flakConfig);
    }

    // Commanders — deeper back, random lane
    for (let i = 0; i < commanderCount; i++) {
      const lane = LANES[randInt(0, LANES.length - 1)];
      units.push({ type: 'commander', team: 'red', lane, x: ENEMY_X_START + 10 + randRange(0, 5) });
    }

    // Enemy drones — spawn at drone altitude
    for (let i = 0; i < enemyDroneCount; i++) {
      const lane = LANES[randInt(0, LANES.length - 1)];
      units.push({ type: 'enemyDrone', team: 'red', lane, x: ENEMY_X_START + randRange(4, 16), y: 10 });
    }

    return units;
  }
}
