import { bus }  from '../core/EventBus.js';
import { t }    from '../core/i18n.js';
import { WORKSHOP_ITEMS, DRONE_MODELS, WORKSHOP_ITEMS as _WS } from '../systems/RogueliteManager.js';

// ── Inline SVG icons ─────────────────────────────────────────────────────────

const DRONE_SVG = {
  wasp: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="24" y1="8"  x2="8"  y2="24" stroke="#4A9FFF" stroke-width="3" stroke-linecap="round"/>
    <line x1="24" y1="8"  x2="40" y2="24" stroke="#4A9FFF" stroke-width="3" stroke-linecap="round"/>
    <line x1="24" y1="40" x2="8"  y2="24" stroke="#4A9FFF" stroke-width="3" stroke-linecap="round"/>
    <line x1="24" y1="40" x2="40" y2="24" stroke="#4A9FFF" stroke-width="3" stroke-linecap="round"/>
    <circle cx="8"  cy="24" r="4" fill="#4A9FFF"/>
    <circle cx="40" cy="24" r="4" fill="#4A9FFF"/>
    <circle cx="24" cy="8"  r="4" fill="#4A9FFF"/>
    <circle cx="24" cy="40" r="4" fill="#4A9FFF"/>
    <circle cx="24" cy="24" r="5" fill="#99CCFF"/>
  </svg>`,
  hornet: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="24" y1="6"  x2="6"  y2="24" stroke="#FF8800" stroke-width="4" stroke-linecap="round"/>
    <line x1="24" y1="6"  x2="42" y2="24" stroke="#FF8800" stroke-width="4" stroke-linecap="round"/>
    <line x1="24" y1="42" x2="6"  y2="24" stroke="#FF8800" stroke-width="4" stroke-linecap="round"/>
    <line x1="24" y1="42" x2="42" y2="24" stroke="#FF8800" stroke-width="4" stroke-linecap="round"/>
    <circle cx="6"  cy="24" r="5" fill="#FF8800"/>
    <circle cx="42" cy="24" r="5" fill="#FF8800"/>
    <circle cx="24" cy="6"  r="5" fill="#FF8800"/>
    <circle cx="24" cy="42" r="5" fill="#FF8800"/>
    <circle cx="24" cy="24" r="6" fill="#FFCC66"/>
  </svg>`,
  reaper: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="24" y1="6"  x2="6"  y2="24" stroke="#AA44FF" stroke-width="3" stroke-linecap="round"/>
    <line x1="24" y1="6"  x2="42" y2="24" stroke="#AA44FF" stroke-width="3" stroke-linecap="round"/>
    <line x1="24" y1="42" x2="6"  y2="24" stroke="#AA44FF" stroke-width="3" stroke-linecap="round"/>
    <line x1="24" y1="42" x2="42" y2="24" stroke="#AA44FF" stroke-width="3" stroke-linecap="round"/>
    <line x1="8"  y1="10" x2="40" y2="38" stroke="#AA44FF" stroke-width="3" stroke-linecap="round"/>
    <line x1="40" y1="10" x2="8"  y2="38" stroke="#AA44FF" stroke-width="3" stroke-linecap="round"/>
    <circle cx="6"  cy="24" r="4" fill="#AA44FF"/>
    <circle cx="42" cy="24" r="4" fill="#AA44FF"/>
    <circle cx="24" cy="6"  r="4" fill="#AA44FF"/>
    <circle cx="24" cy="42" r="4" fill="#AA44FF"/>
    <circle cx="24" cy="24" r="5" fill="#CC88FF"/>
  </svg>`,
};

const WEAPON_SVG = {
  bomb: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="28" r="14" fill="#444"/>
    <polygon points="16,38 32,38 24,48" fill="#333"/>
    <rect x="21" y="8" width="6" height="10" rx="2" fill="#555"/>
    <circle cx="24" cy="8" r="3" fill="#FF8800"/>
  </svg>`,
  missile: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="20" width="28" height="8" rx="3" fill="#CC6600"/>
    <polygon points="36,20 36,28 46,24" fill="#FF4400"/>
    <polygon points="8,20 8,28 2,32" fill="#884400"/>
    <polygon points="8,20 8,28 2,16" fill="#884400"/>
    <ellipse cx="9" cy="24" rx="3" ry="2.5" fill="#FF6600"/>
  </svg>`,
  emp: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="18" stroke="#00CCFF" stroke-width="2.5" fill="none"/>
    <circle cx="24" cy="24" r="10" stroke="#44DDFF" stroke-width="2" fill="none"/>
    <circle cx="24" cy="24" r="4" fill="#AAFFFF"/>
    <polygon points="26,8 20,22 24,22 18,40 28,22 24,22" fill="#00FFFF"/>
  </svg>`,
  cluster: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="10" fill="#4A6A3A"/>
    <circle cx="24" cy="8"  r="5" fill="#FF5500"/>
    <circle cx="24" cy="40" r="5" fill="#FF5500"/>
    <circle cx="8"  cy="24" r="5" fill="#FF5500"/>
    <circle cx="40" cy="24" r="5" fill="#FF5500"/>
    <circle cx="11" cy="11" r="4" fill="#FF5500"/>
    <circle cx="37" cy="37" r="4" fill="#FF5500"/>
  </svg>`,
};

const UPGRADE_SVG = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polygon points="24,4 42,14 42,34 24,44 6,34 6,14" stroke="#FFE28A" stroke-width="2.5" fill="none"/>
  <polygon points="24,12 36,18 36,30 24,36 12,30 12,18" stroke="#FFE28A" stroke-width="1.5" fill="none" opacity=".4"/>
</svg>`;

export class WorkshopScreen {
  constructor() {
    this._el         = null;
    this._coinsEl    = null;
    this._contentEl  = null;
    this._tabBar     = null;
    this._roguelite  = null;
    this._activeTab  = 'drones';
  }

  init(roguelite) {
    this._roguelite = roguelite;
    this._el        = document.getElementById('screen-workshop');
    this._coinsEl   = document.getElementById('workshop-coins');
    this._contentEl = document.getElementById('ws-tab-content');
    this._tabBar    = document.getElementById('ws-tab-bar');

    // Continue / close button
    const continueBtn = document.getElementById('btn-workshop-continue');
    if (continueBtn) {
      continueBtn.addEventListener('pointerdown', () => {
        bus.emit('ui:click');
        bus.emit('workshop:continue');
      });
    }

    // Tab switching
    if (this._tabBar) {
      this._tabBar.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.shop-tab');
        if (!btn) return;
        bus.emit('ui:click');
        this._activeTab = btn.dataset.tab;
        this._updateTabBar();
        this._renderContent();
      });
    }
  }

  show() {
    this._activeTab = 'drones';
    this._updateCoins();
    this._updateTabBar();
    this._renderContent();
    if (this._el) this._el.style.display = 'flex';
  }

  hide() {
    if (this._el) this._el.style.display = 'none';
  }

  _updateCoins() {
    if (this._coinsEl) this._coinsEl.textContent = this._roguelite?.coins ?? 0;
  }

  _updateTabBar() {
    if (!this._tabBar) return;
    for (const btn of this._tabBar.querySelectorAll('.shop-tab')) {
      btn.classList.toggle('active', btn.dataset.tab === this._activeTab);
    }
  }

  _renderContent() {
    if (!this._contentEl) return;
    this._contentEl.innerHTML = '';
    if (this._activeTab === 'drones')   this._renderDrones();
    else if (this._activeTab === 'weapons') this._renderWeapons();
    else this._renderUpgrades();
  }

  // ── Drones tab ───────────────────────────────────────────────────────────

  _renderDrones() {
    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    for (const model of DRONE_MODELS) {
      if (model.id === 'wasp') continue; // always free — show as owned
      grid.appendChild(this._makeDroneCard(model));
    }
    // Also add Wasp as always-owned first
    grid.insertBefore(this._makeDroneCard(DRONE_MODELS[0]), grid.firstChild);

    this._contentEl.appendChild(grid);
  }

  _makeDroneCard(model) {
    const owned  = this._roguelite.isDroneUnlocked(model.id) || model.id === 'wasp';
    const afford = this._roguelite.coins >= model.cost;

    const card = document.createElement('div');
    card.className = 'shop-card' + (owned ? ' shop-card--owned' : (!afford ? ' shop-card--locked' : ''));

    if (owned) {
      const corner = document.createElement('span');
      corner.className = 'shop-card-owned-corner';
      corner.textContent = '✓';
      card.appendChild(corner);
    }

    const iconEl = document.createElement('div');
    iconEl.className = 'shop-card-icon';
    iconEl.innerHTML = DRONE_SVG[model.id] || DRONE_SVG.wasp;
    card.appendChild(iconEl);

    const nameEl = document.createElement('div');
    nameEl.className = 'shop-card-name';
    nameEl.textContent = t(model.nameKey) || model.id.toUpperCase();
    card.appendChild(nameEl);

    const stat = document.createElement('div');
    stat.className = 'shop-card-stat';
    stat.textContent = `${model.maxHp} HP · ${Math.round(model.speedMult * 100)}% SPD`;
    card.appendChild(stat);

    const foot = document.createElement('div');
    foot.className = 'shop-card-foot';
    if (owned) {
      const badge = document.createElement('span');
      badge.className = 'shop-card-owned-badge';
      badge.textContent = t('ws.owned') || 'OWNED';
      foot.appendChild(badge);
    } else {
      const btn = document.createElement('span');
      btn.className = 'shop-card-buy' + (afford ? '' : ' shop-card-buy--broke');
      btn.textContent = `⬡ ${model.cost}`;
      foot.appendChild(btn);
    }
    card.appendChild(foot);

    if (!owned) {
      card.addEventListener('pointerdown', () => {
        if (!afford) return;
        if (this._roguelite.droneBuy(model.id)) {
          bus.emit('ui:click');
          this._updateCoins();
          this._renderContent();
        }
      });
    }

    return card;
  }

  // ── Weapons tab ──────────────────────────────────────────────────────────

  _renderWeapons() {
    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    const weaponItems = WORKSHOP_ITEMS.filter(i => i.category === 'WEAPON');
    for (const item of weaponItems) {
      grid.appendChild(this._makeWeaponCard(item));
    }

    this._contentEl.appendChild(grid);
  }

  _makeWeaponCard(item) {
    const owned  = this._roguelite.isWorkshopUnlocked(item.id);
    const afford = this._roguelite.coins >= item.cost;
    const weaponId = item.id.replace('unlock_', '');

    const card = document.createElement('div');
    card.className = 'shop-card' + (owned ? ' shop-card--owned' : (!afford ? ' shop-card--locked' : ''));

    if (owned) {
      const corner = document.createElement('span');
      corner.className = 'shop-card-owned-corner';
      corner.textContent = '✓';
      card.appendChild(corner);
    }

    const iconEl = document.createElement('div');
    iconEl.className = 'shop-card-icon';
    iconEl.innerHTML = WEAPON_SVG[weaponId] || UPGRADE_SVG;
    card.appendChild(iconEl);

    const nameEl = document.createElement('div');
    nameEl.className = 'shop-card-name';
    nameEl.textContent = t(item.nameKey) || item.id;
    card.appendChild(nameEl);

    const cat = document.createElement('div');
    cat.className = 'shop-card-stat';
    cat.textContent = item.category;
    card.appendChild(cat);

    const foot = document.createElement('div');
    foot.className = 'shop-card-foot';
    if (owned) {
      const badge = document.createElement('span');
      badge.className = 'shop-card-owned-badge';
      badge.textContent = t('ws.owned') || 'OWNED';
      foot.appendChild(badge);
    } else {
      const btn = document.createElement('span');
      btn.className = 'shop-card-buy' + (afford ? '' : ' shop-card-buy--broke');
      btn.textContent = `⬡ ${item.cost}`;
      foot.appendChild(btn);
    }
    card.appendChild(foot);

    if (!owned) {
      card.addEventListener('pointerdown', () => {
        if (!afford) return;
        if (this._roguelite.workshopBuy(item.id)) {
          bus.emit('ui:click');
          this._updateCoins();
          this._renderContent();
        }
      });
    }

    return card;
  }

  // ── Upgrades tab ─────────────────────────────────────────────────────────

  _renderUpgrades() {
    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    const upgradeItems = WORKSHOP_ITEMS.filter(i => i.category !== 'WEAPON');
    for (const item of upgradeItems) {
      grid.appendChild(this._makeUpgradeCard(item));
    }

    this._contentEl.appendChild(grid);
  }

  _makeUpgradeCard(item) {
    const owned  = this._roguelite.isWorkshopUnlocked(item.id);
    const afford = this._roguelite.coins >= item.cost;

    const card = document.createElement('div');
    card.className = 'shop-card' + (owned ? ' shop-card--owned' : (!afford ? ' shop-card--locked' : ''));

    if (owned) {
      const corner = document.createElement('span');
      corner.className = 'shop-card-owned-corner';
      corner.textContent = '✓';
      card.appendChild(corner);
    }

    const iconEl = document.createElement('div');
    iconEl.className = 'shop-card-icon';
    iconEl.innerHTML = UPGRADE_SVG;
    card.appendChild(iconEl);

    const nameEl = document.createElement('div');
    nameEl.className = 'shop-card-name';
    nameEl.textContent = t(item.nameKey) || item.id;
    card.appendChild(nameEl);

    const cat = document.createElement('div');
    cat.className = 'shop-card-stat';
    cat.textContent = t(item.descKey) || item.category;
    card.appendChild(cat);

    const foot = document.createElement('div');
    foot.className = 'shop-card-foot';
    if (owned) {
      const badge = document.createElement('span');
      badge.className = 'shop-card-owned-badge';
      badge.textContent = t('ws.owned') || 'OWNED';
      foot.appendChild(badge);
    } else {
      const btn = document.createElement('span');
      btn.className = 'shop-card-buy' + (afford ? '' : ' shop-card-buy--broke');
      btn.textContent = `⬡ ${item.cost}`;
      foot.appendChild(btn);
    }
    card.appendChild(foot);

    if (!owned) {
      card.addEventListener('pointerdown', () => {
        if (!afford) return;
        if (this._roguelite.workshopBuy(item.id)) {
          bus.emit('ui:click');
          this._updateCoins();
          this._renderContent();
        }
      });
    }

    return card;
  }
}
