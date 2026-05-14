import { bus } from '../core/EventBus.js';

const NEAR_MISS_DURATION   = 0.4;
const CENTER_TEXT_DURATION = 2.0;
const TOOLTIP_FLAG_KEY     = 'drone_strike_flak_tip_seen';

const KILL_SOURCE_LABELS = {
  flakGun:    'SHOT DOWN BY FLAK',
  enemyDrone: 'RAMMED BY ENEMY DRONE',
  tank:       'DESTROYED BY TANK AA',
  rocket:     'HIT BY ROCKET AA',
  commander:  'HIT BY COMMANDER AA',
};

/**
 * HUD — in-game overlay. Manages all 2D feedback:
 * HP icons, weapon cooldowns, objective status, directional hit indicators,
 * screen vignette, hull-breach text, enemy-drone warning, near-miss.
 */
export class HUD {
  constructor() {
    this._bus = null;

    this._hp1El = null;
    this._hp2El = null;
    this._hp3El = null;
    this._hpIcons = [];

    this._mapNameEl      = null;
    this._objStatusEl    = null;

    this._primaryLabelEl         = null;
    this._primaryCooldownEl      = null;
    this._primaryCooldownFillEl  = null;
    this._secondaryBtnEl         = null;
    this._secondaryLabelEl       = null;
    this._secondaryCooldownEl    = null;
    this._secondaryCooldownFillEl = null;

    this._centerTextEl  = null;
    this._nearMissEl    = null;
    this._tooltipEl     = null;
    this._killSourceEl  = null;
    this._hudEl         = null;

    // New feedback elements
    this._hitVignetteEl   = null;
    this._hullBreachEl    = null;
    this._droneWarningEl  = null;
    this._hitArrows       = {}; // { top, bottom, left, right }

    this._nearMissTimer   = 0;
    this._centerTimer     = 0;
    this._tooltipTimer    = 0;
    this._tooltipActive   = false;
    this._killSourceTimer = 0;
    this._maxHp           = 3;

    // Vignette / hull breach
    this._vignetteTimer   = 0;
    this._hullBreachTimer = 0;

    // Directional hit arrows — each has { timer, maxTimer }
    this._arrowTimers = { top: 0, bottom: 0, left: 0, right: 0 };

    // Enemy drone warning
    this._droneWarningTimer  = 0;
    this._droneWarningPulse  = false; // true when < 8 units away
    this._droneWarningPhase  = 0;     // for pulse oscillation

    // Track last unit type to hit the drone for kill-source display
    this._lastHitSourceType = null;

    // Drone world position (needed for directional indicators)
    this._dronePosition = null;

    this._onDroneHit       = null;
    this._onDroneDead      = null;
    this._onUnitFired      = null;
    this._onBattleDroneHit = null;
    this._onDroneApproach  = null;
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
    this._tooltipEl     = document.getElementById('hud-tooltip');
    this._killSourceEl  = document.getElementById('kill-source-text');

    this._hitVignetteEl  = document.getElementById('hit-vignette');
    this._hullBreachEl   = document.getElementById('hull-breach-text');
    this._droneWarningEl = document.getElementById('drone-warning');
    this._hitArrows = {
      top:    document.getElementById('hit-arrow-top'),
      bottom: document.getElementById('hit-arrow-bottom'),
      left:   document.getElementById('hit-arrow-left'),
      right:  document.getElementById('hit-arrow-right'),
    };

    this._onDroneHit  = ({ hpRemaining }) => this.setHP(hpRemaining);
    this._onDroneDead = () => {
      this.setHP(0);
      this._showKillSource();
    };

    // battle:droneHit carries source position for directional indicator
    this._onBattleDroneHit = ({ sourcePosition }) => {
      this._triggerHitFeedback(sourcePosition);
    };

    this._onDroneApproach = ({ sourcePosition, dist }) => {
      this._droneWarningTimer  = 0.4; // reset each frame it's close
      this._droneWarningPulse  = dist <= 8;
      // Also show directional warning for the drone approach
      if (this._dronePosition) {
        this._showDirectionalArrow(sourcePosition, this._dronePosition);
      }
    };

    // Track which red unit last fired — used to attribute death cause
    this._onUnitFired = ({ team, type }) => {
      if (team === 'red') this._lastHitSourceType = type || 'flakGun';
    };

    bus_.on('drone:hit',        this._onDroneHit);
    bus_.on('drone:dead',       this._onDroneDead);
    bus_.on('battle:droneHit',  this._onBattleDroneHit);
    bus_.on('unit:fire',        this._onUnitFired);
    bus_.on('enemyDrone:approach', this._onDroneApproach);
  }

  // ── HP ────────────────────────────────────────────────────────────────────

  setMaxHP(max) {
    this._maxHp = max;
    for (let i = 0; i < this._hpIcons.length; i++) {
      if (this._hpIcons[i]) {
        this._hpIcons[i].style.display = i < max ? '' : 'none';
      }
    }
  }

  setHP(hp) {
    for (let i = 0; i < this._hpIcons.length; i++) {
      const el = this._hpIcons[i];
      if (!el) continue;
      const shouldBeLost = i >= hp;
      const wasLost = el.classList.contains('lost');
      if (shouldBeLost && !wasLost) {
        // Icon just lost — play shake+scale animation
        el.classList.add('losing');
        el.addEventListener('animationend', () => {
          el.classList.remove('losing');
          el.classList.add('lost');
        }, { once: true });
      } else if (!shouldBeLost) {
        el.classList.remove('lost', 'losing');
      }
    }
  }

  // ── Hit feedback ──────────────────────────────────────────────────────────

  _triggerHitFeedback(sourcePosition) {
    // Vignette flash
    this._vignetteTimer = 0.3;
    if (this._hitVignetteEl) {
      this._hitVignetteEl.style.opacity = '1';
    }

    // Hull breach text
    this._hullBreachTimer = 0.8;
    if (this._hullBreachEl) {
      this._hullBreachEl.style.opacity = '1';
    }

    // Directional arrow
    if (sourcePosition && this._dronePosition) {
      this._showDirectionalArrow(sourcePosition, this._dronePosition);
    }
  }

  _showDirectionalArrow(sourcePos, dronePos) {
    const dx = sourcePos.x - dronePos.x;
    const dz = sourcePos.z - dronePos.z;

    // Determine dominant direction in screen space
    // Camera is overhead/behind: world +X ≈ screen right, world +Z ≈ screen down
    const absX = Math.abs(dx);
    const absZ = Math.abs(dz);

    let dir;
    if (absX >= absZ) {
      dir = dx > 0 ? 'right' : 'left';
    } else {
      // world Z: positive Z is toward camera (bottom of screen), negative Z is away (top)
      dir = dz > 0 ? 'bottom' : 'top';
    }

    const ARROW_DURATION = 1.2;
    this._arrowTimers[dir] = ARROW_DURATION;
    const el = this._hitArrows[dir];
    if (el) el.style.opacity = '1';
  }

  // ── Map / objective ───────────────────────────────────────────────────────

  setMapInfo(name, objectiveText) {
    if (this._mapNameEl)   this._mapNameEl.textContent   = name || '—';
    if (this._objStatusEl) this._objStatusEl.textContent = objectiveText || '—';
  }

  setObjectiveStatus(text) {
    if (this._objStatusEl) this._objStatusEl.textContent = text || '';
  }

  // ── Weapon cooldowns ──────────────────────────────────────────────────────

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

  // ── Near miss / center text ───────────────────────────────────────────────

  showNearMiss() {
    this._nearMissTimer = NEAR_MISS_DURATION;
    if (this._nearMissEl) this._nearMissEl.style.opacity = '1';
  }

  showCenterText(text, duration) {
    this._centerTimer = duration ?? CENTER_TEXT_DURATION;
    if (this._centerTextEl) {
      this._centerTextEl.textContent = text;
      this._centerTextEl.style.opacity = '1';
    }
  }

  /**
   * Start the flak tutorial tooltip sequence.
   * Only fires if the player hasn't seen it before (localStorage gate).
   */
  startFlakTooltip() {
    try {
      if (localStorage.getItem(TOOLTIP_FLAG_KEY)) return;
    } catch (_) {}
    this._tooltipActive = true;
    this._tooltipTimer  = 0;
  }

  _showKillSource() {
    if (!this._killSourceEl || !this._lastHitSourceType) return;
    const label = KILL_SOURCE_LABELS[this._lastHitSourceType] || 'DRONE DESTROYED';
    this._killSourceEl.textContent = label;
    this._killSourceEl.style.opacity = '1';
    this._killSourceTimer = 3.0;
  }

  /** Called by Game each frame so HUD can compute directional indicators. */
  setDronePosition(pos) {
    this._dronePosition = pos;
  }

  // ── Update ────────────────────────────────────────────────────────────────

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

    if (this._killSourceTimer > 0) {
      this._killSourceTimer -= dt;
      if (this._killSourceTimer <= 0 && this._killSourceEl) {
        this._killSourceEl.style.opacity = '0';
      }
    }

    // Vignette: fast in (handled at trigger), fade out over remaining time
    if (this._vignetteTimer > 0) {
      this._vignetteTimer -= dt;
      if (this._vignetteTimer <= 0 && this._hitVignetteEl) {
        this._hitVignetteEl.style.opacity = '0';
      }
    }

    // Hull breach text fade
    if (this._hullBreachTimer > 0) {
      this._hullBreachTimer -= dt;
      if (this._hullBreachTimer <= 0 && this._hullBreachEl) {
        this._hullBreachEl.style.opacity = '0';
      }
    }

    // Hit arrows — fade each independently
    for (const dir of ['top', 'bottom', 'left', 'right']) {
      if (this._arrowTimers[dir] > 0) {
        this._arrowTimers[dir] -= dt;
        const frac = this._arrowTimers[dir] / 1.2;
        const el = this._hitArrows[dir];
        if (el) el.style.opacity = frac > 0 ? String(Math.min(1, frac * 2)) : '0';
        if (this._arrowTimers[dir] <= 0 && el) el.style.opacity = '0';
      }
    }

    // Enemy drone warning — droneWarningTimer is reset each frame approach event fires
    if (this._droneWarningTimer > 0) {
      this._droneWarningTimer -= dt;
      if (this._droneWarningEl) {
        if (this._droneWarningTimer <= 0) {
          this._droneWarningEl.style.opacity = '0';
        } else if (this._droneWarningPulse) {
          // Pulse at 8Hz when very close
          this._droneWarningPhase += dt * 8 * Math.PI * 2;
          const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this._droneWarningPhase));
          this._droneWarningEl.style.opacity = String(pulse);
        } else {
          this._droneWarningEl.style.opacity = '1';
        }
      }
    }

    // Tutorial tooltip
    if (this._tooltipActive && this._tooltipEl) {
      this._tooltipTimer += dt;
      if (this._tooltipTimer >= 3 && this._tooltipTimer < 3 + dt) {
        this._tooltipEl.style.opacity = '1';
      }
      if (this._tooltipTimer >= 6) {
        this._tooltipEl.style.opacity = '0';
        this._tooltipActive = false;
        try { localStorage.setItem(TOOLTIP_FLAG_KEY, '1'); } catch (_) {}
      }
    }
  }

  show() { if (this._hudEl) this._hudEl.style.display = 'flex'; }
  hide() { if (this._hudEl) this._hudEl.style.display = 'none'; }

  destroy() {
    if (this._bus) {
      this._bus.off('drone:hit',           this._onDroneHit);
      this._bus.off('drone:dead',          this._onDroneDead);
      this._bus.off('battle:droneHit',     this._onBattleDroneHit);
      this._bus.off('unit:fire',           this._onUnitFired);
      this._bus.off('enemyDrone:approach', this._onDroneApproach);
    }
  }
}
