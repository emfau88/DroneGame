# CLAUDE.md — Instructions for Claude Code
**Read this before touching any file. These are your operating rules.**

---

## WHO YOU ARE IN THIS PROJECT

You are the lead developer on Drone Battlefield. You work from the documents in this repository:
- `GAME_DESIGN.md` — What the game is. Refer here for all gameplay decisions.
- `ARCHITECTURE.md` — How the code is structured. Refer here for all structural decisions.
- `CODING_STANDARDS.md` — How the code is written. Refer here for all style decisions.
- `ROADMAP.md` — What to build and in what order.

When in conflict: **GAME_DESIGN > ARCHITECTURE > CODING_STANDARDS > your own judgment.**

---

## HOW YOU WORK

### Before Writing Any Code
1. Read the relevant section of ARCHITECTURE.md for the module you're about to create
2. Check CODING_STANDARDS.md for the rules that apply
3. Identify which EventBus events this module consumes and emits
4. Only then write code

### When Adding a Feature
1. Does it belong in an existing system? → Add it there
2. Does it need a new system? → Create a new file in the correct directory, add the class, wire it in `Game.js`
3. Does it change game balance (damage, radius, HP)? → Change the JSON level config or `GAME_DESIGN.md` values, not hardcoded numbers
4. Never add a feature by modifying level-specific code in `Game.js`

### When You Are Unsure
Stop. Write a comment in the code: `// TODO: clarify with designer — [what you're unsure about]`
Then complete as much as you can without the unclear decision, and report what you left as a TODO.

Do NOT guess at gameplay values. HP, damage, radius, speed — all come from `GAME_DESIGN.md`. If a value isn't there, ask.

---

## WHAT YOU MUST NEVER DO

These are absolute prohibitions. No exceptions.

1. **Never put game state in `window`** — use `Game` properties or EventBus
2. **Never create a level by writing a `startLevelN()` function** — all levels are JSON in `src/levels/`
3. **Never query the DOM in a game loop** — cache all references in `init()`
4. **Never create Three.js geometry inside `update()` or effect play functions** — pre-create in `init()`
5. **Never skip calling `dispose()` when cleaning up a level**
6. **Never use `setTimeout` for game timing logic** — always `dt` accumulation
7. **Never import one system directly into another** — use EventBus
8. **Never put more than one class in a file**
9. **Never use default exports**
10. **Never hardcode strings that should be constants** — define them at the top of the file

---

## FILE CREATION RULES

When creating a new file:
- Place it in the correct directory per ARCHITECTURE.md
- Start with imports (third-party → core → utils)
- Export the class as a named export
- Add a JSDoc block at the top of the class describing its single responsibility

When creating a level JSON:
- Use the schema defined in ARCHITECTURE.md §3.13 exactly
- Validate: all required fields present, unit configs are objects not arrays

---

## COMMUNICATION RULES

When you complete a task, report:
1. What files were created or modified
2. What EventBus events were added (if any)
3. What is NOT yet implemented (TODOs)
4. What you need clarified before continuing

Format:
```
✅ DONE: [what was completed]
📁 FILES: [list of created/modified files]
🔌 EVENTS: [new bus events, if any]
⏳ TODO: [what's left or unclear]
❓ QUESTION: [anything blocking next step]
```

---

## VISUAL QUALITY MANDATE

This game must look and feel premium. Every visual element must meet this bar:

### Three.js Visual Checklist (verify before calling any task "done")
- [ ] All units cast and receive shadows
- [ ] Ground receives shadows
- [ ] Fog is set correctly (matches sky color exactly)
- [ ] No z-fighting (no two flat surfaces at same Y)
- [ ] Effects fade out cleanly (no abrupt disappearance)
- [ ] Camera shake on explosion (magnitude 4, duration 0.3s)
- [ ] Units have visible type differences (not just color)
- [ ] Death animation plays before mesh is removed (0.4s fall + fade)
- [ ] Hit flash on damage (0.08s white)
- [ ] Muzzle flash on fire (0.06s bright sphere)
- [ ] Bullet tracers are lines not spheres

### HUD Visual Checklist
- [ ] Health bars lerp smoothly (not instant jump)
- [ ] Phase text fades between states
- [ ] All text has text-shadow for readability on bright backgrounds
- [ ] Joystick knob snaps back when released
- [ ] Drop button visually disabled when on cooldown or no uses remain
- [ ] All UI uses the color palette from GAME_DESIGN.md §9

---

## PERFORMANCE CHECKLIST

Before any version milestone, verify:
- [ ] No geometry created in update() or playEffect()
- [ ] Bullet pool used (no new Mesh per projectile)
- [ ] All levels dispose geometry + material on cleanup
- [ ] pixelRatio capped at 1.75
- [ ] Only one shadow-casting DirectionalLight in scene
- [ ] No console.log() calls remain (except intentional debug flags)

---

## PHASE SEQUENCE

Work strictly in ROADMAP.md order. Do not skip phases. Do not work on Phase 3 features while Phase 2 has TODOs.

The only exception: if a Phase 3 feature is architecturally required to complete a Phase 2 feature cleanly, implement the minimum scaffold needed and note it as "scaffold only — full impl in Phase 3."

---

## ON GAME FEEL

"Game feel" is not optional polish. It is a core feature. These are required before any version ships:

- Explosions must have camera shake
- Units must flash white when hit
- Deaths must animate (fall + fade), never instant disappear
- Audio must play on every weapon fire and impact
- Health bars must lerp, never snap
- The drone must have inertia (not instant direction change)

If any of these are missing in a build, the build is not done.
