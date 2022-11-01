/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const win = window;
const nav = win.navigator;

export const polyfillMediaDevices = () => {
  if (nav.mediaDevices) {
    return;
  }
  // polifyll the lack of plivo
  nav.mediaDevices = {
    enumerateDevices: () => {
      if (win.Promise) return win.Promise.reject(0);
      return {}; // not sure what will happen in this case
    },
  };
};
