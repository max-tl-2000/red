/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveRxpSettings, getPropertyById } from '../../dal/propertyRepo';
import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'import/integrationSettings' });

const REQUIRED_FIELDS = [
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
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

const saveRxpSetting = async (ctx, rxpSetting) => {
  const { id, settings } = await getPropertyById(ctx, rxpSetting.propertyId);
  const { rxp = {} } = settings || {};
  Object.keys(rxpSetting)
    .filter(key => key !== 'propertyId' && key !== 'property')
    .forEach(key => {
      const value = rxpSetting[key];

      logger.trace({ ctx, key, value }, 'import rxp settings key');

      const keys = key.split('\n');
      if (keys.length > 1) {
        const [columnHeader, settingKey] = keys;
        rxp[columnHeader] = rxp[columnHeader] || {};
        rxp[columnHeader][settingKey] = value;
      } else {
        rxp[key] = value;
      }
    });

  await saveRxpSettings(ctx, id, rxp);
};

export const importRxpSettings = async (ctx, rxpSettings) => {
  const invalidFields = await validate(
    rxpSettings,
    {
      requiredFields: REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      async onValidEntity(rxpSetting) {
        await saveRxpSetting(ctx, rxpSetting);
      },
    },
    ctx,
    spreadsheet.RxpSettings.columns,
  );

  return {
    invalidFields,
  };
};
