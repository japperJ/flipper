# Pinball Redesign — Design Spec

**Date:** 2026-05-15
**Status:** Approved (brainstorming phase)
**Decisions:** Custom fixed-timestep physics (C2) · Classic table feature set (S2) · Retro neon visuals (T2)

---

## Goal

Replace the current Matter.js-based pinball in `index.html` with a from-scratch implementation that:

1. Eliminates the wedge-pocket / stuck-ball class of bugs by construction.
2. Feels like a real pinball table (snappy flippers, active slingshots, ejecting bumpers).
3. Adds gameplay objectives (drop targets, spinner, captive lane, ramp loop, combos, ball saver).
4. Looks like a glowing neon arcade pinball.

Single-file deliverable: `index.html` (no build tools, no external libraries).

## Non-Goals

- Multiball (deferred to a future S3 release).
- Mode/objective state machine (deferred).
- High-score persistence (in-memory only).
- Mobile / touch input (keyboard only).
- Sprite-based art (procedural vector + glow only).

## Constraints

- One `index.html` file. No external runtime dependencies.
- Canvas 420 × 720 px (existing footprint).
- Keyboard controls: `Z`/`←` left flipper, `/`/`→` right flipper, `Space` plunger (hold to charge), `R` restart.
- Must run by opening `index.html` directly in a browser (file:// scheme).

---

## 1. Architecture

Single `<script type="module">` organized into logical sections (top → bottom):

| # | Section | Responsibility |
|---|---------|----------------|
| 1 | CONFIG | constants, palette, table dimensions, tuning numbers |
| 2 | MATH | `Vec2` helpers, clamp, segment/arc math |
| 3 | PHYSICS | ball state, fixed step, broadphase, collision response |
| 4 | TABLE | static geometry: walls (segments + arcs), bumpers, slingshots, drops, spinner, scoop |
| 5 | FLIPPERS | left/right flipper kinematics + ball interaction |
| 6 | PLUNGER | charge + release |
| 7 | SCORING | hits, drop-target groups, combos, ball saver, multipliers |
| 8 | INPUT | keyboard wiring |
| 9 | RENDER | neon glow draw passes |
| 10 | LOOP | requestAnimationFrame + fixed-step accumulator |
| 11 | TEST HOOK | `window.__test` for Playwright determinism |

Target size: ~1200 lines including blank lines and short comments.

## 2. Physics Model

### Ball
```js
ball = { p: {x,y}, v: {x,y}, r: 11 }
```

### Step
- Render at native rAF rate.
- Physics at fixed `dt = 1/240 s`, advanced via accumulator pattern.
- Per render frame: up to 4 substeps; if accumulator exceeds 4×dt (large pauses), drop the excess.

### Forces
- Gravity: `g = 900 px/s²` (downward).
- Velocity-proportional damping per step: `v *= 0.9995^(dt*240)` (≈ very light drag).

### Geometry primitives
Every wall is described as one of:
- `Segment` — line from `a` to `b`, with `restitution` and optional `friction`.
- `Arc` — center `c`, radius `r`, `angleStart`, `angleEnd`, restitution.
- `CircleObstacle` — center, radius, with `kind: 'bumper' | 'post'` and ejection rule.

Adjacent wall segments share endpoints so end-cap arcs of radius 0 are not needed; pockets are impossible because every concave region opens wider than `2 × ball.r + ε`.

### Collision detection (broadphase)
- Spatial hash grid, 64-px cells, populated once at table build.
- Per substep: ball queries the 9 cells around its swept AABB.

### Collision detection (narrowphase)
- Circle vs Segment: swept-circle test (cylinder cap). Solve quadratic for earliest TOI in `[0, 1]`.
- Circle vs Arc: project onto arc plane, swept distance to circle's outer surface.
- Circle vs Circle (bumpers): standard quadratic.
- All tests return `{toi, normal}` or `null`.
- Earliest TOI across all candidates wins; advance ball to `toi - ε`, resolve, repeat until full `dt` consumed or 6 iterations (safety cap).

### Collision response
```
v' = v - (1 + restitution) * (v · n) * n
p' = p + n * ε   // push out by 0.01 px to avoid re-entering
```

Per-surface restitution:
- Walls: 0.55
- Slingshot active edge: 1.30 (over-elastic — speeds the ball up)
- Bumpers: handled separately — see below
- Flipper bat: see Flippers

### Bumpers
On contact: set `|v| = max(|v|, 520)` in the direction of `normal`, then add a fixed `+80` to ensure ball never leaves slow. Trigger scoring event + sound + particle burst.

### Slingshots
A slingshot is a triangle (3 segments). The hypotenuse facing the playfield is the "active edge". On contact with the active edge, after reflection, multiply outgoing speed by `1.8` (capped at `900 px/s`). Trigger scoring + sound + particle.

### Flippers (kinematic capsule)
Each flipper:
```
{ pivot, length:62, restLen:8, angleRest, angleUp, angle, angVel,
  state: 'rest' | 'rising' | 'up' | 'falling',
  riseAngVel: 18 rad/s, fallAngVel: 10 rad/s }
```
- Angle is integrated each substep toward target by `±angVel`. No springs — just clamped linear motion. This makes flippers feel snappy and deterministic.
- Bat shape = capsule (segment + 2 arcs). Both segment and arcs collide with ball.
- At contact, compute the bat surface velocity at contact point: `v_surf = ω × (contact - pivot)`. Reflected ball velocity:
  ```
  v_rel = ball.v - v_surf
  v_rel' = reflect(v_rel, n) * 1.05   // 5% boost
  ball.v = v_surf + v_rel'
  ```
- This naturally gives a powerful upward kick when the flipper is rising into the ball, and a soft contact when stationary.

### Anti-stuck invariant
By construction, segment+arc geometry has no concave pockets. Defensive safety net:
- If `|v| < 30 px/s` for > 1 second AND ball is not in a kicker/scoop region AND phase is 'playing': apply random horizontal nudge `vx ± 60`, `vy = -100`. This should never fire in practice; if it does, log a warning to the console (for testability).

## 3. Table Layout

Coordinate system: `(0,0)` top-left, `+x` right, `+y` down. Playfield is `420 × 720`.

### Vertical bands (top → bottom)
- `y 0–24` HUD strip (no physics).
- `y 24–100` Curved ceiling arc (radius 220, center somewhere off-screen above), enclosing the play area at the top.
- `y 80–110` Three drop targets, evenly spaced across `x 90–330`.
- `y 130–170` Two upper bumpers at `(140, 150)` and `(280, 150)`.
- `y 170–210` Center bumper at `(210, 195)`.
- `y 210–260` Spinner at `(80, 235)` (vertical rod, scores per rotation).
- `y 130–230` Captive lane on the right interior (between shooter lane and playfield); a ball travelling up that lane scores.
- `y 260–420` Open mid-field, side rails.
- `y 420–470` Ramp loop entry at left, exits back to top of playfield.
- `y 480–540` Slingshot triangles, left and right, hypotenuses pointing inward and slightly down.
- `y 540–620` Flippers (pivots at `(135, 620)` and `(285, 620)`, length 62).
- `y 620–700` Inlanes/outlanes funneling to the drain.
- `y 700` Drain line — single drain only between the flippers (`x 175–245`).
- Right side: shooter lane on `x 380–410` from `y 80` (top) down to `y 700` (plunger). One-way gate at `y 80`.

### Outlane safety
The two outlanes (`x 90–135` left, `x 285–330` right) terminate in a rounded curve back into the inlane, not into the drain. The only exit is the central drain.

### Ball saver
On ball-launch, set `saverUntil = now + 5s`. If ball crosses drain before `saverUntil`, respawn at the inlane top with a small velocity — no ball lost.

## 4. Game State & Scoring

```js
state = {
  phase: 'attract' | 'ready' | 'playing' | 'drained' | 'gameover',
  score: 0, hi: 0, balls: 3, mult: 1,
  saverUntil: 0,
  drops: [false, false, false], dropCycles: 0,
  comboCount: 0, comboUntil: 0,
  spinnerSpinning: false, spinnerRotations: 0,
};
```

| Event | Score | Side effect |
|-------|-------|-------------|
| Bumper hit | 100 × mult | particle, sfx |
| Slingshot hit | 50 × mult | particle, sfx |
| Spinner rotation | 25 each | sfx |
| Drop target hit | 500 | hide target until cycle clear |
| All 3 drops cleared | 5000 | mult = min(mult+1, 5); respawn all targets |
| Captive lane completion | 1500 | sfx |
| Ramp loop | 1000 | start combo timer 4s |
| Ramp loop within 4s | 2000 + comboCount × 1000 | extend combo |
| Drain while `now < saverUntil` | 0 | respawn ball |
| Drain otherwise | 0 | balls-- ; if balls > 0 → ready ; else gameover |

## 5. Visuals (Retro Neon)

### Palette (CSS variables)
- `--ink-cyan: #5cf`
- `--ink-magenta: #f3a`
- `--ink-yellow: #fd5`
- `--ink-white: #fff`
- `--bg: #0a0612`

### Walls
Each wall drawn in two passes:
1. **Glow pass:** stroke with `shadowBlur=18`, `shadowColor=color`, `lineWidth=8`, `globalAlpha=0.4`.
2. **Core pass:** stroke `lineWidth=2`, `globalAlpha=1`.

### Ball
- Trail: 6 prior positions, fading alpha 0.6 → 0.
- Body: white circle radius 11, plus radial gradient highlight off-center.

### HUD
- Font: `'Press Start 2P'` from Google Fonts (loaded with `<link>`; falls back to monospace).
- Score top-left in cyan; balls top-right as small filled circles in yellow; multiplier under score in magenta.

### Hit FX
- Bumper / slingshot: 12 small particles, color of the hit surface, lifespan 350 ms, gravity-pulled, additive blend.
- Drop-target clear: brief flash of all 3 target slots in yellow.

## 6. Audio

`AudioContext`-driven procedural blips. Created lazily on first user keypress (browser autoplay rules).

| Event | Sound |
|-------|-------|
| Bumper | square 400 Hz, exponential decay 60 ms |
| Slingshot | bandpassed noise burst 100 ms |
| Drop target | sine 600→1200 Hz over 80 ms |
| Drop cycle clear | arpeggio C–E–G–C 200 ms |
| Spinner | short triangle 1200 Hz tick |
| Drain | saw 200 Hz, down to 60 Hz over 350 ms |
| Ball save | rising chord 200 ms |

## 7. Controls

| Key | Action |
|-----|--------|
| `Z` or `←` | Left flipper (hold to keep up) |
| `/` or `→` | Right flipper |
| `Space` | Plunger — hold to charge (max 1.2 s), release to launch |
| `R` | Restart game (when phase = 'gameover') |
| `P` | Pause (helpful for tests) |

## 8. Test Hook

Expose on `window`:
```js
window.__test = {
  ball,            // live reference
  state,
  step(n=1) { for(let i=0;i<n;i++) physicsStep(FIXED_DT); render(); },
  pause() { paused = true; },
  resume() { paused = false; },
  place(x, y, vx=0, vy=0) { ball.p={x,y}; ball.v={x:vx,y:vy}; },
  CONFIG,
};
```

`step()` enables deterministic testing — Playwright pauses the rAF loop, drives steps directly, asserts state. No flake.

## 9. Testing Strategy (Playwright)

`launch.spec.js` rewritten with these tests:

1. **plunger launches into playfield** — hold space 900 ms, release, simulate 600 substeps; assert ball.p.x is on the playfield side of the shooter lane gate at least once.
2. **stuck-ball randomized fuzz** — for each of 12 (position, velocity) seeds spread over the upper playfield, simulate 4 seconds; assert ball is never stationary (|v|<30) for >250 ms while phase='playing'.
3. **bumper imparts at least 520 px/s** — place ball adjacent to each bumper with v=0, step 2 frames; assert |v| ≥ 520.
4. **slingshot speeds up the ball** — fire ball at slingshot with speed 200; assert outgoing speed ≥ 300.
5. **drop targets score 500 and disappear** — drive ball into target, assert score += 500 and target inactive; repeat for all three; assert clear bonus 5000 and mult incremented.
6. **ball saver replays drained ball within 5s grace** — drain ball at t=2s; assert state.balls unchanged and ball respawned.
7. **flipper kick** — left flipper at rest, ball above; activate flipper, step 4 frames; assert ball.v.y < -200 (kicked upward).

## 10. Migration / Cleanup

- Replace entire `index.html` contents with new game.
- Delete `node_modules/matter-js/` references (matter.min.js CDN script tag goes away).
- Keep `node_modules/@playwright/test` (still used).
- Rewrite `launch.spec.js`.
- Keep this design doc and the implementation plan in `docs/superpowers/`.

## 11. Open Questions / Risks

- **Spinner physics** — treating it as a thin rod where the ball passes through but scores per crossing is an approximation. Acceptable for S2.
- **Ramp loop** — implemented as a curved tube that *temporarily* removes gravity and sets a fixed travel velocity until the ball exits. Cheap but feels good. Alternative (gravity-with-track) is more code; defer.
- **Browser font loading** — first render before Press Start 2P loads will use monospace fallback. Acceptable.
- **Performance** — 240 Hz physics + 12-cell broadphase queries should be well under 1 ms/frame for a single ball. If it's not, drop to 180 Hz.
