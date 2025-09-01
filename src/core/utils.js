// src/core/utils.js
const { execFile } = require('child_process');

const now = () => Date.now();
const avg = (a,b,t) => a + (b-a)*t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a,b,t) => a + (b-a)*t;
const invLerp = (a,b,v) => (v - a) / (b - a);

// Try to get keyChord from our IO adapter
let io = null;
try { io = require('../adapters/io'); } catch { io = null; }

async function osaKeyChord(mods = [], keyCode) {
  const using = mods.length ? ` using {${mods.join(', ')}}` : '';
  return new Promise((resolve) => {
    const script = `tell application "System Events" to key code ${keyCode}${using}`;
    execFile('osascript', ['-e', script], () => resolve());
  });
}

async function keyChord(keys) {
  // Prefer adapter (nut-js or robot fallback)
  if (io && typeof io.keyChord === 'function') {
    return io.keyChord(keys);
  }
  // Final fallback: minimal AppleScript handling for the specific chords we use
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
  if (keys.some(k => /F11/.test(k)))   keyCode = 103;
  if (keys.some(k => /F4/.test(k)))    keyCode = 118;

  if (keyCode == null) return;
  await osaKeyChord(mods, keyCode);
}

// OS chords remain symbolic; engine/gestures pass these arrays into keyChord()
const OS = {
  missionControlUp:    ['LeftControl','Up'],
  missionControlDown:  ['LeftControl','Down'],
  nextDesktop:         ['LeftControl','Right'],
  prevDesktop:         ['LeftControl','Left'],
  showDesktop:         ['F11'],
  launchpad:           ['F4'],
};

module.exports = { now, avg, clamp01, lerp, invLerp, keyChord, OS };
