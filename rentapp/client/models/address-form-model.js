/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { FormModel } from 'helpers/Form/FormModel';
import { computed, action } from 'mobx';
import { t } from 'i18next';
import { parseApplicantAddress, isDateInTheFuture } from '../helpers/utils';
import { VALIDATION_TYPES } from '../../../client/helpers/Form/Validation';
import { RentappTypes } from '../../common/enums/rentapp-types';

export default class AddressFormModel extends FormModel {
  @computed
  get ownOrRent() {
    return this.valueOf('ownOrRent');
  }

  @computed
  get ownerName() {
    return this.valueOf('ownerName');
  }

  @computed
  get ownerPhone() {
    return this.valueOf('ownerPhone');
  }

  @computed
  get moveInDate() {
    return this.valueOf('moveInDate');
  }

  @computed
  get monthlyPayment() {
    return this.valueOf('monthlyPayment');
  }

  @computed
  get hasInternationalAddress() {
    return this.valueOf('hasInternationalAddress');
  }

  @computed
  get addressLine() {
    return this.valueOf('addressLine');
  }

  @computed
  get addressLine1() {
    return this.valueOf('addressLine1');
  }

  @computed
  get addressLine2() {
    return this.valueOf('addressLine2');
  }

  @computed
  get city() {
    return this.valueOf('city');
  }

  @computed
  get state() {
    return this.valueOf('state');
  }

  @computed
  get zip() {
    return this.valueOf('zip');
  }

  @action
  clearValues() {
    this.updateFrom({
      id: '',
      ownOrRent: '',
      ownerName: '',
      ownerPhone: '',
      moveInDate: '',
      monthlyPayment: '',
      hasInternationalAddress: false,
      addressLine: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      zip: '',
    });
  }

  constructor({ initialState, validators, id } = {}) {
    super(initialState, validators);
    this.id = id;
  }

  @action
  updateFrom({ id, createdAt, ...item }) { // eslint-disable-line
    this.id = id; // id is not a field in the FormModel
    super.updateFrom(item);
  }

  @action
  setInternationalCheckBox(val) {
    this.fields.hasInternationalAddress.setValue(val);
    val ? this.clearDomesticFields() : this.clearInternationalFields();
  }

  @action
  autocompleteAddress(address = {}, isLocalAddress = true) {
    const applicantAddress = parseApplicantAddress(address, isLocalAddress);
    super.updateField('hasInternationalAddress', !isLocalAddress);
    super.updateFrom({ addressLine1: '', addressLine: '' });
    const { addressLine1, addressLine, ...rest } = applicantAddress;
    super.updateFrom(rest, false);

    setTimeout(() => super.updateFrom({ addressLine1, addressLine }), 0);
  }

  @action
  clearDomesticFields() {
    this.updateFrom({
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      zip: '',
    });
  }

  @action
  clearInternationalFields() {
    this.updateFrom({
      addressLine: '',
    });
  }
}

export const createAddressFormModel = ({
  id,
  ownOrRent,
  ownerName = '',
  ownerPhone = '',
  moveInDate = '',
  monthlyPayment = '',
  hasInternationalAddress = false,
  addressLine = '',
  addressLine1 = '',
  addressLine2 = '',
  city = '',
  state = '',
  zip = '',
} = {}) => {
  const initialState = {
    ownOrRent,
    ownerName,
    ownerPhone,
    moveInDate,
    monthlyPayment,
    hasInternationalAddress,
    addressLine,
    addressLine1,
    addressLine2,
    city,
    state,
    zip,
  };

  const validators = {
    ownOrRent: { required: t('RENT_OR_OWN_REQUIRED') },
    ownerName: {
      requiredMessage: t('OWNER_NAME_REQUIRED'),
      required: ({ fields }) => fields.ownOrRent.value === RentappTypes.PropertyType.RENT,
    },
    ownerPhone: {
      errorMessage: t('OWNER_PHONE_WRONG_FORMAT'),
      validationType: VALIDATION_TYPES.PHONE,
    },
    moveInDate: {
      waitForBlur: true,
      errorMessage: t('INVALID_DATE'),
      validationType: [
        {
          type: VALIDATION_TYPES.DATE,
          args: { format: 'MM/DD/YYYY' },
          formatError: (token, { minYear: min, maxYear: max, format }) => {
            if (token === 'INVALID_DATE') {
              return t('INVALID_DATE_FORMAT', { format });
            }
            return t(token, { min, max });
          },
        },
      ],
      fn: field => isDateInTheFuture(field, { parseFormat: 'MM/DD/YYYY', errorToken: 'MOVE_IN_DATE_IN_FUTURE_NOT_ALLOWED', unitOfTime: 'day' }),
    },
    addressLine: {
      requiredMessage: t('ADDRESS_LINE_REQUIRED'),
      required: ({ fields }) => fields.hasInternationalAddress.value,
    },
    addressLine1: {
      requiredMessage: t('ADDRESS_LINE_1_REQUIRED'),
      required: ({ fields }) => !fields.hasInternationalAddress.value,
    },
    city: {
      requiredMessage: t('CITY_REQUIRED'),
      required: ({ fields }) => !fields.hasInternationalAddress.value,
    },
    state: {
      requiredMessage: t('STATE_REQUIRED'),
      required: ({ fields }) => !fields.hasInternationalAddress.value,
    },
    zip: {
      requiredMessage: t('ZIP_REQUIRED'),
      required: ({ fields }) => !fields.hasInternationalAddress.value,
    },
  };

  return new AddressFormModel({ initialState, validators, id });
};
