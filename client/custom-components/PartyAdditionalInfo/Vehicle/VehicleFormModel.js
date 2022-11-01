/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { computed, action } from 'mobx';
import { t } from 'i18next';
import { FormModel } from '../../../helpers/Form/FormModel';
import { VALIDATION_TYPES } from '../../../helpers/Form/Validation';
import { now } from '../../../../common/helpers/moment-utils';
import trim from '../../../../common/helpers/trim';

export class VehicleFormModel extends FormModel {
  @computed
  get type() {
    return this.valueOf('type');
  }

  @computed
  get makeAndModel() {
    return this.valueOf('makeAndModel');
  }

  @computed
  get makeYear() {
    return this.valueOf('makeYear');
  }

  @computed
  get color() {
    return this.valueOf('color');
  }

  @computed
  get tagNumber() {
    return this.valueOf('tagNumber');
  }

  @computed
  get state() {
    return this.valueOf('state');
  }

  constructor({ id, model, validators } = {}) {
    super(model, validators);
    this.id = id;
  }

  @action
  updateFrom({ id, ...item }) {
    this.id = id;
    super.updateFrom(item);
  }

  @action
  tagNumberToUpperCase() {
    this.fields.tagNumber.setValue(trim(this.tagNumber).toUpperCase());
  }
}

export const createVehicleFormModel = ({ id, type, makeAndModel, makeYear, color, tagNumber, state, createdAt } = {}) =>
  new VehicleFormModel({
    id,
    model: {
      type,
      makeAndModel,
      makeYear,
      color,
      tagNumber,
      state,
      createdAt,
    },
    validators: {
      type: {
        required: t('VEHICLE_TYPE_REQUIRED'),
      },
      makeAndModel: {
        required: t('VEHICLE_MAKE_AND_MODEL_REQUIRED'),
      },
      tagNumber: {
        required: t('VEHICLE_TAG_NUMBER_REQUIRED'),
        errorMessage: t('INVALID_LIMIT_OF_CHARACTERES'),
        validationType: [
          {
            type: VALIDATION_TYPES.ALPHANUMERIC,
            args: { limit: 10 },
          },
        ],
      },
      state: {
        required: t('VEHICLE_STATE_REQUIRED'),
      },
      makeYear: {
        errorMessage: t('INVALID_YEAR', { endYear: now().year() + 2 }),
        validationType: [
          {
            type: VALIDATION_TYPES.MAKE_YEAR,
            args: { onlyPositiveNumber: true, range: { from: '1900' } },
          },
        ],
      },
    },
  });
