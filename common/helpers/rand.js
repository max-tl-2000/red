/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Math } from '../globals/math';

export default function rand(...args) {
  let min;
  let max;

  // if only one argument is provided we are expecting to have a value between 0 and max
  if (args.length === 1) {
    max = args[0];
    min = 0;
  }

  // two arguments provided mean we are expecting to have a number between min and max
  if (args.length >= 2) {
    min = args[0];
    max = args[1];

    if (min > max) {
      min = args[1];
      max = args[0];
    }
  }

  return Math.floor(Math.random() * (max - min)) + min;
}
