/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniq from 'lodash/uniq';
import sortBy from 'lodash/sortBy';
import omit from 'lodash/omit';
import union from 'lodash/union';
import { mapSeries } from 'bluebird';
import orderBy from 'lodash/orderBy';

import * as partyRepo from '../dal/partyRepo';
import { getPersonById } from '../dal/personRepo';
import { removePartyFromSearch } from '../dal/searchRepo';
import { updateCommunicationEntriesForParties, removeUnreadCommunications } from '../dal/communicationRepo';
import {
  getTeamsForUser,
  getTeamsByNames,
  getTeamBy,
  getTeamMemberByTeamAndUser,
  getDispatcherId,
  getReassignableTeamMembersForInactiveTeams,
} from '../dal/teamsRepo';
import { addToBlacklist } from '../dal/blacklistRepo';
import { getUserById, getUserFullNameById, isAdminOrDispatcherAgent } from '../dal/usersRepo';
import { getActiveTasksForPartyByCategory, getTasksForPartiesByName } from '../dal/tasksRepo';
import { getPropertiesAssociatedWithTeams, getPropertyById, getPropertyTimezone, getPropertySettings } from '../dal/propertyRepo';
import { generateStrongMatches, deleteUnresolvedStrongMatches, saveMatchesDismissals } from './strongMatches';
import { addPersonsToResidentsList } from './person';
import { replacePrimaryTenant, archiveAllExternalInfoByParty, reviveAllExternalInfoByPartyId } from './externalPartyMemberInfo';
import { sendApplicationDeclinedComm } from './quotePromotions';
import { reassignActivePartyTasks, removeMemberFromTasks } from './tasks';
import { sendMessage } from './pubsub';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';
import { performPartyStateTransition } from './partyStatesTransitions';
import { logEntity, logEntityAdded } from './activityLogService';
import { DALTypes } from '../../common/enums/DALTypes';
import { getKeyByValue } from '../../common/enums/enumHelper';
import { APP_EXCHANGE, TASKS_MESSAGE_TYPE, SCREENING_MESSAGE_TYPE, PARTY_MESSAGE_TYPE } from '../helpers/message-constants';
import { ServiceError, BadRequestError } from '../common/errors';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import { runInTransaction } from '../database/factory';
import { addCommunication } from './communication';
import { tenantAdminEmail } from '../../common/helpers/database';
import { sendMessageToCancelAutomaticTaskBeforeQuotePromotion } from '../helpers/taskUtils';
import { getPartyRoutingUserId } from './routing/partyRouter';
import { CommTargetType } from './routing/targetUtils';
import { getContactInfoDiff } from '../dal/contactInfoRepo';
import { releaseManuallyHeldInventoriesByParty } from './inventories';
import {
  isCorporateParty,
  getLeaseTypeForParty,
  getPartyTypeDisabledReason,
  getNumberOfMembersOnCorporateParties,
  cannotChangePartyTypeToken,
  shouldCloseAfterMemberRemoval,
  isResident,
  isGuarantor,
  isScreeningRequired,
} from '../../common/helpers/party-utils';
import { getAllowedMemberTypes, areOccupantsAllowed } from './party-settings';
import { sendApplicantMemberTypeChangedMessage } from '../helpers/notifications';
import { getDisplayName } from '../../common/helpers/person-helper';
import * as eventService from './partyEvent';
import loggerModule from '../../common/helpers/logger';
import { toMoment, now, formatMoment } from '../../common/helpers/moment-utils';
import { getFavoriteUnitsPropertyIds } from '../helpers/party';
import * as calendar from './calendar';
import { getAvailabilitiesForDays } from './floatingAgents';
import { importActiveLeaseByPartyId } from './importActiveLeases/force-import';
const logger = loggerModule.child({ subType: 'partyService' });
import { enhanceContactInfoWithSmsInfo } from './telephony/twilio';
import { parseQualificationQuestions } from './routing/email-parser/email-parser-helper';
import { removeSpaces } from '../dal/helpers/person';
import { partyCreationAllowedTeams, AdditionalInfoTypes } from '../../common/enums/partyTypes';
import { createJob } from './jobs';
import { getTeamAndOwnerForParty } from './workflows';
import { archiveExternalInfoByPartyMemberId } from '../dal/exportRepo';
import { getTenantSettings } from './tenantService';
import { getCommsTemplateByPropertyIdAndTemplateSetting } from '../dal/commsTemplateRepo';
import { TemplateSections, TemplateActions } from '../../common/enums/templateTypes';
import { DATE_AND_TIME_US_FORMAT } from '../../common/date-constants';

const formatChildAdditionalInfo = additionalInfo => {
  // case on add
  if (additionalInfo?.type === DALTypes.AdditionalPartyMemberType.CHILD) {
    additionalInfo.info.fullName = removeSpaces(additionalInfo.info.fullName);
    additionalInfo.info.preferredName = removeSpaces(additionalInfo.info.preferredName);
  }
  // case on edit
  if (additionalInfo?.fullName) {
    additionalInfo.fullName = removeSpaces(additionalInfo.fullName);
    additionalInfo.preferredName = removeSpaces(additionalInfo.preferredName);
  }
  return additionalInfo;
};

const markCommunicationsAsReadForParties = async (ctx, partyId) => {
  const delta = {
    unread: false,
  };
  const comms = await updateCommunicationEntriesForParties(ctx, [partyId], delta);
  await removeUnreadCommunications(
    ctx,
    comms.map(c => c.id),
  );
  return comms;
};

export const sendPartyMembersInformationToScreen = async (ctx, partyId) =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SCREENING_MESSAGE_TYPE.PARTY_MEMBERS_CHANGED,
    message: {
      tenantId: ctx.tenantId,
      partyId,
    },
    ctx,
  });

export const savePartyAdditionalInfo = async (ctx, additionalInfo) => {
  const additionalInfoData = await partyRepo.savePartyAdditionalInfo(ctx, formatChildAdditionalInfo(additionalInfo));

  if (additionalInfoData.type === DALTypes.AdditionalPartyMemberType.PET && additionalInfoData.info.isServiceAnimal) {
    await eventService.saveServiceAnimalAddedEvent(ctx, { partyId: additionalInfo.partyId, userId: (ctx.authUser || {}).id });
  }

  const { partyId, type } = additionalInfo;
  notify({
    ctx,
    event: eventTypes.PARTY_UPDATED,
    data: { partyId, type },
  });
  return additionalInfoData;
};

export const getAdditionalInfoByPartyAndType = (ctx, partyId, type) => partyRepo.getAdditionalInfoByPartyAndType(ctx, partyId, type);

export const getPartyAdditionalInfo = async (ctx, additionalInfoId) => await partyRepo.getPartyAdditionalInfo(ctx, additionalInfoId);

export const deletePartyAdditionalInfo = async (ctx, additionalInfoId, partyId) => {
  const removedPartyAdditionalInfo = await partyRepo.removePartyAdditionalInfo(ctx, additionalInfoId);
  const pets = await getAdditionalInfoByPartyAndType(ctx, partyId, AdditionalInfoTypes.PET);
  const serviceAnimals = pets.some(pet => pet.info.isServiceAnimal);

  if (!serviceAnimals) {
    await eventService.saveAllServiceAnimalsRemovedEvent(ctx, { partyId, userId: (ctx.authUser || {}).id });
  }

  return removedPartyAdditionalInfo;
};

export const updatePartyAdditionalInfo = async (ctx, additionalInfoId, additionalInfo) => {
  const savedAdditionalInfo = await getPartyAdditionalInfo(ctx, additionalInfoId);
  const additionalInfoData = await partyRepo.updatePartyAdditionalInfo(ctx, additionalInfoId, formatChildAdditionalInfo(additionalInfo));

  if (
    additionalInfoData.type === DALTypes.AdditionalPartyMemberType.PET &&
    additionalInfoData.info.isServiceAnimal &&
    !savedAdditionalInfo.info.isServiceAnimal
  ) {
    await eventService.saveServiceAnimalAddedEvent(ctx, { partyId: savedAdditionalInfo.partyId, userId: (ctx.authUser || {}).id });
  }

  const pets = await getAdditionalInfoByPartyAndType(ctx, savedAdditionalInfo.partyId, AdditionalInfoTypes.PET);
  const serviceAnimals = pets.some(pet => pet.info.isServiceAnimal);

  if (!serviceAnimals) {
    await eventService.saveAllServiceAnimalsRemovedEvent(ctx, { partyId: savedAdditionalInfo.partyId, userId: (ctx.authUser || {}).id });
  }

  const { partyId, type } = additionalInfoData;
  notify({
    ctx,
    event: eventTypes.PARTY_UPDATED,
    data: { partyId, type },
  });
  return additionalInfoData;
};

export const getPartyMembersInfoByPartyAndEmailType = (ctx, partyId) => partyRepo.getPartyMembersByPartyIdAndContactInfoEmailType(ctx, partyId);

const isTeamAllowedToCreateParty = team => partyCreationAllowedTeams.includes(team?.module);

export const getTeamIdsForNewParty = async ({ ctx, teams }) => {
  const names = teams
    .filter(isTeamAllowedToCreateParty)
    .map(t => t.metadata.associatedTeamNames && t.metadata.associatedTeamNames.split(','))
    .filter(p => p)
    .reduce((acc, c) => [...acc, ...c], [])
    .map(p => p.trim())
    .filter(p => p);
  const associatedTeams = (await getTeamsByNames(ctx, names)) || [];
  logger.trace({ ctx, associatedTeams }, 'Teams that need to be associated with this party');

  const aggregatedTeams = [...teams.map(t => t.id), ...associatedTeams.map(t => t.id)];

  return [...new Set(aggregatedTeams)];
};

const validateUpdatePartyType = async (ctx, party, newLeaseType) => {
  const throwError = reason => {
    throw new ServiceError({
      token: cannotChangePartyTypeToken,
      status: 412,
      data: {
        reason,
      },
    });
  };

  const quotePromotions = (await partyRepo.loadAllQuotePromotions(ctx, party.id)) || [];
  const occupantsAllowed = await areOccupantsAllowed(ctx, newLeaseType);
  const partyTypeDisabledReason = getPartyTypeDisabledReason(party, newLeaseType, quotePromotions, occupantsAllowed);
  partyTypeDisabledReason && throwError(partyTypeDisabledReason);
};

export const archiveParty = async (ctx, { partyId, workflowName, archiveReasonId, taskCategoriesToNotCancel = [], options }) => {
  const myLogCtx = { ctx, partyId, workflowName, archiveReasonId };

  const executeArchive = async trx => {
    const innerCtx = { trx, ...ctx };
    logger.trace(myLogCtx, 'archiveParty - start');
    const { shouldCancelActiveTasks = true } = options || {};
    const archiveReasonKey = getKeyByValue(DALTypes.ArchivePartyReasons, archiveReasonId);

    const res = await partyRepo.archiveParty(innerCtx, partyId, archiveReasonKey);

    // mark as read all communications from the current party
    await markCommunicationsAsReadForParties(innerCtx, partyId);

    await logEntity(innerCtx, {
      entity: {
        id: partyId,
        status: 'Archived',
        state: res.state,
        archiveReason: archiveReasonKey,
        createdByType: DALTypes.CreatedByType.SYSTEM,
      },
      activityType: ACTIVITY_TYPES.ARCHIVE,
      component: COMPONENT_TYPES.PARTY,
      options,
    });

    if (shouldCancelActiveTasks) {
      const tenantSettings = await getTenantSettings(ctx);
      await eventService.savePartyArchivedEvent(innerCtx, { partyId, userId: (ctx.authUser || {}).id, metadata: { archiveReason: archiveReasonKey } });
      await sendMessage({
        exchange: APP_EXCHANGE,
        key: TASKS_MESSAGE_TYPE.CANCEL_ON_DEMAND,
        message: { tenantId: ctx.tenantId, partyId, authUser: ctx.authUser, tenantSettings },
        categoriesToExclude: taskCategoriesToNotCancel,
        innerCtx,
      });
    }
    logger.trace({ ...myLogCtx }, 'archiveParty - done');

    await releaseManuallyHeldInventoriesByParty(innerCtx, partyId);

    await archiveAllExternalInfoByParty(innerCtx, partyId);

    return res;
  };

  return await runInTransaction(async trx => await executeArchive(trx), ctx);
};

const sendApplicationDeniedEmail = async (ctx, partyId) => {
  const party = await partyRepo.getPartyBy(ctx, { id: partyId });
  const template = await getCommsTemplateByPropertyIdAndTemplateSetting(ctx, party.assignedPropertyId, {
    section: TemplateSections.SCREENING,
    action: TemplateActions.DECLINE_AA_LETTER,
  });

  const [quotePromotion] = await partyRepo.getQuotePromotionsByStatus(ctx, partyId, DALTypes.PromotionStatus.CANCELED);
  const senderId = quotePromotion?.modified_by || (ctx.authUser || {}).id;

  const personIds = await partyRepo.getPersonIdsbyPartyIds(ctx, [partyId], { excludeInactive: true, excludeSpam: true });

  template && (await sendApplicationDeclinedComm(ctx, { partyId, personIds, templateName: template.name, senderId }));
};

const shouldSendApplicationDeniedEmail = async (ctx, partyId, closeReasonId) => {
  const party = await partyRepo.getPartyBy(ctx, { id: partyId });
  const propertySettings = party.assignedPropertyId && (await getPropertySettings(ctx, party.assignedPropertyId));
  if (!propertySettings?.applicationReview?.sendAALetterOnDecline) return false;

  const tasks = await getTasksForPartiesByName(ctx, [partyId], DALTypes.TaskNames.CONTACT_PARTY_DECLINE_DECISION);
  const contactPartyDeclineDecisionTask = (tasks || []).filter(task => task.state !== DALTypes.TaskStates.CANCELED);

  return contactPartyDeclineDecisionTask?.length || DALTypes.ClosePartyReasons[closeReasonId] === DALTypes.ClosePartyReasons.APPLICATION_DECLINED;
};

export const closeParty = async (ctx, partyId, closeReasonId, taskCategoriesToNotCancel = []) => {
  const myLogCtx = { ctx, partyId, closeReasonId };

  const executeClose = async trx => {
    const innerCtx = { ...ctx, trx };
    logger.info(myLogCtx, 'closeParty');
    const res = await partyRepo.closeParty(innerCtx, partyId, closeReasonId);

    const shouldSendApplicationDeniedComm = await shouldSendApplicationDeniedEmail(innerCtx, partyId, closeReasonId);
    if (shouldSendApplicationDeniedComm) {
      await sendApplicationDeniedEmail(innerCtx, partyId);
    }

    if (DALTypes.ClosePartyReasons[closeReasonId] === DALTypes.ClosePartyReasons.ALREADY_A_RESIDENT) {
      logger.trace(myLogCtx, 'Close party, already a resident');
      await removePartyFromSearch(innerCtx, partyId);
      await addPersonsToResidentsList(innerCtx, partyId);
    }

    await performPartyStateTransition(innerCtx, partyId);

    // mark as read all communications from the current party
    logger.trace(myLogCtx, 'Close party, mark as read all communications from the current party');
    await markCommunicationsAsReadForParties(innerCtx, partyId);

    await logEntity(innerCtx, {
      entity: {
        id: partyId,
        status: 'Closed',
        state: res.state,
        closeReason: closeReasonId,
      },
      activityType: ACTIVITY_TYPES.CLOSE,
      component: COMPONENT_TYPES.PARTY,
    });
    const tenantSettings = await getTenantSettings(innerCtx);

    await eventService.savePartyClosedEvent(innerCtx, { partyId, userId: (ctx.authUser || {}).id, metadata: { closeReason: closeReasonId } });
    await sendMessage({
      exchange: APP_EXCHANGE,
      key: TASKS_MESSAGE_TYPE.CANCEL_ON_DEMAND,
      message: { tenantId: ctx.tenantId, partyId, authUser: ctx.authUser, tenantSettings },
      categoriesToExclude: taskCategoriesToNotCancel,
      innerCtx,
    });
    logger.info({ ...myLogCtx, closePartyResult: res }, 'closeParty complete');

    await releaseManuallyHeldInventoriesByParty(innerCtx, partyId);

    return res;
  };

  return await runInTransaction(async trx => await executeClose(trx), ctx);
};

export const removePartyMember = async req => {
  const { notes } = req.body;
  const { partyId, memberId } = req.params;

  logger.trace({ ctx: req, partyId, memberId, notes }, 'removePartyMember - input params');

  const executeRemovePartyMember = async innerCtx => {
    await partyRepo.removeGuaranteedByLink(innerCtx, partyId, memberId);
    const removedMember = await partyRepo.markMemberAsRemoved(innerCtx, memberId);
    await archiveExternalInfoByPartyMemberId(innerCtx, removedMember.id);
    const party = await partyRepo.loadParty(innerCtx, partyId);
    const tasks = await removeMemberFromTasks(innerCtx, partyId, removedMember);

    const shouldCloseParty = shouldCloseAfterMemberRemoval(party.partyMembers, removedMember);

    if (shouldCloseParty) {
      await closeParty(innerCtx, partyId, 'NO_MEMBERS');
    } else {
      await performPartyStateTransition(innerCtx, partyId);
    }
    const [partyMember] = await partyRepo.loadPartyMemberById(omit(innerCtx, ['trx']), memberId);
    await logEntity(innerCtx, { entity: { ...partyMember, notes }, activityType: ACTIVITY_TYPES.REMOVE, component: COMPONENT_TYPES.GUEST });
    await eventService.savePartyMemberRemovedEvent(innerCtx, { partyId, partyMemberId: memberId, userId: (innerCtx.authUser || {}).id });

    if (!shouldCloseParty) {
      await sendPartyMembersInformationToScreen(innerCtx, partyId);
    }
    await replacePrimaryTenant(innerCtx, { partyId, partyMembers: party.partyMembers, removedMember, propertyId: party.assignedPropertyId });

    return { member: removedMember, tasks };
  };

  const result = req.trx ? await executeRemovePartyMember(req) : await runInTransaction(async trx => await executeRemovePartyMember({ ...req, trx }));

  return result;
};

export const shouldSendMessageToCompleteContactInfo = member => member.contactInfo && !member.contactInfo.all.length;

const removeGuarantorsOnCorporateParty = async (ctx, party, partyMembers) => {
  if (!isCorporateParty(party)) return;

  const guarantors = partyMembers.filter(isGuarantor);
  logger.info({ ctx, guarantors }, 'removing guarantors from corporate party');

  await mapSeries(guarantors, async ({ id }) => {
    const removeParams = {
      ...ctx,
      params: { partyId: party.id, memberId: id },
      body: {
        notes: 'Removed by party type conversion',
      },
    };

    await removePartyMember(removeParams);
  });
};

const removeCompanyLinkFromPartyMembers = async (ctx, party, partyMembers) => {
  logger.info({ ctx, partyMembers }, 'removing company link from PartyMembers');

  await mapSeries(partyMembers, async ({ id }) => {
    await partyRepo.updatePartyMember(ctx, id, { companyId: null });
  });
};

const processTasksOnLeaseTypeChanged = async (ctx, party) => {
  if (isCorporateParty(party)) {
    logger.info({ ctx, partyId: party.id }, 'send message to cancel automatic task');
    await sendMessageToCancelAutomaticTaskBeforeQuotePromotion(ctx, party.id);
  }
};

export const closeImportedParties = async (ctx, propertyIds, activityDate) =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: PARTY_MESSAGE_TYPE.CLOSE_IMPORTED_PARTIES,
    message: {
      authUser: ctx.authUser,
      tenantId: ctx.tenantId,
      propertyIds,
      activityDate,
    },
    ctx,
  });

export const getImportedPartiesWithoutActivity = async (ctx, propertyIds, activityDate) =>
  await partyRepo.getImportedPartiesWithoutActivity(ctx, propertyIds, activityDate);

export const markAsSpam = async (ctx, partyId) => {
  const closeReasonId = 'BLOCKED_CONTACT';
  const myLogCtx = { ctx, partyId, closeReasonId };

  const result = await runInTransaction(async innerTrx => {
    logger.info(myLogCtx, 'markAsSpam');
    const innerCtx = { trx: innerTrx, ...ctx };

    const partyMembers = await partyRepo.loadPartyMembers(innerCtx, partyId);
    logger.trace({ ...myLogCtx, partyMembers }, 'markAsSpam: partyMembers');
    if (partyMembers.length > 1) throw new ServiceError({ token: 'TOO_MANY_PARTY_MEMBERS', status: 412 });
    if (partyMembers[0].contactInfo.all.length !== 1) throw new ServiceError({ token: 'TOO_MANY_CONTACT_INFO_FOR_PERSON', status: 412 });

    const contactInfo = partyMembers[0].contactInfo.all[0];
    logger.trace({ ...myLogCtx, contactInfo }, 'markAsSpam: blacklist contact');
    await addToBlacklist(innerCtx, contactInfo.type, contactInfo.value);

    logger.trace(myLogCtx, 'markAsSpam: closing party');
    const res = await partyRepo.closeParty(innerCtx, partyId, closeReasonId);

    // mark as read all communications from the current party
    logger.trace(myLogCtx, 'markAsSpam: mark as read all communications from the current party');
    await markCommunicationsAsReadForParties(innerCtx, partyId);

    logger.trace(myLogCtx, 'markAsSpam: update party state');
    await performPartyStateTransition(innerCtx, partyId);
    await logEntity(innerCtx, {
      entity: {
        id: partyId,
        status: 'Closed',
        state: res.state,
        closeReason: closeReasonId,
      },
      activityType: ACTIVITY_TYPES.CLOSE,
      component: COMPONENT_TYPES.PARTY,
    });

    const tenantSettings = await getTenantSettings(innerCtx);

    await eventService.savePartyClosedEvent(innerCtx, { partyId, userId: (ctx.authUser || {}).id, metadata: { closeReason: closeReasonId } });
    await sendMessage({
      exchange: APP_EXCHANGE,
      key: TASKS_MESSAGE_TYPE.CANCEL_ON_DEMAND,
      message: { tenantId: ctx.tenantId, partyId, authUser: ctx.authUser, tenantSettings },
      ctx: innerCtx,
    });

    return res;
  }, ctx);

  logger.info({ ...myLogCtx, closePartyResult: result }, 'markAsSpam: complete');

  return result;
};

export const loadPartyMembers = (ctx, partyId, options) => partyRepo.loadPartyMembers(ctx, partyId, options);

export const loadPersonByPartyMemberId = async ({ tenantId }, memberId) => {
  const [partyMember] = await partyRepo.loadPartyMemberById({ tenantId }, memberId);
  return getPersonById({ tenantId }, partyMember.personId);
};

export const setPartyMemberToApplicant = async (ctx, partyId, memberId) => {
  const partyMember = await partyRepo.updatePartyMember(ctx, memberId, { memberState: DALTypes.PartyStateType.APPLICANT });
  await performPartyStateTransition(ctx, partyId);

  return partyMember;
};

export const getPublishedLeaseTermsByPartyIdAndQuoteId = (ctx, { partyId, quoteId }) =>
  partyRepo.getPublishedLeaseTermsByPartyIdAndQuoteId(ctx, { partyId, quoteId });

export const loadPartyById = async (ctx, partyId) => partyRepo.loadParty(ctx, partyId);

export const loadPartiesByPartyGroupId = async (ctx, partyGroupId) => await partyRepo.getPartiesByPartyGroupId(ctx, partyGroupId);

export const existsPersonInParty = async (tenantId, partyId, personId) => {
  const result = await partyRepo.getActivePartyMemberByPartyIdAndPersonId({ tenantId }, partyId, personId);
  return !!result;
};

export const getActivePartyMemberByPartyIdAndPersonId = async (ctx, partyId, personId) =>
  await partyRepo.getActivePartyMemberByPartyIdAndPersonId(ctx, partyId, personId);

export const validateMemberType = async (ctx, partyMember, partyId) => {
  const partyTypesAllowed = await getAllowedMemberTypes(ctx, partyId);
  const isMemberTypeAllowed = partyTypesAllowed.some(type => partyMember.memberType === type);
  if (isMemberTypeAllowed) return;
  throw new BadRequestError({ token: 'INVALID_MEMBER_TYPE_FOR_PARTY' });
};

const validatePartyMember = async (ctx, partyMember, partyId) => {
  await validateMemberType(ctx, partyMember, partyId);

  if (await partyRepo.isCorporateLeaseType(ctx, partyId)) {
    const partyMembers = await partyRepo.loadPartyMembers(ctx, partyId);
    const occupantsAllowed = await areOccupantsAllowed(ctx, DALTypes.PartyTypes.CORPORATE);
    const pointOfContactLength = getNumberOfMembersOnCorporateParties(partyMembers, occupantsAllowed);
    if (pointOfContactLength === 1 && isResident(partyMember)) throw new ServiceError({ token: 'ADD_PARTY_MEMBER_NOT_ALLOWED', status: 412 });
  }

  // check to see if we already have the person added to the party
  if (partyMember.personId) {
    const personAlreadyExistsInParty = await existsPersonInParty(ctx.tenantId, partyId, partyMember.personId);
    if (personAlreadyExistsInParty) throw new BadRequestError({ token: 'ADD_PARTY_MEMBER_DUPLICATE_PERSON' });
  }
  return true;
};

const updateMember = async (ctx, partyMemberId, partyMember) => {
  if (partyMember.contactInfo) {
    partyMember.contactInfo.all = await enhanceContactInfoWithSmsInfo(ctx, partyMember.contactInfo.all);
  }

  return await partyRepo.updatePartyMember(ctx, partyMemberId, partyMember);
};

const handleAddPartyMember = async (ctx, partyMember, partyId) => {
  await validatePartyMember(ctx, partyMember, partyId);
  if (partyMember.contactInfo) {
    partyMember.contactInfo.all = await enhanceContactInfoWithSmsInfo(ctx, partyMember.contactInfo.all);
  }
  const member = await partyRepo.createPartyMember(ctx, partyMember, partyId);
  if (!partyMember.personId) await generateStrongMatches(ctx, member.contactInfo.all, member.personId);

  await saveMatchesDismissals(ctx, partyMember.personId || member.personId, partyMember.dismissedMatches);
  await logEntityAdded(ctx, { entity: member, component: COMPONENT_TYPES.GUEST });
  await eventService.savePartyMemberAddedEvent(ctx, { partyId, userId: (ctx.authUser || {}).id, partyMemberId: member.id });

  await sendPartyMembersInformationToScreen(ctx, partyId);

  partyMember.personId && (await performPartyStateTransition(ctx, partyId));

  return member;
};

export const addPartyMember = async (ctx, partyMember, partyId) => {
  logger.trace({ ctx, partyId, partyMember }, 'addPartyMember');
  return await runInTransaction(async trx => await handleAddPartyMember({ ...ctx, trx }, partyMember, partyId), ctx);
};

const saveContactEvent = async (ctx, party, partyMember) => {
  const timezone = await getPropertyTimezone(ctx, party.assignedPropertyId);
  const nowDate = now({ timezone });
  const roundedNow = nowDate.minute() >= 30 ? nowDate.startOf('hour').add(30, 'm') : nowDate.startOf('hour');

  await addCommunication({
    ...ctx,
    body: {
      type: DALTypes.CommunicationMessageType.CONTACTEVENT,
      recipients: [partyMember.personId],
      partyId: party.id,
      message: {
        text: '',
        type: party.metadata.firstContactChannel,
        eventDateTime: roundedNow.toJSON(),
      },
      contactEventType: party.metadata.firstContactChannel,
      names: getDisplayName(partyMember),
    },
  });
};

export const createParty = async (ctx, { member, saveInitialContactEvent, company, ...party } = {}) =>
  await runInTransaction(async trx => {
    logger.info({ ctx, party, member, saveInitialContactEvent }, 'create party');
    const trxCtx = { ...ctx, trx };
    const userId = party.userId || ctx.authUser.id;

    const teamsForUser = userId ? await getTeamsForUser(trxCtx, userId) : [];
    const teams = party.ownerTeam ? [party.ownerTeam] : await getTeamIdsForNewParty({ ctx: trxCtx, teams: teamsForUser });
    const assignedPropertyId = party.assignedPropertyId || (await partyRepo.getAssignedPropertyIdForParty(trxCtx, teams));
    const partyProperty = assignedPropertyId && (await getPropertyById(trxCtx, assignedPropertyId));
    const ownerTeamId = teams[0];
    const partyOwnerTeam = ownerTeamId && (await getTeamBy(trxCtx, { id: ownerTeamId }));

    if (partyOwnerTeam && !isTeamAllowedToCreateParty(partyOwnerTeam)) {
      logger.error({ ctx, teamId: partyOwnerTeam.id, module: partyOwnerTeam.module }, 'Team not allowed to create party');
      throw new ServiceError({
        token: 'TEAM_NOT_ALLOWED_TO_CREATE_PARTY',
        status: 412,
      });
    }

    const payload = {
      userId,
      assignedPropertyId,
      score: DALTypes.LeadScore.PROSPECT,
      teams,
      ...party,
      leaseType: getLeaseTypeForParty(party),
    };

    const newParty = await partyRepo.createParty(trxCtx, payload);
    const createdCompany = company && company.companyName && !company.companyId && (await partyRepo.createCompany(trxCtx, company.companyName));

    await performPartyStateTransition(trxCtx, newParty.id);
    await logEntityAdded(trxCtx, {
      entity: {
        ...newParty,
        propertyDisplayName: partyProperty?.displayName,
        ownerTeamDisplayName: partyOwnerTeam?.displayName,
        partyOwner: userId && (await getUserFullNameById(trxCtx, userId)),
      },
      component: COMPONENT_TYPES.PARTY,
    });
    await eventService.savePartyCreatedEvent(trxCtx, { partyId: newParty.id, userId });
    let partyMember = member;
    if (member) {
      partyMember = await handleAddPartyMember(trxCtx, { ...member, companyId: company?.companyId || createdCompany?.id }, newParty.id);
    }
    if (saveInitialContactEvent) await saveContactEvent(trxCtx, newParty, partyMember);
    return newParty;
  }, ctx);

const getMemberTypeChangedInfo = async (ctx, memberId, memberType) => {
  if (!memberType) return { changed: false };

  const [oldPartyMember] = await partyRepo.loadPartyMemberById(ctx, memberId);
  const memberTypeChanged = memberType !== oldPartyMember.memberType;
  const changedFromGuarantor = memberTypeChanged && isGuarantor(oldPartyMember) && !isGuarantor(memberType);

  return {
    partyId: oldPartyMember.partyId,
    memberTypeChanged,
    removeGuaranteedByLink: memberTypeChanged && !isGuarantor(oldPartyMember),
    removeGuarantees: changedFromGuarantor,
  };
};

export const updatePartyMember = async (ctx, memberId, partyMember) => {
  logger.trace({ ctx, memberId, partyMember }, 'updatePartyMember - params');

  const updatedPartyMember = await runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };
    let contactInfoDiff;

    if (partyMember.contactInfo) {
      contactInfoDiff = await getContactInfoDiff(innerCtx, partyMember.contactInfo.all, partyMember.personId);
    }

    const { partyId, memberTypeChanged, removeGuaranteedByLink, removeGuarantees } = await getMemberTypeChangedInfo(ctx, memberId, partyMember.memberType);
    removeGuaranteedByLink && Object.assign(partyMember, { guaranteedBy: null });

    removeGuarantees && (await partyRepo.removeGuaranteedByLink(innerCtx, partyId, memberId));
    const member = await updateMember(innerCtx, memberId, partyMember);
    await eventService.savePartyMemberUpdatedEvent(innerCtx, { partyId, userId: (ctx.authUser || {}).id, partyMemberId: memberId });

    if (memberTypeChanged) {
      await sendApplicantMemberTypeChangedMessage(innerCtx, member.partyId);
      await notify({
        ctx: innerCtx,
        event: eventTypes.PARTY_DETAILS_UPDATED,
        data: { partyId: member.partyId },
      });
      await eventService.savePartyMemberTypeUpdatedEvent(innerCtx, {
        partyId,
        userId: (ctx.authUser || {}).id,
        partyMemberId: memberId,
        metadata: { memberType: member.memberType },
      });
    }

    if (memberTypeChanged && member.memberType === DALTypes.MemberType.GUARANTOR) {
      const party = await loadPartyById(innerCtx, partyId);
      await replacePrimaryTenant(innerCtx, {
        partyId: party.id,
        partyMembers: party.partyMembers,
        removedMember: member,
        propertyId: party.assignedPropertyId,
      });
    }

    if (contactInfoDiff) {
      await generateStrongMatches(innerCtx, contactInfoDiff.itemsToSave, partyMember.personId);
      await deleteUnresolvedStrongMatches(innerCtx, contactInfoDiff.itemsToDelete);
    }

    return member;
  }, ctx);

  logger.trace({ ctx, updatedPartyMember }, 'updatePartyMember - updatedPartyMember');

  return updatedPartyMember;
};

export const loadPartyAgent = partyRepo.loadPartyAgent;

export const updateAssignedProperty = async (ctx, partyId, propertyId) => {
  logger.info({ ctx, partyId, propertyId }, 'updateAssignedProperty');

  const party = await loadPartyById(ctx, partyId);
  const prevPropertyId = party.assignedPropertyId;

  const result = await partyRepo.updateParty(ctx, { id: partyId, assignedPropertyId: propertyId });

  if (propertyId !== prevPropertyId) {
    await eventService.savePartyReassignedPropertyEvent(ctx, {
      partyId: result.id,
      metadata: {
        prevPropertyId,
        propertyId,
      },
    });
  }

  return result;
};

const isFirstLeasingTeamAssignment = async (ctx, agentId, prevAgentId) => {
  if (prevAgentId && !(await isAdminOrDispatcherAgent(ctx, prevAgentId, { excludeAdmin: true }))) return false;

  return !(await isAdminOrDispatcherAgent(ctx, agentId));
};

export const updateOwner = async (ctx, party, newOwnerId) => {
  logger.trace({ ctx, partyId: party.id, newOwnerId }, 'updateOwner');
  const prevOwnerTeamId = party.ownerTeam;

  const delta = {
    id: party.id,
    userId: newOwnerId,
  };

  const updatedParty = await partyRepo.updateParty(ctx, delta);
  await partyRepo.updatePartyCollaborators(ctx, party.id, [newOwnerId]);

  const newPrimaryAgentName = (await getUserById(ctx, newOwnerId)).fullName;
  const previousPrimaryAgentName = party.userId ? (await getUserById(ctx, party.userId)).fullName : '';

  if (!updatedParty.metadata?.firstCollaborator && (await isFirstLeasingTeamAssignment(ctx, newOwnerId, party.userId))) {
    await partyRepo.saveMetadata(ctx, party.id, { firstCollaborator: newOwnerId });
  }
  await logEntity(ctx, {
    entity: { partyId: party.id, newPrimaryAgentName, previousPrimaryAgentName },
    activityType: ACTIVITY_TYPES.UPDATE,
    component: COMPONENT_TYPES.LEASINGTEAM,
  });
  await eventService.savePartyOwnerChanged(ctx, {
    partyId: party.id,
    userId: (ctx.authUser || {}).id,
    metadata: {
      previousOwner: party.userId,
      previousTeam: party.ownerTeam,
      newOwner: newOwnerId,
      newOwnerTeam: updatedParty.ownerTeam,
    },
  });

  const newOwnerTeamId = updatedParty.ownerTeam;
  const teams = uniq([prevOwnerTeamId, newOwnerTeamId]);
  await notify({
    ctx,
    event: eventTypes.PARTY_UPDATED,
    data: { partyId: party.id },
    routing: { teams },
  });
};

export const linkPartyMember = async (ctx, partyId, partyMemberId, linkedPartyMemberIds) => {
  const [partyMember] = await partyRepo.loadPartyMemberById(ctx, partyMemberId);
  const { teams } = await partyRepo.loadPartyById(ctx, partyId);
  const partyEvents = [];
  const eventInfo = {
    partyId,
    userId: (ctx.authUser || {}).id,
  };

  if (isGuarantor(partyMember)) {
    const partyMembers = await partyRepo.loadPartyMembers(ctx, partyId);
    const currentLinkedMembers = partyMembers.filter(member => member.guaranteedBy === partyMember.id);

    const membersToUnlink = currentLinkedMembers.filter(member => linkedPartyMemberIds.indexOf(member.id) < 0);
    const membersToLink = partyMembers.filter(member => linkedPartyMemberIds.indexOf(member.id) >= 0);

    const updatedPartyMembers = await Promise.all(
      membersToLink.map(async member => {
        member.guaranteedBy = partyMember.id;
        partyEvents.push({ ...eventInfo, partyMemberId: member.id, metadata: { guaranteedBy: partyMember.id } });

        return await updateMember(ctx, member.id, member);
      }),
    );
    await Promise.all(
      membersToUnlink.map(async member => {
        member.guaranteedBy = null;
        partyEvents.push({ ...eventInfo, partyMemberId: member.id, metadata: { guaranteedBy: null } });
        return await updateMember(ctx, member.id, member);
      }),
    );
    await sendPartyMembersInformationToScreen(ctx, partyMember.partyId);
    await mapSeries(partyEvents, async event => {
      await eventService.savePartyMemberUpdatedEvent(ctx, event);
      await eventService.savePartyMemberLinkedEvent(ctx, event);
    });
    notify({
      ctx,
      event: eventTypes.PARTY_DETAILS_UPDATED,
      data: { partyId },
      routing: { teams },
    });
    return updatedPartyMembers;
  }
  const [guarantorId] = linkedPartyMemberIds;
  partyMember.guaranteedBy = guarantorId ? guarantorId : null; // eslint-disable-line no-unneeded-ternary
  const updatedPartyMember = await updateMember(ctx, partyMember.id, partyMember);
  await sendPartyMembersInformationToScreen(ctx, partyMember.partyId);
  await eventService.savePartyMemberUpdatedEvent(ctx, { ...eventInfo, partyMemberId: partyMember.id, metadata: { guranteedBy: partyMember.guaranteedBy } });
  await eventService.savePartyMemberLinkedEvent(ctx, { ...eventInfo, partyMemberId: partyMember.id, metadata: { guranteedBy: partyMember.guaranteedBy } });
  notify({
    ctx,
    event: eventTypes.PARTY_DETAILS_UPDATED,
    data: { partyId },
    routing: { teams },
  });
  return updatedPartyMember;
};

const getAppointmentDates = appointments => {
  const endDates = (appointments || []).map(item => item.metadata.endDate);
  const maxEndDate = sortBy(endDates, item => -toMoment(item).utc())[0];

  const startDates = (appointments || []).map(item => item.metadata.startDate);
  const minStartDate = sortBy(startDates, item => toMoment(item).utc())[0];

  // added an extra 2 days to the days we are selecting beucause the diff function returns the full day difference between two days
  // example : in case end date is 13.07.2018 01:50 and start date is 12.07.2018 23:50, the function returns 0 days, but we acutally want 2 days
  const noOfDays = toMoment(maxEndDate).diff(toMoment(minStartDate), 'days') + 2;
  const allDays = union(
    startDates.map(d => toMoment(d).startOf('day').toISOString()),
    endDates.map(d => toMoment(d).startOf('day').toISOString()),
  );

  return { startDate: minStartDate, endDate: maxEndDate, noOfDays, allDays };
};

export const getOverlappingAppointments = async (req, { party, userId, teamId }) => {
  const category = DALTypes.TaskCategories.APPOINTMENT;
  const partyActiveAppointments = await getActiveTasksForPartyByCategory(req, party.id, category);

  if (!partyActiveAppointments.length) return [];

  const partyOwnerActiveAppointments = partyActiveAppointments.filter(t => t.userIds.indexOf(party.userId) >= 0);
  if (partyOwnerActiveAppointments.length === 0) return [];

  const dateInterval = await getAppointmentDates(partyOwnerActiveAppointments);
  const toUserAndTeamEvents = await calendar.getCalendarEventsForNewOwner(req, {
    userId,
    teamId,
    startDate: dateInterval.startDate,
    noOfDays: dateInterval.noOfDays,
  });

  const floatingAgentAvailabilities = await getAvailabilitiesForDays(req, { userId, teamId, dateInterval });
  return calendar.getOverlappingAppointments(partyOwnerActiveAppointments, toUserAndTeamEvents, floatingAgentAvailabilities);
};

const getOverlappingAppointmentIds = async (...args) => (await getOverlappingAppointments(...args)).map(a => a.id);

const validateNewPartyOwner = async (req, { party, userId, teamId }) => {
  const overlappingAppointments = await getOverlappingAppointmentIds(req, { party, userId, teamId });

  if (overlappingAppointments.length) {
    throw new ServiceError({
      token: 'APPOINTMENTS_CONFLICT',
      status: 412,
      data: {
        appointmentIds: overlappingAppointments,
      },
    });
  }
};

const getNewPartyOwner = async (req, party, teamId) => {
  let overlappingAppointments;
  let verifiedUsers = [];
  let targetUserId;

  const getNextUser = async () => {
    const team = await getTeamBy(req, { id: teamId });
    return await getPartyRoutingUserId(req, { targetContext: { type: CommTargetType.TEAM }, team });
  };

  do {
    targetUserId = await getNextUser();
    if (verifiedUsers.includes(targetUserId)) break;
    verifiedUsers = [...verifiedUsers, targetUserId];

    // skip the current party owner
    if (targetUserId === party.userId) {
      targetUserId = await getNextUser();
      verifiedUsers = [...verifiedUsers, targetUserId];
    }

    overlappingAppointments = await getOverlappingAppointmentIds(req, { party, userId: targetUserId, teamId });
  } while (overlappingAppointments.length);

  if (overlappingAppointments && overlappingAppointments.length) {
    throw new ServiceError({
      token: 'APPOINTMENTS_CONFLICT',
      status: 412,
      data: {
        appointmentIds: overlappingAppointments,
      },
    });
  }

  return targetUserId;
};

const getAssignedPropertyForReassignParty = async (ctx, teamId, currentAssignedPropertyId, currentPartyWorkflowName) => {
  const properties = await getPropertiesAssociatedWithTeams(ctx, [teamId]);

  const property = properties.find(p => p.id === currentAssignedPropertyId);

  if ([DALTypes.WorkflowName.ACTIVE_LEASE, DALTypes.WorkflowName.RENEWAL].includes(currentPartyWorkflowName)) return currentAssignedPropertyId;
  if (property) return currentAssignedPropertyId;
  if (properties.length === 1) return properties[0].id;
  if (properties.length > 1) return null;
  return currentAssignedPropertyId;
};

export const getAssignPartyToUserDelta = async (ctx, party, toUserId, toTeamId, checkConflictingAppointments) => {
  checkConflictingAppointments && (await validateNewPartyOwner(ctx, { party, userId: toUserId, teamId: toTeamId }));

  const assignedTeamId = toTeamId || party.ownerTeam;
  const assignedPropertyId = await getAssignedPropertyForReassignParty(ctx, assignedTeamId, party.assignedPropertyId, party.workflowName);
  const teams = [...new Set([...party.teams, assignedTeamId])];

  return {
    userId: toUserId,
    collaborators: [...new Set([...party.collaborators, party.userId, toUserId])],
    teams,
    ownerTeam: assignedTeamId,
    assignedPropertyId,
  };
};

export const getAssignPartyToTeamDelta = async (ctx, party, toTeamId) => {
  const newUserId = await getNewPartyOwner(ctx, party, toTeamId);

  return {
    userId: newUserId,
    collaborators: [...new Set([...party.collaborators, party.userId, newUserId])],
    teams: [...new Set([...party.teams, toTeamId])],
    ownerTeam: toTeamId,
  };
};

const getAssignPartyDelta = async (ctx, party, to, checkConflictingAppointments) => {
  const result = to.userId
    ? await getAssignPartyToUserDelta(ctx, party, to.userId, to.teamId, checkConflictingAppointments)
    : await getAssignPartyToTeamDelta(ctx, party, to.teamId);
  return result;
};

export const addTransferReasonActivityLogAndComm = async (ctx, party, reassignReason) => {
  logger.trace({ ctx, partyId: party?.id, reassignReason }, 'addTransferReasonActivityLogAndComm');
  const timezone = await getPropertyTimezone(ctx, party.assignedPropertyId);
  const nowDate = now({ timezone });
  const nowDateAndTimeUSFormat = formatMoment(nowDate, { timezone, format: DATE_AND_TIME_US_FORMAT });
  const roundedNow = nowDate.minute() >= 30 ? nowDate.startOf('hour').add(30, 'm') : nowDate.startOf('hour');
  const partyMembersNames = party.partyMembers.map(member => member.fullName);

  await logEntity(ctx, {
    entity: {
      partyId: party.id,
      participants: partyMembersNames,
      type: DALTypes.ContactEventTypes.OTHER,
      notes: reassignReason,
      date: nowDateAndTimeUSFormat,
    },
    activityType: ACTIVITY_TYPES.NEW,
    component: COMPONENT_TYPES.CONTACT_EVENT,
  });

  await addCommunication({
    ...ctx,
    body: {
      type: DALTypes.CommunicationMessageType.CONTACTEVENT,
      recipients: party.partyMembers.map(member => member.personId),
      partyId: party.id,
      message: {
        text: reassignReason,
        type: DALTypes.ContactEventTypes.OTHER,
        eventDateTime: roundedNow.toJSON(),
      },
      contactEventType: DALTypes.ContactEventTypes.OTHER,
      names: partyMembersNames.join(','),
    },
  });
};

export const assignParty = async (ctx, party, to, checkConflictingAppointments, reassignReason, fromExcelImport = false) => {
  logger.trace({ ctx, partyId: party.id, toData: to, checkConflictingAppointments, reassignReason }, 'assignParty');

  const requestNotFromAdminTemplateSchema = ctx.authUser && ctx.authUser.email ? ctx.authUser.email !== tenantAdminEmail : false;

  const previousOwner = party.userId;
  const prevOwnerTeamId = party.ownerTeam;

  if (!party.collaborators.includes(party.userId)) party.collaborators.push(party.userId);

  const assignPartyDelta = await getAssignPartyDelta(ctx, party, to, checkConflictingAppointments);

  const result = await partyRepo.updateParty(ctx, { id: party.id, ...assignPartyDelta });

  // reassign party tasks to the new owner
  await reassignActivePartyTasks(ctx, party.id, previousOwner, assignPartyDelta.userId, assignPartyDelta.ownerTeam);

  // eslint-disable-next-line global-require
  const { reassignCountersignerSignatureStatuses } = require('./leases/leaseService');

  await reassignCountersignerSignatureStatuses(ctx, party.id, party.userId);

  const newPrimaryAgentName = (await getUserById(ctx, result.userId)).fullName;
  const previousPrimaryAgentName = (await getUserById(ctx, previousOwner)).fullName;

  if (!result.metadata?.firstCollaborator && (await isFirstLeasingTeamAssignment(ctx, result.userId, previousOwner))) {
    await partyRepo.saveMetadata(ctx, party.id, { firstCollaborator: result.userId });
  }
  await logEntity(ctx, {
    entity: {
      partyId: party.id,
      newPrimaryAgentName,
      previousPrimaryAgentName,
      isAdminUser: fromExcelImport,
      createdByType: requestNotFromAdminTemplateSchema ? DALTypes.CreatedByType.USER : DALTypes.CreatedByType.SYSTEM,
    },
    activityType: ACTIVITY_TYPES.UPDATE,
    component: COMPONENT_TYPES.LEASINGTEAM,
  });

  const newOwnerTeamId = result.ownerTeam;
  await eventService.savePartyOwnerChanged(ctx, {
    partyId: party.id,
    userId: (ctx.authUser || {}).id,
    metadata: {
      previousOwner,
      previousTeam: prevOwnerTeamId,
      newOwner: result.userId,
      newOwnerTeam: newOwnerTeamId,
    },
  });

  const primaryPropertyChanged = result.assignedPropertyId && result.assignedPropertyId !== party.assignedPropertyId;
  if (primaryPropertyChanged) {
    await eventService.savePartyReassignedPropertyEvent(ctx, {
      partyId: result.id,
      metadata: {
        prevPropertyId: party.assignedPropertyId,
        propertyId: result.assignedPropertyId,
      },
    });

    const { displayName: propertyName } = await getPropertyById(ctx, result.assignedPropertyId);
    const { displayName: teamName } = await getTeamBy(ctx, { id: newOwnerTeamId });
    await logEntity(ctx, {
      entity: {
        id: party.id,
        primaryProperty: propertyName,
        reason: `Owner ${newPrimaryAgentName} belongs to ${teamName} team`,
      },
      activityType: ACTIVITY_TYPES.UPDATE,
      component: COMPONENT_TYPES.PARTY,
    });
  }

  reassignReason && (await addTransferReasonActivityLogAndComm(ctx, party, reassignReason));

  const teams = uniq([prevOwnerTeamId, newOwnerTeamId]);

  await notify({
    ctx,
    event: eventTypes.PARTY_ASSIGNED,
    data: { partyId: result.id },
    routing: { teams },
  });

  return result;
};

export const updateParty = async (ctx, party) => {
  const oldParty = await partyRepo.loadParty(ctx, party.id);
  const partyPropertyIds = oldParty.storedUnitsFilters?.propertyIds ? [...oldParty.storedUnitsFilters?.propertyIds] : [];

  if (party.metadata?.activatePaymentPlan) {
    if (oldParty.metadata?.activatePaymentPlanDate) {
      logger.error({ ctx, partyId: party.id }, 'Can not deactivate payment plan');
    } else {
      const timezone = await getPropertyTimezone(ctx, oldParty.assignedPropertyId);
      party.metadata.activatePaymentPlanDate = now({ timezone }).toJSON();
    }

    const { activatePaymentPlan, ...newMetadata } = party.metadata;
    party.metadata = newMetadata;
  }

  const leaseType = getLeaseTypeForParty(party, oldParty.leaseType);
  const leaseTypeChanged = oldParty.leaseType !== leaseType;
  const primaryPropertyChanged = party.assignedPropertyId && party.assignedPropertyId !== oldParty.assignedPropertyId;

  if (
    party.qualificationQuestions &&
    oldParty.workflowName === DALTypes.WorkflowName.RENEWAL &&
    oldParty.qualificationQuestions?.groupProfile !== party.qualificationQuestions?.groupProfile
  ) {
    const activeLeaseId = await partyRepo.getActiveLeaseIdByRenewalPartyId(ctx, party.id);
    await partyRepo.updateLeaseTypeQuestionForActiveLease(ctx, activeLeaseId, party.qualificationQuestions.groupProfile);
  }

  if (primaryPropertyChanged) {
    partyPropertyIds.push(party.assignedPropertyId);
    const { displayName: propertyName } = await getPropertyById(ctx, party.assignedPropertyId);
    await logEntity(ctx, {
      entity: {
        id: party.id,
        primaryPropertyUpdated: propertyName,
      },
      activityType: ACTIVITY_TYPES.UPDATE,
      component: COMPONENT_TYPES.PARTY,
    });

    await eventService.savePartyReassignedPropertyEvent(ctx, {
      partyId: party.id,
      metadata: {
        prevPropertyId: oldParty.assignedPropertyId,
        propertyId: party.assignedPropertyId,
      },
    });
  }

  logger.info({ ctx, leaseTypeChanged, leaseType, partyId: party?.id }, 'updating party');
  leaseTypeChanged && (await validateUpdatePartyType(ctx, oldParty, leaseType));

  const hasQualQuestionsCompleted = oldParty.metadata && oldParty.metadata.qualQuestionsCompleted;

  if (!hasQualQuestionsCompleted && party.qualificationQuestions) {
    party.metadata = {
      ...party.metadata,
      qualQuestionsCompleted: now().toJSON(),
    };
  }

  const partyMembers = await partyRepo.loadPartyMembers(ctx, party.id);
  const updatedParty = await runInTransaction(async innerTrx => {
    const innerCtx = { ...ctx, trx: innerTrx };
    const innerUpdatedParty = await partyRepo.updateParty(innerCtx, {
      ...party,
      ...(primaryPropertyChanged && { storedUnitsFilters: { ...oldParty.storedUnitsFilters, propertyIds: partyPropertyIds } }),
      ...((leaseTypeChanged && { leaseType }) || {}),
    });

    if (party.metadata?.activatePaymentPlanDate) {
      const { program } = ctx;
      program && (await assignParty(innerCtx, innerUpdatedParty, { teamId: program.teamId }));
      await logEntity(innerCtx, {
        entity: {
          id: party.id,
          programDisplayName: program?.displayName,
          createdByType: program ? DALTypes.CreatedByType.SYSTEM : DALTypes.CreatedByType.USER,
        },
        activityType: ACTIVITY_TYPES.SET_FLAG,
        component: COMPONENT_TYPES.PARTY,
      });
    }

    leaseTypeChanged && (await removeGuarantorsOnCorporateParty(innerCtx, innerUpdatedParty, partyMembers));
    leaseTypeChanged && isCorporateParty(oldParty) && (await removeCompanyLinkFromPartyMembers(innerCtx, innerUpdatedParty, partyMembers));
    // the following is done this way to break the circular dependency issue
    const { addPartyContactEvent } = require('./communication'); // eslint-disable-line global-require
    await addPartyContactEvent(innerCtx, innerUpdatedParty);

    const newState = await performPartyStateTransition(innerCtx, innerUpdatedParty.id);

    const userId = ctx.authUser?.id || party.userId;
    await eventService.savePartyUpdatedEvent(innerCtx, { partyId: party.id, userId, metadata: { leaseType, handlePromoteApplicationTask: leaseTypeChanged } });

    if (leaseTypeChanged) {
      await notify({
        ctx: innerCtx,
        event: eventTypes.PARTY_UPDATED,
        data: { partyId: party.id },
      });
      await processTasksOnLeaseTypeChanged(innerCtx, innerUpdatedParty);
      logger.info({ ctx, partyId: innerUpdatedParty.id, newLeaseType: leaseType, oldLeaseType: oldParty.leaseType }, 'lease type changed');
    }
    const favoriteUnitsPropertyIds = await getFavoriteUnitsPropertyIds(innerCtx, innerUpdatedParty);
    const isCorporate = isCorporateParty(innerUpdatedParty);
    return {
      ...innerUpdatedParty,
      favoriteUnitsPropertyIds,
      state: newState,
      screeningRequired: isScreeningRequired(isCorporate, innerUpdatedParty.workflowName),
    };
  });
  logger.info({ ctx, partyId: updatedParty.id, leaseTypeChanged }, 'updated party');
  return updatedParty;
};

const teamIsInactive = async (ctx, party) => {
  const team = await getTeamBy(ctx, { id: party.ownerTeam });
  return team?.endDate;
};

const ownerIsInactive = async (ctx, party) => {
  const teamMember = await getTeamMemberByTeamAndUser(ctx, party.ownerTeam, party.userId);
  return teamMember?.inactive;
};

const shouldCreateContactPartyDeclinedDecisionTask = async (ctx, partyId) => {
  const tasks = await getTasksForPartiesByName(ctx, [partyId], DALTypes.TaskNames.CONTACT_PARTY_DECLINE_DECISION);
  const quotePromotions = await partyRepo.loadAllQuotePromotions(ctx, partyId);

  return (
    !tasks?.length && quotePromotions?.length && quotePromotions.every(quotePromotion => quotePromotion.promotionStatus === DALTypes.PromotionStatus.CANCELED)
  );
};

export const reopenParty = async (ctx, partyId) => {
  logger.info({ ctx, partyId }, 'reopenParty');

  await importActiveLeaseByPartyId(ctx, partyId);

  const result = await runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };
    const party = await partyRepo.openParty(innerCtx, partyId);

    const isTeamInactive = await teamIsInactive(innerCtx, party);
    const isOwnerInactive = await ownerIsInactive(innerCtx, party);

    // if the original team is active but the owner is inactive change the owner to the dispatcher of the team
    if (!isTeamInactive && isOwnerInactive) {
      logger.info({ ctx: innerCtx }, 'reopenParty - original owner is active but the original owner is inactive -> reassigning party to Dispatcher');
      const newOwnerId = await getDispatcherId(innerCtx, party.ownerTeam);

      await assignParty(innerCtx, party, { userId: newOwnerId });
    }
    // if the original team is inactive, move the party to the first active leasing team or resident service team for the property
    if (isTeamInactive) {
      logger.info({ ctx: innerCtx }, 'reopenParty - original team is inactive -> reassigning party to an active team');
      const { userId, ownerTeam } = await getTeamAndOwnerForParty(innerCtx, party, party.workflowName);
      await assignParty(innerCtx, { ...party, ownerTeam }, { userId, teamId: ownerTeam });
    }

    const newPartyState = await performPartyStateTransition(innerCtx, partyId);

    await logEntity(innerCtx, {
      entity: {
        id: partyId,
        status: getKeyByValue(DALTypes.PartyStateType, newPartyState),
        state: party.state,
      },
      activityType: ACTIVITY_TYPES.UPDATE,
      component: COMPONENT_TYPES.PARTY,
    });

    const shouldCreateDeclinedTask = await shouldCreateContactPartyDeclinedDecisionTask(ctx, partyId);
    await eventService.savePartyReopenedEvent(innerCtx, {
      partyId,
      userId: (ctx.authUser || {}).id,
      metadata: { createDeclinedTask: shouldCreateDeclinedTask },
    });
    return party;
  }, ctx);

  logger.info({ ctx, partyId, reopenPartyResultId: result?.id }, 'reopenParty complete');
  return result;
};

export const reopenPartyIfNeeded = async (ctx, partyId) => {
  const party = await partyRepo.getPartyBy(ctx, { id: partyId });
  const partyCloseReason = DALTypes.ClosePartyReasons[party.metadata.closeReasonId];
  if (partyCloseReason) return await reopenParty(ctx, partyId);
  return party;
};
export const updatePartyOwnerAfterCall = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'updatePartyOwnerAfterCall');

  const party = await partyRepo.loadParty(ctx, partyId);
  if (party.userId) return party.userId;

  const [teamId] = party.teams;
  const team = await getTeamBy(ctx, { id: teamId });
  const routedOwnerId = await getPartyRoutingUserId(ctx, { targetContext: { type: CommTargetType.TEAM }, team });
  await updateOwner(ctx, party, routedOwnerId);
  return routedOwnerId;
};

export const isCorporateLeaseType = async (ctx, partyId) => await partyRepo.isCorporateLeaseType(ctx, partyId);

export const getPartyById = async (ctx, partyId) => await partyRepo.loadPartyById(ctx, partyId);

export const getPartyMembersByPersonId = async (ctx, personId) => await partyRepo.getPartyMembersByPersonIds(ctx, [personId], false);

export const getActivePartyIdsByPersonId = async (ctx, personId) => await partyRepo.getActivePartyIdsByPersonId(ctx, personId);

export const isPartyClosed = async (ctx, partyId) => await partyRepo.isPartyClosed(ctx, partyId);

export const getPartyMemberByPartyIdAndPersonId = async (ctx, partyId, personId) => await partyRepo.getPartyMemberByPartyIdAndPersonId(ctx, partyId, personId);

export const getPartyMembersById = async (ctx, partyMembersId) => await partyRepo.getPartyMembersById(ctx, partyMembersId);

export const updatePreferencesByPartyId = async (ctx, partyId, preferences) => {
  if (!preferences || !partyId) {
    logger.error({ ...ctx, partyId, preferences }, 'Missing required params');
    throw new ServiceError({
      token: 'MISSING_REQUIRED_PARAMS',
      status: 412,
    });
  }

  const qualificationQuestionsMap = new Map(Object.entries(preferences));
  const qualificationQuestions = parseQualificationQuestions(qualificationQuestionsMap);

  const storedUnitsFilters = partyRepo.getUnitsFiltersFromQuestions(qualificationQuestions);

  await partyRepo.updateParty(ctx, {
    id: partyId,
    qualificationQuestions,
    storedUnitsFilters,
  });
};

const archivePartiesFromSoldPropertiesJob = async (ctx, propertyIds) => {
  logger.trace({ ctx, propertyIds }, 'archivePartiesFromSoldProperties - job');

  const jobDetails = {
    name: DALTypes.Jobs.ImportUpdateDataFiles,
    step: DALTypes.ImportUpdateDataFilesSteps.ArchivePartiesFromSoldProperties,
    category: DALTypes.JobCategory.MigrateData,
    status: DALTypes.JobStatus.IN_PROGRESS,
  };

  const job = await createJob(ctx, [], jobDetails);

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: PARTY_MESSAGE_TYPE.ARCHIVE_PARTIES_FROM_SOLD_PROPERTIES,
    message: {
      authUser: ctx.authUser,
      tenantId: ctx.tenantId,
      propertyIds,
      job,
    },
    ctx,
  });
};

const updatePartiesWithLeasedUnitOnSoldProperties = async (ctx, propertyIds) => {
  logger.trace({ ctx, propertyIds }, 'updatePartiesWithLeasedUnitOnSoldProperties');
  let partyIdsUpdated = [];
  await mapSeries(propertyIds, async propertyId => {
    const partyIdsToUpdate = await partyRepo.getPartyIdsWithActiveLeaseAndPropertyMismatch(ctx, propertyId);
    await mapSeries(partyIdsToUpdate, async partyId => {
      await updateAssignedProperty(ctx, partyId, propertyId);
    });
    partyIdsUpdated = [...partyIdsUpdated, ...partyIdsToUpdate];
  });
  return partyIdsUpdated;
};

export const archivePartiesFromSoldProperties = async (ctx, propertyIds) => {
  logger.trace({ ctx, propertyIds }, 'archivePartiesFromSoldProperties - service');

  await updatePartiesWithLeasedUnitOnSoldProperties(ctx, propertyIds);
  const partyIdsToArchive = await partyRepo.getActivePartiesFromSoldProperties(ctx, propertyIds);

  await archivePartiesFromSoldPropertiesJob(ctx, propertyIds);

  return { numberOfPartiesToArchive: partyIdsToArchive.length };
};

// This functions returns the external(belongs to another party) applications for the current party members
export const getOtherPartiesApplications = async (ctx, currentPartyId, { partyMembers }) => {
  const currentPartyMembers = partyMembers || (await partyRepo.getPartyMembersByPartyIds(ctx, [currentPartyId]));
  const personIds = currentPartyMembers.map(pm => pm.personId);

  const otherPartiesApplications = await partyRepo.getActiveApplicationsForPersons(ctx, personIds, currentPartyId);

  const latestApplicationsGroupedByPersonId = otherPartiesApplications.reduce((acc, application) => {
    if (application.endedAsMergedAt) return acc;

    const { personId } = application;

    acc[personId] = acc[personId] || application;
    if (acc[personId].updated_at < application.updated_at) acc[personId] = application;

    return acc;
  }, {});

  const applications = Object.values(latestApplicationsGroupedByPersonId);

  const applicationsOrderByUpdatedAt = orderBy(applications, 'updated_at', 'desc');

  return applicationsOrderByUpdatedAt.map(application => ({
    ...application,
    applicantName: currentPartyMembers.find(pm => pm.personId === application.personId)?.fullName,
  }));
};

export const loadPartyMembersApplicantInfo = async (ctx, partyId) => await partyRepo.loadPartyMembersApplicantInfo(ctx, partyId);

export const reassignPartiesFromInactiveTeams = async (ctx, teamIds) => {
  logger.trace({ ctx }, 'reassignPartiesFromInactiveTeams - service');

  const allPartiesToReassign = await partyRepo.getPartiesToReassignForInactiveTeams(ctx, teamIds);

  logger.trace({ ctx, lengthOfPartiesToReassign: allPartiesToReassign.length }, 'reassignPartiesFromInactiveTeams - start');

  await mapSeries(allPartiesToReassign, async party => {
    const reassignableTeamMembers = await getReassignableTeamMembersForInactiveTeams(ctx, party.assignedPropertyId, party.userId);

    await eventService.saveReassignPartyFromInactiveTeamEvent(ctx, {
      partyId: party.id,
      userId: (ctx.authUser || {}).id,
      metadata: { partyId: party.id, reassignableTeamMembers },
    });
  });
};

export const reassignParty = async (ctx, { partyId, teamId, userId, shouldArchive = false }) => {
  logger.trace({ ctx, partyId, newTeamId: teamId, newUserId: userId, shouldArchive }, 'reassignParty - service');

  const party = await getPartyById(ctx, partyId);

  return await assignParty(ctx, { ...party, ownerTeam: teamId }, { userId, teamId });
};

export const updateCompany = async (ctx, company) => {
  logger.trace({ ctx, company }, 'updateCompany');
  return await partyRepo.updateCompany(ctx, company);
};

export const addCompany = async (ctx, companyName, partyMemberId) => {
  logger.trace({ ctx, companyName }, 'addCompany');
  const company = await partyRepo.addCompany(ctx, companyName);

  partyMemberId && (await partyRepo.updatePartyMember(ctx, partyMemberId, { companyId: company.id }));

  return company;
};

export const unarchiveParty = async (ctx, partyId) => {
  const myLogCtx = { ctx, partyId };

  const executeUnarchive = async trx => {
    const innerCtx = { trx, ...ctx };
    logger.trace(myLogCtx, 'unarchiveParty - start');

    const res = await partyRepo.unarchiveParty(innerCtx, partyId);

    await logEntity(ctx, {
      entity: {
        id: partyId,
        state: res.state,
        reason: 'Unarchived because lease was voided',
      },
      activityType: ACTIVITY_TYPES.UPDATE,
      component: COMPONENT_TYPES.PARTY,
    });

    await reviveAllExternalInfoByPartyId(innerCtx, partyId);
    logger.trace(myLogCtx, 'unarchiveParty - done');

    return res;
  };

  return await runInTransaction(async trx => await executeUnarchive(trx), ctx);
};
