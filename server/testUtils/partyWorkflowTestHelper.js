/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { mapSeries } from 'bluebird';
import { waitFor, setupQueueToWaitFor } from './apiHelper';
import { enhance } from '../../common/helpers/contactInfoUtils';
import { chan, createResolverMatcher, tenant } from './setupTestGlobalContext';
import { setupConsumers } from '../workers/consumer';
import { getRecurringJobByName } from '../dal/jobsRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { now } from '../../common/helpers/moment-utils';
import { DATE_US_FORMAT } from '../../common/date-constants';
import { APP_EXCHANGE, JOBS_MESSAGE_TYPE } from '../helpers/message-constants';
import { sendMessage } from '../services/pubsub';
import { createLeaseTestData, createLease, publishLease, signLeaseByAllPartyMembers, counterSignLease, addGuarantorToParty } from './leaseTestHelper';
import {
  testCtx as ctx,
  createATeamMember,
  createAUser,
  createAProperty,
  createATeam,
  createAPartyMember,
  createAPartyPet,
  createAPartyChild,
  createAPartyVehicle,
  createAnInventory,
  createALeaseName,
  createALeaseTerm,
  toggleEnableRenewalsFeature,
  saveUnitsRevaPricing,
  createAInventoryGroup,
} from './repoHelper';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';
import { getPartyBy, createParty, getPartyMembersByPartyIds } from '../dal/partyRepo';
import { saveActiveLeaseWorkflowData } from '../dal/activeLeaseWorkflowRepo';
import { getPropertyById } from '../dal/propertyRepo';
import { getPartiesLeases } from '../dal/leaseRepo';

let matcher;

export const setupMsgQueueAndWaitFor = async (conditions, workerKeysToBeStarted) => {
  const { resolvers, promises } = waitFor(conditions);
  matcher = createResolverMatcher(resolvers);
  await setupConsumers(chan(), matcher, workerKeysToBeStarted);
  return { task: Promise.all(promises), matcher };
};

export const createActiveLeaseParty = async ({
  leaseStartDate = now().format(DATE_US_FORMAT),
  moveInDate = now().format(DATE_US_FORMAT),
  leaseEndDate = now().add(10, 'days').format(DATE_US_FORMAT),
  rolloverPeriod = DALTypes.RolloverPeriod.NONE,
  recurringCharges = [],
  rentableItems = [],
  metadata = {},
  state = DALTypes.ActiveLeaseState.NONE,
  isExtension = false,
  computedExtensionEndDate,
  inventoryId,
}) => {
  const settings = {
    renewals: { renewalCycleStart: 30 },
    integration: { import: { residentData: true, unitPricing: false } },
  }; // renewalCycleStart set in days
  const { id: propertyId, settings: propertySettings, timezone } = await createAProperty(settings);
  const { renewalCycleStart: propertyRenewalCycleStart } = propertySettings.renewals;

  await toggleEnableRenewalsFeature(true);

  const team = await createATeam();

  const { id: leasingAgentUserId } = await createAUser();
  const { id: dispatcherUserId } = await createAUser();
  const { id: lcaUserId } = await createAUser();
  const { id: adminUserId } = await createAUser({ isAdmin: true, email: 'admin@reva.tech' });

  const users = { leasingAgentUserId, dispatcherUserId, lcaUserId, adminUserId };
  await createATeamMember({
    teamId: team.id,
    userId: leasingAgentUserId,
    roles: {
      mainRoles: [MainRoleDefinition.LA.name],
      functionalRoles: [FunctionalRoleDefinition.LWA.name],
    },
  });

  await createATeamMember({
    teamId: team.id,
    userId: lcaUserId,
    roles: {
      mainRoles: [MainRoleDefinition.LA.name],
      functionalRoles: [FunctionalRoleDefinition.LCA.name],
    },
  });

  await createATeamMember({
    teamId: team.id,
    userId: dispatcherUserId,
    roles: {
      mainRoles: [MainRoleDefinition.LA.name],
      functionalRoles: [FunctionalRoleDefinition.LD.name],
    },
  });

  const activeLeaseParty = await createParty(ctx, {
    id: newId(),
    userId: leasingAgentUserId,
    workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
    assignedPropertyId: propertyId,
    state: DALTypes.PartyStateType.RESIDENT,
    ownerTeam: team.id,
    teams: [team.id],
  });

  const { id: partyId } = activeLeaseParty;
  const { id: leaseNameId } = await createALeaseName({ tenantId: tenant.id }, { propertyId });
  const { id: inventoryGroupId } = await createAInventoryGroup({ propertyId, leaseNameId });

  let inventory = { id: inventoryId };
  if (!inventoryId) {
    inventory = await createAnInventory({ propertyId, inventoryGroupId });
    await saveUnitsRevaPricing([inventory], DALTypes.LeaseState.RENEWAL);
  }

  await createALeaseTerm({
    leaseNameId,
    propertyId,
    termLength: 1,
    state: DALTypes.LeaseState.RENEWAL,
  });

  const leaseTerm = rolloverPeriod === DALTypes.RolloverPeriod.M2M ? 1 : 12;
  const activeLeaseWorkflowData = await saveActiveLeaseWorkflowData(ctx, {
    created_at: activeLeaseParty.created_at,
    leaseId: null,
    leaseData: { leaseStartDate, leaseEndDate, leaseTerm, computedExtensionEndDate, moveInDate, inventoryId: inventory.id },
    partyId,
    recurringCharges,
    updated_at: activeLeaseParty.updated_at,
    rentableItems,
    rolloverPeriod,
    state,
    isExtension,
    metadata,
  });

  const guarantors = [await addGuarantorToParty(partyId)];

  const residentCi = enhance([
    { type: 'email', value: 'luke@reva.tech' },
    { type: 'phone', value: '12025550163' },
  ]);
  const residents = [
    await createAPartyMember(activeLeaseParty.id, {
      fullName: 'Luke Skywalker',
      contactInfo: residentCi,
      memberType: DALTypes.MemberType.RESIDENT,
      memberState: DALTypes.PartyStateType.RESIDENT,
      guaranteedBy: guarantors[0].id,
    }),
  ];

  const pets = [await createAPartyPet(partyId)];
  const vehicles = [await createAPartyVehicle(partyId)];
  const children = [await createAPartyChild(partyId)];

  return { activeLeaseParty, propertyRenewalCycleStart, activeLeaseWorkflowData, residents, pets, vehicles, children, timezone, users };
};

export const createActiveLeasePartyFromNewLease = async ({
  rolloverPeriod = DALTypes.RolloverPeriod.NONE,
  recurringCharges = [],
  rentableItems = [],
  metadata = {},
  state = DALTypes.ActiveLeaseState.NONE,
  isExtension = false,
  newLeaseParty,
}) => {
  const { id: propertyId, settings: propertySettings, timezone } = await getPropertyById(ctx, newLeaseParty.assignedPropertyId);

  const { renewalCycleStart: propertyRenewalCycleStart } = propertySettings.renewals;

  await toggleEnableRenewalsFeature(true);

  const activeLeaseParty = await createParty(ctx, {
    id: newId(),
    userId: newLeaseParty.userId,
    workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
    assignedPropertyId: propertyId,
    state: DALTypes.PartyStateType.RESIDENT,
    ownerTeam: newLeaseParty.ownerTeam,
    teams: newLeaseParty.teams,
    seedPartyId: newLeaseParty.id,
    partyGroupId: newLeaseParty.partyGroupId,
  });

  const [leaseForNewParty] = await getPartiesLeases(ctx, [newLeaseParty.id]);

  const { leaseStartDate, leaseEndDate, moveInDate, inventoryId } = leaseForNewParty.baselineData?.quote || {};

  const activeLeaseWorkflowData = await saveActiveLeaseWorkflowData(ctx, {
    created_at: activeLeaseParty.created_at,
    leaseId: leaseForNewParty.id,
    leaseData: { leaseStartDate, leaseEndDate, leaseTerm: 12, moveInDate, inventoryId },
    partyId: activeLeaseParty.id,
    recurringCharges,
    updated_at: activeLeaseParty.updated_at,
    rentableItems,
    rolloverPeriod,
    state,
    isExtension,
    metadata,
  });

  const partyMembersForNewLeaseParty = await getPartyMembersByPartyIds(ctx, [newLeaseParty.id]);
  await mapSeries(partyMembersForNewLeaseParty, async pm => {
    const { id, partyId, ...restPM } = pm;
    await createAPartyMember(activeLeaseParty.id, restPM);
  });

  return { activeLeaseParty, propertyRenewalCycleStart, activeLeaseWorkflowData, timezone };
};

export const createNewLeaseParty = async ({
  leaseStartDate = now().format(DATE_US_FORMAT),
  leaseEndDate = now().add(10, 'days').format(DATE_US_FORMAT),
  shouldSignLease = true,
  shouldCounterSignLease = true,
}) => {
  const publishedLease = {
    leaseStartDate,
    leaseEndDate,
    moveInDate: now().format(DATE_US_FORMAT),
    moveinRentEndDate: now().add(55, 'days').toDate(),
    unitRent: 500,
    rentersInsuranceFacts: 'buyInsuranceFlag',
    concessions: {},
    additionalCharges: {},
    oneTimeCharges: {
      unitDeposit: {
        amount: 2500,
        feeType: DALTypes.FeeType.DEPOSIT,
        quoteSectionName: DALTypes.QuoteSection.DEPOSIT,
        firstFee: true,
      },
    },
  };

  await toggleEnableRenewalsFeature(true);

  const { party, userId, promotedQuote, team, partyId, property } = await createLeaseTestData();
  const propertyRenewalCycleStart = property.settings.renewals.renewalCycleStart;
  const lease = await createLease(partyId, userId, promotedQuote.id, team);
  const leaseTestData = {
    partyId,
    lease,
    userId,
    team,
    publishedLease,
    matcher,
    skipWaitingForEvents: true,
  };
  const {
    baselineData: {
      quote: { inventoryId },
    },
  } = await publishLease(leaseTestData);

  if (shouldSignLease) await signLeaseByAllPartyMembers(lease.id, partyId, matcher, false);
  if (shouldSignLease && shouldCounterSignLease) await counterSignLease(lease.id, partyId, matcher, false);

  const { id: dispatcherUserId } = await createAUser();

  await createATeamMember({
    teamId: team.id,
    userId: dispatcherUserId,
    roles: {
      mainRoles: [MainRoleDefinition.LA.name],
      functionalRoles: [FunctionalRoleDefinition.LD.name],
    },
  });

  return { partyId, party, propertyRenewalCycleStart, dispatcherUserId, leaseId: lease.id, property, team, inventoryId };
};

export const callProcessWorkflowsJob = async () => {
  const { id: jobId } = (await getRecurringJobByName(ctx, DALTypes.Jobs.ImportAndProcessPartyWorkflows)) || {};
  if (!jobId) throw new Error(`callProcessWorkflowsJob: Cannot get job by name: ${DALTypes.Jobs.ImportAndProcessPartyWorkflows}`);
  const { task: processWorkflowsMessage } = await setupQueueToWaitFor([msg => msg.jobId === jobId], ['jobs']);

  const message = {
    exchange: APP_EXCHANGE,
    key: JOBS_MESSAGE_TYPE.IMPORT_AND_PROCESS_PARTY_WORKFLOWS,
    message: { tenantId: ctx.tenantId, jobId },
    ctx,
  };

  await sendMessage(message);

  await processWorkflowsMessage;
};

export const createRenewalParty = async leaseEndDate => {
  const { activeLeaseParty, activeLeaseWorkflowData } = await createActiveLeaseParty({ leaseEndDate });

  await callProcessWorkflowsJob();

  const renewalParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.RENEWAL, seedPartyId: activeLeaseParty.id });

  return { renewalParty, activeLeaseParty, activeLeaseWorkflowData };
};

export const createRenewalPartyWithQuote = async ({ activeLeasePartyId, inventoryId }) => {
  const { party: renewalParty, quote } = await createLeaseTestData({
    workflowName: DALTypes.WorkflowName.RENEWAL,
    seedPartyId: activeLeasePartyId,
    inventoryId,
  });
  return { renewalParty, quote };
};
