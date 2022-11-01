/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import loggerModule from '../../../../common/helpers/logger';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { importSkipReasons } from '../../../../common/enums/importSkipReasons';
import * as repo from '../../../dal/import-repo';
import {
  getPartyMembersByPartyIds,
  getPartyIdsByPersonIds,
  getActivePartyMemberIdsByPartyId,
  getPartyAdditionalInfo,
  getPartyMemberWithNameById,
  getPartyAdditionalInfoByPartyId,
} from '../../../dal/partyRepo';
import { getActiveLeaseIdByInventoryId } from '../../../dal/activeLeaseWorkflowRepo';
import { runInTransaction } from '../../../database/factory';
import {
  isLeaseMoveOutComplete,
  isLeaseMoveInNotCompleted,
  getFullName,
  getPartyWorkflow,
  getInventoryByExternalId,
  getDeletedMembersFromImport,
  getExternalRoommateId,
  isPartyTransferred,
  archivePartiesOnTransfer,
  getActiveLeaseData,
  isLeaseMoveInComplete,
  removeResident,
  removeChild,
} from './helpers';
import { getAllExternalInfoByParty, insertExternalInfo, archiveExternalInfoByPartyMemberId } from '../../../dal/exportRepo';
import { addMember } from './member-create';
import { updateMemberData } from './member-update';
import { updatePersonData } from './person-update';
import { createHistoricalLease } from './lease-create';
import { updateLeaseData } from './lease-update';
import { processPetsAndVehicles } from './pets-and-vehicles';
import { createExceptionReport } from './exception-report';
import { OtherExceptionReportRules } from '../../../helpers/exceptionReportRules';
import { checkMatchingPersonData, checkIfChild, checkAndUpdateChangedExternalIds, isOldPrimaryMatched } from './checks';
import { archiveParty, getAdditionalInfoByPartyAndType } from '../../party';

const logger = loggerModule.child({ subType: 'importResidents' });

const renewalStarted = (partyWorkflows, isInitialImport = false) => {
  // on initial import we should still create the Active Lease workflow and we should not log any exception report
  if (isInitialImport) return false;

  return partyWorkflows.length && !!getPartyWorkflow(partyWorkflows, DALTypes.WorkflowName.RENEWAL);
};

const insertExternalInfoForParty = async (
  ctx,
  { partyId, leaseId, partyMembers, receivedMembers, propertyId, primaryExternalId, childrenWithoutExternalInfo, receivedChildren },
) => {
  logger.trace({ ctx, partyId, leaseId, propertyId, primaryExternalId }, 'insertExternalInfoForParty');

  childrenWithoutExternalInfo.length &&
    (await mapSeries(childrenWithoutExternalInfo, async child => {
      const { id: externalIdForChild } = receivedChildren.find(c => getFullName(c) === child.info.fullName) || {};
      const externalRoommateId = getExternalRoommateId(ctx, { externalId: externalIdForChild, isPrimary: false }) ? externalIdForChild : null;
      if (externalIdForChild) {
        // CPM-17885 - we should only have EPMI entries to archive for Yardi, where the rCodes we receive are different from those we export
        await archiveExternalInfoByPartyMemberId(ctx, child.id);
        await insertExternalInfo(ctx, {
          partyId,
          leaseId,
          childId: child.id,
          externalId: externalRoommateId ? null : externalIdForChild,
          externalRoommateId,
          propertyId,
          isPrimary: false,
        });
      }
    }));

  await mapSeries(partyMembers, async member => {
    const { id: externalIdForMember, prospectId = null } =
      receivedMembers.find(
        m => getFullName(m) === member.fullName && m.email && member.contactInfo.emails.map(email => email.value.toLowerCase()).includes(m.email.toLowerCase()),
      ) || {};
    const isPrimary = externalIdForMember === primaryExternalId;
    const externalRoommateId = getExternalRoommateId(ctx, { externalId: externalIdForMember, isPrimary });
    if (externalIdForMember) {
      await archiveExternalInfoByPartyMemberId(ctx, member.id);
      await insertExternalInfo(ctx, {
        partyId,
        leaseId,
        partyMemberId: member.id,
        externalId: externalRoommateId ? null : externalIdForMember,
        externalRoommateId,
        externalProspectId: prospectId,
        propertyId,
        isPrimary,
      });
    }
  });
};

const checkAndUpdateExternalInfoForParty = async (
  ctx,
  { partyId, leaseId, primaryExternalId, residentImportTrackingId, receivedMembers, propertyId, existingPartyExternalInfoEntries = [] },
) => {
  logger.trace({ ctx, partyId, primaryExternalId, residentImportTrackingId }, 'checkAndUpdateExternalInfoForParty');

  let childrenWithoutExternalInfo = [];
  const receivedChildren = receivedMembers.filter(member => checkIfChild(member.type));
  if (receivedChildren.length) {
    const partyChildren = await getAdditionalInfoByPartyAndType(ctx, partyId, DALTypes.AdditionalPartyMemberType.CHILD);
    childrenWithoutExternalInfo = partyChildren.filter(child => !existingPartyExternalInfoEntries.find(ext => ext.childId === child.id));
  }

  const activePartyMemberIds = await getActivePartyMemberIdsByPartyId(ctx, partyId);
  const partyMembersIdsWithoutExternalInfo = activePartyMemberIds.filter(pmId => !existingPartyExternalInfoEntries.find(ext => ext.partyMemberId === pmId));

  if (!partyMembersIdsWithoutExternalInfo.length && !childrenWithoutExternalInfo.length) {
    logger.trace({ ctx, partyId, primaryExternalId, residentImportTrackingId }, 'All members have external info, no update needed');
    return;
  }
  const partyMembers = await getPartyMembersByPartyIds(ctx, [partyId]);
  const partyMembersWithoutExternalInfo = partyMembers.filter(pm => !!partyMembersIdsWithoutExternalInfo.find(pmId => pmId === pm.id));

  await insertExternalInfoForParty(ctx, {
    partyId,
    leaseId,
    partyMembers: partyMembersWithoutExternalInfo,
    receivedMembers,
    propertyId,
    primaryExternalId,
    childrenWithoutExternalInfo,
    receivedChildren,
  });
};

const shouldSkipEntry = async (ctx, { entry, partyWorkflows, property, inventories, forceSync }) => {
  const { rawData } = entry;
  const { leaseTerm, buildingId, unitId, primaryExternalId, members, isPrimarySwitched = false } = rawData;

  if (!leaseTerm) {
    logger.trace({ ctx, entry }, 'No lease term specified, skipping import');
    return { shouldSkip: true, reason: importSkipReasons.NO_LEASE_TERM };
  }

  const inventory = getInventoryByExternalId(inventories, property.externalId, buildingId, unitId);

  if (!inventory.id) {
    logger.trace({ ctx, entry }, 'Unit does not exists');
    return { shouldSkip: true, reason: importSkipReasons.MISSING_UNIT };
  }

  // promoted roommate flow - specific for YARDI (for the PastResident record)
  if (ctx.backendMode === DALTypes.BackendMode.YARDI && isPrimarySwitched) {
    logger.trace({ ctx, entry }, 'Primary tenant switched - new record exists for this entry');
    return { shouldSkip: true, reason: importSkipReasons.NEW_RECORD_EXISTS };
  }

  if (!forceSync && partyWorkflows.length) {
    const activeLeaseWorkflow = getPartyWorkflow(partyWorkflows, DALTypes.WorkflowName.ACTIVE_LEASE);
    const newLeaseWorkflow = getPartyWorkflow(partyWorkflows, DALTypes.WorkflowName.NEW_LEASE);
    const renewalWorkflow = getPartyWorkflow(partyWorkflows, DALTypes.WorkflowName.RENEWAL);

    if (!activeLeaseWorkflow && !newLeaseWorkflow && !renewalWorkflow && isLeaseMoveOutComplete(entry)) {
      logger.trace({ ctx, entry }, 'There is no active workflow for this entry');
      return { shouldSkip: true, reason: importSkipReasons.ACTIVE_LEASE_ENDED };
    }
  }

  if (!partyWorkflows.length && isLeaseMoveOutComplete(entry)) {
    logger.trace({ ctx, entry }, 'This lease is no longer active, the leaseholders have moved out');
    return { shouldSkip: true, reason: importSkipReasons.MOVED_OUT };
  }

  const activeLeaseData = await getActiveLeaseData(ctx, partyWorkflows);
  const activeLeaseIdForSameUnit = await getActiveLeaseIdByInventoryId(ctx, inventory.id);
  if (activeLeaseIdForSameUnit && activeLeaseData?.partyId !== activeLeaseIdForSameUnit) {
    const isRoommatePromoted =
      ctx.backendMode === DALTypes.BackendMode.YARDI && (await isOldPrimaryMatched(ctx, members, primaryExternalId, activeLeaseIdForSameUnit));
    if (isRoommatePromoted) {
      return { shouldSkip: false, reason: '' };
    }
    const noActiveLeaseFoundOrIsTransfer = !activeLeaseData || isPartyTransferred(inventory.id, activeLeaseData.leaseData.inventoryId);
    if (isLeaseMoveInComplete(entry) && noActiveLeaseFoundOrIsTransfer) {
      const reportData = {
        existingPartyIdForInventory: activeLeaseIdForSameUnit,
        inventoryId: inventory.id,
        party: activeLeaseData && { partyId: activeLeaseData.partyId },
      };
      await createExceptionReport(
        ctx,
        { entry, externalId: primaryExternalId, reportData },
        OtherExceptionReportRules.ACTIVE_LEASE_ALREADY_EXISTS_FOR_INVENTORY,
      );
      return { shouldSkip: true, reason: importSkipReasons.ACTIVE_LEASE_ON_SAME_UNIT };
    }
  }
  return { shouldSkip: false, reason: '' };
};

const handleYardiSpecificCases = async (ctx, entry, partyWorkflows, property, inventories) => {
  let newPartyWorkflows = partyWorkflows;
  let newActiveLeasePartyGroupData = {};

  if (ctx.backendMode !== DALTypes.BackendMode.YARDI) return { newPartyWorkflows, newActiveLeasePartyGroupData };

  const { primaryExternalId, rawData } = entry;
  const { unitId, buildingId, members } = rawData;

  const inventory = getInventoryByExternalId(inventories, property.externalId, buildingId, unitId);

  // party trasferred flow
  if (newPartyWorkflows?.length) {
    const activeLeaseData = await getActiveLeaseData(ctx, newPartyWorkflows);
    if (activeLeaseData && isPartyTransferred(inventory.id, activeLeaseData.leaseData.inventoryId)) {
      await archivePartiesOnTransfer(ctx, activeLeaseData.partyId, newPartyWorkflows);
      newActiveLeasePartyGroupData = { partyGroupId: activeLeaseData.partyGroupId, leaseType: activeLeaseData.leaseType };
      newPartyWorkflows = [];
    }
  }

  // promoted roommate flow - specific for YARDI (for the new Resident record)
  if (!newPartyWorkflows.length) {
    const newExternallIds = await checkAndUpdateChangedExternalIds(ctx, members, primaryExternalId, inventory.id, property.id);
    newPartyWorkflows = newExternallIds?.length ? await repo.getPartyWorkflows(ctx, { externalIds: newExternallIds }) : [];
  }

  return { newPartyWorkflows, newActiveLeasePartyGroupData };
};

const getNamesForDeletedPartyMembers = async (ctx, deletedResidentsIds, deletedChildrenIds) => {
  const deletedResidentsNames = await mapSeries(deletedResidentsIds, async deletedResidentId => {
    const member = await getPartyMemberWithNameById(ctx, deletedResidentId);
    return member?.fullName;
  });

  const deletedChildrenNames = await mapSeries(deletedChildrenIds, async deletedChildId => {
    const child = await getPartyAdditionalInfo(ctx, deletedChildId);
    return child?.info?.fullName;
  });
  return [...deletedResidentsNames, ...deletedChildrenNames];
};

const processDeletedPartyMembers = async (ctx, { renewalCycleStarted, deletedPartyMembers, activeRevaMembersInfo, partyId, primaryExternalId }) => {
  logger.trace({ ctx, renewalCycleStarted, deletedPartyMembers, partyId, primaryExternalId }, 'processDeletedPartyMembers');
  const { deletedResidentsIds, deletedChildrenIds } = deletedPartyMembers;

  if (!deletedResidentsIds.length && !deletedChildrenIds.length) return;

  if (renewalCycleStarted) {
    const deletedMembersNames = await getNamesForDeletedPartyMembers(ctx, deletedResidentsIds, deletedChildrenIds);

    const reportData = { deletedMembersNames, party: { partyId } };

    await createExceptionReport(ctx, { reportData, externalId: primaryExternalId, partyId }, OtherExceptionReportRules.DELETED_MEMBERS_AFTER_RENEWAL_START);
  } else {
    await mapSeries(deletedResidentsIds, async deletedResidentId => {
      await removeResident(ctx, activeRevaMembersInfo, deletedResidentId);
    });
    await mapSeries(deletedChildrenIds, async deletedChildId => {
      await removeChild(ctx, activeRevaMembersInfo, deletedChildId);
    });
  }
};

const processMembers = async (
  ctx,
  {
    renewalCycleStarted,
    entry,
    activeLeaseWorkflow,
    property,
    renewalPartyId,
    primaryExternalId,
    leasingAgent,
    isInitialImport,
    partyGroupId,
    matchedLeaseType,
  },
) => {
  logger.trace({ ctx, residentImportTrackingId: entry.id, primaryExternalId }, 'processMembers - start');
  let partyId = activeLeaseWorkflow ? activeLeaseWorkflow.id : null;

  const externalInfos = await getAllExternalInfoByParty(ctx, partyId);
  const allPartyMembers = await getPartyMembersByPartyIds(ctx, [partyId], { excludeInactive: false });
  const allChildren = ((await getPartyAdditionalInfoByPartyId(ctx, partyId)) || []).filter(p => p.type === DALTypes.AdditionalPartyMemberType.CHILD);
  // TODO: check if substracting boolean is correct (they are converted to numbers, but it might be worth to revisit this)
  const sortedReceivedMembers = entry.rawData.members.sort((a, b) => (b.id === primaryExternalId) - (a.id === primaryExternalId));

  await mapSeries(sortedReceivedMembers, async receivedResident => {
    const externalInfo = externalInfos.find(e => e.externalId === receivedResident.id || e.externalRoommateId === receivedResident.id);

    if (externalInfo && externalInfo.childId) {
      logger.trace({ ctx, residentImportTrackingId: entry.id, receivedResidentId: receivedResident.id }, 'processMembers - existing member - child');
    } else if (externalInfo) {
      const existingMember = allPartyMembers.find(member => member.id === externalInfo.partyMemberId);
      if (!existingMember) {
        logger.trace(
          { ctx, residentImportTrackingId: entry.id, receivedResidentId: receivedResident.id },
          'processMembers - member for receivedResidentId is no longer active',
        );
        return;
      }
      logger.trace(
        { ctx, residentImportTrackingId: entry.id, receivedResidentId: receivedResident.id, memberId: existingMember.id },
        'processMembers - existing member',
      );
      await updatePersonData(ctx, { renewalCycleStarted, receivedResident, existingMember, entry, partyId, renewalPartyId, allPartyMembers, property });
      await updateMemberData(ctx, {
        entry,
        renewalCycleStarted,
        externalInfo,
        partyLeaseType: activeLeaseWorkflow?.leaseType || matchedLeaseType,
        receivedResident,
        dbMember: existingMember,
        property,
        partyId,
      });
    } else {
      ({ partyId } = await addMember(ctx, {
        renewalCycleStarted,
        partyGroupId,
        renewalPartyId,
        entry,
        receivedResident,
        partyId,
        partyLeaseType: activeLeaseWorkflow?.leaseType || matchedLeaseType,
        property,
        leasingAgent,
        isInitialImport,
        allPartyMembers,
        allChildren,
      }));
    }
  });
  const activeRevaMembersInfo = (await getAllExternalInfoByParty(ctx, partyId)).filter(extInfo => !extInfo.endDate);
  const deletedPartyMembers = getDeletedMembersFromImport(activeRevaMembersInfo, entry.rawData.members);
  await processDeletedPartyMembers(ctx, { renewalCycleStarted, deletedPartyMembers, activeRevaMembersInfo, partyId, primaryExternalId });

  return { partyId };
};

const processLeaseData = async (ctx, { renewalCycleStarted, entry, partyId, property, shouldCreateLease, inventories, forceSyncLeaseData }) => {
  logger.trace({ ctx, residentImportTrackingId: entry.id }, 'processLeaseData - start');

  if (shouldCreateLease) {
    await createHistoricalLease(ctx, { property, partyId, entry, inventories });
  } else {
    await updateLeaseData(ctx, { property, partyId, entry, renewalCycleStarted, forceSyncLeaseData });
  }
};

const partyHasALease = party => [DALTypes.PartyStateType.RESIDENT, DALTypes.PartyStateType.FUTURERESIDENT, DALTypes.PartyStateType.LEASE].includes(party.state);

const checkAndArchiveActiveNewLeaseWorkflow = async (ctx, entry, partyWorkflows) => {
  const { primaryExternalId } = entry;
  logger.trace({ ctx, primaryExternalId, residentImportTrackingId: entry.id }, 'checkAndArchiveNewLeaseWorkflow');

  const activeNewLeaseWorkflow = getPartyWorkflow(partyWorkflows, DALTypes.WorkflowName.NEW_LEASE);
  if (!activeNewLeaseWorkflow || partyHasALease(activeNewLeaseWorkflow)) return {};

  await archiveParty(ctx, {
    partyId: activeNewLeaseWorkflow.id,
    workflowName: DALTypes.WorkflowName.NEW_LEASE,
    archiveReasonId: DALTypes.ArchivePartyReasons.LEASE_EXECUTED_OUTSIDE_OF_REVA,
  });

  return { newLeaseWfPartyGroupId: activeNewLeaseWorkflow.partyGroupId, newLeaseWfLeaseType: activeNewLeaseWorkflow.leaseType };
};

const checkAndUpdateNewLeaseMatch = async (ctx, { entry, property, inventories }) => {
  const { primaryExternalId, rawData } = entry;
  const { members: receivedMembers, buildingId, unitId } = rawData;
  logger.trace({ ctx, primaryExternalId, residentImportTrackingId: entry.id }, 'checkAndUpdateNewLeaseMatch - start');

  const receivedMembersIds = receivedMembers.map(member => member.id);
  const existingPartyExternalInfoEntries = await repo.getNewLeaseExternalInfoByExternalIds(ctx, receivedMembersIds);

  if (existingPartyExternalInfoEntries.length) {
    const { partyId, leaseId } = existingPartyExternalInfoEntries[0];
    await checkAndUpdateExternalInfoForParty(ctx, {
      partyId,
      leaseId,
      primaryExternalId,
      residentImportTrackingId: entry.id,
      receivedMembers,
      propertyId: property.id,
      existingPartyExternalInfoEntries,
    });
    return { shouldCreateActiveLeaseWf: false };
  }

  const personMatchIds = (
    await mapSeries(receivedMembers, async receivedMember => {
      const { personMatchFound } = await checkMatchingPersonData(ctx, {
        email: receivedMember.email,
        receivedResident: receivedMember,
      });
      return personMatchFound?.id;
    })
  ).filter(id => !!id);

  const partyIdsForMatchedPersons = personMatchIds && [...new Set(await getPartyIdsByPersonIds(ctx, personMatchIds))];
  const inventory = getInventoryByExternalId(inventories, property.externalId, buildingId, unitId);
  const matchingPartyData = partyIdsForMatchedPersons && (await repo.getMatchingNewLeasePartyByInventory(ctx, partyIdsForMatchedPersons, inventory.id));

  if (!matchingPartyData) {
    if (isLeaseMoveInNotCompleted(entry)) {
      return { shouldCreateActiveLeaseWf: false };
    }
    return { shouldCreateActiveLeaseWf: true };
  }
  const { partyId, leaseId } = matchingPartyData;
  await checkAndUpdateExternalInfoForParty(ctx, {
    partyId,
    leaseId,
    receivedMembers,
    propertyId: property.id,
    primaryExternalId,
    residentImportTrackingId: entry.id,
  });
  return { shouldCreateActiveLeaseWf: false };
};

const processEntry = async (ctx, { entry, property, inventories, forceSync, isInitialImport }) => {
  logger.trace({ ctx, residentImportTrackingId: entry.id }, 'processEntry - start');
  const { primaryExternalId, rawData } = entry;

  try {
    await runInTransaction(async innerTrx => {
      const innerCtx = { trx: innerTrx, ...ctx };
      const { leasingAgent, members } = rawData;
      const externalIds = members.map(m => m.id);
      const partyWorkflows = await repo.getPartyWorkflows(innerCtx, { externalIds });
      const { shouldSkip, reason } = await shouldSkipEntry(innerCtx, {
        entry,
        partyWorkflows,
        property,
        inventories,
        forceSync,
      });

      if (shouldSkip) {
        await repo.setStatusById(innerCtx, { id: entry.id, status: DALTypes.ResidentImportStatus.SKIPPED, importResult: { validations: [reason] } });
        return;
      }

      const { newPartyWorkflows, newActiveLeasePartyGroupData } = await handleYardiSpecificCases(innerCtx, entry, partyWorkflows, property, inventories);

      const activeLeaseWorkflow = newPartyWorkflows.length && getPartyWorkflow(newPartyWorkflows, DALTypes.WorkflowName.ACTIVE_LEASE, forceSync);
      if (!activeLeaseWorkflow) {
        const { shouldCreateActiveLeaseWf } = await checkAndUpdateNewLeaseMatch(innerCtx, { entry, property, inventories });
        if (!shouldCreateActiveLeaseWf) return;
      }

      const { newLeaseWfPartyGroupId, newLeaseWfLeaseType } = await checkAndArchiveActiveNewLeaseWorkflow(innerCtx, entry, newPartyWorkflows);

      const renewalCycleStarted = renewalStarted(newPartyWorkflows, isInitialImport);
      const isNewParty = !activeLeaseWorkflow;
      logger.trace({ ctx, residentImportTrackingId: entry.id, renewalCycleStarted, isNewParty }, 'processEntry - values');

      const { id: renewalPartyId } = getPartyWorkflow(newPartyWorkflows, DALTypes.WorkflowName.RENEWAL) || {};
      const { partyId } = await processMembers(innerCtx, {
        renewalCycleStarted,
        entry,
        activeLeaseWorkflow,
        property,
        renewalPartyId,
        primaryExternalId,
        leasingAgent,
        partyGroupId: newActiveLeasePartyGroupData.partyGroupId || newLeaseWfPartyGroupId,
        matchedLeaseType: newActiveLeasePartyGroupData.leaseType || newLeaseWfLeaseType,
        isInitialImport,
      });

      if (!partyId) {
        logger.trace({ ctx, residentImportTrackingId: entry.id }, 'processEntry - no members saved for entry');
        return;
      }

      logger.trace({ ctx, residentImportTrackingId: entry.id, partyId, renewalCycleStarted, isNewParty }, 'processEntry - values');

      await processLeaseData(innerCtx, {
        renewalCycleStarted,
        entry,
        partyId,
        property,
        shouldCreateLease: isNewParty,
        inventories,
      });

      const shouldProcessPetsAndVehicles = innerCtx.backendMode === DALTypes.BackendMode.MRI; // specific for MRI
      shouldProcessPetsAndVehicles && (await processPetsAndVehicles(innerCtx, { partyId, isNewParty, entry, renewalCycleStarted }));
    });
  } catch (error) {
    // skip this resident and mark it as Failed
    logger.error({ ctx, entry, error }, 'Failed to process data');
    const validations = [{ error: JSON.stringify(`${error.toString()}\n${error.stack}`) }];
    await repo.setStatusById(ctx, { id: entry.id, status: DALTypes.ResidentImportStatus.FAILED, importResult: { validations } });
    return;
  }
  await repo.setStatusById(ctx, { id: entry.id, status: DALTypes.ResidentImportStatus.PROCESSED, importResult: {} });
  logger.trace({ ctx, residentImportTrackingId: entry.id }, 'processEntry - done');
};

const forceProcessLeaseData = async (ctx, { entry, property, inventories, forceSync, forceSyncLeaseData }) => {
  logger.trace({ ctx, residentImportTrackingId: entry.id }, 'forceProcessLeaseData - start');
  const { rawData } = entry;

  try {
    await runInTransaction(async innerTrx => {
      const innerCtx = { trx: innerTrx, ...ctx };
      const { members } = rawData;
      const externalIds = members.map(m => m.id);
      const partyWorkflows = await repo.getPartyWorkflows(innerCtx, { externalIds });
      const { shouldSkip, reason } = await shouldSkipEntry(innerCtx, { entry, partyWorkflows, property, inventories, forceSync });

      if (shouldSkip) {
        await repo.setStatusById(innerCtx, { id: entry.id, status: DALTypes.ResidentImportStatus.SKIPPED, importResult: { validations: [reason] } });
        return;
      }

      const activeLeaseWorkflow = partyWorkflows.length && getPartyWorkflow(partyWorkflows, DALTypes.WorkflowName.ACTIVE_LEASE, forceSync);
      if (!activeLeaseWorkflow) {
        return;
      }

      await processLeaseData(innerCtx, {
        renewalCycleStarted: false,
        entry,
        partyId: activeLeaseWorkflow.id,
        property,
        shouldCreateLease: false,
        inventories,
        forceSyncLeaseData,
      });
    });
  } catch (error) {
    // skip this resident and mark it as Failed
    logger.error({ ctx, entry, error }, 'Failed to process data');
    const validations = [{ error: JSON.stringify(`${error.toString()}\n${error.stack}`) }];
    await repo.setStatusById(ctx, { id: entry.id, status: DALTypes.ResidentImportStatus.FAILED, importResult: { validations } });
    return;
  }
  await repo.setStatusById(ctx, { id: entry.id, status: DALTypes.ResidentImportStatus.PROCESSED, importResult: {} });
  logger.trace({ ctx, residentImportTrackingId: entry.id }, 'forceProcessLeaseData - done');
};

export const processData = async (ctx, { property, entries, forceSync, isInitialImport, forceSyncLeaseData }) => {
  logger.trace({ ctx, propertyExternalId: property.externalId, total: entries.length, isInitialImport, forceSyncLeaseData }, 'processData - start');
  const inventories = await repo.getAllInventoriesForProperty(ctx, property.id);

  await mapSeries(entries, async entry =>
    !forceSyncLeaseData
      ? await processEntry(ctx, { entry, property, inventories, forceSync, isInitialImport })
      : await forceProcessLeaseData(ctx, { entry, property, inventories, forceSync, forceSyncLeaseData }),
  );

  logger.trace({ ctx, propertyExternalId: property.externalId }, 'processData - done');
};
