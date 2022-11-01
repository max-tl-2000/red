/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import getUUID from 'uuid/v4';

import * as mergeRepo from '../../dal/mergePartyRepo';
import logger from '../../../common/helpers/logger';

export const mergePartyApplication = async (ctx, basePartyId, mergedPartyId) => {
  const myLogCtx = { ctx, basePartyId, mergedPartyId };
  logger.trace(myLogCtx, 'mergePartyApplication - params');
  const start = new Date().getTime();

  const mergedPartyApplication = (await mergeRepo.getPartyApplicationByPartyId(ctx, mergedPartyId)) || {};
  const basePartyApplication = (await mergeRepo.getPartyApplicationByPartyId(ctx, basePartyId)) || {};

  const application = {
    ...mergedPartyApplication,
    ...basePartyApplication,
    partyId: basePartyId,
    maxApprovedAt: null,
    minDeniedAt: null,
  };
  if (!application.id) {
    // this means that neither party has an application yet
    logger.info(myLogCtx, 'mergePartyApplication neither party has application yet');
    return {};
  }
  const logAppData = app => pick(app, ['id', 'isHeld', 'maxApprovedAt', 'minDeniedAt']);
  logger.info(
    {
      ...myLogCtx,
      mergedPartyApplicationData: logAppData(mergedPartyApplication),
      basePartyApplicationData: logAppData(basePartyApplication),
      targetPartyApplicationData: logAppData(application),
    },
    'updating party application',
  );
  let result;
  if (application.id === mergedPartyApplication.id) {
    logger.info(myLogCtx, 'mergePartyApplication - party application exists just in merged party so will be copied');
    result = await mergeRepo.savePartyApplication(ctx, { ...application, id: getUUID() });
  } else {
    result = await mergeRepo.updatePartyApplication(ctx, application);
  }

  const end = new Date().getTime();
  logger.trace({ ctx, duration: end - start }, 'mergePartyApplication - duration');
  return result;
};
