/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import set from 'lodash/set';
import { updateTenant, getTenantData } from '../../dal/tenantsRepo';
import { validate, Validation } from './util.js';
import { admin } from '../../common/schemaConstants';
import DBColumnLength from '../../utils/dbConstants';
import loggerModule from '../../../common/helpers/logger';
import { isBoolean } from '../../../common/helpers/type-of';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getPartySettings } from '../../services/party-settings';

const logger = loggerModule.child({ subType: 'import/partySettings' });

const PARTY_SETTINGS_REQUIRED_FIELDS = [
  {
    fieldName: 'partyType',
    validation: [Validation.NOT_EMPTY],
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'showOccupantMember',
    validation: [Validation.NOT_EMPTY, Validation.BOOLEAN],
  },
  {
    fieldName: 'holdDepositAccepted',
    validation: [Validation.NOT_EMPTY, Validation.BOOLEAN],
  },
  {
    fieldName: 'showEmergencyContactTask',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'residentOrPartyLevelGuarantor',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Type,
  },
];

const getInvalidPartySettingsSetup = tenantPartySettings =>
  Object.values(DALTypes.PartyTypes).reduce(
    (validation, partyType) => {
      if (!Object.keys(tenantPartySettings).find(key => key === partyType)) {
        validation.invalidFields.push({
          name: 'Party Settings',
          message: `Settings not configured for party type: ${partyType}`,
        });
      }
      return validation;
    },
    { invalidFields: [] },
  );

const savePartySettingData = async (ctx, partySetting) => {
  const adminCtx = { tenantId: admin.id };
  const tenantId = ctx.tenantId;
  const { partySettings } = await getTenantData(ctx);
  Object.keys(partySetting)
    .filter(key => key !== 'partyType')
    .forEach(key => {
      if (!partySetting[key] && !isBoolean(partySetting[key])) return;
      let value = null;
      if (!isBoolean(partySetting[key])) value = partySetting[key];
      if (value === null) value = partySetting[key];

      set(partySettings || {}, `${partySetting.partyType}.${key}`, value);
    });
  await updateTenant(adminCtx, tenantId, { partySettings });
  logger.trace({ ctx, partySetting }, 'import party setting');
};

export const importPartySettings = async (ctx, partySettings) => {
  const validations = await validate(
    partySettings,
    {
      requiredFields: PARTY_SETTINGS_REQUIRED_FIELDS,
      async onValidEntity(partySetting) {
        await savePartySettingData(ctx, partySetting);
      },
    },
    ctx,
    spreadsheet.PartySetting.columns,
  );
  const tenantPartySettings = await getPartySettings(ctx);
  const partySettingsSetupErrors = getInvalidPartySettingsSetup(tenantPartySettings);

  return {
    invalidFields: [...validations, partySettingsSetupErrors],
  };
};
