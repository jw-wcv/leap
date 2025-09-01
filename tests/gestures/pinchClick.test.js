const { makeMockCtx } = require('../helpers/mockCtx');
const { pinchClickInit, handlePinchClick } = require('../../src/gestures/pinchClick');

describe('pinchClick', () => {
  test('single tap → left click', async () => {
    const ctx = makeMockCtx();
    pinchClickInit(ctx.state, ctx.persist, ctx.tutor);

    // emulate press+release
    await handlePinchClick(ctx, true);
    // quick tap
    ctx.state.pinchStartTs = Date.now() - (ctx.CFG?.pinchTapMs ?? 200) + 10;
    await handlePinchClick(ctx, false);

    // timer resolves next tick; fast-forward
    jest.runOnlyPendingTimers?.();
    expect(ctx.mouse.click).toHaveBeenCalledWith(ctx.Button.LEFT);
    expect(ctx._events.tutorEvents.at(-1)).toMatch(/Click/);
  });

  test('double tap → right click', async () => {
    jest.useFakeTimers();
    const ctx = makeMockCtx();
    pinchClickInit(ctx.state, ctx.persist, ctx.tutor);

    await handlePinchClick(ctx, true);
    ctx.state.pinchStartTs = Date.now(); await handlePinchClick(ctx, false);

    // second tap within window
    await handlePinchClick(ctx, true);
    ctx.state.pinchStartTs = Date.now(); await handlePinchClick(ctx, false);

    jest.runAllTimers();
    expect(ctx.mouse.click).toHaveBeenCalledWith(ctx.Button.RIGHT);
  });

  test('triple tap → middle click (if enabled)', async () => {
    jest.useFakeTimers();
    const ctx = makeMockCtx();
    ctx.persist.clicks.enableMiddleTriple = true;
    pinchClickInit(ctx.state, ctx.persist, ctx.tutor);

    for (let i=0;i<3;i++){
      await handlePinchClick(ctx, true);
      ctx.state.pinchStartTs = Date.now();
      await handlePinchClick(ctx, false);
    }
    jest.runAllTimers();
    expect(ctx.mouse.click).toHaveBeenCalledWith(ctx.Button.MIDDLE);
  });
});
