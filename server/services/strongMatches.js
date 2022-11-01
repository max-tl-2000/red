/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { mapSeries } from 'bluebird';
import intersection from 'lodash/intersection';

import { DALTypes } from '../../common/enums/DALTypes';
import { getContactsInfoByPhone, enhanceContactInfos } from '../dal/contactInfoRepo';
import { getPartyIdsByPersonIds, loadPartyById } from '../dal/partyRepo';
import { saveStrongMatches, deleteStrongMatches, dismissStrongMatch } from '../dal/strongMatchesRepo';
import loggerModule from '../../common/helpers/logger';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';

const logger = loggerModule.child({ subtype: 'strongMatches' });

const getExistingContactInfos = async (ctx, contactInfo) => {
  const existingContactInfos = await getContactsInfoByPhone(ctx, contactInfo.value);

  return existingContactInfos.filter(ci => ci.id !== contactInfo.id);
};

const constructStrongMatchEntity = (newContactInfo, existingContactInfo, personId) => ({
  id: getUUID(),
  firstPersonId: personId,
  firstPersonContactInfoId: newContactInfo.id,
  secondPersonId: existingContactInfo.personId,
  secondPersonContactInfoId: existingContactInfo.id,
  value: newContactInfo.value,
  status: DALTypes.StrongMatchStatus.NONE,
});

const personsHavePartiesInCommon = (ctx, newPersonPartyIds, existingPersonPartyIds) => {
  logger.trace({ ctx, newPersonPartyIds, existingPersonPartyIds }, 'personsHavePartiesInCommon - params');

  const partiesInCommonExist = intersection(newPersonPartyIds, existingPersonPartyIds).length > 0;

  if (partiesInCommonExist) {
    logger.trace({ ctx, newPersonPartyIds, existingPersonPartyIds, partiesInCommonExist }, 'personsHavePartiesInCommon - skipping strong match creation');
  }

  return partiesInCommonExist;
};

const excludeSamePartyContactInfos = async (ctx, existingContactInfos, newPersonPartyIds) => {
  const contactInfosWithParties = await enhanceContactInfos(
    ctx,
    existingContactInfos.map(ci => ci.id),
  );

  return contactInfosWithParties.filter(
    contactInfo => !contactInfo.personMergedWith && !personsHavePartiesInCommon(ctx, newPersonPartyIds, contactInfo.partyIds),
  );
};

export const generateStrongMatches = async (ctx, contactInfos, personId) => {
  logger.trace({ ctx, contactInfos, personId }, 'generateStrongMatches - params');

  let strongMatches = [];

  await mapSeries(contactInfos, async newContactInfo => {
    const existingContactInfos = await getExistingContactInfos(ctx, newContactInfo);
    const newPersonPartyIds = await getPartyIdsByPersonIds(ctx, [personId]);
    const filteredContactInfos = await excludeSamePartyContactInfos(ctx, existingContactInfos, newPersonPartyIds);
    const matches = filteredContactInfos.map(existingContactInfo => constructStrongMatchEntity(newContactInfo, existingContactInfo, personId));
    strongMatches = [...strongMatches, ...matches];
  });

  if (strongMatches.length) {
    const savedStrongMatches = await saveStrongMatches(ctx, strongMatches);
    logger.trace({ ctx, contactInfos, personId, savedStrongMatches }, 'generateStrongMatches - savedStrongMatches');
  } else {
    logger.trace({ ctx, contactInfos, personId }, 'generateStrongMatches - no strong matches');
  }
};

export const deleteUnresolvedStrongMatches = async (ctx, contactInfos) => {
  logger.trace({ ctx, contactInfos }, 'deleteUnresolvedStrongMatches - params');

  const contactInfoIds = contactInfos.map(item => item.id);

  if (contactInfoIds.length) {
    const deletedResult = await deleteStrongMatches(ctx, contactInfoIds);
    logger.trace({ ctx, contactInfos, deletedResult }, 'deleteUnresolvedStrongMatches - deletedResult');
  } else {
    logger.trace({ ctx, contactInfos }, 'deleteUnresolvedStrongMatches - nothing to delete');
  }
};

export const saveMatchesDismissals = async (ctx, personId, dismissedMatches) => {
  dismissedMatches && (await mapSeries(dismissedMatches, async dismissedMatch => await dismissStrongMatch(ctx, personId, dismissedMatch)));
  const partyIds = await getPartyIdsByPersonIds(ctx, [personId], false);

  await mapSeries(partyIds, async partyId => {
    const party = await loadPartyById(ctx, partyId);

    notify({
      ctx,
      event: eventTypes.PARTY_UPDATED,
      data: { partyId },
      routing: { teams: party.teams },
    });
  });
};
