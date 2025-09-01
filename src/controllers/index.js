// src/controllers/index.js
const { createLeapCBridge } = require('../bridges/leapc-tcp');
const { LeapWSCompat } = require('../bridges/leap-ws-compat');

function createController() {
  const useLeapC = process.env.USE_LEAPC_BRIDGE === '1';
  if (useLeapC) return createLeapCBridge({ host: '127.0.0.1', port: 8000 });

  // WS fallback (versioned endpoint first)
  const ctl = new LeapWSCompat({ url: 'ws://127.0.0.1:6437/v7.json' });
  ctl.connect();
  return ctl;
}

module.exports = { createController };
