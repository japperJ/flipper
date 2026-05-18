# Pinball Theme Packs — Design Spec

**Date:** 2026-05-18  
**Status:** Approved (brainstorming)  
**Scope:** Visual/audio redesign for vintage flipper-machine feel with selectable theme packs

---

## Goal

Upgrade the current pinball app visual and audio presentation to feel like an old electro-mechanical flipper machine, including:

1. Three distinct vintage-inspired theme packs.
2. Flashing lamp choreography per gameplay event.
3. Sound effects with a single master on/off toggle.
4. Theme and sound settings persisted across reloads.
5. Theme switching only from start/pause menu (not during active ball play).

## Non-Goals

- No gameplay physics changes.
- No scoring-rule changes.
- No reduced-flash accessibility mode in this release.
- No deep audio mixer (single master toggle only).

---

## Confirmed Product Decisions

- Theme system approach: **Theme Packs** (not lightweight recolor only, not full manifest engine).
- Number of themes at launch: **3**.
- Theme switching UX: **menu-only** (start/pause overlay).
- Sound controls: **single master toggle** (`Sound On/Off`).
- Preference persistence: **enabled** (`theme` and `soundEnabled` saved in browser storage).
- Flash behavior: **full arcade flash** (no reduced mode).

---

## Theme Lineup

### 1) Sunburst Classic
- Mood: warm, carnival-like 60s/70s table energy.
- Palette: creamy white, amber/yellow, red accents, soft cyan highlights.
- Light behavior: circular chase on combo/jackpot, warm bumper pops.
- Audio flavor: warm chimes + subtle relay-click character.

### 2) Cosmic Wedge
- Mood: space-era geometric wedgehead style.
- Palette: teal, orange-red, cream, bright insert arrows.
- Light behavior: top-arch sweeps, lane ladder pulses.
- Audio flavor: brighter synth-like pings + crisp mechanical clicks.

### 3) Volcano Pop
- Mood: high-energy pop-bumper showpiece.
- Palette: mint/green base with amber/orange heat zones.
- Light behavior: eruption-style rapid pulses on bumper chains.
- Audio flavor: punchier bumper thuds + short ring tones.

Gameplay remains functionally equivalent across all themes.

---

## Architecture and Components

Add three presentation-focused modules without changing deterministic gameplay core.

### ThemeManager
Responsibilities:
- Maintain `activeThemeId`.
- Validate and expose active theme tokens.
- Load/save user preferences from `localStorage`.

API sketch:
- `getTheme(): ThemePack`
- `setTheme(themeId): void` (with fallback)
- `getSettings(): { themeId, soundEnabled }`
- `setSoundEnabled(boolean): void`

### LightEngine
Responsibilities:
- Consume gameplay events and schedule short-lived lamp animations.
- Run animation recipes supplied by active theme.

Supported recipes (minimum):
- `pulse`, `chase`, `sweep`, `strobeBurst`.

### AudioEngine
Responsibilities:
- Master-gated event sound playback.
- Map event names to theme-specific timbre presets.
- Lazily initialize `AudioContext` after user gesture.

Master behavior:
- If `soundEnabled === false`, event playback is a no-op.

---

## Data Model

```text
ThemePack {
  id,
  name,
  palette: { bg, lane, insertOn, insertOff, bumperGlow, slingGlow, textPrimary, textAccent },
  art: { playfieldStyle, decalSet, labelStyle },
  lights: {
    bumperHit, slingHit, dropClear, jackpot, drain, gameOver
  },
  audio: {
    bumperHit, slingHit, dropClear, jackpot, drain, gameOver, uiToggle
  }
}

UserSettings {
  themeId: string,
  soundEnabled: boolean
}
```

Storage keys:
- `flipper.themeId`
- `flipper.soundEnabled`

---

## Event Flow

1. Existing gameplay system raises event (e.g., `bumper_hit`).
2. `dispatchThemeEvent(type, payload)` called.
3. `LightEngine` reads active theme light recipe and schedules effects.
4. `AudioEngine` reads active theme sound recipe and plays if sound is enabled.
5. Renderer consumes active light effects every frame.

This keeps physics/scoring deterministic while allowing presentation variance.

---

## UI/UX Behavior

### Menu changes
Start/pause overlay will include:
- Theme selector (3 cards/buttons with preview swatches).
- `Sound: On/Off` master toggle.
- `Apply & Resume` action.

### Switching constraints
- Theme changes allowed only while a non-active-play overlay is open (ready/start, paused, or game-over overlay).
- During active play, theme controls are disabled or hidden.

### Persistence
- On boot, app loads saved `themeId` and `soundEnabled`.
- If values are missing/invalid, fallback to defaults:
  - `themeId = sunburst-classic`
  - `soundEnabled = true`

---

## Rendering Integration

Keep existing render loop and inject presentation layers:

1. **Theme skin pass** (playfield background, texture style, decals).
2. Existing geometry/game object rendering.
3. **Dynamic lamp pass** from `LightEngine` (glow sprites/overlays).
4. Existing HUD, with optional small current-theme indicator.

No physics transforms are theme-driven.

---

## Error Handling and Fallbacks

- Unknown `themeId` -> fallback to `sunburst-classic`.
- Corrupted saved settings -> reset to defaults and continue.
- Missing light recipe for an event -> skip only that effect.
- Audio init blocked/unavailable -> disable sound silently; gameplay unaffected.
- Theme apply failure -> keep previous valid theme and show brief status text.

Design principle: presentation errors must never break gameplay.

---

## Testing Strategy

### Keep existing baseline
- All current physics and gameplay tests must continue passing unchanged.

### Add focused theme tests
1. **Theme apply test:** selecting each theme updates active palette tokens.
2. **Persistence test:** theme + sound survive reload via storage.
3. **Menu policy test:** theme switching unavailable during active play.
4. **Audio gate test:** when sound is off, no playback path is invoked.
5. **Light event test:** each key gameplay event creates a light effect entry.
6. **Fallback test:** invalid stored theme falls back to default safely.

---

## Implementation Boundaries

- Work in existing `index.html` structure.
- Prefer additive changes around render/input/settings modules.
- Do not re-open or alter core physics constants/logic unless regression forces it.

---

## Risks and Mitigations

1. **Risk:** Theme logic creeps into gameplay logic.  
   **Mitigation:** one-way event bridge (`dispatchThemeEvent`) and strict separation.

2. **Risk:** Flash performance spikes.  
   **Mitigation:** cap concurrent light effects and precompute recipe parameters.

3. **Risk:** Audio inconsistencies across browsers.  
   **Mitigation:** lazy init + defensive no-op fallback.

---

## Acceptance Criteria

- User can choose among 3 themes in start/pause menu.
- Theme cannot be changed while actively playing.
- Sound can be toggled on/off with one control.
- Theme + sound settings are remembered after refresh/reopen.
- Each theme has visibly distinct lamp behavior and clearly different sound flavor.
- Existing gameplay behavior remains unchanged and tests stay green.
