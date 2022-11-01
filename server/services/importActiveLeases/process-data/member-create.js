/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { toMoment } from '../../../../common/helpers/moment-utils';
import { checkIfChild, checkMatchingPersonData, checkMatchingPartyMember } from './checks';
import {
  createPartyMember,
  savePartyAdditionalInfo,
  createParty,
  getPartyMembersByPersonIds,
  getPartyMembersByPartyIds,
  getPartyAdditionalInfoByPartyId,
} from '../../../dal/partyRepo';
import { insertExternalInfo, getAllExternalInfoByParty, getExternalInfoByExternalIdAndPartyId } from '../../../dal/exportRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { AdditionalInfoTypes } from '../../../../common/enums/partyTypes';
import loggerModule from '../../../../common/helpers/logger';
import {
  getFullName,
  getContactInfosValueByType,
  getEnhancedContactInfoWithSmsInfo,
  getExternalRoommateId,
  handleUpdatedExternalInfo,
  insertExternalInfoAndIgnorePreviousER,
  buildContactInfo,
} from './helpers';
import { savePartyCreatedEvent } from '../../partyEvent';
import { formatPhoneNumberForDb } from '../../../helpers/phoneUtils';
import { createExceptionReport } from './exception-report';
import { getPersonById } from '../../../dal/personRepo';
import { PartyExceptionReportRules } from '../../../helpers/exceptionReportRules';
import { getUserAndTeamsForProspectImport } from '../../../dal/usersRepo';
import { getInFlightRenewalV1ByExternalIds } from '../../../dal/renewalV1Repo';
import { logActiveLeasePartyCreated, logPartyMemberCreated } from '../../helpers/workflows';
import { removeSpaces } from '../../../dal/helpers/person';

const logger = loggerModule.child({ subType: 'importActiveLeases' });

const getMemberIdForExternalInfoUpdate = ({
  personMatchFound,
  nameAndPhoneMatchFound,
  sameMemberFoundInParty,
  memberWithEmailMatchInTheSameParty,
  memberWithPhoneMatchInTheSameParty,
}) => {
  if (personMatchFound && memberWithEmailMatchInTheSameParty) return memberWithEmailMatchInTheSameParty.id;
  if (nameAndPhoneMatchFound && memberWithPhoneMatchInTheSameParty) return memberWithPhoneMatchInTheSameParty.id;
  return sameMemberFoundInParty.childId;
};

const getUserAndTeams = async (ctx, { leasingAgent, propertyId }) => {
  const { userId, teamIds } = (await getUserAndTeamsForProspectImport(ctx, leasingAgent, propertyId)) || {};

  return {
    userId,
    teams: teamIds,
    ownerTeam: teamIds?.[0],
  };
};

const createNewParty = async (
  ctx,
  { residentImportTrackingId, primaryExternalId, leasingAgent, propertyId, allReceivedMemberIds, partyGroupId, leaseType },
) => {
  logger.trace({ ctx, residentImportTrackingId, primaryExternalId, leasingAgent, propertyId, partyGroupId }, 'createNewParty - start');

  const { userId, teams, ownerTeam } = await getUserAndTeams(ctx, { leasingAgent, propertyId });
  const inFlightRenewalV1 = await getInFlightRenewalV1ByExternalIds(ctx, allReceivedMemberIds);

  const newParty = {
    userId,
    state: DALTypes.PartyStateType.RESIDENT,
    workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
    assignedPropertyId: propertyId,
    teams,
    partyGroupId,
    leaseType,
    ownerTeam,
    metadata: { firstContactChannel: DALTypes.ContactEventTypes.OTHER, isImported: true },
    ...(inFlightRenewalV1 && { partyGroupId: inFlightRenewalV1.partyGroupId }),
  };

  const party = await createParty(ctx, newParty);
  await logActiveLeasePartyCreated(ctx, party);
  await savePartyCreatedEvent(ctx, { partyId: party.id, userId, metadata: { sendResidentsInvite: true } });

  logger.trace({ ctx, residentImportTrackingId, primaryExternalId, userId, teams, ownerTeam, propertyId, partyGroupId }, 'createNewParty - done');
  return party;
};

const addChildToParty = async (ctx, partyId, data) => {
  const { id } = data;
  logger.trace({ ctx, partyId, id }, 'Adding child to Party_AdditionalInfo from imported data');
  const child = {
    partyId,
    type: AdditionalInfoTypes.CHILD,
    info: {
      fullName: removeSpaces([data.firstName, data.lastName].join(' ')),
      preferredName: removeSpaces(data.firstName),
    },
  };
  return await savePartyAdditionalInfo(ctx, child);
};

const getMemberType = (receivedResident, isCorporateParty) => {
  if (isCorporateParty && !receivedResident.isPrimary) {
    return DALTypes.MemberType.OCCUPANT;
  }

  return receivedResident.type === DALTypes.ExternalMemberType.GUARANTOR ? DALTypes.MemberType.GUARANTOR : DALTypes.MemberType.RESIDENT;
};

const buildPartyMember = async (ctx, { receivedResident, personId, isCorporateParty, isPrimary }) => {
  logger.trace({ ctx, receivedResident, personId }, 'buildPartyMember - start');

  let personData;
  let contactInfo;

  if (!personId) {
    personData = { fullName: getFullName(receivedResident) };
    contactInfo = await buildContactInfo(ctx, receivedResident);
  }

  const memberType = getMemberType({ ...receivedResident, isPrimary }, isCorporateParty);

  const memberData = {
    id: newId(),
    memberState: DALTypes.PartyStateType.RESIDENT,
    memberType,
    fullName: personData?.fullName || getFullName(receivedResident),
    personId,
    vacateDate: receivedResident.vacateDate,
  };

  return { ...memberData, contactInfo, person: personData };
};

const savePartyMember = async (ctx, { residentImportTrackingId, receivedResident, partyId, isResidentChild, personId, isCorporateParty, isPrimary }) => {
  logger.trace({ ctx, residentImportTrackingId, receivedResidentId: receivedResident.id, partyId, isResidentChild, personId }, 'savePartyMember - start');

  if (isResidentChild) {
    logger.trace(
      { ctx, residentImportTrackingId, receivedResident, partyId, isResidentChild, personId },
      'Resident is a child, will be added to additional party data',
    );
    return await addChildToParty(ctx, partyId, receivedResident);
  }

  const memberData = await buildPartyMember(ctx, { receivedResident, personId, isCorporateParty, isPrimary });

  if (memberData.contactInfo) {
    memberData.contactInfo.all = await getEnhancedContactInfoWithSmsInfo(ctx, personId, memberData.contactInfo.all);
  }

  const member = await createPartyMember(ctx, memberData, partyId, false);
  await logPartyMemberCreated(ctx, member);

  return member;
};

const shouldSkipMember = (ctx, { primaryResidentId, receivedResident, isCorporateParty, leaseStartDate, timezone }) => {
  const { type, vacateDate: residentVacateDate } = receivedResident;

  const isResidentVacatedBeforeLeaseStart =
    leaseStartDate && residentVacateDate && toMoment(residentVacateDate, { timezone }).isSameOrBefore(toMoment(leaseStartDate, { timezone }), 'day');
  if (isResidentVacatedBeforeLeaseStart) {
    logger.trace({ ctx, primaryResidentId, receivedResident, leaseStartDate }, 'The member was vacated before the lease start date');

    const reason = {
      message: 'The member was vacated before the lease start date',
      leaseStartDate,
      residentVacateDate,
    };

    return { shouldSkip: true, reason };
  }

  if (type === DALTypes.ExternalMemberType.OCCUPANT && !isCorporateParty) {
    logger.trace({ ctx, primaryResidentId, receivedResident }, 'The member is only an occupant, skipping import');

    const reason = {
      message: 'The member is an occupant in a traditional party and is not a child',
      type,
    };

    return { shouldSkip: true, reason };
  }

  return { shouldSkip: false, reason: {} };
};

const save = async (
  ctx,
  { entry, receivedResident, partyId, propertyId, personId, isCorporateParty, leasingAgent, allReceivedMemberIds, receivedExternalProspectId, partyGroupId },
) => {
  logger.trace({ ctx, residentImportTrackingId: entry.id, receivedResidentId: receivedResident.id, partyId, propertyId, personId }, 'save - start');

  const isPrimary = receivedResident.id === entry.primaryExternalId;
  const isResidentChild = checkIfChild(receivedResident.type);

  const targetPartyId =
    partyId ||
    (
      await createNewParty(ctx, {
        residentImportTrackingId: entry.id,
        primaryExternalId: entry.primaryExternalId,
        leasingAgent,
        partyGroupId,
        leaseType: isCorporateParty ? DALTypes.PartyTypes.CORPORATE : DALTypes.PartyTypes.TRADITIONAL,
        propertyId,
        allReceivedMemberIds,
      })
    ).id;

  const partyMember = await savePartyMember(ctx, {
    residentImportTrackingId: entry.id,
    receivedResident,
    partyId: targetPartyId,
    isResidentChild,
    personId,
    isCorporateParty,
    isPrimary,
  });

  const partyMemberId = isResidentChild ? null : partyMember.id;
  const childId = partyMemberId ? null : partyMember.id;
  const externalRoommateId = getExternalRoommateId(ctx, { externalId: receivedResident.id, isPrimary });

  await insertExternalInfo(ctx, {
    partyId: targetPartyId,
    partyMemberId,
    childId,
    externalProspectId: receivedExternalProspectId,
    externalId: externalRoommateId ? null : receivedResident.id,
    externalRoommateId,
    propertyId,
    isPrimary,
  });

  logger.trace(
    { ctx, residentImportTrackingId: entry.id, receivedResidentId: receivedResident.id, partyId: targetPartyId, propertyId, personId },
    'save - done',
  );
  return { targetPartyId };
};

const getDataForRules = async (ctx, { receivedResident, partyId, isInitialImport, allPartyMembers, allChildren }) => {
  let exceptionReportPersonData;
  let memberWithEmailMatchInTheSameParty;
  let memberWithPhoneMatchInTheSameParty;

  const { email, phone } = receivedResident;
  const formattedPhone = formatPhoneNumberForDb(phone);

  const { emailMatchFound, personMatchFound, nameAndPhoneMatchFound } = await checkMatchingPersonData(ctx, {
    email,
    phone: formattedPhone,
    receivedResident,
    externalId: receivedResident.id,
    isInitialImport,
  });

  if (emailMatchFound || nameAndPhoneMatchFound) {
    const partyMembersForEmailMatchPerson = emailMatchFound && (await getPartyMembersByPersonIds(ctx, [emailMatchFound.personId]));
    memberWithEmailMatchInTheSameParty = partyMembersForEmailMatchPerson?.length && partyMembersForEmailMatchPerson.find(pm => pm.partyId === partyId);

    const partyMembersForPhoneMatchFound = nameAndPhoneMatchFound && (await getPartyMembersByPersonIds(ctx, [nameAndPhoneMatchFound.personId]));
    memberWithPhoneMatchInTheSameParty = partyMembersForPhoneMatchFound?.length && partyMembersForPhoneMatchFound.find(pm => pm.partyId === partyId);

    const conflictingPerson = emailMatchFound ? await getPersonById(ctx, emailMatchFound.personId) : await getPersonById(ctx, nameAndPhoneMatchFound.personId);

    const { emails, phones } = getContactInfosValueByType(conflictingPerson.contactInfo?.all);
    exceptionReportPersonData = {
      personId: conflictingPerson.id,
      fullName: conflictingPerson.fullName,
      emails,
      phones,
    };
  }

  const sameMemberFoundInParty = checkMatchingPartyMember(receivedResident, allPartyMembers, allChildren);

  return {
    receivedExternalProspectId: receivedResident?.prospectId || null,
    emailMatchFound,
    personMatchFound,
    nameAndPhoneMatchFound,
    exceptionReportPersonData,
    memberWithEmailMatchInTheSameParty,
    memberWithPhoneMatchInTheSameParty,
    sameMemberFoundInParty,
  };
};

const rules = [
  {
    check: ({ personMatchFound, memberWithEmailMatchInTheSameParty, memberWithPhoneMatchInTheSameParty, sameMemberFoundInParty, nameAndPhoneMatchFound }) =>
      (personMatchFound && memberWithEmailMatchInTheSameParty) ||
      (nameAndPhoneMatchFound && memberWithPhoneMatchInTheSameParty) ||
      sameMemberFoundInParty?.childId,
    action: async (
      ctx,
      {
        entry,
        receivedResident,
        partyId,
        propertyId,
        memberWithEmailMatchInTheSameParty,
        receivedExternalProspectId,
        memberWithPhoneMatchInTheSameParty,
        sameMemberFoundInParty,
        personMatchFound,
        nameAndPhoneMatchFound,
      },
    ) => {
      const isPrimary = receivedResident.id === entry.primaryExternalId;
      const externalRoommateId = getExternalRoommateId(ctx, { externalId: receivedResident.id, isPrimary });
      const memberId = getMemberIdForExternalInfoUpdate({
        personMatchFound,
        nameAndPhoneMatchFound,
        sameMemberFoundInParty,
        memberWithEmailMatchInTheSameParty,
        memberWithPhoneMatchInTheSameParty,
      });

      await handleUpdatedExternalInfo(
        ctx,
        { partyId, memberId, propertyId },
        {
          externalId: externalRoommateId ? null : receivedResident.id,
          externalRoommateId,
          externalProspectId: receivedExternalProspectId,
          isPrimary,
          isChild: !!sameMemberFoundInParty?.childId,
        },
      );
      return { targetPartyId: partyId };
    },
  },
  {
    check: ({ personMatchFound }) => !!personMatchFound,
    action: async (
      ctx,
      {
        entry,
        receivedResident,
        partyId,
        propertyId,
        personMatchFound,
        isCorporateParty,
        leasingAgent,
        allReceivedMemberIds,
        receivedExternalProspectId,
        partyGroupId,
      },
    ) =>
      await save(ctx, {
        entry,
        receivedResident,
        partyId,
        propertyId,
        personId: personMatchFound.id,
        isCorporateParty,
        leasingAgent,
        allReceivedMemberIds,
        receivedExternalProspectId,
        partyGroupId,
      }),
  },
  {
    // row 7
    check: ({ emailMatchFound, memberWithEmailMatchInTheSameParty, personMatchFound }) =>
      emailMatchFound && !personMatchFound && !memberWithEmailMatchInTheSameParty,
    action: async (
      ctx,
      { entry, partyId, propertyId, receivedResident, isCorporateParty, leasingAgent, allReceivedMemberIds, receivedExternalProspectId, partyGroupId },
    ) =>
      await save(ctx, {
        entry,
        receivedResident,
        partyId,
        propertyId,
        isCorporateParty,
        leasingAgent,
        allReceivedMemberIds,
        receivedExternalProspectId,
        partyGroupId,
      }),
  },
  {
    // row 8, row 9
    check: ({ emailMatchFound, nameAndPhoneMatchFound }) => !!nameAndPhoneMatchFound && !emailMatchFound,
    action: async (
      ctx,
      {
        entry,
        receivedResident,
        partyId,
        propertyId,
        isCorporateParty,
        leasingAgent,
        allReceivedMemberIds,
        receivedExternalProspectId,
        partyGroupId,
        nameAndPhoneMatchFound,
      },
    ) =>
      await save(ctx, {
        entry,
        receivedResident,
        partyId,
        propertyId,
        isCorporateParty,
        leasingAgent,
        allReceivedMemberIds,
        receivedExternalProspectId,
        partyGroupId,
        personId: nameAndPhoneMatchFound.personId,
      }),
  },
  {
    check: () => true,
    action: async (
      ctx,
      { entry, receivedResident, partyId, propertyId, isCorporateParty, leasingAgent, allReceivedMemberIds, receivedExternalProspectId, partyGroupId },
    ) =>
      await save(ctx, {
        entry,
        receivedResident,
        partyId,
        propertyId,
        isCorporateParty,
        leasingAgent,
        allReceivedMemberIds,
        receivedExternalProspectId,
        partyGroupId,
      }),
  },
];

export const addMember = async (
  ctx,
  {
    renewalCycleStarted,
    renewalPartyId,
    entry,
    receivedResident,
    partyId,
    partyLeaseType,
    property,
    leasingAgent,
    isInitialImport,
    allPartyMembers,
    allChildren,
    partyGroupId,
  },
) => {
  logger.trace({ ctx, renewalCycleStarted, residentImportTrackingId: entry.id, receivedResident: receivedResident.id, partyId }, 'addMember - start');
  const { id: propertyId, timezone } = property;
  const validations = [];
  const isCorporateParty = partyLeaseType === DALTypes.LeaseType.CORPORATE;

  const allReceivedMemberIds = entry.rawData.members.map(member => member.id);

  try {
    const { shouldSkip, reason } = shouldSkipMember(ctx, {
      primaryResidentId: entry.primaryExternalId,
      receivedResident,
      isCorporateParty,
      leaseStartDate: entry.rawData.leaseStartDate,
      timezone,
    });

    if (shouldSkip) {
      logger.trace({ ctx, receivedResident, reason }, 'Skipping member');
      validations.push(reason);
      return { partyId };
    }

    if (renewalCycleStarted) {
      const externalInfos = await getAllExternalInfoByParty(ctx, renewalPartyId);

      if (!externalInfos.some(e => e.externalId === receivedResident.id)) {
        const allRenewalPartyMembers = renewalPartyId && (await getPartyMembersByPartyIds(ctx, [renewalPartyId], { excludeInactive: true }));
        const allRenewalChildren =
          renewalPartyId &&
          ((await getPartyAdditionalInfoByPartyId(ctx, renewalPartyId)) || []).filter(p => p.type === DALTypes.AdditionalPartyMemberType.CHILD && !p.endDate);

        const sameMemberFoundInParty = await checkMatchingPartyMember(receivedResident, allRenewalPartyMembers, allRenewalChildren);

        if (sameMemberFoundInParty.isMemberMatched) {
          const isPrimary = receivedResident.id === entry.primaryExternalId;
          const externalInfoForMatchMember = await getExternalInfoByExternalIdAndPartyId(ctx, receivedResident.id, renewalPartyId);

          if (!externalInfoForMatchMember || externalInfoForMatchMember.endDate) {
            await insertExternalInfoAndIgnorePreviousER(ctx, { sameMemberFoundInParty, receivedResident, renewalPartyId, isPrimary, propertyId, timezone });

            return { partyId };
          }
        }

        await createExceptionReport(
          ctx,
          { renewalCycleStarted, externalId: receivedResident.id, entry, partyId },
          PartyExceptionReportRules.NEW_RESIDENT_ADDED_AFTER_RENEWAL_START,
        );

        return { partyId };
      }
    }

    const dataForCheck = await getDataForRules(ctx, { receivedResident, partyId, isInitialImport, allPartyMembers, allChildren });

    const dataForAction = {
      ctx,
      entry,
      receivedResident,
      partyId,
      propertyId,
      ...dataForCheck,
      externalId: receivedResident.id,
      isCorporateParty,
      leasingAgent,
      partyGroupId,
      allReceivedMemberIds,
    };

    const ruleToExecute = rules.find(rule => !!rule.check({ ...dataForCheck, backendMode: ctx.backendMode }));
    const { targetPartyId } = (await ruleToExecute.action(ctx, dataForAction)) || {};

    logger.trace(
      { ctx, renewalCycleStarted, residentImportTrackingId: entry.id, receivedResident: receivedResident.id, partyId: targetPartyId },
      'addMember - done',
    );

    return { partyId: targetPartyId };
  } catch (error) {
    logger.error({ ctx, error, receivedResident }, 'Error on saveResident');
    throw error;
  }
};
