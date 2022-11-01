/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { FormModel } from 'helpers/Form/FormModel';
import { action } from 'mobx';
import { t } from 'i18next';
import { RentappTypes } from '../../common/enums/rentapp-types';
import { parseApplicantAddress, isIncomeSourceNegative, incomeSourceFieldHasValue } from '../helpers/utils';
import { VALIDATION_TYPES } from '../../../client/helpers/Form/Validation';

export default class IncomeSourceFormModel extends FormModel {
  @action
  clearValues() {
    this.restoreInitialValues();
    this.updateFrom({ grossIncome: '', incomeSourceType: '' });
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

export const createIncomeSourceFormModel = ({
  id,
  incomeSourceType = RentappTypes.IncomeSourceType.EMPLOYMENT,
  sourceDescription = '',
  employerName = '',
  jobTitle = '',
  startDate = '',
  managerName = '',
  managerPhone = '',
  grossIncome = '',
  grossIncomeFrequency,
  hasInternationalAddress = false,
  addressLine = '',
  addressLine1 = '',
  addressLine2 = '',
  city = '',
  state = '',
  zip = '',
} = {}) => {
  const initialState = {
    incomeSourceType,
    sourceDescription,
    employerName,
    jobTitle,
    startDate,
    managerName,
    managerPhone,
    grossIncome,
    grossIncomeFrequency,
    hasInternationalAddress,
    addressLine,
    addressLine1,
    addressLine2,
    city,
    state,
    zip,
  };

  const _isEmployedType = fields => fields.incomeSourceType.value === RentappTypes.IncomeSourceType.EMPLOYMENT;

  const _hasInternationalAddress = fields => fields.hasInternationalAddress.value;

  const _isEmployeeWithDomesticAddress = fields => _isEmployedType(fields) && !_hasInternationalAddress(fields);

  const _isEmployeeWithInternationalAddress = fields => _isEmployedType(fields) && _hasInternationalAddress(fields);

  const validators = {
    incomeSourceType: {
      required: t('INCOME_SOURCE_REQUIRED'),
    },
    managerPhone: {
      errorMessage: t('MANAGER_PHONE_WRONG_FORMAT'),
      validationType: VALIDATION_TYPES.PHONE,
    },
    startDate: {
      waitForBlur: true,
      errorMessage: t('INVALID_DATE'),
      validationType: [
        {
          type: VALIDATION_TYPES.DATE,
          args: { format: 'MM/YYYY' },
          formatError: (token, { minYear: min, maxYear: max, format }) => {
            if (token === 'INVALID_DATE') {
              return t('INVALID_DATE_FORMAT', { format });
            }
            return t(token, { min, max });
          },
        },
      ],
    },
    grossIncome: {
      required: t('GROSS_INCOME_REQUIRED'),
      fn: field => isIncomeSourceNegative(field),
      hasValue: value => incomeSourceFieldHasValue(value),
    },
    addressLine: {
      // required can also be a function, in which case it will evaluate
      // dynamically if the field needs to be considered to be required
      required: ({ fields }) => _isEmployeeWithInternationalAddress(fields),
      requiredMessage: t('ADDRESS_LINE_REQUIRED'),
    },
    addressLine1: {
      required: ({ fields }) => _isEmployeeWithDomesticAddress(fields),
      requiredMessage: t('ADDRESS_LINE_1_REQUIRED'),
    },
    city: {
      required: ({ fields }) => _isEmployeeWithDomesticAddress(fields),
      requiredMessage: t('CITY_REQUIRED'),
    },
    state: {
      required: ({ fields }) => _isEmployeeWithDomesticAddress(fields),
      requiredMessage: t('STATE_REQUIRED'),
    },
    zip: {
      required: ({ fields }) => _isEmployeeWithDomesticAddress(fields),
      requiredMessage: t('ZIP_REQUIRED'),
    },
    grossIncomeFrequency: {
      required: t('GROSS_FREQUENCY_REQUIRED'),
    },
  };

  return new IncomeSourceFormModel({ initialState, validators, id });
};
