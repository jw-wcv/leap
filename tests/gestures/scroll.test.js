const { makeMockCtx } = require('../helpers/mockCtx');
const { makeFrame, makeHand } = require('../helpers/makeFrame');
const { makeFakeIBox } = require('../helpers/fakeIBox');
const { handleTwoFingerScroll } = require('../../src/gestures/scroll');

describe('scroll', () => {
  test('2F scroll emits vertical scroll calls and primes inertia', async () => {
    const ctx = makeMockCtx();
    const iBox = makeFakeIBox();
    // first call sets last center (no scroll yet)
    await handleTwoFingerScroll(ctx, makeHand({ fingers:2, tip:[0.5,0.6,0] }), iBox);
    // move fingers up (screen coords y decreases => negative dy => scrollDown positive)
    await handleTwoFingerScroll(ctx, makeHand({ fingers:2, tip:[0.5,0.7,0] }), iBox);

    // one of scrollUp/Down must be called
    expect(ctx.mouse.scrollUp).toHaveBeenCalledTimes(1);
    // inertia primed
    expect(ctx.state.inertia.active).toBe(true);
  });

  test('with pinch > 0.7 holds Cmd during scroll (zoom)', async () => {
    const ctx = makeMockCtx({ opts: { ...makeMockCtx().opts, zoomWithCmdScrollOnPinch: true } });
    const iBox = makeFakeIBox();
    await handleTwoFingerScroll(ctx, makeHand({ fingers:2, tip:[0.5,0.5,0], pinch:0.8 }), iBox);
    // still no delta (first call), do second with move
    await handleTwoFingerScroll(ctx, makeHand({ fingers:2, tip:[0.6,0.5,0], pinch:0.8 }), iBox);
    // zoom path: we expect press/release of Cmd
    expect(ctx.keyboard.pressKey).toHaveBeenCalled();
    expect(ctx.keyboard.releaseKey).toHaveBeenCalled();
  });
});
