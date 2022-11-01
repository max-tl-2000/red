/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { flatMap, groupBy, orderBy, flatten } from 'lodash'; // eslint-disable-line
import getUUID from 'uuid/v4';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getUsersWithLCARoleForParty } from '../../utils';
import { isCorporateParty, isTaskAllowedOnCorporateParties } from '../../../../common/helpers/party-utils';
import logger from '../../../../common/helpers/logger';
import { now } from '../../../../common/helpers/moment-utils';
import { FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { isSignatureStatusSigned } from '../../../../common/helpers/lease';
import { shouldProcessTaskOnPartyWorkflow, findEvents } from '../taskHelper';

const { PartyEventType, TaskNames, TaskStates } = DALTypes;

const getActiveTasks = party => (party.tasks || []).filter(task => task.name === TaskNames.COUNTERSIGN_LEASE && task.state === TaskStates.ACTIVE);

const getActiveLeases = party => (party.leases || []).filter(lease => lease.status !== DALTypes.LeaseStatus.VOIDED);

const allPartyMemberEnvelopesSigned = signatures =>
  signatures.filter(signature => signature.partyMemberId).every(signature => isSignatureStatusSigned(signature.status));

const allCounterSignerEnvelopesSigned = signatures =>
  signatures.filter(signature => signature.userId).every(signature => isSignatureStatusSigned(signature.status));

const allActiveSignaturesForParty = party =>
  flatMap(party.leases, lease => lease.signatures || []).filter(({ status }) => status !== DALTypes.LeaseSignatureStatus.VOIDED);

const signaturesGroupedByEnvelope = signatures => Object.values(groupBy(signatures, 'envelopeId'));

const doesEnvelopeNeedCounterSignature = signatures => {
  const didAllResidentsSign = allPartyMemberEnvelopesSigned(signatures);
  const didAllCounterSignersSign = allCounterSignerEnvelopesSigned(signatures);

  return didAllResidentsSign && !didAllCounterSignersSign;
};

const needsCounterSignerTask = party => {
  const allSignatures = allActiveSignaturesForParty(party);
  if (!allSignatures.length) return false;

  const groupedEnvelopeSignatures = signaturesGroupedByEnvelope(allSignatures);
  return groupedEnvelopeSignatures.some(envelopeSignatures => doesEnvelopeNeedCounterSignature(envelopeSignatures));
};

const noEnvelopeNeedsCountersignature = party => {
  const allSignatures = allActiveSignaturesForParty(party);
  if (!allSignatures.length) return true;

  const groupedEnvelopeSignatures = signaturesGroupedByEnvelope(allSignatures);
  return groupedEnvelopeSignatures.every(envelopeSignatures => !doesEnvelopeNeedCounterSignature(envelopeSignatures));
};

const getLastCounterSigner = activeLeases => {
  const signatures = activeLeases.map(lease => lease.signatures);
  const counterSigners = flatten(signatures).filter(signature => signature.userId);

  return orderBy(counterSigners, ['metadata.signDate'], ['desc'])[0].userId;
};

const createTasks = async (ctx, party, token) => {
  const leaseSignedEvent = party.events.find(ev => DALTypes.PartyEventType.LEASE_SIGNED === ev.event);
  if (!leaseSignedEvent) return [];

  const activeLeases = getActiveLeases(party);
  if (!activeLeases.length) return [];

  if (!shouldProcessTaskOnPartyWorkflow(party, DALTypes.TaskNames.COUNTERSIGN_LEASE)) return [];

  if (isCorporateParty(party) && !isTaskAllowedOnCorporateParties(DALTypes.TaskNames.COUNTERSIGN_LEASE)) return [];

  const activeTask = getActiveTasks(party);
  if (activeTask.length) return [];

  if (!needsCounterSignerTask(party)) return [];

  const { leaseId } = leaseSignedEvent?.metadata;

  const usersWithLCARole = await getUsersWithLCARoleForParty(ctx, party.id, token);
  const newTask = {
    name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
    category: DALTypes.TaskCategories.CONTRACT_SIGNING,
    partyId: party.id,
    userIds: usersWithLCARole,
    state: DALTypes.TaskStates.ACTIVE,
    dueDate: now().toDate(),
    metadata: {
      externalId: getUUID(),
      leaseId,
      unique: true,
    },
  };
  logger.trace({ ctx, taskEntities: [newTask] }, 'CreateCountersignLeaseTask');

  return [newTask];
};

const completeTasks = (ctx, party) => {
  if (!party.events.find(ev => ev.event === PartyEventType.LEASE_COUNTERSIGNED || ev.event === PartyEventType.LEASE_EXECUTED)) return [];

  if (!shouldProcessTaskOnPartyWorkflow(party, DALTypes.TaskNames.COUNTERSIGN_LEASE)) return [];
  if (isCorporateParty(party) && !isTaskAllowedOnCorporateParties(DALTypes.TaskNames.COUNTERSIGN_LEASE)) return [];

  const activeTask = getActiveTasks(party);
  if (!activeTask.length) return [];

  const activeLeases = getActiveLeases(party);
  if (!activeLeases.length) return [];

  if (!noEnvelopeNeedsCountersignature(party)) return [];

  const lastCounterSignerUserId = getLastCounterSigner(activeLeases);
  const executedLeases = activeLeases.filter(lease => lease.status === DALTypes.LeaseStatus.EXECUTED);
  const completedTask = {
    id: activeTask[0].id,
    state: DALTypes.TaskStates.COMPLETED,
    completionDate: now().toDate(),
    metadata: {
      completedBy: lastCounterSignerUserId,
      ...(executedLeases.length && { completedLeases: executedLeases.map(lease => lease.id) }),
    },
  };

  if (completedTask) {
    logger.trace({ ctx, taskEntities: [completedTask], partyId: party.id }, 'CompleteCountersignLeaseTask');
  }
  return [completedTask];
};

const cancelTasks = (ctx, party) => {
  logger.trace({ ctx, partyId: party.id, events: party.events }, 'CancelCountersignLeaseTask');

  if (!findEvents(party, [PartyEventType.LEASE_VERSION_CREATED, PartyEventType.LEASE_VOIDED, PartyEventType.PARTY_ARCHIVED]).length) {
    return [];
  }

  if (isCorporateParty(party) && !isTaskAllowedOnCorporateParties(DALTypes.TaskNames.COUNTERSIGN_LEASE)) return [];

  const activeTask = getActiveTasks(party);
  if (!activeTask.length) return [];

  if (!noEnvelopeNeedsCountersignature(party)) return [];

  const canceledTask = {
    id: activeTask[0].id,
    state: DALTypes.TaskStates.CANCELED,
  };

  if (canceledTask) {
    logger.trace({ ctx, taskEntities: [canceledTask], partyId: party.id }, 'CancelCountersignLeaseTask');
  }
  return [canceledTask];
};

export const countersignLease = {
  name: DALTypes.TaskNames.COUNTERSIGN_LEASE,
  category: DALTypes.TaskCategories.CONTRACT_SIGNING,
  requiredRoles: [FunctionalRoleDefinition.LCA.name],
  createTasks,
  completeTasks,
  cancelTasks,
};
