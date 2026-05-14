import { bus }             from '../core/EventBus.js';
import { t }               from '../core/i18n.js';
import { DroneShowcase }   from './DroneShowcase.js';
import { DRONE_MODELS }    from '../systems/RogueliteManager.js';

const WEAPON_ICONS = { missile: '🚀', bomb: '💣', emp: '⚡', cluster: '💥' };
const WEAPON_IDS   = ['missile', 'bomb', 'emp', 'cluster'];

const DRONE_ICONS = { wasp: '🔵', hornet: '🟠', reaper: '🟣' };

/**
 * LoadoutScreen — two tabs: Drone selection + Weapon selection.
 * Emits: loadout:confirmed
 */
export class LoadoutScreen {
  constructor() {
    this._el        = null;
    this._roguelite = null;
    this._showcase  = new DroneShowcase();

    this._tab          = 'drone'; // 'drone' | 'weapons'
    this._selectedDrone   = 'wasp';
    this._selectedWeapons = [];

    // DOM refs built dynamically
    this._tabDroneBtn   = null;
    this._tabWeaponsBtn = null;
    this._contentEl     = null;
    this._confirmEl     = null;
  }

  init(roguelite) {
    this._roguelite = roguelite;
    this._el        = document.getElementById('screen-loadout');
    this._confirmEl = document.getElementById('btn-loadout-confirm');
    this._showcase.init('lo-showcase-canvas', 'lo-showcase-labels');

    if (this._confirmEl) {
      this._confirmEl.addEventListener('pointerdown', () => {
        bus.emit('ui:click');
        this._roguelite.setDrone(this._selectedDrone);
        this._roguelite.setLoadout(this._selectedWeapons);
        bus.emit('loadout:confirmed', { drone: this._selectedDrone, secondaries: [...this._selectedWeapons] });
      });
    }
  }

  show() {
    this._selectedDrone   = this._roguelite?.selectedDrone ?? 'wasp';
    this._selectedWeapons = [...(this._roguelite?.loadout ?? [])];
    this._tab = 'drone';
    this._buildTabs();
    this._renderTab();
    if (this._el) this._el.style.display = 'flex';
    this._showcase.setDroneModel(this._selectedDrone);
    this._showcase.setWeapons(null, null);
    this._showcase.start();
  }

  hide() {
    if (this._el) this._el.style.display = 'none';
    this._showcase.stop();
  }

  // ── Tab chrome ─────────────────────────────────────────────────────────────

  _buildTabs() {
    // Find or create the right-side content wrapper
    let rightPanel = document.getElementById('lo-right-panel');
    if (!rightPanel) return;

    rightPanel.innerHTML = '';

    // Tab buttons row
    const tabRow = document.createElement('div');
    tabRow.style.cssText = 'display:flex;gap:0;width:100%;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:10px;';

    this._tabDroneBtn   = this._makeTabBtn(t('loadout.tabDrone')   || 'Drone',   'drone');
    this._tabWeaponsBtn = this._makeTabBtn(t('loadout.tabWeapons') || 'Weapons', 'weapons');
    tabRow.appendChild(this._tabDroneBtn);
    tabRow.appendChild(this._tabWeaponsBtn);
    rightPanel.appendChild(tabRow);

    // Content area
    this._contentEl = document.createElement('div');
    this._contentEl.style.cssText = 'flex:1;overflow-y:auto;width:100%;display:flex;flex-direction:column;align-items:center;gap:10px;padding:0 16px 16px;';
    rightPanel.appendChild(this._contentEl);

    this._updateTabStyle();
  }

  _makeTabBtn(label, tabId) {
    const btn = document.createElement('button');
    btn.style.cssText = `
      flex:1; padding:10px 0; background:none; border:none;
      font-family:inherit; font-size:.8rem; letter-spacing:.1em;
      text-transform:uppercase; cursor:pointer; color:rgba(255,255,255,.5);
      border-bottom:2px solid transparent; transition:color .15s,border-color .15s;
    `;
    btn.textContent = label;
    btn.addEventListener('pointerdown', () => { bus.emit('ui:click'); this._switchTab(tabId); });
    return btn;
  }

  _updateTabStyle() {
    if (!this._tabDroneBtn || !this._tabWeaponsBtn) return;
    const active = 'color:#fff;border-bottom:2px solid #297BFF;';
    const idle   = 'color:rgba(255,255,255,.4);border-bottom:2px solid transparent;';
    this._tabDroneBtn.style.cssText   += this._tab === 'drone'   ? active : idle;
    this._tabWeaponsBtn.style.cssText += this._tab === 'weapons' ? active : idle;
  }

  _switchTab(tabId) {
    this._tab = tabId;
    this._updateTabStyle();
    this._renderTab();
    if (tabId === 'drone') {
      this._showcase.showDrone();
      this._showcase.setDroneModel(this._selectedDrone);
      this._showcase.setWeapons(null, null);
    } else {
      this._showcase.showDrone();
      this._showcase.setDroneModel(this._selectedDrone);
      this._showcase.setWeapons(this._selectedWeapons[0] || null, this._selectedWeapons[1] || null);
    }
  }

  _renderTab() {
    if (!this._contentEl) return;
    this._contentEl.innerHTML = '';
    if (this._tab === 'drone') this._renderDroneTab();
    else                       this._renderWeaponsTab();
  }

  // ── Drone tab ──────────────────────────────────────────────────────────────

  _renderDroneTab() {
    for (const model of DRONE_MODELS) {
      const owned  = this._roguelite.isDroneUnlocked(model.id);
      const afford = this._roguelite.coins >= model.cost;
      const card   = this._buildDroneCard(model, owned, afford);
      this._contentEl.appendChild(card);
    }
  }

  _buildDroneCard(model, owned, afford) {
    const isSelected = this._selectedDrone === model.id;
    const div = document.createElement('div');
    div.className = 'lo-card lo-drone-card' + (isSelected ? ' lo-card--selected' : '') + (!owned && !afford ? ' lo-card--locked' : '');
    div.style.cssText = 'width:100%;max-width:340px;display:flex;align-items:center;gap:12px;padding:12px 14px;text-align:left;';

    // Icon
    const iconEl = document.createElement('div');
    iconEl.style.cssText = 'font-size:1.8rem;flex-shrink:0;';
    iconEl.textContent = DRONE_ICONS[model.id] || '🔷';
    div.appendChild(iconEl);

    // Info
    const info = document.createElement('div');
    info.style.cssText = 'flex:1;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:.9rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;';
    nameEl.textContent = t(model.nameKey) || model.id.toUpperCase();

    const descEl = document.createElement('div');
    descEl.style.cssText = 'font-size:.7rem;color:rgba(255,255,255,.55);margin-top:2px;line-height:1.3;';
    descEl.textContent = t(model.descKey) || '';

    // Stat pills
    const statsEl = document.createElement('div');
    statsEl.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:5px;';
    const statDefs = [
      { label: `❤ ${model.maxHp} HP`, color: '#FF6666' },
      { label: `⚡ ${Math.round(model.speedMult * 100)}% SPD`, color: '#66CCFF' },
      ...(model.dualCannon ? [{ label: '× 2 CANNON', color: '#FFE28A' }] : []),
    ];
    for (const s of statDefs) {
      const pill = document.createElement('span');
      pill.style.cssText = `font-size:.6rem;font-weight:700;letter-spacing:.08em;padding:2px 6px;border-radius:3px;background:rgba(255,255,255,.08);color:${s.color};`;
      pill.textContent = s.label;
      statsEl.appendChild(pill);
    }

    info.appendChild(nameEl);
    info.appendChild(descEl);
    info.appendChild(statsEl);
    div.appendChild(info);

    // Right badge
    const badge = document.createElement('div');
    badge.style.cssText = 'font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;flex-shrink:0;';
    if (isSelected) {
      badge.style.color = '#297BFF';
      badge.textContent = '✓';
    } else if (owned || model.id === 'wasp') {
      badge.style.color = 'rgba(255,255,255,.3)';
      badge.textContent = '';
    } else {
      badge.style.color = afford ? '#FFE28A' : 'rgba(255,255,255,.3)';
      badge.textContent = `⬡ ${model.cost}`;
    }
    div.appendChild(badge);

    div.addEventListener('pointerdown', () => {
      bus.emit('ui:click');
      if (owned || model.id === 'wasp') {
        this._selectedDrone = model.id;
        this._showcase.setDroneModel(model.id);
        this._renderTab();
      } else if (afford) {
        if (this._roguelite.droneBuy(model.id)) {
          this._selectedDrone = model.id;
          this._showcase.setDroneModel(model.id);
          this._renderTab();
        }
      }
    });

    return div;
  }

  // ── Weapons tab ────────────────────────────────────────────────────────────

  _renderWeaponsTab() {
    // Slot display
    const slotRow = document.createElement('div');
    slotRow.className = 'lo-slots';
    slotRow.innerHTML = `
      <span class="lo-slot-label">${t('loadout.slot') || 'Slot'} 1:</span>
      <span class="lo-slot" id="lo-slot-a">${this._selectedWeapons[0] ? (WEAPON_ICONS[this._selectedWeapons[0]] + ' ' + (t('ws.' + this._selectedWeapons[0] + '.name') || '')) : '—'}</span>
      <span class="lo-slot-label">${t('loadout.slot') || 'Slot'} 2:</span>
      <span class="lo-slot" id="lo-slot-b">${this._selectedWeapons[1] ? (WEAPON_ICONS[this._selectedWeapons[1]] + ' ' + (t('ws.' + this._selectedWeapons[1] + '.name') || '')) : '—'}</span>
    `;
    this._contentEl.appendChild(slotRow);

    const unlocked = WEAPON_IDS.filter(w => this._roguelite.isWorkshopUnlocked('unlock_' + w));

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;width:100%;';

    if (unlocked.length === 0) {
      const msg = document.createElement('p');
      msg.style.cssText = 'color:rgba(255,255,255,.5);font-size:.85rem;text-align:center;grid-column:1/-1;';
      msg.textContent = t('loadout.noWeapons') || 'No weapons unlocked yet.';
      grid.appendChild(msg);
    } else {
      for (const w of unlocked) {
        grid.appendChild(this._buildWeaponCard(w));
      }
    }
    this._contentEl.appendChild(grid);
  }

  _buildWeaponCard(weaponType) {
    const isSelected = this._selectedWeapons.includes(weaponType);
    const div = document.createElement('div');
    div.className = 'lo-card' + (isSelected ? ' lo-card--selected' : '');

    const icon = document.createElement('div');
    icon.className = 'lo-card-icon';
    icon.textContent = WEAPON_ICONS[weaponType] || '🔫';

    const name = document.createElement('div');
    name.className = 'lo-card-name';
    name.textContent = t(`ws.${weaponType}.name`) || weaponType.toUpperCase();

    div.appendChild(icon);
    div.appendChild(name);

    div.addEventListener('pointerdown', () => {
      bus.emit('ui:click');
      this._toggleWeapon(weaponType);
      this._showcase.showWeaponPreview(weaponType);
    });

    return div;
  }

  _toggleWeapon(weaponType) {
    const idx = this._selectedWeapons.indexOf(weaponType);
    if (idx >= 0) {
      this._selectedWeapons.splice(idx, 1);
    } else if (this._selectedWeapons.length < 2) {
      this._selectedWeapons.push(weaponType);
    } else {
      this._selectedWeapons.shift();
      this._selectedWeapons.push(weaponType);
    }
    this._renderTab();
    this._showcase.setWeapons(this._selectedWeapons[0] || null, this._selectedWeapons[1] || null);
  }
}
