function makeFinger({ extended=true, tip=[0.5,0.5,0] } = {}) {
    return {
      extended,
      stabilizedTipPosition: tip
    };
  }
  
  function makeHand({
    pinch=0, grab=0, fingers=2,
    tip=[0.5,0.5,0],
    palmVelocity=[0,0,0],
    roll=()=>0, pitch=()=>0
  } = {}) {
    const fingerArr = Array.from({length:fingers}, (_,i)=>makeFinger({ extended:true, tip }));
    return {
      pinchStrength: pinch,
      grabStrength: grab,
      fingers: fingerArr,
      indexFinger: fingerArr[0],
      stabilizedPalmPosition: tip,
      palmVelocity,
      roll, pitch
    };
  }
  
  function makeFrame({ hands=1, handOpts={}, iBox } = {}) {
    return {
      hands: hands ? [makeHand(handOpts)] : [],
      interactionBox: iBox
    };
  }
  
  module.exports = { makeFrame, makeHand, makeFinger };
  