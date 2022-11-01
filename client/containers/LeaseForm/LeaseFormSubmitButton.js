/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { connect } from 'react-redux';
import { submit, isInvalid, hasSubmitFailed, getFormValues } from 'redux-form';
import { t } from 'i18next';
import { Button } from 'components';
import { PUBLISH_STATUSES } from 'redux/modules/leaseStore';
import { getAdditionalAndOneTimeFeesFromPublishTermPeriod, canHaveRentableItems } from '../../helpers/leaseUtils';

const formName = 'leaseForm';

const LeaseFormSubmitButton = ({
  disabled,
  dispatch,
  invalid,
  submitFailed,
  leaseFormSelector,
  additionalLeaseData,
  allowRentableItemSelection,
  publishStatus,
  exportEnabled,
}) => {
  const toInventories = field => {
    const checkboxIndex = field.indexOf('checkbox');
    const baseString = field.substring(0, checkboxIndex);
    return {
      inventoriesKey: baseString.concat('inventories'),
      quantityKey: baseString.concat('dropdown'),
    };
  };

  const transformFeesArrayToObject = fees =>
    fees.reduce((acc, fee) => {
      const { id, ...rest } = fee;
      acc[fee.id] = rest;
      return acc;
    }, {});

  const selectedAdditionalCharges =
    leaseFormSelector &&
    Object.entries(leaseFormSelector)
      .filter(entry => /^(additional_)(.*)(_checkbox)/i.test(entry[0]) && entry[1])
      .map(entry => toInventories(entry[0]));

  const thereIsAdditionalChargeWithNoSelectedRentableItems = feesById => {
    if (!leaseFormSelector) return true;

    return selectedAdditionalCharges.some(({ inventoriesKey, quantityKey }) => {
      const [, feeId] = quantityKey.split('_');
      const quantity = leaseFormSelector[quantityKey];
      const noOfInventories = (leaseFormSelector[inventoriesKey] || []).length;

      return canHaveRentableItems(feesById[feeId]) && {}.hasOwnProperty.call(leaseFormSelector, quantityKey) && quantity && quantity !== noOfInventories;
    });
  };

  const { publishedTerm, additionalAndOneTimeCharges } = additionalLeaseData;
  const additionalAndOneTimeFees = getAdditionalAndOneTimeFeesFromPublishTermPeriod(additionalAndOneTimeCharges, publishedTerm.period);
  const feesById = transformFeesArrayToObject(additionalAndOneTimeFees.fees);

  const shouldDisableBecauseOfMissingRentableItemSelection =
    !exportEnabled && allowRentableItemSelection && thereIsAdditionalChargeWithNoSelectedRentableItems(feesById);
  const isPublishInProgress = publishStatus === PUBLISH_STATUSES.ONGOING;

  return (
    <Button
      type="raised"
      btnRole="secondary"
      disabled={disabled || submitFailed || invalid || isPublishInProgress || shouldDisableBecauseOfMissingRentableItemSelection}
      id="publishLease"
      label={t('PUBLISH_LEASE')}
      onClick={() => dispatch(submit(formName))}
    />
  );
};

export default connect(state => ({
  invalid: isInvalid(formName)(state),
  submitFailed: hasSubmitFailed(formName)(state),
  leaseFormSelector: getFormValues(formName)(state),
}))(LeaseFormSubmitButton);
