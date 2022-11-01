/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveIntegrationSetting, getProperties } from '../../dal/propertyRepo';
import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import loggerModule from '../../../common/helpers/logger';
import { getTenant } from '../../services/tenantService';
import { DALTypes } from '../../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'import/integrationSettings' });

const AMENITY_SETTING_ERROR = 'Amenity import setting is not supported because tenant is not MRI.';
const AMENITY_SETTING_FIELD = 'import\namenities';

const REQUIRED_FIELDS = [
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'import\ninventoryState',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'import\ninventoryAvailabilityDate',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'import\nresidentData',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'import\nunitPricing',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'import\namenities',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'export\nnewLease',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'export\nrenewalLease',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'lease\nbmAutoESignatureRequest',
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

const checkMriBackend = async (ctx, integrationSetting) => {
  const {
    metadata: { backendIntegration },
  } = await getTenant(ctx);

  const amenityImportSetting = integrationSetting['import\namenities'];

  if (amenityImportSetting && backendIntegration?.name !== DALTypes.BackendMode.MRI) {
    logger.error({ ctx }, AMENITY_SETTING_ERROR);
    return [
      {
        name: AMENITY_SETTING_FIELD,
        message: AMENITY_SETTING_ERROR,
      },
    ];
  }

  return [];
};

const additionalValidations = async (ctx, integrationSetting) => await checkMriBackend(ctx, integrationSetting);

const storeIntegrationSetting = async (ctx, integrationSettings, propertiesById) => {
  const settings = propertiesById[integrationSettings.propertyId];
  const { integration = {} } = settings || {};
  Object.keys(integrationSettings)
    .filter(key => key !== 'propertyId' && key !== 'property')
    .forEach(key => {
      const value = integrationSettings[key];

      logger.trace({ ctx, key, value }, 'import integration settings key');

      const keys = key.split('\n');
      if (keys.length > 1) {
        const [columnHeader, settingKey] = keys;
        integration[columnHeader] = integration[columnHeader] || {};
        integration[columnHeader][settingKey] = value;
      } else {
        integration[key] = value;
      }
    });

  await saveIntegrationSetting(ctx, integrationSettings.propertyId, integration);
};

export const importIntegrationSettings = async (ctx, integrationSettings) => {
  const properties = await getProperties(ctx);
  const propertiesById = properties.reduce((acc, property) => {
    acc[property.id] = { settings: property.settings };
    return acc;
  }, {});

  const invalidFields = await validate(
    integrationSettings,
    {
      requiredFields: REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(integrationSetting) {
        await storeIntegrationSetting(ctx, integrationSetting, propertiesById);
      },
      async customCheck(integrationSetting) {
        return await additionalValidations(ctx, integrationSetting);
      },
    },
    ctx,
    spreadsheet.IntegrationSettings.columns,
  );

  return {
    invalidFields,
  };
};
