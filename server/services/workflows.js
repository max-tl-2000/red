/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import omit from 'lodash/omit';
import sortBy from 'lodash/sortBy';
import { mapSeries } from 'bluebird';
import { updateTermWithMatrixRents } from '../../common/helpers/quotes';
import { runInTransaction } from '../database/factory';
import * as eventService from './partyEvent';
import { archiveParty } from './party';
import { DALTypes } from '../../common/enums/DALTypes';
import { getUsersWithRoleFromPartyOwnerTeam } from '../dal/usersRepo';
import * as partyRepo from '../dal/partyRepo';
import loggerModule from '../../common/helpers/logger';
import { isUserAdmin } from './users';
import {
  getActiveLeaseWorkflowDataByPartyId,
  saveActiveLeaseWorkflowData,
  setActiveLeaseExtension,
  getActiveLeaseIdByInventoryId,
} from '../dal/activeLeaseWorkflowRepo';
import { saveActiveLeaseWfData } from './activeLease';
import { getEligibleResidentPartyIdsByWfToArchive } from '../dal/leaseRepo';
import { getEmailIdentifierFromUuid } from '../../common/helpers/strings';
import { FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';
import { insertExternalPartyMemberInfoBySeedParty } from './externalPartyMemberInfo';
import { logEntity } from './activityLogService';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';
import { getOneMonthLeaseTermByInventoryId } from '../dal/leaseTermRepo';
import { getRMSPricingByInventoryId } from '../dal/rmsPricingRepo';
import { addAdjustmentsToRentMatrix } from './rms';
import { getPropertyTimezoneAndSettingsFromInventoryId, getProperty, getPropertyByName } from '../dal/propertyRepo';
import { toMoment } from '../../common/helpers/moment-utils';
import { createExceptionReport } from './importActiveLeases/process-data/exception-report';
import { OtherExceptionReportRules } from '../helpers/exceptionReportRules';
import { addRenewalLetterContactEvent } from './importActiveLeases/process-data/lease-create';
import { logActiveLeasePartyCreated } from './helpers/workflows';
import { getTeamsWhereUserIsAgent, getDispatcherId, getTeamBy, getTeamMemberByTeamAndUser } from '../dal/teamsRepo';
import { getFirstLeasingTeamIdForProperty, getFirstResidentServicesTeamIdForProperty } from './teams';

const logger = loggerModule.child({ subType: 'workflowService' });

const getGuarantorId = (newPartyMember, guarantors) =>
  newPartyMember.guaranteedBy && guarantors.find(g => newPartyMember.guaranteedBy === g.seedPartyMemberId)?.id;

const enhanceMembersWithGuarantorLinks = newMembersData => {
  const guarantors = newMembersData.filter(pm => pm.memberType === DALTypes.MemberType.GUARANTOR);
  return newMembersData.map(pm => {
    if (pm.guaranteedBy) return { ...pm, guaranteedBy: getGuarantorId(pm, guarantors) };
    return pm;
  });
};

const addPartyMembersToNewParty = async (
  ctx,
  { newPartyId, seedPartyId, propertyId, isRenewalParty, leaseEndDate, leaseId, leaseType, isSeedPartyArchived },
) => {
  logger.trace({ ctx, newPartyId, seedPartyId, leaseEndDate, isRenewalParty, leaseId }, 'addPartyMembersToNewParty - params');
  const seedPartyMembers = await partyRepo.loadPartyMembers(ctx, seedPartyId);
  let newPartyMembers = [];

  const filteredMembers = leaseEndDate
    ? seedPartyMembers.filter(pm => !pm.vacateDate || toMoment(pm.vacateDate).isAfter(leaseEndDate, 'day'))
    : seedPartyMembers;

  const newMembersData = filteredMembers.map(pm => ({
    ...omit(pm, ['contactInfo']),
    id: getUUID(),
    seedPartyMemberId: pm.id,
    partyId: newPartyId,
  }));

  const { settings } = await getProperty(ctx, propertyId);
  if (isRenewalParty && settings?.renewals?.skipOriginalGuarantors) {
    const membersWithoutGuarantors = newMembersData.filter(member => member.memberType !== DALTypes.MemberType.GUARANTOR);
    newPartyMembers = await mapSeries(membersWithoutGuarantors, async member => {
      const memberWithoutGuarantorLink = { ...member, guaranteedBy: null };
      const newMember = await partyRepo.createPartyMember(ctx, omit(memberWithoutGuarantorLink, ['seedPartyMemberId']), newPartyId, false);
      const { seedPartyMemberId } = member;
      return { ...newMember, seedPartyMemberId };
    });
  } else {
    const newMembersWithGuarantors = enhanceMembersWithGuarantorLinks(newMembersData);

    newPartyMembers = await mapSeries(
      sortBy(newMembersWithGuarantors, m => m.memberType !== DALTypes.MemberType.GUARANTOR),
      async member => {
        const newMember = await partyRepo.createPartyMember(ctx, omit(member, ['seedPartyMemberId']), newPartyId, false);
        const { seedPartyMemberId } = member;
        return { ...newMember, seedPartyMemberId };
      },
    );
  }

  await mapSeries(newPartyMembers, async partyMember => {
    const { personId, partyId, id, seedPartyMemberId } = partyMember;
    return await insertExternalPartyMemberInfoBySeedParty(ctx, {
      personId,
      partyId,
      seedPartyId,
      seedPartyMemberId,
      propertyId,
      partyMemberId: id,
      leaseId,
      leaseType,
      isSeedPartyArchived,
    });
  });

  return newPartyMembers;
};

const addPartyAdditionalInfo = async (ctx, { newPartyId, seedPartyId, propertyId, leaseId = null }) => {
  logger.trace({ ctx, newPartyId, seedPartyId }, 'addPartyAdditionalInfo - params');
  const seedPartyAdditionalInfo = await partyRepo.getPartyAdditionalInfoByPartyId(ctx, seedPartyId);

  const newPartyAdditionalInfo = seedPartyAdditionalInfo.map(ai => ({
    ...ai,
    id: getUUID(),
    partyId: newPartyId,
  }));

  await mapSeries(newPartyAdditionalInfo, async ai => await partyRepo.savePartyAdditionalInfo(ctx, ai));

  const newChilds = newPartyAdditionalInfo.filter(addInfo => addInfo.type === DALTypes.AdditionalPartyMemberType.CHILD);
  await mapSeries(newChilds, async child => {
    const { partyId, id, info } = child;
    return await insertExternalPartyMemberInfoBySeedParty(ctx, {
      partyId,
      seedPartyId,
      propertyId,
      leaseId,
      childId: id,
      info,
    });
  });

  return newPartyAdditionalInfo;
};

const getOwnerForRenewal = async (ctx, seedPartyId, ownerTeam) => {
  logger.trace({ ctx, seedPartyId, ownerTeam }, 'getOwnerForRenewal - params');

  const currentUserId = ctx.authUser?.userId || ctx.authUser?.id;
  const isAdmin = currentUserId && (await isUserAdmin(ctx, currentUserId));
  const teamsWhereUserIsAgent = currentUserId && (await getTeamsWhereUserIsAgent(ctx, currentUserId)).map(t => t.id);
  const assignToAgent = !isAdmin && teamsWhereUserIsAgent && teamsWhereUserIsAgent.includes(ownerTeam);

  return assignToAgent ? currentUserId : (await getUsersWithRoleFromPartyOwnerTeam(ctx, seedPartyId, FunctionalRoleDefinition.LD.name))[0];
};

export const createRenewalLeaseParty = async (ctx, seedPartyId) => {
  logger.trace({ ctx, seedPartyId }, 'createRenewalLeaseParty - params');

  const seedParty = await partyRepo.getPartyBy(ctx, { id: seedPartyId });
  const { metadata: seedPartyMetadata, leaseType, ownerTeam } = seedParty;
  const userId = await getOwnerForRenewal(ctx, seedPartyId, ownerTeam);
  const renewalPartyId = getUUID();
  const creationType = ctx.authUser ? DALTypes.PartyCreationTypes.USER : DALTypes.PartyCreationTypes.SYSTEM;
  const activeLeasePartyTeams = ctx.authUser?.teamIds || [seedParty.ownerTeam];
  const collaborators = [...new Set([...seedParty.collaborators, seedParty.userId])];
  const teams = [...new Set([...activeLeasePartyTeams, ...seedParty.teams])];

  const renewalParty = {
    ...seedParty,
    id: renewalPartyId,
    userId,
    state: DALTypes.PartyStateType.PROSPECT,
    emailIdentifier: getEmailIdentifierFromUuid(renewalPartyId),
    startDate: undefined,
    teams,
    collaborators,
    seedPartyId: seedParty.id,
    modified_by: null,
    teamPropertyProgramId: null,
    workflowName: DALTypes.WorkflowName.RENEWAL,
    metadata: { ...seedPartyMetadata, creationType },
  };

  const newParty = await partyRepo.createParty(ctx, renewalParty);

  logger.trace({ ctx, newParty }, 'log RenewalParty created');
  const createdByType = ctx.authUser ? DALTypes.CreatedByType.USER : DALTypes.CreatedByType.SYSTEM;
  const propertyId = newParty.assignedPropertyId;

  await logEntity(ctx, {
    entity: {
      id: newParty.id,
      workflowName: newParty.workflowName,
      createdByType,
    },
    activityType: ACTIVITY_TYPES.SPAWN,
    component: COMPONENT_TYPES.PARTY,
  });

  const { id: activeLeaseWorkflowDataId, leaseData, metadata, leaseId = null } = await getActiveLeaseWorkflowDataByPartyId(ctx, seedPartyId);

  if (metadata?.wasExternalRenewalLetterSent) {
    await addRenewalLetterContactEvent(ctx, {
      partyId: renewalPartyId,
      externalRenewalLetterSentDate: metadata.externalRenewalLetterSentDate,
      property: await getProperty(ctx, propertyId),
      leaseEndDate: leaseData.leaseEndDate,
    });
  }

  await addPartyMembersToNewParty(ctx, {
    newPartyId: renewalParty.id,
    seedPartyId: seedParty.id,
    propertyId,
    isRenewalParty: true,
    leaseEndDate: leaseData.leaseEndDate,
    leaseId,
    leaseType,
  });
  await addPartyAdditionalInfo(ctx, { newPartyId: renewalParty.id, seedPartyId: seedParty.id, propertyId, leaseId });

  await eventService.saveLeaseRenewalCreatedEvent(ctx, { partyId: renewalPartyId, metadata: { activeLeaseWorkflowDataId } });
  logger.trace({ ctx, newParty }, 'createRenewalLeaseParty - done');

  return newParty;
};

const getNewUserForParty = async (ctx, teamId, oldUserId) => {
  logger.trace({ ctx, teamId, oldUserId }, 'getNewUserForParty');

  const userExistsInTeam = !!(await getTeamMemberByTeamAndUser(ctx, teamId, oldUserId));
  return userExistsInTeam ? oldUserId : await getDispatcherId(ctx, teamId);
};

export const getTeamAndOwnerForParty = async (ctx, party, workflowName) => {
  const { assignedPropertyId, userId } = party;
  logger.trace({ ctx, assignedPropertyId, workflowName }, 'getTeamAndOwnerForParty');

  const shouldAssignResidentServiceTeam = workflowName !== DALTypes.WorkflowName.NEW_LEASE;
  const residentServicesTeamId = shouldAssignResidentServiceTeam && (await getFirstResidentServicesTeamIdForProperty(ctx, assignedPropertyId));

  if (residentServicesTeamId) {
    const newUserId = await getNewUserForParty(ctx, residentServicesTeamId, userId);

    return {
      collaborators: new Set([...party.collaborators, newUserId]),
      userId: newUserId,
      teams: [...new Set([...party.teams, residentServicesTeamId])],
      ownerTeam: residentServicesTeamId,
    };
  }

  const team = await getTeamBy(ctx, { id: party.ownerTeam });
  const isOwnerTeamInactive = team?.endDate;

  if (isOwnerTeamInactive) {
    const activeLeasingTeamId = await getFirstLeasingTeamIdForProperty(ctx, party.assignedPropertyId);
    const newUserId = await getNewUserForParty(ctx, activeLeasingTeamId, userId);

    return {
      collaborators: new Set([...party.collaborators, newUserId]),
      userId: newUserId,
      teams: [...new Set([...party.teams, activeLeasingTeamId])],
      ownerTeam: activeLeasingTeamId,
    };
  }

  return {
    collaborators: party.collaborators,
    userId: party.userId,
    teams: party.teams,
    ownerTeam: party.ownerTeam,
  };
};

export const createActiveLeaseParty = async (ctx, { seedPartyId, leaseId, options, propertyName, isSeedPartyArchived = false, sendResidentInvite = false }) => {
  logger.trace({ ctx, seedPartyId, leaseId }, 'createActiveLeaseParty - params');

  const seedParty = await partyRepo.getPartyBy(ctx, { id: seedPartyId });
  const { metadata, leaseType } = seedParty;
  const seedPartyMetadata = omit(metadata, ['V1RenewalState']);
  const activeLeasePartyId = getUUID();

  const { collaborators, userId, teams, ownerTeam } = await getTeamAndOwnerForParty(ctx, seedParty, DALTypes.WorkflowName.ACTIVE_LEASE);

  const isCorporateParty = seedParty.leaseType === DALTypes.LeaseType.CORPORATE;
  const propertyId = (isCorporateParty && propertyName && (await getPropertyByName(ctx, propertyName))?.id) || seedParty.assignedPropertyId;

  const activeLeaseParty = {
    ...seedParty,
    id: activeLeasePartyId,
    userId,
    state: DALTypes.PartyStateType.RESIDENT,
    emailIdentifier: getEmailIdentifierFromUuid(activeLeasePartyId),
    startDate: undefined,
    archiveDate: null,
    teams,
    collaborators,
    seedPartyId: seedParty.id,
    modified_by: null,
    ownerTeam,
    teamPropertyProgramId: null,
    workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
    workflowState: DALTypes.WorkflowState.ACTIVE,
    metadata: { ...omit(seedPartyMetadata, ['archiveReasonId']), creationType: DALTypes.PartyCreationTypes.SYSTEM },
    assignedPropertyId: propertyId,
  };

  const newParty = await partyRepo.createParty(ctx, activeLeaseParty);

  await logActiveLeasePartyCreated(ctx, newParty, options);
  await addPartyMembersToNewParty(ctx, {
    newPartyId: activeLeasePartyId,
    seedPartyId: seedParty.id,
    propertyId: newParty.assignedPropertyId,
    leaseId,
    leaseType,
    isSeedPartyArchived,
  });
  await addPartyAdditionalInfo(ctx, { newPartyId: activeLeasePartyId, seedPartyId: seedParty.id, propertyId: newParty.assignedPropertyId, leaseId });

  await eventService.savePartyCreatedEvent(ctx, { partyId: newParty.id, userId, metadata: { sendResidentsInvite: sendResidentInvite && isCorporateParty } });

  logger.trace({ ctx, newPartyId: newParty.id }, 'createActiveLeaseParty - done');

  return newParty;
};

const getRentPriceForOneMonth = async (ctx, { oneMonthLeaseTerm, inventoryId, currentRentPrice, currentLeaseEndDate, timezone }) => {
  const rmsPricing = await getRMSPricingByInventoryId(ctx, inventoryId, DALTypes.LeaseState.RENEWAL);

  if (!(rmsPricing && rmsPricing.rentMatrix['1'])) {
    logger.warn({ ctx, inventoryId }, 'createOneMonthActiveLease - there are no one month prices for inventory.');
    return currentRentPrice;
  }

  const rentMatrixWithAdjustments = addAdjustmentsToRentMatrix(ctx, [oneMonthLeaseTerm], {}, rmsPricing.rentMatrix, inventoryId);

  const startDate = toMoment(currentLeaseEndDate, { timezone }).add(1, 'day');

  const oneMonthRentPrice = (updateTermWithMatrixRents({ termLength: '1' }, startDate, rentMatrixWithAdjustments, timezone) || {}).adjustedMarketRent;

  if (!oneMonthRentPrice) {
    logger.warn({ ctx, inventoryId, startDate }, 'createOneMonthActiveLease - there are no prices for start date.');
    return currentRentPrice;
  }

  return oneMonthRentPrice;
};

export const archiveMovingOutActiveLease = async (ctx, activeLeasePartyId) => {
  logger.trace({ ctx, activeLeasePartyId }, 'archiveMovingOutActiveLease - params');
  try {
    await runInTransaction(async innerTrx => {
      const innerCtx = { trx: innerTrx, ...ctx };

      await archiveParty(innerCtx, {
        partyId: activeLeasePartyId,
        workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
        archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENTS_HAVE_MOVED_OUT,
      });

      const renewalPartyIdToArchive = await partyRepo.getRenewalPartyIdBySeedPartyId(ctx, activeLeasePartyId);

      renewalPartyIdToArchive &&
        (await archiveParty(innerCtx, {
          partyId: renewalPartyIdToArchive,
          workflowName: DALTypes.WorkflowName.RENEWAL,
          archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENTS_HAVE_MOVED_OUT,
        }));
    });
  } catch (error) {
    logger.error({ ctx, error, activeLeasePartyId }, 'archiveMovingOutActiveLease - error');
  }
};

export const createOneMonthActiveLease = async (ctx, seedPartyId, isSeedPartyArchived = false) => {
  logger.trace({ ctx, seedPartyId }, 'createOneMonthActiveLease - params');
  const { leaseData, ...activeLeaseData } = await getActiveLeaseWorkflowDataByPartyId(ctx, seedPartyId);
  const { inventoryId } = leaseData;
  const oneMonthLeaseTerm = await getOneMonthLeaseTermByInventoryId(ctx, inventoryId, DALTypes.LeaseState.RENEWAL);

  if (!oneMonthLeaseTerm) {
    const renewalPartyIdToArchive = await partyRepo.getRenewalPartyIdBySeedPartyId(ctx, seedPartyId);
    renewalPartyIdToArchive &&
      (await archiveParty(ctx, {
        partyId: renewalPartyIdToArchive,
        workflowName: DALTypes.WorkflowName.RENEWAL,
        archiveReasonId: DALTypes.ArchivePartyReasons.CURRENT_LEASE_IN_PAST_AND_NO_ONE_MONTH_LEASE_TERM,
      }));

    const exceptionReportData = {
      reportData: { partyId: seedPartyId, inventoryId, leaseData, activeLeaseData },
    };
    await createExceptionReport(ctx, exceptionReportData, OtherExceptionReportRules.NO_ONE_MONTH_LEASE_TERM);

    logger.error({ ctx, inventoryId }, 'createOneMonthActiveLease - there is no one month lease term for inventory.');
    return;
  }

  const { timezone } = await getPropertyTimezoneAndSettingsFromInventoryId(ctx, inventoryId);
  const currentLeaseEndDate = activeLeaseData.isExtension ? leaseData.computedExtensionEndDate : leaseData.leaseEndDate;
  const unitRent = await getRentPriceForOneMonth(ctx, { oneMonthLeaseTerm, inventoryId, currentRentPrice: leaseData.unitRent, currentLeaseEndDate, timezone });

  try {
    await runInTransaction(async innerTrx => {
      const innerCtx = { trx: innerTrx, ...ctx };

      const { id: activeLeasePartyId } = await createActiveLeaseParty(innerCtx, { seedPartyId, isSeedPartyArchived });

      const activeLeaseWfData = {
        ...activeLeaseData,
        id: getUUID(),
        partyId: activeLeasePartyId,
        leaseData: {
          ...omit(leaseData, 'computedExtensionEndDate'),
          leaseTerm: 1,
          unitRent,
          leaseEndDate: toMoment(currentLeaseEndDate, { timezone }).add(1, 'day').add(1, 'month').toISOString(),
          leaseStartDate: toMoment(currentLeaseEndDate, { timezone }).add(1, 'day').toISOString(),
        },
        rolloverPeriod: DALTypes.RolloverPeriod.M2M,
        isImported: false,
        isExtension: false,
      };

      await saveActiveLeaseWorkflowData(innerCtx, activeLeaseWfData);

      await archiveParty(innerCtx, {
        partyId: seedPartyId,
        workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
        archiveReasonId: DALTypes.ArchivePartyReasons.CREATED_ONE_MONTH_LEASE,
      });

      const renewalPartyIdToArchive = await partyRepo.getRenewalPartyIdBySeedPartyId(innerCtx, seedPartyId);
      renewalPartyIdToArchive &&
        (await archiveParty(innerCtx, {
          partyId: renewalPartyIdToArchive,
          workflowName: DALTypes.WorkflowName.RENEWAL,
          archiveReasonId: DALTypes.ArchivePartyReasons.CREATED_ONE_MONTH_LEASE,
        }));
    }, ctx);
  } catch (error) {
    logger.error({ ctx, error, seedPartyId }, 'createOneMonthActiveLease - error');
  }
};

export const setExtensionOnActiveLease = async (ctx, activeLeaseWorkflowDataId) => {
  logger.trace({ ctx, activeLeaseWorkflowDataId }, 'setExtensionOnActiveLese - params');
  try {
    await runInTransaction(async innerTrx => {
      const innerCtx = { trx: innerTrx, ...ctx };

      const { partyId: seedPartyId } = await setActiveLeaseExtension(innerCtx, activeLeaseWorkflowDataId);

      const renewalPartyIdToArchive = await partyRepo.getRenewalPartyIdBySeedPartyId(ctx, seedPartyId);

      renewalPartyIdToArchive &&
        (await archiveParty(innerCtx, {
          partyId: renewalPartyIdToArchive,
          workflowName: DALTypes.WorkflowName.RENEWAL,
          archiveReasonId: DALTypes.ArchivePartyReasons.CURRENT_LEASE_IN_PAST_AND_NO_PUBLISH_QUOTE_ON_RENEWAL,
        }));
    }, ctx);
  } catch (error) {
    logger.error({ ctx, error, activeLeaseWorkflowDataId }, 'setExtensionOnActiveLese - error');
  }
};

export const startActiveLeaseWorkflow = async (
  ctx,
  { leaseId, partyId: seedPartyId, baselineData, termLength, externalLeaseId, sendResidentInvite = false },
  importResidentsEnabled,
) => {
  logger.trace({ ctx, leaseId, seedPartyId }, 'startActiveLeaseWorkflow - input params');

  await runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };

    const {
      quote: { inventoryId },
    } = baselineData;

    const activeLeaseIdForSameUnit = await getActiveLeaseIdByInventoryId(innerCtx, inventoryId);

    if (activeLeaseIdForSameUnit) {
      if (importResidentsEnabled) {
        const exceptionReportData = { reportData: { seedPartyId, inventoryId, leaseId } };
        await createExceptionReport(innerCtx, exceptionReportData, OtherExceptionReportRules.ACTIVE_LEASE_ALREADY_EXISTS_FOR_INVENTORY);
        return;
      }

      await archiveParty(innerCtx, {
        partyId: activeLeaseIdForSameUnit,
        workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
        archiveReasonId: DALTypes.ArchivePartyReasons.NEW_RESIDENT_CREATED_FOR_UNIT_SYNC_NOT_ENABLED,
      });
    }
    const propertyName = baselineData?.propertyName;

    const { id: activeLeasePartyId } = await createActiveLeaseParty(innerCtx, { seedPartyId, leaseId, propertyName, sendResidentInvite });
    await saveActiveLeaseWfData(innerCtx, { leaseId, activeLeasePartyId, baselineData, externalLeaseId, termLength });
  }, ctx);
};

export const createActiveLeaseFromRenewalWorkFlow = async (ctx, { leaseId, partyId: renewalPartyId, baselineData, termLength, externalLeaseId }) => {
  try {
    logger.trace({ ctx, leaseId, seedPartyId: renewalPartyId }, 'createActiveLeaseFromRenewalWorkFlow - input params');
    await runInTransaction(async innerTrx => {
      const innerCtx = { trx: innerTrx, ...ctx };
      const {
        quote: { inventoryId },
      } = baselineData;

      const activeLeaseIdForSameUnit = await getActiveLeaseIdByInventoryId(innerCtx, inventoryId, renewalPartyId);

      if (activeLeaseIdForSameUnit) {
        const exceptionReportData = {
          reportData: { seedPartyId: renewalPartyId, inventoryId, leaseId },
        };
        await createExceptionReport(innerCtx, exceptionReportData, OtherExceptionReportRules.ACTIVE_LEASE_ALREADY_EXISTS_FOR_INVENTORY);

        return;
      }

      const metadata = { moveInConfirmed: true };
      const propertyName = baselineData?.propertyName;
      const { id: activeLeasePartyId } = await createActiveLeaseParty(innerCtx, { seedPartyId: renewalPartyId, propertyName });
      await saveActiveLeaseWfData(innerCtx, { leaseId, activeLeasePartyId, baselineData, externalLeaseId, termLength, metadata });

      const { seedPartyId: oldActiveLeasePartyId } =
        (await partyRepo.getPartyBy(innerCtx, { id: renewalPartyId, workflowState: DALTypes.WorkflowState.ACTIVE })) || {};

      oldActiveLeasePartyId &&
        (await archiveParty(innerCtx, {
          partyId: oldActiveLeasePartyId,
          workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
          archiveReasonId: DALTypes.ArchivePartyReasons.RENEWAL_LEASE_STARTED,
        }));
    }, ctx);
  } catch (error) {
    logger.error({ ctx, error, leaseId, renewalPartyId }, 'createActiveLeaseFromRenewalWorkFlow - error');
  }
};

export const getEligibleNewLeasePartyIdsToArchive = async (ctx, filters) =>
  await getEligibleResidentPartyIdsByWfToArchive(ctx, DALTypes.WorkflowName.NEW_LEASE, filters);

export const getEligibleRenewalPartyIdsToArchive = async (ctx, filter) =>
  await getEligibleResidentPartyIdsByWfToArchive(ctx, DALTypes.WorkflowName.RENEWAL, filter);
