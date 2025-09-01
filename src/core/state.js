// src/core/state.js
function createState(initial) {
    const state = { ...initial };
    const get = () => state;
    const set = (patch) => Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
    const sel = (fn) => fn(state); // selector helper
    return { get, set, sel };
  }
  module.exports = { createState };
  