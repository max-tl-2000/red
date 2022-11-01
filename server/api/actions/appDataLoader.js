/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loadPersonDetailsData, loadPartyDetailsData, loadFilteredDashboardBulk, loadGlobalData } from '../../services/appDataLoaderService';
import loggerModule from '../../../common/helpers/logger';
import { isRevaAdmin } from '../../../common/helpers/auth';
const logger = loggerModule.child({ subType: 'api/appDataLoader' });
import config from '../../config';

import { ServiceError } from '../../common/errors';
import { getTenantSettings } from '../../services/tenantService';

export const getPersonDetailsData = async req => {
  const { personId } = req.params;
  logger.trace({ ctx: req, personId }, 'getPersonDetailsData');

  return loadPersonDetailsData(req, personId);
};

export const getGlobalData = async req => {
  logger.trace({ ctx: req }, 'getGlobalData');
  return await loadGlobalData(req);
};

export const getPartyDetailsData = req => {
  const { partyId } = req.params;

  const readOnlyServer = config.useReadOnlyServer;

  logger.trace({ ctx: req, partyId, readOnlyServer }, 'getPartyDetailsData');
  return loadPartyDetailsData({ ...req, readOnlyServer }, partyId);
};

export const getFilteredDashboard = async req => {
  const readOnlyServer = config.useReadOnlyServer;
  const { acdFilter, extraFilter, originator, isTeamFilter } = req.body;
  logger.trace({ ctx: req, acdFilter, extraFilter, originator, isTeamFilter }, 'getFilteredDashboardBulk');
  if (!acdFilter || !acdFilter.users || !acdFilter.teams) {
    throw new ServiceError({
      token: 'USERS_AND_TEAMS_NOT_SPECIFIED',
      status: 400,
    });
  }
  const tenantSettings = await getTenantSettings(req);

  const duplicatePersonNotificationFeature = tenantSettings?.features?.duplicatePersonNotification;
  const includeStrongMatchData = duplicatePersonNotificationFeature === undefined || duplicatePersonNotificationFeature || isRevaAdmin(req.authUser);
  const res = await loadFilteredDashboardBulk({ ...req, readOnlyServer }, acdFilter, { ...extraFilter, includeStrongMatchData });
  return res;
};

export const getDashboardParty = async req => {
  const { partyId } = req.params;
  const acdFilter = req.body;
  logger.trace({ ctx: req, acdFilter, partyId }, 'getDashboardParty');
  if (!acdFilter.users || !acdFilter.teams) {
    throw new ServiceError({
      token: 'USERS_AND_TEAMS_NOT_SPECIFIED',
      status: 400,
    });
  }
  const res = await loadFilteredDashboardBulk(req, acdFilter, { partyId });
  return res;
};
