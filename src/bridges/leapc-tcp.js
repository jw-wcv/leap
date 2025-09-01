// src/bridges/leapc-tcp.js
const net = require('net');
const { EventEmitter } = require('events');

function createLeapCBridge({
  host = '127.0.0.1',
  port = 8000,
  mmBounds = { x: [-120, 120], y: [0, 300], z: [-120, 120] },
} = {}) {
  const bus = new EventEmitter();
  let sock = null, buf = '';

  // normalizePoint compatible with LeapJS InteractionBox
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

  // Map one hand from middleware JSON -> LeapJS-ish hand object
  function mapHand(raw) {
    // Raw shape we emit from C:
    // {
    //   id, type: "left"|"right",
    //   palmPosition: [x,y,z],
    //   grab: <float>, pinch: <float>,
    //   fingers: { thumb:[x,y,z], index:[x,y,z], ... },
    //   fingerExtended: { thumb:true/false, ... }   // optional
    // }

    const order = ['thumb', 'index', 'middle', 'ring', 'pinky'];

    const mkTip = (name) => {
      const tip = raw.fingers?.[name];
      if (Array.isArray(tip) && tip.length >= 3) return [tip[0], tip[1], tip[2]];
      const p = raw.palmPosition || [0, 0, 0];
      return [p[0], p[1], p[2]];
    };

    const mkExtended = (name) => {
      // Prefer explicit fingerExtended map; fall back to true (legacy)
      if (raw.fingerExtended && Object.prototype.hasOwnProperty.call(raw.fingerExtended, name)) {
        return !!raw.fingerExtended[name];
      }
      // If C side hasn’t been updated yet, be conservative: treat as false
      return false;
    };

    const fingers = order.map((name) => ({
      type:
        name === 'thumb' ? 0 :
        name === 'index' ? 1 :
        name === 'middle' ? 2 :
        name === 'ring' ? 3 : 4,
      stabilizedTipPosition: mkTip(name),
      extended: mkExtended(name),
    }));

    // Provide indexFinger shortcut used by your engine
    const indexTip = mkTip('index');

    return {
      id: raw.id,
      type: raw.type === 'left' ? 0 : 1, // left=0, right=1
      palmPosition: raw.palmPosition || [0, 0, 0],
      palmVelocity: [0, 0, 0], // not sent from C; keep neutral
      pinchStrength: typeof raw.pinch === 'number' ? raw.pinch : 0,
      grabStrength: typeof raw.grab === 'number' ? raw.grab : 0,
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

        // Expect { frameId, hands: [...] }
        const hands = Array.isArray(msg.hands) ? msg.hands.map(mapHand) : [];
        const frame = {
          type: 'frame',
          id: msg.frameId,
          hands,
          interactionBox: iBox,
        };

        // Optional: first-frame debug (uncomment to inspect what JS receives)
        // if (!createLeapCBridge._dbgPrinted && hands.length) {
        //   createLeapCBridge._dbgPrinted = true;
        //   console.log('[leapc-tcp] sample hand', JSON.stringify(hands[0], null, 2));
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
