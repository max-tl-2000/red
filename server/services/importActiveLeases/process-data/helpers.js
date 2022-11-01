/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isEqual from 'lodash/isEqual';
import { DALTypes } from '../../../../common/enums/DALTypes';
import trim from '../../../../common/helpers/trim';
import { now, toMoment, parseAsInTimezone } from '../../../../common/helpers/moment-utils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';
import loggerModule from '../../../../common/helpers/logger';
import { archiveParty } from '../../party';
import { validatePhone as validatePhoneNumber, getOnlyDigitsFromPhoneNumber } from '../../../../common/helpers/phone-utils';
import config from '../../../config';
import { enhanceContactInfoWithSmsInfo } from '../../telephony/twilio';
import { removeSpaces } from '../../../dal/helpers/person';
import { getActiveLeaseWorkflowDataByPartyId } from '../../../dal/activeLeaseWorkflowRepo';
import { archiveExternalInfoByPartyMemberId, insertExternalInfo } from '../../../dal/exportRepo';
import { ExceptionReportIgnoreReasons } from '../../../helpers/exceptionReportRules';
import { markLastExceptionReportAsIgnored } from '../../../dal/exceptionReportRepo';
import { markMemberAsRemoved, removePartyAdditionalInfo } from '../../../dal/partyRepo';
import { archiveExternalInfo } from '../../externalPartyMemberInfo';
import { logPartyMemberRemoved } from '../../helpers/workflows';
import { getContactsInfoByEmail } from '../../../dal/contactInfoRepo';
import { isEmailValid } from '../../../../common/helpers/validations';
import { formatPhoneNumberForDb } from '../../../helpers/phoneUtils';
import { enhance } from '../../../../common/helpers/contactInfoUtils';

const logger = loggerModule.child({ subType: 'importActiveLeases' });
export const baseRentChargeCode = 'RNT';

export const shouldOverrideContactInfo = config.import.overrideContactInfo;

export const cleanAndFormatName = fullName => {
  const formattedfullName = fullName
    // remove anything between parentheses and nested parentheses
    .replace(/\s+\(.*\)\s+/g, ' ')
    // remove everything after (in case parenthesis is not closed)
    .replace(/\(.*$/g, ' ')
    // remove other symbols and numbers
    .replace(/[|#^!?%*_={}:"&;$%@"-<>.~+,0-9]/g, ' ')
    // multiple spaces into one
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .join('%');

  return `%${formattedfullName}%`;
};
export const cleanAndFormatRevaName = fullname => cleanAndFormatName(fullname).replace(/%/g, ' ');

export const getFullName = receivedResident =>
  removeSpaces([receivedResident.firstName, receivedResident.middleInitial, receivedResident.lastName].filter(x => x).join(' '));

export const getFormattedNamesForQuery = receivedResident => {
  const nameWithMiddleInitial = cleanAndFormatName(
    [receivedResident.firstName, receivedResident.middleInitial, receivedResident.lastName].filter(x => x).join(' '),
  );
  const nameWithoutMiddleInitial = cleanAndFormatName([receivedResident.firstName, receivedResident.lastName].filter(x => x).join(' '));
  return { nameWithMiddleInitial, nameWithoutMiddleInitial };
};

export const getRecurringCharges = charges => charges.filter(c => c.code !== baseRentChargeCode && parseInt(c.amount, 10) > 0);
export const getConcessions = charges => charges.filter(c => c.code !== baseRentChargeCode && parseInt(c.amount, 10) < 0);

export const parseDate = (date, timezone) => parseAsInTimezone(date, { format: YEAR_MONTH_DAY_FORMAT, timezone }).toISOString();

export const getFormattedCharges = (charges, timezone) =>
  charges.map(({ code, description, amount, startDate, quantity, endDate }) => ({
    code,
    description: '',
    displayName: description,
    amount: amount > 0 ? amount : amount * -1,
    startDate: parseDate(startDate, timezone),
    endDate: endDate ? parseDate(endDate, timezone) : null,
    quantity: quantity || 1,
  }));

export const getContactInfosValueByType = contactInfo => {
  const emails = contactInfo
    .filter(ci => ci.type === DALTypes.ContactInfoType.EMAIL)
    .map(email => email.value)
    .sort();
  const phones = contactInfo
    .filter(ci => ci.type === DALTypes.ContactInfoType.PHONE)
    .map(phone => phone.value)
    .sort();
  return { emails, phones };
};

export const getDeletedMembersFromImport = (revaResidents, receivedResidents) => {
  const deletedResidentsIds = [];
  const deletedChildrenIds = [];

  revaResidents.forEach(revaResident => {
    const receivedResident = receivedResidents.find(e => e.id === revaResident.externalId || e.id === revaResident.externalRoommateId);
    if (!receivedResident) {
      if (revaResident.childId) {
        deletedChildrenIds.push(revaResident.childId);
        return;
      }
      deletedResidentsIds.push(revaResident.partyMemberId);
    }
  });
  return { deletedResidentsIds, deletedChildrenIds };
};

const getInventoryExternalId = (propertyExternalId, buildingId, unitId) => (buildingId ? [propertyExternalId, buildingId, unitId].join('-') : unitId);

export const getInventoryByExternalId = (inventories, propertyExternalId, buildingId, unitId) => {
  const receivedInventoryExtId = getInventoryExternalId(propertyExternalId, buildingId, unitId);
  return (
    inventories.find(i =>
      buildingId
        ? getInventoryExternalId(i.propertyExternalId, i.buildingExternalId, i.inventoryExternalId) === receivedInventoryExtId
        : i.inventoryExternalId === receivedInventoryExtId,
    ) || {}
  );
};

export const isLeaseMoveInComplete = entry => {
  const { status } = entry.rawData;
  return status === DALTypes.PartyStateType.RESIDENT;
};

export const isRenewalLetterSent = data => {
  const { wasExternalRenewalLetterSent } = data;
  return wasExternalRenewalLetterSent === 'Y';
};

export const isPartyMovingOut = entry => entry.rawData.leaseVacateDate || entry.rawData.isUnderEviction;

export const isLeaseMoveOutComplete = entry => {
  const { status } = entry.rawData;
  return status === DALTypes.PartyStateType.PASTRESIDENT;
};

export const getPartyWorkflow = (partyWorkflows, workflowName, forceSync = false) => {
  const filteredWorkflows = forceSync
    ? partyWorkflows.filter(item => item.workflowName === workflowName)
    : partyWorkflows.filter(item => item.workflowName === workflowName && item.workflowState === DALTypes.WorkflowState.ACTIVE);

  const enhancedSortedWorkflows = filteredWorkflows
    .map(item => ({
      ...item,
      createdAt: item.seedPartyCreatedAt || item.createdAt,
    }))
    .sort((a, b) => -toMoment(a.createdAt).diff(toMoment(b.createdAt)));

  const activeWorkflow = (enhancedSortedWorkflows || []).find(item => item.workflowState === DALTypes.WorkflowState.ACTIVE);

  return activeWorkflow || enhancedSortedWorkflows[0];
};

export const isLeaseMoveInNotCompleted = entry => {
  const { status } = entry.rawData;
  return status === DALTypes.PartyStateType.FUTURERESIDENT;
};

export const getEnhancedContactInfoWithSmsInfo = async (ctx, personId, contactInfos) => {
  try {
    return !shouldOverrideContactInfo ? await enhanceContactInfoWithSmsInfo(ctx, contactInfos) : contactInfos;
  } catch (error) {
    logger.error({ ctx, personId }, 'getEnhancedContactInfoWithSmsInfo - error');
    return contactInfos;
  }
};

export const validatePhone = phone => (shouldOverrideContactInfo ? { valid: true } : validatePhoneNumber(phone));

const overrideEmail = email => {
  const emailSubstr = email.substring(0, email.lastIndexOf('.')).replace('@', '_');
  return `cust+${emailSubstr}@reva.tech`;
};

const overridePhone = phone => {
  const last7Digits = trim(phone).slice(phone.length - 7);
  return `1111${last7Digits}`;
};

export const overrideContactInfo = persons =>
  persons?.length &&
  persons.map(person => ({ ...person, email: person?.email ? overrideEmail(person.email) : null, phone: person?.phone ? overridePhone(person.phone) : null }));

export const getExternalRoommateId = (ctx, { externalId, isPrimary }) => (!isPrimary && ctx.backendMode === DALTypes.BackendMode.YARDI ? externalId : null);

export const isPartyTransferred = (receivedInventoryId, currentInventoryId) => receivedInventoryId !== currentInventoryId;

export const archivePartiesOnTransfer = async (ctx, activeLeasePartyId, partyWorkflows) => {
  await archiveParty(ctx, {
    partyId: activeLeasePartyId,
    workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
    archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENTS_TRANSFERRED,
  });

  const newLeaseWorkflow = getPartyWorkflow(partyWorkflows, DALTypes.WorkflowName.NEW_LEASE);
  const newLeasePartyId = newLeaseWorkflow?.id;
  !!newLeasePartyId &&
    (await archiveParty(ctx, {
      partyId: newLeasePartyId,
      workflowName: DALTypes.WorkflowName.NEW_LEASE,
      archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENTS_TRANSFERRED,
    }));
};

export const getActiveLeaseData = async (ctx, partyWorkflows) => {
  const activeLeaseWorkflow = getPartyWorkflow(partyWorkflows, DALTypes.WorkflowName.ACTIVE_LEASE);
  const activeLeaseData = activeLeaseWorkflow && (await getActiveLeaseWorkflowDataByPartyId(ctx, activeLeaseWorkflow.id));
  return activeLeaseData && { ...activeLeaseData, partyGroupId: activeLeaseWorkflow.partyGroupId, leaseType: activeLeaseWorkflow.leaseType };
};

export const handleUpdatedExternalInfo = async (ctx, externalToArchive, newExternalInfo) => {
  const { partyId, memberId, propertyId } = externalToArchive;
  const { externalId = null, externalProspectId = null, externalRoommateId = null, isPrimary = false, isChild = false, metadata = {} } = newExternalInfo;
  logger.trace({ ctx, partyId, memberId, externalId, externalProspectId, externalRoommateId, isPrimary, isChild }, 'handleUpdatedExternalInfo');

  await archiveExternalInfoByPartyMemberId(ctx, memberId);

  await insertExternalInfo(ctx, {
    partyId,
    partyMemberId: isChild ? null : memberId,
    childId: isChild ? memberId : null,
    externalId,
    externalProspectId,
    externalRoommateId,
    isPrimary,
    metadata,
    propertyId,
  });
};

export const getPhoneNumberAndExtension = phone => {
  if (!phone) return {};

  let phoneNumber = phone;
  let phoneNumberExtension;

  if (phone.includes('x')) {
    [phoneNumber, phoneNumberExtension] = phone.split('x');
  }
  return { phoneNumber: getOnlyDigitsFromPhoneNumber(phoneNumber), phoneNumberExtension };
};

export const insertExternalInfoAndIgnorePreviousER = async (
  ctx,
  { sameMemberFoundInParty, receivedResident, renewalPartyId, isPrimary, propertyId, timezone },
) => {
  logger.trace(
    { ctx, sameMemberFoundInParty, receivedResidentId: receivedResident.id, renewalPartyId, isPrimary },
    'insertExternalInfoAndIgnorePreviousExceptionReport',
  );
  const externalRoommateId = getExternalRoommateId(ctx, { externalId: receivedResident.id, isPrimary });

  await insertExternalInfo(ctx, {
    partyId: renewalPartyId,
    partyMemberId: sameMemberFoundInParty.matchedPartyMemberId,
    childId: sameMemberFoundInParty.childId,
    externalId: externalRoommateId ? null : receivedResident.id,
    externalProspectId: null,
    externalRoommateId,
    isPrimary,
    metadata: {},
    propertyId,
  });

  const ignoreReason = {
    date: now({ timezone }).format(YEAR_MONTH_DAY_FORMAT),
    reason: ExceptionReportIgnoreReasons.PERSON_ALREADY_ADDED_IN_RENEWAL.description,
  };

  await markLastExceptionReportAsIgnored(ctx, {
    externalId: receivedResident.id,
    ignoreReason,
    ruleId: ExceptionReportIgnoreReasons.PERSON_ALREADY_ADDED_IN_RENEWAL.ruleId,
  });
};

export const wasEntryNotUpdated = (newEntry, entry) => isEqual(newEntry.rawData, entry.rawData);

export const removeResident = async (ctx, activeRevaMembersInfo, deletedResidentId) => {
  const externalInfo = activeRevaMembersInfo.find(info => info.partyMemberId === deletedResidentId);
  const removedMember = await markMemberAsRemoved(ctx, deletedResidentId);
  await archiveExternalInfo(ctx, externalInfo);
  await logPartyMemberRemoved(ctx, removedMember);
};

export const removeChild = async (ctx, activeRevaMembersInfo, deletedChildId) => {
  const externalInfo = activeRevaMembersInfo.find(info => info.childId === deletedChildId);
  await removePartyAdditionalInfo(ctx, deletedChildId);
  await archiveExternalInfo(ctx, externalInfo);
};

export const buildContactInfo = async (ctx, receivedResident) => {
  const { id, email, phone } = receivedResident;
  const contactInfos = [];

  if (email) {
    const [existing] = await getContactsInfoByEmail(ctx, email);
    const isValid = isEmailValid(email);

    if (isValid && !existing) {
      contactInfos.push({
        type: DALTypes.ContactInfoType.EMAIL,
        value: email,
        imported: true,
      });
    } else {
      !isValid
        ? logger.error({ ctx, id, email }, 'buildContactInfo - invalid email')
        : logger.error({ ctx, id, email }, 'buildContactInfo - email already exists');
    }
  }

  if (phone) {
    const { phoneNumber, phoneNumberExtension } = getPhoneNumberAndExtension(phone);
    const { valid, reason } = validatePhone(phoneNumber);
    if (valid) {
      contactInfos.push({
        type: DALTypes.ContactInfoType.PHONE,
        value: formatPhoneNumberForDb(phoneNumber),
        imported: true,
        metadata: phoneNumberExtension ? { phoneNumberExtension } : {},
      });
    } else {
      logger.error({ ctx, id, phone, reason }, 'buildContactInfo - invalid phone');
    }
  }

  return enhance(contactInfos);
};
