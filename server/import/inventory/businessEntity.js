/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveAddressRow } from '../../services/addresses.js';
import { saveBusinessEntity } from '../../dal/businessEntityRepo.js';
import { DALTypes } from '../../../common/enums/DALTypes.js';
import { getValueFromEnum, validate, Validation } from './util.js';
import DBColumnLength from '../../utils/dbConstants.js';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const BUSINESS_ENTITY_REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'type',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.BusinessEntityType,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'expertise',
    validation: [Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.BusinessEntityExpertise,
    maxLength: DBColumnLength.Expertise,
  },
  {
    fieldName: 'website',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.WebSite,
  },
  {
    fieldName: 'addressLine1',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Address,
  },
  {
    fieldName: 'addressLine2',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Address,
  },
  {
    fieldName: 'city',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.City,
  },
  {
    fieldName: 'state',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.State,
  },
  {
    fieldName: 'postalCode',
    validation: [Validation.ALPHANUMERIC, Validation.POSTAL_CODE],
    maxLength: DBColumnLength.PostalCode,
  },
];

async function saveBusinessEntityData(ctx, businessEntity) {
  const record = await saveBusinessEntity(ctx, {
    name: businessEntity.name,
    type: getValueFromEnum(DALTypes.BusinessEntityType, businessEntity.type),
    expertise: businessEntity.expertise !== '' ? getValueFromEnum(DALTypes.BusinessEntityExpertise, businessEntity.expertise) : null,
    description: businessEntity.description,
    website: businessEntity.website,
    addressId: businessEntity.addressId,
  });
  businessEntity.id = record.id;
}

export const importBusinessEntities = async (ctx, businessEntities) => {
  const invalidFields = await validate(
    businessEntities,
    {
      requiredFields: BUSINESS_ENTITY_REQUIRED_FIELDS,
      async onValidEntity(businessEntity) {
        const { addressId } = await saveAddressRow(ctx, businessEntity);
        businessEntity.addressId = addressId;
        await saveBusinessEntityData(ctx, businessEntity);
      },
    },
    null,
    spreadsheet.BusinessEntity.columns,
  );

  return {
    invalidFields,
  };
};
