# CODING STANDARDS — Drone Battlefield
**Version:** 1.0  
**Enforcement:** These are rules, not suggestions. Every PR must comply.

---

## 1. FILE & MODULE RULES

### One Class Per File
```javascript
// ✅ src/entities/Unit.js exports Unit only
export class Unit extends Entity { ... }

// ❌ Never put two classes in one file
export class Unit { ... }
export class Projectile { ... }  // belongs in Projectile.js
```

### Named Exports Only (no default exports)
```javascript
// ✅
export class BattleSystem { ... }
export const bus = new EventBus();

// ❌
export default class BattleSystem { ... }
```

### Import Order
```javascript
// 1. Third-party libs
import * as THREE from 'three';

// 2. Core modules
import { bus } from '../core/EventBus.js';
import { Entity } from './Entity.js';

// 3. Utils
import { clamp, lerp } from '../utils/math.js';
```

---

## 2. CLASS RULES

### Constructor: Only Setup, No Logic
```javascript
// ✅ Constructor only assigns, never computes
constructor(scene, config) {
  this.scene = scene;
  this.config = config;
  this.units = [];
  this.active = false;
}

// ❌ No logic in constructor
constructor(scene) {
  this.scene = scene;
  this._buildAllMeshes();  // ← belongs in init()
  bus.emit('system:ready'); // ← belongs in init()
}
```

### Separate `init()` from `constructor()`
```javascript
// Systems are constructed first, then initialized in correct order
const battle = new BattleSystem();
const effects = new EffectSystem();
battle.init(scene, bus);      // init() takes dependencies
effects.init(scene, bus);     // all deps exist by now
```

### Private Methods: `_` Prefix
```javascript
class Unit {
  update(dt) { ... }        // ✅ public API
  _findTarget() { ... }     // ✅ private, prefixed
  findTarget() { ... }      // ❌ if private, must be prefixed
}
```

---

## 3. GAME LOOP RULES

### Always Use `dt` (Delta Time)
```javascript
// ✅ Frame-rate independent
this.position.x += this.speed * dt;
this.cooldown -= dt;
this.blastTimer = Math.max(0, this.blastTimer - dt);

// ❌ Frame-dependent (breaks at 30fps vs 120fps)
this.position.x += 0.05;
this.cooldownFrames--;
```

### Cap `dt` to Prevent Spiral of Death
```javascript
// In Game._loop():
const dt = Math.min(0.033, (now - this._lastTime) / 1000);  // max 33ms (30fps floor)
```

### No DOM Queries in Update Loops
```javascript
// ✅ Cache references in constructor/init
class HUD {
  init() {
    this._phaseEl = document.getElementById('phaseText');
    this._blueBarEl = document.getElementById('blueBar');
  }
  update(blue, red) {
    this._blueBarEl.style.width = (blue / MAX_BLUE * 100) + '%';
  }
}

// ❌ Never in the loop
update() {
  document.getElementById('blueBar').style.width = ...;  // queried every frame!
}
```

---

## 4. THREE.JS RULES

### Never Create Geometry/Material Inside `update()`
```javascript
// ✅ Created once, reused
class EffectSystem {
  init() {
    this._explosionGeo = new THREE.SphereGeometry(1, 16, 12);
    this._explosionMat = new THREE.MeshBasicMaterial({ ... });
  }
  playExplosion(pos) {
    const mesh = new THREE.Mesh(this._explosionGeo, this._explosionMat.clone());
    // clone() only for material if color/opacity changes per instance
  }
}

// ❌ New geometry every explosion
playExplosion(pos) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), ...);
}
```

### Always Dispose on Cleanup
```javascript
clearLevel() {
  for (const unit of this.units) {
    unit.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    this.scene.remove(unit.group);
  }
  this.units = [];
}
```

### Geometry Sharing Pattern
```javascript
// ✅ Shared geometry, per-instance material
const SOLDIER_GEO = new THREE.CapsuleGeometry(0.28, 0.55, 4, 8);

class Unit {
  _buildMesh() {
    const mat = new THREE.MeshStandardMaterial({ color: this.team === 'blue' ? 0x297BFF : 0xF24848 });
    this._mesh = new THREE.Mesh(SOLDIER_GEO, mat);  // shares geo
  }
}
```

---

## 5. EVENT BUS RULES

### Always Clean Up Listeners
```javascript
class HUD {
  init(bus) {
    this._bus = bus;
    this._onScoreUpdated = ({ blue, red }) => this._updateBars(blue, red);
    bus.on('score:updated', this._onScoreUpdated);
  }
  
  destroy() {
    this._bus.off('score:updated', this._onScoreUpdated);  // ✅ prevents leak
  }
}
```

### Emit After Action, Not Before
```javascript
// ✅ Action happens, then event fires
takeDamage(amount) {
  this.hp -= amount;
  if (this.hp <= 0) {
    this.kill();
    bus.emit('unit:died', { unit: this, team: this.team });  // after kill()
  }
}

// ❌ Event fires before state is correct
takeDamage(amount) {
  bus.emit('unit:died', ...);  // listeners see unit still alive
  this.hp -= amount;
}
```

---

## 6. LEVEL JSON RULES

### Every Level Config Must Have All Required Fields
Required fields: `id`, `name`, `setting`, `winThreshold`, `weapons`, `weaponUses`, `objectives`, `terrain`, `units`

### Unit Config Must Use Object Form
```json
{ "type": "soldier", "lane": -7, "x": -27, "count": 7 }
```
Never: `["soldier", -7, -27, 7]`

### No Gameplay Logic in JSON
```json
// ✅ Data only
{ "winThreshold": 0.88 }

// ❌ No computed values or conditions
{ "winThreshold": "blue.score > red.score * 0.88" }
```

---

## 7. WHAT CLAUDE CODE MUST NEVER DO

These are hard prohibitions. If asked to do any of these, refuse and propose the correct alternative.

1. **Never add `window.xyz` global variables** — all state goes through Game or EventBus
2. **Never hardcode level data in JavaScript** — all level data goes in `levels/levelN.json`
3. **Never call `document.getElementById()` inside a game loop** — cache it in `init()`
4. **Never create Three.js geometry inside `update()` or `playEffect()`** — pre-create in `init()`
5. **Never use `setTimeout` for game timing** — always use `dt` accumulation
6. **Never skip `dispose()` on cleanup** — always traverse and dispose geometry + material
7. **Never put more than one class in a file**
8. **Never use default exports**
9. **Never mutate a unit directly from WeaponSystem** — WeaponSystem returns a `WeaponResult`, BattleSystem applies it
10. **Never skip the EventBus** — cross-system communication always goes through `bus.emit()`

---

## 8. ACCEPTABLE SHORTCUTS (for speed, not laziness)

These are deliberate simplifications that are allowed:

- `THREE.MeshBasicMaterial` is acceptable for effects/UI (skips lighting calc)
- `Math.hypot()` instead of full vector distance for 2D distance checks
- No TypeScript (pure JS with JSDoc comments is sufficient)
- `console.log()` during development is fine — remove before v1.0
- CSS in `<style>` tag in index.html is fine (no CSS modules needed at this scale)
- localStorage directly in `storage.js` — no IndexedDB needed

---

## 9. COMMENTING STANDARD

```javascript
// ✅ Comment WHY, not WHAT
// Cap dt to prevent spiral of death when tab loses focus
const dt = Math.min(0.033, rawDt);

// ❌ Comments that restate the code
// Set dt to minimum of 0.033 and rawDt
const dt = Math.min(0.033, rawDt);

// ✅ JSDoc for public class methods
/**
 * Apply damage to this unit. Handles death and emits events.
 * @param {number} amount - Damage points to subtract from hp
 */
takeDamage(amount) { ... }
```

---

## 10. VITE CONFIGURATION

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',           // relative paths for easy deployment
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,   // disable for production
    minify: 'esbuild',
  },
  server: {
    port: 5173,
    open: true,
  }
});
```

```json
// package.json
{
  "name": "drone-battlefield",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "three": "^0.160.0"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```
