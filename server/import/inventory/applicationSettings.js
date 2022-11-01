/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import set from 'lodash/set';
import { updateProperty, getPropertyById, getProperties } from '../../dal/propertyRepo';
import { validate, Validation } from './util.js';
import DBColumnLength from '../../utils/dbConstants';
import { translateFlagCellValue } from '../../helpers/importUtils';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { DALTypes } from '../../../common/enums/DALTypes';
import { HoldDepositApplicationSettingsValues } from '../../../common/enums/applicationTypes';

const APPLICATION_SETTINGS_REQUIRED_FIELDS = [
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'partyType',
    validation: [Validation.NOT_EMPTY],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'memberType',
    validation: [Validation.NOT_EMPTY],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'incomeSourcesSection',
    validation: [Validation.NOT_EMPTY],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'addressHistorySection',
    validation: [Validation.NOT_EMPTY],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'disclosuresSection',
    validation: [Validation.NOT_EMPTY],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'childrenSection',
    validation: [Validation.NOT_EMPTY],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'petsSection',
    validation: [Validation.NOT_EMPTY],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'vehiclesSection',
    validation: [Validation.NOT_EMPTY],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'privateDocumentsSection',
    validation: [Validation.NOT_EMPTY],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'sharedDocumentsSection',
    validation: [Validation.NOT_EMPTY],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'rentersInsuranceSection',
    validation: [Validation.NOT_EMPTY],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'holdDeposit',
    validation: [Validation.ALPHANUMERIC, Validation.NOT_EMPTY, Validation.EXISTS_IN],
    validValues: HoldDepositApplicationSettingsValues,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'holdDepositWithoutUnit',
    validation: [Validation.ALPHANUMERIC, Validation.NOT_EMPTY, Validation.EXISTS_IN],
    validValues: HoldDepositApplicationSettingsValues,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'creditReportRequiredFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'criminalReportRequiredFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'creditReportValidForPeriod',
    validation: [Validation.NUMERIC],
  },
  {
    fieldName: 'criminalReportValidForPeriod',
    validation: [Validation.NUMERIC],
  },
  {
    fieldName: 'appFeePaymentValidForPeriod',
    validation: [Validation.NUMERIC],
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

const getPropertyPartyTypeMemberTypeCombinations = () => {
  const partyTypes = Object.values(DALTypes.PartyTypes);
  const memberTypes = Object.values(DALTypes.MemberType);
  return partyTypes.reduce((acc, type) => {
    if (type === DALTypes.PartyTypes.CORPORATE) acc.push({ partyType: type, memberType: DALTypes.MemberType.OCCUPANT.toLowerCase() });
    else memberTypes.forEach(memberType => acc.push({ partyType: type, memberType: memberType.toLowerCase() }));
    return acc;
  }, []);
};

const getInvalidApplicationSettingsSetup = properties => {
  const partyTypeMemberTypeCombinations = getPropertyPartyTypeMemberTypeCombinations(properties);
  return properties.reduce(
    (validation, property) => {
      const settings = property.settings?.applicationSettings || {};

      partyTypeMemberTypeCombinations.forEach(combination => {
        const { partyType, memberType } = combination;
        const settingsNotConfigured = !settings[partyType] || (settings[partyType] && !settings[partyType][memberType]);
        if (settingsNotConfigured) {
          validation.invalidFields.push({
            name: 'Application Settings',
            message: `Settings not configured for property: ${property.name}, party type: ${partyType} and member type:${memberType}`,
          });
        }
      });
      return validation;
    },
    { invalidFields: [] },
  );
};

const processSettingsValues = obj =>
  Object.keys(obj).reduce((acc, key) => {
    // columns that end in Flag should be converted to booleans
    acc[key] = key.match(/Flag$/) ? translateFlagCellValue(obj[key]) : obj[key];
    return acc;
  }, {});

const saveApplicationSettingData = async (ctx, applicationSettings) => {
  // we take advantage of the destructuring to remove the properties we don't want to save
  const { propertyId, partyType, memberType, property, ...appSettings } = applicationSettings;

  const { id, settings } = await getPropertyById(ctx, propertyId);
  const setting = settings || {};
  const path = `applicationSettings.${partyType}.${memberType}`;

  set(setting, path, processSettingsValues(appSettings));
  await updateProperty(ctx, { id }, { settings: setting });
};

export const importApplicationSettings = async (ctx, applicationSettings) => {
  const validations = await validate(
    applicationSettings,
    {
      requiredFields: APPLICATION_SETTINGS_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(applicationSetting) {
        await saveApplicationSettingData(ctx, applicationSetting);
      },
    },
    ctx,
    spreadsheet.ApplicationSetting.columns,
  );
  const properties = await getProperties(ctx);
  const applicationSettingsSetupErrors = getInvalidApplicationSettingsSetup(properties);

  return {
    invalidFields: [...validations, applicationSettingsSetupErrors],
  };
};
