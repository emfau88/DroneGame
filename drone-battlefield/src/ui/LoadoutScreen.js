import { bus }  from '../core/EventBus.js';
import { t }    from '../core/i18n.js';
import { DRONE_MODELS } from '../systems/RogueliteManager.js';

const WEAPON_IDS = ['missile', 'bomb', 'emp', 'cluster'];

const WEAPON_NAMES = {
  missile: 'Missile',
  bomb:    'Bomb Bay',
  emp:     'EMP',
  cluster: 'Cluster',
};

const DRONE_SVG = {
  wasp: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="18" y1="4"  x2="4"  y2="18" stroke="#4A9FFF" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="18" y1="4"  x2="32" y2="18" stroke="#4A9FFF" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="18" y1="32" x2="4"  y2="18" stroke="#4A9FFF" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="18" y1="32" x2="32" y2="18" stroke="#4A9FFF" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="4"  cy="18" r="3" fill="#4A9FFF"/>
    <circle cx="32" cy="18" r="3" fill="#4A9FFF"/>
    <circle cx="18" cy="4"  r="3" fill="#4A9FFF"/>
    <circle cx="18" cy="32" r="3" fill="#4A9FFF"/>
    <circle cx="18" cy="18" r="4" fill="#99CCFF"/>
  </svg>`,
  hornet: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="18" y1="3"  x2="3"  y2="18" stroke="#FF8800" stroke-width="3" stroke-linecap="round"/>
    <line x1="18" y1="3"  x2="33" y2="18" stroke="#FF8800" stroke-width="3" stroke-linecap="round"/>
    <line x1="18" y1="33" x2="3"  y2="18" stroke="#FF8800" stroke-width="3" stroke-linecap="round"/>
    <line x1="18" y1="33" x2="33" y2="18" stroke="#FF8800" stroke-width="3" stroke-linecap="round"/>
    <circle cx="3"  cy="18" r="4" fill="#FF8800"/>
    <circle cx="33" cy="18" r="4" fill="#FF8800"/>
    <circle cx="18" cy="3"  r="4" fill="#FF8800"/>
    <circle cx="18" cy="33" r="4" fill="#FF8800"/>
    <circle cx="18" cy="18" r="5" fill="#FFCC66"/>
  </svg>`,
  reaper: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="18" y1="3"  x2="3"  y2="18" stroke="#AA44FF" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="18" y1="3"  x2="33" y2="18" stroke="#AA44FF" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="18" y1="33" x2="3"  y2="18" stroke="#AA44FF" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="18" y1="33" x2="33" y2="18" stroke="#AA44FF" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="5"  y1="5"  x2="31" y2="31" stroke="#AA44FF" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="31" y1="5"  x2="5"  y2="31" stroke="#AA44FF" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="18" cy="18" r="4" fill="#CC88FF"/>
  </svg>`,
};

const WEAPON_SVG = {
  bomb: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="22" r="10" fill="#444"/>
    <polygon points="12,30 24,30 18,36" fill="#333"/>
    <rect x="16" y="6" width="4" height="8" rx="2" fill="#555"/>
    <circle cx="18" cy="6" r="2.5" fill="#FF8800"/>
  </svg>`,
  missile: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="15" width="22" height="6" rx="2.5" fill="#CC6600"/>
    <polygon points="26,15 26,21 34,18" fill="#FF4400"/>
    <polygon points="4,15 4,21 0,24" fill="#884400"/>
    <polygon points="4,15 4,21 0,12" fill="#884400"/>
    <ellipse cx="5" cy="18" rx="2.5" ry="2" fill="#FF6600"/>
  </svg>`,
  emp: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="13" stroke="#00CCFF" stroke-width="2" fill="none"/>
    <circle cx="18" cy="18" r="7"  stroke="#44DDFF" stroke-width="1.5" fill="none"/>
    <circle cx="18" cy="18" r="3"  fill="#AAFFFF"/>
    <polygon points="19,5 15,16 18,16 13,31 22,16 18,16" fill="#00FFFF"/>
  </svg>`,
  cluster: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="7" fill="#4A6A3A"/>
    <circle cx="18" cy="5"  r="4" fill="#FF5500"/>
    <circle cx="18" cy="31" r="4" fill="#FF5500"/>
    <circle cx="5"  cy="18" r="4" fill="#FF5500"/>
    <circle cx="31" cy="18" r="4" fill="#FF5500"/>
    <circle cx="8"  cy="8"  r="3" fill="#FF5500"/>
    <circle cx="28" cy="28" r="3" fill="#FF5500"/>
  </svg>`,
};

const LOADOUT_STORAGE_KEY = 'drone_strike_loadout';

export class LoadoutScreen {
  constructor() {
    this._el         = null;
    this._roguelite  = null;
    this._contentEl  = null;
    this._tabBar     = null;

    this._tab            = 'drone';
    this._selectedDrone  = 'wasp';
    this._slot1 = null;   // weapon type string or null
    this._slot2 = null;
  }

  init(roguelite) {
    this._roguelite = roguelite;
    this._el        = document.getElementById('screen-loadout');
    this._contentEl = document.getElementById('lo-tab-content');
    this._tabBar    = document.getElementById('lo-tab-bar');

    const confirmBtn = document.getElementById('btn-loadout-confirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('pointerdown', () => {
        bus.emit('ui:click');
        this._roguelite.setDrone(this._selectedDrone);
        // Slots are managed by WorkshopScreen — read from roguelite.loadout
        const lo = this._roguelite.loadout;
        const weapons = [lo?.slot1, lo?.slot2].filter(Boolean);
        this._roguelite.setLoadout(weapons);
        bus.emit('loadout:confirmed', { drone: this._selectedDrone, secondaries: weapons });
      });
    }

    if (this._tabBar) {
      this._tabBar.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.shop-tab');
        if (!btn) return;
        bus.emit('ui:click');
        this._tab = btn.dataset.tab;
        this._updateTabBar();
        this._renderContent();
      });
    }
  }

  show() {
    this._selectedDrone = this._roguelite?.selectedDrone ?? 'wasp';
    this._loadLoadout();
    this._tab = 'drone';
    this._updateTabBar();
    this._renderContent();
    if (this._el) this._el.style.display = 'flex';
  }

  hide() {
    if (this._el) this._el.style.display = 'none';
  }

  _loadLoadout() {
    try {
      const raw = localStorage.getItem(LOADOUT_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this._slot1 = data.slot1 || null;
        this._slot2 = data.slot2 || null;
      } else {
        // Fall back to roguelite.loadout (object or legacy array)
        const lo = this._roguelite?.loadout;
        if (lo && !Array.isArray(lo)) {
          this._slot1 = lo.slot1 || null;
          this._slot2 = lo.slot2 || null;
        } else {
          this._slot1 = Array.isArray(lo) ? (lo[0] || null) : null;
          this._slot2 = Array.isArray(lo) ? (lo[1] || null) : null;
        }
      }
    } catch (_) {
      this._slot1 = null;
      this._slot2 = null;
    }
    // Validate: clear slots for weapons no longer owned
    if (this._slot1 && !this._roguelite.isWorkshopUnlocked('unlock_' + this._slot1)) this._slot1 = null;
    if (this._slot2 && !this._roguelite.isWorkshopUnlocked('unlock_' + this._slot2)) this._slot2 = null;
  }

  _saveLoadout() {
    try {
      localStorage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify({ slot1: this._slot1, slot2: this._slot2 }));
    } catch (_) {}
  }

  _updateTabBar() {
    if (!this._tabBar) return;
    for (const btn of this._tabBar.querySelectorAll('.shop-tab')) {
      btn.classList.toggle('active', btn.dataset.tab === this._tab);
    }
  }

  _renderContent() {
    if (!this._contentEl) return;
    this._contentEl.innerHTML = '';
    this._renderDroneTab();
  }

  // ── Drone tab ───────────────────────────────────────────────────────────

  _renderDroneTab() {
    const list = document.createElement('div');
    list.className = 'lo-drone-list';

    for (const model of DRONE_MODELS) {
      const owned   = this._roguelite.isDroneUnlocked(model.id) || model.id === 'wasp';
      const sel     = this._selectedDrone === model.id;
      const row     = document.createElement('div');
      row.className = 'lo-drone-row' + (sel ? ' lo-drone-row--selected' : '') + (!owned ? ' lo-drone-row--locked' : '');

      // Radio dot
      const radio = document.createElement('div');
      radio.className = 'lo-drone-radio';
      row.appendChild(radio);

      // Icon
      const iconWrap = document.createElement('div');
      iconWrap.className = 'lo-drone-icon';
      iconWrap.innerHTML = DRONE_SVG[model.id] || DRONE_SVG.wasp;
      row.appendChild(iconWrap);

      // Info
      const info = document.createElement('div');
      info.className = 'lo-drone-info';

      const nameEl = document.createElement('div');
      nameEl.className = 'lo-drone-name';
      nameEl.textContent = t(model.nameKey) || model.id.toUpperCase();
      info.appendChild(nameEl);

      const statsEl = document.createElement('div');
      statsEl.className = 'lo-drone-stats';
      statsEl.textContent = `${model.maxHp} HP · ${Math.round(model.speedMult * 100)}% speed${model.dualCannon ? ' · dual cannon' : ''}`;
      info.appendChild(statsEl);

      row.appendChild(info);

      // Lock icon
      if (!owned) {
        const lock = document.createElement('span');
        lock.className = 'lo-drone-lock';
        lock.textContent = '🔒';
        row.appendChild(lock);
      } else if (sel) {
        const check = document.createElement('span');
        check.style.cssText = 'font-size:.8rem;color:#297BFF;font-weight:700;flex-shrink:0;';
        check.textContent = '✓';
        row.appendChild(check);
      }

      if (owned) {
        row.addEventListener('pointerdown', () => {
          bus.emit('ui:click');
          this._selectedDrone = model.id;
          this._renderContent();
        });
      }

      list.appendChild(row);
    }

    this._contentEl.appendChild(list);
  }

  // ── Weapons tab ─────────────────────────────────────────────────────────

  _renderWeaponsTab() {
    const unlocked = WEAPON_IDS.filter(w => this._roguelite.isWorkshopUnlocked('unlock_' + w));

    if (unlocked.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'lo-no-weapons';
      msg.innerHTML = `<div>${t('loadout.noWeapons') || 'Unlock weapons in the Workshop first.'}</div>
        <button id="lo-goto-workshop">${t('loadout.gotoWorkshop') || '→ WORKSHOP'}</button>`;
      this._contentEl.appendChild(msg);
      const wsBtn = document.getElementById('lo-goto-workshop');
      if (wsBtn) wsBtn.addEventListener('pointerdown', () => { bus.emit('ui:click'); bus.emit('menu:workshop'); });
      return;
    }

    // Status bar — shows current slot assignments at a glance
    const statusBar = document.createElement('div');
    statusBar.style.cssText = `
      display:flex; gap:8px; margin-bottom:12px; padding:10px 12px;
      background:#111c2e; border-radius:8px;
      border:1px solid rgba(255,255,255,.1);
      align-items:center;
    `;
    const slotLabel = document.createElement('span');
    slotLabel.style.cssText = 'font-size:.62rem;font-weight:700;letter-spacing:.12em;color:rgba(255,255,255,.4);text-transform:uppercase;flex-shrink:0;';
    slotLabel.textContent = 'SLOTS:';
    statusBar.appendChild(slotLabel);

    for (const [num, weapon] of [[1, this._slot1], [2, this._slot2]]) {
      const pill = document.createElement('span');
      const filled = !!weapon;
      pill.style.cssText = `
        flex:1; padding:5px 10px; border-radius:5px; text-align:center;
        font-size:.72rem; font-weight:700; letter-spacing:.05em;
        background:${filled ? 'rgba(41,123,255,.25)' : 'rgba(255,255,255,.06)'};
        border:1px solid ${filled ? '#297BFF' : 'rgba(255,255,255,.15)'};
        color:${filled ? '#fff' : 'rgba(255,255,255,.3)'};
      `;
      pill.textContent = filled ? `${num === 1 ? '①' : '②'} ${WEAPON_NAMES[weapon]}` : `${num === 1 ? '①' : '②'} — empty —`;
      statusBar.appendChild(pill);
    }
    this._contentEl.appendChild(statusBar);

    // Hint
    const hint = document.createElement('div');
    hint.className = 'lo-weapons-hint';
    hint.textContent = t('loadout.weaponHint') || 'Tap to assign · Tap again to remove';
    this._contentEl.appendChild(hint);

    // Weapon grid — one tap assigns, second tap clears
    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    for (const w of unlocked) {
      const isInSlot1 = this._slot1 === w;
      const isInSlot2 = this._slot2 === w;
      const isAssigned = isInSlot1 || isInSlot2;

      const card = document.createElement('div');
      card.className = 'shop-card' + (isAssigned ? ' shop-card--selected' : '');

      // Slot badge — absolute top-left corner
      if (isInSlot1 || isInSlot2) {
        const badge = document.createElement('span');
        badge.style.cssText = `
          position:absolute; top:4px; left:5px;
          font-size:.75rem; font-weight:700; color:#297BFF;
          line-height:1;
        `;
        badge.textContent = isInSlot1 ? '①' : '②';
        card.appendChild(badge);
      }

      const iconEl = document.createElement('div');
      iconEl.className = 'shop-card-icon';
      iconEl.innerHTML = WEAPON_SVG[w] || '';
      card.appendChild(iconEl);

      const nameEl = document.createElement('div');
      nameEl.className = 'shop-card-name';
      nameEl.textContent = WEAPON_NAMES[w] || w.toUpperCase();
      card.appendChild(nameEl);

      // State label below name
      const stateEl = document.createElement('div');
      stateEl.className = 'shop-card-stat';
      if (isInSlot1) stateEl.textContent = 'SLOT 1 ✓';
      else if (isInSlot2) stateEl.textContent = 'SLOT 2 ✓';
      else stateEl.textContent = 'tap to assign';
      card.appendChild(stateEl);

      card.addEventListener('pointerdown', () => {
        bus.emit('ui:click');
        this._assignWeapon(w);
      });

      grid.appendChild(card);
    }

    this._contentEl.appendChild(grid);
  }

  _assignWeapon(weaponType) {
    // Tap on already-assigned weapon → clear that slot
    if (this._slot1 === weaponType) {
      this._slot1 = null;
      this._saveLoadout();
      this._renderContent();
      return;
    }
    if (this._slot2 === weaponType) {
      this._slot2 = null;
      this._saveLoadout();
      this._renderContent();
      return;
    }
    // Fill first empty slot; if both full, replace slot 1
    if (!this._slot1) {
      this._slot1 = weaponType;
    } else if (!this._slot2) {
      this._slot2 = weaponType;
    } else {
      this._slot1 = weaponType; // both full → replace slot 1
    }
    this._saveLoadout();
    this._renderContent();
  }
}
