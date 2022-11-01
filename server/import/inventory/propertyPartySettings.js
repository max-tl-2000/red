/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { validate, Validation } from './util.js';
import DBColumnLength from '../../utils/dbConstants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { savePropertyPartySetting } from '../../dal/screeningCriteriaRepo';
import { getTenant } from '../../services/tenantService';
import { getPropertiesWithoutPropertyPartySettings } from '../../dal/propertyRepo';

const PROPERTY_PARTY_SETTINGS_REQUIRED_FIELDS = [
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'partyType',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'screeningCriteria',
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
  {
    field: 'screeningCriteria',
    tableFieldName: 'name',
    table: 'ScreeningCriteria',
    idReceiver: 'screeningCriteriaId',
  },
];

const validatePropertyPartyTypes = async ctx => {
  const { partySettings } = (await getTenant(ctx)) || { partySettings: {} };
  if (!partySettings) return [];

  const propertiesWithoutPropertyPartySettings = await getPropertiesWithoutPropertyPartySettings(ctx);

  const invalidFields = propertiesWithoutPropertyPartySettings.map(property => ({
    name: 'propertyPartySettings',
    message: `Missing Property Party Settings for property '${property.name}' and party ${property.missingSettings}`,
  }));

  return { invalidFields };
};

const savePropertyPartySettingData = async (ctx, propertyPartySetting) => {
  const { propertyId, screeningCriteriaId } = propertyPartySetting;
  return await savePropertyPartySetting(ctx, {
    propertyId,
    screeningCriteriaId,
    inactive: propertyPartySetting.inactiveFlag,
    partyType: propertyPartySetting.partyType,
  });
};

export const importPropertyPartySettings = async (ctx, propertyPartySettings) => {
  const validations = await validate(
    propertyPartySettings,
    {
      requiredFields: PROPERTY_PARTY_SETTINGS_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(propertyPartySetting) {
        await savePropertyPartySettingData(ctx, propertyPartySetting);
      },
    },
    ctx,
    spreadsheet.PropertyPartySettings.columns,
  );
  const propertyPartyTypesValidations = await validatePropertyPartyTypes(ctx);

  return {
    invalidFields: [...validations, propertyPartyTypesValidations],
  };
};
