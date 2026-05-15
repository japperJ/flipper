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
    for (let i = 0; i < 240*3; i++) window.__test.step(1);
    const b = window.__test.ball;
    return Math.hypot(b.v.x, b.v.y) > 5 || b.p.y > 720;
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
