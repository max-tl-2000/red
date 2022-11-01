/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

describe('async-iterate', () => {
  let iterate;
  let iterateOverArray;

  beforeEach(() => {
    const iterateImport = require('../async-iterate'); // eslint-disable-line
    iterate = iterateImport.asyncIterate;
    iterateOverArray = iterateImport.iterateOverArray;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('asyncIterate', () => {
    it('should throw an error if no itemCb provided', () => {
      expect(() => {
        iterate([]);
      }).toThrow('itemCb callback is required');
    });

    it('should throw an error if first argument is not an array', () => {
      expect(() => {
        iterate(null);
      }).toThrow('first argument must be an array');
    });

    it('should iterate over the array with a configurable delay', cb => {
      const spy = jest.fn();
      iterate([1, 2, 3, 4], {
        itemCb: ({ item, index }, callback) => {
          spy(item, index);
          callback();
        },
        delay: 16, // shortest frame
        done: () => {
          expect(spy).toHaveBeenCalledTimes(4);
          expect(spy).lastCalledWith(4, 3);
          cb();
        },
      });
    });
  });

  describe('iterateOverArray', () => {
    it('should iterate over the array by chunks', cb => {
      const spy = jest.fn();
      const data = Array.from(Array(24), (_, x) => x);
      iterateOverArray(data, {
        chunkSize: 5,
        onChunk: ({ arr }, next) => {
          spy(arr);
          next && next();
        },
        done: () => {
          expect(spy).toHaveBeenCalledTimes(5);
          expect(spy).toHaveBeenNthCalledWith(1, [0, 1, 2, 3, 4]);
          expect(spy).toHaveBeenNthCalledWith(5, [20, 21, 22, 23]);
          cb();
        },
      });
    });
  });
});
