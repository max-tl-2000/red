/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { calculateRelativeAdjustment } from './quotes';

export const MIN_START_DAYS_DIFFERENCE = 7;
export const MIN_OVERALL_DAYS_DIFFERENCE = 14;

export const getConcessionValues = (concession, term, baseRentValue, amountVariableAdjustment) => {
  const relativeAdjustment = Math.abs(concession.relativeAdjustment);
  const absoluteAdjustment = Math.abs(concession.absoluteAdjustment);
  const isNotVariable = !concession.variableAdjustment;
  const isVariableAndSet = concession.variableAdjustment && amountVariableAdjustment > 0;
  const isRecurringAndSet = concession.recurring && (isNotVariable || isVariableAndSet);
  const relativeAmount = calculateRelativeAdjustment(baseRentValue || term.adjustedMarketRent, relativeAdjustment);

  return { relativeAmount, relativeAdjustment, absoluteAdjustment, isRecurringAndSet };
};

const concessionCheckboxIsChecked = (key, values) => key.startsWith('concession_') && key.endsWith('_checkbox') && values[key] === true;
const additionalChargesCheckboxIsChecked = (key, values) => key.startsWith('additional_') && key.endsWith('_checkbox') && values[key] === true;
const oneTimeChargesCheckboxIsChecked = (key, values) => key.startsWith('onetime_') && key.endsWith('_checkbox') && values[key] === true;

const getConcessionAmount = (values, concessionId) => {
  const amount = values[`concession_${concessionId}_amount`];
  const computedAmount = values[`concession_${concessionId}_computedAmount`];

  return computedAmount || amount;
};

const getConcessionsFromLeaseFormValues = (keys, values) =>
  keys.reduce((acc, key) => {
    if (!concessionCheckboxIsChecked(key, values)) return acc;

    const concessionId = key.split('_')[1];
    acc[concessionId] = acc[concessionId] || {};
    acc[concessionId].amount = getConcessionAmount(values, concessionId);

    if (values[`concession_${concessionId}_amountVariableAdjustment`]) {
      acc[concessionId].amountVariableAdjustment = values[`concession_${concessionId}_amountVariableAdjustment`];
    } else {
      acc[concessionId].relativeAmount = values[`concession_${concessionId}_relativeAmount`];
    }

    return acc;
  }, {});

export const getChargeFieldNameType = isOneTime => (isOneTime ? 'onetime' : 'additional');

const getChargesFromLeaseFormValues = (keys, values, isOneTime = false) => {
  const fieldNameType = getChargeFieldNameType(isOneTime);

  return keys.reduce((acc, key) => {
    if (!isOneTime && !additionalChargesCheckboxIsChecked(key, values)) return acc;
    if (isOneTime && !oneTimeChargesCheckboxIsChecked(key, values)) return acc;

    const feeId = key.split('_')[1];
    if (!isOneTime && key.includes('_concession_') && !additionalChargesCheckboxIsChecked(`additional_${feeId}_checkbox`, values)) return acc;
    if (isOneTime && key.includes('_concession_') && !oneTimeChargesCheckboxIsChecked(`onetime_${feeId}_checkbox`, values)) return acc;

    acc[feeId] = acc[feeId] || {};
    if (key.includes('_concession_')) {
      const concessionId = key.split('_')[3];
      acc[feeId].concessions = acc[feeId].concessions || {};
      acc[feeId].concessions[concessionId] = values[`${fieldNameType}_${feeId}_concession_${concessionId}_amount`];
    } else {
      acc[feeId].amount = values[`${fieldNameType}_${feeId}_amount`];
      acc[feeId].quantity = values[`${fieldNameType}_${feeId}_dropdown`];
      if (!isOneTime) {
        acc[feeId].selectedInventories = values[`additional_${feeId}_inventories`];
      }
    }
    return acc;
  }, {});
};

export const getLeaseDataToPublish = (leaseFormValues, isRenewal) => {
  const keys = Object.keys(leaseFormValues);

  return {
    leaseStartDate: leaseFormValues.LEASE_START_DATE,
    leaseEndDate: leaseFormValues.LEASE_END_DATE,
    moveInDate: !isRenewal ? leaseFormValues.MOVE_IN_DATE : leaseFormValues.LEASE_START_DATE,
    unitRent: leaseFormValues.BASE_RENT,
    rentersInsuranceFacts: leaseFormValues.RENTERS_INSURANCE_FACTS,
    sfsuAddendumIncluded: leaseFormValues.SFSU_ADDENDUM,
    studentEarlyTerminationAddendumIncluded: leaseFormValues.STUDENT_EARLY_TERMINATION_ADDENDUM,
    student2022OfferAddendumIncluded: leaseFormValues.STUDENT_2022_OFFER_ADDENDUM,
    selectedOccupants: leaseFormValues.SELECTED_OCCUPANTS,
    selectedPartyRepresentativeId: leaseFormValues.SELECTED_PARTY_REPRESENTATIVE,
    concessions: getConcessionsFromLeaseFormValues(keys, leaseFormValues),
    additionalCharges: getChargesFromLeaseFormValues(keys, leaseFormValues),
    oneTimeCharges: getChargesFromLeaseFormValues(keys, leaseFormValues, true),
  };
};
