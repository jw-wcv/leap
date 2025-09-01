const { now } = require('./utils');

// Gesture Conflict Resolver
class GCR {
  constructor() { this.lock = null; this.lockTs = 0; this.lastExt = null; }
  acquire(name, ext) {
    if (!this.lock) { this.lock = name; this.lockTs = now(); this.lastExt = ext; return true; }
    return this.lock === name;
  }
  canSwitch(ext) {
    if (!this.lock) return true;
    if (this.lastExt !== ext) { this.release(); return true; }
    return false;
  }
  release() { this.lock = null; this.lockTs = 0; this.lastExt = null; }
  current() { return this.lock; }
}

module.exports = GCR;
