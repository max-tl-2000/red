/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import orderBy from 'lodash/orderBy';
import { mapSeries } from 'bluebird';

import { getTeamsForUser, getTeamBy, getTeamsByIds, getTeamMemberById, getTeamMemberByTeamAndUser } from '../dal/teamsRepo';
import { getUserFullNameById } from '../dal/usersRepo';
import * as partyRepo from '../dal/partyRepo';
import { getCommunicationsByMessageId } from '../dal/communicationRepo';
import { getPropertiesAssociatedWithTeams, getPropertySettings } from '../dal/propertyRepo';
import { loadProgramByTeamPropertyProgramId } from '../dal/programsRepo';
import { getSourceByName } from '../dal/sourcesRepo';

import { getPartyRoutingUserId } from './routing/partyRouter';
import { CommTargetType } from './routing/targetUtils';
import { performPartyStateTransition } from './partyStatesTransitions';
import { logEntityAdded, logEntity } from './activityLogService';
import { getTeamIdsForNewParty } from './party.js';
import * as commsHelpers from './helpers/communicationHelpers';
import { shouldExcludeForNewLeadProcessing } from '../helpers/party';
import { updateParty } from './party';
import { updatePerson, getPersonById } from './person';

import eventTypes from '../../common/enums/eventTypes';
import { notify } from '../../common/server/notificationClient';
import { DALTypes } from '../../common/enums/DALTypes';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';
import loggerModule from '../../common/helpers/logger';
import { ServiceError } from '../common/errors';
import { enhanceContactInfoWithSmsInfo } from './telephony/twilio';
import { partyWfStatesSubset } from '../../common/enums/partyTypes';
import { reassignPartyAndTasksForInactiveTeamMember } from './teamMembers';

import nullish from '../../common/helpers/nullish';
import { toMoment, now } from '../../common/helpers/moment-utils';

const logger = loggerModule.child({ subType: 'rawLeadCreation' });

const validStatesForAddingNewMembers = [
  DALTypes.PartyStateType.CONTACT,
  DALTypes.PartyStateType.LEAD,
  DALTypes.PartyStateType.PROSPECT,
  DALTypes.PartyStateType.APPLICANT,
];

const updatePropertyIdIfNecessary = async (ctx, targetContext, senderParties) => {
  const propertyId = targetContext.program.propertyId;
  if (propertyId) {
    const partiesToBeUpdated = senderParties.filter(party => !party.assignedPropertyId);
    await mapSeries(
      partiesToBeUpdated,
      async party =>
        await partyRepo.updateParty(ctx, {
          id: party.id,
          assignedPropertyId: propertyId,
        }),
    );
  }
};

const getFirstContactChannel = commChannel => {
  switch (commChannel) {
    case DALTypes.CommunicationMessageType.CALL:
      return DALTypes.ContactEventTypes.CALL;
    case DALTypes.CommunicationMessageType.SMS:
      return DALTypes.ContactEventTypes.SMS;
    case DALTypes.CommunicationMessageType.EMAIL:
      return DALTypes.ContactEventTypes.EMAIL;
    case DALTypes.CommunicationMessageType.WEB:
      return DALTypes.ContactEventTypes.WEB;
    default:
      return DALTypes.ContactEventTypes.OTHER;
  }
};

const hasQualificationQuestions = ({ qualificationQuestions }) => !!Object.keys(qualificationQuestions || {}).length;

const shouldStoreQualificationQuestions = (commChannel, senderPersonId, personData = {}) => {
  switch (commChannel) {
    case DALTypes.CommunicationMessageType.WEB:
      return senderPersonId ? hasQualificationQuestions(personData) : false;
    case DALTypes.CommunicationMessageType.EMAIL:
      return hasQualificationQuestions(personData);
    default:
      return false;
  }
};

const getValidQualificationQuestion = (ctx, types, option, fieldName) => {
  if (!option || !fieldName) return {};

  const answers = Array.isArray(option) ? option : [option];
  const options = Object.keys(types);
  const validAnswers = answers.filter(value => options.some(key => key === value));
  if (validAnswers.length !== answers.length) {
    logger.warn({ ctx, options, questionKey: fieldName, questionValue: answers, validAnswers }, 'Could not find qualification question answer');
  }
  return validAnswers.length ? { [fieldName]: Array.isArray(option) ? validAnswers : validAnswers[0] } : {};
};

export const getValidQuestionsAndAnswers = (ctx, qualificationQuestions) => {
  if (!hasQualificationQuestions({ qualificationQuestions })) return qualificationQuestions;

  const optionsByQuestionMap = [
    ['numBedrooms', DALTypes.QualificationQuestions.BedroomOptions],
    ['groupProfile', DALTypes.QualificationQuestions.GroupProfile],
    ['moveInTime', DALTypes.QualificationQuestions.MoveInTime],
    ['cashAvailable', DALTypes.QualificationQuestions.SufficientIncome],
  ];

  return Object.keys(qualificationQuestions).reduce((acc, key) => {
    const quenstionAndAnswers = optionsByQuestionMap.find(([fieldName]) => fieldName === key);
    if (!quenstionAndAnswers) return { ...acc, [key]: qualificationQuestions[key] };

    return {
      ...acc,
      ...getValidQualificationQuestion(ctx, quenstionAndAnswers[1], qualificationQuestions[key], key),
    };
  }, {});
};

const getLastArchivedActiveLease = parties => {
  const archivedParties = parties.filter(p => p.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE && p.workflowState === DALTypes.WorkflowState.ARCHIVED);
  const orderedParties = orderBy(archivedParties, ['archiveDate'], ['desc']);
  return orderedParties.length ? orderedParties[0] : undefined;
};

export const getPartiesForComm = async (ctx, { allParties, propertyId }) => {
  // first filter based on property if possible.
  const parties = commsHelpers.narrowDownPartiesByProperty({ parties: allParties, propertyId });

  // if we have active parties -> return the active parties
  const activeParties = parties.filter(p => p.workflowState === DALTypes.WorkflowState.ACTIVE);
  if (activeParties.length) {
    logger.trace({ ctx, activePartiesIds: activeParties?.map(party => party.id).join(', ') }, 'getPartiesForComm - active parties flow');
    return activeParties;
  }

  // if we have no active parties -> return the last closed party if exists
  const closedParties = parties.filter(p => p.workflowState === DALTypes.WorkflowState.CLOSED);
  if (closedParties.length) {
    const [first] = orderBy(closedParties, ['endDate'], ['desc']);
    logger.trace({ ctx, partyId: first?.id }, 'getPartiesForComm - closed parties flow');
    return [first];
  }

  // if we have no active or closed parties -> return the last Active Lease archived party
  const lastArchivedLease = getLastArchivedActiveLease(parties);
  if (lastArchivedLease) {
    logger.trace({ ctx, partyId: lastArchivedLease?.id }, 'getPartiesForComm - archived parties flow');
    return [lastArchivedLease];
  }

  const [first] = orderBy(parties, ['created_at'], ['desc']);
  logger.trace({ ctx, partyId: first?.id }, 'getPartiesForComm - last created party flow');
  return [first];
};

// this is for scenario when we already have a party for the target team, but the propertyId is not set
// eg. when same person sends two emails to a team member address and the member's team is associated with two parties
// in this case we don't want to create two parties (both of them with assignedPropertyId = null)
const doesAlreadyExistsForSameTeam = (parties, targetTeamIds) => parties.some(p => targetTeamIds.includes(p.ownerTeam));

const isSenderAlreadyAMember = async (ctx, senderAddress, partyId) => {
  const partyMembers = await partyRepo.loadPartyMembers(ctx, partyId);
  return partyMembers.some(pm => pm.contactInfo.emails.some(e => e.value === senderAddress));
};

const isArchivedPartyStillInValidReceivingCommsWindow = async (ctx, partiesInGroup, targetParty) => {
  const lastArchivedLeaseInGroup = getLastArchivedActiveLease(partiesInGroup);
  if (!lastArchivedLeaseInGroup) return false;
  if (targetParty && targetParty?.workflowState !== DALTypes.WorkflowState.ARCHIVED) return false;
  // since they are ordered descending by created at, the first one found will be the last one created so we should be fine

  const { comms } = await getPropertySettings(ctx, lastArchivedLeaseInGroup.assignedPropertyId);
  return comms.daysToRouteToALPostMoveout && toMoment(lastArchivedLeaseInGroup.archiveDate).add(comms.daysToRouteToALPostMoveout, 'days').isSameOrAfter(now());
};

const getOtherActivePartyFromGroup = (partiesInGroup, partyIdForRouting) =>
  partiesInGroup.find(p => p.workflowState === DALTypes.WorkflowState.ACTIVE && !p.endDate && !p.archiveDate && partyIdForRouting !== p.id);

// only one party per property should be created for same person
const leadAlreadyExists = async (ctx, commContext, teamIds) => {
  const { targetContext, senderContext, transferredFromCommId: isTransfer, channel, inReplyTo, uniquePartyPerPropertyAndTeam } = commContext;

  if (targetContext.type === CommTargetType.PARTY) {
    // if the party member is active in another party for the same property and the initial party of the comm is closed
    // redirect to the active one
    // please be aware that if the target context party is a archived party, the else statement will be true
    // also please note that the sender context party list contains also archived parties in case the target party is closed or archived
    // in case the target party is not closed and not archived, the senderContext.parties = [targetContext.id] = destination party id
    const partyIdForRouting = targetContext.isClosedParty && senderContext.parties[0] ? senderContext.parties[0] : targetContext.id;

    const party = await partyRepo.getPartyBy(ctx, { id: partyIdForRouting });
    const partiesInGroup = await partyRepo.getPartiesByPartyGroupId(ctx, party.partyGroupId);
    const activePartyInGroup = getOtherActivePartyFromGroup(partiesInGroup, partyIdForRouting);

    const isSenderAMemberInActiveParty = activePartyInGroup && (await isSenderAlreadyAMember(ctx, senderContext.from, activePartyInGroup.id));

    const isTargetPartyArchived = party?.workflowState === DALTypes.WorkflowState.ARCHIVED;

    if ((isTargetPartyArchived && inReplyTo) || isSenderAMemberInActiveParty) {
      return {
        leadExists: true,
        parties: [],
      };
    }

    const isSenderAMember = await isSenderAlreadyAMember(ctx, senderContext.from, party.id);

    // if sender is no longer in a active party, but the last archived active lease party in the grup was archived due to the vacate date
    // if we are in 120 days interval from the vacate date (or whatever value we have in property settings in daysToRouteToALPostMoveout field)
    const canArchivedPartyReceiveComms = isTargetPartyArchived && (await isArchivedPartyStillInValidReceivingCommsWindow(ctx, partiesInGroup, party));

    if (
      (!isSenderAMember && (party?.endDate || !validStatesForAddingNewMembers.includes(party.state))) ||
      (isTargetPartyArchived && !canArchivedPartyReceiveComms)
    ) {
      // in this case, as fallback, we create a new party on the same property as the target one
      // and also we set the custom source as transfer-agent as requested by josh for /CPM-14293
      const source = await getSourceByName(ctx, 'transfer-agent');
      const transferAgentSource = { id: source.id, displayName: source.displayName };

      logger.trace(
        { ctx, from: senderContext.from, party },
        'Cannot add a new party member to the target party. A new party will be created on the same property.',
      );
      return {
        leadExists: false,
        transferAgentSource,
        parties: [],
      };
    }
    const targetParty = canArchivedPartyReceiveComms && getLastArchivedActiveLease(partiesInGroup);
    const parties = targetParty ? [targetParty] : [];
    return {
      leadExists: true,
      parties,
    };
  }

  const allParties = await partyRepo.loadPartiesByPersonIds(ctx, senderContext.persons, partyWfStatesSubset.unarchived);
  const parties = allParties.filter(p => !shouldExcludeForNewLeadProcessing(p));

  if (targetContext.type === CommTargetType.PROGRAM) {
    const programPropertyId = targetContext.program.propertyId;

    // for WEB check only NEW_LEASE. For the rest go through normal flow
    const partiesToCheck =
      channel === DALTypes.CommunicationMessageType.WEB ? parties.filter(p => p.workflowName === DALTypes.WorkflowName.NEW_LEASE) : parties;

    const leadExistsBeforeCheckingArchived = partiesToCheck.some(party => party.assignedPropertyId === programPropertyId);

    if (leadExistsBeforeCheckingArchived || channel === DALTypes.CommunicationMessageType.WEB) {
      const programTeamId = targetContext.program.teamId;
      return {
        leadExists: uniquePartyPerPropertyAndTeam
          ? partiesToCheck.some(party => party.assignedPropertyId === programPropertyId && party.ownerTeam === programTeamId)
          : leadExistsBeforeCheckingArchived,
        parties: [],
      };
    }

    const archivedParties = await partyRepo.loadPartiesByPersonIds(ctx, senderContext.persons, partyWfStatesSubset.archived);
    const partiesFilteredByProperty = archivedParties.filter(p => p.assignedPropertyId === targetContext.program.propertyId);
    const orderedParties = orderBy(partiesFilteredByProperty, ['created_at'], ['desc']);
    const lastActiveLeaseArchivedParty = getLastArchivedActiveLease(orderedParties);
    const canPartyStillReceiveComms = await isArchivedPartyStillInValidReceivingCommsWindow(ctx, orderedParties);

    return {
      leadExists: canPartyStillReceiveComms,
      parties: lastActiveLeaseArchivedParty ? [lastActiveLeaseArchivedParty] : [],
    };
  }

  // for CommTargetType: TEAM, TEAM_MEMBER, INDIVIDUAL
  if (isTransfer) return { leadExists: parties.length > 0, parties };

  const teamProperties = await getPropertiesAssociatedWithTeams(ctx, teamIds);
  const teamPropertyIds = teamProperties.map(tp => tp.id);
  const existsForSameProperty = parties.some(p => teamPropertyIds.includes(p.assignedPropertyId));
  return {
    leadExists: existsForSameProperty || doesAlreadyExistsForSameTeam(parties, teamIds),
    parties: [],
  };
};

const logLeadAdded = async (ctx, lead) => {
  const { teamPropertyProgramId } = lead;
  const program = teamPropertyProgramId ? await loadProgramByTeamPropertyProgramId(ctx, teamPropertyProgramId) : null;
  const logData = {
    ...lead,
    program,
    createdByType: DALTypes.CreatedByType.SYSTEM,
    partyOwner: lead.userId && (await getUserFullNameById(ctx, lead.userId)),
  };

  await logEntityAdded(ctx, { entity: logData, component: COMPONENT_TYPES.PARTY });
};

const notifyPartyUpdated = (ctx, party) => {
  notify({
    ctx,
    event: eventTypes.PARTY_UPDATED,
    data: { partyId: party.id },
    routing: { teams: party.teams },
  });
};

const getTeamIdsForTargetContext = async (ctx, targetContext) => {
  switch (targetContext.type) {
    case CommTargetType.PARTY: {
      const party = await partyRepo.getPartyBy(ctx, { id: targetContext.id });
      return [(await getTeamBy(ctx, { id: party.ownerTeam })).id];
    }
    case CommTargetType.PROGRAM: {
      return [targetContext.program.teamId];
    }
    case CommTargetType.INDIVIDUAL: {
      const userTeams = await getTeamsForUser(ctx, targetContext.id);
      return userTeams.map(team => team.id);
    }
    case CommTargetType.TEAM_MEMBER: {
      const { teamId } = await getTeamMemberById(ctx, targetContext.id);
      return [teamId];
    }
    case CommTargetType.TEAM: {
      return [targetContext.id];
    }
    default:
      return [];
  }
};

const getRoutedUserId = async (ctx, { channel, targetContext, avoidAssigningToDispatcher, preferredPartyOwnerId, teamId }) => {
  // when creating leads for calls, we assign the owner only after the call takes place
  // such that we have more info on who the owner should be
  if (channel === DALTypes.CommunicationMessageType.CALL) return null;

  switch (targetContext.type) {
    case CommTargetType.PARTY: {
      const team = await getTeamBy(ctx, { id: teamId });
      return await getPartyRoutingUserId(ctx, { targetContext, team, avoidAssigningToDispatcher, preferredPartyOwnerId });
    }
    case CommTargetType.INDIVIDUAL: {
      return targetContext.id;
    }
    case CommTargetType.TEAM_MEMBER: {
      const { userId } = await getTeamMemberById(ctx, targetContext.id);
      return userId;
    }
    case CommTargetType.TEAM: {
      const team = await getTeamBy(ctx, { id: targetContext.id });
      return await getPartyRoutingUserId(ctx, { targetContext, team, avoidAssigningToDispatcher, preferredPartyOwnerId });
    }
    case CommTargetType.PROGRAM: {
      const team = await getTeamBy(ctx, { id: targetContext.program.teamId });
      return await getPartyRoutingUserId(ctx, { targetContext, team, avoidAssigningToDispatcher, preferredPartyOwnerId });
    }
    default: {
      logger.error({ ctx, targetType: targetContext.type }, 'Invalid target context type');
      throw new ServiceError({
        token: 'INVALID_COMM_TARGET_TYPE',
        status: 412,
      });
    }
  }
};

const getPersonDataForLead = (ctx, senderPersonId, personData, channel) => {
  // if a person already exists, don't change its data
  const personDataForLead = senderPersonId ? { personId: senderPersonId } : personData;

  const tempPersonData = shouldStoreQualificationQuestions(channel, senderPersonId, personData)
    ? {
        ...personDataForLead,
        qualificationQuestions: personData.qualificationQuestions,
      }
    : personDataForLead;

  return {
    ...tempPersonData,
    ...(tempPersonData.qualificationQuestions ? { qualificationQuestions: getValidQuestionsAndAnswers(ctx, tempPersonData.qualificationQuestions) } : {}),
  };
};

const addNewRawLead = async (
  ctx,
  { teamIds, channel, category, targetContext, personData, senderPersonId, avoidAssigningToDispatcher, preferredPartyOwnerId, transferAgentSource },
) => {
  const teams = await getTeamsByIds(ctx, teamIds);
  const collaboratorTeams = await getTeamIdsForNewParty({ ctx, teams });
  const firstContactChannel = getFirstContactChannel(channel);
  const routedUserId = await getRoutedUserId(ctx, { channel, targetContext, avoidAssigningToDispatcher, preferredPartyOwnerId, teamId: teamIds[0] });
  const teamMemberSource = targetContext.type === CommTargetType.TEAM_MEMBER ? targetContext.id : '';
  const party = targetContext.type === CommTargetType.PARTY ? await partyRepo.getPartyBy(ctx, { id: targetContext.id }) : {};

  const personDataForLead = getPersonDataForLead(ctx, senderPersonId, personData, channel);
  if (personDataForLead.contactInfo) {
    const isILSEmail = channel === DALTypes.CommunicationMessageType.EMAIL && category === DALTypes.CommunicationCategory.ILS;
    personDataForLead.contactInfo.all = await enhanceContactInfoWithSmsInfo(ctx, personDataForLead.contactInfo.all, isILSEmail);
  }

  const lead = await partyRepo.createRawLead({
    ctx,
    personData: personDataForLead,
    collaboratorTeams, // this contains also associated teams
    teamsForParty: teamIds, // this contains only the teams determined by the comm context
    userId: routedUserId,
    program: targetContext.program,
    originalProgram: targetContext.originalProgram,
    channel: firstContactChannel,
    teamMemberSource,
    transferAgentSource,
    propertyId: party.assignedPropertyId, // this is set only when we create a lead from a comm that came on an emailIdentifier of a closed party from a person that is not member
  });

  if (lead.metadata?.activatePaymentPlanDate) {
    await logEntity(ctx, {
      entity: {
        id: lead.id,
        programDisplayName: targetContext.program?.displayName,
        createdByType: targetContext.program ? DALTypes.CreatedByType.SYSTEM : DALTypes.CreatedByType.USER,
      },
      activityType: ACTIVITY_TYPES.SET_FLAG,
      component: COMPONENT_TYPES.PARTY,
    });
  }

  await logLeadAdded(ctx, lead);
  await performPartyStateTransition(ctx, lead.id);
  notifyPartyUpdated(ctx, lead);

  return lead;
};

const addNewPartyMember = async (ctx, party, personData, senderPersonId, senderMemberType) => {
  const enhancedPersonData = {
    ...personData,
    personId: senderPersonId,
    memberType: senderMemberType,
    memberState: DALTypes.PartyStateType.CONTACT,
  };

  const partyMember = await partyRepo.createPartyMember(ctx, enhancedPersonData, party.id);
  notifyPartyUpdated(ctx, party);

  return partyMember;
};

const getTargetPartyMember = async (ctx, sendersPersonIds, targetedParty) => {
  const targetPartyMembers = await partyRepo.getPartyMembersByPartyIds(ctx, [targetedParty.id]);
  return targetPartyMembers.find(m => sendersPersonIds.includes(m.personId));
};

const getTargetedParty = async (ctx, parties, targetContext, sendersPersonIds) => {
  if (parties.length === 1) return parties[0];

  const sortedParties = orderBy(parties, ['created_at', 'endDate'], ['desc', 'desc']);
  const partiesWithPerson = (p, personIds) => (p.partyMembers || []).some(pm => personIds.includes(pm.personId));

  if (targetContext.type === CommTargetType.PROGRAM) {
    const partyForTargetedProgram = sortedParties.find(
      p => p.teamPropertyProgramId === targetContext.program.teamPropertyProgramId && partiesWithPerson(p, sendersPersonIds),
    );
    if (partyForTargetedProgram) return partyForTargetedProgram;
  }

  return sortedParties.find(p => partiesWithPerson(p, sendersPersonIds)) || sortedParties[0];
};

const createNewPartyMember = async (ctx, { personData, senderPersonId, targetedParty, teamIds }) => {
  logger.trace({ ctx }, `A new party member will be added for party ${targetedParty.id}`);

  const senderMemberType = targetedParty.leaseType === DALTypes.PartyTypes.CORPORATE ? DALTypes.MemberType.OCCUPANT : DALTypes.MemberType.RESIDENT;
  const newPartyMember = await addNewPartyMember(ctx, targetedParty, personData, senderPersonId, senderMemberType);

  await logEntityAdded(ctx, { entity: { ...newPartyMember, createdByType: DALTypes.CreatedByType.SYSTEM }, component: COMPONENT_TYPES.GUEST });

  return {
    newPartyMember,
    teamIds,
    personId: newPartyMember.personId,
    partyIds: [targetedParty.id],
    targetPartyId: targetedParty.id,
    senderPartyMemberId: newPartyMember.id,
  };
};

const shouldRedirectToOtherParty = async (ctx, senderContext, targetContext, senderParties) => {
  if (targetContext.isClosedParty) return senderContext.parties[0] && targetContext.id !== senderContext.parties[0];

  if (targetContext.isArchivedParty) {
    if (getOtherActivePartyFromGroup(senderParties, targetContext.id)) return true;
    const targetParty = senderParties.find(p => p.id === targetContext.id);
    return await isArchivedPartyStillInValidReceivingCommsWindow(ctx, senderParties, targetParty);
  }
  return false;
};

const getPartiesForReplyComm = async (ctx, { communicationContext }) => {
  // if this is a reply -> return the parties for this reply
  const { targetContext, inReplyTo } = communicationContext;
  if (targetContext.isArchivedParty) {
    // redirect the comm to the seeded party
    const seededParty = await partyRepo.getSeededPartyByParentId(ctx, targetContext.id);
    if (seededParty && seededParty.workflowState !== DALTypes.WorkflowState.ARCHIVED) return [seededParty];
  }

  const messages = await getCommunicationsByMessageId(ctx, inReplyTo);
  const partyIds = messages.reduce((acc, curr) => [...acc, ...curr.parties], []);
  logger.trace({ ctx, partyIds }, 'getPartiesForComm - inReplyTo flow');
  if (partyIds.length) return await partyRepo.loadPartiesByIds(ctx, partyIds); // if we got here by mistake (bad in replyTo field) go through normal flow
  return [];
};

const shouldUpdatePartyMetadata = (program, targetedParty) =>
  program?.metadata?.activatePaymentPlan && nullish(targetedParty?.metadata?.activatePaymentPlanDate);

const reassignPartyIfOwnerIsInactive = async (ctx, party) => {
  logger.trace({ ctx, endDate: party.endDate, partyId: party.id }, 'reassignPartyIfOwnerIsInactive');

  const teamMemberOwner = await getTeamMemberByTeamAndUser(ctx, party.ownerTeam, party.userId);
  if (teamMemberOwner && !teamMemberOwner.inactive) {
    logger.trace({ ctx, endDate: party.endDate, partyId: party.id }, 'reassignPartyIfOwnerIsInactive - no reassignment necessary');
    return;
  }
  logger.trace({ ctx, endDate: party.endDate, partyId: party.id }, 'reassignPartyIfOwnerIsInactive - inactive owner and party is closed for more than 30 days');
  await reassignPartyAndTasksForInactiveTeamMember(ctx, teamMemberOwner, party);
};
const getSelectedPartiesForComm = async (ctx, validInReplyPartiesForAddingMembers, targetContext, senderParties) =>
  (validInReplyPartiesForAddingMembers || []).length
    ? validInReplyPartiesForAddingMembers
    : await getPartiesForComm(ctx, {
        allParties: senderParties,
        propertyId:
          (targetContext.program && targetContext.program.propertyId) || (targetContext.type === CommTargetType.PARTY && senderParties[0].assignedPropertyId),
      });

export const createRawLeadFromCommIfNeeded = async (ctx, { communicationContext, personData, avoidAssigningToDispatcher, preferredPartyOwnerId }) => {
  logger.trace({ ctx, communicationContext, personData, avoidAssigningToDispatcher, preferredPartyOwnerId }, 'Create RAW LEAD - context');

  const { targetContext, senderContext, channel, category } = communicationContext;
  const teamIds = await getTeamIdsForTargetContext(ctx, targetContext);
  const senderParties = await partyRepo.loadPartiesForCommunicationByIds(ctx, senderContext.parties);
  const { leadExists, parties, transferAgentSource } = await leadAlreadyExists(ctx, communicationContext, teamIds);

  // if we have several persons that match then try to do an educated guess.
  // get last updated person having an active party
  const senderPersonId =
    senderContext.persons.find(p => parties.some(party => (party.partyMembers || []).some(pm => pm.personId === p))) || senderContext.persons[0];

  if (leadExists) {
    logger.trace({ ctx }, `Lead exists for teams ${teamIds} so a new one will NOT be created`);
    if (targetContext.program) await updatePropertyIdIfNecessary(ctx, targetContext, senderParties);

    const shouldRedirectToAllParties = await shouldRedirectToOtherParty(ctx, senderContext, targetContext, senderParties);
    const inReplyToRouting = communicationContext.inReplyTo && !shouldRedirectToAllParties;
    const partiesForInReply = inReplyToRouting && (await getPartiesForReplyComm(ctx, { communicationContext }));

    // we filter out from inReply parties the Active ones where the resident is not a member
    // if this is the case, we try to route the comm to sender parties if possible
    const isActiveLease = p => p.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE;
    const arePersonsMembersInParty = (party, persons) => (party.partyMembers || []).find(m => persons.includes(m.personId));
    const validInReplyPartiesForAddingMembers = (partiesForInReply || []).filter(p => !isActiveLease(p) || arePersonsMembersInParty(p, senderContext.persons));

    // if we got here by mistake (bad in replyTo field) go through normal flow
    const partiesForComm = parties.length ? parties : await getSelectedPartiesForComm(ctx, validInReplyPartiesForAddingMembers, targetContext, senderParties);

    const targetedParty = await getTargetedParty(ctx, partiesForComm, targetContext, senderContext.persons);
    if (targetedParty?.endDate) await reassignPartyIfOwnerIsInactive(ctx, targetedParty);

    const { fullName } = personData || {};
    const dbPerson = senderPersonId && (await getPersonById(ctx, senderPersonId));
    fullName && dbPerson && !dbPerson.fullName && (await updatePerson(ctx, senderPersonId, { fullName }));

    if (shouldUpdatePartyMetadata(targetContext.program, targetedParty)) {
      await updateParty({ ...ctx, program: targetContext.program }, { id: targetedParty.id, metadata: { activatePaymentPlan: true } });
    }

    const targetPartyMember = await getTargetPartyMember(ctx, senderContext.persons, targetedParty);
    if (!targetPartyMember) {
      return await createNewPartyMember(ctx, { personData, senderPersonId, targetedParty, teamIds });
    }

    const { id: partyMemberId, personId } = targetPartyMember;

    return {
      teamIds,
      personId,
      partyIds: partiesForComm.map(p => p.id),
      targetPartyId: targetedParty.id,
      isCloseParty: !!targetedParty.endDate,
      senderPartyMemberId: partyMemberId,
    };
  }

  logger.trace({ ctx }, `New raw lead will be created for team ids: ${teamIds}`);

  const lead = await addNewRawLead(ctx, {
    teamIds,
    channel,
    category,
    targetContext,
    personData,
    senderPersonId,
    avoidAssigningToDispatcher,
    preferredPartyOwnerId,
    transferAgentSource,
  });

  return {
    lead,
    teamIds: lead.teams,
    personId: lead.partyMembers[0].personId,
    partyIds: [lead.id],
    targetPartyId: lead.id,
    isCloseParty: false,
    senderPartyMemberId: lead.partyMembers[0].id,
  };
};
