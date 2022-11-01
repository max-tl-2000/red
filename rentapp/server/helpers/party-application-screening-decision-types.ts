/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ICreditReport, ICriminalReport } from '../workers/screening/v2/helpers/report-data-builder';
import { IDictionaryHash } from '../../../common/types/base-types';
import { IApplicationData, IParsedServiceStatusV2 } from './applicant-types';

export enum MemberType {
  GUARANTOR = 'guarantor',
  RESIDENT = 'resident',
  OCCUPANT = 'occupant',
  CORPORATION = 'corporation',
}

export enum ReportStatus {
  PENDING = 'pending',
  COMPILING = 'compiling',
  COMPLETED = 'completed',
  BLOCKED_ADDRESS = 'blockedAddress',
  BLOCKED_CREDIT_FREEZE = 'blockedCreditFreeze',
  BLOCKED_DISPUTE = 'blockedDispute',
  ERROR = 'error',
  NOT_APPLICABLE = 'notApplicable',
}

export interface ICriminalServiceErrors {
  hasCriminalServiceError: boolean | null;
  hasGlobalSanctionsServiceError: boolean | null;
  hasSexOffenderServiceError: boolean | null;
  hasTimeFinishBlockOnCriminal: boolean | null;
  hasNameFormatBlockOnCriminal: boolean | null;
  hasSsnRequiredOnCriminal: boolean | null;
  hasUnknownBlockOnCriminal: boolean | null;
  blockedMessageOnCriminal: string | null;
}

export interface ICreditServiceErrors {
  hasCreditBureauError: boolean | null;
  hasTimeFinishBlockOnCredit: boolean | null;
  hasNameFormatBlockOnCredit: boolean | null;
  hasSsnRequiredOnCredit: boolean | null;
  hasUnknownBlockOnCredit: boolean | null;
  blockedMessageOnCredit: string | null;
}

export interface IApplicantScreeningData extends ICriminalServiceErrors, ICreditServiceErrors {
  memberType: MemberType;
  guarantors: Array<string>;
  personId: string;
  hasCompletedCreditReport: boolean | null;
  hasCompletedCriminalReport: boolean | null;
  hasCompilingCreditReport: boolean | null;
  hasCompilingCriminalReport: boolean | null;
  hasPendingCreditReport: boolean | null;
  hasPendingCriminalReport: boolean | null;
  hasCreditFreeze: boolean | null;
  hasDisputedCreditReport: boolean | null;
  hasDisputedCriminalReport: boolean | null;
  hasAddressErroredCreditReport: boolean | null;
  hasAddressErroredCriminalReport: boolean | null;
  hasErroredCreditReport: boolean | null;
  hasErroredCriminalReport: boolean | null;
  hasExpiredCreditReport: boolean | null;
  hasExpiredCriminalReport: boolean | null;
  hasInternationalAddress: boolean | null;
  monthlyIncome: number | null;
  liquidAssets: number | null;
  creditScore: number | null;
  hasNoEstablishedCredit: boolean | null;
  hasBankruptcy: boolean | null;
  hasForeclosure: boolean | null;
  hasLegalItems: boolean | null;
  hasTaxLiens: boolean | null;
  hasMortgageDebt: boolean | null;
  hasPropertyRentalDebt: boolean | null;
  hasUtilityDebt: boolean | null;
  hasRentalCollections: boolean | null;
  hasDrugsFelony: boolean | null;
  hasDrugsMisdemeanor: boolean | null;
  hasDuiFelony: boolean | null;
  hasDuiMisdemeanor: boolean | null;
  hasUnclassifiedFelony: boolean | null;
  hasUnclassifiedMisdemeanor: boolean | null;
  hasPropertyFelony: boolean | null;
  hasPropertyMisdemeanor: boolean | null;
  hasSexFelony: boolean | null;
  hasSexMisdemeanor: boolean | null;
  hasTheftFelony: boolean | null;
  hasTheftMisdemeanor: boolean | null;
  hasTheftByCheckFelony: boolean | null;
  hasTheftByCheckMisdemeanor: boolean | null;
  hasTrafficFelony: boolean | null;
  hasTrafficMisdemeanor: boolean | null;
  hasViolentCrimeFelony: boolean | null;
  hasViolentCrimeMisdemeanor: boolean | null;
  hasWeaponsFelony: boolean | null;
  hasWeaponsMisdemeanor: boolean | null;
  hasRegisteredSexOffender: boolean | null;
  hasRegisteredSexOffenderDobOnly: boolean | null;
  hasGlobalSanctions: boolean | null;
  hasGlobalSanctionsFuzzy: boolean | null;
  hasEvictionRecordsMin: boolean | null;
  hasEvictionRecordsMax: boolean | null;
  hasEvictionFilingsMin: boolean | null;
  hasEvictionFilingsMax: boolean | null;
  hasNsfOrLatePayMin: boolean | null;
  hasNsfOrLatePayMax: boolean | null;
  hasEvictionNotice: boolean | null;
  hasLeaseViolation: boolean | null;
  hasSuspiciousSsn: boolean | null;
}

type ApplicationQuoteTerm = {
  monthlyRent: number;
  monthlyTotalRent: number;
  termLength: number;
};

export interface IApplicationQuote {
  quoteId: string;
  startDate: Date;
  quoteTerms: ApplicationQuoteTerm[];
  propertyId?: string;
}

export enum CreditScreeningCriteria {
  APPROVED = 'approved',
  DECLINED = 'declined',
  NOT_APPLICABLE = 'notApplicable',
  SSN_REVIEW_REQUIRED = 'ssnReviewRequired',
  GUARANTOR_REQUIRED = 'guarantorRequired',
  INCREASED_DEPOSIT_REQUIRED = 'increasedDepositRequired',
  INCREASED_DEPOSIT_OR_GUARANTOR_REQUIRED = 'increasedDepositOrGuarantorRequired',
}

export enum CriminalScreeningCriteria {
  REPORT = 'report',
  DECLINED = 'declined',
  NOT_APPLICABLE = 'notApplicable',
}

export enum GuarantorResidentRelationship {
  INDIVIDUAL_GUARANTORS = 'individualGuarantors',
  PARTY_GUARANTOR = 'partyGuarantor',
}

export interface IApplicationScreeningCriteria {
  guarantorResidentRelationship: GuarantorResidentRelationship;
  monthlyResidentIncomeDebtMultiple: number;
  monthlyGuarantorIncomeDebtMultiple: number;
  monthlyResidentIncomeMultiple: number;
  monthlyGuarantorIncomeMultiple: number;
  excessiveIssuesCount: number;
  hasGroupResidentIncomes: boolean;
  hasGroupGuarantorIncomes: boolean;
  hasGroupResidentCreditScores: boolean;
  hasGroupGuarantorCreditScores: boolean;
  fullLeaseLiquidAssetMultiple: number;
  approvedResidentCreditScore: number;
  declinedResidentCreditScore: number;
  approvedGuarantorCreditScore: number;
  declinedGuarantorCreditScore: number;
  defaultResidentCreditScore: number;
  defaultGuarantorCreditScore: number;
  applicantsInsufficientIncome: CreditScreeningCriteria;
  applicantsCreditScoreApproved: CreditScreeningCriteria;
  applicantsCreditScoreDeclined: CreditScreeningCriteria;
  applicantsCreditScoreBetween: CreditScreeningCriteria;
  applicantsNoEstablishedCredit: CreditScreeningCriteria;
  applicantsBankruptcy: CreditScreeningCriteria;
  applicantsForeclosure: CreditScreeningCriteria;
  applicantsLegalItem: CreditScreeningCriteria;
  applicantsTaxLien: CreditScreeningCriteria;
  applicantsPropertyDebt: CreditScreeningCriteria;
  applicantsMortgageDebt: CreditScreeningCriteria;
  applicantsUtilityDebt: CreditScreeningCriteria;
  applicantsEvictionOrEvictionFiling: CreditScreeningCriteria;
  applicantsExcessiveIssues: CreditScreeningCriteria;
  applicantsSsnSuspicious: CreditScreeningCriteria;
  guarantorsInsufficientIncome: CreditScreeningCriteria;
  guarantorsCreditScoreApproved: CreditScreeningCriteria;
  guarantorsCreditScoreDeclined: CreditScreeningCriteria;
  guarantorsCreditScoreBetween: CreditScreeningCriteria;
  guarantorsNoEstablishedCredit: CreditScreeningCriteria;
  guarantorsBankruptcy: CreditScreeningCriteria;
  guarantorsForeclosure: CreditScreeningCriteria;
  guarantorsLegalItem: CreditScreeningCriteria;
  guarantorsTaxLien: CreditScreeningCriteria;
  guarantorsPropertyDebt: CreditScreeningCriteria;
  guarantorsMortgageDebt: CreditScreeningCriteria;
  guarantorsUtilityDebt: CreditScreeningCriteria;
  guarantorsEvictionOrEvictionFiling: CreditScreeningCriteria;
  guarantorsExcessiveIssues: CreditScreeningCriteria;
  guarantorsSsnSuspicious: CreditScreeningCriteria;
  drugsFelony: CriminalScreeningCriteria;
  drugsMisdemeanor: CriminalScreeningCriteria;
  duiFelony: CriminalScreeningCriteria;
  duiMisdemeanor: CriminalScreeningCriteria;
  unclassifiedFelony: CriminalScreeningCriteria;
  unclassifiedMisdemeanor: CriminalScreeningCriteria;
  propertyFelony: CriminalScreeningCriteria;
  propertyMisdemeanor: CriminalScreeningCriteria;
  sexFelony: CriminalScreeningCriteria;
  sexMisdemeanor: CriminalScreeningCriteria;
  theftFelony: CriminalScreeningCriteria;
  theftMisdemeanor: CriminalScreeningCriteria;
  theftByCheckFelony: CriminalScreeningCriteria;
  theftByCheckMisdemeanor: CriminalScreeningCriteria;
  trafficFelony: CriminalScreeningCriteria;
  trafficMisdemeanor: CriminalScreeningCriteria;
  violentCrimeFelony: CriminalScreeningCriteria;
  violentCrimeMisdemeanor: CriminalScreeningCriteria;
  weaponsFelony: CriminalScreeningCriteria;
  weaponsMisdemeanor: CriminalScreeningCriteria;
  registeredSexOffender: CriminalScreeningCriteria;
  globalSanctions: CriminalScreeningCriteria;
}

export interface IPartyApplicationScreeningData {
  decisionId: string;
  applicants: Array<IApplicantScreeningData>;
  quotes: Array<IApplicationQuote>;
  criteria: IApplicationScreeningCriteria;
}

export interface IPropertyApplicationSettings {
  applicationSettings: IDictionaryHash<any>;
  propertyId: string;
}

export type PartyApplicantReport = {
  reportName: string;
  applicationData: IApplicationData;
  reportData: ICreditReport | ICriminalReport;
  status: string;
  isReportExpired: boolean | null;
  serviceStatus: IParsedServiceStatusV2 | null;
  serviceBlockedStatus: string | null;
};

export interface IPartyApplicantData {
  personId: string;
  leaseType: string;
  memberType: string;
  criminalApplicantReport: PartyApplicantReport;
  creditApplicantReport: PartyApplicantReport;
}

export interface IPartyScreeningCriteria {
  propertyPartySettingsId: string;
  partyType: string;
  propertyId: string;
  screeningCriteria: IApplicationScreeningCriteria;
}

export interface IApplicationSettingsFilter {
  leaseType: string;
  memberType: MemberType;
}
