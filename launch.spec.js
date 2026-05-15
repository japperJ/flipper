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
    window.__test.place(210, 100, 0, 0);
    window.__test._addTempFloor(60, 700, 360, 700);
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
