/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable } from 'mobx';
import { screenIsAtLeast, screenIsAtMost, initLayoutHelper, sizes } from '../../client/helpers/layout';

export const screen = observable({
  size: '',
  get isXSmall() {
    return this.size.match(/xsmall1|xsmall2/);
  },
  get isSmall() {
    return this.size.match(/small1|small2/);
  },
  get isAtLeastXSmall1() {
    return screenIsAtLeast(this.size, sizes.xsmall1);
  },
  get isAtLeastXSmall2() {
    return screenIsAtLeast(this.size, sizes.xsmall2);
  },
  get isAtLeastSmall1() {
    return screenIsAtLeast(this.size, sizes.small1);
  },
  get isAtLeastSmall2() {
    return screenIsAtLeast(this.size, sizes.small2);
  },
  get isAtLeastMedium() {
    return screenIsAtLeast(this.size, sizes.medium);
  },
  get isAtLeastLarge() {
    return screenIsAtLeast(this.size, sizes.large);
  },
  get isAtLeastXLarge() {
    return screenIsAtLeast(this.size, sizes.xlarge);
  },
  get isAtMostXSmall1() {
    return screenIsAtMost(this.size, sizes.xsmall1);
  },
  get isAtMostXSmall2() {
    return screenIsAtMost(this.size, sizes.xsmall2);
  },
  get isAtMostSmall1() {
    return screenIsAtMost(this.size, sizes.small1);
  },
  get isAtMostSmall2() {
    return screenIsAtMost(this.size, sizes.small2);
  },
  get isAtMostMedium() {
    return screenIsAtMost(this.size, sizes.medium);
  },
  get isAtMostLarge() {
    return screenIsAtMost(this.size, sizes.large);
  },
  get isAtMostXLarge() {
    return screenIsAtMost(this.size, sizes.xlarge);
  },
});

initLayoutHelper(size => {
  screen.size = size;
});
