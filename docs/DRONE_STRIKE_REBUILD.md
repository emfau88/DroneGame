# DRONE STRIKE — Complete Rebuild Instructions
**For Claude Code — Read everything before touching any file.**
**This document replaces GAME_DESIGN.md. All other documents (ARCHITECTURE.md, CODING_STANDARDS.md, CLAUDE.md) remain valid.**

---

## WHAT YOU ARE BUILDING

A **top-down arcade roguelite** where you pilot an armed drone over an active battlefield. The ground war fights itself. Your job: survive, strike smart, and push the front line forward.

**One-line pitch:** You are a combat drone over a war zone — every run is different, every decision matters, and dying means starting over with new upgrades.

**What makes it different from the old design:**
- OLD: Observe → one action → watch. Passive. Boring.
- NEW: You fly continuously through live combat. You have weapons with cooldowns. Enemies actively try to shoot you down. You die if you're careless. Runs last 3–8 minutes.

---

## CORE GAME LOOP

```
START RUN
  → Choose 1 starting upgrade from 3 random options
  → Fly into active battlefield
  → Survive + strike enemies with cooldown weapons
  → Protect allied units (they fight on their own)
  → Clear the map objective (destroy HQ / escort convoy / hold zone)
  → If survived: upgrade screen (choose 1 of 3)
  → Next map (harder)
  → Repeat until death or campaign complete (8 maps)

ON DEATH:
  → Run ends. Show stats (kills, maps cleared, time)
  → Unlock 1 permanent meta-upgrade (from pool)
  → Start new run with that meta-upgrade active
```

**Session length target:** 5–15 minutes per run. Failing early = 3 min. Full clear = 15 min.

---

## PLAYER — THE DRONE

### Movement
- **Control:** Left joystick (mobile) / WASD (desktop)
- **Feel:** Agile, snappy. Low inertia (0.05s acceleration ramp — barely perceptible).
- **Speed:** 18 world units/second base
- **Altitude:** Fixed at y=12. Player never changes altitude. Camera follows from behind/above.
- **Tilt:** Drone tilts 15° in movement direction (visual only, no gameplay effect)
- **Bounds:** Soft boundary — drone slows and pushes back at map edges, never hard-stops

### Drone Stats (all moddable by upgrades)
```javascript
{
  hp: 3,              // hit points (lives). 3 hits = dead.
  speed: 18,          // world units per second
  weaponCooldowns: {
    cannon:    0.22,  // seconds between shots
    bomb:      3.5,
    emp:       8.0,
    missile:   1.8,
  },
  damageMultiplier: 1.0,
  shieldTimer: 0,     // invincibility frames after taking hit: 1.5s
}
```

### Taking Damage
- Hit by flak projectile OR enemy drone collision → lose 1 HP
- On hit: 1.5s invincibility (shield timer), drone flashes white rapidly
- At 0 HP: run ends
- HP visualized as 3 icons in HUD (hearts or drone icons), not a bar

### Death
- Drone spins + descends + explodes (0.8s animation)
- Camera pulls back slowly during animation
- Then: Run Over screen

---

## WEAPONS

Player has ONE primary weapon always active. Secondary weapon slot unlocked at map 3.

All weapons fire toward **the nearest enemy** within range automatically when cooldown is ready AND the fire button is held. Player aims by positioning the drone, not by aiming a cursor.

### Why auto-aim toward nearest enemy:
Mobile players cannot aim precisely with a joystick. Positioning the drone IS the skill expression. This is the same mechanic as Vampire Survivors — positioning matters, aiming is automatic.

### Weapon Roster

#### CANNON (starting weapon, always available)
```
damage:     8 per projectile
cooldown:   0.22s
range:      14 world units
target:     nearest ground unit
projectile: fast tracer line, yellow
effect:     small impact spark
sound:      rapid percussive pop
feel:       machine gun — hold fire button and mow them down
```

#### BOMB (unlockable, secondary slot)
```
damage:     55 in radius 5.2, linear falloff
cooldown:   3.5s
range:      infinite (drops below drone)
target:     ground position directly below drone
projectile: none — drops instantly
effect:     full explosion (sphere + smoke + scorch + shake)
sound:      whoosh → boom → rumble
feel:       positioning weapon — fly over cluster, drop, get out
```

#### EMP (unlockable, secondary slot)
```
damage:     0 HP, stuns all enemies in radius 7.5 for 3s
cooldown:   8.0s
range:      radius around drone
target:     all enemies within radius
effect:     expanding cyan ring + electrical arcs on stunned units
sound:      high sweep → pop → crackle
feel:       breathing room — use when overwhelmed
```

#### MISSILE (unlockable, secondary slot)
```
damage:     38
cooldown:   1.8s
range:      22 world units
target:     nearest HIGH-PRIORITY unit (tank > commander > rocket > soldier)
projectile: slow-moving missile mesh, tracks target, slight curve
effect:     medium explosion on impact
sound:      whoosh → impact
feel:       sniper — high damage, smart targeting, moderate cooldown
```

#### CLUSTER (unlockable, secondary slot)
```
damage:     22 per submunition × 6 submunitions
cooldown:   12.0s
range:      infinite (drops below drone)
target:     ground below drone, submunitions scatter in radius 10
effect:     6 staggered small explosions over 0.8s
sound:      6 staggered pops
feel:       crowd clearer — fly over dense formation, drop
```

### Weapon Firing Logic
```javascript
// In Drone.update(dt):
if (input.firePrimary && primaryCooldown <= 0) {
  const target = findNearestEnemy(primaryWeapon.range);
  if (target) {
    fireWeapon(primaryWeapon, target);
    primaryCooldown = primaryWeapon.cooldownDuration;
  }
}
// Same for secondary
```

---

## ENEMIES

### Ground Units (fight the allied army AND shoot at the drone)

All ground units have two behaviors simultaneously:
1. Fight the ground war (advance, engage allied units) — same AI as before
2. If drone is within their anti-air range: fire flak at drone

#### Soldier
```
hp:           15
ground dmg:   2.1 / shot, cooldown 0.75s
aa range:     0  (cannot shoot drone)
aa damage:    0
speed:        2.05
visual:       small capsule
```

#### Rocket Soldier
```
hp:           22
ground dmg:   4.8 / shot, cooldown 1.25s
aa range:     10  (fires unguided rockets at drone)
aa damage:    1 hit
aa cooldown:  3.5s
speed:        1.6
visual:       capsule + shoulder launcher
```

#### Tank
```
hp:           60
ground dmg:   5.2 / shot, cooldown 1.8s
aa range:     8   (fires flak burst — slow, easy to dodge)
aa damage:    1 hit
aa cooldown:  4.0s
speed:        1.2
visual:       wide box + turret
```

#### Flak Gun (static — does NOT advance)
```
hp:           28
ground dmg:   0  (only targets drone)
aa range:     20  (primary threat to drone)
aa damage:    1 hit
aa cooldown:  1.8s
speed:        0   (static emplacement)
visual:       dark box + angled barrel cylinder, rotates to track drone
special:      barrel visually rotates to face drone before firing
              red targeting laser shows when locked on (0.5s before shot)
```

#### Enemy Drone (air unit — appears map 3+)
```
hp:           20
ground dmg:   0
aa range:     16  (actively chases player drone)
aa damage:    1 hit on collision
speed:        14  (slightly slower than player)
visual:       smaller drone mesh, red
behavior:     intercept path toward player drone
              if within 2 units: collision damage, then it dies too
special:      cannon also fires at it (auto-aim includes enemy drones)
```

#### Commander
```
hp:           35
ground dmg:   3.0
aa range:     6
aa damage:    1 hit
aa cooldown:  5.0s
speed:        1.8
visual:       taller capsule + antenna
aura:         buffs nearby units +15% damage, +10% speed in radius 4
priority:     MISSILE auto-targets commanders first
```

### Anti-Air Projectile Behavior
- Flak projectiles: slow-moving spheres (speed 8), slightly homing (20% correction per frame)
- Easy to dodge if moving — dangerous if hovering
- Visual: orange/red small sphere, smoke trail
- Rocket soldier rockets: faster (12), less homing (10% correction)
- Enemy drone: collision-based, not projectile

### This Creates The Core Tension:
> Moving constantly = safe from flak but hard to aim cannon accurately.
> Hovering = perfect cannon aim but flak will hit you.
> The skill is finding the sweet spot.

---

## MAP STRUCTURE

Each run = sequence of maps. Maps are procedurally configured from templates.

### Map Template System
A map template defines:
- Setting (bridge / desert / forest / urban)
- Enemy composition ranges (min/max of each unit type)
- Flak gun positions (fixed or randomized within zones)
- Objective type
- Wave count

The actual enemy count, positions, and upgrade offerings are randomized each run within the template's ranges. Same template = different experience each run.

### Map Templates (8 total)

```javascript
const MAP_TEMPLATES = [
  {
    id: 1,
    name: "River Crossing",
    setting: "bridge",
    difficulty: 1,
    enemies: { soldier: [8,12], rocket: [0,2], tank: [1,2], flakGun: [1,2], commander: [0,1], enemyDrone: [0,0] },
    objective: "destroy_hq",
    waves: 1,
  },
  {
    id: 2,
    name: "Desert Push",
    setting: "desert",
    difficulty: 2,
    enemies: { soldier: [10,16], rocket: [2,4], tank: [2,3], flakGun: [2,3], commander: [1,1], enemyDrone: [0,0] },
    objective: "hold_zone",
    waves: 2,
  },
  {
    id: 3,
    name: "Ambush Valley",
    setting: "forest",
    difficulty: 3,
    enemies: { soldier: [12,18], rocket: [3,5], tank: [2,4], flakGun: [3,4], commander: [1,2], enemyDrone: [1,2] },
    objective: "escort_convoy",
    waves: 2,
  },
  {
    id: 4,
    name: "Urban Hell",
    setting: "urban",
    difficulty: 4,
    enemies: { soldier: [14,20], rocket: [4,6], tank: [3,5], flakGun: [4,5], commander: [2,2], enemyDrone: [2,3] },
    objective: "destroy_hq",
    waves: 3,
  },
  {
    id: 5,
    name: "Night Raid",
    setting: "bridge",
    difficulty: 5,
    lightingOverride: "night",
    enemies: { soldier: [16,22], rocket: [5,7], tank: [4,6], flakGun: [5,6], commander: [2,3], enemyDrone: [3,4] },
    objective: "hold_zone",
    waves: 3,
  },
  {
    id: 6,
    name: "Fortress",
    setting: "urban",
    difficulty: 6,
    enemies: { soldier: [18,24], rocket: [6,8], tank: [5,7], flakGun: [6,8], commander: [3,3], enemyDrone: [4,5] },
    objective: "destroy_hq",
    waves: 4,
  },
  {
    id: 7,
    name: "Final Push",
    setting: "desert",
    difficulty: 7,
    enemies: { soldier: [20,28], rocket: [7,10], tank: [6,9], flakGun: [7,9], commander: [3,4], enemyDrone: [5,7] },
    objective: "escort_convoy",
    waves: 4,
  },
  {
    id: 8,
    name: "The Command",
    setting: "urban",
    difficulty: 8,
    enemies: { soldier: [24,32], rocket: [8,12], tank: [8,12], flakGun: [10,12], commander: [4,5], enemyDrone: [6,8] },
    objective: "destroy_hq",
    waves: 5,
    bossSpawn: true,
  }
];
```

### Objectives

#### DESTROY_HQ
- Enemy HQ building placed at far end of map (red beacon on it)
- HQ has 200 HP
- Win: reduce HQ to 0 HP
- Lose: allied units all dead before HQ destroyed

#### HOLD_ZONE
- A marked circular zone in center of map (radius 6)
- Timer: 60 seconds
- Win: zone controlled by blue (more blue units than red inside) for 60 cumulative seconds
- Lose: drone dead, or allied units all dead

#### ESCORT_CONVOY
- Blue convoy vehicle moves along road at speed 3 (u/s)
- Convoy has 100 HP
- Win: convoy reaches end of road
- Lose: convoy HP reaches 0, or drone dead

### Waves
Maps with multiple waves:
- Wave 1 enemies spawn at run start
- New wave spawns when 70% of current wave is dead
- Each wave: same template ranges, fresh spawn
- Between waves: 3-second pause, "WAVE 2 INCOMING" text

---

## ROGUELITE SYSTEM

### Run Upgrades (between maps)
After surviving each map, player chooses 1 of 3 randomly drawn upgrades.

**Upgrade Pool — 24 total upgrades:**

```
OFFENSIVE:
- Iron Rain:        Cannon damage +25%
- Rapid Fire:       Cannon cooldown -20%
- Devastator:       Bomb radius +2, damage +15
- Chain EMP:        EMP hits twice (second pulse 1s after first)
- Homing Missiles:  Missile tracking strength +50%
- Cluster Plus:     Cluster adds 2 extra submunitions
- Armor Piercer:    All weapons ignore 30% of tank damage reduction
- Killstreak:       After 5 kills: next weapon use does 2x damage (auto-resets)
- Overcharge:       Every 20s: next shot does 3x damage (indicator in HUD)

DEFENSIVE:
- Composite Hull:   +1 max HP (can stack, max 6)
- Quick Repair:     On map start: restore 1 HP if below max
- Afterburner:      Speed +25%
- Evasive Maneuver: On hit: brief speed burst +100% for 0.5s
- Shield Drone:     Blocks 1 hit every 15s (visual shield bubble)
- Ghost Protocol:   Flak guns take 1.5s longer to lock onto you

UTILITY:
- Dual Weapons:     Unlock secondary weapon slot (mandatory if not yet unlocked)
- Weapon Cache:     Start each map with full weapon cooldowns reset
- Intel:            Reveal all Flak Gun positions at map start (red markers)
- Scavenger:        Killing commanders restores 0.5s off all cooldowns
- Overclock:        All cooldowns -15%
- Blitz Mode:       First 10s of each map: all cooldowns -50%
- Supply Drop:      Once per map: press both fire buttons → restore 1 HP
- Target Lock:      Missile range +8 units
```

**Selection Rules:**
- Draw 3 from pool, weighted toward ones player doesn't have
- Offensive/Defensive/Utility balanced: never offer 3 of same category
- Some upgrades appear only from map 3+ (Dual Weapons is always available from map 2)

### Meta-Progression (persists between runs)
After each run (win or lose), earn 1 meta-upgrade from a smaller permanent pool.

**Meta-Upgrades (12 total — permanent, always active):**
```
- Veteran Drone:    All runs start with +1 HP
- Combat Training:  Cannon damage permanently +10%
- Reinforced Hull:  First hit of every run: no damage (one time per run)
- Supply Lines:     Start each run with 1 extra upgrade pick (from 2 instead of none)
- EMP Mastery:      EMP always available from map 1
- Bomb Training:    Bomb always available from map 1
- Tactician:        See enemy count on map select screen
- Survivor:         On death: 20% chance to survive with 1 HP (once per run)
- Speed Demon:      Base speed +15% permanently
- Quick Learner:    After first death in a run: upgrades offer 4 choices instead of 3
- Iron Will:        Maps 1-3 difficulty slightly reduced
- Elite Pilot:      Drone invincibility after hit extended to 2.0s (from 1.5s)
```

**Meta unlock order:** Random draw from unowned pool after each run. Once all 12 owned: bonus score multiplier per run instead.

---

## GAME FEEL SPECIFICATIONS

### Drone Movement Feel
```javascript
// Snappy but not instant
const ACCELERATION = 0.05; // seconds to full speed — barely perceptible
drone.velocity.lerp(targetVelocity, dt / ACCELERATION);
drone.position.addScaledVector(drone.velocity, dt);

// Tilt
drone.rotation.z = lerp(drone.rotation.z, -input.x * 0.26, dt * 12);
drone.rotation.x = lerp(drone.rotation.x, input.y * 0.18, dt * 12);
```

### Camera
- Position: drone.position + (0, 22, 18) — behind and above
- LookAt: drone.position + (0, 0, -4) — slightly ahead of drone
- Follow lerp: `dt * 5.5` — tight but not instant
- On hit: shake (magnitude 6, duration 0.25s)
- On death: pull back (camera y +30 over 0.8s, fov 55→70)

### Flak Dodge Feel
- Flak projectile: orange sphere, visible smoke trail, slightly homing
- Slow enough that moving drone can always dodge (speed 8 vs drone speed 18)
- When flak misses by <2 units: "near miss" sound (whoosh) + brief camera micro-shake
- This rewards skilled dodging even when not hit

### Weapon Fire Feel
- Cannon: no recoil, pure rapid-fire satisfaction. Muzzle flash 0.05s. Tracer lines persist 0.08s.
- Bomb: 0.2s delay between drop trigger and explosion (tension). Camera shake magnitude 8.
- EMP: slow build-up sound (0.3s) before pulse — telegraphs the moment.
- Missile: visible projectile tracking target with slight curve. Satisfying to watch.

### Kill Feedback
- Soldier death: ragdoll fall + fade (0.35s)
- Tank death: larger explosion, turret flies off (separate mesh, arc trajectory, lands with clunk)
- Flak gun death: collapses, barrel detaches and falls
- Enemy drone death: spiral descent + small explosion on ground impact
- Commander death: same as soldier + gold particle burst (reward signal)

### HUD (minimal — game must be readable)
```
Top-left:     HP icons (3 drone silhouettes, grey when lost)
Top-right:    Map name + objective status (one line)
Bottom-left:  Joystick zone
Bottom-right: Fire primary (large button) + fire secondary (smaller, above primary)
Bottom-center: Cooldown indicators for both weapons (arc fill, like iOS timer)
Center:       Wave incoming text (fades in/out)
              Near-miss text: "NEAR MISS" flash (0.4s, top-center)
              Kill streak: "+5 KILL STREAK" flash when Killstreak upgrade active
```

---

## ARCHITECTURE CHANGES FROM PREVIOUS VERSION

The following changes to ARCHITECTURE.md apply. All other rules remain.

### Modified Systems

#### `Drone.js` — Major changes
New properties:
```javascript
hp: number                    // current hit points
maxHp: number                 // from upgrades
velocity: THREE.Vector3       // for inertia
shieldTimer: number           // invincibility after hit
primaryWeapon: WeaponConfig
secondaryWeapon: WeaponConfig | null
primaryCooldown: number
secondaryCooldown: number
```

New methods:
```javascript
takeDamage(): void            // -1 HP, trigger shield, emit 'drone:hit'
isDead(): boolean
fireWeapons(dt, units): void  // called every frame — handles auto-fire
_findTarget(range): Unit | null
```

#### `WeaponSystem.js` — Simplified
Old: player-triggered, uses-based
New: auto-fires when held + cooldown ready. No "uses" concept. Just cooldowns.

```javascript
class WeaponSystem {
  getWeaponConfig(type: WeaponType): WeaponConfig
  executeWeapon(config, position, units, scene): WeaponResult
  // No longer manages "usesRemaining" — Drone.js manages cooldowns
}
```

#### `BattleSystem.js` — Extended
New responsibility: anti-air behavior for ground units + enemy drone AI.

New methods:
```javascript
_updateAntiAir(unit, drone, dt): void   // if drone in aa range: fire flak
_updateEnemyDrone(unit, drone, dt): void // intercept behavior
getFlakProjectiles(): Projectile[]       // for collision detection
```

#### `RogueliteManager.js` — NEW FILE
New system. Add to `src/systems/RogueliteManager.js`.

```javascript
class RogueliteManager {
  currentRun: RunState
  metaUpgrades: string[]       // persistent (localStorage)
  
  init(bus, storage): void
  
  startRun(): void             // reset run state, apply meta upgrades
  endMap(survived: boolean): void
  selectUpgrade(upgradeId: string): void
  endRun(cleared: boolean): void
  
  getUpgradeChoices(): Upgrade[]  // 3 random from pool
  applyUpgradeToDrone(upgrade, drone): void
  
  // Persistence
  saveMetaProgress(): void
  loadMetaProgress(): void
}

interface RunState {
  currentMapIndex: number
  activeUpgrades: string[]
  kills: number
  mapsCleared: number
  startTime: number
}
```

#### `MapGenerator.js` — NEW FILE
New system. Add to `src/world/MapGenerator.js`.

```javascript
class MapGenerator {
  generate(template: MapTemplate, seed?: number): MapConfig
  // Returns fully-specified unit positions, flak gun positions,
  // objective config — all randomized within template ranges
  
  _randomizeUnits(template): UnitConfig[]
  _placeFlakGuns(template, terrain): FlakConfig[]
  _buildObjective(type, terrain): ObjectiveConfig
}
```

### New EventBus Events
| Event | Emitter | Payload |
|-------|---------|---------|
| `drone:hit` | Drone | `{ hpRemaining }` |
| `drone:dead` | Drone | `{}` |
| `flak:nearMiss` | BattleSystem | `{ distance }` |
| `map:complete` | Game | `{ mapId, survived }` |
| `map:waveStart` | Game | `{ waveNumber }` |
| `upgrade:selected` | RogueliteManager | `{ upgradeId }` |
| `objective:updated` | Game | `{ type, progress }` |
| `run:ended` | RogueliteManager | `{ cleared, kills, maps }` |

### New Game States
Add to `StateMachine.js`:
```
UPGRADE_SELECT  // between maps: choose upgrade
RUN_OVER        // drone dead: show stats
RUN_WIN         // all 8 maps cleared
```

New transitions:
```
PLAYING → UPGRADE_SELECT  (map complete, survived)
UPGRADE_SELECT → PLAYING  (upgrade chosen)
PLAYING → RUN_OVER        (drone dead)
RUN_OVER → MENU           (back to menu)
RUN_OVER → PLAYING        (start new run)
RUN_WIN → MENU
```

---

## NEW FILE STRUCTURE ADDITIONS

```
src/
├── systems/
│   ├── RogueliteManager.js    ← NEW
│   ├── BattleSystem.js        ← MODIFIED (add AA + enemy drone AI)
│   ├── WeaponSystem.js        ← MODIFIED (cooldown-based, no uses)
│   └── ...existing
├── world/
│   ├── MapGenerator.js        ← NEW
│   └── ...existing
├── ui/
│   ├── UpgradeScreen.js       ← NEW (shows 3 upgrade choices)
│   ├── RunOverScreen.js       ← NEW (death stats + meta unlock)
│   └── ...existing
└── data/
    ├── upgrades.js            ← NEW (upgrade pool definitions)
    ├── metaUpgrades.js        ← NEW (meta upgrade definitions)
    └── mapTemplates.js        ← NEW (8 map template definitions)
        (replaces levels/*.json — templates not configs)
```

---

## SCREENS & FLOW

```
MAIN MENU
  → "NEW RUN" button
  
META UPGRADE DISPLAY (if any owned)
  → Shows active meta upgrades as icons (0.5s, then auto-proceeds)
  
MAP 1 START
  → UPGRADE SELECT: choose 1 of 3 (no skip — must choose)
  → Cinematic descent → battle begins
  
[PLAYING]
  → Drone flies, auto-fires, dodges flak
  → Wave system (if template has waves > 1)
  → Objective progress shown in HUD
  
MAP COMPLETE (objective done, drone alive)
  → "MAP CLEARED" flash (1s)
  → UPGRADE SELECT: choose 1 of 3
  → Next map loads
  
DRONE DEAD
  → Death animation (0.8s)
  → RUN OVER screen:
      - Maps cleared: N/8
      - Total kills: N
      - Survival time: MM:SS
      - New meta upgrade unlocked: [NAME] + description
      - Buttons: "NEW RUN" / "MAIN MENU"

ALL 8 MAPS CLEARED
  → RUN WIN screen:
      - "CAMPAIGN COMPLETE"
      - Stats
      - New meta upgrade unlocked (if any remain)
      - Buttons: "NEW RUN" / "MAIN MENU"
```

---

## WHAT TO KEEP FROM CURRENT CODEBASE

| Component | Keep? | Notes |
|-----------|-------|-------|
| Three.js setup (Renderer.js) | ✅ Yes | Unchanged |
| EventBus.js | ✅ Yes | Add new events |
| StateMachine.js | ✅ Extend | Add new states |
| InputManager.js | ✅ Yes | Add secondary fire button |
| World.js terrain | ✅ Yes | All 4 settings still valid |
| Entity.js, Unit.js base | ✅ Yes | Add AA properties to Unit |
| BattleSystem.js core | ✅ Extend | Add AA + enemy drone behavior |
| EffectSystem.js | ✅ Yes | Add flak projectile effect |
| AudioSystem.js | ✅ Yes | Add near-miss sound |
| HUD.js | ♻️ Rebuild | Completely new layout |
| LevelLoader.js | ♻️ Replace | → MapGenerator.js |
| levels/*.json | ❌ Delete | → src/data/mapTemplates.js |
| WeaponSystem.js | ♻️ Modify | Remove uses, keep damage calc |
| MenuManager.js | ♻️ Extend | Add UpgradeScreen, RunOverScreen |
| Drone.js | ♻️ Rebuild | Completely new — add HP, weapons, AA |
| Projectile.js | ✅ Extend | Add flak projectile type |
| CODING_STANDARDS.md | ✅ Yes | All rules still apply |
| ARCHITECTURE.md | ✅ Extend | Add new systems to §2 and §7 |

---

## IMPLEMENTATION ORDER FOR CLAUDE CODE

Work in this exact order. Do not skip steps. Each step must work before proceeding.

### Step 1 — Core drone transformation
1. Modify `Drone.js`: add HP system, shieldTimer, takeDamage(), isDead()
2. Modify `Drone.js`: add primaryWeapon, secondaryCooldown, fireWeapons(dt, units)
3. Modify `InputManager.js`: add secondary fire button (separate from primary)
4. Test: drone flies, has 3 HP shown in HUD, cannon auto-fires at nearest enemy

### Step 2 — Anti-air ground units
1. Add AA properties to all Unit configs (aa_range, aa_damage, aa_cooldown)
2. Add `_updateAntiAir(unit, drone, dt)` to BattleSystem
3. Add flak projectile type to Projectile.js (slow, slightly homing)
4. Add flak collision detection with drone in BattleSystem
5. Add FlakGun unit type (static, only targets drone)
6. Test: stand still near flak gun → get hit. Move → dodge.

### Step 3 — Enemy drone unit
1. Add EnemyDrone entity (extends Unit, flies at y=10, intercepts player)
2. Add `_updateEnemyDrone(unit, drone, dt)` to BattleSystem
3. Collision detection: if within 2 units of player drone → both take damage
4. Test: enemy drone spawns, chases, collides if player doesn't dodge

### Step 4 — Map templates + MapGenerator
1. Create `src/data/mapTemplates.js` with all 8 templates
2. Create `MapGenerator.js`: generates MapConfig from template (randomized within ranges)
3. Wire MapGenerator into Game.js replacing LevelLoader
4. Test: map 1 generates with correct unit types, counts within ranges

### Step 5 — Roguelite loop
1. Create `src/data/upgrades.js` — all 24 run upgrades defined
2. Create `src/data/metaUpgrades.js` — all 12 meta upgrades defined
3. Create `RogueliteManager.js` — startRun, endMap, selectUpgrade, endRun
4. Create `UpgradeScreen.js` — shows 3 choices, player selects one
5. Create `RunOverScreen.js` — death stats + meta unlock reveal
6. Add new StateMachine states: UPGRADE_SELECT, RUN_OVER, RUN_WIN
7. Wire full run flow in Game.js: map → upgrade → map → ... → death/win
8. Test: complete map 1, see upgrade screen, choose upgrade, map 2 loads with upgrade active

### Step 6 — Objectives
1. Implement DESTROY_HQ: HQ building mesh, 200 HP, progress shown in HUD
2. Implement HOLD_ZONE: zone ring on ground, timer logic, blue/red presence check
3. Implement ESCORT_CONVOY: convoy vehicle moving along road, HP bar
4. Wire objective type from MapConfig into Game objective system
5. Test each objective type from start to completion

### Step 7 — Weapons expansion
1. Implement all 5 weapon types in WeaponSystem (cannon already exists as base)
2. Verify each weapon: correct damage, radius, effect, sound
3. Secondary weapon slot in Drone.js wired to secondary fire button
4. Test: earn "Dual Weapons" upgrade → secondary slot activates → switch works

### Step 8 — HUD rebuild
1. HP display: 3 drone icons (full / empty) — not a bar
2. Cooldown indicators: arc fill per weapon (CSS or canvas-based)
3. Objective progress: top-right, one line, updates live
4. Near-miss text flash system
5. Wave incoming text
6. Remove all old phase text / observe text

### Step 9 — Polish pass (only after all above works)
1. Turret detach death animation for tanks
2. Enemy drone spiral death
3. Near-miss sound + micro-shake
4. Meta upgrade display on run start
5. All screen transitions (fades)
6. Verify: CLAUDE.md Visual Quality Checklist 100%

---

## ACCEPTANCE CRITERIA — REBUILD COMPLETE

Before reporting done, verify ALL of these:

- [ ] Drone has 3 HP. Taking 3 hits ends the run.
- [ ] Cannon auto-fires at nearest enemy when fire button held
- [ ] Bomb drops below drone, causes explosion with camera shake magnitude 8
- [ ] Flak guns rotate to face drone before firing
- [ ] Enemy drones chase and collide with player
- [ ] Moving drone consistently dodges flak. Hovering drone gets hit within 3s.
- [ ] Near miss (<2 units): whoosh sound + micro-shake
- [ ] Map 1 generates differently each run (unit positions randomized)
- [ ] After map complete: upgrade screen shows 3 choices
- [ ] Chosen upgrade applies immediately and persists for rest of run
- [ ] Death triggers run over screen with kill count and maps cleared
- [ ] Meta upgrade unlocked on run end (shown on screen)
- [ ] Meta upgrades persist between runs (survive page refresh)
- [ ] All 3 objective types completable
- [ ] Wave system triggers correctly (new wave at 70% cleared)
- [ ] Secondary weapon slot usable after "Dual Weapons" upgrade
- [ ] 60fps on desktop during full battle with all effects
- [ ] 30fps on mid-range mobile
- [ ] No console.log in production build
- [ ] No global window variables
- [ ] All levels of CLAUDE.md checklist pass
