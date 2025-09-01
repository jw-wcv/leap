// src/functions/index.js
const rec = require('./recorder');
const trn = require('./training');
const cal = require('./calibration');

function mwRecorder(ctx, next){
  ctx.recorder = {
    start: ()=>rec.startRecording(ctx),
    stop: ()=>rec.stopRecording(ctx),
    play: ()=>rec.playLastRecording(ctx),
    capture: (iBox,hand)=>rec.recorderCapture(ctx,iBox,hand)
  };
  return next();
}
function mwTrainer(ctx, next){
  ctx.trainer = {
    enable: (v)=>trn.trainerEnable(ctx,v),
    setLabel: (s)=>trn.trainerSetLabel(ctx,s),
    start: ()=>trn.trainerStart(ctx),
    stopSave: ()=>trn.trainerStopAndSave(ctx),
    replayLast: ()=>trn.trainerReplayLast(ctx),
    capture: (iBox,hand)=>trn.trainerCapture(ctx,iBox,hand)
  };
  return next();
}
function mwCalibration(ctx, next){
  ctx.calib = {
    start: ()=>cal.startCalibration(ctx),
    cancel: ()=>cal.cancelCalibration(ctx),
    finish: ()=>cal.finishCalibration(ctx),
    map: (nx,ny)=>cal.mapToScreen(ctx,nx,ny)
  };
  // expose as _mapToScreen for existing code compatibility
  ctx._mapToScreen = (nx,ny)=>cal.mapToScreen(ctx,nx,ny);
  return next();
}

module.exports = [mwRecorder, mwTrainer, mwCalibration];
