const STORAGE_KEY = 'drone-battlefield';

const DEFAULT_DATA = {
  levelProgress: {},
  unlockedWeapons: ['BOMB'],
  settings: { sfxVolume: 0.8, musicVolume: 0.5 },
};

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(raw);
    // Schema validation — ensure top-level keys exist
    if (
      typeof parsed.levelProgress !== 'object' ||
      !Array.isArray(parsed.unlockedWeapons) ||
      typeof parsed.settings !== 'object'
    ) {
      return structuredClone(DEFAULT_DATA);
    }
    return parsed;
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function _save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full — fail gracefully, never crash
  }
}

export function saveProgress(levelId, stars) {
  const data = _load();
  const prev = data.levelProgress[levelId];
  if (!prev || stars > prev.stars) {
    data.levelProgress[levelId] = { stars };
  }
  _save(data);
}

export function getProgress(levelId) {
  const data = _load();
  return data.levelProgress[levelId] || { stars: 0 };
}

export function saveSettings(settings) {
  const data = _load();
  data.settings = { ...data.settings, ...settings };
  _save(data);
}

export function getSettings() {
  return _load().settings;
}

export function resetProgress() {
  _save(structuredClone(DEFAULT_DATA));
}
