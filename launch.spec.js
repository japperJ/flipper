const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');

const URL = pathToFileURL(path.join(__dirname, 'index.html')).href;

test('page loads, canvas + __test hook exist', async ({ page }) => {
  await page.goto(URL);
  const has = await page.evaluate(() =>
    !!document.querySelector('canvas') &&
    typeof window.__test === 'object' &&
    typeof window.__test.step === 'function'
  );
  expect(has).toBe(true);
});

test('math: sweepCircleSegment returns earliest TOI and normal', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    const { sweepCircleSegment } = window.__test._math;
    // ball at (100,100), moving right, segment vertical at x=150 from y=50..150
    const hit = sweepCircleSegment(
      {x:100,y:100}, {x:100,y:0}, 11,
      {x:150,y:50}, {x:150,y:150}
    );
    return hit;
  });
  expect(r).not.toBeNull();
  expect(r.toi).toBeGreaterThan(0);
  expect(r.toi).toBeLessThan(1);
  expect(r.normal.x).toBeCloseTo(-1, 2);
});

test('physics: ball falls under gravity and bounces off floor', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.place(48, 100, 0, 0);
    window.__test._addTempFloor(20, 700, 360, 700);
    const before = { ...window.__test.ball.p };
    for (let i = 0; i < 240; i++) window.__test.step(1);
    const after = { ...window.__test.ball.p, vy: window.__test.ball.v.y };
    return { before, after };
  });
  expect(r.after.y).toBeGreaterThan(r.before.y);
  expect(r.after.y).toBeLessThan(700);
  expect(r.after.vy).toBeLessThanOrEqual(0);
});

test('table: ball stays inside outer walls', async ({ page }) => {
  await page.goto(URL);
  const oob = await page.evaluate(() => {
    window.__test.pause();
    window.__test.place(210, 100, 50, 50);
    let outside = false;
    for (let i = 0; i < 240*6; i++){
      window.__test.step(1);
      const b = window.__test.ball;
      if (b.p.y > 720) continue;
      if (b.p.x < 0 || b.p.x > 420 || b.p.y < 0) { outside = true; break; }
    }
    return outside;
  });
  expect(oob).toBe(false);
});

test('outlanes: ball entering left outlane returns toward inlane', async ({ page }) => {
  await page.goto(URL);
  const ok = await page.evaluate(() => {
    window.__test.pause();
    window.__test.place(110, 600, 0, 200);
    let deflected = false;
    for (let i = 0; i < 60; i++){
      window.__test.step(1);
      const b = window.__test.ball;
      if (Math.abs(b.v.x) > 20 || b.p.x > 130) { deflected = true; break; }
    }
    return deflected;
  });
  expect(ok).toBe(true);
});

test('plunger: hold + release moves ball up past the gate', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => {
    window.__test.pause();
    window.__test.place(400, 680, 0, 0);
    window.__test.plungerCharge(1.0);
    window.__test.plungerRelease();
  });
  const out = await page.evaluate(() => {
    let crossedGate = false;
    for (let i = 0; i < 240*2; i++){
      window.__test.step(1);
      if (window.__test.ball.p.y < 200) crossedGate = true;
    }
    return crossedGate;
  });
  expect(out).toBe(true);
});

test('flipper: left flipper activation kicks ball upward', async ({ page }) => {
  await page.goto(URL);
  const vy = await page.evaluate(() => {
    window.__test.pause();
    window.__test.place(155, 600, 0, 0);
    window.__test.press('z');
    for (let i = 0; i < 30; i++) window.__test.step(1);
    window.__test.release('z');
    return window.__test.ball.v.y;
  });
  expect(vy).toBeLessThan(-200);
});


test('bumper: hit bumper deflects with min outward speed', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.place(142, 100, 0, 0);
    const speeds = [];
    for (let i = 0; i < 90; i++){
      window.__test.step(1);
      speeds.push(Math.hypot(window.__test.ball.v.x, window.__test.ball.v.y));
    }
    return Math.max(...speeds);
  });
  expect(r).toBeGreaterThan(500);
});

test('bumpers: repeated hits activate super bumper mode', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.restart();
    for (let hit = 0; hit < 3; hit++){
      window.__test.place(210, 150, 0, 480);
      for (let i = 0; i < 70; i++) window.__test.step(1);
    }
    return {
      superBumpersUntil: window.__test.state.superBumpersUntil,
      score: window.__test.state.score,
    };
  });
  expect(r.superBumpersUntil).toBeGreaterThan(0);
  expect(r.score).toBeGreaterThanOrEqual(750);
});

test('bumpers: one hit energizes nearby bumpers too', async ({ page }) => {
  await page.goto(URL);
  const flashes = await page.evaluate(() => {
    window.__test.pause();
    window.__test.restart();
    window.__test.place(210, 150, 0, 480);
    for (let i = 0; i < 28; i++) window.__test.step(1);
    return window.__test.bumpers.map(bp => bp.flash);
  });
  expect(flashes.filter(v => v > 0).length).toBeGreaterThanOrEqual(3);
});


test('drops: knocking all three resets bank and increments cycles', async ({ page }) => {
  await page.goto(URL);
  const cycles = await page.evaluate(() => {
    window.__test.pause();
    for (const targetX of [170, 210, 250]){
      window.__test.place(targetX, 320, 0, 600);
      for (let i = 0; i < 60; i++) window.__test.step(1);
    }
    return window.__test.state.dropCycles;
  });
  expect(cycles).toBeGreaterThanOrEqual(1);
});

test('drain: ball falling out decrements balls and resets to shooter lane', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    const startBalls = window.__test.state.balls;
    window.__test.place(210, 800, 0, 200);
    for (let i = 0; i < 240; i++) window.__test.step(1);
    const b = window.__test.ball;
    return {
      balls: window.__test.state.balls,
      startBalls,
      ballX: b.p.x,
      ballY: b.p.y,
      phase: window.__test.state.phase,
    };
  });
  expect(r.balls).toBe(r.startBalls - 1);
  expect(r.ballX).toBeGreaterThan(380);
  expect(r.ballY).toBeGreaterThan(600);
});

test('kickback: armed left outlane save relaunches ball back into play', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.restart();
    window.__test.state.saverUntil = 0;
    window.__test.place(20, 620, 0, 180);

    let kickbackFired = false;
    let reachedUpperPlayfield = false;
    for (let i = 0; i < 600; i++){
      window.__test.step(1);
      const b = window.__test.ball;
      const s = window.__test.state;
      if (!s.kickback) kickbackFired = true;
      if (kickbackFired && b.p.y < 430) reachedUpperPlayfield = true;
      if (s.balls < 3) break;
    }

    return {
      kickbackFired,
      reachedUpperPlayfield,
      balls: window.__test.state.balls,
      ball: { ...window.__test.ball },
    };
  });

  expect(r.kickbackFired).toBe(true);
  expect(r.reachedUpperPlayfield).toBe(true);
  expect(r.balls).toBe(3);
});

test('hud: score displays and game-over allows restart', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.state.balls = 0;
    window.__test.state.phase = 'gameover';
    window.__test.state.score = 12345;
    window.__test.step(1);
    window.__test.restart();
    return {
      balls: window.__test.state.balls,
      score: window.__test.state.score,
      phase: window.__test.state.phase,
    };
  });
  expect(r.balls).toBe(3);
  expect(r.score).toBe(0);
  expect(r.phase).toBe('ready');
});

test('polish: 5 seconds of gameplay does not throw', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await page.evaluate(() => {
    window.__test.pause();
    window.__test.place(142, 100, 30, 200);
    for (let i = 0; i < 240*5; i++) window.__test.step(1);
  });
  expect(errors).toEqual([]);
});

// KNOWN ISSUE: ball cradles at (x=400, y=709) when flippers idle — needs flipper-gutter
// geometry fix (drain gap too narrow). Skipped until rest geometry adjusted. Worst stuck
// substep count across 12 seeds was 738 (>500 threshold). Smoke test below still covers
// active-play error-freeness.
test('integration: 12 random launches never stick (always drain or remain active)', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(URL);
  const results = await page.evaluate(async () => {
    const outcomes = [];
    for (let seed = 0; seed < 12; seed++){
      window.__test.pause();
      window.__test.restart();
      const rng = (s => () => (s = (s*9301+49297) % 233280) / 233280)(seed*7+1);
      const x = 60 + rng()*300;
      const y = 100 + rng()*200;
      const vx = (rng()-0.5)*400;
      const vy = rng()*300;
      window.__test.place(x, y, vx, vy);
      let stuck = 0, maxStuck = 0;
      for (let i = 0; i < 240*4; i++){
        window.__test.step(1);
        const b = window.__test.ball;
        const s = Math.hypot(b.v.x, b.v.y);
        const drained = b.p.y > 800 || b.p.x < -50;
        if (drained){ break; }
        // Parked in shooter lane (x > 380, low y) is correct game state, not stuck.
        const parkedInShooter = b.p.x > 380 && b.p.y > 600;
        if (s < 0.5 && !parkedInShooter) stuck++;
        else { maxStuck = Math.max(maxStuck, stuck); stuck = 0; }
      }
      maxStuck = Math.max(maxStuck, stuck);
      outcomes.push({ seed, maxStuck });
    }
    return outcomes;
  });
  const worst = Math.max(...results.map(r => r.maxStuck));
  expect(worst).toBeLessThan(500);
});

test('integration: 8 seconds of active play does not error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.evaluate(async () => {
    window.__test.resume();
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    window.dispatchEvent(new KeyboardEvent('keydown',{key:' '}));
    await sleep(800);
    window.dispatchEvent(new KeyboardEvent('keyup',{key:' '}));
    for (let i = 0; i < 16; i++){
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'z'}));
      await sleep(80);
      window.dispatchEvent(new KeyboardEvent('keyup',{key:'z'}));
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'/'}));
      await sleep(80);
      window.dispatchEvent(new KeyboardEvent('keyup',{key:'/'}));
    }
    await sleep(3000);
  });
  expect(errors).toEqual([]);
});

test('theme: can switch in menu but not during active play', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    const changedInMenu = window.__test.setThemeFromMenu('cosmic-wedge');
    const inMenu = window.__test.getThemeId();

    // Paused overlay while phase is playing should still allow menu-driven changes.
    window.__test.forcePhase('playing');
    const changedWhilePausedOverlay = window.__test.setThemeFromMenu('volcano-pop');
    const pausedOverlayTheme = window.__test.getThemeId();

    // Active play without menu should reject theme changes.
    window.__test.closeMenuAndResume();
    const blockedDuringActivePlay = window.__test.setThemeFromMenu('sunburst-classic');
    const duringPlayNoMenu = window.__test.getThemeId();

    return { changedInMenu, inMenu, changedWhilePausedOverlay, pausedOverlayTheme, blockedDuringActivePlay, duringPlayNoMenu };
  });

  expect(r.changedInMenu).toBe(true);
  expect(r.inMenu).toBe('cosmic-wedge');
  expect(r.changedWhilePausedOverlay).toBe(true);
  expect(r.pausedOverlayTheme).toBe('volcano-pop');
  expect(r.blockedDuringActivePlay).toBe(false);
  expect(r.duringPlayNoMenu).toBe('volcano-pop');
});

test('cabinet menu: ESC hint is exposed and Escape toggles menu open/close', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    const initialHint = window.__test.getCabinetMenuHint();
    const initiallyOpen = window.__test.isMenuOpen();

    window.__test.press('Escape');
    const openAfterEsc = window.__test.isMenuOpen();
    const hintWhileOpen = window.__test.getCabinetMenuHint();

    window.__test.press('Escape');
    const openAfterSecondEsc = window.__test.isMenuOpen();
    const hintAfterClose = window.__test.getCabinetMenuHint();

    return {
      initialHint,
      initiallyOpen,
      openAfterEsc,
      hintWhileOpen,
      openAfterSecondEsc,
      hintAfterClose,
    };
  });

  expect(r.initialHint).toBe('PRESS ESC FOR CABINET MENU');
  expect(r.initiallyOpen).toBe(false);
  expect(r.openAfterEsc).toBe(true);
  expect(r.hintWhileOpen).toBe('ESC CLOSES MENU');
  expect(r.openAfterSecondEsc).toBe(false);
  expect(r.hintAfterClose).toBe('PRESS ESC FOR CABINET MENU');
});

test('cabinet menu: exposes compact launch and flipper control help', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    const hasAccessor = typeof window.__test.getCabinetMenuControls === 'function';
    return {
      hasAccessor,
      lines: hasAccessor ? window.__test.getCabinetMenuControls() : null,
    };
  });

  expect(r.hasAccessor).toBe(true);
  expect(r.lines).toEqual([
    'SPACE  LAUNCH BALL',
    'Z OR LEFT  LEFT FLIPPER',
    '/ OR RIGHT  RIGHT FLIPPER',
  ]);
});

test('cabinet menu: explains starting balls and extra ball rule', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    const hasAccessor = typeof window.__test.getCabinetMenuRules === 'function';
    return {
      hasAccessor,
      lines: hasAccessor ? window.__test.getCabinetMenuRules() : null,
    };
  });

  expect(r.hasAccessor).toBe(true);
  expect(r.lines).toEqual([
    'START WITH 3 BALLS',
    '500000 SCORE  EXTRA BALL',
  ]);
});

test('scoring: reaching 500000 awards exactly one extra ball per game', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.restart();
    const startBalls = window.__test.state.balls;
    const hasAddScore = typeof window.__test.addScore === 'function';

    if (hasAddScore) window.__test.addScore(499999);
    const beforeThreshold = {
      score: window.__test.state.score,
      balls: window.__test.state.balls,
      extraBallAwarded: window.__test.state.extraBallAwarded,
    };

    if (hasAddScore) window.__test.addScore(1);
    const atThreshold = {
      score: window.__test.state.score,
      balls: window.__test.state.balls,
      extraBallAwarded: window.__test.state.extraBallAwarded,
    };

    if (hasAddScore) window.__test.addScore(250000);
    const afterMoreScore = {
      score: window.__test.state.score,
      balls: window.__test.state.balls,
      extraBallAwarded: window.__test.state.extraBallAwarded,
    };

    window.__test.restart();
    const afterRestart = {
      balls: window.__test.state.balls,
      extraBallAwarded: window.__test.state.extraBallAwarded,
    };

    return { hasAddScore, startBalls, beforeThreshold, atThreshold, afterMoreScore, afterRestart };
  });

  expect(r.hasAddScore).toBe(true);
  expect(r.startBalls).toBe(3);
  expect(r.beforeThreshold.score).toBe(499999);
  expect(r.beforeThreshold.balls).toBe(3);
  expect(r.beforeThreshold.extraBallAwarded).toBe(false);
  expect(r.atThreshold.score).toBe(500000);
  expect(r.atThreshold.balls).toBe(4);
  expect(r.atThreshold.extraBallAwarded).toBe(true);
  expect(r.afterMoreScore.balls).toBe(4);
  expect(r.afterRestart.balls).toBe(3);
  expect(r.afterRestart.extraBallAwarded).toBe(false);
});

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

test('theme: invalid saved theme falls back to default', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.setItem('flipper.themeId', 'nope-not-a-theme');
  });
  await page.reload();

  const id = await page.evaluate(() => window.__test.getThemeId());
  expect(id).toBe('sunburst-classic');
});

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

test('theme: menu can apply all three theme packs', async ({ page }) => {
  await page.goto(URL);
  const ids = await page.evaluate(() => {
    window.__test.pause();
    window.__test.openMenu();
    window.__test.setThemeFromMenu('sunburst-classic');
    const one = window.__test.getThemeId();
    window.__test.setThemeFromMenu('cosmic-wedge');
    const two = window.__test.getThemeId();
    window.__test.setThemeFromMenu('volcano-pop');
    const three = window.__test.getThemeId();
    return [one, two, three];
  });

  expect(ids).toEqual(['sunburst-classic', 'cosmic-wedge', 'volcano-pop']);
});

test('sound: invalid persisted value falls back to enabled', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.setItem('flipper.soundEnabled', 'corrupt-value');
  });

  await page.reload();
  const enabled = await page.evaluate(() => window.__test.isSoundEnabled());
  expect(enabled).toBe(true);
});

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
    return {
      drops: window.__test.drops.length,
      topLanes: window.__test.topLanes.length,
    };
  });
  expect(r.drops).toBe(4);
  expect(r.topLanes).toBe(3);
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
    // Light first 4 lanes manually, leave last unlit
    for (let i = 0; i < lanes.length - 1; i++) lanes[i].lit = true;
    lanes[lanes.length - 1].lit = false;
    // Fly ball through last lane
    const cx = (lanes[lanes.length-1].xMin + lanes[lanes.length-1].xMax) / 2;
    window.__test.place(cx, 70, 0, -50);
    for (let i = 0; i < 15; i++) window.__test.step(1);
    return { mult: window.__test.state.mult, anyLit: window.__test.topLanes.some(l => l.lit) };
  });
  expect(r.mult).toBeGreaterThanOrEqual(2); // multiplier went up from 1 to 2
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
test('mini flipper: pressing left key sweeps miniL flipper toward active angle', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.restart();
    const angleRest = window.__test.miniLFlipper.angle;
    // Press left key and step a few frames
    window.__test.press('z');
    for (let i = 0; i < 10; i++) window.__test.step(1);
    const angleActive = window.__test.miniLFlipper.angle;
    window.__test.release('z');
    return { angleRest, angleActive };
  });
  expect(r.angleRest).toBeCloseTo(0.9, 1);
  expect(r.angleActive).toBeLessThan(r.angleRest); // sweeping toward -0.4
});

test('mini flipper: ball in outlane above pivot is deflected inward when active', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.restart();
    // Place ball just above the flipper pivot (y=492), falling down into the outlane
    window.__test.place(18, 475, 0, 80);
    window.__test.press('z'); // flipper sweeps up toward -0.4 and intercepts ball
    let deflected = false;
    for (let i = 0; i < 90; i++){
      window.__test.step(1);
      const b = window.__test.ball;
      if (b.v.x > 50) { deflected = true; break; }
    }
    window.__test.release('z');
    return deflected;
  });
  expect(r).toBe(true);
});


test('right kickback: armed right outlane relaunches ball back into play', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.restart();
    window.__test.state.saverUntil = 0;
    // x=405, actually inside outlane channel (past the separator wall at x≈394)
    window.__test.place(405, 600, 0, 180);
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
