/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniq from 'lodash/uniq';
import isEmpty from 'lodash/isEmpty';
import { DALTypes } from '../../../common/enums/DALTypes';
import { ApplicantReportNames } from '../../../common/enums/screeningReportTypes';
import { IDataDiff, IDictionaryHash } from '../../../common/types/base-types';
import { IScreeningReportSettingsOnActiveParties, IApplicationData, IApplicantReportRequestTracking } from './applicant-types';
import config from '../../config';
import { now, toMoment } from '../../../common/helpers/moment-utils';

type IFieldsPerReport = IDictionaryHash<string[]>;

const applicationDataFieldsPerReport: IFieldsPerReport = {
  [ApplicantReportNames.CREDIT]: [
    'haveInternationalAddress',
    'reportCopyRequested',
    'dateOfBirth',
    'firstName',
    'lastName',
    'suffix',
    'middleName',
    'address',
    'ssn',
  ],
  [ApplicantReportNames.CRIMINAL]: [
    'haveInternationalAddress',
    'reportCopyRequested',
    'dateOfBirth',
    'firstName',
    'lastName',
    'suffix',
    'middleName',
    'address',
  ],
};

export const screeningReportSettingFields: string[] = [
  'creditReportRequiredFlag',
  'criminalReportRequiredFlag',
  'creditReportValidForPeriod',
  'criminalReportValidForPeriod',
];

export const statesOnActiveParties: string[] = [
  DALTypes.PartyStateType.CONTACT,
  DALTypes.PartyStateType.LEAD,
  DALTypes.PartyStateType.PROSPECT,
  DALTypes.PartyStateType.APPLICANT,
  DALTypes.PartyStateType.LEASE,
];

export const isApplicantReportForInternationalAddress = (applicationData?: IApplicationData): boolean =>
  (applicationData || ({} as IApplicationData)).haveInternationalAddress || false;

export const isPendingRequestTrackingOnTime = (applicantReportRequestTracking: IApplicantReportRequestTracking): boolean => {
  if (isEmpty(applicantReportRequestTracking)) return true;

  const { apiRequestTimeout } = config.fadv;
  const { timezone, created_at } = applicantReportRequestTracking;
  const currentTime = now({ timezone });
  const createdAtInTimeZone = toMoment(created_at!, { timezone });
  return currentTime.diff(createdAtInTimeZone, 'minutes') < apiRequestTimeout;
};

const isApplicantReportNeeded = (reportName: string, applicantFieldsUpdated: string[]): boolean => {
  if (!applicantFieldsUpdated || !applicantFieldsUpdated.length) return true;
  const wasFieldUpdated = (fieldName: string): boolean => applicantFieldsUpdated.some(key => key === fieldName);
  return (applicationDataFieldsPerReport[reportName] || []).some(wasFieldUpdated);
};

export const getApplicantReportsNeededBy = (
  screeningReportSettings: Array<IScreeningReportSettingsOnActiveParties>,
  applicationDataDiff?: IDataDiff,
): string[] => {
  const applicantFieldsUpdated = Object.keys(applicationDataDiff || {});
  const applicantReports = screeningReportSettings.reduce((acc: string[], { applicantSettings }) => {
    const isCreditReportNeeded = applicantSettings.creditReportRequiredFlag && isApplicantReportNeeded(ApplicantReportNames.CREDIT, applicantFieldsUpdated);
    const isCriminalReportNeeded =
      applicantSettings.criminalReportRequiredFlag && isApplicantReportNeeded(ApplicantReportNames.CRIMINAL, applicantFieldsUpdated);

    isCreditReportNeeded && acc.push(ApplicantReportNames.CREDIT);
    isCriminalReportNeeded && acc.push(ApplicantReportNames.CRIMINAL);
    return acc;
  }, []);

  return uniq(applicantReports);
};
