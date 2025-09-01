const { makeMockCtx } = require('../helpers/mockCtx');
const { enterWindowMode, exitWindowMode, tickWindowMode } = require('../../src/gestures/windowModes');

describe('windowModes', () => {
  test('move mode calls _axMoveBy with deltas', async () => {
    const ctx = makeMockCtx();
    enterWindowMode(ctx, 'move', { x: 100, y: 100 }, { roll:()=>0, pitch:()=>0 });
    await tickWindowMode(ctx, { x: 130, y: 80 }, { roll:()=>0, pitch:()=>0 });
    expect(ctx._axMoveBy).toHaveBeenCalledWith(30, -20);
  });

  test('resize mode reacts to wrist roll/pitch', async () => {
    const ctx = makeMockCtx();
    enterWindowMode(ctx, 'resize', { x: 0, y: 0 }, { roll:()=>0, pitch:()=>0 });
    await tickWindowMode(ctx, { x: 0, y: 0 }, { roll:()=>0.1, pitch:()=>-0.05 });
    expect(ctx._axResizeBy).toHaveBeenCalled(); // actual numbers depend on CFG gains
  });

  test('exit resets mode', () => {
    const ctx = makeMockCtx();
    enterWindowMode(ctx, 'move', { x: 0, y: 0 }, { roll:()=>0, pitch:()=>0 });
    exitWindowMode(ctx);
    expect(ctx.state.windowMode).toBe('none');
  });
});
