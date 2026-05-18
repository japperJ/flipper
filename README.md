# NEON PINBALL

Arcade-style browser pinball with a neon cabinet look, theme packs, light effects, and a pause/cabinet menu.

![NEON PINBALL Screenshot](./image.png)

## Features

- 🎨 3 built-in theme packs:
  - Sunburst Classic
  - Cosmic Wedge
  - Volcano Pop
- 💡 Event-driven lighting effects (bumper/sling/drop/jackpot/drain/game over)
- 🔊 Theme-specific retro audio with sound toggle
- 🕹️ Cabinet menu overlay with theme + sound controls
- 🧪 Playwright regression tests for physics, gameplay, and menu behavior

## Controls

- `Z` / `Left Arrow`: Left flipper
- `/` / `Right Arrow`: Right flipper
- `Space`: Plunger / launch
- `P`: Pause
- `Esc`: Open/close **Cabinet Menu**
- In Cabinet Menu:
  - `1` / `2` / `3`: Select theme
  - `S`: Toggle sound
  - `Enter`: Apply + resume
  - `Esc`: Cancel + resume

## Run locally

Open `index.html` directly in your browser.

## Run tests

Install dependencies (if needed), then run Playwright:

- `npm install`
- `npx playwright test launch.spec.js`

## Project structure

- `index.html` — Game + rendering + input + menu
- `launch.spec.js` — Playwright gameplay and regression tests
- `docs/superpowers/` — design/spec/planning docs

