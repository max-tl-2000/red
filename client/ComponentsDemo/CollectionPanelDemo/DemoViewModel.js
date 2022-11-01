/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed } from 'mobx';
import nullish from 'helpers/nullish';

export default class DemoViewModel {
  @observable
  id;

  @observable
  firstName;

  @observable
  lastName;

  @observable
  backendId;

  @computed
  get entityId() {
    return this.backendId || this.id;
  }

  constructor({ id, firstName, lastName, backendId }) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.backendId = backendId;
  }

  @action
  update({ id, firstName, lastName, backendId }) {
    !nullish(id) && (this.id = id);
    !nullish(backendId) && (this.backendId = backendId);
    this.firstName = firstName;
    this.lastName = lastName;
  }
}
