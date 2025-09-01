const fs = require('fs');
const path = require('path');
const { now, clamp01 } = require('../core/utils');

function recDir(ctx) { const d = path.join(ctx.userDataPath, 'recordings'); fs.mkdirSync(d,{recursive:true}); return d; }

function startRecording(ctx) {
  if (ctx.state.rec.enabled) return;
  const file = path.join(recDir(ctx), `${new Date().toISOString().replace(/[:.]/g,'-')}.ndjson`);
  ctx.state.rec.stream = fs.createWriteStream(file, { encoding:'utf8' });
  ctx.state.rec.stream.write(JSON.stringify({ meta:{ v:1, started:Date.now(), displayId:ctx.state.displayId } })+'\n');
  ctx.state.rec.enabled = true; ctx.state.rec.started = now(); ctx.state.rec.lastFile = file;
  ctx.tutor('Recording started'); ctx._hudPatch({ rec:'recording' });
}

function stopRecording(ctx) {
  if (!ctx.state.rec.enabled) return;
  ctx.state.rec.stream?.end();
  ctx.state.rec.enabled = false;
  ctx.tutor('Recording saved'); ctx._hudPatch({ rec:'idle' });
}

function playLastRecording(ctx) {
  const file = ctx.state.rec.lastFile || (()=>{
    const files = fs.readdirSync(recDir(ctx)).filter(f=>f.endsWith('.ndjson')).sort();
    return files.length ? path.join(recDir(ctx), files[files.length-1]) : null;
  })();
  if (!file) { ctx.tutor('No recording found'); return; }
  const lines = fs.readFileSync(file,'utf8').trim().split('\n').map(l=>{ try{return JSON.parse(l);}catch{return null;} }).filter(Boolean);
  const frames = lines.filter(o=>!o.meta).map(o=>o);
  if (!frames.length) { ctx.tutor('Recording empty'); return; }
  ctx.tutor('Replay started'); ctx._hudPatch({ rec:'replaying' });

  ctx.state.rec.replay = { idx:0, frames, t0: now() };
  const tick = async () => {
    const rp = ctx.state.rec.replay; if (!rp) return;
    if (rp.idx >= rp.frames.length) { ctx.state.rec.replay = null; ctx.tutor('Replay finished'); ctx._hudPatch({ rec:'idle' }); return; }
    const f = rp.frames[rp.idx];
    const delay = Math.max(0, (ctx.state.rec.replay.t0 + f.t) - now());
    setTimeout(async () => { await ctx._onReplayFrame(f); rp.idx++; tick(); }, delay);
  };
  tick();
}

function recorderCapture(ctx, iBox, hand) {
  if (!ctx.state.rec.enabled) return;
  const t = now() - ctx.state.rec.started;
  const norm = (vec)=> { const a = iBox.normalizePoint(vec, true); return { nx: clamp01(a[0]), ny: clamp01(a[1]) }; };
  const indexTip = hand.indexFinger?.stabilizedTipPosition ? norm(hand.indexFinger.stabilizedTipPosition) : norm(hand.stabilizedPalmPosition);
  const palm     = norm(hand.stabilizedPalmPosition);
  const fingers  = hand.fingers.map(f => { const p = norm(f.stabilizedTipPosition); return { nx: p.nx, ny: p.ny, extended: !!f.extended }; });
  const two = fingers.filter(f => f.extended).slice(0,2);
  const twoCenter = two.length === 2 ? { nx: (two[0].nx+two[1].nx)/2, ny:(two[0].ny+two[1].ny)/2 } : null;

  const rec = {
    t,
    hand: {
      pinch: hand.pinchStrength || 0,
      grab:  hand.grabStrength || 0,
      ext:   ctx.extCount(hand),
      roll:  hand.roll() || 0,
      pitch: hand.pitch() || 0,
      palmVelocity: hand.palmVelocity || [0,0,0],
      indexTip, palm, fingers, twoCenter
    }
  };
  ctx.state.rec.stream?.write(JSON.stringify(rec)+'\n');
}

module.exports = { startRecording, stopRecording, playLastRecording, recorderCapture };
