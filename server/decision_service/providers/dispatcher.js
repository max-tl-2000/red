/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DSInputBuilder } from '../adapters/builders/DSInputBuilder';

export default class Dispatcher {
  constructor(dispatcherProviderMode) {
    this.dispatcherProviderMode = dispatcherProviderMode;
  }

  get defaultDSInputBuilder() {
    if (this._defaultDSInputBuilder) return this._defaultDSInputBuilder;

    this._defaultDSInputBuilder = new DSInputBuilder();
    return this._defaultDSInputBuilder;
  }

  get dispatcherMode() {
    return this.dispatcherProviderMode;
  }
}
