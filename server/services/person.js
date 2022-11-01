/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import intersection from 'lodash/intersection';
import difference from 'lodash/difference';
import { mapSeries } from 'bluebird';
import pick from 'lodash/pick';
// import { getCommonUserByPersonIds } from '../../auth/server/services/common-user';
import {
  getPersonById,
  getPersonByEmailAddress,
  getPersonsByIds as dalGetPersonsByIds,
  updatePerson as updatePersonInDb,
  markPersonAsMerged,
  getExistingResidentsByPersonIds,
  addPersonsToResidents,
  deleteExistingResidents,
  getContactInfo,
  getPersonResidentStates,
} from '../dal/personRepo';
import {
  loadPartiesByPersonIds,
  getPartyIdsByPersonIds,
  updatePersonIdForPartyMember,
  loadPartyMembers,
  markPartyMemberAsRemovedForParties,
  getPartyMembersByPersonIds,
  copyActiveApplicationForPerson,
  updateMemberStateForParty,
  getAssignedPropertyByPartyId,
  getPartyMemberByPartyIdAndPersonId,
} from '../dal/partyRepo';
import { getActiveExternalInfoByPartyMember, archiveExternalInfoByPartyMemberId, insertExternalInfo } from '../dal/exportRepo';
import { getUserIdByPersonId, getCommonUserByPersonIds as dalGetCommonUserByPersonIds } from '../../auth/server/dal/common-user-repo';
import { removePersonFromSearch } from '../dal/searchRepo';
import { mergeContactInfos, getContactInfoDiff, existsEmailContactInfo, getContactInfosByPersonId } from '../dal/contactInfoRepo';
import { mergeComms } from './communication';
import { loadAppointmentsForParties } from '../dal/appointmentRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { runInTransaction } from '../database/factory';
// TODO: should use service!
import {
  updatePersonIdForPersonApplication,
  getPersonApplicationsByPersonIds,
  getPersonApplicationsByPartyIdPersonIds,
} from '../../rentapp/server/dal/person-application-repo';
import { logEntity } from './activityLogService';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';
import loggerModule from '../../common/helpers/logger';
import { generateStrongMatches, deleteUnresolvedStrongMatches, saveMatchesDismissals } from './strongMatches';
import { ServiceError } from '../common/errors';
import { getTasksForPartiesByName, updateTasksBulk, updateTasks } from '../dal/tasksRepo';
import { getDisplayName } from '../../common/helpers/person-helper';
import { performPartyStateTransition } from './partyStatesTransitions';
import { updatePersonApplicationsBulk } from '../dal/mergePartyRepo';
import { now } from '../../common/helpers/moment-utils';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import * as eventService from './partyEvent';
import { confirmStrongMatch, deleteUnresolvedStrongMathcesByPersonIds } from '../dal/strongMatchesRepo';

import { enhanceContactInfoWithSmsInfo } from './telephony/twilio';
import { ResidentPropertyState } from '../../common/enums/residentPropertyStates';
import { getNotificationUnsubscriptionByPersonId, replacePersonIdByUnsubscriptionId } from '../dal/cohortCommsRepo';

const logger = loggerModule.child({ subType: 'personService' });

// TODO: pass in ctx
export const getCommonUserEmailsByPersonIds = async (tenantId, personIds) => {
  const ctx = { tenantId };
  // eslint-disable-next-line global-require
  const { getCommonUserByPersonIds } = require('../../auth/server/services/common-user');
  const commonUsers = await getCommonUserByPersonIds(ctx, personIds);
  return commonUsers.reduce((acc, user) => {
    user && acc.set(user.personId, user.email);
    return acc;
  }, new Map());
};

export const getPersonsByIds = async (ctx, personsIds) => {
  const persons = await dalGetPersonsByIds(ctx, personsIds);

  const commonUserEmails = await getCommonUserEmailsByPersonIds(
    ctx.tenantId,
    persons.map(person => person.id),
  );

  return persons.map(person => {
    person.primaryEmail = person.contactInfo.defaultEmail;
    person.commonUserEmail = commonUserEmails.get(person.id);
    person.displayName = getDisplayName(person);
    return person;
  });
};

export const getPersonsDisplayNamesByIds = async (ctx, ids) => (await dalGetPersonsByIds(ctx, ids)).map(getDisplayName);

const savePartyEvents = async (ctx, personId, diff) => {
  const partyMembersForPerson = await getPartyMembersByPersonIds(ctx, [personId], false);
  if (!partyMembersForPerson) return;

  await mapSeries(partyMembersForPerson, async pm => {
    const eventInfo = {
      partyId: pm.partyId,
      userId: (ctx.authUser || {}).id,
      partyMemberId: pm.id,
      metadata: { personId },
    };

    await eventService.savePersonUpdatedEvent(ctx, eventInfo);

    if (diff && diff.itemsToSave && diff.itemsToSave.length) {
      await eventService.saveContactInfoAddedEvent(ctx, eventInfo, diff.itemsToSave);
    }
    if (diff && diff.itemsToDelete && diff.itemsToDelete.length) {
      await eventService.saveContactInfoRemovedEvent(ctx, eventInfo, diff.itemsToDelete);
    }
  });
};

const formatContacInfo = (contactInfo, partyId) => {
  const { phones, emails } = contactInfo.reduce(
    (acc, info) => {
      const data = {
        value: info.value,
        type: info.type,
        id: info.id,
        isPrimary: info.isPrimary,
        isSpam: info.isSpam,
        personId: info.personId,
        metadata: info.metadata,
      };

      if (info.type === DALTypes.ContactInfoType.PHONE) acc.phones.push(data);
      if (info.type === DALTypes.ContactInfoType.EMAIL) acc.emails.push(data);

      return acc;
    },
    { phones: [], emails: [] },
  );

  return {
    partyId,
    contactInfo: {
      phones,
      emails,
    },
  };
};

const saveActivityLogs = async (ctx, personId) => {
  const partyMembersForPerson = await getPartyMembersByPersonIds(ctx, [personId], false);
  const contactInfo = await getContactInfo(ctx, personId);
  await mapSeries(partyMembersForPerson, async ({ partyId }) => {
    const entity = formatContacInfo(contactInfo, partyId);
    await logEntity(ctx, { entity, activityType: ACTIVITY_TYPES.UPDATE, component: COMPONENT_TYPES.GUEST });
  });
};

export const updatePerson = async (ctx, personId, person) => {
  logger.trace({ ctx, personId }, 'updatePerson - params');

  return await runInTransaction(async trx => {
    const innerCtx = { trx, ...ctx };
    const contactInfoDiff = person.contactInfo && (await getContactInfoDiff(innerCtx, person.contactInfo.all, personId));
    const dbPerson = await getPersonById(innerCtx, personId);

    const isPreferredNameChanged = person.preferredName !== dbPerson.preferredName;
    const isFullNameChanged = person.fullName !== dbPerson.fullName;
    if (person.contactInfo) {
      person.contactInfo.all = await enhanceContactInfoWithSmsInfo(ctx, person.contactInfo.all);
    }
    const updatedPerson = await updatePersonInDb(innerCtx, personId, person);
    const itemsToSave = contactInfoDiff && contactInfoDiff.itemsToSave && contactInfoDiff.itemsToSave.length;
    itemsToSave && (await generateStrongMatches(innerCtx, contactInfoDiff.itemsToSave, personId));

    const itemsToDelete = contactInfoDiff && contactInfoDiff.itemsToDelete && contactInfoDiff.itemsToDelete.length;
    itemsToDelete && (await deleteUnresolvedStrongMatches(innerCtx, contactInfoDiff.itemsToDelete));

    const diff = {
      ...contactInfoDiff,
      preferredName: isPreferredNameChanged ? person.preferredName : undefined,
      fullName: isFullNameChanged ? person.fullName : undefined,
    };
    const isPersonModified = isFullNameChanged || isPreferredNameChanged || itemsToDelete || itemsToSave;

    await saveMatchesDismissals(innerCtx, personId, person.dismissedMatches);

    if (contactInfoDiff && isPersonModified) {
      await savePartyEvents(innerCtx, personId, diff);
      await saveActivityLogs(innerCtx, personId);
    }
    const commonUserEmails = await getCommonUserEmailsByPersonIds(innerCtx.tenantId, [personId]);
    return {
      ...updatedPerson,
      primaryEmail: updatedPerson.contactInfo.defaultEmail,
      commonUserEmail: commonUserEmails.get(person.id),
      displayName: getDisplayName(person),
    };
  }, ctx);
};

// externally available person-related services
export { getPersonById, getPersonByEmailAddress };

export const determineBasePersonForMerge = async (ctx, firstPersonId, secondPersonId) => {
  logger.trace({ firstPersonId, secondPersonId }, 'determineBasePersonForMerge');
  const orderedPartyStates = [
    DALTypes.PartyStateType.CONTACT,
    DALTypes.PartyStateType.LEAD,
    DALTypes.PartyStateType.PROSPECT,
    DALTypes.PartyStateType.APPLICANT,
    DALTypes.PartyStateType.LEASE,
    DALTypes.PartyStateType.FUTURERESIDENT,
    DALTypes.PartyStateType.RESIDENT,
    DALTypes.PartyStateType.PASTRESIDENT,
  ];

  let basePersonId;

  const apps = await getPersonApplicationsByPersonIds(ctx, [firstPersonId, secondPersonId]);
  const firstPersonApps = apps.filter(app => app.personId === firstPersonId);
  const secondPersonApps = apps.filter(app => app.personId === secondPersonId);

  if (firstPersonApps.length && secondPersonApps.length) {
    // this is the case in which both the persons are applicants and we need to determine which has the most advanced application.
    // the base person will be the one that has a paid application.
    const firstPersonHasPaidApps = firstPersonApps.filter(app => app.paymentCompleted);
    const secondPersonHasPaidApps = secondPersonApps.filter(app => app.paymentCompleted);

    if (!firstPersonHasPaidApps.length && !secondPersonHasPaidApps.length) {
      // in case both have applications but none is paid, we return the one that merge was clicked on
      return firstPersonId;
    }

    return firstPersonHasPaidApps.length ? firstPersonId : secondPersonId;
  }
  if (firstPersonApps && firstPersonApps.length) {
    return firstPersonId;
  }
  if (secondPersonApps && secondPersonApps.length) {
    return secondPersonId;
  }

  const partiesForFirstPerson = await loadPartiesByPersonIds(ctx, [firstPersonId]);
  const partiesForSecondPerson = await loadPartiesByPersonIds(ctx, [secondPersonId]);

  if (partiesForFirstPerson.length && partiesForSecondPerson.length) {
    // determine the most advanced party by its state.
    const maxStateFor1 = Math.max(...partiesForFirstPerson.map(item => orderedPartyStates.indexOf(item.state)));
    const maxStateFor2 = Math.max(...partiesForSecondPerson.map(item => orderedPartyStates.indexOf(item.state)));

    basePersonId = maxStateFor1 >= maxStateFor2 ? firstPersonId : secondPersonId;
  } else if (partiesForFirstPerson.length) {
    // means that one of the persons is not present in any party.
    basePersonId = firstPersonId;
  } else {
    basePersonId = secondPersonId;
  }

  logger.trace(`Elected ${basePersonId} as the base person for merge operation`);
  return basePersonId;
};

const reduceLogMergeHandler = (basePerson, otherPerson) => (acc, partyId) => {
  const personForAnalytics = person => ({
    fullName: person.fullName,
    preferredName: person.preferredName,
    contactInfo: person.contactInfo,
  });
  acc.set(partyId, {
    id: partyId,
    basePerson: personForAnalytics(basePerson),
    otherPerson: personForAnalytics(otherPerson),
  });
  return acc;
};

const mergeAppointments = async (ctx, parties, otherPersonId) => {
  const partyMembersForPerson = await getPartyMembersByPersonIds(ctx, [otherPersonId]);
  const filteredPartyMembers = partyMembersForPerson.filter(pm => parties.includes(pm.partyId));
  const appointments = await loadAppointmentsForParties(
    ctx,
    filteredPartyMembers.map(pm => pm.partyId),
  );
  const filteredIds = filteredPartyMembers.map(pm => pm.id);

  const deltas = appointments.map(appt => ({
    id: appt.id,
    metadata: {
      ...appt.metadata,
      partyMembers: appt.metadata.partyMembers.filter(pmId => filteredIds.every(id => id !== pmId)),
    },
  }));

  logger.trace({ ctx, appointmentsData: deltas }, 'Updating appointments for mergePersons');
  await updateTasks(ctx, deltas);
};

const updateExternalInfoForMergedPersons = async ({ innerCtx, openPartiesForActiveMembers, basePersonId, otherPersonId }) => {
  await mapSeries(openPartiesForActiveMembers, async partyId => {
    const partyMemberForOtherPerson = await getPartyMemberByPartyIdAndPersonId(innerCtx, partyId, otherPersonId);
    const partyMemberExternalInfoForOtherPerson = await getActiveExternalInfoByPartyMember(innerCtx, partyMemberForOtherPerson.id);

    if (partyMemberExternalInfoForOtherPerson) {
      await archiveExternalInfoByPartyMemberId(innerCtx, partyMemberForOtherPerson.id);
      const partyMemberBasePerson = await getPartyMemberByPartyIdAndPersonId(innerCtx, partyId, basePersonId);
      const partyMemberExternalInfoForBasePerson = await getActiveExternalInfoByPartyMember(innerCtx, partyMemberBasePerson.id);

      if (!partyMemberExternalInfoForBasePerson) {
        const { externalId, externalProspectId, externalRoommateId, isPrimary, leaseId, metadata } = partyMemberExternalInfoForOtherPerson;
        const propertyId = await getAssignedPropertyByPartyId(innerCtx, partyId);
        await insertExternalInfo(innerCtx, {
          partyMemberId: partyMemberBasePerson.id,
          partyId,
          leaseId,
          externalId,
          externalProspectId,
          externalRoommateId,
          isPrimary,
          metadata: {
            ...metadata,
            personMerge: true,
          },
          propertyId,
        });
      }
    }
  });
};

const mergePersonNames = async (ctx, basePerson, otherPerson) => {
  if (!basePerson.fullName) {
    await updatePersonInDb(ctx, basePerson.id, { ...basePerson, fullName: otherPerson.fullName });
  }
};

const mergeUnsubscription = async (ctx, basePersonId, otherPersonId) => {
  const notificationUnsubscription = await getNotificationUnsubscriptionByPersonId(ctx, otherPersonId);
  if (!notificationUnsubscription) return;

  await replacePersonIdByUnsubscriptionId(ctx, notificationUnsubscription.id, basePersonId);
};

const cancelCompleteContactInfoTasks = async (ctx, partyIds, personId) => {
  const tasks = await getTasksForPartiesByName(ctx, partyIds, DALTypes.TaskNames.COMPLETE_CONTACT_INFO);
  const taskIds = tasks.filter(t => t.metadata && t.metadata.personId === personId).map(t => t.id);
  await updateTasksBulk(ctx, taskIds, { state: DALTypes.TaskStates.CANCELED });
};

const cancelExistingCompleteContactInfoTasks = async ({ ctx, partiesOfBasePerson, partiesOfOtherPerson, basePersonId, otherPersonId }) => {
  await cancelCompleteContactInfoTasks(ctx, partiesOfBasePerson, basePersonId);
  await cancelCompleteContactInfoTasks(ctx, partiesOfOtherPerson, otherPersonId);
};

const updatePersonIdForCommonUserPerson = async (ctx, { basePersonId, otherPersonId }) => {
  // eslint-disable-next-line global-require
  const { updatePersonIdForCommonUserPerson: updatePersonIdForCommonUserPersonDal } = require('../../auth/server/dal/common-user-repo');
  return await updatePersonIdForCommonUserPersonDal(ctx, { basePersonId, otherPersonId });
};

const copyActiveApplicationOnMergerAction = async (ctx, partiesOfBasePerson, partiesOfOtherPerson, personId) => {
  const basePartyIds = difference(partiesOfBasePerson, partiesOfOtherPerson);
  const otherPartyIds = difference(partiesOfOtherPerson, partiesOfBasePerson);
  if (!otherPartyIds.length) return null;

  logger.trace({ ctx, personId, targetPartyIds: otherPartyIds, basePartyIds }, 'copyActiveApplicationOnMergerAction');
  return await copyActiveApplicationForPerson(ctx, personId, otherPartyIds, partyId => basePartyIds.some(id => id === partyId));
};

const markUnusedApplicationsAsEnded = async (ctx, personId, partiesOfBoth, otherPersonId) => {
  logger.trace({ ctx, personId, partiesOfBoth }, 'Looking for applications that should be marked as ended due to persons merge');

  const orderedApplicationStates = [
    DALTypes.PersonApplicationStatus.NOT_SENT,
    DALTypes.PersonApplicationStatus.SENT,
    DALTypes.PersonApplicationStatus.OPENED,
    DALTypes.PersonApplicationStatus.PAID,
    DALTypes.PersonApplicationStatus.COMPLETED,
  ];

  const apps = (
    (await mapSeries(partiesOfBoth, async partyId => await getPersonApplicationsByPartyIdPersonIds(ctx, partyId, [personId, otherPersonId]))) || []
  ).flat();

  if (apps.length > 1) {
    const mostAdvancedApp = apps.sort((a, b) =>
      orderedApplicationStates.indexOf(a.applicationStatus) < orderedApplicationStates.indexOf(b.applicationStatus) ? 1 : -1,
    )[0];

    const appsToMarkAsEnded = apps.filter(item => item.id !== mostAdvancedApp.id);

    logger.trace({ ctx, personId, mostAdvancedApp }, 'Determined application that survives after persons merge');
    logger.trace({ ctx, personId, appsToMarkAsEnded }, 'Determined applications to mark as ended due to persons merge');

    await updatePersonApplicationsBulk(
      ctx,
      appsToMarkAsEnded.map(item => item.id),
      {
        endedAsMergedAt: now().toDate(),
      },
    );
  }
};

const updateStrongMatches = async (ctx, basePersonId, otherPersonId) => {
  await confirmStrongMatch(ctx, basePersonId, otherPersonId);
  const deletedStrongMatches = await deleteUnresolvedStrongMathcesByPersonIds(ctx, [basePersonId, otherPersonId]);
  if (deletedStrongMatches.length) {
    logger.trace({ ctx, deletedStrongMatches, basePersonId, otherPersonId }, 'updateStrongMatches - deleted strong matches');
    const basePersonContactInfos = await getContactInfosByPersonId(ctx, basePersonId);
    await generateStrongMatches(ctx, basePersonContactInfos, basePersonId);
  }
};

const getPartyIdsByPersonId = async (ctx, personId, options = { includeClosedParties: true, excludeInactiveMembers: true }) =>
  await getPartyIdsByPersonIds(ctx, [personId], options.includeClosedParties, options.excludeInactiveMembers);

const getPartiesBelongingToBothPersons = async (ctx, basePersonId, otherPersonId, options) => {
  const basePersonParties = await getPartyIdsByPersonId(ctx, basePersonId, options);
  const otherPersonParties = await getPartyIdsByPersonId(ctx, otherPersonId, options);

  return intersection(basePersonParties, otherPersonParties);
};

export const mergePersons = async (ctx, firstPersonId, secondPersonId, contactInfo) => {
  logger.trace({ ctx, firstPersonId, secondPersonId, contactInfo }, 'mergePersons');
  const firstPersonHasAccount = await getUserIdByPersonId(ctx, firstPersonId);
  const basePersonId = firstPersonHasAccount ? firstPersonId : secondPersonId;
  const otherPersonId = basePersonId === firstPersonId ? secondPersonId : firstPersonId;
  logger.trace({ ctx, basePersonId, otherPersonId }, 'mergePersons - determined personIds');

  const partiesOfBasePerson = await getPartyIdsByPersonId(ctx, basePersonId, { includeClosedParties: false, excludeInactiveMembers: true });
  const partiesOfOtherPerson = await getPartyIdsByPersonId(ctx, otherPersonId, { includeClosedParties: false, excludeInactiveMembers: true });
  logger.trace({ ctx, partiesOfBasePerson, partiesOfOtherPerson }, 'mergePersons - parties of both persons');

  const openPartiesForActiveMembers = await getPartiesBelongingToBothPersons(ctx, basePersonId, otherPersonId, {
    includeClosedParties: false,
    excludeInactiveMembers: true,
  });
  const allPartiesForActiveAndInactiveMembers = await getPartiesBelongingToBothPersons(ctx, basePersonId, otherPersonId, {
    includeClosedParties: true,
    excludeInactiveMembers: false,
  });
  const allPartiesForActiveMembers = await getPartiesBelongingToBothPersons(ctx, basePersonId, otherPersonId, {
    includeClosedParties: true,
    excludeInactiveMembers: true,
  });

  logger.trace(
    { ctx, openPartiesForActiveMembers, allPartiesForActiveAndInactiveMembers, allPartiesForActiveMembers },
    'mergePersons - parties affected by the merge process',
  );

  const persons = await dalGetPersonsByIds(ctx, [basePersonId, otherPersonId]);
  const basePerson = persons.find(p => p.id === basePersonId);
  const otherPerson = persons.find(p => p.id === otherPersonId);
  const firstLogMergeHandler = reduceLogMergeHandler(basePerson, otherPerson);
  const activityLogData = [...new Set([...partiesOfBasePerson, ...partiesOfOtherPerson])].reduce(firstLogMergeHandler, new Map());
  const entitiesToLog = Array.from(activityLogData.values());

  try {
    return await runInTransaction(async innerTrx => {
      const innerCtx = { trx: innerTrx, ...ctx };

      if (contactInfo) {
        // if the LA added some new contact infos prior to merge we want to save them.
        await updatePerson(innerCtx, firstPersonId, contactInfo);
      }

      await mergePersonNames(innerCtx, basePerson, otherPerson);
      await mergeContactInfos(innerCtx, basePersonId, otherPersonId);
      await mergeComms(innerCtx, basePersonId, otherPersonId);
      await mergeUnsubscription(innerCtx, basePersonId, otherPersonId);
      await mergeAppointments(innerCtx, openPartiesForActiveMembers, otherPersonId);
      allPartiesForActiveMembers &&
        allPartiesForActiveMembers.length &&
        (await markPartyMemberAsRemovedForParties(innerCtx, allPartiesForActiveMembers, otherPersonId));
      openPartiesForActiveMembers.length && (await updateExternalInfoForMergedPersons({ innerCtx, openPartiesForActiveMembers, basePersonId, otherPersonId }));
      await updatePersonIdForPartyMember(innerCtx, basePersonId, otherPersonId);
      allPartiesForActiveAndInactiveMembers?.length &&
        (await markUnusedApplicationsAsEnded(innerCtx, basePersonId, allPartiesForActiveAndInactiveMembers, otherPersonId));
      await updatePersonIdForPersonApplication(innerCtx, basePersonId, otherPersonId);
      const applicationsProcessed = await copyActiveApplicationOnMergerAction(innerCtx, partiesOfBasePerson, partiesOfOtherPerson, basePersonId);
      await markPersonAsMerged(innerCtx, basePersonId, otherPersonId);
      await removePersonFromSearch(innerCtx, otherPersonId);
      await notify({
        ctx,
        event: eventTypes.PERSON_MERGED,
        data: { personId: otherPersonId },
      });
      await updatePersonIdForCommonUserPerson(innerCtx, { basePersonId, otherPersonId });
      applicationsProcessed &&
        applicationsProcessed.length &&
        (await mapSeries(applicationsProcessed, async application => {
          const { id: newPersonApplicationId, personId, partyId: targetPartyId } = application;
          logger.trace({ ctx, personId, targetPartyId, newPersonApplicationId }, 'person application copied on merge person action');
          await updateMemberStateForParty(innerCtx, application.partyId, application.personId, DALTypes.PartyStateType.APPLICANT);
          await performPartyStateTransition(innerCtx, application.partyId);
        }));
      await updateStrongMatches(innerCtx, basePersonId, otherPersonId);
      for (const entity of entitiesToLog) {
        await logEntity(innerCtx, { entity, activityType: ACTIVITY_TYPES.GUEST_MERGED, component: COMPONENT_TYPES.PARTY });
      }

      const resultPerson = await getPersonById(innerCtx, basePersonId);
      await cancelExistingCompleteContactInfoTasks({ ctx: innerCtx, partiesOfBasePerson, partiesOfOtherPerson, basePersonId, otherPersonId });

      partiesOfBasePerson &&
        (await mapSeries(partiesOfBasePerson, async partyId => {
          await eventService.savePersonsMergedEvent(innerCtx, {
            partyId,
            userId: (innerCtx.authUser || {}).id,
          });
        }));

      logger.trace({ ctx: innerCtx }, `Merged persons ${basePersonId} and ${otherPersonId} successfully into ${basePersonId}`);

      return resultPerson;
    }, ctx);
  } catch (error) {
    logger.error({ ctx, error, basePersonId, otherPersonId }, 'merging persons failed');
    throw error;
  }
};

export const mergeCanBePerformed = async (ctx, firstPersonId, secondPersonId) => {
  const apps = await getPersonApplicationsByPersonIds(ctx, [firstPersonId, secondPersonId]);

  const firstPersonHasPaidApps = apps.filter(app => app.personId === firstPersonId && app.paymentCompleted);
  const secondPersonHasPaidApps = apps.filter(app => app.personId === secondPersonId && app.paymentCompleted);

  if (firstPersonHasPaidApps.length && secondPersonHasPaidApps.length) {
    return { error: { token: 'ERROR_BOTH_PERSONS_APPLIED', status: 412 } };
  }

  return true;
};

export const addPersonsToResidentsList = async (ctx, partyId, metadata) => {
  const partyResidents = (await loadPartyMembers(ctx, partyId)).filter(pm => pm.memberType === DALTypes.MemberType.RESIDENT).map(pm => pm.personId);
  const alreadyResidents = (await getExistingResidentsByPersonIds(ctx, partyResidents)).map(r => r.personId);
  const newResidents = partyResidents.filter(p => !alreadyResidents.includes(p));
  await addPersonsToResidents(ctx, newResidents, metadata);
};

export const removePersonsFromResidentsList = async (ctx, partyId) => {
  const partyResidents = (await loadPartyMembers(ctx, partyId)).filter(pm => pm.memberType === DALTypes.MemberType.RESIDENT).map(pm => pm.personId);
  await deleteExistingResidents(ctx, partyResidents);
};

export const existsPersonWithEmail = async (ctx, email, personId) => await existsEmailContactInfo(ctx, email, personId);

const isPrimaryEmailAnonymous = ({ defaultEmailId, emails }) =>
  !!emails.find(({ id, isPrimary, isAnonymous }) => id === defaultEmailId && isPrimary && isAnonymous);
const isPrimaryEmailSameAsEmailFromSource = ({ defaultEmail }, email) => defaultEmail.toLowerCase() === email.toLowerCase();

export const validatePrimaryEmail = async (ctx, personId, email = '') => {
  const person = await getPersonById(ctx, personId);
  const contactInfo = person.contactInfo;

  if (contactInfo && (!contactInfo.defaultEmail || isPrimaryEmailAnonymous(contactInfo) || isPrimaryEmailSameAsEmailFromSource(contactInfo, email))) return;

  throw new ServiceError({ token: 'PRIMARY_EMAIL_IS_NOT_CORRECT', status: 412, data: { email } });
};

export const getResidentState = async (ctx, personId, propertyIds) => {
  if (!personId) {
    logger.trace({ ctx, personId, propertyIds }, 'getResidentState missing params');
    throw new ServiceError({
      token: 'MISSING_REQUIRED_PARAMS',
      status: 412,
    });
  }

  let residentState = await getPersonResidentStates(ctx, personId, propertyIds);

  const residentStateGroupedByPropertyId = residentState.reduce((acc, a) => {
    (acc[a.propertyId] = acc[a.propertyId] || []).push(a);
    return acc;
  }, {});

  const propertyIdsIterator = Object.keys(residentStateGroupedByPropertyId);

  residentState = propertyIdsIterator.reduce((acc, propertyIdKey) => {
    const residentStatesByProperty = residentStateGroupedByPropertyId[propertyIdKey];
    const [first] = residentStatesByProperty;
    const pickedValues = { personId, ...pick(first, ['propertyId', 'propertyName', 'propertyState', 'propertyCity', 'features', 'propertyTimezone']) };

    const isCurrentResident = residentStatesByProperty?.some(
      ({ workflowName, workflowState, endDate, vacateDate }) =>
        workflowName === DALTypes.WorkflowName.ACTIVE_LEASE && workflowState === DALTypes.WorkflowState.ACTIVE && !endDate && !vacateDate,
    );
    if (isCurrentResident) return [...acc, { ...pickedValues, residentState: ResidentPropertyState.CURRENT }];

    const isFutureResident = residentStatesByProperty?.some(
      ({ state, endDate }) => (!endDate && state === DALTypes.PartyStateType.FUTURERESIDENT) || state === DALTypes.PartyStateType.LEASE,
    );
    if (isFutureResident) return [...acc, { ...pickedValues, residentState: ResidentPropertyState.FUTURE }];

    const isPastResident = residentStatesByProperty?.some(
      ({ workflowName, workflowState, vacateDate, endDate }) =>
        (workflowName === DALTypes.WorkflowName.ACTIVE_LEASE && vacateDate) ||
        (workflowName === DALTypes.WorkflowName.ACTIVE_LEASE && workflowState === DALTypes.WorkflowState.ARCHIVED) ||
        endDate,
    );
    if (isPastResident) return [...acc, { ...pickedValues, residentState: ResidentPropertyState.PAST }];

    return [...acc, { ...pickedValues, residentState: null }];
  }, []);

  logger.trace({ ctx, personId, propertyIds, residentState }, 'getResidentState');

  return residentState;
};

export const overridePersonsWithContactInfo = async (ctx, personIds) => {
  logger.trace({ ctx, personIds }, 'overridePersonsWithContactInfo');
  if (!personIds?.length) return [];

  const persons = await dalGetPersonsByIds(ctx, personIds);
  const commonUsers = await dalGetCommonUserByPersonIds(ctx, personIds);

  const personsOverride = persons.map(person => {
    const commonUser = commonUsers.find(({ personId }) => personId === person.id);
    const {
      contactInfo: { emails, defaultEmail },
    } = person;

    if (!commonUser || commonUser.email === defaultEmail) return person;

    const overrideDefaultEmailId = emails.find(({ value }) => value === commonUser.email)?.id;
    if (!overrideDefaultEmailId) return person;

    return {
      ...person,
      contactInfo: {
        ...person.contactInfo,
        defaultEmail: commonUser.email,
        defaultEmailId: overrideDefaultEmailId,
      },
    };
  });

  return personsOverride;
};
