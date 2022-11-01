/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import difference from 'lodash/difference';
import newId from 'uuid/v4';
import chunk from 'lodash/chunk';
import { mapSeries } from 'bluebird';
import { DALTypes } from '../../../common/enums/DALTypes';
import {
  savePostRecipientsFromUnitCodes,
  savePostRecipientsFromResidentCodes,
  saveUnmatchedPostRecipientsFromResidentCodes,
  getNumberOfMatchingResidentCodes,
  saveMissingPostRecipientResidentCodes,
  getNumberOfMatchingResidentsForUnitCodes,
} from '../../dal/cohortCommsRepo';
import { CohortConstants } from '../../../common/enums/cohortConstants';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'cohortUpdates' });

const getCaseInsensitiveKey = (object, searchedKey) => Object.keys(object).find(key => key.toLowerCase() === searchedKey.toLowerCase());

const cohortRowHasResidentCode = cohortDataObj => cohortDataObj && getCaseInsensitiveKey(cohortDataObj, CohortConstants.FileColumns.ResidentCode);

// This code is used for performance reasons
const filterUniqueCodes = cohortData => {
  const seen = {};
  const uniqueCodes = [];
  for (let i = 0; i < cohortData.length; i++) {
    if (!(cohortData[i] in seen)) {
      uniqueCodes.push(cohortData[i]);
      seen[cohortData[i]] = true;
    }
  }
  return uniqueCodes;
};

const getMatchingResidentCodes = async (ctx, cohortData) => {
  logger.trace({ ctx, cohortDataCount: cohortData.length }, 'getMatchingResidentCodes');

  const firstRow = cohortData?.[0];
  const residentCodeKey = getCaseInsensitiveKey(firstRow, CohortConstants.FileColumns.ResidentCode);
  const residentCodes = cohortData.map(fields => fields[residentCodeKey]);
  const uniqueCodes = filterUniqueCodes(residentCodes);

  return await getNumberOfMatchingResidentCodes(ctx, uniqueCodes);
};

const getMatchingUnitCodesWithoutPartyDetails = async (ctx, cohortData) => {
  logger.trace({ ctx, cohortDataCount: cohortData.length }, 'getMatchingUnitCodesWithoutPartyDetails');

  const firstRow = cohortData?.[0];
  const unitCodeKey = getCaseInsensitiveKey(firstRow, CohortConstants.FileColumns.UnitCode);
  const unitCodes = cohortData.map(fields => fields[unitCodeKey]);

  return await getNumberOfMatchingResidentsForUnitCodes(ctx, unitCodes);
};

const getMatchingUnitCodes = async (ctx, cohortData) => {
  logger.trace({ ctx, cohortDataCount: cohortData.length }, 'getMatchingUnitCodes');

  return await getMatchingUnitCodesWithoutPartyDetails(ctx, cohortData);
};

export const getMatchingCodes = async (ctx, cohortData) => {
  logger.trace({ ctx, cohortDataCount: cohortData.length }, 'getMatchingCodes');

  const firstRow = cohortData?.[0];
  const hasResidentCode = cohortRowHasResidentCode(firstRow);

  const matchingCodes = hasResidentCode ? await getMatchingResidentCodes(ctx, cohortData) : await getMatchingUnitCodes(ctx, cohortData);
  const numberOfMatchingCodes = parseInt(matchingCodes, 10);

  logger.trace({ ctx, totalCodes: cohortData.length, numberOfMatchingCodes }, 'getMatchingCodes - done');

  return { numberOfMatchingCodes, hasResidentCode };
};

const addCohortDataForUnitCodes = async (ctx, cohortData, postId, fileId) => {
  logger.trace({ ctx, cohortDataLength: cohortData.length, postId }, 'addCohortDataForUnitCodes');

  const unitCodeCaseInsensitiveKey = getCaseInsensitiveKey(cohortData?.[0], CohortConstants.FileColumns.UnitCode);

  const unitCodes = cohortData.map(fields => fields[unitCodeCaseInsensitiveKey]);
  const uniqueCodes = filterUniqueCodes(unitCodes);

  await savePostRecipientsFromUnitCodes(ctx, uniqueCodes, postId, fileId);
};

const addCohortDataForResidentCodes = async (ctx, cohortData, postId, fileId) => {
  logger.trace({ ctx, cohortDataLength: cohortData.length, postId }, 'addCohortDataForResidentCodes');

  const residentCodeCaseInsensitiveKey = getCaseInsensitiveKey(cohortData?.[0], CohortConstants.FileColumns.ResidentCode);
  const residentCodes = cohortData.map(fields => fields[residentCodeCaseInsensitiveKey]);
  const uniqueResidentCodes = filterUniqueCodes(residentCodes);

  const matchedResidents = await savePostRecipientsFromResidentCodes(ctx, uniqueResidentCodes, postId, fileId);
  const unmatchedCodes = difference(
    uniqueResidentCodes,
    matchedResidents.map(r => r.personExternalId),
  );
  const unmatchedResidents = await saveUnmatchedPostRecipientsFromResidentCodes(ctx, unmatchedCodes, postId, fileId);
  const missingResidentsCodes = difference(
    unmatchedCodes,
    unmatchedResidents.map(r => r.personExternalId),
  );

  if (missingResidentsCodes.length) {
    logger.trace({ ctx, residentCodesCount: missingResidentsCodes.length, postId, fileId }, 'saveMissingPostRecipientResidentCodes');

    const missingPostRecipients = missingResidentsCodes.map(extId => ({
      id: newId(),
      postId,
      personExternalId: extId,
      postRecipientFileId: fileId,
      status: DALTypes.PostRecipientStatus.NOT_SENT,
      reason: 'Resident code does not exist in Reva',
    }));

    const maxNumOfRecipientsToInsert = 999;
    if (missingPostRecipients.length > maxNumOfRecipientsToInsert) {
      const recipientChunks = chunk(missingPostRecipients, maxNumOfRecipientsToInsert);
      logger.trace({ ctx, postId, fileId, noOfChunks: recipientChunks.length }, 'insertMissingPostRecipientCods - no of chunks');
      await mapSeries(recipientChunks, async batch => await saveMissingPostRecipientResidentCodes(ctx, batch));
    } else await saveMissingPostRecipientResidentCodes(ctx, missingPostRecipients);
  }
};

export const addCohortData = async (ctx, cohortData, postId, fileId) => {
  if (!cohortData || !cohortData.length) return {};

  logger.trace({ ctx, cohortDataLength: cohortData.length, postId }, 'addCohortData');

  const hasResidentCode = cohortRowHasResidentCode(cohortData?.[0]);

  hasResidentCode ? await addCohortDataForResidentCodes(ctx, cohortData, postId, fileId) : await addCohortDataForUnitCodes(ctx, cohortData, postId, fileId);

  return await getMatchingCodes(ctx, cohortData);
};
