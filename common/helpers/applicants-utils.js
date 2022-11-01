/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { DALTypes } from '../enums/DALTypes';
import { ScreeningDecision, REVA_SERVICE_STATUS, ServiceNames, GroupServiceNames, FADV_RESPONSE_STATUS } from '../enums/applicationTypes';
import { toHumanReadableString } from './strings';
import { getFullName } from './personUtils';
import { isRevaAdmin } from './auth';
import { isGuarantor, isResident, isPartyLevelGuarantor } from './party-utils';
import { areAllGuarantorsLinkedToMembers } from './guarantors-check';

export const applicantsWithDisclosures = ({ applicants, applicantHasDisclosures }) => applicants.filter(applicant => applicantHasDisclosures(applicant));

export const membersWithIncompleteApplicationMapReducer = (acc, applicant) => {
  const { applicantInfomation } = applicant;
  const { personId, fullName } = !applicantInfomation
    ? {
        personId: applicant.personId,
        fullName: applicant.fullName,
      }
    : {
        personId: applicantInfomation.personId,
        fullName: applicantInfomation.fullName,
      };

  acc.set(personId, fullName);
  return acc;
};

export const isApplicationPaid = ({ applicationStatus } = {}) =>
  applicationStatus === DALTypes.PersonApplicationStatus.PAID || applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED;

export const allMembersAtLeastPaid = members => members.every(member => member && isApplicationPaid(member.application));

// When the residentOrPartyLevelGuarantor is set to party in the sheets
// we don't need to check for all guarators being linked to residents
export const areAllGuarantorsLinkedWhenNeeded = partyMembers => isPartyLevelGuarantor || areAllGuarantorsLinkedToMembers(partyMembers);

const screeningDecisionUserFriendlyTrans = {
  [ScreeningDecision.APPROVED.toLowerCase()]: 'APPROVED',
  [ScreeningDecision.GUARANTOR_REQUIRED.toLowerCase()]: 'GUARANTOR_REQUIRED',
  [ScreeningDecision.DECLINED.toLowerCase()]: 'DECLINED',
  [ScreeningDecision.FURTHER_REVIEW.toLowerCase()]: 'APPROVED_WITH_CONDITIONS',
  [ScreeningDecision.DISPUTED.toLowerCase()]: 'CREDIT_DISPUTE',
  [ScreeningDecision.INCOMPLETE.toLowerCase()]: 'INCOMPLETE_REVIEW_DETAILS',
  [ScreeningDecision.DRAFT.toLowerCase()]: 'DRAFT_STATUS',
  [ScreeningDecision.APPROVED_WITH_COND.toLowerCase()]: 'APPROVED_WITH_CONDITIONS',
  [ScreeningDecision.NO_SCREENING_REQUEST.toLowerCase()]: 'COMPILING',
  [ScreeningDecision.NO_SCREENING_RESPONSE.toLowerCase()]: 'COMPILING',
  [ScreeningDecision.ERROR_ADDRESS_UNPARSABLE.toLowerCase()]: 'ADDRESS_ERROR',
  [ScreeningDecision.ERROR_RESPONSE_UNPARSABLE.toLowerCase()]: 'DECLINED',
  [ScreeningDecision.ERROR_OTHER.toLowerCase()]: 'DECLINED',
  [ScreeningDecision.SCREENING_IN_PROGRESS.toLowerCase()]: 'COMPILING',
  [ScreeningDecision.GUARANTOR_DENIED.toLowerCase()]: 'GUARANTOR_DENIED',
  [ScreeningDecision.COMPILING.toLowerCase()]: 'COMPILING',
  [ScreeningDecision.COMPILING_DELAYED.toLowerCase()]: 'COMPILING_DELAYED',
  [ScreeningDecision.ON_HOLD.toLowerCase()]: 'DRAFT_STATUS',
  [ScreeningDecision.EXPIRED.toLowerCase()]: 'EXPIRED_STATUS',
  [ScreeningDecision.RESULTS_DELAYED.toLowerCase()]: 'RESULTS_DELAYED',
};

export const getUserFriendlyStatus = status => {
  const statusTransToken = screeningDecisionUserFriendlyTrans[status.toLowerCase()];
  return statusTransToken ? t(statusTransToken) : status;
};

export const namePrefixes = ['Mr', 'Mr.', 'Dr', 'Dr.', 'Ms', 'Ms.', 'Mrs', 'Mrs.', 'Mme', 'Mme.'];

export const nameSuffixes = ['Jr', 'Sr', 'Jr.', 'Sr.', 'Jnr', 'Snr', 'Jnr.', 'Snr.', 'I', 'II', 'III', 'IV', 'V', 'Esq', 'Esq.', 'MD', 'M.D.', 'PhD', 'Ph.D.'];

export const checkPrefix = (str = '') => namePrefixes.map(p => p.toLowerCase()).includes(str.toLowerCase());
export const checkSuffix = (str = '') => nameSuffixes.map(s => s.toLowerCase()).includes(str.toLowerCase());

export const getLastNameAndMiddlename = (name, partialLastName = '') => {
  let middleName = '';
  let lastName = partialLastName;

  if (!name) return { middleName, lastName };

  if (name.length >= 2) {
    middleName = name.shift();
    lastName = `${name.join(' ')} ${partialLastName}`;
  } else {
    middleName = name[0];
  }

  return { middleName, lastName };
};

export const getApplicantName = fullName => {
  if (!fullName) return { firstName: '', lastName: '', middleName: '' };
  const applicantName = fullName.split(' ');

  const firstElement = applicantName.shift();
  const lastElement = applicantName.pop();

  const firstName = checkPrefix(firstElement) ? applicantName.shift() : firstElement;
  const partialLastName = checkSuffix(lastElement) ? applicantName.pop() : lastElement;

  const { middleName, lastName } = getLastNameAndMiddlename(applicantName, partialLastName);

  return {
    firstName,
    lastName,
    middleName,
  };
};

const isDelayedStatus = status => [REVA_SERVICE_STATUS.INCOMPLETE, REVA_SERVICE_STATUS.IN_PROCESS, REVA_SERVICE_STATUS.BLOCKED].includes(status);

const hasDelayedServiceOf = (nameOfService, services) =>
  services.some(({ status, serviceName }) => {
    let isDelayed;
    switch (nameOfService) {
      case GroupServiceNames.CREDIT:
        isDelayed = [ServiceNames.SSN, ServiceNames.CREDIT, ServiceNames.EVICTION, ServiceNames.SKIPWATCH].includes(serviceName);
        break;
      case GroupServiceNames.CRIMINAL:
        isDelayed = [
          ServiceNames.CRIMINAL,
          ServiceNames.SEXOFFENDER,
          ServiceNames.SEXOFFENDER,
          ServiceNames.COLLECTIONS,
          ServiceNames.CRIMINAL_OFFLINE,
          ServiceNames.SEX_OFFENDER_OFFLINE,
          ServiceNames.GLOBAL_SANCTIONS_OFFLINE,
          ServiceNames.NEAR_INSTANT,
        ].includes(serviceName);
        break;
      default:
    }
    return isDelayed && isDelayedStatus(status);
  });

const delayedServiceStatuses = {
  CREDIT_AND_CRIMINAL: 'credit_and_criminal',
  ...GroupServiceNames,
};

const getApplicantBySpecificDelayedStatus = (serviceStatus, applicants, delayedStatus) =>
  (applicants || []).reduce((acc, applicant) => {
    const services = serviceStatus[applicant.applicantId];
    if (!services) return acc;
    const { CREDIT, CRIMINAL, CREDIT_AND_CRIMINAL } = delayedServiceStatuses;
    const hasDelayedCreditService = hasDelayedServiceOf(CREDIT, services);
    const hasDelayedCriminalService = hasDelayedServiceOf(CRIMINAL, services);
    switch (delayedStatus) {
      case CREDIT_AND_CRIMINAL:
        if (hasDelayedCreditService && hasDelayedCriminalService) acc.push(applicant);
        break;
      case CREDIT:
        if (hasDelayedCreditService && !hasDelayedCriminalService) acc.push(applicant);
        break;
      case CRIMINAL:
        if (!hasDelayedCreditService && hasDelayedCriminalService) acc.push(applicant);
        break;
      default:
    }
    return acc;
  }, []);

const getApplicantsByCreditAndCriminalStatuses = ({ serviceStatus, applicantData }) => {
  if (!serviceStatus || !applicantData) return [];

  const { applicants } = applicantData;
  return Object.values(delayedServiceStatuses).reduce((obj, delayedStatus) => {
    const applicantsByDelayedStatus = getApplicantBySpecificDelayedStatus(serviceStatus, applicants, delayedStatus).map(getFullName);
    applicantsByDelayedStatus && (obj[delayedStatus] = applicantsByDelayedStatus);
    return obj;
  }, {});
};

export const getDelayedCreditAndCriminalStatuses = (screeningResult, user = {}) => {
  const applicantsByCreditAndCriminalStatuses = getApplicantsByCreditAndCriminalStatuses(screeningResult);
  const isThereApplicantsWithDelayedStatus = Object.values(applicantsByCreditAndCriminalStatuses).some(applicants => applicants.length);
  if (!isThereApplicantsWithDelayedStatus) return null;
  if (isRevaAdmin(user)) {
    return Object.values(delayedServiceStatuses)
      .reduce((acc, delayedStatus) => {
        const applicants = applicantsByCreditAndCriminalStatuses[delayedStatus];
        const trans = t(`DELAYED_${delayedStatus.toUpperCase()}`);
        if (applicants.length) acc.push(`${trans} for ${toHumanReadableString(applicants)}`);
        return acc;
      }, [])
      .join(', ');
  }
  const { credit, criminal, credit_and_criminal } = applicantsByCreditAndCriminalStatuses;
  if (credit.length && !criminal.length && !credit_and_criminal.length) return t('DELAYED_CREDIT');
  if (!credit.length && criminal.length && !credit_and_criminal.length) return t('DELAYED_CRIMINAL');
  if ((!credit.length && !criminal.length && credit_and_criminal.length) || (credit.length && criminal.length)) return t('DELAYED_CREDIT_AND_CRIMINAL');
  return null;
};

const CREDIT_FREEZE_MATCHING_TEXT = 'has been frozen by the applicant';

const applicantHasCreditFreeze = (services, screeningStatus, blockedStatus) => {
  const isResponseComplete = screeningStatus === FADV_RESPONSE_STATUS.COMPLETE;
  const isBlockedByCreditFreeze = blockedStatus && blockedStatus.includes(CREDIT_FREEZE_MATCHING_TEXT);

  if (isResponseComplete || !isBlockedByCreditFreeze) return false;
  return services.some(({ status, serviceName }) => status !== REVA_SERVICE_STATUS.COMPLETE && serviceName === ServiceNames.CREDIT);
};

export const getApplicantsWithCreditFreeze = ({ serviceStatus, applicantData, status: screeningStatus, blockedStatus }) => {
  if (!serviceStatus || !applicantData) return [];

  const { applicants = [] } = applicantData;

  return applicants.reduce((acc, applicant) => {
    const services = serviceStatus[applicant.applicantId];

    if (!services || !applicantHasCreditFreeze(services, screeningStatus, blockedStatus)) return acc;

    acc.push(applicant);
    return acc;
  }, []);
};

export const getCreditFreezeStatus = screeningResult => {
  const applicantsWithCreditFreeze = getApplicantsWithCreditFreeze(screeningResult);

  if (!applicantsWithCreditFreeze.length) return null;

  const applicantNames = applicantsWithCreditFreeze.map(({ firstName, lastName }) => `${firstName} ${lastName}`);

  return `${t('CREDIT_FREEZE_FOR')} ${applicantNames.join(', ')}`;
};

const hasGuarantors = applicants => applicants.some(applicant => applicant.guarantorFor);

export const getInternationalAddressDecisionForUser = applicants =>
  (!hasGuarantors(applicants) && ScreeningDecision.GUARANTOR_REQUIRED) || ScreeningDecision.DECLINED;

export const shouldInviteGuarantor = (members, personId, guarantorLevel) => {
  const currentMember = members.find(member => member.personId === personId);
  const isCurrentMemberNotAGuarantor = currentMember && isResident(currentMember) && !currentMember.guaranteedBy;
  const guarantorsExist = members.some(isGuarantor);

  if (!isCurrentMemberNotAGuarantor) return false;

  return !isPartyLevelGuarantor(guarantorLevel) || !guarantorsExist;
};
