/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { createExceptionReport } from './exception-report';
import { getOneWhere } from '../../../database/factory';
import {
  updatePartyMember,
  removeGuaranteedByLink,
  getCorrespondingRenewalPartyMember,
  updateCompany,
  createPartyMember,
  getCompanyByDisplayName,
  updateCompanyIdForPartyMember,
} from '../../../dal/partyRepo';
import { updateExternalInfo, reviveExternalPartyMemberInfoById, getActiveExternalInfoByPartyMember, insertExternalInfo } from '../../../dal/exportRepo';
import { markLastExceptionReportAsIgnored } from '../../../dal/exceptionReportRepo';
import loggerModule from '../../../../common/helpers/logger';
import { now, isSameDay } from '../../../../common/helpers/moment-utils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';
import { MemberExceptionReportRules, ExceptionReportIgnoreReasons, ExceptionReportMetadataReplacement } from '../../../helpers/exceptionReportRules';
import {
  getContactInfosValueByType,
  isLeaseMoveOutComplete,
  parseDate,
  getFullName,
  removeResident,
  buildContactInfo,
  getEnhancedContactInfoWithSmsInfo,
} from './helpers';
import { isResident } from '../../../../common/helpers/party-utils';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { addExceptionReportDetailsInEPMI } from '../../../../resident/server/dal/external-party-member-repo';
import { logPartyMemberCreated, logPartyMemberMoved } from '../../helpers/workflows';
import { getContactsInfoByEmail } from '../../../dal/contactInfoRepo';

const logger = loggerModule.child({ subType: 'importActiveLeases' });

const companyNamesMatch = (companyName, receivedResident) => {
  const receivedCompanyName = getFullName(receivedResident);
  if (!receivedCompanyName) return true;

  return (
    companyName.toLowerCase() === receivedCompanyName.toLowerCase() ||
    companyName.toLowerCase() === receivedResident.firstName.toLowerCase() ||
    companyName.toLowerCase() === receivedResident.lastName.toLowerCase()
  );
};

const checkAndUpdateCompany = async (ctx, dbMember, receivedResident) => {
  logger.trace({ ctx }, 'checkAndUpdateCompany');
  const newCompanyDisplayName =
    receivedResident.firstName.toLowerCase() === receivedResident.lastName.toLowerCase() ? receivedResident.firstName : getFullName(receivedResident);
  const newCompanyNameMatch = await getCompanyByDisplayName(ctx, newCompanyDisplayName);

  if (newCompanyNameMatch) {
    logger.trace({ ctx }, 'Company name updated to one of an existing different company, updating companyId for member');

    await updateCompanyIdForPartyMember(ctx, dbMember.id, newCompanyNameMatch.id);
    return;
  }
  await updateCompany(ctx, {
    id: dbMember.companyId,
    displayName: newCompanyDisplayName,
  });
};

const getDataForCheck = (ctx, { primaryExternalId, externalInfo, isCorporateParty, receivedResident, dbMember, timezone, entry, renewalCycleStarted }) => {
  logger.trace({ ctx, primaryExternalId, externalId: receivedResident.id, memberId: dbMember.id }, 'member-update - getDataForCheck');
  let companyName;
  let companyNameUpdated;
  let pointOfContactEmailUpdated;
  const { leaseVacateDate } = entry.rawData;
  const { vacateDate: receivedVacateDate, email: receivedEmail } = receivedResident;
  const { vacateDate: dbVacateDate } = dbMember;
  const isNewPrimary = !externalInfo.isPrimary && externalInfo.externalId === primaryExternalId;
  const wasPrimary = externalInfo.isPrimary && externalInfo.externalId !== primaryExternalId;

  const receivedLeaseVacateDate = leaseVacateDate && parseDate(leaseVacateDate, timezone);
  const receivedResidentVacateDate = receivedVacateDate && parseDate(receivedVacateDate, timezone);
  const newResidentVacateDate =
    receivedResidentVacateDate && isLeaseMoveOutComplete(entry) && isSameDay(receivedLeaseVacateDate, receivedResidentVacateDate, { timezone })
      ? null
      : receivedResidentVacateDate;

  const vacateDateReceived = !dbVacateDate && newResidentVacateDate;
  const vacateDateRemoved = dbVacateDate && !newResidentVacateDate;
  const memberVacateDateChanged =
    vacateDateRemoved || vacateDateReceived || (dbVacateDate && newResidentVacateDate && !isSameDay(dbVacateDate, newResidentVacateDate, { timezone }));

  const memberTypeChanged =
    (dbMember.memberType === DALTypes.MemberType.RESIDENT && receivedResident.type === DALTypes.ExternalMemberType.GUARANTOR) ||
    (dbMember.memberType === DALTypes.MemberType.GUARANTOR && receivedResident.type === DALTypes.ExternalMemberType.RESIDENT);

  const { emails: previousEmails, phones: previousPhones } = getContactInfosValueByType(dbMember.contactInfo.all);

  if (isCorporateParty && dbMember.companyId) {
    companyName = dbMember.displayName;
    companyNameUpdated = companyName && !companyNamesMatch(companyName, receivedResident);

    const existingEmails = dbMember.contactInfo.emails;
    pointOfContactEmailUpdated =
      !!receivedEmail && !existingEmails.some(existingEmail => existingEmail.value === receivedEmail.toLowerCase() && existingEmail.isPrimary);
  }

  const exceptionReportPersonData = {
    personId: dbMember.personId,
    fullName: dbMember.fullName,
    companyName: isCorporateParty && companyName,
    renewalCycleStarted,
    emails: previousEmails,
    phones: previousPhones,
  };

  return {
    isNewPrimary,
    wasPrimary,
    memberTypeChanged,
    memberVacateDateChanged,
    newResidentVacateDate,
    exceptionReportPersonData,
    pointOfContactEmailUpdated,
    companyNameUpdated,
  };
};

const markAsPrimary = async (ctx, primaryExternalId, externalInfo) => {
  logger.trace({ ctx, primaryExternalId, externalInfo }, 'markAsPrimary');
  await updateExternalInfo(ctx, { ...externalInfo, isPrimary: true });
};

const unmarkAsPrimary = async (ctx, primaryExternalId, externalInfo) => {
  logger.trace({ ctx, primaryExternalId, externalInfo }, 'unmarkAsPrimary');
  await updateExternalInfo(ctx, { ...externalInfo, isPrimary: false });
};

const updateType = async (ctx, receivedResident, dbMember) => {
  logger.trace({ ctx, receivedResident, dbMember }, 'updatePartyMemberType');
  let initialMemberType;
  const member = await getOneWhere(ctx.tenantId, 'PartyMember', { id: dbMember.id });
  if (isResident(member)) {
    member.memberType = DALTypes.MemberType.GUARANTOR;
    member.guaranteedBy = null;
    initialMemberType = DALTypes.MemberType.RESIDENT;
  } else {
    await removeGuaranteedByLink(ctx, member.partyId, member.id);
    member.memberType = DALTypes.MemberType.RESIDENT;
    initialMemberType = DALTypes.MemberType.GUARANTOR;
  }
  await updatePartyMember(ctx, dbMember.id, member);

  await logPartyMemberMoved(ctx, { receivedResident, to: member.memberType, from: initialMemberType, dbMember });
};

const getRenewalPartyMember = async (ctx, dbMember) => {
  logger.trace({ ctx, dbMemberId: dbMember.id }, 'getRenewalPartyMember');

  return await getCorrespondingRenewalPartyMember(ctx, dbMember.personId);
};

const updateVacateDate = async (ctx, { newResidentVacateDate, dbMember, externalInfoId }) => {
  logger.trace({ ctx, newResidentVacateDate, dbMember }, 'updateResidentVacateDate');
  const member = await getOneWhere(ctx.tenantId, 'PartyMember', { id: dbMember.id });
  member.vacateDate = newResidentVacateDate;
  if (!newResidentVacateDate) {
    member.endDate = null;
    await reviveExternalPartyMemberInfoById(ctx, externalInfoId);
  }
  await updatePartyMember(ctx, dbMember.id, member);
};

const updateVacateDateDuringRenewalCycle = async (
  ctx,
  { newResidentVacateDate, exceptionReportPersonData, externalInfo, receivedResident, dbMember, partyId, entry },
) => {
  const correspondingRenewalPartyMember = await getRenewalPartyMember(ctx, dbMember);

  if (!correspondingRenewalPartyMember) return;
  await updateVacateDate(ctx, { newResidentVacateDate, dbMember: correspondingRenewalPartyMember, externalInfoId: externalInfo.id });

  if (correspondingRenewalPartyMember.endDate) {
    const ignoreReason = {
      date: now().format(YEAR_MONTH_DAY_FORMAT),
      reason: ExceptionReportIgnoreReasons.PERSON_ALREADY_REMOVED_FROM_RENEWAL.description,
    };

    await markLastExceptionReportAsIgnored(ctx, {
      externalId: receivedResident.id,
      ignoreReason,
      ruleId: ExceptionReportIgnoreReasons.PERSON_ALREADY_REMOVED_FROM_RENEWAL.ruleId,
    });
  } else {
    await createExceptionReport(
      ctx,
      { entry, exceptionReportPersonData, externalId: receivedResident.id, partyId },
      MemberExceptionReportRules.OCCUPANT_VACATE_DATE_UPDATED_AFTER_RENEWAL_START,
    );
  }
};

const updateCorporatePointOfContact = async (ctx, { dbMember, receivedResident, propertyId }) => {
  logger.trace({ ctx, receivedResident, dbMember }, 'updateCorporatePointOfContact');
  let personData;
  let contactInfo;

  const dbMemberExternalInfo = await getActiveExternalInfoByPartyMember(ctx, dbMember.id);
  await removeResident(ctx, [dbMemberExternalInfo], dbMember.id);

  const { personId } = (await getContactsInfoByEmail(ctx, receivedResident.email))[0] || {};

  if (!personId) {
    contactInfo = await buildContactInfo(ctx, receivedResident);
  }

  const memberData = {
    id: newId(),
    memberState: DALTypes.PartyStateType.RESIDENT,
    memberType: DALTypes.MemberType.RESIDENT,
    personId,
    vacateDate: receivedResident.vacateDate,
    contactInfo,
    person: personData,
    companyId: dbMember.companyId,
  };

  if (memberData.contactInfo) {
    memberData.contactInfo.all = await getEnhancedContactInfoWithSmsInfo(ctx, personId, memberData.contactInfo.all);
  }

  const member = await createPartyMember(ctx, memberData, dbMember.partyId, false);
  await logPartyMemberCreated(ctx, member);

  await insertExternalInfo(ctx, {
    partyId: dbMember.partyId,
    partyMemberId: member.id,
    childId: null,
    externalProspectId: receivedResident?.prospectId || null,
    externalId: receivedResident.id,
    externalRoommateId: null,
    propertyId,
    isPrimary: true,
  });
};

export const updateMemberData = async (ctx, { renewalCycleStarted, externalInfo, receivedResident, partyLeaseType, dbMember, property, partyId, entry }) => {
  const { id: residentImportTrackingId, primaryExternalId } = entry;
  logger.trace(
    { ctx, residentImportTrackingId, renewalCycleStarted, primaryExternalId, externalInfoId: externalInfo.id, memberId: dbMember.id, partyId },
    'updateMemberData - start',
  );

  const isCorporateParty = partyLeaseType === DALTypes.LeaseType.CORPORATE;

  const {
    isNewPrimary,
    wasPrimary,
    memberTypeChanged,
    memberVacateDateChanged,
    newResidentVacateDate,
    exceptionReportPersonData,
    pointOfContactEmailUpdated,
    companyNameUpdated,
  } = getDataForCheck(ctx, {
    primaryExternalId,
    externalInfo,
    isCorporateParty,
    receivedResident,
    dbMember,
    timezone: property.timezone,
    entry,
    renewalCycleStarted,
  });

  if (renewalCycleStarted) {
    isNewPrimary && (await markAsPrimary(ctx, primaryExternalId, externalInfo));
    wasPrimary && (await unmarkAsPrimary(ctx, primaryExternalId, externalInfo));
    if (memberTypeChanged) {
      const date = now().format(YEAR_MONTH_DAY_FORMAT);
      await addExceptionReportDetailsInEPMI(ctx, {
        externalId: receivedResident.id,
        replacementData: ExceptionReportMetadataReplacement.MEMBER_TYPE_CHANGED_AFTER_RENEWAL_START,
        date,
      });
    }
    memberVacateDateChanged &&
      (await updateVacateDateDuringRenewalCycle(ctx, {
        newResidentVacateDate,
        exceptionReportPersonData,
        externalInfo,
        receivedResident,
        dbMember,
        partyId,
        entry,
      }));
    (companyNameUpdated || pointOfContactEmailUpdated) &&
      (await createExceptionReport(
        ctx,
        { entry, exceptionReportPersonData, externalId: receivedResident.id, partyId },
        MemberExceptionReportRules.CORPORATE_EMAIL_AND_NAME_UPDATED,
      ));
  } else {
    companyNameUpdated &&
      pointOfContactEmailUpdated &&
      (await createExceptionReport(
        ctx,
        { entry, exceptionReportPersonData, externalId: receivedResident.id, partyId },
        MemberExceptionReportRules.CORPORATE_EMAIL_AND_NAME_UPDATED,
      ));
    companyNameUpdated && !pointOfContactEmailUpdated && (await checkAndUpdateCompany(ctx, dbMember, receivedResident));
    !companyNameUpdated && pointOfContactEmailUpdated && (await updateCorporatePointOfContact(ctx, { dbMember, receivedResident, propertyId: property.id }));

    isNewPrimary && (await markAsPrimary(ctx, primaryExternalId, externalInfo));
    wasPrimary && (await unmarkAsPrimary(ctx, primaryExternalId, externalInfo));
    memberTypeChanged && (await updateType(ctx, receivedResident, dbMember));
    memberVacateDateChanged && (await updateVacateDate(ctx, { newResidentVacateDate, dbMember, externalInfoId: externalInfo.id }));
  }
};
