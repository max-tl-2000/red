/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { IAuditEntity, IDataDiff, IDictionaryHash } from '../../../common/types/base-types';

export interface IScreeningReportSettings {
  creditReportRequiredFlag: boolean;
  criminalReportRequiredFlag: boolean;
  creditReportValidForPeriod: number;
  criminalReportValidForPeriod: number;
}

export interface IScreeningReportSettingsOnActiveParties {
  propertyId: string;
  leaseType: string;
  memberType: string;
  applicantSettings: IScreeningReportSettings;
}

type AddressLocality = {
  city: string;
  zip5: string;
  state: string;
};

type AddressNormalized = {
  city: string;
  line1: string;
  line2?: string;
  state: string;
  address: string;
  postalCode: string;
  unparsedAddress: string;
};

export type ApplicationAddress = {
  locality?: AddressLocality;
  normalized?: AddressNormalized;
  enteredByUser: AddressNormalized;
};

export interface IApplicationData {
  email: string;
  phone?: string;
  suffix?: string;
  address?: ApplicationAddress;
  lastName?: string;
  middleName?: string;
  firstName: string;
  addressLine?: string;
  dateOfBirth?: string;
  grossIncome?: number;
  grossIncomeMonthly?: number;
  reportCopyRequested?: boolean;
  grossIncomeFrequency?: string;
  ssn?: string;
  itin?: string;
  haveInternationalAddress?: boolean;
  requestWithSSN?: boolean;
  socSecNumber?: string;
  applicantId?: string;
  personId?: string;
  type?: string;
}

export interface IApplicantData extends IAuditEntity {
  id?: string;
  personId: string;
  propertyId: string;
  applicationData: IApplicationData;
  applicationDataTimestamps?: object | null;
  applicationDataDiff?: IDataDiff | null;
  startDate: Date;
  endDate?: Date | null;
  validUntil?: Date | null;
  updatedByUserId?: string;
}

export interface IApplicantDataNotCommitted extends IAuditEntity {
  id?: string;
  personId: string;
  partyId: string;
  partyApplicationId: string;
  applicationData: IApplicationData;
  paymentCompleted: boolean;
}

export interface IApplicantReport extends IAuditEntity {
  id?: string;
  personId: string;
  reportName: string;
  applicantDataId: string;
  status: string;
  serviceStatus?: object | null;
  completedAt?: Date | string | null;
  mergedAt?: Date | null;
  validUntil?: Date | null;
  obsoletedBy?: string;
  creditBureau?: string;
  reportData?: object | null;
  reportDocument?: string;
  isAlerted?: boolean;
}

export interface IApplicantReportRequestTracking extends IAuditEntity {
  id?: string;
  applicantReportId?: string;
  personId?: string;
  reportName: string;
  requestApplicantId?: string;
  propertyId: string;
  requestType?: string;
  forcedNew?: boolean;
  rawRequest?: string;
  externalReportId?: string;
  isAlerted?: boolean;
  isObsolete?: boolean;
  requestEndedAt?: Date;
  hasTimedOut?: boolean;
  timezone?: string;
}

export interface IApplicantReportRequestTrackingWithSettings extends IApplicantReportRequestTracking {
  applicantFullName: string;
  applicantSettings: IScreeningReportSettings;
}

export enum ScreeningResponseOrigin {
  HTTP = 'http',
  POLL = 'poll',
  PUSH = 'push',
}

export interface IApplicantReportResponseTracking extends IAuditEntity {
  id?: string;
  screeningRequestId?: string;
  status?: string;
  blockedReason?: string;
  serviceStatus?: object;
  serviceBlockedStatus?: string;
  rawResponse?: IDictionaryHash<any>;
  origin?: ScreeningResponseOrigin;
}

export interface IRequestApplicantReportArgs {
  applicantReportId: string;
  personId: string;
  reportName: string;
  applicationData: IApplicationData;
  propertyId: string;
  screeningTypeRequested?: string;
  forcedNew?: boolean;
}

export interface IScreeningReportOptions {
  requestType: string;
  reportId?: string;
  version?: string;
  storeRequest?: boolean;
  submissionRequestId?: string;
  reportName?: string;
}

export interface IFadvApplicantData {
  tenantId: string;
  applicants: Array<IApplicationData>;
  partyApplicationId?: string;
}

export interface IRentData {
  rent: number;
  leaseTermMonths: number;
  deposit: number;
}

export interface IScreeningReportData {
  rentData: IRentData;
  propertyId: string;
  applicantData: IFadvApplicantData;
}

export interface IReportRequestData {
  screeningReportData: IScreeningReportData;
  screeningReportOptions: IScreeningReportOptions;
}

interface I$ {
  applicantid: string;
}

interface IResult {
  _: string;
  $: I$;
}

interface IApplicantResults {
  Result: IResult[];
}

export interface ICriteria {
  ApplicantResults: IApplicantResults[];
  CriteriaID: number;
  PassFail: Array<string>;
  CriteriaDescription: Array<string>;
  CriteriaType: Array<string>;
  Override: Array<string>;
}

interface IParsedApplicantResults {
  [key: string]: string;
}

export interface IParsedCriteria {
  passFail: string;
  criteriaDescription: string;
  criteriaId: string;
  criteriaType: string;
  override: string;
  applicantResults: IParsedApplicantResults;
}

export interface IParsedCriteriaObject {
  [key: string]: IParsedCriteria;
}

export interface IScreeningReportCustomRecord {
  screeningRequestId: string;
  version: string;
  [key: string]: any;
}

interface IService$ {
  Name: string;
  Date: string;
}

export interface IFadvService {
  _: string;
  $: IService$;
}

export interface IFadvServiceStatus {
  Service: IFadvService[];
}

interface IParsedServiceV2 {
  status: string;
  updatedAt: string;
}

export interface IParsedServiceStatusV2 {
  [key: string]: IParsedServiceV2;
}

type AS_Information = {
  ApplicantIdentifier: string[];
};

export interface IFadvResponseApplicant {
  AS_Information: AS_Information[];
}

export interface IFormattedServicesV1 {
  serviceName: string;
  status: string;
}

export interface IParsedServiceStatusV1 {
  [key: string]: IFormattedServicesV1;
}

export interface IApplicantDecisionItem {
  applicantId: string;
  result: string;
  applicantName?: string;
}

export interface IFadvOverrideApplicant {
  [key: string]: string;
}
export interface IFadvOverride {
  Applicant: IFadvOverrideApplicant[];
}

export interface IFadvInstructions {
  ApplicantOverride: IFadvOverride[];
}

export interface IParsedOverrideRecommendation {
  id: string;
  text: string;
}

export interface IScreeningKeyValuePair {
  Name: Array<string>;
  Value: Array<any>;
}

export interface IScreeningCustomRecord {
  Record: Array<IScreeningKeyValuePair>;
}

// TODO: Finish defining each property
export interface IScreeningResponseValidation {
  isValid: boolean;
  errors: string[];
}

export interface IApplicantScreening {
  Request: Array<any>;
  LeaseTerms: Array<any>;
  Response: Array<any>;
  Applicant: Array<any>;
  CustomRecords: Array<IScreeningCustomRecord>;
  CustomRecordsExtended: Array<any>;
  [key: string]: any;
}

export interface IScreeningResponse {
  ApplicantScreening?: IApplicantScreening;
}

export interface IParsedResponse extends IAuditEntity {
  MonthlyRent: number;
  criteriaResult: IParsedCriteriaObject;
  externalId: string;
  TransactionNumber: string;
  ReportDate: string;
  ApplicationDecision?: string;
  Status: string;
  RequestID_Returned: string;
  tenantId: string;
  customRecords?: IScreeningReportCustomRecord | null;
  ErrorCode?: string;
  ErrorDescription?: string;
  BlockedStatus?: string;
  CreditBureau?: string;
  serviceStatus?: IParsedServiceStatusV1 | IParsedServiceStatusV2;
  BackgroundReport: string;
  ApplicantDecision: IApplicantDecisionItem[];
  recommendations: IParsedOverrideRecommendation[];
}

export type creditInformation = {
  creditScore?: number;
  creditAssessment?: string;
  applicantId?: string;
};

export interface IParseApplicantDecisionOptions {
  includeApplicantName?: boolean;
  creditInformation?: creditInformation[];
}
