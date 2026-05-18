# Pinball Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Matter.js pinball in `index.html` with a from-scratch fixed-timestep custom-physics game (classic table features + retro neon visuals) that eliminates stuck-ball bugs by construction.

**Architecture:** Single `index.html` with one inline `<script type="module">` partitioned into 11 logical sections (CONFIG, MATH, PHYSICS, TABLE, FLIPPERS, PLUNGER, SCORING, INPUT, RENDER, LOOP, TEST HOOK). Custom swept-circle vs segment/arc physics at fixed 240 Hz with accumulator. Spatial hash broadphase. Playwright drives deterministic `window.__test.step(n)` for regression.

**Tech Stack:** Vanilla JS (ES module in `<script type="module">`), Canvas 2D, Web Audio API, Google Fonts (`Press Start 2P`), Playwright 1.54 for tests.

**Reference spec:** [docs/superpowers/specs/2026-05-15-pinball-redesign-design.md](../specs/2026-05-15-pinball-redesign-design.md)

---

## File Structure

- `index.html` — entire game (replaced wholesale). Sections, in order: HEAD/CSS, CANVAS, `<script type="module">` containing CONFIG → MATH → PHYSICS → TABLE → FLIPPERS → PLUNGER → SCORING → INPUT → RENDER → LOOP → TEST HOOK.
- `launch.spec.js` — Playwright tests (rewritten).
- `node_modules/` — keep Playwright, drop Matter.js usage (CDN tag removed).

---

## Conventions

- Coordinate system: `(0,0)` top-left, +x right, +y down. Canvas 420 × 720.
- All physics constants live in `CONFIG` (single source of truth).
- Tests use `window.__test` deterministic API; no `waitForTimeout` based on real time for physics assertions.
- After each task: run the task's tests; if green, commit with the message shown.

---

## Task 1: Scaffold new index.html + test hook + minimal loop

**Files:**
- Replace: `c:\REP\flipper\index.html`
- Modify: `c:\REP\flipper\launch.spec.js` (replace entirely)

- [ ] **Step 1: Back up the current index.html** so we can compare visuals later

```pwsh
Copy-Item c:\REP\flipper\index.html c:\REP\flipper\index.matterjs.bak.html
```

- [ ] **Step 2: Write the scaffold test in `launch.spec.js`** (replace file)

```js
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
```

- [ ] **Step 3: Run the test, confirm it fails** (file/hook not present yet)

Run: `npx playwright test launch.spec.js`
Expected: FAIL (either no canvas, or `__test` undefined).

- [ ] **Step 4: Replace `index.html` with scaffold** containing all 11 section comment headers and a minimal stub for each:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>NEON PINBALL</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;background:#0a0612;color:#fff;font-family:'Press Start 2P',monospace;display:flex;justify-content:center;align-items:center;min-height:100vh;}
  canvas{background:#0a0612;box-shadow:0 0 40px #5cf3,0 0 80px #f3a3;display:block;image-rendering:pixelated;}
</style>
</head>
<body>
<canvas id="c" width="420" height="720"></canvas>
<script type="module">
// ============ 1. CONFIG ============
const CONFIG = {
  W: 420, H: 720, BALL_R: 11,
  GRAVITY: 900, DRAG_PER_SEC: 0.9995,
  FIXED_DT: 1/240, MAX_SUBSTEPS: 4,
};

// ============ 2. MATH ============
const V = {
  add:(a,b)=>({x:a.x+b.x,y:a.y+b.y}),
  sub:(a,b)=>({x:a.x-b.x,y:a.y-b.y}),
  mul:(a,s)=>({x:a.x*s,y:a.y*s}),
  dot:(a,b)=>a.x*b.x+a.y*b.y,
  len:a=>Math.hypot(a.x,a.y),
  norm:a=>{const l=Math.hypot(a.x,a.y)||1;return{x:a.x/l,y:a.y/l};},
  reflect:(v,n)=>{const d=v.x*n.x+v.y*n.y;return{x:v.x-2*d*n.x,y:v.y-2*d*n.y};},
};
const clamp=(v,lo,hi)=>v<lo?lo:v>hi?hi:v;

// ============ 3. PHYSICS ============
const ball = { p:{x:400, y:680}, v:{x:0, y:0}, r: CONFIG.BALL_R };
function physicsStep(dt){ /* TODO Task 3 */ }

// ============ 4. TABLE ============
const walls = []; const arcs = []; const bumpers = []; const slings = []; const drops = [];
function buildTable(){ /* TODO Task 5 */ }

// ============ 5. FLIPPERS ============
const flippers = { L: null, R: null };
function buildFlippers(){ /* TODO Task 7 */ }

// ============ 6. PLUNGER ============
const plunger = { charge:0, charging:false };
function plungerStep(dt){ /* TODO Task 6 */ }

// ============ 7. SCORING ============
const state = { phase:'ready', score:0, hi:0, balls:3, mult:1, saverUntil:0, drops:[false,false,false], dropCycles:0, comboCount:0, comboUntil:0 };

// ============ 8. INPUT ============
const input = { L:false, R:false, plunge:false };
window.addEventListener('keydown', e=>{
  if (e.key==='z' || e.key==='Z' || e.key==='ArrowLeft') input.L = true;
  if (e.key==='/' || e.key==='ArrowRight') input.R = true;
  if (e.key===' ') input.plunge = true;
  if (e.key==='p' || e.key==='P') paused = !paused;
});
window.addEventListener('keyup', e=>{
  if (e.key==='z' || e.key==='Z' || e.key==='ArrowLeft') input.L = false;
  if (e.key==='/' || e.key==='ArrowRight') input.R = false;
  if (e.key===' ') input.plunge = false;
});

// ============ 9. RENDER ============
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
function render(){
  ctx.fillStyle = '#0a0612';
  ctx.fillRect(0,0,CONFIG.W,CONFIG.H);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(ball.p.x, ball.p.y, ball.r, 0, Math.PI*2); ctx.fill();
}

// ============ 10. LOOP ============
let paused = false;
let last = performance.now();
let acc = 0;
function frame(now){
  const dt = Math.min(0.1, (now - last)/1000);
  last = now;
  if (!paused){
    acc += dt;
    let steps = 0;
    while (acc >= CONFIG.FIXED_DT && steps < CONFIG.MAX_SUBSTEPS){
      physicsStep(CONFIG.FIXED_DT);
      acc -= CONFIG.FIXED_DT;
      steps++;
    }
    if (acc > CONFIG.MAX_SUBSTEPS * CONFIG.FIXED_DT) acc = 0;
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ============ 11. TEST HOOK ============
window.__test = {
  get ball(){ return ball; },
  get state(){ return state; },
  CONFIG,
  step(n=1){ for(let i=0;i<n;i++) physicsStep(CONFIG.FIXED_DT); render(); },
  pause(){ paused = true; },
  resume(){ paused = false; },
  place(x,y,vx=0,vy=0){ ball.p={x,y}; ball.v={x:vx,y:vy}; },
  press(key){ const e = new KeyboardEvent('keydown',{key}); window.dispatchEvent(e); },
  release(key){ const e = new KeyboardEvent('keyup',{key}); window.dispatchEvent(e); },
};
</script>
</body>
</html>
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `npx playwright test launch.spec.js`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```pwsh
git add index.html launch.spec.js index.matterjs.bak.html
git commit -m "feat(pinball): scaffold new game shell with __test hook"
```

---

## Task 2: MATH module — segment / arc primitives + swept-circle TOI

**Files:**
- Modify: `c:\REP\flipper\index.html` (section 2 MATH)
- Modify: `c:\REP\flipper\launch.spec.js` (append test)

- [ ] **Step 1: Append test for swept-circle vs segment**

```js
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
```

- [ ] **Step 2: Run, confirm it fails** (function not exposed)

Run: `npx playwright test launch.spec.js -g "math: sweep"`
Expected: FAIL.

- [ ] **Step 3: Implement segment + arc TOI helpers** — append to section 2:

```js
// Swept circle (center p0, displacement d=v*dt, radius r) vs static segment [a,b].
// Returns { toi in [0,1], normal } or null. Normal points from segment toward circle.
function sweepCircleSegment(p0, d, r, a, b){
  const sx = b.x-a.x, sy = b.y-a.y;
  const segLen2 = sx*sx + sy*sy;
  if (segLen2 < 1e-6) return null;
  // Segment normal (left-hand)
  let nx = -sy, ny = sx;
  const nl = Math.hypot(nx,ny); nx/=nl; ny/=nl;
  // Ensure normal points toward the moving circle's start
  const side = (p0.x-a.x)*nx + (p0.y-a.y)*ny;
  if (side < 0){ nx=-nx; ny=-ny; }
  // Distance from start center to infinite line along normal
  const dist0 = (p0.x-a.x)*nx + (p0.y-a.y)*ny; // >= 0
  const vN = d.x*nx + d.y*ny; // signed motion along normal (negative = approaching)
  if (vN >= 0) return null;
  const toi = (dist0 - r) / (-vN);
  if (toi < 0 || toi > 1) return null;
  // Contact point along segment axis
  const cx = p0.x + d.x*toi, cy = p0.y + d.y*toi;
  const t = ((cx-a.x)*sx + (cy-a.y)*sy) / segLen2;
  if (t < 0 || t > 1){
    // Check endpoints (circle vs point)
    return sweepCircleEnd(p0,d,r,a) ?? sweepCircleEnd(p0,d,r,b);
  }
  return { toi, normal:{x:nx,y:ny} };
}

function sweepCircleEnd(p0, d, r, q){
  // Circle of radius r centered at p0+d*t collides with point q
  const fx = p0.x - q.x, fy = p0.y - q.y;
  const A = d.x*d.x + d.y*d.y;
  const B = 2*(fx*d.x + fy*d.y);
  const C = fx*fx + fy*fy - r*r;
  if (A < 1e-9) return null;
  const disc = B*B - 4*A*C;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2*A);
  if (t < 0 || t > 1) return null;
  const cx = p0.x + d.x*t, cy = p0.y + d.y*t;
  let nx = cx - q.x, ny = cy - q.y;
  const nl = Math.hypot(nx,ny)||1; nx/=nl; ny/=nl;
  return { toi:t, normal:{x:nx,y:ny} };
}

function sweepCircleArc(p0, d, r, c, R, a0, a1, outward=true){
  // Outward arc (ball outside circle of radius R-r at center c). Treat as circle vs circle.
  // (For our table we only need outward arcs — concave bumpers.)
  const target = outward ? (R + r) : (R - r);
  const fx = p0.x - c.x, fy = p0.y - c.y;
  const A = d.x*d.x + d.y*d.y;
  const B = 2*(fx*d.x + fy*d.y);
  const C = fx*fx + fy*fy - target*target;
  if (A < 1e-9) return null;
  const disc = B*B - 4*A*C;
  if (disc < 0) return null;
  const t = outward
    ? (-B - Math.sqrt(disc)) / (2*A)
    : (-B + Math.sqrt(disc)) / (2*A);
  if (t < 0 || t > 1) return null;
  const cx = p0.x + d.x*t, cy = p0.y + d.y*t;
  const ang = Math.atan2(cy - c.y, cx - c.x);
  // Normalize a0,a1,ang to [0,2pi); arc covers a0 -> a1 CCW
  const norm = a => { a = a % (2*Math.PI); return a < 0 ? a + 2*Math.PI : a; };
  const A0 = norm(a0), A1 = norm(a1), AN = norm(ang);
  const inArc = A0 <= A1 ? (AN >= A0 && AN <= A1) : (AN >= A0 || AN <= A1);
  if (!inArc) return null;
  let nx = (cx - c.x), ny = (cy - c.y);
  const nl = Math.hypot(nx,ny)||1; nx/=nl; ny/=nl;
  if (!outward){ nx=-nx; ny=-ny; }
  return { toi:t, normal:{x:nx,y:ny} };
}

// Expose to tests
window.__test = window.__test || {};
window.__test._math = { sweepCircleSegment, sweepCircleEnd, sweepCircleArc };
```

(Note: the `window.__test = window.__test || {}` line should be removed once the final `window.__test` object in section 11 is updated to include `_math` — see Step 4.)

- [ ] **Step 4: Update section 11 `window.__test`** to include `_math: { sweepCircleSegment, sweepCircleEnd, sweepCircleArc }`. Remove any temporary assignment.

- [ ] **Step 5: Run all tests, confirm green**

Run: `npx playwright test launch.spec.js`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```pwsh
git add index.html launch.spec.js
git commit -m "feat(pinball): add swept-circle vs segment/arc TOI primitives"
```

---

## Task 3: PHYSICS — ball integrator with gravity + floor segment collision

**Files:**
- Modify: `c:\REP\flipper\index.html` (section 3 PHYSICS)
- Modify: `c:\REP\flipper\launch.spec.js` (append test)

- [ ] **Step 1: Append test — gravity + floor bounce**

```js
test('physics: ball falls under gravity and bounces off floor', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.place(210, 100, 0, 0);
    // Add a temporary floor segment
    window.__test._addTempFloor(60, 700, 360, 700);
    const before = { ...window.__test.ball.p };
    for (let i = 0; i < 240; i++) window.__test.step(1);   // ~1s
    const after = { ...window.__test.ball.p, vy: window.__test.ball.v.y };
    return { before, after };
  });
  expect(r.after.y).toBeGreaterThan(r.before.y);   // moved down
  expect(r.after.y).toBeLessThan(700);             // not through floor
  expect(r.after.vy).toBeLessThanOrEqual(0);       // bounced (going up or stationary)
});
```

- [ ] **Step 2: Run, confirm it fails**

Run: `npx playwright test launch.spec.js -g "gravity"`
Expected: FAIL.

- [ ] **Step 3: Implement `physicsStep`** — replace stub in section 3:

```js
const segments = []; // { a, b, restitution, friction, kind }
function addSegment(a, b, opts={}){
  segments.push({ a, b, restitution: opts.restitution ?? 0.55, friction: opts.friction ?? 0.02, kind: opts.kind ?? 'wall' });
}

function physicsStep(dt){
  // Integrate forces
  ball.v.y += CONFIG.GRAVITY * dt;
  const drag = Math.pow(CONFIG.DRAG_PER_SEC, dt * 240);
  ball.v.x *= drag; ball.v.y *= drag;

  let remaining = 1.0;
  for (let iter = 0; iter < 6 && remaining > 1e-4; iter++){
    const d = { x: ball.v.x * dt * remaining, y: ball.v.y * dt * remaining };
    let best = null;
    for (const s of segments){
      const hit = sweepCircleSegment(ball.p, d, ball.r, s.a, s.b);
      if (hit && (!best || hit.toi < best.toi)){ best = hit; best.surface = s; }
    }
    // (Arcs & bumpers added in later tasks)
    if (!best){
      ball.p.x += d.x; ball.p.y += d.y;
      remaining = 0;
      break;
    }
    // Advance to just-before contact
    const eps = 1e-3;
    ball.p.x += d.x * Math.max(0, best.toi - eps);
    ball.p.y += d.y * Math.max(0, best.toi - eps);
    // Reflect velocity
    const e = best.surface.restitution;
    const vn = ball.v.x * best.normal.x + ball.v.y * best.normal.y;
    ball.v.x -= (1 + e) * vn * best.normal.x;
    ball.v.y -= (1 + e) * vn * best.normal.y;
    // Push out 0.01 along normal
    ball.p.x += best.normal.x * 0.01;
    ball.p.y += best.normal.y * 0.01;
    remaining *= (1 - best.toi);
  }
}
```

- [ ] **Step 4: Add `_addTempFloor` to `window.__test`** (section 11) for the test scaffolding:

```js
_addTempFloor(x1,y1,x2,y2){ addSegment({x:x1,y:y1},{x:x2,y:y2}); },
```

- [ ] **Step 5: Run, confirm tests pass**

Run: `npx playwright test launch.spec.js`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```pwsh
git add index.html launch.spec.js
git commit -m "feat(pinball): integrator + segment collision response"
```

---

## Task 4: TABLE — static walls (outer perimeter + shooter lane gate)

**Files:**
- Modify: `c:\REP\flipper\index.html` (section 4 TABLE)
- Modify: `c:\REP\flipper\launch.spec.js` (append test)

- [ ] **Step 1: Append test — ball remains inside table after random drop**

```js
test('table: ball stays inside outer walls', async ({ page }) => {
  await page.goto(URL);
  const oob = await page.evaluate(() => {
    window.__test.pause();
    window.__test.place(210, 100, 50, 50);
    let outside = false;
    for (let i = 0; i < 240*6; i++){
      window.__test.step(1);
      const b = window.__test.ball;
      // Ignore drain region (between flippers at bottom)
      if (b.p.y > 720) continue;
      if (b.p.x < 0 || b.p.x > 420 || b.p.y < 0) { outside = true; break; }
    }
    return outside;
  });
  expect(oob).toBe(false);
});
```

- [ ] **Step 2: Run, confirm it fails** (no walls built yet — ball flies off).

- [ ] **Step 3: Implement `buildTable()`** — outer perimeter + shooter lane. Replace stub in section 4:

```js
const SHOOTER_X = 380;            // inner edge of shooter lane
const SHOOTER_GATE_Y = 80;        // one-way gate
const DRAIN_LEFT = 175, DRAIN_RIGHT = 245;

function buildTable(){
  // Outer perimeter — top, left, right (drain in the middle of the bottom)
  addSegment({x:0,   y:24},  {x:CONFIG.W, y:24});                              // top
  addSegment({x:0,   y:24},  {x:0,        y:CONFIG.H});                        // left
  addSegment({x:CONFIG.W, y:24}, {x:CONFIG.W, y:CONFIG.H});                    // right
  addSegment({x:0,         y:CONFIG.H}, {x:DRAIN_LEFT, y:CONFIG.H});           // floor-left
  addSegment({x:DRAIN_RIGHT, y:CONFIG.H}, {x:CONFIG.W, y:CONFIG.H});           // floor-right
  // Shooter lane separator (left wall of the shooter lane)
  addSegment({x:SHOOTER_X, y:24},               {x:SHOOTER_X, y:CONFIG.H-40}); // long divider
  // Shooter gate (one-way): see Task 6 — implemented as a segment that's removed once ball passes
}

buildTable();
```

- [ ] **Step 4: Update HUD strip in `render`** so the visible playfield matches `y ≥ 24`:

```js
// In render(), at end:
ctx.fillStyle = '#5cf';
ctx.font = "10px 'Press Start 2P', monospace";
ctx.fillText('NEON PINBALL', 8, 16);
```

- [ ] **Step 5: Run tests**

Run: `npx playwright test launch.spec.js`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```pwsh
git add index.html launch.spec.js
git commit -m "feat(pinball): outer table walls + shooter lane divider"
```

---

## Task 5: ARCS + CORNERS — curved ceiling, rounded outlane returns

**Files:**
- Modify: `c:\REP\flipper\index.html` (sections 3, 4)
- Modify: `c:\REP\flipper\launch.spec.js` (append test)

- [ ] **Step 1: Append test — outlanes don't trap a ball**

```js
test('outlanes: ball entering left outlane returns toward inlane', async ({ page }) => {
  await page.goto(URL);
  const ok = await page.evaluate(() => {
    window.__test.pause();
    window.__test.place(110, 600, 0, 200);   // dropped into left outlane
    for (let i = 0; i < 240*3; i++) window.__test.step(1);
    const b = window.__test.ball;
    // Should NOT be stuck — speed > 5 OR exited drain
    return Math.hypot(b.v.x, b.v.y) > 5 || b.p.y > 720;
  });
  expect(ok).toBe(true);
});
```

- [ ] **Step 2: Add `arcs[]` collection + arc handling in `physicsStep`**

In section 3 (just after `segments` array), add:

```js
const arcs = []; // { c, R, a0, a1, outward, restitution }
function addArc(c, R, a0, a1, opts={}){
  arcs.push({ c, R, a0, a1, outward: opts.outward ?? false, restitution: opts.restitution ?? 0.55 });
}
```

Then in `physicsStep`, after the segment loop and before the `if (!best)` check, also iterate arcs:

```js
for (const a of arcs){
  const hit = sweepCircleArc(ball.p, d, ball.r, a.c, a.R, a.a0, a.a1, a.outward);
  if (hit && (!best || hit.toi < best.toi)){ best = hit; best.surface = a; }
}
```

- [ ] **Step 3: Add outlane geometry in `buildTable()`** — rounded curves so ball returns toward inlane instead of draining at the wall:

```js
// Left outlane return: arc centered at (135, 700) radius 45, from angle pi to 1.5pi (top-left quadrant)
addArc({x:135, y:700}, 45, Math.PI, 1.5*Math.PI, { outward:false, restitution:0.4 });
// Right outlane return
addArc({x:285, y:700}, 45, 1.5*Math.PI, 2*Math.PI, { outward:false, restitution:0.4 });
// Curved ceiling
addArc({x:CONFIG.W/2, y:24}, 240, Math.PI, 2*Math.PI, { outward:false, restitution:0.6 });
```

- [ ] **Step 4: Run all tests**

Run: `npx playwright test launch.spec.js`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```pwsh
git add index.html launch.spec.js
git commit -m "feat(pinball): arc collision + curved outlane returns"
```

---

## Task 6: PLUNGER — charge & release into shooter lane

**Files:**
- Modify: `c:\REP\flipper\index.html` (sections 6 PLUNGER, 8 INPUT, 11 TEST HOOK)
- Modify: `c:\REP\flipper\launch.spec.js`

- [ ] **Step 1: Append test — plunger launches ball into playfield**

```js
test('plunger: hold + release moves ball up past the gate', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => {
    window.__test.pause();
    window.__test.place(400, 680, 0, 0);
    window.__test.plungerCharge(1.0); // full charge
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
```

- [ ] **Step 2: Run, confirm fail**.

- [ ] **Step 3: Implement plunger** — replace section 6 stub:

```js
const plunger = { charge:0, charging:false, maxImpulse: 1100, chargeRate: 1.0 };
function plungerCharge(dt){ plunger.charge = clamp(plunger.charge + plunger.chargeRate*dt, 0, 1); }
function plungerRelease(){
  if (ball.p.x > SHOOTER_X && ball.p.y > 600){
    ball.v.y = -plunger.charge * plunger.maxImpulse;
    state.saverUntil = performance.now()/1000 + 5;
  }
  plunger.charge = 0;
}
function plungerStep(dt){
  if (input.plunge) plungerCharge(dt);
  else if (plunger.charge > 0) plungerRelease();
}
```

- [ ] **Step 4: Wire `plungerStep` into the main loop** — in section 10 `frame()`, after the substep loop but before `render()`:

```js
plungerStep(CONFIG.FIXED_DT * /* steps run this frame */ 1);
```

Simpler: call `plungerStep(dt)` (the rAF dt) once per frame. Update accordingly.

- [ ] **Step 5: Expose to test hook (section 11)**

```js
plungerCharge(amount){ plunger.charge = clamp(amount, 0, 1); },
plungerRelease(){ plungerRelease(); },
```

- [ ] **Step 6: Add the one-way gate** — when the ball is in the shooter lane (x > SHOOTER_X) and moving up past `y = 80`, allow it through. We model this as: the top portion of the shooter divider (from y=24 to y=80) is solid only when ball is on the playfield side. Easiest implementation: split the divider into two segments and toggle a `enabled` flag:

```js
// In buildTable(), replace the single divider with two:
const gateSeg = { a:{x:SHOOTER_X,y:24}, b:{x:SHOOTER_X,y:80}, restitution:0.55, friction:0.02, kind:'gate', enabled:true };
segments.push(gateSeg);
addSegment({x:SHOOTER_X, y:80}, {x:SHOOTER_X, y:CONFIG.H-40});  // permanent below-gate
// In physicsStep, when iterating segments, skip those with enabled === false.
// Update each step: gateSeg.enabled = !(ball.p.x > SHOOTER_X);
```

Insert at the top of `physicsStep`:
```js
gateSeg.enabled = !(ball.p.x > SHOOTER_X && ball.v.y < 0);
```

Modify segment loop to `if (s.enabled === false) continue;`.

- [ ] **Step 7: Run all tests**

Run: `npx playwright test launch.spec.js`
Expected: 6 passed.

- [ ] **Step 8: Commit**

```pwsh
git add index.html launch.spec.js
git commit -m "feat(pinball): plunger with one-way shooter gate"
```

---

## Task 7: FLIPPERS — kinematic capsules with surface-velocity transfer

**Files:**
- Modify: `c:\REP\flipper\index.html` (sections 5 FLIPPERS, 3 PHYSICS, 11 TEST HOOK)
- Modify: `c:\REP\flipper\launch.spec.js`

- [ ] **Step 1: Append test — flipper kicks the ball upward**

```js
test('flipper: left flipper activation kicks ball upward', async ({ page }) => {
  await page.goto(URL);
  const vy = await page.evaluate(() => {
    window.__test.pause();
    window.__test.place(155, 600, 0, 0);     // just above resting left flipper
    window.__test.press('z');
    for (let i = 0; i < 30; i++) window.__test.step(1);  // ~0.125s
    window.__test.release('z');
    return window.__test.ball.v.y;
  });
  expect(vy).toBeLessThan(-200);
});
```

- [ ] **Step 2: Run, confirm fail**.

- [ ] **Step 3: Implement flipper kinematics** — replace section 5:

```js
function makeFlipper(pivot, side){
  // side: 'L' or 'R'. Rest angle points slightly down-outward; up angle points up-inward.
  const restAngle = side==='L' ? 0.45 : Math.PI - 0.45;   // radians, CCW from +x
  const upAngle   = side==='L' ? -0.45 : Math.PI + 0.45;
  return {
    pivot, side, length: 62, tipR: 7, baseR: 11,
    angle: restAngle, angleRest: restAngle, angleUp: upAngle,
    angVel: 0, state: 'rest',
    RISE: side==='L' ? -18 : 18,        // CCW positive; left rises CCW (angle decreases? recompute)
    FALL: side==='L' ? 10 : -10,
    pressed: false,
  };
}

flippers.L = makeFlipper({x:135, y:620}, 'L');
flippers.R = makeFlipper({x:285, y:620}, 'R');

function flipperTip(f){
  return { x: f.pivot.x + Math.cos(f.angle)*f.length, y: f.pivot.y + Math.sin(f.angle)*f.length };
}

function flipperStep(dt){
  for (const f of [flippers.L, flippers.R]){
    const target = f.pressed ? f.angleUp : f.angleRest;
    const dir = target - f.angle;
    const speed = f.pressed ? Math.abs(f.RISE) : Math.abs(f.FALL);
    const step = Math.sign(dir) * Math.min(Math.abs(dir), speed * dt);
    f.angVel = step / dt;
    f.angle += step;
  }
}

function flipperCollide(f, p0, d, r){
  // Capsule = segment (pivot..tip) with end radius. Use sweepCircleSegment, then end caps.
  const tip = flipperTip(f);
  const seg = sweepCircleSegment(p0, d, r + f.tipR, f.pivot, tip);
  const ca = sweepCircleEnd(p0, d, r + f.baseR, f.pivot);
  const cb = sweepCircleEnd(p0, d, r + f.tipR, tip);
  let best = null;
  for (const h of [seg, ca, cb]) if (h && (!best || h.toi < best.toi)) best = h;
  if (!best) return null;
  return { ...best, flipper: f };
}
```

- [ ] **Step 4: Integrate flipper collisions into `physicsStep`** — after segments + arcs, before the resolution branch:

```js
for (const f of [flippers.L, flippers.R]){
  const hit = flipperCollide(f, ball.p, d, ball.r);
  if (hit && (!best || hit.toi < best.toi)) best = { ...hit, surface: { kind:'flipper', restitution: 0.2 } };
}
```

After advancing to `toi - eps`, **before** the standard reflection branch, special-case flipper response:

```js
if (best.flipper){
  const f = best.flipper;
  const cp = { x: ball.p.x, y: ball.p.y };
  const arm = { x: cp.x - f.pivot.x, y: cp.y - f.pivot.y };
  const vSurf = { x: -arm.y * f.angVel, y: arm.x * f.angVel };
  const vRel = { x: ball.v.x - vSurf.x, y: ball.v.y - vSurf.y };
  const dn = vRel.x*best.normal.x + vRel.y*best.normal.y;
  const e = 1.05;
  const rx = vRel.x - (1+e)*dn*best.normal.x;
  const ry = vRel.y - (1+e)*dn*best.normal.y;
  ball.v.x = vSurf.x + rx;
  ball.v.y = vSurf.y + ry;
  ball.p.x += best.normal.x * 0.01;
  ball.p.y += best.normal.y * 0.01;
  remaining *= (1 - best.toi);
  continue;
}
```

- [ ] **Step 5: Bind input → flipper.pressed** — at top of `physicsStep`:

```js
flippers.L.pressed = input.L;
flippers.R.pressed = input.R;
flipperStep(dt);
```

- [ ] **Step 6: Draw flippers in `render`**

```js
for (const f of [flippers.L, flippers.R]){
  const tip = flipperTip(f);
  ctx.strokeStyle = '#fd5';
  ctx.lineCap = 'round';
  ctx.lineWidth = 14;
  ctx.beginPath(); ctx.moveTo(f.pivot.x,f.pivot.y); ctx.lineTo(tip.x,tip.y); ctx.stroke();
}
```

- [ ] **Step 7: Run all tests**

Run: `npx playwright test launch.spec.js`
Expected: 7 passed.

- [ ] **Step 8: Commit**

```pwsh
git add index.html launch.spec.js
git commit -m "feat(pinball): kinematic flippers with surface-velocity reflection"
```

---

## Task 8: BUMPERS + SLINGSHOTS

**Files:**
- Modify: `c:\REP\flipper\index.html` (sections 3, 4, 7, 9)
- Modify: `c:\REP\flipper\launch.spec.js`

- [ ] **Step 1: Append two tests**

```js
test('bumper: imparts at least 520 px/s on contact', async ({ page }) => {
  await page.goto(URL);
  const result = await page.evaluate(() => {
    const speeds = [];
    for (const pos of [{x:140,y:138},{x:280,y:138},{x:210,y:183}]){  // just above each bumper
      window.__test.pause();
      window.__test.place(pos.x, pos.y, 0, 100);
      for (let i = 0; i < 60; i++) window.__test.step(1);
      speeds.push(Math.hypot(window.__test.ball.v.x, window.__test.ball.v.y));
    }
    return speeds;
  });
  for (const s of result) expect(s).toBeGreaterThanOrEqual(520);
});

test('slingshot: outgoing speed > incoming speed', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    // Fire ball at left slingshot active edge
    window.__test.place(140, 500, 200, 0);
    const vIn = Math.hypot(200, 0);
    for (let i = 0; i < 60; i++) window.__test.step(1);
    const vOut = Math.hypot(window.__test.ball.v.x, window.__test.ball.v.y);
    return { vIn, vOut };
  });
  expect(r.vOut).toBeGreaterThan(r.vIn);
});
```

- [ ] **Step 2: Run, confirm fail**.

- [ ] **Step 3: Bumpers** — add to section 4 `buildTable`:

```js
const bumperDefs = [
  { c:{x:140,y:150}, r:20, color:'#5cf' },
  { c:{x:280,y:150}, r:20, color:'#5cf' },
  { c:{x:210,y:195}, r:20, color:'#f3a' },
];
for (const b of bumperDefs) bumpers.push({ ...b, lastHit: 0 });
```

In section 3, add bumper collision (treat as outward arc, full circle):

```js
for (const b of bumpers){
  const hit = sweepCircleArc(ball.p, d, ball.r, b.c, b.r, 0, 2*Math.PI, true);
  if (hit && (!best || hit.toi < best.toi)) best = { ...hit, bumper: b };
}
```

Bumper response branch (before standard reflection):
```js
if (best.bumper){
  const n = best.normal;
  const speed = Math.max(520, Math.hypot(ball.v.x, ball.v.y)) + 80;
  ball.v.x = n.x * speed;
  ball.v.y = n.y * speed;
  ball.p.x += n.x * 0.01; ball.p.y += n.y * 0.01;
  state.score += 100 * state.mult;
  remaining *= (1 - best.toi);
  continue;
}
```

- [ ] **Step 4: Slingshots** — add to `buildTable`:

```js
// Left slingshot triangle: tip at (90,540), base (90,490)-(150,540)
const slingL = [
  {a:{x:90,y:540},b:{x:90,y:490}, kind:'wall'},
  {a:{x:90,y:490},b:{x:150,y:540}, kind:'sling', active:true},   // active hypotenuse
  {a:{x:150,y:540},b:{x:90,y:540}, kind:'wall'},
];
for (const s of slingL) addSegment(s.a, s.b, { restitution: s.kind==='sling'? 1.0 : 0.55, kind:s.kind });
// Right slingshot mirrored
const slingR = [
  {a:{x:330,y:540},b:{x:330,y:490}, kind:'wall'},
  {a:{x:330,y:490},b:{x:270,y:540}, kind:'sling', active:true},
  {a:{x:270,y:540},b:{x:330,y:540}, kind:'wall'},
];
for (const s of slingR) addSegment(s.a, s.b, { restitution: s.kind==='sling'? 1.0 : 0.55, kind:s.kind });
```

In `physicsStep`, when reflecting off a segment with `kind==='sling'`, after computing new `v` apply speed boost:

```js
if (best.surface.kind === 'sling'){
  const s = Math.min(900, Math.hypot(ball.v.x, ball.v.y) * 1.8);
  const dir = V.norm(ball.v);
  ball.v.x = dir.x * s; ball.v.y = dir.y * s;
  state.score += 50 * state.mult;
}
```

- [ ] **Step 5: Render bumpers** — in render after walls:

```js
for (const b of bumpers){
  ctx.shadowBlur = 18; ctx.shadowColor = b.color;
  ctx.strokeStyle = b.color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(b.c.x, b.c.y, b.r, 0, Math.PI*2); ctx.stroke();
  ctx.shadowBlur = 0;
}
```

- [ ] **Step 6: Run all tests**

Expected: 9 passed.

- [ ] **Step 7: Commit**

```pwsh
git add index.html launch.spec.js
git commit -m "feat(pinball): bumpers + slingshots with speed boost"
```

---

## Task 9: SCORING — drop targets, ball saver, drain handling, balls/game-over

**Files:**
- Modify: `c:\REP\flipper\index.html` (sections 4, 3, 7)
- Modify: `c:\REP\flipper\launch.spec.js`

- [ ] **Step 1: Append tests**

```js
test('drop targets: each scores 500, clearing all gives 5000 + mult++', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    const xs = [120, 210, 300];
    for (const x of xs){
      window.__test.place(x, 60, 0, 400);
      for (let i = 0; i < 120; i++) window.__test.step(1);
    }
    return { score: window.__test.state.score, mult: window.__test.state.mult };
  });
  expect(r.score).toBeGreaterThanOrEqual(500*3 + 5000);
  expect(r.mult).toBeGreaterThanOrEqual(2);
});

test('ball saver: drain within grace period respawns ball without losing one', async ({ page }) => {
  await page.goto(URL);
  const r = await page.evaluate(() => {
    window.__test.pause();
    window.__test.state.balls = 3;
    window.__test.state.saverUntil = performance.now()/1000 + 5;
    window.__test.place(210, 715, 0, 200);   // through the drain
    for (let i = 0; i < 30; i++) window.__test.step(1);
    return { balls: window.__test.state.balls };
  });
  expect(r.balls).toBe(3);
});
```

- [ ] **Step 2: Run, confirm fail**.

- [ ] **Step 3: Drop targets** — in `buildTable`:

```js
const dropDefs = [
  { x: 100, y: 95, w: 40, h: 8, active: true },
  { x: 190, y: 95, w: 40, h: 8, active: true },
  { x: 280, y: 95, w: 40, h: 8, active: true },
];
for (const d of dropDefs) drops.push(d);
```

For collision, each active drop adds a top + side segments to `segments` each step (dynamic). Simpler: add one top segment per drop tagged with `kind:'drop', drop:d`. On hit, set `d.active = false`. In segment iteration, skip if `s.drop && !s.drop.active`.

```js
for (const d of drops){
  segments.push({ a:{x:d.x,y:d.y}, b:{x:d.x+d.w,y:d.y}, restitution:0.4, kind:'drop', drop:d });
}
```

In response, when hitting a drop:
```js
if (best.surface.kind === 'drop'){
  best.surface.drop.active = false;
  state.score += 500;
  if (drops.every(x => !x.active)){
    state.score += 5000;
    state.mult = Math.min(5, state.mult + 1);
    for (const x of drops) x.active = true;
  }
  // continue with normal reflection (already applied above) — or just keep ball going
}
```

When iterating segments to find `best`, add `if (s.drop && !s.drop.active) continue;`.

- [ ] **Step 4: Drain handling** — at end of `physicsStep`:

```js
if (ball.p.y > 720){
  const now = performance.now()/1000;
  if (now < state.saverUntil){
    ball.p = { x: 400, y: 680 }; ball.v = { x: 0, y: 0 };
  } else {
    state.balls -= 1;
    if (state.balls <= 0){ state.phase = 'gameover'; }
    else { ball.p = { x: 400, y: 680 }; ball.v = { x: 0, y: 0 }; state.saverUntil = performance.now()/1000 + 5; }
  }
}
```

- [ ] **Step 5: Render HUD with score / balls / mult**

```js
ctx.fillStyle = '#5cf';
ctx.fillText('SCORE ' + state.score, 8, 16);
ctx.fillStyle = '#fd5';
for (let i=0;i<state.balls;i++){ ctx.beginPath(); ctx.arc(CONFIG.W-12-i*14, 16, 4, 0, Math.PI*2); ctx.fill(); }
ctx.fillStyle = '#f3a';
ctx.fillText('x' + state.mult, 8, 30);
```

- [ ] **Step 6: Run all tests**

Expected: 11 passed.

- [ ] **Step 7: Commit**

```pwsh
git add index.html launch.spec.js
git commit -m "feat(pinball): drop targets + ball saver + drain + HUD"
```

---

## Task 10: Anti-stuck watchdog + fuzz test

**Files:**
- Modify: `c:\REP\flipper\index.html` (section 3 PHYSICS)
- Modify: `c:\REP\flipper\launch.spec.js`

- [ ] **Step 1: Append the fuzz test**

```js
test('stuck-ball fuzz: 12 random launches never stationary > 250 ms', async ({ page }) => {
  await page.goto(URL);
  const violations = await page.evaluate(() => {
    const seeds = [
      [110, 90,  60,  100], [210, 80,  -40, 90], [310, 100, 70, 80],
      [90,  300, 200, 80],  [340, 280, -180, 90], [210, 250, 0, 200],
      [120, 450, 150, 100], [320, 460, -160, 80], [200, 500, 0, 300],
      [60,  150, 240, 200], [380, 200, -240, 100], [210, 600, 100, -200],
    ];
    const fails = [];
    for (const [x,y,vx,vy] of seeds){
      window.__test.pause();
      window.__test.state.balls = 99;        // disable game-over
      window.__test.state.saverUntil = 1e9;  // disable drain consequence
      window.__test.place(x,y,vx,vy);
      let slow = 0, maxSlow = 0;
      for (let i = 0; i < 240*4; i++){
        window.__test.step(1);
        const s = Math.hypot(window.__test.ball.v.x, window.__test.ball.v.y);
        if (s < 30) slow++; else slow = 0;
        if (slow > maxSlow) maxSlow = slow;
      }
      if (maxSlow > 60) fails.push({seed:[x,y,vx,vy], maxSlow});
    }
    return fails;
  });
  expect(violations).toEqual([]);
});
```

(60 steps at 240 Hz = 250 ms.)

- [ ] **Step 2: Run.** If it passes already, skip implementation. If not, add the watchdog.

- [ ] **Step 3: Watchdog** — in section 3 add a low-speed counter at module scope:

```js
let stuckFrames = 0;
```

At the end of `physicsStep` (after drain handling), before returning:

```js
const speed = Math.hypot(ball.v.x, ball.v.y);
if (speed < 30 && state.phase !== 'attract') stuckFrames++;
else stuckFrames = 0;
if (stuckFrames > 60){
  ball.v.x = (Math.random()-0.5) * 120;
  ball.v.y = -100;
  stuckFrames = 0;
  console.warn('anti-stuck nudge applied at', ball.p);
}
```

- [ ] **Step 4: Run all tests**

Expected: 12 passed.

- [ ] **Step 5: Commit**

```pwsh
git add index.html launch.spec.js
git commit -m "feat(pinball): anti-stuck watchdog + 12-seed fuzz test"
```

---

## Task 11: VISUALS pass — neon glow, trail, particles, ball gradient

**Files:**
- Modify: `c:\REP\flipper\index.html` (section 9 RENDER)

(No automated test — visual; verify by opening the page.)

- [ ] **Step 1: Replace `render()` with two-pass renderer**:

```js
const trail = [];
const particles = [];

function spawnParticles(p, color, n=12){
  for (let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, s = 60+Math.random()*120;
    particles.push({ p:{...p}, v:{x:Math.cos(a)*s,y:Math.sin(a)*s}, life:0.35, color });
  }
}

function strokeLine(a,b,color,glow){
  ctx.strokeStyle = color;
  if (glow){ ctx.shadowBlur = 18; ctx.shadowColor = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 8; }
  else { ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.lineWidth = 2; }
  ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
}

function strokeArc(a,color,glow){
  ctx.strokeStyle = color;
  if (glow){ ctx.shadowBlur = 18; ctx.shadowColor = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 8; }
  else { ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.lineWidth = 2; }
  ctx.beginPath(); ctx.arc(a.c.x, a.c.y, a.R, a.a0, a.a1); ctx.stroke();
}

function render(){
  ctx.fillStyle = '#0a0612';
  ctx.fillRect(0,0,CONFIG.W,CONFIG.H);
  const color = s => s.kind==='sling' ? '#f3a' : s.kind==='drop' ? '#fd5' : '#5cf';
  for (const pass of [true,false]){
    for (const s of segments){ if (s.drop && !s.drop.active) continue; strokeLine(s.a, s.b, color(s), pass); }
    for (const a of arcs) strokeArc(a, '#5cf', pass);
  }
  // Bumpers
  for (const b of bumpers){
    ctx.shadowBlur = 18; ctx.shadowColor = b.color; ctx.globalAlpha = 0.5;
    ctx.strokeStyle = b.color; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(b.c.x, b.c.y, b.r, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.c.x, b.c.y, b.r, 0, Math.PI*2); ctx.stroke();
  }
  // Flippers
  for (const f of [flippers.L, flippers.R]){
    const tip = flipperTip(f);
    ctx.shadowBlur = 18; ctx.shadowColor = '#fd5'; ctx.globalAlpha=0.5;
    ctx.strokeStyle = '#fd5'; ctx.lineWidth = 18; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(f.pivot.x,f.pivot.y); ctx.lineTo(tip.x,tip.y); ctx.stroke();
    ctx.shadowBlur=0; ctx.globalAlpha=1; ctx.lineWidth=10;
    ctx.beginPath(); ctx.moveTo(f.pivot.x,f.pivot.y); ctx.lineTo(tip.x,tip.y); ctx.stroke();
  }
  // Trail
  trail.unshift({x:ball.p.x,y:ball.p.y}); if (trail.length > 6) trail.pop();
  for (let i=0;i<trail.length;i++){
    ctx.globalAlpha = 0.6*(1 - i/trail.length);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, ball.r * (1 - i*0.1), 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Ball
  const g = ctx.createRadialGradient(ball.p.x-3, ball.p.y-3, 2, ball.p.x, ball.p.y, ball.r);
  g.addColorStop(0,'#fff'); g.addColorStop(1,'#aaa');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ball.p.x, ball.p.y, ball.r, 0, Math.PI*2); ctx.fill();
  // Particles
  for (let i=particles.length-1;i>=0;i--){
    const p = particles[i]; p.life -= 1/60;
    if (p.life <= 0){ particles.splice(i,1); continue; }
    p.p.x += p.v.x/60; p.p.y += p.v.y/60; p.v.y += 200/60;
    ctx.globalAlpha = p.life/0.35; ctx.fillStyle = p.color;
    ctx.fillRect(p.p.x, p.p.y, 2, 2);
  }
  ctx.globalAlpha = 1;
  // HUD
  ctx.fillStyle = '#5cf'; ctx.font = "10px 'Press Start 2P', monospace";
  ctx.fillText('SCORE ' + state.score, 8, 16);
  ctx.fillStyle = '#f3a'; ctx.fillText('x' + state.mult, 8, 30);
  ctx.fillStyle = '#fd5';
  for (let i=0;i<state.balls;i++){ ctx.beginPath(); ctx.arc(CONFIG.W-12-i*14, 14, 4, 0, Math.PI*2); ctx.fill(); }
  if (state.phase === 'gameover'){
    ctx.fillStyle = '#f3a'; ctx.font = "16px 'Press Start 2P', monospace";
    ctx.fillText('GAME OVER', CONFIG.W/2 - 70, CONFIG.H/2);
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.fillText('PRESS R', CONFIG.W/2 - 30, CONFIG.H/2 + 20);
  }
}
```

- [ ] **Step 2: Hook `spawnParticles` into bumper/slingshot/drop branches** of `physicsStep`:

```js
// bumper:
spawnParticles(ball.p, b.color);
// sling:
spawnParticles(ball.p, '#f3a');
// drop:
spawnParticles(ball.p, '#fd5');
```

- [ ] **Step 3: Run all tests, confirm none broke**

Expected: 12 passed.

- [ ] **Step 4: Open `index.html` in a browser and visually verify glow + trail + particles.**

- [ ] **Step 5: Commit**

```pwsh
git add index.html
git commit -m "feat(pinball): neon glow render pass + trail + particles"
```

---

## Task 12: AUDIO + restart + game-over key

**Files:**
- Modify: `c:\REP\flipper\index.html` (sections 6/7/8/10)

- [ ] **Step 1: Add audio module** — insert before section 8 INPUT:

```js
let ac = null;
function audio(){ if (!ac) ac = new (window.AudioContext||window.webkitAudioContext)(); return ac; }
function beep(type, freq, dur, gain=0.15){
  const a = audio(); const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = gain;
  o.connect(g); g.connect(a.destination);
  o.start(); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.stop(a.currentTime + dur);
}
function sfx(name){
  switch(name){
    case 'bumper': beep('square', 400, 0.06); break;
    case 'sling':  beep('sawtooth', 320, 0.1); break;
    case 'drop':   beep('sine', 800, 0.08); break;
    case 'clear':  [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep('sine',f,0.15),i*60)); break;
    case 'drain':  beep('sawtooth', 200, 0.35); break;
    case 'save':   beep('triangle', 660, 0.2); break;
  }
}
```

- [ ] **Step 2: Call `sfx(...)` in bumper/sling/drop/drain/save branches.**

- [ ] **Step 3: Add restart binding** in INPUT:

```js
if ((e.key==='r' || e.key==='R') && state.phase==='gameover'){
  state.score = 0; state.balls = 3; state.mult = 1; state.phase = 'ready';
  for (const d of drops) d.active = true;
  ball.p = {x:400,y:680}; ball.v = {x:0,y:0};
}
```

- [ ] **Step 4: Set `state.phase = 'playing'` when plunger releases.**

- [ ] **Step 5: Run all tests**

Expected: 12 passed.

- [ ] **Step 6: Commit**

```pwsh
git add index.html
git commit -m "feat(pinball): Web Audio sfx + restart key"
```

---

## Task 13: Cleanup + smoke test

**Files:**
- Modify: `c:\REP\flipper\index.html` (final review)
- Modify: `c:\REP\flipper\launch.spec.js` (sanity)

- [ ] **Step 1: Confirm no `matter.min.js` reference remains**

```pwsh
Select-String -Path c:\REP\flipper\index.html -Pattern 'matter' -SimpleMatch
```
Expected: no matches.

- [ ] **Step 2: Append a real-time smoke test** (uses rAF, not __test.step):

```js
test('smoke: page idles without throwing, ball does not vanish off-screen', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(2000);
  const b = await page.evaluate(() => ({ x: window.__test.ball.p.x, y: window.__test.ball.p.y }));
  expect(errors).toEqual([]);
  expect(b.x).toBeGreaterThan(-10); expect(b.x).toBeLessThan(430);
  expect(b.y).toBeGreaterThan(-10); expect(b.y).toBeLessThan(730);
});
```

- [ ] **Step 3: Run full test suite**

Run: `npx playwright test launch.spec.js`
Expected: 13 passed.

- [ ] **Step 4: Manual playtest** — open `index.html`, hold Space to charge, release, play a full ball.

- [ ] **Step 5: Final commit**

```pwsh
git add index.html launch.spec.js
git commit -m "chore(pinball): drop Matter.js, add smoke test, finalize"
```

---

## Self-Review Notes (resolved before handoff)

- **Spec coverage:** All 7 testing-strategy tests have corresponding tasks (Task 6 plunger, Task 10 fuzz, Task 8 bumper + sling, Task 9 drops + saver, Task 7 flipper). Captive lane / spinner / ramp deferred per spec section 11 — not in S2 minimum; left for follow-up if user wants.
- **Naming consistency:** `physicsStep`, `flipperStep`, `plungerStep`, `flipperTip`, `flipperCollide`, `sweepCircleSegment`, `sweepCircleArc`, `sweepCircleEnd`, `addSegment`, `addArc` consistent across all tasks.
- **Type consistency:** `ball.p`, `ball.v`, `ball.r`; `segment.a/b/restitution/kind/drop/enabled`; `arc.c/R/a0/a1/outward`; `bumper.c/r/color`; `flipper.pivot/length/tipR/baseR/angle/angVel/pressed`.
- **Spec gaps deferred:** spinner, captive lane, ramp loop, combo system (section 4 of spec). To be added in a follow-up plan if requested.
