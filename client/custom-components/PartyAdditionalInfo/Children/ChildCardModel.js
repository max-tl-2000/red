/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action } from 'mobx';
import { now } from '../../../../common/helpers/moment-utils';

export class ChildCardModel {
  @observable
  id;

  @observable
  fullName;

  @observable
  preferredName;

  constructor({ id, fullName, preferredName, createdAt }) {
    this.id = id;
    this.fullName = fullName;
    this.preferredName = preferredName;
    this.createdAt = createdAt || now();
  }

  @action
  update({ fullName, preferredName }) {
    this.fullName = fullName;
    this.preferredName = preferredName;
  }
}
