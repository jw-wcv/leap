function makeFakeIBox() {
    return {
      normalizePoint: (vec /* [x,y,z] */, clamp = true) => {
        // assume vec is already 0..1 for tests; passthrough
        return vec;
      }
    };
  }
  module.exports = { makeFakeIBox };
  