# Ultraleap Mac Trackpad Pro

Turn your **Ultraleap (Leap Motion Controller 2)** into a macOS “virtual trackpad” with rich support for:

- Cursor movement & clicks
- Dragging (closed fist) & 3-finger drag
- OS X gestures (Mission Control, Spaces, Show Desktop, Launchpad)
- Window move, resize, snap & tiling
- Configurable profiles (per-app overrides + key bindings)
- HUD overlay with tutor toasts
- Recorder / replay of Leap frames
- Trainer: record & label custom gesture segments
- Calibration wizard (per display)
- Settings panel (adjust sensitivities, enable/disable gestures)

---

## Requirements

- macOS 12+
- **Ultraleap Gemini (V5+)** hand tracking service installed
- **UltraleapTrackingWebSocket** bridge running at `ws://127.0.0.1:6437`
- **Node.js 18+**
- **Xcode Command Line Tools** (`xcode-select --install`) – required to build the Swift AX helper
- **Homebrew** – required to install `libwebsockets` when building the bridge

---

## Setup

```bash
git clone <this-repo> ultraleap-mac-trackpad-pro
cd ultraleap-mac-trackpad-pro

npm install
npm start
```

On first run:

- `src/axwin.swift` is compiled into `./axwin` (Accessibility API helper).
- `profiles.json` is created in the app’s userData folder.
- `config.json` is created with defaults.

---

## Permissions

Grant Accessibility (and optionally Input Monitoring) to Electron or your packaged app in:

```
System Settings → Privacy & Security → Accessibility
```

---

## Project Tree

```
ultraleap-mac-trackpad-pro/
├─ package.json
├─ main.js
├─ axwin                 # compiled Swift helper binary
├─ src/
│  ├─ gestureEngine.js
│  ├─ core/              # CFG, GCR, state, utils, bus, pipeline
│  ├─ input/             # profiles + key parser
│  ├─ osx/               # AX + AppleScript helpers
│  ├─ gestures/          # scroll, drag, pinchClick, snapCycle, etc.
│  ├─ functions/         # recorder, training, calibration, profile controls
│  ├─ adapters/          # IO adapters (nut-js / robotjs fallback)
│  ├─ hud/               # HUD overlay (renderer.js + hud.html)
│  ├─ settings/          # Settings window (renderer.js + settings.html)
│  └─ preload.js
```

Runtime data is written to:

```
~/Library/Application Support/ultraleap-mac-trackpad-pro/
├─ config.json
├─ profiles.json
├─ recordings/*.ndjson
├─ gestures/*.ndjson
```

---

## Gestures

### Cursor / Clicks
- Index finger hover → move cursor
- Pinch taps:
  - 1 tap → Left click
  - 2 taps → Right click
  - 3 taps → Middle click
- Closed fist (`grabStrength ≥ 0.9`) → start drag; release at ≤ 0.65
- Dwell click: hold fingertip still ~650 ms to auto-click

### Scroll / Zoom
- Two fingers move → Scroll
- Two fingers + pinch > 0.7 → ⌘+Scroll Zoom (browser/app zoom)
- Scroll inertia → glides after lift

### Window Control
- **4-finger pinch-hold** → Window **Move Mode**  
  (drag windows directly; two-finger swipes snap left/right/top/bottom; 4-finger pinch-tap cycles layouts)
- **5-finger pinch-hold** → Window **Resize Mode**  
  (rotate wrist = width resize, pitch = height resize)
- Snapping cycle order:  
  `left → right → top → bottom → tl → tr → bl → br → third-left → third-center → third-right → center → max`

### OS Gestures
- 4-finger swipe left/right → Switch desktop
- 4-finger swipe up → Mission Control
- 4-finger swipe down → App Exposé
- 5-finger open hold → Show Desktop
- 5-finger pinch-in quick → Launchpad

---

## HUD Overlay

- Displays tutor toasts for recognized gestures:
  - `"Drag start"`, `"Right click"`, `"Snap: left"`, etc.
- Shows calibration prompts
- Shows recorder status (`idle / recording / replaying`)
- Displays active profile name
- Displays trainer label + capture state

---

## Tray Menu

- **HUD Overlay toggle**
- **Three-Finger Drag toggle**
- **Cmd+Scroll Zoom on pinch toggle**
- **Profiles**
  - Auto (by app bundle ID)
  - Reload profiles
  - Open `profiles.json`
  - Current active profile (read-only)
- **Recorder**
  - Start / Stop Recording
  - Replay Last
  - Open recordings folder
- **Trainer**
  - Enable/disable Trainer Mode
  - Start / Stop & Save Segment
  - Open gestures folder
  - Replay last saved segment
- **Start Calibration Wizard**
- **Settings…** (full configuration UI)
- **Quit**

---

## Profiles

Profiles are stored in `profiles.json` under the app’s userData directory. Each profile may override:

- `threeFingerDrag`
- `zoomWithCmdScrollOnPinch`
- `pointerGain`
- `scrollInertia`
- Bindings for gestures (e.g., `threeSwipe.left` → key chord)

### Example (Chrome):
```json
"com.google.Chrome": {
  "name": "Chrome",
  "overrides": { "threeFingerDrag": false },
  "bindings": {
    "threeSwipe.left":  { "type": "key", "keys": ["LeftControl","LeftShift","Tab"] },
    "threeSwipe.right": { "type": "key", "keys": ["LeftControl","Tab"] },
    "threeSwipe.up":    { "type": "key", "keys": ["LeftSuper","L"] }
  }
}
```

---

## Recorder / Replay

- **Recorder**: Saves Leap frame data (normalized) to NDJSON in `recordings/`.
- **Replay**: Replays last recording deterministically (cursor + gestures) without the device.
- HUD shows Recorder state: idle / recording / replaying.

---

## Trainer

- **Enable Trainer Mode**: capture labeled gesture segments
- **Start Segment**: begins capturing normalized frames
- **Stop + Save Segment**: saves to `gestures/<label>.ndjson`
- **Replay Last Saved Segment**: deterministic playback
- Useful for training custom gesture recognizers in the future.

---

## Calibration

From tray or HUD:

1. Step A: point to top-left → quick pinch
2. Step B: point to bottom-right → quick pinch

Mapping is saved globally and per-display.

---

## Settings Panel

Accessible via Tray → **Settings…**

- Enable/disable gestures
- Adjust thresholds:
  - Pointer gain
  - Scroll inertia
  - Dwell click timings
  - Click delays
  - Window move/resize scale
  - Swipe velocities
- Toggle per-feature preferences (threeFingerDrag, zoomWithCmdScrollOnPinch, profilesAuto)

Settings are saved to `config.json` and applied at runtime.

---

## Known Limits

- Trackpad native pinch-to-zoom not exposed; use ⌘+Scroll zoom
- AX API requires Accessibility permission
- Some apps resist resize/move (sandboxed or nonstandard window managers)
- HUD overlay is Electron — kept minimal for latency
- Requires UltraleapTrackingWebSocket bridge (Gemini does not expose WebSocket natively)

---
