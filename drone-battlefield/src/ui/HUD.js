import { bus } from '../core/EventBus.js';

const NEAR_MISS_DURATION = 0.4;
const CENTER_TEXT_DURATION = 2.0;

/**
 * HUD — in-game overlay: HP icons, weapon cooldown, objective status,
 * near-miss flash, wave text.
 * All DOM references cached in init(). Never queried in update().
 */
export class HUD {
  constructor() {
    this._bus = null;

    // HP icons
    this._hp1El = null;
    this._hp2El = null;
    this._hp3El = null;
    this._hpIcons = [];

    // Map / objective
    this._mapNameEl      = null;
    this._objStatusEl    = null;

    // Weapons
    this._primaryLabelEl    = null;
    this._primaryCooldownEl = null;
    this._primaryCooldownFillEl = null;
    this._secondaryBtnEl    = null;
    this._secondaryLabelEl  = null;
    this._secondaryCooldownEl = null;
    this._secondaryCooldownFillEl = null;

    // Notifications
    this._centerTextEl  = null;
    this._nearMissEl    = null;
    this._hudEl         = null;

    // Timers
    this._nearMissTimer  = 0;
    this._centerTimer    = 0;
    this._maxHp          = 3;

    this._onDroneHit  = null;
    this._onDroneDead = null;
  }

  init(bus_) {
    this._bus = bus_;

    this._hudEl              = document.getElementById('hud');
    this._hp1El              = document.getElementById('hp-1');
    this._hp2El              = document.getElementById('hp-2');
    this._hp3El              = document.getElementById('hp-3');
    this._hpIcons            = [this._hp1El, this._hp2El, this._hp3El].filter(Boolean);

    this._mapNameEl          = document.getElementById('map-name');
    this._objStatusEl        = document.getElementById('objective-status');

    this._primaryLabelEl         = document.getElementById('primary-weapon-label');
    this._primaryCooldownEl      = document.getElementById('primary-cooldown-label');
    this._primaryCooldownFillEl  = document.getElementById('primary-cooldown-fill');
    this._secondaryBtnEl         = document.getElementById('fire-secondary-btn');
    this._secondaryLabelEl       = document.getElementById('secondary-weapon-label');
    this._secondaryCooldownEl    = document.getElementById('secondary-cooldown-label');
    this._secondaryCooldownFillEl = document.getElementById('secondary-cooldown-fill');

    this._centerTextEl  = document.getElementById('center-text');
    this._nearMissEl    = document.getElementById('near-miss-text');

    this._onDroneHit  = ({ hpRemaining }) => this.setHP(hpRemaining);
    this._onDroneDead = () => this.setHP(0);

    bus_.on('drone:hit',  this._onDroneHit);
    bus_.on('drone:dead', this._onDroneDead);
  }

  /** Call after map load to configure HP display. */
  setMaxHP(max) {
    this._maxHp = max;
    // For now supports 3 icons; if upgrades add more, hide extras
    for (let i = 0; i < this._hpIcons.length; i++) {
      if (this._hpIcons[i]) {
        this._hpIcons[i].style.display = i < max ? '' : 'none';
      }
    }
  }

  /** Update HP icon display. hp = current HP (0–maxHp). */
  setHP(hp) {
    for (let i = 0; i < this._hpIcons.length; i++) {
      if (!this._hpIcons[i]) continue;
      const filled = i < hp;
      this._hpIcons[i].classList.toggle('lost', !filled);
    }
  }

  /** Set map name and reset objective status. */
  setMapInfo(name, objectiveText) {
    if (this._mapNameEl)   this._mapNameEl.textContent   = name || '—';
    if (this._objStatusEl) this._objStatusEl.textContent = objectiveText || '—';
  }

  /** Update objective status line (e.g. "HQ: 142 HP"). */
  setObjectiveStatus(text) {
    if (this._objStatusEl) this._objStatusEl.textContent = text || '';
  }

  /**
   * Update primary weapon display every frame.
   * @param {string} weaponType
   * @param {number} cooldownRemaining  seconds left
   * @param {number} cooldownMax        total cooldown
   */
  updatePrimary(weaponType, cooldownRemaining, cooldownMax) {
    if (this._primaryLabelEl) {
      this._primaryLabelEl.textContent = weaponType.toUpperCase();
    }
    if (this._primaryCooldownEl) {
      this._primaryCooldownEl.textContent = cooldownRemaining > 0
        ? `${cooldownRemaining.toFixed(1)}s`
        : 'HOLD';
    }
    if (this._primaryCooldownFillEl) {
      const pct = cooldownMax > 0 ? (cooldownRemaining / cooldownMax) * 100 : 0;
      this._primaryCooldownFillEl.style.height = `${Math.max(0, Math.min(100, pct))}%`;
    }
  }

  /**
   * Update secondary weapon display every frame.
   * @param {string|null} weaponType  null = no secondary
   * @param {number} cooldownRemaining
   * @param {number} cooldownMax
   */
  updateSecondary(weaponType, cooldownRemaining, cooldownMax) {
    if (!this._secondaryBtnEl) return;

    if (!weaponType) {
      this._secondaryBtnEl.classList.remove('unlocked');
      return;
    }

    this._secondaryBtnEl.classList.add('unlocked');
    if (this._secondaryLabelEl) {
      this._secondaryLabelEl.textContent = weaponType.toUpperCase();
    }
    if (this._secondaryCooldownEl) {
      this._secondaryCooldownEl.textContent = cooldownRemaining > 0
        ? `${cooldownRemaining.toFixed(1)}s`
        : 'READY';
    }
    if (this._secondaryCooldownFillEl) {
      const pct = cooldownMax > 0 ? (cooldownRemaining / cooldownMax) * 100 : 0;
      this._secondaryCooldownFillEl.style.height = `${Math.max(0, Math.min(100, pct))}%`;
    }
  }

  /** Flash "NEAR MISS" at top center. */
  showNearMiss() {
    this._nearMissTimer = NEAR_MISS_DURATION;
    if (this._nearMissEl) this._nearMissEl.style.opacity = '1';
  }

  /** Show a temporary center text (wave incoming, etc.). */
  showCenterText(text, duration) {
    this._centerTimer = duration ?? CENTER_TEXT_DURATION;
    if (this._centerTextEl) {
      this._centerTextEl.textContent = text;
      this._centerTextEl.style.opacity = '1';
    }
  }

  /** Call every frame for timer-driven UI updates. */
  update(dt) {
    if (this._nearMissTimer > 0) {
      this._nearMissTimer -= dt;
      if (this._nearMissTimer <= 0 && this._nearMissEl) {
        this._nearMissEl.style.opacity = '0';
      }
    }
    if (this._centerTimer > 0) {
      this._centerTimer -= dt;
      if (this._centerTimer <= 0 && this._centerTextEl) {
        this._centerTextEl.style.opacity = '0';
      }
    }
  }

  show() { if (this._hudEl) this._hudEl.style.display = 'flex'; }
  hide() { if (this._hudEl) this._hudEl.style.display = 'none'; }

  destroy() {
    if (this._bus) {
      this._bus.off('drone:hit',  this._onDroneHit);
      this._bus.off('drone:dead', this._onDroneDead);
    }
  }
}
