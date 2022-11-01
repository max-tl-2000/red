/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { updateTenant, getTenantData } from '../../dal/tenantsRepo';
import { deleteRingPhones } from '../../dal/usersRepo';
import { admin } from '../../common/schemaConstants';
import { validate, Validation } from './util.js';
import DBColumnLength from '../../utils/dbConstants';
import { obscureObject, OBSCURE_VALUE, privateLogEntries } from '../../../common/helpers/logger-utils';
import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'import/globalSettings' });
import config from '../../config';
import { APP_EXCHANGE, EXTERNAL_CALENDARS_TYPE, IMPORT_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { getTenant } from '../../services/tenantService';
import { DALTypes } from '../../../common/enums/DALTypes';

const RESIDENT_LEGAL_STIP_FIELD_NAME = 'customImport\nresidentLegalStipColumn';
const LOSS_LEADER_UNIT_FIELD_NAME = 'customImport\nlossLeaderUnitColumn';

const RESIDENT_LEGAL_STIP_FLAG_FALSE_ERROR = 'residentLegalStipColumn must be set to false on a non-Yardi tenant';
const LOSS_LEADER_UNIT_FALSE_ERROR = 'lossLeaderUnitColumn must be set to false on a non-Yardi tenant';

const GLOBAL_SETTINGS_REQUIRED_FIELDS = [
  {
    fieldName: 'communications\ndefaultEmailSignature',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Text2KB,
  },
  {
    fieldName: 'communications\ncontactUsLink',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'communications\nfooterNotice',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Text2KB,
  },
  {
    fieldName: 'communications\nfooterCopyright',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'preferences\nhidePropertyLifestyles',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'screening\noriginatorId',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'screening\nusername',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'screening\npassword',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'quote\nallowBaseRentAdjustmentFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'communicationOverrides\ncustomerEmails',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'communicationOverrides\nemployeeEmails',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'communicationOverrides\ncustomerPhone',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'lease\nallowCounterSigningInPast',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'features\nenableCohortComms',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'legal\nprivacyPolicyUrl',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'legal\ntermsOfServiceUrl',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'rules\ncustomPrefix',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'customImport\nresidentLegalStipColumn',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'customImport\nlossLeaderUnitColumn',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
];

const addMessageForCalendarCleanup = async ctx =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: EXTERNAL_CALENDARS_TYPE.CLEANUP_CALENDAR_ACCOUNTS,
    message: {
      tenantId: ctx.tenantId,
    },
    ctx,
  });

const addResidentLegalStipulationFlagCleanup = async ctx =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: IMPORT_MESSAGE_TYPE.CLEANUP_RESIDENT_LEGAL_STIPULATION_FLAG,
    message: {
      tenantId: ctx.tenantId,
    },
    ctx,
  });

const addLossLeaderUnitFlagCleanup = async ctx =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: IMPORT_MESSAGE_TYPE.CLEANUP_LOSS_LEADER_UNIT_FLAG,
    message: {
      tenantId: ctx.tenantId,
    },
    ctx,
  });

const updateTenantAndCalendarFlag = async (ctx, tenantId, setting, metadata, existingExternalCalendarIntegrationFlag) => {
  const {
    features: { enableExternalCalendarIntegration: newCalendarExternalIntegrationFlag },
  } = setting;
  const integrationEnabledFlag = !!newCalendarExternalIntegrationFlag;
  await updateTenant(ctx, tenantId, {
    settings: setting,
    metadata: { ...metadata, externalCalendars: { ...metadata.externalCalendars, integrationEnabled: integrationEnabledFlag } },
  });

  if (!newCalendarExternalIntegrationFlag && existingExternalCalendarIntegrationFlag) {
    await addMessageForCalendarCleanup({ tenantId });
  }
};

const logParsedValue = (ctx, key, value) => {
  let val = value;
  privateLogEntries.forEach(property => {
    if (key.toLowerCase().includes(property)) {
      val = OBSCURE_VALUE;
    }
  });

  logger.trace({ ctx, key, parsedValue: val }, 'import tenant global settings key');
};

const additionalValidations = async (ctx, globalSetting) => {
  const validation = [];

  const {
    metadata: { backendIntegration },
  } = await getTenant(ctx);

  if (backendIntegration?.name !== DALTypes.BackendMode.YARDI) {
    const residentLegalStipColumn = globalSetting[RESIDENT_LEGAL_STIP_FIELD_NAME];
    if (residentLegalStipColumn.toLowerCase() !== 'false') {
      logger.error({ ctx }, RESIDENT_LEGAL_STIP_FLAG_FALSE_ERROR);
      validation.push({
        name: RESIDENT_LEGAL_STIP_FIELD_NAME,
        message: RESIDENT_LEGAL_STIP_FLAG_FALSE_ERROR,
      });
    }

    const lossLeaderUnitColumn = globalSetting[LOSS_LEADER_UNIT_FIELD_NAME];
    if (lossLeaderUnitColumn.toLowerCase() !== 'false') {
      logger.error({ ctx }, LOSS_LEADER_UNIT_FALSE_ERROR);
      validation.push({
        name: LOSS_LEADER_UNIT_FIELD_NAME,
        message: LOSS_LEADER_UNIT_FALSE_ERROR,
      });
    }
  }

  return validation;
};

const cleanupResidentLegalStipulationFlagIfNeeded = async (tenantData, tenantId, globalSetting) => {
  const { settings, metadata } = tenantData;

  const residentLegalStipColumnToImport = globalSetting[RESIDENT_LEGAL_STIP_FIELD_NAME];
  const existingLegalStipColumn = settings?.customImport?.residentLegalStipColumn || '';

  const columnChanged = residentLegalStipColumnToImport.toLowerCase() !== existingLegalStipColumn.toLowerCase();

  if (
    (residentLegalStipColumnToImport.toLowerCase() === 'false' && metadata?.backendIntegration?.name === DALTypes.BackendMode.YARDI && columnChanged) ||
    (residentLegalStipColumnToImport !== 'false' && columnChanged)
  ) {
    await addResidentLegalStipulationFlagCleanup({ tenantId });
  }
};

const cleanupLossLeaderUnitFlagIfNeeded = async (tenantData, tenantId, globalSetting) => {
  const { settings, metadata } = tenantData;

  const lossLeaderUnitColumnToImport = globalSetting[LOSS_LEADER_UNIT_FIELD_NAME];
  const existingLossLeaderUnitColumn = settings?.customImport?.lossLeaderUnitColumn || '';

  const columnChanged = lossLeaderUnitColumnToImport.toLowerCase() !== existingLossLeaderUnitColumn.toLowerCase();

  if (
    (lossLeaderUnitColumnToImport.toLowerCase() === 'false' && metadata?.backendIntegration?.name === DALTypes.BackendMode.YARDI && columnChanged) ||
    (lossLeaderUnitColumnToImport !== 'false' && columnChanged)
  ) {
    await addLossLeaderUnitFlagCleanup({ tenantId });
  }
};

const GLOBAL_SETTING_PARSED_VALUE_FIELDS = {}; // In case there is an array
const saveGlobalSettingData = async (ctx, globalSetting) => {
  const tenantId = ctx.tenantId;
  const adminCtx = { tenantId: admin.id };
  const { settings, metadata } = await getTenantData(ctx);
  const {
    features: {
      enableExternalCalendarIntegration: existingExternalCalendarIntegrationFlag,
      enableRingPhoneConfiguration: existingEnableRingPhoneConfiguration,
    } = {},
  } = settings;
  const setting = settings || {};
  logger.trace({ ctx, globalSetting: obscureObject(globalSetting) }, 'import tenant global settings');

  Object.keys(globalSetting).forEach(key => {
    const value = globalSetting[key];
    let parsedValue = GLOBAL_SETTING_PARSED_VALUE_FIELDS[key] ? GLOBAL_SETTING_PARSED_VALUE_FIELDS[key].getParsedValue(value) : value;
    parsedValue = parsedValue != null ? parsedValue : {};
    logParsedValue(ctx, key, parsedValue);

    const keys = key.split('\n');
    if (keys.length > 1) {
      setting[keys[0]] = setting[keys[0]] || {};
      setting[keys[0]][keys[1]] = parsedValue;
    } else {
      setting[key] = parsedValue;
    }
  });

  // TODO: This is temporary. For the training environment we always turn on renewals for now.
  if (config.university.isUniversityEnv) setting.features.enableRenewals = true;

  const { externalCalendars: { integrationEnabled: calendarIntegrationEnabled } = {} } = metadata;

  const { enableRingPhoneConfiguration } = setting.features;
  if (existingEnableRingPhoneConfiguration && !enableRingPhoneConfiguration) {
    await deleteRingPhones(ctx);
  }

  const tenantData = await getTenantData(ctx, null, true);
  await cleanupResidentLegalStipulationFlagIfNeeded(tenantData, tenantId, globalSetting);
  await cleanupLossLeaderUnitFlagIfNeeded(tenantData, tenantId, globalSetting);

  if (calendarIntegrationEnabled) {
    await updateTenantAndCalendarFlag(adminCtx, tenantId, setting, metadata, existingExternalCalendarIntegrationFlag);
  } else {
    await updateTenant(adminCtx, tenantId, { settings: setting });
  }
};

export const importGlobalSettings = async (ctx, globalSettings) => {
  const invalidFields = await validate(
    globalSettings,
    {
      requiredFields: GLOBAL_SETTINGS_REQUIRED_FIELDS,
      async onValidEntity(globalSetting) {
        await saveGlobalSettingData(ctx, globalSetting);
      },
      async customCheck(globalSetting) {
        return await additionalValidations(ctx, globalSetting);
      },
    },
    ctx,
    spreadsheet.GlobalSetting.columns,
  );

  return {
    invalidFields,
  };
};
