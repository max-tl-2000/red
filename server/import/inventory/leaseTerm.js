/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';

import { saveLeaseTerms, getAllLeaseNames } from '../../dal/leaseTermRepo';
import DBColumnLength from '../../utils/dbConstants';
import { validate, Validation, getValueFromEnum, getValueToPersist } from './util';
import { DALTypes } from '../../../common/enums/DALTypes';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

export const LEASE_NAME = 'leaseName';
export const INVALID_LEASE_NAME_APPLIED = 'INVALID_LEASE_NAME_FOR_GIVEN_LEASE_TERM';
export const LEASE_ADJUSTMENT = 'leaseAdjustmentValues';
export const INVALID_LEASE_ADJUSTMENT = 'BOTH_RELATIVE_AND_ABSOLUTE_VALUES_PROVIDED';

const LEASE_TERMS_REQUIRED_FIELDS = [
  {
    fieldName: 'leaseName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'length',
    validation: [Validation.INTEGER, Validation.POSITIVE_INTEGER, Validation.NOT_EMPTY],
  },
  {
    fieldName: 'period',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.LeasePeriod,
    maxLength: DBColumnLength.Period,
  },
  {
    fieldName: 'relativeAdjustment',
    validation: [Validation.PERCENTAGE],
  },
  {
    fieldName: 'absoluteAdjustment',
    validation: [Validation.NUMERIC],
  },
  {
    fieldName: 'state',
    validation: [Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.LeaseState,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'inactiveFlag',
    validation: [Validation.BOOLEAN],
  },
];

const PREREQUISITES = [
  {
    field: 'property',
    tableFieldName: 'name',
    table: 'Property',
    idReceiver: 'propertyId',
  },
  {
    field: 'leaseName',
    tableFieldName: 'name',
    table: 'LeaseName',
    idReceiver: 'leaseNameId',
    relatedField: 'property',
    relatedTableFieldName: 'propertyId',
  },
];

export const validatePropertyLeaseNameConstraint = (ctx, leaseTerm, leaseNames) => {
  const associatedLeaseName = leaseNames.find(leaseName => leaseTerm.leaseName === leaseName.name && leaseTerm.property === leaseName.propertyName);

  if (!associatedLeaseName) {
    return [
      {
        name: LEASE_NAME,
        message: INVALID_LEASE_NAME_APPLIED,
      },
    ];
  }
  return [];
};

export const validateAdjustmentValues = leaseTerm => {
  if (leaseTerm.relativeAdjustment && leaseTerm.absoluteAdjustment) {
    return [
      {
        name: LEASE_ADJUSTMENT,
        message: INVALID_LEASE_ADJUSTMENT,
      },
    ];
  }

  return [];
};

export const additionalValidations = (ctx, leaseTerm, leaseNames) => {
  const validations = validateAdjustmentValues(leaseTerm);
  const propertyLeaseNameValidation = validatePropertyLeaseNameConstraint(ctx, leaseTerm, leaseNames);

  propertyLeaseNameValidation.forEach(validation => {
    validations.push(validation);
  });
  return validations;
};

const createLeaseTermRecord = leaseTerm => ({
  id: newId(),
  leaseNameId: leaseTerm.leaseNameId,
  termLength: leaseTerm.length,
  period: leaseTerm.period,
  relativeAdjustment: getValueToPersist(leaseTerm.relativeAdjustment),
  absoluteAdjustment: getValueToPersist(leaseTerm.absoluteAdjustment),
  state: getValueFromEnum(DALTypes.LeaseState, leaseTerm.state),
  inactive: leaseTerm.inactiveFlag,
});

export const importLeaseTerms = async (ctx, leaseTerms) => {
  const leaseNames = await getAllLeaseNames(ctx);
  const leaseTermsToSave = [];

  const invalidFields = await validate(
    leaseTerms,
    {
      requiredFields: LEASE_TERMS_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(leaseTerm) {
        leaseTermsToSave.push(createLeaseTermRecord(leaseTerm));
      },
      customCheck(leaseTerm) {
        return additionalValidations(ctx, leaseTerm, leaseNames);
      },
    },
    ctx,
    spreadsheet.LeaseTerm.columns,
  );

  await saveLeaseTerms(ctx, leaseTermsToSave);

  return {
    invalidFields,
  };
};
