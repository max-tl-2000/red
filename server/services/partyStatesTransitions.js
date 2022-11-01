/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loadParty, updateParty, getPartyStateData } from '../dal/partyRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import { savePartyStateChangedEvent } from './partyEvent';
import { logEntityUpdated } from './activityLogService';
import { COMPONENT_TYPES } from '../../common/enums/activityLogTypes';
import { getActiveAppointments, partyStatesOrder } from '../helpers/party';
import { isSignatureStatusSigned } from '../../common/helpers/lease';

import loggerModule from '../../common/helpers/logger';
import { hasAnsweredRequiredQualificationQuestions, isEmergencyTaskAllowedOnParty, isTaskAllowedOnPartyWorkflow } from '../../common/helpers/party-utils';
import { now, parseAsInTimezone } from '../../common/helpers/moment-utils';
import { getCachedEntity } from '../helpers/cacheHelper';

const logger = loggerModule.child({ subType: 'party state transition' });

// LEAD -> Required qualification questions have been answered
// or an appointment have been created (but not yet completed)
const shouldTransitionToLead = ({ party, appointments }) => {
  const allOpenAppointments = appointments.length && appointments.every(p => p.state !== DALTypes.TaskStates.COMPLETED);

  return allOpenAppointments || hasAnsweredRequiredQualificationQuestions(party.qualificationQuestions);
};

// PROSPECT -> An appointment has been completed
// or a quote was generated for the party
const shouldTransitionToProspect = ({ appointments, quotesForParty }) => {
  const completedAppointmentExists = (appointments || []).some(p => p.state === DALTypes.TaskStates.COMPLETED);
  return completedAppointmentExists || quotesForParty.length > 0;
};

const partyHasApplicant = party => party.partyMembers.some(pm => pm.memberState === DALTypes.PartyStateType.APPLICANT);

const partyHasActiveQuotePromotion = quotePromotions =>
  (quotePromotions || []).some(
    q =>
      q.promotionStatus === DALTypes.PromotionStatus.PENDING_APPROVAL ||
      q.promotionStatus === DALTypes.PromotionStatus.APPROVED ||
      q.promotionStatus === DALTypes.PromotionStatus.REQUIRES_WORK,
  );

const partyHasPublishedLease = leases => (leases || []).some(l => l.status === DALTypes.LeaseStatus.SUBMITTED || l.status === DALTypes.LeaseStatus.EXECUTED);

// APPLICANT -> At least one application was submited
const shouldTransitionToApplicant = ({ party, quotePromotions, leases }) =>
  !partyHasPublishedLease(leases) && (partyHasApplicant(party) || partyHasActiveQuotePromotion(quotePromotions));

const shouldTransitionToLease = ({ leases }) => partyHasPublishedLease(leases);

const shouldTransitionToFutureResident = ({ leases }) => {
  const activeLeases = (leases || []).filter(lease => lease.status !== DALTypes.LeaseStatus.VOIDED);
  if (!activeLeases.length) return false;

  return activeLeases.every(item => {
    const validSignatures = (item.signatures || []).filter(signature => signature.userId);
    return validSignatures.length && validSignatures.every(signature => isSignatureStatusSigned(signature.status));
  });
};

const shouldTransitionToMovingOut = ({ activeLeaseData }) => activeLeaseData.state === DALTypes.ActiveLeaseState.MOVING_OUT;

const collectEmergencyContactConditionsPassed = (party, partySettings, activeLeases, tasks) => {
  if (!isEmergencyTaskAllowedOnParty(party, partySettings)) return true;

  const isCollectEmergencyTaskCreationAllowedOnWorkflow = isTaskAllowedOnPartyWorkflow({
    taskName: DALTypes.TaskNames.COLLECT_EMERGENCY_CONTACT,
    partyWorkflowName: party.workflowName,
    partyWorkflowState: party.workflowState,
  });

  if (!isCollectEmergencyTaskCreationAllowedOnWorkflow) return true;
  const collectEmergencyContactCondition = activeLeases.every(lease => {
    const task = tasks.find(t => t.metadata.leaseId === lease.id && t.name === DALTypes.TaskNames.COLLECT_EMERGENCY_CONTACT);
    if (!task) return false;
    return task.state !== DALTypes.TaskStates.ACTIVE;
  });

  return !!collectEmergencyContactCondition;
};

const shouldTransitionToResident = ({ ctx, party, leases, tasks, partySettings }) => {
  const activeLeases = (leases || []).filter(lease => lease.status !== DALTypes.LeaseStatus.VOIDED);
  if (!activeLeases.length) return false;

  const leaseCondition = activeLeases.every(item => {
    const timezone = item?.baselineData?.timezone;
    const today = now({ timezone }).startOf('day');
    return (
      item.status === DALTypes.LeaseStatus.EXECUTED &&
      parseAsInTimezone(item?.baselineData?.quote?.moveInDate, { timezone }).startOf('day').isSameOrBefore(today)
    );
  });
  if (!leaseCondition) return false;

  if (!collectEmergencyContactConditionsPassed(party, partySettings, activeLeases, tasks)) return false;

  const activeTasks = tasks.filter(task => task.state === DALTypes.TaskStates.ACTIVE || task.state === DALTypes.TaskStates.SNOOZED);

  if (activeTasks.length) {
    logger.warn({ ctx, activeTasks }, 'Transitioning party to resident. ACTIVE TASKS still present on the party!');
  }

  return !activeTasks.length;
};

const transitionMatchingFunctions = {
  [DALTypes.PartyStateType.CONTACT]: () => true,
  [DALTypes.PartyStateType.LEAD]: shouldTransitionToLead,
  [DALTypes.PartyStateType.PROSPECT]: shouldTransitionToProspect,
  [DALTypes.PartyStateType.APPLICANT]: shouldTransitionToApplicant,
  [DALTypes.PartyStateType.LEASE]: shouldTransitionToLease,
  [DALTypes.PartyStateType.FUTURERESIDENT]: shouldTransitionToFutureResident,
  [DALTypes.PartyStateType.MOVINGOUT]: () => false,
  [DALTypes.PartyStateType.RESIDENT]: shouldTransitionToResident,
};

const renewalTransitionMatchingFunctions = {
  [DALTypes.PartyStateType.PROSPECT]: () => true,
  [DALTypes.PartyStateType.APPLICANT]: () => false,
  [DALTypes.PartyStateType.LEASE]: shouldTransitionToLease,
  [DALTypes.PartyStateType.FUTURERESIDENT]: shouldTransitionToFutureResident,
  [DALTypes.PartyStateType.MOVINGOUT]: shouldTransitionToMovingOut,
  [DALTypes.PartyStateType.RESIDENT]: shouldTransitionToResident,
};

const computeActiveLeasePartyState = () => DALTypes.PartyStateType.RESIDENT;

const computeRenewalPartyState = async (ctx, party) => {
  const { partyLeases: leases, partyTasks: tasks, activeLeaseData } = await getPartyStateData(ctx, party.id, party.seedPartyId);

  const stateToTransitionTo = partyStatesOrder
    .slice()
    .reverse()
    .find(s =>
      renewalTransitionMatchingFunctions[s]({
        ctx,
        leases,
        tasks,
        activeLeaseData,
        party,
      }),
    );

  return stateToTransitionTo || DALTypes.PartyStateType.PROSPECT;
};

const computePartyState = async (ctx, party) => {
  const { partyQuotes: quotesForParty, quotePromotions, partyLeases: leases, partyTasks: tasks, activeLeaseData, partySettings } = await getPartyStateData(
    ctx,
    party.id,
    party.seedPartyId,
  );
  const publishedQuotes = quotesForParty.filter(q => q.publishDate);
  const appointments = getActiveAppointments(tasks);

  const stateToTransitionTo = partyStatesOrder
    .slice()
    .reverse()
    .find(s =>
      transitionMatchingFunctions[s]({
        ctx,
        quotesForParty,
        publishedQuotes,
        quotePromotions,
        leases,
        tasks,
        activeLeaseData,
        appointments,
        party,
        partySettings,
      }),
    );
  return stateToTransitionTo || DALTypes.PartyStateType.CONTACT;
};

const computePartyStates = async (ctx, party) => {
  switch (party.workflowName) {
    case DALTypes.WorkflowName.RENEWAL: {
      return await computeRenewalPartyState(ctx, party);
    }
    case DALTypes.WorkflowName.ACTIVE_LEASE: {
      return computeActiveLeasePartyState();
    }
    default:
      return await computePartyState(ctx, party);
  }
};

const updatePartyState = async (ctx, partyId, newPartyState) => {
  const delta = {
    id: partyId,
    state: newPartyState,
  };

  return await updateParty(ctx, delta);
};

export const performPartyStateTransition = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'performPartyStateTransition');
  const party = getCachedEntity(ctx, { type: 'party', id: partyId }) || (await loadParty(ctx, partyId));
  const newPartyState = await computePartyStates(ctx, party);
  logger.trace({ ctx, partyId, newPartyState }, 'computed party state');
  if (newPartyState !== party.state) {
    logger.info(
      {
        ctx,
        partyId: party.id,
        oldState: party.state,
        newState: newPartyState,
      },
      'Transitioning party to new state',
    );
    const updatedParty = await updatePartyState(ctx, partyId, newPartyState);
    await logEntityUpdated({
      req: ctx,
      entityPrevState: party,
      entityNextState: updatedParty,
      component: COMPONENT_TYPES.PARTY,
      createdByType: DALTypes.CreatedByType.SYSTEM,
    });
    await savePartyStateChangedEvent(ctx, {
      partyId,
      userId: (ctx.authUser || {}).id || party.userId,
      metadata: {
        oldState: party.state,
        newState: newPartyState,
      },
    });

    notify({
      ctx,
      event: eventTypes.PARTY_UPDATED,
      data: { partyId: party.id },
      routing: { teams: updatedParty.teams },
    });

    return newPartyState;
  }

  return party.state;
};
