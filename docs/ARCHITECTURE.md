# ARCHITECTURE — Drone Battlefield
**Version:** 1.0  
**Stack:** Vite + Vanilla JS (ES Modules) + Three.js r160  

---

## 1. GUIDING PRINCIPLES

1. **One Responsibility Per File** — Every module does one thing. If a file grows past ~200 lines, it needs to be split.
2. **No Global State** — All state lives in the `Game` class or explicit state objects passed by reference. No `window.xyz` variables.
3. **Systems Communicate via Events** — Modules don't import each other horizontally. They fire events on a shared `EventBus`. This prevents circular dependencies.
4. **Level Data is Data, Not Code** — Levels are JSON configs, not functions. `LevelLoader` interprets them. Adding a new level = adding a JSON file, nothing else.
5. **Never Mutate External State** — Systems receive what they need, return results, don't reach into other systems.

---

## 2. PROJECT STRUCTURE

```
drone-battlefield/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js                    # Entry point
│   ├── core/
│   │   ├── Game.js                # Central orchestrator
│   │   ├── EventBus.js            # Pub/Sub event system
│   │   ├── Renderer.js            # Three.js + post-processing setup
│   │   ├── InputManager.js        # Unified joystick + keyboard + touch
│   │   └── StateMachine.js        # Game state (MENU, PLAYING, PAUSED, etc.)
│   ├── world/
│   │   ├── World.js               # Scene: terrain, lighting, static objects
│   │   └── LevelLoader.js         # Parses level JSON, instantiates entities
│   ├── entities/
│   │   ├── Entity.js              # Base class: id, position, group, destroy()
│   │   ├── Unit.js                # Soldier, Tank, Rocket — extends Entity
│   │   ├── Drone.js               # Player drone — extends Entity
│   │   └── Projectile.js          # Bullets — extends Entity
│   ├── systems/
│   │   ├── BattleSystem.js        # Unit AI, movement, combat resolution
│   │   ├── WeaponSystem.js        # Weapon execution, radius calc, damage apply
│   │   ├── EffectSystem.js        # VFX: explosions, smoke, EMP pulse, ragdolls
│   │   └── AudioSystem.js         # Web Audio API: sfx synthesis + playback
│   ├── ui/
│   │   ├── HUD.js                 # In-game: health bars, phase text, weapon btn
│   │   ├── MenuManager.js         # Start screen, level select, pause, end screen
│   │   └── StarRating.js          # Animated star reveal component
│   ├── levels/
│   │   ├── level1.json
│   │   ├── level2.json
│   │   ├── level3.json
│   │   ├── level4.json
│   │   ├── level5.json
│   │   ├── level6.json
│   │   ├── level7.json
│   │   └── level8.json
│   └── utils/
│       ├── math.js                # Shared math helpers (clamp, lerp, randRange)
│       ├── pool.js                # Object pool for bullets + effects (performance)
│       └── storage.js             # localStorage wrapper with schema validation
├── assets/
│   └── sounds/                    # Reserved for future audio assets
└── public/
    └── favicon.svg
```

---

## 3. MODULE CONTRACTS

### 3.1 `EventBus.js`
The backbone of inter-module communication. All systems talk through this.

```javascript
class EventBus {
  on(event: string, callback: Function): void
  off(event: string, callback: Function): void
  emit(event: string, data?: any): void
}

export const bus = new EventBus(); // Singleton export
```

**Defined Events:**
| Event Name            | Emitter         | Payload                            |
|-----------------------|-----------------|------------------------------------|
| `unit:died`           | BattleSystem    | `{ unit, team }`                   |
| `unit:damaged`        | BattleSystem    | `{ unit, amount }`                 |
| `weapon:fired`        | WeaponSystem    | `{ type, position }`               |
| `weapon:impact`       | WeaponSystem    | `{ type, position, affectedUnits }`|
| `level:started`       | Game            | `{ levelId }`                      |
| `level:ended`         | Game            | `{ result: 'win'|'loss', stars }`  |
| `phase:changed`       | Game            | `{ phase: string }`                |
| `score:updated`       | BattleSystem    | `{ blue: number, red: number }`    |

---

### 3.2 `Game.js`
Central orchestrator. Owns the game loop. Creates and coordinates all systems.

```javascript
class Game {
  constructor()
  
  // Lifecycle
  init(): Promise<void>            // Bootstrap all systems
  start(): void                    // Begin game loop
  destroy(): void                  // Cleanup
  
  // Level management
  loadLevel(levelId: number): Promise<void>
  restartLevel(): void
  nextLevel(): void
  
  // Game loop
  _loop(timestamp: number): void   // Private, called via rAF
  _update(dt: number): void        // Private, updates all systems
  _render(): void                  // Private, calls renderer
  
  // Properties
  state: StateMachine
  renderer: Renderer
  world: World
  input: InputManager
  battle: BattleSystem
  weapons: WeaponSystem
  effects: EffectSystem
  audio: AudioSystem
  hud: HUD
  menus: MenuManager
  currentLevel: LevelConfig | null
}
```

**Game does NOT:**
- Contain any Three.js scene logic (that's Renderer + World)
- Contain any unit AI (that's BattleSystem)
- Contain any damage calculation (that's WeaponSystem)

---

### 3.3 `StateMachine.js`
```javascript
// Valid states
type GameState = 'BOOT' | 'MENU' | 'PLAYING' | 'PAUSED' | 'ENDED'

class StateMachine {
  current: GameState
  transition(to: GameState): void  // Validates transition, emits event
  is(state: GameState): boolean
}
```

**Valid transitions:**
```
BOOT → MENU
MENU → PLAYING
PLAYING → PAUSED
PLAYING → ENDED
PAUSED → PLAYING
PAUSED → MENU
ENDED → MENU
ENDED → PLAYING  (restart)
```

---

### 3.4 `Renderer.js`
Owns Three.js setup. Nothing else touches `renderer`, `scene`, or `camera` directly.

```javascript
class Renderer {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  
  init(container: HTMLElement): void
  resize(): void
  render(): void
  
  // Camera control
  setCameraTarget(position: THREE.Vector3): void
  shake(magnitude: number, duration: number): void
  
  // Post-processing (v0.7+)
  addBloom(strength: number): void
}
```

---

### 3.5 `Entity.js` (Base Class)
```javascript
class Entity {
  id: string                        // UUID
  group: THREE.Group                // Three.js group (all meshes parented here)
  position: THREE.Vector3           // Alias for group.position
  scene: THREE.Scene                // Reference for self-removal
  alive: boolean
  
  constructor(scene: THREE.Scene)
  destroy(): void                   // Remove from scene, set alive = false
  update(dt: number): void          // Override in subclasses
}
```

---

### 3.6 `Unit.js`
```javascript
class Unit extends Entity {
  team: 'blue' | 'red'
  type: 'soldier' | 'tank' | 'rocket' | 'commander'
  hp: number
  maxHp: number
  damage: number
  range: number
  speed: number
  lane: number
  cooldown: number
  
  // State
  state: 'advancing' | 'fighting' | 'retreating' | 'stunned' | 'dead'
  stunTimer: number
  
  // Methods
  takeDamage(amount: number): void  // Emits unit:damaged, handles death
  stun(duration: number): void
  kill(): void                      // Plays death animation, then destroy()
  
  // Visual
  _buildMesh(): void                // Creates type-specific geometry
  _flashWhite(): void               // Hit feedback
  _playDeathAnimation(): void       // Ragdoll fall + fade
}
```

---

### 3.7 `Drone.js`
```javascript
class Drone extends Entity {
  // Movement
  velocity: THREE.Vector3
  
  update(dt: number, input: { x: number, y: number }): void
  getBombPosition(): THREE.Vector3  // Returns world position below drone
}
```

---

### 3.8 `BattleSystem.js`
```javascript
class BattleSystem {
  units: Unit[]
  projectiles: Projectile[]
  
  init(scene: THREE.Scene, bus: EventBus): void
  
  // Unit management
  spawnUnit(config: UnitConfig): Unit
  clearAll(): void
  
  // Per-frame
  update(dt: number): void
  
  // Scoring
  getScore(team: 'blue' | 'red'): number  // Sum of remaining HP
  
  // Private
  _updateUnit(unit: Unit, dt: number): void
  _findNearestEnemy(unit: Unit): Unit | null
  _fire(from: Unit, to: Unit): void
  _updateProjectiles(dt: number): void
  _checkWinCondition(): void
}
```

---

### 3.9 `WeaponSystem.js`
```javascript
class WeaponSystem {
  availableWeapons: WeaponConfig[]
  activeWeapon: WeaponConfig
  usesRemaining: number
  cooldownTimer: number
  
  init(bus: EventBus): void
  
  // Called by Game when player fires
  fire(position: THREE.Vector3, units: Unit[]): WeaponResult
  
  // Weapon switching (v0.4+)
  selectWeapon(type: WeaponType): void
  
  canFire(): boolean
  
  // Private
  _calculateDamage(weapon: WeaponConfig, unit: Unit, distance: number): number
  _applyEffects(result: WeaponResult): void
}

interface WeaponResult {
  type: WeaponType
  position: THREE.Vector3
  affectedUnits: { unit: Unit, damage: number }[]
}
```

---

### 3.10 `EffectSystem.js`
```javascript
class EffectSystem {
  effects: Effect[]
  
  init(scene: THREE.Scene): void
  update(dt: number): void
  clearAll(): void
  
  // Triggered by bus events
  playExplosion(position: THREE.Vector3): void
  playEMP(position: THREE.Vector3, radius: number): void
  playSmoke(position: THREE.Vector3, count: number): void
  playHitFlash(unit: Unit): void
  playMuzzleFlash(position: THREE.Vector3): void
  playGroundScorch(position: THREE.Vector3): void  // Persistent decal
}
```

---

### 3.11 `AudioSystem.js`
```javascript
class AudioSystem {
  ctx: AudioContext
  masterVolume: number
  sfxVolume: number
  
  init(): void
  
  // Sounds (all synthesized via Web Audio API)
  playExplosion(intensity?: number): void
  playEMP(): void
  playGunshot(): void
  playImpact(): void
  playUIClick(): void
  playLevelWin(): void
  playLevelLoss(): void
  
  // Ambient
  startWind(): void
  stopWind(): void
  
  setVolume(type: 'master' | 'sfx' | 'music', value: number): void
}
```

---

### 3.12 `LevelLoader.js`
```javascript
class LevelLoader {
  async load(levelId: number): Promise<LevelConfig>
  
  // Instantiates all units defined in the JSON
  spawnUnits(config: LevelConfig, battle: BattleSystem): void
  
  // Configures weapons for the level
  setupWeapons(config: LevelConfig, weapons: WeaponSystem): void
  
  // Builds the terrain/world for this level
  buildWorld(config: LevelConfig, world: World): void
}
```

---

### 3.13 Level JSON Schema
```json
{
  "id": 1,
  "name": "Bridge Breakpoint",
  "setting": "bridge",
  "timeLimit": null,
  "winThreshold": 0.88,
  "weapons": ["BOMB"],
  "weaponUses": { "BOMB": 1 },
  "objectives": {
    "primary": "Protect the bridge. Stop the red push.",
    "secondary": "Eliminate the enemy Commander."
  },
  "terrain": {
    "type": "bridge",
    "riverWidth": 4,
    "bridgeWidth": 9
  },
  "units": {
    "blue": [
      { "type": "tank", "lane": -7, "x": -26 },
      { "type": "soldier", "lane": -7, "x": -27, "count": 7 },
      { "type": "tank", "lane": 0, "x": -26 },
      { "type": "soldier", "lane": 0, "x": -27, "count": 7 },
      { "type": "soldier", "lane": 7, "x": -26, "count": 8 }
    ],
    "red": [
      { "type": "tank", "lane": -7, "x": 26 },
      { "type": "rocket", "lane": -7, "x": 27 },
      { "type": "soldier", "lane": -7, "x": 28, "count": 8 },
      { "type": "commander", "lane": 0, "x": 28 },
      { "type": "soldier", "lane": 0, "x": 29, "count": 9 },
      { "type": "tank", "lane": 7, "x": 26 },
      { "type": "soldier", "lane": 7, "x": 27, "count": 9 }
    ]
  }
}
```

---

## 4. DATA FLOW

```
InputManager
    │
    │ joystick x/y, fire pressed
    ▼
Game._update(dt)
    │
    ├──► Drone.update(dt, input)           ← moves drone
    │
    ├──► BattleSystem.update(dt)           ← AI, projectiles
    │        │
    │        └──► bus.emit('unit:died')
    │                    │
    │                    ├──► EffectSystem.playDeathEffect()
    │                    ├──► AudioSystem.playImpact()
    │                    └──► HUD.updateBars()
    │
    ├──► [if fire pressed] WeaponSystem.fire(pos, units)
    │        │
    │        └──► bus.emit('weapon:impact')
    │                    │
    │                    ├──► EffectSystem.playExplosion()
    │                    ├──► AudioSystem.playExplosion()
    │                    └──► Renderer.shake()
    │
    ├──► EffectSystem.update(dt)           ← animate VFX
    │
    └──► Renderer.render()                 ← draw frame
```

---

## 5. PERFORMANCE RULES

1. **Object Pooling for Bullets** — Never `new THREE.Mesh()` per bullet. Use `pool.js` to recycle.
2. **Geometry Sharing** — All soldiers share one `BoxGeometry` instance. Only materials differ.
3. **No Per-Frame DOM Access** — Cache all DOM element references in constructors. Never `getElementById` in update loops.
4. **PixelRatio Cap** — `Math.min(devicePixelRatio, 1.75)` — non-negotiable for mobile battery.
5. **Shadow Map** — Single directional light casts shadows. Never more than one shadow-casting light.
6. **dispose() Everything** — Every geometry, material, texture must be disposed when a level ends.

---

## 6. CODING CONVENTIONS

```javascript
// ✅ Class names: PascalCase
class BattleSystem {}

// ✅ Methods: camelCase
update(dt) {}

// ✅ Private methods: _prefixed
_calculateDamage() {}

// ✅ Constants: UPPER_SNAKE_CASE
const MAX_UNITS = 64;

// ✅ Events: 'namespace:action' kebab
bus.emit('unit:died', { unit, team });

// ✅ Config objects over positional params
makeUnit({ type: 'tank', team: 'red', lane: 0, x: 26 });
// ❌ Not: makeUnit('tank', 'red', 0, 26)

// ✅ Early returns over nested ifs
update(dt) {
  if (!this.alive) return;
  if (this.state === 'stunned') return this._updateStun(dt);
  // ... rest of logic
}

// ✅ dt-based time (never frame-counting)
this.cooldown -= dt;  // ✅
this.cooldownFrames--;  // ❌
```

---

## 7. INITIALIZATION ORDER

```javascript
// main.js
const game = new Game();
await game.init();
// init() order:
// 1. EventBus (no deps)
// 2. StateMachine (no deps)
// 3. Renderer (no deps — creates scene)
// 4. AudioSystem (no deps)
// 5. InputManager (needs DOM)
// 6. World (needs scene)
// 7. BattleSystem (needs scene, bus)
// 8. WeaponSystem (needs bus)
// 9. EffectSystem (needs scene, bus)
// 10. HUD (needs bus, DOM)
// 11. MenuManager (needs bus, DOM, StateMachine)
// 12. LevelLoader (needs all of the above)
game.start();
// → shows MENU state
// → player selects level
// → LevelLoader.load(id) → spawnUnits → setupWeapons → buildWorld
// → StateMachine.transition('PLAYING')
// → game loop begins
```
