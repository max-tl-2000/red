/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

import * as partyRepo from '../../dal/partyRepo';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'mergePartiesService' });

const getQualificationQuestionsAndUnitFilters = (baseParty, mergedParty) => {
  const hasBasePartyQualificationQuestions = !isEmpty(baseParty.qualificationQuestions);
  const hasMergedPartyQualificationQuestions = !isEmpty(mergedParty.qualificationQuestions);

  const defaultUnitFilters = { propertyIds: [baseParty.assignedPropertyId] };
  const areCustomUnitFilter = unitsFilters => unitsFilters && !isEqual(defaultUnitFilters, unitsFilters);

  const hasBasePartyNoDefaultUnitsFilters = areCustomUnitFilter(baseParty.storedUnitsFilters);
  const hasMergedPartyNoDefaultUnitsFilters = areCustomUnitFilter(mergedParty.storedUnitsFilters);

  const shouldUpdateQualificationQuestions = !hasBasePartyQualificationQuestions && hasMergedPartyQualificationQuestions;
  const shouldUpdateStoredUnitFilters = !hasBasePartyNoDefaultUnitsFilters && hasMergedPartyNoDefaultUnitsFilters;

  return {
    qualificationQuestions: shouldUpdateQualificationQuestions ? mergedParty.qualificationQuestions : baseParty.qualificationQuestions,
    storedUnitsFilters: shouldUpdateStoredUnitFilters ? mergedParty.storedUnitsFilters : baseParty.storedUnitsFilters,
  };
};

const addFavoriteUnits = (partyDelta, basePartyMetadata, mergedPartyMetadata) => {
  const { favoriteUnits: baseFavoriteUnits } = basePartyMetadata;
  const { favoriteUnits: mergedFavoriteUnits } = mergedPartyMetadata;

  if (!baseFavoriteUnits && !mergedFavoriteUnits) return partyDelta;

  return {
    ...partyDelta,
    metadata: {
      ...partyDelta.metadata,
      favoriteUnits: [...new Set([...(baseFavoriteUnits || []), ...(mergedFavoriteUnits || [])])],
    },
  };
};

export const mergePartySpecificFields = async (ctx, basePartyId, mergedPartyId) => {
  logger.trace({ ctx, basePartyId, mergedPartyId }, 'mergePartySpecificFields - params');
  const start = new Date().getTime();

  const baseParty = await partyRepo.loadPartyById(ctx, basePartyId);
  const mergedParty = await partyRepo.loadPartyById(ctx, mergedPartyId);

  const partiesSortedByDate = sortBy([baseParty, mergedParty], ['created_at']);
  const [{ metadata: elderPartyMetadata }, { metadata: youngerPartyMetadata }] = partiesSortedByDate;

  const qQuestionsAndUnitFilters = getQualificationQuestionsAndUnitFilters(baseParty, mergedParty);
  const teams = [...new Set([...baseParty.teams, ...mergedParty.teams])];
  const collaborators = [...new Set([...baseParty.collaborators, ...mergedParty.collaborators])];

  let delta = {
    teams,
    collaborators,
    qualificationQuestions: qQuestionsAndUnitFilters.qualificationQuestions,
    storedUnitsFilters: qQuestionsAndUnitFilters.storedUnitsFilters,
    metadata: {
      ...baseParty.metadata,
      activatePaymentPlanDate: baseParty.metadata.activatePaymentPlanDate || mergedParty.metadata.activatePaymentPlanDate,
      creationType: elderPartyMetadata.creationType || youngerPartyMetadata.creationType || null,
      firstContactedDate: elderPartyMetadata.firstContactedDate || youngerPartyMetadata.firstContactedDate || null,
      programId: elderPartyMetadata.programId || youngerPartyMetadata.programId || null,
      firstContactChannel: elderPartyMetadata.firstContactChannel || youngerPartyMetadata.firstContactChannel || null,
      source: elderPartyMetadata.source || youngerPartyMetadata.source || null,
    },
  };

  delta = addFavoriteUnits(delta, baseParty.metadata, mergedParty.metadata);

  const result = await partyRepo.updateParty(ctx, { ...delta, id: baseParty.id });

  const end = new Date().getTime();
  logger.trace({ ctx, duration: end - start }, 'mergePartySpecificFields - duration');
  return result;
};
