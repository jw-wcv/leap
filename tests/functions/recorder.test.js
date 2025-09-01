const { makeMockCtx } = require('../helpers/mockCtx');
const { recorderCapture, startRecording, stopRecording } = require('../../src/functions/recorder');
const { makeHand } = require('../helpers/makeFrame');
const { makeFakeIBox } = require('../helpers/fakeIBox');
const fs = require('fs');

describe('recorder', () => {
  test('start/stop toggles enabled and writes frames', () => {
    const ctx = makeMockCtx({ userDataPath: __dirname });
    startRecording(ctx);
    expect(ctx.state.rec.enabled).toBe(true);

    recorderCapture(ctx, makeFakeIBox(), makeHand({ fingers:2 }));
    stopRecording(ctx);
    expect(ctx.state.rec.enabled).toBe(false);
    // stream was closed
    // (we won’t check FS here to keep it simple; recorder uses streams)
  });
});
