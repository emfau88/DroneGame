import { bus } from '../core/EventBus.js';

const NEAR_MISS_DURATION   = 0.4;
const CENTER_TEXT_DURATION = 2.0;
const TOOLTIP_FLAG_KEY     = 'drone_strike_flak_tip_seen';

const KILL_SOURCE_LABELS = {
  flakGun:        'ABGESCHOSSEN — Formular B-7 ausfüllen',
  samMedium:      'SAM-M TREFFER — Schaden: klassifiziert',
  samHeavy:       'SAM-H TREFFER — Abstand wäre empfohlen gewesen',
  enemyDrone:     'KOLLISION MIT FEINDDROHNE — Ironie vermerkt',
  tank:           'PANZER-AA TREFFER — Handbuch sagt: Abstand halten',
  rocket:         'RAKETENTREFFER — Ausweichmanöver: zu spät',
  rocketInfantry: 'SCHULTERRAKETE — Budget für Panzerung: überdenken',
  commander:      'KOMMANDANTEN-FEUER — Respekt, irgendwie',
  empMortar:      'EMP-TREFFER — Systeme deaktiviert. Kurz.',
  jammer:         'NAVIGATION GESTÖRT — GPS: hoffnungsoptimistisch',
  titanTank:      'TITAN-BESCHUSS — €2.847.000 Schaden. Erneut.',
};

// Rotating death comments indexed by death count (0-based, wraps after 4)
const DEATH_COMMENTS = [
  'Drohne ausgefallen. Kostenvoranschlag folgt.',
  'Kontakt verloren. Offiziell: technisches Versagen.',
  'Formular B-7 liegt beim Sachbearbeiter. Er ist im Urlaub.',
  'Drohne verloren. Budget-Meeting anberaumt.',
  'Bitte Absturzprotokoll in dreifacher Ausfertigung einreichen.',
];

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

    this._primaryLabelEl          = null;
    this._primaryCooldownEl       = null;
    this._primaryCooldownFillEl   = null;
    this._secondaryBtnEl          = null;
    this._secondaryLabelEl        = null;
    this._secondaryCooldownEl     = null;
    this._secondaryCooldownFillEl = null;
    this._secondary2BtnEl         = null;
    this._secondary2LabelEl       = null;
    this._secondary2CooldownEl    = null;
    this._secondary2CooldownFillEl = null;
    this._coinsEl                 = null;

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
    this._onDroneJammed    = null;
    this._onEmpFreeze      = null;
    this._jamTextActive    = false;

    this._deathCount              = 0;  // deaths this session
    this._commentEl               = null;
    this._commentTimer            = 0;
    this._titanCommentedThisMap   = false;
    this._onTitanHit              = null;

    // EMP jammed bar
    this._jammedDuration  = 0;
    this._jammedTimer     = 0;
    this._onWeaponsFrozen = null;
    this._onWeaponsRestored = null;

    // HQ arrow
    this._hqArrowTimer = 0;
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

    this._primaryLabelEl           = document.getElementById('primary-weapon-label');
    this._primaryCooldownEl        = document.getElementById('primary-cooldown-label');
    this._primaryCooldownFillEl    = document.getElementById('primary-cooldown-fill');
    this._secondaryBtnEl           = document.getElementById('fire-secondary-btn');
    this._secondaryLabelEl         = document.getElementById('secondary-weapon-label');
    this._secondaryCooldownEl      = document.getElementById('secondary-cooldown-label');
    this._secondaryCooldownFillEl  = document.getElementById('secondary-cooldown-fill');
    this._secondary2BtnEl          = document.getElementById('fire-secondary2-btn');
    this._secondary2LabelEl        = document.getElementById('secondary2-weapon-label');
    this._secondary2CooldownEl     = document.getElementById('secondary2-cooldown-label');
    this._secondary2CooldownFillEl = document.getElementById('secondary2-cooldown-fill');
    this._coinsEl                  = document.getElementById('hud-coins');

    this._centerTextEl  = document.getElementById('center-text');
    this._nearMissEl    = document.getElementById('near-miss-text');
    this._tooltipEl     = document.getElementById('hud-tooltip');
    this._killSourceEl  = document.getElementById('kill-source-text');

    this._hitVignetteEl  = document.getElementById('hit-vignette');
    this._hullBreachEl   = document.getElementById('hull-breach-text');
    this._droneWarningEl = document.getElementById('drone-warning');
    this._commentEl      = document.getElementById('death-comment');
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
      this._showDeathComment();
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

    this._onDroneJammed = ({ active }) => {
      if (active) this.showCenterText('⚡ CONTROLS JAMMED', 99); // persistent until cleared
      else this._clearJamText();
    };

    this._onEmpFreeze = () => {
      this.showCenterText('⚡ WEAPONS DISABLED', 2.2);
    };

    this._onTitanHit = () => {
      // Only comment once per map — after that the player gets the point
      if (!this._titanCommentedThisMap) {
        this._titanCommentedThisMap = true;
        this._showComment('Titan-Klasse. Das Handbuch sagt: Abstand halten.', 3.5);
      }
    };

    this._onWeaponsFrozen = ({ duration }) => {
      this._jammedDuration = duration;
      this._jammedTimer = duration;
      const ind = document.getElementById('jammed-indicator');
      const barWrap = document.getElementById('jammed-bar-wrap');
      const cluster = document.getElementById('fire-cluster');
      if (ind) ind.style.display = 'block';
      if (barWrap) barWrap.style.display = 'block';
      if (cluster) cluster.style.setProperty('opacity', '0.45');
    };

    this._onWeaponsRestored = () => {
      this._jammedTimer = 0;
      const ind = document.getElementById('jammed-indicator');
      const barWrap = document.getElementById('jammed-bar-wrap');
      const cluster = document.getElementById('fire-cluster');
      if (barWrap) barWrap.style.display = 'none';
      if (cluster) cluster.style.setProperty('opacity', '1');
      if (ind) {
        ind.textContent = 'WEAPONS ONLINE';
        ind.style.background = 'rgba(0,180,80,0.85)';
        ind.style.display = 'block';
        setTimeout(() => {
          ind.style.display = 'none';
          ind.textContent = 'JAMMED';
          ind.style.background = 'rgba(220,0,0,0.85)';
        }, 900);
      }
    };

    bus_.on('drone:hit',           this._onDroneHit);
    bus_.on('drone:dead',          this._onDroneDead);
    bus_.on('battle:droneHit',     this._onBattleDroneHit);
    bus_.on('unit:fire',           this._onUnitFired);
    bus_.on('enemyDrone:approach', this._onDroneApproach);
    bus_.on('drone:jammed',        this._onDroneJammed);
    bus_.on('drone:empFreeze',     this._onEmpFreeze);
    bus_.on('battle:titanHit',     this._onTitanHit);
    bus_.on('drone:weaponsFrozen',   this._onWeaponsFrozen);
    bus_.on('drone:weaponsRestored', this._onWeaponsRestored);
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
      this._secondaryBtnEl.classList.remove('unlocked', 'weapon-ready');
      return;
    }
    this._secondaryBtnEl.classList.add('unlocked');
    if (this._secondaryLabelEl) {
      this._secondaryLabelEl.textContent = weaponType.toUpperCase();
    }
    const isReady = cooldownRemaining <= 0;
    if (this._secondaryCooldownEl) {
      this._secondaryCooldownEl.textContent = isReady ? 'READY' : `${cooldownRemaining.toFixed(1)}s`;
    }
    if (this._secondaryCooldownFillEl) {
      const pct = cooldownMax > 0 ? (cooldownRemaining / cooldownMax) * 100 : 0;
      this._secondaryCooldownFillEl.style.height = `${Math.max(0, Math.min(100, pct))}%`;
    }
    // Flash green when transitioning to ready
    const wasReady = this._secondaryBtnEl.classList.contains('weapon-ready');
    if (isReady && !wasReady) {
      this._secondaryBtnEl.classList.add('weapon-ready', 'ready-flash');
      setTimeout(() => this._secondaryBtnEl?.classList.remove('ready-flash'), 600);
    } else if (!isReady) {
      this._secondaryBtnEl.classList.remove('weapon-ready');
    }
  }

  updateSecondary2(weaponType, cooldownRemaining, cooldownMax) {
    if (!this._secondary2BtnEl) return;
    if (!weaponType) {
      this._secondary2BtnEl.style.display = 'none';
      this._secondary2BtnEl.classList.remove('weapon-ready');
      return;
    }
    this._secondary2BtnEl.style.display = 'flex';
    if (this._secondary2LabelEl) {
      this._secondary2LabelEl.textContent = weaponType.toUpperCase();
    }
    const isReady = cooldownRemaining <= 0;
    if (this._secondary2CooldownEl) {
      this._secondary2CooldownEl.textContent = isReady ? 'READY' : `${cooldownRemaining.toFixed(1)}s`;
    }
    if (this._secondary2CooldownFillEl) {
      const pct = cooldownMax > 0 ? (cooldownRemaining / cooldownMax) * 100 : 0;
      this._secondary2CooldownFillEl.style.height = `${Math.max(0, Math.min(100, pct))}%`;
    }
    const wasReady = this._secondary2BtnEl.classList.contains('weapon-ready');
    if (isReady && !wasReady) {
      this._secondary2BtnEl.classList.add('weapon-ready', 'ready-flash');
      setTimeout(() => this._secondary2BtnEl?.classList.remove('ready-flash'), 600);
    } else if (!isReady) {
      this._secondary2BtnEl.classList.remove('weapon-ready');
    }
  }

  setCoins(amount) {
    if (this._coinsEl) this._coinsEl.textContent = amount;
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
   * Show briefing lines one after another, 1.1s per line.
   * Lines are shown in the center text element sequentially.
   */
  showBriefing(lines) {
    if (!lines?.length) return;
    let idx = 0;
    const showNext = () => {
      if (idx >= lines.length) return;
      this.showCenterText(lines[idx], 1.0);
      idx++;
      if (idx < lines.length) {
        setTimeout(showNext, 1100);
      }
    };
    showNext();
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
    const label = KILL_SOURCE_LABELS[this._lastHitSourceType] || 'DROHNE AUSGEFALLEN — Ursache: unklar';
    this._killSourceEl.textContent = label;
    this._killSourceEl.style.opacity = '1';
    this._killSourceTimer = 4.0;
  }

  _showDeathComment() {
    const comment = DEATH_COMMENTS[this._deathCount % DEATH_COMMENTS.length];
    this._deathCount++;
    this._showComment(comment, 4.5);
  }

  _showComment(text, duration) {
    if (!this._commentEl) return;
    this._commentEl.textContent = text;
    this._commentEl.style.opacity = '1';
    this._commentTimer = duration;
  }

  /** Called by Game each frame so HUD can compute directional indicators. */
  setDronePosition(pos) {
    this._dronePosition = pos;
  }

  showObjectiveArrow(duration = 5) {
    const el = document.getElementById('hq-arrow');
    if (!el) return;
    el.style.display = 'flex';
    this._hqArrowTimer = duration;
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

    if (this._commentTimer > 0) {
      this._commentTimer -= dt;
      if (this._commentTimer <= 0 && this._commentEl) {
        this._commentEl.style.opacity = '0';
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

    // Jammed bar shrink
    if (this._jammedTimer > 0) {
      this._jammedTimer = Math.max(0, this._jammedTimer - dt);
      const pct = (this._jammedTimer / this._jammedDuration) * 100;
      const bar = document.getElementById('jammed-bar');
      if (bar) bar.style.width = pct + '%';
    }

    // HQ arrow countdown
    if (this._hqArrowTimer > 0) {
      this._hqArrowTimer -= dt;
      if (this._hqArrowTimer <= 0) {
        const el = document.getElementById('hq-arrow');
        if (el) el.style.display = 'none';
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

  /** Call at the start of each new map to reset per-map state. */
  resetForMap() {
    this._titanCommentedThisMap = false;
    if (this._commentEl) this._commentEl.style.opacity = '0';
    this._commentTimer = 0;
  }

  destroy() {
    if (this._bus) {
      this._bus.off('drone:hit',           this._onDroneHit);
      this._bus.off('drone:dead',          this._onDroneDead);
      this._bus.off('battle:droneHit',     this._onBattleDroneHit);
      this._bus.off('unit:fire',           this._onUnitFired);
      this._bus.off('enemyDrone:approach', this._onDroneApproach);
      this._bus.off('drone:jammed',        this._onDroneJammed);
      this._bus.off('drone:empFreeze',       this._onEmpFreeze);
      this._bus.off('battle:titanHit',       this._onTitanHit);
      this._bus.off('drone:weaponsFrozen',   this._onWeaponsFrozen);
      this._bus.off('drone:weaponsRestored', this._onWeaponsRestored);
    }
  }

  _clearJamText() {
    if (this._centerTextEl && this._centerTextEl.textContent.includes('JAMMED')) {
      this._centerTextEl.style.opacity = '0';
      this._centerTimer = 0;
    }
  }
}
