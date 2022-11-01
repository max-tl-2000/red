/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../../common/enums/DALTypes';
import loggerModule from '../../../../common/helpers/logger';
import {
  saveContactInfo,
  unmarkAsPrimaryContactInfo,
  markAsPrimaryContactInfo,
  getContactsInfoByEmail,
  getContactsInfoByPhone,
} from '../../../dal/contactInfoRepo';
import { createExceptionReport } from './exception-report';
import { updatePerson, getPersonById } from '../../../dal/personRepo';
import { checkMatchingPersonData, checkMatchingPartyMember } from './checks';
import {
  getFullName,
  getContactInfosValueByType,
  getEnhancedContactInfoWithSmsInfo,
  validatePhone,
  getExternalRoommateId,
  handleUpdatedExternalInfo,
  getPhoneNumberAndExtension,
} from './helpers';
import { formatPhoneNumberForDb } from '../../../helpers/phoneUtils';
import { isEmailValid } from '../../../../common/helpers/validations';
import { getPartyIdsByPersonIds } from '../../../dal/partyRepo';
import { addExceptionReportDetailsInEPMI } from '../../../../resident/server/dal/external-party-member-repo';
import { MemberExceptionReportRules, ExceptionReportMetadataReplacement } from '../../../helpers/exceptionReportRules';
import { saveContactInfoAddedEvent } from '../../partyEvent';
import { logPartyMemberUpdated } from '../../helpers/workflows';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';
import { now } from '../../../../common/helpers/moment-utils';

const logger = loggerModule.child({ subType: 'importActiveLeases' });

const updateName = async (ctx, { personId, receivedResident, hasPreferredName }) => {
  logger.trace({ ctx, personId, hasPreferredName }, 'updateName');

  const fullName = getFullName(receivedResident);

  const delta = {
    fullName,
    ...(hasPreferredName && { preferredName: fullName }),
  };

  await updatePerson(ctx, personId, delta);
};

const updateContactInfo = async (ctx, { personId, type, value, metadata, partyId, partyMemberId }) => {
  logger.trace({ ctx, personId, type, value }, 'updateContactInfo');
  await unmarkAsPrimaryContactInfo(ctx, personId, type);
  const enhancedContactInfo = enhance([{ type, value, metadata, imported: true, isPrimary: true }]);
  enhancedContactInfo.all = await getEnhancedContactInfoWithSmsInfo(ctx, personId, enhancedContactInfo.all);

  const savedContactInfo = await saveContactInfo(ctx, enhancedContactInfo.all, personId);

  const eventInfo = {
    partyId,
    partyMemberId,
    metadata: { personId },
  };
  const contactInfo = [{ value, type, id: savedContactInfo?.[0]?.id, isPrimary: true }];

  await saveContactInfoAddedEvent(ctx, eventInfo, contactInfo);
  return savedContactInfo;
};

const updateEmail = async (ctx, { personId, receivedResident, partyId, partyMemberId }) => {
  const isValidEmail = isEmailValid(receivedResident.email);
  const [existing] = await getContactsInfoByEmail(ctx, receivedResident.email);

  if (existing) {
    await unmarkAsPrimaryContactInfo(ctx, personId, DALTypes.ContactInfoType.EMAIL);
    await markAsPrimaryContactInfo(ctx, personId, DALTypes.ContactInfoType.EMAIL, existing.value);

    logger.trace({ ctx, externalId: receivedResident.id, email: receivedResident.email }, 'updateEmail - new email address marked as primary');
    return [];
  }

  if (!isValidEmail) {
    logger.error({ ctx, externalId: receivedResident.id, email: receivedResident.email }, 'updateEmail - invalid email');
    return [];
  }
  return await updateContactInfo(ctx, { personId, type: DALTypes.ContactInfoType.EMAIL, value: receivedResident.email, partyId, partyMemberId });
};

const updatePhone = async (ctx, { personId, receivedResident, partyId, partyMemberId }) => {
  const { phoneNumber, phoneNumberExtension } = getPhoneNumberAndExtension(receivedResident.phone);
  const { valid: isValidPhone } = validatePhone(phoneNumber);

  if (!isValidPhone) {
    logger.error({ ctx, externalId: receivedResident.id, phone: phoneNumber }, 'updatePhone - invalid phone');
    return [];
  }

  const formattedNumber = formatPhoneNumberForDb(phoneNumber);
  const contactsInfo = await getContactsInfoByPhone(ctx, formattedNumber);
  const existing = contactsInfo.find(ci => ci.personId === personId);
  if (existing) {
    await unmarkAsPrimaryContactInfo(ctx, personId, DALTypes.ContactInfoType.PHONE);
    await markAsPrimaryContactInfo(ctx, personId, DALTypes.ContactInfoType.PHONE, existing.value);

    logger.trace({ ctx, externalId: receivedResident.id, phone: formattedNumber }, 'updatePhone - new phone number marked as primary');
    return [];
  }

  return await updateContactInfo(ctx, {
    personId,
    type: DALTypes.ContactInfoType.PHONE,
    value: formattedNumber,
    metadata: phoneNumberExtension ? { phoneNumberExtension } : {},
    partyId,
    partyMemberId,
  });
};

// https://docs.google.com/spreadsheets/d/15QUzYj3TWxSxrm8Bw_Ai_vgt3uOsDResbfwznf5RJnQ/edit#gid=668724248
const rules = [
  {
    // Handle contact info switch in Yardi
    check: ({ backendMode, sameMemberFoundInParty, currentResidentMatched }) =>
      backendMode === DALTypes.BackendMode.YARDI && !currentResidentMatched && !!sameMemberFoundInParty.isMemberMatched,
    action: async (ctx, { entry, receivedResident, partyId, sameMemberFoundInParty, propertyId }) => {
      const isPrimary = entry.primaryExternalId === receivedResident.id;
      const externalRoommateId = getExternalRoommateId(ctx, { externalId: receivedResident.id, isPrimary });
      await handleUpdatedExternalInfo(
        ctx,
        { partyId, memberId: sameMemberFoundInParty.matchedPartyMemberId, propertyId },
        {
          externalId: externalRoommateId ? null : receivedResident.id,
          externalRoommateId,
          externalProspectId: receivedResident.prospectId,
          isPrimary,
          metadata: { isContactInfoSwitch: true },
        },
      );
      return { emails: [], phones: [] };
    },
  },
  {
    // row 10
    // Name: No update
    // Email: New email added and does not match any existing record
    // Phone: No update
    check: ({ nameUpdated, emailUpdated, newEmailExists, phoneUpdated }) =>
    /* Name:  */ !nameUpdated &&                      // eslint-disable-line
    /* Email: */ (emailUpdated && !newEmailExists) && // eslint-disable-line
    /* Phone: */ !phoneUpdated,                       // eslint-disable-line
    action: async (ctx, { personId, receivedResident, partyId, partyMemberId }) => {
      const emails = await updateEmail(ctx, { personId, receivedResident, partyId, partyMemberId });
      return { emails, phones: [] };
    },
  },
  {
    // row 11
    // Name: No update
    // Email: No update
    // Phone: New phone added and does not match any existing record
    check: ({ nameUpdated, emailUpdated, phoneUpdated, newPhoneExists }) =>
    /* Name:  */ !nameUpdated &&  // eslint-disable-line
    /* Email: */ !emailUpdated && // eslint-disable-line
    /* Phone: */ phoneUpdated && !newPhoneExists,   // eslint-disable-line
    action: async (ctx, { personId, receivedResident, partyId, partyMemberId }) => {
      const phones = await updatePhone(ctx, { personId, receivedResident, partyId, partyMemberId });
      return { emails: [], phones };
    },
  },
  {
    // row 12
    // Name: No update
    // Email: New email added and does not match any existing record
    // Phone: New phone added and does not match any existing record
    check: ({ nameUpdated, emailUpdated, newEmailExists, phoneUpdated, newPhoneExists }) =>
      /* Name:  */ !nameUpdated && // eslint-disable-line
      /* Email: */ emailUpdated &&
      !newEmailExists &&
      /* Phone: */ phoneUpdated &&
      !newPhoneExists,
    action: async (ctx, { personId, receivedResident, partyId, partyMemberId }) => {
      const emails = await updateEmail(ctx, { personId, receivedResident, partyId, partyMemberId });
      const phones = await updatePhone(ctx, { personId, receivedResident, partyId, partyMemberId });
      return { emails, phones };
    },
  },
  {
    // row 13
    // Name: Updated and does not match any existing record
    // Email: No update OR New that does not match an existing record
    // Phone: No update OR New that does not match an existing record
    check: ({ nameUpdated, newNameExists, emailUpdated, newEmailExists, phoneUpdated, newPhoneExists }) =>
      /* Name:  */ nameUpdated && !newNameExists && // eslint-disable-line
      /* Email: */ (!emailUpdated || (emailUpdated && !newEmailExists)) &&
      /* Phone: */ (!phoneUpdated || (phoneUpdated && !newPhoneExists)),
    action: async (
      ctx,
      {
        personId,
        receivedResident,
        renewalCycleStarted,
        emailUpdated,
        phoneUpdated,
        hasPreferredName,
        entry,
        partyId,
        exceptionReportPersonData,
        externalId,
        partyMemberId,
      },
    ) => {
      if (renewalCycleStarted) {
        await createExceptionReport(
          ctx,
          { entry, partyId, exceptionReportPersonData, externalId },
          MemberExceptionReportRules.NAME_UPDATED_AFTER_RENEWAL_START,
        );
        return { emails: [], phones: [] };
      }
      await updateName(ctx, { personId, receivedResident, hasPreferredName });
      const emails = emailUpdated && (await updateEmail(ctx, { personId, receivedResident, partyId, partyMemberId }));
      const phones = phoneUpdated && (await updatePhone(ctx, { personId, receivedResident, partyId, partyMemberId }));
      return { emails: !emails?.length ? [] : emails, phones: !phones?.length ? [] : phones };
    },
  },
  {
    // row 14
    // Name: Does not matter
    // Email: New email added that matches an existing record
    // Phone: Does not matter
    check: ({ emailUpdated, newEmailExists, emailMatchFoundInSameParty }) => emailUpdated && newEmailExists && !emailMatchFoundInSameParty,
    action: async (ctx, { entry }) => {
      logger.trace({ ctx, residentImportTrackingId: entry.id }, 'updatePersonData - email updated to an existing value');
      return { emails: [], phones: [] };
    },
  },
  {
    // row 15
    // Name: No update
    // Email: No update
    // Phone: New phone added and matches an existing record
    check: ({ nameUpdated, emailUpdated, phoneUpdated, newPhoneExists }) =>
      /* Name:  */ !nameUpdated && // eslint-disable-line
      /* Email: */ !emailUpdated &&
      /* Phone: */ phoneUpdated &&
      newPhoneExists,
    action: async (ctx, { personId, receivedResident, partyId, partyMemberId }) => {
      const phones = await updatePhone(ctx, { personId, receivedResident, partyId, partyMemberId });
      return { emails: [], phones };
    },
  },
  {
    // row 16
    // Name: Updated and matches another existing record
    // Email: No update OR New that does not match an existing record
    // Phone: No update OR New that does not match an existing record
    check: ({ nameUpdated, newNameExists, emailUpdated, newEmailExists, phoneUpdated, newPhoneExists }) =>
      /* Name:  */ nameUpdated && newNameExists && // eslint-disable-line
      /* Email: */ (!emailUpdated || (emailUpdated && !newEmailExists)) &&
      /* Phone: */ (!phoneUpdated || (phoneUpdated && !newPhoneExists)),
    action: async (
      ctx,
      {
        personId,
        receivedResident,
        renewalCycleStarted,
        emailUpdated,
        hasPreferredName,
        entry,
        partyId,
        exceptionReportPersonData,
        phoneUpdated,
        externalId,
        partyMemberId,
      },
    ) => {
      if (renewalCycleStarted) {
        await createExceptionReport(
          ctx,
          { entry, partyId, exceptionReportPersonData, externalId },
          MemberExceptionReportRules.NAME_UPDATED_AFTER_RENEWAL_START,
        );
        return { emails: [], phones: [] };
      }
      await updateName(ctx, { personId, receivedResident, hasPreferredName });
      const emails = emailUpdated && (await updateEmail(ctx, { personId, receivedResident, partyId, partyMemberId }));
      const phones = phoneUpdated && (await updatePhone(ctx, { personId, receivedResident, partyId, partyMemberId }));
      return { emails: !emails?.length ? [] : emails, phones: !phones?.length ? [] : phones };
    },
  },
  {
    // row 17
    // Name: Updated and matches another existing record
    // Email: No update
    // Phone: New phone added that matches another existing record
    check: ({ nameUpdated, phoneUpdated, nameAndPhoneMatchFound, emailUpdated }) =>
      /* Name: */ nameUpdated &&    // eslint-disable-line
      /* Email: */ !emailUpdated && // eslint-disable-line
      /* Phone: */ phoneUpdated &&  // eslint-disable-line
      /* Name and Phone match found */ !!nameAndPhoneMatchFound, // eslint-disable-line
    action: async (
      ctx,
      { personId, receivedResident, renewalCycleStarted, hasPreferredName, entry, partyId, exceptionReportPersonData, externalId, partyMemberId },
    ) => {
      if (renewalCycleStarted) {
        await createExceptionReport(
          ctx,
          { entry, partyId, exceptionReportPersonData, externalId },
          MemberExceptionReportRules.RESIDENT_UPDATE_WITH_EXISTING_NAME_AND_PHONE,
        );
        return { emails: [], phones: [] };
      }
      await updateName(ctx, { personId, receivedResident, hasPreferredName });
      const phones = await updatePhone(ctx, { personId, receivedResident, partyId, partyMemberId });
      return { emails: [], phones };
    },
  },
  {
    // row 18
    // Email: Existing value CLEARED
    check: ({ emailCleared }) => !!emailCleared,
    action: async (ctx, { externalId }) => {
      const date = now().format(YEAR_MONTH_DAY_FORMAT);
      await addExceptionReportDetailsInEPMI(ctx, { externalId, replacementData: ExceptionReportMetadataReplacement.EMAIL_CLEARED, date });
      return { emails: [], phones: [] };
    },
  },
  {
    // row 18
    // Phone: Existing value CLEARED
    check: ({ phoneCleared }) => !!phoneCleared,
    action: async (ctx, { externalId }) => {
      const date = now().format(YEAR_MONTH_DAY_FORMAT);
      await addExceptionReportDetailsInEPMI(ctx, { externalId, replacementData: ExceptionReportMetadataReplacement.PHONE_CLEARED, date });
      return { emails: [], phones: [] };
    },
  },
];

const getDataForRules = async (ctx, { receivedResident, existingMember, partyId, allPartyMembers }) => {
  let exceptionReportPersonData;
  let emailMatchFoundInSameParty;
  const { email: receivedEmail, phone: receivedPhone } = receivedResident;
  const isPersonPointOfContact = !!existingMember.companyId;

  const formattedReceivedPhone = formatPhoneNumberForDb(receivedPhone);
  const receivedFullName = getFullName(receivedResident);
  const nameUpdated =
    existingMember.fullName && receivedFullName && existingMember.fullName.toLowerCase() !== receivedFullName.toLowerCase() && !isPersonPointOfContact;
  const hasPreferredName = !!existingMember.preferredName;

  const existingEmails = existingMember.contactInfo.emails;
  const emailUpdated =
    !!receivedEmail &&
    !existingEmails.some(existingEmail => existingEmail.value === receivedEmail.toLowerCase() && existingEmail.isPrimary) &&
    !isPersonPointOfContact;
  const emailCleared = !!existingEmails.length && !receivedEmail;

  const existingPhones = existingMember.contactInfo.phones;
  const phoneUpdated = receivedPhone && !existingPhones.some(existingPhone => existingPhone.value === formattedReceivedPhone && existingPhone.isPrimary);
  const phoneCleared = existingPhones.length && !receivedPhone;

  const { emails: previousEmails, phones: previousPhones } = getContactInfosValueByType(existingMember.contactInfo.all);

  exceptionReportPersonData = {
    personId: existingMember.personId,
    fullName: existingMember.fullName,
    emails: previousEmails,
    phones: previousPhones,
  };

  const {
    emailMatchFound: newEmailExists,
    phoneMatchFound: newPhoneExists,
    nameMatchFound: newNameExists,
    nameAndPhoneMatchFound,
  } = await checkMatchingPersonData(ctx, {
    email: receivedEmail,
    phone: formattedReceivedPhone,
    receivedResident,
    personId: existingMember.personId,
  });

  if (newEmailExists || nameAndPhoneMatchFound) {
    const partyIdsForEmailMatchPerson = newEmailExists && (await getPartyIdsByPersonIds(ctx, [newEmailExists.personId]));
    emailMatchFoundInSameParty = partyIdsForEmailMatchPerson?.length && partyIdsForEmailMatchPerson.find(id => id === partyId);
    const conflictingPerson = newEmailExists ? await getPersonById(ctx, newEmailExists.personId) : await getPersonById(ctx, nameAndPhoneMatchFound.personId);

    const { emails, phones } = getContactInfosValueByType(conflictingPerson.contactInfo?.all);
    exceptionReportPersonData = {
      personId: conflictingPerson.id,
      fullName: conflictingPerson.fullName,
      emails,
      phones,
    };
  }

  const coResidents = allPartyMembers.filter(pm => pm.id !== existingMember.id);
  const { isMemberMatched: currentResidentMatched } = checkMatchingPartyMember(receivedResident, [existingMember]);
  const sameMemberFoundInParty = checkMatchingPartyMember(receivedResident, coResidents);

  return {
    hasPreferredName,
    nameUpdated,
    newNameExists,
    emailUpdated,
    newEmailExists,
    emailCleared,
    phoneUpdated,
    newPhoneExists,
    nameAndPhoneMatchFound,
    phoneCleared,
    exceptionReportPersonData,
    emailMatchFoundInSameParty,
    sameMemberFoundInParty,
    currentResidentMatched,
  };
};

export const updatePersonData = async (
  ctx,
  { renewalCycleStarted, receivedResident, existingMember, entry, partyId, renewalPartyId, allPartyMembers, property },
) => {
  logger.trace({ ctx, residentImportTrackingId: entry.id }, 'updatePersonData - start');
  const dataForCheck = await getDataForRules(ctx, { receivedResident, existingMember, partyId, allPartyMembers });

  const dataForAction = {
    ctx,
    personId: existingMember.personId,
    partyMemberId: existingMember.id,
    receivedResident,
    renewalCycleStarted,
    partyId: renewalPartyId || partyId,
    entry,
    propertyId: property.id,
    externalId: receivedResident.id,
    ...dataForCheck,
  };

  const ruleToExecute = rules.find(rule => !!rule.check({ ...dataForCheck, backendMode: ctx.backendMode }));
  if (!ruleToExecute) return;
  const { emails, phones } = await ruleToExecute.action(ctx, dataForAction);
  if (emails.length || phones.length) {
    await logPartyMemberUpdated(ctx, { partyId, emails, phones, existingMember });
  }
};
