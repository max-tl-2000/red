/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import csvtojson from 'csvtojson';
import fs from 'fs';
import pick from 'lodash/pick';
import groupBy from 'lodash/groupBy';
import loggerModule from '../../../common/helpers/logger';
import { convertToBoolean } from '../../../common/helpers/strings';
import { getLastUpdatedOptimizationFiles, removeFiles as removeTempFiles } from '../../workers/upload/migrateDataHandler';
import { UTC_TIMEZONE } from '../../../common/date-constants';
import { toMoment } from '../../../common/helpers/moment-utils';
import { DALTypes } from '../../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'importActiveLeases - Yardi' });

const isContactInfoMatching = (primaryPartyMember, partyMember) =>
  (primaryPartyMember.email === partyMember.email || primaryPartyMember.phone === partyMember.phone) &&
  primaryPartyMember.firstName === partyMember.firstName &&
  primaryPartyMember.lastName === partyMember.lastName;

const wasRoommatePromoted = ({ oldTenant, oldRoommates, allRoommates, allTenants }) => {
  if (oldTenant.status !== DALTypes.PartyStateType.PASTRESIDENT) return false;

  const newRoommate = allRoommates.find(rm => isContactInfoMatching(oldTenant, rm));
  if (!newRoommate) return false;

  const newTenant = allTenants.find(primary => primary.externalId === newRoommate?.primaryExternalId);
  if (!newTenant) return false;

  const oldRoommate = oldRoommates.find(rm => isContactInfoMatching(newTenant, rm));
  if (!oldRoommate) return false;

  return true;
};

const getFormattedMembers = membersData =>
  membersData.map(entry => ({
    id: entry.externalId,
    prospectId: entry.externalProspectId || null,
    vacateDate: (entry?.vacateDate && toMoment(new Date(entry.vacateDate), { timezone: UTC_TIMEZONE }).toISOString()) || null,
    middleInitial: entry.middleInitial || null,
    ...pick(entry, ['email', 'phone', 'lastName', 'firstName', 'type']),
  }));

export const getYardiActiveLeaseData = async (ctx, propertyExternalId) => {
  logger.trace({ ctx, propertyExternalId }, 'getYardiActiveLeaseData - start');

  const { filePaths, lastUploads } = await getLastUpdatedOptimizationFiles(ctx, { isForYardiResidentSync: true });
  logger.trace({ ctx, lastUploads }, 'getYardiActiveLeaseData - latest data files');

  const tenantsReadableStream = fs.createReadStream(lastUploads.parties);
  const roommatesReadableStream = fs.createReadStream(lastUploads.partyMembers);

  const primaryTenantsData = await csvtojson().fromStream(tenantsReadableStream);
  const roommatesData = await csvtojson().fromStream(roommatesReadableStream);

  const primaryTenantsDataByProperty = primaryTenantsData.filter(entry => entry.propertyExternalId === propertyExternalId);
  const roommatesDataByProperty = roommatesData.filter(entry => entry.propertyExternalId === propertyExternalId);

  const groupedValidRoommates = groupBy(roommatesDataByProperty, rm => rm.primaryExternalId);
  const formattedEntries = primaryTenantsDataByProperty.map(entry => {
    const roommatesDataForPrimary = groupedValidRoommates[entry.externalId] || [];
    const members = getFormattedMembers([entry, ...roommatesDataForPrimary]);
    const isPrimarySwitched = wasRoommatePromoted({
      oldTenant: entry,
      oldRoommates: roommatesDataForPrimary,
      allRoommates: roommatesDataByProperty,
      allTenants: primaryTenantsDataByProperty,
    });
    return {
      primaryExternalId: entry.externalId,
      pets: [],
      leaseNo: null,
      buildingId: null,
      leasingAgent: null,
      recurringCharges: [],
      leaseVacateReason: null,
      wasExternalRenewalLetterSent: null,
      externalRenewalLetterSentDate: null,
      isPrimarySwitched,
      members,
      leaseEndDate: toMoment(new Date(entry.leaseEndDate), { timezone: UTC_TIMEZONE }).toISOString(),
      leaseStartDate: toMoment(new Date(entry.leaseStartDate), { timezone: UTC_TIMEZONE }).toISOString(),
      leaseMoveIn: toMoment(new Date(entry.leaseMoveIn), { timezone: UTC_TIMEZONE }).toISOString(),
      leaseVacateDate: entry?.leaseVacateDate && toMoment(new Date(entry.leaseVacateDate), { timezone: UTC_TIMEZONE }).toISOString(),
      leaseVacateNotificationDate:
        entry?.leaseVacateNotificationDate && toMoment(new Date(entry.leaseVacateNotificationDate), { timezone: UTC_TIMEZONE }).toISOString(),
      renewalDate: (entry?.renewalDate && toMoment(new Date(entry.renewalDate), { timezone: UTC_TIMEZONE }).toISOString()) || null,
      vehicles: [],
      isUnderEviction: convertToBoolean(entry.isUnderEviction),
      legalStipulationInEffect: convertToBoolean(entry.legalStipulationInEffect),
      ...pick(entry, ['status', 'unitId', 'leaseTerm', 'propertyExternalId', 'unitRent']),
    };
  });
  logger.trace({ ctx, propertyExternalId, entries: formattedEntries.length }, 'getYardiActiveLeaseData - done');
  await removeTempFiles(filePaths);
  return formattedEntries;
};
