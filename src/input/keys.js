// const { Key } = require('nut-js');
// const { Key } = require('@nut-tree/nut-js');
const { Key } = require('@hurdlegroup/robotjs');


// name → nut-js Key
function parseKey(name) {
  if (Key[name]) return Key[name];
  const upper = name.length === 1 ? name.toUpperCase() : name;
  if (Key[upper]) return Key[upper];
  const alias = {
    Cmd:'LeftSuper', Command:'LeftSuper', Super:'LeftSuper', Win:'LeftSuper',
    Ctrl:'LeftControl', Control:'LeftControl',
    Alt:'LeftAlt', Option:'LeftAlt',
    Enter:'Return', Return:'Return', Esc:'Escape',
    PgUp:'PageUp', PgDown:'PageDown',
    LeftArrow:'Left', RightArrow:'Right', UpArrow:'Up', DownArrow:'Down'
  };
  const a = alias[name] || alias[upper];
  if (a && Key[a]) return Key[a];
  return null;
}

module.exports = { parseKey };
