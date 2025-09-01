const fs = require('fs');
const { execFileSync } = require('child_process');
const { keyChord } = require('../core/utils');
const { parseKey } = require('./keys');

function frontBundleId() {
  try {
    const out = execFileSync(
      'osascript',
      ['-e', 'tell application "System Events" to get bundle identifier of (first process whose frontmost is true)'],
      { encoding: 'utf8' }
    );
    return String(out || '').trim();
  } catch { return ''; }
}

class Profiles {
  constructor(profilesPath, onTutor) {
    this.path = profilesPath;
    this.data = { auto: true, profiles: { default: { name:'Default', overrides:{} } } };
    this.activeId = 'default';
    this.activeName = 'Default';
    this.auto = true;
    this.onTutor = onTutor || (()=>{});
  }
  load() {
    try {
      if (this.path && fs.existsSync(this.path)) {
        const obj = JSON.parse(fs.readFileSync(this.path,'utf8'));
        if (obj && obj.profiles) this.data = obj;
        this.auto = !!(obj.auto ?? true);
      }
    } catch {}
  }
  setAuto(v) { this.auto = !!v; }
  current() { return { id: this.activeId, name: this.activeName }; }
  getProfileFor(bundleId) {
    const p = this.data.profiles || {};
    return p[bundleId] || p['default'] || { name:'Default', overrides:{} };
  }
  activate(bundleId) {
    const prof = this.getProfileFor(bundleId || 'default');
    this.activeId = bundleId || 'default';
    this.activeName = prof.name || bundleId || 'Default';
    return prof;
  }
  async runBinding(binding) {
    if (!binding) return;
    if (binding.type === 'key' && Array.isArray(binding.keys)) {
      const ks = binding.keys.map(parseKey).filter(Boolean);
      if (ks.length) await keyChord(ks);
    }
  }
}

module.exports = { Profiles, frontBundleId };
