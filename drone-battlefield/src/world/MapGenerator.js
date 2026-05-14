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

    // Blue ally units — skip entirely if noBlueForce is set
    if (!template.noBlueForce) {
      const blueUnits = this._generateBlueUnits(template.blueForce);
      units.push(...blueUnits);
    }

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

    const soldierCount        = count('soldier');
    const rocketCount         = count('rocket');
    const tankCount           = count('tank');
    const flakCount           = count('flakGun');
    const commanderCount      = count('commander');
    const enemyDroneCount     = count('enemyDrone');
    const rocketInfantryCount = count('rocketInfantry');
    const samMediumCount      = count('samMedium');
    const samHeavyCount       = count('samHeavy');
    const jammerCount         = count('jammer');
    const empMortarCount      = count('empMortar');
    // Titan Tank only spawns in final wave
    const titanTankCount      = (waveNumber === totalWaves) ? count('titanTank') : 0;

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

    // Rocket infantry — scattered mid-depth, all lanes
    for (let i = 0; i < rocketInfantryCount; i++) {
      const lane = LANES[i % LANES.length];
      units.push({ type: 'rocketInfantry', team: 'red', lane, x: ENEMY_X_START + randRange(2, ENEMY_X_SPREAD) });
    }

    // Off-center lanes only — avoids overlapping HQ at Z=0 and spreads AA visually
    const AA_LANES = [-8, -4, 4, 8];

    // SAM Light (flakGun) — static, deep in enemy territory, max X=34 to stay clear of HQ
    for (let i = 0; i < flakCount; i++) {
      const lane = AA_LANES[i % AA_LANES.length];
      const x = ENEMY_X_START + 6 + randRange(0, 6); // 28–34
      const cfg = { type: 'flakGun', team: 'red', lane, x };
      if (template.tutorialMap) cfg.aaRangeOverride = 16;
      units.push(cfg);
    }

    // SAM Medium — slightly deeper than SAM Light
    for (let i = 0; i < samMediumCount; i++) {
      const lane = AA_LANES[i % AA_LANES.length];
      units.push({ type: 'samMedium', team: 'red', lane, x: ENEMY_X_START + 8 + randRange(0, 6) }); // 30–36
    }

    // SAM Heavy — deepest back line
    for (let i = 0; i < samHeavyCount; i++) {
      const lane = AA_LANES[i % AA_LANES.length];
      units.push({ type: 'samHeavy', team: 'red', lane, x: ENEMY_X_START + 10 + randRange(0, 6) }); // 32–38 — use flanks only
    }

    // Jammers — static, mid-field, staggered lanes
    for (let i = 0; i < jammerCount; i++) {
      const lane = AA_LANES[i % AA_LANES.length];
      units.push({ type: 'jammer', team: 'red', lane, x: ENEMY_X_START + 6 + randRange(0, 8) });
    }

    // EMP Mortars — back-line like SAMs
    for (let i = 0; i < empMortarCount; i++) {
      const lane = AA_LANES[i % AA_LANES.length];
      units.push({ type: 'empMortar', team: 'red', lane, x: ENEMY_X_START + 6 + randRange(0, 8) });
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

    // Titan Tank — single boss, center lane, deepest position
    for (let i = 0; i < titanTankCount; i++) {
      units.push({ type: 'titanTank', team: 'red', lane: 0, x: ENEMY_X_START + ENEMY_X_SPREAD + 4 });
    }

    return units;
  }
}
