/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const asyncIterate = (items, { itemCb, done, delay = 1000 } = {}) => {
  if (!Array.isArray(items)) {
    throw new Error('first argument must be an array');
  }
  if (typeof itemCb !== 'function') {
    throw new Error('itemCb callback is required');
  }

  const len = items.length;
  let index = 0;

  if (len === 0) {
    done && done();
    return;
  }

  const process = () => {
    const item = items[index];
    itemCb({ item, index }, () => {
      index++;
      if (index === len) {
        done && done();
        return;
      }
      setTimeout(process, delay);
    });
  };
  process();
};

export const iterateOverArray = (items = [], args) => {
  const { chunkSize = 100, onChunk, done } = args;
  const { length } = items;

  const totalGroups = Math.ceil(length / chunkSize);
  let processed = 0;
  let cancelled = false;
  let iterationDone = false;

  const process = () => {
    if (cancelled) {
      return;
    }

    if (processed === totalGroups) {
      iterationDone = true;
      done && done();
      return;
    }

    const from = processed * chunkSize;
    const to = from + chunkSize;
    const arr = items.slice(from, to);

    setTimeout(() => {
      if (cancelled) return;
      onChunk &&
        onChunk({ arr, from, to: to - 1 }, () => {
          processed++;
          setTimeout(process);
        });
    });
  };

  process();

  return () => {
    if (iterationDone || cancelled) return;
    cancelled = true;
  };
};
