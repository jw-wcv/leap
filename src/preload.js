// src/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// ---- LEAP: gesture toggles for Settings/HUD -------------------------------
contextBridge.exposeInMainWorld('leap', {
  getGestures: () => ipcRenderer.invoke('gestures:get'),
  setGesture:  (name, value) => ipcRenderer.invoke('gestures:set', { name, value }),
  setGestures: (flags) => ipcRenderer.invoke('gestures:setMany', flags),
});

// ---- HUD: overlay updates, calibration, recorder, profiles, trainer -------
const hudChannels = {
  update: 'hud:update',
  toggle: 'hud:toggle',
  cal:    'hud:cal',
};

contextBridge.exposeInMainWorld('hud', {
  // Event subscriptions (return an unsubscribe fn to avoid leaks)
  onUpdate: (fn) => {
    const handler = (_e, data) => fn(data);
    ipcRenderer.on(hudChannels.update, handler);
    return () => ipcRenderer.removeListener(hudChannels.update, handler);
  },
  onToggle: (fn) => {
    const handler = (_e, visible) => fn(visible);
    ipcRenderer.on(hudChannels.toggle, handler);
    return () => ipcRenderer.removeListener(hudChannels.toggle, handler);
  },
  onCal: (fn) => {
    const handler = (_e, data) => fn(data);
    ipcRenderer.on(hudChannels.cal, handler);
    return () => ipcRenderer.removeListener(hudChannels.cal, handler);
  },

  // Actions (invoke -> main)
  calStart:   () => ipcRenderer.invoke('cal:start'),
  calCancel:  () => ipcRenderer.invoke('cal:cancel'),

  recStart:       () => ipcRenderer.invoke('rec:start'),
  recStop:        () => ipcRenderer.invoke('rec:stop'),
  recPlayLast:    () => ipcRenderer.invoke('rec:playLast'),
  recOpenFolder:  () => ipcRenderer.invoke('rec:openFolder'),

  profilesReload:    () => ipcRenderer.invoke('profiles:reload'),
  profilesSetAuto:   (v) => ipcRenderer.invoke('profiles:auto', v),

  // Trainer
  trainerEnable:     (v)      => ipcRenderer.invoke('trainer:enable', v),
  trainerStart:      ()       => ipcRenderer.invoke('trainer:start'),
  trainerStopSave:   ()       => ipcRenderer.invoke('trainer:stopSave'),
  trainerSetLabel:   (label)  => ipcRenderer.invoke('trainer:setLabel', label || ''),
  trainerOpenFolder: ()       => ipcRenderer.invoke('trainer:openFolder'),
  trainerReplayLast: ()       => ipcRenderer.invoke('trainer:replayLast'),
});
