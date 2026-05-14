import { bus }          from './EventBus.js';
import { StateMachine } from './StateMachine.js';
import { Renderer }     from './Renderer.js';
import { InputManager } from './InputManager.js';

import { World }           from '../world/World.js';
import { MapGenerator }    from '../world/MapGenerator.js';

import { Drone }           from '../entities/Drone.js';

import { BattleSystem }    from '../systems/BattleSystem.js';
import { WeaponSystem }    from '../systems/WeaponSystem.js';
import { EffectSystem }    from '../systems/EffectSystem.js';
import { AudioSystem }     from '../systems/AudioSystem.js';
import { RogueliteManager }  from '../systems/RogueliteManager.js';
import { ObjectiveSystem }   from '../systems/ObjectiveSystem.js';

import { HUD }             from '../ui/HUD.js';
import { MenuManager }     from '../ui/MenuManager.js';
import { StartScreenFX }   from '../ui/StartScreenFX.js';
import { WorkshopScreen }  from '../ui/WorkshopScreen.js';
import { LoadoutScreen }   from '../ui/LoadoutScreen.js';
import { t }               from './i18n.js';

const DT_CAP = 0.033;

// Wave spawning threshold — new wave when this fraction of enemies killed
const WAVE_TRIGGER_PERCENT = 0.70;

/**
 * Game — central orchestrator. Owns the game loop.
 * NO Three.js scene logic, NO unit AI, NO damage calculation.
 */
export class Game {
  constructor() {
    this.state    = null;
    this.renderer = null;
    this.input    = null;
    this.world    = null;
    this.battle   = null;
    this.weapons  = null;
    this.effects  = null;
    this.audio    = null;
    this.roguelite = null;
    this.hud      = null;
    this.menus    = null;
    this.workshop = null;
    this.loadout  = null;

    this._mapGen = null;
    this._drone  = null;

    this._currentMapConfig = null;
    this._currentTemplate  = null;

    // Wave tracking
    this._waveNumber     = 1;
    this._totalWaves     = 1;
    this._waveEnemyStart = 0; // enemy count at wave start
    this._waveComplete   = false;

    // Objective system
    this._objectiveSystem = new ObjectiveSystem();

    // Kill counter
    this._killCount = 0;

    this._lastTime     = 0;
    this._rafId        = null;
    this._running      = false;
    this._mapEnded     = false;
    this._runJustEnded = false;
    this._workshopOnDone = null;
    this._loadoutOnDone  = null;

    // Bound listeners
    this._onNewRun    = null;
    this._onMainMenu  = null;
    this._onDroneDead = null;
    this._onUnitDied  = null;
    this._onUpgradeSelected = null;
    this._onFlakNearMiss    = null;
  }

  async init() {
    const container = document.getElementById('canvas-container');

    this.state = new StateMachine();

    this.renderer = new Renderer();
    this.renderer.init(container);

    this.audio = new AudioSystem();
    this.audio.init();

    this.input = new InputManager();
    this.input.init();

    this.world = new World();
    this.world.init(this.renderer.scene);

    this.battle = new BattleSystem();
    this.battle.init(this.renderer.scene);

    this.weapons = new WeaponSystem();
    this.weapons.init(bus, this.renderer.scene);

    this.effects = new EffectSystem();
    this.effects.init(this.renderer.scene);

    this.hud = new HUD();
    this.hud.init(bus);

    this.menus = new MenuManager();
    this.menus.init(this.state);

    this.startFX = new StartScreenFX();
    this.startFX.init();

    this.workshop = new WorkshopScreen();
    this.loadout  = new LoadoutScreen();

    // Apply i18n to all data-i18n elements on language change
    const applyI18n = () => {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = t(key);
        if (val && val !== key) el.textContent = val;
      });
    };
    applyI18n();
    document.addEventListener('langChanged', applyI18n);

    this.roguelite = new RogueliteManager();
    this.roguelite.init(bus);

    this.workshop.init(this.roguelite);
    this.loadout.init(this.roguelite);

    this._mapGen = new MapGenerator();

    // Bus listeners — "New Run" from start menu goes direct; after a run shows workshop first
    this._onNewRun = () => {
      if (this._runJustEnded) {
        this._runJustEnded = false;
        this._openWorkshop(() => this._openLoadout(() => this._startNewRun()));
      } else {
        this._startNewRun();
      }
    };
    this._onMainMenu = () => {
      this.state.transition('MENU');
      this.hud.hide();
      this.workshop.hide();
      this.loadout.hide();
      this.menus.hideAll();
      this.menus.showStart();
    };
    this._onDroneDead = () => this._onDroneKilled();
    this._onUnitDied = ({ unit }) => {
      if (unit.team === 'red') {
        this._killCount++;
        this.roguelite.recordKill();
        this.roguelite.awardCoins(unit.type);
        this.hud.setCoins(this.roguelite.coins);
        if (this._drone && this._drone.alive) {
          this._drone.onEnemyKill(unit.type);
        }
      }
    };
    this._onUpgradeSelected  = ({ upgradeId }) => this._applyUpgradeAndContinue(upgradeId);
    this._onUpgradeReroll    = () => this._handleUpgradeReroll();
    this._onWorkshopContinue = () => {
      this.workshop.hide();
      const onDone = this._workshopOnDone;
      this._workshopOnDone = null;
      if (onDone) onDone();
    };
    this._onLoadoutConfirmed = () => {
      this.loadout.hide();
      const onDone = this._loadoutOnDone;
      this._loadoutOnDone = null;
      if (onDone) onDone();
    };

    this._onWeaponImpactShake = ({ type }) => {
      const t = (type || '').toLowerCase();
      if (t === 'bomb')    this.renderer.shake(8, 0.35);
      if (t === 'missile') this.renderer.shake(4, 0.25);
      if (t === 'emp')     this.renderer.shake(2, 0.2);
      if (t === 'cluster') this.renderer.shake(3, 0.2);
    };
    this._onFlakNearMiss = ({ distance }) => {
      this.hud.showNearMiss();
      this.renderer.shake(1.5, 0.15);
      this.audio.playNearMiss();
    };
    this._onBattleDroneHit = () => {
      this.renderer.shake(6, 0.25);
      this.audio.playDroneHit();
    };

    this._onOpenWorkshop = () => {
      this._runJustEnded = false; // already in workshop flow
      this._openWorkshop(() => this._openLoadout(() => this._startNewRun()));
    };

    bus.on('menu:newRun',          this._onNewRun);
    bus.on('menu:mainMenu',        this._onMainMenu);
    bus.on('menu:workshop',        this._onOpenWorkshop);
    bus.on('drone:dead',           this._onDroneDead);
    bus.on('unit:died',            this._onUnitDied);
    bus.on('upgrade:cardSelected', this._onUpgradeSelected);
    bus.on('upgrade:reroll',       this._onUpgradeReroll);
    bus.on('flak:nearMiss',        this._onFlakNearMiss);
    bus.on('weapon:impact',        this._onWeaponImpactShake);
    bus.on('battle:droneHit',      this._onBattleDroneHit);
    bus.on('drone:hit', () => { this.renderer.shake(0.18, 0.20); });
    bus.on('workshop:continue',    this._onWorkshopContinue);
    bus.on('loadout:confirmed',    this._onLoadoutConfirmed);

    document.addEventListener('pointerdown', () => this.audio.resume(), { once: true });

    this.state.transition('MENU');
    this.menus.showStart();

    return this;
  }

  start() {
    this._running  = true;
    this._lastTime = performance.now();
    this._rafId    = requestAnimationFrame((t) => this._loop(t));
  }

  // ── Run management ────────────────────────────────────────────────────────

  /** Show workshop after run ends. onDone called when player clicks Continue → Loadout → run. */
  _openWorkshop(onDone) {
    this._workshopOnDone = onDone;
    this.menus.hideAll();
    this.hud.hide();
    this.hud.setCoins(this.roguelite.coins);
    this.workshop.show();
  }

  _openLoadout(onDone) {
    this._loadoutOnDone = onDone;
    this.loadout.show();
  }

  _startNewRun() {
    // Cancel any pending map-end or wave-spawn callbacks from a previous run
    this._mapEndCallback    = null;
    this._waveSpawnCallback = null;
    this._mapEnded          = false;
    this._cleanupMapListeners();

    this.menus.hideAll();
    this.roguelite.startRun();
    this._killCount = 0;

    // Map 1 starts immediately — no upgrade select before first map
    this._loadMap(0);
  }

  _showUpgradeSelectForMap(mapIndex, onDone) {
    const upgrades = this.roguelite.getUpgradeChoices();
    if (!upgrades || upgrades.length === 0) {
      onDone();
      return;
    }

    const template = this._getTemplate(mapIndex);
    const label = template ? `Map ${mapIndex + 1}: ${template.name} — Choose Upgrade` : 'Choose Upgrade';

    // Ensure we reach UPGRADE_SELECT regardless of current state
    if (this.state.is('MENU') || this.state.is('RUN_OVER') || this.state.is('RUN_WIN') || this.state.is('ENDED')) {
      this.state.transition('PLAYING');
    }
    if (this.state.is('PLAYING')) {
      this.state.transition('UPGRADE_SELECT');
    }

    this._pendingAfterUpgrade = onDone;
    const ownedIds = this.roguelite.currentRun?.activeUpgrades ?? [];
    this.menus.showUpgradeSelect(label, upgrades, ownedIds);
    this.hud.hide();
  }

  _applyUpgradeAndContinue(upgradeId) {
    this.roguelite.selectUpgrade(upgradeId);
    if (this._drone) {
      this.roguelite.applyUpgradeToDrone(upgradeId, this._drone);
    }

    const onDone = this._pendingAfterUpgrade;
    this._pendingAfterUpgrade = null;
    this.menus.hideAll();

    if (onDone) onDone();
  }

  _handleUpgradeReroll() {
    const newChoices = this.roguelite.getUpgradeChoices();
    const ownedIds   = this.roguelite.currentRun?.activeUpgrades ?? [];
    this.menus.rerollCards(newChoices, ownedIds);
  }

  _getTemplate(mapIndex) {
    return this.roguelite.getMapTemplate(mapIndex);
  }

  async _loadMap(mapIndex) {
    try {
      const template = this._getTemplate(mapIndex);
      if (!template) {
        // All 8 maps cleared!
        this._onRunWin();
        return;
      }

      this._mapEnded   = false;
      this._waveNumber = 1;
      this._totalWaves = template.waves || 1;
      this._waveComplete = false;
      this._killCount  = 0;

      // Clean up previous
      this.battle.clearAll();
      this.effects.clearAll();
      this.weapons.clearPending();
      this.world.dispose();
      if (this._drone) { this._drone.destroy(); this._drone = null; }

      // Generate map config from template
      this._currentTemplate  = template;
      this._currentMapConfig = this._mapGen.generate(template);

      // Build world
      this.world.build(template.setting, this.renderer.scene);

      // Spawn wave 1 units
      this._spawnWave(this._currentMapConfig, 1);

      // Create drone with roguelite upgrades applied
      this._drone = new Drone(this.renderer.scene);
      this.roguelite.applyAllUpgradesToDrone(this._drone);
      this._drone.startMap(); // activate blitz timer, reset supply drop

      // Update weapon system with current unit list
      this.weapons.setUnits(this.battle.units);

      // Init objective
      this._objectiveSystem.init(template.objective, this.renderer.scene);

      // Listen for weapon impacts to damage HQ
      this._onWeaponImpactForObj = (data) => {
        if (data.type === 'bomb' || data.type === 'missile' || data.type === 'cluster') {
          const r = data.type === 'bomb' ? 5.2 : data.type === 'missile' ? 3 : 10;
          this._objectiveSystem.applyWeaponToHQ(data.position, r, data.type === 'bomb' ? 55 : data.type === 'missile' ? 38 : 22);
        }
      };
      bus.on('weapon:impact', this._onWeaponImpactForObj);

      // HUD setup
      this.hud.setMaxHP(this._drone.maxHp);
      this.hud.setHP(this._drone.hp);
      this.hud.setMapInfo(
        `${mapIndex + 1}. ${template.name}`,
        this._getObjectiveText(template.objective),
      );
      this.hud.show();
      this.hud.resetForMap();

      // Briefing text from template — shown line by line with stagger, then objective
      if (template.briefing?.length) {
        this.hud.showBriefing(template.briefing);
      } else {
        this.hud.showCenterText(this._getObjectiveText(template.objective), 2.5);
      }

      // Tutorial: flak tooltip on map 1 (one-time, localStorage-gated)
      if (template.tutorialMap) this.hud.startFlakTooltip();

      // Camera
      this.renderer.setCameraTarget(this._drone.position);
      this.renderer.startCinematicIntro?.();

      // Ensure PLAYING state
      if (!this.state.is('PLAYING')) {
        this.state.transition('PLAYING');
      }

      this.audio.startWind();
      this.roguelite.setCurrentMap(mapIndex);

      // Wave 1 intro text
      if (this._totalWaves > 1) {
        this.hud.showCenterText(`${t('center.wave').toUpperCase()} 1`, 1.5);
      }

    } catch (err) {
      console.error('[Game] _loadMap error:', err);
    }
  }

  _spawnWave(mapConfig, waveNumber) {
    const waveUnits = mapConfig.waves?.[waveNumber - 1] ?? mapConfig.units ?? [];
    for (const unitConfig of waveUnits) {
      this.battle.spawnUnit(unitConfig);
    }
    this._waveEnemyStart = this.battle.units.filter(u => u.team === 'red' && u.alive).length;
    this.weapons.setUnits(this.battle.units);
  }

  _getObjectiveText(type) {
    const labels = {
      destroy_hq:    t('obj.destroyHq').toUpperCase(),
      hold_zone:     t('obj.holdZone').toUpperCase(),
      escort_convoy: t('obj.escortConvoy').toUpperCase(),
    };
    return labels[type] || type.toUpperCase();
  }

  // ── Wave system ───────────────────────────────────────────────────────────

  _checkWaveProgress() {
    if (this._waveComplete) return;
    const redAlive = this.battle.units.filter(u => u.team === 'red' && u.alive && u.state !== 'dead').length;
    const killed   = this._waveEnemyStart - redAlive;
    const fraction = this._waveEnemyStart > 0 ? killed / this._waveEnemyStart : 1;

    if (fraction >= WAVE_TRIGGER_PERCENT) {
      this._waveComplete = true;
      if (this._waveNumber < this._totalWaves) {
        this._startNextWave();
      }
    }
  }

  _startNextWave() {
    this._waveNumber++;
    this._waveComplete = false;

    this.hud.showCenterText(`WAVE ${this._waveNumber} INCOMING`, 3.0);

    // 3 second delay then spawn
    let timer = 0;
    const waiter = (dt) => {
      timer += dt;
      if (timer >= 3.0) {
        this._spawnWave(this._currentMapConfig, this._waveNumber);
        this._waveSpawnCallback = null;
      }
    };
    this._waveSpawnCallback = waiter;
  }

  // ── Map end ───────────────────────────────────────────────────────────────

  _checkMapComplete() {
    if (this._mapEnded) return;

    // Win: no red units alive
    const redAlive = this.battle.units.some(u => u.team === 'red' && u.alive && u.state !== 'dead');
    if (!redAlive && this._waveNumber >= this._totalWaves && this._waveComplete) {
      this._onMapCleared();
    }
  }

  _cleanupMapListeners() {
    if (this._onWeaponImpactForObj) {
      bus.off('weapon:impact', this._onWeaponImpactForObj);
      this._onWeaponImpactForObj = null;
    }
  }

  _onMapCleared() {
    if (this._mapEnded) return;
    this._mapEnded = true;
    this._cleanupMapListeners();

    this.hud.showCenterText(t('center.mapCleared').toUpperCase(), 1.5);
    this.roguelite.endMap(true);
    bus.emit('map:complete', { mapId: this._currentTemplate?.id, survived: true });

    // After 1.5s show upgrade screen then next map
    let timer = 0;
    this._mapEndCallback = (dt) => {
      timer += dt;
      if (timer >= 1.5) {
        this._mapEndCallback = null;
        const nextIndex = this.roguelite.currentRun.currentMapIndex;
        this._showUpgradeSelectForMap(nextIndex, () => this._loadMap(nextIndex));
      }
    };
  }

  _onDroneKilled() {
    if (this._mapEnded) return;
    this._mapEnded = true;
    this._cleanupMapListeners();

    this.roguelite.endMap(false);
    this.audio.stopWind();

    // Wait for death animation (0.8s) then show run over screen
    let timer = 0;
    this._mapEndCallback = (dt) => {
      timer += dt;
      if (timer >= 1.0) {
        this._mapEndCallback = null;
        this._onRunOver();
      }
    };
  }

  _onRunOver() {
    this.hud.hide();
    this._runJustEnded = true;
    const result = this.roguelite.endRun(false);
    const stats  = result.stats;
    const meta   = result.newMetaUpgrade;

    if (this.state.is('PLAYING')) this.state.transition('RUN_OVER');
    this.menus.showRunOver(stats, meta);
  }

  _onRunWin() {
    this.hud.hide();
    this._runJustEnded = true;
    const result = this.roguelite.endRun(true);
    const stats  = result.stats;
    const meta   = result.newMetaUpgrade;

    if (this.state.is('PLAYING')) this.state.transition('RUN_WIN');
    this.menus.showRunWin(stats, meta);
  }

  // ── Game loop ─────────────────────────────────────────────────────────────

  _loop(timestamp) {
    if (!this._running) return;
    this._rafId = requestAnimationFrame((t) => this._loop(t));

    const dt = Math.min(DT_CAP, (timestamp - this._lastTime) / 1000);
    this._lastTime = timestamp;

    const isPlaying = this.state.is('PLAYING');
    if (isPlaying) this._update(dt);
    this._render();
  }

  _update(dt) {
    const input = this.input.getState();

    // Drone movement + auto-fire
    if (this._drone && this._drone.alive) {
      this._drone.update(dt, input, this.battle.units);
      this.renderer.setCameraTarget(this._drone.position, this._drone.velocity);
      this.hud.setDronePosition(this._drone.position);
      this.weapons.setUnits(this.battle.units);

      // Update HUD weapon cooldowns
      const pw  = this._drone.primaryWeapon;
      const sw  = this._drone.secondaryWeapon;
      const sw2 = this._drone.secondaryWeapon2;
      this.hud.updatePrimary(
        pw ? pw.type : 'none',
        this._drone.primaryCooldown,
        pw ? pw.cooldownDuration * this._drone.cooldownMultiplier : 1,
      );
      this.hud.updateSecondary(
        sw ? sw.type : null,
        this._drone.secondaryCooldown,
        sw ? sw.cooldownDuration * this._drone.cooldownMultiplier : 1,
      );
      this.hud.updateSecondary2(
        sw2 ? sw2.type : null,
        this._drone.secondaryCooldown2,
        sw2 ? sw2.cooldownDuration * this._drone.cooldownMultiplier : 1,
      );
    }

    // Delayed callbacks (map end, wave spawn)
    if (this._mapEndCallback)   this._mapEndCallback(dt);
    if (this._waveSpawnCallback) this._waveSpawnCallback(dt);

    // Battle AI (also runs anti-air internally after Step 2)
    if (this._drone) {
      this.battle.update(dt, this._drone);
    } else {
      this.battle.update(dt, null);
    }

    // Wave progress check
    this._checkWaveProgress();

    // Sync convoy position to battle system so red units pathfind toward it
    if (this._objectiveSystem.type === 'escort_convoy') {
      const convoyPos = this._objectiveSystem.getConvoyPosition();
      this.battle.setConvoyX(convoyPos ? convoyPos.x : null);
    } else {
      this.battle.setConvoyX(null);
    }

    // Objective update
    if (!this._mapEnded) {
      const objResult = this._objectiveSystem.update(dt, this.battle.units);
      this.hud.setObjectiveStatus(objResult.statusText);

      if (objResult.complete) {
        this._onMapCleared();
      } else if (objResult.failed) {
        this._onDroneKilled(); // treat convoy destroyed as run-over trigger
      }
    }

    // All enemies dead = map cleared regardless of objective type
    // (destroying all defenders is sufficient even if HQ still stands)
    if (!this._mapEnded) {
      this._checkMapComplete();
    }

    // Weapon system (cluster stagger, etc.)
    this.weapons.update(dt);

    // VFX
    this.effects.update(dt);

    // HUD timers
    this.hud.update(dt);

    // Camera
    this.renderer.update(dt);
  }

  _render() {
    this.renderer.render();
  }

  destroy() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);

    bus.off('menu:newRun',          this._onNewRun);
    bus.off('menu:mainMenu',        this._onMainMenu);
    bus.off('menu:workshop',        this._onOpenWorkshop);
    bus.off('drone:dead',           this._onDroneDead);
    bus.off('unit:died',            this._onUnitDied);
    bus.off('upgrade:cardSelected', this._onUpgradeSelected);
    bus.off('upgrade:reroll',       this._onUpgradeReroll);
    bus.off('flak:nearMiss',        this._onFlakNearMiss);
    bus.off('weapon:impact',        this._onWeaponImpactShake);
    bus.off('battle:droneHit',      this._onBattleDroneHit);
    bus.off('workshop:continue',    this._onWorkshopContinue);
    bus.off('loadout:confirmed',    this._onLoadoutConfirmed);
    this._cleanupMapListeners();
    this._objectiveSystem.destroy();

    this.input.destroy();
    this.hud.destroy();
    this.effects.destroy();
    this.weapons.destroy();
    this.roguelite.destroy();
  }
}
