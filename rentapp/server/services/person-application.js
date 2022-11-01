/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { runInTransaction } from '../../../server/database/factory';

import * as dal from '../dal/person-application-repo';
import { getPersonById } from '../../../server/services/person';
import { createJWTToken } from '../../../common/server/jwt-helpers';
import { DALTypes } from '../../../common/enums/DALTypes';
import { fetchDocumentsMetadataTemplate } from './documents';

import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import { APP_EXCHANGE, SCREENING_MESSAGE_TYPE } from '../../../server/helpers/message-constants';
import { sendMessage } from '../../../server/services/pubsub';
import { saveApplicationStatusUpdatedEvent } from '../../../server/services/partyEvent';
import feeNames from '../../../common/enums/feeNames';

import { mapScreeningApplicantData } from '../screening/fadv/applicant-data-parser';

import { getApplicationFeesForProperty } from '../../../server/helpers/fees';
import {
  loadPartyMembers,
  setPartyMemberToApplicant,
  loadPersonByPartyMemberId,
  getPartyById,
  loadPartyById,
  getAdditionalInfoByPartyAndType,
  isPartyClosed,
  getPartyMemberByPartyIdAndPersonId,
} from '../../../server/services/party';
import { getPropertyById, isPropertyInactive } from '../../../server/dal/propertyRepo';
import { getApplicationInvoicesByFilter } from './application-invoices';
import { ServiceError } from '../../../server/common/errors';

import { applicationWithMaskedSSN } from '../../../common/helpers/utils';
import nullish from '../../../common/helpers/nullish';
import { logEntity } from '../../../server/services/activityLogService';
import { COMPONENT_TYPES, SUB_COMPONENT_TYPES, ACTIVITY_TYPES } from '../../../common/enums/activityLogTypes';
import { WAIVER_APPLICATION_FEE_DISPLAY_NAME } from '../../../common/application-constants';
import * as shared from './shared/person-application';
import { getApplicantName } from '../../../common/helpers/applicants-utils';
import { isGuarantor } from '../../../common/helpers/party-utils';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'personApplicationService' });

import { assert } from '../../../common/assert';
import { getApplicationSettings } from '../../../server/services/properties';
import { getPartyDocuments, getApplicationDataForPartyApplication } from '../dal/party-application-repo';
import { AdditionalInfoTypes } from '../../../common/enums/partyTypes';
import { ApplicationSettingsValues } from '../../../common/enums/applicationTypes';
import { getScreeningVersion } from '../helpers/screening-helper';
import {
  enhanceApplicationWithStandardizedAddress,
  validateUniqueEmailApplication,
  notifyApplicationEvent,
  validateQuotePromotions,
  validateUniqueEmail,
} from '../helpers/application-helper';
import { personApplicationProvider } from '../providers/person-application-provider-integration';
import { getInventoryForQuote } from '../../../server/services/inventories';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { getPersonByPersonApplicationId, getLastMergeWithByPersonId } from '../../../server/dal/personRepo';
import { getFullName } from '../../../common/helpers/personUtils';
import { now } from '../../../common/helpers/moment-utils';
import { getInventoryHolds } from '../../../server/dal/inventoryRepo';

export const sendApplicantInformationToScreen = async (ctx, { partyId }, hasChangedSsnSendFlag) => {
  const { tenantId } = ctx;
  const messageType = hasChangedSsnSendFlag ? SCREENING_MESSAGE_TYPE.SEND_SSN_CHANGED : SCREENING_MESSAGE_TYPE.APPLICANT_DATA_UPDATED;
  const message = {
    tenantId,
    partyId,
  };
  await sendMessage({ ctx, exchange: APP_EXCHANGE, key: messageType, message });
};

const validatePromotions = async (ctx, personApplication, partyId) =>
  personApplication && personApplication.paymentCompleted && (await validateQuotePromotions(ctx, partyId));

const addLogWhenSendSsnIsEnabled = async (ctx, personApplication, partyId) =>
  personApplication.sendSsnEnabled &&
  (await logEntity(ctx, {
    entity: {
      id: partyId,
      ssnEnabledFor: getFullName(personApplication.applicationData),
    },
    activityType: ACTIVITY_TYPES.UPDATE,
    component: COMPONENT_TYPES.PARTY,
  }));

const createOrUpdatePersonApplication = async (
  ctx,
  { skipStandardizedAddressValidation = true, maskSSN = true, ...rawPersonApplication },
  triggerScreening = true,
) => {
  const { tenantId } = ctx;
  assert(tenantId, 'createOrUpdatePersonApplication now expects a ctx instead of tenantId');

  const { applicationData, personId, partyId } = rawPersonApplication;

  const { firstName = '', lastName = '' } = applicationData || {};
  logger.debug({ ctx, firstName, lastName, personId, partyId }, 'createOrUpdatePersonApplication');

  applicationData && (await validateUniqueEmail(ctx, applicationData.email, personId));
  const existingPersonApplication = await dal.getPersonApplicationForApplicant(ctx, { personId, partyId }, false /* maskSSN */);
  await validatePromotions(ctx, existingPersonApplication, partyId);

  if (!skipStandardizedAddressValidation) {
    const addressStandarizationError = await enhanceApplicationWithStandardizedAddress(ctx, rawPersonApplication, existingPersonApplication);
    if (addressStandarizationError) return addressStandarizationError;
  }

  if (applicationData) {
    await validateUniqueEmailApplication(ctx, applicationData.email, partyId, (existingPersonApplication || {}).id);
    rawPersonApplication.applicationData = mapScreeningApplicantData(rawPersonApplication, existingPersonApplication);
  }

  const notifyData = { ctx };

  if (existingPersonApplication) {
    logger.info({ ctx, partyId, personId, personApplicationId: existingPersonApplication.id }, 'Updating existing personApplication');

    const runNotify = !!(existingPersonApplication.applicationData || {}).email;

    if (rawPersonApplication.applicationData) {
      existingPersonApplication.applicationData = rawPersonApplication.applicationData;
    }

    let hasChangedSsnSendFlag = false;
    if (!nullish(rawPersonApplication.sendSsnEnabled)) {
      hasChangedSsnSendFlag = rawPersonApplication.sendSsnEnabled !== existingPersonApplication.sendSsnEnabled;
      existingPersonApplication.sendSsnEnabled = rawPersonApplication.sendSsnEnabled;
    }

    const application = await dal.updatePersonApplication(ctx, existingPersonApplication.id, existingPersonApplication, false /* maskSSN */);
    runNotify && notifyApplicationEvent(notifyData, application, eventTypes.APPLICATION_UPDATED);

    const shouldTriggerScreening = !hasChangedSsnSendFlag && triggerScreening && existingPersonApplication.paymentCompleted;

    if (shouldTriggerScreening) await sendApplicantInformationToScreen(ctx, application);

    await addLogWhenSendSsnIsEnabled(ctx, existingPersonApplication, partyId);

    logger.debug({ ctx, firstName, lastName, personId, partyId }, 'createOrUpdatePersonApplication exiting');

    return applicationWithMaskedSSN(application);
  }

  logger.info({ ctx, personId, partyId }, 'Creating initial person application');

  return await runInTransaction(async innerTrx => {
    const innerCtx = { ...ctx, trx: innerTrx };

    rawPersonApplication.applicationStatus = DALTypes.PersonApplicationStatus.NOT_SENT;
    const { authUser } = ctx;
    const { createdFromCommId } = authUser || {};
    const application = await shared.createPersonApplication(innerCtx, { ...rawPersonApplication, createdFromCommId }, partyId, maskSSN);

    notifyApplicationEvent(notifyData, application, eventTypes.APPLICATION_CREATED);

    return application;
  }, ctx).catch(error => {
    logger.error({ ctx, error }, `[ERROR ON CREATE PERSON APPLICATION] ${tenantId} ${personId} ${partyId}`);
    throw error;
  });
};

const updatePersonApplication = async (ctx, personApplicationRaw) => {
  const { firstName = '', lastName = '' } = personApplicationRaw.applicationData;
  logger.debug(`Update person application FirstName: ${firstName}, LastName: ${lastName}`);

  const { personId, applicationData = {} } = personApplicationRaw;
  await validateUniqueEmail(ctx, applicationData.email, personId);

  personApplicationRaw.applicationData = mapScreeningApplicantData(personApplicationRaw);

  const application = await dal.updatePersonApplication(ctx, personApplicationRaw.id, personApplicationRaw);
  notify({
    ctx,
    event: eventTypes.APPLICATION_UPDATED,
    data: {
      partyId: application.partyId,
      personId: application.personId,
      applicationId: application.id,
    },
  });
  return application;
};

export const getPersonApplicationByPersonIdAndPartyApplicationId = async (
  ctx,
  personId,
  partyApplicationId,
  { maskSsn = true, includeApplicationsWherePartyMemberIsInactive } = {},
) => {
  logger.debug({ ctx, personId, partyApplicationId }, 'getPersonApplicationByPersonIdAndPartyApplicationId');
  return await dal.getPersonApplicationByPersonIdAndPartyApplicationId(ctx, personId, partyApplicationId, {
    maskSsn,
    includeApplicationsWherePartyMemberIsInactive,
  });
};

const hasPaidApplication = async (ctx, personId, partyId) => {
  logger.debug({ ctx, personId, partyId }, 'hasPaidApplication');
  return (await dal.getPersonApplicationByFilter(ctx, { personId, partyId })).paymentCompleted;
};

const getPersonApplicationByFilter = (ctx, personId, partyId) => {
  logger.debug({ ctx, personId, partyId }, 'getPersonApplicationByFilter');

  return dal.getPersonApplicationByFilter(ctx, { personId, partyId });
};

export const getPersonApplicationsByFilter = (ctx, filter, options) => {
  logger.debug({ ctx, filter, options }, 'getPersonApplicationsByFilter');
  return dal.getPersonApplicationsByFilter(ctx, filter, options);
};

export const countPersonApplicationsByFilter = async (ctx, filter) => {
  logger.debug({ ctx, filter }, 'countPersonApplicationsByFilter');
  const result = await dal.countPersonApplicationsByFilter(ctx, filter);
  return result;
};

export const updatePersonApplicationStatus = async (ctx, personApplicationId, applicationStatus, notNotify = false, extraProps = {}) => {
  const valuesToUpdate = { ...extraProps, applicationStatus };
  const personApplication = await dal.updatePersonApplication(ctx, personApplicationId, valuesToUpdate, false);
  const { partyId, personId, id: applicationId } = personApplication;
  await saveApplicationStatusUpdatedEvent(ctx, { partyId, metadata: { personId, applicationStatus, applicationId } });

  if (!notNotify) {
    notify({
      ctx,
      event: eventTypes.APPLICATION_UPDATED,
      data: {
        partyId,
        personId,
        applicationId,
      },
    });
  }
  return personApplication;
};

export const updatePersonApplicationPaymentCompleted = async (ctx, personApplicationId, paymentCompletedNew, triggerScreening = true) => {
  logger.debug({ ctx, personApplicationId, paymentCompletedNew }, 'Update person application paymentCompleted');

  const application = await updatePersonApplicationStatus(ctx, personApplicationId, DALTypes.PersonApplicationStatus.PAID, true, {
    paymentCompleted: paymentCompletedNew,
  });
  logger.trace({ ctx, personApplicationId }, 'back from setting paymentCompleted');
  const { id: applicationId, partyId, personId } = application;

  if (triggerScreening) await sendApplicantInformationToScreen(ctx, application);

  // TODO: should not load all party members just to set state of 1...
  const members = await loadPartyMembers(ctx, partyId);
  const { id: memberId } = members.find(m => m.personId === personId);
  await setPartyMemberToApplicant(ctx, partyId, memberId);

  notify({
    ctx,
    event: eventTypes.APPLICATION_UPDATED,
    data: { partyId, personId, applicationId },
  });
  return applicationWithMaskedSSN(application);
};

const isNullOrEmpty = list => !Array.isArray(list) || !list.length;
const isValidSection = (section, skip, data) => {
  if (section !== ApplicationSettingsValues.REQUIRED) return true;
  const isValid = skip || !isNullOrEmpty(data);
  if (!isValid) logger.trace({ section, skip, data, isValid }, 'isValidSection');
  return isValid;
};

const validateRequiredInformation = (
  { applicationSettings, skipPartySection, skipSection },
  { incomeSourceHistory, addressHistory, disclosures, children, pets, vehicles, documents, partyDocuments, insuranceChoice },
) => {
  logger.trace(
    {
      applicationSettings,
      skipPartySection,
      skipSection,
      incomeSourceHistoryIds: incomeSourceHistory?.map(incomeSource => incomeSource.id),
      addressHistoryIds: addressHistory?.map(adHistory => adHistory.id),
      disclosures,
      children: children?.map(child => child.id),
      petIds: pets?.map(pet => pet.id),
      vehicleIds: vehicles?.map(vehicle => vehicle.id),
      documents: documents?.map(document => document.metadata?.documentId),
      partyDocumentIds: partyDocuments?.map(partyDocument => partyDocument.metadata?.documentId),
      insuranceChoiceIds: insuranceChoice?.map(inChoice => inChoice.id),
    },
    'validatePersonApplication',
  );
  let isValid = true;

  if (!isValidSection(applicationSettings.incomeSourcesSection, skipSection.skipIncomeSourcesSection, incomeSourceHistory)) isValid = false;
  if (!isValidSection(applicationSettings.addressHistorySection, skipSection.skipAddressHistorySection, addressHistory)) isValid = false;
  if (!isValidSection(applicationSettings.disclosuresSection, skipSection.skipDisclosuresSection, disclosures)) isValid = false;
  if (!isValidSection(applicationSettings.childrenSection, skipPartySection.skipChildrenSection, children)) isValid = false;
  if (!isValidSection(applicationSettings.petsSection, skipPartySection.skipPetsSection, pets)) isValid = false;
  if (!isValidSection(applicationSettings.vehiclesSection, skipPartySection.skipVehiclesSection, vehicles)) isValid = false;
  if (!isValidSection(applicationSettings.privateDocumentsSection, skipSection.skipPrivateDocumentsSection, documents)) isValid = false;
  if (!isValidSection(applicationSettings.sharedDocumentsSection, skipPartySection.skipSharedDocumentsSection, partyDocuments)) isValid = false;
  if (!isValidSection(applicationSettings.rentersInsuranceSection, skipSection.skipRentersInsuranceSection, insuranceChoice)) isValid = false;

  return isValid;
};

const validatePersonApplication = async (ctx, personApplicationId) => {
  const personApplication = await dal.getPersonApplication(ctx, personApplicationId);
  const party = await loadPartyById(ctx, personApplication.partyId);
  const { leaseType, assignedPropertyId, partyMembers } = party;
  const { memberType } = partyMembers.find(m => m.personId === personApplication.personId);
  const applicationSettings = await getApplicationSettings(ctx, assignedPropertyId, leaseType, memberType);
  const additionalData = await dal.getAdditionalDataForPersonApplication(ctx, personApplicationId);
  const { additionalData: { disclosures = {}, addressHistory = [], incomeSourceHistory = [], skipSection = {} } = {} } = additionalData || {};
  const partyAdditionalInfo = await getAdditionalInfoByPartyAndType(ctx, party.id);
  const { children, vehicles, pets, insuranceChoice } = partyAdditionalInfo.reduce(
    (acc, item) => {
      if (item.type === AdditionalInfoTypes.CHILD) acc.children.push(item);
      else if (item.type === AdditionalInfoTypes.PET) acc.pets.push(item);
      else if (item.type === AdditionalInfoTypes.VEHICLE) acc.vehicles.push(item);
      else if (item.type === AdditionalInfoTypes.INSURANCE_CHOICE) acc.insuranceChoice.push(item);
      return acc;
    },
    { children: [], vehicles: [], pets: [], insuranceChoice: [] },
  );
  const documents = await dal.getDocumentsForPersonApplication(ctx, personApplicationId);
  const partyDocuments = await getPartyDocuments(ctx, personApplication.partyApplicationId);
  const {
    applicationData: { skipSection: skipPartySection = {} },
  } = await getApplicationDataForPartyApplication(ctx, personApplication.partyApplicationId);

  logger.debug({ ctx, personApplicationId, applicationSettings, skipPartySection, skipSection }, 'validatePersonApplication');

  return validateRequiredInformation(
    { applicationSettings, skipPartySection, skipSection },
    {
      addressHistory,
      incomeSourceHistory,
      children,
      vehicles,
      pets,
      insuranceChoice,
      documents,
      partyDocuments,
      disclosures: Object.keys(disclosures),
    },
  );
};

export const completePersonApplication = async (ctx, personApplicationId) => {
  logger.debug({ ctx, personApplicationId }, 'completePersonApplication');
  const isValid = await validatePersonApplication(ctx, personApplicationId);
  if (!isValid) throw new ServiceError({ token: 'APPLICATION_MISSING_REQUIRED_INFORMATION', status: 412 });

  const application = await updatePersonApplicationStatus(ctx, personApplicationId, DALTypes.PersonApplicationStatus.COMPLETED, true, {
    applicationCompleted: now().toJSON(),
  });
  const { id: applicationId, partyId, personId } = application;

  notify({
    ctx,
    ...ctx,
    event: eventTypes.APPLICATION_UPDATED,
    data: { partyId, personId, applicationId },
  });
  return application;
};

export const getDocumentsForPersonApplication = (ctx, personApplicationId) =>
  fetchDocumentsMetadataTemplate(ctx, {
    getDocumentList: () => dal.getDocumentsForPersonApplication(ctx, personApplicationId),
  });

export const getPersonApplicationDocumentsByPartyId = (ctx, partyId) => dal.getPersonApplicationDocumentsByPartyId(ctx, partyId);

export const getPersonApplicationAdditionalData = async (ctx, personApplicationId) => {
  logger.debug({ ctx, personApplicationId }, 'getPersonApplicationAdditionalData');

  const additionalData = await dal.getAdditionalDataForPersonApplication(ctx, personApplicationId);
  return additionalData;
};

const updatePersonApplicationAdditionalData = (ctx, personApplicationId, additionalData) => {
  logger.debug({ ctx, personApplicationId }, 'updatePersonApplicationAdditionalData');

  return dal.updatePersonApplicationAdditionalData(ctx, personApplicationId, additionalData);
};

export const getPersonApplicationForScreening = async (ctx, partyApplicationId, personId) => {
  logger.debug({ ctx, partyApplicationId, personId }, 'getPersonApplicationForScreening');

  return dal.getPersonApplicationByFilter(ctx, { partyApplicationId, personId });
};

export const getPersonApplicationWithoutApplicationDataForApplicant = async (ctx, { personId, partyId }) => {
  logger.debug({ ctx, personId, partyId }, 'getPersonApplicationWithoutApplicationDataForApplicant');

  const personApplication = await dal.getPersonApplicationForApplicant(ctx, { personId, partyId });

  if (!personApplication) {
    // TypeError: Cannot convert undefined or null to object
    // http://prod-logs.corp.reva.tech/app/kibana#/doc/logstash-*/logstash-2017.10.08/logs/?id=AV79ypsWT8W4yj3acxK8
    const err = new Error('MISSING_PERSON_APPLICATION');
    logger.error({ ctx, err, personId, partyId }, 'Cannot get the personApplication for the personId');
    throw err;
  }

  delete personApplication.applicationData;

  return personApplication;
};

const getPersonApplicationToken = async (ctx, applicationTokenObject) => {
  const { tenantId, quoteId, personId, commonUserId, personApplicationId, partyId, propertyId, tenantDomain, hasMultipleApplications } = applicationTokenObject;
  const personApplicationData = await dal.getPersonApplication(ctx, personApplicationId);
  const person = await getPersonById(ctx, personId);

  return createJWTToken({
    quoteId,
    tenantId,
    partyId,
    personId,
    commonUserId,
    personApplicationId,
    personName: person.preferredName,
    partyApplicationId: personApplicationData.partyApplicationId,
    propertyId,
    restrictedPaths: ['/personApplications/current/*', '/partyApplications/current/*', '/documents/'],
    tenantDomain,
    hasMultipleApplications,
  });
};

export const getPersonApplicationByDocumentId = async (ctx, documentId) => await dal.getPersonApplicationByDocumentId(ctx, documentId);

export const deletePersonApplicationDocument = async (ctx, personApplicationId, documentId) =>
  await dal.deletePersonApplicationDocument(ctx, personApplicationId, documentId);

const toApplicationFee = fee => ({
  feeId: fee.id,
  feeType: fee.feeType,
  feeName: fee.displayName,
  amount: fee.amount,
  isRequired: true,
});

const getApplicationFeeForResidents = ({ fees, members, personId }) => {
  const isPersonResidentAndOccupant = members.find(member => member.personId === personId && !isGuarantor(member.memberType));
  if (!isPersonResidentAndOccupant) return null;

  const numberOfResidentsAndOccupantsInParty = members.filter(member => !isGuarantor(member.memberType)).length;

  if (numberOfResidentsAndOccupantsInParty > 1) {
    const groupAppFee = fees.find(fee => fee.name === feeNames.GROUP_APP_FEE);
    if (groupAppFee) return toApplicationFee(groupAppFee);
  }
  // CPM-6650: use single fee for groups if groupAppFee not found
  const singleAppFee = fees.find(fee => fee.name === feeNames.SINGLE_APP_FEE);
  if (singleAppFee) return toApplicationFee(singleAppFee);

  return null;
};

const getApplicationFeeForGuarantor = ({ fees, members, personId }) => {
  const isPersonGuarantor = members.find(member => member.personId === personId && member.memberType === DALTypes.MemberType.GUARANTOR);
  if (!isPersonGuarantor) return null;

  const guarantorAppFee = fees.find(fee => fee.name === feeNames.GUARANTOR_APP_FEE);
  if (guarantorAppFee) return toApplicationFee(guarantorAppFee);

  // CPM-6650: Use single fee for guarantors if guarantorAppFee not found
  const singleAppFee = fees.find(fee => fee.name === feeNames.SINGLE_APP_FEE);
  if (singleAppFee) return toApplicationFee(singleAppFee);

  return null;
};

const getWaivedApplicationFee = (applicationFeeForResidents, applicationFeesForGuarantor) => {
  const waiverFee = appFee => ({
    ...appFee,
    id: newId(),
    amount: appFee.amount,
    feeType: DALTypes.FeeType.WAIVER_APPLICATION,
    displayName: WAIVER_APPLICATION_FEE_DISPLAY_NAME,
  });
  if (applicationFeeForResidents) return toApplicationFee(waiverFee(applicationFeeForResidents));
  if (applicationFeesForGuarantor) return toApplicationFee(waiverFee(applicationFeesForGuarantor));
  return null;
};

const getPreviouslyPaidHoldDeposit = (applicationInvoices, partyApplicationId, holdDepositFeeId) =>
  applicationInvoices.find(
    applicationInvoice =>
      applicationInvoice.partyApplicationId === partyApplicationId &&
      applicationInvoice.holdDepositFeeId === holdDepositFeeId &&
      applicationInvoice.paymentCompleted,
  );

const getHoldDepositFee = async (ctx, { fees = [], applicationInvoices = [], partyApplicationId }) => {
  const holdDepositFee = fees.find(fee => fee.feeType === DALTypes.FeeType.HOLD_DEPOSIT);
  if (!holdDepositFee) return null;

  const { id, isRequired, unitInfo, holdDurationInHours } = holdDepositFee;
  const holdDepositPayer = getPreviouslyPaidHoldDeposit(applicationInvoices, partyApplicationId, id);
  let payerName;
  let isRequiredFee = isRequired;

  if (holdDepositPayer) {
    const payerPerson = await getPersonByPersonApplicationId(ctx, holdDepositPayer.personApplicationId);
    payerName = payerPerson?.fullName;
    isRequiredFee = false;
  }

  return {
    ...toApplicationFee(holdDepositFee),
    isRequired: isRequiredFee,
    unitInfo,
    holdDurationInHours,
    payerName,
  };
};

const getPersonApplicationWithProvider = async (ctx, personApplicationId) => {
  const { tenantId, partyId } = ctx;
  const screeningVersion = await getScreeningVersion({ partyId, tenantId });

  return await personApplicationProvider(screeningVersion).getPersonApplicationById(ctx, personApplicationId);
};

export const validateApplicant = async (ctx, applicant = {}, tenantDomain) => {
  const { personId, partyId } = applicant.personApplicationId ? await getPersonApplicationWithProvider(ctx, applicant.personApplicationId) : applicant;

  if (applicant.propertyId && (await isPropertyInactive(ctx, applicant.propertyId))) {
    throw new ServiceError({
      token: DALTypes.ApplicantErrors.INACTIVE_PROPERTY,
      status: 412,
      data: {
        partyId,
      },
    });
  }

  const partyMember = await getPartyMemberByPartyIdAndPersonId(ctx, partyId, personId);

  if (!partyMember && !!(await getLastMergeWithByPersonId(ctx, personId))) {
    throw new ServiceError({
      token: DALTypes.ApplicantErrors.PARTY_MEMBER_MERGED,
      status: 412,
      data: {
        partyId,
        personId,
      },
    });
  }

  if (partyMember.endDate) {
    throw new ServiceError({
      token: DALTypes.ApplicantErrors.PARTY_MEMBER_REMOVED,
      status: 404,
      data: {
        partyId,
        personId,
        applicantName: getDisplayName(partyMember, { usePreferred: true, ignoreContactInfo: true }),
        tenantDomain,
      },
    });
  }

  const partyClosed = await isPartyClosed(ctx, partyId);

  if (partyClosed) {
    throw new ServiceError({
      token: DALTypes.ApplicantErrors.PARTY_CLOSED,
      status: 404,
      data: {
        partyId,
        personId,
        applicantName: getDisplayName(partyMember, { usePreferred: true, ignoreContactInfo: true }),
        tenantDomain,
      },
    });
  }

  if (!(partyMember.endDate || partyClosed)) return;

  throw new ServiceError({
    token: DALTypes.ApplicantErrors.APPLICANT_NOT_FOUND,
    status: 404,
    data: {
      partyId,
      applicantName: getDisplayName(partyMember, { usePreferred: true, ignoreContactInfo: true }),
      tenantDomain,
    },
  });
};

export const getMemberTypeSettings = async (ctx, { propertyId, partyId, personId, members }) => {
  const party = await getPartyById(ctx, partyId);
  const applicant = members.find(member => member.personId === personId);
  return await getApplicationSettings(ctx, propertyId, party.leaseType, applicant.memberType);
};

export const getFeesByPersonApplication = async ctx => {
  const { tenantId, quoteId, propertyId, partyId, personApplicationId } = ctx;
  logger.trace({ ctx, quoteId, propertyId, partyId, personApplicationId }, 'getFeesByPersonApplication');

  const { personId, partyApplicationId, isFeeWaived } = await getPersonApplicationWithProvider(ctx, personApplicationId);

  await validateApplicant(ctx, { partyId, personId });

  let propertyFilter = { propertyId };
  let inventoryId;
  if (quoteId) {
    const { id } = await getInventoryForQuote(ctx, quoteId, ['id']);
    inventoryId = id;
    propertyFilter = { inventoryId, hasQuote: true, ...propertyFilter };
  }
  // Fee repo still uses tenantId, but these are generally read-only so should be OK
  const members = await loadPartyMembers(ctx, partyId);
  const memberTypeSettings = await getMemberTypeSettings(ctx, { propertyId, partyId, personId, members });

  const fees = await getApplicationFeesForProperty(tenantId, propertyFilter, memberTypeSettings);
  const applicationInvoices = await getApplicationInvoicesByFilter(ctx, { partyApplicationId, paymentCompleted: true });
  logger.trace(
    { ctx, feeIds: fees.map(fee => fee.id), applicationInvoicesIds: applicationInvoices.map(appInvoice => appInvoice.id) },
    'Person application fees and invoices',
  );

  const applicationFees = [];
  const applicationFeeForResidents = getApplicationFeeForResidents({ fees, members, personId });
  if (applicationFeeForResidents) applicationFees.push(applicationFeeForResidents);

  const applicationFeesForGuarantor = getApplicationFeeForGuarantor({ fees, members, personId });
  if (applicationFeesForGuarantor) applicationFees.push(applicationFeesForGuarantor);

  if (isFeeWaived) {
    const applicationFeeWaiver = getWaivedApplicationFee(applicationFeeForResidents, applicationFeesForGuarantor);
    applicationFees.push(applicationFeeWaiver);
  }

  const holdDepositFee = await getHoldDepositFee(ctx, { fees, applicationInvoices, partyApplicationId });
  if (holdDepositFee) {
    const inventoryHolds = inventoryId ? await getInventoryHolds(ctx, inventoryId) : [];
    const isHeld = inventoryHolds.some(ih => partyId !== ih.partyId);
    applicationFees.push({ ...holdDepositFee, isHeld });
  }

  logger.debug({ ctx, applicationFeeIds: applicationFees.map(appFee => appFee.feeId) }, 'Returning fees');
  return applicationFees;
};

export const getNumberOfDocumentsByPerson = async (ctx, partyId, personId) => {
  const { documentCount = 0 } = (await dal.getNumberOfDocumentsByPerson(ctx, partyId, personId)) || {};
  return +documentCount;
};

export const updatePersonApplicationData = (ctx, personApplicationId, applicationData) =>
  dal.updatePersonApplicationData(ctx, personApplicationId, applicationData);

// TODO: remove this function after verifying no longer used
export const deletePersonApplicationSSN = async (ctx, personId, partyApplicationId) => {
  // CPM-9298
  logger.info({ ctx, personId, partyApplicationId }, 'skipping deletion of SSN for now');

  /*
  const personApplication = await dal.getPersonApplicationByPersonIdAndPartyApplicationId(tenantId, personId, partyApplicationId);
  if (!personApplication) return;

  const { id, applicationData } = personApplication;
  if (!(applicationData && {}.hasOwnProperty.call(applicationData, 'socSecNumber'))) return;

  logger.trace({ tenantId, personId, partyApplicationId }, 'Deleting social security number from person application');
  delete applicationData.socSecNumber;

  await dal.updatePersonApplication({ tenantId }, id, { applicationData });
  */
};

export const updateWaivedFee = async (ctx, { personApplicationId, isFeeWaived, feeWaiverReason, partyId, partyMemberId }) => {
  logger.info({ ctx, personApplicationId, isFeeWaived, partyId, partyMemberId }, 'updateWaivedFee');

  return await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };
    const member = await loadPersonByPartyMemberId(innerCtx, partyMemberId);
    if (!personApplicationId) {
      const { firstName, lastName, middleName } = getApplicantName(member.fullName);
      const application = await createOrUpdatePersonApplication(innerCtx, {
        personId: member.id,
        partyId,
        applicationData: {
          firstName,
          lastName,
          middleName,
        },
      });
      personApplicationId = application.id;
    }
    const personApplication = await dal.updatePersonApplication(innerCtx, personApplicationId, { isFeeWaived, feeWaiverReason }, false);
    const { personId, id: applicationId } = personApplication;
    notify({
      ctx: innerCtx,
      event: eventTypes.APPLICATION_UPDATED,
      data: { partyId, personId, applicationId },
    });

    notify({
      ctx: innerCtx,
      event: eventTypes.WAIVE_APPLICATION_FEE,
      data: { personApplicationId },
    });

    const action = personApplication.isFeeWaived ? ACTIVITY_TYPES.NEW : ACTIVITY_TYPES.REMOVE;
    await logEntity(innerCtx, {
      entity: {
        partyId,
        memberName: member.fullName,
        waiverReason: feeWaiverReason,
      },
      activityType: action,
      component: COMPONENT_TYPES.APPLICATION,
      subComponent: SUB_COMPONENT_TYPES.WAIVER,
    });
    return personApplication;
  });
};

export const getPersonApplication = async (ctx, personApplicationId) => {
  logger.debug({ ctx, personApplicationId }, 'getPersonApplication');
  assert(personApplicationId, 'getPersonApplication requires personApplicationId!');
  // TODO: CPM-12483 get screening version from party or using the application id
  const screeningVersion = await getScreeningVersion({ tenantId: ctx.tenantId });
  const personApplication = await personApplicationProvider(screeningVersion).getPersonApplicationById(ctx, personApplicationId);
  if (!personApplication) {
    throw new Error('NO_APPLICATION_FOR_APPLICATION_ID');
  }
  return personApplication;
};

export const savePersonApplicationEvent = async (ctx, event) => {
  const { personApplicationId, ...rest } = event;
  logger.debug({ ctx, personApplicationId }, 'savePersonApplicationEvent');

  const { personId, partyId } = await getPersonApplicationWithProvider(ctx, personApplicationId);
  await validateApplicant(ctx, { personId, partyId });
  const { assignedPropertyId } = await getPartyById(ctx, partyId);
  const { timezone } = await getPropertyById(ctx, assignedPropertyId);
  return await dal.savePersonApplicationEvent(ctx, personApplicationId, rest, timezone);
};

export {
  createOrUpdatePersonApplication,
  updatePersonApplication,
  hasPaidApplication,
  updatePersonApplicationAdditionalData,
  getPersonApplicationToken,
  getPersonApplicationByFilter,
};
