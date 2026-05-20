# Gameplay Modes Design

**Date:** 2026-05-20  
**Status:** Approved

## Overview

Add 4 distinct gameplay modes to NEON PINBALL so each game feels different. All modes share the core table structure (2 flippers, launch lane, slingshots, outer walls) but differ in top lane count, obstacle layout, and scoring objectives. A left mini flipper and right kickback are added to all modes for symmetric side protection.

---

## Architecture

### Mode Config Object

A new `GAMEPLAY_MODES` constant mirrors the existing `THEME_PACKS` pattern. Each mode is a plain object specifying its layout and rules. `buildTable()` reads from the active mode config.

```js
const GAMEPLAY_MODES = {
  'top-lanes':      { ... },
  'drop-bank':      { ... },
  'spell-neon':     { ... },
  'bumper-frenzy':  { ... },
};
const DEFAULT_GAMEPLAY_MODE_ID = 'top-lanes';
const GAMEPLAY_MODE_STORAGE_KEY = 'flipper.gameplayModeId';
```

Active mode is stored in `settings.gameplayModeId`, persisted to `localStorage`, and applied on `buildTable()` / `restartGame()`.

### buildTable() becomes mode-aware

`buildTable()` reads `getActiveMode()` and places obstacles accordingly:
- Top lane count and x-positions computed from mode config
- Bumper count / positions from mode config
- Drop target count from mode config
- Center feature (extra drop bank) toggled by mode config

All other geometry (outer walls, slingshots, flippers, launch lane, kickback logic) is shared across all modes.

---

## Top Lanes System

Top lanes are **detection zones** — no changes to the top wall physics segments.

**Detection:** Each frame, if `ball.y < 65` and `ball.x` falls within a lane's `[xMin, xMax]` range, that lane is marked lit. Once lit, a lane stays lit until the full set is completed (then all reset).

**Rendering:** Thin vertical lane indicators drawn at the top of the playfield (above the bumper area). Lit lanes glow in the theme accent colour; unlit lanes are dim.

**Lane x-positions:** Computed evenly across the playfield width (excluding the shooter lane at x > 370), distributed per the mode's `laneCount`.

---

## The 4 Modes

### 1. Top Lanes (`top-lanes`)
- **5 rollover lanes** at top
- **Complete all 5:** multiplier increases by 1 (max ×4), all lanes reset
- Bumpers: 5 (existing cluster)
- Drop targets: 3 (existing bank)
- No center feature

### 2. Drop Bank (`drop-bank`)
- **3 rollover lanes** at top
- **Complete all 3:** 1000-point burst per completion
- Bumpers: 5 (existing cluster)
- Drop targets: **4-target bank** (replaces the 3-target bank; targets are slightly wider-spaced)
- Center feature: 4th drop target added to the center bank

### 3. Spell NEON (`spell-neon`)
- **4 rollover lanes** at top, labelled N · E · O · N
- **Complete N-E-O-N:** Jackpot fires (base 5000 pts × current mult). Jackpot base value **doubles** each time it is collected (resets to 5000 on new ball)
- Letters displayed in the HUD below the score
- Bumpers: 5 (existing cluster)
- Drop targets: 3 (existing bank)

### 4. Bumper Frenzy (`bumper-frenzy`)
- **3 rollover lanes** at top; each lane lights one bumper group (left cluster / center / right cluster)
- **Complete all 3:** All bumpers enter super mode for 10 seconds (stacks with existing super-bumper chain logic)
- Bumpers: **6** (adds one extra flanking bumper)
- Drop targets: **0** (removed to give ball more room to bounce between bumpers)

---

## Side Protection (all modes)

### Left Mini Flipper
- **Position:** Pivot at approximately `{x: 30, y: 500}` on the left wall
- **Length:** ~38 px (vs 62 px for main flippers)
- **Tip/base radii:** 5 / 8 px
- **Rest angle:** pointing down toward the left wall (`~1.1 rad`)
- **Up angle:** pointing inward toward playfield center (`~-0.1 rad`)
- **Control:** Same left flipper key (Z / Left Arrow) — both left flippers move together
- **Purpose:** Deflects ball back toward center before it enters the deep left outlane

### Right Kickback
- **Detection zone:** `ball.p.x > 388 && ball.p.x < 416 && ball.p.y > 550 && ball.p.y < 700`
- **Eject target:** `{ x: 352, y: 510, vx: -340, vy: -580 }` (mirrors left kickback)
- **Armed:** at game start and on every drop bank clear (same as left kickback)
- **Visual:** flash + `KICKBACK!` float text on right side (mirrors left)

---

## Cabinet Menu Changes

### New MODE section
Keys `4`–`7` select gameplay modes (shown in the menu overlay):
```
4  TOP LANES
5  DROP BANK
6  SPELL NEON
7  BUMPER FRENZY
```
Mode name displayed as a small label in the HUD (e.g. `MODE: SPELL NEON`) below the ball counter.

Mode change is saved immediately when selected in the cabinet menu, but takes effect on the **next new game** — `restartGame()` calls `buildTable()` which re-reads the active mode. Unlike themes (which are purely visual and apply instantly), mode changes require a full table rebuild.

---

## State Changes

```js
// Added to `state`:
state.topLanesLit = [];      // array of booleans, length = mode.laneCount
state.spellJackpotBase = 5000; // spell-neon only, doubles on each collect
state.rightKickback = true;  // mirrors state.kickback
state.rightKickbackFlash = 0;
```

`restartGame()` resets all new state fields. `serveBall()` does not reset spell jackpot base (it persists across balls within a game).

---

## Rendering

- **Top lane indicators:** drawn in `drawHUD()` or a new `drawTopLanes()` call in the render loop, above bumper area
- **Mode label in HUD:** single line below ball counter, using theme `textAccent` colour
- **Right kickback flash:** drawn symmetrically to existing left kickback flash
- **Mini flipper:** drawn using same `drawFlipper()` logic as main flippers

---

## Persistence

| Key | Value |
|-----|-------|
| `flipper.gameplayModeId` | Active mode id string |

Validated on load (falls back to `'top-lanes'` if stored value is invalid).

---

## Out of Scope

- Animated lane dividers / physical gap segments in the top wall (detection zones are sufficient)
- Per-mode visual themes (mode and theme remain independent)
- Mid-game mode switching
