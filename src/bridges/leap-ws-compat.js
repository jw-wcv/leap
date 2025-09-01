// src/bridges/leap-ws-compat.js
const { EventEmitter } = require('events');
const WebSocket = require('ws');

class LeapWSCompat extends EventEmitter {
  constructor({ url, protocols, timeoutMs = 3000 }) {
    super();
    this.url = url;
    this.protocols = protocols;
    this.timeoutMs = timeoutMs;
    this.ws = null;
    this._ka = null;
  }

  _blastVersions() {
    const versions = [7,6,5,4,3,2,1];
    const payloads = [];
    for (const v of versions) {
      payloads.push(JSON.stringify({ version: v }));
      payloads.push(String(v));
      payloads.push(JSON.stringify(String(v)));
      payloads.push(`version ${v}`);
      payloads.push(String(v) + '\n');
      payloads.push(Buffer.from(String(v) + '\n', 'utf8'));
    }
    const sendAll = () => payloads.forEach(p => { try { this.ws.send(p); } catch {} });
    sendAll(); setTimeout(sendAll, 40); setTimeout(sendAll, 120);
  }

  connect() {
    this.ws = new WebSocket(this.url, this.protocols && this.protocols.length ? this.protocols : undefined, {
      perMessageDeflate: false, handshakeTimeout: this.timeoutMs,
      headers: { 'User-Agent': 'UltraleapWS/compat' }
    });

    this.ws.on('open', () => {
      this._blastVersions();
      this._ka = setInterval(() => { try { this.ws.send('{"keepalive":true}'); } catch {} }, 25000);
      this.emit('connect');
    });

    this.ws.on('message', (data) => {
      let msg; try { msg = JSON.parse(data.toString()); } catch { return; }
      let frame = null;
      if (msg?.event === 'frame' && msg.frame) frame = msg.frame;
      else if (msg?.type === 'frame') frame = msg;
      else if (Array.isArray(msg?.hands)) frame = msg;
      if (!frame) return;

      const iBox = frame.interactionBox && typeof frame.interactionBox.normalizePoint === 'function'
        ? frame.interactionBox
        : { normalizePoint: (pt, clamp = true) => {
            const x = Array.isArray(pt) ? pt[0] : (pt?.x ?? 0);
            const y = Array.isArray(pt) ? pt[1] : (pt?.y ?? 0);
            const z = Array.isArray(pt) ? pt[2] : (pt?.z ?? 0);
            const looksUnit = Math.abs(x) <= 1.2 && Math.abs(y) <= 1.2 && Math.abs(z) <= 1.2;
            let nx = looksUnit ? x : (x + 120) / 240;
            let ny = looksUnit ? y : (y + 120) / 240;
            let nz = looksUnit ? z : (z + 120) / 240;
            if (clamp) { nx=Math.max(0,Math.min(1,nx)); ny=Math.max(0,Math.min(1,ny)); nz=Math.max(0,Math.min(1,nz)); }
            return [nx,ny,nz];
          } };
      frame.interactionBox = iBox;

      if (Array.isArray(frame.hands)) {
        for (const h of frame.hands) {
          h.pinchStrength = h.pinchStrength ?? h.pinch ?? 0;
          h.grabStrength  = h.grabStrength  ?? h.grab  ?? 0;
          if (!h.indexFinger && h.index) h.indexFinger = h.index;
          if (!h.indexFinger && Array.isArray(h.fingers)) {
            h.indexFinger = h.fingers.find(f => (f.type === 'index' || f.type === 1)) || h.fingers[1];
          }
          if (h.indexFinger && !h.indexFinger.stabilizedTipPosition && h.indexFinger.tipPosition) {
            h.indexFinger.stabilizedTipPosition = h.indexFinger.tipPosition;
          }
          if (!Array.isArray(h.fingers) && Array.isArray(h.digits)) h.fingers = h.digits;
          if (Array.isArray(h.fingers)) for (const f of h.fingers) if (typeof f.extended === 'undefined') f.extended = !!f.isExtended;
        }
      }
      this.emit('frame', frame);
    });

    this.ws.on('close', () => { if (this._ka) clearInterval(this._ka); this.emit('disconnect'); });
    this.ws.on('error', (err) => this.emit('error', err));
  }

  disconnect() { if (this._ka) clearInterval(this._ka); try { this.ws?.close(); } catch {} }
  reportFocus() {}
  setBackground() {}
}

module.exports = { LeapWSCompat };
