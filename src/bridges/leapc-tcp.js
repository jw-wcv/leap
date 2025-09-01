// src/bridges/leapc-tcp.js
const net = require('net');
const { EventEmitter } = require('events');

function createLeapCBridge({ host = '127.0.0.1', port = 8000, mmBounds = { x: [-120, 120], y: [0, 300], z: [-120, 120] } } = {}) {
  const bus = new EventEmitter();
  let sock = null, buf = '';

  // normalizePoint compatible with LeapJS InteractionBox
  const iBox = {
    normalizePoint(pt, clamp = true) {
      // pt can be [x,y,z] or {x,y,z}; positions are in millimeters from the middleware
      const x = Array.isArray(pt) ? pt[0] : (pt?.x ?? 0);
      const y = Array.isArray(pt) ? pt[1] : (pt?.y ?? 0);
      const z = Array.isArray(pt) ? pt[2] : (pt?.z ?? 0);
      const nx = (x - mmBounds.x[0]) / (mmBounds.x[1] - mmBounds.x[0]);
      const ny = (y - mmBounds.y[0]) / (mmBounds.y[1] - mmBounds.y[0]);
      const nz = (z - mmBounds.z[0]) / (mmBounds.z[1] - mmBounds.z[0]);
      const clip = v => clamp ? Math.max(0, Math.min(1, v)) : v;
      return [clip(nx), clip(ny), clip(nz)];
    }
  };

  function mapHand(raw) {
    // Shape to a LeapJS-ish hand
    const mkFinger = (tip) => ({
      // include minimal fields used by your engine
      stabilizedTipPosition: [tip[0], tip[1], tip[2]],
      extended: true
    });
    const fingers = [];
    const order = ['thumb','index','middle','ring','pinky'];
    for (const name of order) fingers.push({ type: name === 'thumb' ? 0 : name === 'index' ? 1 : name === 'middle' ? 2 : name === 'ring' ? 3 : 4,
      stabilizedTipPosition: raw.fingers?.[name] ?? [raw.palmPosition[0], raw.palmPosition[1], raw.palmPosition[2]],
      extended: true });

    return {
      id: raw.id,
      type: raw.type === 'left' ? 0 : 1,         // left=0, right=1
      pinchStrength: 0, grabStrength: 0,        // not provided by middleware; keep 0
      palmVelocity: [0,0,0],                    // optional
      palmPosition: raw.palmPosition,           // mm
      indexFinger: { stabilizedTipPosition: raw.fingers?.index ?? raw.palmPosition },
      fingers
    };
  }

  function connect() {
    sock = net.createConnection({ host, port }, () => {
      bus.emit('connect');
    });
    sock.on('data', (data) => {
      buf += data.toString('utf8');
      const parts = buf.split('\n');
      buf = parts.pop(); // remainder
      for (const line of parts) {
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        // Expect { frameId, hands: [ {id,type,palmPosition,fingers:{...}} ] }
        const frame = {
          type: 'frame',
          id: msg.frameId,
          hands: (msg.hands || []).map(mapHand),
          interactionBox: iBox
        };
        bus.emit('frame', frame);
      }
    });
    sock.on('close', () => { bus.emit('disconnect'); setTimeout(connect, 500); });
    sock.on('error', (e) => bus.emit('error', e));
  }

  connect();

  // Minimal LeapJS-compatible surface
  return {
    on: (...args) => { bus.on(...args); return this; },
    reportFocus() {},
    setBackground() {},
    disconnect() { try { sock?.destroy(); } catch {} }
  };
}

module.exports = { createLeapCBridge };
