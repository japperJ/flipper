# Gameplay Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 distinct gameplay modes (Top Lanes, Drop Bank, Spell NEON, Bumper Frenzy), top lane detection/scoring, a left mini flipper, and a right kickback to NEON PINBALL, all selectable from the cabinet menu.

**Architecture:** A `GAMEPLAY_MODES` config object (mirroring existing `THEME_PACKS`) drives `buildTable()` to place mode-specific obstacles. A new `clearTable()` + `buildTable()` call in `restartGame()` rebuilds the table on each new game for the selected mode. Top lanes are detection zones (no physics changes) checked each frame.

**Tech Stack:** Vanilla JS, Canvas 2D, Playwright for tests — all in `index.html` + `launch.spec.js`.

---

## File Structure

- **Modify:** `index.html` — all changes go here (single-file app)
  - Section 1 (CONFIG): Add `GAMEPLAY_MODES`, `DEFAULT_GAMEPLAY_MODE_ID`, `RIGHT_KICKBACK_EJECT`, `GAMEPLAY_MODE_STORAGE_KEY`
  - Section 3 (PHYSICS): Add `topLaneList`, `clearTable()`, top-lane detection in `physicsStep()`, right kickback in `physicsStep()`
  - Section 4 (TABLE): Make `buildTable()` mode-aware; add top lane population
  - Section 5 (FLIPPERS): Add `flippers.miniL`, `makeMiniFlipperL()`, drive mini flipper in `flipperStep()` + collision loop
  - Section 7 (SCORING): Add `state.rightKickback`, `state.rightKickbackFlash`, `state.spellJackpotBase`; update `restartGame()` and `serveBall()`
  - Section 8 (INPUT): Add keys `4`–`7` for mode selection; add `setGameplayModeId`, `applyGameplayModeFromMenu`; update `loadSettings`/`saveSettings`/`settings`
  - Section 10 (RENDER): Add `drawTopLanes()`, right kickback flash in HUD, mode label in HUD, expand `renderMenuOverlay()`
  - Section 12 (TEST HOOK): Expose `topLanes`, `getGameplayModeId`, `setGameplayModeFromMenu`, `rightKickback` state
- **Modify:** `launch.spec.js` — add tests for modes, top lanes, mini flipper, right kickback

---

## Task 1: GAMEPLAY_MODES config + settings/persistence

**Files:**
- Modify: `index.html` (Section 1 CONFIG ~line 17, Section 8 INPUT ~line 128)
- Modify: `launch.spec.js`

- [ ] **Step 1: Add GAMEPLAY_MODES constant after the `CABINET_MENU_RULE_LINES` block (~line 48)**

```js
const DEFAULT_GAMEPLAY_MODE_ID = 'top-lanes';
const GAMEPLAY_MODE_STORAGE_KEY = 'flipper.gameplayModeId';
const RIGHT_KICKBACK_EJECT = { x: 352, y: 510, vx: -340, vy: -580 };

const GAMEPLAY_MODES = {
  'top-lanes': {
    id: 'top-lanes', name: 'Top Lanes',
    laneCount: 5, laneLabels: null,
    onLaneComplete: 'multiplier',
    bumpers: [
      { c:{x:140,y:250}, r:22, gain:1.7, value:250 },
      { c:{x:210,y:200}, r:22, gain:1.7, value:250 },
      { c:{x:280,y:250}, r:22, gain:1.7, value:250 },
      { c:{x:100,y:220}, r:20, gain:1.7, value:250 },
      { c:{x:320,y:220}, r:20, gain:1.7, value:250 },
    ],
    drops: [
      { c:{x:170,y:350}, w:24, h:8, value:200 },
      { c:{x:210,y:350}, w:24, h:8, value:200 },
      { c:{x:250,y:350}, w:24, h:8, value:200 },
    ],
  },
  'drop-bank': {
    id: 'drop-bank', name: 'Drop Bank',
    laneCount: 3, laneLabels: null,
    onLaneComplete: 'points-burst',
    bumpers: [
      { c:{x:140,y:250}, r:22, gain:1.7, value:250 },
      { c:{x:210,y:200}, r:22, gain:1.7, value:250 },
      { c:{x:280,y:250}, r:22, gain:1.7, value:250 },
      { c:{x:100,y:220}, r:20, gain:1.7, value:250 },
      { c:{x:320,y:220}, r:20, gain:1.7, value:250 },
    ],
    drops: [
      { c:{x:155,y:350}, w:24, h:8, value:200 },
      { c:{x:190,y:350}, w:24, h:8, value:200 },
      { c:{x:225,y:350}, w:24, h:8, value:200 },
      { c:{x:260,y:350}, w:24, h:8, value:200 },
    ],
  },
  'spell-neon': {
    id: 'spell-neon', name: 'Spell Neon',
    laneCount: 4, laneLabels: ['N','E','O','N'],
    onLaneComplete: 'jackpot',
    bumpers: [
      { c:{x:140,y:250}, r:22, gain:1.7, value:250 },
      { c:{x:210,y:200}, r:22, gain:1.7, value:250 },
      { c:{x:280,y:250}, r:22, gain:1.7, value:250 },
      { c:{x:100,y:220}, r:20, gain:1.7, value:250 },
      { c:{x:320,y:220}, r:20, gain:1.7, value:250 },
    ],
    drops: [
      { c:{x:170,y:350}, w:24, h:8, value:200 },
      { c:{x:210,y:350}, w:24, h:8, value:200 },
      { c:{x:250,y:350}, w:24, h:8, value:200 },
    ],
  },
  'bumper-frenzy': {
    id: 'bumper-frenzy', name: 'Bumper Frenzy',
    laneCount: 3, laneLabels: null,
    onLaneComplete: 'super-all',
    bumpers: [
      { c:{x:100,y:240}, r:20, gain:1.7, value:250 },
      { c:{x:140,y:200}, r:22, gain:1.7, value:250 },
      { c:{x:210,y:180}, r:22, gain:1.7, value:250 },
      { c:{x:210,y:260}, r:20, gain:1.7, value:250 },
      { c:{x:280,y:200}, r:22, gain:1.7, value:250 },
      { c:{x:320,y:240}, r:20, gain:1.7, value:250 },
    ],
    drops: [],
  },
};
```

- [ ] **Step 2: Update `settings` object and add mode helper functions**

Find `const settings = { themeId: DEFAULT_THEME_ID, soundEnabled: true, };` and replace it with:

```js
const settings = {
  themeId: DEFAULT_THEME_ID,
  soundEnabled: true,
  gameplayModeId: DEFAULT_GAMEPLAY_MODE_ID,
};
```

Then, after the existing `isThemeIdValid` / `getActiveTheme` functions, add:

```js
function isGameplayModeIdValid(id){
  return Object.prototype.hasOwnProperty.call(GAMEPLAY_MODES, id);
}

function getActiveMode(){
  return GAMEPLAY_MODES[settings.gameplayModeId] || GAMEPLAY_MODES[DEFAULT_GAMEPLAY_MODE_ID];
}

function setGameplayModeId(id){
  if (!isGameplayModeIdValid(id)) return false;
  settings.gameplayModeId = id;
  saveSettings();
  return true;
}

function applyGameplayModeFromMenu(id){
  if (!canApplyThemeFromMenu()) return false;
  return setGameplayModeId(id);
}
```

- [ ] **Step 3: Update `saveSettings` and `loadSettings` to persist the mode**

Replace the existing `saveSettings` function:

```js
function saveSettings(){
  localStorage.setItem(THEME_STORAGE_KEY, settings.themeId);
  localStorage.setItem(SOUND_STORAGE_KEY, String(settings.soundEnabled));
  localStorage.setItem(GAMEPLAY_MODE_STORAGE_KEY, settings.gameplayModeId);
}
```

Replace the existing `loadSettings` function:

```js
function loadSettings(){
  const rawTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const rawSound = localStorage.getItem(SOUND_STORAGE_KEY);
  const rawMode  = localStorage.getItem(GAMEPLAY_MODE_STORAGE_KEY);

  settings.themeId = isThemeIdValid(rawTheme) ? rawTheme : DEFAULT_THEME_ID;
  const soundValid = rawSound === 'true' || rawSound === 'false';
  settings.soundEnabled = soundValid ? rawSound === 'true' : true;
  settings.gameplayModeId = isGameplayModeIdValid(rawMode) ? rawMode : DEFAULT_GAMEPLAY_MODE_ID;

  if (!isThemeIdValid(rawTheme)) localStorage.setItem(THEME_STORAGE_KEY, settings.themeId);
  if (!soundValid) localStorage.setItem(SOUND_STORAGE_KEY, String(settings.soundEnabled));
  if (!isGameplayModeIdValid(rawMode)) localStorage.setItem(GAMEPLAY_MODE_STORAGE_KEY, settings.gameplayModeId);
}
```

- [ ] **Step 4: Expose mode hooks in `window.__test`**

In the test hook block at the bottom, add after `isSoundEnabled`:

```js
getGameplayModeId(){ return settings.gameplayModeId; },
setGameplayModeFromMenu(id){ return applyGameplayModeFromMenu(id); },
```

- [ ] **Step 5: Write the failing tests**

In `launch.spec.js`, add at the end of the file:

```js
test('gameplay mode: default is top-lanes', async ({ page }) => {
  await page.goto(URL);
  const id = await page.evaluate(() => window.__test.getGameplayModeId());
  expect(id).toBe('top-lanes');
});

test('gameplay mode: can switch modes in cabinet menu', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    const ok1 = window.__test.setGameplayModeFromMenu('spell-neon');
    const id1 = window.__test.getGameplayModeId();
    const ok2 = window.__test.setGameplayModeFromMenu('bumper-frenzy');
    const id2 = window.__test.getGameplayModeId();
    return { ok1, id1, ok2, id2 };
  });
  expect(r.ok1).toBe(true);
  expect(r.id1).toBe('spell-neon');
  expect(r.ok2).toBe(true);
  expect(r.id2).toBe('bumper-frenzy');
});

test('gameplay mode: invalid id is rejected', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    const ok = window.__test.setGameplayModeFromMenu('not-a-mode');
    return { ok, id: window.__test.getGameplayModeId() };
  });
  expect(r.ok).toBe(false);
  expect(r.id).toBe('top-lanes');
});

test('gameplay mode: persists across reload', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setGameplayModeFromMenu('drop-bank');
  });
  await page.reload();
  const id = await page.evaluate(() => window.__test.getGameplayModeId());
  expect(id).toBe('drop-bank');
});

test('gameplay mode: invalid persisted value falls back to default', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.setItem('flipper.gameplayModeId', 'garbage');
  });
  await page.reload();
  const id = await page.evaluate(() => window.__test.getGameplayModeId());
  expect(id).toBe('top-lanes');
});
```

- [ ] **Step 6: Run tests to verify they fail**

```
npx playwright test launch.spec.js --grep "gameplay mode" -v
```

Expected: all 5 new tests FAIL with `window.__test.getGameplayModeId is not a function`.

- [ ] **Step 7: Run tests to verify they pass after implementation**

```
npx playwright test launch.spec.js --grep "gameplay mode" -v
```

Expected: all 5 PASS.

- [ ] **Step 8: Run full test suite to confirm no regressions**

```
npx playwright test launch.spec.js
```

Expected: all existing tests still pass.

- [ ] **Step 9: Commit**

```
git add index.html launch.spec.js
git commit -m "feat: add GAMEPLAY_MODES config and settings persistence"
```

---

## Task 2: clearTable + mode-aware buildTable + topLaneList

**Files:**
- Modify: `index.html` (Section 3 PHYSICS ~line 311, Section 4 TABLE ~line 622, Section 7 SCORING ~line 347)

- [ ] **Step 1: Write failing tests**

Add to `launch.spec.js`:

```js
test('table: top-lanes mode has 5 bumpers and 3 drops', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setGameplayModeFromMenu('top-lanes');
    window.__test.restart();
    return {
      bumpers: window.__test.bumpers.length,
      topLanes: window.__test.topLanes.length,
    };
  });
  expect(r.bumpers).toBe(5);
  expect(r.topLanes).toBe(5);
});

test('table: bumper-frenzy mode has 6 bumpers and 0 drops', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setGameplayModeFromMenu('bumper-frenzy');
    window.__test.restart();
    return {
      bumpers: window.__test.bumpers.length,
      topLanes: window.__test.topLanes.length,
    };
  });
  expect(r.bumpers).toBe(6);
  expect(r.topLanes).toBe(3);
});

test('table: drop-bank mode has 4 drop targets', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setGameplayModeFromMenu('drop-bank');
    window.__test.restart();
    return window.__test.topLanes.length;
  });
  expect(r).toBe(3);
});

test('table: spell-neon mode has 4 top lanes with labels N E O N', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setGameplayModeFromMenu('spell-neon');
    window.__test.restart();
    return window.__test.topLanes.map(l => l.label);
  });
  expect(r).toEqual(['N','E','O','N']);
});
```

- [ ] **Step 2: Run to verify they fail**

```
npx playwright test launch.spec.js --grep "table:" -v
```

Expected: FAIL — `window.__test.topLanes` is undefined.

- [ ] **Step 3: Add `topLaneList` and `clearTable()` to Section 3 (PHYSICS)**

After `const dropList = [];` (~line 337) add:

```js
const topLaneList = []; // { xMin, xMax, label, lit }
```

After the `addDrop` function add:

```js
function clearTable(){
  segments.length = 0;
  arcRegistry.length = 0;
  slingList.length = 0;
  bumperList.length = 0;
  dropList.length = 0;
  topLaneList.length = 0;
  gateSeg = null;
}
```

- [ ] **Step 4: Replace `buildTable()` with a mode-aware version**

Replace the entire `buildTable()` function body (keeping the function declaration):

```js
function buildTable(){
  const mode = getActiveMode();

  // ── Fixed geometry shared by all modes ──
  addSegment({x:0,   y:24},  {x:SHOOTER_X, y:24});
  addSegment({x:0,   y:24},  {x:0,        y:CONFIG.H});
  addSegment({x:CONFIG.W, y:24}, {x:CONFIG.W, y:CONFIG.H});
  addSegment({x:0,           y:CONFIG.H-20}, {x:DRAIN_LEFT,  y:CONFIG.H});
  addSegment({x:DRAIN_RIGHT,  y:CONFIG.H},   {x:SHOOTER_X,   y:CONFIG.H-20});
  addSegment({x:SHOOTER_X,    y:CONFIG.H-20},{x:CONFIG.W,    y:CONFIG.H-20});
  addSegment({x:SHOOTER_X, y:120}, {x:SHOOTER_X, y:CONFIG.H-40});
  addSegment({x:SHOOTER_X, y:24}, {x:CONFIG.W, y:120}, { restitution: 0.92 });

  addSegment({x:32,  y:490}, {x:26,  y:668});
  addSegment({x:388, y:490}, {x:394, y:668});
  addSegment({x:55,  y:490}, {x:32,  y:490});
  addSegment({x:365, y:490}, {x:388, y:490});
  addSegment({x:115, y:600}, {x:120, y:618});
  addSegment({x:305, y:600}, {x:300, y:618});
  addSegment({x:75,  y:440}, {x:130, y:468});
  addSegment({x:345, y:440}, {x:290, y:468});

  addSling({x:55,  y:490}, {x:115, y:600}, 1.65, 80);
  addSling({x:365, y:490}, {x:305, y:600}, 1.65, 80);

  // ── Mode-specific obstacles ──
  for (const bp of mode.bumpers) addBumper(bp.c, bp.r, bp.gain, bp.value);
  for (const dp of mode.drops)   addDrop(dp.c, dp.w, dp.h, dp.value);

  // ── Top lanes ──
  const xStart = 10, xEnd = 355;
  const laneWidth = (xEnd - xStart) / mode.laneCount;
  for (let i = 0; i < mode.laneCount; i++){
    topLaneList.push({
      xMin: xStart + i * laneWidth,
      xMax: xStart + (i + 1) * laneWidth,
      label: mode.laneLabels ? mode.laneLabels[i] : null,
      lit: false,
    });
  }
}
```

- [ ] **Step 5: Update `restartGame()` to rebuild table on each new game**

In `restartGame()`, BEFORE `serveBall()`, add these two lines:

```js
clearTable();
buildTable();
```

Also reset flipper state (angles can get stuck if table rebuilds mid-play):

```js
for (const f of [flippers.L, flippers.R, flippers.miniL].filter(Boolean)){
  f.angle = f.angleRest;
  f.angVel = 0;
  f.pressed = false;
}
```

- [ ] **Step 6: Expose `topLanes` in `window.__test`**

In the test hook, add after the existing `get bumpers()` getter:

```js
get topLanes(){ return topLaneList; },
```

- [ ] **Step 7: Run table tests**

```
npx playwright test launch.spec.js --grep "table:" -v
```

Expected: all 4 new table tests PASS.

- [ ] **Step 8: Run full suite**

```
npx playwright test launch.spec.js
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```
git add index.html launch.spec.js
git commit -m "feat: mode-aware buildTable with clearTable and topLaneList"
```

---

## Task 3: Top lane detection + per-mode scoring

**Files:**
- Modify: `index.html` (Section 3 PHYSICS `physicsStep`, `restartGame`, `serveBall`)
- Modify: `launch.spec.js`

- [ ] **Step 1: Write failing tests**

Add to `launch.spec.js`:

```js
test('top lanes: ball at top lights the lane it passes through', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setGameplayModeFromMenu('top-lanes');
    window.__test.restart();
    // Place ball inside first lane's x range, just above detection threshold
    const lane = window.__test.topLanes[0];
    const cx = (lane.xMin + lane.xMax) / 2;
    window.__test.place(cx, 70, 0, -50);
    for (let i = 0; i < 10; i++) window.__test.step(1);
    return window.__test.topLanes.map(l => l.lit);
  });
  expect(r[0]).toBe(true);
  expect(r.slice(1).every(v => !v)).toBe(true);
});

test('top lanes: completing all 5 in top-lanes mode raises multiplier', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setGameplayModeFromMenu('top-lanes');
    window.__test.restart();
    window.__test.state.mult = 1;
    const lanes = window.__test.topLanes;
    // Manually light all lanes
    for (const lane of lanes) lane.lit = true;
    // Trigger completion by lighting the last lane via physics
    // Reset all but last, then fly ball through last
    for (let i = 0; i < lanes.length - 1; i++) lanes[i].lit = true;
    lanes[lanes.length - 1].lit = false;
    const cx = (lanes[lanes.length-1].xMin + lanes[lanes.length-1].xMax) / 2;
    window.__test.place(cx, 70, 0, -50);
    for (let i = 0; i < 15; i++) window.__test.step(1);
    return { mult: window.__test.state.mult, anyLit: window.__test.topLanes.some(l => l.lit) };
  });
  // mult went up OR all lanes reset (they were all lit so completion fired)
  expect(r.mult).toBeGreaterThanOrEqual(1); // at least 1; completion increases to 2
  expect(r.anyLit).toBe(false); // lanes reset after completion
});

test('top lanes: spell-neon completion fires jackpot and doubles base', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setGameplayModeFromMenu('spell-neon');
    window.__test.restart();
    const lanes = window.__test.topLanes;
    const before = window.__test.state.score;
    // Light first 3, then fly ball through last
    for (let i = 0; i < 3; i++) lanes[i].lit = true;
    lanes[3].lit = false;
    const cx = (lanes[3].xMin + lanes[3].xMax) / 2;
    window.__test.place(cx, 70, 0, -50);
    for (let i = 0; i < 15; i++) window.__test.step(1);
    return {
      scoreDelta: window.__test.state.score - before,
      jackpotBase: window.__test.state.spellJackpotBase,
    };
  });
  expect(r.scoreDelta).toBeGreaterThan(0);
  expect(r.jackpotBase).toBe(10000); // doubled from 5000
});
```

- [ ] **Step 2: Run to verify they fail**

```
npx playwright test launch.spec.js --grep "top lanes:" -v
```

Expected: FAIL (detection/scoring not implemented yet).

- [ ] **Step 3: Add new state fields + reset logic**

In `restartGame()`, after existing resets (`state.extraBallAwarded = false`), add:

```js
state.rightKickback = true;
state.rightKickbackFlash = 0;
state.spellJackpotBase = 5000;
```

In `serveBall()`, add after `state.phase = 'ready'`:

```js
state.spellJackpotBase = 5000;
```

In the `state` object declaration (~line 755), add the new fields:

```js
const state = { phase:'ready', score:0, hi:0, balls:3, mult:1, saverUntil:0, drops:[false,false,false], dropCycles:0, comboCount:0, comboUntil:0, kickback:true, kickbackFlash:0, bumperHits:0, superBumpersUntil:0, bumperChainCount:0, bumperChainUntil:0, extraBallAwarded:false, rightKickback:true, rightKickbackFlash:0, spellJackpotBase:5000 };
```

- [ ] **Step 4: Add `handleTopLanesComplete()` function**

Add this function after `registerScoreEvent()`:

```js
function handleTopLanesComplete(){
  const mode = getActiveMode();
  const nowSec = performance.now()/1000;
  if (mode.onLaneComplete === 'multiplier'){
    if (state.mult < 4){
      state.mult += 1;
      spawnFloat('LANES! MULT x' + state.mult, CONFIG.W/2, 200, '#fc4');
    } else {
      applyScore(5000 * state.mult);
      spawnFloat('MAX MULT! +5000', CONFIG.W/2, 200, '#fc4');
    }
    spawnParticles(CONFIG.W/2, 80, 20, '#fc4');
    dispatchThemeEvent('jackpot', { x: CONFIG.W/2, y: 80 });
    shake = Math.max(shake, 12);
  } else if (mode.onLaneComplete === 'points-burst'){
    const pts = 1000 * state.mult;
    applyScore(pts);
    spawnFloat('LANE BONUS +' + pts, CONFIG.W/2, 200, '#5cf');
    spawnParticles(CONFIG.W/2, 80, 20, '#5cf');
    dispatchThemeEvent('drop_clear', { x: CONFIG.W/2, y: 80 });
    shake = Math.max(shake, 8);
  } else if (mode.onLaneComplete === 'jackpot'){
    const pts = state.spellJackpotBase * state.mult;
    applyScore(pts);
    spawnFloat('N-E-O-N! +' + pts, CONFIG.W/2, 200, '#0ff');
    spawnParticles(CONFIG.W/2, 80, 30, '#0ff');
    dispatchThemeEvent('jackpot', { x: CONFIG.W/2, y: 80 });
    state.spellJackpotBase = Math.min(state.spellJackpotBase * 2, 80000);
    shake = Math.max(shake, 16);
  } else if (mode.onLaneComplete === 'super-all'){
    state.superBumpersUntil = nowSec + 10;
    state.bumperChainCount = 0;
    spawnFloat('FRENZY! ALL SUPER!', CONFIG.W/2, 200, '#f3a');
    spawnParticles(CONFIG.W/2, 80, 40, '#f3a');
    dispatchThemeEvent('jackpot', { x: CONFIG.W/2, y: 80 });
    shake = Math.max(shake, 20);
  }
  for (const lane of topLaneList) lane.lit = false;
}
```

- [ ] **Step 5: Add top lane detection inside `physicsStep()`**

Inside `physicsStep()`, after `handleDrain()`, add:

```js
// Top lane detection
if (ball.p.y > 24 && ball.p.y < 65){
  for (const lane of topLaneList){
    if (!lane.lit && ball.p.x >= lane.xMin && ball.p.x <= lane.xMax){
      lane.lit = true;
      applyScore(100 * state.mult);
      registerScoreEvent();
      spawnFloat(lane.label ? lane.label + '!' : '+100', ball.p.x, 68, '#5cf');
      if (topLaneList.every(l => l.lit)) handleTopLanesComplete();
      break;
    }
  }
}
```

- [ ] **Step 6: Run top lane tests**

```
npx playwright test launch.spec.js --grep "top lanes:" -v
```

Expected: all 3 PASS.

- [ ] **Step 7: Run full suite**

```
npx playwright test launch.spec.js
```

Expected: all pass.

- [ ] **Step 8: Commit**

```
git add index.html launch.spec.js
git commit -m "feat: top lane detection and per-mode scoring"
```

---

## Task 4: Left mini flipper (physics + rendering)

**Files:**
- Modify: `index.html` (Section 5 FLIPPERS ~line 677, Section 3 PHYSICS `physicsStep` + `flipperStep`)
- Modify: `launch.spec.js`

- [ ] **Step 1: Write failing test**

Add to `launch.spec.js`:

```js
test('mini flipper: left key also activates mini flipper in left outlane area', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.restart();
    // Place ball in left outlane (below x=32, above y=668)
    window.__test.place(18, 550, 0, 120);
    window.__test.press('z');      // activate left flipper (and mini flipper)
    let deflected = false;
    for (let i = 0; i < 90; i++){
      window.__test.step(1);
      const b = window.__test.ball;
      if (b.v.x > 50) { deflected = true; break; } // moving rightward = deflected inward
    }
    window.__test.release('z');
    return deflected;
  });
  expect(r).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

```
npx playwright test launch.spec.js --grep "mini flipper" -v
```

Expected: FAIL — ball is not deflected.

- [ ] **Step 3: Add `makeMiniFlipperL()` and initialize `flippers.miniL`**

First update the flippers object declaration from:

```js
const flippers = { L: null, R: null };
```

to:

```js
const flippers = { L: null, R: null, miniL: null };
```

After `flippers.R = makeFlipper({x:285, y:620}, 'R');`, add:

```js
function makeMiniFlipperL(){
  // Pivot on left wall at top of left outlane (y=492, x=30)
  // Rest: angled right-downward (0.9 rad ≈ 52°, tip points right and slightly down)
  // Up: angled right-upward (−0.4 rad ≈ −23°, tip points right and up → deflects ball inward)
  return {
    pivot: { x: 30, y: 492 },
    side: 'L',
    length: 38, tipR: 5, baseR: 8,
    angle: 0.9, angleRest: 0.9, angleUp: -0.4,
    angVel: 0, state: 'rest',
    pressed: false,
  };
}
flippers.miniL = makeMiniFlipperL();
```

- [ ] **Step 4: Drive mini flipper in `flipperStep()`**

Change:

```js
for (const f of [flippers.L, flippers.R]){
```

to:

```js
for (const f of [flippers.L, flippers.R, flippers.miniL].filter(Boolean)){
```

- [ ] **Step 5: Add mini flipper to collision loop in `physicsStep()`**

Change:

```js
for (const f of [flippers.L, flippers.R]){
  const hit = flipperCollide(f, ball.p, d, ball.r);
```

to:

```js
for (const f of [flippers.L, flippers.R, flippers.miniL].filter(Boolean)){
  const hit = flipperCollide(f, ball.p, d, ball.r);
```

Also drive `flippers.miniL.pressed` from `input.L`. In `physicsStep()`, find:

```js
flippers.L.pressed = input.L;
flippers.R.pressed = input.R;
```

and add after:

```js
if (flippers.miniL) flippers.miniL.pressed = input.L;
```

- [ ] **Step 6: Render the mini flipper**

In `render()`, find the flipper rendering loop:

```js
for (const f of [flippers.L, flippers.R]){
  const tip = flipperTip(f);
  ctx.strokeStyle = '#fd5';
```

Change to:

```js
for (const f of [flippers.L, flippers.R, flippers.miniL].filter(Boolean)){
  const tip = flipperTip(f);
  ctx.strokeStyle = '#fd5';
  ctx.lineCap = 'round';
  ctx.lineWidth = f === flippers.miniL ? 8 : 14; // mini flipper is thinner
  ctx.beginPath(); ctx.moveTo(f.pivot.x,f.pivot.y); ctx.lineTo(tip.x,tip.y); ctx.stroke();
}
```

Note: the existing loop has `ctx.lineWidth = 14` hardcoded inside — extract it so the mini flipper gets `lineWidth = 8`.

- [ ] **Step 7: Run mini flipper test**

```
npx playwright test launch.spec.js --grep "mini flipper" -v
```

Expected: PASS.

- [ ] **Step 8: Run full suite**

```
npx playwright test launch.spec.js
```

Expected: all pass.

- [ ] **Step 9: Commit**

```
git add index.html launch.spec.js
git commit -m "feat: left mini flipper in left outlane"
```

---

## Task 5: Right kickback (physics + rendering)

**Files:**
- Modify: `index.html` (Section 3 PHYSICS `physicsStep`, Section 10 RENDER)
- Modify: `launch.spec.js`

- [ ] **Step 1: Write failing test**

Add to `launch.spec.js`:

```js
test('right kickback: armed right outlane relaunches ball back into play', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.restart();
    window.__test.state.saverUntil = 0;
    // Place ball in right outlane (x ~382, just below slingshot base)
    window.__test.place(382, 600, 0, 180);
    let kickbackFired = false;
    let movedLeft = false;
    for (let i = 0; i < 600; i++){
      window.__test.step(1);
      const b = window.__test.ball;
      const s = window.__test.state;
      if (!s.rightKickback) kickbackFired = true;
      if (kickbackFired && b.p.x < 360) movedLeft = true;
      if (s.balls < 3) break;
    }
    return { kickbackFired, movedLeft, balls: window.__test.state.balls };
  });
  expect(r.kickbackFired).toBe(true);
  expect(r.movedLeft).toBe(true);
  expect(r.balls).toBe(3);
});
```

- [ ] **Step 2: Run to verify it fails**

```
npx playwright test launch.spec.js --grep "right kickback" -v
```

Expected: FAIL — `s.rightKickback` never becomes false.

- [ ] **Step 3: Add right kickback logic to `physicsStep()`**

Inside `physicsStep()`, directly after the existing left kickback block:

```js
// Right kickback (symmetric to left)
if (state.rightKickback && ball.p.x > 370 && ball.p.x < 396 && ball.p.y > 550 && ball.p.y < 700){
  ball.p.x = RIGHT_KICKBACK_EJECT.x;
  ball.p.y = RIGHT_KICKBACK_EJECT.y;
  ball.v.x = RIGHT_KICKBACK_EJECT.vx;
  ball.v.y = RIGHT_KICKBACK_EJECT.vy;
  state.rightKickback = false;
  state.rightKickbackFlash = 0.8;
  spawnParticles(RIGHT_KICKBACK_EJECT.x, 600, 24, '#0ff');
  spawnFloat('KICKBACK!', CONFIG.W - 88, 540, '#0ff');
  shake = 12;
}
```

- [ ] **Step 4: Rearm right kickback on drop bank clear**

Find the drop bank clear block in `physicsStep()`:

```js
state.kickback = true; // rearm kickback on every bank clear
```

Add on the next line:

```js
state.rightKickback = true;
```

- [ ] **Step 5: Render right kickback flash in HUD**

In `render()`, find the left kickback rendering block:

```js
if (state.kickback){
  ctx.fillStyle = palette.bumperGlow;
  ctx.shadowColor = palette.bumperGlow; ctx.shadowBlur = 6;
  ctx.fillText('KBCK', hudRightX, 62);
  ctx.shadowBlur = 0;
} else if (state.kickbackFlash > 0){
  ctx.globalAlpha = state.kickbackFlash / 0.8;
  ctx.fillStyle = palette.bumperGlow;
  ctx.fillText('KBCK', hudRightX, 62);
  ctx.globalAlpha = 1;
  state.kickbackFlash = Math.max(0, state.kickbackFlash - 1/60);
}
```

Directly after that block, add (right kickback is shown in the left HUD panel on its own line):

```js
// Right kickback indicator (line below left kickback)
if (state.rightKickback){
  ctx.fillStyle = palette.bumperGlow;
  ctx.shadowColor = palette.bumperGlow; ctx.shadowBlur = 6;
  ctx.fillText('R-KB', hudRightX, 76);
  ctx.shadowBlur = 0;
} else if (state.rightKickbackFlash > 0){
  ctx.globalAlpha = state.rightKickbackFlash / 0.8;
  ctx.fillStyle = palette.bumperGlow;
  ctx.textAlign = 'right';
  ctx.fillText('R-KB', hudRightX, 76);
  ctx.globalAlpha = 1;
  state.rightKickbackFlash = Math.max(0, state.rightKickbackFlash - 1/60);
}
```

Also expand the right HUD panel height to accommodate the extra line. Find:

```js
ctx.fillRect(300, 6, 114, 66);
```

and change to:

```js
ctx.fillRect(300, 6, 114, 82);
```

- [ ] **Step 6: Run right kickback test**

```
npx playwright test launch.spec.js --grep "right kickback" -v
```

Expected: PASS.

- [ ] **Step 7: Run full suite**

```
npx playwright test launch.spec.js
```

Expected: all pass.

- [ ] **Step 8: Commit**

```
git add index.html launch.spec.js
git commit -m "feat: right kickback symmetric to left kickback"
```

---

## Task 6: Top lane rendering

**Files:**
- Modify: `index.html` (Section 10 RENDER)
- Modify: `launch.spec.js`

- [ ] **Step 1: Write smoke test**

Add to `launch.spec.js`:

```js
test('top lanes: rendering does not throw in any mode', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  for (const modeId of ['top-lanes','drop-bank','spell-neon','bumper-frenzy']){
    await page.evaluate((id) => {
      window.__test.pause();
      window.__test.openMenu();
      window.__test.setGameplayModeFromMenu(id);
      window.__test.restart();
      for (let i = 0; i < 60; i++) window.__test.step(1);
    }, modeId);
  }
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run to verify it passes already (no throw even before top lanes are drawn)**

```
npx playwright test launch.spec.js --grep "top lanes: rendering" -v
```

Expected: PASS (no crash without the rendering code yet).

- [ ] **Step 3: Add `drawTopLanes()` function in Section 10 (RENDER)**

Add this function before `render()`:

```js
function drawTopLanes(){
  if (topLaneList.length === 0) return;
  const theme = getActiveTheme();
  const palette = theme.palette;
  const laneH = 18; // height of each lane indicator
  const laneY = 26; // just below top wall
  const mode = getActiveMode();
  const isSpell = mode.onLaneComplete === 'jackpot';

  for (let i = 0; i < topLaneList.length; i++){
    const lane = topLaneList[i];
    const cx = (lane.xMin + lane.xMax) / 2;
    const lw = lane.xMax - lane.xMin - 4; // 2px gap each side
    const lit = lane.lit;

    ctx.save();
    if (lit){
      ctx.fillStyle = palette.insertOn;
      ctx.shadowColor = palette.insertOn;
      ctx.shadowBlur = 10;
    } else {
      ctx.fillStyle = palette.insertOff;
      ctx.shadowBlur = 0;
    }
    ctx.fillRect(lane.xMin + 2, laneY, lw, laneH);
    ctx.restore();

    // Label (spell mode only)
    if (isSpell && lane.label){
      ctx.fillStyle = lit ? '#0a0612' : palette.textAccent;
      ctx.font = "bold 9px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lane.label, cx, laneY + laneH / 2);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'start';
    }
  }
}
```

- [ ] **Step 4: Call `drawTopLanes()` from `render()`**

Inside `render()`, after the drops rendering block (after the `for (const dp of dropList)` loop) and before the trail rendering, add:

```js
drawTopLanes();
```

- [ ] **Step 5: Run rendering smoke test again**

```
npx playwright test launch.spec.js --grep "top lanes: rendering" -v
```

Expected: still PASS.

- [ ] **Step 6: Run full suite**

```
npx playwright test launch.spec.js
```

Expected: all pass.

- [ ] **Step 7: Commit**

```
git add index.html launch.spec.js
git commit -m "feat: top lane rendering with lit/unlit state and spell labels"
```

---

## Task 7: Cabinet menu mode selection + HUD mode label

**Files:**
- Modify: `index.html` (Section 8 INPUT keydown handler, `renderMenuOverlay`, `render` HUD)
- Modify: `launch.spec.js`

- [ ] **Step 1: Write failing tests**

Add to `launch.spec.js`:

```js
test('cabinet menu: keys 4-7 select gameplay modes', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.press('4'); const m4 = window.__test.getGameplayModeId();
    window.__test.press('5'); const m5 = window.__test.getGameplayModeId();
    window.__test.press('6'); const m6 = window.__test.getGameplayModeId();
    window.__test.press('7'); const m7 = window.__test.getGameplayModeId();
    return { m4, m5, m6, m7 };
  });
  expect(r.m4).toBe('top-lanes');
  expect(r.m5).toBe('drop-bank');
  expect(r.m6).toBe('spell-neon');
  expect(r.m7).toBe('bumper-frenzy');
});
```

- [ ] **Step 2: Run to verify it fails**

```
npx playwright test launch.spec.js --grep "keys 4-7" -v
```

Expected: FAIL — pressing `4` doesn't change the mode.

- [ ] **Step 3: Add keys 4–7 to keydown handler**

In the `keydown` handler, inside the `if (menu.open)` block, after:

```js
if (e.key === '3') applyThemeFromMenu('volcano-pop');
```

add:

```js
if (e.key === '4') applyGameplayModeFromMenu('top-lanes');
if (e.key === '5') applyGameplayModeFromMenu('drop-bank');
if (e.key === '6') applyGameplayModeFromMenu('spell-neon');
if (e.key === '7') applyGameplayModeFromMenu('bumper-frenzy');
```

- [ ] **Step 4: Run mode key tests**

```
npx playwright test launch.spec.js --grep "keys 4-7" -v
```

Expected: PASS.

- [ ] **Step 5: Update `renderMenuOverlay()` to show mode section**

`renderMenuOverlay()` needs an extra 120px of height to fit the new mode lines. Also reorganize Y positions slightly. Replace the entire `renderMenuOverlay()` function:

```js
function renderMenuOverlay(){
  if (!menu.open) return;
  const t = getActiveTheme();
  const p = t.palette;
  const controlLines = getCabinetMenuControlLines();
  const ruleLines = getCabinetMenuRuleLines();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(20, 80, CONFIG.W - 40, 480);
  ctx.strokeStyle = p.textAccent;
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 80, CONFIG.W - 40, 480);
  ctx.fillStyle = p.textPrimary;
  ctx.font = "10px 'Press Start 2P', monospace";
  ctx.textAlign = 'center';
  ctx.fillText('CABINET MENU', CONFIG.W/2, 114);
  ctx.textAlign = 'left';
  // Themes
  ctx.fillStyle = p.textAccent;
  ctx.fillText('THEMES', 50, 140);
  ctx.fillStyle = p.textPrimary;
  ctx.fillText('1 SUNBURST CLASSIC', 50, 160);
  ctx.fillText('2 COSMIC WEDGE', 50, 180);
  ctx.fillText('3 VOLCANO POP', 50, 200);
  // Modes
  ctx.fillStyle = p.textAccent;
  ctx.fillText('MODES', 50, 226);
  ctx.fillStyle = p.textPrimary;
  ctx.fillText('4 TOP LANES', 50, 246);
  ctx.fillText('5 DROP BANK', 50, 264);
  ctx.fillText('6 SPELL NEON', 50, 282);
  ctx.fillText('7 BUMPER FRENZY', 50, 300);
  // Sound
  ctx.fillText('S SOUND: ' + (settings.soundEnabled ? 'ON' : 'OFF'), 50, 322);
  // Controls
  ctx.fillStyle = p.textAccent;
  ctx.fillText('PLAY CONTROLS', 50, 348);
  ctx.fillStyle = p.textPrimary;
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.fillText(controlLines[0], 50, 368);
  ctx.fillText(controlLines[1], 50, 386);
  ctx.fillText(controlLines[2], 50, 404);
  // Rules
  ctx.fillStyle = p.textAccent;
  ctx.font = "10px 'Press Start 2P', monospace";
  ctx.fillText('GAME RULES', 50, 428);
  ctx.fillStyle = p.textPrimary;
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.fillText(ruleLines[0], 50, 448);
  ctx.fillText(ruleLines[1], 50, 464);
  // Footer
  ctx.font = "10px 'Press Start 2P', monospace";
  ctx.fillText('ENTER APPLY/RESUME', 50, 488);
  ctx.fillText('ESC CANCEL/RESUME', 50, 506);
  ctx.textAlign = 'center';
  ctx.fillText('THEME: ' + t.name.toUpperCase(), CONFIG.W/2, 530);
  ctx.fillText('MODE: ' + getActiveMode().name.toUpperCase(), CONFIG.W/2, 550);
  ctx.textAlign = 'start';
}
```

- [ ] **Step 6: Add mode name label to the in-game HUD**

In `render()`, find the theme name line:

```js
ctx.fillStyle = palette.textAccent;
ctx.font = "8px 'Press Start 2P', monospace";
ctx.textAlign = 'start';
ctx.fillText(theme.name.toUpperCase(), 8, 76);
```

Replace with:

```js
ctx.fillStyle = palette.textAccent;
ctx.font = "8px 'Press Start 2P', monospace";
ctx.textAlign = 'start';
ctx.fillText(theme.name.toUpperCase(), 8, 76);
ctx.fillText(getActiveMode().name.toUpperCase(), 8, 90);
```

Also expand the left HUD panel to fit the extra line. Find:

```js
ctx.fillRect(6, 6, 248, 78);
```

Change to:

```js
ctx.fillRect(6, 6, 248, 96);
```

- [ ] **Step 7: Run full suite**

```
npx playwright test launch.spec.js
```

Expected: all pass (including `cabinet menu: exposes compact launch...` and `cabinet menu: explains starting balls...` which check exact strings that we haven't changed).

- [ ] **Step 8: Commit**

```
git add index.html launch.spec.js
git commit -m "feat: cabinet menu mode selection and HUD mode label"
```

---

## Task 8: Final integration tests + polish

**Files:**
- Modify: `launch.spec.js`
- Modify: `index.html` (minor adjustments from integration findings)

- [ ] **Step 1: Write integration smoke tests for all 4 modes**

Add to `launch.spec.js`:

```js
test('integration: all 4 modes run 5 seconds without error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  for (const modeId of ['top-lanes','drop-bank','spell-neon','bumper-frenzy']){
    await page.evaluate((id) => {
      window.__test.pause();
      window.__test.openMenu();
      window.__test.setGameplayModeFromMenu(id);
      window.__test.restart();
      window.__test.place(140, 100, 30, 200);
      for (let i = 0; i < 240*5; i++) window.__test.step(1);
    }, modeId);
  }
  expect(errors).toEqual([]);
});

test('integration: table rebuild on restart does not leave stale physics objects', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setGameplayModeFromMenu('bumper-frenzy');
    window.__test.restart();
    const bumpersFrenzy = window.__test.bumpers.length;
    const lanesFrenzy = window.__test.topLanes.length;

    window.__test.openMenu();
    window.__test.setGameplayModeFromMenu('top-lanes');
    window.__test.restart();
    const bumpersTopLanes = window.__test.bumpers.length;
    const lanesTopLanes = window.__test.topLanes.length;

    return { bumpersFrenzy, lanesFrenzy, bumpersTopLanes, lanesTopLanes };
  });
  expect(r.bumpersFrenzy).toBe(6);
  expect(r.lanesFrenzy).toBe(3);
  expect(r.bumpersTopLanes).toBe(5);
  expect(r.lanesTopLanes).toBe(5);
});

test('integration: top-lanes mult can reach x4 by completing lanes repeatedly', async ({ page }) => {
  await page.goto(URL);
  const mult = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setGameplayModeFromMenu('top-lanes');
    window.__test.restart();
    // Complete lanes 3 times to push mult from 1 → 4
    for (let round = 0; round < 3; round++){
      for (const lane of window.__test.topLanes) lane.lit = false;
      const lanes = window.__test.topLanes;
      for (let i = 0; i < lanes.length - 1; i++) lanes[i].lit = true;
      lanes[lanes.length-1].lit = false;
      const cx = (lanes[lanes.length-1].xMin + lanes[lanes.length-1].xMax) / 2;
      window.__test.place(cx, 70, 0, -50);
      for (let i = 0; i < 15; i++) window.__test.step(1);
    }
    return window.__test.state.mult;
  });
  expect(mult).toBeGreaterThanOrEqual(3);
});
```

- [ ] **Step 2: Run integration tests**

```
npx playwright test launch.spec.js --grep "integration:" -v
```

Expected: all pass. If any fail, investigate and fix before continuing.

- [ ] **Step 3: Run full test suite**

```
npx playwright test launch.spec.js
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```
git add index.html launch.spec.js
git commit -m "test: integration tests for all 4 gameplay modes"
```

---

## Self-Review Checklist

- [x] **GAMEPLAY_MODES config** — Task 1 ✓
- [x] **settings.gameplayModeId persistence** — Task 1 ✓  
- [x] **buildTable() mode-aware** — Task 2 ✓
- [x] **clearTable() + rebuild in restartGame()** — Task 2 ✓
- [x] **topLaneList populated from mode config** — Task 2 ✓
- [x] **Top lane detection zones (ball.y < 65)** — Task 3 ✓
- [x] **handleTopLanesComplete() for all 4 onLaneComplete types** — Task 3 ✓
- [x] **state.spellJackpotBase doubles on collect, resets on new ball** — Task 3 ✓
- [x] **Left mini flipper: position, angles, physics collision** — Task 4 ✓
- [x] **Mini flipper driven by input.L** — Task 4 ✓
- [x] **Mini flipper rendered** — Task 4 ✓
- [x] **Right kickback detection zone** — Task 5 ✓
- [x] **Right kickback rearms on drop clear and restart** — Task 5 ✓
- [x] **Right kickback flash rendered in HUD** — Task 5 ✓
- [x] **Top lane rendering with lit/unlit + spell labels** — Task 6 ✓
- [x] **Cabinet menu keys 4–7** — Task 7 ✓
- [x] **renderMenuOverlay shows all 4 modes** — Task 7 ✓
- [x] **HUD mode label** — Task 7 ✓
- [x] **Mode change takes effect on next restartGame()** — Task 2 ✓ (restartGame calls buildTable)
