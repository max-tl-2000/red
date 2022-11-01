/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, ObservableMap, computed } from 'mobx';
import typeOf from 'helpers/type-of';

export class SavingState {
  @observable
  serviceCalls;

  @computed
  get pendingCallsCount() {
    return this.serviceCalls.size;
  }

  @computed
  get saving() {
    return this.pendingCallsCount > 0;
  }

  constructor() {
    this.serviceCalls = new ObservableMap();
  }

  hasResource(matcher) {
    const values = this.serviceCalls.values();

    if (typeof matcher === 'function') return values.some(matcher);

    if (typeOf(matcher) === 'regexp') return values.some(val => val.resource.match(matcher));

    throw new Error('matcher should be either a function or a regexp');
  }

  @action
  notifyStart(args) {
    this.serviceCalls.set(args.id, args);
  }

  @action
  notifyEnd(args) {
    this.serviceCalls.delete(args.id, args);
  }
}
