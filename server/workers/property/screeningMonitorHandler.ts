/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import loggerModule from '../../../common/helpers/logger';
import { getTenantData } from '../../dal/tenantsRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { IDictionaryHash, IConsumerResult, IDbContext } from '../../../common/types/base-types';
import { getPropertiesWithCompleteScreeningsAndNoPushes } from '../../../rentapp/server/dal/fadv-submission-repo';

const logger = loggerModule.child({ subType: 'screeningMonitor' });
const { ScreeningProviderMode } = DALTypes;

const getTenantScreeningProviderMode = (tenant: IDictionaryHash<any>): string => get(tenant, 'metadata.screeningProviderMode', ScreeningProviderMode.FAKE);

const isFadvProdModeEnabled = (tenant: IDictionaryHash<any>): boolean => getTenantScreeningProviderMode(tenant) === ScreeningProviderMode.FADV_PROD;

const checkPropertyScreeningsPushes = async (ctx: IDbContext): Promise<IDictionaryHash<any>[]> => {
  logger.debug({ ctx }, 'checking for properties screening pushes');

  const tenant = await getTenantData(ctx);

  if (!isFadvProdModeEnabled(tenant)) return [];

  const properties = await getPropertiesWithCompleteScreeningsAndNoPushes(ctx);
  properties &&
    properties.length &&
    logger.warn({ ctx, properties: properties.map(property => property.name).join(', ') }, 'properties with complete screenings and no pushes');

  return properties;
};

export const screeningMonitor = async (payload: IDictionaryHash<any>): Promise<IConsumerResult> => {
  const { msgCtx: ctx } = payload;
  logger.time({ ctx, payload }, 'Recurring Jobs - Running screeningMonitor duration');

  await checkPropertyScreeningsPushes(ctx);

  logger.timeEnd({ ctx, payload }, 'Recurring Jobs - Running screeningMonitor duration');
  return { processed: true };
};
