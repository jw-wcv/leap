// src/adapters/osActions.js
const { keyChord, Key, Button } = require('./io');
const { axRun, osaMoveBy, osaResizeBy, osaSnap } = require('../osx/ax');

async function clickLeft(io){ await io.mouse.click(Button.LEFT); }
async function clickRight(io){ await io.mouse.click(Button.RIGHT); }
async function clickMiddle(io){ await io.mouse.click(Button.MIDDLE); }

async function scroll(io, x, y) {
  if (y) (y > 0 ? io.mouse.scrollUp(y) : io.mouse.scrollDown(-y));
  if (x) (x > 0 ? io.mouse.scrollRight(x) : io.mouse.scrollLeft(-x));
}

async function holdCmd(io, fn) {
  await io.keyboard.pressKey(Key.LeftSuper);
  try { await fn(); } finally { await io.keyboard.releaseKey(Key.LeftSuper); }
}

async function moveWindow(helperPath, dx, dy){ if (await axRun(helperPath,['moveBy',String(dx),String(dy)])) return; await osaMoveBy(dx,dy); }
async function resizeWindow(helperPath, dw, dh){ if (await axRun(helperPath,['resizeBy',String(dw),String(dh)])) return; await osaResizeBy(dw,dh); }
async function snapWindow(helperPath, which){ if (await axRun(helperPath,['snap',which])) return; await osaSnap(which); }

module.exports = { clickLeft, clickRight, clickMiddle, scroll, holdCmd, moveWindow, resizeWindow, snapWindow, keyChord, Key, Button };
