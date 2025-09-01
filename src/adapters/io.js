// src/adapters/io.js
let nut = null;
try { nut = require('@nut-tree/nut-js'); } catch { nut = null; }

let robot = null;
if (!nut) {
  try { robot = require('@hurdlegroup/robotjs'); } catch { robot = null; }
}

// ---- nut.js backend (preferred when available) ----
function withNut() {
  const {
    mouse, keyboard, Key, Button, screen, Point,
    setMouseDelay, setKeyboardDelay
  } = require('@nut-tree/nut-js');

  setMouseDelay(0); setKeyboardDelay(0);

  async function keyChord(keys) {
    for (const k of keys) await keyboard.pressKey(k);
    for (let i = keys.length - 1; i >= 0; i--) await keyboard.releaseKey(keys[i]);
  }

  return { mouse, keyboard, Key, Button, screen, Point, keyChord };
}

// ---- robotjs backend (fallback) ----
const { execFile } = require('child_process');

function osaKeyChord(mods = [], keyCode) {
  // mods: array of 'control down','command down','option down','shift down'
  const using = mods.length ? ` using {${mods.join(', ')}}` : '';
  return new Promise((resolve) => {
    const script = `tell application "System Events" to key code ${keyCode}${using}`;
    execFile('osascript', ['-e', script], () => resolve());
  });
}

function withRobot() {
  const r = robot;
  
  // Check if robotjs loaded successfully
  if (!r) {
    console.error('robotjs failed to load - falling back to AppleScript-only mode');
    // Return a minimal implementation that only supports key chords via AppleScript
    const Button = { LEFT: 1, RIGHT: 2, MIDDLE: 3 };
    const Key = { LeftControl: 'ctrl', LeftAlt: 'alt', LeftSuper: 'cmd', Up: 'up', Down: 'down', Left: 'left', Right: 'right', F4: 'f4', F11: 'f11' };
    const Point = function (x, y) { this.x = x; this.y = y; };
    const screen = {};

    const mouse = {
      click: async () => { console.warn('Mouse clicks not available - robotjs failed to load'); },
      pressButton: async () => { console.warn('Mouse press not available - robotjs failed to load'); },
      releaseButton: async () => { console.warn('Mouse release not available - robotjs failed to load'); },
      scrollUp: async () => { console.warn('Mouse scroll not available - robotjs failed to load'); },
      scrollDown: async () => { console.warn('Mouse scroll not available - robotjs failed to load'); },
      scrollLeft: async () => { console.warn('Mouse scroll not available - robotjs failed to load'); },
      scrollRight: async () => { console.warn('Mouse scroll not available - robotjs failed to load'); },
      getPosition: async () => { 
        console.warn('Mouse position not available - robotjs failed to load');
        return { x: 0, y: 0 }; // Return safe default
      },
      setPosition: async () => { console.warn('Mouse movement not available - robotjs failed to load'); },
    };

    // AppleScript-based keyChord for arrows/F-keys with modifiers
    async function keyChord(keys) {
      // ... existing keyChord implementation ...
      const mods = [];
      let keyCode = null;

      if (keys.some(k => /LeftControl|Control/.test(k))) mods.push('control down');
      if (keys.some(k => /LeftAlt|Option/.test(k)))     mods.push('option down');
      if (keys.some(k => /LeftSuper|Command/.test(k)))  mods.push('command down');
      if (keys.some(k => /Shift/.test(k)))              mods.push('shift down');

      if (keys.some(k => /Up/.test(k)))    keyCode = 126;
      if (keys.some(k => /Down/.test(k)))  keyCode = 125;
      if (keys.some(k => /Left$/.test(k))) keyCode = 123;
      if (keys.some(k => /Right$/.test(k)))keyCode = 124;

      // F-keys: F11 (103), F4 (118)
      if (keys.some(k => /F11/.test(k))) keyCode = 103;
      if (keys.some(k => /F4/.test(k)))  keyCode = 118;

      if (keyCode == null) return; // nothing to do
      await osaKeyChord(mods, keyCode);
    }

    return { mouse, keyboard: { pressKey: async () => {}, releaseKey: async () => {} }, Key, Button, screen, Point, keyChord };
  }

  // minimal enums to keep the rest of the code happy
  const Button = { LEFT: 1, RIGHT: 2, MIDDLE: 3 };
  const Key = { LeftControl: 'ctrl', LeftAlt: 'alt', LeftSuper: 'cmd', Up: 'up', Down: 'down', Left: 'left', Right: 'right', F4: 'f4', F11: 'f11' };
  const Point = function (x, y) { this.x = x; this.y = y; };
  const screen = {}; // not used by our engine code directly

  const mouse = {
    click: (btn) => r.mouseClick(btn === 2 ? 'right' : btn === 3 ? 'middle' : 'left', false),
    pressButton: (btn) => r.mouseToggle('down', btn === 2 ? 'right' : btn === 3 ? 'middle' : 'left'),
    releaseButton: (btn) => r.mouseToggle('up', btn === 2 ? 'right' : btn === 3 ? 'middle' : 'left'),
    scrollUp: (n) => r.scrollMouse(0, Math.abs(n)),
    scrollDown: (n) => r.scrollMouse(0, -Math.abs(n)),
    scrollLeft: (n) => r.scrollMouse(-Math.abs(n), 0),
    scrollRight: (n) => r.scrollMouse(Math.abs(n), 0),
    getPosition: async () => {
      const p = r.getMousePos();
      return { x: p.x, y: p.y };
    },
    setPosition: ({ x, y }) => r.moveMouse(x, y),
  };

  // AppleScript-based keyChord for arrows/F-keys with modifiers
  async function keyChord(keys) {
    // Translate our OS chords (e.g., LeftControl + Up) to AppleScript modifier + keycode
    const mods = [];
    let keyCode = null;

    if (keys.some(k => /LeftControl|Control/.test(k))) mods.push('control down');
    if (keys.some(k => /LeftAlt|Option/.test(k)))     mods.push('option down');
    if (keys.some(k => /LeftSuper|Command/.test(k)))  mods.push('command down');
    if (keys.some(k => /Shift/.test(k)))              mods.push('shift down');

    if (keys.some(k => /Up/.test(k)))    keyCode = 126;
    if (keys.some(k => /Down/.test(k)))  keyCode = 125;
    if (keys.some(k => /Left$/.test(k))) keyCode = 123;
    if (keys.some(k => /Right$/.test(k)))keyCode = 124;

    // F-keys: F11 (103), F4 (118)
    if (keys.some(k => /F11/.test(k))) keyCode = 103;
    if (keys.some(k => /F4/.test(k)))  keyCode = 118;

    if (keyCode == null) return; // nothing to do
    await osaKeyChord(mods, keyCode);
  }

  return { mouse, keyboard: { pressKey: async () => {}, releaseKey: async () => {} }, Key, Button, screen, Point, keyChord };
}

module.exports = nut ? withNut() : withRobot();
