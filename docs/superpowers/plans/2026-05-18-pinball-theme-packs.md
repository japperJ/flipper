# Pinball Theme Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three vintage theme packs (visuals + light choreography + sound flavor), menu-only switching, and persistent theme/sound settings to the current pinball game without changing gameplay physics.

**Architecture:** Keep `index.html` as the single runtime file and add three presentation modules inside it: `ThemeManager`, `LightEngine`, and `AudioEngine`. Route gameplay events through `dispatchThemeEvent(...)` so visuals/audio vary by theme while physics/scoring remain deterministic. Use Playwright tests in `launch.spec.js` for menu policy, persistence, fallbacks, and event effects.

**Tech Stack:** Vanilla JS (single-file app), Canvas 2D, Web Audio API, localStorage, Playwright.

---

## File Structure

- `c:\REP\flipper\index.html`
  - Add theme pack definitions (`sunburst-classic`, `cosmic-wedge`, `volcano-pop`)
  - Add `ThemeManager` load/save/fallback
  - Add `LightEngine` event effects and render pass
  - Add `AudioEngine` master-gated sound playback
  - Add pause/start menu controls for theme selection + sound toggle
  - Extend `window.__test` with testing hooks
- `c:\REP\flipper\launch.spec.js`
  - Add focused tests for theme switching policy, persistence, fallback, light effects, and audio gate

---

## Task 1: Add failing tests for theme behavior and persistence

**Files:**
- Modify: `c:\REP\flipper\launch.spec.js`

- [ ] **Step 1: Append a test for menu-only theme switching**

```js
test('theme: can switch in menu but not during active play', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    const before = window.__test.getThemeId();
    window.__test.setThemeFromMenu('cosmic-wedge');
    const inMenu = window.__test.getThemeId();

    window.__test.closeMenuAndResume();
    window.__test.forcePhase('playing');
    window.__test.setThemeFromMenu('volcano-pop');
    const duringPlay = window.__test.getThemeId();

    return { before, inMenu, duringPlay };
  });

  expect(r.inMenu).toBe('cosmic-wedge');
  expect(r.duringPlay).toBe('cosmic-wedge');
});
```

- [ ] **Step 2: Append a test for persistence across reload**

```js
test('theme/sound: settings persist across reload', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setThemeFromMenu('volcano-pop');
    window.__test.setSoundFromMenu(false);
  });

  await page.reload();

  const saved = await page.evaluate(() => ({
    themeId: window.__test.getThemeId(),
    soundEnabled: window.__test.isSoundEnabled(),
  }));

  expect(saved.themeId).toBe('volcano-pop');
  expect(saved.soundEnabled).toBe(false);
});
```

- [ ] **Step 3: Append a fallback test for invalid saved theme**

```js
test('theme: invalid saved theme falls back to default', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.setItem('flipper.themeId', 'nope-not-a-theme');
  });
  await page.reload();

  const id = await page.evaluate(() => window.__test.getThemeId());
  expect(id).toBe('sunburst-classic');
});
```

- [ ] **Step 4: Append a light effect test and audio gate test**

```js
test('lights: gameplay event creates active light effect', async ({ page }) => {
  await page.goto(URL);
  const n = await page.evaluate(() => {
    window.__test.pause();
    window.__test.dispatchThemeEvent('bumper_hit', { x: 160, y: 220 });
    return window.__test.getActiveLightEffectCount();
  });
  expect(n).toBeGreaterThan(0);
});

test('audio: sound off blocks event playback counter', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setSoundFromMenu(false);
    const before = window.__test.getAudioPlayCount();
    window.__test.dispatchThemeEvent('sling_hit', { x: 100, y: 500 });
    const after = window.__test.getAudioPlayCount();
    return { before, after };
  });

  expect(r.after).toBe(r.before);
});
```

- [ ] **Step 5: Run tests to confirm they fail before implementation**

Run: `npx playwright test launch.spec.js -g "theme:|theme/sound:|lights:|audio:"`  
Expected: FAIL due to missing `window.__test` APIs and missing theme/light/audio systems.

- [ ] **Step 6: Commit test scaffolding**

```pwsh
git add c:\REP\flipper\launch.spec.js
git commit -m "test(pinball): add failing theme packs and settings tests"
```

---

## Task 2: Implement ThemeManager with three theme packs and persistence

**Files:**
- Modify: `c:\REP\flipper\index.html`

- [ ] **Step 1: Add theme constants and defaults (near config/state section)**

```js
const DEFAULT_THEME_ID = 'sunburst-classic';
const THEME_STORAGE_KEY = 'flipper.themeId';
const SOUND_STORAGE_KEY = 'flipper.soundEnabled';

const THEME_PACKS = {
  'sunburst-classic': {
    id: 'sunburst-classic',
    name: 'Sunburst Classic',
    palette: {
      bg: '#1a1208', lane: '#f5c242', insertOn: '#ffd86b', insertOff: '#6b561d',
      bumperGlow: '#ffd86b', slingGlow: '#ff824d', textPrimary: '#fff4d0', textAccent: '#ffcf5f'
    },
    lights: {
      bumper_hit: { type: 'pulse', color: '#ffd86b', life: 0.24, size: 22 },
      sling_hit: { type: 'pulse', color: '#ff824d', life: 0.20, size: 20 },
      drop_clear: { type: 'chase', color: '#fff2b3', life: 0.42, size: 16 },
      jackpot: { type: 'strobeBurst', color: '#fff8cc', life: 0.60, size: 30 },
      drain: { type: 'sweep', color: '#ffb36b', life: 0.30, size: 18 },
      game_over: { type: 'sweep', color: '#ffc07a', life: 0.45, size: 20 }
    },
    audio: {
      bumper_hit: { wave: 'triangle', freq: 420, dur: 0.05, gain: 0.08 },
      sling_hit: { wave: 'square', freq: 320, dur: 0.07, gain: 0.07 },
      drop_clear: { wave: 'sine', freq: 760, dur: 0.08, gain: 0.07 },
      jackpot: { wave: 'triangle', freq: 980, dur: 0.14, gain: 0.10 },
      drain: { wave: 'sawtooth', freq: 210, dur: 0.18, gain: 0.08 },
      game_over: { wave: 'sawtooth', freq: 150, dur: 0.24, gain: 0.09 },
      ui_toggle: { wave: 'sine', freq: 600, dur: 0.04, gain: 0.05 }
    }
  },
  'cosmic-wedge': {
    id: 'cosmic-wedge',
    name: 'Cosmic Wedge',
    palette: {
      bg: '#0f1626', lane: '#2ad1c9', insertOn: '#ff7043', insertOff: '#4a3a33',
      bumperGlow: '#4dd0e1', slingGlow: '#ff7043', textPrimary: '#e8f7ff', textAccent: '#ffab91'
    },
    lights: {
      bumper_hit: { type: 'pulse', color: '#4dd0e1', life: 0.22, size: 23 },
      sling_hit: { type: 'pulse', color: '#ff7043', life: 0.20, size: 21 },
      drop_clear: { type: 'sweep', color: '#80deea', life: 0.40, size: 17 },
      jackpot: { type: 'chase', color: '#ffab91', life: 0.58, size: 28 },
      drain: { type: 'sweep', color: '#26c6da', life: 0.30, size: 18 },
      game_over: { type: 'strobeBurst', color: '#ff8a65', life: 0.42, size: 21 }
    },
    audio: {
      bumper_hit: { wave: 'square', freq: 520, dur: 0.05, gain: 0.08 },
      sling_hit: { wave: 'square', freq: 390, dur: 0.07, gain: 0.07 },
      drop_clear: { wave: 'triangle', freq: 840, dur: 0.08, gain: 0.07 },
      jackpot: { wave: 'sine', freq: 1200, dur: 0.12, gain: 0.10 },
      drain: { wave: 'sawtooth', freq: 230, dur: 0.18, gain: 0.08 },
      game_over: { wave: 'square', freq: 170, dur: 0.24, gain: 0.09 },
      ui_toggle: { wave: 'sine', freq: 680, dur: 0.04, gain: 0.05 }
    }
  },
  'volcano-pop': {
    id: 'volcano-pop',
    name: 'Volcano Pop',
    palette: {
      bg: '#1a2a1a', lane: '#9de86b', insertOn: '#ffa726', insertOff: '#5c4a2a',
      bumperGlow: '#8bc34a', slingGlow: '#ff9800', textPrimary: '#f4ffe8', textAccent: '#ffcc80'
    },
    lights: {
      bumper_hit: { type: 'strobeBurst', color: '#8bc34a', life: 0.20, size: 24 },
      sling_hit: { type: 'pulse', color: '#ff9800', life: 0.20, size: 21 },
      drop_clear: { type: 'chase', color: '#c5e1a5', life: 0.44, size: 18 },
      jackpot: { type: 'strobeBurst', color: '#ffcc80', life: 0.62, size: 30 },
      drain: { type: 'sweep', color: '#aed581', life: 0.30, size: 18 },
      game_over: { type: 'sweep', color: '#ffb74d', life: 0.45, size: 22 }
    },
    audio: {
      bumper_hit: { wave: 'triangle', freq: 460, dur: 0.05, gain: 0.09 },
      sling_hit: { wave: 'sawtooth', freq: 340, dur: 0.07, gain: 0.08 },
      drop_clear: { wave: 'sine', freq: 720, dur: 0.09, gain: 0.07 },
      jackpot: { wave: 'triangle', freq: 1040, dur: 0.13, gain: 0.10 },
      drain: { wave: 'sawtooth', freq: 210, dur: 0.18, gain: 0.08 },
      game_over: { wave: 'sawtooth', freq: 145, dur: 0.24, gain: 0.09 },
      ui_toggle: { wave: 'sine', freq: 560, dur: 0.04, gain: 0.05 }
    }
  }
};
```

- [ ] **Step 2: Add ThemeManager helpers**

```js
const settings = {
  themeId: DEFAULT_THEME_ID,
  soundEnabled: true,
};

function isThemeIdValid(id){
  return Object.prototype.hasOwnProperty.call(THEME_PACKS, id);
}

function getActiveTheme(){
  return THEME_PACKS[settings.themeId] || THEME_PACKS[DEFAULT_THEME_ID];
}

function saveSettings(){
  localStorage.setItem(THEME_STORAGE_KEY, settings.themeId);
  localStorage.setItem(SOUND_STORAGE_KEY, String(settings.soundEnabled));
}

function loadSettings(){
  const rawTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const rawSound = localStorage.getItem(SOUND_STORAGE_KEY);

  settings.themeId = isThemeIdValid(rawTheme) ? rawTheme : DEFAULT_THEME_ID;
  settings.soundEnabled = rawSound === null ? true : rawSound === 'true';

  if (!isThemeIdValid(rawTheme)) {
    localStorage.setItem(THEME_STORAGE_KEY, settings.themeId);
  }
  if (rawSound === null) {
    localStorage.setItem(SOUND_STORAGE_KEY, String(settings.soundEnabled));
  }
}
```

- [ ] **Step 3: Initialize settings on startup and expose in state HUD usage**

```js
loadSettings();

function setThemeId(nextId){
  if (!isThemeIdValid(nextId)) return false;
  settings.themeId = nextId;
  saveSettings();
  return true;
}

function setSoundEnabled(enabled){
  settings.soundEnabled = !!enabled;
  saveSettings();
}
```

- [ ] **Step 4: Run focused tests (still expected fail for missing menu/effects/audio hooks)**

Run: `npx playwright test launch.spec.js -g "theme:|theme/sound:"`  
Expected: Partial FAIL (persistence may pass only after test hooks are added; menu-policy tests still fail).

- [ ] **Step 5: Commit ThemeManager foundation**

```pwsh
git add c:\REP\flipper\index.html
git commit -m "feat(pinball): add theme packs and settings persistence foundation"
```

---

## Task 3: Add pause/start menu controls for theme selection and sound toggle

**Files:**
- Modify: `c:\REP\flipper\index.html`

- [ ] **Step 1: Add menu state and helpers**

```js
const menu = {
  open: false,
  selectedThemeId: settings.themeId,
};

function openMenu(){
  paused = true;
  menu.open = true;
  menu.selectedThemeId = settings.themeId;
}

function closeMenuAndResume(){
  menu.open = false;
  paused = false;
}

function canApplyThemeFromMenu(){
  return menu.open && paused;
}

function applyThemeFromMenu(themeId){
  if (!canApplyThemeFromMenu()) return false;
  return setThemeId(themeId);
}

function applySoundFromMenu(enabled){
  if (!canApplyThemeFromMenu()) return false;
  setSoundEnabled(enabled);
  return true;
}
```

- [ ] **Step 2: Update key handling for menu-only controls**

```js
window.addEventListener('keydown', e=>{
  if (e.key === 'Escape'){
    if (menu.open) closeMenuAndResume();
    else openMenu();
    return;
  }

  if (menu.open){
    if (e.key === '1') applyThemeFromMenu('sunburst-classic');
    if (e.key === '2') applyThemeFromMenu('cosmic-wedge');
    if (e.key === '3') applyThemeFromMenu('volcano-pop');
    if (e.key === 's' || e.key === 'S') applySoundFromMenu(!settings.soundEnabled);
    if (e.key === 'Enter') closeMenuAndResume();
    return;
  }

  if (e.key==='p' || e.key==='P') paused = !paused;
  if (e.key==='z' || e.key==='Z' || e.key==='ArrowLeft') input.L = true;
  if (e.key==='/' || e.key==='ArrowRight') input.R = true;
  if (e.key===' ') input.plunge = true;
});
```

- [ ] **Step 3: Render a menu overlay with current theme + sound state**

```js
function renderMenuOverlay(){
  if (!menu.open) return;

  const t = getActiveTheme();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(20, 120, CONFIG.W - 40, 300);

  ctx.strokeStyle = t.palette.textAccent;
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 120, CONFIG.W - 40, 300);

  ctx.fillStyle = t.palette.textPrimary;
  ctx.font = "10px 'Press Start 2P', monospace";
  ctx.textAlign = 'center';
  ctx.fillText('CABINET MENU', CONFIG.W/2, 155);

  ctx.textAlign = 'left';
  ctx.fillText('1 SUNBURST CLASSIC', 50, 200);
  ctx.fillText('2 COSMIC WEDGE', 50, 228);
  ctx.fillText('3 VOLCANO POP', 50, 256);
  ctx.fillText('S SOUND: ' + (settings.soundEnabled ? 'ON' : 'OFF'), 50, 294);
  ctx.fillText('ENTER APPLY/RESUME', 50, 332);
  ctx.fillText('ESC CANCEL/RESUME', 50, 360);

  ctx.textAlign = 'center';
  ctx.fillText('ACTIVE: ' + t.name.toUpperCase(), CONFIG.W/2, 390);
  ctx.textAlign = 'start';
}
```

Call at end of `render()`:

```js
renderMenuOverlay();
```

- [ ] **Step 4: Re-run menu-policy test**

Run: `npx playwright test launch.spec.js -g "theme: can switch in menu"`  
Expected: FAIL until `window.__test` menu hooks are added in Task 6.

- [ ] **Step 5: Commit menu UI and control policy**

```pwsh
git add c:\REP\flipper\index.html
git commit -m "feat(pinball): add menu-only theme and sound controls"
```

---

## Task 4: Implement LightEngine and theme event dispatcher

**Files:**
- Modify: `c:\REP\flipper\index.html`

- [ ] **Step 1: Add light effect runtime + event dispatcher**

```js
const lightEffects = []; // {x,y,color,life,maxLife,size,type,phase}

function enqueueLightEffect(type, payload={}){
  const theme = getActiveTheme();
  const recipe = theme.lights[type];
  if (!recipe) return;

  lightEffects.push({
    x: payload.x ?? CONFIG.W/2,
    y: payload.y ?? CONFIG.H/2,
    color: recipe.color,
    life: recipe.life,
    maxLife: recipe.life,
    size: recipe.size,
    type: recipe.type,
    phase: 0,
  });
}

function dispatchThemeEvent(type, payload={}){
  enqueueLightEffect(type, payload);
  playThemeSound(type);
}

function updateLightEffects(dt){
  for (let i = lightEffects.length - 1; i >= 0; i--){
    const e = lightEffects[i];
    e.life -= dt;
    e.phase += dt * 12;
    if (e.life <= 0) lightEffects.splice(i, 1);
  }
}
```

- [ ] **Step 2: Call dispatcher from gameplay events**

```js
// bumper branch
dispatchThemeEvent('bumper_hit', { x: ball.p.x, y: ball.p.y });

// sling branch
dispatchThemeEvent('sling_hit', { x: ball.p.x, y: ball.p.y });

// drop clear branch
dispatchThemeEvent('drop_clear', { x: CONFIG.W/2, y: 340 });

// jackpot branch
dispatchThemeEvent('jackpot', { x: CONFIG.W/2, y: 250 });

// drain branch
dispatchThemeEvent('drain', { x: (DRAIN_LEFT + DRAIN_RIGHT)/2, y: CONFIG.H - 12 });

// game over state set
dispatchThemeEvent('game_over', { x: CONFIG.W/2, y: CONFIG.H/2 });
```

- [ ] **Step 3: Add light effect render pass**

```js
function renderLightEffects(){
  for (const e of lightEffects){
    const a = Math.max(0, e.life / e.maxLife);
    const pulse = e.type === 'strobeBurst' ? (Math.sin(e.phase * 8) > 0 ? 1 : 0.45) : 1;
    const r = e.size * (1 + (1 - a) * 0.9);

    ctx.save();
    ctx.globalAlpha = a * 0.45 * pulse;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 22;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
```

In `render()` call:

```js
updateLightEffects(1/60);
renderLightEffects();
```

- [ ] **Step 4: Run light effect test**

Run: `npx playwright test launch.spec.js -g "lights:"`  
Expected: FAIL until test hook `getActiveLightEffectCount` is added in Task 6.

- [ ] **Step 5: Commit LightEngine integration**

```pwsh
git add c:\REP\flipper\index.html
git commit -m "feat(pinball): add theme-driven light effects and event dispatch"
```

---

## Task 5: Implement AudioEngine with master on/off gate

**Files:**
- Modify: `c:\REP\flipper\index.html`

- [ ] **Step 1: Add audio runtime and play counter**

```js
let ac = null;
let audioPlayCount = 0;

function getAudioContext(){
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  return ac;
}

function playThemeSound(type){
  if (!settings.soundEnabled) return;

  const theme = getActiveTheme();
  const s = theme.audio[type];
  if (!s) return;

  const a = getAudioContext();
  const osc = a.createOscillator();
  const gain = a.createGain();

  osc.type = s.wave;
  osc.frequency.value = s.freq;
  gain.gain.value = s.gain;

  osc.connect(gain);
  gain.connect(a.destination);

  const t0 = a.currentTime;
  osc.start(t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + s.dur);
  osc.stop(t0 + s.dur);

  audioPlayCount += 1;
}
```

- [ ] **Step 2: Add user-gesture unlock hook**

```js
window.addEventListener('keydown', () => {
  if (!settings.soundEnabled) return;
  try {
    const a = getAudioContext();
    if (a.state === 'suspended') a.resume();
  } catch {}
}, { once: false });
```

- [ ] **Step 3: Add optional UI toggle chirp**

```js
function applySoundFromMenu(enabled){
  if (!canApplyThemeFromMenu()) return false;
  setSoundEnabled(enabled);
  if (enabled) playThemeSound('ui_toggle');
  return true;
}
```

- [ ] **Step 4: Run audio gate test**

Run: `npx playwright test launch.spec.js -g "audio:"`  
Expected: FAIL until test hook `getAudioPlayCount` is added in Task 6.

- [ ] **Step 5: Commit AudioEngine**

```pwsh
git add c:\REP\flipper\index.html
git commit -m "feat(pinball): add theme-aware audio engine with master gate"
```

---

## Task 6: Extend test hook and make tests pass

**Files:**
- Modify: `c:\REP\flipper\index.html`
- Modify: `c:\REP\flipper\launch.spec.js`

- [ ] **Step 1: Extend `window.__test` with required helpers**

```js
window.__test = {
  get ball(){ return ball; },
  get state(){ return state; },
  CONFIG,
  step(n=1){ for(let i=0;i<n*CONFIG.MAX_SUBSTEPS;i++) physicsStep(CONFIG.FIXED_DT); render(); },
  pause(){ paused = true; },
  resume(){ paused = false; },
  place(x,y,vx=0,vy=0){ ball.p={x,y}; ball.v={x:vx,y:vy}; },

  openMenu(){ openMenu(); },
  closeMenuAndResume(){ closeMenuAndResume(); },
  setThemeFromMenu(id){ return applyThemeFromMenu(id); },
  setSoundFromMenu(enabled){ return applySoundFromMenu(enabled); },
  getThemeId(){ return settings.themeId; },
  isSoundEnabled(){ return settings.soundEnabled; },
  forcePhase(phase){ state.phase = phase; },

  dispatchThemeEvent(type, payload){ dispatchThemeEvent(type, payload); },
  getActiveLightEffectCount(){ return lightEffects.length; },
  getAudioPlayCount(){ return audioPlayCount; },
};
```

- [ ] **Step 2: Ensure theme apply path is strictly menu-only**

```js
function applyThemeFromMenu(themeId){
  if (!(menu.open && paused)) return false;
  if (state.phase === 'playing') return false;
  return setThemeId(themeId);
}
```

- [ ] **Step 3: Replace any draft tests with these exact hook-based versions**

```js
test('theme: can switch in menu but not during active play', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setThemeFromMenu('cosmic-wedge');
    const inMenu = window.__test.getThemeId();

    window.__test.closeMenuAndResume();
    window.__test.forcePhase('playing');
    window.__test.setThemeFromMenu('volcano-pop');
    const duringPlay = window.__test.getThemeId();

    return { inMenu, duringPlay };
  });

  expect(r.inMenu).toBe('cosmic-wedge');
  expect(r.duringPlay).toBe('cosmic-wedge');
});

test('audio: sound off blocks event playback counter', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setSoundFromMenu(false);
    const before = window.__test.getAudioPlayCount();
    window.__test.dispatchThemeEvent('sling_hit', { x: 100, y: 500 });
    const after = window.__test.getAudioPlayCount();
    return { before, after };
  });

  expect(r.after).toBe(r.before);
});
```

- [ ] **Step 4: Run full test file**

Run: `npx playwright test launch.spec.js`  
Expected: PASS for existing gameplay tests + new theme tests.

- [ ] **Step 5: Commit passing test-integrated implementation**

```pwsh
git add c:\REP\flipper\index.html c:\REP\flipper\launch.spec.js
git commit -m "feat(pinball): complete theme packs with menu policy, persistence, and tests"
```

---

## Task 7: Final polish pass and handoff checks

**Files:**
- Modify: `c:\REP\flipper\index.html` (only if needed)
- Modify: `c:\REP\flipper\launch.spec.js` (only if needed)

- [ ] **Step 1: Add explicit HUD badge for current theme (small, unobtrusive)**

```js
const themeNameShort = getActiveTheme().name.toUpperCase();
ctx.fillStyle = getActiveTheme().palette.textAccent;
ctx.font = "8px 'Press Start 2P', monospace";
ctx.fillText(themeNameShort, 8, 78);
```

- [ ] **Step 2: Run final verification suite**

Run: `npx playwright test launch.spec.js`  
Expected: All tests PASS.

- [ ] **Step 3: Manual validation checklist**

- Open `index.html` in browser.
- Press `Escape` to open menu.
- Switch themes with `1/2/3` and verify immediate visual style change.
- Toggle sound with `S` and verify events are muted/unmuted.
- Resume with `Enter`; confirm theme switching no longer changes during active play.
- Reload page; confirm chosen theme and sound state persist.

- [ ] **Step 4: Commit polish adjustments**

```pwsh
git add c:\REP\flipper\index.html c:\REP\flipper\launch.spec.js
git commit -m "chore(pinball): finalize theme packs polish and verification"
```

---

## Self-Review Notes

- **Spec coverage:**
  - 3 themes defined and selectable: Tasks 2–3
  - Menu-only switching: Tasks 3 and 6
  - Sound master on/off: Tasks 3 and 5
  - Persistence (`themeId`, `soundEnabled`): Task 2
  - Light choreography + event routing: Task 4
  - Fallback behavior and tests: Tasks 1, 2, 6
  - Keep gameplay unchanged: all tasks avoid physics-rule edits; regression run in Tasks 6–7

- **Placeholder scan:** No TODO/TBD placeholders in tasks.

- **Type/signature consistency:**
  - Hooks and helpers use consistent names across plan and tests:
    - `dispatchThemeEvent`
    - `setThemeFromMenu`
    - `setSoundFromMenu`
    - `getThemeId`
    - `isSoundEnabled`
    - `getActiveLightEffectCount`
    - `getAudioPlayCount`
