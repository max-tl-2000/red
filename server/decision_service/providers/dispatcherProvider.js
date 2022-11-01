/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import FakeDispatcher from './fakeDispatcher';
import CorticonDispatcher from './corticonDispatcher';

export default class DispatcherProvider {
  constructor(dispatcherProviderMode, logger) {
    this.dispatcherProviderMode = dispatcherProviderMode;
    this.logger = logger;
  }

  get fakeDispatcher() {
    if (this._fakeDispatcher) return this._fakeDispatcher;

    this._fakeDispatcher = new FakeDispatcher();
    return this._fakeDispatcher;
  }

  get corticonDispatcher() {
    if (this._corticonDispatcher) return this._corticonDispatcher;

    this._corticonDispatcher = new CorticonDispatcher(this.logger);
    return this._corticonDispatcher;
  }

  getProvider() {
    switch (this.dispatcherProviderMode) {
      case DALTypes.DecisionServiceDispatcherMode.FAKE:
        return this.fakeDispatcher;
      default:
        return this.corticonDispatcher;
    }
  }
}
