import { bus } from '../core/EventBus.js';
import { UPGRADES, UPGRADE_MAP } from '../data/upgrades.js';
import { META_UPGRADES, META_UPGRADE_MAP } from '../data/metaUpgrades.js';
import { MAP_TEMPLATES } from '../data/mapTemplates.js';

const STORAGE_KEY      = 'drone_strike_meta';
const COIN_KEY         = 'drone_strike_coins';
const WORKSHOP_KEY     = 'drone_strike_workshop';
const DRONE_KEY        = 'drone_strike_drone';
const CHOICES_PER_UPGRADE = 3;

export const DRONE_MODELS = [
  {
    id:          'wasp',
    nameKey:     'drone.wasp.name',
    descKey:     'drone.wasp.desc',
    cost:        0,      // always free
    maxHp:       3,
    speedMult:   1.0,
    dualCannon:  false,
  },
  {
    id:          'hornet',
    nameKey:     'drone.hornet.name',
    descKey:     'drone.hornet.desc',
    cost:        120,
    maxHp:       6,
    speedMult:   0.90,   // -10% speed
    dualCannon:  false,
  },
  {
    id:          'reaper',
    nameKey:     'drone.reaper.name',
    descKey:     'drone.reaper.desc',
    cost:        200,
    maxHp:       2,
    speedMult:   1.15,   // +15% speed
    dualCannon:  true,   // fires 2 cannon shots simultaneously
  },
];
export const DRONE_MODEL_MAP = Object.fromEntries(DRONE_MODELS.map(d => [d.id, d]));

const COIN_PER_KILL = {
  soldier: 1, rocket: 2, tank: 3, commander: 5,
  flakGun: 3, enemyDrone: 2,
};

export const WORKSHOP_ITEMS = [
  { id: 'unlock_missile',  category: 'WEAPON',  cost: 20, nameKey: 'ws.missile.name',  descKey: 'ws.missile.desc'  },
  { id: 'unlock_bomb',     category: 'WEAPON',  cost: 20, nameKey: 'ws.bomb.name',     descKey: 'ws.bomb.desc'     },
  { id: 'unlock_emp',      category: 'WEAPON',  cost: 25, nameKey: 'ws.emp.name',      descKey: 'ws.emp.desc'      },
  { id: 'unlock_cluster',  category: 'WEAPON',  cost: 35, nameKey: 'ws.cluster.name',  descKey: 'ws.cluster.desc'  },
  { id: 'bonus_hp',        category: 'HULL',    cost: 30, nameKey: 'ws.bonusHp.name',  descKey: 'ws.bonusHp.desc'  },
  { id: 'bonus_cooldown',  category: 'SYSTEMS', cost: 25, nameKey: 'ws.cooldown.name', descKey: 'ws.cooldown.desc' },
  { id: 'coin_boost',      category: 'SYSTEMS', cost: 15, nameKey: 'ws.coinBoost.name',descKey: 'ws.coinBoost.desc'},
];

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

    /** Coins accumulated across all runs. */
    this.coins = 0;

    /** Workshop: permanently unlocked weapon/bonus IDs. */
    this.workshopUnlocks = [];

    /** Loadout: chosen secondary weapon IDs for next run (slot1/slot2 format). */
    this.loadout = { droneType: 'wasp', slot1: null, slot2: null };

    /** Selected drone model id for next run. */
    this.selectedDrone = 'wasp';

    this._onUpgrade = null;
  }

  init(bus_) {
    this._bus = bus_;
    this.loadMetaProgress();
    this.loadCoins();
    this.loadWorkshop();
    this.loadDroneSelection();
    this._loadLoadout();
  }

  /** Award coins for a kill. Returns coins earned (includes coin_boost multiplier). */
  awardCoins(unitType) {
    const base   = COIN_PER_KILL[unitType] ?? 1;
    const boost  = this.workshopUnlocks.includes('coin_boost') ? 1.5 : 1;
    const earned = Math.round(base * boost);
    this.coins += earned;
    this.saveCoins();
    bus.emit('coins:changed', { coins: this.coins, earned });
    return earned;
  }

  spendCoins(amount) {
    if (this.coins < amount) return false;
    this.coins -= amount;
    this.saveCoins();
    bus.emit('coins:changed', { coins: this.coins, earned: 0 });
    return true;
  }

  /** Unlock a workshop item. Returns false if already owned or not enough coins. */
  workshopBuy(itemId) {
    const item = WORKSHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return false;
    if (this.workshopUnlocks.includes(itemId)) return false;
    if (!this.spendCoins(item.cost)) return false;
    this.workshopUnlocks.push(itemId);
    this.saveWorkshop();
    bus.emit('workshop:unlocked', { itemId });
    return true;
  }

  isWorkshopUnlocked(itemId) {
    return this.workshopUnlocks.includes(itemId);
  }

  setLoadout(secondaries) {
    this.loadout = {
      droneType: this.selectedDrone,
      slot1: secondaries[0] || null,
      slot2: secondaries[1] || null,
    };
    this._saveLoadout();
  }

  setDrone(droneId) {
    if (DRONE_MODEL_MAP[droneId]) {
      this.selectedDrone = droneId;
      this.saveDroneSelection();
    }
  }

  isDroneUnlocked(droneId) {
    if (droneId === 'wasp') return true;
    return this.workshopUnlocks.includes('drone_' + droneId);
  }

  droneBuy(droneId) {
    const model = DRONE_MODEL_MAP[droneId];
    if (!model || droneId === 'wasp') return false;
    const wsId = 'drone_' + droneId;
    if (this.workshopUnlocks.includes(wsId)) return false;
    if (!this.spendCoins(model.cost)) return false;
    this.workshopUnlocks.push(wsId);
    this.saveWorkshop();
    bus.emit('workshop:unlocked', { itemId: wsId });
    return true;
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

    // Gate weapon upgrades: only show them if the workshop item is owned
    const WEAPON_GATE = {
      devastator:       'unlock_bomb',
      chain_emp:        'unlock_emp',
      homing_missiles:  'unlock_missile',
      cluster_plus:     'unlock_cluster',
    };

    const available = UPGRADES.filter(u => {
      const gate = WEAPON_GATE[u.id];
      if (gate === undefined) return true;
      return this.workshopUnlocks.includes(gate);
    });

    // Pick one from each category to ensure variety
    const chosen = [];
    const shuffledCategories = this._shuffle([...categories]);

    for (const cat of shuffledCategories) {
      const pool = available.filter(u => u.category === cat);
      // Prefer upgrades player doesn't already have
      const unowned = pool.filter(u => !owned.has(u.id));
      const source = unowned.length > 0 ? unowned : pool;
      if (source.length === 0) continue;
      const pick = source[Math.floor(Math.random() * source.length)];
      if (pick) chosen.push(pick);
    }

    // Fill to exactly CHOICES_PER_UPGRADE if needed
    while (chosen.length < CHOICES_PER_UPGRADE) {
      const remaining = available.filter(u => !chosen.includes(u));
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
    drone.primaryCooldownMultiplier   = 1.0;
    drone.secondaryCooldownMultiplier = 1.0;
    drone._upgrades = {};

    // Apply selected drone model base stats
    const model = DRONE_MODEL_MAP[this.selectedDrone] ?? DRONE_MODEL_MAP['wasp'];
    drone.maxHp         = model.maxHp;
    drone.hp            = model.maxHp;
    drone.speedMultiplier *= model.speedMult;
    drone.dualCannon    = model.dualCannon;
    drone.droneModelId  = model.id;

    // Apply workshop permanent bonuses
    if (this.workshopUnlocks.includes('bonus_hp')) {
      drone.maxHp = Math.min(drone.maxHp + 1, 6);
      drone.hp    = Math.min(drone.hp + 1, drone.maxHp);
    }
    if (this.workshopUnlocks.includes('bonus_cooldown')) {
      drone.cooldownMultiplier *= 0.90; // -10%
    }

    // Apply meta upgrades (permanent cross-run)
    for (const id of this.metaUpgrades) {
      const meta = META_UPGRADE_MAP[id];
      if (meta?.apply) meta.apply(drone);
    }

    // Apply run upgrades
    drone.clearSecondaryWeapons();
    for (const id of (this.currentRun?.activeUpgrades ?? [])) {
      const upgrade = UPGRADE_MAP[id];
      if (upgrade?.apply) upgrade.apply(drone);
    }

    // Apply loadout weapons
    const slot1 = Array.isArray(this.loadout) ? this.loadout[0] : this.loadout?.slot1;
    const slot2 = Array.isArray(this.loadout) ? this.loadout[1] : this.loadout?.slot2;
    if (slot1) drone.setSecondaryWeapon(slot1, 1);
    if (slot2) drone.setSecondaryWeapon(slot2, 2);

    // Quick Repair: restore 1 HP if below max
    if (drone._upgrades?.quickRepair && drone.hp < drone.maxHp) {
      drone.hp = Math.min(drone.hp + 1, drone.maxHp);
    }

    // Weapon Cache: reset cooldowns
    if (drone._upgrades?.weaponCache) {
      drone.primaryCooldown    = 0;
      drone.secondaryCooldown  = 0;
      drone.secondaryCooldown2 = 0;
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.metaUpgrades)); } catch (_) {}
  }
  loadMetaProgress() {
    try { const r = localStorage.getItem(STORAGE_KEY); if (r) this.metaUpgrades = JSON.parse(r); }
    catch (_) { this.metaUpgrades = []; }
  }

  saveCoins() {
    try { localStorage.setItem(COIN_KEY, String(this.coins)); } catch (_) {}
  }
  loadCoins() {
    try { this.coins = parseInt(localStorage.getItem(COIN_KEY) ?? '0', 10) || 0; } catch (_) {}
  }

  saveWorkshop() {
    try { localStorage.setItem(WORKSHOP_KEY, JSON.stringify(this.workshopUnlocks)); } catch (_) {}
  }
  loadWorkshop() {
    try { const r = localStorage.getItem(WORKSHOP_KEY); if (r) this.workshopUnlocks = JSON.parse(r); }
    catch (_) { this.workshopUnlocks = []; }
  }

  saveDroneSelection() {
    try { localStorage.setItem(DRONE_KEY, this.selectedDrone); } catch (_) {}
  }
  loadDroneSelection() {
    try { this.selectedDrone = localStorage.getItem(DRONE_KEY) || 'wasp'; } catch (_) {}
    if (!DRONE_MODEL_MAP[this.selectedDrone]) this.selectedDrone = 'wasp';
  }

  _saveLoadout() {
    try { localStorage.setItem('drone_strike_loadout', JSON.stringify(this.loadout)); } catch (_) {}
  }
  _loadLoadout() {
    try {
      const raw = localStorage.getItem('drone_strike_loadout');
      if (raw) {
        const data = JSON.parse(raw);
        this.loadout = { droneType: data.droneType || 'wasp', slot1: data.slot1 || null, slot2: data.slot2 || null };
        // Also restore selectedDrone from loadout
        if (DRONE_MODEL_MAP[this.loadout.droneType]) {
          this.selectedDrone = this.loadout.droneType;
        }
      }
    } catch (_) {}
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
