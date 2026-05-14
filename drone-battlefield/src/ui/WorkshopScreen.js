import { bus }             from '../core/EventBus.js';
import { t }               from '../core/i18n.js';
import { WORKSHOP_ITEMS, DRONE_MODELS } from '../systems/RogueliteManager.js';
import { DroneShowcase }   from './DroneShowcase.js';

const WEAPON_SVG = {
  missile: `<svg viewBox="0 0 80 36" xmlns="http://www.w3.org/2000/svg">
    <!-- body -->
    <rect x="12" y="14" width="46" height="8" rx="4" fill="#CC7700"/>
    <!-- nose cone -->
    <polygon points="58,14 58,22 74,18" fill="#FF4400"/>
    <!-- tail fins -->
    <polygon points="12,14 12,22 2,26" fill="#995500"/>
    <polygon points="12,14 12,22 2,10" fill="#995500"/>
    <!-- cross fins -->
    <rect x="18" y="8"  width="6" height="20" rx="1" fill="#885500" opacity=".8"/>
    <!-- engine glow -->
    <ellipse cx="13" cy="18" rx="4" ry="3" fill="#FF6600" opacity=".9"/>
    <ellipse cx="11" cy="18" rx="2" ry="1.5" fill="#FFCC00"/>
  </svg>`,

  bomb: `<svg viewBox="0 0 60 72" xmlns="http://www.w3.org/2000/svg">
    <!-- body -->
    <ellipse cx="30" cy="30" rx="20" ry="22" fill="#2A2A2A"/>
    <!-- warning stripe 1 -->
    <ellipse cx="30" cy="30" rx="20" ry="22" fill="none" stroke="#FFDD00" stroke-width="4" stroke-dasharray="8 6"/>
    <!-- nose -->
    <polygon points="18,50 42,50 30,66" fill="#1A1A1A"/>
    <!-- top cap -->
    <rect x="24" y="6" width="12" height="7" rx="3" fill="#333"/>
    <!-- fuse -->
    <path d="M30 6 Q38 0 36 -4" stroke="#FFAA00" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="36" cy="-4" r="2.5" fill="#FF6600"/>
  </svg>`,

  emp: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <!-- outer ring -->
    <circle cx="40" cy="40" r="34" fill="none" stroke="#00CCFF" stroke-width="3.5" opacity=".9"/>
    <!-- mid ring -->
    <circle cx="40" cy="40" r="23" fill="none" stroke="#44DDFF" stroke-width="2.5" opacity=".75" transform="rotate(40 40 40)"/>
    <!-- inner ring -->
    <circle cx="40" cy="40" r="13" fill="none" stroke="#88FFFF" stroke-width="2" opacity=".65"/>
    <!-- core -->
    <circle cx="40" cy="40" r="6" fill="#AAFFFF"/>
    <circle cx="40" cy="40" r="3" fill="#fff"/>
    <!-- spark lines -->
    <line x1="40" y1="2"  x2="40" y2="10" stroke="#00CCFF" stroke-width="2" opacity=".6"/>
    <line x1="40" y1="70" x2="40" y2="78" stroke="#00CCFF" stroke-width="2" opacity=".6"/>
    <line x1="2"  y1="40" x2="10" y2="40" stroke="#00CCFF" stroke-width="2" opacity=".6"/>
    <line x1="70" y1="40" x2="78" y2="40" stroke="#00CCFF" stroke-width="2" opacity=".6"/>
  </svg>`,

  cluster: `<svg viewBox="0 0 70 80" xmlns="http://www.w3.org/2000/svg">
    <!-- main canister -->
    <rect x="20" y="22" width="30" height="36" rx="5" fill="#4A5A3A"/>
    <!-- cap bottom -->
    <rect x="22" y="56" width="26" height="10" rx="3" fill="#3A4A2A"/>
    <!-- cap top -->
    <rect x="24" y="14" width="22" height="10" rx="3" fill="#3A4A2A"/>
    <!-- submunitions bursting out -->
    <circle cx="12" cy="22" r="6" fill="#FF5500"/>
    <circle cx="58" cy="22" r="6" fill="#FF5500"/>
    <circle cx="8"  cy="42" r="5" fill="#FF5500"/>
    <circle cx="62" cy="42" r="5" fill="#FF5500"/>
    <circle cx="18" cy="10" r="5" fill="#FF5500"/>
    <circle cx="52" cy="10" r="5" fill="#FF5500"/>
    <!-- glow dots -->
    <circle cx="12" cy="22" r="3" fill="#FFAA44" opacity=".7"/>
    <circle cx="58" cy="22" r="3" fill="#FFAA44" opacity=".7"/>
  </svg>`,
};

const DRONE_SVG = {
  wasp: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="40" cy="40" rx="14" ry="8" fill="#1A1A2A"/>
    <ellipse cx="40" cy="38" rx="9" ry="5" fill="#2A2A3E"/>
    <circle  cx="40" cy="44" r="4" fill="#0A0A14"/>
    <line x1="40" y1="40" x2="14" y2="28" stroke="#2A2A3E" stroke-width="3" stroke-linecap="round"/>
    <line x1="40" y1="40" x2="66" y2="28" stroke="#2A2A3E" stroke-width="3" stroke-linecap="round"/>
    <line x1="40" y1="40" x2="14" y2="52" stroke="#2A2A3E" stroke-width="3" stroke-linecap="round"/>
    <line x1="40" y1="40" x2="66" y2="52" stroke="#2A2A3E" stroke-width="3" stroke-linecap="round"/>
    <circle cx="14" cy="28" r="5" fill="#111118"/><circle cx="14" cy="28" r="6.5" fill="none" stroke="#333348" stroke-width="2" opacity=".8"/>
    <circle cx="66" cy="28" r="5" fill="#111118"/><circle cx="66" cy="28" r="6.5" fill="none" stroke="#333348" stroke-width="2" opacity=".8"/>
    <circle cx="14" cy="52" r="5" fill="#111118"/><circle cx="14" cy="52" r="6.5" fill="none" stroke="#333348" stroke-width="2" opacity=".8"/>
    <circle cx="66" cy="52" r="5" fill="#111118"/><circle cx="66" cy="52" r="6.5" fill="none" stroke="#333348" stroke-width="2" opacity=".8"/>
    <circle cx="40" cy="36" r="2" fill="#44AAFF"/>
  </svg>`,

  hornet: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="40" cy="40" rx="17" ry="9" fill="#2A1A00"/>
    <ellipse cx="40" cy="38" rx="11" ry="6" fill="#3A2800"/>
    <circle  cx="40" cy="45" r="5" fill="#0A0800"/>
    <line x1="40" y1="40" x2="10" y2="24" stroke="#CC6600" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="40" y1="40" x2="70" y2="24" stroke="#CC6600" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="40" y1="40" x2="10" y2="40" stroke="#CC6600" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="40" y1="40" x2="70" y2="40" stroke="#CC6600" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="40" y1="40" x2="10" y2="56" stroke="#CC6600" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="40" y1="40" x2="70" y2="56" stroke="#CC6600" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="10" cy="24" r="6" fill="#1A1000"/><circle cx="10" cy="24" r="7.5" fill="none" stroke="#CC6600" stroke-width="2" opacity=".7"/>
    <circle cx="70" cy="24" r="6" fill="#1A1000"/><circle cx="70" cy="24" r="7.5" fill="none" stroke="#CC6600" stroke-width="2" opacity=".7"/>
    <circle cx="10" cy="40" r="6" fill="#1A1000"/><circle cx="10" cy="40" r="7.5" fill="none" stroke="#CC6600" stroke-width="2" opacity=".7"/>
    <circle cx="70" cy="40" r="6" fill="#1A1000"/><circle cx="70" cy="40" r="7.5" fill="none" stroke="#CC6600" stroke-width="2" opacity=".7"/>
    <circle cx="10" cy="56" r="6" fill="#1A1000"/><circle cx="10" cy="56" r="7.5" fill="none" stroke="#CC6600" stroke-width="2" opacity=".7"/>
    <circle cx="70" cy="56" r="6" fill="#1A1000"/><circle cx="70" cy="56" r="7.5" fill="none" stroke="#CC6600" stroke-width="2" opacity=".7"/>
    <circle cx="40" cy="37" r="2.5" fill="#FF8800"/>
  </svg>`,

  reaper: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="40" cy="40" rx="11" ry="6" fill="#0C0A14"/>
    <rect x="37" y="24" width="6" height="16" rx="2" fill="#1A0A2A"/>
    <rect x="27" y="35" width="9" height="5" rx="1" fill="#0C0A14"/>
    <rect x="44" y="35" width="9" height="5" rx="1" fill="#0C0A14"/>
    <rect x="28" y="37" width="2" height="3" rx="1" fill="#8800FF" opacity=".9"/>
    <rect x="50" y="37" width="2" height="3" rx="1" fill="#8800FF" opacity=".9"/>
    <line x1="40" y1="40" x2="13" y2="25" stroke="#1A0A2A" stroke-width="3" stroke-linecap="round"/>
    <line x1="40" y1="40" x2="67" y2="25" stroke="#1A0A2A" stroke-width="3" stroke-linecap="round"/>
    <line x1="40" y1="40" x2="13" y2="55" stroke="#1A0A2A" stroke-width="3" stroke-linecap="round"/>
    <line x1="40" y1="40" x2="67" y2="55" stroke="#1A0A2A" stroke-width="3" stroke-linecap="round"/>
    <circle cx="13" cy="25" r="5.5" fill="#080610"/><circle cx="13" cy="25" r="6.5" fill="none" stroke="#8800FF" stroke-width="2" opacity=".8"/>
    <circle cx="67" cy="25" r="5.5" fill="#080610"/><circle cx="67" cy="25" r="6.5" fill="none" stroke="#8800FF" stroke-width="2" opacity=".8"/>
    <circle cx="13" cy="55" r="5.5" fill="#080610"/><circle cx="13" cy="55" r="6.5" fill="none" stroke="#8800FF" stroke-width="2" opacity=".8"/>
    <circle cx="67" cy="55" r="5.5" fill="#080610"/><circle cx="67" cy="55" r="6.5" fill="none" stroke="#8800FF" stroke-width="2" opacity=".8"/>
    <ellipse cx="40" cy="39" rx="5" ry="2.5" fill="#8800FF" opacity=".6"/>
    <circle  cx="40" cy="39" r="2" fill="#CC44FF"/>
  </svg>`,
};

/**
 * WorkshopScreen — permanent upgrade shop between runs.
 * Shows coin balance, all purchasable items (locked/unlocked), and a Continue button.
 * Emits: workshop:continue
 */
export class WorkshopScreen {
  constructor() {
    this._el         = null;
    this._coinsEl    = null;
    this._gridEl     = null;
    this._continueEl = null;
    this._roguelite  = null;
    this._showcase   = new DroneShowcase();
  }

  init(roguelite) {
    this._roguelite = roguelite;
    this._el        = document.getElementById('screen-workshop');
    this._coinsEl   = document.getElementById('workshop-coins');
    this._gridEl    = document.getElementById('workshop-grid');
    this._continueEl = document.getElementById('btn-workshop-continue');

    this._showcase.init('ws-showcase-canvas', 'ws-showcase-labels');

    if (this._continueEl) {
      this._continueEl.addEventListener('pointerdown', () => {
        bus.emit('ui:click');
        bus.emit('workshop:continue');
      });
    }
  }

  show() {
    this._render();
    if (this._el) this._el.style.display = 'flex';
    // Show selected drone model in showcase
    const droneId = this._roguelite?.selectedDrone ?? 'wasp';
    this._showcase.setDroneModel(droneId);
    const loadout = this._roguelite?.loadout ?? [];
    this._showcase.setWeapons(loadout[0] || null, loadout[1] || null);
    this._showcase.start();
  }

  hide() {
    if (this._el) this._el.style.display = 'none';
    this._showcase.stop();
  }

  _render() {
    if (!this._roguelite) return;

    if (this._coinsEl) {
      this._coinsEl.textContent = this._roguelite.coins;
    }

    if (!this._gridEl) return;
    this._gridEl.innerHTML = '';

    // ── Drone section ──
    const droneHeader = document.createElement('div');
    droneHeader.style.cssText = 'width:100%;font-size:.6rem;font-weight:700;letter-spacing:.15em;color:rgba(255,255,255,.35);text-transform:uppercase;padding:2px 0 6px;grid-column:1/-1;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:2px;';
    droneHeader.textContent = t('ws.sectionDrones') || 'Drones';
    this._gridEl.appendChild(droneHeader);

    for (const model of DRONE_MODELS) {
      if (model.id === 'wasp') continue; // always free, not purchasable
      const owned  = this._roguelite.isDroneUnlocked(model.id);
      const afford = this._roguelite.coins >= model.cost;
      const card   = this._buildDroneCard(model, owned, afford);
      this._gridEl.appendChild(card);
    }

    // ── Weapons / upgrades section ──
    const upgHeader = document.createElement('div');
    upgHeader.style.cssText = droneHeader.style.cssText;
    upgHeader.textContent = t('ws.sectionUpgrades') || 'Upgrades';
    this._gridEl.appendChild(upgHeader);

    for (const item of WORKSHOP_ITEMS) {
      const owned  = this._roguelite.isWorkshopUnlocked(item.id);
      const afford = this._roguelite.coins >= item.cost;
      const card   = this._buildCard(item, owned, afford);
      this._gridEl.appendChild(card);
    }
  }

  _buildDroneCard(model, owned, afford) {
    const div = document.createElement('div');
    div.className = 'ws-card ws-drone-card' + (owned ? ' ws-card--owned' : '') + (!afford && !owned ? ' ws-card--locked' : '');

    // SVG preview
    const preview = document.createElement('div');
    preview.className = 'ws-card-preview';
    preview.innerHTML = DRONE_SVG[model.id] || '';
    div.appendChild(preview);

    const nameEl = document.createElement('div');
    nameEl.className = 'ws-card-name';
    nameEl.textContent = t(model.nameKey) || model.id.toUpperCase();

    const catEl = document.createElement('div');
    catEl.className = 'ws-card-cat';
    catEl.textContent = 'DRONE';

    const descEl = document.createElement('div');
    descEl.className = 'ws-card-desc';
    descEl.textContent = t(model.descKey) || '';

    const footEl = document.createElement('div');
    footEl.className = 'ws-card-foot';
    if (owned) {
      footEl.innerHTML = `<span class="ws-owned-badge">${t('ws.owned') || 'OWNED'}</span>`;
    } else {
      const costEl = document.createElement('span');
      costEl.className = 'ws-cost' + (afford ? '' : ' ws-cost--broke');
      costEl.textContent = `⬡ ${model.cost}`;
      footEl.appendChild(costEl);
    }

    div.appendChild(nameEl);
    div.appendChild(catEl);
    div.appendChild(descEl);
    div.appendChild(footEl);

    if (!owned) {
      div.addEventListener('pointerdown', () => {
        this._showcase.showWeaponPreview && this._showcase.setDroneModel(model.id);
        if (afford && this._roguelite.droneBuy(model.id)) {
          bus.emit('ui:click');
          this._render();
          this._showcase.setDroneModel(model.id);
        }
      });
    } else {
      div.addEventListener('pointerdown', () => {
        this._showcase.setDroneModel(model.id);
      });
    }

    return div;
  }

  _injectBuyButton(item, cardEl) {
    // Grab the info panel from the showcase and append a buy button
    const panel = this._showcase._infoPanel;
    if (!panel) return;
    // Remove any existing buy btn first
    panel.querySelector('.ws-buy-btn')?.remove();

    const afford = this._roguelite.coins >= item.cost;
    const btn = document.createElement('button');
    btn.className = 'ws-buy-btn';
    btn.style.cssText = `
      margin-top:6px; padding:6px 14px; border-radius:6px;
      background:${afford ? 'rgba(41,123,255,.85)' : 'rgba(255,255,255,.12)'};
      border:1px solid ${afford ? '#297BFF' : 'rgba(255,255,255,.2)'};
      color:${afford ? '#fff' : 'rgba(255,255,255,.35)'};
      font-family:inherit; font-size:.7rem; letter-spacing:.1em;
      text-transform:uppercase; cursor:${afford ? 'pointer' : 'default'};
      pointer-events:auto;
    `;
    btn.textContent = afford ? `Buy  ⬡ ${item.cost}` : `Need ⬡ ${item.cost}`;
    if (afford) {
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (this._roguelite.workshopBuy(item.id)) {
          bus.emit('ui:click');
          this._showcase.showDrone();
          this._render();
        }
      });
    }
    panel.appendChild(btn);
  }

  _buildCard(item, owned, afford) {
    const div = document.createElement('div');
    div.className = 'ws-card' + (owned ? ' ws-card--owned' : '') + (!afford && !owned ? ' ws-card--locked' : '');

    // Weapon mini-preview SVG (only for weapon unlock items)
    const weaponId = item.id.replace('unlock_', '');
    const isWeapon = ['missile', 'bomb', 'emp', 'cluster'].includes(weaponId);
    if (isWeapon) {
      const preview = document.createElement('div');
      preview.className = 'ws-card-preview';
      preview.innerHTML = WEAPON_SVG[weaponId] || '';
      div.appendChild(preview);
    }

    const nameEl = document.createElement('div');
    nameEl.className = 'ws-card-name';
    nameEl.textContent = t(item.nameKey) || item.id;

    const catEl = document.createElement('div');
    catEl.className = 'ws-card-cat';
    catEl.textContent = item.category;

    const descEl = document.createElement('div');
    descEl.className = 'ws-card-desc';
    descEl.textContent = t(item.descKey) || '';

    const footEl = document.createElement('div');
    footEl.className = 'ws-card-foot';

    if (owned) {
      footEl.innerHTML = `<span class="ws-owned-badge">${t('ws.owned') || 'OWNED'}</span>`;
    } else {
      const costEl = document.createElement('span');
      costEl.className = 'ws-cost' + (afford ? '' : ' ws-cost--broke');
      costEl.textContent = `⬡ ${item.cost}`;
      footEl.appendChild(costEl);
    }

    div.appendChild(nameEl);
    div.appendChild(catEl);
    div.appendChild(descEl);
    div.appendChild(footEl);

    // Weapon items: tap shows 3D preview; non-weapon items buy immediately

    if (!owned) {
      div.addEventListener('pointerdown', () => {
        if (isWeapon) {
          this._showcase.showWeaponPreview(weaponId);
          this._injectBuyButton(item, div);
        } else {
          if (this._roguelite.workshopBuy(item.id)) {
            bus.emit('ui:click');
            this._render();
          }
        }
      });
    } else if (isWeapon) {
      // Owned weapon: tapping still shows preview
      div.addEventListener('pointerdown', () => {
        this._showcase.showWeaponPreview(weaponId);
      });
    }

    return div;
  }
}
