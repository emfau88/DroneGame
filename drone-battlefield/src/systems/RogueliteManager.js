import { bus } from '../core/EventBus.js';
import { UPGRADES, UPGRADE_MAP } from '../data/upgrades.js';
import { META_UPGRADES, META_UPGRADE_MAP } from '../data/metaUpgrades.js';
import { MAP_TEMPLATES } from '../data/mapTemplates.js';

const STORAGE_KEY = 'drone_strike_meta';
const CHOICES_PER_UPGRADE = 3;

/**
 * RogueliteManager — manages run state, upgrade selection, and meta-progression.
 * Persists meta upgrades to localStorage between sessions.
 */
export class RogueliteManager {
  constructor() {
    this._bus = null;

    /** @type {{ currentMapIndex: number, activeUpgrades: string[], kills: number, mapsCleared: number, startTime: number }} */
    this.currentRun = null;

    /** Permanently owned meta upgrade IDs (persists across runs). */
    this.metaUpgrades = [];

    this._onUpgrade = null;
  }

  init(bus_) {
    this._bus = bus_;
    this.loadMetaProgress();
  }

  // ── Run lifecycle ─────────────────────────────────────────────────────────

  startRun() {
    this.currentRun = {
      currentMapIndex: 0,
      activeUpgrades: [],
      kills: 0,
      mapsCleared: 0,
      startTime: Date.now(),
    };

    // Apply meta upgrade effects that add to starting run upgrades
    if (this.metaUpgrades.includes('supply_lines')) {
      // Supply Lines: start with 1 bonus upgrade pick already applied
      // (handled in getUpgradeChoices — always show 1 extra round initially)
    }
  }

  setCurrentMap(index) {
    if (this.currentRun) this.currentRun.currentMapIndex = index;
  }

  recordKill() {
    if (this.currentRun) this.currentRun.kills++;
  }

  /**
   * Call when a map ends.
   * @param {boolean} survived
   */
  endMap(survived) {
    if (!this.currentRun) return;
    if (survived) {
      this.currentRun.mapsCleared++;
      this.currentRun.currentMapIndex++;
    }
  }

  /**
   * Select an upgrade and advance run state.
   * @param {string} upgradeId
   */
  selectUpgrade(upgradeId) {
    if (!this.currentRun) return;
    this.currentRun.activeUpgrades.push(upgradeId);
    bus.emit('upgrade:selected', { upgradeId });
  }

  /**
   * End the current run. Returns stats and any new meta upgrade unlocked.
   * @param {boolean} cleared - true if all 8 maps completed
   * @returns {{ stats: object, newMetaUpgrade: object|null }}
   */
  endRun(cleared) {
    const stats = this.currentRun ? { ...this.currentRun } : { kills: 0, mapsCleared: 0, startTime: Date.now() };
    const newMeta = this._unlockRandomMeta();
    this.saveMetaProgress();
    bus.emit('run:ended', { cleared, kills: stats.kills, maps: stats.mapsCleared });
    this.currentRun = null;
    return { stats, newMetaUpgrade: newMeta };
  }

  // ── Upgrade selection ─────────────────────────────────────────────────────

  /**
   * Get 3 upgrade choices for display. Weighted toward unowned upgrades.
   * @returns {import('../data/upgrades.js').Upgrade[]}
   */
  getUpgradeChoices() {
    const owned = new Set(this.currentRun?.activeUpgrades ?? []);
    const categories = ['OFFENSIVE', 'DEFENSIVE', 'UTILITY'];

    // Pick one from each category to ensure variety
    const chosen = [];
    const shuffledCategories = this._shuffle([...categories]);

    for (const cat of shuffledCategories) {
      const pool = UPGRADES.filter(u => u.category === cat);
      // Prefer upgrades player doesn't already have
      const unowned = pool.filter(u => !owned.has(u.id));
      const source = unowned.length > 0 ? unowned : pool;
      const pick = source[Math.floor(Math.random() * source.length)];
      if (pick) chosen.push(pick);
    }

    // Fill to exactly CHOICES_PER_UPGRADE if needed
    while (chosen.length < CHOICES_PER_UPGRADE) {
      const remaining = UPGRADES.filter(u => !chosen.includes(u));
      if (remaining.length === 0) break;
      chosen.push(remaining[Math.floor(Math.random() * remaining.length)]);
    }

    return chosen.slice(0, CHOICES_PER_UPGRADE);
  }

  /**
   * Apply all active run upgrades + meta upgrades to a drone.
   * Called on each map load so upgrades persist through maps.
   * @param {import('../entities/Drone.js').Drone} drone
   */
  applyAllUpgradesToDrone(drone) {
    // Reset modifiers first
    drone.damageMultiplier   = 1.0;
    drone.speedMultiplier    = 1.0;
    drone.cooldownMultiplier = 1.0;
    drone._upgrades = {};

    // Apply meta upgrades first (permanent)
    for (const id of this.metaUpgrades) {
      const meta = META_UPGRADE_MAP[id];
      if (meta?.apply) meta.apply(drone);
    }

    // Apply run upgrades
    for (const id of (this.currentRun?.activeUpgrades ?? [])) {
      const upgrade = UPGRADE_MAP[id];
      if (upgrade?.apply) upgrade.apply(drone);
    }

    // Quick Repair: restore 1 HP if below max
    if (drone._upgrades?.quickRepair && drone.hp < drone.maxHp) {
      drone.hp = Math.min(drone.hp + 1, drone.maxHp);
    }

    // Weapon Cache: reset cooldowns
    if (drone._upgrades?.weaponCache) {
      drone.primaryCooldown   = 0;
      drone.secondaryCooldown = 0;
    }
  }

  /**
   * Apply a single upgrade to the drone immediately.
   * @param {string} upgradeId
   * @param {import('../entities/Drone.js').Drone} drone
   */
  applyUpgradeToDrone(upgradeId, drone) {
    const upgrade = UPGRADE_MAP[upgradeId];
    if (upgrade?.apply) upgrade.apply(drone);
  }

  // ── Map templates ─────────────────────────────────────────────────────────

  /**
   * @param {number} index - 0-based
   * @returns {object|null}
   */
  getMapTemplate(index) {
    return MAP_TEMPLATES[index] ?? null;
  }

  // ── Meta-progression ──────────────────────────────────────────────────────

  _unlockRandomMeta() {
    const unowned = META_UPGRADES.filter(m => !this.metaUpgrades.includes(m.id));
    if (unowned.length === 0) return null;
    const pick = unowned[Math.floor(Math.random() * unowned.length)];
    this.metaUpgrades.push(pick.id);
    return pick;
  }

  saveMetaProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.metaUpgrades));
    } catch (_) { /* storage unavailable */ }
  }

  loadMetaProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.metaUpgrades = JSON.parse(raw);
    } catch (_) { this.metaUpgrades = []; }
  }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  destroy() {
    // No bus listeners to clean up currently
  }
}
