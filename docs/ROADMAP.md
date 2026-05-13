# ROADMAP — Drone Battlefield
**Target:** v1.0 Release-Ready  
**Versioning:** Each version is a shippable milestone. Never skip a version.

---

## PHASE OVERVIEW

| Version | Name              | What you have when done                              | Est. Sessions |
|---------|-------------------|------------------------------------------------------|---------------|
| v0.1    | Fundament         | Clean architecture running, Level 1 playable         | 2–3           |
| v0.2    | Core Loop         | Real tactical decisions, multi-drop, win/loss flow   | 2–3           |
| v0.3    | Game Feel         | Sounds, VFX, camera shake — it feels like a game     | 2–3           |
| v0.4    | Content           | 5 levels, 2 more weapon types, unit variety          | 3–4           |
| v0.5    | Balance           | Difficulty that scales, tuned numbers, AI improved   | 2             |
| v0.6    | Meta & Retention  | Stars, progression, unlock system, score screen      | 2             |
| v0.7    | Mobile Polish     | Perfect touch controls, perf on low-end devices      | 2             |
| v0.8    | UI/UX             | Full menu system, settings, pause, animations        | 2–3           |
| v0.9    | QA & Bugfix       | Playtested, critical bugs fixed, perf profiled       | 2             |
| v1.0    | Release           | Deployed, shareable, works on all target devices     | 1             |

---

## v0.1 — FUNDAMENT ✅
**Goal:** Delete the preview.html forever. The new architecture runs Level 1 correctly.

### Setup Tasks
- [x] `npm create vite@latest drone-battlefield -- --template vanilla`
- [x] Install Three.js: `npm install three`
- [x] Copy all 5 docs into project root
- [x] Create directory structure per ARCHITECTURE.md §2

### Core Module Implementation
- [x] **`EventBus.js`** — `on()`, `off()`, `emit()`. Export singleton `bus`.
- [x] **`StateMachine.js`** — States: `BOOT`, `MENU`, `PLAYING`, `ENDED`. Transition validation. Emits `'state:changed'` on transition.
- [x] **`Renderer.js`** — Three.js scene, camera, renderer. Shadow setup. `render()`, `resize()`, `shake()` stub.
- [x] **`InputManager.js`** — Joystick (pointer events), keyboard (WASD/Space), unified output: `{ x, y, fire }`. Fire is edge-triggered (not held).
- [x] **`Game.js`** — Constructs all systems. `init()` wires them together in correct order. `_loop()` calls `_update(dt)` and `_render()`.

### Entity Layer
- [x] **`Entity.js`** — Base class. `id` (crypto.randomUUID), `group`, `position` alias, `alive`, `destroy()`.
- [x] **`Drone.js`** — Extends Entity. Drone mesh (body + arms + rotors). `update(dt, input)` with inertia. Tilts on movement.
- [x] **`Unit.js`** — Extends Entity. Builds mesh based on `type` ('soldier', 'tank', 'rocket'). Stores stats from config. `takeDamage()`, `stun()`, `kill()` (stub animation).
- [x] **`Projectile.js`** — Extends Entity. Line geometry (tracer). Moves toward target. Applies damage on arrival. Auto-destroys.

### World & Level
- [x] **`World.js`** — Terrain, lighting, bridge, river, cover objects. Accepts `setting` string to vary appearance (only `'bridge'` needed now).
- [x] **`LevelLoader.js`** — Loads JSON, spawns units via `BattleSystem`, sets up weapons via `WeaponSystem`, calls `World.build(config)`.
- [x] **`src/levels/level1.json`** — Full config per ARCHITECTURE.md §3.13 schema.

### Systems (v0.1 scope — functional, not polished)
- [x] **`BattleSystem.js`** — `spawnUnit()`, `update(dt)`, unit AI (advance → fight → advance). Projectile management. `getScore()`. Emits `'unit:died'`, `'score:updated'`.
- [x] **`WeaponSystem.js`** — BOMB only. `fire(pos, units)`. Returns `WeaponResult`. Handles uses count. Emits `'weapon:impact'`.
- [x] **`EffectSystem.js`** — Listens to `'weapon:impact'`, plays explosion (sphere scale + smoke). No audio yet. Update loop fades effects.
- [x] **`AudioSystem.js`** — Stub only. All methods exist but do nothing. Web Audio Context initialized on first user gesture.

### UI (v0.1 scope — functional, not beautiful)
- [x] **`HUD.js`** — Phase text, blue/red bars, weapon button. Listens to `'score:updated'`, `'phase:changed'`. Caches all DOM refs in `init()`.
- [x] **`MenuManager.js`** — Start screen, level select (Level 1 only), end screen (win/loss + restart). Emits `'menu:levelSelected'`, `'menu:restart'`.

### v0.1 Acceptance Criteria
- [x] `npm run dev` runs without errors
- [x] Start screen shows, Level 1 selectable
- [x] Drone moves with joystick (inertia present)
- [x] BOMB drops at drone position
- [x] Units advance, fight, die (no animations yet)
- [x] Win/loss detected correctly
- [x] Restart works cleanly (no lingering state)
- [x] No global variables (`window.xyz` = zero)
- [x] No DOM queries in update loop (verify with grep)

---

## v0.2 — CORE LOOP ✅
**Goal:** The game has real tactical decisions. You can lose by making bad choices.

### Weapon System Expansion
- [x] Multi-use weapons (BOMB: 2 uses from Level 3 onward)
- [x] Weapon cooldown timer (visual feedback: button dims, fills back)
- [x] **`src/levels/level2.json`** — EMP level. `WeaponSystem` handles EMP: stun effect, no instant kill.
- [x] EMP implementation: `stun(duration)` on `Unit`. Unit freezes mid-advance, cooldown reset.
- [x] Weapon button shows current weapon name + uses remaining

### AI Improvements
- [x] Units respect each other's space (simple separation: push apart if overlapping)
- [x] Retreat behavior: if `hp < maxHp * 0.3`, retreat 2 units back, then resume
- [x] Tanks protect: soldiers behind a tank get 30% damage reduction from projectiles
- [x] Commander unit: buffs nearby allies +15% damage, +10% speed in 4u radius

### Win/Loss Polish
- [x] Win condition now evaluates after `observeTimer` expires (not instant)
- [x] Secondary objective tracking (first: eliminate Commander)
- [x] `endGame()` calculates star rating (1–3 stars per `GAME_DESIGN.md §6`)
- [x] Post-level screen: shows stars earned, primary/secondary objective status

### Phase System
- [x] Explicit phase tracking: `OBSERVE → AIMING → IMPACT → RESULT`
- [x] `'phase:changed'` emitted on each transition
- [x] HUD phase text updates with fade transition
- [ ] AIMING phase: target ring pulses when drone is over high-density enemy zone (optional hint) — deferred to v0.3

### Level Design
- [x] Level 1 JSON: add Commander to red team
- [x] Level 2 JSON: EMP weapon + EMP+BOMB combo
- [x] Both levels: secondary objectives defined
- [ ] Level 2 convoy mechanic (moving blue objective) — not implemented, removed from scope (no convoy unit type)

### v0.2 Acceptance Criteria
- [x] Dropping BOMB at the wrong place causes a loss (verified by testing)
- [x] EMP stuns units visibly (they freeze)
- [x] Star rating shows correctly after level end
- [x] Secondary objective (Commander kill) tracked and reported
- [x] Retreat behavior visible in late-stage combat
- [x] No unit Z-fighting or overlap clipping issues (lane Z-clamp enforced, MAP_X_LIMIT kill boundary)
- [ ] Performance: 60fps on M1 MacBook, 30fps on mid-range Android — not yet profiled

---

## v0.3 — GAME FEEL
**Goal:** Close your eyes and listen. Open them and feel. This version is all sensation.

### Camera
- [x] **Cinematic level start**: Camera starts high above (y=80), smoothly descends to play position over 1.5s. Non-interactive during descent.
- [x] **Explosion shake**: `Renderer.shake(magnitude=4, duration=0.3)`. Applied on `'weapon:impact'`. *(implemented in v0.2)*
- [x] **FOV pulse**: On explosion, `camera.fov` jumps to 62 from 55, lerps back over 0.4s. *(implemented in v0.2)*
- [x] **Soft camera follow**: Drone leads camera slightly (camera target = drone.pos + velocity * 0.3).

### VFX — Complete Implementation
All effects must be pre-built in `EffectSystem.init()`. Nothing created at runtime except positioning.

- [x] **Explosion:**
  - [x] Expanding sphere (scale 0.2→6.5 over 0.55s, opacity 0.72→0) *(implemented in v0.2)*
  - [x] 10 smoke spheres: scattered, rise via `vy`, expand in size, fade over 2.5s *(implemented in v0.2)*
  - [x] Ground scorch decal: flat circle (radius 3), opacity 0.6→0 over 8s *(implemented in v0.2)*
  - [x] Debris: 6 small boxes scatter outward, rotate, fade (0.8s) *(implemented in v0.2)*

- [x] **EMP:**
  - [x] Expanding ring (not sphere) — `RingGeometry` grows outward *(implemented in v0.2)*
  - [x] Cyan electrical arcs on stunned units: 3 `Line` segments per unit, flicker 3x then fade *(implemented in v0.2)*
  - [x] Units emit brief cyan glow on stun (`material.emissive` flash) *(implemented in v0.2)*

- [x] **Unit death animation:**
  - [x] Unit rotates 90° sideways over 0.4s (like falling) *(implemented in v0.2)*
  - [x] Simultaneously fades opacity to 0 *(implemented in v0.2)*
  - [x] Then `destroy()` called *(implemented in v0.2)*
  - [x] No instant `visible = false` anywhere *(implemented in v0.2)*

- [x] **Hit flash:**
  - [x] On `takeDamage()`: `material.emissive = 0xFFFFFF` for 0.08s, then back *(implemented in v0.2)*
  - [x] Affects all meshes in unit group *(implemented in v0.2)*

- [x] **Muzzle flash:**
  - Small sphere (r=0.2) at barrel tip on fire
  - `MeshBasicMaterial`, bright white-yellow
  - Exists for 0.06s then removed

- [x] **Bullet tracer:**
  - [x] `Line` geometry (2 points, origin → target) *(implemented in v0.1)*
  - [x] Colored by team *(implemented in v0.1)*
  - [ ] 3-point midpoint curve + lerp movement *(still straight line, not lerped arc)*

### Audio — Full Implementation
All sounds synthesized via Web Audio API. No audio files needed.

- [x] **AudioSystem.init():** Create `AudioContext` on first user gesture. Master gain node. SFX gain node.

- [x] **`playExplosion(intensity)`:**
  - Low-frequency oscillator burst (80Hz, 0.3s decay)
  - White noise component (0.1s, filtered)
  - Low-pass filtered rumble tail (0.6s)
  - Gain: `intensity` scales peak amplitude

- [x] **`playEMP()`:**
  - Sine sweep: 8000Hz → 200Hz over 0.5s
  - Brief silence, then electrical crackle (noise burst, 0.1s)

- [x] **`playGunshot()`:**
  - Very short noise burst (0.02s)
  - High-pass filtered
  - Slight pitch randomization per call

- [x] **`playImpact()`:**
  - Mid-frequency thud (400Hz, 0.15s decay)

- [x] **`playUIClick()`:**
  - Clean sine blip (800Hz, 0.04s)

- [x] **`playLevelWin()`:**
  - Three ascending notes (C-E-G, 0.15s each)

- [x] **`playLevelLoss()`:**
  - Descending minor interval (0.3s each note)

- [x] **`startWind()`:**
  - Low-amplitude brown noise loop
  - Volume: 0.04 (barely perceptible, creates presence)

### HUD Polish
- [x] Health bars: CSS transition `width 0.3s ease-out` (not instant) *(in index.html)*
- [x] Phase text: `opacity` transition 0.2s on change *(in HUD.js + CSS)*
- [x] Weapon button: disabled state shows cooldown fill animation (height-based inner fill) *(implemented in v0.2)*
- [x] Drop button: pulse glow when drone is over optimal position (≥3 red units inside weapon radius)

### v0.3 Acceptance Criteria
- [x] Cinematic intro plays on level start
- [x] Explosion causes camera shake every time (no exceptions) *(implemented in v0.2)*
- [x] Every unit death animates (no instant disappear) *(implemented in v0.2)*
- [x] Every hit shows white flash *(implemented in v0.2)*
- [x] All 7 sounds play at correct moments
- [x] Wind ambience always present during play
- [x] Ground scorch visible after explosion, fades over 8s *(implemented in v0.2)*
- [ ] 60fps maintained during explosions on target hardware — not yet profiled
- [ ] Someone who has never seen the game says "oh wow" at the explosion — subjective, requires playtest

---

## v0.4 — CONTENT
**Goal:** 5 playable levels. 4 weapon types. The game has variety.

### Levels 3–5
Each level needs: JSON config + any new terrain features in `World.js`

- [x] **Level 3 — Desert Ambush:** Open terrain, no bridge. Time limit (90s). 2 BOMB uses. Enemy flanks from two directions.
  - Terrain: `setting: "desert"`. Sandy color palette. Sand dune cover objects.
  - Enemy: 3 lanes + flanking squad starting close to blue side.
  - Mechanic: Player must prioritize which cluster to bomb first.

- [ ] **Level 4 — Cluster Strike:** Forest clearing. CLUSTER weapon introduced.
  - Terrain: `setting: "forest"`. Tree objects as cover (block unit movement).
  - Enemy: Tight cluster formations — CLUSTER bomb becomes most efficient.
  - Mechanic: Units hide behind trees, must be flushed out.
  - Trees: `Box` geometry, slightly randomized, cast shadows, block unit pathfinding.

- [ ] **Level 5 — Multi-Objective:** Urban ruins. Two simultaneous objectives.
  - Terrain: `setting: "urban"`. Ruined wall geometry. Two separate bridges.
  - Enemy: Split force attacks both bridges simultaneously.
  - Mechanic: Player cannot save both with one drop. Must choose which to prioritize. Second objective fails unless secondary weapon used (if 2 uses).
  - Story beat: First level where perfect score requires optimal decision-making.

### Weapons
- [ ] **CLUSTER bomb** (Level 4 unlock): Full implementation per `GAME_DESIGN.md §4`
  - 6 submunitions scattered in 12u radius
  - Each submunition: separate small explosion effect + sound
  - Timing: submunitions land over 0.8s (staggered) — not simultaneous

- [ ] **Weapon selection UI** (for levels with multiple weapons):
  - Simple toggle above drop button when 2+ weapons available
  - Shows weapon icon + uses remaining
  - Switching weapon changes drop button appearance + label

### Unit Visual Differentiation
Currently all units look the same except color. Fix this:
- [ ] **Soldier**: Capsule body, no extras (baseline)
- [ ] **Tank**: Wider box body + turret box + barrel cylinder. Visibly larger.
- [ ] **Rocket**: Standard body + shoulder-mounted box (angled 30°)
- [ ] **Commander**: Taller capsule + small antenna box on top
- [ ] **Medic**: White cross decal (flat plane, `DoubleSide`)

### World Settings
Implement terrain variety in `World.js`:
- [ ] `'bridge'` — existing (river + bridge + road)
- [ ] `'desert'` — sandy ground, dune cover, no water, warm sky
- [ ] `'forest'` — green ground, tree objects that block movement, neutral sky
- [ ] `'urban'` — grey ground, ruined wall pieces, two road axes

### v0.4 Acceptance Criteria
- [ ] All 5 levels completable from start to end
- [ ] Each level feels mechanically distinct (different decisions required)
- [ ] CLUSTER bomb works: 6 separate impact points visible
- [ ] All 5 unit types visually distinguishable at a glance
- [ ] Forest trees block unit movement (units pathfind around them — simple: if blocked, try adjacent lane)
- [ ] Level 5 forces a genuine strategic choice

---

## v0.5 — BALANCE & DIFFICULTY
**Goal:** The game is fair. You can always tell why you lost.

### AI Improvements
- [ ] **Smarter targeting:** Units prefer to target the nearest high-threat unit (Rocket > Tank > Commander > Soldier) rather than nearest unit
- [ ] **Formation maintenance:** Red units space themselves correctly on spawn, don't cluster unrealistically
- [ ] **Tank shield behavior:** Tank physically interposes between soldiers and enemies (path toward most endangered soldier, not always forward)

### Difficulty Tuning
- [ ] **Easy mode** (selectable in menu): 80% of red HP, 15% slower speed, extra BOMB use
- [ ] **Hard mode** (unlocked after 3-star Level 5): +25% red HP, red units shoot faster, time limits on every level

For each of the 5 levels, playtest and document:
- [ ] Average player completion rate (test with 3+ people)
- [ ] Most common death scenario
- [ ] Adjust enemy count/composition accordingly

### Balancing Worksheet
For each level, verify these parameters feel right:
```
Level N:
- Red HP total at start: ___
- Blue HP total at start: ___
- Win threshold: ___
- Average time to decide: ___
- Most common winning drop position: ___
- Does a bad drop guarantee loss? (should be YES for L1–3, maybe for L4–5)
```

### Win Condition Tuning
- [ ] Review and adjust `winThreshold` per level based on playtesting
- [ ] Ensure 3-star condition requires genuine skill, not just luck

### Performance Pass
- [ ] Profile update loop — identify top 3 CPU consumers
- [ ] Verify object pool is working (no spike on explosion)
- [ ] Test on: Chrome Android (mid-range), Safari iOS 16, Firefox desktop
- [ ] If <30fps on target mobile: reduce shadow map to 512, reduce geometry segments

### v0.5 Acceptance Criteria
- [ ] A player who understands the mechanics can win Level 1 on first try
- [ ] Level 5 requires 2–3 attempts for a new player (non-trivial but fair)
- [ ] Tanks visibly protect soldiers behind them
- [ ] Performance: 30fps on mid-range Android (Snapdragon 720G equivalent)
- [ ] No level is won by random luck — skill consistently determines outcome

---

## v0.6 — META & RETENTION
**Goal:** Players have reasons to return and replay.

### Persistence Layer (`storage.js`)
- [ ] `saveProgress(levelId, stars)` — stores best star rating
- [ ] `getProgress(levelId)` — retrieves, returns `{ stars: 0 }` if not played
- [ ] `saveSettings(settings)` — volume prefs
- [ ] `getSettings()` — with defaults fallback
- [ ] Schema validation on load (corrupt data → reset to defaults, never crash)

### Level Select Screen
- [ ] Shows all 8 levels (even locked ones — shown as padlock)
- [ ] Each completed level shows star rating (animated reveal on first view)
- [ ] Locked levels show unlock condition: "Complete Level N"
- [ ] Levels 6–8 locked initially

### Star Rating System
- [ ] `StarRating.js` — animated reveal component
- [ ] 3 star positions, each animates in sequentially (0.3s delay between)
- [ ] Sound: small chime per star
- [ ] Empty stars shown for unearned

### Score Screen
After each level:
- [ ] Stars earned (animated)
- [ ] Primary objective: ✅ or ❌
- [ ] Secondary objective: ✅ or ❌
- [ ] "Best run" indicator if this is their new best star count

### Replayability Hooks
- [ ] Each level tracks best star count (shown on level select)
- [ ] 3-star all levels = visible achievement on main menu ("Full Campaign Complete")
- [ ] Replay button on score screen (one-click, skips all menus)

### v0.6 Acceptance Criteria
- [ ] Progress survives page refresh
- [ ] Level select shows accurate star ratings
- [ ] Star animation plays on every level completion
- [ ] All 8 level slots visible on level select (locked 6–8)
- [ ] Storage never causes a crash (tested with corrupt localStorage)

---

## v0.7 — MOBILE POLISH
**Goal:** Flawless on iOS Safari and Android Chrome. Your primary audience is mobile.

### Touch Control Audit
- [ ] Joystick dead zone: 8% of radius — prevents drift on cheap screens
- [ ] Joystick knob returns to center with visible snap animation (CSS transition 0.1s)
- [ ] Drop button: minimum 90px tap target (verify with DevTools)
- [ ] No accidental triggers: drop button requires `pointerdown` on button itself (not on joystick release)
- [ ] Multi-touch: joystick and drop button work simultaneously (separate pointer IDs)
- [ ] Prevent scroll/zoom: `touch-action: none` on all interactive elements
- [ ] `user-scalable=no` in viewport meta (already present — verify)

### iOS Safari Specifics
- [ ] `AudioContext` resumes on first user gesture (required by iOS)
- [ ] No `position:fixed` elements that jump on iOS address bar show/hide — use `100dvh` not `100vh`
- [ ] Test all levels on iPhone SE (smallest common viewport: 375px wide)

### Android Chrome Specifics
- [ ] Test on 360px wide viewport (common Android width)
- [ ] Verify joystick and button don't overlap on small screens
- [ ] `devicePixelRatio` cap at 1.75 enforced (many Android phones are 3x)

### Performance on Low-End Mobile
Target: 30fps on Snapdragon 720G (mid-2021 Android)
- [ ] If failing: reduce shadow map to 512x512
- [ ] If still failing: disable bloom (if implemented)
- [ ] If still failing: reduce unit geometry segments (CapsuleGeometry 4,8 → 4,6)
- [ ] Add `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))` toggle for low-end

### Viewport & Layout
- [ ] Game canvas always fills screen, no overflow
- [ ] HUD elements don't overlap controls on landscape mode
- [ ] Test both portrait and landscape orientations
- [ ] Level select scrolls correctly on small screens

### v0.7 Acceptance Criteria
- [ ] All 5 levels completable on iPhone SE (375px) in portrait
- [ ] All 5 levels completable on 360px Android in portrait
- [ ] Joystick and drop button never interfere with each other
- [ ] AudioContext never "suspended" after level start
- [ ] 30fps sustained on target Android device during full battle

---

## v0.8 — UI/UX
**Goal:** Every screen looks and feels premium. No rough edges.

### Main Menu Redesign
- [ ] Full-screen background with animated 3D scene (zoomed-out battlefield view, no interaction)
- [ ] Game logo: bold, military-styled typography (use Google Fonts: `Rajdhani` or `Orbitron`)
- [ ] "PLAY" button → level select
- [ ] "SETTINGS" button → settings overlay
- [ ] Subtle animated gradient or particle effect in background

### Level Select
- [ ] Grid layout: 2 columns on mobile, 4 on desktop
- [ ] Each level card: number, name, setting thumbnail (colored placeholder), star rating
- [ ] Locked cards: desaturated, padlock icon
- [ ] Hover/active state on cards (scale 1.03, border glow)

### In-Game HUD Polish
- [ ] Compact redesign: less screen space, more game visible
- [ ] Weapon indicator: icon + count (not just text)
- [ ] Phase indicator: subtle color shift in top bar per phase
- [ ] Timer bar (when time limit active): horizontal bar at top, color shifts red at <20s

### Settings Screen
- [ ] SFX volume slider
- [ ] Music volume slider (music stub — slider present, no music yet)
- [ ] "Reset Progress" button (requires confirmation)
- [ ] Back button (→ main menu)

### Pause Menu
- [ ] `ESC` key or pause button (top-right corner icon) triggers pause
- [ ] `StateMachine.transition('PAUSED')`
- [ ] Overlay: resume, restart, main menu options
- [ ] Battle frozen during pause (update loop halted)

### Transitions
- [ ] Screen fade (black overlay, 0.3s) between all major state changes
- [ ] Level title card: shows level name for 1s before cinematic starts
- [ ] Score screen: slides up from bottom after level ends (not instant appear)

### Typography
- [ ] Import Google Font: `Rajdhani` (military-clean, highly legible, unique)
- [ ] Apply to all HUD text
- [ ] Apply to all menu text
- [ ] System fonts as fallback only

### v0.8 Acceptance Criteria
- [ ] Main menu looks like a shipped product, not a prototype
- [ ] Level select is navigable without explanation
- [ ] Pause works correctly (battle truly frozen)
- [ ] Settings sliders affect audio volume immediately
- [ ] All screen transitions are animated (no hard cuts)
- [ ] Rajdhani font loaded and applied everywhere

---

## v0.9 — QA & BUGFIX
**Goal:** Find every bug before a stranger does.

### Playtesting Protocol
- [ ] 5 people who have never seen the game play through all 5 levels
- [ ] Document: where they got stuck, what confused them, where they died unexpectedly
- [ ] For each piece of feedback: either fix it or consciously decide not to with a written reason

### Bug Categories (track all)
- **P0 — Game-breaking:** Crash, soft lock, data loss → fix immediately
- **P1 — Level-breaking:** Can't complete a level, wrong win/loss → fix before v1.0
- **P2 — Visual glitch:** Z-fighting, texture issue, effect doesn't play → fix if time allows
- **P3 — Polish miss:** Minor visual imperfection, typo → log for v1.1

### Required Tests
- [ ] Complete all 5 levels from cold start (no cache)
- [ ] Restart mid-level → no leftover state from previous run
- [ ] Win Level 1 → go to Level 2 → win → check level select stars updated
- [ ] Lose Level 3 → restart → win → confirm correct outcome
- [ ] localStorage full (simulate): game degrades gracefully
- [ ] Resize window mid-game: no layout break
- [ ] Switch between portrait/landscape mid-level (mobile): no crash

### Performance Profiling
- [ ] Chrome DevTools Performance tab: record 30s of Level 5 (heaviest)
- [ ] Identify any function taking >2ms per frame
- [ ] Fix top 3 offenders

### Pre-Release Checklist
- [ ] Zero `console.log()` calls in production build
- [ ] `npm run build` completes without warnings
- [ ] `dist/` folder is self-contained (open `index.html` directly — no server needed for basic test)
- [ ] All 5 level JSONs valid (no missing required fields)
- [ ] `CLAUDE.md` Visual Quality Checklist: 100% checked
- [ ] `CLAUDE.md` Performance Checklist: 100% checked

---

## v1.0 — RELEASE
**Goal:** Live. Shareable. People can play it.

### Deployment
- [ ] Deploy to **Netlify** (free tier) or **GitHub Pages**
  - Netlify: `npm run build` → drag `dist/` folder to netlify.com/drop
  - GitHub Pages: push `dist/` to `gh-pages` branch via `gh-pages` npm package
- [ ] Custom domain (optional): point domain to deployment
- [ ] HTTPS enforced (required for AudioContext on mobile)
- [ ] Test deployed URL on: iOS Safari, Android Chrome, Desktop Chrome, Desktop Firefox

### Final Verification on Live URL
- [ ] Load time <3s on 4G mobile (use Chrome DevTools Network throttling)
- [ ] All assets load (no 404 errors in console)
- [ ] AudioContext works on live HTTPS URL
- [ ] localStorage works on live URL (not blocked by browser policy)

### Share Package
- [ ] Write 2-sentence game description for sharing
- [ ] Take 3 screenshots (menu, mid-battle, explosion moment)
- [ ] Record 15-second gameplay clip (optional but valuable)

### v1.0 Acceptance Criteria
- [ ] URL is live and accessible without login
- [ ] All 5 levels completable from the live URL
- [ ] Passes Mobile Lighthouse audit score >70 Performance
- [ ] You can share the link in a message and the recipient plays without setup

---

## POST v1.0 BACKLOG (Future Versions)
These are explicitly NOT in scope for v1.0. Log them here to avoid scope creep.

| Feature                         | Rationale for deferral                          |
|---------------------------------|-------------------------------------------------|
| Levels 6–8                      | Need v1.0 feedback to inform design            |
| Thermobaric + Shield Disruptor  | Weapons need levels to shine in               |
| Boss encounter (Level 7)        | Requires enemy Drone unit (new entity)         |
| Daily Challenge mode            | Needs server or deterministic seed system      |
| Leaderboard                     | Needs backend                                  |
| Weapon upgrade system           | Needs economy/meta layer                        |
| Post-processing (Bloom, FXAA)   | Implement in v1.1 if perf allows               |
| Music soundtrack                | Needs original composition or licensed track   |
| Achievements                    | Post-launch retention feature                  |
| Multiplayer                     | Entire separate product                        |
