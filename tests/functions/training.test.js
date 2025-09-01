const { makeMockCtx } = require('../helpers/mockCtx');
const { trainerEnable, trainerSetLabel, trainerStart, trainerStopAndSave, trainerCapture } = require('../../src/functions/training');
const { makeHand } = require('../helpers/makeFrame');
const { makeFakeIBox } = require('../helpers/fakeIBox');
const fs = require('fs');
const path = require('path');

describe('training', () => {
  test('enable, capture, and save segment to gestures folder', () => {
    const ctx = makeMockCtx({ userDataPath: path.join(__dirname, '.tmp') });
    trainerEnable(ctx, true);
    trainerSetLabel(ctx, 'circle');
    trainerStart(ctx);
    trainerCapture(ctx, makeFakeIBox(), makeHand({ fingers:2 }));
    trainerStopAndSave(ctx);
    expect(ctx._events.tutorEvents.some(t=>/saved/.test(t))).toBe(true);
  });
});
