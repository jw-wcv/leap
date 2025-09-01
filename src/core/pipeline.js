// src/core/pipeline.js
function compose(middlewares) {
    return function run(ctx) {
      let i = -1;
      const dispatch = (idx) => {
        if (idx <= i) return Promise.reject(new Error('next() called multiple times'));
        i = idx;
        const fn = middlewares[idx];
        if (!fn) return Promise.resolve();
        return Promise.resolve(fn(ctx, () => dispatch(idx + 1)));
      };
      return dispatch(0);
    };
  }
  module.exports = { compose };
  