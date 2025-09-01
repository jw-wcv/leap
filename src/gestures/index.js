// src/gestures/index.js
const { pinchClickInit, handlePinchClick } = require('./pinchClick');
const { maybeStartDrag, startThreeDrag, endThreeDrag } = require('./drag');
const { handleTwoFingerScroll } = require('./scroll');
const { enterWindowMode, exitWindowMode, tickWindowMode } = require('./windowModes');
const { handleOsSwipes } = require('./osSwipes');
const { maybeSnapCycle, maybeMoveModeSnapSwipes } = require('./snapCycle');
const { tickDwell } = require('./dwellClick');
const { maybeThreeSwipeBinding } = require('./threeSwipeBindings');
const { handleTwoFingerZoom } = require('./zoom'); 

// Pinch bus + init
function mwPinch(ctx, next){ ctx.bus.on('gesture:pinch', (v)=>handlePinchClick(ctx, v)); pinchClickInit(ctx.state, ctx.persist, ctx.tutor); return next(); }

// Drag helpers
function mwDrag(ctx, next){ ctx.drag = { maybeStart: ()=>maybeStartDrag(ctx), start3: ()=>startThreeDrag(ctx), end3: ()=>endThreeDrag(ctx) }; return next(); }

// Two-finger scroll
function mwScroll(ctx, next){ ctx.scroll = { handle: (hand,iBox)=>handleTwoFingerScroll(ctx,hand,iBox) }; return next(); }

// Window modes + snapping
function mwWindow(ctx, next){
  ctx.window = {
    enter: (mode,ref,hand)=>enterWindowMode(ctx,mode,ref,hand),
    exit: ()=>exitWindowMode(ctx),
    tick: (pt,hand)=>tickWindowMode(ctx,pt,hand),
    snapCycle: (tap,ext)=>maybeSnapCycle(ctx,tap,ext),
    snapSwipes: (hand,dx,dy)=>maybeMoveModeSnapSwipes(ctx,hand,dx,dy)
  };
  return next();
}

// Dwell with disabled/stop support
function mwDwell(ctx, next) {
  ctx.dwell = {
    tick: (opts) => {
      if (opts && opts.disabled) { ctx.state.dwellAnchor = null; ctx.state.dwellStartTs = 0; return; }
      return tickDwell(ctx);
    },
    stop: () => { ctx.state.dwellAnchor = null; ctx.state.dwellStartTs = 0; }
  };
  return next();
}

// OS swipes + profile 3F bindings
function mwOsSwipes(ctx, next){ ctx.os = { swipes: (hand)=>handleOsSwipes(ctx,hand) }; return next(); }
function mwThreeSwipeBindings(ctx, next){ ctx.threeSwipe = { maybe: (hand,ext)=>maybeThreeSwipeBinding(ctx,hand,ext) }; return next(); }

function mwZoom(ctx, next) {
  ctx.zoom = { handle: (hand, iBox) => handleTwoFingerZoom(ctx, hand, iBox) };
  return next();
}

module.exports = [
  mwPinch,
  mwDrag,
  mwScroll,
  mwWindow,
  mwOsSwipes,
  mwThreeSwipeBindings,
  mwDwell,
  mwZoom,
];
