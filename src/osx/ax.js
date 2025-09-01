const { execFile } = require('child_process');

// Run Swift AX helper if available
function axRun(helperPath, args) {
  return new Promise((resolve) => {
    if (!helperPath) return resolve(false);
    execFile(helperPath, args, (err) => resolve(!err));
  });
}

// AppleScript fallbacks (best-effort)
function osa(script) {
  return new Promise((resolve) => {
    const { execFile } = require('child_process');
    execFile('osascript', ['-e', script], (err) => resolve(!err));
  });
}

async function osaMoveBy(dx, dy) {
  const s = `
tell application "System Events"
  set p to first process whose frontmost is true
  tell p
    if (count of windows) < 1 then return
    tell window 1
      set {x, y} to position
      set position to {x + ${Math.round(dx)}, y + ${Math.round(dy)}}
    end tell
  end tell
end tell`;
  return osa(s);
}

async function osaResizeBy(dw, dh) {
  const s = `
tell application "System Events"
  set p to first process whose frontmost is true
  tell p
    if (count of windows) < 1 then return
    tell window 1
      set {w, h} to size
      set size to {max(200, w + ${Math.round(dw)}), max(150, h + ${Math.round(dh)})}
    end tell
  end tell
end tell`;
  return osa(s);
}

// Fallback snap is a no-op (helper handles real snapping)
async function osaSnap(_which) { return true; }

module.exports = { axRun, osaMoveBy, osaResizeBy, osaSnap };
