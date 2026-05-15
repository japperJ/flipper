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
