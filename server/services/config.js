/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import config from '../config';
import { getPropertyId } from './properties';
import { ServiceError } from '../common/errors';
import { getMarketRentRange } from '../dal/inventoryRepo';
import { admin } from '../common/schemaConstants';
import { getPropertyTimezone } from '../dal/propertyRepo';
import { getPartySettings } from './party-settings';
import { getTenantSettings } from './tenantService';

const getConfig = async ctx => {
  if (!ctx.tenantId) {
    throw new ServiceError({
      token: 'INVALID_TENANT',
      status: 400,
    });
  }

  let tenantSettings = await getTenantSettings(ctx);
  if (tenantSettings) {
    tenantSettings = pick(tenantSettings, ['preferences']);
  }

  const cfg = {
    emailDomain: config.mail.emailDomain,
    smsTemplateNameMap: config.smsTemplateNameMap,
    pagePaths: config.pagePaths,
    tenantName: ctx.tenantName,
    tenantSettings,
    // example of accessing the translator context
    // in the server
    //
    // ctx.i18n.translator.translate === i18next.t in the client
    // appTitle: ctx.i18n.translator.translate('APP_TITLE'),
  };

  if (ctx.tenantId !== admin.id) {
    const [marketRentRange, partySettings] = await Promise.all([getMarketRentRange(ctx.tenantId), getPartySettings(ctx)]);
    cfg.marketRentRange = marketRentRange;
    cfg.partySettings = partySettings;
  }

  return cfg;
};

export const getTenantAndPropertyIds = async (ctx, propertyName) => {
  let temporalPropertyName = propertyName;
  if (propertyName.toLowerCase() === 'parkmerced') {
    temporalPropertyName = 'swparkme';
  } // TODO: This code is to switch from Parkmerced to swparkme in order to find the id

  const propertyId = await getPropertyId(ctx, temporalPropertyName);
  if (!propertyId) {
    throw new ServiceError({
      token: 'INVALID_PROPERTY_FOR_GIVEN_TENANT',
      status: 400,
    });
  }

  const propertyTimezone = await getPropertyTimezone(ctx, propertyId);
  return {
    tenantId: ctx.tenantId,
    tenantName: ctx.tenantName,
    propertyName: propertyName === 'swparkme' ? 'Parkmerced' : propertyName, // TODO: This code is to switch from swparkme to Parkmerced in order to display Parkmerced
    propertyId,
    propertyTimezone,
  };
};

export { getConfig };
