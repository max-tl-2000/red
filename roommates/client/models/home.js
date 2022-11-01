/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action } from 'mobx';

export default class HomeModel {
  @observable
  showNotAllowedMessage;

  constructor({ showNotAllowedMessage }) {
    this.showNotAllowedMessage = showNotAllowedMessage || false;
  }

  @action
  setShowNotAllowedMessage(value) {
    this.showNotAllowedMessage = value;
  }
}
