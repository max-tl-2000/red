/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveLeaseName } from '../../dal/leaseTermRepo';
import DBColumnLength from '../../utils/dbConstants';
import { validate, Validation, getValueToPersist } from './util';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const LEASE_NAMES_REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
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
];

const saveLeaseNameData = (ctx, leaseName) =>
  saveLeaseName(ctx, {
    name: leaseName.name,
    propertyId: leaseName.propertyId,
    description: getValueToPersist(leaseName.description, null),
    inventoryType: leaseName.inventoryType,
    inactive: leaseName.inactiveFlag,
  });

export const importLeaseNames = async (ctx, leaseNames) => {
  const invalidFields = await validate(
    leaseNames,
    {
      requiredFields: LEASE_NAMES_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      onValidEntity(leaseName) {
        return saveLeaseNameData(ctx, leaseName);
      },
    },
    ctx,
    spreadsheet.LeaseName.columns,
  );

  return {
    invalidFields,
  };
};
