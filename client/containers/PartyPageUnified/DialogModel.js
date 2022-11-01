/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed } from 'mobx';

export default class DialogModel {
  @observable
  _open;

  constructor({ open } = {}) {
    this.setOpen(open);
  }

  @computed
  get isOpen() {
    return this._open;
  }

  @action
  setOpen = open => {
    this._open = open;
  };

  @action
  open = () => {
    this._open = true;
  };

  @action
  close = () => {
    this._open = false;
  };
}
