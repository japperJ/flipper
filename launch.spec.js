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
