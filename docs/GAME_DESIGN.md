# GAME DESIGN DOCUMENT — Drone Battlefield
**Version:** 1.0 (Living Document — update after every major playtest)  
**Genre:** Mobile Tactical Action  
**Platform:** Browser (Mobile-first, Desktop supported)  
**Engine:** Three.js + Vite  

---

## 1. CORE PHILOSOPHY

### One-Line Pitch
You are a drone operator behind enemy lines — one wrong call and the mission fails.

### Design Pillars (in order of priority)
1. **Read, Think, Strike** — Every action must feel like a deliberate tactical decision, not a reflex.
2. **Consequence over Chaos** — One well-placed drop beats ten random ones. The game rewards patience.
3. **Visceral Feedback** — When a bomb lands, the world must react. Sound, shockwave, scatter, smoke. The player must *feel* impact.
4. **Mobile-First Elegance** — Controls are designed for one thumb. Nothing requires precision tapping on small UI elements.

### What This Game Is NOT
- Not a real-time strategy game (no base building, no unit control)
- Not a casual idle game (you must actively engage and make decisions)
- Not a simulation (fun over realism, always)

---

## 2. CORE GAME LOOP

```
OBSERVE → PLAN → EXECUTE → EVALUATE → (next round or next level)
```

**OBSERVE** (5–15 seconds)
- Player watches enemy units advance
- Formations, unit types, and positions become clear
- Drone can move freely to scout

**PLAN** (player-driven, no time limit in early levels)
- Player identifies highest-value target zone
- Considers weapon type, blast radius, unit clustering
- In later levels: time pressure introduced

**EXECUTE**
- Player positions drone, triggers weapon
- Action plays out in real-time (not paused)
- Player cannot cancel once triggered

**EVALUATE**
- 8–12 seconds of watching outcome
- Score calculated based on kills, objectives protected, resources used
- Star rating displayed (1–3 stars)

**LOOP BACK**
- If lives remain: re-arm and face next wave
- If level cleared: star rating + next level unlock

---

## 3. PLAYER CONTROLS

### Mobile (primary)
- **Left joystick** — Drone movement (8-directional, analog speed)
- **RIGHT side** — Weapon button (large, palm-friendly)
- **No accidental triggers** — Weapon only fires on intentional pointerdown, not on joystick release

### Desktop (secondary)
- **WASD / Arrow keys** — Drone movement
- **Space / Click** — Fire weapon
- **Mouse position** — Optional camera pan (not required for gameplay)

### Drone Feel
- Drone movement has slight inertia (0.15s acceleration ramp)
- Drone tilts subtly in direction of movement (visual only, ~12°)
- Camera follows drone with smooth lerp (not instant snap)
- Camera angle: slightly behind and above, slightly tilted down — gives tactical overview
- When dropping weapon: brief camera shake (0.3s, 4px magnitude)

---

## 4. WEAPONS SYSTEM

All weapons share these properties:
- `radius` — blast/effect radius in world units
- `damage` — base damage at center of impact
- `falloff` — how damage decreases with distance (linear or exponential)
- `cooldown` — time before next use (if reusable)
- `uses` — how many times per level (1 = one-shot, Infinity = cooldown-based)

### Weapon Roster (ordered by unlock)

#### BOMB (Level 1 unlock)
```
radius:     5.2
damage:     52
falloff:    linear
uses:       1 (Level 1), 2 (Level 3+)
effect:     explosion sphere + 10 smoke particles + ground scorch decal
sound:      distant whoosh → impact boom → rumble fade
```

#### EMP (Level 2 unlock)
```
radius:     7.2
damage:     18 (non-lethal alone, disabling)
effect:     cyan pulse sphere + electrical sparks on hit units
sound:      high-frequency buildup → pop → electrical hiss
special:    stuns units for 2.4s (cooldown forced)
```

#### CLUSTER (Level 4 unlock)
```
radius:     12 (spread zone)
damage:     28 per submunition, 6 submunitions
falloff:    exponential per munition
uses:       1
effect:     6 smaller explosions scattered in radius
sound:      salvo of staggered pops
```

#### THERMOBARIC (Level 6 unlock)
```
radius:     8.5
damage:     38 initial + 18 burn over 3s
uses:       1
effect:     initial blast + persistent fire particles on ground
sound:      deep thump → sustained roar
special:    damages units that walk through burn zone after impact
```

#### SHIELD DISRUPTOR (Level 8 unlock — boss use)
```
radius:     4.0
damage:     0 HP damage
effect:     disables armored units' damage resistance for 6s
sound:      resonant drone tone
special:    makes tanks take full damage from friendly fire
```

---

## 5. UNIT TYPES

### Blue Team (Allied)
| Type     | HP | Damage | Speed | Range | Visual Identifier      |
|----------|----|--------|-------|-------|------------------------|
| Soldier  | 15 | 2.1    | 2.05  | 5.2   | Small capsule, blue    |
| Medic    | 12 | 0      | 2.2   | —     | White cross on body    |
| Tank     | 42 | 3.6    | 1.4   | 5.2   | Larger, turret visible |

### Red Team (Enemy)
| Type     | HP  | Damage | Speed | Range | Visual Identifier         |
|----------|-----|--------|-------|-------|---------------------------|
| Soldier  | 15  | 2.1    | 2.05  | 5.2   | Small capsule, red        |
| Rocket   | 22  | 4.8    | 1.6   | 7.5   | Shoulder-mounted launcher |
| Tank     | 60  | 5.2    | 1.2   | 5.2   | Larger, dark hull         |
| Commander| 35  | 3.0    | 1.8   | 6.0   | Taller, hat/antenna       |
| Drone    | 20  | 6.0    | 3.5   | 8.0   | Flying unit (v0.5+)       |

### Unit Behavior (AI Rules)
1. Units advance toward enemy base along assigned lane
2. If enemy in range: stop advancing, face enemy, begin firing (cooldown-based)
3. If unit HP < 30%: retreat 2 units back, then resume
4. Tanks protect soldiers behind them (act as shield)
5. Commanders buff nearby units: +15% damage, +10% move speed in 4u radius
6. Units avoid each other (simple separation steering)

---

## 6. LEVEL DESIGN PRINCIPLES

### Level Structure
Each level has:
- **Setting**: Map theme (bridge, desert, urban, arctic, jungle)
- **Objective**: Primary win condition
- **Secondary Objective**: Optional, grants 3rd star
- **Enemy Formation**: Specific unit composition and spawn timing
- **Available Weapons**: Subset of unlocked weapons
- **Time Limit** (optional): Adds pressure from Level 3+

### Level Difficulty Curve
```
L1: Tutorial feel. One bomb. Enemy outnumbers you but moves slow.
L2: EMP introduced. Learn positioning vs. blast weapons.
L3: Two drops available. Time pressure starts.
L4: Cluster bomb. Enemy has Commanders now.
L5: Multi-lane pressure. Multiple objectives.
L6: Thermobaric. Burn zones change map control.
L7: Boss encounter (enemy Drone swarm).
L8: All weapons, hardest formation. True test.
```

### Win/Loss Conditions

**WIN:** Blue HP total >= (Red HP total * threshold)
- Level 1: threshold = 0.88 (very tight, forces good drop)
- Level 3+: threshold = 0.72
- Level 7+: threshold = 0.60

**LOSS:** Red HP total >= (Blue HP total * 1.2) after drop evaluated

**Star Rating:**
- ⭐ — Mission complete (threshold met)
- ⭐⭐ — Secondary objective completed
- ⭐⭐⭐ — Secondary objective + no friendly casualties from player's drop

---

## 7. GAME FEEL SPECIFICATIONS

These are non-negotiable for "high quality" feel. Every item here must be implemented before v0.3 is considered done.

### Camera
- Smooth lerp follow: `lerp(camera.pos, target, dt * 4.2)`
- On weapon drop: camera shake (magnitude: 4, decay: 0.3s, frequency: 12hz)
- On level start: cinematic pan from above down to play position (1.5s)
- FOV: 55° normal, briefly widens to 62° on explosion (lerp back over 0.4s)

### Visual Effects (VFX)
- **Explosion**: Expanding sphere → fade out (0.55s) + 10 smoke spheres rising + ground scorch (persistent flat circle, fades over 8s)
- **EMP**: Expanding cyan ring (not sphere) + electrical arc particles on stunned units
- **Unit death**: Don't just hide — ragdoll-like fall (rotate 90° sideways over 0.4s, then fade out)
- **Bullet tracers**: Thin, fast lines (not spheres) — use `Line` geometry
- **Muzzle flash**: Brief bright sphere at barrel tip on fire (0.06s, then gone)
- **Hit flash**: Unit briefly turns bright white on taking damage (0.08s)

### Audio (Web Audio API — no external libs)
- Explosion boom: synthesized low-frequency impulse + room reverb
- EMP: synthesized high-frequency sweep descending
- Gunfire: rapid percussive clicks (looped pattern per unit)
- Ambient: low wind hum (subtle, always present)
- UI: clean click sounds on button interactions
- Music: optional tension loop during OBSERVE phase (can be off by default)

### UI Feedback
- Health bars: smooth lerp (not instant jump) when taking damage
- Phase text: fade transition between states
- Star rating reveal: animated, one star at a time with sound
- Drop button: pulse animation when player is in prime target zone (optional visual hint)

---

## 8. PROGRESSION & RETENTION

### Level Unlock
- Complete Level N with at least 1 star → Level N+1 unlocked
- Levels can be replayed to improve star rating

### Persistent Storage (localStorage)
```javascript
{
  "levelProgress": {
    "1": { "stars": 3, "bestTime": 34 },
    "2": { "stars": 2, "bestTime": null },
    ...
  },
  "unlockedWeapons": ["BOMB", "EMP"],
  "settings": { "sfxVolume": 0.8, "musicVolume": 0.5 }
}
```

### Future Retention Hooks (v1.0+)
- Daily Challenge: fixed seed, leaderboard score
- Weapon upgrade system (damage/radius improvements)
- Achievement system (10 achievements at launch)

---

## 9. VISUAL STYLE GUIDE

### Art Direction: "Military Realism Lite"
- Clean, readable forms — not photorealistic, not cartoonish
- Think: a polished wargame map come to life
- Color palette is desaturated with strong accent colors for teams

### Color Palette
```
Background Sky:     #8EC7FF (day), #2B3A52 (night levels)
Ground Base:        #5FBD52
Ground Variation:   #74CA58
Road:               #6B625A
Water:              #3CAEE5
Blue Team:          #297BFF (units), #1A5FD4 (base)
Red Team:           #F24848 (units), #B32020 (base)
Explosion:          #FFB340 → #FF4400 (gradient over time)
EMP:                #65D8FF
UI Background:      rgba(9, 16, 24, 0.72)
UI Border:          rgba(255, 255, 255, 0.16)
UI Text Primary:    #FFFFFF
UI Text Secondary:  rgba(255, 255, 255, 0.72)
UI Accent:          #FFE28A
```

### Lighting
- Primary: DirectionalLight (sun) — position (-25, 42, 20), warm white
- Ambient: HemisphereLight — sky #FFFFFF, ground #7AA05C
- Shadow: PCFSoftShadowMap, 1024x1024 map
- Night levels: reduce sun intensity, add cool ambient, add unit emission glow

### Post-Processing (Three.js post — v0.7+)
- Bloom: subtle, only on explosions and muzzle flashes
- FXAA: antialiasing pass for smooth edges on mobile
- Vignette: very subtle dark corners, always on

---

## 10. ANTI-PATTERNS TO AVOID

These are decisions that will hurt the game. Do not implement these under any circumstances:

1. **Auto-targeting** — Never aim the bomb for the player. The whole game is about positioning.
2. **Difficulty that cheats** — Enemy HP scaling is fine, invisible damage buffs are not.
3. **Unskippable cutscenes** — Cinematic intro maximum 2 seconds. Always skippable.
4. **Pay-to-win placeholders** — No in-app purchase hooks in v1.0. Adds nothing, risks everything.
5. **Tutorial popups mid-game** — Tutorial is baked into Level 1 design, not modal boxes.
6. **Screen clutter** — Every UI element earns its place. When in doubt, remove it.
7. **Random outcomes that ignore player skill** — RNG in unit movement is fine (natural feel). RNG in whether a bomb lands where you aimed is not acceptable.
