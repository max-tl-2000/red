/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPartyMemberByEmailAddress, updatePartyMember, loadPartiesByIds, updateParty, getPartyMembersByExternalIds } from '../../dal/partyRepo.js';
import { DALTypes } from '../../../common/enums/DALTypes';
import { execConcurrent } from '../../../common/helpers/exec-concurrent.js';
import { handleCreateParty } from './updatesHelper';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'updatesHandler' });

const handleFirstUpload = async (ctx, rows, indexObject, inserts, updates) => {
  const filteredRows = rows.filter(x => x[indexObject.partyStatus] === DALTypes.PartyStateType.RESIDENT);
  logger.debug({ filteredRows }, 'filteredRows');

  const emptyProspectCode = [];
  filteredRows.forEach(x => {
    if (x[indexObject.prospectCode]) {
      inserts.push(x);
    } else {
      emptyProspectCode.push(x);
    }
  });

  logger.debug({ ctx, emptyProspectCode }, 'emptyProspectCode');
  const matchesEmail = await execConcurrent(emptyProspectCode, async x => await getPartyMemberByEmailAddress(ctx, x[indexObject.email]));
  logger.debug({ ctx, matchesEmail }, 'matchesEmail');

  emptyProspectCode.forEach(x => {
    const list = matchesEmail.filter(e => e && e.contactInfo && e.contactInfo.defaultEmail === x[indexObject.email]);
    if (list && list.length) {
      const partyMemberToUpdate = list[0];
      partyMemberToUpdate.externalId = x[indexObject.tenantCode];
      updates.push(partyMemberToUpdate);
    }
  });
};

const handle = async (ctx, rows, indexObject, inserts, partiesToUpdate) => {
  const partyMembersByExternalId = await getPartyMembersByExternalIds(
    ctx,
    rows.map(x => x[indexObject.tenantCode]),
  );

  const rowsWithPartyId = [];

  rows.forEach(x => {
    const list = partyMembersByExternalId.filter(p => p.externalId === x[indexObject.tenantCode]);
    if (list && list.length) {
      rowsWithPartyId.push([...x, list[0].partyId]);
    } else {
      inserts.push(x);
    }
  });

  const partyIds = rowsWithPartyId.map(x => x[indexObject.prospectCode + 1]);
  const parties = await loadPartiesByIds(ctx, partyIds);

  rowsWithPartyId.forEach(x => {
    const partyMatch = parties.filter(p => p.id === x[indexObject.prospectCode + 1]);
    if (partyMatch && partyMatch.length) {
      const party = partyMatch[0];
      party.state = x[indexObject.partyStatus];
      partiesToUpdate.push(party);
    }
  });
};

export const handleUpdateResidents = async (ctx, rows, indexObject, isFirstUpload = false) => {
  const updates = [];
  const inserts = [];
  const partiesToUpdate = [];

  if (isFirstUpload) {
    await handleFirstUpload(ctx, rows, indexObject, inserts, updates);
  } else {
    await handle(ctx, rows, indexObject, inserts, partiesToUpdate);
  }

  logger.debug({ ctx, length: updates.length }, 'rows to update');
  logger.debug({ ctx, length: partiesToUpdate.length }, 'parties to update');
  logger.debug({ ctx, length: inserts.length }, 'rows to insert');

  for (const item of updates) {
    logger.debug({ ctx, item }, 'updating partyMember');
    await updatePartyMember(ctx, item.id, item);
  }

  for (const item of partiesToUpdate) {
    logger.debug({ ctx, item }, 'updating party');
    await updateParty(ctx, item);
  }

  for (const item of inserts) {
    logger.debug({ ctx, item }, 'creating partyMember');
    await handleCreateParty({
      ctx,
      partyState: DALTypes.PartyStateType.RESIDENT,
      fullName: `${item[indexObject.firstName]} ${item[indexObject.lastName]}`,
      preferredName: item[indexObject.firstName],
      memberType: DALTypes.MemberType.RESIDENT,
      externalId: item[indexObject.tenantCode],
      email: item[indexObject.email],
      phone: item[indexObject.phoneNumber],
      cellPhone: item[indexObject.cellPhoneNumber],
    });
  }
};
