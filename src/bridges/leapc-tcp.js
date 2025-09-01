// src/bridges/leapc-tcp.js
// Reads newline-delimited JSON frames from the C middleware and maps to a LeapJS-ish frame.

const net = require('net');
const { EventEmitter } = require('events');

function createLeapCBridge({
  host = '127.0.0.1',
  port = 8000,
  // Rough desktop bounds to normalize InteractionBox mapping
  mmBounds = { x: [-120, 120], y: [0, 300], z: [-120, 120] },
} = {}) {
  const bus = new EventEmitter();
  let sock = null, buf = '';

  const iBox = {
    normalizePoint(pt, clamp = true) {
      const x = Array.isArray(pt) ? pt[0] : (pt?.x ?? 0);
      const y = Array.isArray(pt) ? pt[1] : (pt?.y ?? 0);
      const z = Array.isArray(pt) ? pt[2] : (pt?.z ?? 0);
      const nx = (x - mmBounds.x[0]) / (mmBounds.x[1] - mmBounds.x[0]);
      const ny = (y - mmBounds.y[0]) / (mmBounds.y[1] - mmBounds.y[0]);
      const nz = (z - mmBounds.z[0]) / (mmBounds.z[1] - mmBounds.z[0]);
      const clip = v => (clamp ? Math.max(0, Math.min(1, v)) : v);
      return [clip(nx), clip(ny), clip(nz)];
    },
  };

  function mapHand(raw) {
    // raw:
    // { id, type:"left"|"right", palmPosition:[x,y,z],
    //   grab, pinch, pinchDistance, grabAngle,
    //   palmStab:[x,y,z], palmVel:[x,y,z], palmQuat:[x,y,z,w],
    //   fingers:{ thumb:[x,y,z], ... }, fingerExtended:{ thumb:true, ... } }

    const order = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    const mkTip = (name) => {
      const tip = raw.fingers?.[name];
      if (Array.isArray(tip) && tip.length >= 3) return [tip[0], tip[1], tip[2]];
      const p = raw.palmPosition || [0, 0, 0];
      return [p[0], p[1], p[2]];
    };
    const mkExt = (name) => (raw.fingerExtended && Object.prototype.hasOwnProperty.call(raw.fingerExtended, name))
      ? !!raw.fingerExtended[name] : false;

    const fingers = order.map((name) => ({
      type: name === 'thumb' ? 0 :
            name === 'index' ? 1 :
            name === 'middle' ? 2 :
            name === 'ring' ? 3 : 4,
      stabilizedTipPosition: mkTip(name),
      extended: mkExt(name),
    }));

    // Provide indexFinger shortcut used by engine
    const indexTip = mkTip('index');

    return {
      id: raw.id,
      type: raw.type === 'left' ? 0 : 1,
      palmPosition: raw.palmPosition || [0, 0, 0],

      // New goodies (optional; engine can adopt gradually)
      palmVelocity:   raw.palmVel   || [0, 0, 0],
      palmStabilized: raw.palmStab  || raw.palmPosition || [0, 0, 0],
      palmQuaternion: raw.palmQuat  || [0, 0, 0, 1],
      pinchDistance:  typeof raw.pinchDistance === 'number' ? raw.pinchDistance : 0,
      grabAngle:      typeof raw.grabAngle     === 'number' ? raw.grabAngle     : 0,

      pinchStrength:  typeof raw.pinch === 'number' ? raw.pinch : 0,
      grabStrength:   typeof raw.grab  === 'number' ? raw.grab  : 0,

      indexFinger: { stabilizedTipPosition: indexTip },
      fingers,
    };
  }

  function connect() {
    sock = net.createConnection({ host, port }, () => {
      bus.emit('connect');
    });

    sock.on('data', (data) => {
      buf += data.toString('utf8');
      const parts = buf.split('\n');
      buf = parts.pop(); // keep remainder

      for (const line of parts) {
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }

        const hands = Array.isArray(msg.hands) ? msg.hands.map(mapHand) : [];
        const frame = {
          type: 'frame',
          id: msg.frameId,
          hands,
          interactionBox: iBox,
          // fps is optional; engine can read it if desired
          fps: typeof msg.framerate === 'number' ? msg.framerate : undefined,
        };

        // Uncomment to inspect the first mapped hand:
        // if (!createLeapCBridge._dbg && hands.length) {
        //   createLeapCBridge._dbg = true;
        //   console.log('[leapc-tcp] sample hand:', JSON.stringify(hands[0], null, 2));
        // }

        bus.emit('frame', frame);
      }
    });

    sock.on('close', () => {
      bus.emit('disconnect');
      setTimeout(connect, 500);
    });

    sock.on('error', (e) => bus.emit('error', e));
  }

  connect();

  return {
    on: (...args) => { bus.on(...args); return this; },
    reportFocus() {},
    setBackground() {},
    disconnect() { try { sock?.destroy(); } catch {} },
  };
}

module.exports = { createLeapCBridge };
