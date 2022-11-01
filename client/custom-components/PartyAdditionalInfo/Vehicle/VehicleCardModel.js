/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action } from 'mobx';
import nullish from 'helpers/nullish';
import { now } from '../../../../common/helpers/moment-utils';

export class VehicleCardModel {
  @observable
  id;

  @observable
  type;

  @observable
  makeAndModel;

  @observable
  makeYear;

  @observable
  color;

  @observable
  tagNumber;

  @observable
  state;

  constructor({ id, type, makeAndModel, makeYear, color, tagNumber, state, createdAt }) {
    this.id = id;
    this.type = type;
    this.makeAndModel = makeAndModel;
    this.makeYear = makeYear;
    this.color = color;
    this.tagNumber = tagNumber;
    this.state = state;
    this.createdAt = createdAt || now();
  }

  @action
  update({ id, type, makeAndModel, makeYear, color, tagNumber, state }) {
    !nullish(id) && (this.id = id);
    this.type = type;
    this.makeAndModel = makeAndModel;
    this.makeYear = makeYear;
    this.color = color;
    this.tagNumber = tagNumber;
    this.state = state;
  }
}
