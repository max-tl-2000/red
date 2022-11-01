/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Validation, validate } from './util.js';
import DBColumnLength from '../../utils/dbConstants.js';
import { saveAmenity } from '../../dal/amenityRepo.js';
import { DALTypes } from '../../../common/enums/DALTypes.js';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const LIFESTYLE_REQUIRED_FIELDS = [
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
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'order',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'infographic',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
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

const saveLifestyleData = async (ctx, lifestyle) =>
  await saveAmenity(ctx, {
    name: lifestyle.name,
    propertyId: lifestyle.propertyId,
    category: DALTypes.AmenityCategory.PROPERTY,
    subCategory: DALTypes.AmenitySubCategory.LIFESTYLE,
    displayName: lifestyle.displayName,
    description: lifestyle.description,
    infographicName: lifestyle.infographic,
    order: lifestyle.order || 0,
  });

export const importLifestyles = async (ctx, lifestyles) => {
  const invalidFields = await validate(
    lifestyles,
    {
      requiredFields: LIFESTYLE_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(lifestyle) {
        await saveLifestyleData(ctx, lifestyle);
      },
    },
    ctx,
    spreadsheet.Lifestyle.columns,
  );

  return {
    invalidFields,
  };
};
