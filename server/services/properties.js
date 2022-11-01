/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// TODO: this should be a call to a service
import groupBy from 'lodash/groupBy';
import get from 'lodash/get';
import uniq from 'lodash/uniq';
import isEqual from 'lodash/isEqual';
import { Promise as BlueBirdPromise } from 'bluebird';
import {
  getProperty,
  getProperties as getPropertiesFromDb,
  getPropertyByName,
  getPropertyById as getPropertyFilterById,
  getPropertiesAssociatedWithTeams,
  getProperty as getPropertyDb,
  updateProperty as updatePropertyDb,
  getPostMonthLogByPropertyAndPostMonth,
  savePostMonthLog as savePostMonthLogDb,
  updatePostMonthLog as updatePostMonthLogDb,
  getPropertySettingsByKey as getPropertySettingsByKeyDb,
  getPropertyTimezone as getPropertyTimezoneDb,
  getPropertyByExternalId as getPropertyByExternalIdDb,
  getPropertiesByNames as getPropertiesByNamesDb,
  getPropertiesByExternalIds as getPropertiesByExternalIdsDb,
  updatePropertyProviders,
  getUpdatedPropertyId,
} from '../dal/propertyRepo';
import logger from '../../common/helpers/logger';
import { ApplicationSettingsValues } from '../../common/enums/applicationTypes';
import { SIMPLE_DATE_US_FORMAT } from '../../common/date-constants';
import { ServiceError } from '../common/errors';
import { runInTransaction } from '../database/factory';
import { toMoment, parseAsInTimezone, now } from '../../common/helpers/moment-utils';
import { TARGET_ACCOUNT_TYPE, TARGET_ACCOUNT_PLURAL_TYPE, TARGET_ACCOUNT_NAME } from '../../rentapp/common/enums/target-account-types';
import { getAptexxMaintenanceTypes } from '../../resident/server/services/maintenance';

export const getPropertyId = async (ctx, propertyName) => {
  const property = await getPropertyByName(ctx, propertyName);
  return property ? property.id : null;
};

export const getPropertyById = (ctx, propertyId) => getPropertyFilterById(ctx, propertyId);

export const getPropertiesByNames = (ctx, names) => getPropertiesByNamesDb(ctx, names);

export const getPropertyByExternalId = (ctx, externalId) => getPropertyByExternalIdDb(ctx, externalId);
export const getPropertiesByExternalIds = (ctx, externalIds) => getPropertiesByExternalIdsDb(ctx, externalIds);

export const getProperties = ctx => getPropertiesFromDb(ctx);

export const getPropertiesByIds = (ctx, propertyIds) => getPropertiesFromDb(ctx).whereIn('id', propertyIds);

/**
 * Gets a target item by Target type.
 *
 * @param {Array} targets - Target ids per property name.
 * @param {string} targetType - Target type e.g. holdAccount and applicationAccount.
 * @return {string} Output is impacted properties
 * */
const getTargetIdByType = (targets, targetType) => (targets.find(target => target.type === targetType) || {}).id || '';

/**
 * Gets the Provider target ids
 *
 * @param {Object[]} targets - Target ids per property name.
 * e.g.
 *  "targets": [
 *        {
 *          "id": 12007954,
 *          "type": "holdAccount"
 *        },
 *        {
 *          "id": 12007959,
 *          "type": "applicationAccount"
 *        }
 *      ]
 *
 * @return {Object} Output is impacted properties. { [TARGET_TYPE]: TARGET_ID }
 * */
export const getAptexxSettings = ({ id, targets, maintenanceTypes }) => {
  const accountIds = Object.values(TARGET_ACCOUNT_TYPE).reduce(
    (acc, accountType) => ({ ...acc, [TARGET_ACCOUNT_NAME[accountType]]: getTargetIdByType(targets, accountType) }),
    {},
  );
  return { propertyId: id, maintenanceTypes, accountIds };
};

/**
 * Gets the Provider target ids from paymentProvider on a specific property
 * @param {} ctx
 * @param {*} propertyId
 * @return { [TARGET_TYPE]: TARGET_ID }
 */
export const getTargetAccountsForProperty = async (ctx, propertyId) => {
  const property = await getProperty(ctx, propertyId);
  const { aptexx = {} } = property.paymentProvider || {};
  const { accountIds = {} } = aptexx;
  return Object.keys(accountIds || {}).reduce((acc, key) => ({ ...acc, [TARGET_ACCOUNT_PLURAL_TYPE[key]]: [accountIds[key]] }), {});
};

export const getPropertiesByTeams = async req => {
  const properties = await getPropertiesAssociatedWithTeams(req, req.body.teamIds);
  const trimmedDownProperties = properties.map(p => ({
    id: p.id,
    teamId: p.teamId,
  }));
  return groupBy(trimmedDownProperties, 'id');
};

const isPostMonthValid = ({ property, newPostMonth, timezone }) => {
  if (!newPostMonth || newPostMonth.date() !== 1) return false;
  if (!property.id) return true;
  if (!property.postMonth) return true;

  const currentPostMonth = toMoment(property.postMonth, { timezone });
  const monthDiff = newPostMonth.diff(currentPostMonth, 'month');

  if (monthDiff === 0 || monthDiff === 1) return true;

  return false;
};

const savePostMonthLog = async (ctx, { propertyId, currentPostMonth, newPostMonth, startDate }) => {
  if (currentPostMonth) {
    const [log] = await getPostMonthLogByPropertyAndPostMonth(ctx, propertyId, currentPostMonth);
    if (log) {
      log.endDate = startDate;
      await updatePostMonthLogDb(ctx, log);
    }
  }
  await savePostMonthLogDb(ctx, { propertyId, postMonth: newPostMonth, startDate });
};

export const updatePostMonth = async (ctx, propertyId, postMonth, tz) => {
  logger.trace({ ctx, propertyId, postMonth, tz }, 'updatePostMonth service');

  const property = await getPropertyDb(ctx, propertyId);

  // When we update postMonth from the propertySetup, we have to pass new timezone as parameter
  const timezone = tz || property.timezone;

  const currentPostMonth = property.postMonth ? toMoment(property.postMonth, { timezone }) : null;
  const newPostMonth = parseAsInTimezone(postMonth, { timezone, format: SIMPLE_DATE_US_FORMAT });
  const startDate = now({ timezone });

  if (!isPostMonthValid({ property, newPostMonth, timezone })) {
    throw new ServiceError({
      token: 'INVALID_POST_MONTH',
      status: 412,
      data: {
        propery: property.name,
        postMonth,
      },
    });
  }

  if (currentPostMonth && currentPostMonth.isSame(newPostMonth)) {
    logger.trace({ currentPostMonth, newPostMonth, propertyId }, 'updatePostMonth service - new postmonth already set');
    return null;
  }

  return await runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };
    const newPostMonthStr = newPostMonth.toJSON();
    const currentPostMonthStr = currentPostMonth ? currentPostMonth.toJSON() : null;
    await savePostMonthLog(innerCtx, { propertyId, currentPostMonth: currentPostMonthStr, newPostMonth: newPostMonthStr, startDate: startDate.toJSON() });
    await updatePropertyDb(innerCtx, { id: propertyId }, { postMonth: newPostMonthStr });
  }, ctx);
};

export const getApplicationSettings = async (ctx, id, partyType, memberType) => {
  const settings = await getPropertySettingsByKeyDb(ctx, id, 'applicationSettings');
  const {
    incomeSourcesSection = ApplicationSettingsValues.OPTIONAL,
    addressHistorySection = ApplicationSettingsValues.OPTIONAL,
    childrenSection = ApplicationSettingsValues.OPTIONAL,
    disclosuresSection = ApplicationSettingsValues.OPTIONAL,
    holdDeposit = ApplicationSettingsValues.OPTIONAL,
    petsSection = ApplicationSettingsValues.OPTIONAL,
    privateDocumentsSection = ApplicationSettingsValues.OPTIONAL,
    rentersInsuranceSection = ApplicationSettingsValues.OPTIONAL,
    sharedDocumentsSection = ApplicationSettingsValues.OPTIONAL,
    vehiclesSection = ApplicationSettingsValues.OPTIONAL,
    holdDepositWithoutUnit = ApplicationSettingsValues.OPTIONAL,
  } = get(settings, `setting.${partyType}.${memberType.toLowerCase()}`) || {};

  return {
    incomeSourcesSection,
    addressHistorySection,
    childrenSection,
    disclosuresSection,
    holdDeposit,
    petsSection,
    privateDocumentsSection,
    rentersInsuranceSection,
    sharedDocumentsSection,
    vehiclesSection,
    holdDepositWithoutUnit,
  };
};

export const getPropertyTimezone = async (ctx, propertyId) => await getPropertyTimezoneDb(ctx, propertyId);

const getTargetAccountByName = (associatedAccounts, propertyName) => {
  const activeAccount = associatedAccounts.accounts.filter(account => account.name === propertyName && account.active);
  if (activeAccount && activeAccount.length > 1) throw new ServiceError({ token: 'DUPLICATE_ACTIVE_ACCOUNTS', status: 500 });
  return activeAccount[0];
};

const shouldUpdateAptexxSettings = (paymentProviderSettings, currentAptexxSettings) =>
  !paymentProviderSettings || !isEqual(paymentProviderSettings, currentAptexxSettings);

const getPropertyPaymentProvidersToUpdate = async (ctx, { properties, associatedAccounts }) => {
  let aptexxSettings = {};
  return await BlueBirdPromise.reduce(
    properties,
    async (acc, { id, settings: { payment = {} }, paymentProvider }) => {
      const { propertyName } = payment;
      const targetAccount = getTargetAccountByName(associatedAccounts, propertyName);

      if (!targetAccount) {
        logger.error({ ctx, accountName: propertyName, propertyId: id }, 'Invalid target account');
        acc.accountsNotFound.push(propertyName);
        return acc;
      }
      const maintenanceTypes = await getAptexxMaintenanceTypes(ctx, { clientId: targetAccount.clientId, accountId: targetAccount.id });
      aptexxSettings = getAptexxSettings({ ...targetAccount, maintenanceTypes });

      const formattedAptexxSettings = { aptexx: aptexxSettings };

      if (shouldUpdateAptexxSettings(paymentProvider, formattedAptexxSettings)) {
        const propertyPaymentProviders = [id, JSON.stringify(formattedAptexxSettings)];
        acc.propertyPaymentProviders.push(propertyPaymentProviders);
        return acc;
      }

      return acc;
    },
    { accountsNotFound: [], propertyPaymentProviders: [] },
  );
};

export const updatePaymentProvider = async (ctx, associatedAccounts) => {
  if (!associatedAccounts) {
    logger.error({ ctx }, 'No provider accounts found');
    throw new Error('No provider accounts found');
  }

  const properties = await getProperties(ctx);

  try {
    const { accountsNotFound, propertyPaymentProviders } = await getPropertyPaymentProvidersToUpdate(ctx, { properties, associatedAccounts });

    if (propertyPaymentProviders.length) {
      await updatePropertyProviders(ctx, propertyPaymentProviders);
      logger.trace({ ctx }, 'Payment Provider settings for properties updated');
    }
    return { accountsNotFound: uniq(accountsNotFound) };
  } catch (e) {
    logger.error({ ctx, e }, 'Payment Provider settings updated failed');
    throw new ServiceError({ token: e.message, status: 500, message: 'Payment Provider settings updated failed' });
  }
};

export const getReplacedPropertyId = async (ctx, originalPropertyId) => {
  try {
    const propertyId = await getUpdatedPropertyId(ctx, originalPropertyId);
    return propertyId;
  } catch (error) {
    logger.error({ ctx, error, originalPropertyId }, 'getReplacedPropertyId');
  }
  return originalPropertyId;
};
