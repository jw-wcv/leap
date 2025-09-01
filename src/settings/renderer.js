(async function () {
    const $ = (id) => document.getElementById(id);
  
    const cfg = await window.settings.load();
  
    // set defaults if missing
    const pg = cfg.pointerGain || { enabled:true, gainMin:1.0, gainMax:2.2, velLow:200, velHigh:1000 };
    const si = cfg.scrollInertia || { enabled:true, decay:0.90, burstScale:0.05, minStep:1 };
    const dw = cfg.dwell || { enabled:true, ms:650, radiusPx:10, cooldownMs:800 };
    const ck = cfg.clicks || { doublePinchMs:350, enableMiddleTriple:true };
  
    // toggles
    $('threeFingerDrag').checked = !!cfg.threeFingerDrag;
    $('zoomWithCmdScrollOnPinch').checked = !!cfg.zoomWithCmdScrollOnPinch;
    $('profilesAuto').checked = !!cfg.profilesAuto;
  
    // pointer gain
    $('pg_gainMin').value = pg.gainMin;
    $('pg_gainMax').value = pg.gainMax;
    $('pg_velLow').value  = pg.velLow;
    $('pg_velHigh').value = pg.velHigh;
  
    // inertia
    $('si_enabled').checked   = !!si.enabled;
    $('si_decay').value       = si.decay;
    $('si_burstScale').value  = si.burstScale;
    $('si_minStep').value     = si.minStep;
  
    // dwell
    $('dw_enabled').checked   = !!dw.enabled;
    $('dw_ms').value          = dw.ms;
    $('dw_radiusPx').value    = dw.radiusPx;
    $('dw_cooldownMs').value  = dw.cooldownMs;
  
    // clicks
    $('ck_doublePinchMs').value         = ck.doublePinchMs;
    $('ck_enableMiddleTriple').checked  = !!ck.enableMiddleTriple;
  
    // window control
    $('wc_windowMoveScale').value   = cfg.windowMoveScale ?? 1.0;
    $('wc_windowResizeScale').value = cfg.windowResizeScale ?? 1.0;
  
    // thresholds
    $('th_swipeMinVel').value       = cfg.swipeMinVel ?? 900;
    $('th_moveSnapSwipeVel').value  = cfg.moveSnapSwipeVel ?? 800;
  
    // info
    $('info_smoothing').textContent = (cfg.smoothing ?? 0.22).toString();
  
    $('btnSave').onclick = async () => {
      const patch = {
        threeFingerDrag: $('threeFingerDrag').checked,
        zoomWithCmdScrollOnPinch: $('zoomWithCmdScrollOnPinch').checked,
        profilesAuto: $('profilesAuto').checked,
  
        pointerGain: {
          gainMin: parseFloat($('pg_gainMin').value),
          gainMax: parseFloat($('pg_gainMax').value),
          velLow:  parseFloat($('pg_velLow').value),
          velHigh: parseFloat($('pg_velHigh').value),
          enabled: true
        },
        scrollInertia: {
          enabled:  $('si_enabled').checked,
          decay:    parseFloat($('si_decay').value),
          burstScale: parseFloat($('si_burstScale').value),
          minStep:  parseInt($('si_minStep').value, 10)
        },
        dwell: {
          enabled:  $('dw_enabled').checked,
          ms:       parseInt($('dw_ms').value, 10),
          radiusPx: parseInt($('dw_radiusPx').value, 10),
          cooldownMs: parseInt($('dw_cooldownMs').value, 10)
        },
        clicks: {
          doublePinchMs: parseInt($('ck_doublePinchMs').value, 10),
          enableMiddleTriple: $('ck_enableMiddleTriple').checked
        },
        windowMoveScale:   parseFloat($('wc_windowMoveScale').value),
        windowResizeScale: parseFloat($('wc_windowResizeScale').value),
        swipeMinVel:       parseInt($('th_swipeMinVel').value, 10),
        moveSnapSwipeVel:  parseInt($('th_moveSnapSwipeVel').value, 10),
      };
  
      await window.settings.save(patch);
    };
  
    $('btnOpenCfg').onclick = () => window.settings.openConfigFolder();
  })();
  