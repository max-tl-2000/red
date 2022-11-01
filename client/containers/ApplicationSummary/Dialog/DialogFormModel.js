/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { FormModel } from 'helpers/Form/FormModel';
import { action } from 'mobx';
import { t } from 'i18next';
import { ApprovalIncreaseDeposit } from '../../../../common/enums/approvalTypes';
import nullish from '../../../../common/helpers/nullish';
import { DALTypes } from '../../../../common/enums/DALTypes';

export default class DialogFormModel extends FormModel {
  @action
  clearValues() {
    this.restoreInitialValues();
    this.updateFrom({
      increaseDepositOption: '',
      additionalNotes: '',
      additionalDeposit: false,
      sureDeposit: false,
      npsRentAssurance: false,
      additionalDepositAmount: 0,
    });
  }

  constructor({ initialState, validators } = {}) {
    super(initialState, validators);
  }

  @action
  updateFrom({ ...item }) {
    super.updateFrom(item);
  }
}

export const createDialogFormModel = ({
  increaseDepositOption = '',
  additionalNotes = '',
  additionalDeposit = false,
  sureDeposit = false,
  npsRentAssurance = false,
  additionalDepositAmount = 0,
  additionalDepositDecision = DALTypes.APPROVAL_CONDITIONS.NONE,
} = {}) => {
  const initialState = {
    increaseDepositOption,
    additionalDeposit,
    sureDeposit,
    npsRentAssurance,
    additionalDepositAmount,
    additionalNotes,
    additionalDepositDecision,
  };

  const validators = {
    additionalDepositAmount: {
      interactive: false,
      fn: ({ value }, fields) => {
        if (ApprovalIncreaseDeposit.ID_OTHER_AMOUNT !== fields.increaseDepositOption.value) return true;

        return nullish(value) || value === '' ? { error: t('APPROVAL_DIALOG_ADDITIONAL_DEPOSIT_OTHER_AMOUNT_VALIDATION') } : true;
      },
    },
  };

  return new DialogFormModel({ initialState, validators });
};
