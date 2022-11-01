/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import loggerModule from '../../../common/helpers/logger';
import { DATE_US_FORMAT } from '../../../common/date-constants';
import { sendPriceChangesDetectedMail } from '../../services/mails';
import { convertToFloat, formatMoney } from '../../../common/money-formatter';
import { USD } from '../../../common/currency';
import { parseAsInTimezone, now } from '../../../common/helpers/moment-utils';
import { getPropertyByNameIndex, getRowsProperties } from './updatesHelper';
import { ImportMappersEntityTypes } from '../../../common/enums/enums';
import { propertyHeaderMapping } from './propertyHeaderMapping';
import { DIFF_ACTION_TAG, getDifferences, mapDifferences, mapEntity } from './daff-helpers';

const logger = loggerModule.child({ subType: 'notifyUpdatesHandler' });

const yardiEntityMappingRules = {
  currentChargeDate: ({ key, value, timezone }) => {
    const formatedValue = parseAsInTimezone(value, { format: DATE_US_FORMAT, timezone }).format(DATE_US_FORMAT);
    return [key, formatedValue];
  },
  currentCharge: ({ key, value }) => {
    const amount = convertToFloat(value);
    const formatedValue = formatMoney({ amount, currency: USD.code }).result;
    return [key, formatedValue];
  },
};

const mriEntityMappingRules = {
  changeDate: ({ value, timezone }) => {
    const formatedValue = parseAsInTimezone(value, { format: DATE_US_FORMAT, timezone }).format(DATE_US_FORMAT);
    return ['currentChargeDate', formatedValue];
  },
  amount: ({ value }) => {
    const amount = convertToFloat(value);
    const formatedValue = formatMoney({ amount, currency: USD.code }).result;
    return ['currentCharge', formatedValue];
  },
};

const entityTypeMapper = {
  [ImportMappersEntityTypes.UnitAmenitiesMapper]: yardiEntityMappingRules,
  [ImportMappersEntityTypes.MriUnitAmenitiesMapper]: mriEntityMappingRules,
};

const mapValues = (entityType, { key, value, timezone }) => {
  const mappingRules = entityTypeMapper[entityType];
  if (!mappingRules) {
    throw new Error('No mapper added for the entity');
  }

  const mapperFunction = mappingRules[key];
  return mapperFunction ? mapperFunction({ key, value, timezone }) : [key, value];
};

const isChangeValid = (data = {}, filter, timezone) => {
  if (!data.currentChargeDate) return false;

  const { fromDay, toDay } = filter;
  return parseAsInTimezone(data.currentChargeDate, { timezone, format: DATE_US_FORMAT }).isBetween(fromDay, toDay, null, '[]');
};

const isRmsPricingSetupForProperty = (settings = {}) => get(settings, 'integration.import.unitPricing', false) === true;

const reduceDiffHandler = (ctx, { entityType, headers, propertyNameIndex, properties, action = DIFF_ACTION_TAG.insert }) => (acc, row) => {
  switch (action) {
    case DIFF_ACTION_TAG.update:
    case DIFF_ACTION_TAG.insert: {
      const { timezone = '', settings } = getPropertyByNameIndex(ctx, { entityType, row, propertyNameIndex, properties });
      if (isRmsPricingSetupForProperty(settings)) return acc;

      const filter = {
        fromDay: now({ timezone }).add(-1, 'day').startOf('day'),
        toDay: now({ timezone }).endOf('day'),
      };

      const data = mapEntity(headers, row, (key, value) => mapValues(entityType, { key, value, timezone }));
      if (isChangeValid(data, filter, timezone)) acc.push(data);
      break;
    }
    default:
      break;
  }
  return acc;
};

export const getUpdatedUnitAmenities = async (tenantId, { actual, previous, headers, entityType }) => {
  logger.debug({ tenantId, rows: actual && actual.length }, 'unit amenities');
  const ctx = { tenantId };
  const propertyHeaderName = propertyHeaderMapping[entityType];
  const propertyNameIndex = headers.indexOf(propertyHeaderName);
  let properties;

  if (!previous || !previous.length) {
    properties = await getRowsProperties(ctx, { entityType, rows: actual, propertyNameIndex });
    return actual.reduce(reduceDiffHandler(ctx, { entityType, headers, propertyNameIndex, properties }), []);
  }

  const diff = getDifferences(headers, previous, actual);
  logger.debug({ diff }, 'unit amenities - diff');
  if (!(diff && diff.data && diff.data.length)) return [];

  properties = await getRowsProperties(ctx, { entityType, rows: diff.data, propertyNameIndex: propertyNameIndex + 1 });
  return mapDifferences(diff.data, action => reduceDiffHandler(ctx, { entityType, headers, propertyNameIndex, properties, action }));
};

export const notifyChangingPrice = async (ctx, actual, previous, headers, entityType, thirdPartySystem) => {
  const unitAmenitites = await getUpdatedUnitAmenities(ctx.tenantId, { actual, previous, headers, entityType });

  logger.debug({ ctx, rows: unitAmenitites && unitAmenitites.length, thirdPartySystem }, 'updated unit amenities');

  if (!(unitAmenitites && unitAmenitites.length)) return;

  await sendPriceChangesDetectedMail(ctx, { priceChanges: unitAmenitites, thirdPartySystem });
};
