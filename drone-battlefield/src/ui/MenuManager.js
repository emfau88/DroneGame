import { bus } from '../core/EventBus.js';
import { t }   from '../core/i18n.js';

/**
 * MenuManager — start, upgrade select, run-over, run-win screens.
 * Emits: menu:newRun, menu:mainMenu, upgrade:cardSelected
 */
export class MenuManager {
  constructor() {
    this._state = null;

    this._startScreenEl    = null;
    this._upgradeScreenEl  = null;
    this._runOverScreenEl  = null;
    this._runWinScreenEl   = null;

    this._playBtnEl = null;

    this._upgradeMapLabelEl = null;
    this._upgradeCardsEl    = null;

    this._statMapsEl    = null;
    this._statKillsEl   = null;
    this._statTimeEl    = null;
    this._metaBlockEl   = null;
    this._metaNameEl    = null;
    this._metaDescEl    = null;
    this._runOverNewBtn = null;
    this._runOverMenuBtn = null;

    this._winStatKillsEl = null;
    this._winStatTimeEl  = null;
    this._winMetaBlockEl = null;
    this._winMetaNameEl  = null;
    this._winMetaDescEl  = null;
    this._runWinNewBtn   = null;
    this._runWinMenuBtn  = null;

    // Reroll state — one reroll per upgrade screen
    this._rerollUsed = false;
    this._currentUpgradeChoices = null;
    this._currentOwnedIds = null;
    this._currentOnDone = null;
    this._currentMapLabel = null;
  }

  init(state) {
    this._state = state;

    this._startScreenEl   = document.getElementById('screen-start');
    this._upgradeScreenEl = document.getElementById('screen-upgrade');
    this._runOverScreenEl = document.getElementById('screen-run-over');
    this._runWinScreenEl  = document.getElementById('screen-run-win');

    this._playBtnEl = document.getElementById('btn-play');

    this._upgradeMapLabelEl = document.getElementById('upgrade-map-label');
    this._upgradeCardsEl    = document.getElementById('upgrade-cards');

    this._statMapsEl  = document.getElementById('stat-maps');
    this._statKillsEl = document.getElementById('stat-kills');
    this._statTimeEl  = document.getElementById('stat-time');
    this._metaBlockEl = document.getElementById('meta-unlock-block');
    this._metaNameEl  = document.getElementById('meta-unlock-name');
    this._metaDescEl  = document.getElementById('meta-unlock-desc');
    this._runOverNewBtn  = document.getElementById('btn-run-over-new');
    this._runOverMenuBtn = document.getElementById('btn-run-over-menu');

    this._winStatKillsEl = document.getElementById('win-stat-kills');
    this._winStatTimeEl  = document.getElementById('win-stat-time');
    this._winMetaBlockEl = document.getElementById('win-meta-unlock-block');
    this._winMetaNameEl  = document.getElementById('win-meta-unlock-name');
    this._winMetaDescEl  = document.getElementById('win-meta-unlock-desc');
    this._runWinNewBtn   = document.getElementById('btn-run-win-new');
    this._runWinMenuBtn  = document.getElementById('btn-run-win-menu');

    this._wireButtons();
  }

  _wireButtons() {
    if (this._playBtnEl) {
      this._playBtnEl.addEventListener('pointerdown', () => {
        bus.emit('ui:click');
        bus.emit('menu:newRun');
      });
    }

    if (this._runOverNewBtn) {
      this._runOverNewBtn.addEventListener('pointerdown', () => {
        bus.emit('ui:click');
        bus.emit('menu:newRun');
        this.hideAll();
      });
    }
    if (this._runOverMenuBtn) {
      this._runOverMenuBtn.addEventListener('pointerdown', () => {
        bus.emit('ui:click');
        bus.emit('menu:mainMenu');
        this.hideAll();
        this.showStart();
      });
    }
    if (this._runWinNewBtn) {
      this._runWinNewBtn.addEventListener('pointerdown', () => {
        bus.emit('ui:click');
        bus.emit('menu:newRun');
        this.hideAll();
      });
    }
    if (this._runWinMenuBtn) {
      this._runWinMenuBtn.addEventListener('pointerdown', () => {
        bus.emit('ui:click');
        bus.emit('menu:mainMenu');
        this.hideAll();
        this.showStart();
      });
    }
  }

  /**
   * Show upgrade selection.
   * @param {string} mapLabel
   * @param {import('../data/upgrades.js').Upgrade[]} upgrades - the 3 choices
   * @param {string[]} ownedIds - upgrade IDs already active this run
   */
  showUpgradeSelect(mapLabel, upgrades, ownedIds = []) {
    this._rerollUsed = false;
    this._currentUpgradeChoices = upgrades;
    this._currentOwnedIds       = ownedIds;
    this._currentMapLabel       = mapLabel;

    this.hideAll();
    if (this._upgradeMapLabelEl) {
      this._upgradeMapLabelEl.textContent = mapLabel || '';
    }
    this._renderUpgradeCards(upgrades, ownedIds);
    if (this._upgradeScreenEl) this._upgradeScreenEl.style.display = 'flex';
  }

  _renderUpgradeCards(upgrades, ownedIds) {
    if (!this._upgradeCardsEl) return;
    this._upgradeCardsEl.innerHTML = '';

    const ownedSet = new Set(ownedIds);
    const allOwned = upgrades.every(u => ownedSet.has(u.id));

    for (const upgrade of upgrades) {
      const card = this._buildUpgradeCard(upgrade, ownedSet.has(upgrade.id));
      this._upgradeCardsEl.appendChild(card);
    }

    // Reroll option: show if all 3 are already owned and reroll not yet used
    if (allOwned && !this._rerollUsed) {
      const rerollCard = this._buildRerollCard();
      this._upgradeCardsEl.appendChild(rerollCard);
    }
  }

  _buildUpgradeCard(upgrade, isActive) {
    const div = document.createElement('div');
    div.className = 'upgrade-card';

    if (isActive) div.classList.add('upgrade-card--active');

    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = t(`upg.${upgrade.id}.name`) || upgrade.name;

    const cat = document.createElement('div');
    cat.className = 'card-cat';
    cat.textContent = upgrade.category;

    const desc = document.createElement('div');
    desc.className = 'card-desc';
    desc.textContent = t(`upg.${upgrade.id}.desc`) || upgrade.description;

    div.appendChild(name);
    div.appendChild(cat);
    div.appendChild(desc);

    if (isActive) {
      const badge = document.createElement('div');
      badge.className = 'card-active-badge';
      badge.textContent = t('upgrade.active') || 'ACTIVE';
      div.appendChild(badge);
    }

    div.addEventListener('pointerdown', () => {
      bus.emit('ui:click');
      bus.emit('upgrade:cardSelected', { upgradeId: upgrade.id });
    });

    return div;
  }

  _buildRerollCard() {
    const div = document.createElement('div');
    div.className = 'upgrade-card upgrade-card--reroll';

    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = t('upgrade.reroll');

    const desc = document.createElement('div');
    desc.className = 'card-desc';
    desc.textContent = t('upgrade.rerollDesc') || 'Draw 3 new choices. Once per upgrade screen.';

    div.appendChild(name);
    div.appendChild(desc);

    div.addEventListener('pointerdown', () => {
      bus.emit('ui:click');
      bus.emit('upgrade:reroll');
    });

    return div;
  }

  /** Called by Game when a reroll is requested. */
  rerollCards(newUpgrades, ownedIds) {
    this._rerollUsed = true;
    this._currentUpgradeChoices = newUpgrades;
    this._renderUpgradeCards(newUpgrades, ownedIds);
  }

  showRunOver(stats, metaUpgrade) {
    this.hideAll();

    const { mapsCleared, kills, startTime } = stats;
    const elapsed = (Date.now() - startTime) / 1000;
    const min = Math.floor(elapsed / 60);
    const sec = Math.floor(elapsed % 60).toString().padStart(2, '0');

    if (this._statMapsEl)  this._statMapsEl.textContent  = mapsCleared;
    if (this._statKillsEl) this._statKillsEl.textContent = kills;
    if (this._statTimeEl)  this._statTimeEl.textContent  = `${min}:${sec}`;

    if (this._metaBlockEl) {
      if (metaUpgrade) {
        this._metaBlockEl.style.display = '';
        if (this._metaNameEl) this._metaNameEl.textContent = metaUpgrade.name;
        if (this._metaDescEl) this._metaDescEl.textContent = metaUpgrade.description;
      } else {
        this._metaBlockEl.style.display = 'none';
      }
    }

    if (this._runOverScreenEl) this._runOverScreenEl.style.display = 'flex';
  }

  showRunWin(stats, metaUpgrade) {
    this.hideAll();

    const { kills, startTime } = stats;
    const elapsed = (Date.now() - startTime) / 1000;
    const min = Math.floor(elapsed / 60);
    const sec = Math.floor(elapsed % 60).toString().padStart(2, '0');

    if (this._winStatKillsEl) this._winStatKillsEl.textContent = kills;
    if (this._winStatTimeEl)  this._winStatTimeEl.textContent  = `${min}:${sec}`;

    if (this._winMetaBlockEl) {
      if (metaUpgrade) {
        this._winMetaBlockEl.style.display = '';
        if (this._winMetaNameEl) this._winMetaNameEl.textContent = metaUpgrade.name;
        if (this._winMetaDescEl) this._winMetaDescEl.textContent = metaUpgrade.description;
      } else {
        this._winMetaBlockEl.style.display = 'none';
      }
    }

    if (this._runWinScreenEl) this._runWinScreenEl.style.display = 'flex';
  }

  showStart() {
    this.hideAll();
    if (this._startScreenEl) this._startScreenEl.style.display = 'flex';
  }

  hideAll() {
    for (const el of [
      this._startScreenEl,
      this._upgradeScreenEl,
      this._runOverScreenEl,
      this._runWinScreenEl,
    ]) {
      if (el) el.style.display = 'none';
    }
  }
}
