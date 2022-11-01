/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { DALTypes } from '../../../common/enums/DALTypes';
import loggerModule from '../../../common/helpers/logger';
import {
  saveImportEntry,
  updateLastSyncDate,
  getLastImportedEntriesByPropertyExternalId,
  getRenewalEntryToProcessByExternalId,
  getNewlyCreatedActiveLeaseExternalIdsToProcess,
} from '../../dal/import-repo';
import { runInTransaction } from '../../database/factory';
import { getMriActiveLeaseData } from './mri-api-requester';
import { getYardiActiveLeaseData } from './yardi-data-requester';
import { getTenant } from '../tenantService';
import { overrideContactInfo, shouldOverrideContactInfo, wasEntryNotUpdated } from './process-data/helpers';
import { NON_ALPHANUMERIC_CHARS } from '../../../common/regex';

const logger = loggerModule.child({ subType: 'importActiveLeases' });

const shouldProcessImportEntry = ({
  entry,
  primaryExternalId,
  lastImportedEntries,
  renewalExternalIdsToProcess,
  newlyCreatedActiveLeaseExternalIdsToProcess,
}) => {
  if (primaryExternalId) return { shouldProcessEntry: true };

  const lastImportedEntry = (lastImportedEntries || []).find(e => e.primaryExternalId === entry.primaryExternalId);
  if (!lastImportedEntry) return { shouldProcessEntry: true };

  if (lastImportedEntry.wasAddedToExceptionReport) return { shouldProcessEntry: true };

  const isRenewalActive = !!renewalExternalIdsToProcess.find(r => r.externalId === entry.primaryExternalId);
  if (isRenewalActive) return { shouldProcessEntry: true };

  const isNewlyActiveLeaseCreated = !!newlyCreatedActiveLeaseExternalIdsToProcess.find(n => n.externalId === entry.primaryExternalId);
  if (isNewlyActiveLeaseCreated) return { shouldProcessEntry: true };

  const isSameEntry = wasEntryNotUpdated(entry, lastImportedEntry);
  if (!isSameEntry) return { shouldProcessEntry: true };
  return { lastImportedEntryId: lastImportedEntry.id, shouldProcessEntry: false };
};

const importWithOptimizations = async (ctx, { propertyExternalId, primaryExternalId, entries, propertyLastSuccessfulSyncDate }) => {
  const lastImportedEntries = await getLastImportedEntriesByPropertyExternalId(ctx, {
    propertyExternalId,
    lastSuccessfulSyncDateForProperty: propertyLastSuccessfulSyncDate,
  });
  const renewalExternalIdsToProcess = await getRenewalEntryToProcessByExternalId(ctx, propertyExternalId);
  const newlyCreatedActiveLeaseExternalIdsToProcess = await getNewlyCreatedActiveLeaseExternalIdsToProcess(ctx, {
    propertyExternalId,
    lastSuccessfulSyncDateForProperty: propertyLastSuccessfulSyncDate,
  });

  const entriesToProcess = await mapSeries(entries, async entry => {
    const { lastImportedEntryId = '', shouldProcessEntry } = shouldProcessImportEntry({
      entry,
      primaryExternalId,
      lastImportedEntries,
      renewalExternalIdsToProcess,
      newlyCreatedActiveLeaseExternalIdsToProcess,
    });

    if (!shouldProcessEntry) {
      await updateLastSyncDate(ctx, lastImportedEntryId);
      return {};
    }

    return entry;
  });
  return entriesToProcess.filter(entry => entry.primaryExternalId);
};

const formatMembers = members => {
  const formattedMembers = members.map(member => ({ ...member, phone: member?.phone ? member.phone.replace(NON_ALPHANUMERIC_CHARS, '') : null }));
  return shouldOverrideContactInfo ? overrideContactInfo(formattedMembers) : formattedMembers;
};

export const buildImportEntry = (propertyExternalId, entry) => {
  const result = {
    rawData: entry,
    primaryExternalId: entry.primaryExternalId,
    propertyExternalId,
    status: DALTypes.ResidentImportStatus.PENDING,
  };

  return result;
};

export const retrieveData = async (
  ctx,
  { propertyExternalId, primaryExternalId, backendMode, propertyLastSuccessfulSyncDate, shouldSaveEntries = true, mockedEntries = [] },
) => {
  logger.trace({ ctx, propertyExternalId, primaryExternalId }, 'Starting to retrieve data for property');
  let entries;

  switch (backendMode) {
    case DALTypes.BackendMode.MRI:
      entries = await getMriActiveLeaseData({ ctx, propertyExternalId, primaryExternalId });
      break;
    case DALTypes.BackendMode.YARDI:
      entries = await getYardiActiveLeaseData(ctx, propertyExternalId);
      break;
    default:
      entries = mockedEntries;
      break;
  }
  if (!entries || !entries.length) {
    logger.trace({ ctx, propertyExternalId }, 'No new residents to import');
    return [];
  }

  if (!shouldSaveEntries) return entries;
  // TODO: We need to check this again when the cache behavior change
  // We are removing the cache from ctx for this behavior because is affecting some cases related to import
  const { cache, ...innerCtx } = ctx;
  const tenant = await getTenant(innerCtx);
  const { disableResidentsImportOptimization = false } = tenant.metadata || {};

  const allEntries = await mapSeries(entries, async entry => buildImportEntry(propertyExternalId, entry));

  const formattedEntries = await runInTransaction(async trx => {
    const newCtx = { ...ctx, trx };
    const entriesToImport = disableResidentsImportOptimization
      ? allEntries
      : await importWithOptimizations(newCtx, { propertyExternalId, primaryExternalId, entries: allEntries, propertyLastSuccessfulSyncDate });

    return await mapSeries(entriesToImport, async entry => {
      const savedEntry = await saveImportEntry(newCtx, entry);
      return { ...savedEntry, rawData: { ...savedEntry.rawData, members: formatMembers(savedEntry?.rawData?.members) } };
    });
  });
  logger.trace({ ctx, propertyExternalId, numberOfTotalEntriesToProcess: formattedEntries.length }, 'Retrieving data for properties finished');
  return formattedEntries;
};
