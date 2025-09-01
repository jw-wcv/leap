function setThreeFingerDrag(ctx, v){ ctx.opts.threeFingerDrag = !!v; ctx.onSave({ threeFingerDrag: ctx.opts.threeFingerDrag }); }
function setZoomWithCmdScrollOnPinch(ctx, v){ ctx.opts.zoomWithCmdScrollOnPinch = !!v; ctx.onSave({ zoomWithCmdScrollOnPinch: ctx.opts.zoomWithCmdScrollOnPinch }); }
function setProfilesAuto(ctx, v){ ctx.profilesAuto = !!v; ctx.profiles.setAuto(!!v); ctx.tutor(`Profiles: auto ${v?'ON':'OFF'}`); }
function reloadProfiles(ctx){ ctx.profiles.load(); ctx.tutor('Profiles reloaded'); }

module.exports = { setThreeFingerDrag, setZoomWithCmdScrollOnPinch, setProfilesAuto, reloadProfiles };
