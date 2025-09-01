// src/core/bus.js
const { EventEmitter } = require('events');
function createBus() {
  const ee = new EventEmitter();
  return {
    on: (evt, fn) => (ee.on(evt, fn), () => ee.off(evt, fn)),
    emit: (evt, payload) => ee.emit(evt, payload),
    removeAll: () => ee.removeAllListeners()
  };
}
module.exports = { createBus };
