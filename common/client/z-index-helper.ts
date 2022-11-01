/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action } from 'mobx';

export class ZIndexHelper {
  @observable _zIndex = undefined;

  @action
  clearZIndex() {
    this._zIndex = undefined;
  }

  getZIndex() {
    return this._zIndex;
  }

  @action
  setZIndex(zIndex) {
    this._zIndex = zIndex;
  }

  set zIndex(zIndex) {
    this.setZIndex(zIndex);
  }

  get zIndex() {
    return this._zIndex;
  }
}
