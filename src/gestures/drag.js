// src/gestures/drag.js
async function maybeStartDrag(ctx) {
    const { state, mouse, tutor } = ctx;
    if (!state.dragging) { await mouse.pressButton(ctx.Button.LEFT); state.dragging = true; tutor('Drag start'); }
  }
  
  async function endThreeDrag(ctx) {
    const { state, mouse, tutor } = ctx;
    if (state.threeDrag) { await mouse.releaseButton(ctx.Button.LEFT); state.threeDrag = false; tutor('3-finger drag end'); }
  }
  
  async function startThreeDrag(ctx) {
    const { state, mouse, tutor } = ctx;
    if (!state.threeDrag) { await mouse.pressButton(ctx.Button.LEFT); state.threeDrag = true; tutor('3-finger drag'); }
  }
  
  module.exports = { maybeStartDrag, startThreeDrag, endThreeDrag };
  