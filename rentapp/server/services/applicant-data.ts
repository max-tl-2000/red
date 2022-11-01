/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isEmpty from 'lodash/isEmpty';
import { IDbContext, IDataDiff } from '../../../common/types/base-types';
import { IApplicantData, IApplicantDataNotCommitted } from '../helpers/applicant-types';
import { getActiveApplicantDataByPersonId, createApplicantData, updateApplicantData } from '../dal/applicant-data-repo';
import {
  createApplicantDataNotCommitted,
  getApplicantDataNotCommittedByPersonIdAndPartyId,
  updateApplicantDataNotCommitted,
} from '../dal/applicant-data-not-committed-repo';
import { getApplicantDataDiff } from '../helpers/applicant-data-diff-helper';
import {
  validateUniqueEmail,
  validateQuotePromotions,
  validateUniqueEmailApplication,
  enhanceApplicationWithStandardizedAddress,
} from '../helpers/application-helper';
import { now } from '../../../common/helpers/moment-utils';
import { assert } from '../../../common/assert';
import { mapScreeningApplicantData } from '../screening/fadv/applicant-data-parser';

import loggerModule from '../../../common/helpers/logger';
import { runInTransaction } from '../../../server/database/factory';
import { refreshApplicantReports } from '../screening/v2/applicant-report';

const logger = loggerModule.child({ subType: 'applicantDataService' });

const applicantDataContainsChanges = (applicationDataDiff: IDataDiff): boolean => !isEmpty(applicationDataDiff);

export const calculateApplicantDataTimestamps = (applicantData: IApplicantData, applicationDataDiff: IDataDiff): object => {
  const _now = now();
  const { applicationDataTimestamps = {} } = applicantData;

  const newApplicantDataTimestamps = Object.keys(applicationDataDiff as {}).reduce(
    (acc, changedData) => ({ ...acc, [changedData]: _now }),
    applicationDataTimestamps,
  );

  return newApplicantDataTimestamps as object;
};

const createNewApplicantData = async (ctx: IDbContext, applicantData: IApplicantData): Promise<IApplicantData> => {
  logger.trace(
    { ctx, personId: applicantData.personId, applicationDataDiff: JSON.stringify(applicantData.applicationDataDiff || {}) },
    'saving new applicant data',
  );
  return await createApplicantData(ctx, applicantData);
};

export const saveApplicantData = async (ctx: IDbContext, applicantData: IApplicantData): Promise<IApplicantData> => {
  const { personId } = applicantData;
  let applicantDataUpdated = false;

  const applicantDataResult = await runInTransaction(async innerTrx => {
    const innerCtx = { ...ctx, trx: innerTrx };

    const existingApplicantData = await getActiveApplicantDataByPersonId(innerCtx, personId);

    if (!existingApplicantData) {
      applicantData.applicationDataDiff = getApplicantDataDiff(applicantData);
      applicantData.applicationDataTimestamps = calculateApplicantDataTimestamps(applicantData, applicantData.applicationDataDiff);

      const savedApplicantData = await createNewApplicantData(innerCtx, applicantData);
      applicantDataUpdated = true;

      return savedApplicantData;
    }

    const updatedApplicationDataDiff = getApplicantDataDiff(existingApplicantData, applicantData);

    if (!applicantDataContainsChanges(updatedApplicationDataDiff)) return existingApplicantData;

    const { id: existingApplicantDataId, propertyId: existingPropertyId, applicationDataTimestamps: existingApplicationDataTimestamps } = existingApplicantData;

    applicantData.propertyId = existingPropertyId;
    applicantData.applicationDataDiff = updatedApplicationDataDiff;
    applicantData.applicationDataTimestamps = existingApplicationDataTimestamps;
    applicantData.applicationDataTimestamps = calculateApplicantDataTimestamps(applicantData, updatedApplicationDataDiff);

    existingApplicantData.endDate = now().toDate();
    await updateApplicantData(innerCtx, existingApplicantDataId as string, existingApplicantData);

    const savedApplicantData = await createNewApplicantData(innerCtx, applicantData);
    applicantDataUpdated = true;

    return savedApplicantData;
  }).catch(error => {
    logger.error({ ctx, error, personId }, 'Error on create applicant data');
    throw error;
  });

  if (applicantDataUpdated) {
    logger.trace({ ctx, personId, applicantDataUpdated }, 'refreshing applicant reports');
    await refreshApplicantReports(ctx, personId, applicantDataUpdated);
  }

  return applicantDataResult;
};

export const createOrUpdateApplicantDataNotCommitted = async (
  ctx: IDbContext,
  applicantDataNotCommitted: IApplicantDataNotCommitted,
  skipStandardizedAddressValidation: boolean = true,
): Promise<IApplicantDataNotCommitted> => {
  const { tenantId } = ctx;
  assert(tenantId, 'createOrUpdateApplicantDataNotCommited now expects a ctx instead of tenantId');

  const { applicationData, personId, partyId } = applicantDataNotCommitted;

  const { firstName = '', lastName = '' } = applicationData || {};
  logger.debug({ ctx, firstName, lastName, personId, partyId }, 'createOrUpdateApplicantDataNotCommited');

  await validateQuotePromotions(ctx, partyId);
  applicationData && (await validateUniqueEmail(ctx, applicationData.email, personId));

  const existingApplicantDataNotCommited = await getApplicantDataNotCommittedByPersonIdAndPartyId(ctx, personId, partyId);
  !skipStandardizedAddressValidation && (await enhanceApplicationWithStandardizedAddress(ctx, applicantDataNotCommitted, existingApplicantDataNotCommited));

  if (applicationData) {
    await validateUniqueEmailApplication(ctx, applicationData.email, partyId, (existingApplicantDataNotCommited || {}).id);
    applicantDataNotCommitted.applicationData = mapScreeningApplicantData(applicantDataNotCommitted, existingApplicantDataNotCommited);
  }

  if (existingApplicantDataNotCommited) {
    logger.info({ ctx, partyId, personId, personApplicationId: existingApplicantDataNotCommited.id }, 'Updating existing applicant data not committed');

    if (applicantDataNotCommitted.applicationData) {
      existingApplicantDataNotCommited.applicationData = applicantDataNotCommitted.applicationData;
    }

    const [updatedApplicantDataNotCommitted] = await updateApplicantDataNotCommitted(
      ctx,
      existingApplicantDataNotCommited.id as string,
      existingApplicantDataNotCommited,
    );

    // TODO: CPM-12483: handle sending application event
    // runNotify && notifyApplicationEvent(notifyData, application, eventTypes.APPLICATION_UPDATED);

    logger.debug({ ctx, firstName, lastName, personId, partyId }, 'createOrUpdateApplicantDataNotCommited exiting');

    return updatedApplicantDataNotCommitted;
  }

  logger.info({ ctx, personId, partyId }, 'Creating initial applicant data not committed');

  return await runInTransaction(async innerTrx => {
    const innerCtx = { ...ctx, trx: innerTrx };

    // TODO: CPM-12483: handle sending application event
    // notifyApplicationEvent(notifyData, application, eventTypes.APPLICATION_CREATED);

    return await createApplicantDataNotCommitted(innerCtx, applicantDataNotCommitted);
  }, ctx).catch(error => {
    logger.error({ ctx, error, personId, partyId }, 'Error on create non committed applicant data');
    throw error;
  });
};
