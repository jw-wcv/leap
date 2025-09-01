const fs = require('fs');
const path = require('path');
const { now, clamp01 } = require('../core/utils');

function gesturesDir(ctx) {
  const d = path.join(ctx.userDataPath || process.cwd(), 'gestures');
  fs.mkdirSync(d, { recursive: true }); return d;
}
function saveSegment(ctx) {
  const seg = ctx.state.trainer.seg; if (!seg.length) return null;
  const label = (ctx.state.trainer.label && ctx.state.trainer.label.trim()) || 'unlabeled';
  const file = path.join(gesturesDir(ctx), `${label}.ndjson`);
  const stream = fs.createWriteStream(file, { flags: 'a', encoding: 'utf8' });
  for (const row of seg) stream.write(JSON.stringify(row)+'\n');
  stream.end();
  ctx.state.trainer.lastSaved = file;
  ctx.state.trainer.seg = [];
  return file;
}

function trainerEnable(ctx, v) {
  ctx.state.trainer.enabled = !!v;
  ctx.onHUD({ trainer: { state: ctx.state.trainer.enabled ? 'enabled' : 'disabled', label: ctx.state.trainer.label }});
  ctx.tutor(`Trainer ${v ? 'enabled' : 'disabled'}`);
}
function trainerSetLabel(ctx, label) {
  ctx.state.trainer.label = String(label || '').trim();
  ctx.onHUD({ trainer: { label: ctx.state.trainer.label }});
}
function trainerStart(ctx) {
  if (!ctx.state.trainer.enabled) { ctx.tutor('Enable Trainer first'); return; }
  if (ctx.state.trainer.capturing) return;
  ctx.state.trainer.capturing = true;
  ctx.state.trainer.started = now();
  ctx.state.trainer.seg = [];
  ctx.tutor(`Trainer: segment started ${ctx.state.trainer.label ? `(${ctx.state.trainer.label})` : ''}`);
  ctx.onHUD({ trainer: { recording: true }});
}
function trainerStopAndSave(ctx) {
  if (!ctx.state.trainer.capturing) return;
  ctx.state.trainer.capturing = false;
  const file = saveSegment(ctx);
  ctx.tutor(file ? `Trainer: saved → ${path.basename(file)}` : 'Trainer: segment empty');
  ctx.onHUD({ trainer: { recording: false }});
}
function trainerReplayLast(ctx) {
  const file = ctx.state.trainer.lastSaved;
  if (!file || !fs.existsSync(file)) { ctx.tutor('No last saved segment'); return; }
  const lines = fs.readFileSync(file,'utf8').trim().split('\n').map(l=>JSON.parse(l));
  const frames = lines.slice(-600);
  if (!frames.length) { ctx.tutor('Segment empty'); return; }
  ctx.tutor('Trainer: replay last segment');
  ctx._hudPatch({ rec:'replaying' });
  ctx.state.rec.replay = { idx:0, frames, t0: now() };
  const tick = async () => {
    const rp = ctx.state.rec.replay; if (!rp) return;
    if (rp.idx >= rp.frames.length) { ctx.state.rec.replay = null; ctx._hudPatch({ rec:'idle' }); ctx.tutor('Replay finished'); return; }
    const f = rp.frames[rp.idx];
    const delay = Math.max(0, (ctx.state.rec.replay.t0 + f.t) - now());
    setTimeout(async () => { await ctx._onReplayFrame({ hand: f.hand, t: f.t }); rp.idx++; tick(); }, delay);
  };
  tick();
}

function trainerCapture(ctx, iBox, hand) {
  if (!(ctx.state.trainer.enabled && ctx.state.trainer.capturing)) return;
  const t = now() - ctx.state.trainer.started;
  const norm = (vec)=> { const a = iBox.normalizePoint(vec, true); return { nx: clamp01(a[0]), ny: clamp01(a[1]) }; };
  const indexTip = hand.indexFinger?.stabilizedTipPosition ? norm(hand.indexFinger.stabilizedTipPosition) : norm(hand.stabilizedPalmPosition);
  const palm     = norm(hand.stabilizedPalmPosition);
  const fingers  = hand.fingers.map(f => { const p = norm(f.stabilizedTipPosition); return { nx: p.nx, ny: p.ny, ext: !!f.extended }; });
  const two = fingers.filter(f => f.ext).slice(0,2);
  const twoCenter = two.length === 2 ? { nx: (two[0].nx+two[1].nx)/2, ny:(two[0].ny+two[1].ny)/2 } : null;

  ctx.state.trainer.seg.push({
    t, label: ctx.state.trainer.label || 'unlabeled',
    hand: { pinch: hand.pinchStrength||0, grab: hand.grabStrength||0, roll: hand.roll()||0, pitch: hand.pitch()||0,
            palmVelocity: hand.palmVelocity||[0,0,0], indexTip, palm, twoCenter }
  });
}

module.exports = {
  trainerEnable, trainerSetLabel, trainerStart, trainerStopAndSave, trainerReplayLast, trainerCapture
};
