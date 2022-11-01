/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ICreditReport, ICriminalReport } from '../../workers/screening/v2/helpers/report-data-builder';
import { ICriminalServiceErrors, ICreditServiceErrors } from '../../helpers/party-application-screening-decision-types';
import { IDictionaryHash } from '../../../../common/types/base-types';

export const noCreditReportData: ICreditReport = {
  creditScore: null,
  hasNoEstablishedCredit: null,
  hasBankruptcy: null,
  hasForeclosure: null,
  hasLegalItems: null,
  hasTaxLiens: null,
  hasMortgageDebt: null,
  hasPropertyRentalDebt: null,
  hasUtilityDebt: null,
  hasRentalCollections: null,
  hasNsfOrLatePayMin: null,
  hasNsfOrLatePayMax: null,
  hasEvictionNotice: null,
  hasLeaseViolation: null,
  hasSuspiciousSsn: null,
  hasRequiredSsnResponse: null,
};

export const noCriminalReportData: ICriminalReport = {
  hasDrugsFelony: null,
  hasDrugsMisdemeanor: null,
  hasDuiFelony: null,
  hasDuiMisdemeanor: null,
  hasUnclassifiedFelony: null,
  hasUnclassifiedMisdemeanor: null,
  hasPropertyFelony: null,
  hasPropertyMisdemeanor: null,
  hasSexFelony: null,
  hasSexMisdemeanor: null,
  hasTheftFelony: null,
  hasTheftMisdemeanor: null,
  hasTheftByCheckFelony: null,
  hasTheftByCheckMisdemeanor: null,
  hasTrafficFelony: null,
  hasTrafficMisdemeanor: null,
  hasViolentCrimeFelony: null,
  hasViolentCrimeMisdemeanor: null,
  hasWeaponsFelony: null,
  hasWeaponsMisdemeanor: null,
  hasRegisteredSexOffender: null,
  hasRegisteredSexOffenderDobOnly: null,
  hasGlobalSanctions: null,
  hasGlobalSanctionsFuzzy: null,
  hasEvictionRecordsMin: null,
  hasEvictionRecordsMax: null,
  hasEvictionFilingsMin: null,
  hasEvictionFilingsMax: null,
};

export const defaultNoCriminalReportServiceErrors: ICriminalServiceErrors = {
  hasCriminalServiceError: null,
  hasGlobalSanctionsServiceError: null,
  hasSexOffenderServiceError: null,
  hasTimeFinishBlockOnCriminal: null,
  hasNameFormatBlockOnCriminal: null,
  hasSsnRequiredOnCriminal: null,
  hasUnknownBlockOnCriminal: null,
  blockedMessageOnCriminal: null,
};

export const defaultNoCreditReportServiceErrors: ICreditServiceErrors = {
  hasCreditBureauError: null,
  hasTimeFinishBlockOnCredit: null,
  hasNameFormatBlockOnCredit: null,
  hasSsnRequiredOnCredit: null,
  hasUnknownBlockOnCredit: null,
  blockedMessageOnCredit: null,
};

export const defaultCriminalReportServiceErrors: ICriminalServiceErrors = {
  ...defaultNoCriminalReportServiceErrors,
  hasCriminalServiceError: false,
  hasGlobalSanctionsServiceError: false,
  hasSexOffenderServiceError: false,
  hasTimeFinishBlockOnCriminal: false,
  hasNameFormatBlockOnCriminal: false,
  hasSsnRequiredOnCriminal: false,
  hasUnknownBlockOnCriminal: false,
};

export const defaultCreditReportServiceErrors: ICreditServiceErrors = {
  ...defaultNoCreditReportServiceErrors,
  hasCreditBureauError: false,
  hasTimeFinishBlockOnCredit: false,
  hasNameFormatBlockOnCredit: false,
  hasSsnRequiredOnCredit: false,
  hasUnknownBlockOnCredit: false,
};

export enum BlockedServiceErrors {
  CRIMINAL = 'Criminal generated an error code (1004) that does not exists in the database',
  CREDIT_BUREAU = 'The Credit Bureau returned an error response',
  GLOBAL_SANCTIONS = 'GlobalSanction generated an error code (0) that does not exists in the database',
  SEX_OFFENDER = 'SexOffender generated an error code (1004) that does not exists in the database',
  TIME_FINISH = 'Update of timefinish for status record was not done',
  NAME_FORMAT = 'SSNV Service FAILURE: (045/INVALID SURNAME)',
  SSN_REQUIRED = 'SSNV Service FAILURE: (403/SS# REQUIRED TO ACCESS CONSUMERS FILE)',
  SSN_MISSING_DATA = 'SSNV Service FAILURE: (FADV-1002/Missing SSN data)',
  CREDIT_FREEZE = 'The Credit Report has been frozen by the applicant',
}

export const BlockedServiceStatusErrorMapper: IDictionaryHash<any> = {
  Credit: {
    hasCreditBureauError: [BlockedServiceErrors.CREDIT_BUREAU],
    hasTimeFinishBlockOnCredit: [BlockedServiceErrors.TIME_FINISH],
    hasNameFormatBlockOnCredit: [BlockedServiceErrors.NAME_FORMAT],
    hasSsnRequiredOnCredit: [BlockedServiceErrors.SSN_REQUIRED, BlockedServiceErrors.SSN_MISSING_DATA],
  },
  Criminal: {
    hasCriminalServiceError: [BlockedServiceErrors.CRIMINAL],
    hasGlobalSanctionsServiceError: [BlockedServiceErrors.GLOBAL_SANCTIONS],
    hasSexOffenderServiceError: [BlockedServiceErrors.SEX_OFFENDER],
    hasTimeFinishBlockOnCriminal: [BlockedServiceErrors.TIME_FINISH],
    hasNameFormatBlockOnCriminal: [BlockedServiceErrors.NAME_FORMAT],
    hasSsnRequiredOnCriminal: [BlockedServiceErrors.SSN_REQUIRED, BlockedServiceErrors.SSN_MISSING_DATA],
  },
};

export const BlockedServiceStatusMessageMapper: IDictionaryHash<string> = {
  Credit: 'blockedMessageOnCredit',
  Criminal: 'blockedMessageOnCriminal',
};

export const BlockedServiceUnknownErrorMapper: IDictionaryHash<string> = {
  Credit: 'hasUnknownBlockOnCredit',
  Criminal: 'hasUnknownBlockOnCriminal',
};
