/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import orderBy from 'lodash/orderBy';
import { runInTransaction } from '../database/factory';
import { archiveParty, loadPartyById } from './party';
import { toMoment } from '../../common/helpers/moment-utils';
import {
  getTraditionalPartyGroupsWithUnLinkedRenewalsV1,
  getCorporatePartyGroupsWithUnLinkedRenewalsV1,
  setSeedPartyOnRenewalV1,
  markRenewalV1Party,
} from '../dal/renewalV1Repo';
import { DALTypes } from '../../common/enums/DALTypes';
import loggerModule from '../../common/helpers/logger';
import { partyStatesOrder } from '../helpers/party';

const logger = loggerModule.child({ subType: 'renewalV1Migration' });

const setSeedPartyOnRenewalParties = async (ctx, partyGroup, sortedParties) => {
  logger.trace({ ctx, partyGroup, sortedParties }, 'setSeedPartyOnRenewalParties - input params');

  await runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };
    const firstParty = sortedParties[0];

    if (firstParty.workflowName === DALTypes.WorkflowName.RENEWAL) {
      await markRenewalV1Party(innerCtx, { renewalPartyId: firstParty.id, mark: DALTypes.V1RenewalState.FIRST_PARTY_IS_RENEWAL });
    }

    await mapSeries(sortedParties, async (party, index) => {
      if (index === 0) return;

      const previousWorkflowActiveLease = partyGroup.find(
        p => p.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE && p.seedPartyId === sortedParties[index - 1].id,
      );

      if (!previousWorkflowActiveLease) return;

      await setSeedPartyOnRenewalV1(innerCtx, { renewalV1partyId: party.id, seedPartyId: previousWorkflowActiveLease.id });

      const { id: newActiveLeaseId } = partyGroup.find(p => p.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE && p.seedPartyId === party.id) || {};
      if (newActiveLeaseId) {
        await archiveParty(innerCtx, {
          partyId: previousWorkflowActiveLease.id,
          archiveReasonId: DALTypes.ArchivePartyReasons.RENEWAL_LEASE_STARTED,
          options: { shouldCancelActiveTasks: false },
        });
      }
    });
  }, ctx);
};

const getResidentNewLeaseAndRenewalParties = partyGroup =>
  partyGroup
    .filter(
      p =>
        (p.workflowName === DALTypes.WorkflowName.NEW_LEASE || p.workflowName === DALTypes.WorkflowName.RENEWAL) &&
        (p.state === DALTypes.PartyStateType.RESIDENT ||
          (p.state === DALTypes.PartyStateType.FUTURERESIDENT &&
            partyGroup.some(pa => pa.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE && pa.seedPartyId === p.id))),
    )
    .sort((p1, p2) => (toMoment(p1.created_at).isAfter(p2.created_at) ? 1 : -1));

const getResidentsWithStartDateInFuture = partyGroup =>
  partyGroup
    .filter(
      p =>
        p.workflowName === DALTypes.WorkflowName.RENEWAL &&
        !partyGroup.find(pa => pa.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE && pa.seedPartyId === p.id),
    )
    .sort((p1, p2) => (toMoment(p1.created_at).isBefore(p2.created_at) ? 1 : -1));

const getInFlightRenewals = partyGroup => {
  const inFlightRenewals = partyGroup.filter(
    p => p.workflowName === DALTypes.WorkflowName.RENEWAL && p.metadata.V1RenewalState === DALTypes.V1RenewalState.UNUSED,
  );
  return orderBy(inFlightRenewals, p => [partyStatesOrder.indexOf(p.state), new Date(p.created_at)], ['desc', 'asc']);
};

const isPartyGroupWithInFlightRenewal = partyGroup =>
  partyGroup.some(p => p.workflowName === DALTypes.WorkflowName.RENEWAL && p.metadata.V1RenewalState === DALTypes.V1RenewalState.UNUSED);

const isPartyGroupWithOnlyResidentParties = partyGroup =>
  partyGroup.every(p => p.state === DALTypes.PartyStateType.RESIDENT || p.state === DALTypes.PartyStateType.FUTURERESIDENT);

const isPartyGroupWithOneOrMoreResidentParties = partyGroup =>
  partyGroup.filter(
    p =>
      p.workflowName !== DALTypes.WorkflowName.ACTIVE_LEASE &&
      (p.state === DALTypes.PartyStateType.FUTURERESIDENT || p.state === DALTypes.PartyStateType.RESIDENT),
  ).length >= 1;

const isPartyGroupWithOneActiveLease = partyGroup => partyGroup.filter(p => p.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE).length === 1;

const isPartyGroupWithImportedActiveLease = partyGroup =>
  partyGroup.find(p => p.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE && p.metadata.isImported && p.seedPartyId === null);

const isPartyGroupWithOneResidentRenewal = partyGroup => {
  if (partyGroup.length !== 2) return false;
  const activeLease = partyGroup.find(p => p.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE);
  const renewal = partyGroup.find(p => p.workflowName === DALTypes.WorkflowName.RENEWAL);
  return !!(activeLease && renewal && activeLease.seedPartyId === renewal.id);
};

const renewalV1StateMatching = [
  {
    stateDescription: 'Party group with: one in flight Renewal V1 and an imported Active Lease.',
    migrateToV2Action: async (ctx, partyGroup) => {
      const { id: activeLeasePartyId } = partyGroup.find(p => p.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE);
      const { id: renewalPartyId } = partyGroup.find(p => p.workflowName === DALTypes.WorkflowName.RENEWAL);
      await setSeedPartyOnRenewalV1(ctx, { renewalV1partyId: renewalPartyId, seedPartyId: activeLeasePartyId });
    },
    checkState: partyGroup => partyGroup.length === 2 && isPartyGroupWithInFlightRenewal(partyGroup) && isPartyGroupWithOneActiveLease(partyGroup),
  },
  {
    stateDescription: 'Party group with just one in flight Renewal V1 that has no imported Active Lease.',
    migrateToV2Action: async (ctx, partyGroup) => {
      const { id: renewalPartyId, importResidentData } = partyGroup.find(p => p.workflowName === DALTypes.WorkflowName.RENEWAL);
      if (!importResidentData) {
        logger.trace(
          { ctx, renewalPartyId, importResidentData },
          'Skip migrating in flight renewal V1 since import resident data is not enabled for this property.',
        );
        return;
      }
      await archiveParty(ctx, {
        partyId: renewalPartyId,
        archiveReasonId: DALTypes.ArchivePartyReasons.IN_FLIGHT_RENEWAL_V1_WITH_NO_RELATED_ACTIVE_LEASE,
        options: { shouldCancelActiveTasks: false },
      });
    },
    checkState: partyGroup => partyGroup.length === 1 && isPartyGroupWithInFlightRenewal(partyGroup),
  },
  {
    stateDescription: 'Party group with multiple workflows in resident state',
    migrateToV2Action: async (ctx, partyGroup) => {
      const residentParties = getResidentNewLeaseAndRenewalParties(partyGroup);
      const [residentWithFutureStartDate, ...duplicateParties] = getResidentsWithStartDateInFuture(partyGroup);

      await runInTransaction(async innerTrx => {
        const innerCtx = { trx: innerTrx, ...ctx };

        await mapSeries(duplicateParties, async party => {
          await markRenewalV1Party(innerCtx, { renewalPartyId: party.id, mark: DALTypes.V1RenewalState.ARCHIVED_AS_DUPLICATE });
          await archiveParty(innerCtx, {
            partyId: party.id,
            archiveReasonId: DALTypes.ArchivePartyReasons.DUPLICATE_RENEWAL_V1,
            options: { shouldCancelActiveTasks: false },
          });
        });

        const residents = residentWithFutureStartDate ? [...residentParties, residentWithFutureStartDate] : residentParties;
        await setSeedPartyOnRenewalParties(innerCtx, partyGroup, residents);
      }, ctx);
    },
    checkState: partyGroup => partyGroup.length > 2 && isPartyGroupWithOnlyResidentParties(partyGroup) && !isPartyGroupWithImportedActiveLease(partyGroup),
  },
  {
    stateDescription: 'Party group with multiple workflows in resident/future resident state with start date in future and an imported active lease',
    migrateToV2Action: async (ctx, partyGroup) => {
      const [residentWithFutureStartDate, ...duplicateParties] = getResidentsWithStartDateInFuture(partyGroup);
      const { id: importedActiveLeaseId } = partyGroup.find(p => p.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE);

      await runInTransaction(async innerTrx => {
        const innerCtx = { trx: innerTrx, ...ctx };

        await mapSeries(duplicateParties, async party => {
          await markRenewalV1Party(innerCtx, { renewalPartyId: party.id, mark: DALTypes.V1RenewalState.ARCHIVED_AS_DUPLICATE });
          await archiveParty(innerCtx, {
            partyId: party.id,
            archiveReasonId: DALTypes.ArchivePartyReasons.DUPLICATE_RENEWAL_V1,
            options: { shouldCancelActiveTasks: false },
          });
        });
        await setSeedPartyOnRenewalV1(innerCtx, { renewalV1partyId: residentWithFutureStartDate.id, seedPartyId: importedActiveLeaseId });
      }, ctx);
    },
    checkState: partyGroup => partyGroup.length > 2 && isPartyGroupWithOnlyResidentParties(partyGroup) && isPartyGroupWithImportedActiveLease(partyGroup),
  },
  {
    stateDescription: 'Party group with one renewal in resident state and an active lease generated from it.',
    migrateToV2Action: async (ctx, partyGroup) => {
      const { id: renewalPartyId } = partyGroup.find(p => p.workflowName === DALTypes.WorkflowName.RENEWAL);
      await markRenewalV1Party(ctx, { renewalPartyId, mark: DALTypes.V1RenewalState.FIRST_PARTY_IS_RENEWAL });
    },
    checkState: partyGroup => isPartyGroupWithOneResidentRenewal(partyGroup),
  },
  {
    stateDescription:
      'Party group with one or more parties in Resident or Future Resident state that generated an Active Lease, one or more in flight renewal V1.',
    migrateToV2Action: async (ctx, partyGroup) => {
      const residentParties = getResidentNewLeaseAndRenewalParties(partyGroup);
      const [inFlightRenewal, ...inFlightRenewalsToArchive] = getInFlightRenewals(partyGroup);

      await runInTransaction(async innerTrx => {
        const innerCtx = { trx: innerTrx, ...ctx };

        await setSeedPartyOnRenewalParties(innerCtx, partyGroup, [...residentParties, inFlightRenewal]);

        await mapSeries(inFlightRenewalsToArchive, async party => {
          await markRenewalV1Party(innerCtx, { renewalPartyId: party.id, mark: DALTypes.V1RenewalState.ARCHIVED_AS_DUPLICATE });
          await archiveParty(innerCtx, {
            partyId: party.id,
            archiveReasonId: DALTypes.ArchivePartyReasons.DUPLICATE_RENEWAL_V1,
            options: { shouldCancelActiveTasks: false },
          });
        });
      });
    },
    checkState: partyGroup => partyGroup.length > 2 && isPartyGroupWithOneOrMoreResidentParties(partyGroup) && isPartyGroupWithInFlightRenewal(partyGroup),
  },
  {
    stateDescription: 'Party group with one or more in flight renewals V1 and an imported active lease.',
    migrateToV2Action: async (ctx, partyGroup) => {
      const [inFlightRenewal, ...inFlightRenewalsToArchive] = getInFlightRenewals(partyGroup);
      const { id: activeLeasePartyId } = partyGroup.find(p => p.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE);

      await runInTransaction(async innerTrx => {
        const innerCtx = { trx: innerTrx, ...ctx };

        await setSeedPartyOnRenewalV1(ctx, { renewalV1partyId: inFlightRenewal.id, seedPartyId: activeLeasePartyId });

        await mapSeries(inFlightRenewalsToArchive, async party => {
          await markRenewalV1Party(innerCtx, { renewalPartyId: party.id, mark: DALTypes.V1RenewalState.ARCHIVED_AS_DUPLICATE });
          await archiveParty(innerCtx, {
            partyId: party.id,
            archiveReasonId: DALTypes.ArchivePartyReasons.DUPLICATE_RENEWAL_V1,
            options: { shouldCancelActiveTasks: false },
          });
        });
      });
    },
    checkState: partyGroup =>
      partyGroup.length > 2 &&
      isPartyGroupWithOneActiveLease(partyGroup) &&
      !isPartyGroupWithOneOrMoreResidentParties(partyGroup) &&
      isPartyGroupWithInFlightRenewal(partyGroup),
  },
];

export const linkRenewalV1ToActiveLease = async (ctx, { propertyIdsFilter } = {}) => {
  logger.trace({ ctx, propertyIdsFilter }, 'linkRenewalV1ToActiveLease - start migrating renewal V1 to V2');

  const traditionalPartyGroupsWithUnLinkedRenewals = await getTraditionalPartyGroupsWithUnLinkedRenewalsV1(ctx, { propertyIdsFilter });
  logger.trace(
    { ctx, numberOfTraditionalPartyGroupsToMigrate: traditionalPartyGroupsWithUnLinkedRenewals.length },
    'linkRenewalV1ToActiveLease - number of traditional party groups to process',
  );

  const corporatePartyGroupsWithUnLinkedRenewals = await getCorporatePartyGroupsWithUnLinkedRenewalsV1(ctx, { propertyIdsFilter });
  logger.trace(
    { ctx, numberOfCorporatePartyGroupsToMigrate: corporatePartyGroupsWithUnLinkedRenewals.length },
    'linkRenewalV1ToActiveLease - number of corporate party groups to process',
  );

  const partyGroupsToProcess = [...traditionalPartyGroupsWithUnLinkedRenewals, ...corporatePartyGroupsWithUnLinkedRenewals];

  await mapSeries(partyGroupsToProcess, async (partyGroup, index) => {
    logger.trace({ ctx, partyGroup, total: partyGroupsToProcess.length, current: index + 1 }, 'linkRenewalV1ToActiveLease - start migrating party group');

    const renewalV1Matcher = renewalV1StateMatching.find(r => r.checkState(partyGroup));

    if (!renewalV1Matcher) {
      logger.warn({ ctx, partyGroup }, 'No matcher found to migrate renewal V1 to V2');
      return;
    }

    const [{ partyGroupId }] = partyGroup;
    logger.trace({ ctx, partyGroupId }, `${renewalV1Matcher.stateDescription} - start`);
    try {
      await renewalV1Matcher.migrateToV2Action(ctx, partyGroup);
      logger.trace({ ctx, partyGroupId }, `${renewalV1Matcher.stateDescription} - done`);
    } catch (error) {
      logger.warn({ ctx, partyGroup, error }, 'linkRenewalV1ToActiveLease - error');
    }
  });
};

export const setRenewalPartyGroup = async (ctx, { renewalPartyId, activeLeasePartyId }) => {
  logger.trace({ ctx, renewalPartyId, activeLeasePartyId }, 'setRenewalPartyGroup - input params');
  const activeLeaseParty = await loadPartyById(ctx, activeLeasePartyId);
  const { partyGroupId } = activeLeaseParty;
  return await setSeedPartyOnRenewalV1(ctx, { renewalV1partyId: renewalPartyId, seedPartyId: activeLeasePartyId, partyGroupId });
};
