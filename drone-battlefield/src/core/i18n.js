/**
 * i18n — minimal translation system.
 * Call t('key') to get the current language string.
 * Call setLang('de'|'en') to switch languages.
 */

const STRINGS = {
  en: {
    // ── Start screen
    'start.title':       'Drone\nStrike',
    'start.subtitle':    'You are a combat drone over an active battlefield.\nSurvive. Strike smart. Push the front line forward.',
    'start.newRun':      'New Run',
    'start.missionOverview': 'Mission Overview',

    // ── Upgrade screen
    'upgrade.title':      'Choose Upgrade',
    'upgrade.reroll':     'Reroll',
    'upgrade.rerollDesc': 'Draw 3 new choices. Once per upgrade screen.',
    'upgrade.active':     'ACTIVE',

    // ── Run Over screen
    'runover.title':     'Drone Down',
    'runover.kills':     'Kills',
    'runover.time':      'Time',
    'runover.newRun':    'New Run',
    'runover.menu':      'Main Menu',
    'runover.metaTitle': 'Permanent Unlock',

    // ── Run Win screen
    'runwin.title':      'Mission Complete',
    'runwin.kills':      'Kills',
    'runwin.time':       'Time',
    'runwin.newRun':     'New Run',
    'runwin.menu':       'Main Menu',
    'runwin.metaTitle':  'Permanent Unlock',

    // ── Objectives
    'obj.destroyHq':     'Destroy HQ',
    'obj.holdZone':      'Hold the Zone',
    'obj.escortConvoy':  'Escort Convoy',

    // ── HUD
    'hud.wave':          'Wave',
    'hud.of':            'of',

    // ── Map names
    'map.1':             'River Crossing',
    'map.2':             'Desert Push',
    'map.3':             'Ambush Valley',
    'map.4':             'Urban Hell',
    'map.5':             'Night Raid',
    'map.6':             'Fortress',
    'map.7':             'Final Push',
    'map.8':             'Last Stand',

    // ── Center texts
    'center.mapCleared': 'Map Cleared',
    'center.wave':       'Wave',

    // ── Upgrade names & descriptions
    'upg.iron_rain.name':        'Iron Rain',
    'upg.iron_rain.desc':        'Cannon damage +25%',
    'upg.rapid_fire.name':       'Rapid Fire',
    'upg.rapid_fire.desc':       'Cannon cooldown -20%',
    'upg.devastator.name':       'Devastator',
    'upg.devastator.desc':       'Unlock BOMB. Bomb radius +2, damage +15',
    'upg.chain_emp.name':        'Chain EMP',
    'upg.chain_emp.desc':        'Unlock EMP. Pulses twice (second pulse 1s after first)',
    'upg.homing_missiles.name':  'Homing Missiles',
    'upg.homing_missiles.desc':  'Unlock MISSILE. +20% damage vs tanks',
    'upg.cluster_plus.name':     'Cluster Plus',
    'upg.cluster_plus.desc':     'Unlock CLUSTER. 2 extra submunitions (8 total)',
    'upg.armor_piercer.name':    'Armor Piercer',
    'upg.armor_piercer.desc':    'Weapons deal +30% damage to tanks',
    'upg.killstreak.name':       'Killstreak',
    'upg.killstreak.desc':       'After 5 kills: next shot does 2× damage',
    'upg.overcharge.name':       'Overcharge',
    'upg.overcharge.desc':       'Every 20s: next shot does 3× damage',
    'upg.composite_hull.name':   'Composite Hull',
    'upg.composite_hull.desc':   '+1 max HP (max 6)',
    'upg.quick_repair.name':     'Quick Repair',
    'upg.quick_repair.desc':     'Map start: restore 1 HP if below max',
    'upg.afterburner.name':      'Afterburner',
    'upg.afterburner.desc':      'Speed +25%',
    'upg.evasive_maneuver.name': 'Evasive Maneuver',
    'upg.evasive_maneuver.desc': 'On hit: speed burst +80% for 0.5s',
    'upg.shield_drone.name':     'Shield Drone',
    'upg.shield_drone.desc':     'Blocks 1 hit every 15s automatically',
    'upg.ghost_protocol.name':   'Ghost Protocol',
    'upg.ghost_protocol.desc':   'Flak guns take 1.5s longer to lock on',
    'upg.dual_weapons.name':     'Dual Weapons',
    'upg.dual_weapons.desc':     'Unlock secondary weapon slot',
    'upg.weapon_cache.name':     'Weapon Cache',
    'upg.weapon_cache.desc':     'Start each map with all cooldowns reset',
    'upg.intel.name':            'Intel',
    'upg.intel.desc':            'Flak gun lock-on time -30%',
    'upg.scavenger.name':        'Scavenger',
    'upg.scavenger.desc':        'Killing a commander resets 1s off cooldowns',
    'upg.overclock.name':        'Overclock',
    'upg.overclock.desc':        'All cooldowns -15%',
    'upg.blitz_mode.name':       'Blitz Mode',
    'upg.blitz_mode.desc':       'First 10s per map: all cooldowns -50%',
    'upg.supply_drop.name':      'Supply Drop',
    'upg.supply_drop.desc':      'Once per map: hold both fire → restore 1 HP',
    'upg.target_lock.name':      'Target Lock',
    'upg.target_lock.desc':      'Missile range +8 units',
  },

  de: {
    // ── Start screen
    'start.title':       'Drone\nStrike',
    'start.subtitle':    'Du bist eine Kampfdrohne über einem aktiven Schlachtfeld.\nÜberlebe. Triff klug. Schieb die Front vorwärts.',
    'start.newRun':      'Neuer Run',
    'start.missionOverview': 'Missionsübersicht',

    // ── Upgrade screen
    'upgrade.title':      'Upgrade wählen',
    'upgrade.reroll':     'Neu würfeln',
    'upgrade.rerollDesc': '3 neue Optionen ziehen. Einmal pro Upgrade-Screen.',
    'upgrade.active':     'AKTIV',

    // ── Run Over screen
    'runover.title':     'Drohne abgeschossen',
    'runover.kills':     'Abschüsse',
    'runover.time':      'Zeit',
    'runover.newRun':    'Neuer Run',
    'runover.menu':      'Hauptmenü',
    'runover.metaTitle': 'Dauerhaftes Upgrade',

    // ── Run Win screen
    'runwin.title':      'Mission erfüllt',
    'runwin.kills':      'Abschüsse',
    'runwin.time':       'Zeit',
    'runwin.newRun':     'Neuer Run',
    'runwin.menu':       'Hauptmenü',
    'runwin.metaTitle':  'Dauerhaftes Upgrade',

    // ── Objectives
    'obj.destroyHq':     'HQ zerstören',
    'obj.holdZone':      'Zone halten',
    'obj.escortConvoy':  'Konvoi eskortieren',

    // ── HUD
    'hud.wave':          'Welle',
    'hud.of':            'von',

    // ── Map names
    'map.1':             'Flussüberquerung',
    'map.2':             'Wüstenvorstoß',
    'map.3':             'Hinterhalt im Tal',
    'map.4':             'Stadthölle',
    'map.5':             'Nachtangriff',
    'map.6':             'Festung',
    'map.7':             'Letzter Vorstoß',
    'map.8':             'Letztes Gefecht',

    // ── Center texts
    'center.mapCleared': 'Karte frei',
    'center.wave':       'Welle',

    // ── Upgrade names & descriptions
    'upg.iron_rain.name':        'Eisenregen',
    'upg.iron_rain.desc':        'Kanone: +25% Schaden',
    'upg.rapid_fire.name':       'Schnellfeuer',
    'upg.rapid_fire.desc':       'Kanone: -20% Nachladezeit',
    'upg.devastator.name':       'Verwüster',
    'upg.devastator.desc':       'Schaltet BOMBE frei. Radius +2, Schaden +15',
    'upg.chain_emp.name':        'Ketten-EMP',
    'upg.chain_emp.desc':        'Schaltet EMP frei. Zweiter Puls nach 1 Sekunde',
    'upg.homing_missiles.name':  'Zielsuchraketen',
    'upg.homing_missiles.desc':  'Schaltet RAKETE frei. +20% Schaden gegen Panzer',
    'upg.cluster_plus.name':     'Clusterbombe+',
    'upg.cluster_plus.desc':     'Schaltet CLUSTER frei. 2 Extra-Submunition (8 gesamt)',
    'upg.armor_piercer.name':    'Panzerbrechend',
    'upg.armor_piercer.desc':    'Waffen: +30% Schaden gegen Panzer',
    'upg.killstreak.name':       'Killserie',
    'upg.killstreak.desc':       'Nach 5 Kills: nächster Schuss 2× Schaden',
    'upg.overcharge.name':       'Überlastung',
    'upg.overcharge.desc':       'Alle 20s: nächster Schuss 3× Schaden',
    'upg.composite_hull.name':   'Verbundrumpf',
    'upg.composite_hull.desc':   '+1 max LP (max 6)',
    'upg.quick_repair.name':     'Schnellreparatur',
    'upg.quick_repair.desc':     'Kartenstart: 1 LP wiederherstellen wenn unter Maximum',
    'upg.afterburner.name':      'Nachbrenner',
    'upg.afterburner.desc':      'Geschwindigkeit +25%',
    'upg.evasive_maneuver.name': 'Ausweichmanöver',
    'upg.evasive_maneuver.desc': 'Bei Treffer: Geschwindigkeitsschub +80% für 0,5s',
    'upg.shield_drone.name':     'Schutzdrohne',
    'upg.shield_drone.desc':     'Blockiert automatisch 1 Treffer alle 15s',
    'upg.ghost_protocol.name':   'Geisterprotokoll',
    'upg.ghost_protocol.desc':   'Flak-Kanonen brauchen 1,5s länger zum Einschließen',
    'upg.dual_weapons.name':     'Doppelwaffe',
    'upg.dual_weapons.desc':     'Sekundärwaffenslot freischalten',
    'upg.weapon_cache.name':     'Waffenlager',
    'upg.weapon_cache.desc':     'Jede Karte startet mit zurückgesetzten Abklingzeiten',
    'upg.intel.name':            'Geheimdienstinfos',
    'upg.intel.desc':            'Flak-Einschließzeit -30%',
    'upg.scavenger.name':        'Plünderer',
    'upg.scavenger.desc':        'Kommandeur töten: -1s auf alle Abklingzeiten',
    'upg.overclock.name':        'Übertaktung',
    'upg.overclock.desc':        'Alle Abklingzeiten -15%',
    'upg.blitz_mode.name':       'Blitzmodus',
    'upg.blitz_mode.desc':       'Erste 10s pro Karte: alle Abklingzeiten -50%',
    'upg.supply_drop.name':      'Versorgungsabwurf',
    'upg.supply_drop.desc':      'Einmal pro Karte: beide Feuer halten → 1 LP wiederherstellen',
    'upg.target_lock.name':      'Zielerfassung',
    'upg.target_lock.desc':      'Raketenreichweite +8 Einheiten',
  },
};

let _lang = localStorage.getItem('droneStrike_lang') || 'en';

export function t(key) {
  return STRINGS[_lang]?.[key] ?? STRINGS['en']?.[key] ?? key;
}

export function getLang() { return _lang; }

export function setLang(lang) {
  if (lang !== 'en' && lang !== 'de') return;
  _lang = lang;
  localStorage.setItem('droneStrike_lang', lang);
  document.dispatchEvent(new CustomEvent('langChanged', { detail: { lang } }));
}
