// src/hud/renderer.js
const canvas = document.getElementById('c');
const info = document.getElementById('info');

const calDiv  = document.getElementById('cal');
const calText = document.getElementById('calText');
const btnStart  = document.getElementById('btnStart');
const btnCancel = document.getElementById('btnCancel');

const tutorDiv = document.getElementById('tutor');

const recbar    = document.getElementById('recbar');
const recStatus = document.getElementById('recStatus');
const btnRecStart = document.getElementById('btnRecStart');
const btnRecStop  = document.getElementById('btnRecStop');
const btnRecPlay  = document.getElementById('btnRecPlay');

const trainerDiv      = document.getElementById('trainer');
const trainerLabel    = document.getElementById('trainerLabel');
const btnTrainerEnable= document.getElementById('btnTrainerEnable');
const btnTrainerStart = document.getElementById('btnTrainerStart');
const btnTrainerStop  = document.getElementById('btnTrainerStop');

// Gestures panel root
const gesturesRoot = document.getElementById('settings-gestures');

const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = Math.max(1, Math.floor(window.innerWidth  * devicePixelRatio));
  canvas.height= Math.max(1, Math.floor(window.innerHeight * devicePixelRatio));
}
window.addEventListener('resize', resize);
resize();

let data = null;
let calStep = 'idle';
let trainerEnabled = false;

// --- Toaster ---------------------------------------------------------------
function addToast(text) {
  if (!text) return;
  const el = document.createElement('div');
  el.className = 'chip';
  el.textContent = text;
  tutorDiv.appendChild(el);
  setTimeout(() => el.classList.add('fade'), 1400);
  setTimeout(() => el.remove(), 1800);
}

// --- Gestures panel --------------------------------------------------------
async function renderGesturesPanel(root, preloadedFlags) {
  const flags = preloadedFlags || await window.leap.getGestures();
  root.innerHTML = `
    <div class="panel gestures">
      <div class="panel-header">
        <h3>Gestures</h3>
        <div class="actions">
          <button id="allOff"  title="Disable all gestures">All off</button>
          <button id="safeStart" title="Pointer + 2F scroll only">Safe start</button>
        </div>
      </div>
      <div class="grid">
        ${Object.keys(flags).map(k => `
          <label class="row">
            <input type="checkbox" data-k="${k}" ${flags[k] ? 'checked' : ''}/>
            <span>${k}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `;

  // Wire checkboxes
  root.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const key = e.target.dataset.k;
      await window.leap.setGesture(key, e.target.checked);
      addToast(`${key}: ${e.target.checked ? 'on' : 'off'}`);
    });
  });

  // Bulk buttons
  root.querySelector('#allOff').onclick = async () => {
    const all = Object.fromEntries(Object.keys(flags).map(k => [k, false]));
    await window.leap.setGestures(all);
    renderGesturesPanel(root); // refresh
    addToast('All gestures off');
  };
  root.querySelector('#safeStart').onclick = async () => {
    await window.leap.setGestures({
      cursor: true, scroll: true, pinchClick: false, drag: false,
      threeFingerDrag: false, osSwipes: false, windowMove: false,
      windowResize: false, snapCycle: false, showDesktop: false,
      launchpad: false, dwellClick: false
    });
    renderGesturesPanel(root); // refresh
    addToast('Safe start preset applied');
  };
}

// Initial render
renderGesturesPanel(gesturesRoot).catch(() => { /* ignore */ });

// --- Draw loop -------------------------------------------------------------
function draw() {
  ctx.clearRect(0,0,canvas.width, canvas.height);

  if (data) {
    const r = devicePixelRatio || 1;
    const x = (data.x ?? 0) * r, y = (data.y ?? 0) * r;

    ctx.strokeStyle = 'rgba(0,200,255,0.8)';
    ctx.lineWidth = Math.max(1, 2 * r);
    ctx.beginPath(); ctx.moveTo(x-30*r, y); ctx.lineTo(x+30*r, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y-30*r); ctx.lineTo(x, y+30*r); ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(x, y, 6*r, 0, Math.PI*2); ctx.fill();

    if (data.windowMode && data.windowMode !== 'none') {
      ctx.fillStyle = data.windowMode === 'move' ? 'rgba(50,200,120,0.7)' : 'rgba(255,140,0,0.75)';
      ctx.beginPath(); ctx.arc(x, y, 18*r, 0, Math.PI*2); ctx.fill();
    }
  }

  if (calStep === 'A') {
    info.textContent = 'Calibration: point to TOP-LEFT, quick pinch to set A';
  } else if (calStep === 'B') {
    info.textContent = 'Calibration: point to BOTTOM-RIGHT, quick pinch to set B';
  } else {
    const disp = data?.displayId != null ? `  disp:${data.displayId}` : '';
    const lock = data?.gcr ? `  lock:${data.gcr}` : '';
    const profile = data?.profile?.name ? `  profile:${data.profile.name}` : '';
    info.textContent = data
      ? `hands:${data.hands}  ext:${data.ext}  pinch:${data.pinch}  grab:${data.grab}  mode:${data.windowMode||'—'}  drag:${data.dragging?'yes':'no'}  x:${data.x} y:${data.y}${disp}${lock}${profile}`
      : '—';
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// --- HUD events from main --------------------------------------------------
window.hud.onUpdate((payload) => {
  data = payload || data;
  if (payload?.calStep) calStep = payload.calStep;
  if (payload?.tutor) addToast(payload.tutor);
  if (payload?.rec) recStatus.textContent = `Recorder: ${payload.rec}`;

  // Trainer UI sync
  if (payload?.trainer) {
    if (payload.trainer.state) {
      trainerEnabled = payload.trainer.state === 'enabled';
      btnTrainerEnable.textContent = trainerEnabled ? 'Enabled' : 'Enable';
    }
    if (payload.trainer.label !== undefined && trainerLabel.value !== payload.trainer.label) {
      trainerLabel.value = payload.trainer.label;
    }
  }

  // Re-render gestures panel if engine pushed new toggle state
  if (payload?.settings?.gestures && gesturesRoot) {
    renderGesturesPanel(gesturesRoot, payload.settings.gestures);
  }
});

window.hud.onToggle((visible) => { document.body.style.opacity = visible ? '1' : '0'; });

window.hud.onCal((payload) => {
  if (payload.mode === 'start') {
    calStep = 'A'; calDiv.style.display = 'flex';
    calText.textContent = 'Calibration started (Step A)'; btnStart.disabled = true;
  } else if (payload.mode === 'progress') {
    calStep = payload.step; calText.textContent = payload.step === 'B' ? 'Step B: set bottom-right' : 'Step A';
  } else if (payload.mode === 'done' || payload.mode === 'cancel') {
    calStep = 'idle'; calDiv.style.display = 'none';
    calText.textContent = 'Calibration'; btnStart.disabled = false;
  }
});

// Buttons
btnStart?.addEventListener('click', () => window.hud.calStart());
btnCancel?.addEventListener('click', () => window.hud.calCancel());

// Recorder controls
btnRecStart?.addEventListener('click', () => window.hud.recStart());
btnRecStop?.addEventListener('click', () => window.hud.recStop());
btnRecPlay?.addEventListener('click', () => window.hud.recPlayLast());

// Trainer
btnTrainerEnable.addEventListener('click', async () => {
  trainerEnabled = !trainerEnabled;
  await window.hud.trainerEnable(trainerEnabled);
  btnTrainerEnable.textContent = trainerEnabled ? 'Enabled' : 'Enable';
});

btnTrainerStart.addEventListener('click', async () => {
  await window.hud.trainerSetLabel(trainerLabel.value || '');
  await window.hud.trainerStart();
});
btnTrainerStop.addEventListener('click', async () => {
  await window.hud.trainerSetLabel(trainerLabel.value || '');
  await window.hud.trainerStopSave();
});
